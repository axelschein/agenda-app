"use client";
import { useEffect, useState, type FormEvent } from "react";
import type { ReservationAdminView } from "@agenda-app/shared";
import { agendaRequest, dateLabel, money } from "./agenda-api";

const ESTADO_CLASE: Record<string, string> = {
  Pendiente: "pendiente",
  Confirmado: "confirmado",
  "En curso": "encurso",
  Completado: "completado",
  Cancelado: "cancelado",
};

export function GestionReservas({ onClose }: { onClose: () => void }) {
  const [reservas, setReservas] = useState<ReservationAdminView[]>([]);
  const [valores, setValores] = useState({ desde: "", hasta: "", peluquero: "", cliente: "", estado: "" });
  const [filtros, setFiltros] = useState(valores);
  const [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [busyId, setBusyId] = useState(""),
    [reload, setReload] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    const params = new URLSearchParams();
    Object.entries(filtros).forEach(([key, value]) => { if (value) params.set(key, value); });
    const query = params.size ? `?${params.toString()}` : "";
    agendaRequest<ReservationAdminView[]>(`/reservations/all${query}`)
      .then((r) => {
        if (active) setReservas(r);
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
  }, [filtros, reload]);

  function aplicarFiltros(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFiltros({ ...valores });
  }

  function limpiarFiltros() {
    const vacios = { desde: "", hasta: "", peluquero: "", cliente: "", estado: "" };
    setValores(vacios);
    setFiltros(vacios);
  }

  async function rechazar(reserva: ReservationAdminView) {
    if (busyId) return;
    if (
      !window.confirm(
        `¿Rechazar el turno de ${reserva.clienteEmail} del ${dateLabel(reserva.fecha)} a las ${reserva.horaInicio}? El cliente verá que fue rechazado por el negocio.`,
      )
    )
      return;
    setBusyId(reserva.id);
    setError("");
    try {
      const actualizada = await agendaRequest<ReservationAdminView>(
        `/reservations/${encodeURIComponent(reserva.id)}/reject`,
        { method: "PATCH" },
      );
      setReservas((todas) =>
        todas.map((t) => (t.id === actualizada.id ? actualizada : t)),
      );
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No se pudo rechazar la reserva.",
      );
    } finally {
      setBusyId("");
    }
  }

  async function avanzar(reserva: ReservationAdminView, endpoint: string) {
    if (busyId) return;
    setBusyId(reserva.id);
    setError("");
    try {
      const actualizada = await agendaRequest<ReservationAdminView>(
        `/reservations/${encodeURIComponent(reserva.id)}/${endpoint}`,
        { method: "PATCH" },
      );
      setReservas((todas) =>
        todas.map((t) => (t.id === actualizada.id ? actualizada : t)),
      );
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No se pudo actualizar el turno.",
      );
    } finally {
      setBusyId("");
    }
  }

  return (
    <section className="booking" aria-labelledby="reservas-title">
      <header className="booking-header">
        <button className="back-button" aria-label="Volver" onClick={onClose}>
          ‹
        </button>
        <h2 id="reservas-title">Reservas del negocio</h2>
      </header>
      <form className="reservation-filters" onSubmit={aplicarFiltros}>
        <div className="service-form-fields">
          <div><label htmlFor="reservas-desde">Desde</label><input id="reservas-desde" type="date" value={valores.desde} onChange={(event) => setValores({ ...valores, desde: event.target.value })} /></div>
          <div><label htmlFor="reservas-hasta">Hasta</label><input id="reservas-hasta" type="date" value={valores.hasta} onChange={(event) => setValores({ ...valores, hasta: event.target.value })} /></div>
          <div><label htmlFor="reservas-peluquero">Peluquero/a</label><input id="reservas-peluquero" type="search" placeholder="Buscar por nombre" value={valores.peluquero} onChange={(event) => setValores({ ...valores, peluquero: event.target.value })} /></div>
          <div><label htmlFor="reservas-cliente">Cliente</label><input id="reservas-cliente" type="search" placeholder="Buscar por email" value={valores.cliente} onChange={(event) => setValores({ ...valores, cliente: event.target.value })} /></div>
          <div>
            <label htmlFor="reservas-estado">Estado</label>
            <select id="reservas-estado" value={valores.estado} onChange={(event) => setValores({ ...valores, estado: event.target.value })}>
              <option value="">Todos los estados</option>
              {Object.keys(ESTADO_CLASE).map((estado) => <option key={estado} value={estado}>{estado}</option>)}
            </select>
          </div>
        </div>
        <div className="service-form-actions">
          <button className="button" type="submit" disabled={loading}>Aplicar filtros</button>
          <button className="button button-secondary" type="button" onClick={limpiarFiltros} disabled={loading}>Limpiar</button>
        </div>
      </form>
      <p className="form-help">
        Consultá las reservas y rechazá las que el negocio no pueda atender. Al
        rechazar, el horario vuelve a quedar disponible para otros clientes.
      </p>
      {loading && <p role="status">Cargando reservas…</p>}
      {error && (
        <p role="alert" className="error-message">
          {error}
        </p>
      )}
      {!loading && !error && reservas.length === 0 && (
        <p role="status">{Object.values(filtros).some(Boolean) ? "No hay reservas que coincidan con los filtros." : "Todavía no hay reservas registradas."}</p>
      )}
      {reservas.map((r) => (
        <article className="receipt-card" key={r.id}>
          <span
            className={`state-badge estado-${ESTADO_CLASE[r.estado] ?? "pendiente"}`}
          >
            {r.estado}
          </span>
          <h3>{r.servicio.nombre}</h3>
          <p>Cliente: {r.clienteEmail}</p>
          <p>con {r.peluquero.nombre}</p>
          <p>
            {dateLabel(r.fecha)} · {r.horaInicio} hs · {money(r.total)}
          </p>
          {r.motivoCancelacion && <p>Motivo: {r.motivoCancelacion}</p>}
          {(r.estado === "Pendiente" || r.estado === "Confirmado") && (
            <div className="service-actions">
              {r.estado === "Pendiente" && (
                <button
                  className="button"
                  type="button"
                  disabled={busyId === r.id}
                  onClick={() => void avanzar(r, "admin-confirm")}
                >
                  {busyId === r.id ? "Procesando…" : "Confirmar"}
                </button>
              )}
              {r.estado === "Confirmado" && (
                <button
                  className="button"
                  type="button"
                  disabled={busyId === r.id}
                  onClick={() => void avanzar(r, "admin-complete")}
                >
                  {busyId === r.id ? "Procesando…" : "Marcar completado"}
                </button>
              )}
              {r.estado === "Pendiente" && (
                <button
                  className="button button-danger"
                  type="button"
                  disabled={busyId === r.id}
                  onClick={() => void rechazar(r)}
                >
                  {busyId === r.id ? "Rechazando…" : "Rechazar"}
                </button>
              )}
            </div>
          )}
        </article>
      ))}
      {error && (
        <button className="button" onClick={() => setReload((n) => n + 1)}>
          Reintentar
        </button>
      )}
    </section>
  );
}
