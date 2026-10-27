"use client";
import { useEffect, useState } from "react";
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
  const [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [busyId, setBusyId] = useState(""),
    [reload, setReload] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    agendaRequest<ReservationAdminView[]>("/reservations/all")
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
  }, [reload]);

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

  return (
    <section className="booking" aria-labelledby="reservas-title">
      <header className="booking-header">
        <button className="back-button" aria-label="Volver" onClick={onClose}>
          ‹
        </button>
        <h2 id="reservas-title">Reservas del negocio</h2>
      </header>
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
        <p>Todavía no hay reservas registradas.</p>
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
          {r.estado === "Pendiente" && (
            <div className="service-actions">
              <button
                className="button button-danger"
                type="button"
                disabled={busyId === r.id}
                onClick={() => void rechazar(r)}
              >
                {busyId === r.id ? "Rechazando…" : "Rechazar"}
              </button>
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
