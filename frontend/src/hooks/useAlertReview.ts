import { useState } from 'react';
import { apiMessage } from '../lib/apiClient';
import type { Console } from './useConsole';

/** Shared by the Teacher and Admin Health Alerts pages — both need "which alert's detail modal
 *  is open" state plus the confirm/dismiss handlers wired to toast-on-error and a saving flag;
 *  keeping it in one place means the two pages can't drift on how that wiring behaves. */
export function useAlertReview(c: Console) {
  const [openAlertId, setOpenAlertId] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState(false);

  const openAlert = c.healthAlerts.find((alert) => alert.id === openAlertId) ?? null;

  const handleConfirm = async (payload: { eventType: string; teacherNotes: string; actionTaken: string }) => {
    if (!openAlertId) return false;
    setReviewing(true);
    try {
      await c.confirmAlert(openAlertId, payload);
      setOpenAlertId(null);
      return true;
    } catch (error) {
      c.showToast(apiMessage(error));
      return false;
    } finally {
      setReviewing(false);
    }
  };

  const handleDismiss = async (payload: { teacherNotes: string }) => {
    if (!openAlertId) return false;
    setReviewing(true);
    try {
      await c.dismissAlert(openAlertId, payload);
      setOpenAlertId(null);
      return true;
    } catch (error) {
      c.showToast(apiMessage(error));
      return false;
    } finally {
      setReviewing(false);
    }
  };

  return { openAlertId, setOpenAlertId, openAlert, reviewing, handleConfirm, handleDismiss };
}
