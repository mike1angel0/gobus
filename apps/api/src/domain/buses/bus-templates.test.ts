import { describe, it, expect } from 'vitest';
import { BUS_TEMPLATES, findTemplateById } from './bus-templates.js';

describe('bus-templates', () => {
  describe('BUS_TEMPLATES', () => {
    it('should contain exactly 7 templates', () => {
      expect(BUS_TEMPLATES).toHaveLength(7);
    });

    it('should have all required fields on every template', () => {
      for (const template of BUS_TEMPLATES) {
        expect(template.id).toEqual(expect.any(String));
        expect(template.name).toEqual(expect.any(String));
        expect(template.rows).toBeGreaterThanOrEqual(1);
        expect(template.columns).toBeGreaterThanOrEqual(1);
        expect(template.capacity).toBeGreaterThanOrEqual(1);
        expect(template.seats.length).toBeGreaterThan(0);
      }
    });

    it('should assign PREMIUM type to seats in premium rows', () => {
      const mercedes = BUS_TEMPLATES.find((t) => t.id === 'coach-mercedes-tourismo')!;
      // Rows 1 and 2 are premium
      const premiumSeats = mercedes.seats.filter((s) => s.row <= 2);
      // Seat (1,1) is accessible, rest should be premium
      const premiumOnly = premiumSeats.filter((s) => s.type === 'PREMIUM');
      const accessibleOnly = premiumSeats.filter((s) => s.type === 'DISABLED_ACCESSIBLE');
      expect(premiumOnly.length).toBe(7); // 2 rows * 4 cols - 1 accessible = 7
      expect(accessibleOnly.length).toBe(1);
    });

    it('should assign DISABLED_ACCESSIBLE type to accessible seats', () => {
      const sprinter = BUS_TEMPLATES.find((t) => t.id === 'minibus-mercedes-sprinter')!;
      const accessible = sprinter.seats.filter((s) => s.type === 'DISABLED_ACCESSIBLE');
      expect(accessible.length).toBe(1);
      expect(accessible[0].row).toBe(8);
      expect(accessible[0].column).toBe(1);
    });

    it('should assign BLOCKED type to blocked seats', () => {
      const setra = BUS_TEMPLATES.find((t) => t.id === 'coach-setra-s515')!;
      const blocked = setra.seats.filter((s) => s.type === 'BLOCKED');
      expect(blocked.length).toBe(1);
      expect(blocked[0].row).toBe(12);
      expect(blocked[0].column).toBe(3);
    });

    it('should assign STANDARD type to regular seats', () => {
      const ford = BUS_TEMPLATES.find((t) => t.id === 'microbus-ford-transit')!;
      // Ford Transit has no premium rows, 1 accessible seat, no blocked seats
      const standard = ford.seats.filter((s) => s.type === 'STANDARD');
      // 5 rows * 3 cols = 15 total, minus 1 accessible = 14 standard
      expect(standard.length).toBe(14);
    });

    it('should exclude BLOCKED seats from capacity count', () => {
      const setra = BUS_TEMPLATES.find((t) => t.id === 'coach-setra-s515')!;
      const totalSeats = setra.rows * setra.columns; // 12 * 4 = 48
      const blockedCount = setra.seats.filter((s) => s.type === 'BLOCKED').length;
      expect(setra.capacity).toBe(totalSeats - blockedCount);
    });

    it('should have all seats with price 0 by default', () => {
      for (const template of BUS_TEMPLATES) {
        for (const seat of template.seats) {
          expect(seat.price).toBe(0);
        }
      }
    });

    it('should generate correct labels (row + column letter)', () => {
      const ford = BUS_TEMPLATES.find((t) => t.id === 'microbus-ford-transit')!;
      const seat1A = ford.seats.find((s) => s.row === 1 && s.column === 1);
      const seat3C = ford.seats.find((s) => s.row === 3 && s.column === 3);
      expect(seat1A!.label).toBe('1A');
      expect(seat3C!.label).toBe('3C');
    });
  });

  describe('findTemplateById', () => {
    it('should return template when found', () => {
      const template = findTemplateById('coach-mercedes-tourismo');
      expect(template).toBeDefined();
      expect(template!.id).toBe('coach-mercedes-tourismo');
      expect(template!.name).toBe('Mercedes Tourismo 13x4');
    });

    it('should return undefined when template not found', () => {
      const template = findTemplateById('nonexistent');
      expect(template).toBeUndefined();
    });
  });
});
