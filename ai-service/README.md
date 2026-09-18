# Classroom Monitoring AI Adapter

Python FastAPI contract sandbox for local development and laboratory model integration. It is not a
production model service and never reports mock results as verified AI decisions.

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

## Provider structure

- `app/api/` contains transport-only route handlers.
- `app/models/` contains stable request and response schemas.
- `app/services/` defines provider protocols and development implementations.
- `app/dependencies.py` is the wiring point for replacing a mock with a laboratory provider.
- `tests/` contains contract and fallback-behaviour tests.

Keep model loading, inference, thresholds, and provider SDKs out of route handlers. See
`../docs/ai-integration.md` for the cross-service contract and human-review rules.

Run tests:

```bash
python3 -m unittest discover -s tests -p 'test_*.py'
```
