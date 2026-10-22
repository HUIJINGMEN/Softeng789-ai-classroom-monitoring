import { AssistantResponse } from "./AssistantResponse";
import { AssistantFollowUps } from "./AssistantFollowUps";
import type { AssistantSource } from "./types";
import type { AdminAssistantState } from "./useAdminAssistant";
import { useAssistantPanel } from "./useAssistantPanel";
import { AssistantWelcome, AssistantComposer } from "./AssistantConversationParts";

export function AssistantPanel({
  state,
  onClose,
  onSource,
}: {
  readonly state: AdminAssistantState;
  readonly onClose: () => void;
  readonly onSource: (source: AssistantSource) => void;
}) {
  const { dialog, input, conversation, latestTurn, latestReply, titleId, busy } = useAssistantPanel(state);
  return (
    <dialog
      ref={dialog}
      className="admin-assistant-panel"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          onClose();
        }
      }}
    >
      <header className="assistant-panel-head">
        <div>
          <h2 id={titleId}>ClassLens Assistant</h2>
          <p>Admin · Read-only · Auckland time</p>
        </div>
        <div className="assistant-head-actions">
          <button
            type="button"
            className="assistant-text-button"
            disabled={busy || state.turns.length === 0}
            onClick={state.clear}
          >
            New chat
          </button>
          <button
            type="button"
            className="assistant-close"
            onClick={onClose}
            aria-label="Close assistant"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              aria-hidden="true"
            >
              <path d="m6 6 12 12M18 6 6 18" />
            </svg>
          </button>
        </div>
      </header>
      <div
        ref={conversation}
        className="assistant-conversation"
        role="log"
        aria-label="Assistant conversation"
        aria-relevant="additions text"
      >
        {state.turns.length === 0 && <AssistantWelcome state={state} input={input} />}
        {state.turns.map((turn) => (
          <section
            className="assistant-turn"
            key={turn.id}
            ref={
              turn.id === state.turns[state.turns.length - 1]?.id
                ? latestTurn
                : undefined
            }
          >
            <div className="assistant-question">
              <span>You</span>
              <p>{turn.question.message}</p>
              {turn.selection && <small>{turn.selection}</small>}
            </div>
            <div
              className="assistant-reply"
              ref={
                turn.id === state.turns[state.turns.length - 1]?.id
                  ? latestReply
                  : undefined
              }
            >
              <strong className="assistant-speaker">ClassLens</strong>
              <AssistantResponse
                turn={turn}
                disabled={busy}
                onRepeat={state.repeat}
                onSource={onSource}
                onResolveStudent={state.resolveStudent}
                active={
                  turn.id === state.turns[state.turns.length - 1]?.id && !busy
                }
              />
              {turn.answer &&
                turn.id === state.turns[state.turns.length - 1]?.id && (
                  <AssistantFollowUps
                    answer={turn.answer}
                    disabled={busy}
                    onAsk={state.send}
                  />
                )}
              {state.busyId === turn.id && (
                <div className="assistant-working" role="status">
                  <span
                    className="assistant-working-indicator"
                    aria-hidden="true"
                  />
                  <span>
                    Checking your question and records…
                    <small>
                      {state.elapsed < 10
                        ? "No records will be changed."
                        : `Still working · ${state.elapsed}s elapsed`}
                    </small>
                  </span>
                </div>
              )}
            </div>
          </section>
        ))}
      </div>
      <AssistantComposer state={state} input={input} titleId={titleId} busy={busy} />
    </dialog>
  );
}
