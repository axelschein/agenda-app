import { beforeEach, describe, it, expect, jest } from "@jest/globals";
import { NotFoundException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { ReservaTurnoControl } from "../../../src/modules/reservations/application/reserva-turno.control.js";
import { AgendaDatabase } from "../../../src/persistence/agenda-database.js";
import { CatalogoControl } from "../../../src/modules/services/index.js";
import {
  PersonalControl,
  ClienteIdentidadControl,
} from "../../../src/modules/users/index.js";
import { AgendaControl } from "../../../src/modules/availability/index.js";

// Fila de turno con la instantánea del servicio ya guardada al confirmar.
const row = {
  id: "turno-1",
  servicio_id: "corte",
  peluquero_id: "ana",
  fecha: "2099-01-05",
  inicio: 540,
  duracion_minutos: 60,
  precio_centavos: 600000,
  servicio_nombre: "Corte de cabello",
  servicio_duracion_minutos: 45,
  estado: "Pendiente" as const,
};

describe("ReservaTurnoControl.consultarPropios — recibo desde la instantánea", () => {
  let control: ReservaTurnoControl;
  const obtenerHistorico = jest.fn<CatalogoControl["obtenerHistorico"]>();
  beforeEach(async () => {
    obtenerHistorico.mockReset();
    const module = await Test.createTestingModule({
      providers: [
        ReservaTurnoControl,
        {
          provide: AgendaDatabase,
          useValue: {
            db: { prepare: () => ({ all: () => [row] }) },
            transaction: <T>(a: () => T) => a(),
          },
        },
        {
          provide: CatalogoControl,
          useValue: {
            obtener: jest.fn(),
            obtenerHistorico,
          },
        },
        {
          provide: PersonalControl,
          useValue: {
            obtener: jest
              .fn<PersonalControl["obtener"]>()
              .mockReturnValue({ id: "ana", nombre: "Ana" }),
          },
        },
        { provide: AgendaControl, useValue: {} },
        {
          provide: ClienteIdentidadControl,
          useValue: {
            obtener: jest
              .fn<ClienteIdentidadControl["obtener"]>()
              .mockReturnValue("cliente-1"),
          },
        },
      ],
    }).compile();
    control = module.get(ReservaTurnoControl);
  });

  it("arma el recibo con la instantánea de la fila, sin consultar el catálogo vivo", () => {
    // Aunque el catálogo no pueda resolver el servicio, el historial no se rompe.
    obtenerHistorico.mockImplementation(() => {
      throw new NotFoundException("no debería llamarse");
    });
    const [recibo] = control.consultarPropios({
      email: "cliente@example.com",
      role: "CLIENT",
    });
    expect(obtenerHistorico).not.toHaveBeenCalled();
    expect(recibo).toMatchObject({
      id: "turno-1",
      servicio: {
        id: "corte",
        nombre: "Corte de cabello",
        duracionMinutos: 45,
        precio: 6000,
      },
      total: 6000,
      horaInicio: "09:00",
    });
  });
});
