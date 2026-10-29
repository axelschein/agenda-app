import { Injectable } from "@nestjs/common";
import type {
  AuthenticatedUser,
  MetodoPago,
  PaymentReceipt,
  PendingCharge,
} from "@agenda-app/shared";
import { METODOS_PAGO } from "@agenda-app/shared";
import { AgendaDatabase } from "../../../persistence/agenda-database.js";
import { PersonalControl, ClienteIdentidadControl } from "../../users/index.js";
import { minutosAHora } from "../../availability/index.js";

interface PendienteRow {
  id: string;
  fecha: string;
  inicio: number;
  servicio_nombre: string;
  peluquero_id: string;
  precio_centavos: number;
  estado: string;
  email: string;
}
interface HistorialRow {
  id: string;
  turno_id: string;
  metodo: MetodoPago;
  monto_centavos: number;
  estado: PaymentReceipt["estado"];
  motivo_anulacion: string;
  creado_en: string;
  turno_fecha: string;
  inicio: number;
  servicio_nombre: string;
  peluquero_id: string;
}

/** Consultas de la línea comercial (Clase 8: SELECT / WHERE / JOIN). */
@Injectable()
export class ConsultaComercialControl {
  constructor(
    private readonly database: AgendaDatabase,
    private readonly personal: PersonalControl,
    private readonly clientes: ClienteIdentidadControl,
  ) {}

  /** Métodos de pago habilitados para el formulario de cobro. */
  metodos(): MetodoPago[] {
    return [...METODOS_PAGO];
  }

  /** Turnos cobrables sin un cobro activo (Admin). */
  pendientes(): PendingCharge[] {
    const rows = this.database.db
      .prepare(
        `SELECT t.id, t.fecha, t.inicio, t.servicio_nombre, t.peluquero_id,
                t.precio_centavos, t.estado, c.email
         FROM turno t
         JOIN cliente c ON c.id = t.cliente_id
         WHERE t.estado IN ('Confirmado','Completado')
           AND NOT EXISTS (
             SELECT 1 FROM pago p
             WHERE p.turno_id = t.id AND p.estado <> 'Anulado'
           )
         ORDER BY t.fecha, t.inicio`,
      )
      .all() as unknown as PendienteRow[];
    return rows.map((row) => ({
      turnoId: row.id,
      fecha: row.fecha,
      horaInicio: minutosAHora(row.inicio),
      servicioNombre: row.servicio_nombre,
      peluquero: this.personal.obtener(row.peluquero_id).nombre,
      clienteEmail: row.email,
      monto: row.precio_centavos / 100,
      estadoTurno: row.estado,
    }));
  }

  /** Historial de pagos del Cliente autenticado (solo los propios). */
  historialCliente(user: AuthenticatedUser): PaymentReceipt[] {
    const clienteId = this.clientes.obtener(user.email);
    if (!clienteId) return [];
    const rows = this.database.db
      .prepare(
        `SELECT p.id, p.turno_id, p.metodo, p.monto_centavos, p.estado,
                p.motivo_anulacion, p.creado_en,
                t.fecha AS turno_fecha, t.inicio, t.servicio_nombre, t.peluquero_id
         FROM pago p
         JOIN turno t ON t.id = p.turno_id
         WHERE t.cliente_id = ?
         ORDER BY p.creado_en DESC`,
      )
      .all(clienteId) as unknown as HistorialRow[];
    return rows.map((row) => ({
      id: row.id,
      turnoId: row.turno_id,
      estado: row.estado,
      metodo: row.metodo,
      monto: row.monto_centavos / 100,
      fecha: row.creado_en,
      servicioNombre: row.servicio_nombre,
      turnoFecha: row.turno_fecha,
      turnoHora: minutosAHora(row.inicio),
      peluquero: this.personal.obtener(row.peluquero_id).nombre,
      ...(row.motivo_anulacion
        ? { motivoAnulacion: row.motivo_anulacion }
        : {}),
    }));
  }
}
