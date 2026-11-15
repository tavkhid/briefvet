import { OwnerPlan } from '@/components/owner/owner-plan';
import { supabase } from '@/lib/supabase';
import { isUuid, type PublicVisit } from '@/lib/vet';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'План лечения | VetBrief',
  robots: { index: false, follow: false },
};

function StatusMessage({ title, text }: { title: string; text: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="max-w-sm rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <p className="text-lg font-semibold text-slate-900">{title}</p>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">{text}</p>
      </div>
    </main>
  );
}

export default async function OwnerPlanPage({ params }: { params: { token: string } }) {
  if (!isUuid(params.token)) {
    return <StatusMessage title="Ссылка недействительна" text="Проверьте QR-код или попросите клинику прислать ссылку заново." />;
  }

  const { data, error } = await supabase.rpc('get_visit_by_token', { p_token: params.token });

  if (error) {
    return <StatusMessage title="Не удалось загрузить план" text="Обновите страницу через несколько секунд." />;
  }

  if (!data || typeof data !== 'object' || !Array.isArray((data as PublicVisit).prescriptions)) {
    return <StatusMessage title="Ссылка недействительна" text="Проверьте QR-код или попросите клинику прислать ссылку заново." />;
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <OwnerPlan token={params.token} visit={data as PublicVisit} />
    </main>
  );
}
