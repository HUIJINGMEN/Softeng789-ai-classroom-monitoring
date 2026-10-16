import { useEffect, useId, useRef, useState } from "react";
import type { AssistantAnswer } from "./types";

export function AssistantStudentClarification({
  answer,
  initialSearch,
  disabled,
  onResolve,
  active,
}: {
  readonly answer: AssistantAnswer;
  readonly initialSearch?: string;
  readonly disabled: boolean;
  readonly active: boolean;
  readonly onResolve: (
    search: string,
    selectedId?: string,
    label?: string,
  ) => void;
}) {
  const [search, setSearch] = useState(initialSearch ?? "");
  const fieldId = useId();
  const input = useRef<HTMLInputElement>(null);
  const zh = answer.language === "zh";
  useEffect(() => {
    if (active) input.current?.focus({ preventScroll: true });
  }, [active]);
  return (
    <div className="assistant-clarification">
      {answer.choices.length > 0 && (
        <div
          className="assistant-choices"
          aria-label={zh ? "选择学生" : "Choose a student"}
        >
          {answer.choices.map((choice) => (
            <button
              key={choice.id}
              type="button"
              disabled={disabled}
              onClick={() =>
                onResolve(
                  choice.name,
                  choice.id,
                  `${choice.name} · ${choice.number}`,
                )
              }
            >
              <strong>{choice.name}</strong>
              <span>{choice.number}</span>
            </button>
          ))}
        </div>
      )}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (search.trim()) onResolve(search.trim());
        }}
      >
        <label htmlFor={fieldId}>
          {zh ? "学生姓名或学号" : "Student name or number"}
        </label>
        <div>
          <input
            ref={input}
            data-assistant-clarification-active={active ? "true" : undefined}
            id={fieldId}
            value={search}
            disabled={disabled}
            maxLength={120}
            autoComplete="off"
            aria-describedby={`${fieldId}-scope`}
            placeholder={
              zh ? "输入完整姓名或学号" : "Enter a full name or student number"
            }
            onChange={(event) => setSearch(event.target.value)}
          />
          <button type="submit" disabled={disabled || !search.trim()}>
            {zh ? "查找并继续" : "Find & continue"}
          </button>
        </div>
        <p id={`${fieldId}-scope`}>
          {zh
            ? "保留原问题的日期和课程范围："
            : "Keeps the original dates and course scope: "}
          {answer.dateFrom} — {answer.dateTo}
          {answer.context.courseQuery && ` · ${answer.context.courseQuery}`}
        </p>
      </form>
    </div>
  );
}
