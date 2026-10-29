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
    "Feature consumers must use the public index; internal modules stay inside features." \
    "features/(student-reports|class-reports|overall-reports|report-review|admin-assistant|student-overview|accomplishment-entry|console-shell)/" \
    "$FRONTEND_SRC/pages" "$FRONTEND_SRC/components" "$FRONTEND_SRC/lib"

fail_on_match \
    "Shared report-review code must not depend on a concrete report feature." \
    "\\.\\./(student-reports|class-reports|overall-reports)/" \
    "$FRONTEND_SRC/features/report-review"

fail_on_match \
    "Report workspaces must use independent evidence components, not print-document modules." \
    "from .*ReportDocument" \
    "$FRONTEND_SRC/features/student-reports/StudentReportWorkspace.tsx" \
    "$FRONTEND_SRC/features/class-reports/useClassReportWorkspace.ts" \
    "$FRONTEND_SRC/features/overall-reports/OverallReportWorkspace.tsx" \
    "$FRONTEND_SRC/features/overall-reports/OverallReportSnapshotPanel.tsx"

printf 'Frontend module boundaries: OK\n'
