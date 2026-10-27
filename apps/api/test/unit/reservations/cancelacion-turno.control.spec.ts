import { beforeEach, describe, it, expect, jest } from "@jest/globals";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import {
  CancelacionTurnoControl,
  MOTIVO_CANCELACION_CLIENTE,
} from "../../../src/modules/reservations/application/cancelacion-turno.control.js";
import { AgendaDatabase } from "../../../src/persistence/agenda-database.js";
import {
  ClienteIdentidadControl,
  PersonalControl,
} from "../../../src/modules/users/index.js";
import { ahoraLocal } from "../../../src/modules/availability/horarios.js";

const peluquero = { id: "ana", nombre: "Ana" };
const base = {
  id: "turno-1",
  servicio_id: "corte",
  peluquero_id: "ana",
  fecha: "2099-01-05",
  inicio: 540,
  duracion_minutos: 60,
  precio_centavos: 600000,
  servicio_nombre: "Corte",
  servicio_duracion_minutos: 45,
  estado: "Pendiente" as const,
  motivo_cancelacion: "",
};
const user = { email: "cliente@example.com", role: "CLIENT" as const };

describe("CancelacionTurnoControl — unitarias con dependencias mockeadas", () => {
  let control: CancelacionTurnoControl;
  const get = jest.fn<() => unknown>();
  const update = jest.fn<(...a: unknown[]) => void>();
  const audit = jest.fn<(...a: unknown[]) => void>();
  const obtenerCliente = jest.fn<ClienteIdentidadControl["obtener"]>();
  const prepare = jest.fn<(sql: string) => unknown>();
  beforeEach(async () => {
    get.mockReset();
    update.mockReset();
    audit.mockReset();
    obtenerCliente.mockReset().mockReturnValue("cliente-1");
    prepare.mockReset().mockImplementation((sql) => {
      if (sql.startsWith("SELECT * FROM turno")) return { get };
      if (sql.startsWith("UPDATE turno")) return { run: update };
      if (sql.startsWith("INSERT INTO auditoria_turno")) return { run: audit };
      throw Error("SQL inesperado: " + sql);
    });
    const module = await Test.createTestingModule({
      providers: [
        CancelacionTurnoControl,
        {
          provide: AgendaDatabase,
          useValue: { db: { prepare }, transaction: <T>(a: () => T) => a() },
        },
        { provide: ClienteIdentidadControl, useValue: { obtener: obtenerCliente } },
        {
          provide: PersonalControl,
          useValue: {
            obtener: jest
              .fn<PersonalControl["obtener"]>()
              .mockReturnValue(peluquero),
          },
        },
      ],
    }).compile();
    control = module.get(CancelacionTurnoControl);
  });

  it("cancela un turno propio fuera de la ventana, fija el motivo y audita", () => {
    get
      .mockReturnValueOnce(base)
      .mockReturnValueOnce({
        ...base,
        estado: "Cancelado",
        motivo_cancelacion: MOTIVO_CANCELACION_CLIENTE,
      });
    const recibo = control.cancelar("turno-1", user);
    expect(recibo.estado).toBe("Cancelado");
    expect(recibo.motivoCancelacion).toBe(MOTIVO_CANCELACION_CLIENTE);
    expect(update).toHaveBeenCalledWith(MOTIVO_CANCELACION_CLIENTE, "turno-1");
    expect(audit).toHaveBeenCalledWith("turno-1", expect.any(String));
  });

  it("no cancela si faltan menos de 24 horas (turno de hoy)", () => {
    get.mockReturnValue({ ...base, fecha: ahoraLocal().fecha });
    expect(() => control.cancelar("turno-1", user)).toThrow(BadRequestException);
    expect(update).not.toHaveBeenCalled();
  });

  it("no cancela un turno que no está Pendiente ni Confirmado", () => {
    get.mockReturnValue({ ...base, estado: "En curso" });
    expect(() => control.cancelar("turno-1", user)).toThrow(BadRequestException);
    expect(update).not.toHaveBeenCalled();
  });

  it("no cancela un turno ajeno o inexistente", () => {
    get.mockReturnValue(undefined);
    expect(() => control.cancelar("turno-1", user)).toThrow(NotFoundException);
  });

  it("no cancela si el Cliente no tiene turnos", () => {
    obtenerCliente.mockReturnValue(undefined);
    expect(() => control.cancelar("turno-1", user)).toThrow(NotFoundException);
    expect(prepare).not.toHaveBeenCalled();
  });
});
