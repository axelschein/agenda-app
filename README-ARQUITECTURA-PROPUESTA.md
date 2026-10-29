# Arquitectura propuesta

## Objetivo

Definir una estructura inicial para el MVP de AgendaApp que separe la experiencia de usuario, las reglas de la aplicación y el acceso a la persistencia. Esta propuesta es independiente de los lenguajes y frameworks; las dos alternativas tecnológicas están en el [README principal](README.md).

## Componentes y responsabilidades

### Aplicación web

- Presenta las funciones disponibles según el rol del usuario.
- Permite al Cliente consultar servicios y disponibilidad, solicitar una reserva y revisar su estado.
- Permite al Admin gestionar servicios, disponibilidad y reservas.
- Valida datos básicos para ayudar al usuario, pero no reemplaza las validaciones del backend.
- Se comunica con la API y no accede directamente a la base de datos.

### API de la aplicación

- Expone las operaciones que necesita la aplicación web.
- Autentica a los usuarios y aplica autorización según los roles Admin y Cliente.
- Coordina los casos de uso y aplica las reglas de negocio.
- Valida las solicitudes, incluyendo disponibilidad y condiciones de reserva.
- Es el único componente que accede a la persistencia.

### Persistencia

- Guarda usuarios y roles, servicios, disponibilidad y reservas.
- Mantiene las relaciones e integridad de los datos.
- La selección de base de datos, el modelo físico y la herramienta de persistencia se definirán en una etapa posterior.

### Contrato de API

- Describe las operaciones, datos de entrada y salida y errores esperados entre la aplicación web y la API.
- Permite que ambos componentes evolucionen con acuerdos explícitos.
- En la alternativa de un solo lenguaje puede aportar definiciones compartidas; en la alternativa Java/TypeScript sirve como contrato independiente del lenguaje.

## Roles

- **Cliente:** consulta disponibilidad, solicita una reserva y consulta sus propias reservas.
- **Admin:** administra servicios y disponibilidad, y consulta y gestiona las reservas.

La API debe comprobar los permisos en cada operación. Ocultar una opción en la interfaz no es suficiente para proteger una acción.

## Flujo básico de reserva

1. El Cliente selecciona un servicio y consulta los horarios disponibles.
2. La aplicación web solicita la disponibilidad a la API.
3. La API consulta la persistencia y devuelve las opciones disponibles.
4. El Cliente elige un horario y envía la solicitud de reserva.
5. La API verifica identidad, permisos, datos y disponibilidad actual.
6. Si el horario sigue disponible, la API registra la reserva y devuelve su estado. Si dejó de estar disponible, informa el conflicto y permite consultar otros horarios.
7. El Cliente puede consultar el estado de la reserva; el Admin puede verla y gestionarla según sus permisos.

## Scaffolding inicial del monorepo

```text
agenda-app/
├─ apps/
│  ├─ web/                       # aplicación web para Admin y Cliente
│  └─ api/                       # API, casos de uso y reglas del negocio
├─ packages/
│  └─ contracts/                 # contratos compartidos entre web y API
├─ docs/
│  ├─ casos-de-uso/              # casos de uso y material funcional
│  └─ diagramas/                 # diagramas de arquitectura y dominio
├─ README.md                     # alternativas de tecnologías
└─ README-ARQUITECTURA-PROPUESTA.md
```

### Límites de dependencias

- `apps/web` depende del contrato de la API; no depende del almacenamiento.
- `apps/api` implementa los casos de uso y usa el contrato de la API.
- El acceso a persistencia queda detrás de responsabilidades internas de la API.
- `packages/contracts` contiene acuerdos de comunicación, no reglas de negocio ni acceso a datos.
- `docs` conserva el material de análisis y diseño como referencia para la implementación.

## Decisiones pendientes

- Seleccionar una de las dos alternativas tecnológicas documentadas en el README principal.
- Definir el mecanismo de autenticación y recuperación de acceso.
- Acordar estados, cancelaciones y reglas de modificación de las reservas.
- Elegir base de datos y estrategia de persistencia.
- Precisar si las reservas requieren confirmación manual del Admin o quedan confirmadas automáticamente.
