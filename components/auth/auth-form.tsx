'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Loader2, MailCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AuthLayout } from '@/components/auth/auth-layout';
import { authErrorMessage } from '@/components/auth/auth-errors';
import { ForgotPasswordForm } from '@/components/auth/forgot-password-form';
import { formatMessage, useLocale } from '@/components/i18n/locale-provider';
import { getPasswordErrorKey } from '@/lib/password-rules';
import { supabase } from '@/lib/supabase';

type Mode = 'signin' | 'signup' | 'forgot';

export function AuthForm() {
  const router = useRouter();
  const { messages } = useLocale();
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);
  const [resending, setResending] = useState(false);

  const isSignIn = mode === 'signin';

  function switchMode() {
    setMode(isSignIn ? 'signup' : 'signin');
    setError(null);
    setNotice(null);
  }

  function backToSignIn() {
    setMode('signin');
    setError(null);
    setNotice(null);
  }

  async function handleSignIn(credentials: { email: string; password: string }) {
    const { data, error: authError } = await supabase.auth.signInWithPassword(credentials);
    if (authError) {
      setError(authErrorMessage(authError.message, messages));
      return;
    }
    if (!data.user?.email_confirmed_at) {
      await supabase.auth.signOut();
      setError(messages.errEmailNotConfirmed);
      return;
    }
    router.replace('/dashboard');
  }

  async function handleSignUp(credentials: { email: string; password: string }) {
    const passwordErrorKey = getPasswordErrorKey(credentials.password);
    if (passwordErrorKey) {
      setError(messages[passwordErrorKey]);
      return;
    }

    const { data, error: authError } = await supabase.auth.signUp(credentials);
    if (authError) {
      setError(authErrorMessage(authError.message, messages));
      return;
    }

    if (data.session?.user.email_confirmed_at) {
      router.replace('/dashboard');
      return;
    }
    if (data.session) {
      await supabase.auth.signOut();
    }
    setAwaitingConfirmation(true);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setSubmitting(true);

    const credentials = { email: email.trim(), password };
    if (isSignIn) {
      await handleSignIn(credentials);
    } else {
      await handleSignUp(credentials);
    }

    setSubmitting(false);
  }

  async function resendConfirmation() {
    setResending(true);
    setError(null);
    setNotice(null);
    const { error: resendError } = await supabase.auth.resend({ type: 'signup', email: email.trim() });
    setResending(false);
    if (resendError) {
      setError(authErrorMessage(resendError.message, messages));
      return;
    }
    setNotice(messages.resendSent);
  }

  if (mode === 'forgot') {
    return (
      <AuthLayout>
        <ForgotPasswordForm onBack={backToSignIn} />
      </AuthLayout>
    );
  }

  if (awaitingConfirmation) {
    return (
      <AuthLayout>
        <div className="text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-50 text-teal-700">
            <MailCheck className="h-7 w-7" />
          </span>
          <h1 className="mt-5 text-2xl font-semibold leading-tight text-slate-900">{messages.checkEmailTitle}</h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">
            {formatMessage(messages.checkEmailText, { email: email.trim() })}
          </p>
          {error && (
            <p role="alert" className="mt-5 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}
          {notice && <p className="mt-5 text-sm text-teal-700">{notice}</p>}
          <div className="mt-6 space-y-3">
            <Button
              type="button"
              onClick={() => {
                setAwaitingConfirmation(false);
                backToSignIn();
              }}
              className="h-11 w-full bg-teal-700 text-white transition-colors hover:bg-teal-800"
            >
              {messages.goToSignInButton}
            </Button>
            <button
              type="button"
              onClick={resendConfirmation}
              disabled={resending}
              className="inline-flex items-center gap-2 text-sm font-medium text-teal-700 transition-colors hover:text-teal-800 disabled:opacity-60"
            >
              {resending && <Loader2 className="h-4 w-4 animate-spin" />}
              {messages.resendEmail}
            </button>
          </div>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <h1 className="text-2xl font-semibold leading-tight text-slate-900">
        {isSignIn ? messages.signInTitle : messages.signUpTitle}
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">
        {isSignIn ? messages.signInSubtitle : messages.signUpSubtitle}
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-5">
        <div className="space-y-2">
          <Label htmlFor="email">{messages.emailLabel}</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="doctor@clinic.ru"
          />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="password">{messages.passwordLabel}</Label>
            {isSignIn && (
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setNotice(null);
                  setMode('forgot');
                }}
                className="text-xs font-medium text-teal-700 transition-colors hover:text-teal-800"
              >
                {messages.forgotPassword}
              </button>
            )}
          </div>
          <Input
            id="password"
            type="password"
            autoComplete={isSignIn ? 'current-password' : 'new-password'}
            required
            minLength={isSignIn ? undefined : 8}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder={isSignIn ? messages.passwordPlaceholderSignIn : messages.passwordHint}
          />
          {!isSignIn && <p className="text-xs text-slate-500">{messages.passwordHint}</p>}
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
          {submitting ? messages.submitting : isSignIn ? messages.signInButton : messages.signUpButton}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-600">
        {isSignIn ? messages.noAccountPrompt : messages.haveAccountPrompt}{' '}
        <button
          type="button"
          onClick={switchMode}
          className="font-medium text-teal-700 underline-offset-4 transition-colors hover:text-teal-800 hover:underline"
        >
          {isSignIn ? messages.goToSignUp : messages.goToSignIn}
        </button>
      </p>
    </AuthLayout>
  );
}
