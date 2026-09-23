# Module Map

A file-level guide to where each feature lives, for anyone new to the codebase. See
[`architecture.md`](architecture.md) for how the pieces fit together and
[`ai-integration.md`](ai-integration.md) for the AI gateway contracts.

## Backend layering

`backend/src/main/java/io/github/huijingmen/softeng789/classroommonitoring/`

| Package | Contains |
| --- | --- |
| `controller/` | REST endpoints, one class per feature area. Thin — delegates to `service/`. |
| `service/` | Business logic, AI gateway interfaces and their demo/HTTP/SMTP implementations, `SessionAuthService` (auth and sessions), `StaffAccessService` (teacher/admin resource boundaries) and `TeacherScopeSupport` (shared per-class scoping). Remote AI and email calls run outside database transactions. |
| `entity/` | JPA entities, one per database table. |
| `repository/` | Spring Data repositories. |
| `dto/` | Request/response records exposed by controllers. |
| `client/` | HTTP clients calling out to `ai-service/` (e.g. `HttpFaceEnrollmentGateway`). |
| `config/` | Cross-cutting config such as `CorsConfig`. |

Face-enrolment files are written atomically behind a per-student update lock. A storage snapshot
is committed with the database transaction or restored on rollback, so a failed registration
cannot leave orphaned captures or overwrite a previous valid enrolment.

## Frontend layering

`frontend/src/`

| Directory | Contains |
| --- | --- |
| `pages/` | Top-level views, one per screen (`Dashboard.tsx`, `Students.tsx`, `HealthAlerts.tsx`, `AdminClasses.tsx`, ...). `TeacherApp.tsx` is the shell that switches between them for teacher/admin; `StudentPortal.tsx` is the separate student-facing shell. |
| `components/` | Shared and feature components. `components/auth/` (login/registration), `components/mobile/` (responsive mobile chrome and flows), `components/student/` (student-portal-only views) are role/context-specific subfolders. |
| `features/` | Cohesive feature modules for screens whose data orchestration or business-derived view model is too large for a page. `features/student-profile/` owns profile records and desktop/mobile models; `features/reports/` and `features/class-reports/` own report loading, models and role-specific views; `features/campuses/` owns campus/room management, derived room usage and dialogs; `features/dashboard-attendance/` separates analytics state, chart models, filters and SVG presentation; `features/session-attendance/` owns attendance transforms and resilient cache loading. Pages remain thin coordinators. |
| `hooks/` | Shared data-fetching and state hooks, one per feature area (`useConsole`, `useAuth`, `useHealthAlerts`, `useAccomplishments`, ...). `useConsole` is a compatibility facade composed from focused hooks such as `useConsoleNavigation` and `useConsoleFilters`; new concerns should be added to focused hooks rather than directly to the facade. |
| `lib/` | API clients (one per feature area, e.g. `studentApi.ts`, `healthAlertApi.ts`, `accomplishmentApi.ts`) plus framework-free utilities (formatting, sorting, chart math). |
| `styles/` | Ordered style layers. `theme.css` contains shared tokens and primitives; desktop feature families live in `directories-analytics.css`, `reporting-monitoring.css`, `registration-settings.css`, `console-workspaces.css` and `accomplishments.css`; `print.css` is print-only; mobile and student styles remain in their named surface files. Preserve the import order in `main.tsx` when adding a layer. |

## AI service layering

`ai-service/app/`

| Directory | Contains |
| --- | --- |
| `api/` | FastAPI route handlers. Thin — mirrors the backend controller convention. |
| `services/` | Mock business logic (`face_enrollment.py`, `person_detector.py`). This is where a real model implementation would replace the mock. |
| `models/` | Pydantic request/response models. |

## Feature areas: backend and frontend files

| Feature area | Backend | Frontend |
| --- | --- | --- |
| Auth & sessions | `AuthController`, `AuthService`, `SessionAuthService` | `AuthPage.tsx`, `useAuth.ts`, `authApi.ts` |
| Student & enrollment | `StudentController`, `AdminStudentController` (approve/reject/withdraw), `StaffStudentController` (staff-created registration), `StudentService`, `StaffStudentRegistrationService`; entities `Student`, `CourseEnrollment` | `Students.tsx`, `StudentProfile.tsx`, `AddStudentModal.tsx`, `useStudentsData.ts`, `studentApi.ts` |
| Face enrollment | `FaceEnrollmentGateway`/`FaceEnrollmentService`/`FaceEnrollmentStorageService`, `HttpFaceEnrollmentGateway` (client), entity `FaceEnrollment` | `FaceEnrollmentFlow.tsx`, `CameraCapturePanel.tsx`, `useCameraCapture.ts`, `faceEnrollment.ts` |
| Campuses, rooms & classes (Admin) | `CampusController`, `RoomController`, `ClassController` (read), `AdminClassController` (manage), `CampusService`, `RoomService`, `AdminClassService`; entities `Campus`, `Room`, `CourseOffering`, `CourseOfferingTeachers` | `AdminCampuses.tsx`, `features/campuses/`, `AdminClasses.tsx`, `ClassDetail.tsx`, `campusApi.ts`, `roomApi.ts`, `classAdminApi.ts` |
| Attendance & sessions | `AttendanceController`, `ClassroomSessionController`, `AttendanceService`, `ClassroomSessionService`; entities `ClassroomSession`, `AttendanceRecord` | `Attendance.tsx`, `SessionDetail.tsx`, `useSessionAttendance.ts`, `features/session-attendance/`, `classroomApi.ts`, `attendanceAnalytics.ts` |
| AI behaviour events | `BehaviourEventController`, `BehaviourEventService`, `EventTypeMapper`; entity `BehaviourEvent` | `Events.tsx`, `EventCard.tsx`, `useEventReview.ts`, `behaviourEventApi.ts` |
| Health Alerts & Incident Reports | `HealthAlertController`, `HealthEventIngestController`, `HealthIncidentReportController`, `HealthAlertService`, `HealthIncidentReportService`, `TeacherScopeSupport`; entities `HealthAlert`, `HealthIncidentReport` | `HealthAlerts.tsx`, `AdminHealthAlerts.tsx`, `useHealthAlerts.ts`, `useHealthIncidentReports.ts`, `healthAlertApi.ts`, `healthIncidentApi.ts` |
| Progress reports & class feedback | `ProgressReportController`, `ClassFeedbackController`, `ProgressReportService`, `ProgressReportStorageService`, `ClassFeedbackService`; entities `ProgressReport`, `ClassFeedback` | `ClassReportsTab.tsx`, `CreateFeedbackModal.tsx`, `progressReportApi.ts`, `classFeedbackApi.ts` |
| AI feedback summaries | `FeedbackSummaryController`, `StudentFeedbackSummaryController`, `FeedbackSummaryService`, `FeedbackSummaryGateway`/`DemoFeedbackSummaryGateway`, `ReportEmailGateway`; entity `FeedbackSummary` | `Reports.tsx`, `features/reports/`, `StudentReportsView.tsx`, `FeedbackSummaryCard.tsx`, `PrepareFeedbackReportModal.tsx`, `feedbackSummaryApi.ts` |
| Student accomplishments | `AccomplishmentController`, `StudentAccomplishmentController`, `AccomplishmentService`, `AccomplishmentFeedbackService`; entities `Accomplishment`, `AccomplishmentFeedback` | `Achievements.tsx`, `StudentAccomplishmentsView.tsx`, `useAccomplishments.ts`, `accomplishmentApi.ts` |
| Admin: staff & registrations | `AdminController` (staff accounts), `AdminStudentController` (registration approvals) | `AdminStaff.tsx`, `AdminRegistrations.tsx`, `adminApi.ts` |
