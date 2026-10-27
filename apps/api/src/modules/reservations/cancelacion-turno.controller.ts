import { Controller, Param, Patch, UseGuards } from "@nestjs/common";
import type { AuthenticatedUser } from "@agenda-app/shared";
import { CurrentUser } from "../auth/current-user.decorator.js";
import { Roles } from "../auth/roles.decorator.js";
import { RolesGuard } from "../auth/roles.guard.js";
import { SessionAuthGuard } from "../auth/session-auth.guard.js";
import { CancelacionTurnoControl } from "./application/cancelacion-turno.control.js";

/** Cancelación de un turno propio por el Cliente (CU07). */
@Controller("reservations")
@UseGuards(SessionAuthGuard, RolesGuard)
@Roles("CLIENT")
export class CancelacionTurnoController {
  constructor(private readonly cancelacion: CancelacionTurnoControl) {}

  @Patch(":id/cancel")
  cancelar(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.cancelacion.cancelar(id, user);
  }
}
