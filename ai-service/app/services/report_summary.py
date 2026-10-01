from typing import Protocol

from app.models.report_summary import FeedbackSummaryRequest, FeedbackSummaryResponse


class SummaryProviderUnavailable(RuntimeError):
    """The configured inference server could not complete the request."""


class InvalidSummaryResponse(RuntimeError):
    """The inference server returned a response outside the application contract."""


class FeedbackSummaryGenerator(Protocol):
    """Stable application boundary implemented by private inference providers."""

    def summarize(self, request: FeedbackSummaryRequest) -> FeedbackSummaryResponse:
        """Generate a reviewable draft without publishing it."""

    def close(self) -> None:
        """Release provider resources when the application stops."""
