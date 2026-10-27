import { BadRequestException, Injectable } from "@nestjs/common";
import type { WorkingWindow, AvailabilityResponse } from "@agenda-app/shared";
import { AgendaDatabase } from "../../persistence/agenda-database.js";
import { CatalogoControl } from "../services/index.js";
import { PersonalControl } from "../users/index.js";
import {
  ahoraLocal,
  horaAMinutos,
  minutosAHora,
  validarFecha,
  ZONA_HORARIA,
} from "./horarios.js";
interface Intervalo {
  inicio: number;
  fin: number;
}
@Injectable()
export class AgendaControl {
  constructor(
    private readonly database: AgendaDatabase,
    private readonly catalogo: CatalogoControl,
    private readonly personal: PersonalControl,
  ) {}
  consultarConfiguracion(): { duracionBloqueMinutos: number } {
    return this.database.db
      .prepare(
        "SELECT duracion_bloque_minutos AS duracionBloqueMinutos FROM configuracion_agenda WHERE id=1",
      )
      .get() as { duracionBloqueMinutos: number };
  }
  configurarBloque(value: unknown): { duracionBloqueMinutos: number } {
    if (!Number.isInteger(value) || Number(value) < 1 || Number(value) > 1440)
      throw new BadRequestException(
        "El bloque debe durar entre 1 y 1440 minutos enteros.",
      );
    this.database.db
      .prepare(
        "UPDATE configuracion_agenda SET duracion_bloque_minutos=? WHERE id=1",
      )
      .run(Number(value));
    return this.consultarConfiguracion();
  }
  consultarHorarios(peluqueroId: string): WorkingWindow[] {
    this.personal.obtener(peluqueroId);
    const rows = this.database.db
      .prepare(
        "SELECT dia, inicio, fin FROM horario_laboral WHERE peluquero_id = ? ORDER BY dia, inicio",
      )
      .all(peluqueroId) as unknown as (Intervalo & { dia: number })[];
    return rows.map((r) => ({
      dia: r.dia,
      inicio: minutosAHora(r.inicio),
      fin: minutosAHora(r.fin),
    }));
  }
  configurar(peluqueroId: string, value: unknown): WorkingWindow[] {
    this.personal.obtener(peluqueroId);
    if (!Array.isArray(value) || value.length > 28)
      throw new BadRequestException(
        "Indicá hasta 28 franjas laborales por semana.",
      );
    const windows = value
      .map((item: unknown) => {
        if (!item || typeof item !== "object")
          throw new BadRequestException("Franja laboral inválida.");
        const w = item as Record<string, unknown>;
        if (!Number.isInteger(w.dia) || Number(w.dia) < 0 || Number(w.dia) > 6)
          throw new BadRequestException(
            "El día debe estar entre 0 (domingo) y 6 (sábado).",
          );
        const inicio = horaAMinutos(w.inicio),
          fin = horaAMinutos(w.fin);
        if (inicio >= fin)
          throw new BadRequestException("El fin debe ser posterior al inicio.");
        return { dia: Number(w.dia), inicio, fin };
      })
      .sort((a, b) => a.dia - b.dia || a.inicio - b.inicio);
    windows.forEach((w, i) => {
      const previous = windows[i - 1];
      if (previous && previous.dia === w.dia && previous.fin > w.inicio)
        throw new BadRequestException(
          "Los horarios laborales no pueden superponerse.",
        );
    });
    this.database.transaction(() => {
      this.database.db
        .prepare("DELETE FROM horario_laboral WHERE peluquero_id = ?")
        .run(peluqueroId);
      const insert = this.database.db.prepare(
        "INSERT INTO horario_laboral VALUES (?, ?, ?, ?)",
      );
      for (const w of windows) insert.run(peluqueroId, w.dia, w.inicio, w.fin);
    });
    return this.consultarHorarios(peluqueroId);
  }
  consultar(
    servicioId: string,
    peluqueroId: string,
    fechaValue: unknown,
  ): AvailabilityResponse {
    this.catalogo.obtener(servicioId);
    const duracionBloqueMinutos =
      this.consultarConfiguracion().duracionBloqueMinutos;
    this.personal.obtener(peluqueroId);
    const fecha = validarFecha(fechaValue),
      now = ahoraLocal();
    const result: AvailabilityResponse = {
      fecha,
      horarios: [],
      zonaHoraria: ZONA_HORARIA,
    };
    if (fecha < now.fecha) return result;
    const dia = new Date(fecha + "T12:00:00Z").getUTCDay();
    const windows = this.database.db
      .prepare(
        "SELECT inicio, fin FROM horario_laboral WHERE peluquero_id = ? AND dia = ? ORDER BY inicio",
      )
      .all(peluqueroId, dia) as unknown as Intervalo[];
    const turnos = this.database.db
      .prepare(
        "SELECT inicio, fin FROM ocupacion_agenda WHERE peluquero_id = ? AND fecha = ?",
      )
      .all(peluqueroId, fecha) as unknown as Intervalo[];
    for (const w of windows) {
      for (
        let start = w.inicio;
        start + duracionBloqueMinutos <= w.fin;
        start += duracionBloqueMinutos
      ) {
        const hora = minutosAHora(start);
        if (fecha === now.fecha && hora <= now.hora) continue;
        if (
          !turnos.some(
            (t) => t.inicio < start + duracionBloqueMinutos && start < t.fin,
          )
        )
          result.horarios.push(hora);
      }
    }
    return result;
  }
}
