import { Module } from "@nestjs/common";
import { AuthModule } from "./modules/auth/auth.module.js";
import { AvailabilityModule } from "./modules/availability/availability.module.js";
import { ReservationsModule } from "./modules/reservations/reservations.module.js";
import { PaymentsModule } from "./modules/payments/payments.module.js";
import { ReportsModule } from "./modules/reports/reports.module.js";
import { ServicesModule } from "./modules/services/services.module.js";
import { UsersModule } from "./modules/users/users.module.js";
import { ProfilesModule } from "./modules/users/profiles.module.js";
import { HealthModule } from "./health/health.module.js";

@Module({
  imports: [
    AuthModule,
    UsersModule,
    ProfilesModule,
    ServicesModule,
    AvailabilityModule,
    ReservationsModule,
    PaymentsModule,
    ReportsModule,
    HealthModule,
  ],
})
export class AppModule {}
