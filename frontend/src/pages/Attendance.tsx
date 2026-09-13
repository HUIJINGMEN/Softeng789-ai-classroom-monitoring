import { useState } from 'react';
import CreateSessionModal from '../components/CreateSessionModal';
import SessionManagementPanel from '../components/SessionManagementPanel';
import type { Session } from '../types';
import type { Console } from '../hooks/useConsole';

export default function Attendance({ console: c }: { readonly console: Console }) {
  const [creatingSession, setCreatingSession] = useState(false);
  const [editingSession, setEditingSession] = useState<Session | null>(null);

  return (
    <div className="page__inner">
      <SessionManagementPanel
        console={c}
        onCreate={() => setCreatingSession(true)}
        onSelect={() => c.setPage('session-detail')}
        onEdit={(session) => setEditingSession(session)}
      />

      {(creatingSession || editingSession) && (
        <CreateSessionModal
          saving={c.sessionsLoading}
          onCreate={c.createSession}
          onUpdate={c.updateSession}
          editingSession={editingSession ?? undefined}
          onClose={() => {
            setCreatingSession(false);
            setEditingSession(null);
          }}
        />
      )}
    </div>
  );
}
