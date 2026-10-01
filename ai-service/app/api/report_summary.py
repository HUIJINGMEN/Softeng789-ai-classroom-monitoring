from typing import Annotated

from app.dependencies import get_feedback_summary_generator
from app.models.report_summary import FeedbackSummaryRequest, FeedbackSummaryResponse
from app.services.report_summary import (
    FeedbackSummaryGenerator,
    InvalidSummaryResponse,
    SummaryProviderUnavailable,
)
from fastapi import APIRouter, Depends, HTTPException

router = APIRouter(prefix="/summaries", tags=["report summaries"])


@router.post(
    "/feedback",
    response_model=FeedbackSummaryResponse,
    responses={
        502: {"description": "The inference server returned an invalid response."},
        503: {"description": "The inference server is unavailable."},
    },
)
def create_feedback_summary(
    request: FeedbackSummaryRequest,
    generator: Annotated[FeedbackSummaryGenerator, Depends(get_feedback_summary_generator)],
) -> FeedbackSummaryResponse:
    """Generate a draft only; review and publication remain in the education backend."""
    if request.dateTo < request.dateFrom:
        raise HTTPException(status_code=422, detail="dateTo must not be before dateFrom")
    try:
        return generator.summarize(request)
    except SummaryProviderUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except InvalidSummaryResponse as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
