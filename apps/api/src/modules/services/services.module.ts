import { Module } from "@nestjs/common";
import { PersistenceModule } from "../../persistence/persistence.module.js";
import { CatalogoControl } from "./catalogo.control.js";
@Module({
  imports: [PersistenceModule],
  providers: [CatalogoControl],
  exports: [CatalogoControl],
})
export class ServicesModule {}
