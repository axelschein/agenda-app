import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  UseGuards,
} from "@nestjs/common";
import { Roles } from "../auth/roles.decorator.js";
import { RolesGuard } from "../auth/roles.guard.js";
import { SessionAuthGuard } from "../auth/session-auth.guard.js";
import { CatalogoControl } from "./catalogo.control.js";

@Controller("services")
@UseGuards(SessionAuthGuard, RolesGuard)
export class ServicesController {
  constructor(private readonly catalogo: CatalogoControl) {}

  @Get()
  @Roles("ADMIN", "CLIENT")
  consultar() {
    return this.catalogo.consultar();
  }

  @Get("admin")
  @Roles("ADMIN")
  consultarTodos() {
    return this.catalogo.consultar(true);
  }

  @Post()
  @Roles("ADMIN")
  crear(@Body() body: unknown) {
    return this.catalogo.crear(
      body as Parameters<CatalogoControl["crear"]>[0],
    );
  }

  @Put(":id")
  @Roles("ADMIN")
  modificar(@Param("id") id: string, @Body() body: unknown) {
    return this.catalogo.modificar(
      id,
      body as Parameters<CatalogoControl["modificar"]>[1],
    );
  }

  @Patch(":id/reactivate")
  @Roles("ADMIN")
  reactivar(@Param("id") id: string) {
    return this.catalogo.reactivar(id);
  }

  @Delete(":id")
  @Roles("ADMIN")
  eliminar(@Param("id") id: string) {
    this.catalogo.eliminar(id);
    return { id, activo: false };
  }
}
