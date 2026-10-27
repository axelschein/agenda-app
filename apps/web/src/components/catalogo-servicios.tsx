"use client";
import { useEffect, useState } from "react";
import type { ServiceOption } from "@agenda-app/shared";
import { agendaRequest, money } from "./agenda-api";
export function CatalogoServicios({ onClose }: { onClose: () => void }) {
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [reload, setReload] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    agendaRequest<ServiceOption[]>("/reservations/services")
      .then((result) => {
        if (active) setServices(result);
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
    <section className="booking" aria-labelledby="catalog-title">
      <header className="booking-header">
        <button className="back-button" aria-label="Volver" onClick={onClose}>
          ‹
        </button>
        <h2 id="catalog-title">Servicios disponibles</h2>
      </header>
      <p className="form-help">
        Catálogo de servicios, precios y duración estimada. La edición del
        catálogo todavía no está disponible.
      </p>
      {loading && <p role="status">Cargando servicios…</p>}
      {error && (
        <p role="alert" className="error-message">
          {error}
        </p>
      )}
      <div className="service-options">
        {services.map((s) => (
          <article className="service-option" key={s.id}>
            <span>
              <strong>{s.nombre}</strong>
              <small>{s.duracionMinutos} min</small>
            </span>
            <b>{money(s.precio)}</b>
          </article>
        ))}
      </div>
      {!loading && !error && services.length === 0 && (
        <p>No hay servicios disponibles.</p>
      )}
      {error && (
        <button className="button" onClick={() => setReload((n) => n + 1)}>
          Reintentar
        </button>
      )}
    </section>
  );
}
