import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { getDelaySeverity } from '@/lib/delay';
import { DelayBadge } from './delay-badge';

describe('getDelaySeverity', () => {
  it('returns on-time for 0 minutes', () => {
    expect(getDelaySeverity(0)).toBe('on-time');
  });

  it('returns on-time for negative minutes', () => {
    expect(getDelaySeverity(-5)).toBe('on-time');
  });

  it('returns minor for 1 minute', () => {
    expect(getDelaySeverity(1)).toBe('minor');
  });

  it('returns minor for exactly 15 minutes', () => {
    expect(getDelaySeverity(15)).toBe('minor');
  });

  it('returns major for 16 minutes', () => {
    expect(getDelaySeverity(16)).toBe('major');
  });

  it('returns major for large delays', () => {
    expect(getDelaySeverity(120)).toBe('major');
  });
});

describe('DelayBadge', () => {
  describe('on-time state', () => {
    it('shows "On Time" text for 0 delay', () => {
      render(<DelayBadge delayMinutes={0} />);
      const badge = screen.getByText('On Time');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveAttribute('aria-label', 'On Time');
    });

    it('applies green styling', () => {
      render(<DelayBadge delayMinutes={0} />);
      const badge = screen.getByText('On Time');
      expect(badge).toHaveClass('text-green-500');
      expect(badge).toHaveClass('bg-green-500/10');
    });
  });

  describe('minor delay state', () => {
    it('shows delay minutes for minor delay', () => {
      render(<DelayBadge delayMinutes={10} />);
      const badge = screen.getByText('+10min');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveAttribute('aria-label', 'Delayed 10min');
    });

    it('applies yellow styling', () => {
      render(<DelayBadge delayMinutes={10} />);
      const badge = screen.getByText('+10min');
      expect(badge).toHaveClass('text-yellow-500');
      expect(badge).toHaveClass('bg-yellow-500/10');
    });

    it('includes reason in aria-label when provided', () => {
      render(<DelayBadge delayMinutes={5} reason="Traffic" />);
      const badge = screen.getByText('+5min');
      expect(badge).toHaveAttribute('aria-label', 'Delayed 5min — Traffic');
    });
  });

  describe('major delay state', () => {
    it('shows delay minutes for major delay', () => {
      render(<DelayBadge delayMinutes={25} />);
      const badge = screen.getByText('+25min');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveAttribute('aria-label', 'Delayed 25min');
    });

    it('applies red styling', () => {
      render(<DelayBadge delayMinutes={25} />);
      const badge = screen.getByText('+25min');
      expect(badge).toHaveClass('text-red-500');
      expect(badge).toHaveClass('bg-red-500/10');
    });

    it('includes reason in aria-label when provided', () => {
      render(<DelayBadge delayMinutes={30} reason="Mechanical" />);
      const badge = screen.getByText('+30min');
      expect(badge).toHaveAttribute('aria-label', 'Delayed 30min — Mechanical');
    });
  });

  describe('size variants', () => {
    it('uses sm size by default', () => {
      render(<DelayBadge delayMinutes={0} />);
      const badge = screen.getByText('On Time');
      expect(badge).toHaveClass('text-xs');
      expect(badge).toHaveClass('px-2');
      expect(badge).toHaveClass('py-0.5');
    });

    it('applies md size classes', () => {
      render(<DelayBadge delayMinutes={10} size="md" />);
      const badge = screen.getByText('+10min');
      expect(badge).toHaveClass('text-sm');
      expect(badge).toHaveClass('px-2.5');
      expect(badge).toHaveClass('py-1');
    });
  });

  describe('accessibility', () => {
    it('has aria-label describing the on-time status', () => {
      render(<DelayBadge delayMinutes={0} />);
      expect(screen.getByLabelText('On Time')).toBeInTheDocument();
    });

    it('has aria-label describing delay without reason', () => {
      render(<DelayBadge delayMinutes={20} />);
      expect(screen.getByLabelText('Delayed 20min')).toBeInTheDocument();
    });

    it('has aria-label describing delay with reason', () => {
      render(<DelayBadge delayMinutes={20} reason="Weather" />);
      expect(screen.getByLabelText('Delayed 20min — Weather')).toBeInTheDocument();
    });
  });

  describe('custom className', () => {
    it('merges custom className', () => {
      render(<DelayBadge delayMinutes={0} className="mt-2" />);
      const badge = screen.getByText('On Time');
      expect(badge).toHaveClass('mt-2');
      expect(badge).toHaveClass('text-green-500');
    });
  });
});
