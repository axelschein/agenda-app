export interface ServiceOption {
  id: string;
  nombre: string;
  duracionMinutos: number;
  precio: number;
  activo?: boolean;
}

export interface ServiceInput {
  nombre: string;
  duracionMinutos: number;
  precio: number;
}
export interface BarberOption {
  id: string;
  nombre: string;
}
export interface WorkingWindow {
  dia: number;
  inicio: string;
  fin: string;
}
export interface AvailabilityResponse {
  motivoSinDisponibilidad?: string;
  fecha: string;
  horarios: string[];
  zonaHoraria: string;
}
export interface ReservationSelection {
  servicioId: string;
  peluqueroId: string;
  fecha: string;
  horaInicio: string;
}
export interface AgendaSettings {
  duracionBloqueMinutos: number;
}
export interface ReservationSummary extends ReservationSelection {
  duracionBloqueMinutos: number;
  servicio: ServiceOption;
  peluquero: BarberOption;
  total: number;
  zonaHoraria: string;
}
export interface CreateReservation extends ReservationSelection {
  solicitudId: string;
  precioRevisado: number;
  duracionRevisada: number;
}
export interface ReservationReceipt extends ReservationSummary {
  id: string;
  estado: "Pendiente" | "Confirmado" | "En curso" | "Completado" | "Cancelado";
  motivoCancelacion?: string;
}
export interface ReservationAdminView extends ReservationReceipt {
  clienteEmail: string;
}
