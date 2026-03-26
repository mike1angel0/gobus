import type { LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

/** Action rendered as a link-style button below the empty state message. */
export interface EmptyStateAction {
  /** Button label text. */
  label: string;
  /** Route path to navigate to. */
  href: string;
}

/** Props for the {@link EmptyState} component. */
export interface EmptyStateProps {
  /** Lucide icon displayed above the heading. */
  icon: LucideIcon;
  /** Heading text (e.g. "No buses yet"). */
  title: string;
  /** Descriptive message shown below the heading. */
  message: string;
  /** Optional call-to-action link rendered as an outline button. */
  action?: EmptyStateAction;
}

/**
 * Full-width centred empty state with icon, heading, message, and optional CTA.
 *
 * Used as the standard empty UI across all pages when a data list is empty.
 * Includes `role="status"` so assistive technologies can announce the state.
 *
 * @example
 * ```tsx
 * <EmptyState
 *   icon={BusIcon}
 *   title="No buses yet"
 *   message="Add your first bus to start creating schedules."
 *   action={{ label: "Add bus", href: "/provider/fleet" }}
 * />
 * ```
 */
export function EmptyState({ icon: Icon, title, message, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center py-16 text-center" role="status">
      <Icon className="mb-4 h-16 w-16 text-muted-foreground" aria-hidden="true" />
      <h2 className="mb-2 text-xl font-semibold">{title}</h2>
      <p className={`max-w-md text-muted-foreground${action ? ' mb-6' : ''}`}>{message}</p>
      {action && (
        <Button variant="outline" asChild>
          <Link to={action.href}>{action.label}</Link>
        </Button>
      )}
    </div>
  );
}
