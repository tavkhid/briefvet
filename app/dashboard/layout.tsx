'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { DashboardHeader } from '@/components/dashboard/dashboard-header';
import { useLocale } from '@/components/i18n/locale-provider';
import { supabase } from '@/lib/supabase';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [authenticated, setAuthenticated] = useState(false);
  const { messages } = useLocale();

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      const session = data.session;
      if (!session?.user.email_confirmed_at) {
        router.replace('/login');
        return;
      }
      setAuthenticated(true);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user.email_confirmed_at) {
        setAuthenticated(false);
        router.replace('/login');
      }
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [router]);

  if (!authenticated) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-sm text-slate-500">{messages.loading}</p>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <DashboardHeader />
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:py-12">{children}</main>
    </div>
  );
}
