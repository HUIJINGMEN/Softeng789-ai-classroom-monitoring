import json
import unittest

import httpx
from pydantic import ValidationError

from app.config.settings import LlmRuntime, PrivateLlmSettings
from app.models.payment_message import PaymentMessageRequest, PaymentMessageTone
from app.providers.openai_payment_message import OpenAICompatiblePaymentMessageGenerator
from app.services.payment_message import InvalidPaymentMessage, PaymentMessageProviderUnavailable


class OpenAICompatiblePaymentMessageGeneratorTest(unittest.TestCase):
    def setUp(self) -> None:
        self.payload: dict[str, object] | None = None

    def test_returns_reviewable_message_without_student_identity(self) -> None:
        def handler(request: httpx.Request) -> httpx.Response:
            self.payload = json.loads(request.content)
            return httpx.Response(200, json={"choices": [{"message": {"content": json.dumps({
                "message": "You attended six of the ten sessions in this package. Four sessions remain available."
            })}}]})

        generator = self._generator(httpx.MockTransport(handler))
        result = generator.generate(self._request())
        generator.close()

        self.assertEqual(PaymentMessageTone.ENCOURAGE, result.tone)
        self.assertTrue(result.provider.startswith("QWEN:"))
        assert self.payload is not None
        self.assertFalse(self.payload["chat_template_kwargs"]["enable_thinking"])
        prompt = json.dumps(self.payload["messages"])
        self.assertIn("Sessions attended: 6", prompt)
        self.assertIn("Purchase: Lesson package", prompt)
        self.assertNotIn("studentName", prompt)

    def test_rejects_invalid_provider_output(self) -> None:
        generator = self._generator(httpx.MockTransport(
            lambda _: httpx.Response(200, json={"choices": [{"message": {"content": "{}"}}]})
        ))
        request = self._request()
        with self.assertRaises(InvalidPaymentMessage):
            generator.generate(request)
        generator.close()

    def test_maps_provider_failure(self) -> None:
        generator = self._generator(httpx.MockTransport(
            lambda _: httpx.Response(503, json={"detail": "loading"})
        ))
        request = self._request()
        with self.assertRaises(PaymentMessageProviderUnavailable):
            generator.generate(request)
        generator.close()

    def test_requires_complete_session_context_and_forbids_extra_fields(self) -> None:
        with self.assertRaises(ValidationError):
            PaymentMessageRequest(
                purchasedSessions=10,
                balance="NZD 500.00",
                dueDate="2026-10-20",
                tone=PaymentMessageTone.NOTICE,
            )
        with self.assertRaises(ValidationError):
            PaymentMessageRequest.model_validate({
                "balance": "NZD 500.00",
                "dueDate": "2026-10-20",
                "tone": "NOTICE",
                "studentName": "Must stay outside the AI boundary",
            })

    @staticmethod
    def _request() -> PaymentMessageRequest:
        return PaymentMessageRequest(
            courseLabel="COMPSCI 335 · 2026 Teaching Year",
            purchaseDescription="Lesson package",
            purchasedSessions=10,
            attendedSessions=6,
            chargeableAbsences=0,
            remainingSessions=4,
            balance="NZD 500.00",
            dueDate="2026-10-20",
            tone=PaymentMessageTone.ENCOURAGE,
        )

    @staticmethod
    def _generator(transport: httpx.BaseTransport) -> OpenAICompatiblePaymentMessageGenerator:
        return OpenAICompatiblePaymentMessageGenerator(
            PrivateLlmSettings(
                runtime=LlmRuntime.VLLM,
                base_url="http://qwen.test",
                api_key="test-key",
                model="Qwen/Qwen3-30B-A3B",
                timeout_seconds=5,
            ),
            transport,
        )


if __name__ == "__main__":
    unittest.main()
