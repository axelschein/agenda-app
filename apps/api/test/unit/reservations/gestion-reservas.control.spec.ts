import { beforeEach, describe, it, expect, jest } from "@jest/globals";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import {
  GestionReservasControl,
  MOTIVO_RECHAZO,
} from "../../../src/modules/reservations/application/gestion-reservas.control.js";
import { AgendaDatabase } from "../../../src/persistence/agenda-database.js";
import { CatalogoControl } from "../../../src/modules/services/index.js";
import { PersonalControl } from "../../../src/modules/users/index.js";

const servicio = {
  id: "corte",
  nombre: "Corte",
  duracionMinutos: 45,
  precio: 6000,
  activo: true,
};
const peluquero = { id: "ana", nombre: "Ana" };
const base = {
  id: "turno-1",
  servicio_id: "corte",
  peluquero_id: "ana",
  cliente_email: "cliente@example.com",
  fecha: "2099-01-05",
  inicio: 540,
  duracion_minutos: 60,
  precio_centavos: 600000,
  servicio_nombre: "Corte",
  servicio_duracion_minutos: 45,
  estado: "Pendiente" as const,
  motivo_cancelacion: "",
};

describe("GestionReservasControl — unitarias con dependencias mockeadas", () => {
  let control: GestionReservasControl;
  const get = jest.fn<() => unknown>();
  const all = jest.fn<() => unknown[]>();
  const update = jest.fn<(...args: unknown[]) => void>();
  const audit = jest.fn<(...args: unknown[]) => void>();
  const prepare = jest.fn<(sql: string) => unknown>();
  beforeEach(async () => {
    get.mockReset();
    all.mockReset().mockReturnValue([base]);
    update.mockReset();
    audit.mockReset();
    prepare.mockReset().mockImplementation((sql) => {
      if (sql.includes("WHERE t.id")) return { get };
      if (sql.includes("ORDER BY")) return { all };
      if (sql.startsWith("UPDATE turno")) return { run: update };
      if (sql.startsWith("INSERT INTO auditoria_turno")) return { run: audit };
      throw Error("SQL inesperado: " + sql);
    });
    const module = await Test.createTestingModule({
      providers: [
        GestionReservasControl,
        {
          provide: AgendaDatabase,
          useValue: { db: { prepare }, transaction: <T>(a: () => T) => a() },
        },
        {
          provide: CatalogoControl,
          useValue: {
            obtenerHistorico: jest
              .fn<CatalogoControl["obtenerHistorico"]>()
              .mockReturnValue(servicio),
          },
        },
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
    control = module.get(GestionReservasControl);
  });

  it("lista todas las reservas con el correo del cliente", () => {
    const [vista] = control.consultarTodas();
    expect(vista).toMatchObject({
      id: "turno-1",
      clienteEmail: "cliente@example.com",
      estado: "Pendiente",
      horaInicio: "09:00",
      total: 6000,
    });
  });

  it("rechaza un turno pendiente, fija el motivo y audita", () => {
    get
      .mockReturnValueOnce(base)
      .mockReturnValueOnce({
        ...base,
        estado: "Cancelado",
        motivo_cancelacion: MOTIVO_RECHAZO,
      });
    const vista = control.rechazar("turno-1");
    expect(vista.estado).toBe("Cancelado");
    expect(vista.motivoCancelacion).toBe(MOTIVO_RECHAZO);
    expect(update).toHaveBeenCalledWith(MOTIVO_RECHAZO, "turno-1");
    expect(audit).toHaveBeenCalledWith("turno-1", expect.any(String));
  });

  it("no rechaza una reserva inexistente", () => {
    get.mockReturnValue(undefined);
    expect(() => control.rechazar("fantasma")).toThrow(NotFoundException);
    expect(update).not.toHaveBeenCalled();
  });

  it("no rechaza un turno que no está pendiente", () => {
    get.mockReturnValue({ ...base, estado: "Cancelado" });
    expect(() => control.rechazar("turno-1")).toThrow(BadRequestException);
    expect(update).not.toHaveBeenCalled();
    expect(audit).not.toHaveBeenCalled();
  });
});
