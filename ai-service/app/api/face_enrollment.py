from app.models.face_enrollment import FaceEnrollmentResponse
from app.services.face_enrollment import validate_image_bytes
from fastapi import APIRouter, File, Form, UploadFile

router = APIRouter()


@router.post("/face/enroll", response_model=FaceEnrollmentResponse)
async def enroll_face(
    student_id: str = Form(...),
    image: UploadFile = File(...),
) -> FaceEnrollmentResponse:
    content = await image.read()
    if not validate_image_bytes(content):
        return FaceEnrollmentResponse(
            studentId=student_id,
            imageAccepted=False,
            aiVerified=False,
            status="FAILED",
            message="Invalid image. The local mock could not read the uploaded file.",
        )

    return FaceEnrollmentResponse(
        studentId=student_id,
        imageAccepted=True,
        aiVerified=False,
        status="PHOTO_CAPTURED",
        message=(
            "Enrollment photo received. AI verification is not implemented in the local "
            "mock service."
        ),
    )
