# PP2-11 — Gestionar el catálogo de servicios

**Estado:** implementación funcional y verificada localmente; pendientes de alcance documentados abajo. **Rama:** `feature/PP2-11-gestion-catalogo-servicios`, creada desde `origin/main` luego de integrar PP2-6.

## Trazabilidad

- [Ticket PP2-11](https://axelspp.atlassian.net/browse/PP2-11): Admin mantiene el catálogo; Cliente consulta servicios disponibles.
- CU03 Consultar servicios (Admin, Peluquero/a, Cliente), RD03.04–RD03.05.
- CU04 Mantener catálogo (Admin), RD03.01–RD03.03.
- RG03 Gestionar servicios ofrecidos; RNF03 autorización por rol y RNF05 presentación usable.
- El [MODP](../../../../ChatGPT/PP2/AgendaApp/MODP-AgendaApp.drawio) representa `Servicio` con nombre, duración y precio y asociación con `Turno`.
- El [modelo de casos de uso](../../../../ChatGPT/PP2/AgendaApp/Modelo-casos-de-uso-AgendaApp.md) separa la consulta CU03 del mantenimiento CU04.
- La propuesta de diseño v0.1 identifica `ServiciosUI`/`ServiciosControl` para CU03–CU04 y mapea `Servicio` a `SERVICIO`; es referencia no aprobada.
- Los prototipos MVP v4 muestran consulta de servicios durante la reserva y gestión administrativa del catálogo. Los datos de ejemplo no son datos reales.
- [PP2-6](./PP2-6-reservar-turno.md) fija el comportamiento integrado de la reserva: cada turno ocupa el bloque global configurable, no la duración estimada del servicio.

## Decisiones de implementación

1. **Baja lógica confirmada por el usuario el 26/10/2026:** `activo=false` conserva la FK de `Turno` a `Servicio` y permite recuperar reservas previas. Los servicios inactivos no aparecen en el catálogo de nuevas reservas. Admin puede reactivarlos.
2. Nombre, duración estimada y precio que el Cliente vio al confirmar se guardan como instantánea en `turno`. Cambiar o desactivar el registro del catálogo no altera un recibo histórico. Las reservas existentes se migran tomando los datos actuales de `servicio`.
3. La duración de `Servicio` sigue siendo una estimación mostrada en el catálogo. La disponibilidad y ocupación siguen gobernadas por `configuracion_agenda.duracion_bloque_minutos`, conforme a la aclaración posterior del usuario para PP2-6.
4. El API conserva dinero en centavos enteros. La entrada acepta importes con hasta dos decimales y valida en servidor; la duración estimada acepta enteros entre 1 y 1440 minutos. No se impone unicidad de nombre porque no está especificada por los RD.
5. El CRUD se expone por una frontera HTTP (`ServicesController`) y lo coordina `CatalogoControl`; las reglas y autorización están en el backend. Solo el rol `ADMIN` puede crear, modificar, desactivar o reactivar. La consulta de activos permite los roles actualmente habilitados en autenticación (`ADMIN` y `CLIENT`). **Pendiente de integración:** habilitar consulta para Peluquero/a según RD03.04–RD03.05 y CU03 cuando el rol forme parte del alcance de autenticación.
6. La pantalla Admin bloquea acciones durante las solicitudes de guardado, baja y reactivación para evitar cambios superpuestos.

## Correspondencia con el diseño y persistencia

No se introduce una nueva clase de dominio. `Servicio` existente sigue representando el concepto del MODP. `ServicesController` es una frontera HTTP y `CatalogoControl` realiza las responsabilidades ya previstas para `ServiciosUI`/`ServiciosControl` en la propuesta de diseño; no se mapean a tablas.

La tabla existente `servicio` recibe `activo` con valor inicial verdadero. `turno` recibe `servicio_nombre` y `servicio_duracion_minutos` para completar la instantánea junto con `precio_centavos` y `duracion_minutos` (bloque acordado). Esto es una decisión de persistencia para historial y compatibilidad, no una clase nueva del MODP. Una migración no destructiva agrega columnas a bases existentes y completa los datos históricos disponibles.

| Operación | Endpoint | Permiso |
|---|---|---|
| Consultar catálogo disponible | `GET /api/v1/reservations/services` y `GET /api/v1/services` | Admin, Cliente |
| Consultar todos, incluidos inactivos | `GET /api/v1/services/admin` | Admin |
| Crear | `POST /api/v1/services` | Admin |
| Modificar | `PUT /api/v1/services/:id` | Admin |
| Dar de baja lógicamente | `DELETE /api/v1/services/:id` | Admin |
| Reactivar | `PATCH /api/v1/services/:id/reactivate` | Admin |

## Verificación

Verificación local realizada el 27/10/2026: suite de integración HTTP/SQLite, 9/9 pruebas; TypeScript para API, pruebas y paquete compartido; build de API; y build de web. Todo pasó. El build de API se ejecutó por pasos porque el script con `&&` no es compatible con la versión de PowerShell del entorno.

## Pendientes de alcance

- El ticket PP2-11 incorpora CU04 al Sprint 1, aunque la matriz vigente de RG/RD clasifica el ABM como posterior; el ticket es la instrucción operativa más reciente para esta rama.
- La fuente vigente de requisitos y el prototipo expresan que la duración estimada determina la ocupación. La aclaración posterior de PP2-6 adoptada para la implementación fija un bloque configurable independiente. Se conserva esa decisión técnica y la discrepancia documental queda pendiente de propagación a las fuentes académicas.
- CU03/RD03.04–RD03.05 incluyen Peluquero/a, pero la autenticación actual solo soporta `ADMIN` y `CLIENT`. La consulta del catálogo por Peluquero/a requiere integrar ese rol transversalmente.
