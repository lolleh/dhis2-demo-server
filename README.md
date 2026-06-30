# Interoperability Bridge

> Developed by [vlolleh](https://github.com/lolleh) — DHIS2-OpenMRS bi-directional data synchronization bridge with a DHIS2 custom app dashboard.

A full-stack interoperability solution for synchronizing data between **DHIS2** and **OpenMRS**. Includes a backend bridge service (Node.js/Express + SQLite) and a DHIS2 custom app (React) for managing mappings, running sync jobs, and monitoring activity.

## Quick Start

### 1. Install Docker

- **Windows / macOS**: Install [Docker Desktop](https://docs.docker.com/desktop/)
- **Linux**: Install Docker Engine & Docker Compose
- **Windows (alternative)**: Install [WSL 2](https://learn.microsoft.com/en-us/windows/wsl/install) + Docker Desktop with WSL 2 backend

> On Windows, make sure the project drive (e.g. `C:\`) is shared in Docker Desktop → Settings → Resources → File Sharing.

### 2. Start everything

```bash
docker compose up -d
```

This starts DHIS2 (port 8091), the bridge service (port 4000), PostgreSQL, and the app dev server (port 3000).

> First run downloads a ~200MB Sierra Leone demo database — this takes a few minutes.

### 3. Access the app

| Service | URL | Description |
|---------|-----|-------------|
| DHIS2 | http://localhost:8091 | Log in: `admin` / `district` |
| Custom App | http://localhost:3000 | Dev server with hot-reload |
| Bridge API | http://localhost:4000 | Backend API |

Open DHIS2 at **http://localhost:8091** and find **Interoperability Bridge** in the Apps menu.

## API Endpoints

```bash
# Check health
curl http://localhost:4000/api/status/health

# List mappings
curl http://localhost:4000/api/mappings

# Run sync
curl -X POST http://localhost:4000/api/sync/run/1

# View logs
curl http://localhost:4000/api/sync/logs
```

## Development

### Bridge service

```bash
cd bridge
npm install
npm run dev     # http://localhost:4000
```

### DHIS2 custom app

```bash
cd my-app
npm install
npm start       # http://localhost:3000
npm run build   # production build
```

### Running without Docker

You can run the bridge and app locally while pointing to an external DHIS2 instance. Set these environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `DHIS2_URL` | `http://web:8080` | DHIS2 internal URL |
| `DHIS2_USERNAME` | `admin` | DHIS2 API user |
| `DHIS2_PASSWORD` | `district` | DHIS2 API password |
| `OPENMRS_URL` | `http://openmrs:8080/openmrs` | OpenMRS internal URL |
| `OPENMRS_USERNAME` | `admin` | OpenMRS API user |
| `OPENMRS_PASSWORD` | `Admin123` | OpenMRS API password |

## Tech Stack

- **Frontend**: React 18, @dhis2/ui, @dhis2/app-runtime, Vite
- **Backend**: Node.js, Express, better-sqlite3
- **Data**: DHIS2 REST API, OpenMRS REST API
- **Infra**: Docker, PostgreSQL 16 + PostGIS
