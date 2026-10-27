import { Body, Controller, Get, Post, Query, UseGuards } from "@nestjs/common";
import type { AuthenticatedUser } from "@agenda-app/shared";
import { CurrentUser } from "../auth/current-user.decorator.js";
import { Roles } from "../auth/roles.decorator.js";
import { RolesGuard } from "../auth/roles.guard.js";
import { SessionAuthGuard } from "../auth/session-auth.guard.js";
import { CatalogoControl } from "../services/index.js";
import { PersonalControl } from "../users/index.js";
import { AgendaControl } from "../availability/index.js";
import { ReservaTurnoControl } from "./application/reserva-turno.control.js";
@Controller("reservations")
@UseGuards(SessionAuthGuard, RolesGuard)
@Roles("CLIENT")
export class ReservationsController {
  constructor(
    private readonly reservas: ReservaTurnoControl,
    private readonly catalogo: CatalogoControl,
    private readonly personal: PersonalControl,
    private readonly agenda: AgendaControl,
  ) {}
  @Get("services") @Roles("CLIENT", "ADMIN") servicios() {
    return this.catalogo.consultar();
  }
  @Get("barbers") @Roles("CLIENT", "ADMIN") peluqueros() {
    return this.personal.consultar();
  }
  @Get("availability") disponibilidad(
    @Query("servicioId") servicioId: string,
    @Query("peluqueroId") peluqueroId: string,
    @Query("fecha") fecha: string,
  ) {
    return this.agenda.consultar(servicioId, peluqueroId, fecha);
  }
  @Post("summary") resumen(@Body() body: unknown) {
    return this.reservas.generarResumen(body);
  }
  @Post() registrar(
    @Body() body: unknown,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.reservas.registrar(body, user);
  }
  @Get("mine") propios(@CurrentUser() user: AuthenticatedUser) {
    return this.reservas.consultarPropios(user);
  }
}
