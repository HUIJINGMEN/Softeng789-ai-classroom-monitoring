from pydantic import BaseModel


class FaceEnrollmentResponse(BaseModel):
    studentId: str
    imageAccepted: bool
    aiVerified: bool
    status: str
    message: str
