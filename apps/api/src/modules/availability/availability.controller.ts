import { Body, Controller, Get, Param, Put, UseGuards } from "@nestjs/common";
import { Roles } from "../auth/roles.decorator.js";
import { RolesGuard } from "../auth/roles.guard.js";
import { SessionAuthGuard } from "../auth/session-auth.guard.js";
import { AgendaControl } from "./agenda.control.js";
@Controller("availability/working-hours")
@UseGuards(SessionAuthGuard, RolesGuard)
@Roles("ADMIN")
export class AvailabilityController {
  constructor(private readonly agenda: AgendaControl) {}
  @Get(":peluqueroId") consultar(@Param("peluqueroId") id: string) {
    return this.agenda.consultarHorarios(id);
  }
  @Put(":peluqueroId") configurar(
    @Param("peluqueroId") id: string,
    @Body() body: { franjas?: unknown } | null,
  ) {
    return this.agenda.configurar(id, body?.franjas);
  }
}
