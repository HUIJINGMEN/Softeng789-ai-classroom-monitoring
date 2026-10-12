from typing import Protocol

from app.models.payment_message import PaymentMessageRequest, PaymentMessageResponse


class PaymentMessageProviderUnavailable(RuntimeError):
    pass


class InvalidPaymentMessage(RuntimeError):
    pass


class PaymentMessageGenerator(Protocol):
    def generate(self, request: PaymentMessageRequest) -> PaymentMessageResponse:
        """Generate a reviewable payment note without delivering it."""

    def close(self) -> None:
        """Release provider resources."""
