import { afterEach, beforeEach, describe, expect, it } from "@jest/globals";
import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { mkdtempSync, rmSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID, scryptSync } from "node:crypto";
import { AppModule } from "../../src/app.module.js";
import { AgendaDatabase } from "../../src/persistence/agenda-database.js";

const fecha = "2099-01-05";
const password = "ProfessionalIntegrationPassword";
const salt = Buffer.alloc(16, 5);
const passwordHash = ["scrypt", salt.toString("base64url"), scryptSync(password, salt, 64).toString("base64url")].join("$");
const users = [
  { email: "cliente@example.com", role: "CLIENT", passwordHash },
  { email: "admin@example.com", role: "ADMIN", passwordHash },
  { email: "ana@example.com", role: "BARBER", peluqueroId: "ana", passwordHash },
  { email: "marco@example.com", role: "BARBER", peluqueroId: "marco", passwordHash },
  { email: "orphan@example.com", role: "BARBER", peluqueroId: "inexistente", passwordHash },
];

describe("PP2-22 flujo profesional", () => {
  let app: INestApplication;
  let database: AgendaDatabase;
  let folder: string;
  let previousEnv: Record<string, string | undefined>;
  const envKeys = ["AGENDA_DB_PATH", "AUTH_USERS_JSON", "AUTH_SESSION_SECRET"];

  async function login(email: string): Promise<string[]> {
    const response = await request(app.getHttpServer()).post("/auth/login").send({ email, password }).expect(200);
    return response.headers["set-cookie"] as unknown as string[];
  }

  async function reserve(cookie: string[], peluqueroId: string, horaInicio: string): Promise<string> {
    const selection = { servicioId: "corte", peluqueroId, fecha, horaInicio };
    const summary = await request(app.getHttpServer()).post("/reservations/summary").set("Cookie", cookie).send(selection).expect(201);
    const result = await request(app.getHttpServer()).post("/reservations").set("Cookie", cookie).send({
      ...selection,
      solicitudId: randomUUID(),
      precioRevisado: summary.body.total,
      duracionRevisada: summary.body.duracionBloqueMinutos,
    }).expect(201);
    return result.body.id as string;
  }

  beforeEach(async () => {
    previousEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
    folder = mkdtempSync(join(tmpdir(), "agenda-professional-"));
    process.env.AGENDA_DB_PATH = join(folder, "agenda.sqlite");
    process.env.AUTH_SESSION_SECRET = "professional-test-secret-at-least-32-characters";
    process.env.AUTH_USERS_JSON = JSON.stringify(users);
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    app.useLogger(false);
    await app.init();
    database = app.get(AgendaDatabase);
    database.db.prepare("INSERT INTO servicio(id,nombre,duracion_minutos,precio_centavos) VALUES (?,?,?,?)").run("corte", "Corte", 45, 600000);
    database.db.prepare("INSERT INTO peluquero VALUES (?,?)").run("ana", "Ana López");
    database.db.prepare("INSERT INTO peluquero VALUES (?,?)").run("marco", "Marco Ruiz");
    const day = new Date(`${fecha}T12:00:00Z`).getUTCDay();
    const hours = database.db.prepare("INSERT INTO horario_laboral VALUES (?,?,?,?)");
    hours.run("ana", day, 540, 780);
    hours.run("marco", day, 540, 780);
  });

  afterEach(async () => {
    try {
      await app.close();
    } finally {
      for (const key of envKeys) {
        if (previousEnv[key] === undefined) delete process.env[key];
        else process.env[key] = previousEnv[key]!;
      }
      if (folder && dirname(resolve(folder)) === resolve(tmpdir()) && basename(folder).startsWith("agenda-professional-")) {
        rmSync(folder, { recursive: true, force: true });
      }
    }
  });

  it("liga sesión al perfil, filtra agenda y limita transiciones a turnos propios pendientes", async () => {
    const client = await login("cliente@example.com");
    const ana = await login("ana@example.com");
    const marco = await login("marco@example.com");
    const anaConfirm = await reserve(client, "ana", "09:00");
    const anaReject = await reserve(client, "ana", "10:00");
    const marcoTurno = await reserve(client, "marco", "09:00");

    const anaAgenda = await request(app.getHttpServer()).get("/reservations/assigned").query({ desde: fecha, hasta: fecha }).set("Cookie", ana).expect(200);
    const marcoAgenda = await request(app.getHttpServer()).get("/reservations/assigned").query({ desde: fecha, hasta: fecha }).set("Cookie", marco).expect(200);
    expect(anaAgenda.body.map((turno: { id: string }) => turno.id).sort()).toEqual([anaConfirm, anaReject].sort());
    expect(marcoAgenda.body.map((turno: { id: string }) => turno.id)).toEqual([marcoTurno]);

    await request(app.getHttpServer()).get("/reservations/assigned").query({ desde: fecha, hasta: fecha }).set("Cookie", client).expect(403);
    await request(app.getHttpServer()).patch(`/reservations/${marcoTurno}/confirm`).set("Cookie", ana).expect(403);
    await request(app.getHttpServer()).patch(`/reservations/${anaConfirm}/confirm`).set("Cookie", ana).expect(200).expect(({ body }) => expect(body.estado).toBe("Confirmado"));
    await request(app.getHttpServer()).patch(`/reservations/${anaConfirm}/confirm`).set("Cookie", ana).expect(400);
    await request(app.getHttpServer()).patch(`/reservations/${anaReject}/reject-as-assigned`).set("Cookie", ana).expect(200).expect(({ body }) => expect(body).toMatchObject({ estado: "Cancelado", motivoCancelacion: "rechazado por el negocio" }));
    await request(app.getHttpServer()).patch(`/reservations/${anaReject}/reject-as-assigned`).set("Cookie", ana).expect(400);
    expect(database.db.prepare("SELECT accion FROM auditoria_turno WHERE turno_id=? ORDER BY id").all(anaConfirm)).toEqual([
      { accion: "RESERVA_CREADA" },
      { accion: "TURNO_CONFIRMADO_PELUQUERO" },
    ]);
    expect(database.db.prepare("SELECT accion FROM auditoria_turno WHERE turno_id=? ORDER BY id").all(anaReject)).toEqual([
      { accion: "RESERVA_CREADA" },
      { accion: "TURNO_RECHAZADO_PELUQUERO" },
    ]);
    await request(app.getHttpServer()).post("/auth/login").send({ email: "orphan@example.com", password }).expect(401);
  });

  it("permite consultar y editar el perfil propio, audita cambios y reserva el mantenimiento a Admin", async () => {
    const barber = await login("ana@example.com");
    const client = await login("cliente@example.com");
    const admin = await login("admin@example.com");
    const own = await request(app.getHttpServer()).get("/users/me").set("Cookie", barber).expect(200);
    expect(own.body).toMatchObject({ id: "ana", nombre: "Ana López", email: "ana@example.com", telefono: "" });
    await request(app.getHttpServer()).get("/users/me").set("Cookie", client).expect(403);
    await request(app.getHttpServer()).put("/users/me").set("Cookie", barber).send({ nombre: "Ana L.", telefono: "11223344", email: "otra@example.com" }).expect(400);
    const updated = await request(app.getHttpServer()).put("/users/me").set("Cookie", barber).send({ nombre: "Ana L.", telefono: "11223344" }).expect(200);
    expect(updated.body).toMatchObject({ id: "ana", nombre: "Ana L.", email: "ana@example.com", telefono: "11223344" });
    expect(database.db.prepare("SELECT accion, actor_email FROM auditoria_usuario WHERE usuario_id='ana'").all()).toEqual([{ accion: "PERFIL_PELUQUERO_ACTUALIZADO", actor_email: "ana@example.com" }]);

    await request(app.getHttpServer()).get("/users/admin/peluqueros").set("Cookie", client).expect(403);
    const created = await request(app.getHttpServer()).post("/users/admin/peluqueros").set("Cookie", admin).send({ nombre: "Lucía", telefono: "445566" }).expect(201);
    expect(created.body).toMatchObject({ nombre: "Lucía", telefono: "445566", activo: true });
    const inactive = await request(app.getHttpServer()).put(`/users/admin/peluqueros/${created.body.id}`).set("Cookie", admin).send({ activo: false }).expect(200);
    expect(inactive.body.activo).toBe(false);
    expect(database.db.prepare("SELECT COUNT(*) AS cantidad FROM auditoria_usuario WHERE usuario_id=?").get(created.body.id)?.cantidad).toBe(2);
  });

  it("calcula conteos e ingresos del profesional autenticado y compara con el día previo", async () => {
    const client = await login("cliente@example.com");
    const barber = await login("ana@example.com");
    const ownToday = await reserve(client, "ana", "09:00");
    const otherToday = await reserve(client, "marco", "09:00");
    const ownYesterday = await reserve(client, "ana", "10:00");
    database.db.prepare("UPDATE turno SET estado='Completado' WHERE id IN (?, ?, ?)").run(ownToday, otherToday, ownYesterday);
    database.db.prepare("UPDATE turno SET fecha='2099-01-04' WHERE id=?").run(ownYesterday);

    const result = await request(app.getHttpServer()).get("/users/me/indicators").query({ fecha }).set("Cookie", barber).expect(200);
    expect(result.body).toEqual({ desde: fecha, hasta: fecha, turnosCompletados: 1, ingresosEstimados: 6000, turnosPeriodoAnterior: 1, turnosPorDia: [{ fecha, cantidad: 1 }], rating: null });
    await request(app.getHttpServer()).get("/users/me/indicators").query({ fecha }).set("Cookie", client).expect(403);
  });
});
