import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'react-router-dom';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import { usePageTitle } from '@/hooks/use-page-title';
import { cn } from '@/lib/utils';
import {
  createForgotPasswordSchema,
  type ForgotPasswordFormValues,
} from '@/pages/auth/forgot-password-schema';

/** Forgot password page — sends a password reset email. */
export default function ForgotPasswordPage() {
  const { t } = useTranslation('auth');
  usePageTitle(t('forgotPassword.pageTitle'));
  const { forgotPassword } = useAuth();
  const [submitted, setSubmitted] = useState(false);
  const [rootError, setRootError] = useState<string | null>(null);

  const schema = useMemo(() => createForgotPasswordSchema(t), [t]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '' },
  });

  async function onSubmit(data: ForgotPasswordFormValues) {
    setRootError(null);
    try {
      await forgotPassword(data.email);
      setSubmitted(true);
    } catch {
      // Always show success to prevent email enumeration.
      // Only show error for network/unexpected failures.
      setRootError(t('forgotPassword.errors.unexpected'));
    }
  }

  if (submitted) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <Card className="glass-card w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <CheckCircle2 className="mx-auto mb-4 h-12 w-12 text-green-500" aria-hidden="true" />
            <h1 className="mb-2 text-2xl font-semibold">{t('forgotPassword.success.title')}</h1>
            <p className="mb-6 text-sm text-muted-foreground">
              {t('forgotPassword.success.message')}
            </p>
            <Link to="/auth/login" className="text-sm text-primary hover:underline">
              {t('forgotPassword.success.backToSignIn')}
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="glass-card w-full max-w-md">
        <CardHeader className="text-center">
          <h1 className="text-2xl font-semibold leading-none tracking-tight">
            {t('forgotPassword.title')}
          </h1>
          <CardDescription>{t('forgotPassword.description')}</CardDescription>
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
              <Label htmlFor="email">{t('forgotPassword.email')}</Label>
              <Input
                id="email"
                type="email"
                placeholder={t('forgotPassword.emailPlaceholder')}
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
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="animate-spin" aria-hidden="true" />
                  <span>{t('forgotPassword.submitting')}</span>
                </>
              ) : (
                t('forgotPassword.submit')
              )}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              {t('forgotPassword.rememberPassword')}{' '}
              <Link to="/auth/login" className="text-primary hover:underline">
                {t('forgotPassword.signIn')}
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
