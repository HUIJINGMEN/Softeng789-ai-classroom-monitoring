import { lazy, Suspense, useState } from 'react';
const Panel = lazy(() => import('./WebcamEventsPanel'));

// No camera or model initialization until the user explicitly starts the local test.
export default function WebcamEventsEntry({ studentId, initiallyOpen = false }: { studentId?: string; initiallyOpen?: boolean }) {
  const [open, setOpen] = useState(initiallyOpen);
  return <div style={{ margin: '20px 0' }}>
    {!initiallyOpen && <button type="button" className="btn" aria-expanded={open} onClick={() => setOpen(value => !value)}>
      {open ? 'Close classroom camera' : 'Open classroom camera'}
    </button>}
    {open && <Suspense fallback={<p role="status">Loading camera test…</p>}><Panel studentId={studentId} /></Suspense>}
  </div>;
}
