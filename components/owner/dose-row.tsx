'use client';

import { useState } from 'react';
import { Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { saveDoseStatus } from '@/lib/owner-api';
import { formatTime, type ReminderStatus } from '@/lib/vet';

type DoseAction = 'taken' | 'skipped';

interface DoseRowProps {
  token: string;
  reminderId: string;
  scheduledAt: string;
  medicationName: string;
  dose: string;
  status: ReminderStatus;
  onStatusChange: (reminderId: string, status: ReminderStatus) => void;
}

const ACTIVE_CLASSES: Record<DoseAction, string> = {
  taken: 'border-emerald-700 bg-emerald-700 text-white hover:bg-emerald-800',
  skipped: 'border-amber-300 bg-amber-100 text-amber-900 hover:bg-amber-200',
};

const INACTIVE_CLASSES =
  'border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50';

export function DoseRow({
  token,
  reminderId,
  scheduledAt,
  medicationName,
  dose,
  status,
  onStatusChange,
}: DoseRowProps) {
  const [pendingAction, setPendingAction] = useState<DoseAction | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function markDose(action: DoseAction) {
    setPendingAction(action);
    setError(null);

    try {
      const nextStatus = await saveDoseStatus(token, reminderId, action);
      onStatusChange(reminderId, nextStatus);
    } catch {
      setError('Не удалось сохранить. Попробуйте ещё раз.');
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <li className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-4">
        <span className="w-14 shrink-0 text-lg font-semibold tabular-nums text-slate-900">
          {formatTime(scheduledAt)}
        </span>
        <div>
          <p className="font-medium text-slate-900">{medicationName}</p>
          <p className="text-sm text-slate-600">{dose}</p>
        </div>
      </div>

      <div className="flex flex-col items-stretch gap-2 sm:items-end">
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            aria-pressed={status === 'taken'}
            disabled={pendingAction !== null}
            onClick={() => markDose('taken')}
            className={`h-10 flex-1 px-4 transition-colors sm:flex-none ${
              status === 'taken' ? ACTIVE_CLASSES.taken : INACTIVE_CLASSES
            }`}
          >
            <Check className="mr-1.5 h-4 w-4" />
            {pendingAction === 'taken' ? 'Сохраняем...' : 'Дал'}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            aria-pressed={status === 'skipped'}
            disabled={pendingAction !== null}
            onClick={() => markDose('skipped')}
            className={`h-10 flex-1 px-4 transition-colors sm:flex-none ${
              status === 'skipped' ? ACTIVE_CLASSES.skipped : INACTIVE_CLASSES
            }`}
          >
            <X className="mr-1.5 h-4 w-4" />
            {pendingAction === 'skipped' ? 'Сохраняем...' : 'Пропустил'}
          </Button>
        </div>
        {error && (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        )}
      </div>
    </li>
  );
}
