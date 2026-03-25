import { describe, it, expect } from 'vitest';
import type { UserEntity, UserPreferences, UserUpdateData } from './user.entity.js';

describe('User entity types', () => {
  describe('UserEntity', () => {
    it('represents a complete user profile matching OpenAPI User schema', () => {
      const user: UserEntity = {
        id: 'cm1abc123',
        email: 'user@example.com',
        name: 'Test User',
        role: 'PASSENGER',
        phone: '+40712345678',
        avatarUrl: 'https://example.com/avatar.jpg',
        preferences: { language: 'ro', notifications: true, emailNotifications: false },
        providerId: null,
        status: 'ACTIVE',
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-01-02T00:00:00Z'),
      };
      expect(user.id).toBe('cm1abc123');
      expect(user.role).toBe('PASSENGER');
      expect(user.status).toBe('ACTIVE');
      expect(user.phone).toBe('+40712345678');
      expect(user.preferences?.language).toBe('ro');
    });

    it('allows nullable fields to be null', () => {
      const user: UserEntity = {
        id: 'cm1def456',
        email: 'minimal@example.com',
        name: 'Minimal User',
        role: 'ADMIN',
        phone: null,
        avatarUrl: null,
        preferences: null,
        providerId: null,
        status: 'ACTIVE',
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-01-01T00:00:00Z'),
      };
      expect(user.phone).toBeNull();
      expect(user.avatarUrl).toBeNull();
      expect(user.preferences).toBeNull();
      expect(user.providerId).toBeNull();
    });

    it('supports PROVIDER role with providerId', () => {
      const user: UserEntity = {
        id: 'cm1ghi789',
        email: 'provider@example.com',
        name: 'Provider Admin',
        role: 'PROVIDER',
        phone: null,
        avatarUrl: null,
        preferences: null,
        providerId: 'cm1prov001',
        status: 'ACTIVE',
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-01-01T00:00:00Z'),
      };
      expect(user.role).toBe('PROVIDER');
      expect(user.providerId).toBe('cm1prov001');
    });

    it('supports all status values', () => {
      const statuses: UserEntity['status'][] = ['ACTIVE', 'SUSPENDED', 'LOCKED'];
      expect(statuses).toEqual(['ACTIVE', 'SUSPENDED', 'LOCKED']);
    });

    it('supports all role values', () => {
      const roles: UserEntity['role'][] = ['PASSENGER', 'PROVIDER', 'DRIVER', 'ADMIN'];
      expect(roles).toEqual(['PASSENGER', 'PROVIDER', 'DRIVER', 'ADMIN']);
    });
  });

  describe('UserPreferences', () => {
    it('allows all fields to be optional', () => {
      const prefs: UserPreferences = {};
      expect(prefs.language).toBeUndefined();
      expect(prefs.notifications).toBeUndefined();
      expect(prefs.emailNotifications).toBeUndefined();
    });

    it('accepts all preference fields', () => {
      const prefs: UserPreferences = {
        language: 'en',
        notifications: true,
        emailNotifications: false,
      };
      expect(prefs.language).toBe('en');
      expect(prefs.notifications).toBe(true);
      expect(prefs.emailNotifications).toBe(false);
    });
  });

  describe('UserUpdateData', () => {
    it('allows all fields to be optional for partial updates', () => {
      const update: UserUpdateData = {};
      expect(update.name).toBeUndefined();
    });

    it('accepts individual field updates', () => {
      const nameOnly: UserUpdateData = { name: 'New Name' };
      expect(nameOnly.name).toBe('New Name');

      const phoneOnly: UserUpdateData = { phone: '+40712345678' };
      expect(phoneOnly.phone).toBe('+40712345678');

      const avatarOnly: UserUpdateData = { avatarUrl: 'https://example.com/new.jpg' };
      expect(avatarOnly.avatarUrl).toBe('https://example.com/new.jpg');
    });

    it('accepts preferences update', () => {
      const update: UserUpdateData = {
        preferences: { language: 'ro', notifications: false },
      };
      expect(update.preferences?.language).toBe('ro');
      expect(update.preferences?.notifications).toBe(false);
    });
  });
});
