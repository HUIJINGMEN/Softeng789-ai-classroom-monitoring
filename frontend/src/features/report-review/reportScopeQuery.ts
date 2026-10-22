/** Repeated query parameters preserve empty/multiple course selections without JSON on GET. */
export function reportScopeQuery(scope: object): string {
  const query = new URLSearchParams();
  Object.entries(scope).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      if (!value.length) query.set(key, '');
      else value.forEach(item => query.append(key, String(item)));
    }
    else if (value != null) query.set(key, String(value));
  });
  return query.toString();
}
