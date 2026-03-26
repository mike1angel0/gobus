import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthContext, type AuthContextValue } from '@/contexts/auth-types';
import { RoleGuard } from './role-guard';

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  });
}

const baseAuth: AuthContextValue = {
  user: null,
  status: 'authenticated',
  isLoading: false,
  isAuthenticated: true,
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
  changePassword: vi.fn(),
  forgotPassword: vi.fn(),
  resetPassword: vi.fn(),
};

function makeUser(role: 'PASSENGER' | 'PROVIDER' | 'DRIVER' | 'ADMIN') {
  return { id: '1', email: 'a@b.com', name: 'Test', role } as AuthContextValue['user'];
}

function renderWithRole(
  userRole: 'PASSENGER' | 'PROVIDER' | 'DRIVER' | 'ADMIN',
  allowedRoles: ReadonlyArray<'PASSENGER' | 'PROVIDER' | 'DRIVER' | 'ADMIN'>,
  initialEntry = '/guarded',
) {
  return render(
    <QueryClientProvider client={createTestQueryClient()}>
      <AuthContext.Provider value={{ ...baseAuth, user: makeUser(userRole) }}>
        <MemoryRouter initialEntries={[initialEntry]}>
          <Routes>
            <Route element={<RoleGuard allowedRoles={allowedRoles} />}>
              <Route path="/guarded" element={<div>Guarded Content</div>} />
            </Route>
            <Route path="/" element={<div>Home Page</div>} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}

describe('RoleGuard', () => {
  it('renders child routes when user role matches', () => {
    renderWithRole('PROVIDER', ['PROVIDER']);
    expect(screen.getByText('Guarded Content')).toBeInTheDocument();
  });

  it('renders child routes when user role is one of multiple allowed', () => {
    renderWithRole('ADMIN', ['PROVIDER', 'ADMIN']);
    expect(screen.getByText('Guarded Content')).toBeInTheDocument();
  });

  it('redirects to / when user role does not match', () => {
    renderWithRole('PASSENGER', ['PROVIDER']);
    expect(screen.getByText('Home Page')).toBeInTheDocument();
    expect(screen.queryByText('Guarded Content')).not.toBeInTheDocument();
  });

  it('redirects to / when user is null', () => {
    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <AuthContext.Provider value={{ ...baseAuth, user: null }}>
          <MemoryRouter initialEntries={['/guarded']}>
            <Routes>
              <Route element={<RoleGuard allowedRoles={['PROVIDER']} />}>
                <Route path="/guarded" element={<div>Guarded Content</div>} />
              </Route>
              <Route path="/" element={<div>Home Page</div>} />
            </Routes>
          </MemoryRouter>
        </AuthContext.Provider>
      </QueryClientProvider>,
    );

    expect(screen.getByText('Home Page')).toBeInTheDocument();
    expect(screen.queryByText('Guarded Content')).not.toBeInTheDocument();
  });

  it.each([
    { role: 'PASSENGER' as const, allowed: ['PROVIDER' as const] },
    { role: 'DRIVER' as const, allowed: ['ADMIN' as const] },
    { role: 'PROVIDER' as const, allowed: ['DRIVER' as const, 'ADMIN' as const] },
  ])('redirects $role when allowedRoles is $allowed', ({ role, allowed }) => {
    renderWithRole(role, allowed);
    expect(screen.getByText('Home Page')).toBeInTheDocument();
  });

  it.each([
    { role: 'PROVIDER' as const, allowed: ['PROVIDER' as const] },
    { role: 'DRIVER' as const, allowed: ['DRIVER' as const] },
    { role: 'ADMIN' as const, allowed: ['ADMIN' as const] },
    { role: 'PASSENGER' as const, allowed: ['PASSENGER' as const] },
  ])('allows $role when allowedRoles includes $role', ({ role, allowed }) => {
    renderWithRole(role, allowed);
    expect(screen.getByText('Guarded Content')).toBeInTheDocument();
  });
});
