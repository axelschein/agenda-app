"use client";
import { useEffect, useState } from "react";
import type { ReservationReceipt } from "@agenda-app/shared";
import { agendaRequest, dateLabel, money } from "./agenda-api";

const ESTADO_CLASE: Record<string, string> = {
  Pendiente: "pendiente",
  Confirmado: "confirmado",
  "En curso": "encurso",
  Completado: "completado",
  Cancelado: "cancelado",
};
const CANCELABLES = ["Pendiente", "Confirmado"];

export function MisTurnos({ onClose }: { onClose: () => void }) {
  const [turnos, setTurnos] = useState<ReservationReceipt[]>([]);
  const [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [busyId, setBusyId] = useState(""),
    [reload, setReload] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    agendaRequest<ReservationReceipt[]>("/reservations/mine")
      .then((r) => {
        if (active) setTurnos(r);
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

  async function cancelar(turno: ReservationReceipt) {
    if (busyId) return;
    if (
      !window.confirm(
        `¿Cancelar tu turno del ${dateLabel(turno.fecha)} a las ${turno.horaInicio}? El horario quedará libre para otra persona.`,
      )
    )
      return;
    setBusyId(turno.id);
    setError("");
    try {
      const actualizado = await agendaRequest<ReservationReceipt>(
        `/reservations/${encodeURIComponent(turno.id)}/cancel`,
        { method: "PATCH" },
      );
      setTurnos((todos) =>
        todos.map((t) => (t.id === actualizado.id ? actualizado : t)),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cancelar el turno.");
    } finally {
      setBusyId("");
    }
  }

  return (
    <section className="booking" aria-labelledby="mis-turnos-title">
      <header className="booking-header">
        <button className="back-button" aria-label="Volver" onClick={onClose}>
          ‹
        </button>
        <h2 id="mis-turnos-title">Mis turnos</h2>
      </header>
      <p className="form-help">
        Revisá el estado de tus reservas y cancelá las que no puedas asistir (con
        al menos 24 horas de anticipación).
      </p>
      {loading && <p role="status">Cargando tus turnos…</p>}
      {error && (
        <p role="alert" className="error-message">
          {error}
        </p>
      )}
      {!loading && !error && turnos.length === 0 && (
        <p>Todavía no tenés turnos registrados.</p>
      )}
      {turnos.map((t) => (
        <article className="receipt-card" key={t.id}>
          <span
            className={`state-badge estado-${ESTADO_CLASE[t.estado] ?? "pendiente"}`}
          >
            {t.estado}
          </span>
          <h3>{t.servicio.nombre}</h3>
          <p>con {t.peluquero.nombre}</p>
          <p>
            {dateLabel(t.fecha)} · {t.horaInicio} hs · {money(t.total)}
          </p>
          {t.motivoCancelacion && <p>Motivo: {t.motivoCancelacion}</p>}
          {CANCELABLES.includes(t.estado) && (
            <div className="service-actions">
              <button
                className="button button-danger"
                type="button"
                disabled={busyId === t.id}
                onClick={() => void cancelar(t)}
              >
                {busyId === t.id ? "Cancelando…" : "Cancelar turno"}
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
