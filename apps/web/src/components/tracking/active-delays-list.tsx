import { AlertTriangle, X } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useUpdateDelay } from '@/hooks/use-delays';
import type { components } from '@/api/generated/types';

type Delay = components['schemas']['Delay'];

/** Props for {@link ActiveDelaysList}. */
export interface ActiveDelaysListProps {
  /** Active delays to display. */
  delays: Delay[];
  /** Whether the delays are loading. */
  isLoading: boolean;
}

/** Skeleton placeholder for the delays list. */
function DelaysListSkeleton() {
  return (
    <div className="space-y-2" aria-busy="true" aria-label="Loading delays">
      {Array.from({ length: 2 }, (_, i) => (
        <Card key={i}>
          <CardContent className="p-3">
            <Skeleton className="mb-1 h-4 w-32" />
            <Skeleton className="h-3 w-24" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/**
 * Displays a list of active delays with a deactivate button for each.
 *
 * Shows delay reason, offset minutes, optional note, and a button to
 * deactivate each delay. Uses the `useUpdateDelay` hook to set `active: false`.
 *
 * @example
 * ```tsx
 * <ActiveDelaysList delays={activeDelays} isLoading={false} />
 * ```
 */
export function ActiveDelaysList({ delays, isLoading }: ActiveDelaysListProps) {
  const updateDelay = useUpdateDelay();

  if (isLoading) {
    return <DelaysListSkeleton />;
  }

  const activeDelays = delays.filter((d) => d.active);

  if (activeDelays.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-muted-foreground" role="status">
        No active delays
      </p>
    );
  }

  return (
    <div className="space-y-2" role="list" aria-label="Active delays" aria-live="polite">
      {activeDelays.map((delay) => (
        <Card key={delay.id} role="listitem">
          <CardContent className="flex items-center justify-between p-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 text-yellow-500" aria-hidden="true" />
                <span className="text-sm font-medium">
                  +{delay.offsetMinutes} min —{' '}
                  {delay.reason.charAt(0) + delay.reason.slice(1).toLowerCase()}
                </span>
              </div>
              {delay.note && (
                <p className="mt-1 truncate text-xs text-muted-foreground">{delay.note}</p>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Deactivate delay of ${delay.offsetMinutes} minutes`}
              disabled={updateDelay.isPending}
              onClick={() => updateDelay.mutate({ id: delay.id, body: { active: false } })}
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
