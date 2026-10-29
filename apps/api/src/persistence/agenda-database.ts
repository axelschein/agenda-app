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
        precio_centavos INTEGER NOT NULL CHECK(precio_centavos >= 0),
        activo INTEGER NOT NULL DEFAULT 1 CHECK(activo IN (0,1))
      );
      `);
    this.db.exec("BEGIN IMMEDIATE");
    try {
      // Upgrade databases created before the catalogue management story.
      const serviceColumns = this.db
        .prepare("PRAGMA table_info(servicio)")
        .all() as { name: string }[];
      if (!serviceColumns.some((column) => column.name === "activo")) {
        this.db.exec(
          "ALTER TABLE servicio ADD COLUMN activo INTEGER NOT NULL DEFAULT 1 CHECK(activo IN (0,1))",
        );
      }
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS peluquero (id TEXT PRIMARY KEY NOT NULL, nombre TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS perfil_peluquero (
          peluquero_id TEXT PRIMARY KEY NOT NULL REFERENCES peluquero(id),
          telefono TEXT NOT NULL DEFAULT '',
          activo INTEGER NOT NULL DEFAULT 1 CHECK(activo IN (0,1))
        );
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
          servicio_nombre TEXT NOT NULL DEFAULT '',
          servicio_duracion_minutos INTEGER NOT NULL DEFAULT 60 CHECK(servicio_duracion_minutos BETWEEN 1 AND 1440),
          estado TEXT NOT NULL CHECK(estado IN ('Pendiente','Confirmado','En curso','Completado','Cancelado')),
          motivo_cancelacion TEXT NOT NULL DEFAULT '',
          creado_en TEXT NOT NULL, UNIQUE(cliente_id, solicitud_id)
        );
      `);
      const turnColumns = this.db.prepare("PRAGMA table_info(turno)").all() as { name: string }[];
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS auditoria_usuario (
          id INTEGER PRIMARY KEY,
          usuario_id TEXT NOT NULL REFERENCES peluquero(id),
          actor_email TEXT NOT NULL,
          accion TEXT NOT NULL,
          detalle TEXT NOT NULL,
          ocurrido_en TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS auditoria_usuario_usuario ON auditoria_usuario(usuario_id, ocurrido_en);
      `);
      if (!turnColumns.some((column) => column.name === "servicio_nombre")) {
        this.db.exec("ALTER TABLE turno ADD COLUMN servicio_nombre TEXT NOT NULL DEFAULT ''");
        this.db.exec("UPDATE turno SET servicio_nombre=(SELECT nombre FROM servicio WHERE servicio.id=turno.servicio_id)");
      }
      if (!turnColumns.some((column) => column.name === "servicio_duracion_minutos")) {
        this.db.exec("ALTER TABLE turno ADD COLUMN servicio_duracion_minutos INTEGER NOT NULL DEFAULT 60");
        this.db.exec("UPDATE turno SET servicio_duracion_minutos=(SELECT duracion_minutos FROM servicio WHERE servicio.id=turno.servicio_id)");
      }
      // Upgrade databases created before the reservation management story (PP2-13/PP2-14).
      if (!turnColumns.some((column) => column.name === "motivo_cancelacion")) {
        this.db.exec("ALTER TABLE turno ADD COLUMN motivo_cancelacion TEXT NOT NULL DEFAULT ''");
      }
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
    this.db.exec(`
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
      CREATE TABLE IF NOT EXISTS pago (
        id TEXT PRIMARY KEY NOT NULL,
        turno_id TEXT NOT NULL REFERENCES turno(id),
        solicitud_id TEXT NOT NULL,
        metodo TEXT NOT NULL CHECK(metodo IN ('Efectivo','Transferencia')),
        monto_centavos INTEGER NOT NULL CHECK(monto_centavos >= 0),
        estado TEXT NOT NULL DEFAULT 'Registrado' CHECK(estado IN ('Registrado','Anulado')),
        motivo_anulacion TEXT NOT NULL DEFAULT '',
        creado_en TEXT NOT NULL,
        UNIQUE(turno_id, solicitud_id)
      );
      -- Un solo cobro activo por turno; tras anular se puede volver a cobrar.
      CREATE UNIQUE INDEX IF NOT EXISTS pago_turno_activo ON pago(turno_id) WHERE estado <> 'Anulado';
      CREATE TABLE IF NOT EXISTS auditoria_pago (
        id INTEGER PRIMARY KEY, pago_id TEXT NOT NULL REFERENCES pago(id),
        accion TEXT NOT NULL, ocurrido_en TEXT NOT NULL
      );
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
