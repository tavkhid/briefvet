export type ReminderStatus = 'pending' | 'sent' | 'taken' | 'skipped';

export interface Reminder {
  id: string;
  scheduled_at: string;
  status: ReminderStatus;
}

export interface Prescription {
  id: string;
  medication_name: string;
  dose: string;
  frequency_per_day: number;
  duration_days: number;
  first_dose_at: string;
  reminders: Reminder[];
}

export interface PublicVisit {
  diagnosis: string | null;
  notes: string | null;
  next_visit_date: string | null;
  created_at: string;
  pet: { name: string; species: string; breed: string | null };
  clinic: { name: string; phone: string | null };
  prescriptions: Prescription[];
}

export interface ScheduleEntry {
  id: string;
  prescriptionId: string;
  scheduledAt: string;
  status: ReminderStatus;
  medicationName: string;
  dose: string;
}

export function flattenSchedule(visit: PublicVisit): ScheduleEntry[] {
  return visit.prescriptions
    .flatMap((prescription) =>
      prescription.reminders.map((reminder) => ({
        id: reminder.id,
        prescriptionId: prescription.id,
        scheduledAt: reminder.scheduled_at,
        status: reminder.status,
        medicationName: prescription.medication_name,
        dose: prescription.dose,
      }))
    )
    .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
}

export const SPECIES_OPTIONS = [
  { value: 'dog', label: 'Собака' },
  { value: 'cat', label: 'Кошка' },
  { value: 'other', label: 'Другое' },
] as const;

export const FREQUENCY_OPTIONS = [1, 2, 3, 4] as const;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string) {
  return UUID_PATTERN.test(value);
}

export function speciesLabel(value: string) {
  return SPECIES_OPTIONS.find((option) => option.value === value)?.label ?? value;
}

export function formatDateTime(iso: string) {
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

export function formatTime(iso: string) {
  return new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
}

export function formatDay(iso: string) {
  return new Intl.DateTimeFormat('ru-RU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date(iso));
}

export function formatCalendarDate(isoDate: string) {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }).format(
    new Date(year, month - 1, day)
  );
}

export function localDayKey(iso: string) {
  const date = new Date(iso);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

export function toLocalInputValue(date: Date) {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
