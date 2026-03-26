import { RouterProvider } from 'react-router-dom';
import { router } from './router';

/** Root application component. Renders the router with all configured routes. */
export default function App() {
  return <RouterProvider router={router} />;
}
