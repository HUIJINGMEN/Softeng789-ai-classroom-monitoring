/** Keep proof only in component memory; never in query strings, storage or navigation state. */
export function parseAccountLinkHash(hash: string): string | null {
  if (!hash.startsWith('#account-link=')) return null;
  const token = hash.slice('#account-link='.length);
  return /^[A-Za-z0-9_-]{43}$/.test(token) ? token : '';
}

export function passwordIssue(password: string, confirmation: string): string {
  if (password.length < 8 || new TextEncoder().encode(password).length > 72 || !password.trim()) {
    return 'Use at least 8 characters, up to 72 UTF-8 bytes, for your password.';
  }
  return password === confirmation ? '' : 'Passwords do not match.';
}
