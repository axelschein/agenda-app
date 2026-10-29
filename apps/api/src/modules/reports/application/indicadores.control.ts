import { BadRequestException, Injectable } from "@nestjs/common";
import type {
  IndicadoresResumen,
  PanelIndicadores,
  RendimientoPeluquero,
  ServicioPedido,
  TurnosPorDia,
} from "@agenda-app/shared";
import { AgendaDatabase } from "../../../persistence/agenda-database.js";
import { PersonalControl } from "../../users/index.js";
import { validarFecha } from "../../availability/index.js";

/**
 * Indicadores y reportes de Administración (CU12/CU14).
 * Consultas SQL con filtros de período, relaciones reales y agregaciones
 * (COUNT, SUM, AVG). Solo lectura; el acceso lo restringe el controlador (Admin).
 */
@Injectable()
export class IndicadoresControl {
  constructor(
    private readonly database: AgendaDatabase,
    private readonly personal: PersonalControl,
  ) {}

  panel(desdeValue: unknown, hastaValue: unknown): PanelIndicadores {
    const desde = validarFecha(desdeValue);
    const hasta = validarFecha(hastaValue);
    if (hasta < desde)
      throw new BadRequestException("El período 'hasta' no puede ser anterior a 'desde'.");
    return {
      resumen: this.resumen(desde, hasta),
      serviciosMasPedidos: this.serviciosMasPedidos(desde, hasta),
      rendimientoPorPeluquero: this.rendimientoPorPeluquero(desde, hasta),
      turnosPorDia: this.turnosPorDia(desde, hasta),
    };
  }

  private resumen(desde: string, hasta: string): IndicadoresResumen {
    const db = this.database.db;
    const turnos = (
      db
        .prepare("SELECT COUNT(*) n FROM turno WHERE fecha BETWEEN ? AND ?")
        .get(desde, hasta) as { n: number }
    ).n;
    const porEstado = db
      .prepare(
        "SELECT estado, COUNT(*) cantidad FROM turno WHERE fecha BETWEEN ? AND ? GROUP BY estado ORDER BY estado",
      )
      .all(desde, hasta) as unknown as { estado: string; cantidad: number }[];
    const activos = db
      .prepare(
        `SELECT COUNT(DISTINCT cliente_id) clientes, COUNT(DISTINCT peluquero_id) peluqueros
         FROM turno WHERE fecha BETWEEN ? AND ? AND estado <> 'Cancelado'`,
      )
      .get(desde, hasta) as { clientes: number; peluqueros: number };
    const dinero = db
      .prepare(
        `SELECT COALESCE(SUM(p.monto_centavos),0) suma, COUNT(p.id) cobros,
                COALESCE(AVG(p.monto_centavos),0) promedio
         FROM pago p JOIN turno t ON t.id = p.turno_id
         WHERE p.estado <> 'Anulado' AND t.fecha BETWEEN ? AND ?`,
      )
      .get(desde, hasta) as { suma: number; cobros: number; promedio: number };
    return {
      desde,
      hasta,
      turnos,
      porEstado,
      clientesActivos: activos.clientes,
      peluquerosActivos: activos.peluqueros,
      cobros: dinero.cobros,
      ingresos: dinero.suma / 100,
      ticketPromedio: Math.round(dinero.promedio) / 100,
    };
  }

  private serviciosMasPedidos(desde: string, hasta: string): ServicioPedido[] {
    return (
      this.database.db
        .prepare(
          `SELECT t.servicio_nombre servicio, COUNT(*) cantidad
           FROM turno t
           WHERE t.fecha BETWEEN ? AND ? AND t.estado <> 'Cancelado'
           GROUP BY t.servicio_nombre
           ORDER BY cantidad DESC, servicio`,
        )
        .all(desde, hasta) as unknown as ServicioPedido[]
    );
  }

  private rendimientoPorPeluquero(
    desde: string,
    hasta: string,
  ): RendimientoPeluquero[] {
    const rows = this.database.db
      .prepare(
        `SELECT t.peluquero_id,
                COUNT(DISTINCT t.id) turnos,
                COALESCE(SUM(CASE WHEN p.estado <> 'Anulado' THEN p.monto_centavos ELSE 0 END),0) ingresos
         FROM turno t
         LEFT JOIN pago p ON p.turno_id = t.id
         WHERE t.fecha BETWEEN ? AND ? AND t.estado <> 'Cancelado'
         GROUP BY t.peluquero_id
         ORDER BY ingresos DESC, turnos DESC`,
      )
      .all(desde, hasta) as unknown as {
      peluquero_id: string;
      turnos: number;
      ingresos: number;
    }[];
    return rows.map((row) => ({
      peluquero: this.personal.obtener(row.peluquero_id, true).nombre,
      turnos: row.turnos,
      ingresos: row.ingresos / 100,
    }));
  }

  private turnosPorDia(desde: string, hasta: string): TurnosPorDia[] {
    return (
      this.database.db
        .prepare(
          `SELECT fecha, COUNT(*) cantidad
           FROM turno
           WHERE fecha BETWEEN ? AND ? AND estado <> 'Cancelado'
           GROUP BY fecha
           ORDER BY fecha`,
        )
        .all(desde, hasta) as unknown as TurnosPorDia[]
    );
  }
}
