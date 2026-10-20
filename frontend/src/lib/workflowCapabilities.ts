import { useEffect, useState } from 'react';
import { apiMessage, request } from './apiClient';

export interface WorkflowCapabilities {
  readonly accountEmail: boolean;
  readonly assistedActivation: boolean;
  readonly reportEmail: boolean;
  readonly invoiceEmail: boolean;
}

export function useWorkflowCapabilities() {
  const [capabilities, setCapabilities] = useState<WorkflowCapabilities | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setCapabilities(null);
    setError('');
    request<WorkflowCapabilities>('/api/auth/capabilities')
      .then(value => { if (active) setCapabilities(value); })
      .catch(cause => { if (active) setError(apiMessage(cause)); });
    return () => { active = false; };
  }, [attempt]);
  return { capabilities, error, retry: () => setAttempt(value => value + 1) };
}
