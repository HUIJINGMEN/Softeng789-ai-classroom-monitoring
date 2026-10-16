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
parameters only when required: local development uses Ollama or LM Studio, while production uses vLLM with
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

Student reports reuse `/summaries/feedback` with an optional `section`:
`ATTENDANCE`, `PAYMENTS`, `ABSENCES`, `LEARNING` (default, backwards-compatible), or `ACHIEVEMENTS`.
Spring generates attendance and payment wording directly from the saved report snapshot via
`ReportRecordsDraft` (provider `RECORDS`), not AI. `reports/ReportNarrativeGateway` sends only
absence/make-up, teacher-feedback or achievement evidence to the model. Non-learning sections use
`summary`; learning retains `summary`, `strengths` and `nextSteps` from teacher feedback. Drafts,
manual edits and approval are saved per section. AI failure changes no saved wording; invalid
output fails closed. Requests exceeding 100 evidence entries, 4,000 characters per entry or
48,000 total characters require a narrower scope or manual wording, never silent truncation.

Report tone is warm, respectful and evidence-led, with separate guidance per topic. Learning
recognises recorded strengths, keeps concerns visible and suggests manageable next steps. Payments
use courteous reminders, distinguish confirmed receipts from pending submissions, and never invent
concessions or apply emotional pressure. Missing evidence is not a student failing; encouragement
must not create unsupported praise or hide outstanding balances. A teacher note's narrower time
scope must not be expanded to the full reporting period. These are prompt constraints,
not a guarantee of factual accuracy; human review remains required.

Class reports use the same endpoint with `audience: "CLASS"` (`"STUDENT"` remains the default). The class prompt uses constructive staff-facing wording and preserves the source note's time scope. Only class-wide feedback is supplied; student achievements stay in personal reports. Class attendance, payments and absence counts use deterministic snapshot wording (`RECORDS`); teacher feedback can use AI, with editable drafts and explicit approval.

## 6. Attendance-aware invoice message draft

Overall reports reuse `/summaries/feedback` with `audience: "INTERNAL"` or `"PARTNER"` and `section: "LEARNING"` only. Other overall AI sections are rejected. Prompts use class-wide notes, preserve narrow evidence scope and prohibit invented outcomes, personal identifiers/private circumstances and financial claims. Numerical narratives are generated from saved Spring facts. Partner export additionally requires human privacy review; prompts are not an anonymization guarantee.

## Admin read-only assistant

`POST /api/admin/assistant/ask` requires an admin session. Spring sends the question, up to four previous user questions, Auckland's current date and optional selected-student context to `POST /assistant/plan`. The adapter reuses the private `LLM_*` runtime settings and returns a strict typed plan: attendance, absences, schedule, current payments, pending verification, student count or unsupported.

Student counts aggregate unique current student records: approved total with active/withdrawn breakdown, pending registrations excluded and shown separately. Exact total-count phrases bypass inference (`SOURCE_RECORDS`); paraphrases use the typed `STUDENT_COUNT` plan. Previous student/course/date scope is not inherited by direct counts. Historical, course-filtered or status-only counts are not supported; no enrolment rows or capped search results are used as headcounts.

The model receives no attendance ledger, invoices, bank evidence or private notes. It cannot execute SQL or operations. Spring validates the plan, resolves ambiguous students, runs whitelisted read tools and renders factual answers with source links. Chinese response language and unambiguous “next day” follow-ups are checked independently of inference. Financial answers never substitute historical totals for current balances.

Contextual follow-up buttons retain the selected student, not a later unrelated conversation scope. Cross-topic payment questions clear course filters. Payment totals use only returned invoices, separate currencies and disclose truncation; a saved invoice status inconsistent with its ledger is flagged for human checking, never corrected by the assistant.

When a response needs student clarification, the browser may resubmit the original question with `studentSearch` (1–120 characters), its read-only context and optional `selectedStudentId`. Spring resolves this typed scope directly (`provider: SOURCE_RECORDS`), with no second inference. A scope is required; unsupported intents, an already selected student, blank/overlong names and ranges over 31 days are rejected. Choices are validated against literal matching records. This is an admin-only read path, not an authenticated capability token or a mutation endpoint.

Inference runs outside database transactions. Authentication is checked again afterward; one question may run per admin at a time. Spring's `ai.assistant.read-timeout` defaults to `90s`; the browser aborts at 95s. Failures return a retryable error, never demo facts. Conversation stays in browser memory only, survives drawer closing/navigation and is discarded at logout. Restart both Spring and FastAPI after deploying the module; no schema migration is required.

Java boundary: `PaymentMessageGateway`. Spring calculates the financial balance and session-package
usage first, then sends only the minimum non-identifying context to FastAPI
`/summaries/payment-message`: class label, purchased/attended/chargeable-absence/remaining counts, amount due,
due date and the requested `ENCOURAGE` or `NOTICE` tone. Names, email addresses, receipt images and
payment evidence never leave the application boundary.

The model returns one short plain-text draft. The administrator must review or edit it before
delivery. Spring persists the reviewed wording separately from delivery state, renders that exact
wording into the PDF, and records `lastEmailedAt` only after the SMTP gateway reports success.
Malformed model output or an unavailable provider fails without silently inventing a message.

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
