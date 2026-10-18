# System Architecture

This repository is a SOFTENG 789 research prototype for an AI-enhanced student management and
classroom monitoring system for in-person classes.

## Target Architecture

The project treats Spring Boot as the Education Server. React never calls the AI server directly.
All normal application requests flow through the Education Server.

```text
Teacher / Admin / Student Web Application
        |
        | REST API
        v
Spring Boot
Education Server
        |
        +----------------------+
        |                      |
        v                      v
PostgreSQL              AI Gateway Interfaces
                               |
                               v
                        Provider Adapters
                               |
                               v
                        Laboratory AI Server (CARES)
```

Spring Boot owns:

- Authentication and role-based access control (Student / Teacher / Admin)
- Student, class, campus and room management
- Classroom session and attendance management
- Behaviour-event review
- Health Alerts and Health Incident Reports
- Progress reports, class feedback and AI feedback summaries
- Student accomplishments
- Database persistence
- AI service orchestration through provider-neutral gateway interfaces

The future production computer-vision capability should be provided by the existing CARES AI Server
where available. This project does not duplicate CARES features such as face recognition, CNN/VLM
pipelines, object detection, tracking, or behaviour recognition. Text-only report summarisation is
owned by this project and runs through a private Qwen service.

## Current Local Development Architecture

Until the CARES AI Server API is available, the repository includes a small FastAPI adapter service:

```text
Teacher / Admin / Student Web Application
        |
        v
Spring Boot Education Server
        |
        +----------------------+
        |                      |
        v                      v
PostgreSQL              AI Gateway Interfaces
                               |
                               v
                        HTTP Adapter / Local FastAPI
                               |
             reviewed text-draft requests
                               v
             Private Qwen via OpenAI-compatible runtime
```

The local FastAPI service exists for:

- Development
- API integration testing
- Decoupling the Education Server from the future CARES API
- Testing full vertical slices before production AI integration
- Forwarding minimal, de-identified text-draft context to private Qwen inference

Computer-vision routes remain contract mocks. Report-summary and invoice-message routes use the real
OpenAI-compatible adapter: Ollama or LM Studio locally, and vLLM with Qwen3-30B-A3B in production.
Spring remains responsible for authorization, persistence, teacher approval and publication.

## Roles and Access Control

Three roles: `STUDENT`, `TEACHER`, `ADMIN`. Admin is not a separate entity — it is a `teachers` row
with `role = ADMIN`, so an existing admin can promote a teacher by flipping one column. An admin can do
everything a teacher can, plus staff, campus and class administration.

Authentication issues an opaque bearer token on login/registration, held in an in-memory session map
with a 12-hour TTL (`SessionAuthService`). There is no Spring Security filter chain or JWT; every
controller calls one of four gate methods directly. `LoginAttemptService` separately applies a
configurable failed-login window and temporary block; like the session map, this guard is scoped to
the current backend instance and should move to a shared store before multi-instance deployment.
Browser authentication tracks a credential revision: obsolete 401s and profile-restoration responses
cannot replace a newer login. Storage events synchronize sign-in/out across tabs, and a changed
token remounts the role workspace so one account's in-memory screen state is not reused by another.

### Verification boundaries

`scripts/quality-check.sh` runs migration/security-gate safety tests, backend tests, frontend model/
architecture tests, a production frontend build and AI tests. `sh scripts/check-security.sh` audits
the locked frontend, resolved runtime Maven and installed Python dependencies; network or incomplete
results fail the check, as does every advisory match; there is no applicability exception list.
The backend uses the aligned Spring Boot 4.0 / Spring Framework 7.0 stack, including the fixes for
CVE-2026-47890 and CVE-2026-47884 in Framework 7.0.9. Compatible Jackson 3, Tomcat 11 and JDBC patch
versions are pinned in `backend/pom.xml` where newer than the Boot BOM. JSON uses Jackson 3 with
Boot's Jackson 2-compatible defaults to preserve existing API and stored-report formats; no deprecated
Jackson 2 compatibility module is installed. Face metadata codecs translate JSON errors at the
existing storage boundary so corrupt protected-file metadata keeps its safe failure behaviour.

`python3 scripts/test-postgres-schema.py` creates its own disposable loopback-only PostgreSQL 16
container and validates every ORM mapping against both `schema.sql` and the pre-billing schema
upgraded through migrations. It never connects to the application's database. CI runs all three
checks. These checks do not replace staging tests with real SMTP, payment and vision providers.
Compose database/model ports default to loopback; remote access needs an explicit bind override
and network controls. Authentication/login throttles remain single-instance; demo providers are
not production payment or identity verification.

| Gate method | Allows |
| --- | --- |
| `requireStudentSelf` | Only the signed-in student whose id is in the route (student-portal endpoints) |
| `requireSelfOrTeacher` | That student, or any teacher/admin |
| `requireTeacher` | Any teacher or admin |
| `requireAdmin` | Admin only |

**Per-class scoping** (`TeacherScopeSupport`): an admin can access every class; a teacher only classes
they are assigned to teach (`CourseOffering.isTaughtBy`). This was first built for Health Alerts and
Health Incident Reports and is now shared by `StudentService` and `ClassroomSessionService` — the same
"who is this, are they admin, do they teach this class" check reused across services rather than
reimplemented per feature.

## Feature Modules

The Education Server is organised as one controller/service pair per feature area, all sharing the same
auth gates and, where relevant, the same per-class scoping. See [`modules.md`](modules.md) for the full
file-level map of both the backend and the frontend.

| Area | Owns |
| --- | --- |
| Student & Enrollment | Registration, approval queue, face enrollment, per-class enrollment status |
| Attendance & Sessions | Classroom sessions, attendance records |
| Behaviour Events | AI-candidate observations awaiting teacher review |
| Health Alerts & Incident Reports | AI-detected candidates and the formal incident record |
| Progress Reports & Class Feedback | Per-student notes and whole-class feedback |
| Feedback Summaries | AI-drafted synthesis with a teacher review/publish lifecycle |
| Accomplishments | Teacher-confirmed positive records with student acknowledgement |
| Billing | Invoices, payments, learning entitlements, lesson packages, lesson-credit reconciliation, make-up workflow and account audit history |
| Scheduling | Repeating class patterns, generated sessions, teacher/room availability and single-session adjustments |
| Admin | Campuses, rooms, classes, staff accounts, registration approvals |

### Billing application boundaries

Billing is a vertical module under `billing/`; other feature areas do not manipulate its entities
directly. Its service layer is separated by use case rather than collected in a single account
service:

```text
Billing web adapters
      |
      +-- StudentPaymentsController       statement and checkout
      +-- AdminInvoicesController         invoice and account directories
      +-- ManualPaymentsController        payment evidence and review
      +-- SessionPackageBillingController attendance billing corrections
      |
      v
BillingAccountService (stable facade)
      |
      +-- BillingAccountQueryService       account read model
      +-- BillingAccountActivityService    append-only audit timeline
      +-- BillingOperationsService         operational projections and alerts
            +-- BillingOperationsFinancials period cash flow and current debt
            +-- BillingOperationsAlerts     follow-up queries and rules
            +-- BillingCourseProjection     pure class/student/lesson projection
      +-- SessionPackageLifecycleService   pause/resume/extend/transfer/cancel commands
      +-- PaymentLedgerService             payment/refund ledger semantics

PaymentService                             student checkout and invoice command facade
      +-- InvoiceDraftFactory               draft validation and aggregate construction
      +-- AdminPaymentQueryService          paged administrator invoice projections

LessonCreditService                       allocation and attendance reconciliation
LessonCreditManagementService             absence decisions and make-up bookings

StudentPaymentAccountService              directory query orchestration
      +-- StudentPaymentAccountPolicy      classification and ordering rules
      +-- StudentPaymentAccountAssembler   response projection
```

Transactions and row locks live in command services. Query services are read-only. Revenue remains
attached to the original invoice/course, while a package transfer moves only unused lesson
obligations. Every financial or package command creates an audit activity instead of overwriting
history.

Architecture checks run in the normal quality gate. Backend `ModuleArchitectureTest` checks direct
service/component injection cycles, application-service dependencies on web adapters, and stateless
calculation modules without starting the application. Frontend `moduleArchitecture.test.cjs` checks
runtime import cycles, including re-exports and lazy imports; type-only dependencies are excluded.
These checks complement behavior tests; they do not prove business correctness or performance.

The frontend mirrors these boundaries. `features/payments/index.ts` is the public boundary used by
pages and neighbouring features; `features/payments/api/` is split by transport capability,
`features/payments/types/` is split into core records, directories, invoice preparation and operations,
and the public `api.ts` / `types.ts` files remain compatibility barrels.
Pure neighbouring features use `payments/model.ts`; data-only consumers use `payments/data.ts`.
Do not import the component barrel into a calculation module just to obtain a date helper or type.

`AdminPayments.tsx` renders workspaces while `useAdminPaymentWorkspace` owns cross-workspace transitions and refreshes; approval
navigation and content are separate components. Complex payment forms compose focused editors instead
of owning data loading, validation and every field renderer in one component. Shared browser download
behaviour lives in `lib/saveDownload.ts`, and `features/student-overview/` separates register
presentation from its data-loading workspace. `studentOverviewState.ts` owns scope keys, identity-based
selection and single-student refresh merges. The admin-only `studentoverview/` backend composes one
paginated register response; each class is reconciled once, not once per HTTP page. Full-scope summary
counts still require a scope-wide calculation on the server; this is not database-level pagination.
Attendance writes refresh only the affected student/class unless filter membership or account ordering
changes. Scope changes abort obsolete reads and remove old actionable cells immediately.
Single-class requests project only that class's active approved students. If a partial refresh detects
changed sessions or an invalidated enrolment, it reloads the page instead of mixing old and new cells.
Unsaved attendance edits require confirmation before closing the lesson panel.

`AttendanceRosterPolicy` is the shared historical read boundary for session registers and class/overall
reports: enrolment intervals use the session's explicit Auckland date, and stored attendance marks survive
later enrolment edits. Unmarked pending enrolments create no expected rows. This does not change write
authorization or migrate timestamps. `ClassReportServiceTest` compares single/batch registers with report
counts, including changed enrolment dates and same-day withdrawal.

Course timestamps are real UTC instants; `session_date` and timetable clocks are Pacific/Auckland.
`SessionClock` owns backend conversion and validation; `sessionTime.ts` owns browser-independent
display/edit conversion. Recurrences resolve the offset separately for every occurrence. Ambiguous
or nonexistent DST clocks are rejected rather than silently shifted. Single-session create/update
requests send `timeZone: "Pacific/Auckland"` with UTC instants. Requests without that field are decoded
once as the old client's UTC-digit local clocks; this compatibility boundary does not affect storage
or responses. Conflicts and automatic session transitions compare canonical instants.

Existing databases must use the reviewed `scripts/session-time-migration.py` procedure below before
running this contract. Never infer old encoding only from matching dates. Frozen report JSON and its
rendering are not rewritten; prepare a fresh report to reflect corrected source timestamps.

### Reviewed session time repair

Stop all backend instances first. Keep private plans/backups outside the repository. The tool uses
the local PostgreSQL Docker container and its environment; it never needs credentials in arguments.

```sh
python3 scripts/session-time-migration.py export --output /private/path/plan.csv
# Review every row: fill new_start, new_end (offset-bearing instants) and reason, including unchanged rows.
python3 scripts/session-time-migration.py apply --plan /private/path/plan.csv \
  --batch <new-uuid> --backup-dir /private/path/backups --backend-stopped
```

Apply verifies a readable full database backup, locks sessions, requires complete exact-ID coverage
and unchanged original values, then updates only start/end in one transaction. Every reviewed row is
retained in `classroom_session_time_repairs`; repeating a batch fails. To revert, stop the backend and
run `rollback --batch <same-uuid> --backup-dir /private/path/rollback-backups --backend-stopped`.
Rollback also backs up first and refuses to overwrite subsequent time/date edits or deleted sessions.
Restart the matching backend/frontend together and verify school-local times. Do not restore an old
full dump over newer business data just to undo this repair.

`TeacherApp.tsx` is only the authenticated console shell. Individual teacher and administrator pages
are loaded with React lazy boundaries, so adding a feature does not pull every workspace into the
initial console bundle.

## Example End-to-End Flow: Student Enrollment

The enrollment flow is a useful illustration of how a request crosses the AI gateway boundary:

```text
React Students Page
        |
        v
Capture all seven required face poses
        |
        v
POST multipart student registration
        |
        v
Validate and normalise capture set
        |
        v
FaceEnrollmentGateway -> FastAPI /face/enroll/captures
        |
        v
AI quality + liveness + pose + consistency verification
        |
        +---- Failure/unavailable: stop; create no registration request
        |
        +---- VERIFIED: one DB transaction saves PENDING registration,
              PENDING class enrolments and VERIFIED capture metadata/files
        |
        v
Admin reviews the already verified registration
```

The local FastAPI implementation is a contract sandbox and never pretends to perform production
verification. The explicit Spring demo provider can unblock a UI presentation, while the normal HTTP
provider fails closed until the laboratory service returns `VERIFIED`.

## Data Boundaries

- `Student` stores business data such as student number, email, course, programme, consent, and
  enrollment status.
- `FaceEnrollment` stores biometric enrollment metadata such as image path and status.
- Registration photos are not stored as Base64 in the `students` table.
- Local development photos are written under `data/face-enrollment/`, which is ignored by Git.
- Nothing with history is hard-deleted: a withdrawn student, a cancelled session, a rejected
  registration, a deactivated staff account, a revoked accomplishment and a superseded feedback summary
  are all soft-terminal states on the row itself (`WITHDRAWN` / `CANCELLED` / `REJECTED` /
  `DEACTIVATED` / `REVOKED` / `SUPERSEDED`), so attendance history and audit trails survive intact.
- High-volume classroom-session and behaviour-event collections expose bounded `/page` endpoints;
  the student roster uses `/api/students/directory` so its attendance projection, filters and global
  sorting are applied before the requested slice is returned. Page size is capped at 100, ordering is
  deterministic on the server, and the same teacher-own-class/admin-global boundary is applied before
  pagination. All three use the project-owned `PageResponse` contract rather than Spring Data's
  internal JSON representation.

## Further Reading

- [`ai-integration.md`](ai-integration.md) — the concrete AI gateway contracts and how to plug in a
  real provider.
- [`modules.md`](modules.md) — the backend and frontend file map, by feature area.
- The repository [`README.md`](../README.md) — the current implemented/not-implemented feature list.
