import json
import unittest
from datetime import date

import httpx
from pydantic import ValidationError

from app.config.settings import LlmRuntime, ReportSummarySettings
from app.models.report_summary import FeedbackSummaryRequest
from app.providers.openai_summary import OpenAICompatibleSummaryGenerator
from app.services.report_summary import InvalidSummaryResponse, SummaryProviderUnavailable


class OpenAICompatibleSummaryGeneratorTest(unittest.TestCase):
    def setUp(self) -> None:
        self.captured_payload: dict[str, object] | None = None

    def test_returns_validated_structured_summary(self) -> None:
        def handler(request: httpx.Request) -> httpx.Response:
            self.captured_payload = json.loads(request.content)
            return httpx.Response(
                200,
                json={
                    "choices": [
                        {
                            "message": {
                                "content": json.dumps(
                                    {
                                        "summary": "The evidence shows steady progress.",
                                        "strengths": "The student contributed a clear explanation.",
                                        "nextSteps": "Document testing evidence more precisely.",
                                    }
                                )
                            }
                        }
                    ]
                },
            )

        generator = self._generator(httpx.MockTransport(handler))
        result = generator.summarize(self._request())

        self.assertEqual("The evidence shows steady progress.", result.summary)
        self.assertEqual("QWEN:Qwen/Qwen3-30B-A3B", result.provider)
        self.assertIsNotNone(self.captured_payload)
        assert self.captured_payload is not None
        self.assertEqual(False, self.captured_payload["chat_template_kwargs"]["enable_thinking"])
        self.assertEqual(0.8, self.captured_payload["top_p"])
        self.assertEqual(20, self.captured_payload["top_k"])
        self.assertEqual("json_schema", self.captured_payload["response_format"]["type"])
        messages = self.captured_payload["messages"]
        self.assertNotIn("Test Student", json.dumps(messages))
        generator.close()

    def test_lm_studio_payload_omits_vllm_specific_parameters(self) -> None:
        payload = self._capture_valid_payload(LlmRuntime.LM_STUDIO)

        self.assertNotIn("top_k", payload)
        self.assertNotIn("min_p", payload)
        self.assertNotIn("chat_template_kwargs", payload)
        self.assertFalse(payload["stream"])

    def test_ollama_payload_disables_reasoning_without_vllm_parameters(self) -> None:
        payload = self._capture_valid_payload(LlmRuntime.OLLAMA)

        self.assertEqual("none", payload["reasoning_effort"])
        self.assertNotIn("top_k", payload)
        self.assertNotIn("min_p", payload)
        self.assertNotIn("chat_template_kwargs", payload)

    def _capture_valid_payload(self, runtime: LlmRuntime) -> dict[str, object]:
        def handler(request: httpx.Request) -> httpx.Response:
            self.captured_payload = json.loads(request.content)
            return self._valid_response()

        generator = self._generator(
            httpx.MockTransport(handler),
            runtime=runtime,
        )
        try:
            generator.summarize(self._request())
        finally:
            generator.close()

        if self.captured_payload is None:
            self.fail("The provider did not send a request payload.")
        return self.captured_payload

    def test_rejects_markdown_or_incomplete_model_output(self) -> None:
        def handler(_: httpx.Request) -> httpx.Response:
            return httpx.Response(
                200,
                json={"choices": [{"message": {"content": "```json\n{}\n```"}}]},
            )

        generator = self._generator(httpx.MockTransport(handler))
        with self.assertRaises(InvalidSummaryResponse):
            generator.summarize(self._request())
        generator.close()

    def test_maps_inference_http_errors_to_provider_unavailable(self) -> None:
        def handler(_: httpx.Request) -> httpx.Response:
            return httpx.Response(503, json={"detail": "model is loading"})

        generator = self._generator(httpx.MockTransport(handler))
        with self.assertRaises(SummaryProviderUnavailable):
            generator.summarize(self._request())
        generator.close()

    def test_rejects_unreadable_provider_envelope(self) -> None:
        def handler(_: httpx.Request) -> httpx.Response:
            return httpx.Response(200, json={"choices": []})

        generator = self._generator(httpx.MockTransport(handler))
        with self.assertRaises(InvalidSummaryResponse):
            generator.summarize(self._request())
        generator.close()

    def test_request_rejects_blank_evidence_and_unknown_fields(self) -> None:
        with self.assertRaises(ValidationError):
            FeedbackSummaryRequest(
                classLabel="COMPSCI 335",
                dateFrom=date(2026, 7, 1),
                dateTo=date(2026, 9, 30),
                feedback=["   "],
            )
        with self.assertRaises(ValidationError):
            FeedbackSummaryRequest.model_validate(
                {
                    "classLabel": "COMPSCI 335",
                    "dateFrom": "2026-07-01",
                    "dateTo": "2026-09-30",
                    "feedback": ["Clear contribution."],
                    "studentName": "Must not cross the AI boundary",
                }
            )
        with self.assertRaises(ValidationError):
            FeedbackSummaryRequest(
                classLabel="COMPSCI 335",
                dateFrom=date(2026, 7, 1),
                dateTo=date(2026, 9, 30),
                feedback=["a" * 4000] * 13,
            )

    @staticmethod
    def _request() -> FeedbackSummaryRequest:
        return FeedbackSummaryRequest(
            classLabel="COMPSCI 335 · 2026 Teaching Year",
            dateFrom=date(2026, 7, 1),
            dateTo=date(2026, 9, 30),
            feedback=["Contributed a clear explanation during the group exercise."],
        )

    @staticmethod
    def _generator(
        transport: httpx.BaseTransport,
        runtime: LlmRuntime = LlmRuntime.VLLM,
    ) -> OpenAICompatibleSummaryGenerator:
        settings = ReportSummarySettings(
            runtime=runtime,
            base_url="http://qwen.test",
            api_key="test-key",
            model="Qwen/Qwen3-30B-A3B",
            timeout_seconds=5,
        )
        return OpenAICompatibleSummaryGenerator(settings, transport)

    @staticmethod
    def _valid_response() -> httpx.Response:
        return httpx.Response(
            200,
            json={
                "choices": [
                    {
                        "message": {
                            "content": json.dumps(
                                {
                                    "summary": "The evidence shows steady progress.",
                                    "strengths": "The student contributed a clear explanation.",
                                    "nextSteps": "Document testing evidence more precisely.",
                                }
                            )
                        }
                    }
                ]
            },
        )


if __name__ == "__main__":
    unittest.main()
