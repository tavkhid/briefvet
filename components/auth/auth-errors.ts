import type { Messages } from '@/lib/i18n/messages';

export function authErrorMessage(message: string, messages: Messages) {
  if (message.includes('Invalid login credentials')) return messages.errInvalidCredentials;
  if (message.includes('Email not confirmed')) return messages.errEmailNotConfirmed;
  if (message.includes('User already registered')) return messages.errAlreadyRegistered;
  if (message.includes('For security purposes')) return messages.errRateLimited;
  return messages.errGeneric;
}
