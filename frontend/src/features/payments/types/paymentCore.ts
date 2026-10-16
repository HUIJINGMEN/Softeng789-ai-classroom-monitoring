export type InvoiceStatus = 'DRAFT' | 'PENDING' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE' | 'CANCELLED';
export type LineItemType = 'CHARGE' | 'CREDIT';
export type ManualPaymentMethod = 'BANK_TRANSFER' | 'CASH';
export type ManualPaymentStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type AbsenceBillingPolicy = 'CONSUME_UNEXCUSED' | 'ATTENDANCE_ONLY';
export type CoursePurchaseMode = 'COURSE_ENROLMENT' | 'LESSON_PACKAGE' | 'MEMBERSHIP' | 'PAY_PER_LESSON';
export type LearningEntitlementStatus = 'PENDING_PAYMENT' | 'ACTIVE' | 'COMPLETED' | 'EXPIRED' | 'CANCELLED';
export type AttendanceBillingDecision = 'CONSUME' | 'WAIVE';
export type LessonCreditStatus =
  | 'PENDING_PAYMENT'
  | 'AVAILABLE'
  | 'BOOKED'
  | 'USED'
  | 'COUNTED_ABSENCE'
  | 'MAKEUP_DUE'
  | 'MAKEUP_SCHEDULED'
  | 'EXPIRED'
  | 'VOID';
export type AccountAdjustmentType = 'CREDIT' | 'REFUND' | 'PAYMENT_REVERSAL';
export type SessionPackageAction = 'PAUSE' | 'RESUME' | 'EXTEND' | 'TRANSFER' | 'CANCEL';
export type AccountActivityType =
  | 'PACKAGE_PAUSED'
  | 'PACKAGE_RESUMED'
  | 'PACKAGE_EXTENDED'
  | 'PACKAGE_TRANSFERRED'
  | 'PACKAGE_CANCELLED'
  | 'CREDIT_ADJUSTMENT'
  | 'REFUND_ISSUED'
  | 'PAYMENT_REVERSED';

export interface PaymentBankAccount {
  id: string;
  accountName: string;
  bankName: string;
  accountNumber: string;
  paymentReference: string | null;
  instructions: string | null;
  updatedAt: string;
}

export interface ManualPaymentSubmission {
  id: string;
  invoiceId: string;
  studentId: string;
  studentName: string;
  studentNumber: string;
  invoiceTitle: string;
  invoiceNumber: string;
  invoiceBalance: number;
  currency: string;
  amount: number;
  method: ManualPaymentMethod;
  status: ManualPaymentStatus;
  studentNote: string | null;
  receiptFileName: string | null;
  receiptContentType: string | null;
  receiptFileSize: number;
  submittedAt: string;
  reviewNote: string | null;
  reviewedAt: string | null;
}

export interface PaymentLineItem {
  id: string;
  description: string;
  type: LineItemType;
  amount: number;
}

export interface PaymentTransaction {
  id: string;
  amount: number;
  status: 'SUCCEEDED' | 'FAILED' | 'REFUNDED';
  provider: string;
  reference: string;
  occurredAt: string;
}

export interface StudentInvoice {
  id: string;
  studentName: string;
  studentNumber: string;
  invoiceNumber: string;
  title: string;
  note: string | null;
  dueDate: string;
  currency: string;
  status: InvoiceStatus;
  charges: number;
  credits: number;
  payments: number;
  balance: number;
  lineItems: PaymentLineItem[];
  transactions: PaymentTransaction[];
  manualPayments: ManualPaymentSubmission[];
  entitlement: LearningEntitlement | null;
  sessionPackage: SessionPackageUsage | null;
  coursePurchases: CoursePurchase[];
  createdAt: string;
  messageDraftSavedAt: string | null;
  messageReviewedAt: string | null;
  lastEmailedAt: string | null;
}

export interface CoursePurchase {
  lineItemId: string | null;
  entitlement: LearningEntitlement;
  sessionPackage: SessionPackageUsage | null;
}

export interface LearningEntitlement {
  id: string;
  courseOfferingId: string;
  courseCode: string;
  academicTerm: string;
  purchaseMode: CoursePurchaseMode;
  status: LearningEntitlementStatus;
  validFrom: string | null;
  validTo: string | null;
  sessionAllowance: number | null;
  classroomSessionId: string | null;
  classroomSessionDate: string | null;
}

export interface SessionUsageEntry {
  attendanceRecordId: string | null;
  sessionId: string | null;
  sessionDate: string | null;
  attendanceStatus: 'PRESENT' | 'LATE' | 'ABSENT' | 'UNKNOWN';
  consumesSession: boolean;
  overrideDecision: AttendanceBillingDecision | null;
  overrideReason: string | null;
  lessonCreditId: string | null;
  creditStatus: LessonCreditStatus | null;
  originalSessionId: string | null;
  originalSessionDate: string | null;
  makeupSessionId: string | null;
  makeupSessionDate: string | null;
}

export interface SessionPackageUsage {
  id: string;
  entitlementId: string | null;
  courseOfferingId: string;
  courseCode: string;
  academicTerm: string;
  purchasedSessions: number;
  usedSessions: number;
  remainingSessions: number;
  attendedSessions: number;
  chargeableAbsences: number;
  waivedAbsences: number;
  unrecordedSessions: number;
  serviceFrom: string;
  serviceTo: string;
  absencePolicy: AbsenceBillingPolicy;
  status: string;
  sessions: SessionUsageEntry[];
}

export interface AccountActivity {
  id: string;
  type: AccountActivityType;
  amount: number | null;
  fromValue: string | null;
  toValue: string | null;
  reason: string;
  externalReference: string | null;
  actorName: string;
  createdAt: string;
}

export interface AccountTimelineEvent {
  id: string;
  type: string;
  title: string;
  detail: string | null;
  amount: number | null;
  reference: string | null;
  actorName: string | null;
  occurredAt: string;
}

export interface TransferClassOption {
  courseOfferingId: string;
  courseCode: string;
  academicTerm: string;
}

export interface InvoiceAccount {
  invoice: StudentInvoice;
  activities: AccountActivity[];
  timeline: AccountTimelineEvent[];
  transferOptions: TransferClassOption[];
}
