export interface DatosServicio {
  id: string;
  nombre: string;
  duracionMinutos: number;
  precio: number;
}

/** Servicio que puede asociarse a un turno. Precio en unidad monetaria genérica. */
export class Servicio {
  readonly id: string;
  readonly nombre: string;
  readonly duracionMinutos: number;
  readonly precio: number;

  constructor(datos: DatosServicio) {
    this.id = datos.id;
    this.nombre = datos.nombre;
    this.duracionMinutos = datos.duracionMinutos;
    this.precio = datos.precio;
  }
}
