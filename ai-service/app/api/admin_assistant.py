from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException

from app.dependencies import get_admin_assistant_planner
from app.models.admin_assistant import AssistantPlanRequest, AssistantPlanResponse
from app.providers.openai_admin_assistant import (
    AssistantUnavailable, InvalidAssistantPlan, OpenAICompatibleAssistantPlanner,
)

router = APIRouter(prefix="/assistant", tags=["read-only assistant"])


@router.post("/plan", response_model=AssistantPlanResponse)
def plan_admin_query(
    request: AssistantPlanRequest,
    planner: Annotated[OpenAICompatibleAssistantPlanner, Depends(get_admin_assistant_planner)],
) -> AssistantPlanResponse:
    try:
        return planner.plan(request)
    except AssistantUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except InvalidAssistantPlan as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
