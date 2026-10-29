import { Controller, Get, Param, Patch, UseGuards } from "@nestjs/common";
import type { AuthenticatedUser } from "@agenda-app/shared";
import { Query } from "@nestjs/common";
import { CurrentUser } from "../auth/current-user.decorator.js";
import { Roles } from "../auth/roles.decorator.js";
import { RolesGuard } from "../auth/roles.guard.js";
import { SessionAuthGuard } from "../auth/session-auth.guard.js";
import { GestionReservasControl } from "./application/gestion-reservas.control.js";

/** Panel del negocio: consulta y rechazo de reservas (solo Admin). */
@Controller("reservations")
@UseGuards(SessionAuthGuard, RolesGuard)
@Roles("ADMIN")
export class GestionReservasController {
  constructor(private readonly gestion: GestionReservasControl) {}

  @Get("all")
  todas() {
    return this.gestion.consultarTodas();
  }

  @Patch(":id/reject")
  rechazar(@Param("id") id: string) {
    return this.gestion.rechazar(id);
  }

  @Get("assigned")
  @Roles("BARBER")
  asignadas(
    @CurrentUser() user: AuthenticatedUser,
    @Query("desde") desde: string,
    @Query("hasta") hasta: string,
  ) {
    return this.gestion.consultarAsignadas(user.peluqueroId!, desde, hasta);
  }

  @Patch(":id/confirm")
  @Roles("BARBER")
  confirmarAsignada(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.gestion.confirmarAsignado(id, user.peluqueroId!);
  }

  @Patch(":id/reject-as-assigned")
  @Roles("BARBER")
  rechazarAsignada(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.gestion.rechazarAsignado(id, user.peluqueroId!);
  }

  @Patch(":id/admin-confirm")
  confirmar(@Param("id") id: string) {
    return this.gestion.confirmar(id);
  }

  @Patch(":id/admin-complete")
  completar(@Param("id") id: string) {
    return this.gestion.completar(id);
  }
}
