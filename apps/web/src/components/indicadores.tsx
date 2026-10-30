"use client";
import { useEffect, useState } from "react";
import type { PanelIndicadores } from "@agenda-app/shared";
import { agendaRequest, businessToday, dateLabel, money } from "./agenda-api";

function hace(dias: number): string {
  const d = new Date(Date.now() - dias * 86_400_000);
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function desplazarFecha(fecha: string, dias: number): string {
  if (!fecha) return "";
  const date = new Date(`${fecha}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return "";
  date.setUTCDate(date.getUTCDate() + dias);
  return date.toISOString().slice(0, 10);
}

function diasEntre(desde: string, hasta: string): number {
  return (Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / 86_400_000 + 1;
}

function completarDias(
  desde: string,
  hasta: string,
  turnosPorDia: PanelIndicadores["turnosPorDia"],
): PanelIndicadores["turnosPorDia"] {
  const cantidades = new Map(turnosPorDia.map(({ fecha, cantidad }) => [fecha, cantidad]));
  const dias: PanelIndicadores["turnosPorDia"] = [];
  for (let fecha = desde; fecha <= hasta; fecha = desplazarFecha(fecha, 1)) {
    dias.push({ fecha, cantidad: cantidades.get(fecha) ?? 0 });
  }
  return dias;
}

export function Indicadores({ onClose }: { onClose: () => void }) {
  const [initialPeriod] = useState(() => ({ desde: hace(30), hasta: businessToday() }));
  const [desde, setDesde] = useState(initialPeriod.desde);
  const [hasta, setHasta] = useState(initialPeriod.hasta);
  const [requestedPeriod, setRequestedPeriod] = useState(initialPeriod);
  const [data, setData] = useState<PanelIndicadores | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    const params = new URLSearchParams(requestedPeriod);
    agendaRequest<PanelIndicadores>("/reports/indicators?" + params)
      .then((r) => {
        if (active) setData(r);
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [requestedPeriod]);

  const r = data?.resumen;
  const dailyTurnos = completarDias(requestedPeriod.desde, requestedPeriod.hasta, data?.turnosPorDia ?? []);
  const dailyTurnosMax = Math.max(0, ...dailyTurnos.map((d) => d.cantidad));
  const dailyTurnosScale = Math.max(1, dailyTurnosMax);
  const maxDesde = desplazarFecha(hasta, -30);
  const maxHasta = desplazarFecha(desde, 30);
  const periodoValido = desde <= hasta && diasEntre(desde, hasta) <= 31;
  const chartWidth = 1000;
  const chartTop = 20;
  const chartBottom = 190;
  const chartLeft = 46;
  const chartRight = 982;
  const chartHeight = chartBottom - chartTop;
  const chartPoints = dailyTurnos.map((day, index) => ({
    ...day,
    x: dailyTurnos.length <= 1
      ? (chartLeft + chartRight) / 2
      : chartLeft + (index / (dailyTurnos.length - 1)) * (chartRight - chartLeft),
    y: chartBottom - (day.cantidad / dailyTurnosScale) * chartHeight,
  }));
  const chartPolyline = chartPoints.map((point) => `${point.x},${point.y}`).join(" ");
  const chartLabelIndexes = dailyTurnos.length <= 7
    ? dailyTurnos.map((_, index) => index)
    : [...new Set([0, Math.round((dailyTurnos.length - 1) / 3), Math.round(((dailyTurnos.length - 1) * 2) / 3), dailyTurnos.length - 1])];
  const chartYTicks = [...new Set([0, Math.ceil(dailyTurnosScale / 3), Math.ceil((dailyTurnosScale * 2) / 3), dailyTurnosScale])];
  return (
    <section className="booking" aria-labelledby="indic-title">
      <header className="booking-header">
        <button className="back-button" aria-label="Volver" onClick={onClose}>
          ‹
        </button>
        <h2 id="indic-title">Indicadores</h2>
      </header>
      <p className="form-help">
        Indicadores y reportes del {dateLabel(requestedPeriod.desde)} al {dateLabel(requestedPeriod.hasta)}.
      </p>
      <div className="report-filters">
        <label className="booking-label date-field">
          Desde
          <input type="date" value={desde} min={maxDesde} max={hasta} onChange={(e) => setDesde(e.target.value)} />
        </label>
        <label className="booking-label date-field">
          Hasta
          <input type="date" value={hasta} min={desde} max={maxHasta} onChange={(e) => setHasta(e.target.value)} />
        </label>
        <button
          className="button"
          type="button"
          onClick={() => {
            if (!periodoValido) {
              setError("El período no puede superar los 31 días.");
              return;
            }
            setLoading(true);
            setError("");
            setRequestedPeriod({ desde, hasta });
          }}
          disabled={!periodoValido || (desde === requestedPeriod.desde && hasta === requestedPeriod.hasta && loading)}
        >
          Consultar
        </button>
      </div>
      <p className="form-help report-range-help">El período puede incluir hasta 31 días.</p>

      {loading && <p role="status">Calculando indicadores…</p>}
      {error && (
        <p role="alert" className="error-message">
          {error}
        </p>
      )}

      {r && !loading && !error && (
        <>
          <div className="role-grid indicator-summary" aria-label="Resumen del período">
            <article className="receipt-card">
              <span className="role-label">Ingresos</span>
              <h3>{money(r.ingresos)}</h3>
              <p>{r.cobros} cobro(s) · ticket promedio {money(r.ticketPromedio)}</p>
            </article>
            <article className="receipt-card">
              <span className="role-label">Turnos</span>
              <h3>{r.turnos}</h3>
              <p>
                {r.porEstado.map((e) => `${e.estado}: ${e.cantidad}`).join(" · ") ||
                  "sin turnos"}
              </p>
            </article>
            <article className="receipt-card">
              <span className="role-label">Actividad</span>
              <h3>
                {r.clientesActivos} cliente(s)
              </h3>
              <p>{r.peluquerosActivos} peluquero/a(s) con turnos</p>
            </article>
          </div>

          <h3 className="booking-label report-heading">Servicios más pedidos</h3>
          {data!.serviciosMasPedidos.length ? (
            <ul className="report-list">
              {data!.serviciosMasPedidos.map((s) => (
                <li key={s.servicio}>
                  <span>{s.servicio}</span>
                  <strong>{s.cantidad}</strong>
                </li>
              ))}
            </ul>
          ) : (
            <p>Sin datos en el período.</p>
          )}

          <h3 className="booking-label report-heading">Rendimiento por peluquero/a</h3>
          {data!.rendimientoPorPeluquero.length ? (
            <ul className="report-list">
              {data!.rendimientoPorPeluquero.map((p) => (
                <li key={p.peluquero}>
                  <span>
                    {p.peluquero} · {p.turnos} turno(s)
                  </span>
                  <strong>{money(p.ingresos)}</strong>
                </li>
              ))}
            </ul>
          ) : (
            <p>Sin datos en el período.</p>
          )}

          <h3 className="booking-label report-heading">Turnos por día</h3>
          {dailyTurnos.length ? (
            <figure className="admin-line-chart">
              <figcaption>
                <strong>Turnos por día</strong>
                <span>Actividad en el período</span>
              </figcaption>
              <svg
                viewBox={`0 0 ${chartWidth} 244`}
                role="img"
                aria-label={`Turnos por día entre ${dateLabel(requestedPeriod.desde)} y ${dateLabel(requestedPeriod.hasta)}. Máximo: ${dailyTurnosMax} turnos en un día.`}
                preserveAspectRatio="none"
              >
                <g className="admin-line-chart-grid" aria-hidden="true">
                  {chartYTicks.map((tick) => {
                    const y = chartBottom - (tick / dailyTurnosScale) * chartHeight;
                    return (
                      <g key={tick}>
                        <line x1={chartLeft} x2={chartRight} y1={y} y2={y} />
                        <text x={chartLeft - 12} y={y + 4} textAnchor="end">{tick}</text>
                      </g>
                    );
                  })}
                </g>
                {chartPoints.length > 1 && (
                  <polyline className="admin-line-chart-line" points={chartPolyline} />
                )}
                {chartPoints.map((point) => (
                  <circle className="admin-line-chart-point" cx={point.x} cy={point.y} r="4" key={point.fecha}>
                    <title>{dateLabel(point.fecha)}: {point.cantidad} turno(s)</title>
                  </circle>
                ))}
                {chartLabelIndexes.map((index) => {
                  const point = chartPoints[index];
                  if (!point) return null;
                  const shortDate = new Intl.DateTimeFormat("es-AR", {
                    day: "2-digit",
                    month: "2-digit",
                    timeZone: "UTC",
                  }).format(new Date(`${point.fecha}T12:00:00Z`));
                  return (
                    <text className="admin-line-chart-date" x={point.x} y="224" textAnchor="middle" key={point.fecha}>
                      {shortDate}
                    </text>
                  );
                })}
              </svg>
            </figure>
          ) : (
            <p>Sin datos en el período.</p>
          )}
        </>
      )}
    </section>
  );
}
