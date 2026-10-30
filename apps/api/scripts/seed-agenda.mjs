import { DatabaseSync } from "node:sqlite";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
// Run the API once to create its versioned schema. No accounts or passwords are seeded.
const db = new DatabaseSync(
  process.env.AGENDA_DB_PATH ?? resolve("../../data/agenda.sqlite"),
);

const ZONA = "America/Argentina/Buenos_Aires";
const fechaOffset = (dias) =>
  new Intl.DateTimeFormat("sv-SE", {
    timeZone: ZONA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(Date.now() + dias * 86_400_000));
const ahora = () => new Date().toISOString();

try {
  db.exec("PRAGMA foreign_keys=ON; BEGIN IMMEDIATE");
  const service = db.prepare(
    "INSERT INTO servicio(id,nombre,duracion_minutos,precio_centavos,activo) VALUES (?,?,?, ?,1) ON CONFLICT(id) DO NOTHING",
  );
  const servicios = [
    ["corte", "Corte de cabello", 45, 600000],
    ["corte-barba", "Corte + barba", 60, 850000],
    ["coloracion", "Coloración", 90, 1400000],
    ["barba", "Arreglo de barba", 30, 450000],
  ];
  for (const row of servicios) service.run(...row);
  const barber = db.prepare(
    "INSERT INTO peluquero VALUES (?,?) ON CONFLICT(id) DO NOTHING",
  );
  for (const row of [
    ["ana", "Ana López"],
    ["marco", "Marco Ruiz"],
    ["lucia", "Lucía P."],
  ])
    barber.run(...row);

  // Horario laboral: lunes a sábado (1..6), 09:00 a 18:00, para los tres.
  const horario = db.prepare(
    "INSERT INTO horario_laboral VALUES (?,?,?,?) ON CONFLICT(peluquero_id,dia,inicio) DO NOTHING",
  );
  for (const pel of ["ana", "marco", "lucia"])
    for (let dia = 1; dia <= 6; dia++) horario.run(pel, dia, 540, 1080);

  // Cliente de demostración vinculado a la cuenta local cliente@demo.local.
  const cliente = db.prepare(
    "INSERT INTO cliente VALUES (?,?) ON CONFLICT(id) DO UPDATE SET email=excluded.email",
  );
  for (const row of [
    ["c-juan", "juan@demo.com"],
    ["c-sofia", "cliente@demo.local"],
    ["c-lucas", "lucas@demo.com"],
  ])
    cliente.run(...row);

  // Turnos de ejemplo en varios estados (relativos a hoy, zona AR).
  const precio = Object.fromEntries(servicios.map((s) => [s[0], s[3]]));
  const nombre = Object.fromEntries(servicios.map((s) => [s[0], s[1]]));
  const dur = Object.fromEntries(servicios.map((s) => [s[0], s[2]]));
  // [id, cliente, peluquero, servicio, offsetDías, hora(min), estado]
  const turnos = [
    ["t-01", "c-juan", "ana", "corte", -15, 540, "Completado"],
    ["t-02", "c-sofia", "marco", "barba", -15, 600, "Completado"],
    ["t-03", "c-lucas", "ana", "corte-barba", -12, 660, "Completado"],
    ["t-04", "c-juan", "lucia", "coloracion", -10, 540, "Completado"],
    ["t-05", "c-sofia", "ana", "corte", -8, 540, "Cancelado"],
    ["t-06", "c-lucas", "marco", "corte", -5, 600, "Confirmado"],
    ["t-07", "c-juan", "ana", "corte", 2, 540, "Confirmado"],
    ["t-08", "c-sofia", "lucia", "corte-barba", 2, 600, "Confirmado"],
    ["t-09", "c-lucas", "marco", "barba", -3, 540, "Completado"],
    ["t-10", "c-juan", "ana", "coloracion", 5, 660, "Pendiente"],
    // Turnos completados de hoy y ayer para que el panel profesional tenga
    // datos visibles al consultar sus indicadores diarios.
    ["t-11", "c-juan", "ana", "corte", 0, 540, "Completado"],
    ["t-12", "c-sofia", "ana", "barba", -1, 600, "Completado"],
    ["t-13", "c-sofia", "marco", "corte-barba", 0, 540, "Completado"],
    ["t-14", "c-lucas", "marco", "corte", -1, 600, "Completado"],
    ["t-15", "c-lucas", "lucia", "coloracion", 0, 540, "Completado"],
    ["t-16", "c-juan", "lucia", "barba", -1, 600, "Completado"],
  ];
  const turno = db.prepare(
    "INSERT INTO turno (id,solicitud_id,cliente_id,servicio_id,peluquero_id,fecha,inicio,duracion_minutos,precio_centavos,servicio_nombre,servicio_duracion_minutos,estado,creado_en) VALUES (?,?,?,?,?,?,?,60,?,?,?,?,?) ON CONFLICT(id) DO NOTHING",
  );
  const existeTurno = db.prepare("SELECT 1 FROM turno WHERE id=?");
  for (const [id, cli, pel, srv, off, hora, estado] of turnos) {
    // Guard explícito: el trigger BEFORE INSERT corre antes del ON CONFLICT y
    // vería un re-insert como superposición consigo mismo, así que lo salteamos.
    if (existeTurno.get(id)) continue;
    turno.run(
      id,
      randomUUID(),
      cli,
      srv,
      pel,
      fechaOffset(off),
      hora,
      precio[srv],
      nombre[srv],
      dur[srv],
      estado,
      ahora(),
    );
  }

  // Cobros registrados para turnos ya atendidos. Se omite si el turno ya tiene
  // un cobro activo (idempotente: correr el seed de nuevo no vuelve a cobrar).
  const pago = db.prepare(
    "INSERT INTO pago (id,turno_id,solicitud_id,metodo,monto_centavos,estado,creado_en) VALUES (?,?,?,?,?, 'Registrado',?) ON CONFLICT(id) DO NOTHING",
  );
  for (const [id, turnoId, metodo] of [
    ["pg-01", "t-01", "Efectivo"],
    ["pg-02", "t-02", "Transferencia"],
    ["pg-03", "t-03", "Efectivo"],
    ["pg-04", "t-04", "Transferencia"],
    ["pg-05", "t-06", "Efectivo"],
    ["pg-11", "t-11", "Efectivo"],
    ["pg-12", "t-12", "Transferencia"],
    ["pg-13", "t-13", "Efectivo"],
    ["pg-14", "t-14", "Transferencia"],
    ["pg-15", "t-15", "Efectivo"],
    ["pg-16", "t-16", "Transferencia"],
  ]) {
    const t = db
      .prepare("SELECT precio_centavos FROM turno WHERE id=?")
      .get(turnoId);
    const yaCobrado = db
      .prepare("SELECT 1 FROM pago WHERE turno_id=? AND estado <> 'Anulado'")
      .get(turnoId);
    if (t && !yaCobrado)
      pago.run(id, turnoId, randomUUID(), metodo, t.precio_centavos, ahora());
  }

  db.exec("COMMIT");
  const n = (sql) => db.prepare(sql).get().n;
  console.log(
    "Datos de demostración precargados (catálogo, personal, horarios, clientes, turnos y cobros).",
  );
  console.log(
    `  servicios=${n("SELECT COUNT(*) n FROM servicio")} peluqueros=${n("SELECT COUNT(*) n FROM peluquero")} turnos=${n("SELECT COUNT(*) n FROM turno")} pagos=${n("SELECT COUNT(*) n FROM pago")}`,
  );
} catch (error) {
  db.exec("ROLLBACK");
  throw error;
} finally {
  db.close();
}
