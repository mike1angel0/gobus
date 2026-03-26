import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import ForgotPasswordPage from '@/pages/auth/forgot-password';
import { forgotPasswordSchema } from '@/pages/auth/forgot-password-schema';

const mockForgotPassword = vi.fn();

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    login: vi.fn(),
    user: null,
    isAuthenticated: false,
    status: 'unauthenticated',
    isLoading: false,
    register: vi.fn(),
    logout: vi.fn(),
    changePassword: vi.fn(),
    forgotPassword: mockForgotPassword,
    resetPassword: vi.fn(),
  }),
}));

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/auth/forgot-password']}>
      <ForgotPasswordPage />
    </MemoryRouter>,
  );
}

describe('ForgotPasswordPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders the forgot password form with email field', () => {
      renderPage();

      expect(
        screen.getByRole('heading', { name: 'Forgot password', level: 1 }),
      ).toBeInTheDocument();
      expect(screen.getByLabelText('Email')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Send reset link' })).toBeInTheDocument();
    });

    it('renders sign in link', () => {
      renderPage();

      expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/auth/login');
    });

    it('has proper autocomplete and input type', () => {
      renderPage();

      const emailInput = screen.getByLabelText('Email');
      expect(emailInput).toHaveAttribute('autocomplete', 'email');
      expect(emailInput).toHaveAttribute('type', 'email');
    });
  });

  describe('accessibility', () => {
    it('uses semantic heading', () => {
      renderPage();
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Forgot password');
    });

    it('labels are associated with inputs', () => {
      renderPage();
      expect(screen.getByLabelText('Email')).toBeInTheDocument();
    });

    it('shows validation errors with role=alert', async () => {
      const user = userEvent.setup();
      renderPage();

      await user.click(screen.getByRole('button', { name: 'Send reset link' }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent('Email is required');
      });
    });

    it('sets aria-invalid on invalid fields', async () => {
      const user = userEvent.setup();
      renderPage();

      await user.click(screen.getByRole('button', { name: 'Send reset link' }));

      await waitFor(() => {
        expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true');
      });
    });

    it('links error message via aria-describedby', async () => {
      const user = userEvent.setup();
      renderPage();

      await user.click(screen.getByRole('button', { name: 'Send reset link' }));

      await waitFor(() => {
        expect(screen.getByLabelText('Email')).toHaveAttribute('aria-describedby', 'email-error');
        expect(screen.getByText('Email is required')).toHaveAttribute('id', 'email-error');
      });
    });
  });

  describe('client-side validation', () => {
    it('shows error for empty email', async () => {
      const user = userEvent.setup();
      renderPage();

      await user.click(screen.getByRole('button', { name: 'Send reset link' }));

      await waitFor(() => {
        expect(screen.getByText('Email is required')).toBeInTheDocument();
      });
      expect(mockForgotPassword).not.toHaveBeenCalled();
    });

    it('shows error for invalid email', async () => {
      const user = userEvent.setup();
      renderPage();

      await user.type(screen.getByLabelText('Email'), 'not-an-email');
      await user.click(screen.getByRole('button', { name: 'Send reset link' }));

      await waitFor(() => {
        expect(screen.getByText('Please enter a valid email address')).toBeInTheDocument();
      });
      expect(mockForgotPassword).not.toHaveBeenCalled();
    });
  });

  describe('form submission', () => {
    it('calls forgotPassword and shows success message', async () => {
      mockForgotPassword.mockResolvedValueOnce(undefined);
      const user = userEvent.setup();
      renderPage();

      await user.type(screen.getByLabelText('Email'), 'test@example.com');
      await user.click(screen.getByRole('button', { name: 'Send reset link' }));

      await waitFor(() => {
        expect(mockForgotPassword).toHaveBeenCalledWith('test@example.com');
      });

      expect(
        screen.getByRole('heading', { name: 'Check your email', level: 1 }),
      ).toBeInTheDocument();
      expect(screen.getByText(/If an account exists with that email/)).toBeInTheDocument();
    });

    it('shows success message with back to sign in link', async () => {
      mockForgotPassword.mockResolvedValueOnce(undefined);
      const user = userEvent.setup();
      renderPage();

      await user.type(screen.getByLabelText('Email'), 'test@example.com');
      await user.click(screen.getByRole('button', { name: 'Send reset link' }));

      await waitFor(() => {
        expect(screen.getByRole('link', { name: 'Back to sign in' })).toHaveAttribute(
          'href',
          '/auth/login',
        );
      });
    });

    it('shows loading state during submission', async () => {
      mockForgotPassword.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100)),
      );
      const user = userEvent.setup();
      renderPage();

      await user.type(screen.getByLabelText('Email'), 'test@example.com');
      await user.click(screen.getByRole('button', { name: 'Send reset link' }));

      await waitFor(() => {
        expect(screen.getByText('Sending…')).toBeInTheDocument();
      });
    });

    it('shows error on network failure', async () => {
      mockForgotPassword.mockRejectedValueOnce(new Error('Network error'));
      const user = userEvent.setup();
      renderPage();

      await user.type(screen.getByLabelText('Email'), 'test@example.com');
      await user.click(screen.getByRole('button', { name: 'Send reset link' }));

      await waitFor(() => {
        expect(
          screen.getByText('Something went wrong. Please try again later.'),
        ).toBeInTheDocument();
      });
    });
  });

  describe('schema validation', () => {
    it('rejects empty email', () => {
      const result = forgotPasswordSchema.safeParse({ email: '' });
      expect(result.success).toBe(false);
    });

    it('rejects invalid email format', () => {
      const result = forgotPasswordSchema.safeParse({ email: 'not-email' });
      expect(result.success).toBe(false);
    });

    it('rejects email over 255 chars', () => {
      const result = forgotPasswordSchema.safeParse({ email: 'a'.repeat(250) + '@b.com' });
      expect(result.success).toBe(false);
    });

    it('accepts valid email', () => {
      const result = forgotPasswordSchema.safeParse({ email: 'test@example.com' });
      expect(result.success).toBe(true);
    });
  });
});
