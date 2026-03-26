import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import ResetPasswordPage from '@/pages/auth/reset-password';
import { resetPasswordSchema } from '@/pages/auth/reset-password-schema';
import { ApiError } from '@/api/errors';

const mockResetPassword = vi.fn();
const mockNavigate = vi.fn();

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
    forgotPassword: vi.fn(),
    resetPassword: mockResetPassword,
  }),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

function renderPage(token?: string) {
  const url = token ? `/auth/reset-password?token=${token}` : '/auth/reset-password';
  return render(
    <MemoryRouter initialEntries={[url]}>
      <ResetPasswordPage />
    </MemoryRouter>,
  );
}

describe('ResetPasswordPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('missing token', () => {
    it('shows invalid link message when no token in URL', () => {
      renderPage();

      expect(screen.getByRole('heading', { name: 'Invalid link', level: 1 })).toBeInTheDocument();
      expect(
        screen.getByText(/This password reset link is invalid/),
      ).toBeInTheDocument();
    });

    it('shows link to request new reset', () => {
      renderPage();

      expect(screen.getByRole('link', { name: 'Request a new reset link' })).toHaveAttribute(
        'href',
        '/auth/forgot-password',
      );
    });
  });

  describe('rendering with token', () => {
    it('renders the reset password form', () => {
      renderPage('valid-token');

      expect(
        screen.getByRole('heading', { name: 'Reset password', level: 1 }),
      ).toBeInTheDocument();
      expect(screen.getByLabelText('New password')).toBeInTheDocument();
      expect(screen.getByLabelText('Confirm password')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Reset password' })).toBeInTheDocument();
    });

    it('renders sign in link', () => {
      renderPage('valid-token');

      expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute(
        'href',
        '/auth/login',
      );
    });

    it('has proper autocomplete attributes', () => {
      renderPage('valid-token');

      expect(screen.getByLabelText('New password')).toHaveAttribute(
        'autocomplete',
        'new-password',
      );
      expect(screen.getByLabelText('Confirm password')).toHaveAttribute(
        'autocomplete',
        'new-password',
      );
    });
  });

  describe('accessibility', () => {
    it('uses semantic heading', () => {
      renderPage('valid-token');
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Reset password');
    });

    it('labels are associated with inputs', () => {
      renderPage('valid-token');
      expect(screen.getByLabelText('New password')).toBeInTheDocument();
      expect(screen.getByLabelText('Confirm password')).toBeInTheDocument();
    });

    it('shows validation errors with role=alert', async () => {
      const user = userEvent.setup();
      renderPage('valid-token');

      await user.click(screen.getByRole('button', { name: 'Reset password' }));

      await waitFor(() => {
        const alerts = screen.getAllByRole('alert');
        expect(alerts.length).toBeGreaterThanOrEqual(1);
      });
    });

    it('sets aria-invalid on invalid fields', async () => {
      const user = userEvent.setup();
      renderPage('valid-token');

      await user.click(screen.getByRole('button', { name: 'Reset password' }));

      await waitFor(() => {
        expect(screen.getByLabelText('New password')).toHaveAttribute('aria-invalid', 'true');
      });
    });
  });

  describe('password strength indicator', () => {
    it('does not show strength bar when password is empty', () => {
      renderPage('valid-token');
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });

    it('shows weak strength for short password', async () => {
      const user = userEvent.setup();
      renderPage('valid-token');

      await user.type(screen.getByLabelText('New password'), 'abc');

      await waitFor(() => {
        expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '33');
        expect(screen.getByText('Strength: Weak')).toBeInTheDocument();
      });
    });

    it('shows fair strength for medium password', async () => {
      const user = userEvent.setup();
      renderPage('valid-token');

      await user.type(screen.getByLabelText('New password'), 'Abcdefgh');

      await waitFor(() => {
        expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '66');
        expect(screen.getByText('Strength: Fair')).toBeInTheDocument();
      });
    });

    it('shows strong strength for strong password', async () => {
      const user = userEvent.setup();
      renderPage('valid-token');

      await user.type(screen.getByLabelText('New password'), 'StrongPass1!');

      await waitFor(() => {
        expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
        expect(screen.getByText('Strength: Strong')).toBeInTheDocument();
      });
    });
  });

  describe('client-side validation', () => {
    it('shows error for empty fields', async () => {
      const user = userEvent.setup();
      renderPage('valid-token');

      await user.click(screen.getByRole('button', { name: 'Reset password' }));

      await waitFor(() => {
        expect(
          screen.getByText('Password must be at least 8 characters'),
        ).toBeInTheDocument();
        expect(screen.getByText('Please confirm your password')).toBeInTheDocument();
      });
      expect(mockResetPassword).not.toHaveBeenCalled();
    });

    it('shows error for password without uppercase', async () => {
      const user = userEvent.setup();
      renderPage('valid-token');

      await user.type(screen.getByLabelText('New password'), 'lowercase1');
      await user.type(screen.getByLabelText('Confirm password'), 'lowercase1');
      await user.click(screen.getByRole('button', { name: 'Reset password' }));

      await waitFor(() => {
        expect(
          screen.getByText('Password must contain at least one uppercase letter'),
        ).toBeInTheDocument();
      });
    });

    it('shows error for mismatched passwords', async () => {
      const user = userEvent.setup();
      renderPage('valid-token');

      await user.type(screen.getByLabelText('New password'), 'ValidPass1');
      await user.type(screen.getByLabelText('Confirm password'), 'Different1');
      await user.click(screen.getByRole('button', { name: 'Reset password' }));

      await waitFor(() => {
        expect(screen.getByText('Passwords do not match')).toBeInTheDocument();
      });
    });
  });

  describe('form submission', () => {
    it('calls resetPassword and navigates to login on success', async () => {
      mockResetPassword.mockResolvedValueOnce(undefined);
      const user = userEvent.setup();
      renderPage('my-token');

      await user.type(screen.getByLabelText('New password'), 'NewPass123');
      await user.type(screen.getByLabelText('Confirm password'), 'NewPass123');
      await user.click(screen.getByRole('button', { name: 'Reset password' }));

      await waitFor(() => {
        expect(mockResetPassword).toHaveBeenCalledWith('my-token', 'NewPass123');
        expect(mockNavigate).toHaveBeenCalledWith('/auth/login', { replace: true });
      });
    });

    it('shows loading state during submission', async () => {
      mockResetPassword.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100)),
      );
      const user = userEvent.setup();
      renderPage('my-token');

      await user.type(screen.getByLabelText('New password'), 'NewPass123');
      await user.type(screen.getByLabelText('Confirm password'), 'NewPass123');
      await user.click(screen.getByRole('button', { name: 'Reset password' }));

      await waitFor(() => {
        expect(screen.getByText('Resetting…')).toBeInTheDocument();
      });
    });

    it('shows expired token error and link to forgot password', async () => {
      mockResetPassword.mockRejectedValueOnce(
        new ApiError({
          type: 'about:blank',
          title: 'Bad Request',
          status: 400,
          detail: 'Token expired',
          code: 'TOKEN_EXPIRED',
        }),
      );
      const user = userEvent.setup();
      renderPage('expired-token');

      await user.type(screen.getByLabelText('New password'), 'NewPass123');
      await user.type(screen.getByLabelText('Confirm password'), 'NewPass123');
      await user.click(screen.getByRole('button', { name: 'Reset password' }));

      await waitFor(() => {
        expect(
          screen.getByRole('heading', { name: 'Link expired', level: 1 }),
        ).toBeInTheDocument();
        expect(
          screen.getByText(/This password reset link has expired/),
        ).toBeInTheDocument();
        expect(
          screen.getByRole('link', { name: 'Request a new reset link' }),
        ).toHaveAttribute('href', '/auth/forgot-password');
      });
    });

    it('shows invalid token error', async () => {
      mockResetPassword.mockRejectedValueOnce(
        new ApiError({
          type: 'about:blank',
          title: 'Bad Request',
          status: 400,
          detail: 'Invalid token',
          code: 'INVALID_TOKEN',
        }),
      );
      const user = userEvent.setup();
      renderPage('bad-token');

      await user.type(screen.getByLabelText('New password'), 'NewPass123');
      await user.type(screen.getByLabelText('Confirm password'), 'NewPass123');
      await user.click(screen.getByRole('button', { name: 'Reset password' }));

      await waitFor(() => {
        expect(
          screen.getByText(/This password reset link has expired/),
        ).toBeInTheDocument();
      });
    });

    it('maps field-level API errors to form fields', async () => {
      mockResetPassword.mockRejectedValueOnce(
        new ApiError({
          type: 'about:blank',
          title: 'Bad Request',
          status: 400,
          detail: 'Validation failed',
          errors: [{ field: 'newPassword', message: 'Password too common' }],
        }),
      );
      const user = userEvent.setup();
      renderPage('my-token');

      await user.type(screen.getByLabelText('New password'), 'NewPass123');
      await user.type(screen.getByLabelText('Confirm password'), 'NewPass123');
      await user.click(screen.getByRole('button', { name: 'Reset password' }));

      await waitFor(() => {
        expect(screen.getByText('Password too common')).toBeInTheDocument();
      });
    });

    it('shows generic error for unexpected API errors', async () => {
      mockResetPassword.mockRejectedValueOnce(
        new ApiError({
          type: 'about:blank',
          title: 'Server Error',
          status: 500,
          detail: 'Something broke',
        }),
      );
      const user = userEvent.setup();
      renderPage('my-token');

      await user.type(screen.getByLabelText('New password'), 'NewPass123');
      await user.type(screen.getByLabelText('Confirm password'), 'NewPass123');
      await user.click(screen.getByRole('button', { name: 'Reset password' }));

      await waitFor(() => {
        expect(screen.getByText('Something broke')).toBeInTheDocument();
      });
    });

    it('shows generic error for non-API errors', async () => {
      mockResetPassword.mockRejectedValueOnce(new Error('Network error'));
      const user = userEvent.setup();
      renderPage('my-token');

      await user.type(screen.getByLabelText('New password'), 'NewPass123');
      await user.type(screen.getByLabelText('Confirm password'), 'NewPass123');
      await user.click(screen.getByRole('button', { name: 'Reset password' }));

      await waitFor(() => {
        expect(
          screen.getByText('An unexpected error occurred. Please try again.'),
        ).toBeInTheDocument();
      });
    });
  });

  describe('schema validation', () => {
    it('rejects password under 8 chars', () => {
      const result = resetPasswordSchema.safeParse({
        newPassword: 'Ab1',
        confirmPassword: 'Ab1',
      });
      expect(result.success).toBe(false);
    });

    it('rejects password without digit', () => {
      const result = resetPasswordSchema.safeParse({
        newPassword: 'Abcdefgh',
        confirmPassword: 'Abcdefgh',
      });
      expect(result.success).toBe(false);
    });

    it('rejects password without uppercase', () => {
      const result = resetPasswordSchema.safeParse({
        newPassword: 'abcdefg1',
        confirmPassword: 'abcdefg1',
      });
      expect(result.success).toBe(false);
    });

    it('rejects password without lowercase', () => {
      const result = resetPasswordSchema.safeParse({
        newPassword: 'ABCDEFG1',
        confirmPassword: 'ABCDEFG1',
      });
      expect(result.success).toBe(false);
    });

    it('rejects mismatched passwords', () => {
      const result = resetPasswordSchema.safeParse({
        newPassword: 'ValidPass1',
        confirmPassword: 'DifferentPass1',
      });
      expect(result.success).toBe(false);
    });

    it('accepts valid matching passwords', () => {
      const result = resetPasswordSchema.safeParse({
        newPassword: 'ValidPass1',
        confirmPassword: 'ValidPass1',
      });
      expect(result.success).toBe(true);
    });
  });
});
