# Módulos, clases y límites

Cada módulo Nest representa una capacidad funcional y tiene un `*.module.ts` que Nest importa desde `AppModule`. Ese archivo declara un módulo de infraestructura de la aplicación, no una entidad del negocio. Por ejemplo, `UsersModule` agrupa la capacidad de usuarios; las clases de dominio son `Usuario`, `Cliente`, `Peluquero` y `Administrador`.

Cada clase de dominio tiene un único módulo propietario bajo `domain/`. No se copia en otros módulos, Next ni `packages/shared`. Cuando otro módulo necesita una clase, se importa mediante el `index.ts` público del módulo propietario. Los `index.ts` actuales exportan las entidades del diagrama que ya tienen consumidores entre módulos.

Las entidades no se registran como providers de Nest salvo que una necesidad técnica lo requiera. Los providers son controles de aplicación, repositorios/adaptadores y servicios técnicos. Se agregan carpetas `application/` e `infrastructure/` cuando existan responsabilidades implementadas que lo justifiquen; evitamos scaffolding vacío.

## Clases del dominio

- `users/domain/`: `Usuario` y sus especializaciones `Cliente`, `Peluquero` y `Administrador`.
- `services/domain/`: `Servicio`.
- `reservations/domain/`: `Turno`, asociado a Cliente, Peluquero y Servicio.
- `payments/domain/`: `Pago`, asociado a Turno.
- `auth/application/`: `AutenticacionControl`, control de aplicación del acceso. `auth/infrastructure/` contiene la sesión firmada y la lista de cuentas local.

Las Boundary de interfaz (`AutenticacionUI`, `ReservaTurnoUI` y `TurnosUI`) corresponden a Next. Los controladores HTTP de Nest son la frontera de la API. `packages/shared` contiene contratos de intercambio, no entidades internas.

La implementación actual de PP2-10 utiliza `AutenticacionControl`. Las otras entidades modelan clases del diagrama, sin reglas de reserva, transiciones de estado o persistencia que las fuentes dejan pendientes. `Peluquero` está modelado como usuario del dominio, pero no puede iniciar sesión en el MVP PP2-10.

## Autenticación local

El módulo `auth` permite iniciar y cerrar sesión para cuentas `ADMIN` y `CLIENT` declaradas en el archivo `.env` de la raíz del repositorio. Si no existe, copiá `.env.example` a `.env`, generá un hash con `npm run auth:hash-password --workspace=@agenda-app/api` e incluí las cuentas en `AUTH_USERS_JSON` con los campos `email`, `role` y `passwordHash`. El hash usa scrypt; no guardes contraseñas en texto plano.

La API firma una cookie de sesión `HttpOnly` con una clave definida en `AUTH_SESSION_SECRET`. La sesión dura ocho horas y la API vuelve a comprobar que el usuario y rol sigan en la lista permitida. `RolesGuard` y el decorador `@Roles(...)` quedan disponibles para proteger los controladores de cada función cuando se implementen.

El archivo `.env` no se versiona. El acceso está limitado a las cuentas enumeradas; si la lista queda vacía, no se acepta ningún inicio de sesión.
