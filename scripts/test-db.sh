#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
if [ "${1:-}" = "--postgres" ]; then
  # A fresh lightweight engine tests SQL/RLS without the full Supabase stack.
  task_db="habit-star-sql-test-$$"
  trap 'docker rm -f "$task_db" >/dev/null 2>&1 || true' EXIT
  docker run --name "$task_db" -e POSTGRES_PASSWORD=local-test-only -d postgres:17-alpine >/dev/null
  for attempt in $(seq 1 30); do
    if docker exec "$task_db" pg_isready -h 127.0.0.1 -U postgres >/dev/null 2>&1; then break; fi
    sleep 1
  done
  docker exec "$task_db" pg_isready -h 127.0.0.1 -U postgres >/dev/null
  docker exec -i "$task_db" psql -U postgres -v ON_ERROR_STOP=1 < tests/db-bootstrap.sql
  docker exec -i "$task_db" psql -U postgres -v ON_ERROR_STOP=1 < supabase/migrations/202611100001_cloud.sql
else
  task_db=supabase_db_habit-star
fi
# Never targets a production DATABASE_URL.
docker exec -i "$task_db" psql -U postgres -v ON_ERROR_STOP=1 < supabase/tests/cloud.sql
