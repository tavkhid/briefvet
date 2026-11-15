'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Loader2, Plus } from 'lucide-react';
import { VisitCard } from '@/components/dashboard/visit-card';
import { VisitFilters, type VisitFilter } from '@/components/dashboard/visit-filters';
import { Button } from '@/components/ui/button';
import { computeVisitProgress, type VisitProgress, type VisitRow } from '@/lib/visit-progress';
import { supabase } from '@/lib/supabase';

interface VisitItem {
  visit: VisitRow;
  progress: VisitProgress;
}

function matchesQuery(visit: VisitRow, query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;

  const digits = query.replace(/\D/g, '');
  const petName = visit.pets?.name.toLowerCase() ?? '';
  const phoneDigits = visit.pets?.owners?.phone.replace(/\D/g, '') ?? '';

  return petName.includes(normalized) || (digits.length > 0 && phoneDigits.includes(digits));
}

function matchesFilter(item: VisitItem, filter: VisitFilter) {
  if (filter === 'all') return true;
  return item.progress.status === filter;
}

export function VisitList() {
  const [visits, setVisits] = useState<VisitRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<VisitFilter>('all');

  useEffect(() => {
    let active = true;

    supabase
      .from('visits')
      .select(
        'id, created_at, diagnosis, pets(name, owners(name, phone)), prescriptions(frequency_per_day, duration_days, reminders(status))'
      )
      .order('created_at', { ascending: false })
      .limit(200)
      .then(({ data, error: queryError }) => {
        if (!active) return;
        if (queryError || !Array.isArray(data)) {
          setError('Не удалось загрузить визиты');
          return;
        }
        setVisits(data as unknown as VisitRow[]);
      });

    return () => {
      active = false;
    };
  }, []);

  if (error) {
    return (
      <p role="alert" className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
        {error}
      </p>
    );
  }

  if (visits === null) {
    return (
      <p className="flex items-center gap-2 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Загрузка визитов...
      </p>
    );
  }

  if (visits.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
        <p className="font-medium text-slate-900">У вас пока нет визитов</p>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-slate-600">
          Создайте первый визит, чтобы выдать владельцу QR-код
        </p>
        <Button asChild className="mt-6 bg-teal-700 text-white transition-colors hover:bg-teal-800">
          <Link href="/dashboard/visits/new">
            <Plus className="mr-2 h-4 w-4" />
            Создать новый визит
          </Link>
        </Button>
      </div>
    );
  }

  const now = Date.now();
  const items: VisitItem[] = visits.map((visit) => ({ visit, progress: computeVisitProgress(visit, now) }));
  const visible = items.filter((item) => matchesFilter(item, filter) && matchesQuery(item.visit, query));

  return (
    <div className="space-y-6">
      <VisitFilters query={query} onQueryChange={setQuery} filter={filter} onFilterChange={setFilter} />

      {visible.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center text-sm text-slate-600">
          По вашему запросу ничего не найдено
        </p>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {visible.map((item) => (
            <li key={item.visit.id}>
              <VisitCard visit={item.visit} progress={item.progress} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
