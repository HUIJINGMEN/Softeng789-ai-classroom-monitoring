# Phase 2C — attendance review workspace

[한국어 가이드](phase2c-attendance-review.ko.md)

Branch: `DoJun/phase2c-attendance-review`, based on Phase 2B commit `ea02753`.

## Teacher workflow

1. Open **Attendance**, select a class/session and open its detail screen.
2. **Attendance review** shows Present, Late, Absent, Awaiting approval and Not recorded counts. Unrecorded students are not automatically marked absent.
3. The unified roster has one row per student, with pending and unrecorded students first. Up to 20 students appear on one page; larger classes use Previous/Next. Click a status count to filter, or search by name/student ID. On phones, the same rows become compact lists. Student photo check-in requests refresh every 15 seconds while the tab is visible. **Refresh** updates immediately.
4. Check each student's actual participation, then tick that student's checkbox. Choose **Approve selected**, **Mark selected late**, or **Reject selected**, or use that selected student's Approve/Reject buttons. New requests are never selected automatically. Selections persist across filters/pages, with an explicit count of hidden selections and a Clear selection button.
5. Results show the number processed and any failures. Decisions run sequentially: successful students stay saved if another request fails. Failed decisions are not automatically retried.
6. Use **Manual** or **Correct** on a student's row to open the existing correction dialog. Manual corrections and classroom-photo approvals appear here on the next refresh (within 15 seconds in a visible tab). The original detailed attendance table is collapsed under **Attendance details and check-in times**.
7. Expand **Processing history** for the latest 100 changes, or **All check-in requests** for request outcomes. A pending request cannot overwrite recorded attendance and is described accordingly.

The existing classroom-photo workflow remains below the review workspace. Student registration, admin registration approval, manual attendance and recognition thresholds are unchanged. This feature does not implement live monitoring, automatic attendance, liveness or attention inference.

## API and data

`GET /api/sessions/{id}/attendance-review` returns:

```text
{
  attendance: AttendanceRecordResponse[],
  requests: { id, studentId, studentName, state, createdAt, expiresAt, reviewedAt }[],
  history: { id, studentId, studentName, actorName, action,
             previousStatus, resultingStatus, occurredAt }[]
}
```

The endpoint requires an authenticated teacher with access to the session, or an admin. Students and unrelated teachers cannot read it. Responses use `Cache-Control: no-store`. Reads and manual corrections remain available when inference is disabled; photo-check-in decisions still require the existing CV feature to be enabled.

Selected decisions reuse `POST /api/vision/check-ins/{id}/decision` with `{teacherConfirmed: true, status: "PRESENT" | "LATE" | "REJECTED"}`. Each decision retains server-side access, roster, consent, expiry, duplicate and attendance-conflict validation. Manual corrections reuse `PUT /api/sessions/{sessionId}/attendance/{studentId}`. This is a sequence of independent transactions, not an all-or-nothing bulk endpoint.

Flyway `V6__attendance_review_history.sql` adds `attendance_review_events` and indexes for session/time, student and actor. The same transaction that saves a manual correction, classroom-photo approval or student check-in decision appends an event. Retries of the same photo/check-in decision do not append duplicates. Failed transactions do not retain events. Manual saves are separate events, including same-status saves because other attendance fields may change.

History contains student/actor references, action, previous/resulting state and server timestamp. `PENDING → REJECTED` is a request decision, not an absence mark. No photos, embeddings, match scores or absence notes are copied into history. Names reflect current account records. Actor deletion clears its reference; student/session deletion cascades history. No independent time-based purge is introduced: retention follows the attendance record lifecycle and must be set before production use. Earlier changes are not backfilled. This is application processing history, not a tamper-proof audit system.

The UI pauses polling during decisions, ignores obsolete responses after navigation and keeps successful decisions when another fails. Leaving the screen stops unsent decisions; a request already sent can still complete. A failed refresh retains the last snapshot and displays an error. Read results can lag concurrent edits; write-time server validation is authoritative.

## Local startup and migration

Existing start/stop commands remain valid. Restart the backend after switching to this branch; V6 is applied automatically to a correctly configured Flyway V5 database. Do not reset the database or manually edit Flyway history. This development machine has already applied V6 and restarted successfully; existing data was retained. Frontend and Python services remain running.

From the repository root, for the existing local setup:

```powershell
powershell -ExecutionPolicy Bypass -File .\data\local-dev\start.ps1
powershell -ExecutionPolicy Bypass -File .\data\local-dev\stop.ps1
```

These commands start or stop the full local stack. `start.ps1` does not restart an already running service. The `data/local-dev` scripts and credentials are machine-local ignored files, not distributed by Git. Other developers should use the repository's setup guides.

## Verification performed

- Frontend production build and 343 tests passed, including unified roster ordering/filtering, selection retention, newcomer exclusion, partial failures, persistent errors, stale responses, session switching and visibility-aware polling.
- 61 focused backend tests passed: vision/check-in (31), registration (16), attendance (11), leave approval (3).
- The 31 vision/check-in tests also passed against an isolated PostgreSQL database, including journal rollback, duplicate handling, staff scope, manual before/after state, CV-disabled reads and the 100-entry limit.
- Fresh PostgreSQL migration and V5→V6 upgrade passed, including preservation of pre-existing row values, migration repeatability and ORM mapping validation. Four module architecture checks passed.
- Actual React component browser tests passed at 1440px and 390px with synthetic API responses: 20-student single-page display, 21-student pagination, selection across pages, unselected new arrivals, batch partial success, rejection, search/filter, correction callback, history, stale-request labels and refresh errors; no horizontal overflow or JavaScript errors.
- The running local server accepted authenticated review reads for two existing sessions, and its real session-detail review screen loaded without JavaScript errors. No user attendance was changed by this smoke test.

## Manual acceptance test

Use separate teacher and student browser profiles to avoid replacing the session cookie. In a session open for check-in, submit a student photo request, then verify the teacher sees it within 15 seconds. Select only that student and approve; the student should see Present after refreshing, and teacher history should show the approval. Repeat with rejection and with a manual correction. Confirm recorded students are not listed as awaiting approval. With two test students, verify both selected approvals and that a newly arrived third request remains unselected. Face recognition accuracy across different people is still a separate pending evaluation.
