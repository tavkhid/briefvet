import { isUuid, type PublicVisit, type ReminderStatus } from '@/lib/vet';

type DoseAction = 'taken' | 'skipped';

const functionUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/owner-visit`;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

async function callOwnerVisit(body: Record<string, unknown>): Promise<{ ok: boolean; status: number; data: unknown }> {
  const response = await fetch(functionUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: anonKey,
    },
    body: JSON.stringify(body),
    cache: 'no-store',
  });

  let data: unknown = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  return { ok: response.ok, status: response.status, data };
}

export async function fetchVisitByToken(token: string): Promise<PublicVisit | null> {
  if (!isUuid(token)) return null;

  const { ok, status, data } = await callOwnerVisit({ action: 'get_visit', token });
  if (status === 404) return null;
  if (!ok) throw new Error('load_failed');

  const visit = (data as { visit?: unknown } | null)?.visit;
  if (!visit || typeof visit !== 'object' || !Array.isArray((visit as PublicVisit).prescriptions)) {
    throw new Error('invalid_payload');
  }
  return visit as PublicVisit;
}

export async function saveDoseStatus(
  token: string,
  reminderId: string,
  action: DoseAction,
): Promise<ReminderStatus> {
  const { ok, data } = await callOwnerVisit({
    action: 'set_status',
    token,
    reminderId,
    status: action,
  });

  const status = (data as { status?: unknown } | null)?.status;
  if (!ok || (status !== 'taken' && status !== 'skipped')) {
    throw new Error('save_failed');
  }
  return status;
}
