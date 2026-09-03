import { useState } from 'react';
import { initials } from '../lib/format';

interface Props {
  readonly photoUrl?: string | null;
  readonly name: string;
  readonly tone: string;
  readonly large?: boolean;
  readonly alt: string;
}

/** Registration photo when there is one and it actually loads; initials otherwise. A photo URL
 *  that 404s or times out falls back to the same initials tile via onError, rather than leaving
 *  a broken-image icon in the row — a student's row should never look like a loading failure. */
export default function PersonAvatar({ photoUrl, name, tone, large, alt }: Props) {
  const [failed, setFailed] = useState(false);

  if (photoUrl && !failed) {
    return (
      <img
        className={`person__photo${large ? ' person__photo--large' : ''}`}
        src={photoUrl}
        alt={alt}
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <div className={`person__avatar ${tone}${large ? ' person__avatar--large' : ''}`}>
      {initials(name)}
    </div>
  );
}
