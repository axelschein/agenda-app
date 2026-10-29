import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { Roles } from "../auth/roles.decorator.js";
import { RolesGuard } from "../auth/roles.guard.js";
import { SessionAuthGuard } from "../auth/session-auth.guard.js";
import { CobroControl } from "./application/cobro.control.js";
import { ConsultaComercialControl } from "./application/consulta-comercial.control.js";

/** Línea comercial del negocio: registrar, anular y consultar cobros (solo Admin). */
@Controller("payments")
@UseGuards(SessionAuthGuard, RolesGuard)
@Roles("ADMIN")
export class CobrosController {
  constructor(
    private readonly cobros: CobroControl,
    private readonly consultas: ConsultaComercialControl,
  ) {}

  @Get("methods")
  metodos() {
    return this.consultas.metodos();
  }

  @Get("pending")
  pendientes() {
    return this.consultas.pendientes();
  }

  @Post()
  registrar(@Body() body: unknown) {
    return this.cobros.registrar(body);
  }

  @Patch(":id/void")
  anular(@Param("id") id: string) {
    return this.cobros.anular(id);
  }

  @Get(":id/receipt")
  constancia(@Param("id") id: string) {
    return this.cobros.constancia(id);
  }
}
