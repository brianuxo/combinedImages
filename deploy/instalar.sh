#!/usr/bin/env bash
# Instala, compila y reinicia la app. Se ejecuta EN el servidor.
set -euo pipefail

DIR="$(cd "$(dirname "$0")/.." && pwd)"
SERVICE="${SERVICE:-combined-images}"
ALLOWED_HOSTS="${ALLOWED_HOSTS:-}"
PORT="${PORT:-4199}"

cd "$DIR"

# Reinstalar solo cuando cambia el lockfile: `npm ci` tarda y borra
# node_modules, así que no conviene hacerlo en cada despliegue.
HASH="$(sha256sum package-lock.json | cut -d' ' -f1)"
if [ "$(cat node_modules/.lock-hash 2>/dev/null || true)" != "$HASH" ]; then
  echo "Instalando dependencias..."
  npm ci --no-audit --no-fund
  echo "$HASH" > node_modules/.lock-hash
fi

echo "Compilando..."
# VITE_SERVER_PROXY=1: el build pide las imágenes y el JSON por `/proxy/*`
# y `/media` en lugar de ir directo a los hosts originales.
VITE_SERVER_PROXY=1 npm run build

# Datos de sincronización: no viajan en el tar (se excluye `data/`), así que
# se conservan entre despliegues. La conexión se hace con la frase de cifrado;
# el token fijo solo se conserva para automatizar con curl y para dispositivos
# vinculados antes del cambio.
DATA_DIR="$DIR/data"
mkdir -p "$DATA_DIR"
chmod 700 "$DATA_DIR"
if [ ! -s "$DATA_DIR/token" ]; then
  node -e "process.stdout.write(require('node:crypto').randomBytes(24).toString('hex') + '\n')" > "$DATA_DIR/token"
  chmod 600 "$DATA_DIR/token"
fi
chmod 600 "$DATA_DIR/token" 2>/dev/null || true
chmod 600 "$DATA_DIR"/sync.json "$DATA_DIR"/sync.json.bak 2>/dev/null || true
chmod 600 "$DATA_DIR"/auth 2>/dev/null || true

echo "Reiniciando el servicio..."
sudo systemctl restart "$SERVICE"
sleep 2
systemctl is-active "$SERVICE"
curl -s -o /dev/null -w "HTTP %{http_code}\n" "http://127.0.0.1:$PORT/"

if [ -n "$ALLOWED_HOSTS" ]; then
  echo "Dominios permitidos en el servicio: $ALLOWED_HOSTS"
fi
