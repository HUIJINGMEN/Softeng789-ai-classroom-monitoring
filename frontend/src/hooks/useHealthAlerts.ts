import { useCallback, useEffect, useState } from 'react';
import { apiMessage } from '../lib/apiClient';
import { confirmHealthAlert, dismissHealthAlert, listHealthAlerts } from '../lib/healthAlertApi';
import type { HealthAlert } from '../types';

export function useHealthAlerts() {
  const [healthAlerts, setHealthAlerts] = useState<HealthAlert[]>([]);
  const [healthAlertsLoading, setHealthAlertsLoading] = useState(false);
  const [healthAlertsError, setHealthAlertsError] = useState('');

  const refreshHealthAlerts = useCallback(async () => {
    setHealthAlertsLoading(true);
    try {
      setHealthAlerts(await listHealthAlerts());
      setHealthAlertsError('');
    } catch (error) {
      setHealthAlerts([]);
      setHealthAlertsError(apiMessage(error));
    } finally {
      setHealthAlertsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshHealthAlerts();
  }, [refreshHealthAlerts]);

  const awaitingReviewCount = healthAlerts.filter((alert) => alert.status === 'awaiting-review').length;

  const confirmAlert = useCallback(
    async (id: string, payload: { eventType?: string; teacherNotes?: string; actionTaken?: string }) => {
      await confirmHealthAlert(id, payload);
      await refreshHealthAlerts();
    },
    [refreshHealthAlerts]
  );

  const dismissAlert = useCallback(
    async (id: string, payload: { teacherNotes?: string }) => {
      await dismissHealthAlert(id, payload);
      await refreshHealthAlerts();
    },
    [refreshHealthAlerts]
  );

  return {
    healthAlerts,
    healthAlertsLoading,
    healthAlertsError,
    refreshHealthAlerts,
    awaitingReviewCount,
    confirmAlert,
    dismissAlert
  };
}
