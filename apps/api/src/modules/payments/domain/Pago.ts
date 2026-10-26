import type { Turno } from "../../reservations/domain/Turno.js";

export interface DatosPago {
  id: string;
  fecha: string;
  importe: number;
  metodo: string;
  estado: string;
  turno: Turno;
}

/** Pago asociado a un turno. No define reglas de cobro ni transiciones. */
export class Pago {
  readonly id: string;
  readonly fecha: string;
  readonly importe: number;
  readonly metodo: string;
  readonly estado: string;
  readonly turno: Turno;

  constructor(datos: DatosPago) {
    this.id = datos.id;
    this.fecha = datos.fecha;
    this.importe = datos.importe;
    this.metodo = datos.metodo;
    this.estado = datos.estado;
    this.turno = datos.turno;
  }
}
