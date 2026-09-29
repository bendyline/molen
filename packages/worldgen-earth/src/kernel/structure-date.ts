/** Calendar-only ISO date validation without a clock, timezone, or Date dependency. */
export function isStructureViewingDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value)) return false;
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return year > 0 && month >= 1 && month <= 12 && day >= 1 && day <= (days[month - 1] ?? 0);
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
    isStructureViewingDate(item.validFrom) &&
    isStructureViewingDate(item.validUntil) &&
    item.validFrom < item.validUntil &&
    (item.representedDate === undefined ||
      (typeof item.representedDate === 'string' && item.representedDate.trim().length > 0))
  );
}
