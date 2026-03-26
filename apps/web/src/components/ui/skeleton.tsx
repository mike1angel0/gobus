import { cn } from '@/lib/utils';

/**
 * Skeleton placeholder used for loading states. Renders an animated pulse
 * block that mimics content dimensions while data is being fetched.
 *
 * @example
 * ```tsx
 * <Skeleton className="h-4 w-[200px]" />
 * <Skeleton className="h-12 w-full rounded-lg" />
 * ```
 */
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('animate-pulse rounded-md bg-muted', className)} {...props} />;
}

export { Skeleton };
