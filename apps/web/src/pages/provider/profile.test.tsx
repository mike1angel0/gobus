import { screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ProviderProfilePage from './profile';
import { renderWithProviders } from '@/test/helpers';

/* ---------- Mocks ---------- */

const mockUseProviderProfile = vi.fn();

vi.mock('@/hooks/use-provider-profile', () => ({
  useProviderProfile: () => mockUseProviderProfile(),
}));

/* ---------- Helpers ---------- */

const APPROVED_PROVIDER = {
  id: 'prov_1',
  name: 'Fast Bus Co',
  logo: 'https://example.com/logo.png',
  contactEmail: 'contact@fastbus.com',
  contactPhone: '+40700123456',
  status: 'APPROVED',
  createdAt: '2024-06-15T10:00:00Z',
  updatedAt: '2024-09-01T12:00:00Z',
};

const PENDING_PROVIDER = {
  ...APPROVED_PROVIDER,
  id: 'prov_2',
  name: 'New Transit',
  status: 'PENDING',
  logo: null,
  contactEmail: null,
  contactPhone: null,
};

function loadedState(provider: Record<string, unknown>) {
  return {
    data: { data: provider },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  };
}

function loadingState() {
  return {
    data: undefined,
    isLoading: true,
    isError: false,
    refetch: vi.fn(),
  };
}

function errorState() {
  return {
    data: undefined,
    isLoading: false,
    isError: true,
    refetch: vi.fn(),
  };
}

/* ---------- Tests ---------- */

describe('ProviderProfilePage', () => {
  beforeEach(() => {
    mockUseProviderProfile.mockReset();
  });

  it('renders loading skeleton while data is fetching', () => {
    mockUseProviderProfile.mockReturnValue(loadingState());
    renderWithProviders(<ProviderProfilePage />);
    expect(screen.getByLabelText('Loading provider profile')).toHaveAttribute('aria-busy', 'true');
  });

  it('renders error state with retry button', async () => {
    const refetch = vi.fn();
    mockUseProviderProfile.mockReturnValue({ ...errorState(), refetch });
    renderWithProviders(<ProviderProfilePage />);

    expect(screen.getByText('Failed to load profile')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('renders approved provider profile', () => {
    mockUseProviderProfile.mockReturnValue(loadedState(APPROVED_PROVIDER));
    renderWithProviders(<ProviderProfilePage />);

    expect(screen.getByText('Provider Profile')).toBeInTheDocument();
    expect(screen.getByText('Fast Bus Co')).toBeInTheDocument();
    expect(screen.getByText('contact@fastbus.com')).toBeInTheDocument();
    expect(screen.getByText('+40700123456')).toBeInTheDocument();
    expect(screen.getByText('APPROVED')).toBeInTheDocument();
  });

  it('renders provider logo when available', () => {
    mockUseProviderProfile.mockReturnValue(loadedState(APPROVED_PROVIDER));
    renderWithProviders(<ProviderProfilePage />);

    const logo = screen.getByAltText('Fast Bus Co logo');
    expect(logo).toHaveAttribute('src', 'https://example.com/logo.png');
  });

  it('renders placeholder icon when no logo', () => {
    mockUseProviderProfile.mockReturnValue(loadedState(PENDING_PROVIDER));
    renderWithProviders(<ProviderProfilePage />);

    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('shows pending status warning banner', () => {
    mockUseProviderProfile.mockReturnValue(loadedState(PENDING_PROVIDER));
    renderWithProviders(<ProviderProfilePage />);

    expect(screen.getByText('Your provider account is pending approval')).toBeInTheDocument();
    expect(screen.getByText('PENDING')).toBeInTheDocument();
  });

  it('does not show pending banner for approved provider', () => {
    mockUseProviderProfile.mockReturnValue(loadedState(APPROVED_PROVIDER));
    renderWithProviders(<ProviderProfilePage />);

    expect(screen.queryByText('Your provider account is pending approval')).not.toBeInTheDocument();
  });

  it('hides contact email when not provided', () => {
    mockUseProviderProfile.mockReturnValue(loadedState(PENDING_PROVIDER));
    renderWithProviders(<ProviderProfilePage />);

    expect(screen.queryByText('contact@fastbus.com')).not.toBeInTheDocument();
  });

  it('hides contact phone when not provided', () => {
    mockUseProviderProfile.mockReturnValue(loadedState(PENDING_PROVIDER));
    renderWithProviders(<ProviderProfilePage />);

    expect(screen.queryByText('+40700123456')).not.toBeInTheDocument();
  });

  it('shows registration date', () => {
    mockUseProviderProfile.mockReturnValue(loadedState(APPROVED_PROVIDER));
    renderWithProviders(<ProviderProfilePage />);

    expect(screen.getByText('Registered')).toBeInTheDocument();
    expect(screen.getByText(/2024/)).toBeInTheDocument();
  });

  it('calls refetch when retry button is clicked', async () => {
    const { default: userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();
    const refetch = vi.fn();
    mockUseProviderProfile.mockReturnValue({ ...errorState(), refetch });
    renderWithProviders(<ProviderProfilePage />);

    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });
});
