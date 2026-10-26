/**
 * Label matching shared by style rules and scatter rules. Labels are opaque strings; matching is
 * by whole word so `house` matches `semidetached_house` but never `warehouse`.
 */

// Labels and rule candidates are a small, repeating vocabulary, and every building tests every
// rule's lists: normalizing and splitting them each time was a tenth of a worker's generation.
const normalizedLabels = new Map<string, string>();
const verdicts = new WeakMap<readonly string[], Map<string, boolean>>();
const CACHE_LIMIT = 8192;

export function normalizeClass(value: string): string {
  let normalized = normalizedLabels.get(value);
  if (normalized === undefined) {
    normalized = value
      .trim()
      .toLowerCase()
      .replaceAll('_', ' ')
      .replaceAll('-', ' ')
      .replaceAll(':', ' ');
    if (normalizedLabels.size >= CACHE_LIMIT) normalizedLabels.clear();
    normalizedLabels.set(value, normalized);
  }
  return normalized;
}

/**
 * Does one label match any candidate (exact, whole-word, or multi-word substring)? Remembered per
 * candidate list (rule data, not changed once loaded).
 */
export function classMatches(value: string, candidates: readonly string[]): boolean {
  let known = verdicts.get(candidates);
  if (known === undefined) {
    known = new Map();
    verdicts.set(candidates, known);
  }
  let verdict = known.get(value);
  if (verdict === undefined) {
    verdict = matchClass(value, candidates);
    if (known.size >= CACHE_LIMIT) known.clear();
    known.set(value, verdict);
  }
  return verdict;
}

function matchClass(value: string, candidates: readonly string[]): boolean {
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
