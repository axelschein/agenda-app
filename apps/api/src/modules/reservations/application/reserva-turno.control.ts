import {
  BadRequestException,
  ConflictException,
  Injectable,
} from "@nestjs/common";
import type {
  AuthenticatedUser,
  CreateReservation,
  ReservationReceipt,
  ReservationSelection,
  ReservationSummary,
} from "@agenda-app/shared";
import { randomUUID } from "node:crypto";
import { AgendaDatabase } from "../../../persistence/agenda-database.js";
import { CatalogoControl } from "../../services/index.js";
import { ClienteIdentidadControl, PersonalControl } from "../../users/index.js";
import { AgendaControl, ZONA_HORARIA } from "../../availability/index.js";
import {
  horaAMinutos,
  minutosAHora,
  validarFecha,
} from "../../availability/index.js";
interface TurnoRow {
  id: string;
  solicitud_id: string;
  servicio_id: string;
  peluquero_id: string;
  fecha: string;
  inicio: number;
  duracion_minutos: number;
  precio_centavos: number;
  servicio_nombre: string;
  servicio_duracion_minutos: number;
  estado: ReservationReceipt["estado"];
}
@Injectable()
export class ReservaTurnoControl {
  constructor(
    private readonly database: AgendaDatabase,
    private readonly catalogo: CatalogoControl,
    private readonly personal: PersonalControl,
    private readonly clientes: ClienteIdentidadControl,
    private readonly agenda: AgendaControl,
  ) {}
  private seleccion(value: unknown): ReservationSelection {
    if (!value || typeof value !== "object")
      throw new BadRequestException("Indicá los datos de la reserva.");
    const v = value as Record<string, unknown>;
    if (
      typeof v.servicioId !== "string" ||
      typeof v.peluqueroId !== "string" ||
      !v.servicioId ||
      !v.peluqueroId
    )
      throw new BadRequestException("Seleccioná servicio y peluquero/a.");
    const fecha = validarFecha(v.fecha);
    horaAMinutos(v.horaInicio);
    return {
      servicioId: v.servicioId,
      peluqueroId: v.peluqueroId,
      fecha,
      horaInicio: v.horaInicio as string,
    };
  }
  generarResumen(value: unknown): ReservationSummary {
    const selection = this.seleccion(value);
    const servicio = this.catalogo.obtener(selection.servicioId),
      peluquero = this.personal.obtener(selection.peluqueroId);
    if (
      !this.agenda
        .consultar(selection.servicioId, selection.peluqueroId, selection.fecha)
        .horarios.includes(selection.horaInicio)
    )
      throw new ConflictException(
        "Ese horario ya no está disponible. Elegí otro.",
      );
    return {
      ...selection,
      servicio,
      peluquero,
      total: servicio.precio,
      duracionBloqueMinutos:
        this.agenda.consultarConfiguracion().duracionBloqueMinutos,
      zonaHoraria: ZONA_HORARIA,
    };
  }
  registrar(value: unknown, user: AuthenticatedUser): ReservationReceipt {
    const selection = this.seleccion(value),
      body = value as CreateReservation;
    if (
      typeof body.solicitudId !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        body.solicitudId,
      )
    )
      throw new BadRequestException("Identificador de solicitud inválido.");
    if (
      !Number.isFinite(body.precioRevisado) ||
      !Number.isInteger(body.duracionRevisada)
    )
      throw new BadRequestException("Revisá el resumen antes de confirmar.");
    try {
      return this.database.transaction(() => {
        const db = this.database.db;
        const clienteId = this.clientes.vincular(user.email);
        const previous = db
          .prepare(
            "SELECT * FROM turno WHERE cliente_id = ? AND solicitud_id = ?",
          )
          .get(clienteId, body.solicitudId) as unknown as TurnoRow | undefined;
        if (previous) {
          if (
            previous.servicio_id !== selection.servicioId ||
            previous.peluquero_id !== selection.peluqueroId ||
            previous.fecha !== selection.fecha ||
            previous.inicio !== horaAMinutos(selection.horaInicio) ||
            previous.precio_centavos !==
              Math.round(body.precioRevisado * 100) ||
            previous.duracion_minutos !== body.duracionRevisada
          )
            throw new ConflictException(
              "La solicitud ya corresponde a otra reserva.",
            );
          return this.recibo(previous);
        }
        const summary = this.generarResumen(selection);
        if (
          summary.total !== body.precioRevisado ||
          summary.duracionBloqueMinutos !== body.duracionRevisada
        )
          throw new ConflictException(
            "El servicio o la duración del bloque cambió. Volvé a revisar el resumen.",
          );
        const id = randomUUID(),
          now = new Date().toISOString();
        db.prepare(
          "INSERT INTO turno (id,solicitud_id,cliente_id,servicio_id,peluquero_id,fecha,inicio,duracion_minutos,precio_centavos,servicio_nombre,servicio_duracion_minutos,estado,creado_en) VALUES (?,?,?,?,?,?,?,?,?,?,?,'Pendiente',?)",
        ).run(
          id,
          body.solicitudId,
          clienteId,
          selection.servicioId,
          selection.peluqueroId,
          selection.fecha,
          horaAMinutos(selection.horaInicio),
          summary.duracionBloqueMinutos,
          Math.round(summary.total * 100),
          summary.servicio.nombre,
          summary.servicio.duracionMinutos,
          now,
        );
        db.prepare(
          "INSERT INTO auditoria_turno(turno_id,accion,ocurrido_en) VALUES (?,'RESERVA_CREADA',?)",
        ).run(id, now);
        return { ...summary, id, estado: "Pendiente" };
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes("HORARIO_OCUPADO"))
        throw new ConflictException(
          "Otro cliente tomó ese horario. Elegí otro.",
        );
      throw error;
    }
  }
  consultarPropios(user: AuthenticatedUser): ReservationReceipt[] {
    const clienteId = this.clientes.obtener(user.email);
    if (!clienteId) return [];
    const rows = this.database.db
      .prepare("SELECT * FROM turno WHERE cliente_id=? ORDER BY fecha, inicio")
      .all(clienteId) as unknown as TurnoRow[];
    return rows.map((row) => this.recibo(row));
  }
  private recibo(row: TurnoRow): ReservationReceipt {
    // El turno guarda su propia instantánea del servicio (nombre, duración y
    // precio al confirmar). El recibo se arma solo con esos datos de la fila y
    // no depende del catálogo vivo, que pudo cambiar o darse de baja.
    const servicio = {
      id: row.servicio_id,
      nombre: row.servicio_nombre,
      duracionMinutos: row.servicio_duracion_minutos,
      precio: row.precio_centavos / 100,
    };
    return {
      id: row.id,
      estado: row.estado,
      servicioId: row.servicio_id,
      peluqueroId: row.peluquero_id,
      servicio,
      peluquero: this.personal.obtener(row.peluquero_id),
      fecha: row.fecha,
      horaInicio: minutosAHora(row.inicio),
      total: servicio.precio,
      duracionBloqueMinutos: row.duracion_minutos,
      zonaHoraria: ZONA_HORARIA,
    };
  }
}
