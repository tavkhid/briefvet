'use client';

import { DoseRow } from '@/components/owner/dose-row';
import { formatDay, localDayKey, type ReminderStatus, type ScheduleEntry } from '@/lib/vet';

interface DoseScheduleProps {
  token: string;
  entries: ScheduleEntry[];
  onStatusChange: (reminderId: string, status: ReminderStatus) => void;
}

export function DoseSchedule({ token, entries, onStatusChange }: DoseScheduleProps) {
  const todayKey = localDayKey(new Date().toISOString());

  const groups = entries.reduce<{ key: string; label: string; items: ScheduleEntry[] }[]>((acc, entry) => {
    const key = localDayKey(entry.scheduledAt);
    const last = acc[acc.length - 1];
    if (last && last.key === key) {
      last.items.push(entry);
    } else {
      acc.push({ key, label: formatDay(entry.scheduledAt), items: [entry] });
    }
    return acc;
  }, []);

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <section key={group.key}>
          <h3
            className={`text-sm font-semibold uppercase tracking-wide ${
              group.key === todayKey ? 'text-teal-700' : 'text-slate-500'
            }`}
          >
            {group.key === todayKey ? `Сегодня, ${group.label}` : group.label}
          </h3>
          <ul className="mt-2 divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white px-5 shadow-sm">
            {group.items.map((entry) => (
              <DoseRow
                key={entry.id}
                token={token}
                reminderId={entry.id}
                scheduledAt={entry.scheduledAt}
                medicationName={entry.medicationName}
                dose={entry.dose}
                status={entry.status}
                onStatusChange={onStatusChange}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
