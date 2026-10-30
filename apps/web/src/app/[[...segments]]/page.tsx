import { redirect } from "next/navigation";
import type { AuthenticatedUser } from "@agenda-app/shared";
import { getSession } from "../../lib/session";
import { LoginView } from "../../components/login-view";
import { Dashboard } from "../../components/dashboard";

export const dynamic = "force-dynamic";

type RouteView =
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

const routeViews: Record<string, RouteView> = {
  admin: "home",
  "admin/servicios": "services",
  "admin/disponibilidad": "hours",
  "admin/reservas": "reservas",
  "admin/personal": "personal",
  "admin/cobros": "cobros",
  "admin/indicadores": "indicadores",
  peluquero: "home",
  "peluquero/agenda": "peluquero",
  "peluquero/perfil": "peluquero-perfil",
  "peluquero/indicadores": "peluquero-indicadores",
  cliente: "home",
  "cliente/reservar": "booking",
  "cliente/turnos": "mis-turnos",
  "cliente/pagos": "pagos",
};

const roleHomes: Record<AuthenticatedUser["role"], string> = {
  ADMIN: "/admin",
  BARBER: "/peluquero",
  CLIENT: "/cliente",
};

const rolePrefixes: Record<AuthenticatedUser["role"], string> = {
  ADMIN: "admin",
  BARBER: "peluquero",
  CLIENT: "cliente",
};

export default async function AppPage({
  params,
}: {
  params: Promise<{ segments?: string[] }>;
}) {
  const { segments = [] } = await params;
  const path = segments.join("/");
  const user = await getSession();

  if (!user) {
    if (path) redirect("/");
    return <LoginView />;
  }

  if (!path) redirect(roleHomes[user.role]);

  const view = routeViews[path];
  if (!view || !path.startsWith(rolePrefixes[user.role])) {
    redirect(roleHomes[user.role]);
  }

  return <Dashboard user={user} />;
}
