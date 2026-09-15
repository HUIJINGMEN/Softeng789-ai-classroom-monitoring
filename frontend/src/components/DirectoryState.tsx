import type { ReactNode } from 'react';

interface Props {
  readonly icon: ReactNode;
  readonly title: string;
  readonly description: string;
  readonly action?: ReactNode;
  readonly loading?: boolean;
}

export default function DirectoryState({ icon, title, description, action, loading = false }: Props) {
  const content = (
    <>
      <span className="directory-state__icon" aria-hidden="true">
        {icon}
      </span>
      <div className="directory-state__copy">
        <strong>{title}</strong>
        <span>{description}</span>
      </div>
      {action && <div className="directory-state__action">{action}</div>}
    </>
  );

  if (loading) {
    return <output className="directory-state" aria-live="polite">{content}</output>;
  }
  return <div className="directory-state">{content}</div>;
}
