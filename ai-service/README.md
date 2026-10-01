# ClassLens AI Adapter

Python FastAPI contract sandbox for local development and laboratory model integration. It is not a
production model service and never reports mock results as verified AI decisions.

Report summaries are the exception to the computer-vision mocks: `/summaries/feedback` connects to
the private OpenAI-compatible runtime configured by `LLM_RUNTIME`, `LLM_BASE_URL`, `LLM_API_KEY`, and
`LLM_MODEL`. The adapter sends de-identified report scope and teacher-authored evidence, enforces a
JSON schema, and returns a draft only. Spring still owns review, approval and publication.

## Setup

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Run

```bash
uvicorn app.main:app --reload --env-file ../.env
```

Health endpoint:

```bash
curl http://localhost:8000/health
```

Person detection placeholder:

```bash
curl -X POST http://localhost:8000/detect/person
```

Feedback-summary contract (requires the Qwen server described in the root README):

```bash
curl -X POST http://localhost:8000/summaries/feedback \
  -H 'Content-Type: application/json' \
  -d '{
    "classLabel": "COMPSCI 335 · 2026 Teaching Year",
    "dateFrom": "2026-07-01",
    "dateTo": "2026-09-30",
    "feedback": ["Contributed a clear explanation during the group exercise."]
  }'
```

## Provider structure

- `app/api/` contains transport-only route handlers.
- `app/models/` contains stable request and response schemas.
- `app/services/` defines stable provider protocols and owns prompt construction.
- `app/providers/` maps those protocols to external inference APIs. Its OpenAI-compatible adapter
  supports LM Studio locally and vLLM in production.
- `app/config/` translates environment variables into validated provider settings.
- `app/dependencies.py` is the wiring point for replacing a mock with a laboratory provider.
- `tests/` contains contract and fallback-behaviour tests.

Keep model loading, inference, thresholds, and provider SDKs out of route handlers. See
`../docs/ai-integration.md` for the cross-service contract and human-review rules.

Run tests:

```bash
python3 -m unittest discover -s tests -p 'test_*.py'
```
