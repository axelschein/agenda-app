# PP2-6 — Reservar un turno

Implementación de CU09 (incluye CU03), en la rama feature/PP2-6-reservar-turno, derivada de origin/main 3f947a1. Fecha de consulta de fuentes: 26/10/2026.

## Fuentes vigentes y precedencia

- [PP2-6](https://axelspp.atlassian.net/browse/PP2-6): criterios de aceptación, estado inicial Pendiente y conflicto de concurrencia.
- [RG/RD y RNF, v9](https://axelspp.atlassian.net/wiki/spaces/PPA/pages/56164353): RD06.01–RD06.07; RD07.06; matriz MVP/Posterior; transiciones de estado.
- [Prototipos MVP, v4](https://axelspp.atlassian.net/wiki/spaces/PPA/pages/68485121): pantallas 2–5 e imágenes proto-02-servicio, proto-03-fecha-hora, proto-04-resumen y proto-05-confirmado. Imágenes inspeccionadas visualmente.
- [Correcciones y decisiones, v1](https://axelspp.atlassian.net/wiki/spaces/PPA/pages/73662466): COR-008, COR-012 y COR-015. Un servicio por turno y rating diferido.
- [Modelo de casos de uso, v3](https://axelspp.atlassian.net/wiki/spaces/PPA/pages/67567617).
- Modelos académicos en C:/Users/axels/OneDrive/Documentos/ChatGPT/PP2/AgendaApp/: casos de uso, requisitos/análisis, MODP Draw.io y propuesta de diseño v0.1. No se considera aprobado el diseño por usarlo como referencia.

La aclaración del usuario del 26/10 confirma bloques fijos de reserva, con valor inicial de 60 minutos persistido y configurable por Admin. Esta decisión posterior reemplaza, para esta implementación, la ocupación calculada según duración del servicio descrita en las fuentes anteriores. La duración estimada del catálogo se mantiene como información y no determina el intervalo reservado. Las decisiones de Confluence del 21/10 prevalecen sobre el borrador local del 18/10 y las imágenes antiguas en los demás aspectos. Aunque las imágenes muestran ratings y un recordatorio de una hora, ambos están fuera del MVP vigente. No se incorporan esos controles ni su texto. El importe de los ejemplos y los nombres del prototipo se usan solo en una precarga de demostración explícita; no son datos reales. La página de casos de uso publicada contiene menos detalle que el catálogo local, que conserva el flujo CU09.

## Trazabilidad de implementación y validación

| Criterio / fuente | Implementación | Validación |
| --- | --- | --- |
| RD06.01; CU03; pantalla 2 | CatalogoControl consulta catálogo precargado. ReservaTurno muestra nombre, duración e importe. | Catálogo vacío; errores de conexión; consulta autenticada. |
| RD06.02; pantalla 3 | PersonalControl expone solo identificador y nombre del personal precargado. | Sin personal; profesional inexistente; ausencia de rating. |
| RD06.04; RD07.06 | AgendaControl calcula disponibilidad por jornada semanal, bloque configurado y turnos ocupados. Admin configura franjas semanales por profesional. | Pausas, fin de jornada, fecha inválida/pasada y horarios solapados. |
| RD06.06; pantalla 4 | POST /reservations/summary obtiene resumen autoritativo con servicio, profesional, fecha, hora, duración y total. | Precio/duración adulterados o modificados requieren revisar nuevamente. |
| RD06.05; CA del ticket | ReservaTurnoControl registra Pendiente en transacción SQLite con control de todo el intervalo. | Dos conexiones independientes compiten: una reserva y un conflicto. |
| RD06.07; pantalla 5 | Recibo dentro de la app tras persistir; confirma registro, sin afirmar que el negocio ya confirmó. | Estado Pendiente e identificador; consulta propia y reapertura de la base. |
| RNF03 | SessionAuthGuard + RolesGuard: Cliente reserva; Admin configura horarios. Identidad tomada de sesión. | 401 sin sesión, 403 con rol incorrecto, no se acepta identidad enviada en el cuerpo. |
| RNF04 | Evento RESERVA_CREADA con FK al turno y fecha, dentro de la misma transacción. | Un evento por reserva incluso tras reintentar; actor recuperable por Cliente del turno. |
| RNF05 | Tarjetas, progreso, resumen, foco en encabezado, etiquetas de formulario, estados de carga/error y diseño adaptable. | Inspección de pantallas y recorrido del navegador; no equivale a auditoría completa de accesibilidad. |

RD06.03 (rating) está diferido por decisión vigente del PO, aunque aparece en el catálogo total de RD. Los guardados repetidos de la misma solicitud no generan nuevos turnos.

## Decisiones de implementación

Estas decisiones completan aspectos técnicos que las fuentes no fijaban; no son reglas de negocio atribuidas a la consigna.

1. SQLite en archivo local mediante node:sqlite, sin ORM ni nuevas dependencias. Permite persistencia y transacciones en la instalación local actual. El driver es experimental en Node 22.22.3. El despliegue distribuido, el motor definitivo y la política de copias de seguridad siguen pendientes.
2. Base exclusiva de la API, compartida por sus módulos de negocio. AgendaDatabase mantiene conexión, esquema inicial y transacciones. Los controles usan SQL parametrizado a través de ese adaptador local. Es un compromiso del MVP: extraer repositorios/puertos por módulo antes de cambiar el motor o ampliar la persistencia. La vista SQL ocupacion_agenda publica solo profesional, fecha e intervalo ocupado para AgendaControl; no duplica turnos ni expone Clientes a ese módulo. ClienteIdentidadControl mantiene la vinculación con la sesión dentro del módulo users.
3. La tabla técnica configuracion_agenda contiene una única configuración global duracion_bloque_minutos, inicializada en 60 solo si todavía no existe. Admin la modifica desde Disponibilidad; no hay una variable de entorno que la sobreescriba. Los horarios se ofrecen en incrementos del bloque desde el inicio de cada franja laboral y solo si el bloque cabe completo y no se superpone. La duración estimada del servicio no determina la ocupación.
4. Fecha y hora civiles de America/Argentina/Buenos_Aires. No se ofrecen turnos anteriores al minuto actual ni fechas pasadas. Fechas ISO y horas HH:mm se validan en la API. No se convierte con la zona del navegador o del servidor.
5. Una transacción BEGIN IMMEDIATE serializa confirmaciones y cambios de jornada. La disponibilidad se vuelve a comprobar en esa transacción. Un trigger de inserción impide superponer intervalos del mismo profesional y día. No basta un UNIQUE por hora: servicios de distinta duración también pueden solaparse. Futuras operaciones de actualización de turnos deberán aplicar la misma regla; no se implementan aquí.
6. Precio en centavos enteros y duración del bloque reservado se conservan como instantánea en TURNO. El Cliente envía los valores que revisó, pero la API compara el precio con el catálogo y el tiempo reservado con la configuración vigente. La UI presenta ARS, acorde al contexto local y a los ejemplos: es una configuración inicial, no soporte multimoneda.
7. La solicitud lleva un UUID v4 generado por la UI. UNIQUE(cliente_id, solicitud_id) hace idempotentes los reintentos. Reutilizarlo con otros datos produce conflicto. En caso de respuesta perdida se puede reintentar; tras recargar la página se consultan las reservas propias.
8. La sesión PP2-10 sigue usando su adaptador de cuentas autorizadas. CLIENTE guarda un UUID y el email normalizado de esa identidad. No se inventan nombre, teléfono, contraseña ni perfiles. Esta es una vinculación técnica mínima, no el mapeo definitivo de la jerarquía Usuario. La política de cambio de correo y la integración de perfiles se resolverán al persistir usuarios.
9. Los horarios comienzan vacíos: no se ofrecen jornadas inventadas. El Admin debe configurarlas. El script seed:agenda precarga únicamente catálogo y personal de ejemplo, de forma idempotente, sin reemplazar valores existentes ni crear cuentas.
10. Una modificación de jornada afecta a nuevas reservas y no cancela turnos existentes. La gestión de excepciones, feriados, ausencias y cancelaciones pertenece a la evolución correspondiente.

## Persistencia: alcance parcial de CU09

No reemplaza el MODP ni aprueba la propuesta de BDR completa. Solo se persisten datos necesarios para este flujo; Boundary y Control no se convierten en tablas.

| Tabla | Identidad y relaciones | Origen |
| --- | --- | --- |
| servicio | PK id; nombre; duración; precio en centavos | Servicio; consulta del catálogo RD06.01. |
| peluquero | PK id; nombre | Referencia al personal precargado RD06.02; no cuenta de acceso. |
| cliente | PK UUID; email UNIQUE | Vinculación técnica con la identidad CLIENT de PP2-10. |
| horario_laboral | PK (peluquero_id, día, inicio); FK a peluquero | RD07.06, representación de solución de COR-008. |
| turno | PK UUID; FK obligatorias a cliente, peluquero y servicio; fecha; inicio; duración/precio acordados; estado; fecha de alta; solicitud idempotente | RD06.05 y CA de PP2-6. Cada referencia del turno corresponde a exactamente un registro; cada registro puede tener 0..* turnos. |
| auditoria_turno | PK técnica; FK obligatoria al turno; acción y momento | RNF04, soporte técnico limitado al alta de la reserva. |

Todas las columnas son NOT NULL salvo la PK entera autogenerada. Se activan FKs; no se agregan cascadas. Los CHECK validan rangos, duración, precio y estados. El índice por profesional, fecha e inicio apoya el cálculo de disponibilidad. No se guardan listas de horarios o turnos como texto. Ninguna tabla almacena credenciales.

## API

Las rutas llevan prefijo /api/v1. Requieren la cookie de sesión existente.

| Ruta | Rol | Resultado |
| --- | --- | --- |
| GET /reservations/services | Cliente, Admin | Servicios disponibles. |
| GET /reservations/barbers | Cliente, Admin | Identificador y nombre del personal. |
| GET /reservations/availability?servicioId=…&peluqueroId=…&fecha=AAAA-MM-DD | Cliente | Horarios calculados y zona horaria. |
| POST /reservations/summary | Cliente | Resumen actualizado de la selección. |
| POST /reservations | Cliente | Recibo persistido o conflicto 409. |
| GET /reservations/mine | Cliente | Reservas de la identidad autenticada, para recuperar su recibo. |
| GET /availability/working-hours/:peluqueroId | Admin | Jornada semanal actual. |
| PUT /availability/working-hours/:peluqueroId | Admin | Reemplaza jornada: { franjas: [{ dia:0..6, inicio:'09:00', fin:'18:00' }] }. Lista vacía cierra la agenda. |

POST summary recibe servicioId, peluqueroId, fecha y horaInicio. POST reservations agrega solicitudId, precioRevisado y duracionRevisada. Nunca recibe una identidad de Cliente confiable desde el navegador.

## Alcance y pruebas

Se implementan reserva, recibo, consulta mínima de reservas propias y configuración de jornada necesaria para cumplir el criterio de aceptación. No se implementan cancelaciones, transiciones del negocio, notificaciones de confirmación/rechazo, OAuth, recuperación de contraseña ni ABM de catálogo/personal. Tampoco se publican cambios en Jira/Confluence.

La ventana de cancelación (24 h vigente, propuesta de 2 h pendiente en COR-003) no afecta PP2-6 y permanece pendiente para su ticket. No se incorpora una política de cancelación implícita.

Verificación realizada: 22 pruebas unitarias de Jest y siete de integración HTTP/SQLite. Las unitarias usan mocks de dependencias; las de integración comprueban solicitudes simultáneas a dos instancias Nest en el mismo proceso, con conexiones distintas a la base temporal, integridad del intervalo y rollback ante un fallo de auditoría. La compilación de API y web se verificó separadamente durante la implementación. Recorrido en navegador con datos aislados: selección, resumen, conflicto antes de confirmar, nueva selección, recibo Pendiente, consulta propia y guardado de jornadas por Admin. No se realizó una auditoría integral de accesibilidad ni una inspección de viewport móvil.

Verificación reproducible: npm test (unitarias); npm run test:integration (integración); npm run test:typecheck --workspace=@agenda-app/api (tipos sin emisión). npm run build es una operación independiente y no forma parte de los scripts de prueba. Jest y ts-jest ejecutan los fuentes de src; moduleNameMapper resuelve @agenda-app/shared desde sus fuentes. No se importan archivos de dist, no hay workers con código evaluado ni rutas de archivos mediante new URL.

Las unitarias inyectan mocks con @nestjs/testing y jest.fn; no levantan servidores ni abren bases. Las de integración usan Supertest con cuentas sintéticas y SQLite temporal por escenario, restauran las variables de entorno y cierran las conexiones. No cargan .env ni usan datos reales. La configuración ESM sobre Node 22 requiere --experimental-vm-modules, según la [documentación de Jest](https://jestjs.io/docs/ecmascript-modules). La compilación conserva su comando separado; en Windows PowerShell 5 puede requerir npm --script-shell=cmd.exe run build.

## Ajustes tras la prueba del usuario

La tarjeta Servicios del Admin abre el catálogo de consulta (RD03.04–RD03.05); no habilita ABM. El usuario confirmó después reservas en bloques inicialmente de 60 minutos, definidos por el negocio en base de datos. Admin dispone de GET/PUT /availability/settings (lectura también habilitada a Cliente); solo Admin puede guardar el valor. La tabla de configuración es soporte técnico de agenda y no reemplaza una entidad del MODP. El contrato ReservationSummary distingue duracionBloqueMinutos de servicio.duracionMinutos; duracionRevisada corresponde al bloque que el Cliente revisó. Si cambia antes de confirmar se exige un nuevo resumen. Los turnos anteriores y sus reintentos conservan la duración persistida. Cambiar el bloque no modifica jornadas existentes, no desplaza reservas y no habilita franjas fuera de jornada.

La configuración del Admin se presenta en horas: 1 equivale a 60 minutos y 1.5 a 90; la API conserva minutos enteros como unidad interna. Los valores persistidos se convierten al mostrarlos, sin alterar la duración configurada. Admin ve un aviso si ninguna jornada del profesional admite el bloque; Cliente recibe un motivo cuando la fecha pasó, el día no tiene jornada, el bloque no cabe o no quedan cupos. Se verificó el caso de 6 horas con jornada de 3 horas y su corrección a 1 hora.
