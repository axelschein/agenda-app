import { Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { AgendaDatabase } from "../../persistence/agenda-database.js";

/** Minimal link to PP2-10's authenticated identity; not a fabricated full profile. */
@Injectable()
export class ClienteIdentidadControl {
  constructor(private readonly database: AgendaDatabase) {}
  obtener(email: string): string | undefined {
    const row = this.database.db
      .prepare("SELECT id FROM cliente WHERE email=?")
      .get(email) as { id: string } | undefined;
    return row?.id;
  }
  vincular(email: string): string {
    this.database.db
      .prepare(
        "INSERT INTO cliente(id,email) VALUES (?,?) ON CONFLICT(email) DO NOTHING",
      )
      .run(randomUUID(), email);
    return this.obtener(email)!;
  }
}
