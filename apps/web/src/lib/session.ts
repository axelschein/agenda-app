import { cookies } from "next/headers";
import type { AuthResponse, AuthenticatedUser } from "@agenda-app/shared";

const SESSION_COOKIE = "agenda_session";
// Las llamadas del servidor pueden usar una URL interna; las del navegador
// pasan por el proxy de Next y no usan esta URL.
const API_URL =
  process.env.API_URL_INTERNAL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:3001/api/v1";

/**
 * Resuelve la sesión en el servidor: lee la cookie httpOnly `agenda_session`
 * y la reenvía a la API (GET /auth/me). Devuelve el usuario o null.
 * NestJS sigue siendo la autoridad: Next no valida la firma, solo pregunta.
 */
export async function getSession(): Promise<AuthenticatedUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE);
  if (!token?.value) return null;
  try {
    const response = await fetch(`${API_URL}/auth/me`, {
      headers: { cookie: `${SESSION_COOKIE}=${token.value}` },
      cache: "no-store",
    });
    if (!response.ok) return null;
    const result = (await response.json()) as AuthResponse;
    return result.user;
  } catch {
    // Si la API no responde, tratamos al visitante como no autenticado.
    return null;
  }
}
