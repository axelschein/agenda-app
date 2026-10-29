import { Controller, Get, UseGuards } from "@nestjs/common";
import type { AuthenticatedUser } from "@agenda-app/shared";
import { CurrentUser } from "../auth/current-user.decorator.js";
import { Roles } from "../auth/roles.decorator.js";
import { RolesGuard } from "../auth/roles.guard.js";
import { SessionAuthGuard } from "../auth/session-auth.guard.js";
import { ConsultaComercialControl } from "./application/consulta-comercial.control.js";

/** Historial de pagos propio del Cliente (CU17). */
@Controller("payments")
@UseGuards(SessionAuthGuard, RolesGuard)
@Roles("CLIENT")
export class MisPagosController {
  constructor(private readonly consultas: ConsultaComercialControl) {}

  @Get("mine")
  propios(@CurrentUser() user: AuthenticatedUser) {
    return this.consultas.historialCliente(user);
  }
}
