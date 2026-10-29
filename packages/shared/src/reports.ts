export interface IndicadoresResumen {
  desde: string;
  hasta: string;
  turnos: number;
  porEstado: { estado: string; cantidad: number }[];
  clientesActivos: number;
  peluquerosActivos: number;
  cobros: number;
  ingresos: number;
  ticketPromedio: number;
}

export interface ServicioPedido {
  servicio: string;
  cantidad: number;
}

export interface RendimientoPeluquero {
  peluquero: string;
  turnos: number;
  ingresos: number;
}

export interface TurnosPorDia {
  fecha: string;
  cantidad: number;
}

/** Panel de indicadores y reportes de Administración (CU12/CU14). */
export interface PanelIndicadores {
  resumen: IndicadoresResumen;
  serviciosMasPedidos: ServicioPedido[];
  rendimientoPorPeluquero: RendimientoPeluquero[];
  turnosPorDia: TurnosPorDia[];
}
