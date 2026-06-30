# DHIS2 Demo Server

A local DHIS2 development environment using Docker Compose, with a pre-loaded Sierra Leone demo database.

## Prerequisites

### Windows — Install Docker Desktop

1. **Check virtualization is enabled**
   - Open **Task Manager** → **Performance** tab
   - Under "CPU", check that **Virtualization** says **Enabled**
   - If disabled, enable it in your BIOS/UEFI settings (usually under Advanced → CPU Configuration)

2. **Install WSL 2** (Windows Subsystem for Linux)
   - Open **PowerShell as Administrator** and run:
     ```powershell
     wsl --install
     ```
   - Restart your computer when prompted
   - After reboot, WSL will finish installing Ubuntu automatically

3. **Download & install Docker Desktop**
   - Go to [docs.docker.com/desktop/](https://docs.docker.com/desktop/)
   - Download **Docker Desktop for Windows**
   - Run the installer and follow the prompts

4. **Configure Docker Desktop**
   - Launch Docker Desktop
   - Go to **Settings** → **General** and check **Use WSL 2 based engine**
   - Go to **Settings** → **Resources** → **WSL Integration**
     - Enable integration with your WSL distro (e.g. Ubuntu)
   - Go to **Settings** → **Resources** → **File Sharing**
     - Make sure the drive where this project is located (e.g. `C:\`) is listed
   - Click **Apply & Restart**

5. **Verify Docker is working**
   - Open **PowerShell** and run:
     ```powershell
     docker --version
     docker compose version
     ```
   - You should see version numbers for both

6. **Install Git** (if you don't have it)
   - Go to [git-scm.com](https://git-scm.com/) and download **Git for Windows**
   - Run the installer (default settings are fine)
   - Restart PowerShell, then verify:
     ```powershell
     git --version
     ```

7. **Clone this repo**
   ```powershell
   git clone https://github.com/lolleh/dhis2-demo-server
   cd dhis2-demo-server
   ```

### Linux / macOS

```bash
# Install Docker Engine + Compose
# See: https://docs.docker.com/engine/install/

# Then clone and start
git clone https://github.com/lolleh/dhis2-demo-server
cd dhis2-demo-server
docker compose up -d
```

## Quick Start

### Windows (PowerShell)

```powershell
# Make sure you're in the project folder, then:
docker compose up -d
```

### Linux / macOS

```bash
docker compose up -d
```

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

## Custom App Development

This project includes a DHIS2 custom app in the `my-app/` directory.

### Running the Dev Server

#### Via Docker (recommended)

```bash
docker compose up -d my-app
```

The dev server will start at [http://localhost:3000](http://localhost:3000) and proxy API requests to the DHIS2 instance on port 8091.

#### Directly on host

```bash
cd my-app
npm install
# Remove .d2/ first so the shell node_modules symlink
# is generated fresh (required for the first run)
rm -rf .d2
npm start
```

## Sync Profile

Run two DHIS2 instances for testing data/metadata sync:

```bash
docker compose --profile sync up -d
```

This starts a second DHIS2 instance on port 8082 with its own database on port 5434.

## Troubleshooting

### Port already in use

If you see an error like `Bind for 127.0.0.1:<port> failed: port is already allocated`, a process on your host is already using that port.

#### Option 1: Kill the process using the port

Find the process and stop it:

```bash
# Linux / macOS
sudo lsof -i :<port>     # e.g., sudo lsof -i :5435
sudo kill -9 <PID>
```

```powershell
# Windows (PowerShell)
netstat -ano | findstr :<port>
taskkill /PID <PID> /F
```

#### Option 2: Change the host port

Edit `docker-compose.yml` and change the host port (the left side of the mapping). For example, to change the database port from `5435` to `5436`:

```yaml
ports:
  - "127.0.0.1:5436:5432"
```

Common ports mapped by this project and the services they expose:

| Service | Default Host Port | Container Port | Purpose |
|---------|-------------------|---------------|---------|
| web | `8091` | `8080` | DHIS2 application |
| web | `8089` | `8081` | JDWP debugger |
| web | `9011` | `9010` | JMX monitoring |
| db | `5435` | `5432` | PostgreSQL |
| web-sync | `8082` | `8080` | Sync instance |
| web-sync | `8083` | `8081` | Sync debugger |
| web-sync | `9012` | `9010` | Sync JMX |
| db-sync | `5434` | `5432` | Sync PostgreSQL |

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
