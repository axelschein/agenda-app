import { Module } from "@nestjs/common";
import { PersistenceModule } from "../../persistence/persistence.module.js";
import { ServicesModule } from "../services/services.module.js";
import { UsersModule } from "../users/users.module.js";
import { AvailabilityModule } from "../availability/availability.module.js";
import { AuthModule } from "../auth/auth.module.js";
import { ReservaTurnoControl } from "./application/reserva-turno.control.js";
import { GestionReservasControl } from "./application/gestion-reservas.control.js";
import { CancelacionTurnoControl } from "./application/cancelacion-turno.control.js";
import { ReservationsController } from "./reservations.controller.js";
import { GestionReservasController } from "./gestion-reservas.controller.js";
import { CancelacionTurnoController } from "./cancelacion-turno.controller.js";
@Module({
  imports: [
    PersistenceModule,
    ServicesModule,
    UsersModule,
    AvailabilityModule,
    AuthModule,
  ],
  controllers: [
    ReservationsController,
    GestionReservasController,
    CancelacionTurnoController,
  ],
  providers: [
    ReservaTurnoControl,
    GestionReservasControl,
    CancelacionTurnoControl,
  ],
})
export class ReservationsModule {}
