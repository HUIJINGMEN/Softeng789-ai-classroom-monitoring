from typing import Protocol

from app.models.detection import PersonDetectionPlaceholderResponse


class PersonDetector(Protocol):
    """Provider contract for the future classroom person-detection pipeline."""

    def status(self) -> PersonDetectionPlaceholderResponse:
        """Return the current detector result or capability status."""


class PlaceholderPersonDetector:
    """Explicit non-AI implementation used while the laboratory model is unavailable."""

    def status(self) -> PersonDetectionPlaceholderResponse:
        return PersonDetectionPlaceholderResponse(
            status="not_implemented",
            message="The laboratory person-detection provider has not been connected.",
        )
