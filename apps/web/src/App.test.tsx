import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { AppQueryProvider } from '@/providers/query-provider';
import { AuthProvider } from '@/contexts/auth-context';

describe('App', () => {
  it('renders the home route placeholder', async () => {
    const router = createMemoryRouter(
      [
        {
          path: '/',
          element: (
            <div>
              <h1>Home</h1>
            </div>
          ),
        },
      ],
      { initialEntries: ['/'] },
    );

    render(
      <AppQueryProvider>
        <AuthProvider>
          <RouterProvider router={router} />
        </AuthProvider>
      </AppQueryProvider>,
    );

    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent('Home');
  });
});
