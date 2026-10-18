import unittest
from unittest.mock import AsyncMock

from fastapi import FastAPI, Request
from fastapi.testclient import TestClient

from app.security import AdapterSecurityMiddleware


class AdapterSecurityTest(unittest.TestCase):
    def client(self, key="test-only-secret", limit=32):
        app = FastAPI()
        app.add_middleware(AdapterSecurityMiddleware, key=key, max_bytes=limit)

        @app.get("/health")
        def health():
            return {"status": "ok"}

        @app.post("/echo")
        async def echo(request: Request):
            return {"size": len(await request.body())}

        return TestClient(app)

    def test_missing_configuration_fails_closed_but_health_is_public(self):
        with self.client(key="") as client:
            self.assertEqual(client.get("/health").status_code, 200)
            self.assertEqual(client.post("/echo", content=b"x").status_code, 503)

    def test_missing_or_wrong_key_cannot_reach_the_adapter(self):
        with self.client() as client:
            for headers in ({}, {"X-AI-Adapter-Key": "wrong"}):
                self.assertEqual(client.post("/echo", content=b"x", headers=headers).status_code, 401)
            response = client.post("/echo", content=b"123", headers={"X-AI-Adapter-Key": "test-only-secret"})
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json()["size"], 3)

    def test_declared_and_streamed_oversized_bodies_are_rejected(self):
        with self.client() as client:
            headers = {"X-AI-Adapter-Key": "test-only-secret"}
            self.assertEqual(client.post("/echo", content=b"x" * 33, headers=headers).status_code, 413)
            self.assertEqual(client.post("/echo", content=iter([b"x" * 20, b"y" * 20]), headers=headers).status_code, 413)
            self.assertEqual(client.post("/echo", content=b"x", headers={**headers, "Content-Length": "invalid"}).status_code, 400)

    def test_exact_limit_empty_body_negative_length_and_oversized_key(self):
        with self.client() as client:
            headers = {"X-AI-Adapter-Key": "test-only-secret"}
            self.assertEqual(client.post("/echo", content=b"x" * 32, headers=headers).status_code, 200)
            self.assertEqual(client.post("/echo", content=b"", headers=headers).status_code, 200)
            self.assertEqual(client.post("/echo", content=b"x", headers={**headers, "Content-Length": "-1"}).status_code, 413)
            self.assertEqual(client.post("/echo", content=b"x", headers={"X-AI-Adapter-Key": "x" * 513}).status_code, 401)


class AdapterStreamingSecurityTest(unittest.IsolatedAsyncioTestCase):
    def scope(self):
        return {"type": "http", "path": "/echo", "headers": [(b"x-ai-adapter-key", b"test-key")]}

    async def test_real_asgi_chunks_over_limit_never_reach_the_route(self):
        app = AsyncMock()
        middleware = AdapterSecurityMiddleware(app, key="test-key", max_bytes=8)
        receive = AsyncMock(side_effect=[
            {"type": "http.request", "body": b"12345", "more_body": True},
            {"type": "http.request", "body": b"6789", "more_body": False},
        ])
        send = AsyncMock()
        await middleware(self.scope(), receive, send)
        app.assert_not_awaited()
        self.assertEqual(send.await_args_list[0].args[0]["status"], 413)

    async def test_chunks_are_replayed_exactly_once_then_disconnect_is_forwarded(self):
        received = []

        async def app(scope, receive, send):
            received.append(await receive())
            received.append(await receive())

        middleware = AdapterSecurityMiddleware(app, key="test-key", max_bytes=8)
        receive = AsyncMock(side_effect=[
            {"type": "http.request", "body": b"1234", "more_body": True},
            {"type": "http.request", "body": b"5678", "more_body": False},
            {"type": "http.disconnect"},
        ])
        await middleware(self.scope(), receive, AsyncMock())
        self.assertEqual(received, [{"type": "http.request", "body": b"12345678", "more_body": False},
                                    {"type": "http.disconnect"}])

    async def test_disconnect_and_unauthorized_requests_never_reach_the_route(self):
        app = AsyncMock()
        middleware = AdapterSecurityMiddleware(app, key="test-key", max_bytes=8)
        receive = AsyncMock(return_value={"type": "http.disconnect"})
        await middleware(self.scope(), receive, AsyncMock())
        app.assert_not_awaited()
        receive.reset_mock()
        await middleware({"type": "http", "path": "/echo", "headers": []}, receive, AsyncMock())
        app.assert_not_awaited()
        receive.assert_not_awaited()
