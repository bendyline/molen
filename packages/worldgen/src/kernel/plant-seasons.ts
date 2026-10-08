import type { PlantPreset } from './plant-types';

export type PlantSeason = 'summer' | 'spring' | 'autumn' | 'winter';

/** Derived recipes share dimensions and identity roots; no downloads or placement rerolls. */
export function seasonalPlantPresets(
  plants: Readonly<Record<string, PlantPreset>>,
): Readonly<Record<string, PlantPreset>> {
  const output: Record<string, PlantPreset> = { ...plants };
  for (const p of Object.values(plants)) {
    if (p.phenology === undefined) continue;
    for (const season of ['spring', 'autumn', 'winter'] as const) {
      const id = seasonalPlantId(p, season);
      if (output[id] !== undefined)
        throw new Error(`Seasonal plant ID collides with authored preset: ${id}`);
      const variant: PlantPreset = {
        ...p,
        id,
        title: `${p.title} (${season})`,
        foliage: season === 'winter' ? p.foliage : p.phenology[season],
        leafless: season === 'winter',
      };
      delete variant.taxa;
      delete variant.phenology;
      output[id] = variant;
    }
  }
  return output;
}

export function seasonalPlantId(plant: PlantPreset, season: PlantSeason): string {
  return plant.phenology === undefined || season === 'summer' ? plant.id : `${plant.id}.${season}`;
}
