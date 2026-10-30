#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

if [[ ! -e "$PROJECT_ROOT/node_modules/@agenda-app/shared" ]]; then
  echo "No está enlazado el paquete compartido. Instalando los workspaces..."
  npm install
fi

MODE="${1:-restart}"
if [[ "$MODE" != "start" && "$MODE" != "restart" ]]; then
  echo "Uso: bash scripts/reiniciar-agenda.sh [start|restart]" >&2
  exit 2
fi
if [[ "$MODE" == "restart" ]]; then
  echo "Cerrando servidores de desarrollo anteriores en los puertos 3000 y 3001..."
  powershell.exe -NoProfile -Command '$ports = @(3000, 3001); $ids = Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object { $ports -contains $_.LocalPort } | Select-Object -ExpandProperty OwningProcess -Unique; foreach ($id in $ids) { $process = Get-CimInstance Win32_Process -Filter "ProcessId=$id" -ErrorAction SilentlyContinue; if ($process -and $process.Name -eq "node.exe") { Stop-Process -Id $id -Force -ErrorAction SilentlyContinue } }'
fi

echo "Compilando el paquete compartido..."
node node_modules/typescript/bin/tsc -p packages/shared/tsconfig.json

echo "Compilando la API..."
(
  cd "$PROJECT_ROOT/apps/api"
  node ../../node_modules/@nestjs/cli/bin/nest.js build
)

echo "Iniciando API y web. Presioná Ctrl+C para detener ambos."
(
  cd "$PROJECT_ROOT/apps/api"
  NODE_ENV=development node --env-file=../../.env dist/main.js
) &
API_PID=$!

(
  cd "$PROJECT_ROOT"

if [[ ! -e "$PROJECT_ROOT/node_modules/@agenda-app/shared" ]]; then
  echo "No está enlazado el paquete compartido. Instalando los workspaces..."
  npm install
fi
  node node_modules/next/dist/bin/next dev apps/web
) &
WEB_PID=$!

cleanup() {
  kill "$API_PID" "$WEB_PID" 2>/dev/null || true
  wait "$API_PID" "$WEB_PID" 2>/dev/null || true
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

if wait -n "$API_PID" "$WEB_PID"; then
  status=0
else
  status=$?
fi
exit "$status"
