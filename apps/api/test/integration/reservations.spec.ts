import { beforeEach, afterEach, describe, it, expect } from "@jest/globals";
import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { mkdtempSync, rmSync } from "node:fs";
import { join, resolve, dirname, basename } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID, scryptSync } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { AppModule } from "../../src/app.module.js";
import { AgendaDatabase } from "../../src/persistence/agenda-database.js";

const fecha = "2099-01-05",
  dia = new Date(fecha + "T12:00:00Z").getUTCDay();
const selection = {
  servicioId: "corte",
  peluqueroId: "ana",
  fecha,
  horaInicio: "09:00",
};
const password = "IntegrationPassword";
const salt = Buffer.alloc(16, 2);
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

describe("Reservas — integración HTTP y SQLite temporal", () => {
  let apps: INestApplication[],
    app: INestApplication,
    database: AgendaDatabase,
    folder: string;
  let savedEnv: Record<string, string | undefined>;
  const envKeys = ["AGENDA_DB_PATH", "AUTH_USERS_JSON", "AUTH_SESSION_SECRET"];
  async function createApp() {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    const instance = module.createNestApplication();
    instance.useLogger(false);
    await instance.init();
    apps.push(instance);
    return instance;
  }
  async function login(email = "cliente@example.com", target = app) {
    const response = await request(target.getHttpServer())
      .post("/auth/login")
      .send({ email, password })
      .expect(200);
    return response.headers["set-cookie"] as unknown as string[];
  }
  beforeEach(async () => {
    apps = [];
    savedEnv = Object.fromEntries(
      envKeys.map((key) => [key, process.env[key]]),
    );
    folder = mkdtempSync(join(tmpdir(), "agenda-jest-"));
    process.env.AGENDA_DB_PATH = join(folder, "agenda.sqlite");
    process.env.AUTH_SESSION_SECRET =
      "integration-only-secret-at-least-32-characters";
    process.env.AUTH_USERS_JSON = JSON.stringify([
      { email: "cliente@example.com", role: "CLIENT", passwordHash },
      { email: "otro@example.com", role: "CLIENT", passwordHash },
      { email: "admin@example.com", role: "ADMIN", passwordHash },
    ]);
    app = await createApp();
    database = app.get(AgendaDatabase);
    database.db
      .prepare("INSERT INTO servicio(id,nombre,duracion_minutos,precio_centavos) VALUES (?,?,?,?)")
      .run("corte", "Corte de cabello", 45, 600000);
    database.db
      .prepare("INSERT INTO peluquero VALUES (?,?)")
      .run("ana", "Ana López");
    database.db
      .prepare("INSERT INTO horario_laboral VALUES (?,?,?,?)")
      .run("ana", dia, 540, 720);
  });
  afterEach(async () => {
    try {
      await Promise.all(apps.map((instance) => instance.close()));
    } finally {
      for (const key of envKeys) {
        if (savedEnv[key] === undefined) delete process.env[key];
        else process.env[key] = savedEnv[key];
      }
      // Only remove the directory created by this fixture, never the configured application DB.
      if (
        folder &&
        dirname(resolve(folder)) === resolve(tmpdir()) &&
        basename(folder).startsWith("agenda-jest-")
      )
        rmSync(folder, { recursive: true, force: true });
    }
  });
  it("migra sin pérdida una base anterior al catálogo y sus instantáneas", () => {
    const migrationFolder = mkdtempSync(join(tmpdir(), "agenda-migration-"));
    const migrationPath = join(migrationFolder, "agenda.sqlite");
    const previousPath = process.env.AGENDA_DB_PATH;
    const oldDatabase = new DatabaseSync(migrationPath);
    try {
      oldDatabase.exec(`
        CREATE TABLE servicio (id TEXT PRIMARY KEY, nombre TEXT NOT NULL, duracion_minutos INTEGER NOT NULL, precio_centavos INTEGER NOT NULL);
        CREATE TABLE peluquero (id TEXT PRIMARY KEY, nombre TEXT NOT NULL);
        CREATE TABLE cliente (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE);
        CREATE TABLE turno (
          id TEXT PRIMARY KEY, solicitud_id TEXT NOT NULL, cliente_id TEXT NOT NULL REFERENCES cliente(id),
          servicio_id TEXT NOT NULL REFERENCES servicio(id), peluquero_id TEXT NOT NULL REFERENCES peluquero(id),
          fecha TEXT NOT NULL, inicio INTEGER NOT NULL, duracion_minutos INTEGER NOT NULL,
          precio_centavos INTEGER NOT NULL, estado TEXT NOT NULL, creado_en TEXT NOT NULL,
          UNIQUE(cliente_id, solicitud_id)
        );
        INSERT INTO servicio VALUES ('corte','Corte previo',45,600000);
        INSERT INTO peluquero VALUES ('ana','Ana');
        INSERT INTO cliente VALUES ('cliente-1','cliente@example.com');
        INSERT INTO turno VALUES ('turno-1','solicitud-1','cliente-1','corte','ana','2099-01-05',540,60,600000,'Pendiente','2026-01-01T00:00:00.000Z');
      `);
    } finally {
      oldDatabase.close();
    }

    let migrated: AgendaDatabase | undefined;
    try {
      process.env.AGENDA_DB_PATH = migrationPath;
      migrated = new AgendaDatabase();
      expect(migrated.db.prepare("SELECT activo FROM servicio WHERE id='corte'").get()).toMatchObject({ activo: 1 });
      expect(migrated.db.prepare("SELECT servicio_nombre, servicio_duracion_minutos FROM turno WHERE id='turno-1'").get()).toMatchObject({
        servicio_nombre: "Corte previo",
        servicio_duracion_minutos: 45,
      });
    } finally {
      migrated?.onModuleDestroy();
      if (previousPath === undefined) delete process.env.AGENDA_DB_PATH;
      else process.env.AGENDA_DB_PATH = previousPath;
      if (dirname(resolve(migrationFolder)) === resolve(tmpdir()) && basename(migrationFolder).startsWith("agenda-migration-"))
        rmSync(migrationFolder, { recursive: true, force: true });
    }
  });
  it("restringe las rutas según autenticación y rol", async () => {
    await request(app.getHttpServer())
      .get("/reservations/services")
      .expect(401);
    const admin = await login("admin@example.com");
    const client = await login();
    const catalog = await request(app.getHttpServer())
      .get("/reservations/services")
      .set("Cookie", admin)
      .expect(200);
    expect(catalog.body[0]).toMatchObject({
      id: "corte",
      duracionMinutos: 45,
      precio: 6000,
    });
    await request(app.getHttpServer())
      .post("/reservations")
      .set("Cookie", admin)
      .send(payload())
      .expect(403);
    await request(app.getHttpServer())
      .put("/availability/working-hours/ana")
      .set("Cookie", client)
      .send({ franjas: [] })
      .expect(403);
    await request(app.getHttpServer())
      .put("/availability/working-hours/ana")
      .set("Cookie", admin)
      .send({ franjas: [{ dia, inicio: "10:00", fin: "12:00" }] })
      .expect(200);
    const available = await request(app.getHttpServer())
      .get("/reservations/availability")
      .query(selection)
      .set("Cookie", client)
      .expect(200);
    expect(available.body.horarios).not.toContain("09:00");
    expect(available.body.horarios).toContain("10:00");
  });
  it("administra servicios solo como Admin y conserva instantáneas históricas", async () => {
    const admin = await login("admin@example.com");
    const client = await login();

    await request(app.getHttpServer())
      .post("/services")
      .set("Cookie", client)
      .send({ nombre: "Color", duracionMinutos: 90, precio: 14000 })
      .expect(403);

    await request(app.getHttpServer())
      .post("/services")
      .set("Cookie", admin)
      .send({ nombre: "  ", duracionMinutos: 90, precio: 14000 })
      .expect(400);
    await request(app.getHttpServer())
      .post("/services")
      .set("Cookie", admin)
      .send({ nombre: "Color", duracionMinutos: 90, precio: 14000.001 })
      .expect(400);

    const created = await request(app.getHttpServer())
      .post("/services")
      .set("Cookie", admin)
      .send({ nombre: "Color", duracionMinutos: 90, precio: 14000 })
      .expect(201);
    expect(created.body).toMatchObject({ nombre: "Color", activo: true });

    const updated = await request(app.getHttpServer())
      .put(`/services/${created.body.id}`)
      .set("Cookie", admin)
      .send({ nombre: "Coloración", duracionMinutos: 100, precio: 14500.5 })
      .expect(200);
    expect(updated.body).toMatchObject({ nombre: "Coloración", precio: 14500.5 });

    const summary = await request(app.getHttpServer())
      .post("/reservations/summary")
      .set("Cookie", client)
      .send(selection)
      .expect(201);
    const receipt = await request(app.getHttpServer())
      .post("/reservations")
      .set("Cookie", client)
      .send(payload({
        precioRevisado: summary.body.total,
        duracionRevisada: summary.body.duracionBloqueMinutos,
      }))
      .expect(201);

    await request(app.getHttpServer())
      .delete("/services/corte")
      .set("Cookie", admin)
      .expect(200);

    const activeCatalog = await request(app.getHttpServer())
      .get("/reservations/services")
      .set("Cookie", client)
      .expect(200);
    expect(activeCatalog.body.some((service: { id: string }) => service.id === "corte")).toBe(false);

    const adminCatalog = await request(app.getHttpServer())
      .get("/services/admin")
      .set("Cookie", admin)
      .expect(200);
    expect(adminCatalog.body.find((service: { id: string }) => service.id === "corte").activo).toBe(false);

    const historical = await request(app.getHttpServer())
      .get("/reservations/mine")
      .set("Cookie", client)
      .expect(200);
    expect(historical.body[0]).toMatchObject({
      id: receipt.body.id,
      servicio: { nombre: "Corte de cabello", duracionMinutos: 45 },
      total: 6000,
    });

    await request(app.getHttpServer())
      .patch("/services/corte/reactivate")
      .set("Cookie", admin)
      .expect(200);
    const reactivated = await request(app.getHttpServer())
      .get("/reservations/services")
      .set("Cookie", client)
      .expect(200);
    expect(reactivated.body.some((service: { id: string }) => service.id === "corte")).toBe(true);
  });

  it("registra Pendiente, evita duplicados y devuelve solo reservas propias", async () => {
    const cookie = await login(),
      data = payload({ clienteId: "suplantado" });
    await request(app.getHttpServer())
      .post("/reservations/summary")
      .set("Cookie", cookie)
      .send(selection)
      .expect(201);
    const created = await request(app.getHttpServer())
      .post("/reservations")
      .set("Cookie", cookie)
      .send(data)
      .expect(201);
    expect(created.body.estado).toBe("Pendiente");
    expect(created.body.duracionBloqueMinutos).toBe(60);
    const retry = await request(app.getHttpServer())
      .post("/reservations")
      .set("Cookie", cookie)
      .send(data)
      .expect(201);
    expect(retry.body.id).toBe(created.body.id);
    expect(
      database.db.prepare("SELECT COUNT(*) AS n FROM turno").get()?.n,
    ).toBe(1);
    expect(
      database.db.prepare("SELECT COUNT(*) AS n FROM auditoria_turno").get()?.n,
    ).toBe(1);
    const own = await request(app.getHttpServer())
      .get("/reservations/mine")
      .set("Cookie", cookie)
      .expect(200);
    expect(own.body).toHaveLength(1);
    const other = await login("otro@example.com");
    const foreign = await request(app.getHttpServer())
      .get("/reservations/mine")
      .set("Cookie", other)
      .expect(200);
    expect(foreign.body).toEqual([]);
  });
  it("rechaza precio adulterado y jornadas inválidas sin persistir cambios", async () => {
    const cookie = await login();
    await request(app.getHttpServer())
      .post("/reservations")
      .set("Cookie", cookie)
      .send(payload({ precioRevisado: 1 }))
      .expect(409);
    expect(
      database.db.prepare("SELECT COUNT(*) AS n FROM turno").get()?.n,
    ).toBe(0);
    const admin = await login("admin@example.com");
    await request(app.getHttpServer())
      .put("/availability/working-hours/ana")
      .set("Cookie", admin)
      .send({
        franjas: [
          { dia, inicio: "09:00", fin: "12:00" },
          { dia, inicio: "11:00", fin: "13:00" },
        ],
      })
      .expect(400);
    expect(
      database.db.prepare("SELECT COUNT(*) AS n FROM horario_laboral").get()?.n,
    ).toBe(1);
  });
  it("dos confirmaciones simultáneas con conexiones distintas producen una reserva y un conflicto", async () => {
    const second = await createApp(),
      firstCookie = await login(),
      secondCookie = await login("otro@example.com", second);
    const responses = await Promise.all([
      request(app.getHttpServer())
        .post("/reservations")
        .set("Cookie", firstCookie)
        .send(payload()),
      request(second.getHttpServer())
        .post("/reservations")
        .set("Cookie", secondCookie)
        .send(payload()),
    ]);
    expect(responses.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(
      database.db.prepare("SELECT COUNT(*) AS n FROM turno").get()?.n,
    ).toBe(1);
    // Reopen a third connection: the reservation is on disk, not only in process memory.
    const reopened = new AgendaDatabase();
    try {
      expect(
        reopened.db.prepare("SELECT COUNT(*) AS n FROM turno").get()?.n,
      ).toBe(1);
    } finally {
      reopened.onModuleDestroy();
    }
    // The DB constraint also protects writes that bypass the application check.
    expect(() =>
      database.db
        .prepare(
          "INSERT INTO turno (id,solicitud_id,cliente_id,servicio_id,peluquero_id,fecha,inicio,duracion_minutos,precio_centavos,estado,creado_en) SELECT ?, ?, cliente_id, servicio_id, peluquero_id, fecha, inicio+15, duracion_minutos, precio_centavos, estado, creado_en FROM turno LIMIT 1",
        )
        .run(randomUUID(), randomUUID()),
    ).toThrow("HORARIO_OCUPADO");
  });
  it("revierte la reserva completa si falla el registro de auditoría", async () => {
    database.db.exec(
      "CREATE TRIGGER audit_failure BEFORE INSERT ON auditoria_turno BEGIN SELECT RAISE(ABORT, 'simulated storage failure'); END;",
    );
    const cookie = await login();
    await request(app.getHttpServer())
      .post("/reservations")
      .set("Cookie", cookie)
      .send(payload())
      .expect(500);
    expect(
      database.db.prepare("SELECT COUNT(*) AS n FROM turno").get()?.n,
    ).toBe(0);
    expect(
      database.db.prepare("SELECT COUNT(*) AS n FROM cliente").get()?.n,
    ).toBe(0);
  });
  it("persiste la configuración del Admin y conserva la duración de reservas previas", async () => {
    const admin = await login("admin@example.com"),
      client = await login();
    const initial = await request(app.getHttpServer())
      .get("/availability/settings")
      .set("Cookie", client)
      .expect(200);
    expect(initial.body.duracionBloqueMinutos).toBe(60);
    await request(app.getHttpServer())
      .put("/availability/settings")
      .set("Cookie", client)
      .send({ duracionBloqueMinutos: 90 })
      .expect(403);
    for (const invalid of [0, -1, 1.5, 1441, "60", null])
      await request(app.getHttpServer())
        .put("/availability/settings")
        .set("Cookie", admin)
        .send({ duracionBloqueMinutos: invalid })
        .expect(400);
    await request(app.getHttpServer())
      .put("/availability/settings")
      .set("Cookie", admin)
      .send({ duracionBloqueMinutos: 90 })
      .expect(200);
    const available = await request(app.getHttpServer())
      .get("/reservations/availability")
      .query(selection)
      .set("Cookie", client)
      .expect(200);
    expect(available.body.horarios).toEqual(["09:00", "10:30"]);
    await request(app.getHttpServer())
      .post("/reservations")
      .set("Cookie", client)
      .send(payload())
      .expect(409);
    const data = payload({ duracionRevisada: 90 });
    const saved = await request(app.getHttpServer())
      .post("/reservations")
      .set("Cookie", client)
      .send(data)
      .expect(201);
    expect(saved.body.duracionBloqueMinutos).toBe(90);
    expect(saved.body.servicio.duracionMinutos).toBe(45);
    await request(app.getHttpServer())
      .put("/availability/settings")
      .set("Cookie", admin)
      .send({ duracionBloqueMinutos: 30 })
      .expect(200);
    const retry = await request(app.getHttpServer())
      .post("/reservations")
      .set("Cookie", client)
      .send(data)
      .expect(201);
    expect(retry.body.id).toBe(saved.body.id);
    expect(retry.body.duracionBloqueMinutos).toBe(90);
    const mine = await request(app.getHttpServer())
      .get("/reservations/mine")
      .set("Cookie", client)
      .expect(200);
    expect(mine.body[0].duracionBloqueMinutos).toBe(90);
    const reopened = new AgendaDatabase();
    try {
      expect(
        reopened.db
          .prepare(
            "SELECT duracion_bloque_minutos n FROM configuracion_agenda WHERE id=1",
          )
          .get()?.n,
      ).toBe(30);
    } finally {
      reopened.onModuleDestroy();
    }
  });
  it("explica que un bloque de seis horas no cabe en una jornada de tres y permite reservar al configurarlo en una hora", async () => {
    const admin = await login("admin@example.com"),
      client = await login();
    await request(app.getHttpServer())
      .put("/availability/settings")
      .set("Cookie", admin)
      .send({ duracionBloqueMinutos: 360 })
      .expect(200);
    const unavailable = await request(app.getHttpServer())
      .get("/reservations/availability")
      .query(selection)
      .set("Cookie", client)
      .expect(200);
    expect(unavailable.body.horarios).toEqual([]);
    expect(unavailable.body.motivoSinDisponibilidad).toContain("no cabe");
    await request(app.getHttpServer())
      .put("/availability/settings")
      .set("Cookie", admin)
      .send({ duracionBloqueMinutos: 60 })
      .expect(200);
    const available = await request(app.getHttpServer())
      .get("/reservations/availability")
      .query(selection)
      .set("Cookie", client)
      .expect(200);
    expect(available.body.horarios).toEqual(["09:00", "10:00", "11:00"]);
    const otherDay = new Date(selection.fecha + "T12:00:00Z");
    otherDay.setUTCDate(otherDay.getUTCDate() + 1);
    const closed = await request(app.getHttpServer())
      .get("/reservations/availability")
      .query({ ...selection, fecha: otherDay.toISOString().slice(0, 10) })
      .set("Cookie", client)
      .expect(200);
    expect(closed.body.motivoSinDisponibilidad).toContain("no tiene jornada");
  });
});
