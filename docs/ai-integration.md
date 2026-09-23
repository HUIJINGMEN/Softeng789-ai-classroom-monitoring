# AI Integration Boundary

This document is the hand-off point for anyone implementing the model layer. The web clients never
call a model server directly. Spring Boot owns authentication, authorization, business workflows,
review state, persistence, and reporting. AI providers only analyse inputs or generate drafts.

## Stable application boundaries

The backend currently exposes three provider-neutral Java interfaces:

| Capability | Java boundary | Current implementation | Human decision |
| --- | --- | --- | --- |
| Face-enrollment analysis | `FaceEnrollmentGateway` | `HttpFaceEnrollmentGateway` calling `/face/enroll` | Registration remains pending until the application workflow accepts it |
| Classroom photo recognition | `StudentRecognitionGateway` | `DemoStudentRecognitionGateway` | Teacher confirms or corrects the match before feedback is saved |
| Feedback summarisation | `FeedbackSummaryGateway` | `DemoFeedbackSummaryGateway` | Teacher reviews and approves a draft before export or delivery |
| Report delivery | `ReportEmailGateway` | `DemoReportEmailGateway` / `SmtpReportEmailGateway` | Sends only reports a teacher already approved |

Model-specific request objects, SDKs, confidence calibration, and retry behaviour belong in an
adapter implementing one of these interfaces. Controllers and domain services must not import a
model SDK or construct model prompts.

## Face-enrollment contract

Development endpoint:

```text
POST /face/enroll
Content-Type: multipart/form-data

student_id: string
image: binary image
```

Response:

```json
{
  "studentId": "student-id",
  "imageAccepted": true,
  "aiVerified": false,
  "status": "PHOTO_CAPTURED",
  "message": "Human-readable status"
}
```

`imageAccepted` means the transport accepted a readable image. It must not be treated as identity
verification. A production provider should perform face presence, image quality, liveness (if
available), pose coverage, and duplicate/identity checks before setting `aiVerified`.

When the model service is unavailable, the education server keeps the already-consented photo for
later processing and records the state as `PHOTO_CAPTURED`. It does not invent a successful AI
verification result.

## Recognition and summary rules

- Recognition results must include a student candidate, a calibrated confidence value, and a
  provider/mode label. The gateway receives immutable `RecognitionCandidate` values rather than
  JPA entities. A result is always a suggestion until a teacher confirms it.
- Summary generation receives only feedback already visible to the authenticated teacher for the
  selected student, class, and date range.
- Generated summaries are drafts. They are excluded from export and student delivery until teacher
  approval. A `FeedbackSummary` persists this as an explicit lifecycle (`DRAFT` -> `REVIEWED` ->
  `SUPERSEDED`): once reviewed, it is frozen as the exact record used by exports and the student
  portal, independent of any later edits to the source Progress Reports.
- Health-related AI output is an alert signal, not a medical diagnosis. The application must retain
  the source, confidence, evidence reference, and human review state.

## Adding a laboratory provider

1. Implement the relevant Java gateway in a dedicated adapter class.
2. Select it with a configuration property and Spring `@ConditionalOnProperty`; keep the demo
   implementation available for local development.
3. Map provider-specific payloads into the existing application response records at the adapter
   boundary.
4. Add contract tests for success, timeout, malformed response, and provider-unavailable cases.
5. Never log raw face images, embeddings, access tokens, or full student feedback content.
6. Keep every remote model call outside a database transaction. Load and authorise the minimum
   immutable input in a short read transaction, call the provider, then persist the result in a
   separate short write transaction if the workflow requires storage.

The FastAPI project under `ai-service/` is a development adapter and contract sandbox. Its route
handlers should remain thin; model loading and inference belong under `app/services/` or a new
provider module, with tests under `ai-service/tests/`.
