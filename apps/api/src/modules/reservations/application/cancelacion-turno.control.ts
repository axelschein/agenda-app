import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { AuthenticatedUser, ReservationReceipt } from "@agenda-app/shared";
import { AgendaDatabase } from "../../../persistence/agenda-database.js";
import { ClienteIdentidadControl } from "../../users/index.js";
import { PersonalControl } from "../../users/index.js";
import { horaAMinutos, minutosAHora, ZONA_HORARIA } from "../../availability/index.js";
import { ahoraLocal } from "../../availability/horarios.js";

/** Anticipación mínima para que el Cliente cancele. Valor confirmado por el PO. */
export const VENTANA_CANCELACION_HORAS = 24;
/** Motivo registrado cuando cancela el propio Cliente (distinto del rechazo del negocio). */
export const MOTIVO_CANCELACION_CLIENTE = "cancelado por el cliente";

const CANCELABLES = ["Pendiente", "Confirmado"];

interface TurnoRow {
  id: string;
  servicio_id: string;
  peluquero_id: string;
  fecha: string;
  inicio: number;
  duracion_minutos: number;
  precio_centavos: number;
  servicio_nombre: string;
  servicio_duracion_minutos: number;
  estado: ReservationReceipt["estado"];
  motivo_cancelacion: string;
}

/** Cancelación de un turno propio por parte del Cliente (CU07). */
@Injectable()
export class CancelacionTurnoControl {
  constructor(
    private readonly database: AgendaDatabase,
    private readonly clientes: ClienteIdentidadControl,
    private readonly personal: PersonalControl,
  ) {}

  cancelar(id: string, user: AuthenticatedUser): ReservationReceipt {
    const clienteId = this.clientes.obtener(user.email);
    if (!clienteId)
      throw new NotFoundException("No encontramos ese turno entre los tuyos.");
    return this.database.transaction(() => {
      const turno = this.buscar(id, clienteId);
      if (!CANCELABLES.includes(turno.estado))
        throw new BadRequestException(
          `No se puede cancelar un turno ${turno.estado.toLowerCase()}.`,
        );
      if (this.minutosHastaInicio(turno) < VENTANA_CANCELACION_HORAS * 60)
        throw new BadRequestException(
          `La cancelación requiere al menos ${VENTANA_CANCELACION_HORAS} horas de anticipación. Contactá a la peluquería.`,
        );
      this.database.db
        .prepare(
          "UPDATE turno SET estado='Cancelado', motivo_cancelacion=? WHERE id=?",
        )
        .run(MOTIVO_CANCELACION_CLIENTE, id);
      this.database.db
        .prepare(
          "INSERT INTO auditoria_turno(turno_id,accion,ocurrido_en) VALUES (?,'RESERVA_CANCELADA_CLIENTE',?)",
        )
        .run(id, new Date().toISOString());
      return this.recibo(this.buscar(id, clienteId));
    });
  }

  private buscar(id: string, clienteId: string): TurnoRow {
    const row = this.database.db
      .prepare("SELECT * FROM turno WHERE id=? AND cliente_id=?")
      .get(id, clienteId) as unknown as TurnoRow | undefined;
    if (!row)
      throw new NotFoundException("No encontramos ese turno entre los tuyos.");
    return row;
  }

  /** Minutos de reloj local (America/Argentina/Buenos_Aires) entre ahora y el inicio del turno. */
  private minutosHastaInicio(turno: TurnoRow): number {
    const now = ahoraLocal();
    const dias =
      (Date.parse(turno.fecha + "T00:00:00Z") -
        Date.parse(now.fecha + "T00:00:00Z")) /
      86_400_000;
    return dias * 1440 + turno.inicio - horaAMinutos(now.hora);
  }

  private recibo(row: TurnoRow): ReservationReceipt {
    // Se arma con la instantánea de la fila, sin depender del catálogo vivo.
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
      ...(row.motivo_cancelacion
        ? { motivoCancelacion: row.motivo_cancelacion }
        : {}),
    };
  }
}
