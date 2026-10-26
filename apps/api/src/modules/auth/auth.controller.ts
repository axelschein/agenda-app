import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Res,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import { USER_ROLES, type AuthResponse, type LoginCredentials, type UserRole } from "@agenda-app/shared";
import type { Response } from "express";
import { SESSION_COOKIE_NAME, SESSION_TTL_SECONDS } from "./auth.constants.js";
import { AutenticacionControl } from "./autenticacion.control.js";
import { CurrentUser } from "./current-user.decorator.js";
import { Roles } from "./roles.decorator.js";
import { RolesGuard } from "./roles.guard.js";
import { SessionAuthGuard } from "./session-auth.guard.js";
import { SessionService } from "./session.service.js";

@Controller("auth")
export class AuthController {
  constructor(
    private readonly autenticacion: AutenticacionControl,
    private readonly sessions: SessionService,
  ) {}

  @Post("login")
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() body: Partial<LoginCredentials>,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthResponse> {
    if (typeof body?.email !== "string" || typeof body.password !== "string" || !body.email || !body.password) {
      throw new UnauthorizedException("El correo o la contraseña no son correctos, o la cuenta no está habilitada.");
    }
    const user = await this.autenticacion.autenticar({ email: body.email, password: body.password });
    response.cookie(SESSION_COOKIE_NAME, this.sessions.create(user), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_TTL_SECONDS * 1000,
    });
    return { user };
  }

  @Get("me")
  @UseGuards(SessionAuthGuard, RolesGuard)
  @Roles(...USER_ROLES)
  getCurrentUser(@CurrentUser() user: { email: string; role: UserRole }): AuthResponse {
    return { user };
  }

  @Post("logout")
  @HttpCode(HttpStatus.NO_CONTENT)
  logout(@Res({ passthrough: true }) response: Response): void {
    response.clearCookie(SESSION_COOKIE_NAME, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    });
  }
}
