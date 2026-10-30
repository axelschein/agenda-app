"use client";

import Image from "next/image";
import { useState } from "react";
import type { AuthenticatedUser } from "@agenda-app/shared";
import { usePathname, useRouter } from "next/navigation";

import { API_URL } from "./agenda-api";
import { CatalogoServicios } from "./catalogo-servicios";
import { ReservaTurno } from "./reserva-turno";
import { HorariosLaborales } from "./horarios-laborales";
import { GestionReservas } from "./gestion-reservas";
import { MisTurnos } from "./mis-turnos";
import { FlujoPeluquero } from "./flujo-peluquero";
import { GestionPersonal } from "./gestion-personal";
import { Cobros } from "./cobros";
import { MisPagos } from "./mis-pagos";
import { Indicadores } from "./indicadores";

type View =
  | "home"
  | "booking"
  | "hours"
  | "services"
  | "reservas"
  | "mis-turnos"
  | "peluquero"
  | "peluquero-perfil"
  | "peluquero-indicadores"
  | "personal"
  | "cobros"
  | "pagos"
  | "indicadores";

/**
 * Isla cliente del panel autenticado. Recibe el usuario ya resuelto en el
 * servidor (sin fetch de /auth/me tras el montaje) y solo maneja la
 * interacción: cambio de vista y cierre de sesión.
 */
export function Dashboard({ user }: { user: AuthenticatedUser }) {
  const router = useRouter();
  const pathname = usePathname();
  const view = viewForPath(user.role, pathname);
  const [error, setError] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);

  function navigate(nextView: View) {
    const nextPath = pathForView(user.role, nextView);
    if (user.role === "BARBER" && nextView.startsWith("peluquero")) {
      if (pathname !== nextPath) window.history.pushState(null, "", nextPath);
      return;
    }
    router.push(nextPath);
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
      router.push("/");
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
          <div className="dashboard-identity">
            <Image className="dashboard-logo" src="/agendaapp-icon.png" alt="" width={56} height={56} priority />
            <div>
              <p className="eyebrow dashboard-eyebrow">
                AgendaApp ·{" "}
                {user.role === "ADMIN"
                  ? "Administración"
                  : user.role === "BARBER"
                    ? "Peluquero/a"
                    : "Cliente"}
              </p>
              <h1 id="page-title">Hola, {user.email}</h1>
            </div>
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
          <ReservaTurno onClose={() => navigate("home")} />
        ) : view === "hours" && user.role === "ADMIN" ? (
          <HorariosLaborales onClose={() => navigate("home")} />
        ) : view === "services" && user.role === "ADMIN" ? (
          <CatalogoServicios onClose={() => navigate("home")} />
        ) : view === "reservas" && user.role === "ADMIN" ? (
          <GestionReservas onClose={() => navigate("home")} />
        ) : view === "mis-turnos" && user.role === "CLIENT" ? (
          <MisTurnos onClose={() => navigate("home")} />
        ) : (view === "peluquero" || view === "peluquero-perfil" || view === "peluquero-indicadores") &&
          user.role === "BARBER" ? (
          <FlujoPeluquero
            onClose={() => navigate("home")}
            initialSection={view === "peluquero-perfil" ? "perfil" : view === "peluquero-indicadores" ? "indicadores" : "agenda"}
            onSectionChange={(section) => navigate(section === "perfil" ? "peluquero-perfil" : section === "indicadores" ? "peluquero-indicadores" : "peluquero")}
          />
        ) : view === "personal" && user.role === "ADMIN" ? (
          <GestionPersonal onClose={() => navigate("home")} />
        ) : view === "cobros" && user.role === "ADMIN" ? (
          <Cobros onClose={() => navigate("home")} />
        ) : view === "pagos" && user.role === "CLIENT" ? (
          <MisPagos onClose={() => navigate("home")} />
        ) : view === "indicadores" && user.role === "ADMIN" ? (
          <Indicadores onClose={() => navigate("home")} />
        ) : user.role === "ADMIN" ? (
          <div className="role-grid" aria-label="Funciones de administración">
            <button
              className="role-card role-card-action"
              onClick={() => navigate("services")}
            >
              <span className="role-label">Administración</span>
              <h2>Servicios</h2>
              <p>Mantené los servicios, sus precios y duraciones estimadas.</p>
            </button>
            <button
              className="role-card role-card-action"
              onClick={() => navigate("hours")}
            >
              <span className="role-label">Administración</span>
              <h2>Disponibilidad</h2>
              <p>Configurá los días y horarios laborales.</p>
            </button>
            <button
              className="role-card role-card-action"
              onClick={() => navigate("reservas")}
            >
              <span className="role-label">Administración</span>
              <h2>Reservas</h2>
              <p>Consultá las reservas y rechazá las que no puedas atender.</p>
            </button>
            <button
              className="role-card role-card-action"
              onClick={() => navigate("personal")}
            >
              <span className="role-label">Administración</span>
              <h2>Personal</h2>
              <p>Registrá y actualizá los perfiles profesionales.</p>
            </button>
            <button
              className="role-card role-card-action"
              onClick={() => navigate("cobros")}
            >
              <span className="role-label">Administración</span>
              <h2>Cobros</h2>
              <p>Registrá y consultá los cobros de los turnos confirmados.</p>
            </button>
            <button
              className="role-card role-card-action"
              onClick={() => navigate("indicadores")}
            >
              <span className="role-label">Administración</span>
              <h2>Indicadores</h2>
              <p>Consultá ingresos, turnos y reportes del negocio por período.</p>
            </button>
          </div>
        ) : user.role === "BARBER" ? (
          <div className="role-grid" aria-label="Funciones del peluquero">
            <button
              className="role-card role-card-action"
              onClick={() => navigate("peluquero")}
            >
              <span className="role-label">Tu trabajo</span>
              <h2>Agenda y turnos</h2>
              <p>
                Consultá tu agenda, gestioná turnos pendientes y revisá tus
                indicadores.
              </p>
            </button>
            <button
              className="role-card role-card-action"
              onClick={() => navigate("peluquero-perfil")}
            >
              <span className="role-label">Tu perfil</span>
              <h2>Mi perfil</h2>
              <p>Consultá y actualizá los datos de tu perfil profesional.</p>
            </button>
            <button
              className="role-card role-card-action"
              onClick={() => navigate("peluquero-indicadores")}
            >
              <span className="role-label">Tu rendimiento</span>
              <h2>Indicadores</h2>
              <p>Consultá tus turnos completados e ingresos estimados.</p>
            </button>
          </div>
        ) : (
          <div className="role-grid" aria-label="Funciones de cliente">
            <button
              className="role-card role-card-action"
              onClick={() => navigate("booking")}
            >
              <span className="role-label">Tu agenda</span>
              <h2>Reservar turno</h2>
              <p>Elegí servicio, profesional y horario disponible.</p>
            </button>
            <button
              className="role-card role-card-action"
              onClick={() => navigate("mis-turnos")}
            >
              <span className="role-label">Tu agenda</span>
              <h2>Mis turnos</h2>
              <p>
                Revisá el estado de tus reservas y cancelá las que no puedas
                asistir.
              </p>
            </button>
            <button
              className="role-card role-card-action"
              onClick={() => navigate("pagos")}
            >
              <span className="role-label">Tu agenda</span>
              <h2>Mis pagos</h2>
              <p>Consultá el detalle de los cobros de tus turnos.</p>
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
              : user.role === "BARBER"
                ? "Entrá en Agenda y turnos para consultar tus asignaciones, gestionar turnos pendientes y revisar tus indicadores."
                : "Servicios administra el catálogo, Disponibilidad configura la jornada laboral y Reservas permite consultar y rechazar turnos."}
          </p>
        )}
      </section>
    </main>
  );
}

const homePath: Record<AuthenticatedUser["role"], string> = {
  ADMIN: "/admin",
  BARBER: "/peluquero",
  CLIENT: "/cliente",
};

const pathsByRole: Record<AuthenticatedUser["role"], Partial<Record<View, string>>> = {
  ADMIN: {
    services: "/admin/servicios",
    hours: "/admin/disponibilidad",
    reservas: "/admin/reservas",
    personal: "/admin/personal",
    cobros: "/admin/cobros",
    indicadores: "/admin/indicadores",
  },
  BARBER: {
    peluquero: "/peluquero/agenda",
    "peluquero-perfil": "/peluquero/perfil",
    "peluquero-indicadores": "/peluquero/indicadores",
  },
  CLIENT: {
    booking: "/cliente/reservar",
    "mis-turnos": "/cliente/turnos",
    pagos: "/cliente/pagos",
  },
};

const viewsByPath = Object.fromEntries(
  Object.entries(pathsByRole).flatMap(([, routes]) =>
    Object.entries(routes).map(([view, path]) => [path, view as View]),
  ),
) as Record<string, View>;

function viewForPath(role: AuthenticatedUser["role"], pathname: string): View {
  if (pathname === homePath[role]) return "home";
  return viewsByPath[pathname] ?? "home";
}

function pathForView(role: AuthenticatedUser["role"], view: View): string {
  return view === "home" ? homePath[role] : pathsByRole[role][view] ?? homePath[role];
}
