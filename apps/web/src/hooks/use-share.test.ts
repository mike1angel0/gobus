import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { useShareTrip } from './use-share';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en' },
  }),
}));

const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  toast: (...args: unknown[]) => mockToast(...args),
}));

describe('useShareTrip', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockToast.mockClear();
    Object.defineProperty(window, 'location', {
      value: { origin: 'https://gobus.ro' },
      writable: true,
    });
  });

  it('constructs the correct URL', async () => {
    const shareSpy = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'share', { value: shareSpy, configurable: true });

    const { result } = renderHook(() => useShareTrip());

    await act(() =>
      result.current.share({
        routeName: 'Cluj → Bucharest',
        scheduleId: 'sched_abc',
        tripDate: '2026-04-05',
      }),
    );

    expect(shareSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining('https://gobus.ro/trip/sched_abc?date=2026-04-05'),
      }),
    );

    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
  });

  it('calls navigator.share when available', async () => {
    const shareSpy = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'share', { value: shareSpy, configurable: true });

    const { result } = renderHook(() => useShareTrip());

    await act(() =>
      result.current.share({
        routeName: 'Cluj → Bucharest',
        scheduleId: 'sched_1',
        tripDate: '2026-04-05',
        departureTime: '14:30',
        arrivalTime: '18:45',
        providerName: 'TransBus',
      }),
    );

    expect(shareSpy).toHaveBeenCalledTimes(1);
    const text = shareSpy.mock.calls[0][0].text as string;
    expect(text).toContain('Cluj → Bucharest');
    expect(text).toContain('2026-04-05');
    expect(text).toContain('14:30 - 18:45');
    expect(text).toContain('TransBus');

    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
  });

  it('falls back to clipboard when navigator.share is undefined', async () => {
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
    const writeTextSpy = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextSpy },
      configurable: true,
    });

    const { result } = renderHook(() => useShareTrip());

    await act(() =>
      result.current.share({
        routeName: 'Cluj → Bucharest',
        scheduleId: 'sched_1',
        tripDate: '2026-04-05',
      }),
    );

    expect(writeTextSpy).toHaveBeenCalledTimes(1);
    expect(writeTextSpy.mock.calls[0][0]).toContain('Cluj → Bucharest');
  });

  it('shows toast after clipboard copy', async () => {
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      configurable: true,
    });

    const { result } = renderHook(() => useShareTrip());

    await act(() =>
      result.current.share({
        routeName: 'Cluj → Bucharest',
        scheduleId: 'sched_1',
        tripDate: '2026-04-05',
      }),
    );

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'share.copied',
        description: 'share.copiedDescription',
      }),
    );
  });

  it('ignores AbortError from share sheet dismissal', async () => {
    const abortError = new DOMException('Share canceled', 'AbortError');
    const shareSpy = vi.fn().mockRejectedValue(abortError);
    Object.defineProperty(navigator, 'share', { value: shareSpy, configurable: true });

    const { result } = renderHook(() => useShareTrip());

    await expect(
      act(() =>
        result.current.share({
          routeName: 'Cluj → Bucharest',
          scheduleId: 'sched_1',
          tripDate: '2026-04-05',
        }),
      ),
    ).resolves.toBeUndefined();

    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
  });

  it('omits times and provider lines when not provided', async () => {
    const shareSpy = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'share', { value: shareSpy, configurable: true });

    const { result } = renderHook(() => useShareTrip());

    await act(() =>
      result.current.share({
        routeName: 'Cluj → Bucharest',
        scheduleId: 'sched_1',
        tripDate: '2026-04-05',
      }),
    );

    const text = shareSpy.mock.calls[0][0].text as string;
    expect(text).not.toContain(' - ');
    expect(text).not.toContain('TransBus');

    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
  });
});
