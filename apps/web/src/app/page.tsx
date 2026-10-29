import { getSession } from "../lib/session";
import { LoginView } from "../components/login-view";
import { Dashboard } from "../components/dashboard";

// La página depende de la sesión del visitante: nunca se cachea ni se
// prerenderiza de forma estática, se resuelve en cada pedido en el servidor.
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await getSession();
  return user ? <Dashboard user={user} /> : <LoginView />;
}