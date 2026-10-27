"use client";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import type { ServiceInput, ServiceOption } from "@agenda-app/shared";
import { agendaRequest, money } from "./agenda-api";

const emptyForm = { nombre: "", duracionMinutos: 60, precio: 0 };

export function CatalogoServicios({ onClose }: { onClose: () => void }) {
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [form, setForm] = useState<ServiceInput>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [saving, setSaving] = useState(false),
    [reload, setReload] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    agendaRequest<ServiceOption[]>("/services/admin")
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

  function startEdit(service: ServiceOption) {
    setEditingId(service.id);
    setForm({
      nombre: service.nombre,
      duracionMinutos: service.duracionMinutos,
      precio: service.precio,
    });
    setError("");
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
  }

  async function saveService(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      const path = editingId
        ? `/services/${encodeURIComponent(editingId)}`
        : "/services";
      await agendaRequest<ServiceOption>(path, {
        method: editingId ? "PUT" : "POST",
        body: JSON.stringify(form),
      });
      resetForm();
      setReload((n) => n + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar el servicio.");
    } finally {
      setSaving(false);
    }
  }

  async function deactivate(service: ServiceOption) {
    if (saving) return;
    if (
      !window.confirm(
        `¿Dar de baja “${service.nombre}”? Los turnos anteriores conservarán sus datos.`,
      )
    )
      return;
    setError("");
    setSaving(true);
    try {
      await agendaRequest(`/services/${encodeURIComponent(service.id)}`, {
        method: "DELETE",
      });
      if (editingId === service.id) resetForm();
      setReload((n) => n + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo dar de baja el servicio.");
    } finally {
      setSaving(false);
    }
  }

  async function reactivate(service: ServiceOption) {
    if (saving) return;
    setError("");
    setSaving(true);
    try {
      await agendaRequest(
        `/services/${encodeURIComponent(service.id)}/reactivate`,
        { method: "PATCH" },
      );
      setReload((n) => n + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo reactivar el servicio.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="booking" aria-labelledby="catalog-title">
      <header className="booking-header">
        <button className="back-button" aria-label="Volver" onClick={onClose}>
          ‹
        </button>
        <h2 id="catalog-title">Catálogo de servicios</h2>
      </header>
      <p className="form-help">
        Administrá los servicios que se ofrecen para nuevas reservas. La
        duración es estimada; cada turno ocupa el bloque configurado en
        Disponibilidad.
      </p>
      <form className="service-form" onSubmit={saveService}>
        <h3>{editingId ? "Editar servicio" : "Agregar servicio"}</h3>
        <label htmlFor="service-name">Nombre</label>
        <input
          id="service-name"
          maxLength={120}
          required
          value={form.nombre}
          onChange={(event) => setForm({ ...form, nombre: event.target.value })}
        />
        <div className="service-form-fields">
          <div>
            <label htmlFor="service-duration">Duración estimada (minutos)</label>
            <input
              id="service-duration"
              type="number"
              min={1}
              max={1440}
              step={1}
              required
              value={
                Number.isFinite(form.duracionMinutos)
                  ? form.duracionMinutos
                  : ""
              }
              onChange={(event) =>
                setForm({
                  ...form,
                  duracionMinutos:
                    event.target.value === ""
                      ? Number.NaN
                      : Number(event.target.value),
                })
              }
            />
          </div>
          <div>
            <label htmlFor="service-price">Precio (ARS)</label>
            <input
              id="service-price"
              type="number"
              min={0}
              max={1000000000}
              step="0.01"
              required
              value={Number.isFinite(form.precio) ? form.precio : ""}
              onChange={(event) =>
                setForm({
                  ...form,
                  precio:
                    event.target.value === ""
                      ? Number.NaN
                      : Number(event.target.value),
                })
              }
            />
          </div>
        </div>
        <div className="service-form-actions">
          <button className="button" type="submit" disabled={saving || loading}>
            {saving
              ? "Guardando…"
              : editingId
                ? "Guardar cambios"
                : "Agregar servicio"}
          </button>
          {editingId && (
            <button
              className="button button-secondary"
              type="button"
              onClick={resetForm}
            >
              Cancelar edición
            </button>
          )}
        </div>
      </form>
      {loading && <p role="status">Cargando servicios…</p>}
      {error && (
        <p role="alert" className="error-message">
          {error}
        </p>
      )}
      <h3>Servicios</h3>
      <div className="service-options">
        {services.map((s) => (
          <article
            className={`service-option ${s.activo === false ? "service-inactive" : ""}`}
            key={s.id}
          >
            <span>
              <strong>{s.nombre}</strong>
              <small>
                {s.duracionMinutos} min estimados
                {s.activo === false ? " · Dado de baja" : ""}
              </small>
            </span>
            <b>{money(s.precio)}</b>
            <div className="service-actions">
              {s.activo !== false ? (
                <>
                  <button
                    className="button button-secondary"
                    type="button"
                    disabled={saving || loading}
                    onClick={() => startEdit(s)}
                  >
                    Editar
                  </button>
                  <button
                    className="button button-danger"
                    type="button"
                    disabled={saving || loading}
                    onClick={() => void deactivate(s)}
                  >
                    Dar de baja
                  </button>
                </>
              ) : (
                <button
                  className="button button-secondary"
                  type="button"
                  disabled={saving || loading}
                  onClick={() => void reactivate(s)}
                >
                  Reactivar
                </button>
              )}
            </div>
          </article>
        ))}
      </div>
      {!loading && !error && services.length === 0 && (
        <p>No hay servicios cargados todavía.</p>
      )}
      {error && (
        <button className="button" onClick={() => setReload((n) => n + 1)}>
          Reintentar
        </button>
      )}
    </section>
  );
}
