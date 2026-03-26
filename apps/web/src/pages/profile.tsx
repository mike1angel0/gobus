import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { usePageTitle } from '@/hooks/use-page-title';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ProfileEditForm } from '@/pages/profile-edit-form';
import { ProfileReadView } from '@/pages/profile-read-view';

/**
 * Loading skeleton displayed while auth state is resolving.
 */
function ProfileSkeleton() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <Card>
        <CardHeader>
          <Skeleton className="h-8 w-48" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-5 w-64" />
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-5 w-56" />
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * User profile page — view and edit profile information.
 *
 * Displays user info (name, email, phone, role, avatar, member since) in
 * read-only mode by default. Toggle to edit mode to update name, phone, and
 * avatar URL via `PATCH /api/v1/auth/me`.
 *
 * @example
 * ```tsx
 * <ProfilePage />
 * ```
 */
export default function ProfilePage() {
  usePageTitle('Profile');
  const { user, isLoading } = useAuth();
  const [editing, setEditing] = useState(false);

  if (isLoading) {
    return <ProfileSkeleton />;
  }

  if (!user) {
    return null;
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <Card>
        <CardContent className="pt-6">
          {editing ? (
            <ProfileEditForm user={user} onDone={() => setEditing(false)} />
          ) : (
            <ProfileReadView user={user} onEdit={() => setEditing(true)} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
