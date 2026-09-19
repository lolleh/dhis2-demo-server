#!/usr/bin/env bash
#
# Switch the active PIH site config for the demo OpenMRS.
# Only ONE site config is active at a time: the stack loads a single
# system-wide pih.config chain (read into System properties at boot).
# The active chain is chosen by the OPENMRS_PIH_CONFIG env var in
# docker-compose.yml (default: mongo).
#
# Usage:  ./switch-pih-config.sh <site>
#   mongo    -> Mongo Bendugu CHC  (default)
#   falaba   -> Falaba CHC
#   sinkunia -> Sinkunia CHC
#   kgh      -> KGH
#   wellbody -> Wellbody Clinic
#
# NOTE: the chosen chain applies to the recreate performed below. A later
# plain `docker compose up -d openmrs` (without OPENMRS_PIH_CONFIG) reverts
# to the compose default (mongo).
#
set -euo pipefail
cd "$(dirname "$0")/.."

SITE="${1:-}"
case "$SITE" in
  mongo)    CHAIN="sierraLeone,sierraLeone-mongo" ;;
  falaba)   CHAIN="sierraLeone,sierraLeone-falaba" ;;
  sinkunia) CHAIN="sierraLeone,sierraLeone-sinkunia" ;;
  kgh)      CHAIN="sierraLeone,sierraLeone-kgh,sierraLeone-kgh-test" ;;
  wellbody) CHAIN="sierraLeone,sierraLeone-wellbody" ;;
  *)
    echo "Unknown site: '$SITE'  (use mongo | falaba | sinkunia | kgh | wellbody)" >&2
    exit 1
    ;;
esac

echo "Switching pih.config -> $CHAIN"
OPENMRS_PIH_CONFIG="$CHAIN" docker compose up -d --no-deps --force-recreate openmrs

echo "Waiting for configuration setup..."
OK=0
for i in $(seq 1 60); do
  if docker logs dhis2-demo-server-openmrs-1 2>&1 | grep -q "Configuration Setup Completed Successfully"; then
    echo "  configuration setup completed (~${i}0s)"
    OK=1
    break
  fi
  sleep 10
done
[ "$OK" = 1 ] || { echo "Timed out waiting for configuration setup" >&2; exit 1; }

sleep 20

ACTIVE=$(curl -s -u admin:Admin123 \
  "http://127.0.0.1:8090/openmrs/ws/rest/v1/pihcore/config" \
  | python3 -c "import json,sys; d=json.load(sys.stdin); c=d.get('configDescriptor',{}); print(\"configProperty=%s site=%s welcome=%s idCard=%s dossier=%s\" % (d.get('configProperty'), c.get('site'), c.get('welcomeMessage'), c.get('idCardLabel'), c.get('dossierIdentifierPrefix')))" 2>/dev/null)
echo "Active config: $ACTIVE"
echo "Done. Site config is now: $SITE"