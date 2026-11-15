'use client';

import { useState } from 'react';
import { CalendarDays, CalendarPlus, Phone, PawPrint, Stethoscope } from 'lucide-react';
import { DoseSchedule } from '@/components/owner/dose-schedule';
import { Button } from '@/components/ui/button';
import { buildDoseCalendar } from '@/lib/calendar';
import { useMounted } from '@/lib/use-mounted';
import {
  flattenSchedule,
  formatCalendarDate,
  formatDateTime,
  formatTime,
  speciesLabel,
  type PublicVisit,
  type ReminderStatus,
  type ScheduleEntry,
} from '@/lib/vet';

interface OwnerPlanProps {
  token: string;
  visit: PublicVisit;
}

export function OwnerPlan({ token, visit }: OwnerPlanProps) {
  const mounted = useMounted();
  const [entries, setEntries] = useState<ScheduleEntry[]>(() => flattenSchedule(visit));

  function updateStatus(reminderId: string, status: ReminderStatus) {
    setEntries((current) =>
      current.map((entry) => (entry.id === reminderId ? { ...entry, status } : entry))
    );
  }

  const nextEntry = mounted ? entries.find((entry) => entry.status === 'pending') : undefined;
  const pendingCount = entries.filter((entry) => entry.status === 'pending').length;

  function downloadCalendar() {
    const content = buildDoseCalendar(entries, visit.pet.name, visit.clinic.name);
    const url = URL.createObjectURL(new Blob([content], { type: 'text/calendar;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'vetbrief-plan.ics';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const clinicPhoneHref = visit.clinic.phone ? `tel:${visit.clinic.phone.replace(/[^+\d]/g, '')}` : null;

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-8 sm:py-12">
      <header className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-700 text-white">
          <Stethoscope className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="text-sm text-slate-500">План лечения от клиники</p>
          <p className="truncate font-semibold text-slate-900">{visit.clinic.name}</p>
        </div>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
            <PawPrint className="h-6 w-6" />
          </span>
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold leading-tight text-slate-900">{visit.pet.name}</h1>
            <p className="mt-1 text-sm text-slate-600">
              {speciesLabel(visit.pet.species)}
              {visit.pet.breed ? ` · ${visit.pet.breed}` : ''}
            </p>
          </div>
        </div>

        {visit.diagnosis && (
          <div className="mt-6">
            <p className="text-sm text-slate-500">Диагноз</p>
            <p className="mt-1 text-slate-900">{visit.diagnosis}</p>
          </div>
        )}
        {visit.notes && (
          <div className="mt-4">
            <p className="text-sm text-slate-500">Рекомендации</p>
            <p className="mt-1 whitespace-pre-line leading-relaxed text-slate-900">{visit.notes}</p>
          </div>
        )}

        <div className="mt-6 flex flex-col gap-3 border-t border-slate-100 pt-5 text-sm sm:flex-row sm:items-center sm:justify-between">
          {visit.next_visit_date ? (
            <p className="flex items-center gap-2 text-slate-700">
              <CalendarDays className="h-4 w-4 text-teal-700" />
              Следующий визит: {formatCalendarDate(visit.next_visit_date)}
            </p>
          ) : (
            <span />
          )}
          {clinicPhoneHref && (
            <a
              href={clinicPhoneHref}
              className="inline-flex items-center gap-2 font-medium text-teal-700 underline-offset-4 transition-colors hover:text-teal-800 hover:underline"
            >
              <Phone className="h-4 w-4" />
              Позвонить в клинику
            </a>
          )}
        </div>
      </section>

      {nextEntry && (
        <section className="rounded-2xl bg-teal-700 p-6 text-white shadow-sm">
          <p className="text-sm font-medium text-teal-100">Ближайший приём</p>
          <p className="mt-2 text-xl font-semibold leading-snug">
            {formatTime(nextEntry.scheduledAt)} · {nextEntry.medicationName}
          </p>
          <p className="mt-1 text-sm text-teal-50">
            {nextEntry.dose} · {formatDateTime(nextEntry.scheduledAt)}
          </p>
        </section>
      )}

      <section>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Расписание</h2>
          <Button
            type="button"
            variant="outline"
            onClick={downloadCalendar}
            disabled={pendingCount === 0}
            className="h-11 transition-colors hover:border-teal-300 hover:text-teal-700"
          >
            <CalendarPlus className="mr-2 h-4 w-4" />
            Добавить напоминания в календарь
          </Button>
        </div>
        {mounted ? (
          <div className="mt-4">
            <DoseSchedule token={token} entries={entries} onStatusChange={updateStatus} />
          </div>
        ) : (
          <p className="mt-4 text-sm text-slate-500">Загружаем расписание...</p>
        )}
      </section>
    </div>
  );
}
