export interface DatosUsuario {
  id: string;
  nombre: string;
  email: string;
  telefono: string;
  passwordHash: string;
}

/** Superclase de los roles del dominio, según el MODP de AgendaApp. */
export abstract class Usuario {
  readonly id: string;
  readonly nombre: string;
  readonly email: string;
  readonly telefono: string;
  protected readonly passwordHash: string;

  protected constructor(datos: DatosUsuario) {
    this.id = datos.id;
    this.nombre = datos.nombre;
    this.email = datos.email;
    this.telefono = datos.telefono;
    this.passwordHash = datos.passwordHash;
  }
}
