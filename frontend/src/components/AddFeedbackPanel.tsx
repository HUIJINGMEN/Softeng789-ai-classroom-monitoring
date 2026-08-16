import { useState, type FormEvent } from 'react';
import type { FeedbackRating, TeacherNote } from '../types';

interface Props {
  studentId: string;
  notes: readonly TeacherNote[];
  onSave: (feedback: { studentId: string; rating: FeedbackRating; comment: string }) => void;
}

const RATINGS: FeedbackRating[] = ['Excellent', 'Good', 'Satisfactory', 'Needs Attention'];

export default function AddFeedbackPanel({ studentId, notes, onSave }: Props) {
  const [rating, setRating] = useState<FeedbackRating>('Good');
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = comment.trim();
    if (!text) {
      setError('Write a short note before saving feedback.');
      return;
    }
    onSave({ studentId, rating, comment: text });
    setComment('');
    setRating('Good');
    setError('');
  };

  return (
    <div className="feedback-panel">
      <form className="feedback-form" onSubmit={submit}>
        <div className="feedback-form__ratings" aria-label="Feedback rating">
          {RATINGS.map((value) => (
            <button
              key={value}
              type="button"
              className={`option-btn option-btn--choice feedback-rating${
                rating === value ? ' option-btn--on' : ''
              }`}
              onClick={() => {
                setRating(value);
                setError('');
              }}
            >
              {value}
            </button>
          ))}
        </div>

        <label className="field">
          Comment
          <textarea
            value={comment}
            rows={4}
            placeholder="Write a concise observation or follow-up note for this student."
            onChange={(event) => {
              setComment(event.target.value);
              setError('');
            }}
          />
        </label>

        {error && <div className="form-error">{error}</div>}

        <div className="feedback-form__actions">
          <button type="submit" className="btn btn--primary">
            Save feedback
          </button>
        </div>
      </form>

      <div className="feedback-list">
        {notes.map((note) => (
          <article key={note.id} className="teacher-note">
            <div className="teacher-note__head">
              <span className="badge badge--neutral">{note.rating}</span>
              <span className="teacher-note__meta">
                {note.author} · {formatFeedbackDate(note.createdAt)}
              </span>
            </div>
            <div className="teacher-note__text">{note.comment}</div>
          </article>
        ))}

        {notes.length === 0 && (
          <div className="empty empty--inline">
            No teacher feedback has been recorded for this student.
          </div>
        )}
      </div>
    </div>
  );
}

function formatFeedbackDate(value: string) {
  return new Intl.DateTimeFormat('en-NZ', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value));
}
