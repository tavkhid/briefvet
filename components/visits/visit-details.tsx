'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { ArrowLeft, Check, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { formatCalendarDate, formatDateTime, speciesLabel } from '@/lib/vet';

interface ReminderRow {
  id: string;
  status: string;
  scheduled_at: string;
}

interface PrescriptionRow {
  id: string;
  medication_name: string;
  dose: string;
  frequency_per_day: number;
  duration_days: number;
  first_dose_at: string;
  reminders: ReminderRow[];
}

interface VisitDetail {
  id: string;
  created_at: string;
  diagnosis: string | null;
  notes: string | null;
  next_visit_date: string | null;
  access_token: string;
  pets: {
    name: string;
    species: string;
    breed: string | null;
    owners: { name: string; phone: string } | null;
  } | null;
  prescriptions: PrescriptionRow[];
}

interface VisitDetailsProps {
  visitId: string;
}

export function VisitDetails({ visitId }: VisitDetailsProps) {
  const [visit, setVisit] = useState<VisitDetail | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [origin, setOrigin] = useState('');
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    let active = true;

    supabase
      .from('visits')
      .select(
        'id, created_at, diagnosis, notes, next_visit_date, access_token, pets(name, species, breed, owners(name, phone)), prescriptions(id, medication_name, dose, frequency_per_day, duration_days, first_dose_at, reminders(id, status, scheduled_at))'
      )
      .eq('id', visitId)
      .maybeSingle()
      .then(({ data, error: queryError }) => {
        if (!active) return;
        if (queryError) {
          setError('Не удалось загрузить визит. Обновите страницу.');
          return;
        }
        if (!data) {
          setNotFound(true);
          return;
        }
        setVisit(data as unknown as VisitDetail);
      });

    return () => {
      active = false;
    };
  }, [visitId]);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  if (error) {
    return (
      <p role="alert" className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
        {error}
      </p>
    );
  }

  if (notFound) {
    return (
      <div className="space-y-4">
        <p className="text-slate-900">Визит не найден или был удалён.</p>
        <Link href="/dashboard/visits" className="text-sm font-medium text-teal-700 hover:underline">
          Вернуться к визитам
        </Link>
      </div>
    );
  }

  if (!visit) {
    return <p className="text-sm text-slate-500">Загрузка визита...</p>;
  }

  const publicUrl = origin ? `${origin}/p/${visit.access_token}` : '';
  const owner = visit.pets?.owners ?? null;

  async function copyLink() {
    if (!publicUrl) return;
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      setCopyFailed(false);
    } catch {
      setCopyFailed(true);
    }
  }

  return (
    <div className="space-y-8">
      <Link
        href="/dashboard/visits"
        className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition-colors hover:text-teal-700"
      >
        <ArrowLeft className="h-4 w-4" />
        Все визиты
      </Link>

      <div>
        <p className="text-sm text-slate-500">{formatDateTime(visit.created_at)}</p>
        <h1 className="mt-1 text-3xl font-semibold leading-tight tracking-tight text-slate-900">
          {visit.pets?.name ?? 'Питомец'}
          {visit.pets && (
            <span className="font-normal text-slate-500"> · {speciesLabel(visit.pets.species)}</span>
          )}
        </h1>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Сведения о визите</h2>
            <dl className="mt-5 grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-sm text-slate-500">Владелец</dt>
                <dd className="mt-1 font-medium text-slate-900">{owner?.name ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-sm text-slate-500">Телефон</dt>
                <dd className="mt-1 font-medium text-slate-900">{owner?.phone ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-sm text-slate-500">Диагноз</dt>
                <dd className="mt-1 text-slate-900">{visit.diagnosis ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-sm text-slate-500">Следующий визит</dt>
                <dd className="mt-1 text-slate-900">
                  {visit.next_visit_date ? formatCalendarDate(visit.next_visit_date) : '—'}
                </dd>
              </div>
              {visit.notes && (
                <div className="sm:col-span-2">
                  <dt className="text-sm text-slate-500">Рекомендации</dt>
                  <dd className="mt-1 whitespace-pre-line leading-relaxed text-slate-900">{visit.notes}</dd>
                </div>
              )}
            </dl>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Назначения</h2>
            <ul className="mt-5 divide-y divide-slate-100">
              {visit.prescriptions.map((prescription) => {
                const total = prescription.reminders.length;
                const taken = prescription.reminders.filter((reminder) => reminder.status === 'taken').length;
                const skipped = prescription.reminders.filter((reminder) => reminder.status === 'skipped').length;
                return (
                  <li key={prescription.id} className="flex flex-col gap-2 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-medium text-slate-900">{prescription.medication_name}</p>
                      <p className="mt-1 text-sm text-slate-600">
                        {prescription.dose} · {prescription.frequency_per_day}{' '}
                        {prescription.frequency_per_day === 1 ? 'раз' : 'раза'} в день · {prescription.duration_days} дн.
                      </p>
                    </div>
                    <p className="text-sm text-slate-500">
                      Принято {taken} из {total}
                      {skipped > 0 ? ` · пропущено ${skipped}` : ''}
                    </p>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>

        <aside className="lg:col-span-1">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm lg:sticky lg:top-24">
            <h2 className="text-lg font-semibold text-slate-900">QR-код для владельца</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Владелец сканирует код телефоном и сразу видит план приёма. Регистрация не нужна.
            </p>
            <div className="mx-auto mt-6 flex h-56 w-56 items-center justify-center rounded-xl border border-slate-200 bg-white p-3">
              {publicUrl ? (
                <QRCodeSVG value={publicUrl} size={200} level="M" className="h-full w-full" />
              ) : (
                <span className="text-sm text-slate-400">Готовим код...</span>
              )}
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={copyLink}
              disabled={!publicUrl}
              className="mt-6 w-full transition-colors hover:border-teal-300 hover:text-teal-700"
            >
              {copied ? <Check className="mr-2 h-4 w-4 text-teal-700" /> : <Copy className="mr-2 h-4 w-4" />}
              {copied ? 'Ссылка скопирована' : 'Скопировать ссылку'}
            </Button>
            {copyFailed && (
              <p role="alert" className="mt-3 text-sm text-red-700">
                Не удалось скопировать. Выделите ссылку и скопируйте её вручную.
              </p>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
