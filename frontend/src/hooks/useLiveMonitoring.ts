import { useEffect, useMemo, useRef, useState } from 'react';
import { TRACK_BOXES } from '../data/events';
import type {
  CandidateEvent,
  DetectionSettings,
  EventType,
  MonitorState,
  Student
} from '../types';

interface UseLiveMonitoringOptions {
  events: CandidateEvent[];
  students: Student[];
  settings: DetectionSettings;
  sessionId: string;
  addEvent: (event: CandidateEvent) => void;
}

export function useLiveMonitoring({
  events,
  students,
  settings,
  sessionId,
  addEvent
}: UseLiveMonitoringOptions) {
  const [monitor, setMonitor] = useState<MonitorState>('stopped');
  const [fps, setFps] = useState(24);
  const [tick, setTick] = useState(0);
  const [liveAlerts, setLiveAlerts] = useState<CandidateEvent[]>([]);
  const liveEventCounter = useRef(0);

  useEffect(() => {
    if (monitor !== 'running') return;
    const id = window.setInterval(() => {
      setTick((current) => current + 1);
      setFps(Math.round((24 + (Math.random() * 2 - 1)) * 10) / 10);
    }, 900);
    return () => window.clearInterval(id);
  }, [monitor]);

  useEffect(() => {
    setLiveAlerts([]);
  }, [sessionId]);

  useEffect(() => {
    if (monitor !== 'running' || tick === 0 || tick % 7 !== 0) return;
    setLiveAlerts((alerts) => {
      if (alerts.length >= 3) return alerts;
      const types: EventType[] = [
        'Prolonged head-down posture',
        'Leaving the seat area',
        'Potential peer interaction'
      ];
      const tracks = ['T-006', 'T-012', 'T-019'];
      const sequence = liveEventCounter.current + 1;
      liveEventCounter.current = sequence;
      const next: CandidateEvent = {
        id: `E-89${String(10 + sequence).padStart(2, '0')}`,
        studentId: null,
        trackId: tracks[alerts.length % 3],
        type: types[alerts.length % 3],
        sessionId,
        start: `10:4${alerts.length + 1}:12`,
        duration: `1m 4${alerts.length + 2}s`,
        confidence: Number((0.68 + alerts.length * 0.05).toFixed(2)),
        status: 'Pending Review'
      };
      addEvent(next);
      return [next, ...alerts];
    });
  }, [addEvent, monitor, sessionId, tick]);

  const trackBoxes = useMemo(() => {
    if (monitor === 'stopped') return [];
    return TRACK_BOXES.map((box, index) => {
      const jitter = monitor === 'running' ? Math.sin((tick + index * 2) / 2.4) * 0.7 : 0;
      const student = students[index];
      const label =
        settings.privacy === 'Student name'
          ? (student?.name.split(' ')[0] ?? box.trackId)
          : settings.privacy === 'Track ID + seat'
            ? `${box.trackId} · ${student?.seat ?? '-'}`
            : box.trackId;
      const flagged = events.some(
        (event) =>
          event.trackId === box.trackId &&
          event.sessionId === sessionId &&
          event.status === 'Pending Review'
      );
      return {
        ...box,
        left: box.left + jitter,
        top: box.top + jitter * 0.6,
        color: flagged ? 'var(--warn)' : 'var(--ok-hi)',
        label: `${label}  ${box.confidence.toFixed(2)}`
      };
    });
  }, [events, monitor, sessionId, settings.privacy, students, tick]);

  return {
    monitor,
    setMonitor,
    fps,
    liveAlerts,
    clearLiveAlerts: () => setLiveAlerts([]),
    trackBoxes
  };
}
