#!/usr/bin/env sh
set -eu
PROJECT_ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
AUDIT_DIR=$(mktemp -d "${TMPDIR:-/tmp}/classlens-security.XXXXXX")
trap 'rm -f "$AUDIT_DIR/maven.txt"; rmdir "$AUDIT_DIR"' EXIT INT TERM
AI_PYTHON=${AI_PYTHON:-"$PROJECT_ROOT/ai-service/.venv/bin/python"}
(cd "$PROJECT_ROOT/frontend" && npm audit --audit-level=low)
(cd "$PROJECT_ROOT/backend" && mvn -q dependency:list -DincludeScope=runtime -DoutputFile="$AUDIT_DIR/maven.txt")
"$AI_PYTHON" "$PROJECT_ROOT/scripts/audit-dependencies.py" < "$AUDIT_DIR/maven.txt"
