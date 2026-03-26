import { useState, useMemo } from 'react';
import { LayoutGrid, FileText } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { useBusTemplates, useCreateBus } from '@/hooks/use-buses';
import { isApiError } from '@/api/errors';
import type { components } from '@/api/generated/types';

type BusTemplate = components['schemas']['BusTemplate'];
type CreateSeatInput = components['schemas']['CreateSeatInput'];
type SeatType = components['schemas']['SeatType'];

/** Maximum license plate length per OpenAPI spec. */
const MAX_LICENSE_PLATE_LENGTH = 20;
/** Maximum model name length per OpenAPI spec. */
const MAX_MODEL_LENGTH = 100;
/** Maximum rows per OpenAPI spec. */
const MAX_ROWS = 100;
/** Maximum columns per OpenAPI spec. */
const MAX_COLUMNS = 10;

/** Seat type display colors for the mini grid preview. */
const SEAT_TYPE_COLORS: Record<SeatType, string> = {
  STANDARD: 'bg-green-200 border-green-400',
  PREMIUM: 'bg-amber-200 border-amber-400',
  DISABLED_ACCESSIBLE: 'bg-blue-200 border-blue-400',
  BLOCKED: 'bg-gray-200 border-gray-400',
};

/* ---------- Seat Grid Preview ---------- */

/** Props for {@link SeatGridPreview}. */
interface SeatGridPreviewProps {
  /** Number of rows in the seat layout. */
  rows: number;
  /** Number of columns in the seat layout. */
  columns: number;
  /** Seat data with type information. */
  seats: ReadonlyArray<{ row: number; column: number; type: SeatType }>;
}

/** Mini visual preview of a seat grid layout. */
export function SeatGridPreview({ rows, columns, seats }: SeatGridPreviewProps) {
  const { t } = useTranslation('provider');

  const seatMap = useMemo(() => {
    const map = new Map<string, SeatType>();
    for (const seat of seats) {
      map.set(`${seat.row}-${seat.column}`, seat.type);
    }
    return map;
  }, [seats]);

  const visibleRows = Math.min(rows, 8);

  return (
    <div aria-label={t('fleet.seatGridPreview.label', { rows, columns })} className="space-y-0.5">
      {Array.from({ length: visibleRows }, (_, r) => (
        <div key={r} className="flex gap-0.5">
          {Array.from({ length: columns }, (_, c) => {
            const type = seatMap.get(`${r + 1}-${c + 1}`);
            return (
              <div
                key={c}
                className={`h-3 w-3 rounded-sm border ${type ? SEAT_TYPE_COLORS[type] : 'border-dashed border-gray-300'}`}
                aria-hidden="true"
              />
            );
          })}
        </div>
      ))}
      {rows > 8 && (
        <p className="text-[10px] text-muted-foreground">
          {t('fleet.seatGridPreview.moreRows', { count: rows - 8 })}
        </p>
      )}
    </div>
  );
}

/* ---------- Seat Generator ---------- */

/** Generates a default seat layout from rows and columns. */
function generateSeats(rows: number, columns: number): CreateSeatInput[] {
  const seats: CreateSeatInput[] = [];
  for (let r = 1; r <= rows; r++) {
    for (let c = 1; c <= columns; c++) {
      seats.push({
        row: r,
        column: c,
        label: `${r}${String.fromCharCode(64 + c)}`,
        type: 'STANDARD',
        price: 0,
      });
    }
  }
  return seats;
}

/* ---------- Template Card ---------- */

/** Props for {@link TemplateCard}. */
interface TemplateCardProps {
  /** Bus template data. */
  template: BusTemplate;
  /** Whether this template is currently selected. */
  isSelected: boolean;
  /** Callback when template is selected. */
  onSelect: () => void;
}

/** Visual card for a bus template with seat grid preview. */
function TemplateCard({ template, isSelected, onSelect }: TemplateCardProps) {
  const { t } = useTranslation('provider');

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={isSelected}
      className={`w-full rounded-lg border p-3 text-left transition-colors ${
        isSelected
          ? 'border-primary bg-primary/5 ring-2 ring-primary'
          : 'border-border hover:border-primary/50'
      }`}
    >
      <p className="text-sm font-medium">{template.name}</p>
      <p className="text-xs text-muted-foreground">
        {t('fleet.templateSelector.seatsLayout', {
          capacity: template.capacity,
          rows: template.rows,
          columns: template.columns,
        })}
      </p>
      <div className="mt-2">
        <SeatGridPreview rows={template.rows} columns={template.columns} seats={template.seats} />
      </div>
    </button>
  );
}

/* ---------- Template Selector ---------- */

/** Props for {@link TemplateSelector}. */
interface TemplateSelectorProps {
  /** ID of the currently selected template. */
  selectedId: string | null;
  /** Callback when a template is selected. */
  onSelect: (id: string) => void;
  /** Validation error message. */
  error?: string;
}

/** Template selector fieldset with loading/empty states. */
function TemplateSelector({ selectedId, onSelect, error }: TemplateSelectorProps) {
  const { t } = useTranslation('provider');
  const templatesQuery = useBusTemplates();
  const templates = templatesQuery.data?.data ?? [];

  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-medium">{t('fleet.templateSelector.legend')}</legend>
      {templatesQuery.isLoading && (
        <div
          aria-busy="true"
          aria-label={t('fleet.templateSelector.loading')}
          className="space-y-2"
        >
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      )}
      {!templatesQuery.isLoading && templates.length === 0 && (
        <p className="text-sm text-muted-foreground">{t('fleet.templateSelector.empty')}</p>
      )}
      {!templatesQuery.isLoading && templates.length > 0 && (
        <div
          className="grid gap-2 sm:grid-cols-2"
          aria-label={t('fleet.templateSelector.listLabel')}
        >
          {templates.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              isSelected={selectedId === template.id}
              onSelect={() => onSelect(template.id)}
            />
          ))}
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </fieldset>
  );
}

/* ---------- Manual Config ---------- */

/** Props for {@link ManualConfig}. */
interface ManualConfigProps {
  /** Current rows value. */
  rowsStr: string;
  /** Current columns value. */
  columnsStr: string;
  /** Callback for rows change. */
  onRowsChange: (value: string) => void;
  /** Callback for columns change. */
  onColumnsChange: (value: string) => void;
  /** Rows validation error. */
  rowsError?: string;
  /** Columns validation error. */
  columnsError?: string;
}

/** Manual row/column configuration with seat preview. */
function ManualConfig({
  rowsStr,
  columnsStr,
  onRowsChange,
  onColumnsChange,
  rowsError,
  columnsError,
}: ManualConfigProps) {
  const { t } = useTranslation('provider');
  const showPreview = rowsStr && columnsStr && !rowsError && !columnsError;

  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="space-y-2">
        <Label htmlFor="bus-rows">{t('fleet.manualConfig.rowsLabel')}</Label>
        <Input
          id="bus-rows"
          type="number"
          min={1}
          max={MAX_ROWS}
          placeholder={t('fleet.manualConfig.rowsPlaceholder')}
          value={rowsStr}
          onChange={(e) => onRowsChange(e.target.value)}
          aria-invalid={!!rowsError}
          aria-describedby={rowsError ? 'rows-error' : undefined}
        />
        {rowsError && (
          <p id="rows-error" role="alert" className="text-sm text-destructive">
            {rowsError}
          </p>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="bus-columns">{t('fleet.manualConfig.columnsLabel')}</Label>
        <Input
          id="bus-columns"
          type="number"
          min={1}
          max={MAX_COLUMNS}
          placeholder={t('fleet.manualConfig.columnsPlaceholder')}
          value={columnsStr}
          onChange={(e) => onColumnsChange(e.target.value)}
          aria-invalid={!!columnsError}
          aria-describedby={columnsError ? 'columns-error' : undefined}
        />
        {columnsError && (
          <p id="columns-error" role="alert" className="text-sm text-destructive">
            {columnsError}
          </p>
        )}
      </div>
      {showPreview && (
        <div className="col-span-2">
          <p className="mb-1 text-xs text-muted-foreground">{t('fleet.manualConfig.preview')}</p>
          <SeatGridPreview
            rows={parseInt(rowsStr, 10) || 0}
            columns={parseInt(columnsStr, 10) || 0}
            seats={generateSeats(parseInt(rowsStr, 10) || 0, parseInt(columnsStr, 10) || 0)}
          />
        </div>
      )}
    </div>
  );
}

/* ---------- Validation ---------- */

/** Form errors type for the create bus form. */
interface CreateBusErrors {
  /** License plate error. */
  licensePlate?: string;
  /** Model error. */
  model?: string;
  /** Rows error (also used for template selection). */
  rows?: string;
  /** Columns error. */
  columns?: string;
}

/** Validates the create bus form fields. */
function validateForm(
  licensePlate: string,
  model: string,
  mode: 'template' | 'manual',
  rowsStr: string,
  columnsStr: string,
  hasTemplate: boolean,
  t: TFunction,
): CreateBusErrors {
  const errors: CreateBusErrors = {};
  const plate = licensePlate.trim();
  const mdl = model.trim();

  if (!plate) {
    errors.licensePlate = t('fleet.validation.licensePlateRequired');
  } else if (plate.length > MAX_LICENSE_PLATE_LENGTH) {
    errors.licensePlate = t('fleet.validation.licensePlateMaxLength', {
      max: MAX_LICENSE_PLATE_LENGTH,
    });
  }

  if (!mdl) {
    errors.model = t('fleet.validation.modelRequired');
  } else if (mdl.length > MAX_MODEL_LENGTH) {
    errors.model = t('fleet.validation.modelMaxLength', { max: MAX_MODEL_LENGTH });
  }

  if (mode === 'manual') {
    const rows = parseInt(rowsStr, 10);
    const columns = parseInt(columnsStr, 10);
    if (isNaN(rows) || rows < 1 || rows > MAX_ROWS) {
      errors.rows = t('fleet.validation.rowsRange', { max: MAX_ROWS });
    }
    if (isNaN(columns) || columns < 1 || columns > MAX_COLUMNS) {
      errors.columns = t('fleet.validation.columnsRange', { max: MAX_COLUMNS });
    }
  } else if (!hasTemplate) {
    errors.rows = t('fleet.validation.templateRequired');
  }

  return errors;
}

/* ---------- Create Bus Dialog ---------- */

/** Props for {@link CreateBusDialog}. */
interface CreateBusDialogProps {
  /** Children used as the trigger element. */
  children: React.ReactNode;
}

/**
 * Dialog form for creating a new bus with template selection or manual configuration.
 *
 * Supports two modes: selecting a predefined bus template, or manually specifying
 * rows and columns. Both modes require license plate and model inputs.
 */
export function CreateBusDialog({ children }: CreateBusDialogProps) {
  const { t } = useTranslation('provider');
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'template' | 'manual'>('template');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [licensePlate, setLicensePlate] = useState('');
  const [model, setModel] = useState('');
  const [rowsStr, setRowsStr] = useState('');
  const [columnsStr, setColumnsStr] = useState('');
  const [errors, setErrors] = useState<CreateBusErrors>({});
  const createBus = useCreateBus();
  const templatesQuery = useBusTemplates();
  const templates = templatesQuery.data?.data ?? [];
  const selectedTemplate = templates.find((tmpl) => tmpl.id === selectedTemplateId) ?? null;

  function resetForm() {
    setMode('template');
    setSelectedTemplateId(null);
    setLicensePlate('');
    setModel('');
    setRowsStr('');
    setColumnsStr('');
    setErrors({});
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const formErrors = validateForm(
      licensePlate,
      model,
      mode,
      rowsStr,
      columnsStr,
      !!selectedTemplate,
      t,
    );
    setErrors(formErrors);
    if (Object.keys(formErrors).length > 0) return;

    const rows = mode === 'template' ? selectedTemplate!.rows : parseInt(rowsStr, 10);
    const columns = mode === 'template' ? selectedTemplate!.columns : parseInt(columnsStr, 10);
    const seats = mode === 'template' ? selectedTemplate!.seats : generateSeats(rows, columns);

    createBus.mutate(
      {
        licensePlate: licensePlate.trim(),
        model: model.trim(),
        capacity: seats.length,
        rows,
        columns,
        seats,
      },
      {
        onSuccess: () => {
          resetForm();
          setOpen(false);
        },
        onError: (error: unknown) => {
          if (!isApiError(error)) return;
          if (error.status === 409) {
            setErrors((prev) => ({
              ...prev,
              licensePlate: t('fleet.validation.licensePlateConflict'),
            }));
            return;
          }
          for (const fe of error.fieldErrors) {
            if (fe.field === 'licensePlate' || fe.field === 'model') {
              setErrors((prev) => ({ ...prev, [fe.field!]: fe.message }));
            }
          }
        },
      },
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        setOpen(isOpen);
        if (!isOpen) resetForm();
      }}
    >
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t('fleet.createDialog.title')}</DialogTitle>
          <DialogDescription>{t('fleet.createDialog.description')}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="bus-license-plate">{t('fleet.createDialog.licensePlateLabel')}</Label>
            <Input
              id="bus-license-plate"
              placeholder={t('fleet.createDialog.licensePlatePlaceholder')}
              maxLength={MAX_LICENSE_PLATE_LENGTH}
              value={licensePlate}
              onChange={(e) => setLicensePlate(e.target.value)}
              aria-invalid={!!errors.licensePlate}
              aria-describedby={errors.licensePlate ? 'license-plate-error' : undefined}
            />
            {errors.licensePlate && (
              <p id="license-plate-error" role="alert" className="text-sm text-destructive">
                {errors.licensePlate}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="bus-model">{t('fleet.createDialog.modelLabel')}</Label>
            <Input
              id="bus-model"
              placeholder={t('fleet.createDialog.modelPlaceholder')}
              maxLength={MAX_MODEL_LENGTH}
              value={model}
              onChange={(e) => setModel(e.target.value)}
              aria-invalid={!!errors.model}
              aria-describedby={errors.model ? 'model-error' : undefined}
            />
            {errors.model && (
              <p id="model-error" role="alert" className="text-sm text-destructive">
                {errors.model}
              </p>
            )}
          </div>

          <div
            className="flex gap-2"
            role="radiogroup"
            aria-label={t('fleet.createDialog.configModeLabel')}
          >
            <Button
              type="button"
              variant={mode === 'template' ? 'default' : 'outline'}
              size="sm"
              role="radio"
              aria-checked={mode === 'template'}
              onClick={() => setMode('template')}
            >
              <LayoutGrid className="mr-1 h-4 w-4" aria-hidden="true" />
              {t('fleet.createDialog.template')}
            </Button>
            <Button
              type="button"
              variant={mode === 'manual' ? 'default' : 'outline'}
              size="sm"
              role="radio"
              aria-checked={mode === 'manual'}
              onClick={() => setMode('manual')}
            >
              <FileText className="mr-1 h-4 w-4" aria-hidden="true" />
              {t('fleet.createDialog.manual')}
            </Button>
          </div>

          {mode === 'template' && (
            <TemplateSelector
              selectedId={selectedTemplateId}
              onSelect={setSelectedTemplateId}
              error={errors.rows && !errors.columns ? errors.rows : undefined}
            />
          )}

          {mode === 'manual' && (
            <ManualConfig
              rowsStr={rowsStr}
              columnsStr={columnsStr}
              onRowsChange={setRowsStr}
              onColumnsChange={setColumnsStr}
              rowsError={errors.rows}
              columnsError={errors.columns}
            />
          )}

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                {t('common.cancel')}
              </Button>
            </DialogClose>
            <Button type="submit" disabled={createBus.isPending}>
              {createBus.isPending
                ? t('fleet.createDialog.creating')
                : t('fleet.createDialog.addBusButton')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
