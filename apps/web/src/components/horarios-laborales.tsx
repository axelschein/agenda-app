"use client";
import { useEffect, useState } from "react";
import type {
  AgendaSettings,
  BarberOption,
  WorkingWindow,
} from "@agenda-app/shared";
import { agendaRequest } from "./agenda-api";
const days = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
];
export function HorariosLaborales({ onClose }: { onClose: () => void }) {
  const [block, setBlock] = useState<number | null>(null),
    [blockInput, setBlockInput] = useState(""),
    [blockSaving, setBlockSaving] = useState(false);
  const [barbers, setBarbers] = useState<BarberOption[]>([]),
    [barber, setBarber] = useState("");
  const [windows, setWindows] = useState<WorkingWindow[]>([]),
    [loading, setLoading] = useState(true),
    [saving, setSaving] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [reload, setReload] = useState(0),
    [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let active = true;
    agendaRequest<AgendaSettings>("/availability/settings")
      .then((r) => {
        if (active) {
          setBlock(r.duracionBloqueMinutos);
          setBlockInput(String(r.duracionBloqueMinutos));
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    agendaRequest<BarberOption[]>("/reservations/barbers")
      .then((r) => {
        if (active) setBarbers(r);
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
  }, []);
  useEffect(() => {
    setLoaded(false);
    setWindows([]);
    setError("");
    setNotice("");
    if (!barber) return;
    let active = true;
    setLoading(true);
    agendaRequest<WorkingWindow[]>(
      "/availability/working-hours/" + encodeURIComponent(barber),
    )
      .then((r) => {
        if (active) {
          setWindows(r);
          setLoaded(true);
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
  }, [barber, reload]);
  async function saveBlock() {
    setBlockSaving(true);
    setError("");
    setNotice("");
    try {
      const result = await agendaRequest<AgendaSettings>(
        "/availability/settings",
        {
          method: "PUT",
          body: JSON.stringify({ duracionBloqueMinutos: Number(blockInput) }),
        },
      );
      setBlock(result.duracionBloqueMinutos);
      setBlockInput(String(result.duracionBloqueMinutos));
      setNotice(
        "Duración del bloque guardada. Se aplica a las nuevas reservas; las existentes conservan su duración.",
      );
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No se pudo guardar el bloque.",
      );
    } finally {
      setBlockSaving(false);
    }
  }
  function update(index: number, key: keyof WorkingWindow, value: string) {
    setNotice("");
    setWindows((ws) =>
      ws.map((w, i) =>
        i === index
          ? { ...w, [key]: key === "dia" ? Number(value) : value }
          : w,
      ),
    );
  }
  async function save() {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const r = await agendaRequest<WorkingWindow[]>(
        "/availability/working-hours/" + encodeURIComponent(barber),
        { method: "PUT", body: JSON.stringify({ franjas: windows }) },
      );
      setWindows(r);
      setNotice("Horarios guardados. Ya se usan para las nuevas reservas.");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No se pudieron guardar los horarios.",
      );
    } finally {
      setSaving(false);
    }
  }
  return (
    <section className="booking" aria-labelledby="hours-title">
      <header className="booking-header">
        <button
          className="back-button"
          aria-label="Volver"
          disabled={saving}
          onClick={onClose}
        >
          ‹
        </button>
        <h2 id="hours-title">Horarios laborales</h2>
      </header>
      <p className="form-help">
        Configurá la jornada semanal por profesional. El sistema ofrece bloques
        del tamaño definido por el negocio. Los días sin jornada no se ofrecen
        para reservar.
      </p>
      <div className="booking-note">
        <label className="booking-label date-field" htmlFor="block-minutes">
          Duración de cada reserva (minutos)
          <input
            id="block-minutes"
            type="number"
            min="1"
            max="1440"
            step="1"
            value={blockInput}
            disabled={block === null || blockSaving}
            onChange={(e) => setBlockInput(e.target.value)}
          />
        </label>
        <p>
          Valor inicial: 60 minutos. Se guarda en la base y aplica a todos los
          profesionales. No modifica reservas existentes.
        </p>
        <button
          className="button"
          disabled={block === null || blockSaving || saving || !blockInput}
          onClick={saveBlock}
        >
          {blockSaving ? "Guardando…" : "Guardar duración del bloque"}
        </button>
      </div>
      <label className="booking-label date-field">
        Peluquero/a
        <select
          value={barber}
          disabled={saving}
          onChange={(e) => setBarber(e.target.value)}
        >
          <option value="">Elegí un profesional</option>
          {barbers.map((b) => (
            <option key={b.id} value={b.id}>
              {b.nombre}
            </option>
          ))}
        </select>
      </label>
      {loading && <p role="status">Cargando horarios…</p>}
      {error && (
        <p role="alert" className="error-message">
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      {barber && loaded && !loading && (
        <>
          <div className="working-windows">
            {windows.map((w, i) => (
              <div className="working-window" key={i}>
                <label>
                  Día
                  <select
                    aria-label={"Día franja " + (i + 1)}
                    value={w.dia}
                    disabled={saving}
                    onChange={(e) => update(i, "dia", e.target.value)}
                  >
                    {days.map((d, n) => (
                      <option value={n} key={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Desde
                  <input
                    type="time"
                    value={w.inicio}
                    disabled={saving}
                    onChange={(e) => update(i, "inicio", e.target.value)}
                  />
                </label>
                <label>
                  Hasta
                  <input
                    type="time"
                    value={w.fin}
                    disabled={saving}
                    onChange={(e) => update(i, "fin", e.target.value)}
                  />
                </label>
                <button
                  className="text-button"
                  aria-label={"Quitar franja " + (i + 1)}
                  disabled={saving}
                  onClick={() => {
                    setWindows((ws) => ws.filter((_, n) => n !== i));
                    setNotice("");
                  }}
                >
                  Quitar
                </button>
              </div>
            ))}
          </div>
          {windows.length === 0 && (
            <p>No se ofrecen horarios para este profesional.</p>
          )}
          <button
            className="button button-secondary"
            disabled={
              saving || blockSaving || block === null || windows.length >= 28
            }
            onClick={() =>
              setWindows((ws) => [
                ...ws,
                {
                  dia: 1,
                  inicio: "09:00",
                  fin:
                    block !== null && block <= 840
                      ? String(Math.floor((540 + block) / 60)).padStart(
                          2,
                          "0",
                        ) +
                        ":" +
                        String((540 + block) % 60).padStart(2, "0")
                      : "23:00",
                },
              ])
            }
          >
            Agregar franja laboral
          </button>
          <button
            className="button booking-primary"
            disabled={saving}
            onClick={save}
          >
            {saving ? "Guardando…" : "Guardar horarios"}
          </button>
          <p className="form-help">
            La jornada indica cuándo trabaja el profesional. Cada reserva ocupa
            un bloque del tamaño configurado, no la jornada completa. Cambiar la
            jornada no cancela turnos ya registrados. El personal y catálogo se
            precargan para este MVP.
          </p>
        </>
      )}
      {barber && !loaded && !loading && (
        <button className="button" onClick={() => setReload((n) => n + 1)}>
          Reintentar consulta
        </button>
      )}
    </section>
  );
}
