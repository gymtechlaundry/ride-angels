#!/usr/bin/env bash
# Reset a test Auth user so you can re-run onboarding.
# Deletes the Auth user by email or E.164 phone (cascades profile / rides data).
#
# Usage:
#   ./scripts/reset-test-user.sh hyperionappstudio@gmail.com
#   ./scripts/reset-test-user.sh +15551234567
#
# Requires: supabase CLI logged in + project linked (or SUPABASE_* already exported).
# Never prints or commits the service_role key.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

IDENTIFIER="${1:-}"
if [[ -z "$IDENTIFIER" ]]; then
  echo "Usage: ./scripts/reset-test-user.sh <email-or-e164-phone>" >&2
  exit 1
fi

PROJECT_REF="${SUPABASE_PROJECT_REF:-zuvfzmpdmjwewcuyxtac}"
URL="${SUPABASE_URL:-https://${PROJECT_REF}.supabase.co}"

if [[ -z "${SUPABASE_SERVICE_ROLE_KEY:-}" ]]; then
  echo "Loading service_role via supabase CLI (project $PROJECT_REF)…"
  # shellcheck disable=SC1091
  eval "$(supabase projects api-keys --project-ref "$PROJECT_REF" -o env)"
fi

if [[ -z "${SUPABASE_SERVICE_ROLE_KEY:-}" ]]; then
  echo "Could not load SUPABASE_SERVICE_ROLE_KEY." >&2
  exit 1
fi

export SUPABASE_URL="$URL"
export SUPABASE_SERVICE_ROLE_KEY

node scripts/delete-auth-user-by-email.mjs "$IDENTIFIER"
