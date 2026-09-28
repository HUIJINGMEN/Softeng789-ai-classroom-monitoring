import type { CreateInvoicePayload, LineItemType } from './types';

export interface DraftLine {
  id: string;
  description: string;
  type: LineItemType;
  amount: string;
}

export interface PaymentRecipient {
  student: {
    id: string;
    firstName: string;
    lastName: string;
  };
}

export type SelectedStudents = Map<string, PaymentRecipient>;

export function selectedStudentLabel(item: PaymentRecipient) {
  return `${item.student.firstName} ${item.student.lastName}`;
}

export function createDraftLine(type: LineItemType = 'CHARGE'): DraftLine {
  return { id: crypto.randomUUID(), description: '', type, amount: '' };
}

export function calculateDraftTotal(lines: readonly DraftLine[]) {
  return lines.reduce((total, line) => {
    const amount = Number(line.amount) || 0;
    return total + (line.type === 'CREDIT' ? -amount : amount);
  }, 0);
}

export function isPaymentDraftValid(title: string, dueDate: string, lines: readonly DraftLine[]) {
  return Boolean(
    title.trim()
    && dueDate
    && calculateDraftTotal(lines) > 0
    && lines.every((line) => line.description.trim() && Number(line.amount) > 0)
  );
}

export function toCreateInvoicePayload(
  selected: SelectedStudents,
  title: string,
  dueDate: string,
  note: string,
  lines: readonly DraftLine[]
): CreateInvoicePayload {
  return {
    studentIds: [...selected.keys()],
    title: title.trim(),
    dueDate,
    note: note.trim() || undefined,
    lineItems: lines.map((line) => ({
      description: line.description.trim(),
      type: line.type,
      amount: Number(line.amount)
    }))
  };
}

export function studentCountLabel(count: number) {
  return `${count} student${count === 1 ? '' : 's'}`;
}

export function recipientSummary(selected: SelectedStudents) {
  const names = [...selected.values()].map(selectedStudentLabel);
  if (names.length <= 3) return names.join(', ');
  return `${names.slice(0, 3).join(', ')} and ${names.length - 3} more`;
}
