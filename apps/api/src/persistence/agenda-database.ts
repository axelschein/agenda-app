import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

/** SQLite adapter for the local MVP. Only the API owns this connection. */
@Injectable()
export class AgendaDatabase implements OnModuleDestroy {
  readonly db: DatabaseSync;
  constructor() {
    const path =
      process.env.AGENDA_DB_PATH ??
      resolve(process.cwd(), "../../data/agenda.sqlite");
    if (path !== ":memory:")
      mkdirSync(dirname(resolve(path)), { recursive: true });
    this.db = new DatabaseSync(path, { timeout: 5000 });
    this.db.exec(`
      PRAGMA foreign_keys = ON;
      CREATE TABLE IF NOT EXISTS configuracion_agenda (
        id INTEGER PRIMARY KEY CHECK(id = 1),
        duracion_bloque_minutos INTEGER NOT NULL CHECK(duracion_bloque_minutos BETWEEN 1 AND 1440)
      );
      INSERT INTO configuracion_agenda VALUES (1,60) ON CONFLICT(id) DO NOTHING;
      CREATE TABLE IF NOT EXISTS servicio (
        id TEXT PRIMARY KEY NOT NULL, nombre TEXT NOT NULL,
        duracion_minutos INTEGER NOT NULL CHECK(duracion_minutos > 0 AND duracion_minutos <= 1440),
        precio_centavos INTEGER NOT NULL CHECK(precio_centavos >= 0)
      );
      CREATE TABLE IF NOT EXISTS peluquero (id TEXT PRIMARY KEY NOT NULL, nombre TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS cliente (id TEXT PRIMARY KEY NOT NULL, email TEXT NOT NULL UNIQUE);
      CREATE TABLE IF NOT EXISTS horario_laboral (
        peluquero_id TEXT NOT NULL REFERENCES peluquero(id), dia INTEGER NOT NULL CHECK(dia BETWEEN 0 AND 6),
        inicio INTEGER NOT NULL CHECK(inicio BETWEEN 0 AND 1439),
        fin INTEGER NOT NULL CHECK(fin > inicio AND fin <= 1440),
        PRIMARY KEY(peluquero_id, dia, inicio)
      );
      CREATE TABLE IF NOT EXISTS turno (
        id TEXT PRIMARY KEY NOT NULL, solicitud_id TEXT NOT NULL, cliente_id TEXT NOT NULL REFERENCES cliente(id),
        servicio_id TEXT NOT NULL REFERENCES servicio(id), peluquero_id TEXT NOT NULL REFERENCES peluquero(id),
        fecha TEXT NOT NULL, inicio INTEGER NOT NULL CHECK(inicio BETWEEN 0 AND 1439),
        duracion_minutos INTEGER NOT NULL CHECK(duracion_minutos > 0 AND inicio + duracion_minutos <= 1440),
        precio_centavos INTEGER NOT NULL CHECK(precio_centavos >= 0),
        estado TEXT NOT NULL CHECK(estado IN ('Pendiente','Confirmado','En curso','Completado','Cancelado')),
        creado_en TEXT NOT NULL, UNIQUE(cliente_id, solicitud_id)
      );
      CREATE VIEW IF NOT EXISTS ocupacion_agenda AS
        SELECT peluquero_id, fecha, inicio, inicio + duracion_minutos AS fin
        FROM turno WHERE estado <> 'Cancelado';
      CREATE INDEX IF NOT EXISTS turno_agenda ON turno(peluquero_id, fecha, inicio);
      CREATE TABLE IF NOT EXISTS auditoria_turno (
        id INTEGER PRIMARY KEY, turno_id TEXT NOT NULL REFERENCES turno(id),
        accion TEXT NOT NULL, ocurrido_en TEXT NOT NULL
      );
      CREATE TRIGGER IF NOT EXISTS turno_sin_superposicion BEFORE INSERT ON turno
      WHEN NEW.estado <> 'Cancelado' AND EXISTS (
        SELECT 1 FROM turno t WHERE t.peluquero_id = NEW.peluquero_id AND t.fecha = NEW.fecha
        AND t.estado <> 'Cancelado' AND t.inicio < NEW.inicio + NEW.duracion_minutos
        AND NEW.inicio < t.inicio + t.duracion_minutos
      ) BEGIN SELECT RAISE(ABORT, 'HORARIO_OCUPADO'); END;
    `);
  }
  transaction<T>(action: () => T): T {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const result = action();
      this.db.exec("COMMIT");
      return result;
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }
  onModuleDestroy() {
    this.db.close();
  }
}
