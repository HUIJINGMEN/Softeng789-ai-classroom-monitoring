interface Props {
  readonly message: string;
  readonly busy: boolean;
  readonly onRetry: () => void;
}

/** Keep a failed sign-out visible in every role's workspace, rather than claiming local success. */
export default function SessionNotice({ message, busy, onRetry }: Props) {
  if (!message) return null;
  return (
    <aside className="session-notice" role="alert">
      <p>{message}</p>
      <button type="button" className="btn" disabled={busy} onClick={onRetry}>
        {busy ? 'Signing out…' : 'Try signing out again'}
      </button>
    </aside>
  );
}
