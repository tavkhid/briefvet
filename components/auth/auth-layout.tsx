import Link from 'next/link';
import type { ReactNode } from 'react';
import { Stethoscope } from 'lucide-react';
import { LanguageSwitcher } from '@/components/i18n/language-switcher';

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2 text-slate-900">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-700 text-white">
              <Stethoscope className="h-5 w-5" />
            </span>
            <span className="text-xl font-semibold tracking-tight">VetBrief</span>
          </Link>
          <LanguageSwitcher />
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">{children}</div>
      </div>
    </main>
  );
}
