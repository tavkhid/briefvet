export type PasswordErrorKey = 'passwordTooShort' | 'passwordNoUppercase' | 'passwordNoDigit';

const PASSWORD_RULES: { test: (password: string) => boolean; key: PasswordErrorKey }[] = [
  { test: (password) => password.length >= 8, key: 'passwordTooShort' },
  { test: (password) => /[A-ZА-ЯЁ]/.test(password), key: 'passwordNoUppercase' },
  { test: (password) => /\d/.test(password), key: 'passwordNoDigit' },
];

export function getPasswordErrorKey(password: string): PasswordErrorKey | null {
  return PASSWORD_RULES.find((rule) => !rule.test(password))?.key ?? null;
}
