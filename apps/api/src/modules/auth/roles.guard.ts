import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { UserRole } from "@agenda-app/shared";
import type { AuthenticatedRequest } from "./current-user.decorator.js";
import { REQUIRED_ROLES } from "./roles.decorator.js";

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(REQUIRED_ROLES, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles?.length) return true;
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.authUser) throw new UnauthorizedException("Se requiere una sesión válida.");
    if (!requiredRoles.includes(request.authUser.role)) {
      throw new ForbiddenException("Tu rol no tiene acceso a esta función.");
    }
    return true;
  }
}
