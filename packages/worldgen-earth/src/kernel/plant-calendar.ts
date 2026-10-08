import type { PlantSeason } from '@bendyline/molen-worldgen/kernel';
import { projectWgs84 } from './projection';

const boundaries = [23.5, 40, 55, 66].map((latitude) => Math.abs(projectWgs84(0, latitude)[1]));
// Coarse deciduous phenology. No snow, weather, tropical dry season or local species occurrence
// is inferred. A host supplies the month once, so workers and repeated visits remain reproducible.
const calendars = ['wppsssssssaw', 'wwppsssssaaw', 'wwwppsssaaww', 'wwwwppssawww'];
const seasons: Record<string, PlantSeason> = { w: 'winter', p: 'spring', s: 'summer', a: 'autumn' };

export function plantCalendar(
  month: number | undefined,
  metersPerUnit: number,
): (z: number) => PlantSeason {
  if (month === undefined) return () => 'summer';
  if (!Number.isInteger(month) || month < 1 || month > 12)
    throw new Error('vegetationMonth must be an integer from 1 through 12');
  const bands = boundaries.map((z) => z * metersPerUnit);
  return (z) => {
    const abs = Math.abs(z);
    if (abs < (bands[0] as number)) return 'summer';
    const band =
      abs < (bands[1] as number)
        ? 0
        : abs < (bands[2] as number)
          ? 1
          : abs < (bands[3] as number)
            ? 2
            : 3;
    const localMonth = z <= 0 ? month - 1 : (month + 5) % 12;
    return seasons[calendars[band]?.[localMonth] ?? 's'] ?? 'summer';
  };
}
