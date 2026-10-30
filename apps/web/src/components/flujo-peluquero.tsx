"use client";

import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import type { FormEvent } from "react";
import type { BarberIndicatorSummary, ReservationAdminView } from "@agenda-app/shared";
import { agendaRequest, businessToday, dateLabel, money } from "./agenda-api";

interface Profile {
  id: string;
  nombre: string;
  email: string;
  telefono: string;
}

type Section = "agenda" | "perfil" | "indicadores";

export function FlujoPeluquero({
  onClose,
  initialSection = "agenda",
  onSectionChange,
}: {
  onClose: () => void;
  initialSection?: Section;
  onSectionChange?: (section: Section) => void;
}) {
  const [section, setSection] = useState<Section>(initialSection);
  useLayoutEffect(() => setSection(initialSection), [initialSection]);
  const [fecha, setFecha] = useState(businessToday());
  const [indicadoresHasta, setIndicadoresHasta] = useState(businessToday());
  const [indicadoresDesde, setIndicadoresDesde] = useState(() => desplazarFecha(businessToday(), -6));
  const [indicadoresPeriodo, setIndicadoresPeriodo] = useState<7 | 14 | 21 | "custom">(7);
  const [semanal, setSemanal] = useState(false);
  const [turnos, setTurnos] = useState<ReservationAdminView[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [indicators, setIndicators] = useState<BarberIndicatorSummary | null>(null);
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [loading, setLoading] = useState(false);
  const [agendaReady, setAgendaReady] = useState(false);
  const [profileReady, setProfileReady] = useState(false);
  const [indicatorsReady, setIndicatorsReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const rating = indicators?.rating == null ? null : Math.min(5, Math.max(0, indicators.rating));
  const barberDailySeries = indicators ? completarTurnosPorDia(indicators.desde, indicators.hasta, indicators.turnosPorDia) : [];
  const turnosChartMax = Math.max(1, ...barberDailySeries.map((dia) => dia.cantidad));
  const lineChartPoints = barberDailySeries.map((dia, index) => ({
    ...dia,
    x: barberDailySeries.length <= 1 ? 464 : 48 + (index / (barberDailySeries.length - 1)) * 832,
    y: 184 - (dia.cantidad / turnosChartMax) * 150,
  }));
  const lineChartPolyline = lineChartPoints.map((point) => `${point.x},${point.y}`).join(" ");
  const lineChartLabelIndexes = barberDailySeries.length <= 5
    ? barberDailySeries.map((_, index) => index)
    : [...new Set([0, Math.round((barberDailySeries.length - 1) / 4), Math.round((barberDailySeries.length - 1) / 2), Math.round(((barberDailySeries.length - 1) * 3) / 4), barberDailySeries.length - 1])];
  const lineChartTicks = [...new Set([0, Math.ceil(turnosChartMax / 2), turnosChartMax])];
  const range = dateRange(fecha, semanal);
  const loadAgenda = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setTurnos(await agendaRequest<ReservationAdminView[]>(`/reservations/assigned?desde=${range.desde}&hasta=${range.hasta}`));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo cargar tu agenda.");
    } finally {
      setAgendaReady(true);
      setLoading(false);
    }
  }, [range.desde, range.hasta]);

  useEffect(() => {
    if (section === "agenda") void loadAgenda();
  }, [section, loadAgenda, refresh]);

  useEffect(() => {
    if (section !== "perfil") return;
    setLoading(true);
    setError("");
    agendaRequest<Profile>("/users/me")
      .then((value) => {
        setProfile(value);
        setNombre(value.nombre);
        setTelefono(value.telefono);
      })
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "No se pudo cargar tu perfil."))
      .finally(() => {
        setProfileReady(true);
        setLoading(false);
      });
  }, [section, refresh]);

  useEffect(() => {
    if (section !== "indicadores") return;
    if (indicadoresDesde > indicadoresHasta) {
      setError("La fecha inicial no puede ser posterior a la fecha final.");
      return;
    }
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ desde: indicadoresDesde, hasta: indicadoresHasta });
    agendaRequest<BarberIndicatorSummary>(`/users/me/indicators?${params}`)
      .then(setIndicators)
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "No se pudieron cargar tus indicadores."))
      .finally(() => {
        setIndicatorsReady(true);
        setLoading(false);
      });
  }, [section, indicadoresDesde, indicadoresHasta, refresh]);

  async function changeState(id: string, action: "confirm" | "reject-as-assigned") {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await agendaRequest<ReservationAdminView>(`/reservations/${encodeURIComponent(id)}/${action}`, { method: "PATCH" });
      setNotice(action === "confirm" ? "Turno confirmado." : "Turno rechazado.");
      setRefresh((value) => value + 1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo actualizar el turno.");
    } finally {
      setBusy(false);
    }
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const value = await agendaRequest<Profile>("/users/me", {
        method: "PUT",
        body: JSON.stringify({ nombre, telefono }),
      });
      setProfile(value);
      setNombre(value.nombre);
      setTelefono(value.telefono);
      setNotice("Perfil actualizado.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo guardar el perfil.");
    } finally {
      setBusy(false);
    }
  }

  function seleccionarPeriodoIndicadores(days: 7 | 14 | 21) {
    const hasta = businessToday();
    setIndicadoresPeriodo(days);
    setIndicadoresHasta(hasta);
    setIndicadoresDesde(desplazarFecha(hasta, -(days - 1)));
  }

  function cambiarFechaDesde(value: string) {
    if (!esFechaValida(value)) return;
    setIndicadoresPeriodo("custom");
    setIndicadoresDesde(value);
  }

  function cambiarFechaHasta(value: string) {
    if (!esFechaValida(value)) return;
    setIndicadoresPeriodo("custom");
    setIndicadoresHasta(value);
  }
  function actualizarFecha(value: string) {
    if (esFechaValida(value)) setFecha(value);
  }

  function navigateSection(nextSection: Section) {
    setSection(nextSection);
    onSectionChange?.(nextSection);
  }

  return (
    <section className="booking" aria-labelledby="barber-title">
      <header className="booking-header barber-header">
        <button className="back-button barber-back" aria-label="Volver" onClick={onClose}>‹</button>
        <h2 id="barber-title">{section === "agenda" ? "Mi agenda" : section === "perfil" ? "Mi perfil" : "Mis indicadores"}</h2>
      </header>
      <p className="form-help barber-subtitle">
        {section === "agenda"
          ? "Consultá tu agenda, gestioná turnos pendientes y revisá tus indicadores."
          : section === "perfil"
            ? "Consultá y actualizá los datos de tu perfil profesional."
            : "Consultá tus turnos completados e ingresos para el período seleccionado."}
      </p>
      <nav className="barber-tabs" aria-label="Funciones del peluquero">
        <button className={section === "agenda" ? "button" : "button button-secondary"} onClick={() => navigateSection("agenda")}>Agenda y turnos</button>
        <button className={section === "perfil" ? "button" : "button button-secondary"} onClick={() => navigateSection("perfil")}>Mi perfil</button>
        <button className={section === "indicadores" ? "button" : "button button-secondary"} onClick={() => navigateSection("indicadores")}>Indicadores</button>
      </nav>

      {section === "agenda" && (
        <>
          <div className="barber-filters">
            <label className="booking-label date-field" htmlFor="barber-date">Fecha de inicio</label>
            <input id="barber-date" type="date" value={fecha} onChange={(event) => actualizarFecha(event.target.value)} />
            <label className="barber-check"><input type="checkbox" checked={semanal} onChange={(event) => setSemanal(event.target.checked)} /> Ver semana</label>
            <p className="booking-note">{range.desde === range.hasta ? dateLabel(range.desde) : `${dateLabel(range.desde)} – ${dateLabel(range.hasta)}`}</p>
          </div>
          {!agendaReady && loading ? <p role="status">Cargando agenda…</p> : turnos.length ? (
            <div className="barber-appointments">
              {turnos.map((turno) => (
                <article className="barber-appointment" key={turno.id}>
                  <div>
                    <p className="eyebrow">{dateLabel(turno.fecha)} · {turno.horaInicio}</p>
                    <h3>{turno.servicio.nombre}</h3>
                    <p>Cliente: {turno.clienteEmail}</p>
                    <p>{turno.estado} · {money(turno.total)}</p>
                    {turno.motivoCancelacion && <p>Motivo: {turno.motivoCancelacion}</p>}
                  </div>
                  {turno.estado === "Pendiente" && (
                    <div className="barber-actions">
                      <button className="button" disabled={busy} onClick={() => void changeState(turno.id, "confirm")}>Confirmar</button>
                      <button className="button button-secondary" disabled={busy} onClick={() => void changeState(turno.id, "reject-as-assigned")}>Rechazar</button>
                    </div>
                  )}
                </article>
              ))}
            </div>
          ) : !error && <p className="status-note">No tenés turnos asignados para este período.</p>}
        </>
      )}

      {section === "perfil" && (!profileReady && loading ? <p role="status">Cargando perfil…</p> : profile && (
        <form className="barber-profile barber-profile-wide" onSubmit={saveProfile}>
          <label htmlFor="barber-name">Nombre</label>
          <input id="barber-name" value={nombre} onChange={(event) => setNombre(event.target.value)} required />
          <label htmlFor="barber-email">Correo de acceso</label>
          <input id="barber-email" value={profile.email} readOnly />
          <label htmlFor="barber-phone">Teléfono</label>
          <input id="barber-phone" value={telefono} onChange={(event) => setTelefono(event.target.value)} />
          <button className="button" disabled={busy}>Guardar perfil</button>
        </form>
      ))}

      {section === "indicadores" && (!indicatorsReady && loading ? <p role="status">Cargando indicadores…</p> : indicators && (
        <div className="barber-indicators">
          <div className="barber-indicators-toolbar">
            <div className="barber-period-heading">
              <h3>Resumen del período</h3>
              <p>{dateLabel(indicadoresDesde)} – {dateLabel(indicadoresHasta)}</p>
              <div className="barber-period-presets" role="group" aria-label="Duración del período">
                {([7, 14, 21] as const).map((days) => (
                  <button
                    className={indicadoresPeriodo === days ? "is-active" : ""}
                    type="button"
                    aria-pressed={indicadoresPeriodo === days}
                    key={days}
                    onClick={() => seleccionarPeriodoIndicadores(days)}
                  >
                    {days} días
                  </button>
                ))}
              </div>
              <p className="barber-period-help">También podés elegir fechas manualmente (máximo 90 días).</p>
            </div>
            <div className="barber-date-range-controls">
              <div className="barber-date-control">
                <label className="booking-label date-field" htmlFor="indicator-from">Desde</label>
                <input
                  id="indicator-from"
                  type="date"
                  max={indicadoresHasta}
                  value={indicadoresDesde}
                  onChange={(event) => cambiarFechaDesde(event.target.value)}
                />
              </div>
              <div className="barber-date-control">
                <label className="booking-label date-field" htmlFor="indicator-to">Hasta</label>
                <input
                  id="indicator-to"
                  type="date"
                  min={indicadoresDesde}
                  max={businessToday()}
                  value={indicadoresHasta}
                  onChange={(event) => cambiarFechaHasta(event.target.value)}
                />
              </div>
            </div>
          </div>
          <dl className="indicator-grid barber-indicator-grid">
            <div><dt>Turnos completados</dt><dd>{indicators.turnosCompletados}</dd></div>
            <div><dt>Ingresos estimados</dt><dd>{money(indicators.ingresosEstimados)}</dd></div>
            <div><dt>Turnos en el período anterior</dt><dd>{indicators.turnosPeriodoAnterior}</dd></div>
            <div>
              <dt>Rating</dt>
              <dd className="barber-rating-display">
                {rating === null ? (
                  <span className="barber-rating-score">Sin datos</span>
                ) : (
                  <>
                    <span className="barber-rating-stars" aria-hidden="true">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <span className={rating >= star - 0.5 ? "is-filled" : ""} key={star}>★</span>
                      ))}
                    </span>
                    <span className="barber-rating-score">{rating.toFixed(1)} / 5</span>
                  </>
                )}
              </dd>
            </div>
          </dl>
          <figure className="barber-turnos-chart">
            <figcaption>
              <strong>Turnos completados por día</strong>
              <span>Distribución en el período</span>
            </figcaption>
            <svg
              className="barber-line-chart"
              viewBox="0 0 900 230"
              role="img"
              aria-label={`Turnos completados por día entre ${dateLabel(indicadoresDesde)} y ${dateLabel(indicadoresHasta)}.`}
            >
              <g className="barber-line-chart-grid">
                {lineChartTicks.map((tick) => {
                  const y = 184 - (tick / turnosChartMax) * 150;
                  return (
                    <g key={tick}>
                      <line x1="48" x2="880" y1={y} y2={y} />
                      <text x="38" y={y}>{tick}</text>
                    </g>
                  );
                })}
              </g>
              {lineChartPoints.length > 1 && (
                <polygon className="barber-line-chart-area" points={`48,184 ${lineChartPolyline} 880,184`} />
              )}
              <polyline className="barber-line-chart-line" points={lineChartPolyline} />
              {lineChartPoints.map((point) => (
                <circle className="barber-line-chart-point" cx={point.x} cy={point.y} r="3.5" key={point.fecha}>
                  <title>{dateLabel(point.fecha)}: {point.cantidad} turno(s)</title>
                </circle>
              ))}
              {lineChartLabelIndexes.map((index) => {
                const point = lineChartPoints[index];
                if (!point) return null;
                return (
                  <text className="barber-line-chart-label" x={point.x} y="216" textAnchor="middle" key={point.fecha}>
                    {etiquetaFechaCorta(point.fecha)}
                  </text>
                );
              })}
            </svg>
          </figure>
          {indicators.rating === null && (
            <p className="barber-rating-note">
              <span aria-hidden="true">i</span>
              Las calificaciones todavía no se registran en la aplicación.
            </p>
          )}
        </div>
      ))}

      {error && <p role="alert" className="error-message">{error}</p>}
      {notice && <p role="status" className="status-note">{notice}</p>}
    </section>
  );
}

function desplazarFecha(value: string, days: number): string {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function completarTurnosPorDia(desde: string, hasta: string, valores: BarberIndicatorSummary["turnosPorDia"]): Array<{ fecha: string; cantidad: number }> {
  const porFecha = new Map(valores.map((dia) => [dia.fecha, dia.cantidad]));
  const start = Date.parse(`${desde}T00:00:00Z`);
  const end = Date.parse(`${hasta}T00:00:00Z`);
  const resultado: Array<{ fecha: string; cantidad: number }> = [];
  for (let timestamp = start; timestamp <= end; timestamp += 86_400_000) {
    const fecha = new Date(timestamp).toISOString().slice(0, 10);
    resultado.push({ fecha, cantidad: porFecha.get(fecha) ?? 0 });
  }
  return resultado;
}

function etiquetaFechaCorta(value: string): string {
  return new Intl.DateTimeFormat("es-AR", { timeZone: "UTC", day: "2-digit", month: "2-digit" }).format(new Date(`${value}T12:00:00Z`));
}
function dateRange(value: string, weekly: boolean): { desde: string; hasta: string } {
  const fechaSegura = esFechaValida(value) ? value : businessToday();
  if (!weekly) return { desde: fechaSegura, hasta: fechaSegura };
  const date = new Date(`${fechaSegura}T12:00:00Z`);
  const offset = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - offset);
  const desde = date.toISOString().slice(0, 10);
  date.setUTCDate(date.getUTCDate() + 6);
  return { desde, hasta: date.toISOString().slice(0, 10) };
}

function esFechaValida(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
