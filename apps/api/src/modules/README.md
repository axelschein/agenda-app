# Clases de dominio y aplicación

Las entidades del diagrama detallado de `AgendaApp/Diseno-clases-AgendaApp-MVP.drawio` viven en el backend, dentro del módulo que las posee:

- `users/domain/`: `Usuario` y sus especializaciones `Cliente`, `Peluquero` y `Administrador`.
- `services/domain/`: `Servicio`.
- `reservations/domain/`: `Turno` y sus asociaciones con cliente, peluquero y servicio.
- `payments/domain/`: `Pago` y su asociación con turno.
- `auth/`: `AutenticacionControl`, control de aplicación usado por el controlador HTTP de inicio/cierre de sesión.

Los Boundary de interfaz (`AutenticacionUI`, `ReservaTurnoUI` y `TurnosUI`) corresponden a la aplicación Next. Los controladores HTTP de Nest son la frontera de la API. Las entidades de dominio no se duplican en `packages/shared`; allí se mantienen solo los contratos que cruzan la API.

La implementación actual de PP2-10 utiliza `AutenticacionControl`. Las entidades restantes representan el modelo del diagrama; no agregan reglas de reserva, transiciones de estado o persistencia que las fuentes dejan pendientes. El catálogo de controles de evolución (perfiles, catálogo administrativo, reportes, cobros, etc.) no se implementa como funcionalidad en PP2-10.

## Autenticación local

El módulo `auth` permite iniciar y cerrar sesión para cuentas `ADMIN` y `CLIENT` declaradas en `apps/api/.env`. Copiá `apps/api/.env.example` a `apps/api/.env`, generá un hash con `npm run auth:hash-password --workspace=@agenda-app/api` e incluí las cuentas en `AUTH_USERS_JSON` con los campos `email`, `role` y `passwordHash`. El hash usa scrypt; no guardes contraseñas en texto plano.

La API firma una cookie de sesión `HttpOnly` con una clave definida en `AUTH_SESSION_SECRET`. La sesión dura ocho horas y la API vuelve a comprobar que el usuario y rol sigan en la lista permitida. `RolesGuard` y el decorador `@Roles(...)` quedan disponibles para proteger los controladores de cada función cuando se implementen.

El archivo `.env` no se versiona. El acceso está limitado a las cuentas enumeradas; si la lista queda vacía, no se acepta ningún inicio de sesión.
