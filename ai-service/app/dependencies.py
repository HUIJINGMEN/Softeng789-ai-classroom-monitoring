from functools import lru_cache

from app.services.face_enrollment import FaceEnrollmentAnalyzer, MockFaceEnrollmentAnalyzer
from app.services.person_detector import PersonDetector, PlaceholderPersonDetector


@lru_cache
def get_face_enrollment_analyzer() -> FaceEnrollmentAnalyzer:
    """Application wiring point for the selected face-enrollment provider."""
    return MockFaceEnrollmentAnalyzer()


@lru_cache
def get_person_detector() -> PersonDetector:
    """Application wiring point for the selected classroom detector."""
    return PlaceholderPersonDetector()
