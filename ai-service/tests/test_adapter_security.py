import unittest

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
            self.assertEqual(200, client.get("/health").status_code)
            self.assertEqual(503, client.post("/echo", content=b"x").status_code)

    def test_missing_or_wrong_key_cannot_reach_the_adapter(self):
        with self.client() as client:
            for headers in ({}, {"X-AI-Adapter-Key": "wrong"}):
                self.assertEqual(401, client.post("/echo", content=b"x", headers=headers).status_code)
            response = client.post("/echo", content=b"123", headers={"X-AI-Adapter-Key": "test-only-secret"})
            self.assertEqual(200, response.status_code)
            self.assertEqual(3, response.json()["size"])

    def test_declared_and_streamed_oversized_bodies_are_rejected(self):
        with self.client() as client:
            headers = {"X-AI-Adapter-Key": "test-only-secret"}
            self.assertEqual(413, client.post("/echo", content=b"x" * 33, headers=headers).status_code)
            self.assertEqual(413, client.post("/echo", content=iter([b"x" * 20, b"y" * 20]), headers=headers).status_code)
            self.assertEqual(400, client.post("/echo", content=b"x", headers={**headers, "Content-Length": "invalid"}).status_code)
