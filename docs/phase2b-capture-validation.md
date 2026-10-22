# Phase 2B — immediate capture validation

Branch: `DoJun/phase2b-capture-validation`, based on phase 2 commit `02388e6`.

Student signup and supervised face enrollment now check each captured photo before adding it to the seven-photo set. The existing YuNet detector and quality checks are reused without changing thresholds: exactly one face, minimum face side 80 pixels, Laplacian variance at least 35, mean grayscale brightness strictly between 35 and 225. Detector score threshold remains 0.9. These are pilot thresholds, not measured accuracy guarantees.

Capture → transient quality request → pass: add/replace the photo and advance; fail: stay on that pose, show reason and rejected preview. Other accepted photos are preserved. A failed replacement retains the original until a valid replacement succeeds. Cancel retake keeps the original. The preview is held only in browser memory. A 25-second client timeout, network failure or service rejection never counts as passing. Consent withdrawal, navigation, reset and cancellation abort the client request and discard late responses. Server inference already in progress may finish, without persisting its result.

Final registration/enrollment always validates all seven photos again, including identity consistency with capture 1. Prechecks create no embeddings or reusable validation tokens. They do not validate head pose, liveness, identity or attendance. Manual registration/attendance and admin/teacher approval rules remain unchanged.

## API contracts

| Endpoint | Access and multipart fields | Result |
| --- | --- | --- |
| `POST /api/auth/registration-capture-check` | Anonymous with CSRF; `image`, `consentGiven=true`, `adultConfirmed=true`, current `noticeVersion` from registration options | `{accepted, reasons, message}` |
| `POST /api/vision/students/{id}/capture-check` | Authenticated teacher/admin with CSRF, student access and active student consent; `image` | Same |
| `POST /v2/face/check-capture` | Private Python service credential; `image` | `{accepted, reasons}` |

Quality rejection is HTTP 200 with `accepted:false` and allowlisted `NO_FACE`, `MULTIPLE_FACES`, `FACE_TOO_SMALL`, `BLUR`, `LIGHTING` or `INVALID_IMAGE`. Invalid consent/image input: 400; authentication/authorization/CSRF: 401/403; empty/oversize input: 413; rate limit or occupied shared CPU slot: 429; disabled/unavailable service or invalid internal response: 503. Responses are `Cache-Control: no-store`. No student identifiers, images or templates are returned by the check. No new database tables, accounts, attendance records or biometric profiles are written. Standard multipart handling may use temporary request files; this is not durable photo storage.

Spring accepts one image up to 7 MiB, validates image format/pixel limits using existing normalization, and bounds the normalized JPEG to 7 MiB. The shared inference semaphore also covers normalization. The local pilot limiter permits 60 requests per remote address per minute and 120 total per process; failed checks count. It deliberately does not read arbitrary forwarding headers. A reverse proxy can make many users share one address. Multi-instance deployment requires a trusted proxy policy and distributed limits before rollout; deployment is out of scope.

## Test checklist

- Clear one-person photo advances; empty/multiple/small/blurry/dark face stays at the same step.
- Rejected preview is visible and not counted among accepted photos.
- Retry and individual replacement preserve the other captures in order.
- Consent withdrawal or cancel during a delayed request never restores a photo.
- Service errors and timeouts keep submission blocked until a valid set exists.
- Anonymous endpoint requires CSRF and current consent; supervised endpoint requires staff access and active consent.
- Final seven-photo verification cannot be bypassed by precheck responses.
- Test with actual volunteer faces and devices separately; synthetic UI tests do not measure face accuracy.

Local startup/shutdown scripts are unchanged; restart backend and Python after switching to this branch. The frontend dev server reloads changes. No production deployment is included.

## Verification record (2026-10-22)

- Python: 14 vision tests passed, including pinned-model no-face precheck and API authentication/size limits.
- Java: 16 registration/integration tests and 2 precheck contract/limiter tests passed. All 4 gateway tests passed separately with the actual Python service enabled (no skipped gateway test in that run).
- Frontend: existing 333 tests passed; 3 new regression tests passed for rejection/retry, cancellation/unmount, timeout and malformed responses. TypeScript/Vite build passed.
- Actual React screens under mocked APIs/synthetic camera: desktop 1440px and mobile 390px; rejected photo blocks advance, service failure, consent withdrawal with a pending response, per-photo replacement, cancellation, supervised enrollment, manual signup and admin review passed without page/console errors. Page identity, nonblank content and absence of framework overlays were checked. Rejection text is scrolled into view.
- Live browser → Spring → pinned Python model: synthetic camera with no face yielded `NO_FACE`, stayed on capture 1, and kept final submission disabled. Missing CSRF returned 403. No account was submitted. Real human positive/unknown/multiple-person accuracy and physical phone compatibility remain unverified.
- Browser plugin was not available; existing Playwright/installed Chrome was used. QA harnesses and screenshots are outside committed source in the session visualization folder (`phase2b-ui-qa.mjs`, `phase2b-results.json`, `phase2b-live-qa.mjs`, `phase2b-live-no-face.png`). Local ignored build logs: `data/phase2b-java.log`, `data/phase2b-live-gateway.log`, `data/phase2b-build.log`, `data/phase2b-frontend-tests.log`.
- After implementation, the user reported that their manual test worked and authorized committing and pushing this branch to their fork. This does not establish multi-person or unknown-face accuracy.
