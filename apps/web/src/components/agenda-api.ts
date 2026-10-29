// Browser requests go through the Next.js route so its host owns the
// httpOnly session cookie. The route forwards the request to the API.
export const API_URL = "/api/v1";
export class AgendaError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}
export async function agendaRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(API_URL + path, {
    ...options,
    credentials: "include",
    cache: "no-store",
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      message?: unknown;
    } | null;
    const message =
      response.status === 401
        ? "Tu sesión venció. Volvé a iniciar sesión."
        : typeof body?.message === "string"
          ? body.message
          : "No se pudo completar la operación. Intentá de nuevo.";
    throw new AgendaError(message, response.status);
  }
  return response.json() as Promise<T>;
}
export function businessToday(): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
export function dateLabel(value: string): string {
  return new Intl.DateTimeFormat("es-AR", {
    weekday: "short",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value + "T12:00:00Z"));
}
// The prototype uses pesos. Currency is a documented local MVP setting.
export function money(value: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 2,
  }).format(value);
}
