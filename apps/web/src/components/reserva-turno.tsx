"use client";
import { useEffect, useRef, useState } from "react";
import type {
  AvailabilityResponse,
  BarberOption,
  ReservationReceipt,
  ReservationSummary,
  ServiceOption,
} from "@agenda-app/shared";
import {
  AgendaError,
  agendaRequest,
  businessToday,
  dateLabel,
  money,
} from "./agenda-api";

const icons: Record<string, string> = {
  corte: "✂",
  "corte-barba": "◈",
  coloracion: "✦",
  barba: "▥",
};
export function ReservaTurno({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0);
  const [catalogReload, setCatalogReload] = useState(0);
  const [services, setServices] = useState<ServiceOption[]>([]),
    [barbers, setBarbers] = useState<BarberOption[]>([]);
  const [service, setService] = useState(""),
    [barber, setBarber] = useState("");
  const [date, setDate] = useState(businessToday),
    [time, setTime] = useState("");
  const [slots, setSlots] = useState<string[]>([]),
    [summary, setSummary] = useState<ReservationSummary | null>(null);
  const [receipt, setReceipt] = useState<ReservationReceipt | null>(null),
    [mine, setMine] = useState<ReservationReceipt[] | null>(null);
  const [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [reload, setReload] = useState(0),
    [showMine, setShowMine] = useState(false);
  const requestId = useRef(""),
    lock = useRef(false),
    heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, [step, receipt, showMine]);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    Promise.all([
      agendaRequest<ServiceOption[]>("/reservations/services"),
      agendaRequest<BarberOption[]>("/reservations/barbers"),
    ])
      .then(([s, b]) => {
        if (active) {
          setServices(s);
          setBarbers(b);
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
  }, [catalogReload]);
  useEffect(() => {
    requestId.current = crypto.randomUUID();
    setSummary(null);
    setTime("");
    setSlots([]);
    if (!service || !barber || !date) return;
    let active = true;
    setLoading(true);
    const params = new URLSearchParams({
      servicioId: service,
      peluqueroId: barber,
      fecha: date,
    });
    agendaRequest<AvailabilityResponse>("/reservations/availability?" + params)
      .then((r) => {
        if (active) setSlots(r.horarios);
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
  }, [service, barber, date, reload]);
  function chooseTime(value: string) {
    setTime(value);
    setSummary(null);
    requestId.current = crypto.randomUUID();
  }
  async function review() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await agendaRequest<ReservationSummary>(
        "/reservations/summary",
        {
          method: "POST",
          body: JSON.stringify({
            servicioId: service,
            peluqueroId: barber,
            fecha: date,
            horaInicio: time,
          }),
        },
      );
      setSummary(result);
      setStep(2);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No se pudo obtener el resumen.",
      );
      if (e instanceof AgendaError && e.status === 409) setReload((n) => n + 1);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function confirm() {
    if (!summary || lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await agendaRequest<ReservationReceipt>("/reservations", {
        method: "POST",
        body: JSON.stringify({
          servicioId: service,
          peluqueroId: barber,
          fecha: date,
          horaInicio: time,
          solicitudId: requestId.current,
          precioRevisado: summary.total,
          duracionRevisada: summary.servicio.duracionMinutos,
        }),
      });
      setReceipt(result);
      setStep(3);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No se pudo registrar la reserva.",
      );
      if (e instanceof AgendaError && (e.status === 409 || e.status === 404)) {
        setStep(1);
        setReload((n) => n + 1);
      }
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function viewMine() {
    setBusy(true);
    setError("");
    try {
      setMine(await agendaRequest<ReservationReceipt[]>("/reservations/mine"));
      setShowMine(true);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No se pudieron consultar los turnos.",
      );
    } finally {
      setBusy(false);
    }
  }
  const title = showMine
    ? "Mis turnos"
    : receipt
      ? "¡Turno reservado!"
      : step === 2
        ? "Resumen"
        : "Reservar turno";
  return (
    <section className="booking" aria-labelledby="booking-title">
      <header className="booking-header">
        <button
          className="back-button"
          aria-label="Volver"
          disabled={busy}
          onClick={() => {
            setError("");
            if (showMine) setShowMine(false);
            else if (receipt || step === 0) onClose();
            else setStep((s) => s - 1);
          }}
        >
          ‹
        </button>
        <h2 ref={heading} tabIndex={-1} id="booking-title">
          {title}
        </h2>
      </header>
      {!receipt && !showMine && (
        <ol className="booking-progress" aria-label="Pasos de la reserva">
          {["Servicio", "Fecha y hora", "Resumen", "Reserva"].map(
            (label, i) => (
              <li
                key={label}
                className={i <= step ? "active" : ""}
                aria-current={i === step ? "step" : undefined}
              >
                <span>
                  {i + 1}. {label}
                </span>
              </li>
            ),
          )}
        </ol>
      )}
      {error && (
        <div role="alert" className="error-message booking-error">
          {error}
          <button className="text-button" onClick={() => setError("")}>
            Cerrar aviso
          </button>
        </div>
      )}
      {loading && !showMine && !receipt && (
        <p role="status">Consultando disponibilidad…</p>
      )}
      {showMine ? (
        <>
          <p className="form-help">
            Tus reservas registradas y su estado actual.
          </p>
          {mine?.length ? (
            mine.map((r) => <ReceiptCard key={r.id} receipt={r} />)
          ) : (
            <p>No tenés turnos registrados todavía.</p>
          )}
          <button
            className="button"
            onClick={() => {
              setShowMine(false);
              setReceipt(null);
              setStep(0);
              setReload((n) => n + 1);
            }}
          >
            Reservar otro turno
          </button>
        </>
      ) : receipt ? (
        <>
          <div className="reservation-success" role="status">
            <span aria-hidden="true">✓</span>
            <p>
              Tu solicitud quedó registrada. Está pendiente de confirmación por
              la peluquería.
            </p>
          </div>
          <ReceiptCard receipt={receipt} />
          <button
            className="button booking-primary"
            disabled={busy}
            onClick={viewMine}
          >
            Ver mis turnos
          </button>
          <button className="text-button" onClick={onClose}>
            Volver al inicio
          </button>
        </>
      ) : (
        <>
          {step === 0 && (
            <>
              <h3 className="booking-label">Elegí tu servicio</h3>
              <div
                className="service-options"
                role="group"
                aria-label="Servicios"
              >
                {services.map((s) => (
                  <button
                    key={s.id}
                    className={
                      "service-option " + (service === s.id ? "selected" : "")
                    }
                    aria-pressed={service === s.id}
                    onClick={() => {
                      setService(s.id);
                      setError("");
                    }}
                  >
                    <span className="service-icon" aria-hidden="true">
                      {icons[s.id] ?? "✂"}
                    </span>
                    <span>
                      <strong>{s.nombre}</strong>
                      <small>{s.duracionMinutos} min</small>
                    </span>
                    <b>{money(s.precio)}</b>
                  </button>
                ))}
              </div>
              {!loading && !services.length && (
                <div>
                  <p>No hay servicios disponibles para reservar.</p>
                  <button
                    className="text-button"
                    onClick={() => setCatalogReload((n) => n + 1)}
                  >
                    Reintentar consulta
                  </button>
                </div>
              )}
              <div className="booking-actions">
                <button
                  className="button booking-primary"
                  disabled={!service || loading}
                  onClick={() => {
                    setStep(1);
                    setError("");
                  }}
                >
                  Continuar
                </button>
                <button
                  className="text-button"
                  disabled={busy}
                  onClick={viewMine}
                >
                  Ver mis turnos
                </button>
              </div>
            </>
          )}
          {step === 1 && (
            <>
              <h3 className="booking-label">Elegí peluquero/a</h3>
              <div
                className="barber-options"
                role="group"
                aria-label="Peluqueros y peluqueras"
              >
                {barbers.map((b, i) => (
                  <button
                    key={b.id}
                    className={
                      "barber-option " + (barber === b.id ? "selected" : "")
                    }
                    aria-pressed={barber === b.id}
                    disabled={busy}
                    onClick={() => setBarber(b.id)}
                  >
                    <span className={"avatar avatar-" + i} aria-hidden="true">
                      {b.nombre
                        .split(" ")
                        .map((n) => n[0])
                        .join("")}
                    </span>
                    <strong>{b.nombre}</strong>
                  </button>
                ))}
              </div>
              {!barbers.length && !loading && (
                <p>No hay personal disponible.</p>
              )}
              <label
                className="booking-label date-field"
                htmlFor="booking-date"
              >
                Fecha
                <input
                  id="booking-date"
                  type="date"
                  min={businessToday()}
                  value={date}
                  disabled={busy}
                  onChange={(e) => setDate(e.target.value)}
                />
              </label>
              <h3 className="booking-label">Horarios disponibles</h3>
              <p className="form-help">
                Hora de Buenos Aires. Se reserva la duración completa del
                servicio.
              </p>
              <div className="slot-options" role="group" aria-label="Horarios">
                {slots.map((h) => (
                  <button
                    key={h}
                    className={"slot-option " + (time === h ? "selected" : "")}
                    aria-pressed={time === h}
                    disabled={busy}
                    onClick={() => chooseTime(h)}
                  >
                    {h}
                  </button>
                ))}
              </div>
              {!loading && barber && date && !slots.length && (
                <p role="status">
                  No hay horarios disponibles para esa fecha. Probá con otro día
                  o profesional.
                </p>
              )}
              <div className="booking-actions">
                <button
                  className="button booking-primary"
                  disabled={!time || loading || busy}
                  onClick={review}
                >
                  {busy ? "Preparando resumen…" : "Revisar reserva"}
                </button>
                <button
                  className="text-button"
                  disabled={busy || loading || !barber || !date}
                  onClick={() => setReload((n) => n + 1)}
                >
                  Actualizar horarios
                </button>
              </div>
            </>
          )}
          {step === 2 && summary && (
            <>
              <p className="form-help">Revisá los datos antes de confirmar.</p>
              <SummaryCard summary={summary} />
              <p className="booking-note">
                Al reservar, el turno queda Pendiente hasta que la peluquería lo
                confirme.
              </p>
              <div className="booking-actions">
                <button
                  className="button booking-primary"
                  disabled={busy}
                  onClick={confirm}
                >
                  {busy ? "Registrando reserva…" : "Confirmar reserva"}
                </button>
                <button
                  className="text-button"
                  disabled={busy}
                  onClick={() => setStep(1)}
                >
                  Modificar selección
                </button>
              </div>
            </>
          )}
        </>
      )}
    </section>
  );
}
function SummaryCard({ summary }: { summary: ReservationSummary }) {
  return (
    <dl className="summary-card">
      <div>
        <dt>Servicio</dt>
        <dd>{summary.servicio.nombre}</dd>
      </div>
      <div>
        <dt>Peluquero/a</dt>
        <dd>{summary.peluquero.nombre}</dd>
      </div>
      <div>
        <dt>Fecha</dt>
        <dd>{dateLabel(summary.fecha)}</dd>
      </div>
      <div>
        <dt>Hora</dt>
        <dd>{summary.horaInicio} hs</dd>
      </div>
      <div>
        <dt>Duración</dt>
        <dd>{summary.servicio.duracionMinutos} min</dd>
      </div>
      <div className="summary-total">
        <dt>Total</dt>
        <dd>{money(summary.total)}</dd>
      </div>
    </dl>
  );
}
function ReceiptCard({ receipt }: { receipt: ReservationReceipt }) {
  return (
    <article className="receipt-card">
      <span className="state-badge">{receipt.estado}</span>
      <h3>{receipt.servicio.nombre}</h3>
      <p>con {receipt.peluquero.nombre}</p>
      <p>
        {dateLabel(receipt.fecha)} · {receipt.horaInicio} hs
      </p>
      <p>
        {receipt.servicio.duracionMinutos} min · {money(receipt.total)}
      </p>
      <small>Reserva {receipt.id}</small>
    </article>
  );
}
