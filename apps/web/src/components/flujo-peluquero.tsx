"use client";

import { useCallback, useEffect, useState } from "react";
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

export function FlujoPeluquero({ onClose, initialSection = "agenda" }: { onClose: () => void; initialSection?: Section }) {
  const [section, setSection] = useState<Section>(initialSection);
  const [fecha, setFecha] = useState(businessToday());
  const [semanal, setSemanal] = useState(false);
  const [turnos, setTurnos] = useState<ReservationAdminView[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [indicators, setIndicators] = useState<BarberIndicatorSummary | null>(null);
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const range = dateRange(fecha, semanal);
  const loadAgenda = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setTurnos(await agendaRequest<ReservationAdminView[]>(`/reservations/assigned?desde=${range.desde}&hasta=${range.hasta}`));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo cargar tu agenda.");
    } finally {
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
      .finally(() => setLoading(false));
  }, [section, refresh]);

  useEffect(() => {
    if (section !== "indicadores") return;
    setLoading(true);
    setError("");
    agendaRequest<BarberIndicatorSummary>(`/users/me/indicators?fecha=${fecha}`)
      .then(setIndicators)
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "No se pudieron cargar tus indicadores."))
      .finally(() => setLoading(false));
  }, [section, fecha, refresh]);

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

  function actualizarFecha(value: string) {
    if (esFechaValida(value)) setFecha(value);
  }

  return (
    <section className="booking" aria-labelledby="barber-title">
      <header className="booking-header">
        <div>
          <p className="eyebrow">Área profesional</p>
          <h2 id="barber-title">{section === "agenda" ? "Mi agenda" : section === "perfil" ? "Mi perfil" : "Mis indicadores"}</h2>
        </div>
        <button className="button button-secondary" onClick={onClose}>Volver</button>
      </header>
      <nav className="barber-tabs" aria-label="Funciones del peluquero">
        <button className={section === "agenda" ? "button" : "button button-secondary"} onClick={() => setSection("agenda")}>Agenda y turnos</button>
        <button className={section === "perfil" ? "button" : "button button-secondary"} onClick={() => setSection("perfil")}>Mi perfil</button>
        <button className={section === "indicadores" ? "button" : "button button-secondary"} onClick={() => setSection("indicadores")}>Indicadores</button>
      </nav>

      {section === "agenda" && (
        <>
          <div className="barber-filters">
            <label className="booking-label date-field" htmlFor="barber-date">Fecha de inicio</label>
            <input id="barber-date" type="date" value={fecha} onChange={(event) => actualizarFecha(event.target.value)} />
            <label className="barber-check"><input type="checkbox" checked={semanal} onChange={(event) => setSemanal(event.target.checked)} /> Ver semana</label>
            <p className="booking-note">{range.desde === range.hasta ? dateLabel(range.desde) : `${dateLabel(range.desde)} – ${dateLabel(range.hasta)}`}</p>
          </div>
          {loading ? <p role="status">Cargando agenda…</p> : turnos.length ? (
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

      {section === "perfil" && (loading ? <p role="status">Cargando perfil…</p> : profile && (
        <form className="barber-profile" onSubmit={saveProfile}>
          <label htmlFor="barber-name">Nombre</label>
          <input id="barber-name" value={nombre} onChange={(event) => setNombre(event.target.value)} required />
          <label htmlFor="barber-email">Correo de acceso</label>
          <input id="barber-email" value={profile.email} readOnly />
          <label htmlFor="barber-phone">Teléfono</label>
          <input id="barber-phone" value={telefono} onChange={(event) => setTelefono(event.target.value)} />
          <button className="button" disabled={busy}>Guardar perfil</button>
        </form>
      ))}

      {section === "indicadores" && (loading ? <p role="status">Cargando indicadores…</p> : indicators && (
        <div className="barber-indicators">
          <label className="booking-label date-field" htmlFor="indicator-date">Día</label>
          <input id="indicator-date" type="date" value={fecha} onChange={(event) => actualizarFecha(event.target.value)} />
          <dl className="indicator-grid">
            <div><dt>Turnos completados</dt><dd>{indicators.turnosCompletados}</dd></div>
            <div><dt>Ingresos estimados</dt><dd>{money(indicators.ingresosEstimados)}</dd></div>
            <div><dt>Turnos completados el día anterior</dt><dd>{indicators.turnosDiaAnterior}</dd></div>
            <div><dt>Rating</dt><dd>{indicators.rating === null ? "Sin datos" : indicators.rating.toFixed(1)}</dd></div>
          </dl>
          {indicators.rating === null && <p className="booking-note">El rating se mostrará cuando se defina su origen y cálculo.</p>}
        </div>
      ))}

      {error && <p role="alert" className="error-message">{error}</p>}
      {notice && <p role="status" className="status-note">{notice}</p>}
    </section>
  );
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
