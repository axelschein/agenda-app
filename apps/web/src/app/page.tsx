"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import type { AuthResponse, AuthenticatedUser } from "@agenda-app/shared";

import { CatalogoServicios } from "../components/catalogo-servicios";
import { ReservaTurno } from "../components/reserva-turno";
import { HorariosLaborales } from "../components/horarios-laborales";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api/v1";

export default function HomePage() {
  const [view, setView] = useState<"home" | "booking" | "hours" | "services">(
    "home",
  );
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/auth/me`, { credentials: "include" })
      .then(async (response) => {
        if (!response.ok) return null;
        const result = (await response.json()) as AuthResponse;
        return result.user;
      })
      .then(setUser)
      .catch(() =>
        setError("No se pudo conectar con AgendaApp. Intentá de nuevo."),
      )
      .finally(() => setLoading(false));
  }, []);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        setError(
          "El correo o la contraseña no son correctos, o la cuenta no está habilitada.",
        );
        return;
      }

      const result = (await response.json()) as AuthResponse;
      setUser(result.user);
      setPassword("");
    } catch {
      setError(
        "No se pudo conectar con AgendaApp. Revisá que la API esté iniciada.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleLogout() {
    setError("");
    setLoggingOut(true);
    try {
      const response = await fetch(`${API_URL}/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) throw new Error("No se pudo cerrar la sesión.");
      setUser(null);
      setView("home");
    } catch {
      setError("No se pudo cerrar sesión. Intentá de nuevo.");
    } finally {
      setLoggingOut(false);
    }
  }

  if (loading) {
    return (
      <main className="page-shell">
        <p className="loading-note">Cargando AgendaApp…</p>
      </main>
    );
  }

  if (user) {
    return (
      <main className="page-shell">
        <section className="dashboard" aria-labelledby="page-title">
          <header className="dashboard-header">
            <div>
              <p className="eyebrow">
                AgendaApp ·{" "}
                {user.role === "ADMIN" ? "Administración" : "Cliente"}
              </p>
              <h1 id="page-title">Hola, {user.email}</h1>
            </div>
            <button
              className="button button-secondary"
              disabled={loggingOut}
              onClick={handleLogout}
            >
              {loggingOut ? "Cerrando sesión…" : "Cerrar sesión"}
            </button>
          </header>
          {view === "booking" && user.role === "CLIENT" ? (
            <ReservaTurno onClose={() => setView("home")} />
          ) : view === "hours" && user.role === "ADMIN" ? (
            <HorariosLaborales onClose={() => setView("home")} />
          ) : view === "services" && user.role === "ADMIN" ? (
            <CatalogoServicios onClose={() => setView("home")} />
          ) : user.role === "ADMIN" ? (
            <div className="role-grid" aria-label="Funciones de administración">
              <button
                className="role-card role-card-action"
                onClick={() => setView("services")}
              >
                <span className="role-label">Administración</span>
                <h2>Servicios</h2>
                <p>Consultá los servicios, precios y duraciones.</p>
              </button>
              <button
                className="role-card role-card-action"
                onClick={() => setView("hours")}
              >
                <span className="role-label">Administración</span>
                <h2>Disponibilidad</h2>
                <p>Configurá los días y horarios laborales.</p>
              </button>
              <RoleCard
                label="Administración"
                title="Reservas"
                description="Consultá y gestioná las reservas."
              />
            </div>
          ) : (
            <div className="role-grid" aria-label="Funciones de cliente">
              <button
                className="role-card role-card-action"
                onClick={() => setView("booking")}
              >
                <span className="role-label">Tu agenda</span>
                <h2>Reservar turno</h2>
                <p>Elegí servicio, profesional y horario disponible.</p>
              </button>
              <RoleCard
                label="Tu agenda"
                title="Mis reservas"
                description="Revisá el estado de tus reservas."
              />
            </div>
          )}
          {error && (
            <p className="error-message" role="alert">
              {error}
            </p>
          )}
          {view === "home" && (
            <p className="status-note">
              {user.role === "CLIENT"
                ? "Entrá en Reservar turno para hacer una reserva o consultar tus turnos registrados."
                : "Servicios permite consultar el catálogo y Disponibilidad configura la jornada laboral. La gestión de reservas del negocio está pendiente."}
            </p>
          )}
        </section>
      </main>
    );
  }

  return (
    <main className="page-shell">
      <section className="login-layout" aria-labelledby="page-title">
        <div className="intro-panel">
          <p className="eyebrow">AgendaApp · MVP</p>
          <h1 id="page-title">Tu agenda, en orden.</h1>
          <p className="intro">
            Ingresá para acceder a las funciones habilitadas para tu cuenta.
          </p>
          <div
            className="role-grid role-grid-intro"
            aria-label="Perfiles disponibles"
          >
            <div className="role-chip">Cliente</div>
            <div className="role-chip">Administrador</div>
          </div>
        </div>
        <form className="login-card" onSubmit={handleLogin}>
          <h2>Iniciar sesión</h2>
          <p className="form-help">
            Usá el correo y la contraseña de una cuenta habilitada.
          </p>
          <label htmlFor="email">Correo electrónico</label>
          <input
            autoComplete="username"
            id="email"
            name="email"
            onChange={(event) => setEmail(event.target.value)}
            required
            type="email"
            value={email}
          />
          <label htmlFor="password">Contraseña</label>
          <input
            autoComplete="current-password"
            id="password"
            name="password"
            onChange={(event) => setPassword(event.target.value)}
            required
            type="password"
            value={password}
          />
          {error && (
            <p className="error-message" role="alert">
              {error}
            </p>
          )}
          <button className="button" disabled={submitting} type="submit">
            {submitting ? "Ingresando…" : "Ingresar"}
          </button>
        </form>
      </section>
    </main>
  );
}

function RoleCard({
  label,
  title,
  description,
}: {
  label: string;
  title: string;
  description: string;
}) {
  return (
    <article className="role-card">
      <span className="role-label">{label}</span>
      <h2>{title}</h2>
      <p>{description}</p>
    </article>
  );
}
