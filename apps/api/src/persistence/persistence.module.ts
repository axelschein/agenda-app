import { Module } from "@nestjs/common";
import { AgendaDatabase } from "./agenda-database.js";
@Module({ providers: [AgendaDatabase], exports: [AgendaDatabase] })
export class PersistenceModule {}
