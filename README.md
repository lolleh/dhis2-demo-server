# DHIS2 Demo Server

A local DHIS2 development environment using Docker Compose, with a pre-loaded Sierra Leone demo database.

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/)
- [Docker Compose](https://docs.docker.com/compose/install/) (V2, included with Docker Desktop)

## Quick Start

### Linux / macOS

```bash
# Clone the repo
git clone https://github.com/lolleh/dhis2-demo-server.git
cd dhis2-demo-server

# Start the server
docker compose up -d
```

### Windows (PowerShell)

```powershell
# Clone the repo
git clone https://github.com/lolleh/dhis2-demo-server.git
cd dhis2-demo-server

# Start the server
docker compose up -d
```

DHIS2 will be available at [http://localhost:8091](http://localhost:8091).

> **Note:** If port 8091 is in use, edit `docker-compose.yml` and change the left side of `"127.0.0.1:8091:8080"` to a free port.

## Default Credentials

| Username | Password |
|----------|----------|
| `admin` | `district` |

## Services

| Service | URL | Purpose |
|---------|-----|---------|
| DHIS2 | `http://localhost:8091` | Main application |
| Debugger | `localhost:8089` | JDWP debug port |
| JMX | `localhost:9011` | JMX monitoring |
| Database | `localhost:5435` | PostgreSQL 16 + PostGIS |

## Configuration

Copy `.env.example` to `.env` and adjust as needed:

```bash
cp .env.example .env
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DHIS2_IMAGE` | `dhis2/core-dev:latest` | DHIS2 Docker image |
| `DB_USERNAME` | `dhis` | Database username |
| `DB_PASSWORD` | `dhis` | Database password |
| `DB_NAME` | `dhis` | Database name |
| `DHIS2_DB_DUMP_URL` | Sierra Leone demo DB URL | URL to a `.sql.gz` database dump |

## Database Dumps

You can use a different database dump via the `DHIS2_DB_DUMP_URL` env variable. Official demo databases are available at [databases.dhis2.org](https://databases.dhis2.org/).

Examples of alternative dumps:

- **Sierra Leone** (default): `https://databases.dhis2.org/sierra-leone/dev/dhis2-db-sierra-leone.sql.gz`
- **Sierra Leone (30 days)**: `https://databases.dhis2.org/sierra-leone/30d/dhis2-db-sierra-leone.sql.gz`
- **Sierra Leone (1 year)**: `https://databases.dhis2.org/sierra-leone/1y/dhis2-db-sierra-leone.sql.gz`

## Sync Profile

Run two DHIS2 instances for testing data/metadata sync:

```bash
docker compose --profile sync up -d
```

This starts a second DHIS2 instance on port 8082 with its own database on port 5434.

## Troubleshooting

### Port already in use

If a port is already in use, edit the `ports` section in `docker-compose.yml` and change the host port (the left side of the mapping).

### Container can't resolve hostname

Ensure all containers are on the same Docker network. Run `docker compose down && docker compose up -d` to recreate them.

### Database dump download fails

The database dump is cached in a Docker volume after the first download. To re-download:

```bash
docker compose down -v
docker compose up -d
```

## Stopping

```bash
docker compose down
```

To also remove the database volume:

```bash
docker compose down -v
```
