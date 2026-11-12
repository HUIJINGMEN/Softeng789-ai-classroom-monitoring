# Phase 2/3 UI cleanup review record

[한국어](phase23-ui-cleanup.ko.md)

Original verification date: 2026-10-30 (Pacific/Auckland).

## Baseline and status

- Work started from a clean tree at integration commit `fce61cf`.
- The `DoJun/phase2-3-ui-cleanup` branch was created with no other chat working in the same folder.
- The UI cleanup was committed as `a13da49` after user review. Dated checks below are historical; pre-PR fixes and validation are recorded separately at the end.

## UI changes

1. **Student home and attendance:** today's classes and stored attendance take priority, using Auckland dates. Nearby classes and older activity can be expanded. Home offers **Open camera & activity** and **Full schedule**. **Camera & activity** is a desktop top-menu entry and a mobile bottom tab. Photo-attendance consent and withdrawal are under **Profile**; students see setup guidance when needed. Manual attendance and schedules remain available with photo check-in disabled.
2. **Camera:** one screen contains preview, start/stop, local consent, two independent sharing switches and their status. Current observations, forward reference and recent observations remain visible. Detailed readings, guidance and Phase 3D experiments are collapsible. Stopping resets adult confirmation and local-analysis consent. Leaving releases camera/sharing resources.
3. **Teacher list:** Student list is the default monitoring view. Attendance and observation connection status remain separate. Expanding one student shows observations and that student's explicit viewing control; closing it releases viewing. Search, filters, 20-row pagination and review remain. **Shared videos only** provides a separate whole-class view.

App text stays in English. Existing learning history, payments and reports remain available.

## Preserved boundaries

- Photo requests remain distinct from teacher-saved attendance; stored marks take precedence over old requests.
- Photo submission, local analysis, observation sharing and video sharing retain separate consent.
- Stopping/deleting observations preserves video. Stopping video preserves observations and the source camera.
- The original UI cleanup did not modify Phase 3D algorithms, thresholds, worker or analysis code. It only placed LocalEyeHeadPanel inside a collapsible section.
- Phase 3D results remain local and do not become teacher alerts or attendance/attention/sleep scores.
- Video capacity remains four students. The 21-student roster checks were not concurrent video load tests.
- Backend, Python and schema were unchanged; no student face or attendance data was reset.

## Historical verification

### Camera sections (2026-11-02)

- The screen was grouped into Camera & detection / Recent observations / Share with your teacher / Experimental tools, with section links and responsive layouts.
- Consent, start/stop and reference controls were placed together. Observation readings and history stayed visible; teacher sharing retained two independent consents. Detection algorithms were unchanged.
- The PR baseline `a13da49` passed **407 frontend tests** and the TypeScript/Vite build. Separate registration tests from the integrated working tree are excluded from this PR's baseline count.
- Chrome/Playwright checks at 320, 390, 820, 1024, 1321 and 1440px covered overflow, the four sections, keyboard entry, real MediaPipe no-face observations from a synthetic camera, and camera cleanup on navigation.
- Mock sharing APIs covered independent toggles, video retention after observation deletion and stop/restart resets. Real sharing data was not modified.
- No runtime exception or framework error screen occurred. The existing favicon 404 was recorded separately.
- Existing Playwright tooling was used because the Browser plugin was unavailable. Scripts and screenshots are local QA artifacts, not included in the repository.

### Earlier integrated UI checks

| Check | Historical result |
| --- | --- |
| Frontend boundaries and regression tests | 407 passed, no failures or skips |
| TypeScript / Vite production build | Passed |
| Local browser smoke | Student/teacher login, home, profile, camera, roster and detail entry passed |
| Mobile emulation | No overflow at 390×844 for home/profile/camera, roster/details and 20-row pagination |
| Keyboard | Enter opened details and student rows |
| Real MediaPipe with synthetic camera | Worker loaded, sharing defaulted off, experiment enabled, no-face input was unavailable, stop reset consent/experiment |
| Mock attendance API | Pending, present, late, rejected and expired states; stored marks took priority; photo consent and requests checked |
| Mock sharing API with synthetic tracks | Independent toggles, deletion preserving video, restart resets and navigation cleanup |
| Mock teacher API | 21-student search/pagination, empty/filter/error states, unknown connection after errors, only selected-student video, detail-close cleanup |
| Baseline comparison | Phase 3D detector files, backend and Python unchanged from fce61cf |

Real-server smoke checks had no browser exceptions or API 5xx errors. Error-path tests intentionally returned mock 503 responses. An initial mock lacked the account-verification header; the fixture was corrected without weakening application authentication.

## Verification limits

After user review, camera entry became an independent menu/tab. Further checks at 320, 390, 820, 1024, 1321 and 1440px covered menu overflow, keyboard entry, active-tab state, default no-face readings and track cleanup on navigation. The 407-test suite and build still passed. Scripts/screenshots are local QA artifacts, not repository files.

- Mobile checks used desktop Chrome emulation, not physical phone camera/HTTPS testing.
- The synthetic camera had no real face. Recognition accuracy and the full new-photo → teacher approval → persisted attendance path were not revalidated. Additional attendance states used mocks.
- Cross-device/network streaming and concurrent video load were not revalidated.
- Backend/Python suites were not rerun for the original UI-only change. See the [integration handoff](phase23-integration-handoff.ko.md) for earlier results and limits.

## Current paths

Local app: `http://127.0.0.1:5173`.

- Student: Home → Check in or **Camera & activity** in the desktop top menu/mobile bottom tab (also Home → **Open camera & activity**). Profile and face enrollment are under the account menu.
- Teacher: **Live monitoring** → class → **Student list** → student **+** → **Start viewing live video**. Use **Shared videos only** for the whole-class grid. Manual/photo attendance stays under Attendance/Capture.
- Browser scripts and screenshots are local QA artifacts, not included in the repository. Credentials are not stored in source.

## Pre-PR review fixes (2026-11-12)

Baseline: `a13da49`. Branch: `codex/phase2-3-ui-fixes`. Roles: implement Codex / review and integrate Claude. Changes were made in an isolated worktree.

- Disabled observations and initial-load errors show accurate status and **Open shared videos**. This changes mode only; viewing still needs an explicit start. Student list stays the default.
- Mode buttons use theme colors, selected background/border and at least 44px touch targets. Light/dark visual verification remains for integration.
- Observation/video availability errors appear in their own cards and clear on refresh/success. Refreshing sharing sessions while the camera is active remains disabled.
- Filter, search and page changes collapse student details; returning does not reopen video details automatically.
- Experimental tools show On/Off while collapsed. LocalEyeHeadPanel only gained a notification callback; measurements, thresholds and reset behavior are unchanged.
- Today's classes and any currently submittable check-ins remain primary, including both sides of Auckland midnight, sorted by start instant.
- Attendance labels use stored student marks only. Attendance labels, student video filtering and check-in partitioning now have pure model functions.
- Profile uses a user icon; whole-class video uses h2 and student-detail video uses h3.
- README and Phase 3 English/Korean procedures now match current navigation and consent resets on camera stop.

### Validation of these fixes

| Check | Result |
| --- | --- |
| Git Bash: frontend npm test | Passed: **421 tests**, no failures/skips; boundaries included |
| New phase23UiModels regressions | Passed: **14 tests**, included in 421; midnight cases, attendance independence, video filtering, mocked disabled/error responses |
| Git Bash: frontend npm run build | Passed: TypeScript and Vite |
| git diff --check / allowed-path audit against a13da49 | Passed |
| Backend, AI service, full script suite, DB/infrastructure | Not run: frontend/documentation scope; frontend runner received one new test-list line |
| UI check | Not run: no local stack in this worktree; Claude owns validation after integration |

Open work: Claude review, then integrated UI checks for disabled/error fallback, light/dark selected modes, detail resets, card-local errors and experimental On/Off. Physical camera/device/network limitations remain. Public-index cleanup is outside this task's allowed scope and needs separate coordination.
