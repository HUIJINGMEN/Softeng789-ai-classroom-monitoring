import { useEffect, useId, useRef } from "react";
import { revealAssistantReply } from "./assistantScroll";
import type { AdminAssistantState } from "./useAdminAssistant";

/** Owns responsive dialog, focus restoration and conversation-only scrolling. */
export function useAssistantPanel(state: AdminAssistantState) {
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const conversation = useRef<HTMLDivElement>(null);
  const latestTurn = useRef<HTMLElement>(null);
  const latestReply = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const busy = state.busyId !== null;
  useEffect(() => {
    const panel = dialog.current;
    if (!panel) return;
    const opener =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const mobile = window.matchMedia("(max-width: 760px)");
    let locked = false;
    let previous: string | undefined;
    const restore = () => {
      if (!locked) return;
      if (previous === undefined) delete document.body.dataset.modalScrollLock;
      else document.body.dataset.modalScrollLock = previous;
      locked = false;
    };
    const open = () => {
      if (panel.open) panel.close();
      restore();
      if (mobile.matches) {
        previous = document.body.dataset.modalScrollLock;
        locked = true;
        document.body.dataset.modalScrollLock = "true";
        panel.showModal();
      } else panel.show();
      const clarification = panel.querySelector<HTMLInputElement>(
        '[data-assistant-clarification-active="true"]',
      );
      (clarification ?? input.current)?.focus({ preventScroll: true });
    };
    open();
    mobile.addEventListener("change", open);
    return () => {
      mobile.removeEventListener("change", open);
      panel.close();
      restore();
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, []);
  useEffect(() => {
    const turn = state.turns[state.turns.length - 1];
    const target =
      turn?.answer || turn?.error ? latestReply.current : latestTurn.current;
    if (conversation.current && target)
      revealAssistantReply(conversation.current, target);
    if (
      state.busyId === null &&
      turn?.answer &&
      turn.answer.status !== "CLARIFY" &&
      (document.activeElement === document.body ||
        document.activeElement === dialog.current)
    ) {
      input.current?.focus({ preventScroll: true });
    }
  }, [state.turns, state.busyId]);
  return { dialog, input, conversation, latestTurn, latestReply, titleId, busy };
}
