from typing import Optional

import httpx
from pydantic import ValidationError

from app.config.settings import PrivateLlmSettings
from app.models.admin_assistant import AssistantPlan, AssistantPlanRequest, AssistantPlanResponse
from app.providers.openai_client import OpenAIChatClient
from app.providers.openai_runtime import runtime_options
from app.services.admin_assistant_prompt import PLAN_SCHEMA, plan_messages


class AssistantUnavailable(Exception):
    pass


class InvalidAssistantPlan(Exception):
    pass


class OpenAICompatibleAssistantPlanner:
    """Intent extraction only. Student records and financial facts never enter this provider."""

    def __init__(self, settings: PrivateLlmSettings, transport: Optional[httpx.BaseTransport] = None):
        self.settings = settings
        self.client = OpenAIChatClient(settings.base_url, settings.api_key, settings.timeout_seconds, transport)

    def plan(self, request: AssistantPlanRequest) -> AssistantPlanResponse:
        payload = {
            "model": self.settings.model,
            "messages": plan_messages(request),
            "temperature": 0,
            "max_tokens": 350,
            "stream": False,
            "response_format": {"type": "json_schema", "json_schema": {
                "name": "admin_assistant_plan", "strict": True, "schema": PLAN_SCHEMA,
            }},
            **runtime_options(self.settings.runtime),
        }
        try:
            content = self.client.complete(payload)
        except httpx.HTTPError as exc:
            raise AssistantUnavailable("Assistant inference is unavailable.") from exc
        except ValueError as exc:
            raise InvalidAssistantPlan("Assistant returned an unreadable plan.") from exc
        try:
            plan = AssistantPlan.model_validate_json(content)
        except ValidationError as exc:
            raise InvalidAssistantPlan("Assistant returned an invalid plan.") from exc
        return AssistantPlanResponse(**plan.model_dump(), provider=f"QWEN:{self.settings.model}")

    def close(self) -> None:
        self.client.close()
