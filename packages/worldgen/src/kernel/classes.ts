/**
 * Label matching shared by style rules and scatter rules. Labels are opaque strings; matching is
 * by whole word so `house` matches `semidetached_house` but never `warehouse`.
 */

export function normalizeClass(value: string): string {
  return value.trim().toLowerCase().replaceAll('_', ' ').replaceAll('-', ' ').replaceAll(':', ' ');
}

/** Does one label match any candidate (exact, whole-word, or multi-word substring)? */
export function classMatches(value: string, candidates: readonly string[]): boolean {
  const normalized = normalizeClass(value);
  if (normalized.length === 0) return false;
  const tokens = normalized.split(' ').filter((token) => token.length > 0);
  return candidates.some((candidate) => {
    const wanted = normalizeClass(candidate);
    if (wanted.length === 0) return false;
    if (wanted === normalized || tokens.includes(wanted)) return true;
    return wanted.includes(' ') && normalized.includes(wanted);
  });
}

/** Does any of several labels match any candidate? */
export function anyClassMatches(values: readonly string[], candidates: readonly string[]): boolean {
  return values.some((value) => classMatches(value, candidates));
}

/** Pick the first candidate key (exact, then word match) of a label to value table. */
export function lookupByClass<T>(table: Readonly<Record<string, T>>, value: string): T | undefined {
  const exact = table[value] ?? table[value.toLowerCase()];
  if (exact !== undefined) return exact;
  for (const [key, entry] of Object.entries(table)) {
    if (classMatches(value, [key])) return entry;
  }
  return undefined;
}
