# Phase 1 review checkpoint

Updated: 2026-10-16. Local implementation and regression checks are complete for review. Participant accuracy validation and production rollout are not complete or included.

## Git and user instructions

- Branch: `DoJun/phase1-face-attendance`.
- All changes remain uncommitted. Do not commit, push or merge until the user reviews and explicitly authorizes it; the user currently intends to commit themselves.
- Remote main was checked again at completion: `bb2e70aec8e01309f0837d116c8d2947d9271c89`, unchanged from the implementation baseline.
- No shared/application database was migrated. No production deployment occurred.
- Scope: supervised face enrollment, classroom photo matching and explicit teacher confirmation before attendance persistence. Online/robot features are excluded.

## Delivered

See [the English implementation guide](phase1-photo-attendance.md) for workflow, architecture diagram, model choice, setup, API contracts, schema changes, retention and rollout gates.

- Stateless CPU YuNet/SFace service with pinned model hashes, bounded authenticated uploads and quality/unknown/ambiguous matching states.
- Optional student-owned adult-pilot consent; seven teacher-supervised captures; encrypted templates; scoped classroom roster; expiring encrypted reviews; transactional and idempotent confirmation; manual attendance protection.
- Desktop/mobile student consent and teacher photo/enrollment/review UI. Registration and approval no longer require face capture.
- PostgreSQL migration and schema additions, disabled-by-default configuration, model installer, tests and CI dependency/model setup.
- Retention and withdrawal cleanup uses a subject deletion index, including when the encryption key is unavailable.
- Fixed PostgreSQL nullable-join locking, Java HTTP/2 upgrade incompatibility with Uvicorn by using HTTP/1.1, enrollment-camera retake and UI session-ID refresh issues found during integration tests.

## Verification on this branch

| Check | Result |
| --- | --- |
| Full Java suite | 353 tests, 0 failures/errors/skips; includes actual Java-to-Python multipart calls |
| PostgreSQL 16.15 | Actual schema plus migration applied twice; Hibernate validation passed; all 17 VisionService integration tests passed |
| Python suite with installed pinned models | 49 tests passed |
| Frontend model tests | 142 passed |
| TypeScript + Vite production build | Passed |
| Frontend module boundaries | Passed |
| Browser checks | Chrome, 1440x1000 and 390x844; actual SessionDetail and feature components, mocked API and synthetic camera |
| Browser interactions | Consent, seven captures, retake, enrollment, photo input, no automatic save, explicit identity/exclusion, teacher save, correct UI session-ID callback, attendance table refresh, manual-correction control and withdrawal |
| Browser quality | No page/console errors, no Vite overlay, no horizontal overflow; screenshots visually inspected |
| Patch whitespace | Passed at final review |

The full Java suite uses H2 except the separate PostgreSQL run. Tests use synthetic records and embeddings. Positive model identity accuracy was NOT measured. Real model smoke testing covers model loading, no-face recognition and faceless-enrollment rejection. Browser tests do not cover the full authenticated app-to-database chain or real phone hardware. No Sonar gate result is claimed. The edited GitHub workflow has not run remotely because nothing was pushed.

## Local test artifacts (ignored or outside Git)

### Follow-up: direct classroom camera capture (2026-10-17)

- Added teacher-session **Open camera → Capture and recognize** with explicit capture consent, front/rear camera preference and immediate single-photo submission. Attendance still requires review and a separate save.
- Shared capture hook retains enrollment defaults (960×720); classroom capture requests up to 1920×1440. Tracks stop on capture, close, direction changes and unmount. Existing file upload remains available, including after permission denial.
- A failed recognition request retains its photo and idempotency key for an explicit retry. Starting a new photo resets prior selections and confirmation.
- TypeScript/Vite build passed (415 modules). Actual UI components passed synthetic-camera/mocked-API checks at 1440×1000 and 390×844: consent gating, camera switching/closing, automatic submission, stopped tracks, retry with the same key, permission-denied file fallback, enrollment/retake, candidate selection and reviewed save/table refresh. No unexpected console errors or horizontal overflow; camera screenshots inspected.
- Harness and evidence: `vision-camera-qa.mjs`, `vision-camera-results.json`, `vision-camera-preview-1440.png` and `vision-camera-preview-390.png` in the existing external visualization directory below. Real phone hardware and authenticated camera-to-inference testing remain manual checks. The user's enrolled face and attendance records were not used or changed by these tests.
- Branch remains `DoJun/phase1-face-attendance`; no commit or push.

- `data/vision-final-java.log`: final complete Java run.
- `data/vision-final-integration.log`: PostgreSQL and real Java/Python run.
- `backend/target/surefire-reports`: final test reports.
- Model weights and licenses: `models/` (downloaded, SHA-256 checked; ignored).
- Browser harness/results/screenshots: `C:/Users/ASUS/.codex/visualizations/2026/10/15/01a13d54-8cf4-72b3-bcf6-8522a2d0b00f/vision-ui-qa.mjs`, `vision-ui-results.json`, `vision-review-1440.png`, `vision-review-390.png`.
- Test-only PostgreSQL binaries: `data/tooling/postgres16`; isolated cluster: `data/tooling/cv-test-db`, host `127.0.0.1`, port `55439`, database `cv_phase1_test`, user `cv_test`, synthetic records only. Uses local trust authentication solely for this disposable test cluster.
- Test-only Java 21: `data/tooling/jdk21/jdk-21.0.12.1+1`; Python environment: `ai-service/.venv`.
- Test servers were stopped after verification; the browser harness closes its own server/browser.

## Before user testing or wider rollout

1. Review the diff and guide. Apply the additive migration to a backed-up development DB before starting this backend version, even with CV disabled.
2. Configure separate random service/encryption keys, model location and `CV_ENABLED=true` for local testing. Never reuse test fixture keys.
3. Obtain institutional privacy/ethics/legal approval before participant data; consent UI does not establish legal permission.
4. Use separately consented data to calibrate and measure matching accuracy and CPU latency; document spoofing limitations. Run full authenticated end-to-end and real-phone tests.
5. Existing legacy enrollment images and backups require their own retention review; the new cleanup does not delete them.

An existing npm audit finding for transitive `source-map-js` (<1.2.2, GHSA-68fv-2mgg-jv7q) was observed during dependency installation. No unrelated dependency upgrade was made in this feature branch; details are in ignored `data/npm-audit.json`.
