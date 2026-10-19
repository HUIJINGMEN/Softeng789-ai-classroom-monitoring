import { useCallback, useEffect, useRef, useState } from 'react';
import * as authApi from '../lib/authApi';
import { ApiError, apiMessage, setSessionAuthenticated, setUnauthorizedHandler } from '../lib/apiClient';
import type {
  AuthUser,
  FaceEnrollmentCapture,
  LoginPayload,
  RegisterStudentPayload,
  RegisterTeacherPayload
} from '../types';

const SESSION_NOTICE = 'classlens.session-change';

// Only a change notification is shared. Credentials and profiles are never persisted in JS storage.
function notifyOtherTabs(action: 'login' | 'logout') {
  try { window.localStorage.setItem(SESSION_NOTICE, `${action}:${crypto.randomUUID()}`); }
  catch { /* Cookie authorization still works when browser storage is disabled. */ }
}

export function useAuth() {
  const sessionRevision = useRef(0);
  const signingOut = useRef(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [restoring, setRestoring] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const clearSession = useCallback(() => {
    sessionRevision.current++;
    setSessionAuthenticated(false);
    setUser(null);
    setRestoring(false);
    setBusy(false);
  }, []);

  // Reacts to a session going invalid while the app is actively in use — a request hitting the
  // 12-hour token TTL, or the user signing out from another tab — not just on page load.
  useEffect(() => {
    setUnauthorizedHandler(clearSession);
    return () => setUnauthorizedHandler(null);
  }, [clearSession]);

  const persist = useCallback((next: AuthUser) => {
    setSessionAuthenticated(true, `${next.role.toUpperCase()}:${next.id}`);
    setUser(next);
    setRestoring(false);
  }, []);

  useEffect(() => {
    async function synchronize(event: StorageEvent) {
      if (event.storageArea !== window.localStorage || event.key !== SESSION_NOTICE) return;
      if (event.newValue?.startsWith('logout:')) { clearSession(); return; }
      const revision = ++sessionRevision.current;
      setSessionAuthenticated(false);
      setUser(null);
      setRestoring(true);
      setBusy(false);
      setError('');
      try {
        const fresh = await authApi.fetchCurrentUser();
        if (revision === sessionRevision.current) persist(fresh);
      } catch (cause) {
        if (revision === sessionRevision.current) {
          clearSession();
          if (!(cause instanceof ApiError && cause.status === 401)) setError(apiMessage(cause));
        }
      }
    }
    window.addEventListener('storage', synchronize);
    return () => window.removeEventListener('storage', synchronize);
  }, [clearSession, persist]);

  useEffect(() => {
    // Explicit one-way migration: never restore or transmit an old Bearer credential.
    try { window.localStorage.removeItem('classroomiq.auth'); } catch { /* Storage may be disabled. */ }
    let cancelled = false;
    const revision = sessionRevision.current;
    const isCurrent = () => !cancelled && revision === sessionRevision.current;
    authApi
      .fetchCurrentUser()
      .then((fresh) => {
        if (isCurrent()) persist(fresh);
      })
      .catch((err) => {
        if (!isCurrent()) return;
        if (err instanceof ApiError && err.status === 401) clearSession();
        else setError('Your login could not be checked. Refresh the page to try again.');
      })
      .finally(() => {
        if (isCurrent()) setRestoring(false);
      });
    return () => {
      cancelled = true;
    };
  }, [clearSession, persist]);

  const login = useCallback(
    async (payload: LoginPayload) => {
      const revision = ++sessionRevision.current;
      setBusy(true);
      setError('');
      try {
        const next = await authApi.login(payload);
        if (revision !== sessionRevision.current) return false;
        persist(next);
        notifyOtherTabs('login');
        return true;
      } catch (err) {
        if (revision === sessionRevision.current) setError(apiMessage(err));
        return false;
      } finally {
        if (revision === sessionRevision.current) setBusy(false);
      }
    },
    [persist]
  );

  const registerStudent = useCallback(
    async (payload: RegisterStudentPayload, captures: readonly FaceEnrollmentCapture[]) => {
      const revision = ++sessionRevision.current;
      setBusy(true);
      setError('');
      try {
        // Registration and face enrollment are submitted together. The backend verifies every
        // required capture before it creates the student or any pending class enrolment, so a
        // rejected or unavailable AI result never reaches the Admin review queue.
        const registered = await authApi.registerStudent(payload, captures);
        if (revision !== sessionRevision.current) return null;
        persist(registered);
        notifyOtherTabs('login');
        return registered;
      } catch (err) {
        if (revision === sessionRevision.current) setError(apiMessage(err));
        return null;
      } finally {
        if (revision === sessionRevision.current) setBusy(false);
      }
    },
    [persist]
  );

  const registerTeacher = useCallback(
    async (payload: RegisterTeacherPayload) => {
      const revision = ++sessionRevision.current;
      setBusy(true);
      setError('');
      try {
        const registered = await authApi.registerTeacher(payload);
        if (revision !== sessionRevision.current) return false;
        persist(registered);
        notifyOtherTabs('login');
        return true;
      } catch (err) {
        if (revision === sessionRevision.current) setError(apiMessage(err));
        return false;
      } finally {
        if (revision === sessionRevision.current) setBusy(false);
      }
    },
    [persist]
  );

  const logout = useCallback(async () => {
    if (signingOut.current) return;
    signingOut.current = true;
    const revision = ++sessionRevision.current;
    setBusy(true);
    setError('');
    try {
      await authApi.logout();
      if (revision !== sessionRevision.current) return;
      clearSession();
      notifyOtherTabs('logout');
    } catch {
      if (revision === sessionRevision.current) setError('Sign out failed. You may still be signed in. Please try again.');
    } finally {
      signingOut.current = false;
      setBusy(false);
    }
  }, [user, clearSession]);

  const clearError = useCallback(() => setError(''), []);

  return {
    user,
    restoring,
    busy,
    error,
    login,
    registerStudent,
    registerTeacher,
    logout,
    clearError
  };
}

export type Auth = ReturnType<typeof useAuth>;
