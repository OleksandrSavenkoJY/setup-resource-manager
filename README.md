# Setup Resource Manager

Inventory of test setups: devices, connections, power, network interfaces, photos, office map and generated schemas.

## Tech stack
- Backend: FastAPI + SQLAlchemy
- Database: PostgreSQL 16
- Frontend: Next.js (browser talks only to the same-origin `/api` proxy)
- Deployment: Docker Compose

## Features
- Setups with devices, connections (with cable type), chambers, power sources ("Powered from", UPS, auto-counted wall outlets)
- Network interfaces (name, type, IP, MAC) and a generated network diagram
- Generated schema (SVG / draw.io) with zoom, setup photo, export of any selection of setups (Excel data, schema PNG and draw.io, photo), AI prompt
- Office map with setup markers
- Tags, and a Free / In use by ... until ... status per setup (set by the admin on the details page)
- Top navigation, sortable/searchable list (state kept in the URL), row actions and bulk actions (reserve, release, tags, delete, export), toasts with Undo, unsaved-changes warning and draft for new setups
- Trash for deleted setups and automatic database backups
- Login with roles: `admin` (create/edit/delete) and `guest` (read-only)

## Deploy

Requirements: Docker with Compose v2.

```bash
git clone https://github.com/OleksandrSavenkoJY/setup-resource-manager.git
cd setup-resource-manager
cp .env.example .env      # adjust passwords and DATABASE_URL if needed
docker compose up -d --build
```

Services:
- Frontend: http://localhost:8080
- Backend API: http://localhost:8000 (`/health`)
- PostgreSQL: localhost:5433

### Configuration (`.env`)
`.env` is not stored in Git (it is in `.gitignore`); create it from the template:

```bash
cp .env.example .env
```

| Variable | Meaning |
|---|---|
| `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` | Database name and credentials created on first start |
| `DATABASE_URL` | Backend connection string, `postgresql+psycopg2://USER:PASSWORD@postgres:5432/DB`; user, password and DB must match the `POSTGRES_*` values |
| `APP_SECRET_KEY` | Encrypts access point passwords in the database. Use a long random value (`openssl rand -hex 32`) and keep it: without the key those passwords cannot be read back. Plain-text values saved earlier are encrypted on the next start. |
| `BACKEND_HOST`, `BACKEND_PORT` | Where the backend listens inside the container (keep `0.0.0.0` / `8000`) |
| `NEXT_PUBLIC_API_URL` | Not used by the browser (it goes through the `/api` proxy); can be left as is |

Change `POSTGRES_PASSWORD` (and the same password inside `DATABASE_URL`) before first start.
Postgres only reads these values when the volume is created; to change the password later run `docker compose down -v` (this deletes the data) or change it inside the database.

### First run
1. Open the frontend; it asks you to create the `admin` password.
2. The first visitor sets this password, so do it right after deployment.
3. Default read-only account: `guest` / `guest`. Change or remove it if the app is exposed.

### Update
```bash
git pull
docker compose up -d --build
```
Data stays in the `postgres_data` volume. New columns are added automatically on startup.
Stored schemas are regenerated automatically when the layout version changes.

### Optional environment variables (backend)
- `SESSION_TTL_HOURS` — session lifetime, default 12.
- `COOKIE_SECURE=true` — set when served over HTTPS.
- `CORS_ORIGINS` — comma-separated allowed origins.

### Backups
The `backup` service dumps the database to `./backups/srm-<date>.sql.gz` right after start and then every `BACKUP_INTERVAL_HOURS` (default 24 h); dumps older than `BACKUP_KEEP_DAYS` (default 14) are deleted. Copy that folder off the server from time to time: a backup on the same disk does not survive a disk failure.

Restore (replaces the current data):
```bash
scripts/restore.sh backups/srm-20260101-030000.sql.gz
```
A manual backup: `docker compose exec backup /scripts/backup.sh`.
Access point passwords stay encrypted in the dump; keep `APP_SECRET_KEY` separately, a backup is unreadable for them without it.

### Trash
Deleting a setup moves it to the trash (admin: **Trash** button on the home page). It can be restored with devices, connections, photo and access point links, or removed for good. Entries are purged after `TRASH_DAYS` (default 30). A restored setup gets a new id.

### Reset everything
```bash
docker compose down -v    # also deletes the database volume
```

## Tests
```bash
cd backend && pip install -r requirements-dev.txt && pytest
```
The tests use a temporary SQLite database.

## Notes
- After first deployment on a fresh database, default device types are seeded; on an existing database add new types (e.g. "Antenna", "Attenuator") in the type manager.

