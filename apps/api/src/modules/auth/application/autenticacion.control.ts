import { Injectable, UnauthorizedException } from "@nestjs/common";
import type { AuthenticatedUser, LoginCredentials } from "@agenda-app/shared";
import { UserAllowlistService } from "../infrastructure/user-allowlist.service.js";

/** Control de aplicación que autentica y valida la identidad autorizada. */
@Injectable()
export class AutenticacionControl {
  constructor(private readonly allowlist: UserAllowlistService) {}

  async autenticar(credenciales: LoginCredentials): Promise<AuthenticatedUser> {
    const usuario = await this.allowlist.authenticate(credenciales);
    if (!usuario) {
      throw new UnauthorizedException("El correo o la contraseña no son correctos, o la cuenta no está habilitada.");
    }
    return usuario;
  }

  autorizar(usuario: AuthenticatedUser): boolean {
    return this.allowlist.isAllowed(usuario);
  }
}
