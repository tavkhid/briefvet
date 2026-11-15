'use client';

import { Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { FREQUENCY_OPTIONS } from '@/lib/vet';

export interface PrescriptionDraft {
  key: string;
  medicationName: string;
  dose: string;
  frequencyPerDay: number;
  durationDays: number;
  firstDoseAt: string;
}

interface PrescriptionFieldsProps {
  index: number;
  draft: PrescriptionDraft;
  canRemove: boolean;
  onChange: (patch: Partial<PrescriptionDraft>) => void;
  onRemove: () => void;
}

const selectClassName =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

export function PrescriptionFields({ index, draft, canRemove, onChange, onRemove }: PrescriptionFieldsProps) {
  const id = `prescription-${draft.key}`;

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-5">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-900">Препарат {index + 1}</p>
        {canRemove && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onRemove}
            aria-label={`Удалить препарат ${index + 1}`}
            className="h-8 px-2 text-slate-500 transition-colors hover:bg-red-50 hover:text-red-700"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`${id}-name`}>Препарат</Label>
          <Input
            id={`${id}-name`}
            required
            value={draft.medicationName}
            onChange={(event) => onChange({ medicationName: event.target.value })}
            placeholder="Амоксициллин"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${id}-dose`}>Дозировка</Label>
          <Input
            id={`${id}-dose`}
            required
            value={draft.dose}
            onChange={(event) => onChange({ dose: event.target.value })}
            placeholder="1 таблетка (50 мг)"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${id}-frequency`}>Сколько раз в день</Label>
          <select
            id={`${id}-frequency`}
            className={selectClassName}
            value={draft.frequencyPerDay}
            onChange={(event) => onChange({ frequencyPerDay: Number(event.target.value) })}
          >
            {FREQUENCY_OPTIONS.map((count) => (
              <option key={count} value={count}>
                {count} {count === 1 ? 'раз' : 'раза'} в день
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${id}-duration`}>Длительность, дней</Label>
          <Input
            id={`${id}-duration`}
            type="number"
            min={1}
            max={365}
            required
            value={draft.durationDays}
            onChange={(event) => onChange({ durationDays: Number(event.target.value) })}
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor={`${id}-first-dose`}>Время первого приёма</Label>
          <Input
            id={`${id}-first-dose`}
            type="datetime-local"
            required
            value={draft.firstDoseAt}
            onChange={(event) => onChange({ firstDoseAt: event.target.value })}
          />
        </div>
      </div>
    </div>
  );
}
