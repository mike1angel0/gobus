import type { FieldErrors, UseFormRegister } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import type { RegisterFormValues, PasswordStrength } from '@/pages/auth/register-schema';

/** Props shared by all register form field components. */
interface FieldProps {
  errors: FieldErrors<RegisterFormValues>;
  register: UseFormRegister<RegisterFormValues>;
}

/**
 * Role toggle radio group for PASSENGER / PROVIDER selection.
 */
export function RoleToggle({
  selectedRole,
  register,
}: {
  selectedRole: string;
  register: UseFormRegister<RegisterFormValues>;
}) {
  const { t } = useTranslation('auth');

  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium">{t('register.role.legend')}</legend>
      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={t('register.role.ariaLabel')}>
        <label
          className={cn(
            'flex cursor-pointer items-center justify-center rounded-md border p-3 text-sm font-medium transition-colors',
            selectedRole === 'PASSENGER'
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-border hover:bg-muted',
          )}
        >
          <input type="radio" value="PASSENGER" className="sr-only" {...register('role')} />
          {t('register.role.passenger')}
        </label>
        <label
          className={cn(
            'flex cursor-pointer items-center justify-center rounded-md border p-3 text-sm font-medium transition-colors',
            selectedRole === 'PROVIDER'
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-border hover:bg-muted',
          )}
        >
          <input type="radio" value="PROVIDER" className="sr-only" {...register('role')} />
          {t('register.role.provider')}
        </label>
      </div>
    </fieldset>
  );
}

/**
 * Name, email, phone, and provider name text fields for the registration form.
 */
export function IdentityFields({
  errors,
  register,
  selectedRole,
}: FieldProps & { selectedRole: string }) {
  const { t } = useTranslation('auth');

  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="name">{t('register.fields.fullName')}</Label>
        <Input
          id="name"
          type="text"
          placeholder={t('register.fields.fullNamePlaceholder')}
          autoComplete="name"
          aria-invalid={!!errors.name}
          aria-describedby={errors.name ? 'name-error' : undefined}
          className={cn(errors.name && 'border-destructive')}
          {...register('name')}
        />
        {errors.name && (
          <p id="name-error" role="alert" className="text-sm text-destructive">
            {errors.name.message}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">{t('register.fields.email')}</Label>
        <Input
          id="email"
          type="email"
          placeholder={t('register.fields.emailPlaceholder')}
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
        <Label htmlFor="phone">
          {t('register.fields.phone')}{' '}
          <span className="text-muted-foreground">{t('register.fields.phoneOptional')}</span>
        </Label>
        <Input
          id="phone"
          type="tel"
          placeholder={t('register.fields.phonePlaceholder')}
          autoComplete="tel"
          aria-invalid={!!errors.phone}
          aria-describedby={errors.phone ? 'phone-error' : undefined}
          className={cn(errors.phone && 'border-destructive')}
          {...register('phone')}
        />
        {errors.phone && (
          <p id="phone-error" role="alert" className="text-sm text-destructive">
            {errors.phone.message}
          </p>
        )}
      </div>

      {selectedRole === 'PROVIDER' && (
        <div className="space-y-2">
          <Label htmlFor="providerName">{t('register.fields.providerName')}</Label>
          <Input
            id="providerName"
            type="text"
            placeholder={t('register.fields.providerNamePlaceholder')}
            aria-invalid={!!errors.providerName}
            aria-describedby={errors.providerName ? 'providerName-error' : undefined}
            className={cn(errors.providerName && 'border-destructive')}
            {...register('providerName')}
          />
          {errors.providerName && (
            <p id="providerName-error" role="alert" className="text-sm text-destructive">
              {errors.providerName.message}
            </p>
          )}
        </div>
      )}
    </>
  );
}

/**
 * Password and confirm password fields with strength indicator.
 */
export function PasswordFields({
  errors,
  register,
  passwordValue,
  strength,
}: FieldProps & { passwordValue: string; strength: PasswordStrength }) {
  const { t } = useTranslation('auth');

  /** Style map for the password strength indicator bar. */
  const strengthConfig: Record<PasswordStrength, { width: string; color: string }> = {
    weak: { width: 'w-1/3', color: 'bg-destructive' },
    fair: { width: 'w-2/3', color: 'bg-yellow-500' },
    strong: { width: 'w-full', color: 'bg-green-500' },
  };

  const config = strengthConfig[strength];
  const strengthLabel = t(`passwordStrength.${strength}`);

  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="password">{t('register.fields.password')}</Label>
        <Input
          id="password"
          type="password"
          placeholder={t('register.fields.passwordPlaceholder')}
          autoComplete="new-password"
          aria-invalid={!!errors.password}
          aria-describedby={
            [errors.password ? 'password-error' : '', 'password-strength']
              .filter(Boolean)
              .join(' ') || undefined
          }
          className={cn(errors.password && 'border-destructive')}
          {...register('password')}
        />
        {errors.password && (
          <p id="password-error" role="alert" className="text-sm text-destructive">
            {errors.password.message}
          </p>
        )}
        {passwordValue.length > 0 && (
          <div id="password-strength" className="space-y-1">
            <div
              className="h-1.5 w-full rounded-full bg-muted"
              role="progressbar"
              aria-valuenow={strength === 'weak' ? 33 : strength === 'fair' ? 66 : 100}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${t('passwordStrength.label')} ${strengthLabel}`}
            >
              <div
                className={cn('h-full rounded-full transition-all', config.width, config.color)}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {t('passwordStrength.label')} <span data-testid="strength-label">{strengthLabel}</span>
            </p>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirmPassword">{t('register.fields.confirmPassword')}</Label>
        <Input
          id="confirmPassword"
          type="password"
          placeholder={t('register.fields.confirmPasswordPlaceholder')}
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
    </>
  );
}
