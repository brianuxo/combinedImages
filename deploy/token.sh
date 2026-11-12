#!/usr/bin/env bash
# Muestra el token de sincronización de la instancia.
#
#   ssh ... "bash ~/combined-images/deploy/token.sh"
set -euo pipefail

DIR="$(cd "$(dirname "$0")/.." && pwd)"
FILE="$DIR/data/token"

if [ ! -s "$FILE" ]; then
  echo "Todavía no hay token: se crea en el primer despliegue." >&2
  exit 1
fi

cat "$FILE"
