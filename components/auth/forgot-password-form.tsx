'use client';

import { useState, type FormEvent } from 'react';
import { Loader2, MailCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { authErrorMessage } from '@/components/auth/auth-errors';
import { useLocale } from '@/components/i18n/locale-provider';
import { supabase } from '@/lib/supabase';

interface ForgotPasswordFormProps {
  onBack: () => void;
}

export function ForgotPasswordForm({ onBack }: ForgotPasswordFormProps) {
  const { messages } = useLocale();
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    setSubmitting(false);
    if (resetError && resetError.message.includes('For security purposes')) {
      setError(messages.errRateLimited);
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <div className="text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-50 text-teal-700">
          <MailCheck className="h-7 w-7" />
        </span>
        <p className="mt-5 text-sm leading-relaxed text-slate-600">{messages.resetLinkSent}</p>
        <Button
          type="button"
          onClick={onBack}
          className="mt-6 h-11 w-full bg-teal-700 text-white transition-colors hover:bg-teal-800"
        >
          {messages.backToSignIn}
        </Button>
      </div>
    );
  }

  return (
    <>
      <h1 className="text-2xl font-semibold leading-tight text-slate-900">{messages.forgotTitle}</h1>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">{messages.forgotSubtitle}</p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-5">
        <div className="space-y-2">
          <Label htmlFor="forgot-email">{messages.emailLabel}</Label>
          <Input
            id="forgot-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="doctor@clinic.ru"
          />
        </div>

        {error && (
          <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <Button
          type="submit"
          disabled={submitting}
          className="h-11 w-full bg-teal-700 text-white transition-colors hover:bg-teal-800"
        >
          {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {submitting ? messages.submitting : messages.sendResetLink}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm">
        <button
          type="button"
          onClick={onBack}
          className="font-medium text-teal-700 underline-offset-4 transition-colors hover:text-teal-800 hover:underline"
        >
          {messages.backToSignIn}
        </button>
      </p>
    </>
  );
}
