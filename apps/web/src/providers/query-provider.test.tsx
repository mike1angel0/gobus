import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { useQueryClient } from '@tanstack/react-query';
import { renderWithProviders } from '@/test/helpers';
import { AppQueryProvider } from './query-provider';
import { queryClient } from './query-client';
import { render } from '@testing-library/react';

describe('queryClient defaults', () => {
  it('has staleTime of 30 seconds', () => {
    expect(queryClient.getDefaultOptions().queries?.staleTime).toBe(30_000);
  });

  it('has retry of 1 for queries', () => {
    expect(queryClient.getDefaultOptions().queries?.retry).toBe(1);
  });

  it('has refetchOnWindowFocus disabled', () => {
    expect(queryClient.getDefaultOptions().queries?.refetchOnWindowFocus).toBe(false);
  });

  it('has gcTime of 5 minutes', () => {
    expect(queryClient.getDefaultOptions().queries?.gcTime).toBe(300_000);
  });

  it('has retry of 0 for mutations', () => {
    expect(queryClient.getDefaultOptions().mutations?.retry).toBe(0);
  });
});

describe('AppQueryProvider', () => {
  it('provides QueryClient to children', () => {
    function TestChild() {
      const client = useQueryClient();
      return <span data-testid="has-client">{client ? 'yes' : 'no'}</span>;
    }

    render(
      <AppQueryProvider>
        <TestChild />
      </AppQueryProvider>,
    );

    expect(screen.getByTestId('has-client')).toHaveTextContent('yes');
  });

  it('accepts a custom QueryClient', () => {
    function TestChild() {
      const client = useQueryClient();
      return (
        <span data-testid="stale-time">
          {String(client.getDefaultOptions().queries?.staleTime ?? 'default')}
        </span>
      );
    }

    const { getByTestId } = renderWithProviders(<TestChild />);
    // renderWithProviders uses a test client with staleTime undefined (not 30s)
    expect(getByTestId('stale-time')).toHaveTextContent('default');
  });
});
