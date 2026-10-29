# PP2-22 — Flujo integral del Peluquero/a

**Estado:** implementación en curso. Este documento describe el corte de código de la épica, no reemplaza ni aprueba el MODP o el modelo de diseño de AgendaApp.

## Trazabilidad y alcance implementado

| Ticket | Requisito | Implementación |
|---|---|---|
| PP2-33 | RNF01–RNF04; identidad del profesional | Las cuentas locales `BARBER` llevan `peluqueroId` en `AUTH_USERS_JSON`. El ID debe corresponder a un perfil activo. Una cuenta solo puede vincularse a un perfil; el mismo perfil no se admite en dos cuentas. La relación es configuración local y no una nueva entidad persistente de cuenta. |
| PP2-34 | Acceso y permisos por rol | Inicio, cierre y sesión firmada mantienen el mecanismo existente. La sesión profesional se invalida si deja de estar autorizada o su perfil se da de baja. Las operaciones se protegen en la API; Admin y Cliente conservan sus permisos previos. |
| PP2-35 | CU10 / RD07.01–RD07.05 | `GET /reservations/assigned?desde=AAAA-MM-DD&hasta=AAAA-MM-DD` devuelve solo turnos del ID profesional de la sesión y admite entre uno y siete días. La interfaz permite consultar un día o semana. |
| PP2-36 | CU08 / RD05.02 y RD05.06 | `PATCH /reservations/:id/confirm` y `PATCH /reservations/:id/reject-as-assigned` exigen asignación al profesional y estado `Pendiente`. Cada cambio y su evento de auditoría se guardan en una transacción. Rechazar deja el turno `Cancelado`, motivo `rechazado por el negocio`; el evento de auditoría conserva la acción profesional. |
| PP2-37 | CU02 / RD02.01–RD02.03; CU11 / RD08.01–RD08.06 | El profesional consulta y modifica su nombre y teléfono; su correo de acceso es de solo lectura. Admin puede crear perfiles, consultarlos y actualizarlos o darlos de baja/reactivarlos. Se conservan auditorías con valores anterior y nuevo. La baja excluye el perfil de nuevas reservas y bloquea su acceso. |
| PP2-38 | CU13 / RD10.01–RD10.04 | La consulta personal agrega turnos `Completado` e importes guardados en centavos para una fecha y muestra el conteo del día anterior. La interfaz permite cambiar la fecha. Rating queda sin dato porque no se definieron su fuente ni cálculo. |
| PP2-39 | CU16 / RD13.01–RD13.03 | Pendiente de las reglas y persistencia del módulo comercial de PP2-21. Esta épica no crea una segunda implementación de cobros. |

## Matriz de acceso del flujo profesional

| Recurso | Admin | Peluquero/a | Cliente |
|---|---:|---:|---:|
| Administrar perfiles profesionales | Sí | No | No |
| Consultar/editar perfil propio | No en este corte | Sí | No en este corte |
| Consultar servicios | Sí | Sí | Sí |
| Consultar agenda propia | No en esta ruta | Sí | No |
| Confirmar/rechazar turno | Gestión existente según su rol | Solo asignados y pendientes | No |
| Indicadores personales | No | Solo perfil de sesión | No |
| Cobros | Funciones de PP2-21 | Pendiente de PP2-21 | Historial de PP2-21 |

La API deriva la identidad profesional de la sesión firmada. No acepta un `peluqueroId` suministrado por el navegador para filtrar agenda, indicadores o cambios de estado.

## Persistencia añadida

- `perfil_peluquero` extiende 1:1 la tabla actual `peluquero` con teléfono y estado activo. Los registros antiguos quedan activos y sin teléfono mediante valores por defecto.
- `auditoria_usuario` registra actor, acción, fecha y el antes/después del perfil. Los cambios de perfil se escriben en una transacción.
- `auditoria_turno` registra confirmación y rechazo hechos por el profesional; el cambio de estado y el evento son atómicos.
- La migración es aditiva. La tabla existente `peluquero(id,nombre)` conserva su forma para los datos y scripts del MVP.

## Límites y decisiones pendientes

1. La cuenta se configura manualmente en `AUTH_USERS_JSON`; no hay alta de credenciales, recuperación de contraseña ni OAuth. El alta de usuario completa de CU01/RD01 excede el flujo de perfil profesional y el MVP de autenticación.
2. El vínculo cuenta-perfil funciona por configuración local, sin FK persistente. La cardinalidad global entre personas y roles sigue pendiente en el diseño aprobado; esta implementación conserva las clases `Peluquero`, `Cliente` y `Administrador` separadas.
3. El modelo persistido de Cliente solo guarda correo, no nombre. La agenda muestra ese dato disponible; no inventa un nombre. Hace falta resolver la captura y persistencia del nombre antes de completar RD07.03 literalmente.
4. Los indicadores usan `fecha` del turno y `precio_centavos` de los turnos completados como estimación. El rating se expone como `null` hasta decidir su fuente, período y fórmula. No se genera una variación porcentual porque no está definida.
5. PP2-21 todavía debe acordar reglas, estados y persistencia de pagos. El flujo de cobros propio no se habilita hasta que esa dependencia quede implementada.
6. La ficha de personal usa los atributos existentes del modelo (`nombre`, `email`, `telefono`). El email proviene de la configuración de acceso; no se modifica desde el perfil. No se agregan campos de negocio no especificados.

## Validación prevista

Las pruebas de integración usan SQLite temporal y cuentas aisladas para comprobar autenticación, filtros por identidad, denegación de turnos ajenos, transiciones permitidas, auditoría, perfil y consultas agregadas con datos conocidos. No emplean la base local de desarrollo.
