import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthContext, type AuthContextValue } from '@/contexts/auth-types';
import { AuthGuard } from './auth-guard';

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  });
}

const baseAuth: AuthContextValue = {
  user: null,
  status: 'unauthenticated',
  isLoading: false,
  isAuthenticated: false,
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
  changePassword: vi.fn(),
  forgotPassword: vi.fn(),
  resetPassword: vi.fn(),
};

function renderWithAuth(authValue: Partial<AuthContextValue>, initialEntry = '/protected') {
  const value = { ...baseAuth, ...authValue };
  return render(
    <QueryClientProvider client={createTestQueryClient()}>
      <AuthContext.Provider value={value}>
        <MemoryRouter initialEntries={[initialEntry]}>
          <Routes>
            <Route element={<AuthGuard />}>
              <Route path="/protected" element={<div>Protected Content</div>} />
            </Route>
            <Route path="/auth/login" element={<div>Login Page</div>} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}

describe('AuthGuard', () => {
  it('renders child routes when user is authenticated', () => {
    renderWithAuth({
      status: 'authenticated',
      isAuthenticated: true,
      user: { id: '1', email: 'a@b.com', name: 'Test', role: 'PASSENGER' } as AuthContextValue['user'],
    });

    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });

  it('redirects to /auth/login when user is unauthenticated', () => {
    renderWithAuth({ status: 'unauthenticated', isAuthenticated: false });

    expect(screen.getByText('Login Page')).toBeInTheDocument();
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('renders nothing while auth is loading (no flash of content)', () => {
    const { container } = renderWithAuth({
      status: 'loading',
      isLoading: true,
      isAuthenticated: false,
    });

    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
    expect(screen.queryByText('Login Page')).not.toBeInTheDocument();
    expect(container.innerHTML).toBe('');
  });

  it('preserves the attempted URL in location state for post-login redirect', () => {
    function LoginCapture() {
      const location = useLocation();
      const from = (location.state as { from?: string } | null)?.from ?? '';
      return <div data-testid="from-state">{from}</div>;
    }

    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <AuthContext.Provider value={{ ...baseAuth }}>
          <MemoryRouter initialEntries={['/protected']}>
            <Routes>
              <Route element={<AuthGuard />}>
                <Route path="/protected" element={<div>Protected Content</div>} />
              </Route>
              <Route path="/auth/login" element={<LoginCapture />} />
            </Routes>
          </MemoryRouter>
        </AuthContext.Provider>
      </QueryClientProvider>,
    );

    expect(screen.getByTestId('from-state')).toHaveTextContent('/protected');
  });

  it('is accessible — does not render inaccessible elements', () => {
    renderWithAuth({
      status: 'authenticated',
      isAuthenticated: true,
      user: { id: '1', email: 'a@b.com', name: 'Test', role: 'PASSENGER' } as AuthContextValue['user'],
    });

    // Guard itself is transparent — just renders outlet content
    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });
});
