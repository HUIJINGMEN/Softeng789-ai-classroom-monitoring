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
    "$FRONTEND_ROOT/src/features/class-attendance/classAttendanceModel.ts" \
    "$FRONTEND_ROOT/src/features/class-schedule/scheduleModel.ts" \
    "$FRONTEND_ROOT/src/features/session-attendance/sessionAttendanceModel.ts" \
    "$FRONTEND_ROOT/src/features/payments/adminPaymentViewModel.ts" \
    "$FRONTEND_ROOT/src/features/payments/classBillingPlanModel.ts" \
    "$FRONTEND_ROOT/src/features/payments/invoiceReviewModel.ts" \
    "$FRONTEND_ROOT/src/features/payments/paymentRequestDraft.ts" \
    "$FRONTEND_ROOT/src/features/payments/studentPaymentModel.ts" \
    "$FRONTEND_ROOT/src/features/payments/lessonReconciliationModel.ts" \
    "$FRONTEND_ROOT/src/features/student-overview/studentOverviewModel.ts" \
    "$FRONTEND_ROOT/src/features/payments/format.ts" \
    "$FRONTEND_ROOT/src/lib/sort.ts"

STUDENT_PROFILE_MODEL_PATH="$TEST_BUILD_DIR/features/student-profile/studentProfileModel.js" \
CAMPUS_MODEL_PATH="$TEST_BUILD_DIR/features/campuses/campusModel.js" \
ATTENDANCE_TREND_MODEL_PATH="$TEST_BUILD_DIR/features/dashboard-attendance/attendanceTrendModel.js" \
CLASS_REPORT_MODEL_PATH="$TEST_BUILD_DIR/features/class-reports/classReportModel.js" \
CLASS_ATTENDANCE_MODEL_PATH="$TEST_BUILD_DIR/features/class-attendance/classAttendanceModel.js" \
CLASS_SCHEDULE_MODEL_PATH="$TEST_BUILD_DIR/features/class-schedule/scheduleModel.js" \
SESSION_ATTENDANCE_MODEL_PATH="$TEST_BUILD_DIR/features/session-attendance/sessionAttendanceModel.js" \
PAYMENT_ADMIN_MODEL_PATH="$TEST_BUILD_DIR/features/payments/adminPaymentViewModel.js" \
PAYMENT_CLASS_BILLING_MODEL_PATH="$TEST_BUILD_DIR/features/payments/classBillingPlanModel.js" \
PAYMENT_INVOICE_REVIEW_MODEL_PATH="$TEST_BUILD_DIR/features/payments/invoiceReviewModel.js" \
PAYMENT_DRAFT_MODEL_PATH="$TEST_BUILD_DIR/features/payments/paymentRequestDraft.js" \
PAYMENT_STUDENT_MODEL_PATH="$TEST_BUILD_DIR/features/payments/studentPaymentModel.js" \
PAYMENT_RECONCILIATION_MODEL_PATH="$TEST_BUILD_DIR/features/payments/lessonReconciliationModel.js" \
STUDENT_OVERVIEW_MODEL_PATH="$TEST_BUILD_DIR/features/student-overview/studentOverviewModel.js" \
    node --test \
        "$FRONTEND_ROOT/tests/studentProfileModel.test.cjs" \
        "$FRONTEND_ROOT/tests/campusModel.test.cjs" \
        "$FRONTEND_ROOT/tests/attendanceTrendModel.test.cjs" \
        "$FRONTEND_ROOT/tests/classReportModel.test.cjs" \
        "$FRONTEND_ROOT/tests/classAttendanceModel.test.cjs" \
        "$FRONTEND_ROOT/tests/classScheduleModel.test.cjs" \
        "$FRONTEND_ROOT/tests/sessionAttendanceModel.test.cjs" \
        "$FRONTEND_ROOT/tests/paymentModels.test.cjs" \
        "$FRONTEND_ROOT/tests/studentOverviewModel.test.cjs"
