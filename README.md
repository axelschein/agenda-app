# AgendaApp

AgendaApp permite que clientes consulten disponibilidad y soliciten reservas, mientras que administradores gestionan servicios, disponibilidad y reservas.

Este repositorio documenta dos alternativas tecnológicas para implementar la misma arquitectura. La elección del stack no cambia las responsabilidades de cada componente; la arquitectura común está en [README-ARQUITECTURA-PROPUESTA.md](README-ARQUITECTURA-PROPUESTA.md).

## Opción A: TypeScript en frontend y backend

- **Frontend:** Next.js con TypeScript, en `apps/web`.
- **Backend:** NestJS con TypeScript, en `apps/api`.
- **Monorepo:** pnpm workspaces.
- **Contratos compartidos:** `packages/shared` para tipos, esquemas de validación y contratos de la API que puedan reutilizar ambas aplicaciones.
- **Persistencia:** responsabilidad exclusiva del backend. La base de datos y el ORM quedan por definir.

Esta alternativa mantiene un solo lenguaje y facilita compartir contratos entre frontend y backend. Permite organizar el backend con módulos, clases y servicios, conservando una API separada de la interfaz.

## Opción B: Java en backend y TypeScript en frontend

- **Frontend:** Next.js con TypeScript, en `apps/web`.
- **Backend:** Spring Boot con Java, en `apps/api`.
- **Monorepo:** pnpm workspaces para gestionar el frontend y las herramientas del repositorio. El backend mantiene su propio ciclo de compilación y dependencias Java.
- **Contrato entre aplicaciones:** especificación OpenAPI mantenida como contrato de la API; el cliente y los tipos del frontend pueden generarse a partir de ella.
- **Persistencia:** responsabilidad exclusiva del backend. La base de datos y la tecnología de persistencia quedan por definir.

Esta alternativa usa Java y su ecosistema orientado a objetos en el backend, y mantiene Next.js en el frontend. La comunicación entre ambos lados se acuerda mediante una API HTTP documentada, en vez de compartir clases directamente.

## Criterio de elección

- Elegir **Opción A** si se prioriza reducir la cantidad de ecosistemas y compartir tipos y validaciones dentro del monorepo.
- Elegir **Opción B** si el proyecto académico requiere Java o se quiere practicar específicamente el diseño orientado a objetos con Java.

Las dos opciones contemplan los roles Admin y Cliente y el flujo básico de reservas descrito en el documento de arquitectura. No se ha elegido aún una base de datos ni un ORM.
