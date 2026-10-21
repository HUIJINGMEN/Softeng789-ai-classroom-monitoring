import { request } from "../../lib/apiClient";
import type { AssistantAnswer, AssistantQuestion } from "./types";

export function askAssistant(question: AssistantQuestion, signal: AbortSignal) {
  return request<AssistantAnswer>("/api/admin/assistant/ask", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(question),
    signal,
  });
}
