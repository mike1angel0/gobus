import type { ReactElement, ReactNode } from 'react';
import { render, type RenderOptions } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, type MemoryRouterProps } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import { AuthProvider } from '@/contexts/auth-context';
import i18n from '@/i18n/config';

/**
 * Options for {@link renderWithProviders}. Extends RTL's RenderOptions
 * with router and query client configuration.
 */
interface ProvidersOptions extends Omit<RenderOptions, 'wrapper'> {
  /** Initial route entries for MemoryRouter. Defaults to `['/']`. */
  routerProps?: MemoryRouterProps;
  /** Custom QueryClient instance. A fresh client is created per test by default. */
  queryClient?: QueryClient;
  /** Whether to include AuthProvider in the wrapper. Defaults to `false`. */
  withAuth?: boolean;
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
 * Wraps a component in all application providers (QueryClient, Router, I18next) for testing.
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
  { routerProps, queryClient, withAuth = false, ...renderOptions }: ProvidersOptions = {},
) {
  const client = queryClient ?? createTestQueryClient();

  function Wrapper({ children }: { children: ReactNode }) {
    const content = <MemoryRouter {...routerProps}>{children}</MemoryRouter>;
    return (
      <I18nextProvider i18n={i18n}>
        <QueryClientProvider client={client}>
          {withAuth ? <AuthProvider>{content}</AuthProvider> : content}
        </QueryClientProvider>
      </I18nextProvider>
    );
  }

  return {
    ...render(ui, { wrapper: Wrapper, ...renderOptions }),
    queryClient: client,
  };
}

export { renderWithProviders, createTestQueryClient };
export type { ProvidersOptions };
