from __future__ import annotations

import httpx
from pydantic import ValidationError

from app.config.settings import PrivateLlmSettings
from app.models.report_summary import (
    FeedbackSummaryContent,
    FeedbackSummaryRequest,
    FeedbackSummaryResponse,
)
from app.services.report_summary import InvalidSummaryResponse, SummaryProviderUnavailable
from app.services.report_summary_prompt import SUMMARY_SCHEMA, build_summary_messages
from app.providers.openai_client import OpenAIChatClient
from app.providers.openai_runtime import runtime_options


class OpenAICompatibleSummaryGenerator:
    """Generate Qwen drafts through a supported OpenAI-compatible runtime."""

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

    def summarize(self, request: FeedbackSummaryRequest) -> FeedbackSummaryResponse:
        try:
            content = self._client.complete(self._payload(request))
        except httpx.HTTPError as exc:
            raise SummaryProviderUnavailable("Qwen inference is temporarily unavailable.") from exc
        except ValueError as exc:
            raise InvalidSummaryResponse("Qwen returned an unreadable response.") from exc
        try:
            validated = FeedbackSummaryContent.model_validate_json(content)
        except ValidationError as exc:
            raise InvalidSummaryResponse("Qwen returned an invalid summary structure.") from exc

        return FeedbackSummaryResponse(
            **validated.model_dump(),
            provider=f"QWEN:{self._settings.model}",
        )

    def close(self) -> None:
        self._client.close()

    def _payload(self, request: FeedbackSummaryRequest) -> dict[str, object]:
        payload: dict[str, object] = {
            "model": self._settings.model,
            "messages": build_summary_messages(request),
            "temperature": 0.7,
            "top_p": 0.8,
            "max_tokens": 700,
            "stream": False,
            "response_format": {
                "type": "json_schema",
                "json_schema": {
                    "name": "feedback_summary",
                    "strict": True,
                    "schema": SUMMARY_SCHEMA,
                },
            },
        }
        payload.update(runtime_options(self._settings.runtime))
        return payload
