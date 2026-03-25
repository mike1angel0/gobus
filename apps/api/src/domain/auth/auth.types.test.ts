import { describe, it, expect } from 'vitest';
import type {
  RegisterData,
  RegisterRole,
  LoginCredentials,
  AuthTokenPayload,
  TokenPair,
  ForgotPasswordData,
  ResetPasswordData,
  ChangePasswordData,
} from './auth.types.js';

describe('Auth domain types', () => {
  describe('RegisterData', () => {
    it('accepts valid passenger registration data', () => {
      const data: RegisterData = {
        email: 'test@example.com',
        password: 'Password1',
        name: 'Test User',
        role: 'PASSENGER',
      };
      expect(data.role).toBe('PASSENGER');
      expect(data.email).toBe('test@example.com');
    });

    it('accepts valid provider registration with providerName', () => {
      const data: RegisterData = {
        email: 'provider@example.com',
        password: 'Password1',
        name: 'Provider Admin',
        role: 'PROVIDER',
        phone: '+40712345678',
        providerName: 'FlixBus Romania',
      };
      expect(data.role).toBe('PROVIDER');
      expect(data.providerName).toBe('FlixBus Romania');
      expect(data.phone).toBe('+40712345678');
    });

    it('allows optional fields to be omitted', () => {
      const data: RegisterData = {
        email: 'test@example.com',
        password: 'Password1',
        name: 'Test',
        role: 'PASSENGER',
      };
      expect(data.phone).toBeUndefined();
      expect(data.providerName).toBeUndefined();
    });
  });

  describe('RegisterRole', () => {
    it('only allows PASSENGER and PROVIDER values', () => {
      const passengerRole: RegisterRole = 'PASSENGER';
      const providerRole: RegisterRole = 'PROVIDER';
      expect(passengerRole).toBe('PASSENGER');
      expect(providerRole).toBe('PROVIDER');
    });
  });

  describe('LoginCredentials', () => {
    it('contains email and password fields', () => {
      const creds: LoginCredentials = {
        email: 'user@example.com',
        password: 'SecurePass1',
      };
      expect(creds.email).toBe('user@example.com');
      expect(creds.password).toBe('SecurePass1');
    });
  });

  describe('AuthTokenPayload', () => {
    it('contains all JWT claim fields', () => {
      const payload: AuthTokenPayload = {
        sub: 'cm1abc123',
        email: 'user@example.com',
        role: 'PASSENGER',
        providerId: null,
        iat: 1700000000,
        exp: 1700000900,
      };
      expect(payload.sub).toBe('cm1abc123');
      expect(payload.role).toBe('PASSENGER');
      expect(payload.providerId).toBeNull();
      expect(payload.exp - payload.iat).toBe(900);
    });

    it('includes providerId for PROVIDER role', () => {
      const payload: AuthTokenPayload = {
        sub: 'cm1def456',
        email: 'provider@example.com',
        role: 'PROVIDER',
        providerId: 'cm1prov789',
        iat: 1700000000,
        exp: 1700000900,
      };
      expect(payload.providerId).toBe('cm1prov789');
    });
  });

  describe('TokenPair', () => {
    it('contains accessToken and refreshToken', () => {
      const tokens: TokenPair = {
        accessToken: 'eyJhbGciOiJIUzI1NiJ9.access',
        refreshToken: 'eyJhbGciOiJIUzI1NiJ9.refresh',
      };
      expect(tokens.accessToken).toContain('eyJ');
      expect(tokens.refreshToken).toContain('eyJ');
    });
  });

  describe('ForgotPasswordData', () => {
    it('contains email field', () => {
      const data: ForgotPasswordData = { email: 'forgot@example.com' };
      expect(data.email).toBe('forgot@example.com');
    });
  });

  describe('ResetPasswordData', () => {
    it('contains token and newPassword fields', () => {
      const data: ResetPasswordData = {
        token: 'abc123resettoken',
        newPassword: 'NewPassword1',
      };
      expect(data.token).toBe('abc123resettoken');
      expect(data.newPassword).toBe('NewPassword1');
    });
  });

  describe('ChangePasswordData', () => {
    it('contains currentPassword and newPassword fields', () => {
      const data: ChangePasswordData = {
        currentPassword: 'OldPassword1',
        newPassword: 'NewPassword1',
      };
      expect(data.currentPassword).toBe('OldPassword1');
      expect(data.newPassword).toBe('NewPassword1');
    });
  });
});
