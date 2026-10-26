import type { Cliente } from "../../users/domain/Cliente.js";
import type { Peluquero } from "../../users/domain/Peluquero.js";
import type { Servicio } from "../../services/domain/Servicio.js";

export interface DatosTurno {
  id: string;
  fecha: string;
  horaInicio: string;
  estado: string;
  cliente: Cliente;
  peluquero: Peluquero;
  servicio: Servicio;
}

/** Turno y asociaciones definidas por el MODP y el diagrama de clases. */
export class Turno {
  readonly id: string;
  readonly fecha: string;
  readonly horaInicio: string;
  readonly estado: string;
  readonly cliente: Cliente;
  readonly peluquero: Peluquero;
  readonly servicio: Servicio;

  constructor(datos: DatosTurno) {
    this.id = datos.id;
    this.fecha = datos.fecha;
    this.horaInicio = datos.horaInicio;
    this.estado = datos.estado;
    this.cliente = datos.cliente;
    this.peluquero = datos.peluquero;
    this.servicio = datos.servicio;
  }
}
