# AI Enhanced Classroom Monitoring System

SOFTENG 789 research project: **AI enhanced student management and classroom monitoring system
for offline classrooms**.

## Current Stage

The application layer is feature-complete for a full teacher/admin/student workflow: authentication and
role-based access control, student enrollment and approval, classroom sessions and attendance, AI-candidate
behaviour-event review, the Health Alerts / Health Incident Report two-entity model, progress reports and
class feedback, AI feedback summaries with a teacher review lifecycle, and student accomplishments. See
[`docs/modules.md`](docs/modules.md) for a map of where each feature lives in the codebase.

The computer-vision and language-model layer remains behind a mock/stub boundary until the production
CARES AI Server API is known: face recognition, person detection, tracking, pose estimation and LLM/VLM
summarisation are not implemented (see "Feature Status" below). The application is designed so a real
provider can be dropped in behind the existing gateway interfaces without changing controllers or business
logic — see [`docs/ai-integration.md`](docs/ai-integration.md).

## System Architecture

A responsive React web app talks only to the Spring Boot Education Server, which owns PostgreSQL and
reaches AI capability through gateway interfaces — a local FastAPI mock in development, the CARES AI
Server in production. See [`docs/architecture.md`](docs/architecture.md) for the full diagram, the
roles/access-control model, and the module breakdown.

## Folder Structure

```text
.
├── frontend/
│   └── React + TypeScript + Vite responsive web portals
├── backend/
│   └── Java Spring Boot education server
├── ai-service/
│   └── Python FastAPI development adapter for laboratory AI integration
├── database/
│   └── schema.sql
├── data/
│   └── local face enrollment images, ignored by Git
├── docs/
│   ├── architecture.md
│   ├── ai-integration.md
│   └── modules.md
├── docker-compose.yml
├── .env.example
├── .gitignore
└── README.md
```

## Development Environment

Required, with the versions CI builds against ([`.github/workflows/quality.yml`](.github/workflows/quality.yml)):

- **Java 21** — [Temurin](https://adoptium.net/) or any JDK 21 distribution
- **Maven** — not bundled in this repo (no `mvnw` wrapper yet); install via `brew install maven`
  (macOS) or from [maven.apache.org](https://maven.apache.org/install.html)
- **Node.js 22** and npm — Vite 6 requires Node 18/20/22+; older versions will fail to start
- **Python 3.12** (3.9+ should work, but CI runs 3.12)
- **Docker Desktop** — for PostgreSQL

Any editor works; VS Code is what this project has been developed in.

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

Docker Compose reads this root-level `.env` automatically for the values in `docker-compose.yml`
(`POSTGRES_DB`, `POSTGRES_USER`, etc.). Vite is also configured (`envDir` in `frontend/vite.config.ts`)
to read it, so `VITE_`-prefixed variables reach the frontend without a separate `frontend/.env` file.

The Spring Boot backend does **not** read `.env` automatically. Docker Compose requires
`POSTGRES_PASSWORD` in the root `.env` file, and the backend requires the same value in its process
environment. Export it before running Maven (for example,
`export POSTGRES_PASSWORD=... && mvn spring-boot:run ...`) or pass it as a system property.

Optional authentication settings are documented in `.env.example`. By default, five failed login
attempts for the same normalized email within 15 minutes temporarily block further attempts for 15
minutes. Override `AUTH_LOGIN_MAX_FAILURES`, `AUTH_LOGIN_FAILURE_WINDOW` and
`AUTH_LOGIN_BLOCK_DURATION` when a deployment needs different limits.

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

On a fresh database, `schema.sql` already includes every table and this step can be skipped. It only
applies to an existing development database created before the Accomplishments feature was added —
apply its idempotent migration before restarting the backend:

```bash
docker compose exec -T postgres psql -U classroom_user -d classroom_monitoring \
  < database/migrations/20260915_add_accomplishments.sql
docker compose exec -T postgres psql -U classroom_user -d classroom_monitoring \
  < database/migrations/20260915_add_accomplishment_feedback.sql
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

Run with the PostgreSQL profile:

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

The backend reaches AI functionality through small gateway interfaces, configured via the
`AI_SERVICE_URL` environment variable (default `http://127.0.0.1:8000`, matching the FastAPI service
below) — no controller or service code changes needed to point it elsewhere. See
[`docs/ai-integration.md`](docs/ai-integration.md) before connecting a laboratory model.

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

## First Login

A fresh database has no usable accounts — only a passwordless Admin placeholder from
`database/schema.sql`. Activate it once by setting a private bootstrap password before the first
backend startup:

1. **Activate the Admin account.** Use an 8–72 character password that is not committed to Git:

   ```bash
   export BOOTSTRAP_ADMIN_PASSWORD='choose-a-private-password'
   cd backend
   mvn spring-boot:run -Dspring-boot.run.profiles=postgres
   ```

   Sign in as `admin@auckland.ac.nz`, then remove `BOOTSTRAP_ADMIN_PASSWORD` from your shell or
   deployment configuration. Later startups never overwrite an existing password.

2. **Set up the school from the Admin console.** Signed in as Admin, use Campuses, Rooms, Classes and
   Staff to create real campuses/rooms, classes (course offerings), and any teacher or admin accounts
   your team needs directly — no separate registration required for staff you create this way.

3. **Invite staff or let students register.** An Admin first creates teacher accounts; invited
   teachers then finish registration using the same email and staff number. A self-registered Student
   starts `PENDING` and only appears in rosters, attendance and reports once an Admin approves them
   from the Registrations page.

## Demo Accounts

To skip setup entirely and explore a populated instance, load the presentation dataset once the
backend is up:

```bash
docker compose exec -T postgres psql -U classroom_user -d classroom_monitoring < database/demo_data.sql
```

This creates three ready-to-use logins (or leaves them untouched if they already exist on your
database) with sample classes, attendance, health records, feedback and accomplishments already
attached:

| Role | Email | Password |
| --- | --- | --- |
| Administrator | `admin@auckland.ac.nz` | `Demo1234` |
| Teacher | `111@qq.com` | `12345678` |
| Student | `test.student@aucklanduni.ac.nz` | `TestPass123!` |

`demo_data.sql` is safe to run more than once — it never overwrites a password that's already set,
including on these three accounts.

## Stop Services

React, Spring Boot, and FastAPI can be stopped with `Ctrl+C` in their terminal windows.

PostgreSQL can be stopped with:

```bash
docker compose down
```

## Quality Check

Run the same local checks before committing or opening a pull request:

```bash
./scripts/quality-check.sh
```

The script runs backend tests, the frontend type-check and production build, and the Python AI
adapter tests. It does not start PostgreSQL or modify development data.

## Feature Status

Implemented (see [`docs/modules.md`](docs/modules.md) for the file-level map):

- Student and Teacher/Admin authentication (registration, login, bearer-token sessions, per-class RBAC
  scoping via `TeacherScopeSupport`)
- Student self-registration with an Admin approval queue
- Face-enrollment photo capture and storage, with a mock AI endpoint behind a gateway interface
- Classroom sessions and attendance records (manual and AI-sourced), including bounded batch loading
  for session histories
- AI-candidate behaviour-event review (teacher confirm/reject/correct)
- Health Alerts (AI candidates) and Health Incident Reports (formal record) two-entity model
- Progress reports and whole-class feedback
- AI feedback summaries with a teacher draft/review/publish lifecycle
- Student accomplishments with student acknowledgement/correction-request workflow
- Admin console: campuses, rooms, classes (course offerings with multi-teacher support), staff accounts,
  registration approvals
- Responsive teacher, admin and student portals sharing one React codebase
- PostgreSQL schema and Docker Compose setup
- Architecture, AI-integration and module-map documentation

Not implemented — the computer-vision / language-model layer stays behind the gateway boundary
(`docs/ai-integration.md`) until a real provider is connected:

- YOLO person detection
- Object tracking
- Pose estimation
- Head-down detection
- Leave-seat detection
- Face recognition, face detection, face embeddings
- LLM / VLM integration
- Deployment
