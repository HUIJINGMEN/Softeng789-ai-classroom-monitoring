import json
import unittest
from datetime import date
from unittest.mock import Mock

import httpx
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.admin_assistant import router
from app.config.settings import LlmRuntime, PrivateLlmSettings
from app.dependencies import get_admin_assistant_planner
from app.models.admin_assistant import AssistantPlanRequest, AssistantPlanResponse
from app.providers.openai_admin_assistant import AssistantUnavailable, InvalidAssistantPlan, OpenAICompatibleAssistantPlanner


PLAN = {"intent": "ATTENDANCE", "studentQuery": "Ana Ngata", "courseQuery": "",
        "dateFrom": "2026-10-16", "dateTo": "2026-10-16", "usePreviousStudent": False, "language": "zh"}


class AssistantPlannerTest(unittest.TestCase):
    def make_planner(self, handler):
        return OpenAICompatibleAssistantPlanner(PrivateLlmSettings(model="test-model", runtime=LlmRuntime.OLLAMA), httpx.MockTransport(handler))

    def test_extracts_a_typed_plan_without_generating_record_facts(self):
        captured = []

        def handler(request):
            captured.append(json.loads(request.content))
            return httpx.Response(200, json={"choices": [{"message": {"content": json.dumps(PLAN)}}]})

        planner = self.make_planner(handler)
        try:
            result = planner.plan(AssistantPlanRequest(message="Ana 今天来了吗？", today=date(2026, 10, 16)))
            self.assertEqual("QWEN:test-model", result.provider)
            self.assertEqual("Ana Ngata", result.studentQuery)
            payload = captured[0]
            self.assertEqual(0, payload["temperature"])
            self.assertEqual("json_schema", payload["response_format"]["type"])
            self.assertTrue(payload["response_format"]["json_schema"]["strict"])
            self.assertEqual("none", payload["reasoning_effort"])
            self.assertIn("2026-10-16", payload["messages"][1]["content"])
            self.assertIn("never an answer, SQL", payload["messages"][0]["content"])
            self.assertNotIn("balance", payload["messages"][1]["content"])
        finally:
            planner.close()

    def test_rejects_unknown_tools_unexpected_fields_and_malformed_dates(self):
        for content in ({**PLAN, "intent": "DELETE"}, {**PLAN, "sql": "drop table students"},
                        {**PLAN, "dateFrom": "yesterday"}, {**PLAN, "language": "unknown"}, {"answer": "Paid"}):
            with self.subTest(content=content):
                planner = self.make_planner(lambda _: httpx.Response(200, json={"choices": [{"message": {"content": json.dumps(content)}}]}))
                try:
                    with self.assertRaises(InvalidAssistantPlan):
                        planner.plan(AssistantPlanRequest(message="test", today=date(2026, 10, 16)))
                finally:
                    planner.close()

    def test_provider_failure_never_returns_a_fake_answer(self):
        planner = self.make_planner(lambda _: httpx.Response(503))
        try:
            with self.assertRaises(AssistantUnavailable):
                planner.plan(AssistantPlanRequest(message="test", today=date(2026, 10, 16)))
        finally:
            planner.close()


class AssistantApiTest(unittest.TestCase):
    def setUp(self):
        app = FastAPI()
        app.include_router(router)
        self.planner = Mock()
        app.dependency_overrides[get_admin_assistant_planner] = lambda: self.planner
        self.client = TestClient(app)
        self.body = {"message": "Ana 今天来了吗？", "today": "2026-10-16"}

    def tearDown(self):
        self.client.close()

    def test_route_preserves_typed_output(self):
        self.planner.plan.return_value = AssistantPlanResponse(**PLAN, provider="QWEN:test")
        response = self.client.post("/assistant/plan", json=self.body)
        self.assertEqual(200, response.status_code)
        self.assertEqual("ATTENDANCE", response.json()["intent"])
        self.assertEqual("QWEN:test", response.json()["provider"])

    def test_student_count_is_a_typed_plan_not_a_model_generated_number(self):
        self.planner.plan.return_value = AssistantPlanResponse(**{**PLAN, "intent": "STUDENT_COUNT", "studentQuery": "", "language": "en"}, provider="QWEN:test")
        response = self.client.post("/assistant/plan", json={**self.body, "message": "What is our student headcount?"})
        self.assertEqual(200, response.status_code)
        self.assertEqual("STUDENT_COUNT", response.json()["intent"])
        self.assertNotIn("count", response.json())

    def test_input_limits_reject_unknown_data_before_model_execution(self):
        for body in ({**self.body, "message": " "}, {**self.body, "message": "x" * 1001},
                     {**self.body, "history": ["x"] * 5}, {**self.body, "history": ["x" * 1001]},
                     {**self.body, "invoices": [{"balance": 500}]}):
            with self.subTest(body=body):
                self.assertEqual(422, self.client.post("/assistant/plan", json=body).status_code)
        self.planner.plan.assert_not_called()

    def test_errors_are_explicit_and_retryable(self):
        for error, status in ((AssistantUnavailable("offline"), 503), (InvalidAssistantPlan("invalid"), 502)):
            with self.subTest(status=status):
                self.planner.plan.side_effect = error
                self.assertEqual(status, self.client.post("/assistant/plan", json=self.body).status_code)
