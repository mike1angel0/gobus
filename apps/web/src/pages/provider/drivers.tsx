import { useState } from 'react';
import { Users, Plus, Trash2, AlertCircle, Mail, Phone, Calendar } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
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
import { CreateDriverDialog } from '@/components/drivers/create-driver-dialog';
import { useDrivers, useDeleteDriver } from '@/hooks/use-drivers';
import type { components } from '@/api/generated/types';

type Driver = components['schemas']['Driver'];

/* ---------- Loading Skeleton ---------- */

/** Skeleton placeholder for the driver list while loading. */
function DriverListSkeleton() {
  return (
    <div
      className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
      aria-busy="true"
      aria-label="Loading drivers"
    >
      {Array.from({ length: 6 }, (_, i) => (
        <Card key={i}>
          <CardContent className="p-6">
            <Skeleton className="mb-3 h-6 w-32" />
            <Skeleton className="mb-2 h-4 w-48" />
            <Skeleton className="mb-2 h-4 w-36" />
            <Skeleton className="h-4 w-28" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/* ---------- Error State ---------- */

/** Props for {@link DriversError}. */
interface DriversErrorProps {
  /** Callback to retry loading. */
  onRetry: () => void;
}

/** Error state shown when driver list fails to load. */
function DriversError({ onRetry }: DriversErrorProps) {
  return (
    <div className="flex flex-col items-center py-16 text-center" role="alert">
      <AlertCircle className="mb-4 h-16 w-16 text-destructive" aria-hidden="true" />
      <h2 className="mb-2 text-xl font-semibold">Failed to load drivers</h2>
      <p className="mb-6 max-w-md text-muted-foreground">
        We couldn&apos;t load your drivers. Please try again.
      </p>
      <Button onClick={onRetry} variant="outline">
        Try again
      </Button>
    </div>
  );
}

/* ---------- Empty State ---------- */

/** Empty state shown when no drivers exist. */
function DriversEmpty() {
  return (
    <div className="flex flex-col items-center py-16 text-center" role="status">
      <Users className="mb-4 h-16 w-16 text-muted-foreground" aria-hidden="true" />
      <h2 className="mb-2 text-xl font-semibold">No drivers yet</h2>
      <p className="max-w-md text-muted-foreground">
        Create your first driver account to assign them to schedules.
      </p>
    </div>
  );
}

/* ---------- Driver Card ---------- */

/** Props for {@link DriverCard}. */
interface DriverCardProps {
  /** Driver data to display. */
  driver: Driver;
  /** Callback when delete is requested. */
  onDelete: (id: string) => void;
  /** Whether a delete operation is in progress. */
  isDeleting: boolean;
}

/** Displays a single driver card with info and delete action. */
function DriverCard({ driver, onDelete, isDeleting }: DriverCardProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <Card>
      <CardContent className="flex items-start justify-between p-6">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
            <h3 className="truncate font-semibold">{driver.name}</h3>
          </div>
          <div className="mt-2 space-y-1 text-sm text-muted-foreground">
            <p className="flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span className="truncate">{driver.email}</span>
            </p>
            {driver.phone && (
              <p className="flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>{driver.phone}</span>
              </p>
            )}
            <p className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>
                {driver.assignedScheduleCount}{' '}
                {driver.assignedScheduleCount === 1 ? 'schedule' : 'schedules'} assigned
              </span>
            </p>
          </div>
        </div>
        <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <DialogTrigger asChild>
            <Button variant="ghost" size="icon" aria-label={`Delete driver ${driver.name}`}>
              <Trash2 className="h-4 w-4 text-destructive" aria-hidden="true" />
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete driver</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete &quot;{driver.name}&quot;?
                {driver.assignedScheduleCount > 0 && (
                  <>
                    {' '}
                    This driver is assigned to {driver.assignedScheduleCount}{' '}
                    {driver.assignedScheduleCount === 1 ? 'schedule' : 'schedules'}.
                    They will be unassigned.
                  </>
                )}
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
                  onDelete(driver.id);
                  setConfirmOpen(false);
                }}
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

/* ---------- Driver List Section ---------- */

/** Props for {@link DriverListSection}. */
interface DriverListSectionProps {
  /** Driver data. */
  drivers: Driver[];
  /** Callback to delete a driver. */
  onDelete: (id: string) => void;
  /** Whether a delete mutation is in progress. */
  isDeleting: boolean;
}

/** Renders the grid of driver cards. */
function DriverListSection({ drivers, onDelete, isDeleting }: DriverListSectionProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="Drivers list">
      {drivers.map((driver) => (
        <DriverCard
          key={driver.id}
          driver={driver}
          onDelete={onDelete}
          isDeleting={isDeleting}
        />
      ))}
    </div>
  );
}

/* ---------- Page ---------- */

/**
 * Provider driver management page.
 *
 * Displays a list of the provider's drivers with create and delete functionality.
 * Drivers are shown in a responsive grid with name, email, phone, and assigned
 * schedule count. Creating a driver opens a dialog with a form. Deleting warns
 * about schedule unassignment impact.
 *
 * @example
 * ```
 * // Route: /provider/drivers (requires PROVIDER role)
 * <ProviderDriversPage />
 * ```
 */
export default function ProviderDriversPage() {
  const driversQuery = useDrivers({ page: 1, pageSize: 50 });
  const deleteDriver = useDeleteDriver();

  const drivers = driversQuery.data?.data ?? [];
  const isLoading = driversQuery.isLoading;
  const isError = driversQuery.isError && !driversQuery.data;

  function handleDelete(id: string) {
    deleteDriver.mutate(id);
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Drivers</h1>
          <p className="mt-1 text-muted-foreground">Manage your driver accounts and assignments.</p>
        </div>
        <CreateDriverDialog>
          <Button>
            <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
            Create driver
          </Button>
        </CreateDriverDialog>
      </div>

      <section aria-labelledby="drivers-heading">
        <h2 id="drivers-heading" className="sr-only">
          Drivers
        </h2>
        {isLoading && <DriverListSkeleton />}
        {isError && <DriversError onRetry={() => driversQuery.refetch()} />}
        {!isLoading && !isError && drivers.length === 0 && <DriversEmpty />}
        {!isLoading && !isError && drivers.length > 0 && (
          <DriverListSection
            drivers={drivers}
            onDelete={handleDelete}
            isDeleting={deleteDriver.isPending}
          />
        )}
      </section>
    </div>
  );
}
