export type AssistantIntent =
  | "ATTENDANCE"
  | "ABSENCES"
  | "SCHEDULE"
  | "PAYMENTS"
  | "PAYMENT_REVIEW"
  | "STUDENT_COUNT"
  | "UNSUPPORTED";
export interface AssistantSource {
  type: "STUDENT" | "SESSION" | "PAYMENTS";
  id: string;
}
export interface AssistantContext {
  intent: AssistantIntent;
  studentId: string | null;
  studentName: string;
  dateFrom: string;
  dateTo: string;
  courseQuery: string;
}
export interface AssistantQuestion {
  message: string;
  history: string[];
  context: AssistantContext | null;
  selectedStudentId?: string;
  studentSearch?: string;
}
export interface AssistantAnswer {
  status: "ANSWER" | "CLARIFY" | "UNSUPPORTED";
  message: string;
  intent: AssistantIntent;
  language: "zh" | "en";
  dateFrom: string;
  dateTo: string;
  asOf: string;
  provider: string;
  truncated: boolean;
  context: AssistantContext;
  choices: { id: string; name: string; number: string }[];
  rows: {
    id: string;
    title: string;
    subtitle: string;
    status: string;
    facts: { label: string; value: string }[];
    source: AssistantSource;
  }[];
}
export interface AssistantTurn {
  id: number;
  question: AssistantQuestion;
  answer?: AssistantAnswer;
  error?: string;
  selection?: string;
}
