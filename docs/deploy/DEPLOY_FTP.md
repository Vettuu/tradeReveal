# Deploy FTP (Laravel + Vite)

Questa guida copre il deploy di questo progetto su hosting FTP (es. Aruba), pubblicando:
- `backend` Laravel in `backend/` remoto
- `frontend` Vite statico nella root remota

Lo script reale da usare e `scripts/deploy_ftp.sh`.

## 1) Prerequisiti locali

Installa i tool necessari:

```bash
sudo apt-get update
sudo apt-get install -y lftp rsync
```

Verifica di avere anche `composer`, `node` e `npm` disponibili.

## 2) Configurazione ENV

### Deploy FTP

```bash
cp .env.deploy.example .env.deploy
```

Compila `.env.deploy`:

```env
FTP_HOST=ftp.tuodominio.it
FTP_USER=tuo_utente_ftp
FTP_PASS=tua_password_ftp
FTP_REMOTE_DIR=/public_html
FTP_SSL_ALLOW=false
```

### Backend production (DB remoto)

```bash
cp backend/.env.production.example backend/.env.production
```

Compila almeno queste variabili:

```env
APP_ENV=production
APP_DEBUG=false
APP_URL=https://api.tuodominio.it

DB_CONNECTION=mysql
DB_HOST=sqlXXX.aruba.it
DB_PORT=3306
DB_DATABASE=nome_db
DB_USERNAME=utente_db
DB_PASSWORD=password_db
```

Note:
- Questo setup e pensato per **non usare DB locale in production**.
- Genera una `APP_KEY` valida prima del deploy (`php artisan key:generate`).

### Frontend production

```bash
cp frontend/.env.production.example frontend/.env.production
```

Compila almeno:

```env
VITE_APP_NAME=TradeReveal
VITE_APP_ENV=production
VITE_API_BASE_URL=https://api.tuodominio.it/api
```

## 3) Esecuzione deploy

Deploy completo:

```bash
bash scripts/deploy_ftp.sh
```

Anteprima senza upload:

```bash
bash scripts/deploy_ftp.sh --dry-run
```

Usare build gia presente in `dist/`:

```bash
bash scripts/deploy_ftp.sh --skip-build
```

## 4) Cosa fa lo script

1. Copia `backend/` in `dist/backend`.
2. Esegue `composer install --no-dev` dentro `dist/backend`.
3. Copia `backend/.env.production` in `dist/backend/.env`.
4. Esegue `npm run build` in `frontend/`.
5. Copia output in `dist/frontend`.
6. Upload FTP:
   - `dist/backend` -> `${FTP_REMOTE_DIR}/backend`
   - `dist/frontend` -> `${FTP_REMOTE_DIR}`

## 5) Post deploy

- Verifica che il dominio punti alla cartella FTP corretta (`FTP_REMOTE_DIR`).
- Verifica che `storage/` Laravel sia scrivibile.
- Se cambi i file `.env.production`, riesegui deploy.
- Se serve, esegui migrazioni puntando al DB remoto:

```bash
cd backend
php artisan migrate --force --env=production
```

## Riferimenti

- Esempio storico di script: `docs/deploy/.example deploy_ftp`
- Script attuale usato dal progetto: `scripts/deploy_ftp.sh`
