# PP2-12 — Seleccionar un servicio para una reserva

**Estado:** desarrollo iniciado. **Rama:** `feature/PP2-12-seleccionar-servicio`, creada desde `origin/main` (`01efbe2`).

## Alcance confirmado

El ticket permite seleccionar un único servicio por turno. La selección de varios servicios queda fuera del MVP y el título de Jira se corrigió para reflejarlo. La duración estimada del servicio y su precio se muestran como información del catálogo; el tiempo reservado continúa determinado por el bloque global configurable de PP2-6.

## Trazabilidad

- [Ticket PP2-12](https://axelspp.atlassian.net/browse/PP2-12).
- CU03 Consultar servicios y CU09 Reservar turno.
- RD03.04, RD03.05, RD06.01 y RD06.05; RNF03 y RNF05.
- La decisión COR-012 limita cada turno del MVP a un servicio. La aclaración posterior de PP2-6 fija el bloque configurable de Disponibilidad como duración ocupada.
- [PP2-6 — Reservar un turno](./PP2-6-reservar-turno.md) describe el bloque configurable, la validación del resumen y la persistencia del turno.

## Comportamiento implementado

- La pantalla de reserva presenta el catálogo activo con nombre, duración estimada y precio.
- La selección se expresa con radios nativos: el Cliente solo puede elegir un servicio por turno.
- Sin servicios disponibles, la aplicación informa la situación y mantiene deshabilitado el avance.
- El Cliente elige después profesional, fecha y horario. La API obtiene el bloque configurado y lo presenta en el resumen; la duración estimada del servicio no cambia la ocupación.
- Los contratos de reserva envían un único `servicioId`; el turno mantiene una FK a un solo `Servicio`.

## Verificación pendiente

Verificación local realizada el 27/10/2026: suite unitaria, 28/28; suite de integración HTTP/SQLite, 11/11; chequeos de TypeScript para API, pruebas y paquete compartido; build de API; y build de web. Todo pasó. La prueba unitaria verifica que una lista de servicios se rechaza y que el resumen usa el bloque configurable aunque la duración estimada del servicio sea distinta.
