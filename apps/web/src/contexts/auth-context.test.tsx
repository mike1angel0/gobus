import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { AuthProvider } from '@/contexts/auth-context';
import type { User } from '@/contexts/auth-types';
import { useAuth } from '@/hooks/useAuth';
import { apiClient, setAccessToken, setOnUnauthorized, setOnForbiddenOrLocked } from '@/api/client';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: vi.fn((index: number) => Object.keys(store)[index] ?? null),
  };
})();

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

// Mock the API client module
vi.mock('@/api/client', () => ({
  apiClient: {
    POST: vi.fn(),
    GET: vi.fn(),
    PATCH: vi.fn(),
  },
  setAccessToken: vi.fn(),
  getAccessToken: vi.fn(() => null),
  setOnUnauthorized: vi.fn(),
  setOnForbiddenOrLocked: vi.fn(),
}));

const mockPost = vi.mocked(apiClient.POST);
const mockGet = vi.mocked(apiClient.GET);
const mockPatch = vi.mocked((apiClient as unknown as { PATCH: typeof apiClient.POST }).PATCH);
const mockSetAccessToken = vi.mocked(setAccessToken);
const mockSetOnUnauthorized = vi.mocked(setOnUnauthorized);
const mockSetOnForbiddenOrLocked = vi.mocked(setOnForbiddenOrLocked);

/** A test user matching the API User schema. */
const testUser: User = {
  id: 'user-1',
  email: 'test@example.com',
  name: 'Test User',
  role: 'PASSENGER',
  phone: null,
  avatarUrl: null,
  status: 'ACTIVE',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

/** Creates a JWT-like token with a given exp (seconds since epoch). */
function createMockJwt(expSeconds: number): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = btoa(JSON.stringify({ sub: 'user-1', exp: expSeconds }));
  return `${header}.${payload}.signature`;
}

/** Creates a JWT that expires in the given number of seconds from now. */
function createExpiringJwt(secondsFromNow: number): string {
  return createMockJwt(Math.floor(Date.now() / 1000) + secondsFromNow);
}

/** Auth response envelope matching AuthDataResponse. */
function createAuthResponse(user: User = testUser, expiresIn = 900) {
  return {
    data: {
      data: {
        accessToken: createExpiringJwt(expiresIn),
        refreshToken: 'refresh-token-123',
        user,
      },
    },
  };
}

/** Token refresh response envelope matching TokenRefreshDataResponse. */
function createRefreshResponse(expiresIn = 900) {
  return {
    data: {
      data: {
        accessToken: createExpiringJwt(expiresIn),
        refreshToken: 'new-refresh-token',
      },
    },
  };
}

/** Wrapper providing QueryClient and AuthProvider for hook tests. */
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <AuthProvider>{children}</AuthProvider>
      </QueryClientProvider>
    );
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorageMock.clear();
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('AuthProvider', () => {
  describe('initial state', () => {
    it('resolves to unauthenticated when no refresh token is stored', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.status).toBe('unauthenticated');
      });

      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.user).toBeNull();
    });

    it('restores session from stored refresh token', async () => {
      localStorageMock.setItem('transio_refresh_token', 'stored-refresh-token');
      mockPost.mockResolvedValueOnce(createRefreshResponse() as never);
      mockGet.mockResolvedValueOnce({ data: { data: testUser } } as never);

      const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.status).toBe('authenticated');
      });

      expect(result.current.user).toEqual(testUser);
      expect(result.current.isAuthenticated).toBe(true);
      expect(mockSetAccessToken).toHaveBeenCalled();
    });

    it('clears auth when refresh token is invalid during restore', async () => {
      localStorageMock.setItem('transio_refresh_token', 'expired-token');
      mockPost.mockRejectedValueOnce(new Error('401 Unauthorized'));

      const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.status).toBe('unauthenticated');
      });

      expect(result.current.user).toBeNull();
      expect(localStorageMock.getItem('transio_refresh_token')).toBeNull();
    });

    it('clears auth when refresh succeeds but returns no data', async () => {
      localStorageMock.setItem('transio_refresh_token', 'stored-refresh-token');
      mockPost.mockResolvedValueOnce({ data: undefined } as never);

      const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.status).toBe('unauthenticated');
      });

      expect(result.current.user).toBeNull();
    });

    it('clears auth when profile fetch returns no data after refresh', async () => {
      localStorageMock.setItem('transio_refresh_token', 'stored-refresh-token');
      mockPost.mockResolvedValueOnce(createRefreshResponse() as never);
      mockGet.mockResolvedValueOnce({ data: undefined } as never);

      const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.status).toBe('unauthenticated');
      });

      expect(result.current.user).toBeNull();
    });

    it('clears auth on 403 (suspended) during session restore', async () => {
      localStorageMock.setItem('transio_refresh_token', 'stored-refresh-token');
      const { ApiError } = await import('@/api/errors');
      const suspendedError = new ApiError({
        type: 'about:blank',
        title: 'Forbidden',
        status: 403,
        code: 'ACCOUNT_SUSPENDED',
      });
      mockPost.mockRejectedValueOnce(suspendedError);

      const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.status).toBe('unauthenticated');
      });

      expect(result.current.user).toBeNull();
    });

    it('clears auth on 423 (locked) during session restore', async () => {
      localStorageMock.setItem('transio_refresh_token', 'stored-refresh-token');
      const { ApiError } = await import('@/api/errors');
      const lockedError = new ApiError({
        type: 'about:blank',
        title: 'Locked',
        status: 423,
        code: 'ACCOUNT_LOCKED',
      });
      mockPost.mockRejectedValueOnce(lockedError);

      const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.status).toBe('unauthenticated');
      });

      expect(result.current.user).toBeNull();
    });
  });

  describe('login', () => {
    it('authenticates user and stores tokens', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.status).toBe('unauthenticated');
      });

      mockPost.mockResolvedValueOnce(createAuthResponse() as never);

      await act(async () => {
        await result.current.login('test@example.com', 'password123');
      });

      expect(result.current.status).toBe('authenticated');
      expect(result.current.user).toEqual(testUser);
      expect(result.current.isAuthenticated).toBe(true);
      expect(mockSetAccessToken).toHaveBeenCalledWith(expect.any(String));
      expect(localStorageMock.getItem('transio_refresh_token')).toBe('refresh-token-123');
    });

    it('calls POST /api/v1/auth/login with correct body', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });
      await waitFor(() => expect(result.current.status).toBe('unauthenticated'));

      mockPost.mockResolvedValueOnce(createAuthResponse() as never);

      await act(async () => {
        await result.current.login('user@test.com', 'mypassword');
      });

      expect(mockPost).toHaveBeenCalledWith('/api/v1/auth/login', {
        body: { email: 'user@test.com', password: 'mypassword' },
      });
    });

    it('throws when login returns no data', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });
      await waitFor(() => expect(result.current.status).toBe('unauthenticated'));

      mockPost.mockResolvedValueOnce({ data: undefined } as never);

      await expect(
        act(async () => {
          await result.current.login('test@example.com', 'password123');
        }),
      ).rejects.toThrow('Login failed: no data returned');

      expect(result.current.status).toBe('unauthenticated');
    });

    it('throws on login failure and stays unauthenticated', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });
      await waitFor(() => expect(result.current.status).toBe('unauthenticated'));

      const apiError = { status: 401, message: 'Invalid credentials' };
      mockPost.mockRejectedValueOnce(apiError);

      await expect(
        act(async () => {
          await result.current.login('bad@example.com', 'wrong');
        }),
      ).rejects.toEqual(apiError);

      expect(result.current.status).toBe('unauthenticated');
      expect(result.current.user).toBeNull();
    });
  });

  describe('register', () => {
    it('registers user and stores tokens', async () => {
      const providerUser: User = { ...testUser, role: 'PROVIDER' };
      const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });
      await waitFor(() => expect(result.current.status).toBe('unauthenticated'));

      mockPost.mockResolvedValueOnce(createAuthResponse(providerUser) as never);

      await act(async () => {
        await result.current.register({
          email: 'provider@test.com',
          password: 'StrongPass1',
          name: 'Provider User',
          role: 'PROVIDER',
          providerName: 'My Bus Co',
        });
      });

      expect(result.current.status).toBe('authenticated');
      expect(result.current.user?.role).toBe('PROVIDER');
      expect(mockPost).toHaveBeenCalledWith('/api/v1/auth/register', {
        body: {
          email: 'provider@test.com',
          password: 'StrongPass1',
          name: 'Provider User',
          role: 'PROVIDER',
          providerName: 'My Bus Co',
        },
      });
    });

    it('throws when register returns no data', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });
      await waitFor(() => expect(result.current.status).toBe('unauthenticated'));

      mockPost.mockResolvedValueOnce({ data: undefined } as never);

      await expect(
        act(async () => {
          await result.current.register({
            email: 'test@example.com',
            password: 'StrongPass1',
            name: 'Test',
            role: 'PASSENGER',
          });
        }),
      ).rejects.toThrow('Registration failed: no data returned');

      expect(result.current.status).toBe('unauthenticated');
    });
  });

  describe('logout', () => {
    it('revokes refresh token server-side and clears local state', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });
      await waitFor(() => expect(result.current.status).toBe('unauthenticated'));

      // Login first
      mockPost.mockResolvedValueOnce(createAuthResponse() as never);
      await act(async () => {
        await result.current.login('test@example.com', 'password123');
      });
      expect(result.current.isAuthenticated).toBe(true);

      // Logout
      mockPost.mockResolvedValueOnce({ data: undefined } as never);
      await act(async () => {
        await result.current.logout();
      });

      expect(result.current.status).toBe('unauthenticated');
      expect(result.current.user).toBeNull();
      expect(mockSetAccessToken).toHaveBeenLastCalledWith(null);
      expect(localStorageMock.getItem('transio_refresh_token')).toBeNull();
      expect(mockPost).toHaveBeenCalledWith('/api/v1/auth/logout', {
        body: { refreshToken: 'refresh-token-123' },
      });
    });

    it('clears local state even if server revocation fails', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });
      await waitFor(() => expect(result.current.status).toBe('unauthenticated'));

      mockPost.mockResolvedValueOnce(createAuthResponse() as never);
      await act(async () => {
        await result.current.login('test@example.com', 'password123');
      });

      // Server fails on logout
      mockPost.mockRejectedValueOnce(new Error('Network error'));
      await act(async () => {
        await result.current.logout();
      });

      expect(result.current.status).toBe('unauthenticated');
      expect(result.current.user).toBeNull();
    });
  });

  describe('changePassword', () => {
    it('calls POST /api/v1/auth/change-password with correct body', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });
      await waitFor(() => expect(result.current.status).toBe('unauthenticated'));

      mockPost.mockResolvedValueOnce(createAuthResponse() as never);
      await act(async () => {
        await result.current.login('test@example.com', 'password123');
      });

      mockPost.mockResolvedValueOnce({ data: { data: { message: 'Password changed' } } } as never);
      await act(async () => {
        await result.current.changePassword('oldPass123', 'NewPass456');
      });

      expect(mockPost).toHaveBeenCalledWith('/api/v1/auth/change-password', {
        body: { currentPassword: 'oldPass123', newPassword: 'NewPass456' },
      });
    });
  });

  describe('forgotPassword', () => {
    it('calls POST /api/v1/auth/forgot-password with email', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });
      await waitFor(() => expect(result.current.status).toBe('unauthenticated'));

      mockPost.mockResolvedValueOnce({
        data: { data: { message: 'If an account exists, we sent a reset link' } },
      } as never);

      await act(async () => {
        await result.current.forgotPassword('forgot@example.com');
      });

      expect(mockPost).toHaveBeenCalledWith('/api/v1/auth/forgot-password', {
        body: { email: 'forgot@example.com' },
      });
    });
  });

  describe('resetPassword', () => {
    it('calls POST /api/v1/auth/reset-password with token and new password', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });
      await waitFor(() => expect(result.current.status).toBe('unauthenticated'));

      mockPost.mockResolvedValueOnce({
        data: { data: { message: 'Password reset successfully' } },
      } as never);

      await act(async () => {
        await result.current.resetPassword('reset-token-abc', 'NewSecure1');
      });

      expect(mockPost).toHaveBeenCalledWith('/api/v1/auth/reset-password', {
        body: { token: 'reset-token-abc', newPassword: 'NewSecure1' },
      });
    });
  });

  describe('auto-refresh', () => {
    it('schedules refresh before token expires', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });
      await waitFor(() => expect(result.current.status).toBe('unauthenticated'));

      // Login with a token that expires in 120 seconds
      mockPost.mockResolvedValueOnce(createAuthResponse(testUser, 120) as never);
      await act(async () => {
        await result.current.login('test@example.com', 'password123');
      });

      // Mock the refresh call that will happen 60s before expiry
      mockPost.mockResolvedValueOnce(createRefreshResponse(900) as never);

      // Advance time to 60 seconds (120 - 60 margin = 60s)
      await act(async () => {
        vi.advanceTimersByTime(60 * 1000);
      });

      // Verify refresh was called
      expect(mockPost).toHaveBeenCalledWith('/api/v1/auth/refresh', {
        body: { refreshToken: 'refresh-token-123' },
      });
    });

    it('immediately refreshes when token expires within margin', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });
      await waitFor(() => expect(result.current.status).toBe('unauthenticated'));

      // Login with a token that expires in 30 seconds (within 60s REFRESH_MARGIN_MS)
      // This means delay = 30s - 60s = -30s <= 0, triggering immediate refresh
      mockPost
        .mockResolvedValueOnce(createAuthResponse(testUser, 30) as never) // login
        .mockResolvedValueOnce(createRefreshResponse(900) as never); // immediate refresh

      await act(async () => {
        await result.current.login('test@example.com', 'password123');
      });

      // The immediate refresh should have been triggered without a timer
      await waitFor(() => {
        expect(mockPost).toHaveBeenCalledWith('/api/v1/auth/refresh', {
          body: { refreshToken: 'refresh-token-123' },
        });
      });
    });

    it('clears auth when refresh fails during auto-refresh', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });
      await waitFor(() => expect(result.current.status).toBe('unauthenticated'));

      // Login with token expiring in 120s
      mockPost.mockResolvedValueOnce(createAuthResponse(testUser, 120) as never);
      await act(async () => {
        await result.current.login('test@example.com', 'password123');
      });

      // Refresh will fail
      mockPost.mockRejectedValueOnce(new Error('Refresh token expired'));

      await act(async () => {
        vi.advanceTimersByTime(60 * 1000);
      });

      await waitFor(() => {
        expect(result.current.status).toBe('unauthenticated');
      });
    });
  });
});

describe('updateProfile', () => {
  it('updates user state on successful profile update', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.status).toBe('unauthenticated'));

    // Login first
    mockPost.mockResolvedValueOnce(createAuthResponse() as never);
    await act(async () => {
      await result.current.login('test@example.com', 'password123');
    });

    const updatedUser = { ...testUser, name: 'Updated Name' };
    mockPatch.mockResolvedValueOnce({ data: { data: updatedUser } } as never);

    await act(async () => {
      const returned = await result.current.updateProfile({ name: 'Updated Name' });
      expect(returned).toEqual(updatedUser);
    });

    expect(result.current.user?.name).toBe('Updated Name');
  });

  it('throws when profile update returns no data', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.status).toBe('unauthenticated'));

    mockPost.mockResolvedValueOnce(createAuthResponse() as never);
    await act(async () => {
      await result.current.login('test@example.com', 'password123');
    });

    mockPatch.mockResolvedValueOnce({ data: undefined } as never);

    await expect(
      act(async () => {
        await result.current.updateProfile({ name: 'New Name' });
      }),
    ).rejects.toThrow('Profile update failed: no data returned');
  });
});

describe('unauthorized handler', () => {
  it('registers a 401 handler via setOnUnauthorized', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.status).toBe('unauthenticated'));

    expect(mockSetOnUnauthorized).toHaveBeenCalledWith(expect.any(Function));
  });

  it('triggers refresh when 401 handler is called', async () => {
    // Login first to have a refresh token
    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.status).toBe('unauthenticated'));

    mockPost.mockResolvedValueOnce(createAuthResponse() as never);
    await act(async () => {
      await result.current.login('test@example.com', 'password123');
    });

    // Get the 401 handler that was registered
    const unauthorizedHandler = mockSetOnUnauthorized.mock.calls.at(-1)?.[0];
    expect(unauthorizedHandler).toBeInstanceOf(Function);

    // Mock the refresh call
    mockPost.mockResolvedValueOnce(createRefreshResponse() as never);

    // Trigger the 401 handler
    act(() => {
      (unauthorizedHandler as () => void)();
    });

    // Verify refresh was attempted
    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith('/api/v1/auth/refresh', expect.any(Object));
    });
  });
});

describe('forbidden/locked handler', () => {
  it('registers a 403/423 handler via setOnForbiddenOrLocked', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.status).toBe('unauthenticated'));

    expect(mockSetOnForbiddenOrLocked).toHaveBeenCalledWith(expect.any(Function));
  });

  it('clears auth when 403/423 handler is triggered', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.status).toBe('unauthenticated'));

    // Login first
    mockPost.mockResolvedValueOnce(createAuthResponse() as never);
    await act(async () => {
      await result.current.login('test@example.com', 'password123');
    });
    expect(result.current.isAuthenticated).toBe(true);

    // Get the 403/423 handler
    const forbiddenHandler = mockSetOnForbiddenOrLocked.mock.calls.at(-1)?.[0];
    expect(forbiddenHandler).toBeInstanceOf(Function);

    // Trigger the handler
    act(() => {
      (forbiddenHandler as () => void)();
    });

    await waitFor(() => {
      expect(result.current.status).toBe('unauthenticated');
    });
    expect(result.current.user).toBeNull();
  });
});

describe('useAuth', () => {
  it('throws when used outside AuthProvider', () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    function Wrapper({ children }: { children: ReactNode }) {
      return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
    }

    expect(() => {
      renderHook(() => useAuth(), { wrapper: Wrapper });
    }).toThrow('useAuth must be used within an AuthProvider');
  });
});
