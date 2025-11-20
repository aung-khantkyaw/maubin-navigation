const emailPattern = /^[\w-.]+@([\w-]+\.)+[\w-]{2,}$/i;

export function isEmailValid(value: string): boolean {
  return emailPattern.test(value.trim());
}

export function isPasswordStrong(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length < 8) {
    return false;
  }
  const hasLetter = /[a-z]/i.test(trimmed);
  const hasNumber = /\d/.test(trimmed);
  return hasLetter && hasNumber;
}

export function hasValue(value: string | null | undefined): boolean {
  if (value == null) return false;
  return value.trim().length > 0;
}
