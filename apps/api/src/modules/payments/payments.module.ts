import { Module } from "@nestjs/common";
import { PersistenceModule } from "../../persistence/persistence.module.js";
import { UsersModule } from "../users/users.module.js";
import { AuthModule } from "../auth/auth.module.js";
import { CobroControl } from "./application/cobro.control.js";
import { ConsultaComercialControl } from "./application/consulta-comercial.control.js";
import { CobrosController } from "./cobros.controller.js";
import { MisPagosController } from "./mis-pagos.controller.js";

@Module({
  imports: [PersistenceModule, UsersModule, AuthModule],
  controllers: [CobrosController, MisPagosController],
  providers: [CobroControl, ConsultaComercialControl],
})
export class PaymentsModule {}
