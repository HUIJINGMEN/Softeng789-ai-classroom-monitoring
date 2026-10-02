from __future__ import annotations

import json
from typing import Final

import httpx
from pydantic import ValidationError

from app.config.settings import LlmRuntime, ReportSummarySettings
from app.models.report_summary import (
    FeedbackSummaryContent,
    FeedbackSummaryRequest,
    FeedbackSummaryResponse,
)
from app.services.report_summary import InvalidSummaryResponse, SummaryProviderUnavailable
from app.services.report_summary_prompt import SUMMARY_SCHEMA, build_summary_messages

VLLM_PARAMETERS: Final[dict[str, object]] = {
    "top_k": 20,
    "min_p": 0,
    "chat_template_kwargs": {"enable_thinking": False},
}

OLLAMA_PARAMETERS: Final[dict[str, object]] = {
    "reasoning_effort": "none",
}

RUNTIME_PARAMETERS: Final[dict[LlmRuntime, dict[str, object]]] = {
    LlmRuntime.VLLM: VLLM_PARAMETERS,
    LlmRuntime.LM_STUDIO: {},
    LlmRuntime.OLLAMA: OLLAMA_PARAMETERS,
}


class OpenAICompatibleSummaryGenerator:
    """Generate Qwen drafts through a supported OpenAI-compatible runtime."""

    def __init__(
        self,
        settings: ReportSummarySettings,
        transport: httpx.BaseTransport | None = None,
    ) -> None:
        self._settings = settings
        self._client = httpx.Client(
            base_url=settings.base_url.rstrip("/"),
            headers={"Authorization": f"Bearer {settings.api_key}"},
            timeout=httpx.Timeout(settings.timeout_seconds),
            transport=transport,
        )

    def summarize(self, request: FeedbackSummaryRequest) -> FeedbackSummaryResponse:
        try:
            response = self._client.post("/v1/chat/completions", json=self._payload(request))
            response.raise_for_status()
        except httpx.HTTPError as exc:
            raise SummaryProviderUnavailable("Qwen inference is temporarily unavailable.") from exc

        content = self._extract_content(response)
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
        payload.update(RUNTIME_PARAMETERS[self._settings.runtime])
        return payload

    @staticmethod
    def _extract_content(response: httpx.Response) -> str:
        try:
            payload = response.json()
            content = payload["choices"][0]["message"]["content"]
        except (json.JSONDecodeError, KeyError, IndexError, TypeError) as exc:
            raise InvalidSummaryResponse("Qwen returned an unreadable response.") from exc
        if not isinstance(content, str) or not content.strip():
            raise InvalidSummaryResponse("Qwen returned an empty summary.")
        return content
