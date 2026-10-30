# Borrador de tareas para Jira — AgendaApp

Este documento resume el trabajo incluido en `feature/fixes-ui` y propone cómo separarlo en tickets. **Todavía no se crearon issues en Jira.** La modificación local de autenticación con contraseña hardcodeada queda fuera del commit, del PR y de esta propuesta.

## Épica sugerida: Mejoras de navegación, indicadores y experiencia de AgendaApp

### 1. Preparar datos de demostración para clientes y peluqueros

**Objetivo:** que la cuenta de demostración de cliente y los perfiles profesionales tengan actividad visible al iniciar la aplicación.

**Alcance:** vincular `cliente@demo.local` con los datos de seed; crear ejemplos de turnos completados y pagos para Ana, Marco y Lucía.

**Aceptación:** al ejecutar el seed más de una vez no se duplican los registros; los indicadores y los reportes muestran datos de ejemplo; las credenciales se configuran fuera del código fuente.

**Archivos:** `apps/api/scripts/seed-agenda.mjs`.

### 2. Navegar por rutas según el rol

**Objetivo:** que las vistas de administración, peluquero y cliente tengan URLs propias y funcionen al recargar o compartir una ruta interna.

**Alcance:** rutas para los módulos de cada rol, resolución de sesión y redirección cuando la ruta no corresponde al rol.

**Aceptación:** cada sección cambia la URL; al recargar una ruta se conserva la vista; una cuenta no puede entrar en las rutas de otro rol.

**Archivos:** `apps/web/src/app/[[...segments]]/page.tsx`, `apps/web/src/app/page.tsx`, `apps/web/src/components/dashboard.tsx`.

### 3. Mejorar navegación y encabezados del peluquero

**Objetivo:** que Agenda, Mi perfil e Indicadores compartan una navegación estable y clara.

**Alcance:** tarjeta de Indicadores en el inicio del peluquero, flecha de volver a la izquierda, subtítulo contextual y navegación entre pestañas sin remontar toda la pantalla.

**Aceptación:** las tres secciones se abren desde el inicio y desde las pestañas; la URL refleja la sección; el encabezado no muestra “Área profesional”; al cambiar de pestaña no reaparece la pantalla completa.

**Archivos:** `apps/web/src/components/dashboard.tsx`, `apps/web/src/components/flujo-peluquero.tsx`, `apps/web/src/app/globals.css`.

### 4. Consultar indicadores del peluquero por período

**Objetivo:** permitir revisar actividad diaria o de varias semanas con métricas comparables.

**Alcance:** períodos rápidos de 7, 14 y 21 días, fechas manuales de hasta 90 días, totales de turnos e ingresos, comparación con el período inmediatamente anterior y serie diaria.

**Aceptación:** el backend valida fechas y límites; las métricas consideran todo el período; el gráfico incluye días sin turnos; una consulta de un solo día sigue siendo compatible.

**Archivos:** `apps/api/src/modules/users/personal.control.ts`, `apps/api/src/modules/users/users.controller.ts`, `packages/shared/src/reservations.ts`, `apps/web/src/components/flujo-peluquero.tsx` y test de flujo profesional.

### 5. Simplificar visualización de indicadores

**Objetivo:** mostrar tendencias sin amontonar las etiquetas cuando el período tiene muchos días.

**Alcance:** gráficos lineales por día para peluqueros y administración; etiquetas espaciadas y nota de rating sin estrellas cuando no hay datos.

**Aceptación:** los gráficos usan los datos filtrados; las fechas se leen en períodos largos; el rating vacío muestra “Sin datos” sin estrellas grises.

**Archivos:** `apps/web/src/components/flujo-peluquero.tsx`, `apps/web/src/components/indicadores.tsx`, `apps/web/src/app/globals.css`.

### 9. Alinear el rango consultado con el gráfico de administración

**Objetivo:** que el período seleccionado y el eje temporal del gráfico representen las mismas fechas.

**Alcance:** completar con cero los días sin turnos; limitar cada consulta a 31 días inclusive en los controles y en la API; mostrar el rango aplicado.

**Aceptación:** una consulta del 1 al 30 de octubre dibuja todos los días de ese rango, incluidos los días sin actividad; no se puede consultar un período mayor a 31 días; la API rechaza rangos de más de 31 días.

**Archivos:** `apps/web/src/components/indicadores.tsx`, `apps/web/src/app/globals.css`, `apps/api/src/modules/reports/application/indicadores.control.ts` y test de reportes.

### 6. Pulir formularios y pantallas de administración

**Objetivo:** ordenar las pantallas operativas y hacer más visibles sus estados.

**Alcance:** ancho del formulario de personal, espacio en el catálogo, sección de cobros pendientes, filtros y espaciados de indicadores, estilos de selectores, inputs y confirmación al guardar horarios.

**Aceptación:** los controles ocupan el ancho disponible de forma coherente; los mensajes de guardado se distinguen del contenido; el listado de cobros tiene un título y un estado vacío claro.

**Archivos:** componentes de catálogo, cobros, personal, disponibilidad e indicadores; `apps/web/src/app/globals.css`.

### 7. Aplicar identidad visual de AgendaApp

**Objetivo:** incorporar el logo aprobado y mantener una identidad consistente en acceso y panel autenticado.

**Alcance:** logo en login y encabezado, marca “AgendaApp”, y simplificación del texto de acceso.

**Aceptación:** el logo se ve en login y en el panel; el nombre mantiene camel case; el login no lista roles que puedan confundir.

**Archivos:** `apps/web/public/agendaapp-icon.png`, `apps/web/src/components/login-view.tsx`, `apps/web/src/components/dashboard.tsx`, `apps/web/src/app/globals.css`.

### 8. Simplificar inicio y reinicio local en Windows

**Objetivo:** iniciar frontend y backend desde Git Bash con un solo comando y documentar el flujo.

**Alcance:** scripts separados de inicio y reinicio; compilación de shared y API; restauración del enlace workspace si falta; cierre de procesos de desarrollo solo en modo reinicio.

**Aceptación:** instrucciones indican usar el checkout principal y Git Bash; `Ctrl+C` detiene ambos procesos; no hace falta abrir la terminal como administrador.

**Archivos:** `scripts/iniciar-agenda.sh`, `scripts/reiniciar-agenda.sh`, `scripts/INSTRUCCIONES-REINICIO.md`.

## Verificación ejecutada en `feature/fixes-ui`

- Pruebas unitarias API: 7 suites, 39 pruebas aprobadas.
- Pruebas de integración API: 6 suites, 27 pruebas aprobadas, incluida la validación del máximo de 31 días.
- Build de API y web: aprobado con npm configurado para ejecutar scripts mediante `cmd.exe` en Windows.
- La aplicación no se inició durante esta verificación.
