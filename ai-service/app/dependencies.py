from functools import lru_cache

from app.config.settings import settings
from app.providers.openai_summary import OpenAICompatibleSummaryGenerator
from app.services.face_enrollment import FaceEnrollmentAnalyzer, MockFaceEnrollmentAnalyzer
from app.services.person_detector import PersonDetector, PlaceholderPersonDetector
from app.services.report_summary import FeedbackSummaryGenerator


@lru_cache
def get_face_enrollment_analyzer() -> FaceEnrollmentAnalyzer:
    """Application wiring point for the selected face-enrollment provider."""
    return MockFaceEnrollmentAnalyzer()


@lru_cache
def get_person_detector() -> PersonDetector:
    """Application wiring point for the selected classroom detector."""
    return PlaceholderPersonDetector()


@lru_cache
def get_feedback_summary_generator() -> FeedbackSummaryGenerator:
    """Application wiring point for the privately hosted report-summary model."""
    return OpenAICompatibleSummaryGenerator(settings.report_summary)


def close_feedback_summary_generator() -> None:
    """Close the cached inference client without creating one during shutdown."""
    if get_feedback_summary_generator.cache_info().currsize == 0:
        return
    get_feedback_summary_generator().close()
    get_feedback_summary_generator.cache_clear()
