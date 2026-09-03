from fastapi import FastAPI

from app.api.face_enrollment import router as face_enrollment_router
from app.api.health import router as health_router
from app.api.person_detection import router as person_detection_router

app = FastAPI(
    title="Classroom Monitoring AI Service",
    description="Local development mock for the future CARES AI Server integration.",
    version="0.1.0",
)

app.include_router(health_router)
app.include_router(person_detection_router)
app.include_router(face_enrollment_router)
