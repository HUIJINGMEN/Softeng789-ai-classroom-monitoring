import { request } from './apiClient';
import { buildQueryString } from './queryString';
import type { HealthClassOption, HealthIncidentReport, HealthIncidentSource } from '../types';

interface HealthIncidentReportApiResponse {
  id: string;
  studentId: string;
  studentName: string;
  courseOfferingId: string;
  classLabel: string;
  sessionId: string | null;
  sessionLabel: string | null;
  teacherId: string;
  teacherName: string;
  source: 'AI_DETECTED' | 'TEACHER_REPORTED';
  incidentType: string;
  occurredAt: string;
  description: string;
  actionTaken: string | null;
  teacherNotes: string | null;
  healthAlertId: string | null;
  createdAt: string;
}

interface TeacherClassOptionApiResponse {
  courseOfferingId: string;
  label: string;
  students: { id: string; name: string; studentNumber: string }[];
}

const SOURCE_FROM_API: Record<HealthIncidentReportApiResponse['source'], HealthIncidentSource> = {
  AI_DETECTED: 'ai-detected',
  TEACHER_REPORTED: 'teacher-reported'
};

function mapReportApiToUi(report: HealthIncidentReportApiResponse): HealthIncidentReport {
  return {
    id: report.id,
    studentId: report.studentId,
    studentName: report.studentName,
    courseOfferingId: report.courseOfferingId,
    classLabel: report.classLabel,
    sessionId: report.sessionId,
    sessionLabel: report.sessionLabel,
    teacherId: report.teacherId,
    teacherName: report.teacherName,
    source: SOURCE_FROM_API[report.source],
    incidentType: report.incidentType,
    occurredAt: report.occurredAt,
    description: report.description,
    actionTaken: report.actionTaken,
    teacherNotes: report.teacherNotes,
    healthAlertId: report.healthAlertId,
    createdAt: report.createdAt
  };
}

export interface HealthIncidentReportFilters {
  courseOfferingId?: string;
  studentId?: string;
  source?: string;
  incidentType?: string;
  dateFrom?: string;
  dateTo?: string;
}

function toQueryString(filters?: HealthIncidentReportFilters): string {
  if (!filters) return '';
  return buildQueryString({
    courseOfferingId: filters.courseOfferingId,
    studentId: filters.studentId,
    source: filters.source,
    incidentType: filters.incidentType,
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo
  });
}

export async function listHealthIncidentReports(
  filters?: HealthIncidentReportFilters
): Promise<HealthIncidentReport[]> {
  const reports = await request<HealthIncidentReportApiResponse[]>(
    `/api/health-incidents${toQueryString(filters)}`
  );
  return reports.map(mapReportApiToUi);
}

export async function getHealthIncidentReport(id: string): Promise<HealthIncidentReport> {
  return mapReportApiToUi(await request<HealthIncidentReportApiResponse>(`/api/health-incidents/${id}`));
}

export async function createHealthIncidentReport(payload: {
  studentId: string;
  courseOfferingId: string;
  sessionId?: string | null;
  incidentType: string;
  occurredAt: string;
  description: string;
  actionTaken?: string;
  teacherNotes?: string;
}): Promise<HealthIncidentReport> {
  const report = await request<HealthIncidentReportApiResponse>('/api/health-incidents', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...payload, sessionId: payload.sessionId ?? null })
  });
  return mapReportApiToUi(report);
}

export async function listMyClassOptions(): Promise<HealthClassOption[]> {
  const options = await request<TeacherClassOptionApiResponse[]>('/api/health-incidents/my-classes');
  return options.map((option) => ({
    courseOfferingId: option.courseOfferingId,
    label: option.label,
    students: option.students
  }));
}
