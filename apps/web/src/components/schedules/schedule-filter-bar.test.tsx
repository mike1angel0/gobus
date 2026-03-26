import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { ScheduleFilterBar, type ScheduleFilterBarProps } from './schedule-filter-bar';

/** Returns default props for ScheduleFilterBar. */
function defaultProps(overrides: Partial<ScheduleFilterBarProps> = {}): ScheduleFilterBarProps {
  return {
    routeId: '',
    busId: '',
    status: '',
    fromDate: '',
    toDate: '',
    routes: [
      { id: 'r1', name: 'Route A' },
      { id: 'r2', name: 'Route B' },
    ],
    buses: [
      { id: 'b1', licensePlate: 'ABC-123' },
      { id: 'b2', licensePlate: 'XYZ-789' },
    ],
    onRouteChange: vi.fn(),
    onBusChange: vi.fn(),
    onStatusChange: vi.fn(),
    onFromDateChange: vi.fn(),
    onToDateChange: vi.fn(),
    ...overrides,
  };
}

describe('ScheduleFilterBar', () => {
  it('renders all filter labels', () => {
    render(<ScheduleFilterBar {...defaultProps()} />);
    expect(screen.getByLabelText('Route')).toBeInTheDocument();
    expect(screen.getByLabelText('Bus')).toBeInTheDocument();
    expect(screen.getByLabelText('Status')).toBeInTheDocument();
    expect(screen.getByLabelText('From')).toBeInTheDocument();
    expect(screen.getByLabelText('To')).toBeInTheDocument();
  });

  it('renders route options', () => {
    render(<ScheduleFilterBar {...defaultProps()} />);
    const routeSelect = screen.getByLabelText('Route');
    expect(routeSelect).toHaveDisplayValue('All routes');
    expect(screen.getByText('Route A')).toBeInTheDocument();
    expect(screen.getByText('Route B')).toBeInTheDocument();
  });

  it('renders bus options', () => {
    render(<ScheduleFilterBar {...defaultProps()} />);
    expect(screen.getByText('ABC-123')).toBeInTheDocument();
    expect(screen.getByText('XYZ-789')).toBeInTheDocument();
  });

  it('calls onRouteChange when route filter changes', async () => {
    const onRouteChange = vi.fn();
    render(<ScheduleFilterBar {...defaultProps({ onRouteChange })} />);
    await userEvent.selectOptions(screen.getByLabelText('Route'), 'r1');
    expect(onRouteChange).toHaveBeenCalledWith('r1');
  });

  it('calls onBusChange when bus filter changes', async () => {
    const onBusChange = vi.fn();
    render(<ScheduleFilterBar {...defaultProps({ onBusChange })} />);
    await userEvent.selectOptions(screen.getByLabelText('Bus'), 'b1');
    expect(onBusChange).toHaveBeenCalledWith('b1');
  });

  it('calls onStatusChange when status filter changes', async () => {
    const onStatusChange = vi.fn();
    render(<ScheduleFilterBar {...defaultProps({ onStatusChange })} />);
    await userEvent.selectOptions(screen.getByLabelText('Status'), 'ACTIVE');
    expect(onStatusChange).toHaveBeenCalledWith('ACTIVE');
  });

  it('calls onFromDateChange when from date changes', async () => {
    const onFromDateChange = vi.fn();
    render(<ScheduleFilterBar {...defaultProps({ onFromDateChange })} />);
    await userEvent.type(screen.getByLabelText('From'), '2025-01-01');
    expect(onFromDateChange).toHaveBeenCalled();
  });

  it('calls onToDateChange when to date changes', async () => {
    const onToDateChange = vi.fn();
    render(<ScheduleFilterBar {...defaultProps({ onToDateChange })} />);
    await userEvent.type(screen.getByLabelText('To'), '2025-12-31');
    expect(onToDateChange).toHaveBeenCalled();
  });

  it('has accessible search landmark', () => {
    render(<ScheduleFilterBar {...defaultProps()} />);
    expect(screen.getByRole('search', { name: 'Schedule filters' })).toBeInTheDocument();
  });

  it('reflects controlled filter values', () => {
    render(
      <ScheduleFilterBar
        {...defaultProps({ routeId: 'r2', busId: 'b2', status: 'CANCELLED', fromDate: '2025-03-01', toDate: '2025-03-31' })}
      />,
    );
    expect(screen.getByLabelText('Route')).toHaveValue('r2');
    expect(screen.getByLabelText('Bus')).toHaveValue('b2');
    expect(screen.getByLabelText('Status')).toHaveValue('CANCELLED');
    expect(screen.getByLabelText('From')).toHaveValue('2025-03-01');
    expect(screen.getByLabelText('To')).toHaveValue('2025-03-31');
  });
});
