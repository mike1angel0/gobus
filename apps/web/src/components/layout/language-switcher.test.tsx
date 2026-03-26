import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, beforeEach } from 'vitest';
import i18n from '@/i18n/config';
import { renderWithProviders } from '@/test/helpers';
import { LanguageSwitcher } from './language-switcher';

describe('LanguageSwitcher', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('ro');
  });

  it('renders with current language label and flag', () => {
    renderWithProviders(<LanguageSwitcher />);
    const button = screen.getByTestId('language-switcher');
    expect(button).toBeInTheDocument();
    expect(button).toHaveTextContent('RO');
  });

  it('has accessible label describing the target language', () => {
    renderWithProviders(<LanguageSwitcher />);
    expect(screen.getByLabelText('Switch language to EN')).toBeInTheDocument();
  });

  it('switches language to EN on click', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LanguageSwitcher />);

    await user.click(screen.getByTestId('language-switcher'));

    expect(i18n.language).toBe('en');
    expect(screen.getByTestId('language-switcher')).toHaveTextContent('EN');
  });

  it('switches back to RO on second click', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LanguageSwitcher />);

    await user.click(screen.getByTestId('language-switcher'));
    expect(i18n.language).toBe('en');

    await user.click(screen.getByTestId('language-switcher'));
    expect(i18n.language).toBe('ro');
    expect(screen.getByTestId('language-switcher')).toHaveTextContent('RO');
  });

  it('persists language choice across re-renders', async () => {
    const user = userEvent.setup();
    const { unmount } = renderWithProviders(<LanguageSwitcher />);

    await user.click(screen.getByTestId('language-switcher'));
    expect(i18n.language).toBe('en');

    // Unmount and re-render — i18n retains the language
    unmount();
    renderWithProviders(<LanguageSwitcher />);
    expect(screen.getByTestId('language-switcher')).toHaveTextContent('EN');
  });

  it('updates aria-label after language switch', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LanguageSwitcher />);

    expect(screen.getByLabelText('Switch language to EN')).toBeInTheDocument();

    await user.click(screen.getByTestId('language-switcher'));

    expect(screen.getByLabelText('Switch language to RO')).toBeInTheDocument();
  });
});
