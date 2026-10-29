import os
import unittest
from unittest.mock import AsyncMock, patch

from app.api.vision_boundary import VisionBoundary


class VisionBoundaryTests(unittest.IsolatedAsyncioTestCase):
    def scope(self, key=b't' * 32):
        return {'type': 'http', 'path': '/v2/face/recognize',
                'headers': [(b'x-cv-service-key', key)]}

    async def test_authentication_rejects_before_reading_the_body(self):
        for configured, supplied, status in [('', b't' * 32, 503), ('t' * 32, b'wrong', 401)]:
            with self.subTest(status=status), patch.dict(os.environ, {'CV_SERVICE_KEY': configured}):
                app, receive, send = AsyncMock(), AsyncMock(), AsyncMock()
                await VisionBoundary(app)(self.scope(supplied), receive, send)
                app.assert_not_awaited()
                receive.assert_not_awaited()
                self.assertEqual(send.await_args_list[0].args[0]['status'], status)

    async def test_streamed_limit_and_disconnect_never_reach_the_route(self):
        scenarios = [([
            {'type': 'http.request', 'body': b'x' * (9 * 1024 * 1024), 'more_body': True},
            {'type': 'http.request', 'body': b'x', 'more_body': False},
        ], 413), ([{'type': 'http.disconnect'}], None)]
        with patch.dict(os.environ, {'CV_SERVICE_KEY': 't' * 32}):
            for messages, status in scenarios:
                with self.subTest(status=status):
                    app, send = AsyncMock(), AsyncMock()
                    await VisionBoundary(app)(self.scope(), AsyncMock(side_effect=messages), send)
                    app.assert_not_awaited()
                    if status is None:
                        send.assert_not_awaited()
                    else:
                        self.assertEqual(send.await_args_list[0].args[0]['status'], status)

    async def test_body_is_replayed_once_and_responses_remain_uncached(self):
        for body in (b'', b'x' * (9 * 1024 * 1024)):
            with self.subTest(size=len(body)), patch.dict(os.environ, {'CV_SERVICE_KEY': 't' * 32}):
                received = []

                async def app(scope, receive, send):
                    received.append(await receive())
                    received.append(await receive())
                    await send({'type': 'http.response.start', 'status': 200,
                                'headers': [(b'content-type', b'application/json')]})
                    await send({'type': 'http.response.body', 'body': b'{}'})

                middle = len(body) // 2
                receive = AsyncMock(side_effect=[
                    {'type': 'http.request', 'body': body[:middle], 'more_body': True},
                    {'type': 'http.request', 'body': body[middle:], 'more_body': False},
                    {'type': 'http.disconnect'},
                ])
                send = AsyncMock()
                await VisionBoundary(app)(self.scope(), receive, send)
                self.assertEqual(received, [
                    {'type': 'http.request', 'body': body, 'more_body': False},
                    {'type': 'http.disconnect'},
                ])
                headers = dict(send.await_args_list[0].args[0]['headers'])
                self.assertEqual(headers[b'cache-control'], b'no-store')
                self.assertEqual(headers[b'content-type'], b'application/json')

    async def test_other_routes_and_non_http_scopes_pass_through(self):
        for scope in ({'type': 'http', 'path': '/health'}, {'type': 'lifespan'}):
            with self.subTest(scope=scope):
                app, receive, send = AsyncMock(), AsyncMock(), AsyncMock()
                await VisionBoundary(app)(scope, receive, send)
                app.assert_awaited_once_with(scope, receive, send)
                receive.assert_not_awaited()
