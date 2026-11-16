'use client';

import { Languages } from 'lucide-react';
import { LOCALE_OPTIONS, isLocale } from '@/lib/i18n/locales';
import { useLocale } from '@/components/i18n/locale-provider';

export function LanguageSwitcher() {
  const { locale, messages, setLocale } = useLocale();

  return (
    <label className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 shadow-sm transition-colors hover:border-slate-300">
      <Languages className="h-4 w-4 text-slate-500" aria-hidden="true" />
      <span className="sr-only">{messages.languageLabel}</span>
      <select
        value={locale}
        onChange={(event) => {
          const next = event.target.value;
          if (isLocale(next)) setLocale(next);
        }}
        className="cursor-pointer bg-transparent pr-1 font-medium text-slate-800 outline-none"
      >
        {LOCALE_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
