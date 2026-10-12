from __future__ import annotations

from typing import Final

from app.config.settings import LlmRuntime

_RUNTIME_OPTIONS: Final[dict[LlmRuntime, dict[str, object]]] = {
    LlmRuntime.VLLM: {
        "top_k": 20,
        "min_p": 0,
        "chat_template_kwargs": {"enable_thinking": False},
    },
    LlmRuntime.LM_STUDIO: {},
    LlmRuntime.OLLAMA: {"reasoning_effort": "none"},
}


def runtime_options(runtime: LlmRuntime) -> dict[str, object]:
    """Return a copy so one use case cannot mutate another use case's provider defaults."""
    return dict(_RUNTIME_OPTIONS[runtime])
