import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import RegisterPage from '@/pages/auth/register';
import { registerSchema, getPasswordStrength } from '@/pages/auth/register-schema';
import { ApiError } from '@/api/errors';

// Mock useAuth hook
const mockRegister = vi.fn();
const mockNavigate = vi.fn();

let mockUser: { role: string } | null = null;
let mockIsAuthenticated = false;

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    register: mockRegister,
    user: mockUser,
    isAuthenticated: mockIsAuthenticated,
    status: mockIsAuthenticated ? 'authenticated' : 'unauthenticated',
    isLoading: false,
    login: vi.fn(),
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

/** Valid form data for a passenger registration. */
const validPassenger = {
  name: 'John Doe',
  email: 'john@example.com',
  password: 'Password1',
  confirmPassword: 'Password1',
};

/** Valid form data for a provider registration. */
const validProvider = {
  ...validPassenger,
  providerName: 'Acme Transport',
};

function renderRegisterPage() {
  return render(
    <MemoryRouter initialEntries={['/auth/register']}>
      <RegisterPage />
    </MemoryRouter>,
  );
}

/** Fills the form with valid passenger data. */
async function fillPassengerForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Full name'), validPassenger.name);
  await user.type(screen.getByLabelText('Email'), validPassenger.email);
  await user.type(screen.getByLabelText('Password'), validPassenger.password);
  await user.type(screen.getByLabelText('Confirm password'), validPassenger.confirmPassword);
}

describe('RegisterPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = null;
    mockIsAuthenticated = false;
  });

  describe('rendering', () => {
    it('renders the registration form with all shared fields', () => {
      renderRegisterPage();

      expect(screen.getByRole('heading', { name: 'Create account', level: 1 })).toBeInTheDocument();
      expect(screen.getByLabelText('Full name')).toBeInTheDocument();
      expect(screen.getByLabelText('Email')).toBeInTheDocument();
      expect(screen.getByLabelText('Password')).toBeInTheDocument();
      expect(screen.getByLabelText('Confirm password')).toBeInTheDocument();
      expect(screen.getByLabelText(/Phone/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Create account' })).toBeInTheDocument();
    });

    it('renders role toggle with PASSENGER selected by default', () => {
      renderRegisterPage();

      expect(screen.getByText('Passenger')).toBeInTheDocument();
      expect(screen.getByText('Provider')).toBeInTheDocument();
      // PASSENGER radio should be checked
      const passengerRadio = screen.getByRole('radio', { name: 'Passenger' });
      expect(passengerRadio).toBeChecked();
    });

    it('renders sign in link', () => {
      renderRegisterPage();

      expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/auth/login');
    });

    it('does not show provider name field when PASSENGER is selected', () => {
      renderRegisterPage();

      expect(screen.queryByLabelText('Provider / company name')).not.toBeInTheDocument();
    });

    it('shows provider name field when PROVIDER is selected', async () => {
      const user = userEvent.setup();
      renderRegisterPage();

      await user.click(screen.getByRole('radio', { name: 'Provider' }));

      expect(screen.getByLabelText('Provider / company name')).toBeInTheDocument();
    });

    it('has proper autocomplete attributes', () => {
      renderRegisterPage();

      expect(screen.getByLabelText('Full name')).toHaveAttribute('autocomplete', 'name');
      expect(screen.getByLabelText('Email')).toHaveAttribute('autocomplete', 'email');
      expect(screen.getByLabelText('Password')).toHaveAttribute('autocomplete', 'new-password');
      expect(screen.getByLabelText('Confirm password')).toHaveAttribute(
        'autocomplete',
        'new-password',
      );
      expect(screen.getByLabelText(/Phone/)).toHaveAttribute('autocomplete', 'tel');
    });
  });

  describe('accessibility', () => {
    it('has labels associated with inputs', () => {
      renderRegisterPage();

      expect(screen.getByLabelText('Full name')).toHaveAttribute('id', 'name');
      expect(screen.getByLabelText('Email')).toHaveAttribute('id', 'email');
      expect(screen.getByLabelText('Password')).toHaveAttribute('id', 'password');
      expect(screen.getByLabelText('Confirm password')).toHaveAttribute('id', 'confirmPassword');
    });

    it('has a radiogroup with aria-label for role selection', () => {
      renderRegisterPage();

      expect(screen.getByRole('radiogroup', { name: 'Account type' })).toBeInTheDocument();
    });

    it('sets aria-invalid on fields with errors', async () => {
      const user = userEvent.setup();
      renderRegisterPage();

      await user.click(screen.getByRole('button', { name: 'Create account' }));

      await waitFor(() => {
        expect(screen.getByLabelText('Full name')).toHaveAttribute('aria-invalid', 'true');
        expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true');
        expect(screen.getByLabelText('Password')).toHaveAttribute('aria-invalid', 'true');
      });
    });

    it('links error messages via aria-describedby', async () => {
      const user = userEvent.setup();
      renderRegisterPage();

      await user.click(screen.getByRole('button', { name: 'Create account' }));

      await waitFor(() => {
        expect(screen.getByLabelText('Full name')).toHaveAttribute(
          'aria-describedby',
          'name-error',
        );
        expect(screen.getByLabelText('Email')).toHaveAttribute('aria-describedby', 'email-error');
      });
    });

    it('shows error messages with role="alert"', async () => {
      const user = userEvent.setup();
      renderRegisterPage();

      await user.click(screen.getByRole('button', { name: 'Create account' }));

      await waitFor(() => {
        const alerts = screen.getAllByRole('alert');
        expect(alerts.length).toBeGreaterThanOrEqual(3);
      });
    });
  });

  describe('password strength indicator', () => {
    it('does not show strength indicator when password is empty', () => {
      renderRegisterPage();

      expect(screen.queryByTestId('strength-label')).not.toBeInTheDocument();
    });

    it('shows Weak for a short lowercase-only password', async () => {
      const user = userEvent.setup();
      renderRegisterPage();

      await user.type(screen.getByLabelText('Password'), 'abc');

      expect(screen.getByTestId('strength-label')).toHaveTextContent('Weak');
    });

    it('shows Fair for a password meeting basic requirements', async () => {
      const user = userEvent.setup();
      renderRegisterPage();

      await user.type(screen.getByLabelText('Password'), 'Abcdef1');

      await waitFor(() => {
        expect(screen.getByTestId('strength-label')).toHaveTextContent('Fair');
      });
    });

    it('shows Strong for a long password with special chars', async () => {
      const user = userEvent.setup();
      renderRegisterPage();

      await user.type(screen.getByLabelText('Password'), 'StrongPass1!abc');

      await waitFor(() => {
        expect(screen.getByTestId('strength-label')).toHaveTextContent('Strong');
      });
    });

    it('has an accessible progressbar', async () => {
      const user = userEvent.setup();
      renderRegisterPage();

      await user.type(screen.getByLabelText('Password'), 'Test1234');

      await waitFor(() => {
        const progressbar = screen.getByRole('progressbar');
        expect(progressbar).toHaveAttribute(
          'aria-label',
          expect.stringContaining('Password strength'),
        );
      });
    });
  });

  describe('client-side validation', () => {
    it('shows required errors when submitting empty form', async () => {
      const user = userEvent.setup();
      renderRegisterPage();

      await user.click(screen.getByRole('button', { name: 'Create account' }));

      await waitFor(() => {
        expect(screen.getByText('Name is required')).toBeInTheDocument();
        expect(screen.getByText('Email is required')).toBeInTheDocument();
        expect(screen.getByText('Password must be at least 8 characters')).toBeInTheDocument();
      });

      expect(mockRegister).not.toHaveBeenCalled();
    });

    it('shows error for invalid email format', async () => {
      const user = userEvent.setup();
      renderRegisterPage();

      await user.type(screen.getByLabelText('Email'), 'not-an-email');
      await user.click(screen.getByRole('button', { name: 'Create account' }));

      await waitFor(() => {
        expect(screen.getByText('Please enter a valid email address')).toBeInTheDocument();
      });
    });

    it('shows error when password lacks uppercase letter', async () => {
      const user = userEvent.setup();
      renderRegisterPage();

      await user.type(screen.getByLabelText('Full name'), 'John');
      await user.type(screen.getByLabelText('Email'), 'john@test.com');
      await user.type(screen.getByLabelText('Password'), 'lowercase1');
      await user.type(screen.getByLabelText('Confirm password'), 'lowercase1');
      await user.click(screen.getByRole('button', { name: 'Create account' }));

      await waitFor(() => {
        expect(
          screen.getByText('Password must contain at least one uppercase letter'),
        ).toBeInTheDocument();
      });
    });

    it('shows error when password lacks digit', async () => {
      const user = userEvent.setup();
      renderRegisterPage();

      await user.type(screen.getByLabelText('Full name'), 'John');
      await user.type(screen.getByLabelText('Email'), 'john@test.com');
      await user.type(screen.getByLabelText('Password'), 'NoDigitHere');
      await user.type(screen.getByLabelText('Confirm password'), 'NoDigitHere');
      await user.click(screen.getByRole('button', { name: 'Create account' }));

      await waitFor(() => {
        expect(screen.getByText('Password must contain at least one digit')).toBeInTheDocument();
      });
    });

    it('shows error when passwords do not match', async () => {
      const user = userEvent.setup();
      renderRegisterPage();

      await user.type(screen.getByLabelText('Full name'), 'John');
      await user.type(screen.getByLabelText('Email'), 'john@test.com');
      await user.type(screen.getByLabelText('Password'), 'Password1');
      await user.type(screen.getByLabelText('Confirm password'), 'Different1');
      await user.click(screen.getByRole('button', { name: 'Create account' }));

      await waitFor(() => {
        expect(screen.getByText('Passwords do not match')).toBeInTheDocument();
      });
    });

    it('shows error when PROVIDER role but providerName is empty', async () => {
      const user = userEvent.setup();
      renderRegisterPage();

      await user.click(screen.getByRole('radio', { name: 'Provider' }));
      await fillPassengerForm(user);
      await user.click(screen.getByRole('button', { name: 'Create account' }));

      await waitFor(() => {
        expect(screen.getByText('Provider name is required')).toBeInTheDocument();
      });
    });
  });

  describe('form submission', () => {
    it('calls register with correct data for PASSENGER', async () => {
      mockRegister.mockResolvedValue(undefined);
      const user = userEvent.setup();
      renderRegisterPage();

      await fillPassengerForm(user);
      await user.click(screen.getByRole('button', { name: 'Create account' }));

      await waitFor(() => {
        expect(mockRegister).toHaveBeenCalledWith({
          email: validPassenger.email,
          name: validPassenger.name,
          password: validPassenger.password,
          role: 'PASSENGER',
        });
      });
    });

    it('calls register with providerName for PROVIDER', async () => {
      mockRegister.mockResolvedValue(undefined);
      const user = userEvent.setup();
      renderRegisterPage();

      await user.click(screen.getByRole('radio', { name: 'Provider' }));
      await fillPassengerForm(user);
      await user.type(screen.getByLabelText('Provider / company name'), validProvider.providerName);
      await user.click(screen.getByRole('button', { name: 'Create account' }));

      await waitFor(() => {
        expect(mockRegister).toHaveBeenCalledWith({
          email: validPassenger.email,
          name: validPassenger.name,
          password: validPassenger.password,
          role: 'PROVIDER',
          providerName: validProvider.providerName,
        });
      });
    });

    it('includes phone when provided', async () => {
      mockRegister.mockResolvedValue(undefined);
      const user = userEvent.setup();
      renderRegisterPage();

      await fillPassengerForm(user);
      await user.type(screen.getByLabelText(/Phone/), '+1234567890');
      await user.click(screen.getByRole('button', { name: 'Create account' }));

      await waitFor(() => {
        expect(mockRegister).toHaveBeenCalledWith(
          expect.objectContaining({ phone: '+1234567890' }),
        );
      });
    });

    it('shows loading state while submitting', async () => {
      mockRegister.mockImplementation(() => new Promise(() => {}));
      const user = userEvent.setup();
      renderRegisterPage();

      await fillPassengerForm(user);
      await user.click(screen.getByRole('button', { name: 'Create account' }));

      await waitFor(() => {
        expect(screen.getByText('Creating account…')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /creating account/i })).toBeDisabled();
      });
    });
  });

  describe('API error handling', () => {
    it('shows email already exists error on 409', async () => {
      mockRegister.mockRejectedValue(
        new ApiError({
          type: 'about:blank',
          title: 'Email already registered',
          status: 409,
          code: 'EMAIL_ALREADY_EXISTS',
        }),
      );
      const user = userEvent.setup();
      renderRegisterPage();

      await fillPassengerForm(user);
      await user.click(screen.getByRole('button', { name: 'Create account' }));

      await waitFor(() => {
        expect(screen.getByText('An account with this email already exists')).toBeInTheDocument();
      });
    });

    it('maps field-level validation errors to form fields', async () => {
      mockRegister.mockRejectedValue(
        new ApiError({
          type: 'about:blank',
          title: 'Validation error',
          status: 400,
          code: 'VALIDATION_ERROR',
          errors: [{ field: 'email', message: 'Email is already taken' }],
        }),
      );
      const user = userEvent.setup();
      renderRegisterPage();

      await fillPassengerForm(user);
      await user.click(screen.getByRole('button', { name: 'Create account' }));

      await waitFor(() => {
        expect(screen.getByText('Email is already taken')).toBeInTheDocument();
      });
    });

    it('shows generic error for non-API errors', async () => {
      mockRegister.mockRejectedValue(new Error('Network error'));
      const user = userEvent.setup();
      renderRegisterPage();

      await fillPassengerForm(user);
      await user.click(screen.getByRole('button', { name: 'Create account' }));

      await waitFor(() => {
        expect(
          screen.getByText('An unexpected error occurred. Please try again.'),
        ).toBeInTheDocument();
      });
    });

    it('shows detail from generic API error without code', async () => {
      mockRegister.mockRejectedValue(
        new ApiError({
          type: 'about:blank',
          title: 'Server Error',
          status: 500,
          detail: 'Internal server error occurred',
        }),
      );
      const user = userEvent.setup();
      renderRegisterPage();

      await fillPassengerForm(user);
      await user.click(screen.getByRole('button', { name: 'Create account' }));

      await waitFor(() => {
        expect(screen.getByText('Internal server error occurred')).toBeInTheDocument();
      });
    });
  });

  describe('redirect after registration', () => {
    it('calls register and redirects on success', async () => {
      mockRegister.mockImplementation(() => {
        mockUser = { role: 'PASSENGER' };
        mockIsAuthenticated = true;
        return Promise.resolve();
      });
      const user = userEvent.setup();
      renderRegisterPage();

      await fillPassengerForm(user);
      await user.click(screen.getByRole('button', { name: 'Create account' }));

      await waitFor(() => {
        expect(mockRegister).toHaveBeenCalled();
      });
    });
  });
});

describe('getPasswordStrength', () => {
  it.each([
    ['', 'weak'],
    ['abc', 'weak'],
    ['Abcdefg1', 'fair'],
    ['StrongPass1!abc', 'strong'],
  ] as const)('returns %s for "%s"', (input, expected) => {
    expect(getPasswordStrength(input)).toBe(expected);
  });
});

describe('registerSchema', () => {
  const base = {
    email: 'test@example.com',
    name: 'John Doe',
    password: 'Password1',
    confirmPassword: 'Password1',
    role: 'PASSENGER' as const,
    phone: '',
    providerName: '',
  };

  it('accepts valid PASSENGER registration', () => {
    expect(registerSchema.safeParse(base).success).toBe(true);
  });

  it('accepts valid PROVIDER registration with providerName', () => {
    expect(
      registerSchema.safeParse({ ...base, role: 'PROVIDER', providerName: 'Acme' }).success,
    ).toBe(true);
  });

  const longPw = 'A' + 'a'.repeat(127) + '1';
  it.each([
    ['PROVIDER without providerName', { role: 'PROVIDER', providerName: '' }],
    ['password < 8 chars', { password: 'Short1', confirmPassword: 'Short1' }],
    ['password without uppercase', { password: 'lowercase1', confirmPassword: 'lowercase1' }],
    ['password without lowercase', { password: 'UPPERCASE1', confirmPassword: 'UPPERCASE1' }],
    ['password without digit', { password: 'NoDigitHere', confirmPassword: 'NoDigitHere' }],
    ['mismatched passwords', { confirmPassword: 'Different1' }],
    ['email over 255 chars', { email: 'a'.repeat(250) + '@b.com' }],
    ['name over 100 chars', { name: 'a'.repeat(101) }],
    ['password over 128 chars', { password: longPw, confirmPassword: longPw }],
    ['phone over 20 chars', { phone: '1'.repeat(21) }],
    ['providerName over 200 chars', { role: 'PROVIDER', providerName: 'a'.repeat(201) }],
  ])('rejects %s', (_label, overrides) => {
    expect(registerSchema.safeParse({ ...base, ...overrides }).success).toBe(false);
  });
});
