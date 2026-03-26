import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useBusDetail, useUpdateBus } from '@/hooks/use-buses';
import { useToast } from '@/hooks/use-toast';
import { SeatMapEditor } from '@/components/fleet/seat-map-editor';
import type { components } from '@/api/generated/types';

type Seat = components['schemas']['Seat'];

/** Props for {@link EditBusDialog}. */
export interface EditBusDialogProps {
  /** ID of the bus to edit. */
  busId: string;
  /** Callback when the dialog is closed. */
  onClose: () => void;
}

/**
 * Dialog that loads a bus's seat layout and displays the {@link SeatMapEditor}.
 *
 * Fetches the full bus detail (including seats) via `useBusDetail`, then renders
 * the interactive seat map editor. Save is currently a no-op toast notification
 * because the API does not yet support seat layout updates (see SPEC_GAPS.md).
 */
export function EditBusDialog({ busId, onClose }: EditBusDialogProps) {
  const { t } = useTranslation('provider');
  const busQuery = useBusDetail(busId);
  const updateBus = useUpdateBus();
  const { toast } = useToast();
  const bus = busQuery.data?.data;

  const handleSave = useCallback(
    (_seats: Seat[]) => {
      // Spec gap: PUT /api/v1/buses/{id} does not accept a seats field.
      // When the spec is updated to support seat layout changes, wire this up.
      // For now, show a toast indicating the limitation.
      toast({
        title: t('fleet.editDialog.savedTitle'),
        description: t('fleet.editDialog.savedDescription'),
      });
      onClose();
    },
    [toast, onClose, t],
  );

  return (
    <Dialog
      open
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {bus
              ? t('fleet.editDialog.titleWithPlate', { plate: bus.licensePlate })
              : t('fleet.editDialog.title')}
          </DialogTitle>
          <DialogDescription>{t('fleet.editDialog.description')}</DialogDescription>
        </DialogHeader>

        {busQuery.isLoading && (
          <div
            aria-busy="true"
            aria-label={t('fleet.editDialog.loadingLabel')}
            className="space-y-2"
          >
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-40 w-64" />
            <Skeleton className="h-6 w-48" />
          </div>
        )}

        {busQuery.isError && (
          <p role="alert" className="text-sm text-destructive">
            {t('fleet.editDialog.loadError')}
          </p>
        )}

        {bus && bus.seats && (
          <SeatMapEditor
            seats={bus.seats}
            rows={bus.rows}
            columns={bus.columns}
            onSave={handleSave}
            onCancel={onClose}
            isSaving={updateBus.isPending}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
