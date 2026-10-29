import { Body, Controller, Get, Param, Post, Put, Query, UseGuards } from "@nestjs/common";
import type { AuthenticatedUser } from "@agenda-app/shared";
import { CurrentUser } from "../auth/current-user.decorator.js";
import { Roles } from "../auth/roles.decorator.js";
import { RolesGuard } from "../auth/roles.guard.js";
import { SessionAuthGuard } from "../auth/session-auth.guard.js";
import { PersonalControl } from "./personal.control.js";

@Controller("users")
@UseGuards(SessionAuthGuard, RolesGuard)
@Roles("BARBER")
export class UsersController {
  constructor(private readonly personal: PersonalControl) {}

  @Get("me")
  perfil(@CurrentUser() user: AuthenticatedUser) {
    return { ...this.personal.perfil(user.peluqueroId!), email: user.email };
  }

  @Put("me")
  actualizarPerfil(@CurrentUser() user: AuthenticatedUser, @Body() body: unknown) {
    return {
      ...this.personal.actualizarPerfil(user.peluqueroId!, user.email, body),
      email: user.email,
    };
  }

  @Get("me/indicators")
  indicadores(@CurrentUser() user: AuthenticatedUser, @Query("fecha") fecha: string) {
    return this.personal.indicadores(user.peluqueroId!, fecha);
  }

  @Get("admin/peluqueros")
  @Roles("ADMIN")
  listarPersonal() {
    return this.personal.listarAdministracion();
  }

  @Post("admin/peluqueros")
  @Roles("ADMIN")
  crearPersonal(@CurrentUser() user: AuthenticatedUser, @Body() body: unknown) {
    return this.personal.crearPerfil(user.email, body);
  }

  @Put("admin/peluqueros/:id")
  @Roles("ADMIN")
  actualizarPersonal(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser, @Body() body: unknown) {
    return this.personal.actualizarPerfil(id, user.email, body, true);
  }
}
