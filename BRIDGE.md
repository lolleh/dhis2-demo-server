# Interoperability Bridge

> Developed by [vlolleh](https://github.com/lolleh) — DHIS2-OpenMRS bi-directional data synchronization bridge with a DHIS2 custom app dashboard.

## Quick Start (Windows)

1. **Install Docker Desktop** — [download here](https://docs.docker.com/desktop/)
2. **Open PowerShell** or **Command Prompt** in this folder
3. Run:

```powershell
docker compose up -d
```

4. Open **http://localhost:8091** — log in with `admin` / `district`
5. Open **http://localhost:3000** for the custom app dev server

> First run downloads a ~200MB database — wait a few minutes for DHIS2 to start.

## Services

| Service | URL | Port |
|---------|-----|------|
| DHIS2 | http://localhost:8091 | 8091 |
| Bridge API | http://localhost:4000 | 4000 |
| Dev Server (app) | http://localhost:3000 | 3000 |

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
│  │ Mapping  │ │ Sync Job  │ │ DHIS2 / OpenMRS  │    │
│  │ Engine   │ │ Scheduler │ │ API Clients      │    │
│  └──────────┘ └───────────┘ └──────────────────┘    │
└──────┬────────────────────────────────────┬───────────┘
       │                                    │
┌──────▼──────────┐              ┌─────────▼──────────┐
│     DHIS2       │              │      OpenMRS        │
│  http://:8091   │              │  (configurable)      │
└─────────────────┘              └────────────────────┘
```

## API Endpoints

### System Status
```bash
curl http://localhost:4000/api/status/health
curl http://localhost:4000/api/status/dhis2
curl http://localhost:4000/api/status/openmrs
```

### Data Mappings
```bash
# List all mappings
curl http://localhost:4000/api/mappings

# Create a mapping
curl -X POST http://localhost:4000/api/mappings \
  -H "Content-Type: application/json" \
  -d '{"name":"Patients to TEI","direction":"omrs2dhis2","source_resource":"patient","target_resource":"trackedEntityInstance"}'

# Update / Delete
curl -X PUT http://localhost:4000/api/mappings/1 -d '{"enabled":true}'
curl -X DELETE http://localhost:4000/api/mappings/1
```

### Sync Operations
```bash
curl -X POST http://localhost:4000/api/sync/run/1
curl http://localhost:4000/api/sync/logs
```

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `DHIS2_URL` | `http://web:8080` | DHIS2 internal URL |
| `DHIS2_USERNAME` | `admin` | DHIS2 API user |
| `DHIS2_PASSWORD` | `district` | DHIS2 API password |
| `OPENMRS_URL` | `http://openmrs:8080/openmrs` | OpenMRS internal URL |
| `OPENMRS_USERNAME` | `admin` | OpenMRS API user |
| `OPENMRS_PASSWORD` | `Admin123` | OpenMRS API password |
| `COMMCARE_DOMAIN` | — | CommCare HQ domain (e.g. `myproject.commcarehq.org`) |
| `COMMCARE_API_KEY` | — | CommCare API key |
| `COMMCARE_USERNAME` | — | CommCare username |
| `COMMCARE_APP_ID` | — | CommCare application ID (optional) |

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
