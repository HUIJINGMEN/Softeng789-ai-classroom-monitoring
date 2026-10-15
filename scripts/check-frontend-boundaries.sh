#!/usr/bin/env sh
set -eu

PROJECT_ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
FRONTEND_SRC="$PROJECT_ROOT/frontend/src"

fail_on_match() {
    description=$1
    pattern=$2
    shift 2
    matches=$(grep -R -n -E --include='*.ts' --include='*.tsx' "$pattern" "$@" || true)
    if [ -n "$matches" ]; then
        printf '%s\n%s\n' "$description" "$matches" >&2
        exit 1
    fi
}

fail_on_match \
    "Payments consumers must import from the feature's public index." \
    "features/payments/(components|hooks|api|types|admin|[A-Za-z]+Model)" \
    "$FRONTEND_SRC/pages" "$FRONTEND_SRC/components" "$FRONTEND_SRC/lib"

fail_on_match \
    "Student overview must consume payments through its public feature API." \
    "\.\./payments/(components|hooks|api|types|admin|[A-Za-z]+Model)" \
    "$FRONTEND_SRC/features/student-overview"

fail_on_match \
    "Scheduling consumers must import from features/class-schedule, not its internal model file." \
    "features/class-schedule/scheduleModel" \
    "$FRONTEND_SRC/components" "$FRONTEND_SRC/pages"

fail_on_match \
    "Report consumers must use the feature public index; shared review internals stay inside features." \
    "features/(student-reports|class-reports|overall-reports|report-review)/" \
    "$FRONTEND_SRC/pages" "$FRONTEND_SRC/components" "$FRONTEND_SRC/lib"

printf 'Frontend module boundaries: OK\n'
