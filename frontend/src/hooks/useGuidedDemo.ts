import { useCallback, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import type { CandidateEvent, EventStatus, MonitorState, Page, Session } from '../types';

export interface DemoStep {
  page: Page;
  title: string;
  tip: string;
  run?: () => void;
}

interface Options {
  events: readonly CandidateEvent[];
  sessions: readonly Session[];
  setPage: (page: Page) => void;
  setSessionId: (sessionId: string) => void;
  setSessionDate: (date: string) => void;
  setModalId: Dispatch<SetStateAction<string | null>>;
  setEventStatus: (id: string, status: EventStatus, patch?: Partial<CandidateEvent>) => void;
  setMonitor: (state: MonitorState) => void;
}

/** The step-by-step guided tour shown from the header's "Guided demo" button — self-contained
 *  enough (its own step index, its own step definitions) to live outside useConsole; it just
 *  drives the same page/modal/session state every other page reads and writes directly. */
export function useGuidedDemo({
  events,
  sessions,
  setPage,
  setSessionId,
  setSessionDate,
  setModalId,
  setEventStatus,
  setMonitor
}: Options) {
  const [demoStep, setDemoStep] = useState(0);

  const demoSteps: DemoStep[] = useMemo(
    () => [
      {
        page: 'dashboard',
        title: 'Start on the dashboard',
        tip: "Today's attendance, session list and the number of candidate events still waiting for review."
      },
      {
        page: 'attendance',
        title: 'Open a classroom session',
        tip: 'Attendance for the selected session. Sort any column, or correct a record manually.'
      },
      {
        page: 'live',
        title: 'Watch the session live',
        tip: 'Simulated detection stream. Candidate events appear in the panel on the right as they are created.',
        run: () => setMonitor('running')
      },
      {
        page: 'events',
        title: 'Review candidate events',
        tip: 'Every event starts as Pending Review. Nothing reaches a report before a teacher acts on it.'
      },
      {
        page: 'events',
        title: 'Open the evidence',
        tip: 'Check the still frame, duration and confidence — then confirm, reject or correct the event type. Keys: C confirm, R reject, → next.',
        run: () => {
          const first = events.find((event) => event.status === 'Pending Review');
          if (first) {
            const session = sessions.find((candidate) => candidate.id === first.sessionId);
            setModalId(first.id);
            setSessionId(first.sessionId);
            if (session) setSessionDate(session.date);
          }
        }
      },
      {
        page: 'events',
        title: 'Confirm the observation',
        tip: 'The status badge updates immediately and the event becomes reportable.',
        run: () => {
          setModalId((current) => {
            if (current) setEventStatus(current, 'Confirmed');
            return current;
          });
        }
      },
      {
        page: 'reports',
        title: 'See it in the report',
        tip: 'Reports count confirmed and corrected events only — pending and rejected ones are excluded.',
        run: () => setModalId(null)
      }
    ],
    [events, sessions, setEventStatus, setModalId, setMonitor, setSessionDate, setSessionId]
  );

  const startDemo = useCallback(() => {
    setModalId(null);
    setDemoStep(1);
    setPage(demoSteps[0].page);
  }, [demoSteps, setModalId, setPage]);

  const nextDemoStep = useCallback(() => {
    if (demoStep >= demoSteps.length) {
      setDemoStep(0);
      return;
    }
    const step = demoSteps[demoStep];
    setDemoStep(demoStep + 1);
    setPage(step.page);
    step.run?.();
  }, [demoStep, demoSteps, setPage]);

  const prevDemoStep = useCallback(() => {
    if (demoStep <= 1) return;
    setDemoStep(demoStep - 1);
    setPage(demoSteps[demoStep - 2].page);
  }, [demoStep, demoSteps, setPage]);

  return {
    demoStep,
    demoSteps,
    startDemo,
    nextDemoStep,
    prevDemoStep,
    exitDemo: () => setDemoStep(0)
  };
}
