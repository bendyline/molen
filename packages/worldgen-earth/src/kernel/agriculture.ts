/** Agricultural appearance is derived from observed land use, never from climate alone. Crop
 * identity, row phase and calendars are shared by surface and scatter generation. Unnamed map
 * polygons use a fixed world grid; those divisions are visual defaults, not surveyed parcels. */

import type {
  TerrainCultivation,
  TerrainLandcoverFeature,
  TerrainSemanticTile,
} from '@bendyline/molen-terrain/kernel';
import {
  hashString,
  type PlantPreset,
  type ScatterRule,
  type WorldgenBatchInput,
} from '@bendyline/molen-worldgen/kernel';
import polygonClipping from 'polygon-clipping';
import type { AgricultureCrop, AgricultureProfile } from './agriculture-types';
import { projectWgs84 } from './projection';
import type { RegionalEnvironment } from './regional-environment';
import type { TileGeometry } from './semantic-adapter';

type Stage = TerrainCultivation['stage'];
const CULTIVATED = new Set([
  'farmland',
  'crop',
  'cropland',
  'orchard',
  'vineyard',
  'plantation',
  'pasture',
]);
const normal = (value: string): string => value.toLowerCase().trim().replace(/[ -]+/g, '_');
export const agricultureFieldLabel = (id: string): string => `field:${hashString(id).toString(16)}`;

export function agricultureStage(
  crop: AgricultureCrop,
  month: number | undefined,
  z: number,
  tropical = false,
  calendar?: { sowingMonth?: number; harvestMonth?: number },
): Stage {
  if (crop.kind !== 'annual' || month === undefined || (tropical && !calendar?.sowingMonth))
    return 'mature';
  const localMonth = calendar?.sowingMonth ? month : z <= 0 ? month : ((month + 5) % 12) + 1;
  const growingMonths =
    calendar?.sowingMonth && calendar.harvestMonth
      ? (calendar.harvestMonth - calendar.sowingMonth + 12) % 12 || 11
      : crop.growingMonths;
  const age = (localMonth - (calendar?.sowingMonth ?? crop.sowingMonth) + 12) % 12;
  if (age === 0) return 'sown';
  if (age < Math.max(2, growingMonths - 2)) return 'growing';
  if (age < growingMonths - 1) return 'mature';
  return age < growingMonths ? 'ripe' : 'stubble';
}

export function agriculturalPlantPresets(
  plants: Readonly<Record<string, PlantPreset>>,
  crops: ReadonlyMap<string, AgricultureCrop>,
): Record<string, PlantPreset> {
  const result = { ...plants };
  for (const crop of crops.values()) {
    if (crop.kind !== 'annual') continue;
    for (const id of new Set([crop.model, ...(crop.variants ?? [])])) {
      const source = plants[id];
      if (!source) continue;
      for (const stage of ['sown', 'growing', 'ripe', 'stubble'] as const) {
        const height = source.height * { sown: 0.15, growing: 0.6, ripe: 1, stubble: 0.12 }[stage];
        result[`${id}.${stage}`] = {
          ...source,
          id: `${id}.${stage}`,
          title: `${source.title} (${stage})`,
          cropStage: stage,
          height: Math.max(0.1, height),
          foliage: stage === 'ripe' || stage === 'stubble' ? crop.ripe : source.foliage,
        };
      }
    }
  }
  return result;
}

function pick(profile: AgricultureProfile, orchard: boolean, seed: number): string {
  const choices = orchard ? (profile.orchards ?? profile.crops) : profile.crops;
  let value = (seed / 4294967296) * choices.reduce((sum, entry) => sum + entry.weight, 0);
  for (const entry of choices) {
    value -= entry.weight;
    if (value < 0) return entry.crop;
  }
  return choices[choices.length - 1]?.crop ?? '';
}

/** Pure and idempotent: workers and the surface renderer call this with identical content. */
export function prepareAgricultureTile(
  tile: TerrainSemanticTile,
  geom: TileGeometry,
  environment: RegionalEnvironment | undefined,
): { tile: TerrainSemanticTile; rules: ScatterRule[] } {
  if (!environment?.library.crops.size || geom.level < 10) return { tile, rules: [] };
  const crops = environment.library.crops;
  const aliases = new Map<string, AgricultureCrop>();
  for (const crop of crops.values())
    for (const alias of crop.aliases) aliases.set(normal(alias), crop);
  const rules = new Map<string, ScatterRule>();
  const landcover: TerrainLandcoverFeature[] = [];
  for (const feature of tile.landcover) {
    const kind =
      feature.subclass && CULTIVATED.has(feature.subclass) ? feature.subclass : feature.class;
    if (!CULTIVATED.has(kind)) {
      landcover.push(feature);
      continue;
    }
    const fields: Array<{ feature: TerrainLandcoverFeature; id: string; x: number; z: number }> =
      [];
    const anchor = feature.agriculture?.anchor;
    if (feature.agriculture?.fieldId !== undefined || feature.id !== undefined) {
      const first = feature.polygons[0]?.outer ?? [[0.5, 0.5]];
      const center = first.reduce(
        (p, q) => [p[0]! + q[0] / first.length, p[1]! + q[1] / first.length],
        [0, 0],
      );
      const projected = anchor
        ? projectWgs84(...anchor).map((n) => n * geom.metersPerUnit)
        : undefined;
      fields.push({
        feature,
        id: feature.agriculture?.fieldId ?? `map:${feature.id}`,
        x: projected?.[0] ?? geom.originX + center[0]! * geom.size,
        z: projected?.[1] ?? geom.originZ + center[1]! * geom.size,
      });
    } else {
      // A globally anchored fallback, clipped to actual farmland including holes. Coarse tiles
      // stay bounded; each finer level settles onto the same 2 km Mercator grid at zoom 13.
      const cellMeters = Math.max(2048, 2 ** Math.max(11, 24 - geom.level));
      const cell = cellMeters * geom.metersPerUnit;
      const x0 = Math.floor(geom.originX / cell),
        z0 = Math.floor(geom.originZ / cell);
      const x1 = Math.ceil((geom.originX + geom.size) / cell),
        z1 = Math.ceil((geom.originZ + geom.size) / cell);
      const source = feature.polygons.map((p) => [p.outer, ...(p.holes ?? [])]);
      for (let z = z0; z < z1; z++)
        for (let x = x0; x < x1; x++) {
          const u = (x * cell - geom.originX) / geom.size,
            v = (z * cell - geom.originZ) / geom.size,
            s = cell / geom.size;
          const parts = polygonClipping.intersection(source, [
            [
              [u, v],
              [u + s, v],
              [u + s, v + s],
              [u, v + s],
            ],
          ]);
          const polygons = parts.flatMap(([outer, ...holes]) =>
            outer ? [{ outer, ...(holes.length ? { holes } : {}) }] : [],
          );
          if (polygons.length)
            fields.push({
              feature: { ...feature, polygons },
              id: `inferred:${cellMeters}:${x}:${z}`,
              x: (x + 0.5) * cell,
              z: (z + 0.5) * cell,
            });
        }
    }
    for (const field of fields) {
      const selection = environment.agricultureAt(field.x, field.z);
      const profile = selection.agriculture;
      const observation = field.feature.agriculture;
      const tag =
        field.feature.crop ??
        field.feature.trees ??
        (kind === 'vineyard' ? 'grapes' : kind === 'pasture' ? 'pasture' : '');
      const observed =
        observation?.confidence === undefined || observation.confidence >= 0.65
          ? aliases.get(normal(tag))
          : undefined;
      const crop =
        observed ??
        (profile
          ? crops.get(
              pick(profile, kind === 'orchard' || kind === 'plantation', hashString(field.id)),
            )
          : undefined);
      if (!crop) {
        landcover.push(field.feature);
        continue;
      }
      const stage = agricultureStage(
        crop,
        environment.docs.vegetationMonth,
        field.z,
        profile?.tropical && Math.abs(field.z / geom.metersPerUnit) < 2_691_000,
        observed ? observation : undefined,
      );
      const id = agricultureFieldLabel(field.id);
      const angle =
        observation?.rowAngle ?? [0, 0, 90, 12, 168][hashString(`${field.id}:angle`) % 5] ?? 0;
      const evidence = observed ? (observation ? 'classified' : 'mapped') : 'inferred';
      const cultivation: TerrainCultivation = {
        fieldId: field.id,
        crop: crop.id,
        evidence,
        source: observed
          ? (observation?.source ?? 'map crop tag')
          : (selection.agricultureProfile ?? 'regional crop mixture'),
        ...(observed && observation?.year !== undefined ? { year: observation.year } : {}),
        stage,
        color:
          stage === 'stubble' || stage === 'sown'
            ? crop.soil
            : stage === 'ripe'
              ? crop.ripe
              : crop.color,
        soil: crop.soil,
        rowAngle: angle,
        spacing: crop.spacing,
        pattern:
          crop.kind === 'pasture' || crop.kind === 'fallow'
            ? 'plain'
            : crop.kind === 'orchard'
              ? 'grove'
              : 'rows',
      };
      landcover.push({ ...field.feature, cultivation });
      const model = (name: string): string =>
        crop.kind === 'annual' && stage !== 'mature' ? `${name}.${stage}` : name;
      if (crop.kind === 'fallow' || crop.kind === 'pasture' || rules.has(id)) continue;
      rules.set(id, {
        id,
        classes: [id],
        layer: 'agriculture',
        densityPerHectare: 10_000 / (crop.spacing * crop.interval),
        minSpacing: 0,
        rows: {
          spacing: crop.spacing,
          interval: crop.interval,
          angle,
          jitter: crop.kind === 'annual' ? 0.025 : 0.04,
          headland: crop.kind === 'annual' ? 3 : 2,
        },
        slopeMax: 0.45,
        avoid: { roads: 3, buildings: 3, water: 1 },
        populations: [
          {
            model: model(crop.model),
            ...(crop.variants
              ? { variants: crop.variants.map((name) => ({ model: model(name), weight: 1 })) }
              : {}),
            weight: 1,
            scale: { min: 0.94, max: 1.06 },
            yaw: crop.kind === 'annual' || crop.kind === 'vineyard' ? 'rows' : 'random',
            align: 'up',
          },
        ],
        lod: {
          keepByTier: crop.kind === 'annual' ? [1, 0, 0] : [1, 0.4, 0],
          maxInstancesPerBatch: 6500,
        },
      });
    }
  }
  return { tile: { ...tile, landcover }, rules: [...rules.values()] };
}

export function withAgricultureRules(
  environment: WorldgenBatchInput['scatterEnvironment'],
  rules: ScatterRule[],
): WorldgenBatchInput['scatterEnvironment'] {
  if (!environment) return environment;
  const ids = new Set(rules.map((rule) => rule.id));
  return {
    ...environment,
    doc: {
      ...environment.doc,
      rules: [
        ...environment.doc.rules.map((rule) => ({
          ...rule,
          notClasses: [...(rule.notClasses ?? []), 'agricultural_field'],
        })),
        ...rules,
      ],
    },
    acceptsRule: (rule, x, z) =>
      ids.has(rule.id) || (environment.acceptsRule?.(rule, x, z) ?? true),
  };
}
