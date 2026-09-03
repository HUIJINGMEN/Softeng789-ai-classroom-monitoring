from pydantic import BaseModel


class Settings(BaseModel):
    service_name: str = "ai-service"
    model_name: str = "yolo-person-detection-week-3"


settings = Settings()
