import { assistantFollowUps } from "./assistantSuggestions";
import type { AssistantAnswer, AssistantContext } from "./types";

export function AssistantFollowUps({
  answer,
  disabled,
  onAsk,
}: {
  readonly answer: AssistantAnswer;
  readonly disabled: boolean;
  readonly onAsk: (message: string, context: AssistantContext | null) => void;
}) {
  const actions = assistantFollowUps(answer);
  if (actions.length === 0) return null;
  return (
    <div
      className="assistant-followups"
      aria-label={answer.language === "zh" ? "推荐查询" : "Suggested queries"}
    >
      <span>{answer.language === "zh" ? "你可以继续查" : "You can check"}</span>
      <div>
        {actions.map((action) => (
          <button
            key={action.label}
            type="button"
            disabled={disabled}
            onClick={() => onAsk(action.message, action.context)}
          >
            {action.label}
          </button>
        ))}
      </div>
    </div>
  );
}
