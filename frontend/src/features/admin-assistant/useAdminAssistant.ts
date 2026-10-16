import { useCallback, useEffect, useRef, useState } from "react";
import { apiMessage } from "../../lib/apiClient";
import { askAssistant } from "./api";
import { recentQuestions } from "./assistantModel";
import type {
  AssistantContext,
  AssistantQuestion,
  AssistantTurn,
} from "./types";

/** Memory-only conversation. Never stores student or payment records in localStorage. */
export function useAdminAssistant() {
  const [turns, setTurns] = useState<AssistantTurn[]>([]);
  const [draft, setDraft] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const context = useRef<AssistantContext | null>(null);
  const sequence = useRef(0);
  const running = useRef<AbortController | null>(null);
  useEffect(
    () => () => {
      sequence.current++;
      running.current?.abort();
    },
    [],
  );
  useEffect(() => {
    if (busyId === null) return;
    const started = Date.now();
    setElapsed(0);
    const timer = window.setInterval(
      () => setElapsed(Math.floor((Date.now() - started) / 1000)),
      1000,
    );
    return () => window.clearInterval(timer);
  }, [busyId]);
  const run = useCallback(async (id: number, question: AssistantQuestion) => {
    if (running.current) return;
    const controller = new AbortController();
    running.current = controller;
    const revision = ++sequence.current;
    const timeout = window.setTimeout(() => controller.abort(), 95000);
    setBusyId(id);
    try {
      const answer = await askAssistant(question, controller.signal);
      if (revision !== sequence.current) return;
      context.current = answer.context;
      setTurns((current) =>
        current.map((turn) =>
          turn.id === id ? { ...turn, answer, error: undefined } : turn,
        ),
      );
    } catch (error) {
      if (revision !== sequence.current) return;
      const message = controller.signal.aborted
        ? "This question took too long. Please retry or narrow the dates."
        : apiMessage(error);
      setTurns((current) =>
        current.map((turn) =>
          turn.id === id
            ? { ...turn, error: message, answer: undefined }
            : turn,
        ),
      );
    } finally {
      window.clearTimeout(timeout);
      if (revision === sequence.current) {
        running.current = null;
        setBusyId(null);
      }
    }
  }, []);
  const send = (text = draft, scope = context.current) => {
    const message = text.trim();
    if (!message || message.length > 1000 || running.current) return;
    const id = ++sequence.current;
    const question: AssistantQuestion = {
      message,
      history: recentQuestions(turns),
      context: scope,
    };
    setTurns((current) => [...current, { id, question }]);
    setDraft("");
    void run(id, question);
  };
  const resubmit = (
    turn: AssistantTurn,
    question: AssistantQuestion,
    selection?: string,
  ) => {
    if (running.current) return;
    setTurns((current) =>
      current.map((item) =>
        item.id === turn.id
          ? {
              ...item,
              question,
              answer: undefined,
              error: undefined,
              selection: selection ?? item.selection,
            }
          : item,
      ),
    );
    void run(turn.id, question);
  };
  const repeat = (
    turn: AssistantTurn,
    selectedStudentId?: string,
    selection?: string,
  ) => {
    resubmit(
      turn,
      {
        ...turn.question,
        selectedStudentId: selectedStudentId ?? turn.question.selectedStudentId,
      },
      selection,
    );
  };
  const resolveStudent = (
    turn: AssistantTurn,
    search: string,
    selectedStudentId?: string,
    selection?: string,
  ) => {
    const studentSearch = search.trim();
    if (
      turn.answer?.status !== "CLARIFY" ||
      !studentSearch ||
      studentSearch.length > 120
    )
      return;
    resubmit(
      turn,
      {
        ...turn.question,
        context: turn.answer.context,
        studentSearch,
        selectedStudentId,
      },
      selection ?? studentSearch,
    );
  };
  const clear = () => {
    if (running.current) return;
    sequence.current++;
    context.current = null;
    setTurns([]);
    setDraft("");
  };
  return {
    turns,
    draft,
    setDraft,
    busyId,
    elapsed,
    send,
    repeat,
    resolveStudent,
    clear,
  };
}

export type AdminAssistantState = ReturnType<typeof useAdminAssistant>;
