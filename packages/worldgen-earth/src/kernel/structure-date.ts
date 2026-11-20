function calendarDateKey(value: unknown): number | undefined {
  if (typeof value !== 'string') return undefined;
  const match = /^([0-9]{4}|[+-][0-9]{6})-([0-9]{2})-([0-9]{2})$/.exec(value);
  if (!match || match[0] !== value || match[1] === '-000000') return undefined;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (month < 1 || month > 12 || day < 1 || day > (days[month - 1] ?? 0)) return undefined;
  return year * 10_000 + month * 100 + day;
}

/** Calendar-only ISO dates, including signed expanded years. */
export function isStructureViewingDate(value: unknown): value is string {
  return calendarDateKey(value) !== undefined;
}

/** Check that both bounds are calendar dates and that the interval has positive length. */
export function isStructureViewingDateRange(validFrom: unknown, validUntil: unknown): boolean {
  const from = calendarDateKey(validFrom);
  const until = calendarDateKey(validUntil);
  return from !== undefined && until !== undefined && from < until;
}

/** Select a date in the half-open interval [validFrom, validUntil). */
export function isStructureViewingDateInRange(
  date: unknown,
  validFrom: unknown,
  validUntil: unknown,
): boolean {
  const day = calendarDateKey(date);
  const from = calendarDateKey(validFrom);
  const until = calendarDateKey(validUntil);
  return (
    day !== undefined && from !== undefined && until !== undefined && day >= from && day < until
  );
}

/** A dated reconstruction that is never eligible for the default current-world view. */
export interface HistoricalStructureAppearance {
  kind: 'historical';
  currentWorldEligible: false;
  representedDate?: string;
  /** Inclusive ISO calendar date. */
  validFrom: string;
  /** Exclusive ISO calendar date. */
  validUntil: string;
}

export function isHistoricalStructureAppearance(
  value: unknown,
): value is HistoricalStructureAppearance {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<HistoricalStructureAppearance>;
  return (
    item.kind === 'historical' &&
    item.currentWorldEligible === false &&
    isStructureViewingDateRange(item.validFrom, item.validUntil) &&
    (item.representedDate === undefined ||
      (typeof item.representedDate === 'string' && item.representedDate.trim().length > 0))
  );
}
