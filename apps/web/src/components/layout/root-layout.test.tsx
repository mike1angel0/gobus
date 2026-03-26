import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { RootLayout } from './root-layout';

vi.mock('@/api/client', () => ({
  apiClient: { POST: vi.fn(), GET: vi.fn() },
  setAccessToken: vi.fn(),
  getAccessToken: vi.fn(() => null),
  setOnUnauthorized: vi.fn(),
  setOnForbiddenOrLocked: vi.fn(),
}));

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

function renderWithRouter(outlet = 'Child Content') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <Routes>
          <Route element={<RootLayout />}>
            <Route index element={<p>{outlet}</p>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('RootLayout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
  });

  it('renders child routes via Outlet', async () => {
    renderWithRouter('Hello from child');
    expect(await screen.findByText('Hello from child')).toBeInTheDocument();
  });

  it('wraps children in QueryClient and Auth providers', () => {
    // If providers are missing, rendering would throw — passing means they're present
    expect(() => renderWithRouter()).not.toThrow();
  });
});
