import { Module } from "@nestjs/common";
import { AuthModule } from "./modules/auth/auth.module.js";
import { AvailabilityModule } from "./modules/availability/availability.module.js";
import { ReservationsModule } from "./modules/reservations/reservations.module.js";
import { ServicesModule } from "./modules/services/services.module.js";
import { UsersModule } from "./modules/users/users.module.js";
import { HealthModule } from "./health/health.module.js";

@Module({
  imports: [
    AuthModule,
    UsersModule,
    ServicesModule,
    AvailabilityModule,
    ReservationsModule,
    HealthModule,
  ],
})
export class AppModule {}
