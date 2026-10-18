"""Machine authentication and bounded bodies at the adapter boundary, not individual routes."""
import hmac
import os

from starlette.responses import JSONResponse

MAX_REQUEST_BYTES = 8 * 1024 * 1024


class AdapterSecurityMiddleware:
    def __init__(self, app, key=None, max_bytes=MAX_REQUEST_BYTES):
        self.app = app
        self.key = os.getenv("AI_ADAPTER_KEY", "") if key is None else key
        self.max_bytes = max_bytes

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http" or scope.get("path") == "/health":
            return await self.app(scope, receive, send)
        headers = dict(scope.get("headers", []))
        provided = headers.get(b"x-ai-adapter-key", b"")
        if not self.key:
            return await JSONResponse({"detail": "AI adapter authentication is not configured."}, 503)(scope, receive, send)
        if len(provided) > 512 or not hmac.compare_digest(provided, self.key.encode()):
            return await JSONResponse({"detail": "Invalid AI adapter credentials."}, 401)(scope, receive, send)
        try:
            declared = int(headers.get(b"content-length", b"0"))
        except ValueError:
            return await JSONResponse({"detail": "Invalid Content-Length."}, 400)(scope, receive, send)
        if declared < 0 or declared > self.max_bytes:
            return await self.too_large(scope, receive, send)
        body = bytearray()
        while True:
            message = await receive()
            if message["type"] == "http.disconnect":
                return
            body.extend(message.get("body", b""))
            if len(body) > self.max_bytes:
                return await self.too_large(scope, receive, send)
            if not message.get("more_body", False):
                break
        delivered = False

        async def replay():
            nonlocal delivered
            if delivered:
                return await receive()
            delivered = True
            return {"type": "http.request", "body": bytes(body), "more_body": False}

        return await self.app(scope, replay, send)

    async def too_large(self, scope, receive, send):
        return await JSONResponse({"detail": "Request body exceeds the adapter limit."}, 413)(scope, receive, send)
