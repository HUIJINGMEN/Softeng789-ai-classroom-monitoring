import { useCallback, useEffect, useState } from 'react';
import * as authApi from '../lib/authApi';
import { ApiError, apiMessage, setAuthToken, setUnauthorizedHandler } from '../lib/apiClient';
import type { AuthUser, LoginPayload, RegisterStudentPayload, RegisterTeacherPayload } from '../types';

const STORAGE_KEY = 'classroomiq.auth';

function isAuthUser(value: unknown): value is AuthUser {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.token === 'string' &&
    (candidate.role === 'student' || candidate.role === 'teacher') &&
    typeof candidate.id === 'string' &&
    typeof candidate.name === 'string' &&
    typeof candidate.email === 'string'
  );
}

// A hand-edited or corrupted localStorage entry must not reach App.tsx's role check — it only
// tests `role === 'student'` and falls back to the teacher console otherwise, so an invalid shape
// here would fail open into the wrong console instead of just signing the user out.
function readStored(): AuthUser | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isAuthUser(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

// Runs once on module load, before any component renders — a child component (e.g. TeacherApp)
// can mount and fire its own data-fetching effects before a parent's useEffect would ever run,
// so the token has to be in place synchronously rather than reactively.
setAuthToken(readStored()?.token ?? null);

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(() => readStored());
  const [restoring, setRestoring] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const clearSession = useCallback(() => {
    window.localStorage.removeItem(STORAGE_KEY);
    setAuthToken(null);
    setUser(null);
  }, []);

  // Reacts to a session going invalid while the app is actively in use — a request hitting the
  // 12-hour token TTL, or the user signing out from another tab — not just on page load.
  useEffect(() => {
    setUnauthorizedHandler(clearSession);
    return () => setUnauthorizedHandler(null);
  }, [clearSession]);

  const persist = useCallback((next: AuthUser) => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setAuthToken(next.token);
    setUser(next);
  }, []);

  useEffect(() => {
    const stored = readStored();
    if (!stored) {
      setRestoring(false);
      return;
    }
    let cancelled = false;
    authApi
      .fetchCurrentUser()
      .then((fresh) => {
        // Also writes the refreshed profile back to localStorage — otherwise a name/email edited
        // server-side would only ever show up in memory, and the next hard reload would briefly
        // (or, offline, indefinitely) show the stale cached copy again.
        if (!cancelled) persist(fresh);
      })
      .catch((err) => {
        // Only an explicitly rejected/expired token should sign the user out —
        // a transient network or server error shouldn't discard a still-valid session.
        if (!cancelled && err instanceof ApiError && err.status === 401) {
          clearSession();
        }
      })
      .finally(() => {
        if (!cancelled) setRestoring(false);
      });
    return () => {
      cancelled = true;
    };
  }, [clearSession, persist]);

  const login = useCallback(
    async (payload: LoginPayload) => {
      setBusy(true);
      setError('');
      try {
        persist(await authApi.login(payload));
        return true;
      } catch (err) {
        setError(apiMessage(err));
        return false;
      } finally {
        setBusy(false);
      }
    },
    [persist]
  );

  const registerStudent = useCallback(
    async (payload: RegisterStudentPayload) => {
      setBusy(true);
      setError('');
      try {
        persist(await authApi.registerStudent(payload));
        return true;
      } catch (err) {
        setError(apiMessage(err));
        return false;
      } finally {
        setBusy(false);
      }
    },
    [persist]
  );

  const registerTeacher = useCallback(
    async (payload: RegisterTeacherPayload) => {
      setBusy(true);
      setError('');
      try {
        persist(await authApi.registerTeacher(payload));
        return true;
      } catch (err) {
        setError(apiMessage(err));
        return false;
      } finally {
        setBusy(false);
      }
    },
    [persist]
  );

  const logout = useCallback(() => {
    if (user) void authApi.logout().catch(() => {});
    clearSession();
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
