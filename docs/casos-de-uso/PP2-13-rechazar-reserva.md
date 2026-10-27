# PP2-13 — Rechazar una reserva

**Estado:** implementación funcional y verificada localmente; pendientes de alcance documentados abajo. **Rama:** `feature/PP2-13-rechazar-reserva`, creada desde `origin/main` luego de integrar PP2-6 y PP2-11.

## Trazabilidad

- [Ticket PP2-13](https://axelspp.atlassian.net/browse/PP2-13): Admin/Peluquero/a rechaza un turno pendiente; el horario vuelve a quedar disponible y el Cliente ve que fue rechazado.
- CU08 Administrar estados de turnos. RD05.06 · RNF03 (autorización por rol).
- Pantallas 6 y 7 — Panel y Detalle del turno (Prototipos MVP). Los datos de ejemplo no son datos reales.
- Depende de PP2-6 (reserva y vista `ocupacion_agenda`) y de la instantánea de servicio de PP2-11.

## Decisiones de implementación

1. **Solo se rechaza un turno en estado `Pendiente`.** Rechazar un turno ya `Cancelado`, `En curso` o `Completado` devuelve 400 con un mensaje claro; un identificador inexistente devuelve 404. El rechazo es idempotente a nivel de negocio: no hay doble cancelación.
2. **Motivo fijo del criterio de aceptación:** al rechazar, `turno.estado` pasa a `Cancelado` y `turno.motivo_cancelacion` queda en `"rechazado por el negocio"`. Se agrega la columna `motivo_cancelacion` por migración no destructiva (mismo patrón aditivo que `servicio_nombre`); las bases existentes la reciben con valor vacío.
3. **El horario se libera automáticamente.** La vista `ocupacion_agenda` ya excluye los turnos `Cancelado`, por lo que no hace falta borrar nada: tras el rechazo el bloque vuelve a ofrecerse en disponibilidad. Verificado en integración.
4. **Notificación in-app al Cliente (MVP):** `GET /reservations/mine` ahora expone `motivoCancelacion`, de modo que el Cliente ve en *Mis turnos* que su reserva fue *Cancelada* por el negocio con el motivo. Una notificación en tiempo real (push/toast) queda como mejora posterior; no está en el alcance del MVP.
5. **RBAC (RNF03):** la consulta del panel (`GET /reservations/all`) y el rechazo (`PATCH /reservations/:id/reject`) exigen rol `ADMIN`. El Cliente recibe 403. El rol Peluquero/a se habilitará cuando forme parte del alcance de autenticación (hoy solo existen `ADMIN` y `CLIENT`); el caso de uso lo contempla pero la autenticación todavía no.
6. **Frontera y coordinación:** `GestionReservasController` es la frontera HTTP y `GestionReservasControl` coordina el caso de uso, en línea con la convención `*.Control` del proyecto. El rechazo se ejecuta dentro de una transacción (UPDATE de estado + registro en `auditoria_turno` con acción `RESERVA_RECHAZADA`).
7. La pantalla de administración bloquea el botón durante la solicitud para evitar rechazos superpuestos y pide confirmación antes de rechazar.

## Correspondencia con el diseño y persistencia

No se introduce una nueva clase de dominio: se opera sobre `Turno` existente. `GestionReservasControl` realiza responsabilidades de control ya previstas para la administración de estados. La única decisión de persistencia es la columna `motivo_cancelacion` en `turno` (historial del motivo), no una clase nueva del MODP.

| Operación | Endpoint | Permiso |
|---|---|---|
| Consultar todas las reservas (panel) | `GET /api/v1/reservations/all` | Admin |
| Rechazar un turno pendiente | `PATCH /api/v1/reservations/:id/reject` | Admin |

## Verificación

Verificación local realizada el 27/10/2026: suite unitaria (26/26) y de integración HTTP/SQLite (11/11), compilación TypeScript del paquete compartido, API y pruebas, y build de web. Todo pasó. Casos cubiertos: panel solo-Admin, rechazo que libera el horario, motivo visible para el Cliente, RBAC (403 al Cliente), 400 al re-rechazar y 404 ante id inexistente.

## Observaciones durante la revisión del código integrado (PP2-6 / PP2-11)

Al construir sobre `origin/main` leí el módulo de reservas ya integrado. Dejo observaciones para discutir; no las toqué en esta rama para no mezclar alcance:

1. **`ReservaTurnoControl.recibo()` sigue dependiendo de `catalogo.obtenerHistorico()`** aunque `turno` ya guarda la instantánea (`servicio_nombre`, `servicio_duracion_minutos`, `precio_centavos`). Si alguna vez se borra físicamente un `servicio`, `obtenerHistorico` lanza `NotFound` y `GET /reservations/mine` respondería 500 para turnos históricos, justo lo que la instantánea buscaba evitar. El recibo podría armarse solo con los datos de la fila (`id = row.servicio_id` ya está disponible). *(En `gestion-reservas.control.ts` repliqué el patrón por consistencia; conviene corregir ambos juntos.)*
2. **El trigger `turno_sin_superposicion` es `BEFORE INSERT` únicamente.** Protege la creación, pero cualquier cambio de estado/horario in-place por UPDATE (p. ej. una futura reprogramación que no sea cancelar+reservar) no pasaría por el control de solapamiento. Hoy no hay ese camino, pero conviene un `BEFORE UPDATE` análogo antes de agregar transiciones que muevan un turno.
3. **Superficie de API duplicada:** el catálogo se consulta por `GET /services` (ServicesController) y también por `GET /reservations/services` (ReservationsController). Funciona, pero son dos rutas para lo mismo; valdría unificar o dejar documentado cuál es la canónica.

## Pendientes de alcance

- Rol Peluquero/a en autenticación para que también pueda rechazar (CU08).
- Notificación en tiempo real al Cliente (hoy es pasiva, visible en *Mis turnos*).
