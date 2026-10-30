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

const password = "IntegrationPassword";
const salt = Buffer.alloc(16, 9);
const passwordHash = [
  "scrypt",
  salt.toString("base64url"),
  scryptSync(password, salt, 64).toString("base64url"),
].join("$");

describe("Indicadores y reportes de Administración (PP2-40)", () => {
  let app: INestApplication, db: AgendaDatabase["db"], folder: string;
  let savedEnv: Record<string, string | undefined>;
  const envKeys = ["AGENDA_DB_PATH", "AUTH_USERS_JSON", "AUTH_SESSION_SECRET"];

  async function login(email: string) {
    const r = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email, password })
      .expect(200);
    return r.headers["set-cookie"] as unknown as string[];
  }
  function turno(
    id: string,
    clienteId: string,
    peluqueroId: string,
    servicioId: string,
    nombre: string,
    fecha: string,
    inicio: number,
    precio: number,
    estado: string,
  ) {
    db.prepare(
      "INSERT INTO turno (id,solicitud_id,cliente_id,servicio_id,peluquero_id,fecha,inicio,duracion_minutos,precio_centavos,servicio_nombre,servicio_duracion_minutos,estado,creado_en) VALUES (?,?,?,?,?,?,?,60,?,?,45,?,?)",
    ).run(id, randomUUID(), clienteId, servicioId, peluqueroId, fecha, inicio, precio, nombre, estado, new Date().toISOString());
  }
  function pago(id: string, turnoId: string, monto: number) {
    db.prepare(
      "INSERT INTO pago (id,turno_id,solicitud_id,metodo,monto_centavos,estado,creado_en) VALUES (?,?,?,'Efectivo',?, 'Registrado',?)",
    ).run(id, turnoId, randomUUID(), monto, new Date().toISOString());
  }

  beforeEach(async () => {
    savedEnv = Object.fromEntries(envKeys.map((k) => [k, process.env[k]]));
    folder = mkdtempSync(join(tmpdir(), "agenda-jest-"));
    process.env.AGENDA_DB_PATH = join(folder, "agenda.sqlite");
    process.env.AUTH_SESSION_SECRET =
      "integration-only-secret-at-least-32-characters";
    process.env.AUTH_USERS_JSON = JSON.stringify([
      { email: "cliente@example.com", role: "CLIENT", passwordHash },
      { email: "admin@example.com", role: "ADMIN", passwordHash },
    ]);
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    app.useLogger(false);
    await app.init();
    db = app.get(AgendaDatabase).db;
    // catálogo y personal
    db.prepare("INSERT INTO servicio(id,nombre,duracion_minutos,precio_centavos) VALUES (?,?,?,?)").run("corte", "Corte", 45, 600000);
    db.prepare("INSERT INTO servicio(id,nombre,duracion_minutos,precio_centavos) VALUES (?,?,?,?)").run("barba", "Barba", 30, 400000);
    db.prepare("INSERT INTO peluquero VALUES (?,?)").run("ana", "Ana");
    db.prepare("INSERT INTO peluquero VALUES (?,?)").run("beto", "Beto");
    db.prepare("INSERT INTO cliente VALUES (?,?)").run("cli", "cliente@example.com");
    db.prepare("INSERT INTO cliente VALUES (?,?)").run("otro", "otro@example.com");
    // escenario conocido (marzo 2099)
    turno("t1", "cli", "ana", "corte", "Corte", "2099-03-10", 540, 600000, "Confirmado");
    turno("t2", "cli", "ana", "corte", "Corte", "2099-03-10", 660, 600000, "Completado");
    turno("t3", "otro", "beto", "barba", "Barba", "2099-03-11", 540, 400000, "Confirmado");
    turno("t4", "cli", "ana", "corte", "Corte", "2099-03-12", 540, 600000, "Cancelado");
    pago("p1", "t1", 600000);
    pago("p2", "t2", 600000);
  });
  afterEach(async () => {
    try {
      await app.close();
    } finally {
      for (const k of envKeys) {
        if (savedEnv[k] === undefined) delete process.env[k];
        else process.env[k] = savedEnv[k];
      }
      if (folder && dirname(resolve(folder)) === resolve(tmpdir()) && basename(folder).startsWith("agenda-jest-"))
        rmSync(folder, { recursive: true, force: true });
    }
  });

  it("calcula indicadores (COUNT/SUM/AVG/JOIN) sobre datos conocidos", async () => {
    const admin = await login("admin@example.com");
    const r = await request(app.getHttpServer())
      .get("/reports/indicators")
      .query({ desde: "2099-03-01", hasta: "2099-03-31" })
      .set("Cookie", admin)
      .expect(200);
    const { resumen, serviciosMasPedidos, rendimientoPorPeluquero, turnosPorDia } = r.body;

    expect(resumen.turnos).toBe(4);
    expect(resumen.porEstado).toEqual([
      { estado: "Cancelado", cantidad: 1 },
      { estado: "Completado", cantidad: 1 },
      { estado: "Confirmado", cantidad: 2 },
    ]);
    expect(resumen.clientesActivos).toBe(2);
    expect(resumen.peluquerosActivos).toBe(2);
    expect(resumen.cobros).toBe(2);
    expect(resumen.ingresos).toBe(12000);
    expect(resumen.ticketPromedio).toBe(6000);

    expect(serviciosMasPedidos).toEqual([
      { servicio: "Corte", cantidad: 2 },
      { servicio: "Barba", cantidad: 1 },
    ]);
    expect(rendimientoPorPeluquero[0]).toEqual({ peluquero: "Ana", turnos: 2, ingresos: 12000 });
    expect(rendimientoPorPeluquero.find((x: { peluquero: string }) => x.peluquero === "Beto")).toEqual({
      peluquero: "Beto",
      turnos: 1,
      ingresos: 0,
    });
    expect(turnosPorDia).toEqual([
      { fecha: "2099-03-10", cantidad: 2 },
      { fecha: "2099-03-11", cantidad: 1 },
    ]);
  });

  it("un período sin turnos devuelve ceros y listas vacías", async () => {
    const admin = await login("admin@example.com");
    const r = await request(app.getHttpServer())
      .get("/reports/indicators")
      .query({ desde: "2099-06-01", hasta: "2099-06-30" })
      .set("Cookie", admin)
      .expect(200);
    expect(r.body.resumen).toMatchObject({ turnos: 0, ingresos: 0, ticketPromedio: 0, cobros: 0 });
    expect(r.body.serviciosMasPedidos).toEqual([]);
    expect(r.body.turnosPorDia).toEqual([]);
  });

  it("un Cliente no puede ver los indicadores de Administración", async () => {
    const cliente = await login("cliente@example.com");
    await request(app.getHttpServer())
      .get("/reports/indicators")
      .query({ desde: "2099-03-01", hasta: "2099-03-31" })
      .set("Cookie", cliente)
      .expect(403);
  });

  it("valida el período (fechas con formato correcto)", async () => {
    const admin = await login("admin@example.com");
    await request(app.getHttpServer())
      .get("/reports/indicators")
      .query({ desde: "no-es-fecha", hasta: "2099-03-31" })
      .set("Cookie", admin)
      .expect(400);
  });

  it("rechaza períodos de más de 31 días", async () => {
    const admin = await login("admin@example.com");
    await request(app.getHttpServer())
      .get("/reports/indicators")
      .query({ desde: "2099-03-01", hasta: "2099-04-01" })
      .set("Cookie", admin)
      .expect(400);
  });
});
