import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import ChangePasswordPage from '@/pages/auth/change-password';
import { changePasswordSchema } from '@/pages/auth/change-password-schema';
import { ApiError } from '@/api/errors';

const mockChangePassword = vi.fn();
const mockToast = vi.fn();

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    login: vi.fn(),
    user: { id: '1', email: 'test@example.com', name: 'Test', role: 'PASSENGER' },
    isAuthenticated: true,
    status: 'authenticated',
    isLoading: false,
    register: vi.fn(),
    logout: vi.fn(),
    changePassword: mockChangePassword,
    forgotPassword: vi.fn(),
    resetPassword: vi.fn(),
  }),
}));

vi.mock('@/hooks/use-toast', () => ({
  toast: (...args: unknown[]) => mockToast(...args),
}));

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/auth/change-password']}>
      <ChangePasswordPage />
    </MemoryRouter>,
  );
}

async function fillAndSubmit(
  user: ReturnType<typeof userEvent.setup>,
  { current = 'OldPass1234', newPass = 'NewPass1234', confirm = 'NewPass1234' } = {},
) {
  await user.type(screen.getByLabelText('Current password'), current);
  await user.type(screen.getByLabelText('New password'), newPass);
  await user.type(screen.getByLabelText('Confirm new password'), confirm);
  await user.click(screen.getByRole('button', { name: 'Change password' }));
}

describe('ChangePasswordPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders the change password form with all fields', () => {
      renderPage();

      expect(
        screen.getByRole('heading', { name: 'Change password', level: 1 }),
      ).toBeInTheDocument();
      expect(screen.getByText('Update your account password')).toBeInTheDocument();
      expect(screen.getByLabelText('Current password')).toBeInTheDocument();
      expect(screen.getByLabelText('New password')).toBeInTheDocument();
      expect(screen.getByLabelText('Confirm new password')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Change password' })).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('has labels associated with inputs', () => {
      renderPage();

      expect(screen.getByLabelText('Current password')).toHaveAttribute('id', 'currentPassword');
      expect(screen.getByLabelText('New password')).toHaveAttribute('id', 'newPassword');
      expect(screen.getByLabelText('Confirm new password')).toHaveAttribute(
        'id',
        'confirmPassword',
      );
    });

    it('has proper autocomplete attributes', () => {
      renderPage();

      expect(screen.getByLabelText('Current password')).toHaveAttribute(
        'autocomplete',
        'current-password',
      );
      expect(screen.getByLabelText('New password')).toHaveAttribute(
        'autocomplete',
        'new-password',
      );
      expect(screen.getByLabelText('Confirm new password')).toHaveAttribute(
        'autocomplete',
        'new-password',
      );
    });

    it('marks invalid fields with aria-invalid', async () => {
      const user = userEvent.setup();
      renderPage();

      await user.click(screen.getByRole('button', { name: 'Change password' }));

      await waitFor(() => {
        expect(screen.getByLabelText('Current password')).toHaveAttribute('aria-invalid', 'true');
      });
    });

    it('links error messages with aria-describedby', async () => {
      const user = userEvent.setup();
      renderPage();

      await user.click(screen.getByRole('button', { name: 'Change password' }));

      await waitFor(() => {
        expect(screen.getByLabelText('Current password')).toHaveAttribute(
          'aria-describedby',
          'currentPassword-error',
        );
        expect(screen.getByText('Current password is required')).toHaveAttribute(
          'id',
          'currentPassword-error',
        );
      });
    });
  });

  describe('client-side validation', () => {
    it('shows required error for empty current password', async () => {
      const user = userEvent.setup();
      renderPage();

      await user.click(screen.getByRole('button', { name: 'Change password' }));

      await waitFor(() => {
        expect(screen.getByText('Current password is required')).toBeInTheDocument();
      });
      expect(mockChangePassword).not.toHaveBeenCalled();
    });

    it('shows min length error for short new password', async () => {
      const user = userEvent.setup();
      renderPage();

      await user.type(screen.getByLabelText('Current password'), 'old');
      await user.type(screen.getByLabelText('New password'), 'Ab1');
      await user.type(screen.getByLabelText('Confirm new password'), 'Ab1');
      await user.click(screen.getByRole('button', { name: 'Change password' }));

      await waitFor(() => {
        expect(screen.getByText('Password must be at least 8 characters')).toBeInTheDocument();
      });
      expect(mockChangePassword).not.toHaveBeenCalled();
    });

    it('shows pattern error for weak new password', async () => {
      const user = userEvent.setup();
      renderPage();

      await user.type(screen.getByLabelText('Current password'), 'old');
      await user.type(screen.getByLabelText('New password'), 'alllowercase');
      await user.type(screen.getByLabelText('Confirm new password'), 'alllowercase');
      await user.click(screen.getByRole('button', { name: 'Change password' }));

      await waitFor(() => {
        expect(
          screen.getByText(
            'Password must contain at least one uppercase letter, one lowercase letter, and one digit',
          ),
        ).toBeInTheDocument();
      });
    });

    it('shows mismatch error when passwords do not match', async () => {
      const user = userEvent.setup();
      renderPage();

      await user.type(screen.getByLabelText('Current password'), 'old');
      await user.type(screen.getByLabelText('New password'), 'NewPass1234');
      await user.type(screen.getByLabelText('Confirm new password'), 'Different1234');
      await user.click(screen.getByRole('button', { name: 'Change password' }));

      await waitFor(() => {
        expect(screen.getByText('Passwords do not match')).toBeInTheDocument();
      });
    });
  });

  describe('password strength indicator', () => {
    it('shows strength indicator when typing new password', async () => {
      const user = userEvent.setup();
      renderPage();

      await user.type(screen.getByLabelText('New password'), 'ab');

      expect(screen.getByRole('progressbar')).toBeInTheDocument();
      expect(screen.getByText(/Strength:/)).toBeInTheDocument();
    });

    it('does not show strength indicator when new password is empty', () => {
      renderPage();

      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });

    it('shows strong for password meeting all criteria', async () => {
      const user = userEvent.setup();
      renderPage();

      await user.type(screen.getByLabelText('New password'), 'StrongPass123!');

      expect(screen.getByText('Strength: Strong')).toBeInTheDocument();
      expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
    });
  });

  describe('form submission', () => {
    it('calls changePassword with current and new password on success', async () => {
      mockChangePassword.mockResolvedValue(undefined);
      const user = userEvent.setup();
      renderPage();

      await fillAndSubmit(user);

      await waitFor(() => {
        expect(mockChangePassword).toHaveBeenCalledWith('OldPass1234', 'NewPass1234');
      });
    });

    it('shows success toast after password change', async () => {
      mockChangePassword.mockResolvedValue(undefined);
      const user = userEvent.setup();
      renderPage();

      await fillAndSubmit(user);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'Password changed',
          description: 'Your password has been updated successfully.',
        });
      });
    });

    it('resets form fields after successful change', async () => {
      mockChangePassword.mockResolvedValue(undefined);
      const user = userEvent.setup();
      renderPage();

      await fillAndSubmit(user);

      await waitFor(() => {
        expect(screen.getByLabelText('Current password')).toHaveValue('');
        expect(screen.getByLabelText('New password')).toHaveValue('');
        expect(screen.getByLabelText('Confirm new password')).toHaveValue('');
      });
    });
  });

  describe('API error handling', () => {
    it('shows field error for wrong current password (401)', async () => {
      mockChangePassword.mockRejectedValue(
        new ApiError({
          type: 'about:blank',
          title: 'Unauthorized',
          status: 401,
          code: 'INVALID_CREDENTIALS',
        }),
      );
      const user = userEvent.setup();
      renderPage();

      await fillAndSubmit(user);

      await waitFor(() => {
        expect(screen.getByText('Current password is incorrect')).toBeInTheDocument();
      });
    });

    it('shows field error for 401 without specific code', async () => {
      mockChangePassword.mockRejectedValue(
        new ApiError({
          type: 'about:blank',
          title: 'Unauthorized',
          status: 401,
        }),
      );
      const user = userEvent.setup();
      renderPage();

      await fillAndSubmit(user);

      await waitFor(() => {
        expect(screen.getByText('Current password is incorrect')).toBeInTheDocument();
      });
    });

    it('maps field-level errors from 400 response', async () => {
      mockChangePassword.mockRejectedValue(
        new ApiError({
          type: 'about:blank',
          title: 'Validation Error',
          status: 400,
          errors: [{ field: 'newPassword', message: 'Password too common' }],
        }),
      );
      const user = userEvent.setup();
      renderPage();

      await fillAndSubmit(user);

      await waitFor(() => {
        expect(screen.getByText('Password too common')).toBeInTheDocument();
      });
    });

    it('shows generic API error as root error', async () => {
      mockChangePassword.mockRejectedValue(
        new ApiError({
          type: 'about:blank',
          title: 'Internal Server Error',
          status: 500,
          detail: 'Something went wrong on the server',
        }),
      );
      const user = userEvent.setup();
      renderPage();

      await fillAndSubmit(user);

      await waitFor(() => {
        expect(screen.getByText('Something went wrong on the server')).toBeInTheDocument();
      });
    });

    it('shows fallback error for non-API errors', async () => {
      mockChangePassword.mockRejectedValue(new Error('Network error'));
      const user = userEvent.setup();
      renderPage();

      await fillAndSubmit(user);

      await waitFor(() => {
        expect(
          screen.getByText('An unexpected error occurred. Please try again.'),
        ).toBeInTheDocument();
      });
    });
  });

  describe('schema validation', () => {
    it('rejects empty currentPassword', () => {
      const result = changePasswordSchema.safeParse({
        currentPassword: '',
        newPassword: 'ValidPass1',
        confirmPassword: 'ValidPass1',
      });
      expect(result.success).toBe(false);
    });

    it('rejects currentPassword over 128 chars', () => {
      const result = changePasswordSchema.safeParse({
        currentPassword: 'a'.repeat(129),
        newPassword: 'ValidPass1',
        confirmPassword: 'ValidPass1',
      });
      expect(result.success).toBe(false);
    });

    it('rejects newPassword under 8 chars', () => {
      const result = changePasswordSchema.safeParse({
        currentPassword: 'current',
        newPassword: 'Ab1',
        confirmPassword: 'Ab1',
      });
      expect(result.success).toBe(false);
    });

    it('rejects newPassword without uppercase', () => {
      const result = changePasswordSchema.safeParse({
        currentPassword: 'current',
        newPassword: 'lowercase1',
        confirmPassword: 'lowercase1',
      });
      expect(result.success).toBe(false);
    });

    it('rejects mismatched confirmPassword', () => {
      const result = changePasswordSchema.safeParse({
        currentPassword: 'current',
        newPassword: 'ValidPass1',
        confirmPassword: 'Different1',
      });
      expect(result.success).toBe(false);
    });

    it('accepts valid input', () => {
      const result = changePasswordSchema.safeParse({
        currentPassword: 'current',
        newPassword: 'ValidPass1',
        confirmPassword: 'ValidPass1',
      });
      expect(result.success).toBe(true);
    });
  });
});
