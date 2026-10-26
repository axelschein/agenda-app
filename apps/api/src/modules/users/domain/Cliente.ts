import { Usuario, type DatosUsuario } from "./Usuario.js";

/** Rol que consulta servicios, reserva y gestiona sus propios turnos. */
export class Cliente extends Usuario {
  constructor(datos: DatosUsuario) {
    super(datos);
  }
}
