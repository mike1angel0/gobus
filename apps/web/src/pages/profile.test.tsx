import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ApiError } from '@/api/errors';
import ProfilePage from '@/pages/profile';

/* ---------- Mocks ---------- */

const mockUpdateProfile = vi.fn();
let mockUser: Record<string, unknown> | null = null;
let mockIsLoading = false;

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: mockUser,
    isAuthenticated: !!mockUser,
    status: mockIsLoading ? 'loading' : mockUser ? 'authenticated' : 'unauthenticated',
    isLoading: mockIsLoading,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    changePassword: vi.fn(),
    forgotPassword: vi.fn(),
    resetPassword: vi.fn(),
    updateProfile: mockUpdateProfile,
  }),
}));

vi.mock('@/hooks/use-toast', () => ({
  toast: vi.fn(),
}));

/* ---------- Helpers ---------- */

const DEFAULT_USER = {
  id: 'usr_123',
  email: 'john@example.com',
  name: 'John Doe',
  role: 'PASSENGER',
  phone: '+1234567890',
  avatarUrl: 'https://example.com/avatar.jpg',
  status: 'ACTIVE',
  createdAt: '2024-01-15T10:00:00Z',
  updatedAt: '2024-06-01T12:00:00Z',
  providerId: null,
  preferences: null,
};

function createQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  });
}

function renderProfile() {
  return render(
    <QueryClientProvider client={createQueryClient()}>
      <MemoryRouter initialEntries={['/profile']}>
        <ProfilePage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/* ---------- Tests ---------- */

describe('ProfilePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = { ...DEFAULT_USER };
    mockIsLoading = false;
  });

  it('renders loading skeleton when auth is loading', () => {
    mockIsLoading = true;
    mockUser = null;
    renderProfile();
    // Skeleton elements are present (animated pulse divs)
    const skeletons = document.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('renders user profile in read-only mode', () => {
    renderProfile();
    expect(screen.getByText('Profile')).toBeInTheDocument();
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('john@example.com')).toBeInTheDocument();
    expect(screen.getByText('+1234567890')).toBeInTheDocument();
    expect(screen.getByText('Passenger')).toBeInTheDocument();
    // Check avatar image
    const avatar = screen.getByAltText("John Doe's avatar");
    expect(avatar).toHaveAttribute('src', 'https://example.com/avatar.jpg');
    // Edit button present
    expect(screen.getByRole('button', { name: 'Edit profile' })).toBeInTheDocument();
  });

  it('renders placeholder avatar when no avatarUrl', () => {
    mockUser = { ...DEFAULT_USER, avatarUrl: null };
    renderProfile();
    expect(screen.queryByAltText("John Doe's avatar")).not.toBeInTheDocument();
  });

  it('hides phone when not provided', () => {
    mockUser = { ...DEFAULT_USER, phone: null };
    renderProfile();
    expect(screen.queryByText('+1234567890')).not.toBeInTheDocument();
  });

  it('shows member since date', () => {
    renderProfile();
    expect(screen.getByText('Member since')).toBeInTheDocument();
    // Date formatted (locale-dependent, just check presence)
    expect(screen.getByText(/2024/)).toBeInTheDocument();
  });

  it('enters edit mode when edit button is clicked', async () => {
    const user = userEvent.setup();
    renderProfile();
    await user.click(screen.getByRole('button', { name: 'Edit profile' }));
    // Form fields should appear
    expect(screen.getByLabelText('Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Phone')).toBeInTheDocument();
    expect(screen.getByLabelText('Avatar URL')).toBeInTheDocument();
    // Cancel button appears
    expect(screen.getByRole('button', { name: 'Cancel editing' })).toBeInTheDocument();
    // Save button appears
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeInTheDocument();
  });

  it('pre-fills form with current user data', async () => {
    const user = userEvent.setup();
    renderProfile();
    await user.click(screen.getByRole('button', { name: 'Edit profile' }));
    expect(screen.getByLabelText('Name')).toHaveValue('John Doe');
    expect(screen.getByLabelText('Phone')).toHaveValue('+1234567890');
    expect(screen.getByLabelText('Avatar URL')).toHaveValue('https://example.com/avatar.jpg');
  });

  it('cancels edit mode and returns to read-only', async () => {
    const user = userEvent.setup();
    renderProfile();
    await user.click(screen.getByRole('button', { name: 'Edit profile' }));
    expect(screen.getByLabelText('Name')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancel editing' }));
    // Back to read-only
    expect(screen.queryByLabelText('Name')).not.toBeInTheDocument();
    expect(screen.getByText('John Doe')).toBeInTheDocument();
  });

  it('validates required name field', async () => {
    const user = userEvent.setup();
    renderProfile();
    await user.click(screen.getByRole('button', { name: 'Edit profile' }));
    const nameInput = screen.getByLabelText('Name');
    await user.clear(nameInput);
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => {
      expect(screen.getByText('Name is required')).toBeInTheDocument();
    });
    expect(mockUpdateProfile).not.toHaveBeenCalled();
  });

  it('validates name max length', async () => {
    const user = userEvent.setup();
    renderProfile();
    await user.click(screen.getByRole('button', { name: 'Edit profile' }));
    const nameInput = screen.getByLabelText('Name');
    await user.clear(nameInput);
    await user.type(nameInput, 'A'.repeat(101));
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => {
      expect(screen.getByText('Name must be 100 characters or fewer')).toBeInTheDocument();
    });
  });

  it('validates avatar URL format', async () => {
    const user = userEvent.setup();
    renderProfile();
    await user.click(screen.getByRole('button', { name: 'Edit profile' }));
    const avatarInput = screen.getByLabelText('Avatar URL');
    await user.clear(avatarInput);
    await user.type(avatarInput, 'not-a-url');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => {
      expect(screen.getByText('Must be a valid URL')).toBeInTheDocument();
    });
  });

  it('submits form and calls updateProfile on success', async () => {
    mockUpdateProfile.mockResolvedValueOnce({ ...DEFAULT_USER, name: 'Jane Doe' });
    const user = userEvent.setup();
    renderProfile();
    await user.click(screen.getByRole('button', { name: 'Edit profile' }));
    const nameInput = screen.getByLabelText('Name');
    await user.clear(nameInput);
    await user.type(nameInput, 'Jane Doe');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => {
      expect(mockUpdateProfile).toHaveBeenCalledWith({
        name: 'Jane Doe',
        phone: '+1234567890',
        avatarUrl: 'https://example.com/avatar.jpg',
      });
    });
  });

  it('returns to read-only after successful update', async () => {
    mockUpdateProfile.mockResolvedValueOnce({ ...DEFAULT_USER, name: 'Jane Doe' });
    const user = userEvent.setup();
    renderProfile();
    await user.click(screen.getByRole('button', { name: 'Edit profile' }));
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => {
      expect(screen.queryByLabelText('Name')).not.toBeInTheDocument();
    });
  });

  it('shows root error on non-API error', async () => {
    mockUpdateProfile.mockRejectedValueOnce(new Error('Network error'));
    const user = userEvent.setup();
    renderProfile();
    await user.click(screen.getByRole('button', { name: 'Edit profile' }));
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => {
      expect(
        screen.getByText('An unexpected error occurred. Please try again.'),
      ).toBeInTheDocument();
    });
  });

  it('maps API field errors to form fields', async () => {
    const apiError = new ApiError({
      type: 'about:blank',
      title: 'Validation Error',
      status: 400,
      errors: [{ field: 'name', message: 'Name contains invalid characters' }],
    });
    mockUpdateProfile.mockRejectedValueOnce(apiError);
    const user = userEvent.setup();
    renderProfile();
    await user.click(screen.getByRole('button', { name: 'Edit profile' }));
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => {
      expect(screen.getByText('Name contains invalid characters')).toBeInTheDocument();
    });
  });

  it('shows generic API error when no field errors', async () => {
    const apiError = new ApiError({
      type: 'about:blank',
      title: 'Server Error',
      status: 500,
      detail: 'Something broke on the server',
    });
    mockUpdateProfile.mockRejectedValueOnce(apiError);
    const user = userEvent.setup();
    renderProfile();
    await user.click(screen.getByRole('button', { name: 'Edit profile' }));
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => {
      expect(screen.getByText('Something broke on the server')).toBeInTheDocument();
    });
  });

  it('has proper accessibility: aria-invalid on error fields', async () => {
    const user = userEvent.setup();
    renderProfile();
    await user.click(screen.getByRole('button', { name: 'Edit profile' }));
    const nameInput = screen.getByLabelText('Name');
    await user.clear(nameInput);
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => {
      expect(nameInput).toHaveAttribute('aria-invalid', 'true');
    });
  });

  it('sends empty optional fields as undefined', async () => {
    mockUser = { ...DEFAULT_USER, phone: null, avatarUrl: null };
    mockUpdateProfile.mockResolvedValueOnce({ ...DEFAULT_USER, phone: null, avatarUrl: null });
    const user = userEvent.setup();
    renderProfile();
    await user.click(screen.getByRole('button', { name: 'Edit profile' }));
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => {
      expect(mockUpdateProfile).toHaveBeenCalledWith({
        name: 'John Doe',
        phone: undefined,
        avatarUrl: undefined,
      });
    });
  });
});
