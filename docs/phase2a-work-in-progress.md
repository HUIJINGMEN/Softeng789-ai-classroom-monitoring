# Phase 2A checkpoint

Branch: `DoJun/phase2-student-attendance`, based on `895591c` (`DoJun/phase1-face-attendance`, already published by the user). No commit, push, merge, PR creation or deployment by the agent. User reviews and commits.

## Implemented

- `StudentCheckInPanel` on desktop and mobile student overview: eligible session list, explicit capture consent, own-face request, pending/approved/rejected/expired status, retry with the same key, five-minute failed-capture cleanup, 30-second status refresh and manual fallback.
- Shared `RecognitionCamera` supports student-specific text while preserving phase-1 teacher capture and enrollment behavior.
- `StudentCheckInQueue` in the teacher session: scoped requests, independent participation confirmation, Present/Late approval or rejection; approval refreshes the existing attendance table.
- `StudentCheckInController/Service/Repository/Entity`: student-self and teacher-scope authorization, server-controlled time/membership/consent checks, exactly one own matching face, no pre-approval attendance, idempotency, expiry, duplicate prevention and concurrent/manual-update protection.
- Existing `VisionService` shares the inference semaphore, response validation and consent-revision validation; withdrawal/reenrollment also erases check-in payloads. No Python or model change.
- Additive `20261025_add_student_checkins.sql` plus canonical schema. Existing phase-1 data is preserved.
- English/Korean implementation guides and current-machine startup guide updated.

## Validation (2026-10-18)

| Check | Result |
| --- | --- |
| Full Java suite | 365 tests: 364 passed, 1 conditional live-gateway test skipped because `CV_TEST_SERVICE_URL` was unset |
| Isolated PostgreSQL `VisionServiceTest` | 29 passed, including 12 added check-in tests |
| Final retention lock-order follow-up | Expiry/retention, consent withdrawal and concurrent approval tests passed again on PostgreSQL |
| Upgrade migration | Applied to committed phase-1 schema in `cv_phase2a_test`; repeat application passed; Hibernate schema validation passed |
| Frontend model suite | 142 passed |
| Frontend boundaries | Passed |
| TypeScript/Vite build | Passed (418 modules) |
| 2A browser checks | 1440×1000 and 390×844; actual components, synthetic camera and mocked API; request/retry/pending/late approval/rejection/recapture/mismatch/expiry/consent-loss camera cleanup; no unexpected console errors or horizontal overflow |
| Phase-1 browser regression | Same two widths: consent/enrollment/seven captures/retake, teacher camera/file fallback, candidate selection and teacher-confirmed save/table refresh all passed |
| Local authenticated read smoke | Backend health UP; student check-in workspace enabled and ready; teacher queue 200; frontend HTTP 200. No photo or attendance submission in this smoke test |

Screenshots of student and teacher request states were visually inspected. Automated tests use synthetic records and mocked positive inference; they do not establish real identity accuracy, PAD, mobile hardware compatibility or a complete live-model end-to-end write. The user's phase-1 personal environment tests succeeded, but other identities and false matches remain untested.

## Local environment

Applied the additive 2A migration to the existing loopback development database `classroom_local` on port 55440. Existing enrolled face and attendance records were not edited by tests. Existing local start/stop scripts and credentials remain ignored under `data/local-dev/`. For manual 2A testing, choose an enrolled session currently within the request window and with no existing attendance mark.

Isolated PostgreSQL tests used `cv_phase2a_test` on loopback port 55439, separate from user data. The test cluster can be stopped after verification without affecting the development database.

Evidence (ignored or outside Git):

- `data/phase2a-java-tests.log`, `data/phase2a-postgres-tests.log`, `data/phase2a-final-retention-tests.log`, `backend/target/surefire-reports` (the final targeted run replaces the same suite's XML report).
- Existing external visualization directory `C:/Users/ASUS/.codex/visualizations/2026/10/15/01a13d54-8cf4-72b3-bcf6-8522a2d0b00f`: `phase2a-ui-qa.mjs`, `phase2a-ui-results.json`, `phase2a-student-390.png`, `phase2a-teacher-1440.png`, and `phase2a-phase1-regression.mjs`.

Next: user tests the actual student camera → teacher approval flow, then reviews the diff before committing. Multi-person accuracy/spoofing evaluation and any automatic attendance mode remain separate work. No online monitoring or robot features were added.

## Timetable compatibility fix (2026-10-19)

The existing scheduler encodes Auckland wall-clock digits with a `Z` suffix. The new student check-in flow initially interpreted those values as UTC, moving a teacher's October 19 16:10–17:05 session to October 20 05:10–06:05 and shifting request eligibility. `CheckInSessionTime` now adapts scheduled times at the check-in boundary, including query bounds and the request window. The student panel explicitly displays Auckland time. Request, attendance and audit timestamps remain real instants.

No existing session or attendance records were rewritten. This is a narrow compatibility fix; the legacy scheduler's storage convention remains unchanged. Authenticated read-only verification against the local student API returned October 19 16:10–17:05 Auckland time and `canSubmit=true` during the allowed window. The backend health endpoint returned UP after restart.

All 32 targeted Java tests passed on H2 after recompiling the test classes. The frontend production build passed. Browser checks using the actual student panel and a mocked API passed with both Auckland and UTC browser timezones, displaying the same Auckland schedule. Targeted Java coverage includes the request-window boundaries, winter offset, daylight-saving date change, UTC date rollover and the student workspace response. Evidence is in ignored `data/phase2a-timezone-tests.log`, `data/phase2a-timezone-build.log` and external `phase2a-timezone-qa.mjs` / screenshots.

## Optional registration webcam enrollment (2026-10-20)

User requested adding webcam face registration to 2A, with administrator account approval and an equally available photo-free manual-attendance route. The existing branch and index were preserved; no commit/push performed.

- `AuthPage/RegisterForm` offer manual (default) or face attendance. Face mode mounts `RegistrationCamera` only after explicit adult-volunteer consent and requires seven ordered captures. Uses the real CV service, not the legacy browser mock quality/pose analysis. Camera tracks stop on completion, withdrawal, back navigation and unmount.
- `AuthService` preserves the older API adapter for compatibility, while explicit attendance-mode requests create encrypted `RegistrationFace` review material atomically with a pending student and class requests. Claims of pre-provisioned students also require administrator review. Inference runs outside the registration transaction. Database flushes precede student locking/refreshing so new or claimed account changes are not lost.
- `AdminRegistrations/RegistrationReview` show both attendance choices, scoped administrator-only photos and mandatory independent identity confirmation. New face profiles activate only in the account approval transaction. Pending photos are erased on approval, rejection, manual choice or seven-day expiry; active templates expire 30 days after original consent.
- `PendingRegistrationAttendance` allows student-self withdrawal to manual attendance and refreshing account approval. An expired face request can still be approved after the student switches to manual. This does not mark lesson attendance.
- Additive `20261026_add_registration_faces.sql` applied twice to isolated test DB successfully, then once to local development DB on port 55440. Existing student, face, attendance and check-in row counts unchanged. Local backend restarted; health UP and public registration options report face enrollment enabled. No actual student registration or photo submission performed against the user's development DB.
- One unrelated pre-existing leave workflow test used a fixed October 20 lesson which became past-dated; only its fixture now generates a future lesson. No production leave logic changed.

Browser plugin not available; regular Playwright used with installed Chrome and a synthetic webcam. Actual Landing/AuthPage/AdminRegistrations/PendingApproval components exercised at 1440×1000 and 390×1000 against mocked API responses: manual submission without camera, explicit consent, seven captures, consent withdrawal cleanup, quality rejection/retry, pending-to-manual, administrator confirmation gates, approval and expired-review blocking. Correct CSS load order and actual Landing wrapper were used for final screenshots. No framework overlays, console errors or horizontal overflow; screenshots visually inspected. This does not establish real face accuracy or PAD.

Evidence: `data/phase2a-registration-*.log`; external visualization directory `registration-qa.mjs`, `registration-qa-results.json` and `registration-{manual,face,admin}-{1440,390}.png`. English and Korean 2A guides document the new contracts, retention and manual test sequence.

Final validation on October 20:

| Check | Result |
| --- | --- |
| Full backend regression | 379 tests: 378 passed, 1 conditional live-gateway test skipped; no failures/errors |
| Final registration gate follow-up | 12 tests passed on isolated PostgreSQL, including an additional test that omitting `attendanceMode` cannot bypass review when claiming a pre-provisioned account |
| Frontend model tests / module boundaries | 142 passed / passed |
| Final TypeScript and Vite production build | Passed |
| Desktop/mobile browser QA | Both widths passed; synthetic webcam and mocked API; no console errors or horizontal overflow |
| Whitespace validation | `git diff --check` passed |

The final gate follow-up ran after the full regression run and compiled the last legacy-claim approval fix. Local backend was restarted with that fix; the isolated test database was then stopped. Existing local frontend/Python services remain running. No real face enrollment was submitted by the agent: the user still needs to test the complete real webcam → CV service → administrator approval flow with a new test account. Existing model thresholds and models were not changed. The working tree remains uncommitted on `DoJun/phase2-student-attendance`; existing staged files were preserved.

## Attendance status display correction (2026-10-21)

The user confirmed real webcam registration and administrator approval worked, then reported `Attendance: PRESENT` alongside `Awaiting teacher approval — attendance not saved` after a teacher recorded attendance through photo recognition. The student panel rendered independent check-in request history even after another attendance workflow saved the authoritative record. `StudentCheckInPanel` now displays request instructions only while attendance is `UNKNOWN`; saved attendance takes precedence, including over stale rejection/expiry instructions. No attendance or request records were rewritten.

TypeScript/Vite build and whitespace checks passed. Browser plugin not available; Playwright with actual components and mocked API responses at 1440×900 and 390×900 verified refresh from UNKNOWN/PENDING to saved attendance, suppression of stale expiry text, restoration of pending guidance when UNKNOWN, disabled check-in for saved records, page identity, no error overlays/console errors/horizontal overflow. Evidence outside Git: `phase2a-attendance-status-qa.mjs` and `phase2a-attendance-status-{1440,390}.png` in the existing visualization directory. Actual user attendance data was not modified; user should refresh their student page to confirm the live record display. No commit or push performed.
