# AgendaApp

AgendaApp permite que clientes consulten disponibilidad y soliciten reservas, mientras que administradores gestionan servicios, disponibilidad y reservas.

La arquitectura y los límites entre componentes están documentados en [README-ARQUITECTURA-PROPUESTA.md](docs/README-ARQUITECTURA-PROPUESTA.md).

## Stack elegido: Opción A

- **Frontend:** Next.js con TypeScript en `apps/web`.
- **Backend:** NestJS con TypeScript en `apps/api`.
- **Monorepo:** NPM Workspaces, incluidos en NPM.
- **Paquete compartido:** `packages/shared` contiene contratos y tipos públicos que usan ambas aplicaciones. No contiene reglas de negocio ni acceso a datos.
- **Persistencia:** SQLite local con el driver integrado de Node para PP2-6, sin ORM. Solo la API accede al archivo de datos. El motor de despliegue definitivo queda pendiente.

Esta opción mantiene un lenguaje y un conjunto de herramientas comunes. El backend se organiza como un monolito modular con módulos NestJS para identidad y acceso, usuarios, servicios, disponibilidad, reservas y pagos.


## Requisitos

- Node.js `22.22.3`, seleccionada con NVM.
- NPM, incluido con Node.js.

## Inicio local

Con NVM para Windows, instalá y seleccioná la versión definida en `.nvmrc`:

```powershell
nvm install 22.22.3
nvm use 22.22.3
```

Instalá las dependencias desde la raíz del repositorio:

```bash
npm install
```

Creá el archivo de configuración local en la raíz del repositorio:

```powershell
Copy-Item .env.example .env
```

En `.env`, reemplazá `AUTH_SESSION_SECRET` por una clave aleatoria de al menos 32 caracteres y agregá las cuentas autorizadas a `AUTH_USERS_JSON`. Para generar el `passwordHash` de cada cuenta, ejecutá `npm run auth:hash-password --workspace=@agenda-app/api`. El ejemplo contiene una lista vacía (`[]`): con esa lista la API inicia, pero nadie puede ingresar. La estructura de cada cuenta está explicada en `.env.example`.

Iniciá cada aplicación en una terminal separada:

```bash
npm run dev:web
```

```bash
npm run dev:api
```

La web queda disponible en `http://localhost:3000` y la API en `http://localhost:3001/api/v1`. El endpoint de disponibilidad de la API es `GET /api/v1/health`.

## Estructura

```text
apps/web       Interfaz de Admin y Cliente
apps/api       API, casos de uso y reglas de negocio
packages/shared Contratos compartidos entre las aplicaciones
docs           Material de análisis y diagramas
```

PP2-10 implementa el inicio de sesión local para Administrador y Cliente. PP2-6 agrega la reserva guiada, recibo, consulta de reservas propias y configuración de horarios laborales. La [trazabilidad de PP2-6](docs/casos-de-uso/PP2-6-reservar-turno.md) documenta fuentes y decisiones.

## Preparar las reservas locales

1. Iniciá la API una vez para crear el esquema SQLite en data/agenda.sqlite (o AGENDA_DB_PATH). El archivo y los datos locales están excluidos de Git.
2. Precargá catálogo y personal de demostración con npm run seed:agenda --workspace=@agenda-app/api. Los importes y nombres son ejemplos del prototipo; el script no crea cuentas ni horarios.
3. Ingresá como Admin y abrí Disponibilidad. La duración de cada reserva está guardada en la base con valor inicial de 60 minutos y puede modificarse desde esa pantalla. Elegí profesional y configurá sus franjas semanales de trabajo. Sin jornadas configuradas no se ofrecen horarios.
4. Ingresá como Cliente, abrí Reservar turno y elegí servicio, profesional, fecha y horario. Revisá el resumen y confirmá. El turno se registra Pendiente y ocupa un bloque del tamaño configurado por el negocio, independientemente de la duración estimada del servicio. Las reservas existentes conservan su duración si luego cambia la configuración.

SQLite usa el módulo experimental node:sqlite de Node 22.22.3; no requiere instalar un servidor. No borrar el archivo para actualizar el código. El motor definitivo, la migración de usuarios completos, feriados y ausencias siguen pendientes. No hay ABM de catálogo/personal ni pagos en esta entrega.

## Verificación

- npm test: pruebas unitarias con Jest y mocks, directamente sobre TypeScript.
- npm run test:integration: pruebas HTTP con Supertest y SQLite temporal.
- npm run test:typecheck --workspace=@agenda-app/api: verificación de tipos sin emitir archivos.
- npm run build: compilación independiente de las pruebas.

El workflow CI ejecuta estas verificaciones en cada PR y en los cambios de main. Las pruebas se ejecutan antes del build, con pasos separados.

Los comandos de prueba no ejecutan build ni necesitan dist. Jest usa ts-jest para transformar los fuentes en memoria y @nestjs/testing para inyectar mocks. Las pruebas de integración no cargan .env, no usan la base local y no requieren iniciar la API.

Para el build, si NPM tiene configurado Windows PowerShell 5 como intérprete, usá npm --script-shell=cmd.exe run build: el script de compilación existente emplea &&.

## Pull requests

Al crear un pull request, seguí el formato definido en el [template de pull request](.github/pull_request_template.md). Completá la descripción, los cambios realizados, el alcance y los próximos pasos si corresponde. Si una sección no aplica, indicá “No aplica” en lugar de eliminarla.
