# Module Map

A file-level guide to where each feature lives, for anyone new to the codebase. See
[`architecture.md`](architecture.md) for how the pieces fit together and
[`ai-integration.md`](ai-integration.md) for the AI gateway contracts.

## Backend layering

`backend/src/main/java/io/github/huijingmen/softeng789/classroommonitoring/`

| Package | Contains |
| --- | --- |
| `controller/` | REST endpoints, one class per feature area. Thin — delegates to `service/`. |
| `service/` | Business logic, the three/four AI gateway interfaces and their demo/HTTP/SMTP implementations, `SessionAuthService` (auth, sessions, RBAC gates) and `TeacherScopeSupport` (shared per-class scoping). |
| `entity/` | JPA entities, one per database table. |
| `repository/` | Spring Data repositories. |
| `dto/` | Request/response records exposed by controllers. |
| `client/` | HTTP clients calling out to `ai-service/` (e.g. `HttpFaceEnrollmentGateway`). |
| `config/` | Cross-cutting config such as `CorsConfig`. |

## Frontend layering

`frontend/src/`

| Directory | Contains |
| --- | --- |
| `pages/` | Top-level views, one per screen (`Dashboard.tsx`, `Students.tsx`, `HealthAlerts.tsx`, `AdminClasses.tsx`, ...). `TeacherApp.tsx` is the shell that switches between them for teacher/admin; `StudentPortal.tsx` is the separate student-facing shell. |
| `components/` | Shared and feature components. `components/auth/` (login/registration), `components/mobile/` (responsive mobile chrome and flows), `components/student/` (student-portal-only views) are role/context-specific subfolders. |
| `hooks/` | Data-fetching and state hooks, one per feature area (`useConsole`, `useAuth`, `useHealthAlerts`, `useAccomplishments`, ...) — this is where API calls, loading state and derived view state live, kept out of the page components. |
| `lib/` | API clients (one per feature area, e.g. `studentApi.ts`, `healthAlertApi.ts`, `accomplishmentApi.ts`) plus framework-free utilities (formatting, sorting, chart math). |

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
| Campuses, rooms & classes (Admin) | `CampusController`, `RoomController`, `ClassController` (read), `AdminClassController` (manage), `CampusService`, `RoomService`, `AdminClassService`; entities `Campus`, `Room`, `CourseOffering`, `CourseOfferingTeachers` | `AdminCampuses.tsx`, `AdminClasses.tsx`, `ClassDetail.tsx`, `campusApi.ts`, `roomApi.ts`, `classAdminApi.ts` |
| Attendance & sessions | `AttendanceController`, `ClassroomSessionController`, `AttendanceService`, `ClassroomSessionService`; entities `ClassroomSession`, `AttendanceRecord` | `Attendance.tsx`, `SessionDetail.tsx`, `useSessionAttendance.ts`, `classroomApi.ts`, `attendanceAnalytics.ts` |
| AI behaviour events | `BehaviourEventController`, `BehaviourEventService`, `EventTypeMapper`; entity `BehaviourEvent` | `Events.tsx`, `EventCard.tsx`, `useEventReview.ts`, `behaviourEventApi.ts` |
| Health Alerts & Incident Reports | `HealthAlertController`, `HealthEventIngestController`, `HealthIncidentReportController`, `HealthAlertService`, `HealthIncidentReportService`, `TeacherScopeSupport`; entities `HealthAlert`, `HealthIncidentReport` | `HealthAlerts.tsx`, `AdminHealthAlerts.tsx`, `useHealthAlerts.ts`, `useHealthIncidentReports.ts`, `healthAlertApi.ts`, `healthIncidentApi.ts` |
| Progress reports & class feedback | `ProgressReportController`, `ClassFeedbackController`, `ProgressReportService`, `ProgressReportStorageService`, `ClassFeedbackService`; entities `ProgressReport`, `ClassFeedback` | `ClassReportsTab.tsx`, `CreateFeedbackModal.tsx`, `progressReportApi.ts`, `classFeedbackApi.ts` |
| AI feedback summaries | `FeedbackSummaryController`, `StudentFeedbackSummaryController`, `FeedbackSummaryService`, `FeedbackSummaryGateway`/`DemoFeedbackSummaryGateway`, `ReportEmailGateway`; entity `FeedbackSummary` | `Reports.tsx`, `StudentReportsView.tsx`, `FeedbackSummaryCard.tsx`, `PrepareFeedbackReportModal.tsx`, `feedbackSummaryApi.ts` |
| Student accomplishments | `AccomplishmentController`, `StudentAccomplishmentController`, `AccomplishmentService`, `AccomplishmentFeedbackService`; entities `Accomplishment`, `AccomplishmentFeedback` | `Achievements.tsx`, `StudentAccomplishmentsView.tsx`, `useAccomplishments.ts`, `accomplishmentApi.ts` |
| Admin: staff & registrations | `AdminController` (staff accounts), `AdminStudentController` (registration approvals) | `AdminStaff.tsx`, `AdminRegistrations.tsx`, `adminApi.ts` |
