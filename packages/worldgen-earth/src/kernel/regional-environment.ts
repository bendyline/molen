import type { WildlifeChoice } from '@bendyline/molen-ambient/kernel';
import {
  type PlantSeason,
  type ScatterDoc,
  seasonalPlantId,
  seasonalPlantPresets,
  type WorldgenBatchInput,
} from '@bendyline/molen-worldgen/kernel';
import { agriculturalPlantPresets } from './agriculture';
import { createEcologyResolver, type EcologyAtlasDoc, type EcologyResolver } from './ecology-atlas';
import { plantCalendar } from './plant-calendar';
import type { RegionResolver, WorldBounds } from './region';
import {
  createRegionalLibrary,
  matchesRegionalProfile,
  type RegionalCatalogDoc,
  type RegionalLibrary,
  type RegionalSelection,
} from './regional-content';
import {
  createWildlifeRangeResolver,
  type WildlifeRangeResolver,
  type WildlifeRangesDoc,
} from './wildlife-ranges';

/** Documents cross the worker boundary once; lookup caches and functions stay local. */
export interface RegionalEnvironmentDocs {
  atlas?: EcologyAtlasDoc;
  catalogs: RegionalCatalogDoc[];
  /** Explicit 1..12 calendar month; omission retains neutral leaf-on appearance. */
  vegetationMonth?: number;
  wildlifeRanges?: WildlifeRangesDoc;
}

export interface RegionalEnvironment {
  readonly docs: RegionalEnvironmentDocs;
  readonly ecology: EcologyResolver | undefined;
  /** False for architecture-only modules: preserve the host's existing scatter and ground. */
  readonly hasEcology: boolean;
  readonly library: RegionalLibrary;
  readonly wildlifeRanges: WildlifeRangeResolver | undefined;
  at(x: number, z: number): RegionalSelection;
  /** Vegetation/ground channel only; avoids unrelated architectural polygon lookups. */
  scatterAt(x: number, z: number): ScatterDoc | undefined;
  agricultureAt(x: number, z: number): RegionalSelection;
  modelAt(model: string, x: number, z: number): string;
  seasonAt(z: number): PlantSeason;
  /** Range + potential habitat + observed local context, before actual-surface placement. */
  wildlife(
    x: number,
    z: number,
    context?: { waterDistance?: number; protected?: boolean },
  ): WildlifeChoice[];
  /** Combined document shares one instance/model budget, with pointwise ecological filtering. */
  scatter(bounds: WorldBounds): WorldgenBatchInput['scatterEnvironment'];
}

export function createRegionalEnvironment(
  docs: RegionalEnvironmentDocs,
  metersPerUnit: number,
  regions?: RegionResolver,
): RegionalEnvironment {
  const ecology =
    docs.atlas === undefined ? undefined : createEcologyResolver(docs.atlas, metersPerUnit);
  const wildlifeRanges =
    docs.wildlifeRanges === undefined
      ? undefined
      : createWildlifeRangeResolver(docs.wildlifeRanges, metersPerUnit);
  const source = createRegionalLibrary(docs.catalogs);
  const library = {
    ...source,
    plants: agriculturalPlantPresets(
      docs.vegetationMonth === undefined ? source.plants : seasonalPlantPresets(source.plants),
      source.crops,
    ),
  };
  const seasonAt = plantCalendar(docs.vegetationMonth, metersPerUnit);
  const modelAt = (model: string, _x: number, z: number): string => {
    const plant = source.plants[model];
    return plant === undefined ? model : seasonalPlantId(plant, seasonAt(z));
  };
  if (
    ecology === undefined &&
    library.profiles.some(
      ({ match }) =>
        match.biomes !== undefined || match.realms !== undefined || match.ecoregions !== undefined,
    )
  )
    throw new Error('Ecological profile selectors require an ecological atlas');
  const hasEcology = library.profiles.some((profile) => profile.scatter !== undefined);
  if (docs.wildlifeRanges !== undefined) {
    const known = new Set(docs.wildlifeRanges.taxa.map((taxon) => taxon.id));
    for (const animal of library.animals.values())
      if (animal.range !== undefined && !known.has(animal.range))
        throw new Error(`Missing wildlife range: ${animal.range}`);
  }
  const cache = new Map<string, RegionalSelection>();
  const selectAt = (x: number, z: number, architectural: boolean): RegionalSelection => {
    const ecoregion = ecology?.resolve(x, z);
    const regionId = architectural ? regions?.resolve(x, z)?.id : undefined;
    const key = `${ecoregion?.id ?? '-'}:${regionId ?? '-'}`;
    let selected = cache.get(key);
    if (selected === undefined) {
      selected = library.select({
        ...(ecoregion !== undefined ? { ecoregion } : {}),
        ...(regionId !== undefined ? { regionId } : {}),
      });
      cache.set(key, selected);
    }
    return selected;
  };
  const scatterUsesRegions = library.profiles.some(
    (profile) => profile.scatter !== undefined && profile.match.regions !== undefined,
  );
  const at = (x: number, z: number) => selectAt(x, z, true);
  const scatterAt = (x: number, z: number) => selectAt(x, z, scatterUsesRegions).scatter;
  const agricultureUsesRegions = library.profiles.some(
    (profile) => profile.agriculture !== undefined && profile.match.regions !== undefined,
  );
  return {
    docs,
    ecology,
    hasEcology,
    library,
    wildlifeRanges,
    at,
    scatterAt,
    agricultureAt: (x, z) => selectAt(x, z, agricultureUsesRegions),
    modelAt,
    seasonAt,
    wildlife(x, z, context = {}) {
      const population = at(x, z).wildlife;
      const ecoregion = ecology?.resolve(x, z);
      // Uncovered geographic cells do not authorize a generic global fauna fallback.
      if (population === undefined || ecoregion === undefined) return [];
      const regionId = regions?.resolve(x, z)?.id;
      const choices: WildlifeChoice[] = [];
      for (const rule of population.rules) {
        if (
          !matchesRegionalProfile(rule.match, {
            ecoregion,
            ...(regionId !== undefined ? { regionId } : {}),
          }) ||
          (rule.protectedOnly && context.protected !== true) ||
          (rule.nearWater !== undefined &&
            !(context.waterDistance !== undefined && context.waterDistance <= rule.nearWater))
        )
          continue;
        const species = library.animals.get(rule.animal);
        if (species?.inactiveInWinter && seasonAt(z) === 'winter') continue;
        if (
          species === undefined ||
          (species.range !== undefined && wildlifeRanges?.includes(species.range, x, z) !== true)
        )
          continue;
        choices.push({ species, density: rule.density, habitats: rule.habitats });
      }
      return choices;
    },
    scatter(bounds) {
      if (!hasEcology) return undefined;
      const documents = new Map<string, ScatterDoc>();
      const architecturalRegions = [undefined, ...(regions?.intersecting(bounds) ?? [])];
      for (const ecoregion of ecology?.intersecting(bounds) ?? [undefined]) {
        for (const region of architecturalRegions) {
          const selection = library.select({
            ...(ecoregion !== undefined ? { ecoregion } : {}),
            ...(region !== undefined ? { regionId: region.id } : {}),
          });
          if (selection.scatter !== undefined)
            documents.set(selection.scatter.id, selection.scatter);
        }
      }
      const owner = new Map<string, string>();
      const sources = [...documents.values()].sort((a, b) => (a.id < b.id ? -1 : 1));
      const first = sources[0];
      const doc: ScatterDoc = {
        format: 'molen/scatter@1',
        id: 'molen.regional.scatter',
        version: 1,
        title: 'Spatially composed regional vegetation',
        surface: first?.surface ?? { default: '#929183', colors: {} },
        defaults: first?.defaults ?? {
          avoid: { roads: 5, buildings: 3, water: 1.5 },
          slopeMax: 0.75,
          lod: { keepByTier: [1, 0.45, 0.18, 0.06], maxInstancesPerBatch: 9000 },
        },
        rules: sources.flatMap((source) =>
          source.rules.map((rule) => {
            // Each source owns its seed/version. Adding or changing an unrelated module cannot
            // rearrange this rule's candidates, even when the two share a tile.
            const id = `${source.id}@${source.version}/${rule.id}`;
            owner.set(id, source.id);
            return {
              ...rule,
              id,
              avoid: { ...source.defaults.avoid, ...rule.avoid },
              slopeMax: rule.slopeMax ?? source.defaults.slopeMax,
              lod: { ...source.defaults.lod, ...rule.lod },
            };
          }),
        ),
      };
      return {
        doc,
        pack: { name: 'molen.ecology', version: '1' },
        acceptsRule: (rule, x, z) =>
          scatterAt(bounds[0] + x, bounds[1] + z)?.id === owner.get(rule.id),
        modelAt: (model, x, z) => modelAt(model, bounds[0] + x, bounds[1] + z),
      };
    },
  };
}
