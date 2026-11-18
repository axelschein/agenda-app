import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { Roles } from "../auth/roles.decorator.js";
import { RolesGuard } from "../auth/roles.guard.js";
import { SessionAuthGuard } from "../auth/session-auth.guard.js";
import { IndicadoresControl } from "./application/indicadores.control.js";

/** Indicadores y reportes de Administración (CU12/CU14, Clase 8). Solo Admin. */
@Controller("reports")
@UseGuards(SessionAuthGuard, RolesGuard)
@Roles("ADMIN")
export class ReportsController {
  constructor(private readonly indicadores: IndicadoresControl) {}

  @Get("indicators")
  panel(@Query("desde") desde: string, @Query("hasta") hasta: string) {
    return this.indicadores.panel(desde, hasta);
  }
}
