'use client';

import Link from 'next/link';
import { PawPrint } from 'lucide-react';
import type { VisitProgress, VisitRow, VisitStatus } from '@/lib/visit-progress';
import { formatDateTime } from '@/lib/vet';

const STATUS_STYLES: Record<VisitStatus, { label: string; badge: string; bar: string }> = {
  new: {
    label: 'Новый',
    badge: 'bg-slate-100 text-slate-700 ring-1 ring-slate-200',
    bar: 'bg-slate-400',
  },
  in_progress: {
    label: 'В процессе',
    badge: 'bg-blue-50 text-blue-800 ring-1 ring-blue-200',
    bar: 'bg-blue-600',
  },
  completed: {
    label: 'Завершен',
    badge: 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200',
    bar: 'bg-emerald-600',
  },
  attention: {
    label: 'Требует внимания',
    badge: 'bg-red-50 text-red-700 ring-1 ring-red-200',
    bar: 'bg-red-600',
  },
};

interface VisitCardProps {
  visit: VisitRow;
  progress: VisitProgress;
}

export function VisitCard({ visit, progress }: VisitCardProps) {
  const style = STATUS_STYLES[progress.status];
  const percent = progress.total > 0 ? Math.round((progress.taken / progress.total) * 100) : 0;

  return (
    <Link
      href={`/dashboard/visits/${visit.id}`}
      className="group block rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-teal-300 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
            <PawPrint className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold text-slate-900">{visit.pets?.name ?? 'Питомец'}</p>
            <p className="truncate text-sm text-slate-600">{visit.pets?.owners?.name ?? 'Владелец не указан'}</p>
            <p className="mt-1 text-xs text-slate-500">{formatDateTime(visit.created_at)}</p>
          </div>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${style.badge}`}>{style.label}</span>
      </div>

      <div className="mt-5">
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-500">Прогресс приёмов</span>
          <span className="font-medium text-slate-900">
            Принято {progress.taken} из {progress.total}
          </span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
          <div
            className={`h-full rounded-full transition-all duration-500 ${style.bar}`}
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>
    </Link>
  );
}
