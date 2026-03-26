import { lazy } from 'react';
import { createBrowserRouter } from 'react-router-dom';
import { RootLayout } from '@/components/layout/root-layout';
import { AppLayout } from '@/components/layout/app-layout';
import { AuthGuard } from '@/components/guards/auth-guard';
import { RoleGuard } from '@/components/guards/role-guard';

/* ---------- Lazy-loaded pages ---------- */

const HomePage = lazy(() => import('@/pages/home'));
const LoginPage = lazy(() => import('@/pages/auth/login'));
const RegisterPage = lazy(() => import('@/pages/auth/register'));
const ForgotPasswordPage = lazy(() => import('@/pages/auth/forgot-password'));
const ResetPasswordPage = lazy(() => import('@/pages/auth/reset-password'));
const ChangePasswordPage = lazy(() => import('@/pages/auth/change-password'));
const SearchPage = lazy(() => import('@/pages/search'));
const TripDetailPage = lazy(() => import('@/pages/trip/[id]'));
const MyTripsPage = lazy(() => import('@/pages/my-trips'));
const PlaceholderPage = lazy(() => import('@/pages/placeholder'));

/* ---------- Router ---------- */

/**
 * Application router with auth guards and lazy-loaded pages.
 *
 * Route structure:
 * - Public: `/`, `/search`, `/trip/:id`, `/auth/*`
 * - Authenticated: `/auth/change-password`, `/my-trips`
 * - Provider (role): `/provider/*`
 * - Driver (role): `/driver/*`
 * - Admin (role): `/admin/*`
 */
export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      {
        element: <AppLayout />,
        children: [
          /* ---- Public routes ---- */
          { path: '/', element: <HomePage /> },
          { path: '/search', element: <SearchPage /> },
          { path: '/trip/:id', element: <TripDetailPage /> },

          /* ---- Auth routes (public) ---- */
          { path: '/auth/login', element: <LoginPage /> },
          { path: '/auth/register', element: <RegisterPage /> },
          { path: '/auth/forgot-password', element: <ForgotPasswordPage /> },
          { path: '/auth/reset-password', element: <ResetPasswordPage /> },

          /* ---- Authenticated routes ---- */
          {
            element: <AuthGuard />,
            children: [
              { path: '/auth/change-password', element: <ChangePasswordPage /> },
              { path: '/my-trips', element: <MyTripsPage /> },

              /* ---- Provider routes ---- */
              {
                path: '/provider',
                element: <RoleGuard allowedRoles={['PROVIDER']} />,
                children: [
                  { index: true, element: <PlaceholderPage /> },
                  { path: 'routes', element: <PlaceholderPage /> },
                  { path: 'fleet', element: <PlaceholderPage /> },
                  { path: 'schedules', element: <PlaceholderPage /> },
                  { path: 'drivers', element: <PlaceholderPage /> },
                  { path: 'tracking', element: <PlaceholderPage /> },
                ],
              },

              /* ---- Driver routes ---- */
              {
                path: '/driver',
                element: <RoleGuard allowedRoles={['DRIVER']} />,
                children: [
                  { index: true, element: <PlaceholderPage /> },
                  { path: 'trip/:id', element: <PlaceholderPage /> },
                  { path: 'delay', element: <PlaceholderPage /> },
                ],
              },

              /* ---- Admin routes ---- */
              {
                path: '/admin',
                element: <RoleGuard allowedRoles={['ADMIN']} />,
                children: [
                  { index: true, element: <PlaceholderPage /> },
                  { path: 'fleet', element: <PlaceholderPage /> },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
]);
