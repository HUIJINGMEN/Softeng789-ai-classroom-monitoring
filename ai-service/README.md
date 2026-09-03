# Classroom Monitoring AI Service

Python FastAPI skeleton for Week 2.

## Setup

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Run

```bash
uvicorn app.main:app --reload
```

Health endpoint:

```bash
curl http://localhost:8000/health
```

Person detection placeholder:

```bash
curl -X POST http://localhost:8000/detect/person
```
