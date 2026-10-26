import { beforeEach, describe, it, expect, jest } from "@jest/globals";
import { ConflictException, BadRequestException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { randomUUID } from "node:crypto";
import { ReservaTurnoControl } from "../../../src/modules/reservations/application/reserva-turno.control.js";
import { AgendaDatabase } from "../../../src/persistence/agenda-database.js";
import { CatalogoControl } from "../../../src/modules/services/index.js";
import {
  PersonalControl,
  ClienteIdentidadControl,
} from "../../../src/modules/users/index.js";
import { AgendaControl } from "../../../src/modules/availability/index.js";
const selection = {
  servicioId: "corte",
  peluqueroId: "ana",
  fecha: "2099-01-05",
  horaInicio: "09:00",
};
const servicio = {
  id: "corte",
  nombre: "Corte",
  duracionMinutos: 45,
  precio: 6000,
};
const peluquero = { id: "ana", nombre: "Ana" };
describe("ReservaTurnoControl — unitarias con dependencias mockeadas", () => {
  let control: ReservaTurnoControl;
  let catalogo: { obtener: jest.Mock<CatalogoControl["obtener"]> };
  let personal: { obtener: jest.Mock<PersonalControl["obtener"]> };
  let agenda: { consultar: jest.Mock<AgendaControl["consultar"]> };
  let clientes: {
    obtener: jest.Mock<ClienteIdentidadControl["obtener"]>;
    vincular: jest.Mock<ClienteIdentidadControl["vincular"]>;
  };
  const previous = jest.fn<() => unknown>();
  const save = jest.fn<(...args: unknown[]) => void>();
  const audit = jest.fn<(...args: unknown[]) => void>();
  const readMine = jest.fn<(...args: unknown[]) => unknown[]>();
  const prepare = jest.fn<(sql: string) => unknown>();
  beforeEach(async () => {
    previous.mockReset().mockReturnValue(undefined);
    save.mockReset();
    audit.mockReset();
    readMine.mockReset();
    prepare.mockReset();
    prepare.mockImplementation((sql) => {
      if (sql.startsWith("SELECT * FROM turno WHERE cliente_id ="))
        return { get: previous };
      if (sql.startsWith("INSERT INTO turno")) return { run: save };
      if (sql.startsWith("INSERT INTO auditoria_turno")) return { run: audit };
      if (sql.startsWith("SELECT * FROM turno WHERE cliente_id="))
        return { all: readMine };
      throw Error("SQL inesperado: " + sql);
    });
    catalogo = {
      obtener: jest.fn<CatalogoControl["obtener"]>().mockReturnValue(servicio),
    };
    personal = {
      obtener: jest.fn<PersonalControl["obtener"]>().mockReturnValue(peluquero),
    };
    agenda = {
      consultar: jest
        .fn<AgendaControl["consultar"]>()
        .mockReturnValue({
          fecha: selection.fecha,
          horarios: ["09:00"],
          zonaHoraria: "America/Argentina/Buenos_Aires",
        }),
    };
    clientes = {
      obtener: jest
        .fn<ClienteIdentidadControl["obtener"]>()
        .mockReturnValue("cliente-1"),
      vincular: jest
        .fn<ClienteIdentidadControl["vincular"]>()
        .mockReturnValue("cliente-1"),
    };
    const module = await Test.createTestingModule({
      providers: [
        ReservaTurnoControl,
        {
          provide: AgendaDatabase,
          useValue: {
            db: { prepare },
            transaction: <T>(action: () => T) => action(),
          },
        },
        { provide: CatalogoControl, useValue: catalogo },
        { provide: PersonalControl, useValue: personal },
        { provide: AgendaControl, useValue: agenda },
        { provide: ClienteIdentidadControl, useValue: clientes },
      ],
    }).compile();
    control = module.get(ReservaTurnoControl);
  });
  const payload = () => ({
    ...selection,
    solicitudId: randomUUID(),
    precioRevisado: 6000,
    duracionRevisada: 45,
  });
  it("genera el resumen con los datos del catálogo", () => {
    expect(control.generarResumen(selection)).toMatchObject({
      servicio,
      peluquero,
      total: 6000,
    });
  });
  it("avisa si el horario dejó de estar disponible", () => {
    agenda.consultar.mockReturnValue({
      fecha: selection.fecha,
      horarios: [],
      zonaHoraria: "America/Argentina/Buenos_Aires",
    });
    expect(() => control.generarResumen(selection)).toThrow(ConflictException);
  });
  it.each([
    { fecha: "2099-02-30" },
    { horaInicio: "25:00" },
    { servicioId: "" },
  ])("rechaza una selección inválida: %o", (change) => {
    expect(() => control.generarResumen({ ...selection, ...change })).toThrow(
      BadRequestException,
    );
  });
  it("registra Pendiente para el Cliente de la sesión y genera auditoría", () => {
    const receipt = control.registrar(
      { ...payload(), clienteId: "suplantado" },
      { email: "cliente@example.com", role: "CLIENT" },
    );
    expect(receipt.estado).toBe("Pendiente");
    expect(clientes.vincular).toHaveBeenCalledWith("cliente@example.com");
    expect(save).toHaveBeenCalledWith(
      receipt.id,
      expect.any(String),
      "cliente-1",
      "corte",
      "ana",
      selection.fecha,
      540,
      45,
      600000,
      expect.any(String),
    );
    expect(audit).toHaveBeenCalledWith(receipt.id, expect.any(String));
  });
  it.each([{ precioRevisado: 1 }, { duracionRevisada: 15 }])(
    "exige revisar cambios en precio o duración: %o",
    (change) => {
      expect(() =>
        control.registrar(
          { ...payload(), ...change },
          { email: "cliente@example.com", role: "CLIENT" },
        ),
      ).toThrow(ConflictException);
      expect(save).not.toHaveBeenCalled();
    },
  );
  it("devuelve el recibo previo al repetir la misma solicitud", () => {
    previous.mockReturnValue({
      id: "turno-previo",
      servicio_id: "corte",
      peluquero_id: "ana",
      fecha: selection.fecha,
      inicio: 540,
      duracion_minutos: 45,
      precio_centavos: 600000,
      estado: "Pendiente",
    });
    expect(
      control.registrar(payload(), {
        email: "cliente@example.com",
        role: "CLIENT",
      }).id,
    ).toBe("turno-previo");
    expect(save).not.toHaveBeenCalled();
    expect(audit).not.toHaveBeenCalled();
  });
  it("no permite reutilizar una solicitud con otra selección", () => {
    previous.mockReturnValue({ servicio_id: "otro" });
    expect(() =>
      control.registrar(payload(), {
        email: "cliente@example.com",
        role: "CLIENT",
      }),
    ).toThrow(ConflictException);
  });
  it("devuelve vacío si el Cliente todavía no tiene reservas", () => {
    clientes.obtener.mockReturnValue(undefined);
    expect(
      control.consultarPropios({
        email: "cliente@example.com",
        role: "CLIENT",
      }),
    ).toEqual([]);
    expect(prepare).not.toHaveBeenCalled();
  });
});
