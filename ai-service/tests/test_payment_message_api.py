import unittest
from unittest.mock import Mock

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.payment_message import router
from app.dependencies import get_payment_message_generator
from app.models.payment_message import PaymentMessageResponse, PaymentMessageTone
from app.services.payment_message import InvalidPaymentMessage, PaymentMessageProviderUnavailable


class PaymentMessageApiTest(unittest.TestCase):
    def setUp(self) -> None:
        app = FastAPI()
        app.include_router(router)
        self.generator = Mock()
        app.dependency_overrides[get_payment_message_generator] = lambda: self.generator
        self.client = TestClient(app)
        self.request = {"balance": "NZD 500.00", "dueDate": "2026-10-20", "tone": "NOTICE"}

    def tearDown(self) -> None:
        self.client.close()

    def test_injects_generator_and_preserves_typed_response(self) -> None:
        self.generator.generate.return_value = PaymentMessageResponse(
            message="Please review the outstanding balance.",
            tone=PaymentMessageTone.NOTICE,
            provider="QWEN:test",
        )
        response = self.client.post("/summaries/payment-message", json=self.request)
        self.assertEqual(200, response.status_code)
        self.assertEqual("QWEN:test", response.json()["provider"])
        self.assertEqual("NOTICE", response.json()["tone"])
        self.generator.generate.assert_called_once()
        self.assertEqual("NZD 500.00", self.generator.generate.call_args.args[0].balance)

    def test_rejects_student_identity_before_calling_provider(self) -> None:
        response = self.client.post(
            "/summaries/payment-message", json={**self.request, "studentName": "Do not send"}
        )
        self.assertEqual(422, response.status_code)
        self.generator.generate.assert_not_called()

    def test_maps_provider_errors_without_calling_external_services(self) -> None:
        for error, expected_status in (
            (PaymentMessageProviderUnavailable("unavailable"), 503),
            (InvalidPaymentMessage("invalid output"), 502),
        ):
            with self.subTest(status=expected_status):
                self.generator.generate.side_effect = error
                response = self.client.post("/summaries/payment-message", json=self.request)
                self.assertEqual(expected_status, response.status_code)
                self.assertEqual(str(error), response.json()["detail"])

    def test_return_annotation_still_defines_openapi_response(self) -> None:
        schema = self.client.get("/openapi.json").json()
        response_schema = schema["paths"]["/summaries/payment-message"]["post"]["responses"]["200"]["content"]["application/json"]["schema"]
        self.assertEqual("#/components/schemas/PaymentMessageResponse", response_schema["$ref"])
