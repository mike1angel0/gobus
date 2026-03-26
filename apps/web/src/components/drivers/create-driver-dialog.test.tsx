import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CreateDriverDialog } from './create-driver-dialog';
import { ApiError } from '@/api/errors';

/* ---------- Mocks ---------- */

const mockMutate = vi.fn();
const mockCreateDriver = vi.fn();

vi.mock('@/hooks/use-drivers', () => ({
  useCreateDriver: () => mockCreateDriver(),
}));

vi.mock('@/api/errors', async () => {
  const actual = await vi.importActual<typeof import('@/api/errors')>('@/api/errors');
  return actual;
});

/* ---------- Helpers ---------- */

/** Renders the dialog in an open state by clicking the trigger. */
async function renderOpenDialog() {
  const user = userEvent.setup();
  render(
    <CreateDriverDialog>
      <button>Add Driver</button>
    </CreateDriverDialog>,
  );
  await user.click(screen.getByRole('button', { name: 'Add Driver' }));
  return user;
}

/** Fills the form with valid data. */
async function fillValidForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Name'), 'John Smith');
  await user.type(screen.getByLabelText('Email'), 'john@example.com');
  await user.type(screen.getByLabelText('Password'), 'SecurePass1');
}

/* ---------- Tests ---------- */

describe('CreateDriverDialog', () => {
  beforeEach(() => {
    mockMutate.mockReset();
    mockCreateDriver.mockReset();
    mockCreateDriver.mockReturnValue({ mutate: mockMutate, isPending: false });
  });

  it('opens dialog when trigger is clicked', async () => {
    const user = userEvent.setup();
    render(
      <CreateDriverDialog>
        <button>Add Driver</button>
      </CreateDriverDialog>,
    );

    await user.click(screen.getByRole('button', { name: 'Add Driver' }));

    expect(screen.getByRole('heading', { name: 'Create driver' })).toBeInTheDocument();
  });

  describe('validation', () => {
    it('shows error when name is empty', async () => {
      const user = await renderOpenDialog();
      await user.type(screen.getByLabelText('Email'), 'test@test.com');
      await user.type(screen.getByLabelText('Password'), 'SecurePass1');
      await user.click(screen.getByRole('button', { name: 'Create driver' }));

      expect(screen.getByText('Name is required.')).toBeInTheDocument();
      expect(mockMutate).not.toHaveBeenCalled();
    });


    it('shows error when email is empty', async () => {
      const user = await renderOpenDialog();
      await user.type(screen.getByLabelText('Name'), 'John');
      await user.type(screen.getByLabelText('Password'), 'SecurePass1');
      await user.click(screen.getByRole('button', { name: 'Create driver' }));

      expect(screen.getByText('Email is required.')).toBeInTheDocument();
    });

    it('shows error when email is invalid', async () => {
      const user = await renderOpenDialog();
      await user.type(screen.getByLabelText('Name'), 'John');
      await user.type(screen.getByLabelText('Email'), 'notanemail');
      await user.type(screen.getByLabelText('Password'), 'SecurePass1');
      await user.click(screen.getByRole('button', { name: 'Create driver' }));

      expect(screen.getByText('Please enter a valid email address.')).toBeInTheDocument();
    });

    it('shows error when password is empty', async () => {
      const user = await renderOpenDialog();
      await user.type(screen.getByLabelText('Name'), 'John');
      await user.type(screen.getByLabelText('Email'), 'test@test.com');
      await user.click(screen.getByRole('button', { name: 'Create driver' }));

      expect(screen.getByText('Password is required.')).toBeInTheDocument();
    });

    it('shows error when password is too short', async () => {
      const user = await renderOpenDialog();
      await user.type(screen.getByLabelText('Name'), 'John');
      await user.type(screen.getByLabelText('Email'), 'test@test.com');
      await user.type(screen.getByLabelText('Password'), 'Short1');
      await user.click(screen.getByRole('button', { name: 'Create driver' }));

      expect(
        screen.getByText('Password must be at least 8 characters.'),
      ).toBeInTheDocument();
    });

    it('shows error when password lacks required characters', async () => {
      const user = await renderOpenDialog();
      await user.type(screen.getByLabelText('Name'), 'John');
      await user.type(screen.getByLabelText('Email'), 'test@test.com');
      await user.type(screen.getByLabelText('Password'), 'alllowercase');
      await user.click(screen.getByRole('button', { name: 'Create driver' }));

      expect(
        screen.getByText(
          'Password must contain at least 1 uppercase, 1 lowercase, and 1 digit.',
        ),
      ).toBeInTheDocument();
    });

    it('shows error when phone exceeds max length', async () => {
      const user = await renderOpenDialog();
      await fillValidForm(user);
      await user.type(screen.getByLabelText(/Phone/), '1'.repeat(21));
      await user.click(screen.getByRole('button', { name: 'Create driver' }));

      expect(
        screen.getByText('Phone must be at most 20 characters.'),
      ).toBeInTheDocument();
    });
  });

  describe('submission', () => {
    it('calls mutate with valid form data', async () => {
      const user = await renderOpenDialog();
      await fillValidForm(user);
      await user.click(screen.getByRole('button', { name: 'Create driver' }));

      expect(mockMutate).toHaveBeenCalledWith(
        { name: 'John Smith', email: 'john@example.com', password: 'SecurePass1' },
        expect.objectContaining({ onSuccess: expect.any(Function), onError: expect.any(Function) }),
      );
    });

    it('includes phone when provided', async () => {
      const user = await renderOpenDialog();
      await fillValidForm(user);
      await user.type(screen.getByLabelText(/Phone/), '+40712345678');
      await user.click(screen.getByRole('button', { name: 'Create driver' }));

      expect(mockMutate).toHaveBeenCalledWith(
        expect.objectContaining({ phone: '+40712345678' }),
        expect.any(Object),
      );
    });

    it('shows pending state while creating', async () => {
      mockCreateDriver.mockReturnValue({ mutate: mockMutate, isPending: true });
      await renderOpenDialog();

      expect(screen.getByRole('button', { name: 'Creating...' })).toBeDisabled();
    });

    it('handles 409 conflict error with field message', async () => {
      mockMutate.mockImplementation((_data: unknown, options: { onError: (e: unknown) => void }) => {
        options.onError(
          new ApiError({
            type: 'about:blank',
            title: 'Conflict',
            status: 409,
            code: 'DUPLICATE_EMAIL',
          }),
        );
      });

      const user = await renderOpenDialog();
      await fillValidForm(user);
      await user.click(screen.getByRole('button', { name: 'Create driver' }));

      await waitFor(() => {
        expect(
          screen.getByText('A user with this email address already exists.'),
        ).toBeInTheDocument();
      });
    });

    it('handles API field errors', async () => {
      mockMutate.mockImplementation((_data: unknown, options: { onError: (e: unknown) => void }) => {
        const err = new ApiError({
          type: 'about:blank',
          title: 'Validation Error',
          status: 400,
          errors: [{ field: 'email', message: 'Email domain is blocked' }],
        });
        options.onError(err);
      });

      const user = await renderOpenDialog();
      await fillValidForm(user);
      await user.click(screen.getByRole('button', { name: 'Create driver' }));

      await waitFor(() => {
        expect(screen.getByText('Email domain is blocked')).toBeInTheDocument();
      });
    });

    it('ignores non-API errors in onError handler', async () => {
      mockMutate.mockImplementation((_data: unknown, options: { onError: (e: unknown) => void }) => {
        options.onError(new Error('Network failure'));
      });

      const user = await renderOpenDialog();
      await fillValidForm(user);
      await user.click(screen.getByRole('button', { name: 'Create driver' }));

      // Should not crash, no field errors shown
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('links error messages to fields via aria-describedby', async () => {
      const user = await renderOpenDialog();
      await user.click(screen.getByRole('button', { name: 'Create driver' }));

      expect(screen.getByLabelText('Name')).toHaveAttribute('aria-invalid', 'true');
      expect(screen.getByLabelText('Name')).toHaveAttribute(
        'aria-describedby',
        'driver-name-error',
      );
    });

    it('has dialog description', async () => {
      await renderOpenDialog();
      expect(
        screen.getByText('Add a new driver account. The driver will use these credentials to log in.'),
      ).toBeInTheDocument();
    });
  });
});
