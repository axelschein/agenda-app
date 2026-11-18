#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"

# npm puede heredar PowerShell como intérprete y fallar con scripts que usan `&&`.
case "${OSTYPE:-}" in
  msys*|cygwin*|win32*)
    export npm_config_script_shell="${COMSPEC:-cmd.exe}"
    ;;
esac

exec bash "$SCRIPT_DIR/reiniciar-agenda.sh" start
