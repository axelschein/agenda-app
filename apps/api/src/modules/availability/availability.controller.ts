import { Body, Controller, Get, Param, Put, UseGuards } from "@nestjs/common";
import { Roles } from "../auth/roles.decorator.js";
import { RolesGuard } from "../auth/roles.guard.js";
import { SessionAuthGuard } from "../auth/session-auth.guard.js";
import { AgendaControl } from "./agenda.control.js";
@Controller("availability")
@UseGuards(SessionAuthGuard, RolesGuard)
@Roles("ADMIN")
export class AvailabilityController {
  constructor(private readonly agenda: AgendaControl) {}
  @Get("settings")
  @Roles("ADMIN", "CLIENT")
  settings() {
    return this.agenda.consultarConfiguracion();
  }
  @Put("settings")
  settingsUpdate(@Body() body: { duracionBloqueMinutos?: unknown } | null) {
    return this.agenda.configurarBloque(body?.duracionBloqueMinutos);
  }
  @Get("working-hours/:peluqueroId") consultar(
    @Param("peluqueroId") id: string,
  ) {
    return this.agenda.consultarHorarios(id);
  }
  @Put("working-hours/:peluqueroId") configurar(
    @Param("peluqueroId") id: string,
    @Body() body: { franjas?: unknown } | null,
  ) {
    return this.agenda.configurar(id, body?.franjas);
  }
}
