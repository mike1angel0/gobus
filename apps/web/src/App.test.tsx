import { renderWithProviders } from '@/test/helpers';
import App from './App';

describe('App', () => {
  it('renders the application heading', () => {
    const { getByRole } = renderWithProviders(<App />);
    expect(getByRole('heading', { level: 1 })).toHaveTextContent('Transio');
  });

  it('renders the tagline', () => {
    const { getByText } = renderWithProviders(<App />);
    expect(getByText('Bus transport platform')).toBeInTheDocument();
  });
});
