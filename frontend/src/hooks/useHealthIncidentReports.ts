import { useCallback, useEffect, useState } from 'react';
import { apiMessage } from '../lib/apiClient';
import { createHealthIncidentReport, listHealthIncidentReports } from '../lib/healthIncidentApi';
import type { HealthIncidentReport } from '../types';

export function useHealthIncidentReports() {
  const [healthIncidentReports, setHealthIncidentReports] = useState<HealthIncidentReport[]>([]);
  const [healthIncidentReportsLoading, setHealthIncidentReportsLoading] = useState(false);
  const [healthIncidentReportsError, setHealthIncidentReportsError] = useState('');

  const refreshHealthIncidentReports = useCallback(async () => {
    setHealthIncidentReportsLoading(true);
    try {
      setHealthIncidentReports(await listHealthIncidentReports());
      setHealthIncidentReportsError('');
    } catch (error) {
      setHealthIncidentReports([]);
      setHealthIncidentReportsError(apiMessage(error));
    } finally {
      setHealthIncidentReportsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshHealthIncidentReports();
  }, [refreshHealthIncidentReports]);

  const createReport = useCallback(
    async (payload: {
      studentId: string;
      courseOfferingId: string;
      sessionId?: string | null;
      incidentType: string;
      occurredAt: string;
      description: string;
      actionTaken?: string;
      teacherNotes?: string;
    }) => {
      await createHealthIncidentReport(payload);
      await refreshHealthIncidentReports();
    },
    [refreshHealthIncidentReports]
  );

  return {
    healthIncidentReports,
    healthIncidentReportsLoading,
    healthIncidentReportsError,
    refreshHealthIncidentReports,
    createReport
  };
}
