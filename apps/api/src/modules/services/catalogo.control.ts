import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { AgendaDatabase } from "../../persistence/agenda-database.js";
import type {
  ServiceInput as SharedServiceInput,
  ServiceOption,
} from "@agenda-app/shared";

export type ServiceInput = { [K in keyof SharedServiceInput]: unknown };

@Injectable()
export class CatalogoControl {
  constructor(private readonly database: AgendaDatabase) {}

  consultar(incluirInactivos = false): ServiceOption[] {
    const where = incluirInactivos ? "" : "WHERE activo = 1";
    const rows = this.database.db
      .prepare(
        `SELECT id, nombre, duracion_minutos AS duracionMinutos, precio_centavos / 100.0 AS precio, activo = 1 AS activo FROM servicio ${where} ORDER BY nombre`,
      )
      .all() as unknown as (Omit<ServiceOption, "activo"> & {
      activo: number;
    })[];
    return rows.map((service) => ({ ...service, activo: Boolean(service.activo) }));
  }

  obtener(id: string): ServiceOption {
    const servicio = this.buscar(id, false);
    if (!servicio)
      throw new NotFoundException(
        "El servicio ya no está disponible. Elegí otro.",
      );
    return servicio;
  }

  obtenerHistorico(id: string): ServiceOption {
    const servicio = this.buscar(id, true);
    if (!servicio)
      throw new NotFoundException("No se encontró el servicio de la reserva.");
    return servicio;
  }

  crear(input: ServiceInput): ServiceOption {
    const values = this.validar(input);
    const id = crypto.randomUUID();
    this.database.db
      .prepare(
        "INSERT INTO servicio(id,nombre,duracion_minutos,precio_centavos,activo) VALUES (?,?,?,?,1)",
      )
      .run(id, values.nombre, values.duracionMinutos, values.precioCentavos);
    return this.obtener(id);
  }

  modificar(id: string, input: ServiceInput): ServiceOption {
    this.exigirExistente(id);
    const values = this.validar(input);
    this.database.db
      .prepare(
        "UPDATE servicio SET nombre=?, duracion_minutos=?, precio_centavos=? WHERE id=?",
      )
      .run(values.nombre, values.duracionMinutos, values.precioCentavos, id);
    return this.buscar(id, true)!;
  }

  reactivar(id: string): ServiceOption {
    this.exigirExistente(id);
    const result = this.database.db
      .prepare("UPDATE servicio SET activo=1 WHERE id=?")
      .run(id);
    if (Number(result.changes) === 0)
      throw new ConflictException("No se pudo reactivar el servicio.");
    return this.buscar(id, true)!;
  }

  eliminar(id: string): void {
    this.exigirExistente(id);
    const result = this.database.db
      .prepare("UPDATE servicio SET activo=0 WHERE id=? AND activo=1")
      .run(id);
    if (Number(result.changes) === 0)
      throw new ConflictException("El servicio ya estaba dado de baja.");
  }

  private buscar(
    id: string,
    incluirInactivo: boolean,
  ): ServiceOption | undefined {
    const service = this.database.db
      .prepare(
        `SELECT id, nombre, duracion_minutos AS duracionMinutos, precio_centavos / 100.0 AS precio, activo = 1 AS activo FROM servicio WHERE id=? ${incluirInactivo ? "" : "AND activo=1"}`,
      )
      .get(id) as unknown as
      | (Omit<ServiceOption, "activo"> & { activo: number })
      | undefined;
    return service ? { ...service, activo: Boolean(service.activo) } : undefined;
  }

  private exigirExistente(id: string): void {
    if (!this.buscar(id, true))
      throw new NotFoundException("No se encontró el servicio.");
  }

  private validar(input: ServiceInput) {
    if (!input || typeof input !== "object" || Array.isArray(input))
      throw new BadRequestException("Completá los datos del servicio.");
    const keys = Object.keys(input);
    if (
      keys.some(
        (key) => !["nombre", "duracionMinutos", "precio"].includes(key),
      )
    )
      throw new BadRequestException("El servicio contiene campos no admitidos.");
    const nombre = typeof input.nombre === "string" ? input.nombre.trim() : "";
    const duracionMinutos = input.duracionMinutos;
    const precio = input.precio;
    if (!nombre || nombre.length > 120)
      throw new BadRequestException(
        "El nombre es obligatorio y admite hasta 120 caracteres.",
      );
    if (
      typeof duracionMinutos !== "number" ||
      !Number.isInteger(duracionMinutos) ||
      duracionMinutos < 1 ||
      duracionMinutos > 1440
    )
      throw new BadRequestException(
        "La duración estimada debe ser de 1 a 1440 minutos.",
      );
    if (
      typeof precio !== "number" ||
      !Number.isFinite(precio) ||
      precio < 0 ||
      precio > 1_000_000_000 ||
      Math.abs(precio * 100 - Math.round(precio * 100)) > 1e-7
    )
      throw new BadRequestException(
        "El precio debe ser un importe válido con hasta dos decimales.",
      );
    return {
      nombre,
      duracionMinutos,
      precioCentavos: Math.round(precio * 100),
    };
  }
}
