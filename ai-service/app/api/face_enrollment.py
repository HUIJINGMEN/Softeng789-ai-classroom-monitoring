import json
from typing import Annotated

from app.dependencies import get_face_enrollment_analyzer
from app.models.face_enrollment import FaceEnrollmentResponse
from app.services.face_enrollment import FaceEnrollmentAnalyzer
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile

router = APIRouter()


@router.post("/face/enroll", response_model=FaceEnrollmentResponse)
async def enroll_face(
    analyzer: Annotated[FaceEnrollmentAnalyzer, Depends(get_face_enrollment_analyzer)],
    student_id: str = Form(...),
    image: UploadFile = File(...),
) -> FaceEnrollmentResponse:
    content = await image.read()
    return analyzer.analyze(student_id, content)


@router.post("/face/enroll/captures", response_model=FaceEnrollmentResponse)
async def enroll_face_captures(
    analyzer: Annotated[FaceEnrollmentAnalyzer, Depends(get_face_enrollment_analyzer)],
    subject_id: str = Form(...),
    poses: str = Form(...),
    images: list[UploadFile] = File(...),
) -> FaceEnrollmentResponse:
    """Receive one ordered pose label for each registration image.

    The education backend remains the workflow owner. This endpoint only evaluates the capture
    set and never creates a student or an Admin registration request.
    """
    try:
        parsed_poses = json.loads(poses)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail="poses must be a JSON array") from exc
    if not isinstance(parsed_poses, list) or not all(isinstance(pose, str) for pose in parsed_poses):
        raise HTTPException(status_code=400, detail="poses must be a JSON array of strings")
    if len(parsed_poses) != len(images):
        raise HTTPException(status_code=400, detail="each image must have one pose")

    contents = [await image.read() for image in images]
    return analyzer.analyze_captures(subject_id, list(zip(parsed_poses, contents, strict=True)))
