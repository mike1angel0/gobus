import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, X } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { isApiError } from '@/api/errors';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { profileSchema, type ProfileFormValues } from '@/pages/profile-schema';
import type { User } from '@/contexts/auth-types';

/** Props for {@link ProfileEditForm}. */
interface ProfileEditFormProps {
  /** The current user whose profile is being edited. */
  user: User;
  /** Callback invoked after a successful save or when cancel is clicked. */
  onDone: () => void;
}

/**
 * Profile edit form with name, phone, and avatar URL fields.
 *
 * Uses React Hook Form with Zod validation matching the OpenAPI `UserUpdate`
 * schema constraints. Maps RFC 9457 field errors to form fields on failure.
 */
export function ProfileEditForm({ user, onDone }: ProfileEditFormProps) {
  const { updateProfile } = useAuth();
  const [rootError, setRootError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: user.name,
      phone: user.phone ?? '',
      avatarUrl: user.avatarUrl ?? '',
    },
  });

  /** Handles form submission: sends profile update to API. */
  async function onSubmit(data: ProfileFormValues) {
    setRootError(null);
    try {
      await updateProfile({
        name: data.name,
        phone: data.phone || undefined,
        avatarUrl: data.avatarUrl || undefined,
      });
      onDone();
      toast({
        title: 'Profile updated',
        description: 'Your profile has been updated successfully.',
      });
    } catch (error: unknown) {
      if (!isApiError(error)) {
        setRootError('An unexpected error occurred. Please try again.');
        return;
      }
      for (const fieldError of error.fieldErrors) {
        const field = fieldError.field as keyof ProfileFormValues;
        if (field === 'name' || field === 'phone' || field === 'avatarUrl') {
          setError(field, { message: fieldError.message });
        }
      }
      if (error.fieldErrors.length === 0) {
        setRootError(error.detail ?? error.title);
      }
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold leading-none tracking-tight">Edit Profile</h1>
        <Button variant="ghost" size="sm" onClick={onDone} aria-label="Cancel editing">
          <X className="mr-1 h-4 w-4" aria-hidden="true" />
          Cancel
        </Button>
      </div>
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
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            type="text"
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
          <Label htmlFor="phone">Phone</Label>
          <Input
            id="phone"
            type="tel"
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
        <div className="space-y-2">
          <Label htmlFor="avatarUrl">Avatar URL</Label>
          <Input
            id="avatarUrl"
            type="url"
            placeholder="https://example.com/avatar.jpg"
            aria-invalid={!!errors.avatarUrl}
            aria-describedby={errors.avatarUrl ? 'avatarUrl-error' : undefined}
            className={cn(errors.avatarUrl && 'border-destructive')}
            {...register('avatarUrl')}
          />
          {errors.avatarUrl && (
            <p id="avatarUrl-error" role="alert" className="text-sm text-destructive">
              {errors.avatarUrl.message}
            </p>
          )}
        </div>
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="animate-spin" aria-hidden="true" />
              <span>Saving…</span>
            </>
          ) : (
            'Save changes'
          )}
        </Button>
      </form>
    </div>
  );
}
