#!/usr/bin/env bash
set -euo pipefail

# Deploy backend Laravel + frontend Vite static build su hosting FTP.
# Requisiti:
# - lftp, composer, npm installati localmente
# - .env.deploy (da .env.deploy.example) con credenziali FTP
# - backend/.env.production con valori reali di produzione
# - frontend/.env.production opzionale per build frontend

ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)
DIST_DIR="$ROOT_DIR/dist"
BACKEND_SRC="$ROOT_DIR/backend"
FRONTEND_SRC="$ROOT_DIR/frontend"
BACKEND_DIST="$DIST_DIR/backend"
FRONTEND_DIST="$DIST_DIR/frontend"
ENV_FILE="$ROOT_DIR/.env.deploy"
SCRIPT_ENV_FILE="$(cd "$(dirname "$0")" && pwd)/.env.deploy"

DRY_RUN=false
SKIP_BUILD=false

for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=true ;;
    --skip-build) SKIP_BUILD=true ;;
    *) echo "Opzione sconosciuta: $arg" >&2; exit 1 ;;
  esac
done

if [[ -f "$SCRIPT_ENV_FILE" ]]; then
  ENV_FILE="$SCRIPT_ENV_FILE"
fi

if [[ ! -f "$ENV_FILE" ]]; then
  cat >&2 <<EOF
ERRORE: $ENV_FILE non trovato.
Esegui:
  cp .env.deploy.example .env.deploy
oppure crea:
  scripts/.env.deploy
e compila FTP_HOST, FTP_USER, FTP_PASS, FTP_REMOTE_DIR.
EOF
  exit 1
fi

# shellcheck disable=SC1090
source "$ENV_FILE"

: "${FTP_HOST:?FTP_HOST mancante in .env.deploy}"
: "${FTP_USER:?FTP_USER mancante in .env.deploy}"
: "${FTP_PASS:?FTP_PASS mancante in .env.deploy}"
: "${FTP_REMOTE_DIR:?FTP_REMOTE_DIR mancante in .env.deploy}"
FTP_SSL_ALLOW=${FTP_SSL_ALLOW:-false}

need_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "ERRORE: comando richiesto non trovato: $1" >&2
    exit 1
  fi
}

need_cmd lftp
need_cmd composer
need_cmd npm

copy_backend_source() {
  rm -rf "$BACKEND_DIST"
  mkdir -p "$BACKEND_DIST"

  if command -v rsync >/dev/null 2>&1; then
    rsync -a --delete \
      --exclude=".git" \
      --exclude=".github" \
      --exclude="node_modules" \
      --exclude="vendor" \
      --exclude=".env" \
      --exclude=".env.production" \
      "$BACKEND_SRC/" "$BACKEND_DIST/"
  else
    cp -a "$BACKEND_SRC/." "$BACKEND_DIST/"
    rm -rf \
      "$BACKEND_DIST/.git" \
      "$BACKEND_DIST/.github" \
      "$BACKEND_DIST/node_modules" \
      "$BACKEND_DIST/vendor" \
      "$BACKEND_DIST/.env" \
      "$BACKEND_DIST/.env.production" || true
  fi
}

build_backend() {
  echo "[1/4] Preparo dist backend Laravel"
  copy_backend_source

  pushd "$BACKEND_DIST" >/dev/null
  composer install --no-dev --optimize-autoloader --prefer-dist --no-interaction

  rm -rf storage/logs/* storage/framework/{cache,sessions,views}/* 2>/dev/null || true
  mkdir -p storage/logs storage/framework/{cache,sessions,views}

  if [[ -f "$BACKEND_SRC/.env.production" ]]; then
    cp "$BACKEND_SRC/.env.production" .env
  else
    echo "ATTENZIONE: backend/.env.production non trovato. Carica .env manualmente sul server." >&2
  fi
  popd >/dev/null
}

build_frontend() {
  echo "[2/4] Build frontend Vite"
  pushd "$FRONTEND_SRC" >/dev/null
  if [[ -f package-lock.json ]]; then
    npm ci
  else
    npm install
  fi
  npm run build
  popd >/dev/null

  rm -rf "$FRONTEND_DIST"
  mkdir -p "$FRONTEND_DIST"

  if [[ ! -d "$FRONTEND_SRC/dist" ]]; then
    echo "ERRORE: build frontend non ha prodotto la cartella dist/" >&2
    exit 1
  fi

  cp -a "$FRONTEND_SRC/dist/." "$FRONTEND_DIST/"

  # Vite potrebbe non includere dotfiles da public in tutti gli ambienti:
  # copiamo esplicitamente .htaccess se presente.
  if [[ -f "$FRONTEND_SRC/public/.htaccess" ]]; then
    cp "$FRONTEND_SRC/public/.htaccess" "$FRONTEND_DIST/.htaccess"
  fi
}

if [[ "$SKIP_BUILD" == "false" ]]; then
  rm -rf "$DIST_DIR"
  mkdir -p "$DIST_DIR"

  build_backend
  build_frontend
else
  echo "Skip build attivo: uso la cartella dist/ esistente."
fi

if [[ ! -d "$BACKEND_DIST" || ! -d "$FRONTEND_DIST" ]]; then
  echo "ERRORE: dist/backend o dist/frontend non trovate. Esegui senza --skip-build." >&2
  exit 1
fi

DRY_ARG=""
if [[ "$DRY_RUN" == "true" ]]; then
  DRY_ARG="--dry-run"
  echo "DRY RUN attivo: nessun file verra caricato."
fi

echo "[3/4] Upload via FTP su $FTP_HOST"

lftp -u "$FTP_USER","$FTP_PASS" "$FTP_HOST" <<LFTP_CMDS
set ftp:ssl-allow ${FTP_SSL_ALLOW}
set net:max-retries 2
set net:timeout 25
set mirror:parallel-transfer-count 4
set mirror:use-pget-n 4
set ftp:prefer-epsv no

mkdir -p ${FTP_REMOTE_DIR}/backend
mirror -R --only-newer --delete ${DRY_ARG} "${BACKEND_DIST}" "${FTP_REMOTE_DIR}/backend"

mirror -R --only-newer --delete \
  --exclude-glob backend \
  --exclude-glob "backend/*" \
  --exclude-glob "cgi-bin" \
  --exclude-glob "cgi-bin/*" \
  ${DRY_ARG} "${FRONTEND_DIST}" "${FTP_REMOTE_DIR}"

quit
LFTP_CMDS

echo "[4/4] Deploy completato su ${FTP_REMOTE_DIR}"
