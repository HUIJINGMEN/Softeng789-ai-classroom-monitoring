export interface OperationsAlert {
  type: 'OVERDUE_PAYMENT' | 'LOW_LESSONS' | 'PACKAGE_EXPIRING' | 'MAKEUP_EXPIRING' | 'MEMBERSHIP_EXPIRING';
  severity: 'high' | 'medium';
  title: string;
  detail: string;
  studentId: string;
  studentName: string;
  invoiceId: string;
  sessionPackageId: string | null;
  courseOfferingId: string | null;
  actionDate: string | null;
  amount: number | null;
  remainingLessons: number | null;
}

export interface CourseOperations {
  courseOfferingId: string;
  courseCode: string;
  academicTerm: string;
  students: number;
  netReceived: number;
  outstanding: number;
  purchasedLessons: number;
  usedLessons: number;
  utilizationPercent: number;
}

export interface OperationsDashboard {
  financial: {
    currency: string;
    grossReceived: number;
    refunded: number;
    netReceived: number;
    outstanding: number;
    overdue: number;
  };
  alerts: OperationsAlert[];
  courses: CourseOperations[];
  from: string;
  to: string;
  generatedAt: string;
}
