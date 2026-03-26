import { Pencil, User as UserIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { User } from '@/contexts/auth-types';

/** Props for {@link ProfileReadView}. */
interface ProfileReadViewProps {
  /** The current user to display. */
  user: User;
  /** Callback invoked when the user clicks Edit. */
  onEdit: () => void;
}

/** Formats an ISO date string to a human-readable date. */
function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/** Capitalises the first letter, lowercases the rest. */
function formatRole(role: string): string {
  return role.charAt(0).toUpperCase() + role.slice(1).toLowerCase();
}

/**
 * Read-only view of a user's profile information.
 *
 * Shows avatar, name, role, email, phone (if provided), and member-since date.
 * Includes an Edit button to switch to edit mode.
 */
export function ProfileReadView({ user, onEdit }: ProfileReadViewProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold leading-none tracking-tight">Profile</h1>
        <Button variant="outline" size="sm" onClick={onEdit} aria-label="Edit profile">
          <Pencil className="mr-1 h-4 w-4" aria-hidden="true" />
          Edit
        </Button>
      </div>
      <dl className="space-y-4">
        <div className="flex items-center gap-4">
          {user.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt={`${user.name}'s avatar`}
              className="h-16 w-16 rounded-full object-cover"
            />
          ) : (
            <div
              className="flex h-16 w-16 items-center justify-center rounded-full bg-muted"
              aria-hidden="true"
            >
              <UserIcon className="h-8 w-8 text-muted-foreground" />
            </div>
          )}
          <div>
            <dt className="sr-only">Name</dt>
            <dd className="text-lg font-semibold">{user.name}</dd>
            <dt className="sr-only">Role</dt>
            <dd className="text-sm text-muted-foreground">{formatRole(user.role)}</dd>
          </div>
        </div>
        <div>
          <dt className="text-sm font-medium text-muted-foreground">Email</dt>
          <dd className="mt-1">{user.email}</dd>
        </div>
        {user.phone && (
          <div>
            <dt className="text-sm font-medium text-muted-foreground">Phone</dt>
            <dd className="mt-1">{user.phone}</dd>
          </div>
        )}
        <div>
          <dt className="text-sm font-medium text-muted-foreground">Member since</dt>
          <dd className="mt-1">{formatDate(user.createdAt)}</dd>
        </div>
      </dl>
    </div>
  );
}
