from app.models.health import HealthResponse
from fastapi import APIRouter

router = APIRouter()


@router.get("/health")
def health() -> HealthResponse:
    return HealthResponse(status="ok", service="ai-service")
