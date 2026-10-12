from __future__ import annotations

from enum import Enum
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, model_validator


class PaymentMessageTone(str, Enum):
    ENCOURAGE = "ENCOURAGE"
    NOTICE = "NOTICE"


class PaymentMessageRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    courseLabel: Optional[str] = Field(default=None, max_length=180)
    purchaseDescription: Optional[str] = Field(default=None, max_length=180)
    purchasedSessions: Optional[int] = Field(default=None, ge=0, le=500)
    attendedSessions: Optional[int] = Field(default=None, ge=0, le=500)
    chargeableAbsences: Optional[int] = Field(default=None, ge=0, le=500)
    remainingSessions: Optional[int] = Field(default=None, ge=0, le=500)
    balance: str = Field(min_length=1, max_length=40)
    dueDate: str = Field(min_length=1, max_length=40)
    tone: PaymentMessageTone

    @model_validator(mode="after")
    def require_complete_session_context(self) -> "PaymentMessageRequest":
        values = (
            self.purchasedSessions,
            self.attendedSessions,
            self.chargeableAbsences,
            self.remainingSessions,
        )
        if any(value is not None for value in values) and any(value is None for value in values):
            raise ValueError("session package fields must be supplied together")
        return self


class PaymentMessageContent(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    message: str = Field(min_length=1, max_length=650)


class PaymentMessageResponse(PaymentMessageContent):
    tone: PaymentMessageTone
    provider: str = Field(min_length=1, max_length=120)
