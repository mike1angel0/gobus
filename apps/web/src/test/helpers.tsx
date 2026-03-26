import type { ReactElement, ReactNode } from 'react';
import { render, type RenderOptions } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, type MemoryRouterProps } from 'react-router-dom';

/**
 * Options for {@link renderWithProviders}. Extends RTL's RenderOptions
 * with router and query client configuration.
 */
interface ProvidersOptions extends Omit<RenderOptions, 'wrapper'> {
  /** Initial route entries for MemoryRouter. Defaults to `['/']`. */
  routerProps?: MemoryRouterProps;
  /** Custom QueryClient instance. A fresh client is created per test by default. */
  queryClient?: QueryClient;
}

/**
 * Creates a QueryClient configured for tests: no retries, no garbage collection delays.
 * Each test should use a fresh client to avoid shared state.
 */
function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

/**
 * Wraps a component in all application providers (QueryClient, Router) for testing.
 *
 * @example
 * ```tsx
 * const { getByText } = renderWithProviders(<MyComponent />, {
 *   routerProps: { initialEntries: ['/dashboard'] },
 * });
 * ```
 *
 * @param ui - The React element to render.
 * @param options - Optional render and provider configuration.
 * @returns The RTL render result plus the `queryClient` used.
 */
function renderWithProviders(
  ui: ReactElement,
  { routerProps, queryClient, ...renderOptions }: ProvidersOptions = {},
) {
  const client = queryClient ?? createTestQueryClient();

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>
        <MemoryRouter {...routerProps}>{children}</MemoryRouter>
      </QueryClientProvider>
    );
  }

  return {
    ...render(ui, { wrapper: Wrapper, ...renderOptions }),
    queryClient: client,
  };
}

export { renderWithProviders, createTestQueryClient };
export type { ProvidersOptions };
