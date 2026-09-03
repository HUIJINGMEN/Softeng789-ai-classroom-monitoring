from pydantic import BaseModel


class PersonDetectionPlaceholderResponse(BaseModel):
    status: str
    message: str
