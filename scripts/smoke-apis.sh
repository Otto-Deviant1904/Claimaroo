#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:?Set BASE_URL to the deployed origin, e.g. https://your-app.onrender.com}"
BASE_URL="${BASE_URL%/}"

check() {
  local path="$1"
  local needle="$2"
  local body
  body="$(curl -fsS "${BASE_URL}${path}")"
  echo "${body}" | grep -q "${needle}"
  echo "ok  ${path}"
}

check "/api/health" '"ok":true'
check "/api/status" '"database"'
check "/api/claims" 'CLM-DEMO-A'
check "/api/claims/CLM-DEMO-A" '"id":"CLM-DEMO-A"'
check "/api/tools/get_customer" 'get_customer'

TOKEN_STATUS="$(curl -sS -o /tmp/claimaroo-token.json -w "%{http_code}" "${BASE_URL}/api/elevenlabs/token")"
if [[ "${TOKEN_STATUS}" == "200" ]]; then
  grep -Eq '"agentId"|"conversationToken"' /tmp/claimaroo-token.json
  echo "ok  /api/elevenlabs/token"
else
  echo "warn /api/elevenlabs/token returned ${TOKEN_STATUS} (voice env may be unset)"
fi

echo "smoke passed against ${BASE_URL}"
