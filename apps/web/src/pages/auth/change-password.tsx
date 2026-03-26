import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { isApiError } from '@/api/errors';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { getPasswordStrength } from '@/pages/auth/register-schema';
import {
  changePasswordSchema,
  type ChangePasswordFormValues,
} from '@/pages/auth/change-password-schema';

/** Strength bar colors and labels for password feedback. */
const STRENGTH_CONFIG = {
  weak: { color: 'bg-red-500', label: 'Weak', width: 'w-1/3', value: 33 },
  fair: { color: 'bg-yellow-500', label: 'Fair', width: 'w-2/3', value: 66 },
  strong: { color: 'bg-green-500', label: 'Strong', width: 'w-full', value: 100 },
} as const;

/** Error codes indicating wrong current password. */
const WRONG_PASSWORD_CODES = new Set(['INVALID_CREDENTIALS', 'INCORRECT_PASSWORD']);

/**
 * Change password page — allows authenticated users to update their password.
 *
 * Features:
 * - Current password verification
 * - New password with strength indicator
 * - Confirm password with match validation
 * - API error mapping for wrong current password
 * - Success toast notification
 *
 * @example
 * ```tsx
 * <ChangePasswordPage />
 * ```
 */
export default function ChangePasswordPage() {
  const { changePassword } = useAuth();
  const [rootError, setRootError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  const passwordValue = watch('newPassword');
  const strength = getPasswordStrength(passwordValue);
  const cfg = STRENGTH_CONFIG[strength];

  /** Handles form submission: validates and sends change password request. */
  async function onSubmit(data: ChangePasswordFormValues) {
    setRootError(null);
    try {
      await changePassword(data.currentPassword, data.newPassword);
      reset();
      toast({
        title: 'Password changed',
        description: 'Your password has been updated successfully.',
      });
    } catch (error: unknown) {
      if (!isApiError(error)) {
        setRootError('An unexpected error occurred. Please try again.');
        return;
      }
      if (error.status === 401 || (error.code && WRONG_PASSWORD_CODES.has(error.code))) {
        setError('currentPassword', { message: 'Current password is incorrect' });
        return;
      }
      for (const fieldError of error.fieldErrors) {
        const field = fieldError.field as keyof ChangePasswordFormValues;
        if (field === 'currentPassword' || field === 'newPassword' || field === 'confirmPassword') {
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
          <h1 className="text-2xl font-semibold leading-none tracking-tight">Change password</h1>
          <CardDescription>Update your account password</CardDescription>
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
              <Label htmlFor="currentPassword">Current password</Label>
              <Input
                id="currentPassword"
                type="password"
                placeholder="••••••••"
                autoComplete="current-password"
                aria-invalid={!!errors.currentPassword}
                aria-describedby={errors.currentPassword ? 'currentPassword-error' : undefined}
                className={cn(errors.currentPassword && 'border-destructive')}
                {...register('currentPassword')}
              />
              {errors.currentPassword && (
                <p id="currentPassword-error" role="alert" className="text-sm text-destructive">
                  {errors.currentPassword.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPassword">New password</Label>
              <Input
                id="newPassword"
                type="password"
                placeholder="••••••••"
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
                    aria-label="Password strength"
                  >
                    <div
                      className={cn('h-full rounded-full transition-all', cfg.color, cfg.width)}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">Strength: {cfg.label}</p>
                </div>
              )}
              {errors.newPassword && (
                <p id="newPassword-error" role="alert" className="text-sm text-destructive">
                  {errors.newPassword.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm new password</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="••••••••"
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
                  <span>Changing…</span>
                </>
              ) : (
                'Change password'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
