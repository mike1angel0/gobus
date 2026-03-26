import { useState } from 'react';
import { Bus as BusIcon, Plus, Trash2, Pencil } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CardGridSkeleton } from '@/components/shared/loading-skeleton';
import { PageError } from '@/components/shared/error-state';
import { EmptyState } from '@/components/shared/empty-state';
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
import { useBuses, useDeleteBus } from '@/hooks/use-buses';
import { CreateBusDialog, SeatGridPreview } from '@/components/fleet/create-bus-dialog';
import { EditBusDialog } from '@/components/fleet/edit-bus-dialog';
import type { components } from '@/api/generated/types';

type Bus = components['schemas']['Bus'];

/* ---------- Bus Card ---------- */

/** Props for {@link BusCard}. */
interface BusCardProps {
  /** Bus data to display. */
  bus: Bus;
  /** Callback when delete is requested. */
  onDelete: (id: string) => void;
  /** Whether a delete operation is in progress. */
  isDeleting: boolean;
  /** Callback when edit is requested. */
  onEdit: (id: string) => void;
}

/** Displays a single bus card with plate, model, capacity, and seat grid preview. */
function BusCard({ bus, onDelete, isDeleting, onEdit }: BusCardProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <Card>
      <CardContent className="flex items-start justify-between p-6">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <BusIcon className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
            <h3 className="truncate font-semibold">{bus.licensePlate}</h3>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{bus.model}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {bus.capacity} seats · {bus.rows}×{bus.columns}
          </p>
          <div className="mt-2">
            <SeatGridPreview rows={bus.rows} columns={bus.columns} seats={[]} />
          </div>
        </div>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Edit seat map for ${bus.licensePlate}`}
            onClick={() => onEdit(bus.id)}
          >
            <Pencil className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          </Button>
          <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon" aria-label={`Delete bus ${bus.licensePlate}`}>
                <Trash2 className="h-4 w-4 text-destructive" aria-hidden="true" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete bus</DialogTitle>
                <DialogDescription>
                  Are you sure you want to delete bus &quot;{bus.licensePlate}&quot;? Schedules
                  referencing this bus may be affected.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">Cancel</Button>
                </DialogClose>
                <Button
                  variant="destructive"
                  disabled={isDeleting}
                  onClick={() => {
                    onDelete(bus.id);
                    setConfirmOpen(false);
                  }}
                >
                  {isDeleting ? 'Deleting…' : 'Delete'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardContent>
    </Card>
  );
}

/* ---------- Bus List Section ---------- */

/** Props for {@link BusListSection}. */
interface BusListSectionProps {
  /** Bus data. */
  buses: Bus[];
  /** Callback to delete a bus. */
  onDelete: (id: string) => void;
  /** Whether a delete mutation is in progress. */
  isDeleting: boolean;
  /** Callback to edit a bus. */
  onEdit: (id: string) => void;
}

/** Renders the grid of bus cards. */
function BusListSection({ buses, onDelete, isDeleting, onEdit }: BusListSectionProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="Fleet list">
      {buses.map((bus) => (
        <BusCard
          key={bus.id}
          bus={bus}
          onDelete={onDelete}
          isDeleting={isDeleting}
          onEdit={onEdit}
        />
      ))}
    </div>
  );
}

/* ---------- Page ---------- */

/**
 * Provider fleet management page.
 *
 * Displays a list of the provider's buses with create and delete functionality.
 * Buses are shown in a responsive grid with seat layout previews. Creating a bus
 * opens a dialog with template selection or manual configuration options.
 *
 * @example
 * ```
 * // Route: /provider/fleet (requires PROVIDER role)
 * <ProviderFleetPage />
 * ```
 */
export default function ProviderFleetPage() {
  const busesQuery = useBuses({ page: 1, pageSize: 50 });
  const deleteBus = useDeleteBus();
  const [editingBusId, setEditingBusId] = useState<string | null>(null);

  const buses = busesQuery.data?.data ?? [];
  const isLoading = busesQuery.isLoading;
  const isError = busesQuery.isError && !busesQuery.data;

  function handleDelete(id: string) {
    deleteBus.mutate(id);
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Fleet</h1>
          <p className="mt-1 text-muted-foreground">Manage your buses and seat configurations.</p>
        </div>
        <CreateBusDialog>
          <Button>
            <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
            Add bus
          </Button>
        </CreateBusDialog>
      </div>

      <section aria-labelledby="fleet-heading">
        <h2 id="fleet-heading" className="sr-only">
          Fleet
        </h2>
        {isLoading && <CardGridSkeleton label="Loading fleet" />}
        {isError && (
          <PageError
            title="Failed to load fleet"
            message="We couldn't load your buses. Please try again."
            onRetry={() => busesQuery.refetch()}
          />
        )}
        {!isLoading && !isError && buses.length === 0 && (
          <EmptyState
            icon={BusIcon}
            title="No buses yet"
            message="Add your first bus to start creating schedules."
          />
        )}
        {!isLoading && !isError && buses.length > 0 && (
          <BusListSection
            buses={buses}
            onDelete={handleDelete}
            isDeleting={deleteBus.isPending}
            onEdit={setEditingBusId}
          />
        )}
      </section>

      {editingBusId && <EditBusDialog busId={editingBusId} onClose={() => setEditingBusId(null)} />}
    </div>
  );
}
