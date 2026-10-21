import { useCallback, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { IconMessageSquare } from "../../components/icons";
import { AssistantPanel } from "./AssistantPanel";
import { useAdminAssistant } from "./useAdminAssistant";
import type { AssistantSource } from "./types";
import "./admin-assistant.css";

export function AdminAssistant({
  onSource,
}: {
  readonly onSource: (source: AssistantSource) => void;
}) {
  const [open, setOpen] = useState(false);
  const state = useAdminAssistant();
  const launcher = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => {
    setOpen(false);
    window.requestAnimationFrame(() => launcher.current?.focus());
  }, []);
  return createPortal(
    <div className="admin-assistant">
      {!open && (
        <button
          ref={launcher}
          type="button"
          className="admin-assistant-launcher"
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
        >
          <span aria-hidden="true">
            <IconMessageSquare />
          </span>
          <span>Ask ClassLens</span>
          {state.busyId !== null && (
            <span
              className="assistant-working-indicator"
              aria-label="Question in progress"
            />
          )}
        </button>
      )}
      {open && (
        <AssistantPanel
          state={state}
          onClose={close}
          onSource={(source) => {
            setOpen(false);
            onSource(source);
          }}
        />
      )}
    </div>,
    document.body,
  );
}
