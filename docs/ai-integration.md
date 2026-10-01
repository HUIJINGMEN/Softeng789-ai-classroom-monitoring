# AI integration contract

This is the hand-off contract for the laboratory AI service. The React clients never call AI
directly. Spring Boot owns accounts, authorization, review state, persistence and reporting; AI
only verifies captures, proposes identities/events, or produces draft text.

## Non-negotiable workflow rules

1. Student registration is **not created** until all seven captures pass AI verification.
2. An unavailable, malformed or negative face-verification response fails closed. No student,
   pending class enrolment or Admin review item is written.
3. Behaviour and health results are candidate observations, never confirmed facts. They enter a
   human review queue.
4. Recognition is a suggestion that a teacher confirms or corrects before feedback is saved.
5. Generated summaries are drafts and cannot be exported or delivered until a teacher approves
   them.
6. Raw images, embeddings, secrets and full feedback text must never be logged.

## Configuration and authentication

Outbound AI URL: `AI_SERVICE_URL` (default `http://127.0.0.1:8000`).

Inbound event endpoints require:

```text
X-AI-Service-Key: <AI_INGEST_KEY>
```

If `AI_INGEST_KEY` is blank, ingestion is disabled with HTTP 503. An invalid key returns 401.
Use a long random secret and send AI traffic over TLS outside local development.

## 1. Registration face verification

The stable cross-system identity is the university student number. It is sent as `subject_id` and
is also present in classroom recognition candidates.

```text
POST /face/enroll/captures
Content-Type: multipart/form-data

subject_id: TEST-0001
poses: ["front","slight_left","left","slight_right","right","chin_up","chin_down"]
images: <one JPEG part per pose, in the same order>
```

Exactly seven unique poses are required. Spring validates and normalises each image before calling
AI. The provider should check one face per image, image quality, pose coverage, liveness/spoofing,
and consistency that all captures represent the same person. Duplicate-enrolment detection is
recommended where policy permits it.

```json
{
  "studentId": "TEST-0001",
  "imageAccepted": true,
  "aiVerified": true,
  "status": "VERIFIED",
  "message": "Seven captures passed quality and liveness checks.",
  "provider": "cares-face-v1"
}
```

Success requires all of: matching `studentId`, `imageAccepted=true`, `aiVerified=true`, and
`status="VERIFIED"`. HTTP errors, timeouts, empty responses and every other status block
registration. `FACE_ENROLLMENT_PROVIDER=demo` exists only for explicit demonstrations and is
labelled `DEMO`; the normal default is `http`.

Registration sequence:

```text
account + classes -> seven captures -> AI VERIFIED -> database transaction creates
PENDING student + PENDING class enrolments + VERIFIED face record -> Admin approve/reject
```

Admin approval also checks the persisted `VERIFIED` state as defence in depth, but this is not the
primary gate: an unverified request should never reach Admin.

## 2. Classroom behaviour observations

The laboratory posts candidate observations to the education server:

```text
POST /api/ai/behaviour-events
Content-Type: application/json
X-AI-Service-Key: ...
```

```json
{
  "externalEventId": "camera-303-g14-20260930-000184",
  "sessionId": "11111111-1111-4111-8111-111111111111",
  "studentId": "22222222-2222-4222-8222-222222222222",
  "trackId": "track-37",
  "eventType": "Prolonged head-down posture",
  "confidence": 0.82,
  "detectedAt": "2026-09-30T01:15:24Z",
  "durationSeconds": 25,
  "evidenceUrl": "https://evidence.example/events/000184",
  "modelVersion": "cares-behaviour-1.3.0"
}
```

`studentId` may be null when tracking succeeded but identity is unresolved. When supplied, it must
be an active member of the session's class. `externalEventId` is the provider's stable idempotency
key: retrying it returns the existing event rather than duplicating the teacher's queue. All new
events start `PENDING_REVIEW`; only teacher/admin actions can confirm, reject or correct them.

## 3. Health and safety warnings

Health AI is deliberately warning-only and must not claim diagnosis.

```text
POST /api/ai/health-events
Content-Type: application/json
X-AI-Service-Key: ...
```

```json
{
  "externalEventId": "camera-303-g14-health-000031",
  "studentId": "22222222-2222-4222-8222-222222222222",
  "sessionId": "11111111-1111-4111-8111-111111111111",
  "trackId": "track-37",
  "eventType": "Possible fall",
  "confidence": 0.93,
  "detectedAt": "2026-09-30T01:14:58Z",
  "durationSeconds": 8,
  "evidenceUrl": "https://evidence.example/health/000031",
  "modelVersion": "cares-safety-0.8.0"
}
```

The identified student must be actively enrolled in the session's class. The same
`externalEventId` retry is idempotent. The result starts `AWAITING_REVIEW`. A teacher may dismiss
it or confirm/correct it; only confirmation creates a permanent health incident report.

## 4. Classroom identity suggestion

Java boundary: `StudentRecognitionGateway`.

Input is a JPEG plus only the students actively enrolled in the selected class. Each candidate has
`studentId`, `studentNumber`, and `fullName`; `studentNumber` matches face-enrolment `subject_id`.
Output is:

```json
{
  "studentId": "22222222-2222-4222-8222-222222222222",
  "confidence": 0.91,
  "mode": "CARES_FACE_V1"
}
```

The returned ID must be one of the supplied candidates. Low-confidence and no-match handling stays
explicit; a teacher must confirm or choose another student before the feedback workflow continues.
The current `DemoStudentRecognitionGateway` is deterministic presentation data, clearly labelled
`DEMO`, and is not real recognition.

## 5. Feedback summary draft

Java boundary: `FeedbackSummaryGateway`. The business service resolves access before the remote call.
The HTTP adapter omits direct student identity and sends class label, date range, and only feedback
already visible to the authenticated teacher to FastAPI `/summaries/feedback`. FastAPI calls a
private OpenAI-compatible Qwen endpoint with a strict JSON schema. The provider adds runtime-specific
parameters only when required: local development uses LM Studio, while production uses vLLM with
thinking disabled. Output is:

```json
{
  "summary": "Concise progress synthesis...",
  "strengths": "Observed strengths...",
  "nextSteps": "Concrete next steps...",
  "provider": "QWEN:Qwen/Qwen3-30B-A3B"
}
```

The application persists the output as `DRAFT`. Teacher review freezes the exact approved wording;
only reviewed summaries may appear in exported or delivered reports. Invalid JSON, incomplete output
or unavailable inference fails the request without saving a draft. The demo generator is never
presented as production AI.

## Adapter implementation rules

- Put provider SDK/payload mapping in a dedicated adapter, never in controllers or domain services.
- Select providers through `@ConditionalOnProperty`; demo and production beans must never both load.
- Keep remote calls outside database transactions.
- Set bounded connect/read timeouts and fail closed for face verification.
- Test success, rejection/no-match, timeout, malformed response, unavailable provider, duplicate
  event retry, and mismatched identity.
- Keep evidence behind an authenticated URL with retention controls; do not embed video blobs in
  event JSON.

The FastAPI project under `ai-service/` is a contract sandbox. Route handlers stay thin, application
ports and prompts live under `app/services/`, and inference API details live under `app/providers/`.
