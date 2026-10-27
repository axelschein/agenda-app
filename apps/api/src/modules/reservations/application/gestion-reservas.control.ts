import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { ReservationAdminView } from "@agenda-app/shared";
import { AgendaDatabase } from "../../../persistence/agenda-database.js";
import { CatalogoControl } from "../../services/index.js";
import { PersonalControl } from "../../users/index.js";
import { minutosAHora, ZONA_HORARIA } from "../../availability/index.js";

/** Motivo fijo definido en el criterio de aceptación de PP2-13. */
export const MOTIVO_RECHAZO = "rechazado por el negocio";

interface TurnoAdminRow {
  id: string;
  servicio_id: string;
  peluquero_id: string;
  cliente_email: string;
  fecha: string;
  inicio: number;
  duracion_minutos: number;
  precio_centavos: number;
  servicio_nombre: string;
  servicio_duracion_minutos: number;
  estado: ReservationAdminView["estado"];
  motivo_cancelacion: string;
}

/** Gestión de reservas del negocio (Panel del Admin/Peluquero). */
@Injectable()
export class GestionReservasControl {
  constructor(
    private readonly database: AgendaDatabase,
    private readonly catalogo: CatalogoControl,
    private readonly personal: PersonalControl,
  ) {}

  private readonly seleccion = `
    SELECT t.id, t.servicio_id, t.peluquero_id, c.email AS cliente_email,
           t.fecha, t.inicio, t.duracion_minutos, t.precio_centavos,
           t.servicio_nombre, t.servicio_duracion_minutos, t.estado, t.motivo_cancelacion
    FROM turno t JOIN cliente c ON c.id = t.cliente_id`;

  consultarTodas(): ReservationAdminView[] {
    const rows = this.database.db
      .prepare(`${this.seleccion} ORDER BY t.fecha, t.inicio`)
      .all() as unknown as TurnoAdminRow[];
    return rows.map((row) => this.vista(row));
  }

  rechazar(id: string): ReservationAdminView {
    return this.database.transaction(() => {
      const turno = this.buscar(id);
      if (turno.estado !== "Pendiente")
        throw new BadRequestException(
          "Solo se puede rechazar un turno pendiente.",
        );
      this.database.db
        .prepare(
          "UPDATE turno SET estado='Cancelado', motivo_cancelacion=? WHERE id=?",
        )
        .run(MOTIVO_RECHAZO, id);
      this.database.db
        .prepare(
          "INSERT INTO auditoria_turno(turno_id,accion,ocurrido_en) VALUES (?,'RESERVA_RECHAZADA',?)",
        )
        .run(id, new Date().toISOString());
      return this.vista(this.buscar(id));
    });
  }

  private buscar(id: string): TurnoAdminRow {
    const row = this.database.db
      .prepare(`${this.seleccion} WHERE t.id = ?`)
      .get(id) as unknown as TurnoAdminRow | undefined;
    if (!row) throw new NotFoundException("No se encontró la reserva indicada.");
    return row;
  }

  private vista(row: TurnoAdminRow): ReservationAdminView {
    const servicio = {
      ...this.catalogo.obtenerHistorico(row.servicio_id),
      nombre: row.servicio_nombre,
      duracionMinutos: row.servicio_duracion_minutos,
      precio: row.precio_centavos / 100,
    };
    return {
      id: row.id,
      estado: row.estado,
      clienteEmail: row.cliente_email,
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
