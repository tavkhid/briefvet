'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Loader2, Plus } from 'lucide-react';
import { VisitList } from '@/components/dashboard/visit-list';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';

export default function VisitsPage() {
  const [clinicName, setClinicName] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    supabase
      .from('clinics')
      .select('name')
      .maybeSingle()
      .then(({ data, error }) => {
        if (!active) return;
        if (error || !data) {
          setLoadError('Не удалось загрузить данные клиники. Обновите страницу.');
          return;
        }
        setClinicName(data.name);
      });

    return () => {
      active = false;
    };
  }, []);

  if (loadError) {
    return (
      <p role="alert" className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
        {loadError}
      </p>
    );
  }

  if (clinicName === null) {
    return (
      <p className="flex items-center gap-2 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Загрузка...
      </p>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-teal-700">{clinicName}</p>
          <h1 className="mt-1 text-3xl font-semibold leading-tight tracking-tight text-slate-900">Все визиты</h1>
        </div>
        <Button asChild className="h-11 bg-teal-700 text-white transition-colors hover:bg-teal-800">
          <Link href="/dashboard/visits/new">
            <Plus className="mr-2 h-4 w-4" />
            Создать новый визит
          </Link>
        </Button>
      </div>

      <VisitList />
    </div>
  );
}
