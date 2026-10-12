import type {
  AbsenceBillingPolicy,
  CoursePurchaseMode,
  LineItemType
} from './paymentCore';

export interface CreateInvoicePayload {
  studentIds: string[];
  title: string;
  note?: string;
  dueDate: string;
  lineItems: Array<{ description: string; type: LineItemType; amount: number }>;
  coursePurchases?: Array<{
    description: string;
    amount: number;
    entitlement: InvoiceEntitlementPayload;
  }>;
  entitlement?: InvoiceEntitlementPayload;
}

export interface InvoiceEntitlementPayload {
  courseOfferingId: string;
  purchaseMode: CoursePurchaseMode;
  validFrom?: string;
  validTo?: string;
  includedSessions?: number;
  absencePolicy?: AbsenceBillingPolicy;
  classroomSessionId?: string;
}

export type ChargeSuggestionStatus =
  | 'READY'
  | 'NEEDS_PRICE'
  | 'OPTIONAL_RENEWAL'
  | 'ALREADY_BILLED'
  | 'UNAVAILABLE';

export interface CourseChargeSuggestion {
  courseOfferingId: string;
  courseCode: string;
  academicTerm: string;
  purchaseMode: CoursePurchaseMode;
  description: string;
  defaultPrice: number | null;
  currency: string;
  status: ChargeSuggestionStatus;
  statusDetail: string;
  selectedByDefault: boolean;
  preferredCourse: boolean;
  validFrom: string | null;
  validTo: string | null;
  includedSessions: number | null;
  absencePolicy: AbsenceBillingPolicy | null;
  availableSessions: Array<{
    id: string;
    date: string;
    startTime: string;
    endTime: string;
  }>;
  classroomSessionId: string | null;
  classroomSessionDate: string | null;
  classroomSessionStartTime: string | null;
  classroomSessionEndTime: string | null;
  previousInvoiceNumber: string | null;
}

export interface StudentChargeSuggestions {
  studentId: string;
  studentName: string;
  studentNumber: string;
  courses: CourseChargeSuggestion[];
}

export interface ChargeSuggestionPreview {
  billingDate: string;
  students: StudentChargeSuggestions[];
}

export interface StudentInvoiceDraftPayload {
  studentId: string;
  title: string;
  note?: string;
  dueDate: string;
  lineItems: Array<{ description: string; type: LineItemType; amount: number }>;
  coursePurchases: NonNullable<CreateInvoicePayload['coursePurchases']>;
}

export interface CreateStudentInvoiceBatchPayload {
  invoices: StudentInvoiceDraftPayload[];
}

export interface InvoiceMessageDraft {
  message: string;
  tone: 'ENCOURAGE' | 'NOTICE';
  provider: string;
}

export interface InvoiceDeliveryResult {
  status: 'SENT' | 'DEMO';
  message: string;
  emailedAt: string | null;
}

export interface SavedInvoiceMessage {
  message: string;
  savedAt: string;
  reviewedAt: string | null;
}
