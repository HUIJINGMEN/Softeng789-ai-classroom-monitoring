from datetime import date
from enum import Enum
from typing import Annotated, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field


class AssistantIntent(str, Enum):
    ATTENDANCE = "ATTENDANCE"
    ABSENCES = "ABSENCES"
    SCHEDULE = "SCHEDULE"
    PAYMENTS = "PAYMENTS"
    PAYMENT_REVIEW = "PAYMENT_REVIEW"
    STUDENT_COUNT = "STUDENT_COUNT"
    UNSUPPORTED = "UNSUPPORTED"


class AssistantContext(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    intent: AssistantIntent
    studentName: str = Field(default="", max_length=160)
    dateFrom: date
    dateTo: date
    courseQuery: str = Field(default="", max_length=120)


class AssistantPlanRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    message: str = Field(min_length=1, max_length=1000)
    today: date
    history: list[Annotated[str, Field(min_length=1, max_length=1000)]] = Field(default_factory=list, max_length=4)
    context: Optional[AssistantContext] = None


class AssistantPlan(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    intent: AssistantIntent
    studentQuery: str = Field(max_length=120)
    courseQuery: str = Field(max_length=120)
    dateFrom: date
    dateTo: date
    usePreviousStudent: bool
    language: Literal["zh", "en"]


class AssistantPlanResponse(AssistantPlan):
    provider: str
