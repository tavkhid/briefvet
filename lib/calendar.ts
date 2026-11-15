import type { ScheduleEntry } from '@/lib/vet';

const encoder = new TextEncoder();

function escapeText(value: string) {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

function formatUtc(iso: string) {
  return new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function foldLine(line: string) {
  const parts: string[] = [];
  let current = '';
  let currentBytes = 0;

  for (const char of line) {
    const bytes = encoder.encode(char).length;
    const limit = parts.length === 0 ? 75 : 74;
    if (currentBytes + bytes > limit) {
      parts.push(current);
      current = char;
      currentBytes = bytes;
    } else {
      current += char;
      currentBytes += bytes;
    }
  }
  parts.push(current);

  return parts.join('\r\n ');
}

export function buildDoseCalendar(entries: ScheduleEntry[], petName: string, clinicName: string) {
  const stamp = formatUtc(new Date().toISOString());

  const events = entries
    .filter((entry) => entry.status === 'pending')
    .flatMap((entry) => [
      'BEGIN:VEVENT',
      `UID:${entry.id}@vetbrief`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${formatUtc(entry.scheduledAt)}`,
      'DURATION:PT15M',
      `SUMMARY:${escapeText(`Дать ${entry.medicationName} (${petName})`)}`,
      `DESCRIPTION:${escapeText(`Доза: ${entry.dose}. Отметьте приём в VetBrief. Клиника: ${clinicName}`)}`,
      'BEGIN:VALARM',
      'TRIGGER:-PT5M',
      'ACTION:DISPLAY',
      `DESCRIPTION:${escapeText(`Через 5 минут: дать ${entry.medicationName} (${petName})`)}`,
      'END:VALARM',
      'END:VEVENT',
    ]);

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//VetBrief//RU',
    'CALSCALE:GREGORIAN',
    ...events,
    'END:VCALENDAR',
  ];

  return `${lines.map(foldLine).join('\r\n')}\r\n`;
}
