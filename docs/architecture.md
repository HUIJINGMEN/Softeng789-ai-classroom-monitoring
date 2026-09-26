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

The future production AI capability should be provided by the existing CARES AI Server where
available. This project should not duplicate CARES AI features such as face recognition, CNN/VLM/LLM
pipelines, object detection, tracking, or behaviour recognition.

## Current Local Development Architecture

Until the CARES AI Server API is available, the repository includes a small FastAPI mock service:

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
                        HTTP Adapter / Local FastAPI Mock
```

The local FastAPI service exists only for:

- Development
- API integration testing
- Decoupling the Education Server from the future CARES API
- Testing full vertical slices before production AI integration

FastAPI Mock != Final AI Server.

## Roles and Access Control

Three roles: `STUDENT`, `TEACHER`, `ADMIN`. Admin is not a separate entity — it is a `teachers` row
with `role = ADMIN`, so an existing admin can promote a teacher by flipping one column. An admin can do
everything a teacher can, plus staff, campus and class administration.

Authentication issues an opaque bearer token on login/registration, held in an in-memory session map
with a 12-hour TTL (`SessionAuthService`). There is no Spring Security filter chain or JWT; every
controller calls one of four gate methods directly. `LoginAttemptService` separately applies a
configurable failed-login window and temporary block; like the session map, this guard is scoped to
the current backend instance and should move to a shared store before multi-instance deployment.

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
| Admin | Campuses, rooms, classes, staff accounts, registration approvals |

## Example End-to-End Flow: Student Enrollment

The enrollment flow is a useful illustration of how a request crosses the AI gateway boundary:

```text
React Students Page
        |
        v
Capture registration photo
        |
        v
POST /api/students
        |
        v
Spring Boot Education Server
        |
        v
PostgreSQL
        |
        v
POST /api/students/{id}/face-enrollment
        |
        +---- Save image locally under data/face-enrollment/
        |
        +---- FaceEnrollmentGateway -> HTTP adapter -> Local FastAPI Mock /face/enroll
        |
        v
Update faceEnrollmentStatus in PostgreSQL
```

The local mock accepts image uploads and returns `PHOTO_CAPTURED` when the file is readable as an
image. It does not perform face detection, face recognition, embeddings, YOLO, tracking, or any other
AI inference.

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
