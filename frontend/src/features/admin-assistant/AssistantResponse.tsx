import { useState } from "react";
import {
  answerTime,
  sourceLabel,
  statusLabel,
  statusTone,
} from "./assistantModel";
import type { AssistantSource, AssistantTurn } from "./types";
import { AssistantStudentClarification } from "./AssistantStudentClarification";

export function AssistantResponse({
  turn,
  disabled,
  onRepeat,
  onSource,
  onResolveStudent,
  active = false,
}: {
  readonly turn: AssistantTurn;
  readonly disabled: boolean;
  readonly onRepeat: (
    turn: AssistantTurn,
    studentId?: string,
    selection?: string,
  ) => void;
  readonly onSource: (source: AssistantSource) => void;
  readonly active?: boolean;
  readonly onResolveStudent: (
    turn: AssistantTurn,
    search: string,
    selectedId?: string,
    label?: string,
  ) => void;
}) {
  const [visible, setVisible] = useState(6);
  const answer = turn.answer;
  if (turn.error)
    return (
      <div className="assistant-error" role="alert">
        <p>{turn.error}</p>
        <button
          type="button"
          className="assistant-text-button"
          disabled={disabled}
          onClick={() => onRepeat(turn)}
        >
          Retry question
        </button>
      </div>
    );
  if (!answer) return null;
  const zh = answer.language === "zh";
  const financial =
    answer.intent === "PAYMENTS" || answer.intent === "PAYMENT_REVIEW";
  const paymentLabel = zh ? "当前付款快照" : "Current payment snapshot";
  const recordLabel = zh ? "当前学生档案统计" : "Current student-record count";
  const datedScope = answer.intent === "STUDENT_COUNT"
    ? recordLabel
    : `${answer.dateFrom} — ${answer.dateTo}`;
  const scopeLabel = financial
    ? paymentLabel
    : datedScope;
  return (
    <div className="assistant-response">
      <p className="assistant-answer-text">{answer.message}</p>
      {answer.status === "CLARIFY" && (
        <AssistantStudentClarification
          answer={answer}
          initialSearch={turn.question.studentSearch}
          disabled={disabled}
          active={active}
          onResolve={(search, selectedId, label) =>
            onResolveStudent(turn, search, selectedId, label)
          }
        />
      )}
      {answer.rows.slice(0, visible).map((row) => (
        <article className="assistant-record" key={row.id}>
          <div className="assistant-record-heading">
            <div>
              <h3>{row.title}</h3>
              <span>{row.subtitle}</span>
            </div>
            <span
              className={`assistant-status assistant-status--${statusTone(row.status)}`}
            >
              {statusLabel(row.status, answer.language)}
            </span>
          </div>
          <dl>
            {row.facts.map((fact) => (
              <div key={fact.label}>
                <dt>{fact.label}</dt>
                <dd>{fact.value}</dd>
              </div>
            ))}
          </dl>
          <button
            type="button"
            className="assistant-text-button"
            onClick={() => onSource(row.source)}
            aria-label={`${sourceLabel(row.source, answer.language)}: ${row.title}, ${row.subtitle}`}
          >
            {sourceLabel(row.source, answer.language)}
            <span aria-hidden="true"> →</span>
          </button>
        </article>
      ))}
      {answer.rows.length > visible && (
        <button
          type="button"
          className="assistant-text-button"
          onClick={() => setVisible((current) => current + 6)}
        >
          {zh
            ? `继续显示（剩余 ${answer.rows.length - visible} 条）`
            : `Show more (${answer.rows.length - visible} remaining)`}
        </button>
      )}
      {answer.truncated && (
        <p className="assistant-limit" role="status">
          {zh
            ? "结果已限制显示，请缩小日期或课程范围后重查。上面的数量仅对应查到的范围。"
            : "Results are limited. Narrow the dates or course and ask again; counts above describe only the returned scope."}
        </p>
      )}
      <p className="assistant-provenance">
        {zh ? "查询时间" : "Checked"} {answerTime(answer.asOf)} · {scopeLabel}
      </p>
    </div>
  );
}
