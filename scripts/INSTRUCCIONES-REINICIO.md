# Iniciar o reiniciar AgendaApp en Windows

Usá el checkout principal de `agenda-app` en `Documentos/Desarrollo/agenda-app`. No uses un worktree.

1. Abrí Git Bash.
2. Entrá al repositorio principal:

   ```bash
   cd "/c/Users/axels/OneDrive/Documentos/Desarrollo/agenda-app"
   ```

3. Elegí una opción:

   **Iniciar** sin cerrar procesos que ya estén corriendo:

   ```bash
   bash scripts/iniciar-agenda.sh
   ```

   **Reiniciar**: cierra servidores Node que escuchen en los puertos 3000 y 3001, recompila y vuelve a iniciar todo:

   ```bash
   bash scripts/reiniciar-agenda.sh
   ```

Si falta el enlace del workspace `@agenda-app/shared`, el script ejecuta `npm install` para restaurarlo. Después compila `packages/shared` y la API antes de iniciar la API y la web. Los registros aparecen en la misma terminal. Presioná `Ctrl+C` para detener ambos servicios.

La API queda en `http://localhost:3001` y la web en `http://localhost:3000`.

Usá Git Bash, no PowerShell: el script usa sintaxis Bash como `&&`, `&` y `NODE_ENV=...`. No abras Git Bash como administrador; alcanza con los permisos normales de tu usuario.
