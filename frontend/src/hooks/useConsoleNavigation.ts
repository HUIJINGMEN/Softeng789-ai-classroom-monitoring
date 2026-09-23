import { useState } from 'react';
import type { Page } from '../types';

/**
 * Navigation and cross-page focus state for the teacher/admin shell. Page implementations keep
 * their own local UI state; only values needed to coordinate two pages belong here.
 */
export function useConsoleNavigation() {
  const [page, setPage] = useState<Page>('dashboard');
  const [profileId, setProfileId] = useState<string | null>(null);
  const [correctRowId, setCorrectRowId] = useState<string | null>(null);
  const [classDetailTitle, setClassDetailTitle] = useState<string | null>(null);
  const [classFocusId, setClassFocusId] = useState<string | null>(null);

  return {
    page,
    setPage,
    profileId,
    setProfileId,
    correctRowId,
    setCorrectRowId,
    classDetailTitle,
    setClassDetailTitle,
    classFocusId,
    setClassFocusId
  };
}

export type ConsoleNavigation = ReturnType<typeof useConsoleNavigation>;
