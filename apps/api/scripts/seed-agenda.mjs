import { DatabaseSync } from "node:sqlite";
import { resolve } from "node:path";
// Run the API once to create its versioned schema. No accounts or passwords are seeded.
const db = new DatabaseSync(
  process.env.AGENDA_DB_PATH ?? resolve("../../data/agenda.sqlite"),
);
try {
  db.exec("PRAGMA foreign_keys=ON; BEGIN IMMEDIATE");
  const service = db.prepare(
    "INSERT INTO servicio(id,nombre,duracion_minutos,precio_centavos,activo) VALUES (?,?,?, ?,1) ON CONFLICT(id) DO NOTHING",
  );
  for (const row of [
    ["corte", "Corte de cabello", 45, 600000],
    ["corte-barba", "Corte + barba", 60, 850000],
    ["coloracion", "Coloración", 90, 1400000],
    ["barba", "Arreglo de barba", 30, 450000],
  ])
    service.run(...row);
  const barber = db.prepare(
    "INSERT INTO peluquero VALUES (?,?) ON CONFLICT(id) DO NOTHING",
  );
  for (const row of [
    ["ana", "Ana López"],
    ["marco", "Marco Ruiz"],
    ["lucia", "Lucía P."],
  ])
    barber.run(...row);
  db.exec("COMMIT");
  console.log(
    "Catálogo y personal de demostración precargados. Configurá horarios desde la cuenta Admin.",
  );
} catch (error) {
  db.exec("ROLLBACK");
  throw error;
} finally {
  db.close();
}
