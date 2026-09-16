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
curl http://localhost:4000/api/status/db                 # OpenMRS SQL source status
curl http://localhost:4000/api/status/openmrs/capabilities
```

`/api/status/openmrs` returns the authenticated service user and their roles.
`/api/status/openmrs/capabilities` probes the live OpenMRS server and reports
`encounterSearch` (`true` = fast `/encounter?form=` path, `false` = visit-walker
fallback), `forms`, `concepts`, `patientSearch`, `visits`, `db` and roles.

### Remote re-mapping (external OpenMRS UUID resolution)
```bash
curl -X POST http://localhost:4000/api/remap \
  -H "Content-Type: application/json" \
  -d '{"remoteUrl":"https://openmrs.example.org/openmrs","username":"u","password":"p","mappings":[5],"dryRun":true}'
```
Supports `tls` (insecure/ca/cert/key), `overrides.formUuid` and
`overrides.concepts` (local UUID → remote UUID), and returns `matches`
candidates when a name is not found. Drop `dryRun` to persist.

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

All bridge settings are env vars; the reference template is `.env.example`.
`docker compose` loads `.env` automatically (gitignored).

| Variable | Default | Description |
|----------|---------|-------------|
| `DHIS2_URL` | `http://web:8080` | DHIS2 internal URL |
| `DHIS2_USERNAME` | `admin` | DHIS2 API user |
| `DHIS2_PASSWORD` | `district` | DHIS2 API password |
| `DHIS2_TLS_INSECURE` | `false` | Accept self-signed DHIS2 cert (https) |
| `DHIS2_TLS_CA_FILE` | — | Custom CA bundle path inside container |
| `OPENMRS_URL` | `http://openmrs:8080/openmrs` | OpenMRS REST URL (internal or external) |
| `OPENMRS_USERNAME` | `admin` | OpenMRS API user |
| `OPENMRS_PASSWORD` | `Admin123` | OpenMRS API password |
| `OPENMRS_TLS_INSECURE` | `false` | Accept self-signed OpenMRS cert (https) |
| `OPENMRS_TLS_CA_FILE` | — | Custom CA bundle path inside container |
| `OPENMRS_TLS_CERT_FILE` / `_KEY_FILE` | — | mTLS client cert/key pair |
| `OPENMRS_DB_HOST` | `openmrs-db` | Optional direct-MySQL source host |
| `OPENMRS_DB_PORT` | `3306` | ... port |
| `OPENMRS_DB_NAME` | `openmrs` | ... database |
| `OPENMRS_DB_USER` | `openmrs` | ... user |
| `OPENMRS_DB_PASSWORD` | `Admin123` | ... password |
| `COMMCARE_DOMAIN` | — | CommCare HQ domain (e.g. `myproject.commcarehq.org`) |
| `COMMCARE_API_KEY` | — | CommCare API key |
| `COMMCARE_USERNAME` | — | CommCare username |
| `COMMCARE_APP_ID` | — | CommCare application ID (optional) |

## Connecting to an external OpenMRS

1. Copy `.env.example` to `.env` and point `OPENMRS_URL*` at the external
   server (DNS name or the Docker host's LAN IP — never `localhost`, which is
   the container itself). Add TLS vars if the server is https.
2. `docker compose up -d bridge`
3. Verify with `/api/status/health`, `/api/status/openmrs` (service-user roles)
   and `/api/status/openmrs/capabilities` (fast-path + read privileges).
4. Run `POST /api/remap` (dry-run first) so the mappings' form/concept UUIDs
   point at the external server's metadata; use `not-found` → `matches` and
   `overrides` when names differ.
5. Optional: set `source_db: "mysql"` on a mapping to read encounters directly
   from the external OpenMRS DB (`OPENMRS_DB_*`), verified via
   `/api/status/db` (`configured: true, ok: true`).
6. `POST /api/sync/run/:id` and inspect `/api/sync/logs` + DHIS2 events.

DHIS2-side targets (data sets, programs, org units) are unchanged — re-mapping
only affects the OpenMRS source metadata.

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
