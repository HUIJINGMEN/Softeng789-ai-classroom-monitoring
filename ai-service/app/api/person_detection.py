from app.models.detection import PersonDetectionPlaceholderResponse
from fastapi import APIRouter

router = APIRouter()


@router.post("/detect/person", response_model=PersonDetectionPlaceholderResponse)
def detect_person() -> PersonDetectionPlaceholderResponse:
    return PersonDetectionPlaceholderResponse(
        status="not_implemented",
        message="YOLO person detection baseline will be implemented in Week 3",
    )
