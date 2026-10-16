import type { RefObject } from "react";
import { IconMessageSquare, IconArrowRight } from "../../components/icons";
import { STARTERS } from "./assistantModel";
import type { AdminAssistantState } from "./useAdminAssistant";

interface InputProps {
  readonly state: AdminAssistantState;
  readonly input: RefObject<HTMLTextAreaElement>;
}

export function AssistantWelcome({ state, input }: InputProps) {
  return (
    <section className="assistant-welcome">
      <span className="assistant-welcome-icon" aria-hidden="true">
        <IconMessageSquare />
      </span>
      <h3>
        Find the answer.
        <br />
        Skip the search.
      </h3>
      <p>
        Ask about a student's attendance, upcoming lessons or payment
        status. Answers link to the records behind them.
      </p>
      <div className="assistant-starters">
        {STARTERS.map((starter) => (
          <button
            key={starter.label}
            type="button"
            onClick={() => {
              if ("fill" in starter) {
                state.setDraft(starter.question);
                input.current?.focus();
              } else state.send(starter.question);
            }}
          >
            {starter.label}
            <span className="assistant-starter-arrow" aria-hidden="true">
              <IconArrowRight />
            </span>
          </button>
        ))}
      </div>
      <p className="assistant-welcome-note">
        Use a name or student number. I will ask you to choose if more
        than one student matches.
      </p>
    </section>
  );
}

export function AssistantComposer({ state, input, titleId, busy }: InputProps & { readonly titleId: string; readonly busy: boolean }) {
  return (
    <form
      className="assistant-composer"
      onSubmit={(event) => {
        event.preventDefault();
        state.send();
      }}
    >
      <label className="sr-only" htmlFor={`${titleId}-question`}>
        Ask the administrator assistant
      </label>
      <div className="assistant-composer-field">
        <textarea
          ref={input}
          id={`${titleId}-question`}
          rows={2}
          maxLength={1000}
          value={state.draft}
          placeholder="Ask in English or 中文…"
          onChange={(event) => state.setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (
              event.key === "Enter" &&
              !event.shiftKey &&
              !event.nativeEvent.isComposing
            ) {
              event.preventDefault();
              state.send();
            }
          }}
        />
        <button
          type="submit"
          className="assistant-send"
          disabled={busy || !state.draft.trim()}
          aria-label="Send question"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            aria-hidden="true"
          >
            <path d="M12 19V5m-6 6 6-6 6 6" />
          </svg>
        </button>
      </div>
      <p>
        Enter to send · Shift+Enter for a new line. Check source records
        before acting.
      </p>
    </form>
  );
}
