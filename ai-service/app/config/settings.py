import os
from enum import Enum

from pydantic import BaseModel, Field


class LlmRuntime(str, Enum):
    VLLM = "vllm"
    LM_STUDIO = "lmstudio"
    OLLAMA = "ollama"


class ReportSummarySettings(BaseModel):
    """Connection settings for an OpenAI-compatible private inference runtime."""

    runtime: LlmRuntime = LlmRuntime.VLLM
    base_url: str = Field(default="http://127.0.0.1:8001", min_length=1)
    api_key: str = Field(default="local-development-key", min_length=1)
    model: str = Field(default="Qwen/Qwen3-30B-A3B", min_length=1)
    timeout_seconds: float = Field(default=90.0, gt=0, le=300)

    @classmethod
    def from_environment(cls) -> "ReportSummarySettings":
        """Read neutral names first while retaining compatibility with the initial vLLM setup."""
        return cls(
            runtime=os.getenv("LLM_RUNTIME", LlmRuntime.VLLM.value),
            base_url=os.getenv("LLM_BASE_URL", os.getenv("VLLM_BASE_URL", "http://127.0.0.1:8001")),
            api_key=os.getenv(
                "LLM_API_KEY",
                os.getenv("VLLM_API_KEY", "local-development-key"),
            ),
            model=os.getenv("LLM_MODEL", os.getenv("QWEN_MODEL", "Qwen/Qwen3-30B-A3B")),
            timeout_seconds=float(
                os.getenv("LLM_TIMEOUT_SECONDS", os.getenv("VLLM_TIMEOUT_SECONDS", "90"))
            ),
        )


class Settings(BaseModel):
    service_name: str = "ai-service"
    model_name: str = "yolo-person-detection-week-3"
    report_summary: ReportSummarySettings = Field(default_factory=ReportSummarySettings)


settings = Settings(
    report_summary=ReportSummarySettings.from_environment(),
)
