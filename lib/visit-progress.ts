export type VisitStatus = 'new' | 'in_progress' | 'completed' | 'attention';

export interface VisitRow {
  id: string;
  created_at: string;
  diagnosis: string | null;
  pets: {
    name: string;
    owners: { name: string; phone: string } | null;
  } | null;
  prescriptions: {
    frequency_per_day: number;
    duration_days: number;
    reminders: { status: string }[];
  }[];
}

export interface VisitProgress {
  total: number;
  taken: number;
  status: VisitStatus;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function computeVisitProgress(visit: VisitRow, now: number): VisitProgress {
  const total = visit.prescriptions.reduce(
    (sum, prescription) => sum + prescription.frequency_per_day * prescription.duration_days,
    0
  );
  const taken = visit.prescriptions.reduce(
    (sum, prescription) => sum + prescription.reminders.filter((reminder) => reminder.status === 'taken').length,
    0
  );

  if (total > 0 && taken >= total) {
    return { total, taken, status: 'completed' };
  }
  if (taken > 0) {
    return { total, taken, status: 'in_progress' };
  }

  const isRecent = now - new Date(visit.created_at).getTime() < DAY_MS;
  return { total, taken, status: isRecent ? 'new' : 'attention' };
}
