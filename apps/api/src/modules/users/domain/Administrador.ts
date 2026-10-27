import { Usuario, type DatosUsuario } from "./Usuario.js";

/** Rol que administra la operación del negocio. */
export class Administrador extends Usuario {
  constructor(datos: DatosUsuario) {
    super(datos);
  }
}
