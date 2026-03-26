import {
  decodeJwtPayload,
  getTokenExpiryMs,
  getStoredRefreshToken,
  storeRefreshToken,
  REFRESH_TOKEN_KEY,
} from './auth-types';

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: vi.fn((index: number) => Object.keys(store)[index] ?? null),
  };
})();

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

beforeEach(() => {
  vi.clearAllMocks();
  localStorageMock.clear();
});

describe('decodeJwtPayload', () => {
  it('decodes a valid JWT payload', () => {
    const payload = { sub: 'user-1', exp: 1234567890 };
    const header = btoa(JSON.stringify({ alg: 'HS256' }));
    const body = btoa(JSON.stringify(payload));
    const token = `${header}.${body}.signature`;

    expect(decodeJwtPayload(token)).toEqual(payload);
  });

  it('returns null for token with wrong number of parts', () => {
    expect(decodeJwtPayload('only-one-part')).toBeNull();
    expect(decodeJwtPayload('two.parts')).toBeNull();
  });

  it('returns null for malformed base64 payload', () => {
    expect(decodeJwtPayload('valid.!!!invalid-base64!!!.sig')).toBeNull();
  });

  it('returns null for empty payload segment', () => {
    expect(decodeJwtPayload('header..sig')).toBeNull();
  });
});

describe('getTokenExpiryMs', () => {
  it('returns expiry in milliseconds for valid JWT', () => {
    const exp = 1700000000;
    const header = btoa(JSON.stringify({ alg: 'HS256' }));
    const body = btoa(JSON.stringify({ exp }));
    const token = `${header}.${body}.sig`;

    expect(getTokenExpiryMs(token)).toBe(exp * 1000);
  });

  it('returns null when exp claim is missing', () => {
    const header = btoa(JSON.stringify({ alg: 'HS256' }));
    const body = btoa(JSON.stringify({ sub: 'user-1' }));
    const token = `${header}.${body}.sig`;

    expect(getTokenExpiryMs(token)).toBeNull();
  });

  it('returns null when exp claim is not a number', () => {
    const header = btoa(JSON.stringify({ alg: 'HS256' }));
    const body = btoa(JSON.stringify({ exp: 'not-a-number' }));
    const token = `${header}.${body}.sig`;

    expect(getTokenExpiryMs(token)).toBeNull();
  });

  it('returns null for malformed token', () => {
    expect(getTokenExpiryMs('invalid')).toBeNull();
  });
});

describe('getStoredRefreshToken', () => {
  it('returns null when no token stored', () => {
    expect(getStoredRefreshToken()).toBeNull();
  });

  it('returns stored token', () => {
    localStorageMock.setItem(REFRESH_TOKEN_KEY, 'my-token');
    expect(getStoredRefreshToken()).toBe('my-token');
  });

  it('returns null when localStorage throws', () => {
    localStorageMock.getItem.mockImplementationOnce(() => {
      throw new Error('SecurityError');
    });
    expect(getStoredRefreshToken()).toBeNull();
  });
});

describe('storeRefreshToken', () => {
  it('stores token in localStorage', () => {
    storeRefreshToken('new-token');
    expect(localStorageMock.setItem).toHaveBeenCalledWith(REFRESH_TOKEN_KEY, 'new-token');
  });

  it('removes token when null', () => {
    storeRefreshToken(null);
    expect(localStorageMock.removeItem).toHaveBeenCalledWith(REFRESH_TOKEN_KEY);
  });

  it('handles localStorage errors gracefully', () => {
    localStorageMock.setItem.mockImplementationOnce(() => {
      throw new Error('QuotaExceededError');
    });
    expect(() => storeRefreshToken('token')).not.toThrow();
  });
});
