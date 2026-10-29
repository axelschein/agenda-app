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

export function Indicadores({ onClose }: { onClose: () => void }) {
  const [desde, setDesde] = useState(hace(30));
  const [hasta, setHasta] = useState(businessToday());
  const [data, setData] = useState<PanelIndicadores | null>(null);
  const [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ desde, hasta });
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reload]);

  const r = data?.resumen;
  return (
    <section className="booking" aria-labelledby="indic-title">
      <style>{`
        .report-list { list-style: none; padding: 0; margin: 0 0 1rem; display: flex; flex-direction: column; gap: 0.35rem; }
        .report-list li { display: flex; justify-content: space-between; gap: 1rem; padding: 0.5rem 0.75rem; border-radius: 0.5rem; background: rgba(127,127,127,0.12); }
      `}</style>
      <header className="booking-header">
        <button className="back-button" aria-label="Volver" onClick={onClose}>
          ‹
        </button>
        <h2 id="indic-title">Indicadores</h2>
      </header>
      <p className="form-help">
        Indicadores y reportes del negocio en el período elegido.
      </p>
      <div className="service-actions">
        <label className="booking-label date-field">
          Desde
          <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
        </label>
        <label className="booking-label date-field">
          Hasta
          <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
        </label>
        <button className="button" type="button" onClick={() => setReload((n) => n + 1)}>
          Consultar
        </button>
      </div>

      {loading && <p role="status">Calculando indicadores…</p>}
      {error && (
        <p role="alert" className="error-message">
          {error}
        </p>
      )}

      {r && !loading && !error && (
        <>
          <div className="role-grid" aria-label="Resumen del período">
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

          <h3 className="booking-label">Servicios más pedidos</h3>
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

          <h3 className="booking-label">Rendimiento por peluquero/a</h3>
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

          <h3 className="booking-label">Turnos por día</h3>
          {data!.turnosPorDia.length ? (
            <ul className="report-list">
              {data!.turnosPorDia.map((d) => (
                <li key={d.fecha}>
                  <span>{dateLabel(d.fecha)}</span>
                  <strong>{d.cantidad}</strong>
                </li>
              ))}
            </ul>
          ) : (
            <p>Sin datos en el período.</p>
          )}
        </>
      )}
    </section>
  );
}
