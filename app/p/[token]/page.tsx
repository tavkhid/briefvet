import { OwnerPlan } from '@/components/owner/owner-plan';
import { fetchVisitByToken } from '@/lib/owner-api';
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

  let visit: PublicVisit | null;
  try {
    visit = await fetchVisitByToken(params.token);
  } catch {
    return <StatusMessage title="Не удалось загрузить план" text="Обновите страницу через несколько секунд." />;
  }

  if (!visit) {
    return <StatusMessage title="Ссылка недействительна" text="Проверьте QR-код или попросите клинику прислать ссылку заново." />;
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <OwnerPlan token={params.token} visit={visit} />
    </main>
  );
}
