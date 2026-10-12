from fastapi import APIRouter, Depends, HTTPException, status

from app.dependencies import get_payment_message_generator
from app.models.payment_message import PaymentMessageRequest, PaymentMessageResponse
from app.services.payment_message import (
    InvalidPaymentMessage,
    PaymentMessageGenerator,
    PaymentMessageProviderUnavailable,
)

router = APIRouter(prefix="/summaries", tags=["summaries"])


@router.post("/payment-message", response_model=PaymentMessageResponse)
def generate_payment_message(
    request: PaymentMessageRequest,
    generator: PaymentMessageGenerator = Depends(get_payment_message_generator),
) -> PaymentMessageResponse:
    try:
        return generator.generate(request)
    except PaymentMessageProviderUnavailable as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    except InvalidPaymentMessage as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc
