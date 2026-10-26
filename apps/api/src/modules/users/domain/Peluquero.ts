import { Usuario, type DatosUsuario } from "./Usuario.js";

/** Personal que atiende turnos. El origen de su rating sigue pendiente. */
export class Peluquero extends Usuario {
  /** Valor derivado; no se calcula hasta acordar su origen. */
  readonly ratingPromedio?: number;

  constructor(datos: DatosUsuario, ratingPromedio?: number) {
    super(datos);
    if (ratingPromedio !== undefined) this.ratingPromedio = ratingPromedio;
  }
}
