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

Face-enrolment files are written atomically behind a per-student update lock. A storage snapshot
is committed with the database transaction or restored on rollback, so a failed registration
cannot leave orphaned captures or overwrite a previous valid enrolment.

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
| AI feedback summaries | `FeedbackSummaryController`, `StudentFeedbackSummaryController`, `FeedbackSummaryService`, `FeedbackSummaryGateway` with demo/HTTP adapters, `ReportEmailGateway`; FastAPI separates the summary protocol, prompt and OpenAI-compatible provider; entity `FeedbackSummary` | `Reports.tsx`, `features/reports/`, `StudentReportsView.tsx`, `FeedbackSummaryCard.tsx`, `PrepareFeedbackReportModal.tsx`, `feedbackSummaryApi.ts` |
| Student accomplishments | `AccomplishmentController`, `StudentAccomplishmentController`, `AccomplishmentService`, `AccomplishmentFeedbackService`; entities `Accomplishment`, `AccomplishmentFeedback` | `Achievements.tsx`, `StudentAccomplishmentsView.tsx`, `useAccomplishments.ts`, `accomplishmentApi.ts` |
| Student payments | `billing/` vertical module. Controllers separate student statements, admin invoices, manual-payment review, reconciliation and package operations. `PaymentService` delegates draft construction to `InvoiceDraftFactory` and admin reads to `AdminPaymentQueryService`; account, ledger, entitlement, lesson-credit, make-up and delivery rules stay in focused services. | `features/payments/` owns contracts, API adapters, models, hooks and views behind `index.ts`. `classBillingPlanModel.ts` owns plan validation; payment CSS is split by surface. |
| Student schedule | `StudentScheduleController` exposes a self-only read endpoint; `StudentScheduleService` joins active enrolments, published sessions, the student's attendance and lesson-credit coverage into one purpose-built response without exposing teacher session APIs | `StudentScheduleView.tsx` owns the responsive timetable presentation; `studentPortalApi.ts` owns its contract, `useStudentPortalData.ts` loads it independently with partial-failure handling, and `student-schedule.css` is the isolated responsive style layer |
| Student and parent requests | `support/` owns request submission, review state and requester details. `StudentSupportRequestService` controls the request lifecycle; `LeaveRequestApprovalService` is the transactional coordinator that delegates attendance facts to `AttendanceService` and prepaid-lesson decisions to `LessonCreditManagementService`, so support, attendance and billing rules remain separate | `ContactSchoolModal.tsx` submits and tracks requests; `features/student-requests/` owns the admin queue and makes the attendance and prepaid-lesson outcome explicit before approval; `studentSupportApi.ts` owns the shared contract |
| Admin: staff & registrations | `AdminController` (staff accounts), `AdminStudentController` (registration approvals) | `AdminStaff.tsx`, `AdminRegistrations.tsx`, `adminApi.ts` |
