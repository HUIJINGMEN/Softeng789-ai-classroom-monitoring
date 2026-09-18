from typing import Annotated

from app.dependencies import get_person_detector
from app.models.detection import PersonDetectionPlaceholderResponse
from app.services.person_detector import PersonDetector
from fastapi import APIRouter, Depends

router = APIRouter()


@router.post("/detect/person", response_model=PersonDetectionPlaceholderResponse)
def detect_person(
    detector: Annotated[PersonDetector, Depends(get_person_detector)],
) -> PersonDetectionPlaceholderResponse:
    return detector.status()
