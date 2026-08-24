# System Architecture

This repository is a SOFTENG 789 research prototype for an AI-enhanced student management and
classroom monitoring system for in-person classes.

## Target Architecture

The project treats Spring Boot as the Education Server. React never calls the AI server directly.
All normal application requests flow through the Education Server.

```text
Teacher Web Application
        |
        | REST API
        v
Spring Boot
Education Server
        |
        +----------------------+
        |                      |
        v                      v
PostgreSQL              AiServerClient
                               |
                               v
                        CARES AI Server
                        (future / production)
```

Spring Boot owns:

- Student management
- Classroom session management
- Attendance records
- Behaviour event review
- Reports
- Database persistence
- AI service integration through `AiServerClient`

The future production AI capability should be provided by the existing CARES AI Server where
available. This project should not duplicate CARES AI features such as face recognition, CNN/VLM/LLM
pipelines, object detection, tracking, or behaviour recognition.

## Current Local Development Architecture

Until the CARES AI Server API is available, the repository includes a small FastAPI mock service:

```text
Teacher Web Application
        |
        v
Spring Boot Education Server
        |
        +----------------------+
        |                      |
        v                      v
PostgreSQL              AiServerClient
                               |
                               v
                        Local FastAPI Mock
```

The local FastAPI service exists only for:

- Development
- API integration testing
- Decoupling the Education Server from the future CARES API
- Testing full vertical slices before production AI integration

FastAPI Mock != Final AI Server.

## Student Enrollment Vertical Slice

The first real end-to-end slice is student enrollment:

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
        +---- AiServerClient -> Local FastAPI Mock /face/enroll
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

## Current Scope

Implemented:

- React teacher-facing console and a separate student portal
- Student and Teacher authentication (registration, login, bearer-token sessions backed by PostgreSQL)
- Spring Boot Education Server endpoints for student enrollment
- PostgreSQL persistence for students and face enrollment metadata
- Local FastAPI mock endpoint for face enrollment image acceptance

Not implemented:

- Face recognition
- Face detection
- Face embeddings
- YOLO
- Object tracking
- Pose estimation
- Behaviour recognition
- LLM / VLM integration
- Admin portal
