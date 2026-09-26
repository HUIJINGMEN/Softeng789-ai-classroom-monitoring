import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiMessage } from '../lib/apiClient';
import { listBehaviourEvents, reviewBehaviourEvent } from '../lib/behaviourEventApi';
import type { CandidateEvent, EventStatus, Session } from '../types';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface UseEventReviewOptions {
  sessions: readonly Session[];
  setSessionId: (sessionId: string) => void;
  setSessionDate: (date: string) => void;
  showToast: (message: string) => void;
}

type BulkReviewResult =
  | { id: string; ok: true; saved: CandidateEvent }
  | { id: string; ok: false; previous: CandidateEvent; error: unknown };

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
  const [eventRevision, setEventRevision] = useState(0);

  useEffect(() => {
    let cancelled = false;
    listBehaviourEvents()
      .then((loaded) => {
        if (cancelled) return;
        // Keep any live-monitoring simulations created while the request was in flight.
        setEvents((current) => [
          ...loaded,
          ...current.filter((event) => !UUID_PATTERN.test(event.id))
        ]);
        setEventRevision((current) => current + 1);
      })
      .catch((error) => {
        if (!cancelled) showToast(`AI events could not be loaded: ${apiMessage(error)}`);
      });
    return () => {
      cancelled = true;
    };
  }, [showToast]);

  const pendingEvents = useMemo(
    () => events.filter((event) => event.status === 'Pending Review'),
    [events]
  );

  const addEvent = useCallback((event: CandidateEvent) => {
    setEvents((current) => [...current, event]);
  }, []);

  const setEventStatus = useCallback(
    (id: string, status: EventStatus, patch?: Partial<CandidateEvent>) => {
      const previous = events.find((event) => event.id === id);
      setEvents((current) =>
        current.map((event) => (event.id === id ? { ...event, status, ...patch } : event))
      );
      setSelected((current) => current.filter((selectedId) => selectedId !== id));
      setCorrecting(false);
      showToast(
        status === 'Confirmed'
          ? `Event ${id} confirmed and added to reports.`
          : status === 'Rejected'
            ? `Event ${id} rejected. It is excluded from reports.`
            : `Event ${id} corrected to "${patch?.type}".`
      );

      if (previous && status !== 'Pending Review' && UUID_PATTERN.test(id)) {
        void reviewBehaviourEvent(id, status, patch?.type)
          .then((saved) => {
            setEvents((current) => current.map((event) => (event.id === id ? saved : event)));
            setEventRevision((current) => current + 1);
          })
          .catch((error) => {
            setEvents((current) => current.map((event) => (event.id === id ? previous : event)));
            showToast(`Review was not saved: ${apiMessage(error)}`);
          });
      }
    },
    [events, showToast]
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
      const eligible = events.filter(
        (event) => selected.includes(event.id) && event.status === 'Pending Review'
      );
      if (eligible.length === 0) {
        setSelected([]);
        return;
      }
      const eligibleIds = new Set(eligible.map((event) => event.id));
      setEvents((current) =>
        current.map((event) =>
          eligibleIds.has(event.id) && event.status === 'Pending Review'
            ? { ...event, status }
            : event
        )
      );
      setSelected([]);

      void (async () => {
        const persisted = eligible.filter((event) => UUID_PATTERN.test(event.id));
        const results = await Promise.all(
          persisted.map(async (event): Promise<BulkReviewResult> => {
            try {
              return { id: event.id, ok: true, saved: await reviewBehaviourEvent(event.id, status) };
            } catch (error) {
              return { id: event.id, ok: false, previous: event, error };
            }
          })
        );
        const resultsById = new Map(results.map((result) => [result.id, result]));
        setEvents((current) =>
          current.map((event) => {
            const result = resultsById.get(event.id);
            if (!result) return event;
            return result.ok ? result.saved : result.previous;
          })
        );
        setEventRevision((current) => current + 1);

        const failures = results.filter((result) => !result.ok);
        const savedCount = eligible.length - failures.length;
        const action = status === 'Confirmed' ? 'confirmed' : 'rejected';
        if (failures.length === 0) {
          showToast(`${savedCount} event${savedCount === 1 ? '' : 's'} ${action}.`);
          return;
        }
        const firstFailure = failures[0];
        showToast(
          `${savedCount} saved; ${failures.length} restored because saving failed: ${apiMessage(firstFailure.error)}`
        );
      })();
    },
    [events, selected, showToast]
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
    eventRevision,
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
