#!/usr/bin/env sh
set -eu

PROJECT_ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)

echo "Checking patch whitespace"
git -C "$PROJECT_ROOT" diff --check

echo "Running backend tests"
BACKEND_LOG=$(mktemp "${TMPDIR:-/tmp}/classroom-backend-tests.XXXXXX")
cleanup() {
    rm -f "$BACKEND_LOG"
}
trap cleanup EXIT INT TERM

if ! (cd "$PROJECT_ROOT/backend" && mvn -q test >"$BACKEND_LOG" 2>&1); then
    cat "$BACKEND_LOG"
    echo "Backend tests failed"
    exit 1
fi
echo "Backend tests passed"

echo "Running frontend model tests"
(cd "$PROJECT_ROOT/frontend" && npm test)

echo "Building frontend"
(cd "$PROJECT_ROOT/frontend" && npm run build)

echo "Running AI adapter tests"
AI_PYTHON=python3
if [ -x "$PROJECT_ROOT/ai-service/.venv/bin/python" ]; then
    AI_PYTHON="$PROJECT_ROOT/ai-service/.venv/bin/python"
fi
(cd "$PROJECT_ROOT/ai-service" && "$AI_PYTHON" -m unittest discover -s tests -p 'test_*.py')

echo "Quality checks passed"
