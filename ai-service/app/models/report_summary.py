from datetime import date
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, field_validator

FeedbackNote = Annotated[str, Field(min_length=1, max_length=4000)]
MAX_TOTAL_EVIDENCE_CHARACTERS = 48_000


class FeedbackSummaryRequest(BaseModel):
    """Minimum report evidence required by the language model.

    The education backend deliberately omits student names and identifiers. The model only needs
    the reporting scope and teacher-authored evidence to produce a useful draft.
    """

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    classLabel: str = Field(min_length=1, max_length=240)
    dateFrom: date
    dateTo: date
    feedback: list[FeedbackNote] = Field(min_length=1, max_length=100)

    @field_validator("feedback")
    @classmethod
    def require_meaningful_feedback(cls, values: list[str]) -> list[str]:
        normalized = [" ".join(value.split()) for value in values]
        if any(not value for value in normalized):
            raise ValueError("feedback entries must not be blank")
        if sum(map(len, normalized)) > MAX_TOTAL_EVIDENCE_CHARACTERS:
            raise ValueError("feedback evidence is too large for one summary request")
        return normalized


class FeedbackSummaryContent(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    summary: str = Field(min_length=1, max_length=1200)
    strengths: str = Field(min_length=1, max_length=800)
    nextSteps: str = Field(min_length=1, max_length=800)


class FeedbackSummaryResponse(FeedbackSummaryContent):
    provider: str = Field(min_length=1, max_length=160)
