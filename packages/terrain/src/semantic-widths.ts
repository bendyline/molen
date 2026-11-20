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

/**
 * Carriageway width in world units for a road with no width or lane count mapped. `roadWidth`
 * is the width of a whole road of a class, both directions. A way that carries only part of
 * one is narrower: a ramp is a lane or two whatever road it leaves (two off a freeway, one off
 * a street), and one carriageway of a divided freeway is three lanes, not the five that the
 * freeway's whole width divides into. Drawn at the whole width, the ramps of an interchange
 * overlapped each other and the road they joined for most of their length.
 */
export function carriagewayWidth(
  className: string,
  traits: { link?: boolean; oneway?: boolean } = {},
): number {
  const whole = roadWidth(className);
  const freeway = whole >= 16;
  if (traits.link) return freeway ? 6.6 : Math.min(whole, 4.5);
  if (traits.oneway && freeway) return 11;
  return whole;
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
