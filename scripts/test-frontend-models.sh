#!/usr/bin/env sh
set -eu

PROJECT_ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
FRONTEND_ROOT="$PROJECT_ROOT/frontend"
TEST_BUILD_DIR=$(mktemp -d "${TMPDIR:-/tmp}/classroom-frontend-tests.XXXXXX")

cleanup() {
    rm -rf -- "$TEST_BUILD_DIR"
}
trap cleanup EXIT INT TERM

"$FRONTEND_ROOT/node_modules/.bin/tsc" \
    --outDir "$TEST_BUILD_DIR" \
    --module CommonJS \
    --moduleResolution Node \
    --target ES2020 \
    --skipLibCheck true \
    --esModuleInterop true \
    --noEmit false \
    "$FRONTEND_ROOT/src/features/student-profile/studentProfileModel.ts" \
    "$FRONTEND_ROOT/src/features/campuses/campusModel.ts" \
    "$FRONTEND_ROOT/src/features/dashboard-attendance/attendanceTrendModel.ts" \
    "$FRONTEND_ROOT/src/features/class-reports/classReportModel.ts" \
    "$FRONTEND_ROOT/src/features/session-attendance/sessionAttendanceModel.ts" \
    "$FRONTEND_ROOT/src/lib/sort.ts"

STUDENT_PROFILE_MODEL_PATH="$TEST_BUILD_DIR/features/student-profile/studentProfileModel.js" \
CAMPUS_MODEL_PATH="$TEST_BUILD_DIR/features/campuses/campusModel.js" \
ATTENDANCE_TREND_MODEL_PATH="$TEST_BUILD_DIR/features/dashboard-attendance/attendanceTrendModel.js" \
CLASS_REPORT_MODEL_PATH="$TEST_BUILD_DIR/features/class-reports/classReportModel.js" \
SESSION_ATTENDANCE_MODEL_PATH="$TEST_BUILD_DIR/features/session-attendance/sessionAttendanceModel.js" \
    node --test \
        "$FRONTEND_ROOT/tests/studentProfileModel.test.cjs" \
        "$FRONTEND_ROOT/tests/campusModel.test.cjs" \
        "$FRONTEND_ROOT/tests/attendanceTrendModel.test.cjs" \
        "$FRONTEND_ROOT/tests/classReportModel.test.cjs" \
        "$FRONTEND_ROOT/tests/sessionAttendanceModel.test.cjs"
