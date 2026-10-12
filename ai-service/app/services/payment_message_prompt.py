from typing import Final

from app.models.payment_message import PaymentMessageRequest

SYSTEM_PROMPT: Final = """Write a short, respectful student invoice note.
Use only the supplied facts. Attendance counts are administrative records, not evidence of intent,
motivation, health, or personal circumstances. Never shame, pressure, threaten, or claim that a
payment has been made. If the tone is NOTICE, state the attendance pattern neutrally and invite the
student to contact the office if the record needs review. If the tone is ENCOURAGE, acknowledge the
record warmly without exaggeration. Mention the amount and due date once. Return only the requested
JSON object and no markdown or hidden reasoning."""

MESSAGE_SCHEMA: Final = {
    "type": "object",
    "properties": {"message": {"type": "string", "minLength": 1, "maxLength": 650}},
    "required": ["message"],
    "additionalProperties": False,
}


def build_payment_messages(request: PaymentMessageRequest) -> list[dict[str, str]]:
    session_facts = _session_facts(request)
    user_prompt = (
        f"Tone: {request.tone.value}\n"
        f"Course: {request.courseLabel or 'Not linked to a course'}\n"
        f"Purchase: {request.purchaseDescription or 'General account charge'}\n"
        f"{session_facts}"
        f"Amount due: {request.balance}\n"
        f"Due date: {request.dueDate}\n\n"
        "Write 2-3 concise sentences for the student. Do not add a greeting or sign-off.\n/no_think"
    )
    return [{"role": "system", "content": SYSTEM_PROMPT}, {"role": "user", "content": user_prompt}]


def _session_facts(request: PaymentMessageRequest) -> str:
    if request.purchasedSessions is None:
        return "Attendance-linked package: none\n"
    return (
        f"Sessions purchased: {request.purchasedSessions}\n"
        f"Sessions attended: {request.attendedSessions}\n"
        f"Chargeable absences: {request.chargeableAbsences}\n"
        f"Sessions remaining: {request.remainingSessions}\n"
    )
