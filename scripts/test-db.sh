#!/usr/bin/env bash
# Runs ALL tests, including the database security tests, against a throwaway
# local Supabase (in Docker) built from supabase/migrations/. Never touches your
# real Supabase project.  Usage: npm run test:db
set -euo pipefail

# -x skips services the tests don't use, so it starts faster.
npx supabase start -x studio,imgproxy,realtime,storage-api,edge-runtime,logflare,vector

# Re-apply the migrations from scratch so the test database matches the files.
npx supabase db reset --local

eval "$(npx supabase status -o env)"
export TEST_SUPABASE_URL="$API_URL"
export TEST_SUPABASE_ANON_KEY="$ANON_KEY"
export TEST_SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY"
if [ -z "$TEST_SUPABASE_URL" ] || [ -z "$TEST_SUPABASE_ANON_KEY" ] || [ -z "$TEST_SUPABASE_SERVICE_ROLE_KEY" ]; then
  echo "Couldn't read the local Supabase keys from 'supabase status'." >&2
  exit 1
fi

npx vitest run
echo "Done. Stop the local Supabase with: npx supabase stop"
