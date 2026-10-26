import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { SessionService } from "./infrastructure/session.service.js";
import type { AuthenticatedRequest } from "./current-user.decorator.js";

@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(private readonly sessions: SessionService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = this.sessions.readCookie(request.headers.cookie);
    if (!user) throw new UnauthorizedException("La sesión no es válida o venció.");
    request.authUser = user;
    return true;
  }
}
