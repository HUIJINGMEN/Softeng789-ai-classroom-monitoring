import { useCallback, useMemo, useState } from 'react';
import type { FeedbackRating, TeacherNote } from '../types';

const STORAGE_KEY = 'classroomiq.teacher-feedback.v1';

export interface NewTeacherFeedback {
  studentId: string;
  rating: FeedbackRating;
  comment: string;
}

export function useTeacherFeedback() {
  const [feedback, setFeedback] = useState<TeacherNote[]>(() => loadFeedback());

  const addFeedback = useCallback((draft: NewTeacherFeedback) => {
    const note: TeacherNote = {
      id: `feedback-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      studentId: draft.studentId,
      rating: draft.rating,
      comment: draft.comment.trim(),
      author: 'Dr. Diane Kessler',
      createdAt: new Date().toISOString()
    };

    setFeedback((current) => {
      const next = [note, ...current];
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
    return note;
  }, []);

  const feedbackByStudent = useMemo(() => {
    const grouped = new Map<string, TeacherNote[]>();
    for (const note of feedback) {
      grouped.set(note.studentId, [...(grouped.get(note.studentId) ?? []), note]);
    }
    return grouped;
  }, [feedback]);

  return {
    feedback,
    feedbackByStudent,
    addFeedback
  };
}

function loadFeedback(): TeacherNote[] {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    if (!value) return [];
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
