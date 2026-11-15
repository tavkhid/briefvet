'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Loader2, MailCheck, Stethoscope } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getPasswordError, PASSWORD_HINT } from '@/lib/password-rules';
import { supabase } from '@/lib/supabase';

type Mode = 'signin' | 'signup';

const NOT_CONFIRMED_MESSAGE =
  'Подтвердите email: мы отправили письмо со ссылкой. Если письма нет, проверьте папку «Спам».';

function toRussianError(message: string) {
  if (message.includes('Invalid login credentials')) return 'Неверный email или пароль';
  if (message.includes('Email not confirmed')) return NOT_CONFIRMED_MESSAGE;
  if (message.includes('User already registered')) return 'Аккаунт с таким email уже есть. Войдите в систему.';
  if (message.includes('For security purposes')) return 'Слишком много попыток. Подождите минуту и попробуйте снова.';
  return 'Не удалось выполнить действие. Попробуйте ещё раз.';
}

export function AuthForm() {
  const router = useRouter();
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

  async function handleSignIn(credentials: { email: string; password: string }) {
    const { data, error: authError } = await supabase.auth.signInWithPassword(credentials);
    if (authError) {
      setError(toRussianError(authError.message));
      return;
    }
    if (!data.user?.email_confirmed_at) {
      await supabase.auth.signOut();
      setError(NOT_CONFIRMED_MESSAGE);
      return;
    }
    router.replace('/dashboard');
  }

  async function handleSignUp(credentials: { email: string; password: string }) {
    const passwordError = getPasswordError(credentials.password);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    const { data, error: authError } = await supabase.auth.signUp(credentials);
    if (authError) {
      setError(toRussianError(authError.message));
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
      setError(toRussianError(resendError.message));
      return;
    }
    setNotice('Письмо отправлено повторно. Проверьте почту.');
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-8 flex items-center justify-center gap-2 text-slate-900">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-700 text-white">
            <Stethoscope className="h-5 w-5" />
          </span>
          <span className="text-xl font-semibold tracking-tight">VetBrief</span>
        </Link>

        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          {awaitingConfirmation ? (
            <div className="text-center">
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-50 text-teal-700">
                <MailCheck className="h-7 w-7" />
              </span>
              <h1 className="mt-5 text-2xl font-semibold leading-tight text-slate-900">Проверьте почту</h1>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">
                Мы отправили письмо на <span className="font-medium text-slate-900">{email.trim()}</span>. Перейдите по
                ссылке в письме, затем войдите в аккаунт.
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
                    setMode('signin');
                    setError(null);
                    setNotice(null);
                  }}
                  className="h-11 w-full bg-teal-700 text-white transition-colors hover:bg-teal-800"
                >
                  Перейти ко входу
                </Button>
                <button
                  type="button"
                  onClick={resendConfirmation}
                  disabled={resending}
                  className="inline-flex items-center gap-2 text-sm font-medium text-teal-700 transition-colors hover:text-teal-800 disabled:opacity-60"
                >
                  {resending && <Loader2 className="h-4 w-4 animate-spin" />}
                  Отправить письмо повторно
                </button>
              </div>
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-semibold leading-tight text-slate-900">
                {isSignIn ? 'Вход для врачей' : 'Регистрация клиники'}
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                {isSignIn
                  ? 'Войдите, чтобы создавать назначения и планы лечения.'
                  : 'Создайте аккаунт, чтобы начать работу с планами лечения.'}
              </p>

              <form onSubmit={handleSubmit} className="mt-6 space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
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
                  <Label htmlFor="password">Пароль</Label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete={isSignIn ? 'current-password' : 'new-password'}
                    required
                    minLength={isSignIn ? undefined : 8}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder={isSignIn ? 'Ваш пароль' : PASSWORD_HINT}
                  />
                  {!isSignIn && <p className="text-xs text-slate-500">{PASSWORD_HINT}</p>}
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
                  {submitting ? 'Подождите...' : isSignIn ? 'Войти' : 'Создать аккаунт'}
                </Button>
              </form>

              <p className="mt-6 text-center text-sm text-slate-600">
                {isSignIn ? 'Ещё нет аккаунта?' : 'Уже есть аккаунт?'}{' '}
                <button
                  type="button"
                  onClick={switchMode}
                  className="font-medium text-teal-700 underline-offset-4 transition-colors hover:text-teal-800 hover:underline"
                >
                  {isSignIn ? 'Зарегистрироваться' : 'Войти'}
                </button>
              </p>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
