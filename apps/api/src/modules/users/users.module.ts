import { Module } from "@nestjs/common";
import { PersistenceModule } from "../../persistence/persistence.module.js";
import { ClienteIdentidadControl } from "./cliente-identidad.control.js";
import { PersonalControl } from "./personal.control.js";
@Module({
  imports: [PersistenceModule],
  providers: [PersonalControl, ClienteIdentidadControl],
  exports: [PersonalControl, ClienteIdentidadControl],
})
export class UsersModule {}
