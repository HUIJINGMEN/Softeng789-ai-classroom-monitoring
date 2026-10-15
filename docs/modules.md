# Module Map

A file-level guide to where each feature lives, for anyone new to the codebase. See
[`architecture.md`](architecture.md) for how the pieces fit together and
[`ai-integration.md`](ai-integration.md) for the AI gateway contracts.

## Backend layering

`backend/src/main/java/io/github/huijingmen/softeng789/classroommonitoring/`

| Package | Contains |
| --- | --- |
| `controller/` | REST endpoints, one class per feature area. Thin — delegates to `service/`. |
| `service/` | Business logic, AI gateway interfaces and their demo/HTTP/SMTP implementations, `SessionAuthService` (auth and sessions), `StaffAccessService` (teacher/admin resource boundaries), `TeacherScopeSupport` (shared per-class scoping) and `PageRequestSupport` (bounded list requests). Remote AI and email calls run outside database transactions. |
| `entity/` | JPA entities, one per database table. |
| `repository/` | Spring Data repositories. |
| `dto/` | Request/response records exposed by controllers, including the stable generic `PageResponse` contract. |
| `client/` | HTTP clients calling out to `ai-service/` (e.g. `HttpFaceEnrollmentGateway`). |
| `config/` | Cross-cutting config such as `CorsConfig`. |

New, self-contained business areas may use a vertical package instead of adding more files to every
global layer. Student billing is the first example: `billing/` keeps its domain, DTOs, repositories,
provider boundary, service and controller together while preserving the same controller-service-
repository dependency direction.

## Student reports

- Backend `reports/`: source evidence, AI adapter, versioned drafts, review, email and frozen publication. Frontend `features/student-reports/` exposes preparation, delivery and published-report views through `index.ts`.
- Queue responsibilities: `useStudentReportWorkspace` loads/filters/pages progress; `useStudentReportEntry` opens/resumes reports and discards late responses; `StudentReportTaskRow` renders identity, photo fallback, status and actions. Preparation checks own `student-report-checks.css`, independent of queue styling.
- Reports → Students is a searchable, course/status-filtered, paginated work queue for exact dates and each student's enrolled offering IDs. `POST /api/student-reports/workspace` is read-only (max 100 scopes per request), authorizes every scope server-side and lists the caller's private drafts separately from published summaries without preparing drafts or invoking AI. An explicitly labelled latest other-scope draft can be resumed when its courses remain within the authorized selection; mobile uses the central report-level navigation.
- Reopening a saved draft prepares its original scope again: current evidence revalidates saved review while preserving wording. Preparation checks disclose missing attendance marks and teacher feedback and link to student records; missing marks are not absences, no-feedback wording stays factual and ineligible achievements are omitted.
- “Save all drafts” writes only changed summaries sequentially using each returned version and `approve: false`. On partial failure, completed saves remain and unsaved edits stay in the editor; saving does not approve, publish or email a report.
- `runSequential` carries each resolved report version into the next write; approval stops on failure, generation records partial failures, and workspace reads remain batched. Do not parallelize these revision-dependent writes.
- Shared `report-review/reportGeneration` and `ReportGenerationDialog` expose per-section states, elapsed time and saved-response percentages for all report types. All-success 100% closes automatically after 650 ms; failures stay visible and never count as saved progress. Refresh evidence before retrying an unconfirmed response. Generation does not approve or deliver; leaving stops subsequent generation requests.
- Both Students/profile and Reports/student use the same editor. Attendance, payments, absences/make-ups and teacher-feedback synthesis are mandatory; achievements appear only for confirmed, report-included records without pending corrections in the selected courses/dates.
- All narratives are visible/editable by default; source records expand on demand. “Save & approve all” saves current wording with sequential version checks, skips unchanged reviewed sections and stops on failure. Remaining edits stay in the editor. Outdated wording can be regenerated or manually checked/edited and explicitly acknowledged against the new evidence before individual or bulk approval. Saving a draft alone does not clear staleness.
- `StudentReportDocument` renders the same approved wording for preview and PDF; internal source records stay in the editor. `reportDocumentModel` handles paragraph/learning-label presentation without rewriting text. Dedicated A4 print styles isolate the document from the app, allow long sections to paginate and add page numbers. Disable browser headers/footers when saving PDF.
- `report-print-isolation.css` hides every body sibling of the active report portal, including `#root`, navigation and dialogs. Explicit overall exports take precedence; otherwise personal reports take precedence over legacy overview/class portals. Never target only `.app` when isolating print output.
- `useMediaQuery` freezes responsive component selection during printing and resumes it on the next screen frame, preventing paper width from unmounting an open report.
- `StudentReportSnapshotBuilder` stores profile, scoped courses, attendance counts/weekly trend, confirmed observations, feedback count and `preparedAt` (data-as-of time, not the original draft creation date). `ReportSessionTime` excludes future dates/starts even if prematurely marked completed. Payment facts come from `PaymentReportEvidence`; charts never use AI-derived numbers. Attendance rate is not engagement. Published snapshots stay frozen; legacy reports do not invent missing historical timestamps or facts. No-feedback reports retain a factual empty-state section.
- `POST /api/student-reports/prepare` resumes a draft by student, creator, courses and dates. Section generation/editing and publication require its current `version`; conflicting edits return 409. Refreshing changed evidence preserves wording but invalidates approval. All sections must be approved before delivery; published reports cannot be edited.
- `ReportRecordsDraft` writes attendance and payment narratives from the same saved snapshot as the charts/tables, without model inference. Scheduled lessons are not lessons attended; invoice `PENDING` is not a payment submission. Draft-policy changes mark existing wording outdated on prepare and preserve manual text for regeneration or explicit human re-review. Published snapshots are not rewritten.
- Payment evidence separates period transactions from current balances; unverified payments are not receipts. Mixed-course/unlinked invoices are excluded explicitly. Attendance gaps are not absences, and booked make-ups are not proof of attendance.
- PDF, email and the student portal use the same reviewed narratives. Email POST requires `{version}` matching the preview (use the returned new version after publication). `StudentReportEmailService` commits a durable claim before SMTP; `(report_id, report_version)` is unique. Repeated requests replay the receipt, including after reopening. Timeout/crash outcomes return `UNKNOWN` and must be checked with the recipient/mail administrator; automatic resend is blocked. This is at-most-one attempt per revision, not an exactly-once SMTP guarantee. PDF and portal delivery remain available.
- Existing databases: apply `20261020_add_student_reports.sql`, then `20261021_add_student_report_email_deliveries.sql` from `database/migrations/` before restarting Spring. Both are additive; fresh installations use `database/schema.sql`.

## Class reports

- Reports → Classes → open a class → **Review & export report**. Four editable sections: attendance, payments, absences/make-ups and class-wide teacher feedback. Personal achievements are excluded, including when reopening older class reports; original stored history is not rewritten. No individual progress notes are substituted for class feedback.
- `reports/ClassReport*` separates historical attendance, class-attributable payments, evidence, versioned review and persistence. `ReportSectionReview` and frontend `features/report-review/` share approval/staleness rules with student reports; class views stay in `features/class-reports/`.
- Attendance is weighted by recorded student marks and respects enrolment dates. Completed class sessions and expected student marks are separate counts. Unknown marks, future sessions and cancelled sessions do not become absences. Charts/registers use the saved snapshot, never model-generated figures.
- Payments group issued, class-only invoices by currency. Mixed/unlinked invoices are explicitly excluded; pending submissions are not receipts. Snapshot balances are not period-only transactions or whole student accounts.
- `/api/class-reports`: prepare; versioned section generate/edit; finalize; get; latest 10 finalized reports per class. Export finalizes a frozen version before printing; **Saved reports** reopens it. Teacher class access is enforced. No student access, portal publication or email route.
- Apply `database/migrations/20261022_add_class_reports.sql` before restarting Spring. Dedicated class PDF pages isolate navigation/dialogs and label financial/student data **Staff only**.

## Overall reports

- Admin → Reports → Overview. Choose **Internal operations** or **Partners & reviewers**, dates and courses (empty selection = all; max 100). No billing/financial data in this edition; teacher overview remains permission-scoped and unchanged.
- `reports/OverallReport*` owns aggregate evidence, raw-count weighting, factual drafts, versioned review and frozen history. Frontend `features/overall-reports/` reuses `features/report-review/` without coupling student/class documents to institution reports.
- Workspace layout separates setup, evidence overview, primary draft editor and reference records. Attendance/completeness show raw counts; scope totals are secondary. Review actions and the route-scoped app header stay in normal flow. `OverallReportSnapshotPanel` changes workspace hierarchy only; preview/print layout remains independent.
- `overall-report.css` is the ordered stylesheet entry: workspace/shared tables → preview → document → responsive → print. Edit the owning file; keep import order because screen and PDF overrides share selectors.
- Unique students are deduplicated across courses. Attendance uses recorded marks; recording completeness uses expected marks. Historical enrolments, past completed sessions and confirmed/corrected observations are reused from class evidence. Missing marks are not absences. Optional achievements count only confirmed, report-included records; no individual detail is exported.
- Numerical sections use snapshot facts, not AI. Only class-wide teacher feedback uses AI, with audience-specific prompts. All sections are editable and must be approved. Changed source records preserve wording but require re-review.
- `/api/overall-reports` is admin-only: prepare, versioned section generate/edit, finalize, get and latest 10 saved reports. Audience is part of draft identity. Partner payloads omit operational issue lists and credit-decision counts; administrators must check free-text privacy before finalization. This is human review, not guaranteed automatic anonymization.
- Export freezes the exact preview even if printing is cancelled. History reads frozen facts, never live records. No email or student-portal publication. Apply `database/migrations/20261023_add_overall_reports.sql` before restarting Spring; fresh installs use `database/schema.sql`.

Face-enrolment files are written atomically behind a per-student update lock. A storage snapshot
is committed with the database transaction or restored on rollback, so a failed registration
cannot leave orphaned captures or overwrite a previous valid enrolment.

### Report maintenance boundaries

- Pages/components consume student, class and overall report `index.ts` exports; `check-frontend-boundaries.sh` rejects internal-path imports. Shared review, approval and generation logic stays in `features/report-review/`.
- Backend services own authorization, optimistic versions and transactions. Evidence builders own source facts; `ReportSectionReview` owns review policy; `ReportDocumentJson` owns typed snapshot serialization and preserves feature-specific errors. Serialization must not fetch live records or alter frozen reports.
- Modal scroll locking uses a screen-only body attribute. Print portals own visibility and page assignment through scoped selectors, not inline overflow overrides or `!important`.
- Run `./scripts/quality-check.sh` after changing report contracts or shared review logic. It runs backend, frontend and AI tests plus the frontend build.

## Frontend layering

`frontend/src/`

| Directory | Contains |
| --- | --- |
| `pages/` | Top-level views, one per screen (`Dashboard.tsx`, `Students.tsx`, `HealthAlerts.tsx`, `AdminClasses.tsx`, ...). `TeacherApp.tsx` is the shell that lazy-loads the selected teacher/admin workspace; `StudentPortal.tsx` is the separate student-facing shell. |
| `components/` | Shared and feature components. `components/auth/` (login/registration), `components/mobile/` (responsive mobile chrome and flows), `components/student/` (student-portal-only views) are role/context-specific subfolders. |
| `features/` | Cohesive vertical modules for screens whose data orchestration or business-derived view model is too large for a page. `features/payments/` keeps payment contracts, API calls, formatting, hooks and admin/student views together; `features/student-profile/` owns profile records and desktop/mobile models; `features/reports/` and `features/class-reports/` own report loading, models and role-specific views; `features/campuses/` owns campus/room management, derived room usage and dialogs; `features/dashboard-attendance/` separates analytics state, chart models, filters and SVG presentation; `features/session-attendance/` owns attendance transforms and resilient cache loading. Pages remain thin coordinators. |
| `hooks/` | Shared data-fetching and state hooks, one per feature area (`useConsole`, `useAuth`, `useHealthAlerts`, `useAccomplishments`, ...). `useConsole` is a compatibility facade composed from focused hooks such as `useConsoleNavigation` and `useConsoleFilters`; new concerns should be added to focused hooks rather than directly to the facade. Server-paged screens share `usePagedResource` for loading, errors and stale-response protection. |
| `lib/` | API clients (one per feature area, e.g. `studentApi.ts`, `healthAlertApi.ts`, `accomplishmentApi.ts`) plus framework-free utilities (formatting, sorting, chart math). |
| `styles/` | Ordered style layers. `theme.css` contains shared tokens and primitives; desktop feature families live in `directories-analytics.css`, `reporting-monitoring.css`, `registration-settings.css`, `console-workspaces.css` and `accomplishments.css`; `print.css` is print-only; mobile and student styles remain in their named surface files. Payments is split by surface (`payments-student`, `payments-admin-directory`, `payments-invoice-flow`, `payments-mobile`, `payments-requests`, `payments-manual`, `payments-admin-workspaces`, `payments-overview`) rather than returning to one monolithic stylesheet. Preserve the import order in `main.tsx` when adding a layer. |

## AI service layering

`ai-service/app/`

| Directory | Contains |
| --- | --- |
| `api/` | FastAPI route handlers. Thin — mirrors the backend controller convention. |
| `models/` | Pydantic request/response models. |
| `services/` | Stable provider protocols and application-owned prompt construction. Computer-vision services remain explicit mocks. |
| `providers/` | OpenAI-compatible adapters. `openai_client.py` owns transport; `openai_runtime.py` owns Ollama, LM Studio and vLLM options shared by report and payment-message providers. |
| `config/` | Validated environment configuration for the selected private inference runtime. |

## Feature areas: backend and frontend files

| Feature area | Backend | Frontend |
| --- | --- | --- |
| Auth & sessions | `AuthController`, `AuthService`, `SessionAuthService`, `LoginAttemptService` | `AuthPage.tsx`, `useAuth.ts`, `authApi.ts` |
| Student & enrollment | `StudentController`, `AdminStudentController` (approve/reject/withdraw), `StaffStudentController` (staff-created registration), `StudentService`, `StudentDirectoryService` (scoped roster filters, attendance projection and paging), `StaffStudentRegistrationService`; entities `Student`, `CourseEnrollment` | `Students.tsx`, `StudentProfile.tsx`, `AddStudentModal.tsx`, `useStudentsData.ts`, `useStudentDirectoryPage.ts`, `studentApi.ts` |
| Face enrollment | `FaceRegistrationVerifier` (registration gate), `FaceEnrollmentGateway` (provider port), `FaceEnrollmentService` (persistence orchestration), `FaceEnrollmentStorageService` (files), `HttpFaceEnrollmentGateway` (HTTP adapter), entity `FaceEnrollment` | `FaceEnrollmentFlow.tsx`, `CameraCapturePanel.tsx`, `useCameraCapture.ts`, `faceEnrollment.ts` |
| Campuses, rooms & classes (Admin) | `CampusController`, `RoomController`, `ClassController` (read), `AdminClassController` (manage), `CampusService`, `RoomService`, `AdminClassService`; entities `Campus`, `Room`, `CourseOffering`, `CourseOfferingTeachers` | `AdminCampuses.tsx`, `features/campuses/`, `AdminClasses.tsx`, `ClassDetail.tsx`, `campusApi.ts`, `roomApi.ts`, `classAdminApi.ts` |
| Attendance & sessions | `AttendanceController`, `ClassroomSessionController`, `AttendanceService`, `ClassroomSessionService`, `ClassroomSchedulePlanner`, `ClassroomSessionSpecifications`; `ClassroomSessionService` owns persistence and lifecycle transitions while `ClassroomSchedulePlanner` owns request resolution, availability and conflict rules; entities `ClassroomSession`, `AttendanceRecord`; bounded batch reads avoid one HTTP request per historical session | `Attendance.tsx`, `SessionDetail.tsx`, `useSessionAttendance.ts`, `useSessionDirectoryPage.ts`, `features/session-attendance/`, `classroomApi.ts`, `attendanceAnalytics.ts`. `features/class-schedule/scheduleModel.ts` is the framework-free source for recurrence, generated sessions and availability groups; `ClassScheduleBuilder` renders and submits that model rather than duplicating scheduling rules in JSX. |
| AI behaviour events | `BehaviourEventIngestController` (authenticated machine boundary), `BehaviourEventController`, `BehaviourEventService`, `BehaviourEventSpecifications`, `AiServiceAuthenticator`, `AiObservationContextResolver`, `EventTypeMapper`; entity `BehaviourEvent` | `Events.tsx`, `EventCard.tsx`, `useEventReview.ts`, `useBehaviourEventPage.ts`, `behaviourEventApi.ts` |
| Health Alerts & Incident Reports | `HealthEventIngestController` (authenticated machine boundary), `HealthAlertController`, `HealthIncidentReportController`, `HealthAlertService`, `HealthIncidentReportService`, `AiServiceAuthenticator`, `AiObservationContextResolver`, `TeacherScopeSupport`; entities `HealthAlert`, `HealthIncidentReport` | `HealthAlerts.tsx`, `AdminHealthAlerts.tsx`, `useHealthAlerts.ts`, `useHealthIncidentReports.ts`, `healthAlertApi.ts`, `healthIncidentApi.ts` |
| Progress reports & class feedback | `ProgressReportController`, `ClassFeedbackController`, `ProgressReportService`, `ProgressReportStorageService`, `ClassFeedbackService`; entities `ProgressReport`, `ClassFeedback` | `ClassReportsTab.tsx`, `CreateFeedbackModal.tsx`, `progressReportApi.ts`, `classFeedbackApi.ts` |
| AI feedback summaries | Legacy overview uses `FeedbackSummaryService`; student/class reports use `reports/` for versioned sections and snapshots. FastAPI separates protocol, prompts and provider. | `features/reports/`, `features/student-reports/`, `features/class-reports/` share `features/report-review/` approval/editing; `StudentReportsView.tsx` shows published personal reports. |
| Student accomplishments | `AccomplishmentController`, `StudentAccomplishmentController`, `AccomplishmentService`, `AccomplishmentFeedbackService`; entities `Accomplishment`, `AccomplishmentFeedback` | `Achievements.tsx`, `StudentAccomplishmentsView.tsx`, `useAccomplishments.ts`, `accomplishmentApi.ts` |
| Student payments | `billing/` vertical module. Controllers separate student statements, admin invoices, manual-payment review, reconciliation and package operations. `PaymentService` delegates draft construction to `InvoiceDraftFactory` and admin reads to `AdminPaymentQueryService`; account, ledger, entitlement, lesson-credit, make-up and delivery rules stay in focused services. | `features/payments/` owns contracts, API adapters, models, hooks and views behind `index.ts`. `classBillingPlanModel.ts` owns plan validation; payment CSS is split by surface. |
| Student schedule | `StudentScheduleController` exposes a self-only read endpoint; `StudentScheduleService` joins active enrolments, published sessions, the student's attendance and lesson-credit coverage into one purpose-built response without exposing teacher session APIs | `StudentScheduleView.tsx` owns the responsive timetable presentation; `studentPortalApi.ts` owns its contract, `useStudentPortalData.ts` loads it independently with partial-failure handling, and `student-schedule.css` is the isolated responsive style layer |
| Student and parent requests | `support/` owns request submission, review state and requester details. `StudentSupportRequestService` controls the request lifecycle; `LeaveRequestApprovalService` is the transactional coordinator that delegates attendance facts to `AttendanceService` and prepaid-lesson decisions to `LessonCreditManagementService`, so support, attendance and billing rules remain separate | `ContactSchoolModal.tsx` submits and tracks requests; `features/student-requests/` owns the admin queue and makes the attendance and prepaid-lesson outcome explicit before approval; `studentSupportApi.ts` owns the shared contract |
| Admin: staff & registrations | `AdminController` (staff accounts), `AdminStudentController` (registration approvals) | `AdminStaff.tsx`, `AdminRegistrations.tsx`, `adminApi.ts` |
