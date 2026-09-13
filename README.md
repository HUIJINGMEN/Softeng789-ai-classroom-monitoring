# AI Enhanced Classroom Monitoring System

SOFTENG 789 research project: **AI enhanced student management and classroom monitoring system
for offline classrooms**.

## Current Stage

This repository is in an early vertical-slice stage. The current goal is to make the teacher-facing
student enrollment workflow persist through the Spring Boot Education Server and PostgreSQL, while
keeping AI integration behind a mock/stub boundary until the production CARES AI Server API is known.

## System Architecture

Production / target architecture:

```text
React Teacher Web Application / SwiftUI Teacher iPhone App
        |
        v
Spring Boot Education Server
        |
        +----------------------+
        |                      |
        v                      v
PostgreSQL              CARES AI Server
```

Current local development architecture:

```text
React Teacher Web Application / SwiftUI Teacher iPhone App
        |
        v
Spring Boot Education Server
        |
        +----------------------+
        |                      |
        v                      v
PostgreSQL              Local FastAPI Mock
```

The local FastAPI service is not intended to become a replacement for the CARES AI Server. It exists
only for development, API integration testing, and validating end-to-end flows before the real CARES
API is connected.

## Folder Structure

```text
.
├── frontend/
│   └── React + TypeScript + Vite teacher console UI
├── ios/ClassroomIQTeacher/
│   └── Native SwiftUI teacher companion for photo-assisted feedback
├── backend/
│   └── Java Spring Boot REST API skeleton
├── ai-service/
│   └── Python FastAPI AI service skeleton
├── database/
│   └── schema.sql
├── data/
│   └── local face enrollment images, ignored by Git
├── docs/
│   └── architecture.md
├── docker-compose.yml
├── .env.example
├── .gitignore
└── README.md
```

## Development Environment

Recommended local environment:

- macOS + VS Code
- Node.js and npm
- Java 21
- Maven
- Python 3.9+
- Docker Desktop, for PostgreSQL

Checked on this machine:

- Node.js: available
- npm: available
- Java: available
- Maven: installed under `~/.local/apache-maven/apache-maven-3.9.16`
- Python: available
- pip: available
- Docker: available
- Docker Compose: available

## Ports

| Service | URL |
| --- | --- |
| React frontend | http://localhost:5173 |
| Spring Boot backend | http://localhost:8080 |
| FastAPI AI service | http://localhost:8000 |
| PostgreSQL | localhost:5432 |

## Environment Variables

Copy the example file before running local services:

```bash
cp .env.example .env
```

Do not commit real secrets. `.env` is ignored by Git.

## Run PostgreSQL

Docker Desktop is required.

```bash
docker compose up -d
```

Check PostgreSQL status:

```bash
docker compose ps
docker compose exec -T postgres pg_isready -U classroom_user -d classroom_monitoring
```

Stop PostgreSQL:

```bash
docker compose down
```

## Run Spring Boot Backend

If `mvn` is not found in a new terminal, refresh the shell configuration first:

```bash
source ~/.zshrc
```

For the student enrollment vertical slice, run with the PostgreSQL profile:

```bash
cd backend
mvn spring-boot:run -Dspring-boot.run.profiles=postgres
```

Health check:

```bash
curl http://localhost:8080/api/health
```

```json
{
  "status": "ok",
  "service": "backend"
}
```

The AI service URL can be changed without changing controllers or services:

```bash
AI_SERVICE_URL=http://127.0.0.1:8000
```

## Run FastAPI AI Service

```bash
cd ai-service
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Health check:

```bash
curl http://localhost:8000/health
```

Person detection placeholder:

```bash
curl -X POST http://localhost:8000/detect/person
```

Face enrollment mock:

```bash
curl -X POST http://localhost:8000/face/enroll \
  -F student_id=example-student \
  -F image=@/path/to/image.jpg
```

## Run React Frontend

```bash
cd frontend
npm install
npm run dev
```

Open:

```text
http://localhost:5173
```

## Stop Services

React, Spring Boot, and FastAPI can be stopped with `Ctrl+C` in their terminal windows.

PostgreSQL can be stopped with:

```bash
docker compose down
```

## Student Enrollment Vertical Slice

Implemented:

- Formal project structure
- React application shell
- Student and Teacher authentication (registration, login, bearer-token sessions backed by PostgreSQL)
- Teacher-facing Students page
- Add Student modal with browser camera capture
- Spring Boot Student REST API
- PostgreSQL persistence for students
- Separate FaceEnrollment metadata table
- Local file storage under `data/face-enrollment/`
- FastAPI `/face/enroll` mock endpoint
- AI integration through `AiServerClient`
- PostgreSQL schema
- Docker Compose for PostgreSQL
- Architecture documentation

Not implemented:

- YOLO person detection
- Tracking
- Pose estimation
- Head-down detection
- Leave-seat detection
- Face recognition
- Face detection
- Face embeddings
- LLM / VLM integration
- Advanced reporting
- Deployment
