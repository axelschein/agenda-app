# PP2-14 — Cambiar el horario o cancelar una reserva

**Estado:** implementación funcional y verificada localmente; pendientes de alcance documentados abajo. **Rama:** `feature/PP2-14-cancelar-reserva`, creada desde `feature/PP2-13-rechazar-reserva` (reutiliza la columna `motivo_cancelacion`). Mergear después de PP2-13.

## Trazabilidad

- [Ticket PP2-14](https://axelspp.atlassian.net/browse/PP2-14): el Cliente cancela un turno propio desde *Mis turnos*; la reprogramación en el MVP se resuelve cancelando y reservando de nuevo.
- CU06 Consultar historial de turnos propios · CU07 Cancelar turno propio. RD04.10, RD04.11.
- Pantalla 5 — Mis turnos (Prototipos MVP). Los datos de ejemplo no son datos reales.
- Depende de PP2-6 (reserva y vista `ocupacion_agenda`).

## Decisiones de implementación

1. **Reprogramación = cancelar + reservar** (según el ticket). No se implementa un cambio de horario in-place; esto además evita tocar el camino de reserva de PP2-6 y el control de solapamiento.
2. **Estados cancelables:** `Pendiente` y `Confirmado`. Un turno `En curso`, `Completado` o `Cancelado` no se puede cancelar (400 con mensaje claro).
3. **Ventana de anticipación mínima: 24 h**, expresada como la constante `VENTANA_CANCELACION_HORAS`. El valor lo confirma el PO; queda centralizado para cambiarlo en un solo lugar. El cálculo usa el reloj local (`America/Argentina/Buenos_Aires`, vía `ahoraLocal`), consistente con la disponibilidad.
4. **Pertenencia (RNF03):** el Cliente solo cancela turnos propios. La búsqueda filtra por `cliente_id`; un turno ajeno o inexistente devuelve 404 sin revelar su existencia. El endpoint exige rol `CLIENT`.
5. **Motivo distinto del rechazo:** al cancelar el Cliente, `motivo_cancelacion` queda en `"cancelado por el cliente"` (PP2-13 usa `"rechazado por el negocio"`), de modo que el panel del negocio distingue quién canceló. Se audita con acción `RESERVA_CANCELADA_CLIENTE`.
6. **Aviso a la peluquería:** el turno cancelado aparece como `Cancelado` con su motivo en el panel `GET /reservations/all` (PP2-13). Un aviso en tiempo real queda fuera del alcance del MVP.
7. **Liberación del horario:** inmediata, por la vista `ocupacion_agenda` que excluye `Cancelado`. Verificado en integración.

## Correspondencia con el diseño y persistencia

No se agrega clase de dominio ni tabla: se opera sobre `Turno` y la columna `motivo_cancelacion` ya introducida en PP2-13. `CancelacionTurnoControl` coordina CU07 y `CancelacionTurnoController` es su frontera HTTP (rol `CLIENT`).

| Operación | Endpoint | Permiso |
|---|---|---|
| Cancelar un turno propio | `PATCH /api/v1/reservations/:id/cancel` | Cliente (propietario) |
| Consultar turnos propios (CU06) | `GET /api/v1/reservations/mine` | Cliente |

## Verificación

Verificación local realizada el 27/10/2026: suite unitaria y de integración HTTP/SQLite (incluye la ventana de 24 h con un turno del día), compilación TypeScript del paquete compartido, API y pruebas, y build de web. Todo pasó. El recibo que devuelve la cancelación se arma con la instantánea de la fila (sin depender del catálogo vivo), aplicando la observación de revisión anotada en PP2-13.

## Pendientes de alcance

- Cambio de horario in-place (reprogramación sin cancelar) si se decide salir del enfoque cancelar+reservar del MVP.
- El valor de la ventana (24 h) queda a confirmación final del PO; está parametrizado.
- Aviso en tiempo real a la peluquería (hoy pasivo, visible en el panel).
