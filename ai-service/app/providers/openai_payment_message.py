from __future__ import annotations

import httpx
from pydantic import ValidationError

from app.config.settings import PrivateLlmSettings
from app.models.payment_message import PaymentMessageContent, PaymentMessageRequest, PaymentMessageResponse
from app.providers.openai_client import OpenAIChatClient
from app.providers.openai_runtime import runtime_options
from app.services.payment_message import InvalidPaymentMessage, PaymentMessageProviderUnavailable
from app.services.payment_message_prompt import MESSAGE_SCHEMA, build_payment_messages


class OpenAICompatiblePaymentMessageGenerator:
    def __init__(
        self,
        settings: PrivateLlmSettings,
        transport: httpx.BaseTransport | None = None,
    ) -> None:
        self._settings = settings
        self._client = OpenAIChatClient(
            settings.base_url,
            settings.api_key,
            settings.timeout_seconds,
            transport,
        )

    def generate(self, request: PaymentMessageRequest) -> PaymentMessageResponse:
        try:
            content = self._client.complete(self._payload(request))
        except httpx.HTTPError as exc:
            raise PaymentMessageProviderUnavailable("Qwen inference is temporarily unavailable.") from exc
        except ValueError as exc:
            raise InvalidPaymentMessage("Qwen returned an unreadable payment note.") from exc
        try:
            validated = PaymentMessageContent.model_validate_json(content)
        except ValidationError as exc:
            raise InvalidPaymentMessage("Qwen returned an invalid payment note.") from exc
        return PaymentMessageResponse(
            **validated.model_dump(),
            tone=request.tone,
            provider=f"QWEN:{self._settings.model}",
        )

    def close(self) -> None:
        self._client.close()

    def _payload(self, request: PaymentMessageRequest) -> dict[str, object]:
        payload: dict[str, object] = {
            "model": self._settings.model,
            "messages": build_payment_messages(request),
            "temperature": 0.45,
            "top_p": 0.8,
            "max_tokens": 220,
            "stream": False,
            "response_format": {
                "type": "json_schema",
                "json_schema": {
                    "name": "payment_message",
                    "strict": True,
                    "schema": MESSAGE_SCHEMA,
                },
            },
        }
        payload.update(runtime_options(self._settings.runtime))
        return payload
