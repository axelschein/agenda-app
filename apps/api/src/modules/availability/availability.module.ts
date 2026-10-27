import { Module } from "@nestjs/common";
import { PersistenceModule } from "../../persistence/persistence.module.js";
import { ServicesModule } from "../services/services.module.js";
import { UsersModule } from "../users/users.module.js";
import { AuthModule } from "../auth/auth.module.js";
import { AgendaControl } from "./agenda.control.js";
import { AvailabilityController } from "./availability.controller.js";
@Module({
  imports: [PersistenceModule, ServicesModule, UsersModule, AuthModule],
  providers: [AgendaControl],
  controllers: [AvailabilityController],
  exports: [AgendaControl],
})
export class AvailabilityModule {}
