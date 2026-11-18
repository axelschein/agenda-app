import { Module } from "@nestjs/common";
import { PersistenceModule } from "../../persistence/persistence.module.js";
import { UsersModule } from "../users/users.module.js";
import { AuthModule } from "../auth/auth.module.js";
import { IndicadoresControl } from "./application/indicadores.control.js";
import { ReportsController } from "./reports.controller.js";

@Module({
  imports: [PersistenceModule, UsersModule, AuthModule],
  controllers: [ReportsController],
  providers: [IndicadoresControl],
})
export class ReportsModule {}
