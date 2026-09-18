from typing import Final, Protocol

from app.models.face_enrollment import FaceEnrollmentResponse

MAX_IMAGE_BYTES: Final = 10 * 1024 * 1024
PNG_SIGNATURE: Final = b"\x89PNG\r\n\x1a\n"


def validate_image_bytes(content: bytes) -> bool:
    """Validate supported image signatures without relying on removed stdlib modules.

    This is transport validation, not face detection. The production model must still determine
    whether the image contains a suitable face.
    """
    if not content or len(content) > MAX_IMAGE_BYTES:
        return False

    jpeg = content.startswith(b"\xff\xd8\xff")
    png = content.startswith(PNG_SIGNATURE)
    gif = content.startswith((b"GIF87a", b"GIF89a"))
    bmp = content.startswith(b"BM")
    webp = len(content) >= 12 and content.startswith(b"RIFF") and content[8:12] == b"WEBP"
    return jpeg or png or gif or bmp or webp


class FaceEnrollmentAnalyzer(Protocol):
    """Provider contract implemented by the development mock and future laboratory model."""

    def analyze(self, student_id: str, content: bytes) -> FaceEnrollmentResponse:
        """Assess an enrollment capture without changing application registration state."""


class MockFaceEnrollmentAnalyzer:
    """Transport-only development implementation; it performs no biometric inference."""

    def analyze(self, student_id: str, content: bytes) -> FaceEnrollmentResponse:
        if not validate_image_bytes(content):
            return FaceEnrollmentResponse(
                studentId=student_id,
                imageAccepted=False,
                aiVerified=False,
                status="FAILED",
                message="Invalid image. The local mock could not read the uploaded file.",
            )

        return FaceEnrollmentResponse(
            studentId=student_id,
            imageAccepted=True,
            aiVerified=False,
            status="PHOTO_CAPTURED",
            message=(
                "Enrollment photo received. AI verification is not implemented in the local "
                "mock service."
            ),
        )
