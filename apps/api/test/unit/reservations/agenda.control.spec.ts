import { afterEach, describe, it, expect, jest } from "@jest/globals";
import { AgendaControl } from "../../../src/modules/availability/agenda.control.js";
import { AgendaDatabase } from "../../../src/persistence/agenda-database.js";
import { CatalogoControl } from "../../../src/modules/services/index.js";
import { PersonalControl } from "../../../src/modules/users/index.js";
import { ahoraLocal } from "../../../src/modules/availability/horarios.js";
function fixture(
  duracion = 45,
  ocupados: { inicio: number; fin: number }[] = [],
) {
  const windows = [
    { inicio: 540, fin: 720 },
    { inicio: 840, fin: 960 },
  ];
  const prepare = jest.fn((sql: string) => ({
    all: () => (sql.includes("ocupacion_agenda") ? ocupados : windows),
  }));
  const transaction = jest.fn();
  const database = {
    db: { prepare },
    transaction,
  } as unknown as AgendaDatabase;
  const catalogo = {
    obtener: jest.fn(() => ({
      id: "corte",
      nombre: "Corte",
      precio: 6000,
      duracionMinutos: duracion,
    })),
  } as unknown as CatalogoControl;
  const personal = {
    obtener: jest.fn(() => ({ id: "ana", nombre: "Ana" })),
  } as unknown as PersonalControl;
  return {
    control: new AgendaControl(database, catalogo, personal),
    prepare,
    transaction,
  };
}
describe("AgendaControl — reglas de disponibilidad con datos mockeados", () => {
  afterEach(() => {
    jest.useRealTimers();
  });
  it("respeta duración, pausas y fin de jornada", () => {
    const { control } = fixture();
    const { horarios } = control.consultar("corte", "ana", "2099-01-05");
    expect(horarios).toContain("11:15");
    expect(horarios).not.toContain("11:30");
    expect(horarios).not.toContain("12:00");
    expect(horarios).toContain("15:15");
    expect(horarios).not.toContain("15:30");
  });
  it("descarta todo intervalo superpuesto y admite un turno contiguo", () => {
    const { control } = fixture(45, [{ inicio: 600, fin: 645 }]);
    const { horarios } = control.consultar("corte", "ana", "2099-01-05");
    expect(horarios).not.toContain("09:30");
    expect(horarios).not.toContain("10:15");
    expect(horarios).toContain("10:45");
  });
  it("una duración mayor ocupa más tiempo", () => {
    expect(
      fixture(90).control.consultar("corte", "ana", "2099-01-05").horarios,
    ).not.toContain("11:00");
  });
  it("usa la fecha de Buenos Aires y excluye horarios pasados del día", () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-10-27T02:30:00Z"));
    expect(ahoraLocal()).toEqual({ fecha: "2026-10-26", hora: "23:30" });
    expect(
      fixture().control.consultar("corte", "ana", "2026-10-26").horarios,
    ).toEqual([]);
  });
  it("rechaza jornadas solapadas sin escribir cambios", () => {
    const { control, transaction } = fixture();
    expect(() =>
      control.configurar("ana", [
        { dia: 1, inicio: "09:00", fin: "12:00" },
        { dia: 1, inicio: "11:00", fin: "13:00" },
      ]),
    ).toThrow("no pueden superponerse");
    expect(transaction).not.toHaveBeenCalled();
  });
});
