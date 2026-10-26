/**
 * Rendered width heuristics for linear semantic features whose source carries no width. Shared by
 * the default road/waterway ribbons and by adapters that need matching clearances.
 */

function normalizedClass(value: string): string {
  return value.trim().toLowerCase().replaceAll('_', ' ');
}

/** Road ribbon width in world units for a transportation class. */
export function roadWidth(className: string, explicit?: number): number {
  if (explicit !== undefined) return explicit;
  const value = normalizedClass(className);
  if (value.includes('motorway') || value.includes('freeway') || value.includes('highway'))
    return 16;
  if (value.includes('primary') || value.includes('trunk') || value.includes('major road'))
    return 12;
  if (value.includes('secondary') || value.includes('minor road')) return 8;
  if (value.includes('path') || value.includes('trail')) return 2.5;
  return 6;
}

/** Waterway ribbon width in world units for a water class. */
export function waterwayWidth(className: string | undefined, explicit?: number): number {
  if (explicit !== undefined) return explicit;
  const value = normalizedClass(className ?? '');
  if (value.includes('river')) return 10;
  if (value.includes('canal')) return 5;
  if (value.includes('stream')) return 2;
  if (value.includes('ditch') || value.includes('drain')) return 1;
  if (value.includes('moat')) return 4;
  return 2.5;
}
