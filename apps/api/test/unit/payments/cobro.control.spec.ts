import { beforeEach, describe, it, expect, jest } from "@jest/globals";
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { CobroControl } from "../../../src/modules/payments/application/cobro.control.js";
import { AgendaDatabase } from "../../../src/persistence/agenda-database.js";
import { PersonalControl } from "../../../src/modules/users/index.js";

const peluquero = { id: "ana", nombre: "Ana" };
const turno = {
  id: "turno-1",
  cliente_id: "cli-1",
  peluquero_id: "ana",
  fecha: "2099-02-10",
  inicio: 540,
  precio_centavos: 600000,
  servicio_nombre: "Corte",
  estado: "Confirmado",
};
const solicitudId = "11111111-1111-4111-8111-111111111111";

describe("CobroControl — unitarias con dependencias mockeadas", () => {
  let control: CobroControl;
  const getTurno = jest.fn<() => unknown>();
  const getPrevio = jest.fn<() => unknown>();
  const getActivo = jest.fn<() => unknown>();
  const getCreado = jest.fn<() => unknown>();
  const insPago = jest.fn<(...a: unknown[]) => void>();
  const insAudit = jest.fn<(...a: unknown[]) => void>();
  const prepare = jest.fn<(sql: string) => unknown>();

  beforeEach(async () => {
    for (const m of [getTurno, getPrevio, getActivo, getCreado, insPago, insAudit])
      m.mockReset();
    getPrevio.mockReturnValue(undefined);
    getActivo.mockReturnValue(undefined);
    prepare.mockReset().mockImplementation((sql) => {
      if (sql.startsWith("SELECT * FROM turno")) return { get: getTurno };
      if (sql.includes("FROM pago WHERE turno_id=? AND solicitud_id=?"))
        return { get: getPrevio };
      if (sql.includes("FROM pago WHERE turno_id=? AND estado"))
        return { get: getActivo };
      if (sql.startsWith("INSERT INTO pago")) return { run: insPago };
      if (sql.startsWith("INSERT INTO auditoria_pago")) return { run: insAudit };
      if (sql.startsWith("SELECT * FROM pago WHERE id=?"))
        return { get: getCreado };
      throw Error("SQL inesperado: " + sql);
    });
    const module = await Test.createTestingModule({
      providers: [
        CobroControl,
        {
          provide: AgendaDatabase,
          useValue: { db: { prepare }, transaction: <T>(a: () => T) => a() },
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
    control = module.get(CobroControl);
  });

  it("registra un cobro válido con el monto del turno y audita", () => {
    getTurno.mockReturnValue(turno);
    getCreado.mockReturnValue({
      id: "pago-1",
      turno_id: "turno-1",
      metodo: "Efectivo",
      monto_centavos: 600000,
      estado: "Registrado",
      motivo_anulacion: "",
      creado_en: "2026-10-29T12:00:00.000Z",
    });
    const recibo = control.registrar({
      turnoId: "turno-1",
      metodo: "Efectivo",
      solicitudId,
    });
    expect(recibo).toMatchObject({ estado: "Registrado", monto: 6000 });
    expect(insPago).toHaveBeenCalledTimes(1);
    expect(insAudit).toHaveBeenCalledWith(expect.any(String), expect.any(String));
  });

  it("rechaza un método inválido sin tocar la base", () => {
    expect(() =>
      control.registrar({ turnoId: "turno-1", metodo: "Cripto", solicitudId }),
    ).toThrow(BadRequestException);
    expect(prepare).not.toHaveBeenCalled();
  });

  it("no cobra un turno que no está confirmado ni completado", () => {
    getTurno.mockReturnValue({ ...turno, estado: "Pendiente" });
    expect(() =>
      control.registrar({ turnoId: "turno-1", metodo: "Efectivo", solicitudId }),
    ).toThrow(BadRequestException);
    expect(insPago).not.toHaveBeenCalled();
  });

  it("no cobra un turno inexistente", () => {
    getTurno.mockReturnValue(undefined);
    expect(() =>
      control.registrar({ turnoId: "x", metodo: "Efectivo", solicitudId }),
    ).toThrow(NotFoundException);
  });

  it("devuelve el pago existente ante un reintento idempotente", () => {
    getTurno.mockReturnValue(turno);
    getPrevio.mockReturnValue({
      id: "pago-previo",
      turno_id: "turno-1",
      metodo: "Efectivo",
      monto_centavos: 600000,
      estado: "Registrado",
      motivo_anulacion: "",
      creado_en: "2026-10-29T12:00:00.000Z",
    });
    const recibo = control.registrar({
      turnoId: "turno-1",
      metodo: "Efectivo",
      solicitudId,
    });
    expect(recibo.id).toBe("pago-previo");
    expect(insPago).not.toHaveBeenCalled();
  });

  it("da conflicto si el turno ya tiene un cobro activo", () => {
    getTurno.mockReturnValue(turno);
    getActivo.mockReturnValue({ id: "pago-activo" });
    expect(() =>
      control.registrar({ turnoId: "turno-1", metodo: "Efectivo", solicitudId }),
    ).toThrow(ConflictException);
    expect(insPago).not.toHaveBeenCalled();
  });
});
