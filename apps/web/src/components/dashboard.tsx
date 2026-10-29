"use client";

import { useState } from "react";
import type { AuthenticatedUser } from "@agenda-app/shared";
import { useRouter } from "next/navigation";

import { API_URL } from "./agenda-api";
import { CatalogoServicios } from "./catalogo-servicios";
import { ReservaTurno } from "./reserva-turno";
import { HorariosLaborales } from "./horarios-laborales";
import { GestionReservas } from "./gestion-reservas";
import { MisTurnos } from "./mis-turnos";

type View = "home" | "booking" | "hours" | "services" | "reservas" | "mis-turnos";

/**
 * Isla cliente del panel autenticado. Recibe el usuario ya resuelto en el
 * servidor (sin fetch de /auth/me tras el montaje) y solo maneja la
 * interacción: cambio de vista y cierre de sesión.
 */
export function Dashboard({ user }: { user: AuthenticatedUser }) {
  const router = useRouter();
  const [view, setView] = useState<View>("home");
  const [error, setError] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setError("");
    setLoggingOut(true);
    try {
      const response = await fetch(`${API_URL}/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) throw new Error("No se pudo cerrar la sesión.");
      router.refresh();
    } catch {
      setError("No se pudo cerrar sesión. Intentá de nuevo.");
      setLoggingOut(false);
    }
  }

  return (
    <main className="page-shell">
      <section className="dashboard" aria-labelledby="page-title">
        <header className="dashboard-header">
          <div>
            <p className="eyebrow">
              AgendaApp · {user.role === "ADMIN" ? "Administración" : "Cliente"}
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
        ) : view === "reservas" && user.role === "ADMIN" ? (
          <GestionReservas onClose={() => setView("home")} />
        ) : view === "mis-turnos" && user.role === "CLIENT" ? (
          <MisTurnos onClose={() => setView("home")} />
        ) : user.role === "ADMIN" ? (
          <div className="role-grid" aria-label="Funciones de administración">
            <button
              className="role-card role-card-action"
              onClick={() => setView("services")}
            >
              <span className="role-label">Administración</span>
              <h2>Servicios</h2>
              <p>Mantené los servicios, sus precios y duraciones estimadas.</p>
            </button>
            <button
              className="role-card role-card-action"
              onClick={() => setView("hours")}
            >
              <span className="role-label">Administración</span>
              <h2>Disponibilidad</h2>
              <p>Configurá los días y horarios laborales.</p>
            </button>
            <button
              className="role-card role-card-action"
              onClick={() => setView("reservas")}
            >
              <span className="role-label">Administración</span>
              <h2>Reservas</h2>
              <p>Consultá las reservas y rechazá las que no puedas atender.</p>
            </button>
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
            <button
              className="role-card role-card-action"
              onClick={() => setView("mis-turnos")}
            >
              <span className="role-label">Tu agenda</span>
              <h2>Mis turnos</h2>
              <p>Revisá el estado de tus reservas y cancelá las que no puedas asistir.</p>
            </button>
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
              : "Servicios administra el catálogo, Disponibilidad configura la jornada laboral y Reservas permite consultar y rechazar turnos."}
          </p>
        )}
      </section>
    </main>
  );
}
