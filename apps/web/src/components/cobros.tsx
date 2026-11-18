"use client";
import { useEffect, useState } from "react";
import type {
  MetodoPago,
  PaymentReceipt,
  PendingCharge,
} from "@agenda-app/shared";
import { agendaRequest, dateLabel, money } from "./agenda-api";

export function Cobros({ onClose }: { onClose: () => void }) {
  const [pendientes, setPendientes] = useState<PendingCharge[]>([]);
  const [metodos, setMetodos] = useState<MetodoPago[]>([]);
  const [elegido, setElegido] = useState<Record<string, MetodoPago>>({});
  const [constancia, setConstancia] = useState<PaymentReceipt | null>(null);
  const [loading, setLoading] = useState(true),
    [busyId, setBusyId] = useState(""),
    [error, setError] = useState(""),
    [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    Promise.all([
      agendaRequest<PendingCharge[]>("/payments/pending"),
      agendaRequest<MetodoPago[]>("/payments/methods"),
    ])
      .then(([p, m]) => {
        if (active) {
          setPendientes(p);
          setMetodos(m);
        }
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

  async function cobrar(turno: PendingCharge) {
    if (busyId) return;
    const metodo = elegido[turno.turnoId] ?? metodos[0];
    if (!metodo) return;
    setBusyId(turno.turnoId);
    setError("");
    try {
      const recibo = await agendaRequest<PaymentReceipt>("/payments", {
        method: "POST",
        body: JSON.stringify({
          turnoId: turno.turnoId,
          metodo,
          solicitudId: crypto.randomUUID(),
        }),
      });
      setConstancia(recibo);
      setReload((n) => n + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo registrar el cobro.");
    } finally {
      setBusyId("");
    }
  }

  async function anular(id: string) {
    if (busyId) return;
    if (!window.confirm("¿Anular este cobro? El turno volverá a quedar pendiente de cobro.")) return;
    setBusyId(id);
    setError("");
    try {
      const recibo = await agendaRequest<PaymentReceipt>(
        `/payments/${encodeURIComponent(id)}/void`,
        { method: "PATCH" },
      );
      setConstancia(recibo);
      setReload((n) => n + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo anular el cobro.");
    } finally {
      setBusyId("");
    }
  }

  return (
    <section className="booking" aria-labelledby="cobros-title">
      <header className="booking-header">
        <button className="back-button" aria-label="Volver" onClick={onClose}>
          ‹
        </button>
        <h2 id="cobros-title">Cobros</h2>
      </header>
      <p className="form-help">
        Registrá el cobro de los turnos confirmados o completados. El monto es el
        precio del turno.
      </p>
      {constancia && (
        <article className="receipt-card" aria-live="polite">
          <span
            className={`state-badge estado-${constancia.estado === "Anulado" ? "cancelado" : "confirmado"}`}
          >
            {constancia.estado === "Anulado" ? "Cobro anulado" : "Cobro registrado"}
          </span>
          <h3>Constancia · {constancia.servicioNombre}</h3>
          <p>con {constancia.peluquero}</p>
          <p>
            {dateLabel(constancia.turnoFecha)} · {constancia.turnoHora} hs
          </p>
          <p>
            {constancia.metodo} · {money(constancia.monto)}
          </p>
          <small>Cobro {constancia.id}</small>
          {constancia.estado === "Registrado" && (
            <div className="service-actions">
              <button
                className="button button-danger"
                type="button"
                disabled={busyId === constancia.id}
                onClick={() => void anular(constancia.id)}
              >
                {busyId === constancia.id ? "Anulando…" : "Anular cobro"}
              </button>
            </div>
          )}
        </article>
      )}
      <section className="payment-list" aria-labelledby="pending-payments-title">
        <h3
          className="booking-label payment-list-heading"
          id="pending-payments-title"
        >
          Turnos pendientes de cobro
        </h3>
        {loading && <p role="status">Cargando pendientes…</p>}
        {error && (
          <p role="alert" className="error-message">
            {error}
          </p>
        )}
        {!loading && !error && pendientes.length === 0 && (
          <p className="payment-empty">No hay turnos pendientes de cobro.</p>
        )}
        {pendientes.map((t) => (
          <article className="receipt-card" key={t.turnoId}>
            <span className="state-badge estado-confirmado">{t.estadoTurno}</span>
            <h3>{t.servicioNombre}</h3>
            <p>Cliente: {t.clienteEmail}</p>
            <p>con {t.peluquero}</p>
            <p>
              {dateLabel(t.fecha)} · {t.horaInicio} hs · {money(t.monto)}
            </p>
            <div className="service-actions">
              <label className="sr-only" htmlFor={`metodo-${t.turnoId}`}>
                Método de pago
              </label>
              <select
                id={`metodo-${t.turnoId}`}
                value={elegido[t.turnoId] ?? metodos[0] ?? ""}
                disabled={busyId === t.turnoId}
                onChange={(e) =>
                  setElegido((prev) => ({
                    ...prev,
                    [t.turnoId]: e.target.value as MetodoPago,
                  }))
                }
              >
                {metodos.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
              <button
                className="button"
                type="button"
                disabled={busyId === t.turnoId}
                onClick={() => void cobrar(t)}
              >
                {busyId === t.turnoId ? "Cobrando…" : "Cobrar"}
              </button>
            </div>
          </article>
        ))}
      </section>
      {error && (
        <button className="button" onClick={() => setReload((n) => n + 1)}>
          Reintentar
        </button>
      )}
    </section>
  );
}
