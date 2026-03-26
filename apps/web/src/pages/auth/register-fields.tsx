import type { FieldErrors, UseFormRegister } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import type { RegisterFormValues, PasswordStrength } from '@/pages/auth/register-schema';

/** Props shared by all register form field components. */
interface FieldProps {
  errors: FieldErrors<RegisterFormValues>;
  register: UseFormRegister<RegisterFormValues>;
}

/** Style map for the password strength indicator bar. */
const strengthConfig: Record<PasswordStrength, { width: string; color: string; label: string }> = {
  weak: { width: 'w-1/3', color: 'bg-destructive', label: 'Weak' },
  fair: { width: 'w-2/3', color: 'bg-yellow-500', label: 'Fair' },
  strong: { width: 'w-full', color: 'bg-green-500', label: 'Strong' },
};

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
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium">I am a</legend>
      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Account type">
        <label
          className={cn(
            'flex cursor-pointer items-center justify-center rounded-md border p-3 text-sm font-medium transition-colors',
            selectedRole === 'PASSENGER'
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-border hover:bg-muted',
          )}
        >
          <input type="radio" value="PASSENGER" className="sr-only" {...register('role')} />
          Passenger
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
          Provider
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
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="name">Full name</Label>
        <Input
          id="name"
          type="text"
          placeholder="John Doe"
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
        <Label htmlFor="phone">
          Phone <span className="text-muted-foreground">(optional)</span>
        </Label>
        <Input
          id="phone"
          type="tel"
          placeholder="+1234567890"
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
          <Label htmlFor="providerName">Provider / company name</Label>
          <Input
            id="providerName"
            type="text"
            placeholder="Acme Transport Co."
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
  const config = strengthConfig[strength];

  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          placeholder="••••••••"
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
              aria-label={`Password strength: ${config.label}`}
            >
              <div
                className={cn('h-full rounded-full transition-all', config.width, config.color)}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Password strength: <span data-testid="strength-label">{config.label}</span>
            </p>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Confirm password</Label>
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
    </>
  );
}
