import { useCallback, useEffect, useState } from 'react';
import type { Page, SessionDetailOrigin } from '../types';

const CONSOLE_PAGES = new Set<Page>([
  'dashboard',
  'live',
  'attendance',
  'session-detail',
  'students',
  'achievements',
  'events',
  'reports',
  'settings',
  'staff',
  'classes',
  'campuses',
  'registrations',
  'requests',
  'payments',
  'health-alerts'
]);

function isConsolePage(value: string | null): value is Page {
  return value !== null && CONSOLE_PAGES.has(value as Page);
}

function readInitialNavigation() {
  const search = new URLSearchParams(window.location.search);
  const requestedPage = search.get('page');
  const page: Page = isConsolePage(requestedPage) ? requestedPage : 'dashboard';
  const studentId = search.get('student');

  return {
    page,
    profileId: page === 'students' ? studentId : null,
    paymentAccountFocusId: page === 'payments' ? studentId : null
  };
}

/**
 * Navigation and cross-page focus state for the teacher/admin shell. Page implementations keep
 * their own local UI state; only values needed to coordinate two pages belong here.
 */
export function useConsoleNavigation() {
  const [initialNavigation] = useState(readInitialNavigation);
  const [page, setPage] = useState<Page>(initialNavigation.page);
  const [profileId, setProfileId] = useState<string | null>(initialNavigation.profileId);
  const [correctRowId, setCorrectRowId] = useState<string | null>(null);
  const [classDetailTitle, setClassDetailTitle] = useState<string | null>(null);
  const [classFocusId, setClassFocusId] = useState<string | null>(null);
  const [classDetailSection, setClassDetailSection] = useState<'sessions' | null>(null);
  const [paymentAccountFocusId, setPaymentAccountFocusId] = useState<string | null>(
    initialNavigation.paymentAccountFocusId
  );
  const [sessionDetailOrigin, setSessionDetailOrigin] = useState<SessionDetailOrigin | null>(null);

  const changePage = useCallback((nextPage: Page) => {
    if (nextPage === page) return;
    const url = new URL(window.location.href);
    url.searchParams.set('page', nextPage);
    url.searchParams.delete('student');
    if (nextPage !== 'payments') url.searchParams.delete('paymentView');
    window.history.pushState(window.history.state, '', url);
    setPage(nextPage);
  }, [page]);

  useEffect(() => {
    const url = new URL(window.location.href);
    let studentId: string | null = null;
    if (page === 'students') studentId = profileId;
    else if (page === 'payments') studentId = paymentAccountFocusId;
    url.searchParams.set('page', page);
    if (studentId) url.searchParams.set('student', studentId);
    else url.searchParams.delete('student');
    if (page !== 'payments') url.searchParams.delete('paymentView');
    if (url.href !== window.location.href) {
      window.history.replaceState(window.history.state, '', url);
    }
  }, [page, paymentAccountFocusId, profileId]);

  useEffect(() => {
    const restoreNavigation = () => {
      const restored = readInitialNavigation();
      setPage(restored.page);
      setProfileId(restored.profileId);
      setPaymentAccountFocusId(restored.paymentAccountFocusId);
    };
    window.addEventListener('popstate', restoreNavigation);
    return () => window.removeEventListener('popstate', restoreNavigation);
  }, []);

  return {
    page,
    setPage: changePage,
    profileId,
    setProfileId,
    correctRowId,
    setCorrectRowId,
    classDetailTitle,
    setClassDetailTitle,
    classFocusId,
    setClassFocusId,
    classDetailSection,
    setClassDetailSection,
    paymentAccountFocusId,
    setPaymentAccountFocusId,
    sessionDetailOrigin,
    setSessionDetailOrigin
  };
}

export type ConsoleNavigation = ReturnType<typeof useConsoleNavigation>;
