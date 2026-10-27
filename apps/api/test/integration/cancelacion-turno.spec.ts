import { beforeEach, afterEach, describe, it, expect } from "@jest/globals";
import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { mkdtempSync, rmSync } from "node:fs";
import { join, resolve, dirname, basename } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID, scryptSync } from "node:crypto";
import { AppModule } from "../../src/app.module.js";
import { AgendaDatabase } from "../../src/persistence/agenda-database.js";
import { ahoraLocal } from "../../src/modules/availability/horarios.js";

const fecha = "2099-01-05",
  dia = new Date(fecha + "T12:00:00Z").getUTCDay();
const selection = {
  servicioId: "corte",
  peluqueroId: "ana",
  fecha,
  horaInicio: "09:00",
};
const password = "IntegrationPassword";
const salt = Buffer.alloc(16, 4);
const passwordHash = [
  "scrypt",
  salt.toString("base64url"),
  scryptSync(password, salt, 64).toString("base64url"),
].join("$");
const payload = (extra: Record<string, unknown> = {}) => ({
  ...selection,
  solicitudId: randomUUID(),
  precioRevisado: 6000,
  duracionRevisada: 60,
  ...extra,
});

describe("Cancelación de turno propio (PP2-14)", () => {
  let app: INestApplication, database: AgendaDatabase, folder: string;
  let savedEnv: Record<string, string | undefined>;
  const envKeys = ["AGENDA_DB_PATH", "AUTH_USERS_JSON", "AUTH_SESSION_SECRET"];
  async function login(email = "cliente@example.com") {
    const response = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email, password })
      .expect(200);
    return response.headers["set-cookie"] as unknown as string[];
  }
  async function reservar(cookie: string[]) {
    await request(app.getHttpServer())
      .post("/reservations/summary")
      .set("Cookie", cookie)
      .send(selection)
      .expect(201);
    const created = await request(app.getHttpServer())
      .post("/reservations")
      .set("Cookie", cookie)
      .send(payload())
      .expect(201);
    return created.body.id as string;
  }
  beforeEach(async () => {
    savedEnv = Object.fromEntries(envKeys.map((k) => [k, process.env[k]]));
    folder = mkdtempSync(join(tmpdir(), "agenda-jest-"));
    process.env.AGENDA_DB_PATH = join(folder, "agenda.sqlite");
    process.env.AUTH_SESSION_SECRET =
      "integration-only-secret-at-least-32-characters";
    process.env.AUTH_USERS_JSON = JSON.stringify([
      { email: "cliente@example.com", role: "CLIENT", passwordHash },
      { email: "otro@example.com", role: "CLIENT", passwordHash },
      { email: "admin@example.com", role: "ADMIN", passwordHash },
    ]);
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    app.useLogger(false);
    await app.init();
    database = app.get(AgendaDatabase);
    database.db
      .prepare(
        "INSERT INTO servicio(id,nombre,duracion_minutos,precio_centavos) VALUES (?,?,?,?)",
      )
      .run("corte", "Corte de cabello", 45, 600000);
    database.db.prepare("INSERT INTO peluquero VALUES (?,?)").run("ana", "Ana");
    database.db
      .prepare("INSERT INTO horario_laboral VALUES (?,?,?,?)")
      .run("ana", dia, 540, 720);
  });
  afterEach(async () => {
    try {
      await app.close();
    } finally {
      for (const key of envKeys) {
        if (savedEnv[key] === undefined) delete process.env[key];
        else process.env[key] = savedEnv[key];
      }
      if (
        folder &&
        dirname(resolve(folder)) === resolve(tmpdir()) &&
        basename(folder).startsWith("agenda-jest-")
      )
        rmSync(folder, { recursive: true, force: true });
    }
  });

  it("el Cliente cancela su turno, libera el horario y la peluquería lo ve", async () => {
    const client = await login(),
      admin = await login("admin@example.com");
    const turnoId = await reservar(client);

    const cancelled = await request(app.getHttpServer())
      .patch(`/reservations/${turnoId}/cancel`)
      .set("Cookie", client)
      .expect(200);
    expect(cancelled.body).toMatchObject({
      estado: "Cancelado",
      motivoCancelacion: "cancelado por el cliente",
    });

    const availability = await request(app.getHttpServer())
      .get("/reservations/availability")
      .query(selection)
      .set("Cookie", client)
      .expect(200);
    expect(availability.body.horarios).toContain("09:00");

    const panel = await request(app.getHttpServer())
      .get("/reservations/all")
      .set("Cookie", admin)
      .expect(200);
    expect(panel.body[0]).toMatchObject({
      estado: "Cancelado",
      motivoCancelacion: "cancelado por el cliente",
    });
  });

  it("no se puede cancelar un turno ajeno, ni cancelarlo dos veces", async () => {
    const client = await login(),
      other = await login("otro@example.com");
    const turnoId = await reservar(client);

    await request(app.getHttpServer())
      .patch(`/reservations/${turnoId}/cancel`)
      .set("Cookie", other)
      .expect(404);

    await request(app.getHttpServer())
      .patch(`/reservations/${turnoId}/cancel`)
      .set("Cookie", client)
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/reservations/${turnoId}/cancel`)
      .set("Cookie", client)
      .expect(400);
  });

  it("respeta la ventana de 24 h: no cancela un turno de hoy", async () => {
    const client = await login();
    await reservar(client); // crea el cliente en la base
    const clienteId = (
      database.db
        .prepare("SELECT id FROM cliente WHERE email=?")
        .get("cliente@example.com") as { id: string }
    ).id;
    const hoy = ahoraLocal().fecha;
    database.db
      .prepare(
        "INSERT INTO turno (id,solicitud_id,cliente_id,servicio_id,peluquero_id,fecha,inicio,duracion_minutos,precio_centavos,servicio_nombre,servicio_duracion_minutos,estado,creado_en) VALUES (?,?,?,?,?,?,?,?,?,?,?,'Pendiente',?)",
      )
      .run(
        "turno-hoy",
        randomUUID(),
        clienteId,
        "corte",
        "ana",
        hoy,
        600,
        60,
        600000,
        "Corte de cabello",
        45,
        new Date().toISOString(),
      );
    await request(app.getHttpServer())
      .patch("/reservations/turno-hoy/cancel")
      .set("Cookie", client)
      .expect(400);
  });
});
