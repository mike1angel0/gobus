import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { isApiError } from '@/api/errors';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { loginSchema, getRedirectForRole, type LoginFormValues } from '@/pages/auth/login-schema';

/**
 * Login page with email/password form.
 *
 * Features:
 * - Zod validation with React Hook Form
 * - API error mapping to form fields (RFC 9457)
 * - Loading state on submit button
 * - Role-based redirect on success
 * - Accessible: labels, aria attributes, keyboard navigable
 */
export default function LoginPage() {
  const { login, user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [rootError, setRootError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  // Redirect when user becomes authenticated (after login succeeds)
  useEffect(() => {
    if (isAuthenticated && user) {
      navigate(getRedirectForRole(user.role), { replace: true });
    }
  }, [isAuthenticated, user, navigate]);

  /** Handles form submission: calls auth login and maps errors. */
  async function onSubmit(data: LoginFormValues) {
    setRootError(null);

    try {
      await login(data.email, data.password);
    } catch (error: unknown) {
      if (isApiError(error)) {
        // Map field-level validation errors to form fields
        for (const fieldError of error.fieldErrors) {
          const field = fieldError.field as keyof LoginFormValues;
          if (field === 'email' || field === 'password') {
            setError(field, { message: fieldError.message });
          }
        }

        // Handle specific error codes
        if (error.code === 'INVALID_CREDENTIALS') {
          setRootError('Invalid email or password. Please try again.');
          return;
        }
        if (error.code === 'ACCOUNT_SUSPENDED') {
          setRootError('Your account has been suspended. Please contact support.');
          return;
        }
        if (error.code === 'ACCOUNT_LOCKED') {
          setRootError(
            'Your account has been locked due to too many failed attempts. Please try again later.',
          );
          return;
        }

        // Generic API error with no field errors
        if (error.fieldErrors.length === 0 && !error.code) {
          setRootError(error.detail ?? error.title);
        }
        return;
      }

      setRootError('An unexpected error occurred. Please try again.');
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="glass-card w-full max-w-md">
        <CardHeader className="text-center">
          <h1 className="text-2xl font-semibold leading-none tracking-tight">Sign in</h1>
          <CardDescription>Enter your credentials to access your account</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
            {rootError && (
              <div
                role="alert"
                className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive"
              >
                {rootError}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                autoComplete="email"
                aria-invalid={!!errors.email}
                aria-describedby={errors.email ? 'email-error' : undefined}
                className={cn(errors.email && 'border-destructive')}
                {...register('email')}
              />
              {errors.email && (
                <p id="email-error" role="alert" className="text-sm text-destructive">
                  {errors.email.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                autoComplete="current-password"
                aria-invalid={!!errors.password}
                aria-describedby={errors.password ? 'password-error' : undefined}
                className={cn(errors.password && 'border-destructive')}
                {...register('password')}
              />
              {errors.password && (
                <p id="password-error" role="alert" className="text-sm text-destructive">
                  {errors.password.message}
                </p>
              )}
            </div>

            <div className="flex items-center justify-end">
              <Link
                to="/auth/forgot-password"
                className="text-sm text-muted-foreground hover:text-primary"
              >
                Forgot password?
              </Link>
            </div>

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="animate-spin" aria-hidden="true" />
                  <span>Signing in…</span>
                </>
              ) : (
                'Sign in'
              )}
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              Don&apos;t have an account?{' '}
              <Link to="/auth/register" className="text-primary hover:underline">
                Sign up
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
