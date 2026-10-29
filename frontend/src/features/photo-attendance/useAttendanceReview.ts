import { useCallback, useEffect, useRef, useState } from 'react';
import { apiMessage, request } from '../../lib/apiClient';
import { decideCheckIn } from './checkInApi';
import { actionableRequests, type AttendanceReviewWorkspace } from './attendanceReviewModel';

type ReviewDecision = 'PRESENT' | 'LATE' | 'REJECTED';
interface DecisionBatch { completed: number; failures: string[] }

export function useAttendanceReview(sessionId: string, onSaved: () => Promise<void> | void) {
  const [workspace, setWorkspace] = useState<AttendanceReviewWorkspace | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState(''); const [message, setMessage] = useState('');
  const [actionError, setActionError] = useState('');
  const [busy, setBusy] = useState(false); const [loading, setLoading] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const scope = useRef(0); const revision = useRef(0); const saving = useRef(false);
  const pending = useRef<AbortController | null>(null); const savedCallback = useRef(onSaved);
  savedCallback.current = onSaved;
  const refresh = useCallback(async () => {
    if (saving.current || pending.current) return;
    const epoch = scope.current, version = ++revision.current;
    const controller = new AbortController(); pending.current = controller; setLoading(true);
    const timer = window.setTimeout(() => controller.abort(), 15000);
    try {
      const next = await request<AttendanceReviewWorkspace>(`/api/sessions/${sessionId}/attendance-review`, { signal: controller.signal });
      if (epoch !== scope.current || version !== revision.current) return;
      setWorkspace(next); setError(''); setUpdatedAt(Date.now());
      const eligible = new Set(actionableRequests(next).map(row => row.id));
      setSelected(current => current.filter(id => eligible.has(id)));
    } catch (e) {
      if (epoch === scope.current && version === revision.current)
        setError('Could not refresh attendance. Showing the last loaded data. ' + apiMessage(e));
    } finally {
      window.clearTimeout(timer);
      if (pending.current === controller) pending.current = null;
      if (epoch === scope.current && version === revision.current) setLoading(false);
    }
  }, [sessionId]);
  useEffect(() => {
    scope.current++; saving.current = false; setBusy(false); setWorkspace(null); setSelected([]); setError(''); setActionError(''); setMessage(''); setUpdatedAt(null);
    void refresh();
    const visibleRefresh = () => { if (!document.hidden) void refresh(); };
    const timer = window.setInterval(visibleRefresh, 15000);
    document.addEventListener('visibilitychange', visibleRefresh);
    return () => { scope.current++; revision.current++; pending.current?.abort(); pending.current = null;
      window.clearInterval(timer); document.removeEventListener('visibilitychange', visibleRefresh); };
  }, [refresh]);
  async function applyDecisions(targets: string[], status: ReviewDecision, currentWorkspace: AttendanceReviewWorkspace,
    epoch: number, result: DecisionBatch) {
    for (const id of targets) {
      if (epoch !== scope.current) break;
      try { await decideCheckIn(id, status); result.completed++; }
      catch (e) {
        const name = currentWorkspace.requests.find(row => row.id === id)?.studentName ?? 'Student';
        result.failures.push(`${name}: ${apiMessage(e)}`);
      }
    }
  }
  async function finishDecisions(epoch: number, status: ReviewDecision, result: DecisionBatch) {
    if (epoch !== scope.current) return;
    saving.current = false; setBusy(false); await refresh();
    if (epoch !== scope.current) return;
    setMessage(`${result.completed} request(s) ${status === 'REJECTED' ? 'rejected' : 'approved'}. ${result.failures.length ? 'Some requests need attention.' : ''}`);
    if (result.failures.length) setActionError(result.failures.join(' '));
  }
  async function decide(ids: string[], status: ReviewDecision) {
    if (!workspace || saving.current) return;
    const eligible = new Set(actionableRequests(workspace).map(row => row.id));
    const targets = [...new Set(ids)].filter(id => selected.includes(id) && eligible.has(id));
    if (!targets.length) return;
    const epoch = scope.current; saving.current = true; setBusy(true); setLoading(false);
    revision.current++; pending.current?.abort(); pending.current = null; setError(''); setActionError(''); setMessage('');
    const result: DecisionBatch = { completed: 0, failures: [] };
    try {
      await applyDecisions(targets, status, workspace, epoch, result);
      if (epoch !== scope.current) return;
      setSelected([]);
      if (result.completed && status !== 'REJECTED') {
        try { await savedCallback.current(); } catch { result.failures.push('Saved decisions could not refresh the main attendance table.'); }
      }
    } finally {
      await finishDecisions(epoch, status, result);
    }
  }
  return { workspace, selected, setSelected, error: [error, actionError].filter(Boolean).join(' '), message, busy, loading, updatedAt, refresh, decide };
}
