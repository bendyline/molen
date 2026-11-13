import type { SnowCoverData } from '@bendyline/molen-schema';

/**
 * Lying snow for a snow-level choice (the Weather panel's Snow level list, `?snow=`): `all`
 * covers everything with a moderate fall that lies deeper in the hills, and a number is the snow
 * line in meters above sea level. Undefined for `off` and for anything else.
 */
export function snowCoverChoice(value: string): SnowCoverData | undefined {
  if (value === 'all') return { level: -100, transition: 0, depth: 0.15, depthGain: 0.4 };
  const level = value.trim() === '' ? Number.NaN : Number(value);
  return Number.isFinite(level) && level >= -500 && level <= 9000 ? { level } : undefined;
}
