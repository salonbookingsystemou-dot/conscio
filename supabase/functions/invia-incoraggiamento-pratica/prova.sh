#!/usr/bin/env bash
# Prova l'invio senza completare una sessione reale.
# Uso:
#   ENCOURAGEMENT_SECRET=... \
#   FUNCTIONS_URL=https://<ref>.supabase.co/functions/v1 \
#   ./prova.sh --codice CODICE123 --settimana 1
#
# In locale (dopo `supabase functions serve invia-incoraggiamento-pratica --no-verify-jwt`):
#   FUNCTIONS_URL=http://127.0.0.1:54321/functions/v1 ./prova.sh --codice CODICE123

set -euo pipefail

URL="${FUNCTIONS_URL:-http://127.0.0.1:54321/functions/v1}"
SECRET="${ENCOURAGEMENT_SECRET:-${CRON_SECRET:-}}"
CODICE=""
UTENTE=""
SETTIMANA="1"
GIORNO="$(date +%F)"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --codice) CODICE="${2:-}"; shift 2 ;;
    --utente) UTENTE="${2:-}"; shift 2 ;;
    --settimana) SETTIMANA="${2:-1}"; shift 2 ;;
    --giorno) GIORNO="${2:-}"; shift 2 ;;
    *) echo "Argomento sconosciuto: $1" >&2; exit 1 ;;
  esac
done

if [[ -z "$CODICE" && -z "$UTENTE" ]]; then
  echo "Passa --codice CODICE_PARTECIPANTE oppure --utente UUID" >&2
  exit 1
fi

if [[ -z "$SECRET" ]]; then
  echo "Manca ENCOURAGEMENT_SECRET (o CRON_SECRET)." >&2
  exit 1
fi

BODY=$(python3 - <<PY
import json
body = {"prova": True, "week_number": int("$SETTIMANA"), "practice_date": "$GIORNO"}
codice = """$CODICE"""
utente = """$UTENTE"""
if codice:
    body["codice"] = codice
if utente:
    body["utente_id"] = utente
print(json.dumps(body))
PY
)

curl -sS -X POST "$URL/invia-incoraggiamento-pratica" \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: $SECRET" \
  -d "$BODY"
echo
