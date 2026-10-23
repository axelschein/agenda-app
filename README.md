# AgendaApp

AgendaApp permite que clientes consulten disponibilidad y soliciten reservas, mientras que administradores gestionan servicios, disponibilidad y reservas.

La arquitectura y los límites entre componentes están documentados en [README-ARQUITECTURA-PROPUESTA.md](README-ARQUITECTURA-PROPUESTA.md).

## Stack elegido: Opción A

- **Frontend:** Next.js con TypeScript en `apps/web`.
- **Backend:** NestJS con TypeScript en `apps/api`.
- **Monorepo:** NPM Workspaces, incluidos en NPM.
- **Paquete compartido:** `packages/shared` contiene contratos y tipos públicos que usan ambas aplicaciones. No contiene reglas de negocio ni acceso a datos.
- **Persistencia:** solo la API accederá a la persistencia. La base de datos y el ORM quedan por definir.

Esta opción mantiene un lenguaje y un conjunto de herramientas comunes. El backend se organiza como un monolito modular con módulos NestJS para identidad y acceso, usuarios, servicios, disponibilidad y reservas.


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

La implementación inicial prepara la separación y el arranque de las aplicaciones. Las reglas concretas de reserva, autenticación y persistencia se completarán al definir sus requisitos y el modelo de datos.
