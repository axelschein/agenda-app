import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import {
  METODOS_PAGO,
  type MetodoPago,
  type PaymentAdminView,
  type PaymentReceipt,
  type RegistrarPago,
} from "@agenda-app/shared";
import { AgendaDatabase } from "../../../persistence/agenda-database.js";
import { PersonalControl } from "../../users/index.js";
import { minutosAHora } from "../../availability/index.js";

/** Turnos que se pueden cobrar (regla aprobada por el PO en PP2-23). */
const COBRABLES = ["Confirmado", "Completado"];
/** Motivo por defecto cuando el Admin anula un cobro. */
export const MOTIVO_ANULACION = "anulado por el negocio";

interface TurnoRow {
  id: string;
  cliente_id: string;
  peluquero_id: string;
  fecha: string;
  inicio: number;
  precio_centavos: number;
  servicio_nombre: string;
  estado: string;
}
interface PagoRow {
  id: string;
  turno_id: string;
  solicitud_id: string;
  metodo: MetodoPago;
  monto_centavos: number;
  estado: PaymentReceipt["estado"];
  motivo_anulacion: string;
  creado_en: string;
}

/**
 * Registro y anulación de cobros asociados a un turno (CU16).
 * El pago y su auditoría se confirman juntos o se revierten juntos.
 */
@Injectable()
export class CobroControl {
  constructor(
    private readonly database: AgendaDatabase,
    private readonly personal: PersonalControl,
  ) {}

  registrar(value: unknown): PaymentReceipt {
    const body = this.validar(value);
    return this.database.transaction(() => {
      const db = this.database.db;
      const turno = db
        .prepare("SELECT * FROM turno WHERE id=?")
        .get(body.turnoId) as unknown as TurnoRow | undefined;
      if (!turno) throw new NotFoundException("No encontramos ese turno.");
      if (!COBRABLES.includes(turno.estado))
        throw new BadRequestException(
          `Solo se puede cobrar un turno confirmado o completado (este está ${turno.estado.toLowerCase()}).`,
        );
      // Idempotencia: un reintento con la misma solicitud devuelve el pago ya hecho.
      const previo = db
        .prepare("SELECT * FROM pago WHERE turno_id=? AND solicitud_id=?")
        .get(body.turnoId, body.solicitudId) as unknown as PagoRow | undefined;
      if (previo) return this.recibo(previo, turno);
      const activo = db
        .prepare(
          "SELECT id FROM pago WHERE turno_id=? AND estado <> 'Anulado'",
        )
        .get(body.turnoId) as { id: string } | undefined;
      if (activo)
        throw new ConflictException("El turno ya tiene un cobro registrado.");
      const id = randomUUID(),
        now = new Date().toISOString();
      db.prepare(
        "INSERT INTO pago (id,turno_id,solicitud_id,metodo,monto_centavos,estado,creado_en) VALUES (?,?,?,?,?,'Registrado',?)",
      ).run(
        id,
        body.turnoId,
        body.solicitudId,
        body.metodo,
        turno.precio_centavos,
        now,
      );
      db.prepare(
        "INSERT INTO auditoria_pago(pago_id,accion,ocurrido_en) VALUES (?,'PAGO_REGISTRADO',?)",
      ).run(id, now);
      const creado = db
        .prepare("SELECT * FROM pago WHERE id=?")
        .get(id) as unknown as PagoRow;
      return this.recibo(creado, turno);
    });
  }

  anular(id: string): PaymentReceipt {
    return this.database.transaction(() => {
      const db = this.database.db;
      const pago = db
        .prepare("SELECT * FROM pago WHERE id=?")
        .get(id) as unknown as PagoRow | undefined;
      if (!pago) throw new NotFoundException("No encontramos ese cobro.");
      if (pago.estado === "Anulado")
        throw new BadRequestException("El cobro ya está anulado.");
      db.prepare(
        "UPDATE pago SET estado='Anulado', motivo_anulacion=? WHERE id=?",
      ).run(MOTIVO_ANULACION, id);
      db.prepare(
        "INSERT INTO auditoria_pago(pago_id,accion,ocurrido_en) VALUES (?,'PAGO_ANULADO',?)",
      ).run(id, new Date().toISOString());
      const turno = db
        .prepare("SELECT * FROM turno WHERE id=?")
        .get(pago.turno_id) as unknown as TurnoRow;
      const actualizado = db
        .prepare("SELECT * FROM pago WHERE id=?")
        .get(id) as unknown as PagoRow;
      return this.recibo(actualizado, turno);
    });
  }

  /** Constancia interna para el Admin (incluye el email del Cliente). */
  constancia(id: string): PaymentAdminView {
    const db = this.database.db;
    const pago = db
      .prepare("SELECT * FROM pago WHERE id=?")
      .get(id) as unknown as PagoRow | undefined;
    if (!pago) throw new NotFoundException("No encontramos ese cobro.");
    const turno = db
      .prepare("SELECT * FROM turno WHERE id=?")
      .get(pago.turno_id) as unknown as TurnoRow;
    const cliente = db
      .prepare("SELECT email FROM cliente WHERE id=?")
      .get(turno.cliente_id) as { email: string } | undefined;
    return {
      ...this.recibo(pago, turno),
      clienteEmail: cliente?.email ?? "",
    };
  }

  private validar(value: unknown): RegistrarPago {
    if (!value || typeof value !== "object")
      throw new BadRequestException("Indicá los datos del cobro.");
    const v = value as Record<string, unknown>;
    if (typeof v.turnoId !== "string" || !v.turnoId)
      throw new BadRequestException("Indicá el turno a cobrar.");
    if (
      typeof v.metodo !== "string" ||
      !METODOS_PAGO.includes(v.metodo as MetodoPago)
    )
      throw new BadRequestException("Elegí un método de pago válido.");
    if (
      typeof v.solicitudId !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        v.solicitudId,
      )
    )
      throw new BadRequestException("Identificador de solicitud inválido.");
    return {
      turnoId: v.turnoId,
      metodo: v.metodo as MetodoPago,
      solicitudId: v.solicitudId,
    };
  }

  private recibo(pago: PagoRow, turno: TurnoRow): PaymentReceipt {
    return {
      id: pago.id,
      turnoId: pago.turno_id,
      estado: pago.estado,
      metodo: pago.metodo,
      monto: pago.monto_centavos / 100,
      fecha: pago.creado_en,
      servicioNombre: turno.servicio_nombre,
      turnoFecha: turno.fecha,
      turnoHora: minutosAHora(turno.inicio),
      peluquero: this.personal.obtener(turno.peluquero_id).nombre,
      ...(pago.motivo_anulacion
        ? { motivoAnulacion: pago.motivo_anulacion }
        : {}),
    };
  }
}
