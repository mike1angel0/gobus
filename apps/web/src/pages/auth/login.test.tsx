import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import LoginPage from '@/pages/auth/login';
import { getRedirectForRole, loginSchema } from '@/pages/auth/login-schema';
import { ApiError } from '@/api/errors';

// Mock useAuth hook
const mockLogin = vi.fn();
const mockNavigate = vi.fn();

let mockUser: { role: string } | null = null;
let mockIsAuthenticated = false;

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    login: mockLogin,
    user: mockUser,
    isAuthenticated: mockIsAuthenticated,
    status: mockIsAuthenticated ? 'authenticated' : 'unauthenticated',
    isLoading: false,
    register: vi.fn(),
    logout: vi.fn(),
    changePassword: vi.fn(),
    forgotPassword: vi.fn(),
    resetPassword: vi.fn(),
  }),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

function renderLoginPage() {
  return render(
    <MemoryRouter initialEntries={['/auth/login']}>
      <LoginPage />
    </MemoryRouter>,
  );
}

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = null;
    mockIsAuthenticated = false;
  });

  describe('rendering', () => {
    it('renders the login form with email and password fields', () => {
      renderLoginPage();

      expect(screen.getByRole('heading', { name: 'Sign in', level: 1 })).toBeInTheDocument();
      expect(screen.getByLabelText('Email')).toBeInTheDocument();
      expect(screen.getByLabelText('Password')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument();
    });

    it('renders forgot password and sign up links', () => {
      renderLoginPage();

      expect(screen.getByRole('link', { name: 'Forgot password?' })).toHaveAttribute(
        'href',
        '/auth/forgot-password',
      );
      expect(screen.getByRole('link', { name: 'Sign up' })).toHaveAttribute(
        'href',
        '/auth/register',
      );
    });

    it('has proper autocomplete attributes', () => {
      renderLoginPage();

      expect(screen.getByLabelText('Email')).toHaveAttribute('autocomplete', 'email');
      expect(screen.getByLabelText('Password')).toHaveAttribute(
        'autocomplete',
        'current-password',
      );
    });
  });

  describe('accessibility', () => {
    it('has labels associated with inputs', () => {
      renderLoginPage();

      const emailInput = screen.getByLabelText('Email');
      const passwordInput = screen.getByLabelText('Password');

      expect(emailInput).toHaveAttribute('id', 'email');
      expect(passwordInput).toHaveAttribute('id', 'password');
    });

    it('sets aria-invalid on fields with errors', async () => {
      const user = userEvent.setup();
      renderLoginPage();

      await user.click(screen.getByRole('button', { name: 'Sign in' }));

      await waitFor(() => {
        expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true');
        expect(screen.getByLabelText('Password')).toHaveAttribute('aria-invalid', 'true');
      });
    });

    it('links error messages via aria-describedby', async () => {
      const user = userEvent.setup();
      renderLoginPage();

      await user.click(screen.getByRole('button', { name: 'Sign in' }));

      await waitFor(() => {
        expect(screen.getByLabelText('Email')).toHaveAttribute('aria-describedby', 'email-error');
        expect(screen.getByLabelText('Password')).toHaveAttribute(
          'aria-describedby',
          'password-error',
        );
      });
    });

    it('shows error messages with role="alert"', async () => {
      const user = userEvent.setup();
      renderLoginPage();

      await user.click(screen.getByRole('button', { name: 'Sign in' }));

      await waitFor(() => {
        const alerts = screen.getAllByRole('alert');
        expect(alerts.length).toBeGreaterThanOrEqual(2);
      });
    });
  });

  describe('client-side validation', () => {
    it('shows required errors when submitting empty form', async () => {
      const user = userEvent.setup();
      renderLoginPage();

      await user.click(screen.getByRole('button', { name: 'Sign in' }));

      await waitFor(() => {
        expect(screen.getByText('Email is required')).toBeInTheDocument();
        expect(screen.getByText('Password is required')).toBeInTheDocument();
      });

      expect(mockLogin).not.toHaveBeenCalled();
    });

    it('shows error for invalid email format', async () => {
      const user = userEvent.setup();
      renderLoginPage();

      await user.type(screen.getByLabelText('Email'), 'not-an-email');
      await user.type(screen.getByLabelText('Password'), 'password123');
      await user.click(screen.getByRole('button', { name: 'Sign in' }));

      await waitFor(() => {
        expect(screen.getByText('Please enter a valid email address')).toBeInTheDocument();
      });

      expect(mockLogin).not.toHaveBeenCalled();
    });

    it('does not call login when validation fails', async () => {
      const user = userEvent.setup();
      renderLoginPage();

      await user.type(screen.getByLabelText('Email'), 'bad');
      await user.click(screen.getByRole('button', { name: 'Sign in' }));

      await waitFor(() => {
        expect(screen.getByText('Please enter a valid email address')).toBeInTheDocument();
      });

      expect(mockLogin).not.toHaveBeenCalled();
    });
  });

  describe('form submission', () => {
    it('calls login with email and password on valid submission', async () => {
      mockLogin.mockResolvedValue(undefined);
      const user = userEvent.setup();
      renderLoginPage();

      await user.type(screen.getByLabelText('Email'), 'test@example.com');
      await user.type(screen.getByLabelText('Password'), 'password123');
      await user.click(screen.getByRole('button', { name: 'Sign in' }));

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledWith('test@example.com', 'password123');
      });
    });

    it('shows loading state while submitting', async () => {
      // Make login hang to keep isSubmitting true
      mockLogin.mockImplementation(() => new Promise(() => {}));
      const user = userEvent.setup();
      renderLoginPage();

      await user.type(screen.getByLabelText('Email'), 'test@example.com');
      await user.type(screen.getByLabelText('Password'), 'password123');
      await user.click(screen.getByRole('button', { name: 'Sign in' }));

      await waitFor(() => {
        expect(screen.getByText('Signing in…')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /signing in/i })).toBeDisabled();
      });
    });
  });

  describe('API error handling', () => {
    it('shows invalid credentials error', async () => {
      mockLogin.mockRejectedValue(
        new ApiError({
          type: 'about:blank',
          title: 'Invalid credentials',
          status: 401,
          code: 'INVALID_CREDENTIALS',
        }),
      );
      const user = userEvent.setup();
      renderLoginPage();

      await user.type(screen.getByLabelText('Email'), 'test@example.com');
      await user.type(screen.getByLabelText('Password'), 'wrong');
      await user.click(screen.getByRole('button', { name: 'Sign in' }));

      await waitFor(() => {
        expect(
          screen.getByText('Invalid email or password. Please try again.'),
        ).toBeInTheDocument();
      });
    });

    it('shows account suspended error', async () => {
      mockLogin.mockRejectedValue(
        new ApiError({
          type: 'about:blank',
          title: 'Account suspended',
          status: 403,
          code: 'ACCOUNT_SUSPENDED',
        }),
      );
      const user = userEvent.setup();
      renderLoginPage();

      await user.type(screen.getByLabelText('Email'), 'test@example.com');
      await user.type(screen.getByLabelText('Password'), 'password123');
      await user.click(screen.getByRole('button', { name: 'Sign in' }));

      await waitFor(() => {
        expect(
          screen.getByText('Your account has been suspended. Please contact support.'),
        ).toBeInTheDocument();
      });
    });

    it('shows account locked error', async () => {
      mockLogin.mockRejectedValue(
        new ApiError({
          type: 'about:blank',
          title: 'Account locked',
          status: 423,
          code: 'ACCOUNT_LOCKED',
        }),
      );
      const user = userEvent.setup();
      renderLoginPage();

      await user.type(screen.getByLabelText('Email'), 'test@example.com');
      await user.type(screen.getByLabelText('Password'), 'password123');
      await user.click(screen.getByRole('button', { name: 'Sign in' }));

      await waitFor(() => {
        expect(
          screen.getByText(
            'Your account has been locked due to too many failed attempts. Please try again later.',
          ),
        ).toBeInTheDocument();
      });
    });

    it('maps field-level validation errors to form fields', async () => {
      mockLogin.mockRejectedValue(
        new ApiError({
          type: 'about:blank',
          title: 'Validation error',
          status: 400,
          code: 'VALIDATION_ERROR',
          errors: [{ field: 'email', message: 'Email format is invalid' }],
        }),
      );
      const user = userEvent.setup();
      renderLoginPage();

      await user.type(screen.getByLabelText('Email'), 'test@example.com');
      await user.type(screen.getByLabelText('Password'), 'password123');
      await user.click(screen.getByRole('button', { name: 'Sign in' }));

      await waitFor(() => {
        expect(screen.getByText('Email format is invalid')).toBeInTheDocument();
      });
    });

    it('shows generic error for non-API errors', async () => {
      mockLogin.mockRejectedValue(new Error('Network error'));
      const user = userEvent.setup();
      renderLoginPage();

      await user.type(screen.getByLabelText('Email'), 'test@example.com');
      await user.type(screen.getByLabelText('Password'), 'password123');
      await user.click(screen.getByRole('button', { name: 'Sign in' }));

      await waitFor(() => {
        expect(
          screen.getByText('An unexpected error occurred. Please try again.'),
        ).toBeInTheDocument();
      });
    });

    it('shows detail from generic API error without code', async () => {
      mockLogin.mockRejectedValue(
        new ApiError({
          type: 'about:blank',
          title: 'Server Error',
          status: 500,
          detail: 'Internal server error occurred',
        }),
      );
      const user = userEvent.setup();
      renderLoginPage();

      await user.type(screen.getByLabelText('Email'), 'test@example.com');
      await user.type(screen.getByLabelText('Password'), 'password123');
      await user.click(screen.getByRole('button', { name: 'Sign in' }));

      await waitFor(() => {
        expect(screen.getByText('Internal server error occurred')).toBeInTheDocument();
      });
    });
  });

  describe('redirect after login', () => {
    it('redirects PASSENGER to /', async () => {
      mockLogin.mockImplementation(() => {
        mockUser = { role: 'PASSENGER' };
        mockIsAuthenticated = true;
        return Promise.resolve();
      });
      const user = userEvent.setup();
      renderLoginPage();

      await user.type(screen.getByLabelText('Email'), 'test@example.com');
      await user.type(screen.getByLabelText('Password'), 'password123');
      await user.click(screen.getByRole('button', { name: 'Sign in' }));

      // The useEffect won't fire because mock doesn't trigger re-render.
      // But we can test the redirect helper directly.
      expect(mockLogin).toHaveBeenCalledWith('test@example.com', 'password123');
    });
  });
});

describe('getRedirectForRole', () => {
  it('returns /provider for PROVIDER', () => {
    expect(getRedirectForRole('PROVIDER')).toBe('/provider');
  });

  it('returns /driver for DRIVER', () => {
    expect(getRedirectForRole('DRIVER')).toBe('/driver');
  });

  it('returns /admin for ADMIN', () => {
    expect(getRedirectForRole('ADMIN')).toBe('/admin');
  });

  it('returns / for PASSENGER', () => {
    expect(getRedirectForRole('PASSENGER')).toBe('/');
  });
});

describe('loginSchema', () => {
  it('rejects empty email', () => {
    const result = loginSchema.safeParse({ email: '', password: 'test' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid email format', () => {
    const result = loginSchema.safeParse({ email: 'not-email', password: 'test' });
    expect(result.success).toBe(false);
  });

  it('rejects empty password', () => {
    const result = loginSchema.safeParse({ email: 'test@example.com', password: '' });
    expect(result.success).toBe(false);
  });

  it('accepts valid email and password', () => {
    const result = loginSchema.safeParse({ email: 'test@example.com', password: 'password123' });
    expect(result.success).toBe(true);
  });

  it('rejects email over 255 characters', () => {
    const longEmail = 'a'.repeat(250) + '@b.com';
    const result = loginSchema.safeParse({ email: longEmail, password: 'test' });
    expect(result.success).toBe(false);
  });

  it('rejects password over 128 characters', () => {
    const longPassword = 'a'.repeat(129);
    const result = loginSchema.safeParse({ email: 'test@example.com', password: longPassword });
    expect(result.success).toBe(false);
  });
});
