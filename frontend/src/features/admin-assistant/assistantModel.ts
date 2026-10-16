import type { AssistantAnswer, AssistantSource, AssistantTurn } from "./types";

export const STARTERS = [
  { label: "Who was absent today?", question: "Who was absent today?" },
  { label: "Today's timetable", question: "What lessons are scheduled today?" },
  {
    label: "Payments to verify",
    question: "Which payment submissions are awaiting verification?",
  },
  { label: "Check a student", question: "Did ", fill: true },
] as const;

export const recentQuestions = (turns: readonly AssistantTurn[]) =>
  turns.slice(-4).map((turn) => turn.question.message);
export const answerTime = (value: string) =>
  new Date(value).toLocaleString("en-NZ", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Pacific/Auckland",
    timeZoneName: "short",
  });
const LABELS: Record<string, [string, string]> = {
  PRESENT: ["Present", "出席"],
  LATE: ["Late", "迟到"],
  ABSENT: ["Absent", "缺勤"],
  NOT_RECORDED: ["Not recorded", "未记录"],
  SCHEDULED: ["Upcoming", "未开始"],
  ACTIVE: ["In progress", "进行中"],
  COMPLETED: ["Completed", "已结束"],
  CANCELLED: ["Cancelled", "已取消"],
  PENDING: ["Payment due", "待付款"],
  PARTIALLY_PAID: ["Part paid", "部分付款"],
  PAID: ["Paid", "已付款"],
  OVERDUE: ["Overdue", "逾期"],
  AWAITING_VERIFICATION: ["Awaiting verification", "待核实"],
  STATUS_REVIEW: ["Check invoice status", "核对账单状态"],
};
export function statusLabel(
  status: string,
  language: AssistantAnswer["language"],
) {
  return LABELS[status]?.[language === "zh" ? 1 : 0] ?? status;
}
export function statusTone(status: string) {
  if (["PRESENT", "PAID", "COMPLETED"].includes(status)) return "positive";
  if (["ABSENT", "OVERDUE"].includes(status)) return "attention";
  if (
    [
      "NOT_RECORDED",
      "LATE",
      "PENDING",
      "PARTIALLY_PAID",
      "AWAITING_VERIFICATION",
      "STATUS_REVIEW",
    ].includes(status)
  )
    return "pending";
  return "neutral";
}

export function sourceLabel(
  source: AssistantSource,
  language: AssistantAnswer["language"],
) {
  const labels = {
    SESSION: ["Open lesson record", "查看课次记录"],
    PAYMENTS: ["Open payment account", "打开付款账户"],
    STUDENT: ["Open student profile", "打开学生档案"],
  };
  return labels[source.type][language === "zh" ? 1 : 0];
}
