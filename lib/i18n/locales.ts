export const LOCALES = ['ru', 'en', 'de', 'zh', 'ce', 'ar', 'tr'] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'ru';

export const LOCALE_STORAGE_KEY = 'vetbrief-locale';

export const LOCALE_OPTIONS: { value: Locale; label: string; dir: 'ltr' | 'rtl' }[] = [
  { value: 'ru', label: 'Русский', dir: 'ltr' },
  { value: 'en', label: 'English', dir: 'ltr' },
  { value: 'de', label: 'Deutsch', dir: 'ltr' },
  { value: 'zh', label: '中文', dir: 'ltr' },
  { value: 'ce', label: 'Нохчийн мотт', dir: 'ltr' },
  { value: 'ar', label: 'العربية', dir: 'rtl' },
  { value: 'tr', label: 'Türkçe', dir: 'ltr' },
];

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}
