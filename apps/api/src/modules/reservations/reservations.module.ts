import { Module } from "@nestjs/common";
import { PersistenceModule } from "../../persistence/persistence.module.js";
import { ServicesModule } from "../services/services.module.js";
import { UsersModule } from "../users/users.module.js";
import { AvailabilityModule } from "../availability/availability.module.js";
import { AuthModule } from "../auth/auth.module.js";
import { ReservaTurnoControl } from "./application/reserva-turno.control.js";
import { ReservationsController } from "./reservations.controller.js";
@Module({
  imports: [
    PersistenceModule,
    ServicesModule,
    UsersModule,
    AvailabilityModule,
    AuthModule,
  ],
  controllers: [ReservationsController],
  providers: [ReservaTurnoControl],
})
export class ReservationsModule {}
