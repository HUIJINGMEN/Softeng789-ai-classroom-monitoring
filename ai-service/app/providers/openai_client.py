from __future__ import annotations

import json

import httpx


class OpenAIChatClient:
    """Small transport adapter shared by structured Qwen use cases."""

    def __init__(
        self,
        base_url: str,
        api_key: str,
        timeout_seconds: float,
        transport: httpx.BaseTransport | None = None,
    ) -> None:
        self._client = httpx.Client(
            base_url=base_url.rstrip("/"),
            headers={"Authorization": f"Bearer {api_key}"},
            timeout=httpx.Timeout(timeout_seconds),
            transport=transport,
        )

    def complete(self, payload: dict[str, object]) -> str:
        response = self._client.post("/v1/chat/completions", json=payload)
        response.raise_for_status()
        try:
            content = response.json()["choices"][0]["message"]["content"]
        except (json.JSONDecodeError, KeyError, IndexError, TypeError) as exc:
            raise ValueError("The inference runtime returned an unreadable response.") from exc
        if not isinstance(content, str) or not content.strip():
            raise ValueError("The inference runtime returned an empty response.")
        return content

    def close(self) -> None:
        self._client.close()
