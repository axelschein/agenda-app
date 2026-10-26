# AgendaApp

AgendaApp permite que clientes consulten disponibilidad y soliciten reservas, mientras que administradores gestionan servicios, disponibilidad y reservas.

La arquitectura y los límites entre componentes están documentados en [README-ARQUITECTURA-PROPUESTA.md](docs/README-ARQUITECTURA-PROPUESTA.md).

## Stack elegido: Opción A

- **Frontend:** Next.js con TypeScript en `apps/web`.
- **Backend:** NestJS con TypeScript en `apps/api`.
- **Monorepo:** NPM Workspaces, incluidos en NPM.
- **Paquete compartido:** `packages/shared` contiene contratos y tipos públicos que usan ambas aplicaciones. No contiene reglas de negocio ni acceso a datos.
- **Persistencia:** solo la API accederá a la persistencia. La base de datos y el ORM quedan por definir.

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

PP2-10 implementa el inicio de sesión local para Administrador y Cliente. Las reservas, la administración de catálogo, los pagos y la persistencia se incorporarán al priorizar sus casos de uso y definir sus reglas y modelo de datos.

## Pull requests

Al crear un pull request, seguí el formato definido en el [template de pull request](.github/pull_request_template.md). Completá la descripción, los cambios realizados, el alcance y los próximos pasos si corresponde. Si una sección no aplica, indicá “No aplica” en lugar de eliminarla.
