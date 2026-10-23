import { useState } from 'react';
import Modal from '../../components/Modal';
import type { Session } from '../../types';
import SessionPhotoPanel from './SessionPhotoPanel';
import './photoAttendance.css';

export default function AttendanceCaptureDialog({ sessions, loading, error, onClose, onManualAttendance, onSaved }: {
  sessions: readonly Session[]; loading: boolean; error: string;
  onClose: () => void; onManualAttendance: (sessionId: string) => void; onSaved: (sessionId: string) => Promise<void> | void;
}) {
  const [selectedId, setSelectedId] = useState('');
  const [activeId, setActiveId] = useState('');
  const available = sessions.filter(session => session.recordId && session.status !== 'Cancelled')
    .slice().sort((a, b) => b.startTime.localeCompare(a.startTime));
  const selected = available.find(session => session.id === selectedId);
  const active = available.find(session => session.id === activeId);
  return <Modal size="wide" className="mobile-attendance-capture" title="Attendance photo" subtitle={active ? `${active.course} · ${active.dateLabel} · ${active.time}` : 'Choose the class and date before taking a photo.'} closeButton onClose={onClose}>
    {active ? <SessionPhotoPanel key={active.recordId} sessionId={active.recordId!} initialCameraOpen
      onSaved={() => onSaved(active.id)} onManualAttendance={() => onManualAttendance(active.id)} />
      : <div className="vision-panel">
        {loading && <p role="status">Loading class sessions…</p>}
        {error && <p role="alert">{error}</p>}
        {!loading && !error && !available.length && <p>No available class sessions. Create a session in Attendance first.</p>}
        {activeId && !active && <p role="alert">This session is no longer available. Choose another session.</p>}
        <label>Class session<select value={selectedId} disabled={loading} onChange={event => setSelectedId(event.target.value)}>
          <option value="">Choose a class and date</option>
          {available.map(session => <option key={session.id} value={session.id}>{session.course} · {session.dateLabel} · {session.time} · {session.room}</option>)}
        </select></label>
        <button type="button" className="btn btn--primary" disabled={!selected || loading || !!error} onClick={() => setActiveId(selected!.id)}>Continue to camera</button>
      </div>}
    <p className="mobile-capture-note">Closing discards unsaved local photos and choices. A save already sent to the server may still complete.</p>
  </Modal>;
}
