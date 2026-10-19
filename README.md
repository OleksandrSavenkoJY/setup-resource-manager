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
- Generated schema (SVG / draw.io) with zoom, setup photo, Excel/PNG export, AI prompt
- Office map with setup markers
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
- Frontend: http://localhost:3001
- Backend API: http://localhost:8000 (`/health`)
- PostgreSQL: localhost:5433

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

### Reset everything
```bash
docker compose down -v    # also deletes the database volume
```

## Notes
- After first deployment on a fresh database, default device types are seeded; on an existing database add new types (e.g. "Antenna", "Attenuator") in the type manager.
- There is no login rate limiting; do not expose the app to the internet without a reverse proxy.
