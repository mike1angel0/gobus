import { describe, it, expect } from 'vitest';

import {
  createMetricsState,
  percentile,
  buildSummary,
  SLOW_REQUEST_THRESHOLD_MS,
  type MetricsState,
} from './metrics.js';

describe('metrics helpers', () => {
  describe('createMetricsState', () => {
    it('returns zeroed counters', () => {
      const state = createMetricsState();
      expect(state.requestCount).toBe(0);
      expect(state.totalResponseTime).toBe(0);
      expect(state.errorCountByStatus.size).toBe(0);
      expect(state.responseTimes).toEqual([]);
    });
  });

  describe('percentile', () => {
    it('returns 0 for empty array', () => {
      expect(percentile([], 50)).toBe(0);
    });

    it('returns the only element for single-element array', () => {
      expect(percentile([42], 50)).toBe(42);
      expect(percentile([42], 99)).toBe(42);
    });

    it('calculates p50 correctly', () => {
      const sorted = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
      expect(percentile(sorted, 50)).toBe(50);
    });

    it('calculates p95 correctly', () => {
      const sorted = Array.from({ length: 100 }, (_, i) => i + 1);
      expect(percentile(sorted, 95)).toBe(95);
    });

    it('calculates p99 correctly', () => {
      const sorted = Array.from({ length: 100 }, (_, i) => i + 1);
      expect(percentile(sorted, 99)).toBe(99);
    });
  });

  describe('buildSummary', () => {
    it('returns zeroed summary for empty state', () => {
      const state = createMetricsState();
      const summary = buildSummary(state);
      expect(summary).toEqual({
        requestCount: 0,
        avgResponseTime: 0,
        p50: 0,
        p95: 0,
        p99: 0,
        errorCountByStatus: {},
      });
    });

    it('computes average response time', () => {
      const state: MetricsState = {
        requestCount: 4,
        totalResponseTime: 100,
        errorCountByStatus: new Map(),
        responseTimes: [10, 20, 30, 40],
      };
      const summary = buildSummary(state);
      expect(summary.requestCount).toBe(4);
      expect(summary.avgResponseTime).toBe(25);
    });

    it('includes error counts by status code', () => {
      const state: MetricsState = {
        requestCount: 10,
        totalResponseTime: 500,
        errorCountByStatus: new Map([
          [404, 3],
          [500, 1],
        ]),
        responseTimes: Array.from({ length: 10 }, (_, i) => (i + 1) * 10),
      };
      const summary = buildSummary(state);
      expect(summary.errorCountByStatus).toEqual({ '404': 3, '500': 1 });
    });

    it('computes percentiles from unsorted response times', () => {
      // buildSummary sorts internally, so unsorted input should work
      const state: MetricsState = {
        requestCount: 5,
        totalResponseTime: 150,
        errorCountByStatus: new Map(),
        responseTimes: [50, 10, 40, 20, 30],
      };
      const summary = buildSummary(state);
      expect(summary.p50).toBe(30);
    });
  });

  describe('SLOW_REQUEST_THRESHOLD_MS', () => {
    it('is 5000ms', () => {
      expect(SLOW_REQUEST_THRESHOLD_MS).toBe(5000);
    });
  });
});
