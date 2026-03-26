import { AlertTriangle, Building2, Mail, Phone } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { PageError } from '@/components/shared/error-state';
import { useProviderProfile } from '@/hooks/use-provider-profile';

/** Formats an ISO date string to a human-readable date. */
function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Loading skeleton displayed while the provider profile is being fetched.
 */
function ProfileSkeleton() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-8" aria-label="Loading provider profile" aria-busy="true">
      <Card>
        <CardHeader>
          <Skeleton className="h-8 w-48" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-16 w-16 rounded-full" />
          <Skeleton className="h-5 w-64" />
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-5 w-32" />
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Provider profile page — displays the authenticated provider's company information.
 *
 * Shows provider name, logo, contact email, contact phone, approval status
 * (APPROVED/PENDING badge), and registration date. Displays a warning banner
 * when the provider's account is still pending approval.
 *
 * Accessible at `/provider/profile` for users with the PROVIDER role.
 *
 * @example
 * ```tsx
 * <ProviderProfilePage />
 * ```
 */
export default function ProviderProfilePage() {
  const { data, isLoading, isError, refetch } = useProviderProfile();

  if (isLoading) {
    return <ProfileSkeleton />;
  }

  if (isError || !data) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <PageError
          title="Failed to load profile"
          message="We couldn't load your provider profile. Please try again."
          onRetry={() => void refetch()}
        />
      </div>
    );
  }

  const provider = data.data;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      {provider.status === 'PENDING' && (
        <div
          role="alert"
          className="mb-6 flex items-center gap-3 rounded-md border border-yellow-300 bg-yellow-50 p-4 text-sm text-yellow-800 dark:border-yellow-700 dark:bg-yellow-950 dark:text-yellow-200"
        >
          <AlertTriangle className="h-5 w-5 shrink-0" aria-hidden="true" />
          <p>Your provider account is pending approval</p>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Provider Profile</span>
            <Badge variant={provider.status === 'APPROVED' ? 'default' : 'secondary'}>
              {provider.status}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="space-y-4">
            <div className="flex items-center gap-4">
              {provider.logo ? (
                <img
                  src={provider.logo}
                  alt={`${provider.name} logo`}
                  className="h-16 w-16 rounded-full object-cover"
                />
              ) : (
                <div
                  className="flex h-16 w-16 items-center justify-center rounded-full bg-muted"
                  aria-hidden="true"
                >
                  <Building2 className="h-8 w-8 text-muted-foreground" />
                </div>
              )}
              <div>
                <dt className="sr-only">Company name</dt>
                <dd className="text-lg font-semibold">{provider.name}</dd>
              </div>
            </div>

            {provider.contactEmail && (
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                <dt className="sr-only">Contact email</dt>
                <dd>{provider.contactEmail}</dd>
              </div>
            )}

            {provider.contactPhone && (
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                <dt className="sr-only">Contact phone</dt>
                <dd>{provider.contactPhone}</dd>
              </div>
            )}

            <div>
              <dt className="text-sm font-medium text-muted-foreground">Registered</dt>
              <dd className="mt-1">{formatDate(provider.createdAt)}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
