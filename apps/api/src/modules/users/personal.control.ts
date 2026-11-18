import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { BarberIndicatorSummary, BarberOption } from "@agenda-app/shared";
import { AgendaDatabase } from "../../persistence/agenda-database.js";
import { validarFecha } from "../availability/horarios.js";
import { randomUUID } from "node:crypto";

export interface PerfilPeluquero {
  id: string;
  nombre: string;
  telefono: string;
  activo: boolean;
}
@Injectable()
export class PersonalControl {
  constructor(private readonly database: AgendaDatabase) {}
  consultar(): BarberOption[] {
    return this.database.db
      .prepare("SELECT p.id, p.nombre FROM peluquero p LEFT JOIN perfil_peluquero pp ON pp.peluquero_id=p.id WHERE COALESCE(pp.activo,1)=1 ORDER BY p.nombre")
      .all() as unknown as BarberOption[];
  }
  obtener(id: string, incluirInactivo = false): BarberOption {
    const peluquero = incluirInactivo
      ? (this.database.db.prepare("SELECT id, nombre FROM peluquero WHERE id=?").get(id) as BarberOption | undefined)
      : this.consultar().find((p) => p.id === id);
    if (!peluquero)
      throw new NotFoundException(
        "El peluquero o la peluquera ya no está disponible.",
      );
    return peluquero;
  }

  existe(id: string): boolean {
    return Boolean(this.database.db.prepare("SELECT 1 AS existe FROM peluquero p LEFT JOIN perfil_peluquero pp ON pp.peluquero_id=p.id WHERE p.id=? AND COALESCE(pp.activo,1)=1").get(id));
  }

  perfil(id: string): PerfilPeluquero {
    const row = this.database.db
      .prepare("SELECT p.id, p.nombre, COALESCE(pp.telefono, '') AS telefono, COALESCE(pp.activo,1)=1 AS activo FROM peluquero p LEFT JOIN perfil_peluquero pp ON pp.peluquero_id=p.id WHERE p.id=?")
      .get(id) as (Omit<PerfilPeluquero, "activo"> & { activo: number }) | undefined;
    if (!row) throw new NotFoundException("No se encontró el perfil profesional.");
    return { ...row, activo: Boolean(row.activo) };
  }

  listarAdministracion(): PerfilPeluquero[] {
    const rows = this.database.db.prepare("SELECT p.id, p.nombre, COALESCE(pp.telefono, '') AS telefono, COALESCE(pp.activo,1) AS activo FROM peluquero p LEFT JOIN perfil_peluquero pp ON pp.peluquero_id=p.id ORDER BY p.nombre").all() as unknown as Array<Omit<PerfilPeluquero, "activo"> & { activo: number }>;
    return rows.map((row) => ({ ...row, activo: Boolean(row.activo) }));
  }

  crearPerfil(actorEmail: string, value: unknown): PerfilPeluquero {
    const input = this.validarDatos(value, true);
    const id = randomUUID();
    const perfil = { id, nombre: input.nombre, telefono: input.telefono, activo: true };
    this.database.transaction(() => {
      this.database.db.prepare("INSERT INTO peluquero(id,nombre) VALUES (?,?)").run(id, perfil.nombre);
      this.database.db.prepare("INSERT INTO perfil_peluquero(peluquero_id,telefono,activo) VALUES (?,?,1)").run(id, perfil.telefono);
      this.auditarPerfil(id, actorEmail, "PELUQUERO_CREADO", {}, perfil);
    });
    return perfil;
  }

  actualizarPerfil(id: string, actorEmail: string, value: unknown, permitirEstado = false): PerfilPeluquero {
    if (!value || typeof value !== "object") throw new BadRequestException("Indicá los datos del perfil.");
    const input = value as Record<string, unknown>;
    const allowed = permitirEstado ? ["nombre", "telefono", "activo"] : ["nombre", "telefono"];
    if (Object.keys(input).some((key) => !allowed.includes(key))) throw new BadRequestException("El perfil contiene campos no permitidos.");
    const before = this.perfil(id);
    if (input.nombre !== undefined && typeof input.nombre !== "string") throw new BadRequestException("El nombre debe ser texto.");
    if (input.telefono !== undefined && typeof input.telefono !== "string") throw new BadRequestException("El teléfono debe ser texto.");
    const nombre = typeof input.nombre === "string" ? input.nombre.trim() : before.nombre;
    const telefono = typeof input.telefono === "string" ? input.telefono.trim() : before.telefono;
    const activo = permitirEstado && typeof input.activo === "boolean" ? input.activo : before.activo;
    if (permitirEstado && input.activo !== undefined && typeof input.activo !== "boolean") throw new BadRequestException("El estado activo debe ser verdadero o falso.");
    if (!nombre) throw new BadRequestException("El nombre no puede quedar vacío.");
    const after: PerfilPeluquero = { ...before, nombre, telefono, activo };
    if (after.nombre === before.nombre && after.telefono === before.telefono && after.activo === before.activo) return before;
    this.database.transaction(() => {
      this.database.db
        .prepare("UPDATE peluquero SET nombre=? WHERE id=?")
        .run(after.nombre, id);
      this.database.db
        .prepare("INSERT INTO perfil_peluquero(peluquero_id, telefono, activo) VALUES (?, ?, ?) ON CONFLICT(peluquero_id) DO UPDATE SET telefono=excluded.telefono, activo=excluded.activo")
        .run(id, after.telefono, Number(after.activo));
      this.auditarPerfil(id, actorEmail, permitirEstado ? "PELUQUERO_ADMIN_ACTUALIZADO" : "PERFIL_PELUQUERO_ACTUALIZADO", before, after);
    });
    return after;
  }

  private validarDatos(value: unknown, requireName: boolean): { nombre: string; telefono: string } {
    if (!value || typeof value !== "object") throw new BadRequestException("Indicá los datos del perfil.");
    const input = value as Record<string, unknown>;
    if (Object.keys(input).some((key) => !["nombre", "telefono"].includes(key))) throw new BadRequestException("El perfil contiene campos no permitidos.");
    const nombre = typeof input.nombre === "string" ? input.nombre.trim() : "";
    const telefono = typeof input.telefono === "string" ? input.telefono.trim() : "";
    if (requireName && !nombre) throw new BadRequestException("El nombre es obligatorio.");
    if (input.telefono !== undefined && typeof input.telefono !== "string") throw new BadRequestException("El teléfono debe ser texto.");
    return { nombre, telefono };
  }

  private auditarPerfil(id: string, actorEmail: string, accion: string, antes: unknown, despues: unknown): void {
    this.database.db
      .prepare("INSERT INTO auditoria_usuario(usuario_id, actor_email, accion, detalle, ocurrido_en) VALUES (?, ?, ?, ?, ?)")
      .run(id, actorEmail, accion, JSON.stringify({ antes, despues }), new Date().toISOString());
  }

  indicadores(id: string, desdeValue: unknown, hastaValue: unknown): BarberIndicatorSummary {
    this.obtener(id);
    const desde = validarFecha(desdeValue);
    const hasta = validarFecha(hastaValue);
    if (desde > hasta) throw new BadRequestException("La fecha inicial no puede ser posterior a la fecha final.");
    const duracionDias = Math.round((Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / 86_400_000) + 1;
    if (duracionDias > 90) throw new BadRequestException("El período no puede superar los 90 días.");
    const periodoAnteriorHasta = desplazarFecha(desde, -1);
    const periodoAnteriorDesde = desplazarFecha(desde, -duracionDias);
    const resumen = this.database.db.prepare(`
      SELECT COUNT(*) AS turnosCompletados, COALESCE(SUM(precio_centavos), 0) AS ingresosCentavos
      FROM turno WHERE peluquero_id=? AND fecha BETWEEN ? AND ? AND estado='Completado'
    `).get(id, desde, hasta) as { turnosCompletados: number; ingresosCentavos: number };
    const periodoAnterior = this.database.db.prepare(`
      SELECT COUNT(*) AS turnosCompletados
      FROM turno WHERE peluquero_id=? AND fecha BETWEEN ? AND ? AND estado='Completado'
    `).get(id, periodoAnteriorDesde, periodoAnteriorHasta) as { turnosCompletados: number };
    const turnosPorDia = this.database.db.prepare(`
      SELECT fecha, COUNT(*) AS cantidad
      FROM turno WHERE peluquero_id=? AND fecha BETWEEN ? AND ? AND estado='Completado'
      GROUP BY fecha ORDER BY fecha
    `).all(id, desde, hasta) as unknown as BarberIndicatorSummary["turnosPorDia"];
    return {
      desde,
      hasta,
      turnosCompletados: resumen.turnosCompletados,
      ingresosEstimados: resumen.ingresosCentavos / 100,
      turnosPeriodoAnterior: periodoAnterior.turnosCompletados,
      turnosPorDia,
      rating: null,
    };
  }
}

function desplazarFecha(fecha: string, dias: number): string {
  const date = new Date(`${fecha}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + dias);
  return date.toISOString().slice(0, 10);
}
