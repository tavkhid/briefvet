const PASSWORD_RULES: { test: (password: string) => boolean; message: string }[] = [
  { test: (password) => password.length >= 8, message: 'Пароль должен содержать минимум 8 символов' },
  { test: (password) => /[A-ZА-ЯЁ]/.test(password), message: 'Добавьте хотя бы одну заглавную букву' },
  { test: (password) => /\d/.test(password), message: 'Добавьте хотя бы одну цифру' },
];

export const PASSWORD_HINT = 'Минимум 8 символов, одна заглавная буква и одна цифра';

export function getPasswordError(password: string): string | null {
  return PASSWORD_RULES.find((rule) => !rule.test(password))?.message ?? null;
}
