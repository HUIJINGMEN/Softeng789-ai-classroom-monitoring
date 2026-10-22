"""Machine authentication and bounded bodies at the adapter boundary, not individual routes."""
import hmac
import os

from starlette.responses import JSONResponse

MAX_REQUEST_BYTES = 8 * 1024 * 1024


class RequestBodyTooLarge(Exception):
    """The streamed body exceeded the adapter boundary before reaching any route."""


class AdapterSecurityMiddleware:
    def __init__(self, app, key=None, max_bytes=MAX_REQUEST_BYTES):
        self.app = app
        self.key = os.getenv("AI_ADAPTER_KEY", "") if key is None else key
        self.max_bytes = max_bytes

    async def __call__(self, scope, receive, send):
        # /v2/face/ is protected by VisionBoundary's separate CV service key and
        # 9 MB in-memory body limit. Do not apply the legacy adapter's key/8 MB
        # limit to that independently authenticated protocol.
        if (scope["type"] != "http" or scope.get("path") == "/health"
                or scope.get("path", "").startswith("/v2/face/")):
            return await self.app(scope, receive, send)
        error = self.request_error(dict(scope.get("headers", [])))
        if error is not None:
            return await error(scope, receive, send)
        try:
            body = await self.read_body(receive)
        except RequestBodyTooLarge:
            return await self.too_large(scope, receive, send)
        if body is None:
            return
        delivered = False

        async def replay():
            nonlocal delivered
            if delivered:
                return await receive()
            delivered = True
            return {"type": "http.request", "body": body, "more_body": False}

        return await self.app(scope, replay, send)

    def request_error(self, headers):
        provided = headers.get(b"x-ai-adapter-key", b"")
        if not self.key:
            return JSONResponse({"detail": "AI adapter authentication is not configured."}, 503)
        if len(provided) > 512 or not hmac.compare_digest(provided, self.key.encode()):
            return JSONResponse({"detail": "Invalid AI adapter credentials."}, 401)
        try:
            declared = int(headers.get(b"content-length", b"0"))
        except ValueError:
            return JSONResponse({"detail": "Invalid Content-Length."}, 400)
        if declared < 0 or declared > self.max_bytes:
            return JSONResponse({"detail": "Request body exceeds the adapter limit."}, 413)
        return None

    async def read_body(self, receive):
        body = bytearray()
        while True:
            message = await receive()
            if message["type"] == "http.disconnect":
                return
            chunk = message.get("body", b"")
            if len(body) + len(chunk) > self.max_bytes:
                raise RequestBodyTooLarge
            body.extend(chunk)
            if not message.get("more_body", False):
                return bytes(body)

    async def too_large(self, scope, receive, send):
        return await JSONResponse({"detail": "Request body exceeds the adapter limit."}, 413)(scope, receive, send)
