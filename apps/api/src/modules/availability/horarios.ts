import { BadRequestException } from "@nestjs/common";
export const ZONA_HORARIA = "America/Argentina/Buenos_Aires";
export function horaAMinutos(value: unknown): number {
  if (
    typeof value !== "string" ||
    !/^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(value)
  )
    throw new BadRequestException("La hora debe tener formato HH:mm.");
  return Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
}
export function minutosAHora(value: number): string {
  return (
    String(Math.floor(value / 60)).padStart(2, "0") +
    ":" +
    String(value % 60).padStart(2, "0")
  );
}
export function validarFecha(value: unknown): string {
  if (
    typeof value !== "string" ||
    !/^20[0-9]{2}-[0-9]{2}-[0-9]{2}$/.test(value)
  )
    throw new BadRequestException("La fecha debe tener formato AAAA-MM-DD.");
  const date = new Date(value + "T12:00:00Z");
  if (
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  )
    throw new BadRequestException("La fecha no es válida.");
  return value;
}
export function ahoraLocal(now = new Date()): { fecha: string; hora: string } {
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: ZONA_HORARIA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return {
    fecha: get("year") + "-" + get("month") + "-" + get("day"),
    hora: get("hour") + ":" + get("minute"),
  };
}
