import type { AssistantAnswer, AssistantContext } from "./types";

export interface AssistantFollowUp {
  label: string;
  message: string;
  context: AssistantContext | null;
}

/** Each action carries its own answer scope, never an unrelated later conversation context. */
export function assistantFollowUps(
  answer: AssistantAnswer,
): AssistantFollowUp[] {
  if (answer.status === "UNSUPPORTED")
    return recoverySuggestions(answer.language === "zh");
  if (answer.status !== "ANSWER" || !answer.context.studentId) return [];
  return studentSuggestions(answer);
}

function recoverySuggestions(zh: boolean): AssistantFollowUp[] {
  return [
    {
      label: zh ? "今天的课表" : "Today's timetable",
      message: zh ? "今天有哪些课？" : "What lessons are scheduled today?",
      context: null,
    },
    {
      label: zh ? "已记录的缺勤" : "Recorded absences",
      message: zh
        ? "今天谁被记录为缺勤？"
        : "Who has a recorded absence today?",
      context: null,
    },
    {
      label: zh ? "当前未付账单" : "Current unpaid invoices",
      message: zh ? "查询当前未付账单" : "Show current unpaid invoices",
      context: null,
    },
  ];
}

function studentSuggestions(answer: AssistantAnswer): AssistantFollowUp[] {
  const zh = answer.language === "zh";
  const context = answer.context;
  const current = { ...context, courseQuery: "" };
  const attendance = {
    label: zh ? "今天的考勤" : "Today's attendance",
    message: zh ? "该学生今天来上课了吗？" : "Did this student attend today?",
    context: current,
  };
  const schedule = {
    label: zh ? "七天课表" : "7-day timetable",
    message: zh
      ? "该学生从今天起七天内有哪些课？"
      : "What lessons does this student have over seven days starting today?",
    context: current,
  };
  const payments = {
    label: zh ? "当前付款状态" : "Current payments",
    message: zh
      ? "该学生当前付款状态是什么？"
      : "What is this student's current payment status?",
    context: current,
  };
  if (answer.intent === "PAYMENTS" || answer.intent === "PAYMENT_REVIEW")
    return [attendance, schedule];
  if (answer.intent === "SCHEDULE") return [attendance, payments];
  const previous = {
    label: zh ? "昨天的考勤" : "Yesterday's attendance",
    message: zh
      ? "该学生昨天来上课了吗？"
      : "Did this student attend yesterday?",
    context,
  };
  return [previous, schedule, payments];
}
