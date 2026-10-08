/** Composable regional channels. Content dependencies are explicit and never fetched here. */
import { type WildlifeSpecies, wildlifeSpeciesSchema } from '@bendyline/molen-ambient/kernel';
import {
  type PlantPreset,
  plantPresetSchema,
  type ResolvedStylePack,
  type ScatterDoc,
  type StyleRule,
  validateScatter,
} from '@bendyline/molen-worldgen/kernel';
import type { Ecoregion } from './ecology-atlas';

export interface RegionalMatch {
  /** AND between dimensions, OR within each list. Omitted dimensions impose no constraint. */
  biomes?: number[];
  realms?: string[];
  ecoregions?: number[];
  /** Architectural atlas region IDs. Ecology-only profiles normally omit this. */
  regions?: string[];
}

export interface RegionalProfile {
  id: string;
  title: string;
  /** Higher wins, separately in each channel. Equal-priority competing channels are errors. */
  priority: number;
  match: RegionalMatch;
  scatter?: string;
  buildings?: StyleRule[];
  wildlife?: string;
}

export interface RegionalWildlifePopulation {
  id: string;
  title: string;
  rules: Array<{
    animal: string;
    /** Visual prior per square kilometer, not a census or occurrence estimate. */
    density: number;
    habitats: string[];
    match: RegionalMatch;
    /** Additional gate for animals that need mapped nearby water. */
    nearWater?: number;
    /** Large/rare fauna require explicit conservation habitat; country presence is insufficient. */
    protectedOnly?: boolean;
  }>;
}

export interface RegionalCatalogDoc {
  format: 'molen/regional-catalog@1';
  id: string;
  version: number;
  title: string;
  /** Exact content versions; hosts must supply all required catalogs. */
  requires: Array<{ id: string; version: number }>;
  /** IDs of profiles or scatter documents intentionally replaced from required catalogs. */
  overrides: string[];
  profiles: RegionalProfile[];
  scatters: ScatterDoc[];
  plants?: PlantPreset[];
  animals?: WildlifeSpecies[];
  populations?: RegionalWildlifePopulation[];
  /** Bind architecture to this style-pack identity. Other hosts omit this whole module. */
  stylePack?: string;
}

export interface RegionalContext {
  ecoregion?: Ecoregion;
  regionId?: string;
}

export interface RegionalSelection {
  scatter?: ScatterDoc;
  ecologyProfile?: string;
  buildings?: StyleRule[];
  architectureProfile?: string;
  wildlife?: RegionalWildlifePopulation;
  wildlifeProfile?: string;
}

export interface RegionalLibrary {
  readonly catalogs: readonly RegionalCatalogDoc[];
  readonly profiles: readonly RegionalProfile[];
  readonly scatters: ReadonlyMap<string, ScatterDoc>;
  readonly plants: Readonly<Record<string, PlantPreset>>;
  readonly taxa: ReadonlyMap<string, PlantPreset>;
  readonly animals: ReadonlyMap<string, WildlifeSpecies>;
  readonly populations: ReadonlyMap<string, RegionalWildlifePopulation>;
  select(context: RegionalContext): RegionalSelection;
}

export function matchesRegionalProfile(match: RegionalMatch, context: RegionalContext): boolean {
  const eco = context.ecoregion;
  return (
    (match.biomes === undefined || (eco !== undefined && match.biomes.includes(eco.biome))) &&
    (match.realms === undefined || (eco !== undefined && match.realms.includes(eco.realm))) &&
    (match.ecoregions === undefined || (eco !== undefined && match.ecoregions.includes(eco.id))) &&
    (match.regions === undefined ||
      (context.regionId !== undefined && match.regions.includes(context.regionId)))
  );
}

function selectorsOverlap(a: RegionalMatch, b: RegionalMatch): boolean {
  const intersects = <T>(x: T[] | undefined, y: T[] | undefined): boolean =>
    x === undefined || y === undefined || x.some((value) => y.includes(value));
  return (
    intersects(a.biomes, b.biomes) &&
    intersects(a.realms, b.realms) &&
    intersects(a.ecoregions, b.ecoregions) &&
    intersects(a.regions, b.regions)
  );
}

/** Resolve in dependency order, independent of pack load order. Reject accidental replacement. */
export function createRegionalLibrary(
  catalogs: readonly RegionalCatalogDoc[],
  stylePack?: Pick<ResolvedStylePack, 'id' | 'archstyles'>,
): RegionalLibrary {
  const byId = new Map<string, RegionalCatalogDoc>();
  for (const doc of catalogs) {
    if (stylePack !== undefined && doc.stylePack !== undefined && doc.stylePack !== stylePack.id)
      continue;
    if (doc.format !== 'molen/regional-catalog@1' || byId.has(doc.id))
      throw new Error(`Invalid or duplicate regional catalog: ${doc.id}`);
    byId.set(doc.id, doc);
  }
  const ordered: RegionalCatalogDoc[] = [];
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const ancestors = new Map<string, Set<string>>();
  const visit = (doc: RegionalCatalogDoc): void => {
    if (visited.has(doc.id)) return;
    if (visiting.has(doc.id)) throw new Error(`Regional dependency cycle: ${doc.id}`);
    visiting.add(doc.id);
    const inherited = new Set<string>();
    for (const dependency of [...doc.requires].sort((a, b) => (a.id < b.id ? -1 : 1))) {
      const required = byId.get(dependency.id);
      if (required === undefined || required.version !== dependency.version)
        throw new Error(
          `Regional catalog ${doc.id} requires ${dependency.id}@${dependency.version}`,
        );
      visit(required);
      inherited.add(required.id);
      for (const ancestor of ancestors.get(required.id) ?? []) inherited.add(ancestor);
    }
    ancestors.set(doc.id, inherited);
    visiting.delete(doc.id);
    visited.add(doc.id);
    ordered.push(doc);
  };
  for (const doc of [...byId.values()].sort((a, b) => (a.id < b.id ? -1 : 1))) visit(doc);
  const owners = new Map<string, string>();
  const profiles = new Map<string, RegionalProfile>();
  const scatters = new Map<string, ScatterDoc>();
  const plants = new Map<string, PlantPreset>();
  const animals = new Map<string, WildlifeSpecies>();
  const populations = new Map<string, RegionalWildlifePopulation>();
  for (const doc of ordered) {
    const replaced = new Set<string>();
    const local = new Set<string>();
    const insert = <T extends { id: string }>(value: T, target: Map<string, T>): void => {
      const owner = owners.get(value.id);
      if (local.has(value.id)) throw new Error(`Duplicate regional item: ${value.id}`);
      local.add(value.id);
      if (owner !== undefined) {
        if (
          !doc.overrides.includes(value.id) ||
          !ancestors.get(doc.id)?.has(owner) ||
          !target.has(value.id)
        )
          throw new Error(
            `Regional item ${value.id} needs an explicit dependency and override in ${doc.id}`,
          );
        replaced.add(value.id);
      }
      owners.set(value.id, doc.id);
      target.set(value.id, value);
    };
    for (const scatter of doc.scatters) {
      const errors = validateScatter(scatter).filter((issue) => issue.severity !== 'notice');
      if (errors.length > 0)
        throw new Error(`Invalid regional scatter ${scatter.id}: ${errors[0]?.message}`);
      insert(scatter, scatters);
    }
    for (const profile of doc.profiles) insert(profile, profiles);
    for (const plant of doc.plants ?? []) insert(plantPresetSchema.parse(plant), plants);
    for (const animal of doc.animals ?? []) insert(wildlifeSpeciesSchema.parse(animal), animals);
    for (const population of doc.populations ?? []) insert(population, populations);
    for (const override of doc.overrides)
      if (!replaced.has(override)) throw new Error(`Unused regional override: ${override}`);
  }
  const sorted = [...profiles.values()].sort(
    (a, b) => b.priority - a.priority || (a.id < b.id ? -1 : 1),
  );
  const taxa = new Map<string, PlantPreset>();
  for (const population of populations.values()) {
    const used = new Set<string>();
    for (const rule of population.rules) {
      if (!animals.has(rule.animal)) throw new Error(`Missing regional animal: ${rule.animal}`);
      if (used.has(rule.animal)) throw new Error(`Duplicate animal in population: ${rule.animal}`);
      used.add(rule.animal);
      if (!Number.isFinite(rule.density) || rule.density < 0 || rule.density > 100)
        throw new Error(`Invalid wildlife density: ${rule.animal}`);
    }
  }
  for (const plant of plants.values()) {
    for (const name of plant.taxa ?? []) {
      const key = name.trim().toLowerCase().replace(/\s+/g, ' ');
      if (taxa.has(key) && taxa.get(key)?.id !== plant.id)
        throw new Error(`Ambiguous mapped plant taxon: ${name}`);
      taxa.set(key, plant);
    }
  }
  for (let i = 0; i < sorted.length; i++) {
    const profile = sorted[i] as RegionalProfile;
    if (profile.scatter !== undefined && !scatters.has(profile.scatter))
      throw new Error(`Missing regional scatter: ${profile.scatter}`);
    if (profile.wildlife !== undefined && !populations.has(profile.wildlife))
      throw new Error(`Missing regional wildlife population: ${profile.wildlife}`);
    if (stylePack !== undefined) {
      for (const rule of profile.buildings ?? []) {
        for (const style of [rule.style, ...(rule.variants ?? []).map((entry) => entry.style)]) {
          if (stylePack.archstyles[style] === undefined)
            throw new Error(`Regional profile ${profile.id} references missing style: ${style}`);
        }
      }
    }
    for (const other of sorted.slice(i + 1)) {
      if (profile.priority !== other.priority || !selectorsOverlap(profile.match, other.match))
        continue;
      if (
        (profile.scatter !== undefined && other.scatter !== undefined) ||
        (profile.buildings !== undefined && other.buildings !== undefined) ||
        (profile.wildlife !== undefined && other.wildlife !== undefined)
      )
        throw new Error(`Ambiguous regional channel: ${profile.id} and ${other.id}`);
    }
  }
  return {
    catalogs: ordered,
    profiles: sorted,
    scatters,
    plants: Object.fromEntries(plants),
    taxa,
    animals,
    populations,
    select(context) {
      const selection: RegionalSelection = {};
      for (const profile of sorted) {
        if (!matchesRegionalProfile(profile.match, context)) continue;
        if (selection.scatter === undefined && profile.scatter !== undefined) {
          selection.scatter = scatters.get(profile.scatter) as ScatterDoc;
          selection.ecologyProfile = profile.id;
        }
        if (selection.buildings === undefined && profile.buildings !== undefined) {
          selection.buildings = profile.buildings;
          selection.architectureProfile = profile.id;
        }
        if (selection.wildlife === undefined && profile.wildlife !== undefined) {
          selection.wildlife = populations.get(profile.wildlife) as RegionalWildlifePopulation;
          selection.wildlifeProfile = profile.id;
        }
      }
      return selection;
    },
  };
}
