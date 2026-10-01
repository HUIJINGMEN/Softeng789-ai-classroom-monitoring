from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.api.face_enrollment import router as face_enrollment_router
from app.api.health import router as health_router
from app.api.person_detection import router as person_detection_router
from app.api.report_summary import router as report_summary_router
from app.dependencies import close_feedback_summary_generator


@asynccontextmanager
async def lifespan(_: FastAPI):
    """Release cached provider clients during a graceful shutdown."""
    yield
    close_feedback_summary_generator()


app = FastAPI(
    title="ClassLens AI Adapter",
    description=(
        "Private Qwen report summaries plus explicit development adapters for future "
        "computer-vision providers."
    ),
    version="0.2.0",
    lifespan=lifespan,
)

app.include_router(health_router)
app.include_router(person_detection_router)
app.include_router(face_enrollment_router)
app.include_router(report_summary_router)
