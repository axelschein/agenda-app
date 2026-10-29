"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { agendaRequest } from "./agenda-api";

interface Professional {
  id: string;
  nombre: string;
  telefono: string;
  activo: boolean;
}

export function GestionPersonal({ onClose }: { onClose: () => void }) {
  const [profiles, setProfiles] = useState<Professional[]>([]);
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function load() {
    setLoading(true);
    try {
      setProfiles(await agendaRequest<Professional[]>("/users/admin/peluqueros"));
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo cargar el personal.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const added = await agendaRequest<Professional>("/users/admin/peluqueros", {
        method: "POST",
        body: JSON.stringify({ nombre, telefono }),
      });
      setProfiles((current) => [...current, added].sort((a, b) => a.nombre.localeCompare(b.nombre)));
      setNombre("");
      setTelefono("");
      setNotice("Perfil profesional creado. La cuenta de acceso se habilita por configuración.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo crear el perfil.");
    } finally {
      setBusy(false);
    }
  }

  async function toggle(profile: Professional) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const updated = await agendaRequest<Professional>(`/users/admin/peluqueros/${encodeURIComponent(profile.id)}`, {
        method: "PUT",
        body: JSON.stringify({ nombre: profile.nombre, telefono: profile.telefono, activo: !profile.activo }),
      });
      setProfiles((current) => current.map((item) => item.id === updated.id ? updated : item));
      setNotice(updated.activo ? "Perfil profesional activado." : "Perfil profesional dado de baja.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo actualizar el perfil.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="booking" aria-labelledby="staff-title">
      <header className="booking-header">
        <div><p className="eyebrow">Administración</p><h2 id="staff-title">Personal profesional</h2></div>
        <button className="button button-secondary" onClick={onClose}>Volver</button>
      </header>
      <form className="barber-profile" onSubmit={create}>
        <h3>Agregar peluquero/a</h3>
        <label htmlFor="new-staff-name">Nombre</label>
        <input id="new-staff-name" value={nombre} onChange={(event) => setNombre(event.target.value)} required />
        <label htmlFor="new-staff-phone">Teléfono</label>
        <input id="new-staff-phone" value={telefono} onChange={(event) => setTelefono(event.target.value)} />
        <button className="button" disabled={busy}>Crear perfil</button>
      </form>
      {loading ? <p role="status">Cargando personal…</p> : profiles.length ? (
        <div className="barber-appointments">
          {profiles.map((profile) => (
            <article className="barber-appointment" key={profile.id}>
              <div><h3>{profile.nombre}</h3><p>{profile.telefono || "Sin teléfono"}</p><p>{profile.activo ? "Activo" : "Inactivo"} · ID {profile.id}</p></div>
              <button className="button button-secondary" disabled={busy} onClick={() => void toggle(profile)}>{profile.activo ? "Dar de baja" : "Reactivar"}</button>
            </article>
          ))}
        </div>
      ) : !error && <p className="status-note">Todavía no hay peluqueros/as registrados.</p>}
      {error && <p role="alert" className="error-message">{error}</p>}
      {notice && <p role="status" className="status-note">{notice}</p>}
    </section>
  );
}
