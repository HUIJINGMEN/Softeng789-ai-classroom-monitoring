"""Reject unauthorized/oversized CV requests before multipart parsing can spool images to disk."""
import hmac
import os
from starlette.responses import JSONResponse


class _RequestTooLarge(Exception):
    """The streamed request exceeded the CV boundary's byte limit."""


class VisionBoundary:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope['type'] != 'http' or not scope['path'].startswith('/v2/face/'):
            return await self.app(scope, receive, send)
        headers = dict(scope.get('headers', []))
        key = os.environ.get('CV_SERVICE_KEY', '')
        supplied = headers.get(b'x-cv-service-key', b'').decode('latin1')
        if len(key) < 32 or not hmac.compare_digest(key.encode('utf-8'), supplied.encode('utf-8')):
            return await JSONResponse({'detail': 'CV service unavailable or unauthorized.'}, status_code=503 if len(key) < 32 else 401)(scope, receive, send)
        try:
            body = await self._read_body(receive)
        except _RequestTooLarge:
            return await JSONResponse({'detail': 'CV request exceeds 9 MB.'}, status_code=413)(scope, receive, send)
        if body is not None:
            await self._forward(scope, receive, send, body)

    @staticmethod
    async def _read_body(receive):
        chunks, total = [], 0
        while True:
            message = await receive()
            if message['type'] == 'http.disconnect':
                return
            content = message.get('body', b'')
            total += len(content)
            if total > 9 * 1024 * 1024:
                raise _RequestTooLarge()
            chunks.append(content)
            if not message.get('more_body', False):
                break
        return b''.join(chunks)

    async def _forward(self, scope, receive, send, body):
        delivered = False

        async def bounded_receive():
            nonlocal delivered
            if not delivered:
                delivered = True
                return {'type': 'http.request', 'body': body, 'more_body': False}
            return await receive()

        async def no_cache(message):
            if message['type'] == 'http.response.start':
                message.setdefault('headers', []).append((b'cache-control', b'no-store'))
            await send(message)

        await self.app(scope, bounded_receive, no_cache)
