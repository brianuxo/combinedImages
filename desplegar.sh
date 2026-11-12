#!/usr/bin/env bash
# Copia el proyecto a la instancia, lo recompila y lo reinicia.
#
#   ./desplegar.sh
#
# Variables opcionales: HOST, KEY, REMOTE, DOMINIO
#
# Los valores concretos (servidor, clave SSH y dominio) no van en el repo:
# se leen del entorno o del archivo local .despliegue.local (fuera de git):
#
#   HOST=usuario@servidor KEY=ruta/de/la/key DOMINIO=dominio ./desplegar.sh
set -euo pipefail

cd "$(dirname "$0")"

if [[ -f .despliegue.local ]]; then
  source .despliegue.local
fi

HOST="${HOST:?Falta HOST: defínelo en el entorno o en .despliegue.local}"
KEY="${KEY:?Falta KEY: defínelo en el entorno o en .despliegue.local}"
REMOTE="${REMOTE:-/home/ubuntu/combined-images}"
DOMINIO="${DOMINIO:?Falta DOMINIO: defínelo en el entorno o en .despliegue.local}"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo "Empaquetando el proyecto..."
tar -czf "$TMP/app.tar.gz" \
  --exclude=node_modules --exclude=dist --exclude=.git --exclude=data \
  --exclude=test-results --exclude=playwright-report .

echo "Subiendo a $HOST..."
scp -q -i "$KEY" "$TMP/app.tar.gz" "$HOST:/tmp/combined-images.tar.gz"

echo "Instalando en $REMOTE..."
ssh -i "$KEY" "$HOST" \
  "mkdir -p '$REMOTE' && tar -xzf /tmp/combined-images.tar.gz -C '$REMOTE' && rm /tmp/combined-images.tar.gz && ALLOWED_HOSTS='$DOMINIO' bash '$REMOTE/deploy/instalar.sh'"

echo "Listo: https://$DOMINIO:8445/"
