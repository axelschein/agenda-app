import { Injectable, NotFoundException } from "@nestjs/common";
import type { BarberOption } from "@agenda-app/shared";
import { AgendaDatabase } from "../../persistence/agenda-database.js";
@Injectable()
export class PersonalControl {
  constructor(private readonly database: AgendaDatabase) {}
  consultar(): BarberOption[] {
    return this.database.db
      .prepare("SELECT id, nombre FROM peluquero ORDER BY nombre")
      .all() as unknown as BarberOption[];
  }
  obtener(id: string): BarberOption {
    const peluquero = this.consultar().find((p) => p.id === id);
    if (!peluquero)
      throw new NotFoundException(
        "El peluquero o la peluquera ya no está disponible.",
      );
    return peluquero;
  }
}
