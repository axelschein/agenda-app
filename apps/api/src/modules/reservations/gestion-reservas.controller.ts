import { Controller, Get, Param, Patch, UseGuards } from "@nestjs/common";
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
}
