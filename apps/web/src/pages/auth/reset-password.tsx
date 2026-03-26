import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';
import { isApiError } from '@/api/errors';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { usePageTitle } from '@/hooks/use-page-title';
import { getPasswordStrength } from '@/pages/auth/register-schema';
import type { PasswordStrength } from '@/pages/auth/register-schema';
import {
  createResetPasswordSchema,
  type ResetPasswordFormValues,
} from '@/pages/auth/reset-password-schema';
import { TokenErrorView } from '@/pages/auth/reset-password-error';

/** Style map for the password strength indicator bar. */
const STRENGTH_STYLES: Record<PasswordStrength, { color: string; width: string; value: number }> = {
  weak: { color: 'bg-red-500', width: 'w-1/3', value: 33 },
  fair: { color: 'bg-yellow-500', width: 'w-2/3', value: 66 },
  strong: { color: 'bg-green-500', width: 'w-full', value: 100 },
};

/** Token error codes returned by the API. */
const TOKEN_ERROR_CODES = new Set(['TOKEN_EXPIRED', 'TOKEN_INVALID', 'INVALID_TOKEN']);

/** Reset password page — sets a new password using a token from email. */
export default function ResetPasswordPage() {
  const { t } = useTranslation('auth');
  usePageTitle(t('resetPassword.pageTitle'));
  const { resetPassword } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [rootError, setRootError] = useState<string | null>(null);
  const [tokenExpired, setTokenExpired] = useState(false);

  const schema = useMemo(() => createResetPasswordSchema(t), [t]);

  const {
    register,
    handleSubmit,
    setError,
    watch,
    reset: resetForm,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { newPassword: '', confirmPassword: '' },
  });

  const passwordValue = watch('newPassword');
  const strength = getPasswordStrength(passwordValue);
  const cfg = STRENGTH_STYLES[strength];

  // Clear sensitive password data on unmount
  useEffect(() => {
    return () => {
      resetForm();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!token || tokenExpired) {
    return <TokenErrorView expired={tokenExpired} />;
  }

  async function onSubmit(data: ResetPasswordFormValues) {
    setRootError(null);
    try {
      await resetPassword(token!, data.newPassword);
      navigate('/auth/login', { replace: true });
    } catch (error: unknown) {
      if (!isApiError(error)) {
        setRootError(t('resetPassword.errors.unexpected'));
        return;
      }
      if (error.code && TOKEN_ERROR_CODES.has(error.code)) {
        setTokenExpired(true);
        return;
      }
      for (const fieldError of error.fieldErrors) {
        const field = fieldError.field as keyof ResetPasswordFormValues;
        if (field === 'newPassword' || field === 'confirmPassword') {
          setError(field, { message: fieldError.message });
        }
      }
      if (error.fieldErrors.length === 0 && !error.code) {
        setRootError(error.detail ?? error.title);
      }
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="glass-card w-full max-w-md">
        <CardHeader className="text-center">
          <h1 className="text-2xl font-semibold leading-none tracking-tight">
            {t('resetPassword.title')}
          </h1>
          <CardDescription>{t('resetPassword.description')}</CardDescription>
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
              <Label htmlFor="newPassword">{t('resetPassword.newPassword')}</Label>
              <Input
                id="newPassword"
                type="password"
                placeholder={t('resetPassword.passwordPlaceholder')}
                autoComplete="new-password"
                aria-invalid={!!errors.newPassword}
                aria-describedby={errors.newPassword ? 'newPassword-error' : 'password-strength'}
                className={cn(errors.newPassword && 'border-destructive')}
                {...register('newPassword')}
              />
              {passwordValue.length > 0 && (
                <div id="password-strength" className="space-y-1">
                  <div
                    className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
                    role="progressbar"
                    aria-valuenow={cfg.value}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={t('passwordStrength.ariaLabel')}
                  >
                    <div
                      className={cn('h-full rounded-full transition-all', cfg.color, cfg.width)}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t('passwordStrength.strengthLabel')} {t(`passwordStrength.${strength}`)}
                  </p>
                </div>
              )}
              {errors.newPassword && (
                <p id="newPassword-error" role="alert" className="text-sm text-destructive">
                  {errors.newPassword.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">{t('resetPassword.confirmPassword')}</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder={t('resetPassword.passwordPlaceholder')}
                autoComplete="new-password"
                aria-invalid={!!errors.confirmPassword}
                aria-describedby={errors.confirmPassword ? 'confirmPassword-error' : undefined}
                className={cn(errors.confirmPassword && 'border-destructive')}
                {...register('confirmPassword')}
              />
              {errors.confirmPassword && (
                <p id="confirmPassword-error" role="alert" className="text-sm text-destructive">
                  {errors.confirmPassword.message}
                </p>
              )}
            </div>
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="animate-spin" aria-hidden="true" />
                  <span>{t('resetPassword.submitting')}</span>
                </>
              ) : (
                t('resetPassword.submit')
              )}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              {t('resetPassword.rememberPassword')}{' '}
              <Link to="/auth/login" className="text-primary hover:underline">
                {t('resetPassword.signIn')}
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
