import { Injectable, NotFoundException } from "@nestjs/common";
import { AgendaDatabase } from "../../persistence/agenda-database.js";
import type { ServiceOption } from "@agenda-app/shared";
@Injectable()
export class CatalogoControl {
  constructor(private readonly database: AgendaDatabase) {}
  consultar(): ServiceOption[] {
    return this.database.db
      .prepare(
        "SELECT id, nombre, duracion_minutos AS duracionMinutos, precio_centavos / 100.0 AS precio FROM servicio ORDER BY nombre",
      )
      .all() as unknown as ServiceOption[];
  }
  obtener(id: string): ServiceOption {
    const servicio = this.consultar().find((s) => s.id === id);
    if (!servicio)
      throw new NotFoundException(
        "El servicio ya no está disponible. Elegí otro.",
      );
    return servicio;
  }
}
