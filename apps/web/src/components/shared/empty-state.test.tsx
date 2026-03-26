import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { Calendar, Bus } from 'lucide-react';
import { renderWithProviders } from '@/test/helpers';
import { EmptyState } from './empty-state';

describe('EmptyState', () => {
  it('renders icon, title, and message', () => {
    renderWithProviders(
      <EmptyState icon={Calendar} title="No schedules yet" message="Create your first schedule." />,
    );
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('No schedules yet');
    expect(screen.getByText('Create your first schedule.')).toBeInTheDocument();
  });

  it('renders CTA link when action is provided', () => {
    renderWithProviders(
      <EmptyState
        icon={Bus}
        title="No buses"
        message="Add a bus."
        action={{ label: 'Add bus', href: '/fleet' }}
      />,
    );
    const link = screen.getByRole('link', { name: 'Add bus' });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/fleet');
  });

  it('does not render CTA when action is omitted', () => {
    renderWithProviders(<EmptyState icon={Calendar} title="No items" message="Nothing here." />);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('has accessible status role', () => {
    renderWithProviders(<EmptyState icon={Calendar} title="Empty" message="Nothing." />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('hides icon from assistive technology', () => {
    const { container } = renderWithProviders(
      <EmptyState icon={Calendar} title="Empty" message="Nothing." />,
    );
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
  });

  it('renders correct heading hierarchy', () => {
    renderWithProviders(
      <EmptyState icon={Bus} title="No buses yet" message="Add a bus to get started." />,
    );
    const heading = screen.getByRole('heading', { level: 2 });
    expect(heading).toHaveTextContent('No buses yet');
  });
});
