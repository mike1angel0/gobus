import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach } from 'vitest';
import i18n from '@/i18n/config';
import HelpPage from './help';
import { renderWithProviders } from '@/test/helpers';

beforeEach(async () => {
  await i18n.changeLanguage('en');
});

describe('HelpPage', () => {
  it('renders the page heading and description', () => {
    renderWithProviders(<HelpPage />);

    expect(screen.getByText('Frequently Asked Questions')).toBeInTheDocument();
    expect(
      screen.getByText('Find answers to common questions about GoBus.'),
    ).toBeInTheDocument();
  });

  it('renders all FAQ category headings', () => {
    renderWithProviders(<HelpPage />);

    expect(screen.getByText('Booking & Tickets')).toBeInTheDocument();
    expect(screen.getByText('Traveling')).toBeInTheDocument();
    expect(screen.getByText('Account & Support')).toBeInTheDocument();
  });

  it('renders FAQ questions as accordion triggers', () => {
    renderWithProviders(<HelpPage />);

    expect(screen.getByText('How do I book a trip?')).toBeInTheDocument();
    expect(screen.getByText('Can I cancel a booking?')).toBeInTheDocument();
    expect(screen.getByText('How do I pay?')).toBeInTheDocument();
    expect(screen.getByText('How early should I arrive at the station?')).toBeInTheDocument();
    expect(screen.getByText('Can I track my bus in real time?')).toBeInTheDocument();
    expect(screen.getByText('How do I create an account?')).toBeInTheDocument();
  });

  it('expands accordion item on click to show answer', async () => {
    const user = userEvent.setup();
    renderWithProviders(<HelpPage />);

    const trigger = screen.getByText('How do I book a trip?');
    await user.click(trigger);

    expect(
      screen.getByText(/Search for your route on the Search page/),
    ).toBeInTheDocument();
  });

  it('collapses accordion item on second click', async () => {
    const user = userEvent.setup();
    renderWithProviders(<HelpPage />);

    const trigger = screen.getByText('How do I book a trip?');
    await user.click(trigger);

    expect(
      screen.getByText(/Search for your route on the Search page/),
    ).toBeInTheDocument();

    await user.click(trigger);

    // Radix hides content when collapsed
    expect(
      screen.queryByText(/Search for your route on the Search page/),
    ).not.toBeInTheDocument();
  });

  it('renders the contact section with email link', () => {
    renderWithProviders(<HelpPage />);

    expect(screen.getByText('Still need help?')).toBeInTheDocument();
    expect(screen.getByText('Our support team is here for you.')).toBeInTheDocument();

    const emailLink = screen.getByRole('link', { name: 'support@gobus.ro' });
    expect(emailLink).toHaveAttribute('href', 'mailto:support@gobus.ro');
  });
});
