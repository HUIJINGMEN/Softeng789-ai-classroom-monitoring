import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CandidateEvent, EventStatus, Session } from '../types';

interface UseEventReviewOptions {
  sessions: readonly Session[];
  setSessionId: (sessionId: string) => void;
  setSessionDate: (date: string) => void;
  showToast: (message: string) => void;
}

export function useEventReview({
  sessions,
  setSessionId,
  setSessionDate,
  showToast
}: UseEventReviewOptions) {
  const [events, setEvents] = useState<CandidateEvent[]>([]);
  const [modalId, setModalId] = useState<string | null>(null);
  const [correcting, setCorrecting] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);

  const pendingEvents = useMemo(
    () => events.filter((event) => event.status === 'Pending Review'),
    [events]
  );

  const addEvent = useCallback((event: CandidateEvent) => {
    setEvents((current) => [...current, event]);
  }, []);

  const setEventStatus = useCallback(
    (id: string, status: EventStatus, patch?: Partial<CandidateEvent>) => {
      setEvents((current) =>
        current.map((event) => (event.id === id ? { ...event, status, ...patch } : event))
      );
      setCorrecting(false);
      showToast(
        status === 'Confirmed'
          ? `Event ${id} confirmed and added to reports.`
          : status === 'Rejected'
            ? `Event ${id} rejected. It is excluded from reports.`
            : `Event ${id} corrected to "${patch?.type}".`
      );
    },
    [showToast]
  );

  const goToNextPending = useCallback(
    (afterId?: string, excludeCurrent = false) => {
      const queue = events.filter(
        (event) =>
          event.status === 'Pending Review' && (!excludeCurrent || event.id !== afterId)
      );
      if (queue.length === 0) {
        setModalId(null);
        setCorrecting(false);
        showToast('No candidate events left to review.');
        return;
      }
      const current = events.find((event) => event.id === afterId);
      const next =
        queue.find((event) => event.sessionId === current?.sessionId) ??
        queue.find((event) => event.id !== afterId) ??
        queue[0];
      const session = sessions.find((candidate) => candidate.id === next.sessionId);
      setModalId(next.id);
      setSessionId(next.sessionId);
      if (session) setSessionDate(session.date);
      setCorrecting(false);
    },
    [events, sessions, setSessionDate, setSessionId, showToast]
  );

  const bulkReview = useCallback(
    (status: Extract<EventStatus, 'Confirmed' | 'Rejected'>) => {
      if (selected.length === 0) return;
      setEvents((current) =>
        current.map((event) => (selected.includes(event.id) ? { ...event, status } : event))
      );
      showToast(
        `${selected.length} events ${status === 'Confirmed' ? 'confirmed' : 'rejected'} in one action.`
      );
      setSelected([]);
    },
    [selected, showToast]
  );

  const toggleSelected = useCallback((id: string) => {
    setSelected((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id]
    );
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setModalId(null);
        setCorrecting(false);
        return;
      }
      if (!modalId) return;
      const key = event.key.toLowerCase();
      if (key === 'c') {
        event.preventDefault();
        setEventStatus(modalId, 'Confirmed');
        goToNextPending(modalId, true);
      } else if (key === 'r') {
        event.preventDefault();
        setEventStatus(modalId, 'Rejected');
        goToNextPending(modalId, true);
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        goToNextPending(modalId);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [goToNextPending, modalId, setEventStatus]);

  return {
    events,
    addEvent,
    pendingEvents,
    setEventStatus,
    goToNextPending,
    bulkReview,
    selected,
    toggleSelected,
    clearSelected: () => setSelected([]),
    modalId,
    setModalId,
    correcting,
    setCorrecting
  };
}
