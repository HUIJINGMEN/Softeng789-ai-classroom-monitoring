import unittest

from app.services.face_enrollment import (
    MAX_IMAGE_BYTES,
    MockFaceEnrollmentAnalyzer,
    validate_image_bytes,
)


class ValidateImageBytesTest(unittest.TestCase):
    def test_accepts_supported_image_signatures(self) -> None:
        samples = (
            b"\xff\xd8\xff\xe0jpeg",
            b"\x89PNG\r\n\x1a\npng",
            b"GIF89agif",
            b"BMbitmap",
            b"RIFF\x04\x00\x00\x00WEBPdata",
        )

        for sample in samples:
            with self.subTest(sample=sample[:4]):
                self.assertTrue(validate_image_bytes(sample))

    def test_rejects_empty_unknown_and_oversized_content(self) -> None:
        self.assertFalse(validate_image_bytes(b""))
        self.assertFalse(validate_image_bytes(b"plain text"))
        self.assertFalse(validate_image_bytes(b"\xff\xd8\xff" + b"x" * MAX_IMAGE_BYTES))

    def test_mock_analyzer_never_claims_ai_verification(self) -> None:
        response = MockFaceEnrollmentAnalyzer().analyze("student-1", b"\xff\xd8\xff\xe0jpeg")

        self.assertTrue(response.imageAccepted)
        self.assertFalse(response.aiVerified)
        self.assertEqual("PHOTO_CAPTURED", response.status)


if __name__ == "__main__":
    unittest.main()
