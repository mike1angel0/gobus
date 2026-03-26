import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiClient, setAccessToken, setOnUnauthorized, setOnForbiddenOrLocked } from '@/api/client';
import { isApiError } from '@/api/errors';
import { authKeys } from '@/api/keys';
import {
  AuthContext,
  getStoredRefreshToken,
  getTokenExpiryMs,
  REFRESH_MARGIN_MS,
  storeRefreshToken,
  type AuthContextValue,
  type AuthStatus,
  type ProfileUpdate,
  type RegisterData,
  type User,
} from '@/contexts/auth-types';

/** Props for {@link AuthProvider}. */
interface AuthProviderProps {
  /** Child components that can consume auth state via {@link useAuth}. */
  children: ReactNode;
}

/**
 * Provides authentication state and actions to the component tree.
 *
 * Manages access tokens in memory (XSS-safe), refresh tokens in localStorage,
 * auto-refreshes access tokens before expiry, and handles auth error codes
 * (401 → refresh, 403 → suspended logout, 423 → locked message).
 *
 * @example
 * ```tsx
 * <AuthProvider>
 *   <App />
 * </AuthProvider>
 * ```
 */
export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isRefreshingRef = useRef(false);
  const queryClient = useQueryClient();

  /** Clears all auth state: tokens, user, timers. */
  const clearAuth = useCallback(() => {
    setAccessToken(null);
    storeRefreshToken(null);
    setUser(null);
    setStatus('unauthenticated');
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
    queryClient.removeQueries({ queryKey: authKeys.all });
  }, [queryClient]);

  /** Schedules an access token refresh before it expires. */
  const scheduleRefresh = useCallback(
    (accessToken: string) => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }

      const expiryMs = getTokenExpiryMs(accessToken);
      if (!expiryMs) return;

      const delay = expiryMs - Date.now() - REFRESH_MARGIN_MS;
      if (delay <= 0) {
        void refreshTokens();
        return;
      }

      refreshTimerRef.current = setTimeout(() => {
        void refreshTokens();
      }, delay);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [], // refreshTokens is stable via ref pattern
  );

  /** Stores tokens, sets user, and schedules refresh. */
  const handleAuthSuccess = useCallback(
    (accessToken: string, refreshToken: string, userData: User) => {
      setAccessToken(accessToken);
      storeRefreshToken(refreshToken);
      setUser(userData);
      setStatus('authenticated');
      scheduleRefresh(accessToken);
    },
    [scheduleRefresh],
  );

  /** Attempts to refresh the access token using the stored refresh token. */
  const refreshTokens = useCallback(async (): Promise<boolean> => {
    const storedRefreshToken = getStoredRefreshToken();
    if (!storedRefreshToken || isRefreshingRef.current) return false;

    isRefreshingRef.current = true;
    try {
      const { data } = await apiClient.POST('/api/v1/auth/refresh', {
        body: { refreshToken: storedRefreshToken },
      });

      if (!data) {
        clearAuth();
        return false;
      }

      const newAccessToken = data.data.accessToken;
      const newRefreshToken = data.data.refreshToken;

      setAccessToken(newAccessToken);
      storeRefreshToken(newRefreshToken);
      scheduleRefresh(newAccessToken);
      return true;
    } catch {
      clearAuth();
      return false;
    } finally {
      isRefreshingRef.current = false;
    }
  }, [clearAuth, scheduleRefresh]);

  /** Login with email and password. */
  const login = useCallback(
    async (email: string, password: string): Promise<void> => {
      const { data } = await apiClient.POST('/api/v1/auth/login', {
        body: { email, password },
      });

      if (!data) {
        throw new Error('Login failed: no data returned');
      }

      handleAuthSuccess(data.data.accessToken, data.data.refreshToken, data.data.user);
    },
    [handleAuthSuccess],
  );

  /** Register a new account. */
  const register = useCallback(
    async (registerData: RegisterData): Promise<void> => {
      const { data } = await apiClient.POST('/api/v1/auth/register', {
        body: registerData,
      });

      if (!data) {
        throw new Error('Registration failed: no data returned');
      }

      handleAuthSuccess(data.data.accessToken, data.data.refreshToken, data.data.user);
    },
    [handleAuthSuccess],
  );

  /** Log out: revoke refresh token server-side, then clear local state. */
  const logout = useCallback(async (): Promise<void> => {
    const storedRefreshToken = getStoredRefreshToken();
    if (storedRefreshToken) {
      try {
        await apiClient.POST('/api/v1/auth/logout', {
          body: { refreshToken: storedRefreshToken },
        });
      } catch {
        // Best-effort server revocation — clear locally regardless
      }
    }
    clearAuth();
  }, [clearAuth]);

  /** Change the current user's password. */
  const changePassword = useCallback(
    async (currentPassword: string, newPassword: string): Promise<void> => {
      await apiClient.POST('/api/v1/auth/change-password', {
        body: { currentPassword, newPassword },
      });
    },
    [],
  );

  /** Request a password reset email. */
  const forgotPassword = useCallback(async (email: string): Promise<void> => {
    await apiClient.POST('/api/v1/auth/forgot-password', {
      body: { email },
    });
  }, []);

  /** Reset password using a token from email. */
  const resetPassword = useCallback(async (token: string, newPassword: string): Promise<void> => {
    await apiClient.POST('/api/v1/auth/reset-password', {
      body: { token, newPassword },
    });
  }, []);

  /** Update the current user's profile via PATCH /api/v1/auth/me. */
  const updateProfile = useCallback(async (profileData: ProfileUpdate): Promise<User> => {
    const { data } = await apiClient.PATCH('/api/v1/auth/me', {
      body: profileData,
    });

    if (!data) {
      throw new Error('Profile update failed: no data returned');
    }

    setUser(data.data);
    return data.data;
  }, []);

  // Register 401 handler: attempt refresh, if that fails, clear auth
  useEffect(() => {
    setOnUnauthorized(() => {
      if (!isRefreshingRef.current) {
        void refreshTokens();
      }
    });
    return () => setOnUnauthorized(null);
  }, [refreshTokens]);

  // Register 403/423 handler: clear all auth state (account suspended or locked)
  useEffect(() => {
    setOnForbiddenOrLocked(() => {
      clearAuth();
    });
    return () => setOnForbiddenOrLocked(null);
  }, [clearAuth]);

  // On mount: try to restore session from stored refresh token
  useEffect(() => {
    let cancelled = false;

    async function restoreSession() {
      const storedRefreshToken = getStoredRefreshToken();
      if (!storedRefreshToken) {
        setStatus('unauthenticated');
        return;
      }

      try {
        isRefreshingRef.current = true;
        const { data } = await apiClient.POST('/api/v1/auth/refresh', {
          body: { refreshToken: storedRefreshToken },
        });

        if (cancelled || !data) {
          if (!cancelled) clearAuth();
          return;
        }

        const newAccessToken = data.data.accessToken;
        const newRefreshToken = data.data.refreshToken;

        setAccessToken(newAccessToken);
        storeRefreshToken(newRefreshToken);

        const { data: profileData } = await apiClient.GET('/api/v1/auth/me');

        if (cancelled) return;

        if (profileData) {
          setUser(profileData.data);
          setStatus('authenticated');
          scheduleRefresh(newAccessToken);
        } else {
          clearAuth();
        }
      } catch (error) {
        if (!cancelled) {
          if (isApiError(error)) {
            if (error.status === 403 || error.status === 423) {
              // Silently clear — pages will handle displaying messages
            }
          }
          clearAuth();
        }
      } finally {
        isRefreshingRef.current = false;
      }
    }

    void restoreSession();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      status,
      isLoading: status === 'loading',
      isAuthenticated: status === 'authenticated',
      login,
      register,
      logout,
      changePassword,
      forgotPassword,
      resetPassword,
      updateProfile,
    }),
    [
      user,
      status,
      login,
      register,
      logout,
      changePassword,
      forgotPassword,
      resetPassword,
      updateProfile,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
