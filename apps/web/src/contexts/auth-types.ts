import { createContext } from 'react';
import type { components } from '@/api/generated/types';

/** User profile from the API. */
export type User = components['schemas']['User'];

/** Registration request payload. */
export type RegisterData = components['schemas']['RegisterRequest'];

/** Possible auth states: loading, authenticated, or unauthenticated. */
export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

/** Profile update payload matching the OpenAPI `UserUpdate` schema. */
export type ProfileUpdate = components['schemas']['UserUpdate'];

/** Auth context value exposed to consumers via {@link useAuth}. */
export interface AuthContextValue {
  /** Current authenticated user, or `null` if not logged in. */
  user: User | null;
  /** Current auth status. */
  status: AuthStatus;
  /** Whether initial auth state is still being resolved. */
  isLoading: boolean;
  /** Whether the user is authenticated. */
  isAuthenticated: boolean;
  /** Authenticate with email and password. Stores tokens and fetches profile. */
  login: (email: string, password: string) => Promise<void>;
  /** Register a new account. Stores tokens on success. */
  register: (data: RegisterData) => Promise<void>;
  /** Log out: revoke refresh token server-side, clear local state. */
  logout: () => Promise<void>;
  /** Change password for the current user. */
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  /** Request a password reset email. */
  forgotPassword: (email: string) => Promise<void>;
  /** Reset password using a token from email. */
  resetPassword: (token: string, newPassword: string) => Promise<void>;
  /** Update the current user's profile (name, phone, avatarUrl). */
  updateProfile: (data: ProfileUpdate) => Promise<User>;
}

/**
 * React context for authentication state and actions.
 * Use {@link useAuth} to consume this context.
 */
export const AuthContext = createContext<AuthContextValue | null>(null);

/** Key used to store the refresh token in localStorage. */
export const REFRESH_TOKEN_KEY = 'transio_refresh_token';

/** Milliseconds before JWT expiry to trigger a refresh (60 seconds). */
export const REFRESH_MARGIN_MS = 60 * 1000;

/**
 * Decodes the payload of a JWT without verifying the signature.
 * Returns `null` if the token is malformed.
 */
export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = parts[1];
    if (!payload) return null;
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Extracts the expiration timestamp (in ms) from a JWT.
 * Returns `null` if the token has no `exp` claim.
 */
export function getTokenExpiryMs(token: string): number | null {
  const payload = decodeJwtPayload(token);
  if (!payload || typeof payload['exp'] !== 'number') return null;
  return (payload['exp'] as number) * 1000;
}

/**
 * Reads the refresh token from localStorage.
 */
export function getStoredRefreshToken(): string | null {
  try {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  } catch {
    return null;
  }
}

/**
 * Persists the refresh token to localStorage, or removes it if `null`.
 */
export function storeRefreshToken(token: string | null): void {
  try {
    if (token) {
      localStorage.setItem(REFRESH_TOKEN_KEY, token);
    } else {
      localStorage.removeItem(REFRESH_TOKEN_KEY);
    }
  } catch {
    // Storage unavailable (private browsing, etc.) — degrade gracefully
  }
}
