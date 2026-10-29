/** Bounded UI screening only. The server remains responsible for identity and validation. */
export function isEmailAddress(value: string): boolean {
  if (value.length > 254 || /\s/u.test(value)) return false;
  const at = value.indexOf('@');
  if (at <= 0 || at !== value.lastIndexOf('@')) return false;
  const dot = value.lastIndexOf('.');
  return dot > at + 1 && dot < value.length - 1;
}
