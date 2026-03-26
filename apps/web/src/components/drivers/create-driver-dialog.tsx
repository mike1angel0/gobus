import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog';
import { useCreateDriver } from '@/hooks/use-drivers';
import { isApiError } from '@/api/errors';

/** Maximum email length per OpenAPI spec. */
const MAX_EMAIL_LENGTH = 255;
/** Maximum name length per OpenAPI spec. */
const MAX_NAME_LENGTH = 100;
/** Maximum password length per OpenAPI spec. */
const MAX_PASSWORD_LENGTH = 128;
/** Minimum password length per OpenAPI spec. */
const MIN_PASSWORD_LENGTH = 8;
/** Maximum phone length per OpenAPI spec. */
const MAX_PHONE_LENGTH = 20;
/** Password pattern: at least 1 uppercase, 1 lowercase, 1 digit. */
const PASSWORD_PATTERN = /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d).+$/;

/** Form field errors for create driver. */
interface CreateDriverErrors {
  /** Name field error. */
  name?: string;
  /** Email field error. */
  email?: string;
  /** Password field error. */
  password?: string;
  /** Phone field error. */
  phone?: string;
}

/** Validates create driver form fields against OpenAPI spec constraints. */
function validateForm(
  name: string,
  email: string,
  password: string,
  phone: string,
): CreateDriverErrors {
  const errors: CreateDriverErrors = {};
  const trimmedName = name.trim();
  const trimmedEmail = email.trim();
  const trimmedPhone = phone.trim();

  if (!trimmedName) {
    errors.name = 'Name is required.';
  } else if (trimmedName.length > MAX_NAME_LENGTH) {
    errors.name = `Name must be at most ${MAX_NAME_LENGTH} characters.`;
  }

  if (!trimmedEmail) {
    errors.email = 'Email is required.';
  } else if (trimmedEmail.length > MAX_EMAIL_LENGTH) {
    errors.email = `Email must be at most ${MAX_EMAIL_LENGTH} characters.`;
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
    errors.email = 'Please enter a valid email address.';
  }

  if (!password) {
    errors.password = 'Password is required.';
  } else if (password.length < MIN_PASSWORD_LENGTH) {
    errors.password = `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  } else if (password.length > MAX_PASSWORD_LENGTH) {
    errors.password = `Password must be at most ${MAX_PASSWORD_LENGTH} characters.`;
  } else if (!PASSWORD_PATTERN.test(password)) {
    errors.password = 'Password must contain at least 1 uppercase, 1 lowercase, and 1 digit.';
  }

  if (trimmedPhone && trimmedPhone.length > MAX_PHONE_LENGTH) {
    errors.phone = `Phone must be at most ${MAX_PHONE_LENGTH} characters.`;
  }

  return errors;
}

/** Props for {@link CreateDriverDialog}. */
interface CreateDriverDialogProps {
  /** Children used as the trigger element. */
  children: React.ReactNode;
}

/**
 * Dialog form for creating a new driver account.
 *
 * Collects name, email, password, and optional phone. Validates against
 * OpenAPI spec constraints and handles 409 email conflict errors with
 * a field-level message.
 */
export function CreateDriverDialog({ children }: CreateDriverDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [errors, setErrors] = useState<CreateDriverErrors>({});
  const createDriver = useCreateDriver();

  function resetForm() {
    setName('');
    setEmail('');
    setPassword('');
    setPhone('');
    setErrors({});
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const formErrors = validateForm(name, email, password, phone);
    setErrors(formErrors);
    if (Object.keys(formErrors).length > 0) return;

    const trimmedPhone = phone.trim();

    createDriver.mutate(
      {
        name: name.trim(),
        email: email.trim(),
        password,
        ...(trimmedPhone ? { phone: trimmedPhone } : {}),
      },
      {
        onSuccess: () => {
          resetForm();
          setOpen(false);
        },
        onError: (error: unknown) => {
          if (!isApiError(error)) return;
          if (error.status === 409) {
            setErrors((prev) => ({
              ...prev,
              email: 'A user with this email address already exists.',
            }));
            return;
          }
          for (const fe of error.fieldErrors) {
            if (fe.field === 'name' || fe.field === 'email' || fe.field === 'password' || fe.field === 'phone') {
              setErrors((prev) => ({ ...prev, [fe.field!]: fe.message }));
            }
          }
        },
      },
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        setOpen(isOpen);
        if (!isOpen) resetForm();
      }}
    >
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create driver</DialogTitle>
          <DialogDescription>
            Add a new driver account. The driver will use these credentials to log in.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="driver-name">Name</Label>
            <Input
              id="driver-name"
              placeholder="e.g. John Smith"
              maxLength={MAX_NAME_LENGTH}
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-invalid={!!errors.name}
              aria-describedby={errors.name ? 'driver-name-error' : undefined}
            />
            {errors.name && (
              <p id="driver-name-error" role="alert" className="text-sm text-destructive">
                {errors.name}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="driver-email">Email</Label>
            <Input
              id="driver-email"
              type="email"
              placeholder="e.g. john@example.com"
              maxLength={MAX_EMAIL_LENGTH}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? 'driver-email-error' : undefined}
            />
            {errors.email && (
              <p id="driver-email-error" role="alert" className="text-sm text-destructive">
                {errors.email}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="driver-password">Password</Label>
            <Input
              id="driver-password"
              type="password"
              placeholder="Min. 8 characters"
              maxLength={MAX_PASSWORD_LENGTH}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={!!errors.password}
              aria-describedby={errors.password ? 'driver-password-error' : undefined}
            />
            {errors.password && (
              <p id="driver-password-error" role="alert" className="text-sm text-destructive">
                {errors.password}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Must contain at least 1 uppercase, 1 lowercase, and 1 digit.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="driver-phone">
              Phone <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="driver-phone"
              type="tel"
              placeholder="e.g. +40 712 345 678"
              maxLength={MAX_PHONE_LENGTH}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              aria-invalid={!!errors.phone}
              aria-describedby={errors.phone ? 'driver-phone-error' : undefined}
            />
            {errors.phone && (
              <p id="driver-phone-error" role="alert" className="text-sm text-destructive">
                {errors.phone}
              </p>
            )}
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={createDriver.isPending}>
              {createDriver.isPending ? 'Creating...' : 'Create driver'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
