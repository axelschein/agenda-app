"use client";
import { useEffect, useState } from "react";
import type { PaymentReceipt } from "@agenda-app/shared";
import { agendaRequest, dateLabel, money } from "./agenda-api";

const ESTADO_CLASE: Record<string, string> = {
  Registrado: "confirmado",
  Anulado: "cancelado",
};

export function MisPagos({ onClose }: { onClose: () => void }) {
  const [pagos, setPagos] = useState<PaymentReceipt[]>([]);
  const [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [reload, setReload] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    agendaRequest<PaymentReceipt[]>("/payments/mine")
      .then((r) => {
        if (active) setPagos(r);
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

  return (
    <section className="booking" aria-labelledby="mis-pagos-title">
      <header className="booking-header">
        <button className="back-button" aria-label="Volver" onClick={onClose}>
          ‹
        </button>
        <h2 id="mis-pagos-title">Mis pagos</h2>
      </header>
      <p className="form-help">El detalle de los cobros de tus turnos.</p>
      {loading && <p role="status">Cargando tus pagos…</p>}
      {error && (
        <p role="alert" className="error-message">
          {error}
        </p>
      )}
      {!loading && !error && pagos.length === 0 && (
        <p>Todavía no tenés pagos registrados.</p>
      )}
      {pagos.map((p) => (
        <article className="receipt-card" key={p.id}>
          <span
            className={`state-badge estado-${ESTADO_CLASE[p.estado] ?? "confirmado"}`}
          >
            {p.estado}
          </span>
          <h3>{p.servicioNombre}</h3>
          <p>con {p.peluquero}</p>
          <p>
            {dateLabel(p.turnoFecha)} · {p.turnoHora} hs
          </p>
          <p>
            {p.metodo} · {money(p.monto)}
          </p>
          {p.motivoAnulacion && <p>Motivo: {p.motivoAnulacion}</p>}
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
