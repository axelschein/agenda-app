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

const fecha = "2099-02-10",
  dia = new Date(fecha + "T12:00:00Z").getUTCDay();
const selection = {
  servicioId: "corte",
  peluqueroId: "ana",
  fecha,
  horaInicio: "09:00",
};
const password = "IntegrationPassword";
const salt = Buffer.alloc(16, 5);
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

describe("Cobros de turnos (PP2-21)", () => {
  let app: INestApplication, database: AgendaDatabase, folder: string;
  let savedEnv: Record<string, string | undefined>;
  const envKeys = ["AGENDA_DB_PATH", "AUTH_USERS_JSON", "AUTH_SESSION_SECRET"];

  async function login(email: string) {
    const response = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email, password })
      .expect(200);
    return response.headers["set-cookie"] as unknown as string[];
  }
  async function turnoConfirmado(client: string[], admin: string[]) {
    await request(app.getHttpServer())
      .post("/reservations/summary")
      .set("Cookie", client)
      .send(selection)
      .expect(201);
    const created = await request(app.getHttpServer())
      .post("/reservations")
      .set("Cookie", client)
      .send(payload())
      .expect(201);
    const id = created.body.id as string;
    await request(app.getHttpServer())
      .patch(`/reservations/${id}/confirm`)
      .set("Cookie", admin)
      .expect(200);
    return id;
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

  it("Admin cobra un turno confirmado; persiste pago y auditoría, y el cliente lo ve", async () => {
    const client = await login("cliente@example.com"),
      admin = await login("admin@example.com");
    const turnoId = await turnoConfirmado(client, admin);

    const cobro = await request(app.getHttpServer())
      .post("/payments")
      .set("Cookie", admin)
      .send({ turnoId, metodo: "Efectivo", solicitudId: randomUUID() })
      .expect(201);
    expect(cobro.body).toMatchObject({
      estado: "Registrado",
      metodo: "Efectivo",
      monto: 6000,
      turnoId,
    });

    const auditoria = database.db
      .prepare(
        "SELECT accion FROM auditoria_pago WHERE pago_id=? ORDER BY id",
      )
      .all(cobro.body.id) as { accion: string }[];
    expect(auditoria.map((a) => a.accion)).toEqual(["PAGO_REGISTRADO"]);

    const historial = await request(app.getHttpServer())
      .get("/payments/mine")
      .set("Cookie", client)
      .expect(200);
    expect(historial.body).toHaveLength(1);
    expect(historial.body[0]).toMatchObject({ monto: 6000, metodo: "Efectivo" });

    const pendientes = await request(app.getHttpServer())
      .get("/payments/pending")
      .set("Cookie", admin)
      .expect(200);
    expect(pendientes.body.find((p: { turnoId: string }) => p.turnoId === turnoId)).toBeUndefined();
  });

  it("el reintento con la misma solicitud es idempotente y un segundo cobro distinto da conflicto", async () => {
    const client = await login("cliente@example.com"),
      admin = await login("admin@example.com");
    const turnoId = await turnoConfirmado(client, admin);
    const solicitudId = randomUUID();

    const primero = await request(app.getHttpServer())
      .post("/payments")
      .set("Cookie", admin)
      .send({ turnoId, metodo: "Transferencia", solicitudId })
      .expect(201);
    const reintento = await request(app.getHttpServer())
      .post("/payments")
      .set("Cookie", admin)
      .send({ turnoId, metodo: "Transferencia", solicitudId })
      .expect(201);
    expect(reintento.body.id).toBe(primero.body.id);
    expect(
      (database.db.prepare("SELECT COUNT(*) n FROM pago").get() as { n: number }).n,
    ).toBe(1);

    await request(app.getHttpServer())
      .post("/payments")
      .set("Cookie", admin)
      .send({ turnoId, metodo: "Efectivo", solicitudId: randomUUID() })
      .expect(409);
  });

  it("no cobra un turno pendiente y rechaza a quien no es Admin", async () => {
    const client = await login("cliente@example.com"),
      admin = await login("admin@example.com");
    // turno pendiente (sin confirmar)
    await request(app.getHttpServer())
      .post("/reservations/summary")
      .set("Cookie", client)
      .send(selection)
      .expect(201);
    const created = await request(app.getHttpServer())
      .post("/reservations")
      .set("Cookie", client)
      .send(payload())
      .expect(201);
    const turnoId = created.body.id as string;

    await request(app.getHttpServer())
      .post("/payments")
      .set("Cookie", admin)
      .send({ turnoId, metodo: "Efectivo", solicitudId: randomUUID() })
      .expect(400);

    // un Cliente no puede registrar cobros
    await request(app.getHttpServer())
      .post("/payments")
      .set("Cookie", client)
      .send({ turnoId, metodo: "Efectivo", solicitudId: randomUUID() })
      .expect(403);
  });

  it("al anular un cobro el turno vuelve a quedar pendiente de cobro y se puede volver a cobrar", async () => {
    const client = await login("cliente@example.com"),
      admin = await login("admin@example.com");
    const turnoId = await turnoConfirmado(client, admin);

    const cobro = await request(app.getHttpServer())
      .post("/payments")
      .set("Cookie", admin)
      .send({ turnoId, metodo: "Efectivo", solicitudId: randomUUID() })
      .expect(201);

    const anulado = await request(app.getHttpServer())
      .patch(`/payments/${cobro.body.id}/void`)
      .set("Cookie", admin)
      .expect(200);
    expect(anulado.body.estado).toBe("Anulado");
    expect(anulado.body.motivoAnulacion).toBeTruthy();

    const pendientes = await request(app.getHttpServer())
      .get("/payments/pending")
      .set("Cookie", admin)
      .expect(200);
    expect(
      pendientes.body.some((p: { turnoId: string }) => p.turnoId === turnoId),
    ).toBe(true);

    // vuelve a cobrarse sin conflicto
    await request(app.getHttpServer())
      .post("/payments")
      .set("Cookie", admin)
      .send({ turnoId, metodo: "Transferencia", solicitudId: randomUUID() })
      .expect(201);
  });

  it("el historial del Cliente solo incluye sus propios pagos", async () => {
    const client = await login("cliente@example.com"),
      otro = await login("otro@example.com"),
      admin = await login("admin@example.com");
    const turnoId = await turnoConfirmado(client, admin);
    await request(app.getHttpServer())
      .post("/payments")
      .set("Cookie", admin)
      .send({ turnoId, metodo: "Efectivo", solicitudId: randomUUID() })
      .expect(201);

    const ajeno = await request(app.getHttpServer())
      .get("/payments/mine")
      .set("Cookie", otro)
      .expect(200);
    expect(ajeno.body).toHaveLength(0);
  });
});
