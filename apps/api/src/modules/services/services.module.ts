import { Module } from "@nestjs/common";
import { PersistenceModule } from "../../persistence/persistence.module.js";
import { AuthModule } from "../auth/auth.module.js";
import { CatalogoControl } from "./catalogo.control.js";
import { ServicesController } from "./services.controller.js";
@Module({
  imports: [PersistenceModule, AuthModule],
  controllers: [ServicesController],
  providers: [CatalogoControl],
  exports: [CatalogoControl],
})
export class ServicesModule {}
