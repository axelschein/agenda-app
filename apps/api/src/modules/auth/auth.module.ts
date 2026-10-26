import { Module } from "@nestjs/common";
import { AuthController } from "./auth.controller.js";
import { AutenticacionControl } from "./application/autenticacion.control.js";
import { RolesGuard } from "./roles.guard.js";
import { SessionAuthGuard } from "./session-auth.guard.js";
import { SessionService } from "./infrastructure/session.service.js";
import { UserAllowlistService } from "./infrastructure/user-allowlist.service.js";

@Module({
  controllers: [AuthController],
  providers: [AutenticacionControl, SessionService, SessionAuthGuard, RolesGuard, UserAllowlistService],
  exports: [SessionAuthGuard, RolesGuard],
})
export class AuthModule {}
