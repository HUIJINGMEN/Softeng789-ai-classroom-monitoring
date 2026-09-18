from typing import Annotated

from app.dependencies import get_face_enrollment_analyzer
from app.models.face_enrollment import FaceEnrollmentResponse
from app.services.face_enrollment import FaceEnrollmentAnalyzer
from fastapi import APIRouter, Depends, File, Form, UploadFile

router = APIRouter()


@router.post("/face/enroll", response_model=FaceEnrollmentResponse)
async def enroll_face(
    analyzer: Annotated[FaceEnrollmentAnalyzer, Depends(get_face_enrollment_analyzer)],
    student_id: str = Form(...),
    image: UploadFile = File(...),
) -> FaceEnrollmentResponse:
    content = await image.read()
    return analyzer.analyze(student_id, content)
