import unittest

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.face_enrollment import router


class FaceEnrollmentApiTest(unittest.TestCase):
    def setUp(self):
        app = FastAPI()
        app.include_router(router)
        self.client = TestClient(app)

    def tearDown(self):
        self.client.close()

    def test_multipart_capture_route_works_without_claiming_real_verification(self):
        response = self.client.post("/face/enroll/captures",
            data={"subject_id": "test-only", "poses": '["front"]'},
            files=[("images", ("front.jpg", b"\xff\xd8\xff\xe0test", "image/jpeg"))])
        self.assertEqual(200, response.status_code)
        self.assertFalse(response.json()["aiVerified"])
        self.assertEqual("PHOTO_CAPTURED", response.json()["status"])

    def test_pose_count_must_match_images_before_provider_execution(self):
        response = self.client.post("/face/enroll/captures",
            data={"subject_id": "test-only", "poses": '["front", "left"]'},
            files=[("images", ("front.jpg", b"\xff\xd8\xff\xe0test", "image/jpeg"))])
        self.assertEqual(400, response.status_code)
