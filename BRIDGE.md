# Interoperability Bridge

A bi-directional data synchronization bridge between DHIS2 and OpenMRS, with a DHIS2 custom app dashboard for managing mappings and monitoring syncs.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                  DHIS2 Custom App                    │
│         http://localhost:3000 (dev server)           │
│   Dashboard │ Mappings │ Sync Logs │ Manual Sync     │
└─────────────────────────┬───────────────────────────┘
                          │ HTTP (CORS)
┌─────────────────────────▼───────────────────────────┐
│                 Bridge Service                        │
│              http://localhost:4000                    │
│  ┌──────────┐ ┌───────────┐ ┌──────────────────┐    │
│  │ Mapping  │ │ Sync Job  │ │ DHIS2 / OpenMRS  │    │
│  │ Engine   │ │ Scheduler │ │ API Clients      │    │
│  └──────────┘ └───────────┘ └──────────────────┘    │
└──────┬───────────────────────────────────┬───────────┘
       │                                   │
┌──────▼──────────┐              ┌─────────▼──────────┐
│     DHIS2       │              │      OpenMRS        │
│  http://:8091   │              │  (configurable)      │
└─────────────────┘              └────────────────────┘
```

## Prerequisites

- Docker & Docker Compose
- DHIS2 instance running (this project's docker-compose)
- (Optional) OpenMRS instance for bi-directional sync

## Quick Start

```bash
# Start all services
docker compose up -d

# Or start the bridge and app specifically
docker compose up -d bridge my-app
```

## Services

| Service | URL | Port |
|---------|-----|------|
| DHIS2 | http://localhost:8091 | 8091 |
| Bridge API | http://localhost:4000 | 4000 |
| Dev Server (app) | http://localhost:3000 | 3000 |

## Accessing the Custom App

### Via DHIS2 (production mode)

Once deployed, the app is available inside DHIS2 at:

```
http://localhost:8091/api/apps/interop-bridge/index.html
```

Find it in the Apps menu inside DHIS2.

### Via Dev Server (development mode)

```
http://localhost:3000
```

The dev server automatically proxies API requests to the DHIS2 instance on port 8091.

## Bridge API Endpoints

### System Status

```bash
# Health check for all systems
curl http://localhost:4000/api/status/health

# DHIS2 system info
curl http://localhost:4000/api/status/dhis2

# OpenMRS system info
curl http://localhost:4000/api/status/openmrs
```

### Data Mappings

```bash
# List all mappings
curl http://localhost:4000/api/mappings

# Create a mapping
curl -X POST http://localhost:4000/api/mappings \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Patients to TEI",
    "direction": "omrs2dhis2",
    "source_resource": "patient",
    "target_resource": "trackedEntityInstance",
    "schedule": "0 2 * * *"
  }'

# Update a mapping
curl -X PUT http://localhost:4000/api/mappings/1 \
  -H "Content-Type: application/json" \
  -d '{"enabled": true}'

# Delete a mapping
curl -X DELETE http://localhost:4000/api/mappings/1
```

### Sync Operations

```bash
# Run a sync manually
curl -X POST http://localhost:4000/api/sync/run/1

# View sync logs
curl http://localhost:4000/api/sync/logs
```

## Configuration

### Environment Variables

The bridge service accepts these environment variables (set in `docker-compose.yml`):

| Variable | Default | Description |
|----------|---------|-------------|
| `DHIS2_URL` | `http://web:8080` | DHIS2 internal URL |
| `DHIS2_USERNAME` | `admin` | DHIS2 API user |
| `DHIS2_PASSWORD` | `district` | DHIS2 API password |
| `OPENMRS_URL` | `http://openmrs:8080/openmrs` | OpenMRS internal URL |
| `OPENMRS_USERNAME` | `admin` | OpenMRS API user |
| `OPENMRS_PASSWORD` | `Admin123` | OpenMRS API password |

### Custom App Settings

The DHIS2 custom app reads the bridge URL from the `REACT_APP_BRIDGE_URL` environment variable (defaults to `http://localhost:4000`).

## Development

### Bridge Service

```bash
cd bridge
npm install
npm run dev
```

### DHIS2 Custom App

```bash
cd my-app
npm install
npm start
```
