#!/usr/bin/env bash
# ---------------------------------------------------------------
#  Combined - arranque desde la raiz del proyecto
#  Uso:  ./iniciar.sh            -> vite en http://localhost:5173
#        ./iniciar.sh --host     -> cualquier argumento extra se
#                                   reenvia a vite
# ---------------------------------------------------------------
set -uo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$RAIZ" || exit 1

LOG="$(mktemp -t combined-dev.XXXXXX)"
VITE_PID=""
VIGILANTE_PID=""

# Convierte un PID de MSYS (el que da $!) en su PID real de Windows.
# Sin esto, taskkill no encuentra el proceso y el servidor se queda huerfano.
win_pid() {
  ps -W 2>/dev/null | awk -v p="$1" '$1 == p { print $4; exit }'
}

limpiar() {
  if [ -n "$VIGILANTE_PID" ]; then
    kill "$VIGILANTE_PID" 2>/dev/null
  fi
  if [ -n "$VITE_PID" ]; then
    local wpid
    wpid="$(win_pid "$VITE_PID")"
    if [ -n "$wpid" ]; then
      # /T mata tambien los hijos (cmd.exe -> node vite).
      taskkill //PID "$wpid" //T //F >/dev/null 2>&1
    fi
    kill "$VITE_PID" 2>/dev/null
  fi
  rm -f "$LOG" 2>/dev/null
}

# Al salir (Ctrl+C, error o cierre) la consola se queda abierta
# para poder leer el log antes de cerrarla.
al_salir() {
  echo
  echo "----------------------------------------"
  echo " Servidor detenido."
  [ -t 0 ] && read -r -p " Pulsa Enter para cerrar la consola... " _
  echo
}
trap al_salir EXIT
trap 'limpiar; exit 130' INT TERM

echo "========================================"
echo "  Combined  -  Vite + React"
echo "  Raiz: $RAIZ"
echo "========================================"
echo

if ! command -v node >/dev/null 2>&1; then
  echo "ERROR: Node.js no esta en el PATH."
  exit 1
fi
if ! command -v npm >/dev/null 2>&1; then
  echo "ERROR: npm no esta en el PATH."
  exit 1
fi
echo " Node $(node -v)  |  npm $(npm -v)"
echo

if [ ! -d node_modules ]; then
  echo " node_modules no existe -> npm install (solo la primera vez)..."
  echo
  npm install || { echo; echo "ERROR: fallo npm install."; exit 1; }
  echo
fi

# Quita los codigos de color ANSI de la salida de vite para poder leerla.
sin_ansi() {
  tr -d '\r\033' < "$LOG" 2>/dev/null | sed 's/\[[0-9;?]*[a-zA-Z]//g'
}

# El vigilante espera a que vite imprima su URL local y abre el navegador.
vigilante_navegador() {
  local url="" linea i
  for i in $(seq 1 90); do
    linea="$(sin_ansi | grep -E 'Local:' | head -n 1)"
    if [ -n "$linea" ]; then
      url="$(printf '%s' "$linea" | grep -oE 'http://[A-Za-z0-9._-]+(:[0-9]+)?/' | head -n 1)"
      [ -n "$url" ] && break
    fi
    sleep 1
  done
  if [ -z "$url" ]; then
    url="http://localhost:5173/"
  fi
  echo " Abriendo el navegador en $url"
  # "//c" y no "/c": Git Bash convierte "/c" en una ruta de Windows y cmd.exe
  # no ejecutaria el comando. Con "//" MSYS lo devuelve a "/c".
  cmd.exe //c start "" "$url" >/dev/null 2>&1 || explorer.exe "$url" >/dev/null 2>&1
}

vigilante_navegador &
VIGILANTE_PID=$!

: > "$LOG"
npm run dev -- "$@" > >(tee "$LOG") 2>&1 &
VITE_PID=$!

wait "$VITE_PID"
CODE=$?
limpiar
exit $CODE
