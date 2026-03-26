import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

/** Props for the {@link CardGridSkeleton} component. */
export interface CardGridSkeletonProps {
  /** Number of skeleton cards to render. Defaults to 6. */
  count?: number;
  /** Accessible label describing what is loading (e.g. "Loading fleet"). */
  label: string;
}

/**
 * Grid of skeleton cards used as a loading placeholder for card-based pages.
 *
 * Renders a responsive grid (1→2→3 columns) of animated skeleton cards with
 * a generic card shape (heading line + 3 detail lines). Sets `aria-busy` and
 * `aria-label` for assistive technologies.
 *
 * @example
 * ```tsx
 * <CardGridSkeleton label="Loading fleet" />
 * <CardGridSkeleton label="Loading drivers" count={4} />
 * ```
 */
export function CardGridSkeleton({ count = 6, label }: CardGridSkeletonProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true" aria-label={label}>
      {Array.from({ length: count }, (_, i) => (
        <Card key={i}>
          <CardContent className="p-6">
            <Skeleton className="mb-3 h-6 w-28" />
            <Skeleton className="mb-2 h-4 w-36" />
            <Skeleton className="mb-2 h-4 w-24" />
            <Skeleton className="h-4 w-20" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/** Props for the {@link CardListSkeleton} component. */
export interface CardListSkeletonProps {
  /** Number of skeleton items to render. Defaults to 3. */
  count?: number;
  /** Accessible label describing what is loading (e.g. "Loading trips"). */
  label: string;
}

/**
 * Vertical list of skeleton cards used as a loading placeholder for list-based pages.
 *
 * Renders a stack of animated skeleton cards with a generic list item shape
 * (two rows of content). Sets `aria-busy` and `aria-label` for assistive
 * technologies.
 *
 * @example
 * ```tsx
 * <CardListSkeleton label="Loading trips" />
 * <CardListSkeleton label="Loading bookings" count={5} />
 * ```
 */
export function CardListSkeleton({ count = 3, label }: CardListSkeletonProps) {
  return (
    <div className="space-y-4" aria-busy="true" aria-label={label}>
      {Array.from({ length: count }, (_, i) => (
        <Card key={i} className="p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-2">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-32" />
            </div>
            <Skeleton className="h-6 w-20" />
          </div>
          <div className="mt-3 flex gap-4">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-28" />
          </div>
        </Card>
      ))}
    </div>
  );
}
