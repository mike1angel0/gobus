import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { isApiError } from '@/api/errors';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import { getRedirectForRole } from '@/pages/auth/login-schema';
import {
  registerSchema,
  getPasswordStrength,
  type RegisterFormValues,
} from '@/pages/auth/register-schema';
import { RoleToggle, IdentityFields, PasswordFields } from '@/pages/auth/register-fields';

/**
 * Builds the register API payload from form values.
 * Strips confirmPassword and empty optional fields.
 */
function buildRegisterPayload(data: RegisterFormValues) {
  return {
    email: data.email,
    name: data.name,
    password: data.password,
    role: data.role,
    ...(data.phone ? { phone: data.phone } : {}),
    ...(data.role === 'PROVIDER' && data.providerName ? { providerName: data.providerName } : {}),
  };
}

/**
 * Registration page with role toggle (PASSENGER / PROVIDER).
 *
 * Features:
 * - Role toggle that conditionally shows provider-specific fields
 * - Password strength indicator (weak/fair/strong)
 * - Zod validation matching OpenAPI spec constraints
 * - API error mapping to form fields (RFC 9457)
 * - Auto-login after successful registration
 * - Accessible: labels, ARIA attributes, keyboard navigable
 */
export default function RegisterPage() {
  const { register: authRegister, user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [rootError, setRootError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      email: '',
      name: '',
      password: '',
      confirmPassword: '',
      role: 'PASSENGER',
      phone: '',
      providerName: '',
    },
  });

  const selectedRole = watch('role');
  const passwordValue = watch('password');
  const strength = getPasswordStrength(passwordValue);

  useEffect(() => {
    if (isAuthenticated && user) {
      navigate(getRedirectForRole(user.role), { replace: true });
    }
  }, [isAuthenticated, user, navigate]);

  /** Handles form submission: calls auth register and maps errors. */
  async function onSubmit(data: RegisterFormValues) {
    setRootError(null);

    try {
      await authRegister(buildRegisterPayload(data));
    } catch (error: unknown) {
      if (!isApiError(error)) {
        setRootError('An unexpected error occurred. Please try again.');
        return;
      }

      for (const fieldError of error.fieldErrors) {
        const field = fieldError.field as keyof RegisterFormValues;
        if (field in data) {
          setError(field, { message: fieldError.message });
        }
      }

      if (error.code === 'EMAIL_ALREADY_EXISTS') {
        setError('email', { message: 'An account with this email already exists' });
      } else if (error.fieldErrors.length === 0 && !error.code) {
        setRootError(error.detail ?? error.title);
      }
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-8">
      <Card className="glass-card w-full max-w-md">
        <CardHeader className="text-center">
          <h1 className="text-2xl font-semibold leading-none tracking-tight">Create account</h1>
          <CardDescription>Sign up to start booking or managing routes</CardDescription>
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

            <RoleToggle selectedRole={selectedRole} register={register} />
            <IdentityFields errors={errors} register={register} selectedRole={selectedRole} />
            <PasswordFields
              errors={errors}
              register={register}
              passwordValue={passwordValue}
              strength={strength}
            />

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="animate-spin" aria-hidden="true" />
                  <span>Creating account…</span>
                </>
              ) : (
                'Create account'
              )}
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              Already have an account?{' '}
              <Link to="/auth/login" className="text-primary hover:underline">
                Sign in
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
