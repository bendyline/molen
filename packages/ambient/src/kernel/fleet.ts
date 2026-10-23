/** Small, geometry-free market profiles. Weights are visual priors, not sales statistics. */
import { getSchema, registerSchema } from '@bendyline/molen-schema';
import { z } from 'zod';
import { fmix32, unit01 } from './ids';

const weights = z.record(z.string().min(1), z.number().finite().nonnegative());
export interface FleetCatalog {
  format: 'molen/fleet-catalog@1';
  id: string;
  version: number;
  description: string;
  fallback: string;
  regions: Record<string, string>;
  profiles: Array<{ id: string; title: string; extends?: string; weights: Record<string, number> }>;
}
export const fleetCatalogSchema: z.ZodType<FleetCatalog> = z.strictObject({
  format: z.literal('molen/fleet-catalog@1'),
  id: z.string().min(1),
  version: z.number().int().positive(),
  description: z.string(),
  fallback: z.string().min(1),
  regions: z.record(z.string(), z.string().min(1)),
  profiles: z
    .array(
      z.strictObject({
        id: z.string().min(1),
        title: z.string().min(1),
        extends: z.string().optional(),
        weights,
      }),
    )
    .min(1),
});
export interface FleetMix {
  profile: string;
  weights: ReadonlyMap<string, number>;
}
export interface FleetLibrary {
  regions: ReadonlyMap<string, string>;
  /** Stable bounded shortlist; never depends on camera motion, downloads or wall time. */
  select(region?: string): FleetMix;
}

function seedOf(value: string): number {
  let seed = 2166136261;
  for (let i = 0; i < value.length; i++) seed = Math.imul(seed ^ value.charCodeAt(i), 16777619);
  return fmix32(seed);
}

export function createFleetLibrary(
  documents: readonly FleetCatalog[],
  available: ReadonlySet<string>,
  maxModels = 16,
): FleetLibrary {
  if (!Number.isInteger(maxModels) || maxModels < 1 || maxModels > 128)
    throw new Error('Fleet maxModels must be an integer from 1 to 128');
  const profiles = new Map<string, FleetCatalog['profiles'][number]>();
  const regions = new Map<string, string>();
  let fallback: string | undefined;
  for (const raw of documents) {
    const doc = fleetCatalogSchema.parse(raw);
    fallback ??= doc.fallback;
    for (const profile of doc.profiles) {
      if (profiles.has(profile.id)) throw new Error(`Duplicate fleet profile: ${profile.id}`);
      profiles.set(profile.id, profile);
    }
    for (const [region, profile] of Object.entries(doc.regions)) {
      if (regions.has(region)) throw new Error(`Duplicate fleet region: ${region}`);
      regions.set(region, profile);
    }
  }
  const resolved = new Map<string, Record<string, number>>();
  const resolve = (id: string, visiting = new Set<string>()): Record<string, number> => {
    const cached = resolved.get(id);
    if (cached) return cached;
    const profile = profiles.get(id);
    if (!profile) throw new Error(`Unknown fleet profile: ${id}`);
    if (visiting.has(id)) throw new Error(`Cyclic fleet inheritance: ${id}`);
    visiting.add(id);
    const result = {
      ...(profile.extends ? resolve(profile.extends, visiting) : {}),
      ...profile.weights,
    };
    visiting.delete(id);
    resolved.set(id, result);
    return result;
  };
  for (const id of profiles.keys()) resolve(id);
  for (const id of regions.values()) resolve(id);
  if (!fallback) throw new Error('A fleet catalog needs a fallback');
  resolve(fallback);
  const mixes = new Map<string, FleetMix>();
  const select = (region?: string): FleetMix => {
    const profile = (region && regions.get(region)) || (fallback as string);
    const cached = mixes.get(profile);
    if (cached) return cached;
    const pool = Object.entries(resolve(profile))
      .filter(([id, weight]) => weight > 0 && available.has(id))
      .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
    // Keep the commonest models, then draw the rest without replacement. Model IDs, not load
    // completion order, break ties. Colors supply additional variation without new geometry.
    const chosen = pool.splice(0, Math.min(4, maxModels));
    const seed = seedOf(profile);
    while (pool.length && chosen.length < maxModels) {
      let draw = unit01(seed, chosen.length) * pool.reduce((sum, [, weight]) => sum + weight, 0);
      let at = 0;
      while (at < pool.length - 1 && draw >= (pool[at]?.[1] ?? 0)) draw -= pool[at++]?.[1] ?? 0;
      chosen.push(...pool.splice(at, 1));
    }
    const mix = { profile, weights: new Map(chosen) };
    mixes.set(profile, mix);
    return mix;
  };
  return { regions, select };
}

export function registerFleetSchema(): void {
  if (getSchema('fleet-catalog')) return;
  registerSchema('fleet-catalog', fleetCatalogSchema, {
    id: 'molen/fleet-catalog@1',
    title: 'Regional vehicle fleet',
    description: 'Shared vehicle IDs with inherited regional spawn weights and a global fallback.',
    docsRef: 'guide/regional-fleets.md',
    examples: [
      {
        format: 'molen/fleet-catalog@1',
        id: 'example.fleet',
        version: 1,
        description: 'Illustrative visual mixture',
        fallback: 'global',
        regions: {},
        profiles: [{ id: 'global', title: 'Global', weights: { 'example.car': 1 } }],
      },
    ],
    validate(data) {
      try {
        createFleetLibrary([data as FleetCatalog], new Set());
        return [];
      } catch (error) {
        return [{ path: '', code: 'invalid_fleet', message: (error as Error).message }];
      }
    },
  });
}
registerFleetSchema();
