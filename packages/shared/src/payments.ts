export const METODOS_PAGO = ["Efectivo", "Transferencia"] as const;
export type MetodoPago = (typeof METODOS_PAGO)[number];

export const ESTADOS_PAGO = ["Registrado", "Anulado"] as const;
export type EstadoPago = (typeof ESTADOS_PAGO)[number];

/** Alta de un cobro: siempre sobre un turno, con un método válido. */
export interface RegistrarPago {
  turnoId: string;
  metodo: MetodoPago;
  /** Identificador de la solicitud: hace idempotente el reintento del cobro. */
  solicitudId: string;
}

/** Constancia interna del cobro (sin validez fiscal). */
export interface PaymentReceipt {
  id: string;
  turnoId: string;
  estado: EstadoPago;
  metodo: MetodoPago;
  monto: number;
  fecha: string;
  servicioNombre: string;
  turnoFecha: string;
  turnoHora: string;
  peluquero: string;
  motivoAnulacion?: string;
}

/** Vista del cobro para el Admin: suma el email del Cliente. */
export interface PaymentAdminView extends PaymentReceipt {
  clienteEmail: string;
}

/** Turno que cumple la definición de pendiente de cobro. */
export interface PendingCharge {
  turnoId: string;
  fecha: string;
  horaInicio: string;
  servicioNombre: string;
  peluquero: string;
  clienteEmail: string;
  monto: number;
  estadoTurno: string;
}
