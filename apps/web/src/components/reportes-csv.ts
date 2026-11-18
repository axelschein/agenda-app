import type { PanelIndicadores } from "@agenda-app/shared";

const TIME_ZONE = "America/Argentina/Buenos_Aires";

export function fechaGeneracionLabel(value: string): string {
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "short",
    timeStyle: "medium",
    timeZone: TIME_ZONE,
  }).format(new Date(value));
}

function celdaCsv(value: string | number): string {
  const printable =
    typeof value === "number"
      ? String(value).replace(".", ",")
      : /^[\t\r\n ]*[=+\-@]/.test(value)
        ? `'${value}`
        : value;
  return `"${printable.replaceAll('"', '""')}"`;
}

function filaCsv(values: Array<string | number>): string {
  return values.map(celdaCsv).join(";");
}

export function generarCsvReportes(data: PanelIndicadores): string {
  const { resumen } = data;
  const turnosServicios = data.serviciosMasPedidos.reduce(
    (total, servicio) => total + servicio.cantidad,
    0,
  );
  const turnosPeluqueros = data.rendimientoPorPeluquero.reduce(
    (total, peluquero) => total + peluquero.turnos,
    0,
  );
  const ingresosPeluqueros = data.rendimientoPorPeluquero.reduce(
    (total, peluquero) => total + peluquero.ingresos,
    0,
  );
  const turnosDiarios = data.turnosPorDia.reduce(
    (total, dia) => total + dia.cantidad,
    0,
  );

  const filas: Array<Array<string | number>> = [
    ["AgendaApp — Reportes de gestión"],
    ["Generado el", fechaGeneracionLabel(data.generadoEn)],
    ["Zona horaria", TIME_ZONE],
    ["Período aplicado", `${resumen.desde} a ${resumen.hasta}`],
    [],
    ["Resumen del período"],
    ["Indicador", "Valor"],
    ["Turnos registrados", resumen.turnos],
    ...resumen.porEstado.map(({ estado, cantidad }) => [
      `Turnos ${estado.toLocaleLowerCase("es-AR")}`,
      cantidad,
    ]),
    ["Clientes activos", resumen.clientesActivos],
    ["Peluqueros/as con turnos", resumen.peluquerosActivos],
    ["Cobros registrados", resumen.cobros],
    ["Ingresos cobrados (ARS)", resumen.ingresos],
    ["Ticket promedio (ARS)", resumen.ticketPromedio],
    [],
    ["Servicios más pedidos"],
    ["Servicio", "Turnos"],
    ...data.serviciosMasPedidos.map(({ servicio, cantidad }) => [
      servicio,
      cantidad,
    ]),
    ["Total de turnos incluidos", turnosServicios],
    [],
    ["Rendimiento por peluquero/a"],
    ["Peluquero/a", "Turnos no cancelados", "Ingresos cobrados (ARS)"],
    ...data.rendimientoPorPeluquero.map(({ peluquero, turnos, ingresos }) => [
      peluquero,
      turnos,
      ingresos,
    ]),
    ["Totales", turnosPeluqueros, ingresosPeluqueros],
    [],
    ["Turnos por día"],
    ["Fecha", "Turnos no cancelados"],
    ...data.turnosPorDia.map(({ fecha, cantidad }) => [fecha, cantidad]),
    ["Total de turnos incluidos", turnosDiarios],
  ];

  return `\uFEFF${filas
    .map((fila) => (fila.length ? filaCsv(fila) : ""))
    .join("\r\n")}`;
}

export function descargarCsvReportes(data: PanelIndicadores): void {
  const blob = new Blob([generarCsvReportes(data)], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `agendaapp-reportes-${data.resumen.desde}-${data.resumen.hasta}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
