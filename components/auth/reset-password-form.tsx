'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useLocale } from '@/components/i18n/locale-provider';
import { getPasswordErrorKey } from '@/lib/password-rules';
import { supabase } from '@/lib/supabase';

type LinkState = 'checking' | 'ready' | 'invalid';

export function ResetPasswordForm() {
  const router = useRouter();
  const { messages } = useLocale();
  const [linkState, setLinkState] = useState<LinkState>('checking');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setLinkState(data.session ? 'ready' : 'invalid');
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session)) {
        setLinkState('ready');
      }
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const passwordErrorKey = getPasswordErrorKey(password);
    if (passwordErrorKey) {
      setError(messages[passwordErrorKey]);
      return;
    }
    if (password !== confirmation) {
      setError(messages.passwordsMismatch);
      return;
    }

    setSubmitting(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setSubmitting(false);

    if (updateError) {
      setError(messages.errPasswordUpdate);
      return;
    }

    setSaved(true);
    router.replace('/dashboard');
  }

  if (linkState === 'checking') {
    return <p className="text-center text-sm text-slate-500">{messages.checkingLink}</p>;
  }

  if (linkState === 'invalid') {
    return (
      <div className="text-center">
        <p className="text-sm leading-relaxed text-slate-600">{messages.linkInvalid}</p>
        <Button
          type="button"
          onClick={() => router.replace('/login')}
          className="mt-6 h-11 w-full bg-teal-700 text-white transition-colors hover:bg-teal-800"
        >
          {messages.requestNewLink}
        </Button>
      </div>
    );
  }

  return (
    <>
      <h1 className="text-2xl font-semibold leading-tight text-slate-900">{messages.newPasswordTitle}</h1>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">{messages.newPasswordSubtitle}</p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-5">
        <div className="space-y-2">
          <Label htmlFor="new-password">{messages.newPasswordLabel}</Label>
          <Input
            id="new-password"
            type="password"
            autoComplete="new-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder={messages.passwordHint}
          />
          <p className="text-xs text-slate-500">{messages.passwordHint}</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm-password">{messages.confirmPasswordLabel}</Label>
          <Input
            id="confirm-password"
            type="password"
            autoComplete="new-password"
            required
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
          />
        </div>

        {error && (
          <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        {saved && <p className="text-sm text-teal-700">{messages.passwordSaved}</p>}

        <Button
          type="submit"
          disabled={submitting || saved}
          className="h-11 w-full bg-teal-700 text-white transition-colors hover:bg-teal-800"
        >
          {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {submitting ? messages.submitting : messages.savePassword}
        </Button>
      </form>
    </>
  );
}
