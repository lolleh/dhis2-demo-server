# Interoperability Bridge

> Developed by [vlolleh](https://github.com/lolleh) — DHIS2-OpenMRS bi-directional data synchronization bridge with a DHIS2 custom app dashboard.

A full-stack interoperability solution for synchronizing patient and aggregate data between **DHIS2** and **OpenMRS**. Includes a backend bridge service (Node.js/Express + SQLite) and a DHIS2 custom app (React) for managing mappings, running sync jobs, and monitoring activity.

## Architecture

```
┌──────────────────────────────────────────────────────┐
│                  DHIS2 Custom App                     │
│    Dashboard │ Mappings │ Sync Logs │ Manual Sync     │
└──────────────────────────┬───────────────────────────┘
                           │ HTTP (CORS)
┌──────────────────────────▼───────────────────────────┐
│                 Bridge Service                         │
│              http://localhost:4000                     │
│  ┌──────────┐ ┌───────────┐ ┌──────────────────┐    │
│  │ Mapping  │ │ Sync      │ │ DHIS2 / OpenMRS  │    │
│  │ Engine   │ │ Scheduler │ │ API Clients      │    │
│  └──────────┘ └───────────┘ └──────────────────┘    │
└──────┬────────────────────────────────────┬───────────┘
       │                                    │
┌──────▼──────────┐              ┌─────────▼──────────┐
│     DHIS2       │              │      OpenMRS        │
│  http://:8091   │              │  (configurable)      │
└─────────────────┘              └────────────────────┘
```

## Features

- **Dashboard** — System health (DHIS2/OpenMRS/Bridge), sync statistics (total runs, success rate, last sync), recent sync activity, Run All Mappings button
- **Data Mappings** — Create, edit, and delete mappings between source and target resources; search/filter bar; per-mapping "Run Sync" with confirmation spinner; delete confirmation dialog
- **Sync Logs** — Paginated log viewer with status filters (by mapping, by status), duration and timestamps
- **Bi-directional Sync** — OpenMRS → DHIS2 and DHIS2 → OpenMRS data flow support
- **Notifications** — Toast/snackbar feedback for all operations (success/error)
- **Persistent Storage** — SQLite-backed mapping store and sync history

## Quick Start

### Prerequisites

- Docker & Docker Compose
- DHIS2 instance (or use the included docker-compose)

### Start everything

```bash
docker compose up -d
```

This starts DHIS2 (port 8091), the bridge service (port 4000), PostgreSQL, and the app dev server (port 3000).

### Access the app

Open DHIS2 at **http://localhost:8091** and find **Interoperability Bridge** in the Apps menu.

Or access the dev server directly at **http://localhost:3000** for hot-reload development.

## Services

| Service | URL | Port |
|---------|-----|------|
| DHIS2 | http://localhost:8091 | 8091 |
| Bridge API | http://localhost:4000 | 4000 |
| Dev Server (app) | http://localhost:3000 | 3000 |

## Bridge API

### System Status

```bash
curl http://localhost:4000/api/status/health
curl http://localhost:4000/api/status/dhis2
curl http://localhost:4000/api/status/openmrs
```

### Data Mappings

```bash
# List
curl http://localhost:4000/api/mappings

# Create
curl -X POST http://localhost:4000/api/mappings \
  -H "Content-Type: application/json" \
  -d '{"name":"Patients to TEI","direction":"omrs2dhis2","source_resource":"patient","target_resource":"trackedEntityInstance"}'

# Update / Delete
curl -X PUT http://localhost:4000/api/mappings/1 -d '{"enabled":true}'
curl -X DELETE http://localhost:4000/api/mappings/1
```

### Sync

```bash
# Run sync
curl -X POST http://localhost:4000/api/sync/run/1

# View logs
curl http://localhost:4000/api/sync/logs
```

## Configuration

### Bridge service (docker-compose.yml)

| Variable | Default | Description |
|----------|---------|-------------|
| `DHIS2_URL` | `http://web:8080` | DHIS2 internal URL |
| `DHIS2_USERNAME` | `admin` | DHIS2 API user |
| `DHIS2_PASSWORD` | `district` | DHIS2 API password |
| `OPENMRS_URL` | `http://openmrs:8080/openmrs` | OpenMRS internal URL |
| `OPENMRS_USERNAME` | `admin` | OpenMRS API user |
| `OPENMRS_PASSWORD` | `Admin123` | OpenMRS API password |

### Custom app

The app reads the bridge URL from `REACT_APP_BRIDGE_URL` (defaults to `http://localhost:4000`).

## Development

### Bridge

```bash
cd bridge
npm install
npm run dev
```

### DHIS2 custom app

```bash
cd my-app
npm install
npm start          # dev server at :3000
npm run build      # production build → build/bundle/
```

## Tech Stack

- **Frontend**: React 18, @dhis2/ui, @dhis2/app-runtime, Vite
- **Backend**: Node.js, Express, better-sqlite3
- **Data**: DHIS2 REST API, OpenMRS REST API
- **Infra**: Docker, PostgreSQL 16 + PostGIS
