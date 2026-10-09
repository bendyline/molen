/**
 * World-anchored prop placement. Candidates live on a jittered grid in the request frame, so a
 * cell yields the same candidate for every caller that covers it (adjacent batches never
 * duplicate or miss a prop, coarser detail tiers show nested subsets). Rules pick species,
 * scale, heading, and tint from independent streams of the cell hash. The stepwise form yields
 * between chunks of cells so a host can stay responsive and abort.
 */

import { dmath } from '@bendyline/molen-kernel/determinism';
import { classMatches } from './classes';
import { type Bounds2, intersectBounds, pointInPolygon, ringBounds } from './geometry2d';
import { fbm2 } from './noise';
import { RasterGrid, rasterizePolygon, rasterizePolyline } from './raster';
import type { ScatterDoc, ScatterPopulation, ScatterRule } from './scatter-types';
import {
  fmix32,
  hashCoord,
  type PackIdentity,
  pickWeighted,
  propSalt,
  sampleRange,
  unit01,
} from './seed';
import {
  type HeightSampler,
  PLACEMENT_STRIDE,
  type PlacementSet,
  type ScatterExclusion,
  type ScatterRequest,
  type WorldgenProgress,
} from './types';

export interface ScatterBudget {
  /** Instances one rule may emit. */
  maxInstancesPerRule: number;
  /** Instances the whole batch may emit, thinned uniformly across rules; 0 disables scatter. */
  maxInstances: number;
  maxPropModels: number;
  /** Instances and model varieties for `groundcover` rules, separate from the canopy's. */
  maxGroundCoverInstances?: number;
  maxGroundCoverModels?: number;
  maxUnderstoryInstances?: number;
  maxUnderstoryModels?: number;
  maxAgricultureInstances?: number;
  maxAgricultureModels?: number;
}

export interface ScatterSampleInput {
  request: ScatterRequest;
  doc: ScatterDoc;
  pack: PackIdentity;
  ground: HeightSampler;
  budget: ScatterBudget;
  /** Detail tier (0 = full); selects `keepByTier`. */
  tier: number;
  /** Optional spatial rule gate in request-local meters (e.g. ecological boundaries). */
  acceptsRule?: (rule: ScatterRule, x: number, z: number) => boolean;
  /** Appearance variant only (e.g. season); candidate seeds and positions remain unchanged. */
  modelAt?: (model: string, x: number, z: number) => string;
}

interface Candidate {
  x: number;
  y: number;
  z: number;
  yaw: number;
  scale: number;
  widthScale: number;
  r: number;
  g: number;
  b: number;
  /** Acceptance draw; used for uniform thinning under caps. */
  u: number;
  cx: number;
  cz: number;
}

const JITTER = 0.7;
/** Cells visited between cooperative yields. */
const CHUNK = 16_384;

function rasterCellFor(bounds: Bounds2): number {
  const extent = Math.max(bounds[2] - bounds[0], bounds[3] - bounds[1]);
  return Math.max(1, extent / 400);
}

function buildLabelRaster(request: ScatterRequest, cell: number): RasterGrid {
  const raster = new RasterGrid(request.emitBounds, cell);
  request.polygons.forEach((polygon, index) => {
    if (index + 1 > 65535) return;
    rasterizePolygon(raster, polygon.ring, polygon.holes ?? [], index + 1);
  });
  return raster;
}

function exclusionKey(avoid: { roads: number; buildings: number; water: number }): string {
  return `${avoid.roads}|${avoid.buildings}|${avoid.water}`;
}

function buildExclusionRaster(
  exclusions: readonly ScatterExclusion[],
  bounds: Bounds2,
  cell: number,
  avoid: { roads: number; buildings: number; water: number },
): RasterGrid {
  const raster = new RasterGrid(bounds, cell);
  for (const exclusion of exclusions) {
    const radius = exclusion.kind !== undefined ? avoid[exclusion.kind] : exclusion.radius;
    stampExclusion(raster, exclusion, radius);
  }
  return raster;
}

/** Buffer each feature independently: water's margin must not inflate a distant road's. */
function stampExclusion(raster: RasterGrid, exclusion: ScatterExclusion, radius: number): void {
  if (exclusion.ring !== undefined) {
    rasterizePolygon(raster, exclusion.ring, exclusion.holes ?? [], 1);
    if (radius > 0) {
      for (const ring of [exclusion.ring, ...(exclusion.holes ?? [])]) {
        const first = ring[0];
        if (first !== undefined) rasterizePolyline(raster, [...ring, first], radius, 1);
      }
    }
  } else if (exclusion.polyline !== undefined) {
    rasterizePolyline(raster, exclusion.polyline, (exclusion.width ?? 0) / 2 + radius, 1);
  }
}

function keepFor(rule: ScatterRule, doc: ScatterDoc, tier: number): number {
  const tiers = rule.lod?.keepByTier ?? doc.defaults.lod.keepByTier;
  return tiers[Math.min(Math.max(0, tier), tiers.length - 1)] ?? 1;
}

function tintFor(population: ScatterPopulation, hash: number): [number, number, number] {
  const tint = population.tint;
  if (tint === undefined) return [1, 1, 1];
  const lightness = 1 - tint.lightness * unit01(hash, 6);
  const warmth = (unit01(hash, 7) - 0.5) * tint.saturation;
  const hueShift = (unit01(hash, 8) - 0.5) * tint.hue * 2;
  return [
    Math.max(0, Math.min(1, lightness * (1 + warmth + hueShift * 0.5))),
    Math.max(0, Math.min(1, lightness)),
    Math.max(0, Math.min(1, lightness * (1 - warmth - hueShift * 0.5))),
  ];
}

/** Sample every rule of a scatter document over one request, yielding between cell chunks. */
export function* samplePlacementsSteps(
  input: ScatterSampleInput,
): Generator<WorldgenProgress, PlacementSet[], void> {
  const { request, doc, ground } = input;
  if (request.polygons.length === 0) return [];
  const groundCoverInstances = input.budget.maxGroundCoverInstances ?? 0;
  const groundCoverModels = input.budget.maxGroundCoverModels ?? 0;
  const canopyOpen = input.budget.maxInstances > 0 && input.budget.maxPropModels > 0;
  const groundOpen = groundCoverInstances > 0 && groundCoverModels > 0;
  const understoryInstances = input.budget.maxUnderstoryInstances ?? 0;
  const understoryModels = input.budget.maxUnderstoryModels ?? 0;
  const understoryOpen = understoryInstances > 0 && understoryModels > 0;
  const agricultureInstances = input.budget.maxAgricultureInstances ?? 0;
  const agricultureModels = input.budget.maxAgricultureModels ?? 0;
  const agricultureOpen = agricultureInstances > 0 && agricultureModels > 0;
  if (!canopyOpen && !groundOpen && !understoryOpen && !agricultureOpen) return [];
  const bounds = request.emitBounds;
  const rasterCell = rasterCellFor(bounds);
  const labels = buildLabelRaster(request, rasterCell);
  const polygonBounds = request.polygons.map((polygon) => ringBounds(polygon.ring));
  const exclusionCache = new Map<string, RasterGrid>();
  const proximityCache = new Map<string, RasterGrid>();
  const frame = request.frame;
  const accepted: Array<{
    candidate: Candidate;
    model: string;
    base: string;
    rule: number;
    layer: 'canopy' | 'understory' | 'groundcover' | 'agriculture';
  }> = [];
  const scatterId = { id: doc.id, version: doc.version };
  let visited = 0;

  for (let ruleIndex = 0; ruleIndex < doc.rules.length; ruleIndex++) {
    const rule = doc.rules[ruleIndex] as ScatterRule;
    // A closed pool must not rasterize or visit candidates only to discard them at the end.
    // This matters especially for coarse requests, where dense understory covers a large area.
    const layer = rule.layer ?? 'canopy';
    if (
      layer === 'agriculture'
        ? !agricultureOpen
        : layer === 'groundcover'
          ? !groundOpen
          : layer === 'understory'
            ? !understoryOpen
            : !canopyOpen
    )
      continue;
    if (rule.densityPerHectare <= 0) continue;
    const matches = request.polygons.map(
      (polygon) =>
        classMatches(polygon.label, rule.classes) &&
        !(rule.notClasses !== undefined && classMatches(polygon.label, rule.notClasses)),
    );
    // Only the area covered by matching polygons is worth visiting.
    let area: Bounds2 | undefined;
    matches.forEach((matched, index) => {
      if (!matched) return;
      const box = polygonBounds[index] as Bounds2;
      area =
        area === undefined
          ? [...box]
          : [
              Math.min(area[0], box[0]),
              Math.min(area[1], box[1]),
              Math.max(area[2], box[2]),
              Math.max(area[3], box[3]),
            ];
    });
    const visit = area !== undefined ? intersectBounds(area, bounds) : undefined;
    if (visit === undefined) continue;
    const keep = keepFor(rule, doc, input.tier) * request.keep;
    if (keep <= 0) continue;
    const avoid = { ...doc.defaults.avoid, ...rule.avoid };
    const key = exclusionKey(avoid);
    let exclusion = exclusionCache.get(key);
    if (exclusion === undefined) {
      exclusion = buildExclusionRaster(request.exclusions, bounds, rasterCell, avoid);
      exclusionCache.set(key, exclusion);
    }
    let nearWater: RasterGrid | undefined;
    if (rule.nearWater !== undefined) {
      const proximityKey = JSON.stringify(rule.nearWater);
      nearWater = proximityCache.get(proximityKey);
      if (nearWater === undefined) {
        nearWater = new RasterGrid(bounds, rasterCell);
        for (const water of request.exclusions) {
          if (water.kind !== 'water') continue;
          if (
            rule.nearWater.classes !== undefined &&
            !classMatches(water.label ?? '', rule.nearWater.classes)
          )
            continue;
          stampExclusion(nearWater, water, rule.nearWater.maxDistance);
        }
        proximityCache.set(proximityKey, nearWater);
      }
    }
    const salt = propSalt(input.pack, scatterId, rule.id);
    const cellMeters = Math.max(
      0.5,
      Math.sqrt(10_000 / rule.densityPerHectare),
      rule.minSpacing / 0.3,
    );
    const cellFrame = cellMeters * frame.unitsPerMeter;
    const row = rule.rows;
    const cellX = row === undefined ? cellFrame : row.interval * frame.unitsPerMeter;
    const cellZ = row === undefined ? cellFrame : row.spacing * frame.unitsPerMeter;
    const angle = ((row?.angle ?? 0) * dmath.PI) / 180;
    const cos = row === undefined ? 1 : dmath.cos(angle),
      sin = row === undefined ? 0 : dmath.sin(angle);
    const jitter = row?.jitter ?? JITTER;
    const weights = rule.populations.map((population) => population.weight);
    const ruleSlopeMax = rule.slopeMax ?? doc.defaults.slopeMax;
    const cap = Math.min(
      rule.lod?.maxInstancesPerBatch ?? doc.defaults.lod.maxInstancesPerBatch,
      input.budget.maxInstancesPerRule,
    );
    const clusterScale =
      rule.clustering !== undefined ? rule.clustering.scale * frame.unitsPerMeter : 1;
    const clusterSalt =
      rule.clustering?.sharedSeed === undefined
        ? salt
        : propSalt(input.pack, scatterId, `density:${rule.clustering.sharedSeed}`);
    // Global (frame) coordinates of the visited bounds select the cell range.
    const corners = [
      [visit[0], visit[1]],
      [visit[2], visit[1]],
      [visit[2], visit[3]],
      [visit[0], visit[3]],
    ];
    const grid = corners.map(([x = 0, z = 0]) => {
      const gx = (x - frame.originX) * frame.unitsPerMeter,
        gz = (z - frame.originZ) * frame.unitsPerMeter;
      return [(gx * cos + gz * sin) / cellX, (-gx * sin + gz * cos) / cellZ];
    });
    const cellX0 = Math.floor(Math.min(...grid.map((p) => p[0] as number)));
    const cellX1 = Math.floor(Math.max(...grid.map((p) => p[0] as number)));
    const cellZ0 = Math.floor(Math.min(...grid.map((p) => p[1] as number)));
    const cellZ1 = Math.floor(Math.max(...grid.map((p) => p[1] as number)));
    const ruleCandidates: Array<{ candidate: Candidate; model: string; base: string }> = [];
    for (let cz = cellZ0; cz <= cellZ1; cz++) {
      for (let cx = cellX0; cx <= cellX1; cx++) {
        if (++visited % CHUNK === 0) yield { done: ruleIndex, total: doc.rules.length };
        let hash = hashCoord(cx, cz, salt);
        const rx = (cx + 0.5 + (unit01(hash, 0) - 0.5) * jitter) * cellX;
        const rz = (cz + 0.5 + (unit01(hash, 1) - 0.5) * jitter) * cellZ;
        const gx = rx * cos - rz * sin;
        const gz = rx * sin + rz * cos;
        const x = gx / frame.unitsPerMeter + frame.originX;
        const z = gz / frame.unitsPerMeter + frame.originZ;
        if (x < bounds[0] || x >= bounds[2] || z < bounds[1] || z >= bounds[3]) continue;
        const polygonIndex = labels.get(x, z) - 1;
        if (polygonIndex < 0 || matches[polygonIndex] !== true) continue;
        const polygon = request.polygons[polygonIndex];
        if (
          row !== undefined &&
          polygon !== undefined &&
          !pointInPolygon([x, z], polygon.ring, polygon.holes)
        )
          continue;
        if (polygon?.seed !== undefined) {
          // Small owner patches need exact containment at land-use boundaries, beyond the mask.
          if (!pointInPolygon([x, z], polygon.ring, polygon.holes)) continue;
          hash = fmix32(hash ^ polygon.seed);
        }
        if (row?.headland && polygon) {
          let margin = false;
          for (const ring of [polygon.ring, ...(polygon.holes ?? [])]) {
            for (let i = 0; i < ring.length; i++) {
              const a = ring[i]!,
                b = ring[(i + 1) % ring.length]!;
              // Request clipping boundaries are not field edges. Buffered source edges remain.
              if (
                (Math.abs(a[0] - b[0]) < 0.001 &&
                  (Math.abs(a[0] - bounds[0]) < 0.001 || Math.abs(a[0] - bounds[2]) < 0.001)) ||
                (Math.abs(a[1] - b[1]) < 0.001 &&
                  (Math.abs(a[1] - bounds[1]) < 0.001 || Math.abs(a[1] - bounds[3]) < 0.001))
              )
                continue;
              const dx = b[0] - a[0],
                dz = b[1] - a[1],
                length = dx * dx + dz * dz;
              const t =
                length > 0
                  ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / length))
                  : 0;
              const ex = x - a[0] - t * dx,
                ez = z - a[1] - t * dz;
              if (ex * ex + ez * ez < row.headland * row.headland) {
                margin = true;
                break;
              }
            }
            if (margin) break;
          }
          if (margin) continue;
        }
        if (exclusion.get(x, z) !== 0) continue;
        if (nearWater !== undefined && nearWater.get(x, z) === 0) continue;
        const u = unit01(hash, 2);
        let factor = request.polygons[polygonIndex]?.density ?? 1;
        if (row !== undefined)
          factor *= Math.min(1, (rule.densityPerHectare * row.spacing * row.interval) / 10_000);
        if (rule.clustering !== undefined) {
          const noise = fbm2(
            gx / clusterScale,
            gz / clusterScale,
            clusterSalt + rule.clustering.seedOffset,
            3,
            2,
            0.5,
          );
          const ramp =
            ((noise - rule.clustering.threshold) * rule.clustering.contrast) /
            (1 - rule.clustering.threshold);
          factor *= ramp < 0 ? 0 : ramp > 1 ? 1 : ramp;
          if (rule.clustering.detailScale !== undefined) {
            const detailScale = rule.clustering.detailScale * frame.unitsPerMeter;
            const detail = fbm2(gx / detailScale, gz / detailScale, clusterSalt + 193, 2, 2, 0.5);
            factor *= Math.max(0, Math.min(1, (detail - 0.2) * 2.2));
          }
        }
        if (u >= factor * keep) continue;
        // Geographic polygon lookup is more expensive than the local masks and thinning.
        if (input.acceptsRule !== undefined && !input.acceptsRule(rule, x, z)) continue;
        const population = rule.populations[pickWeighted(unit01(hash, 3), weights)];
        if (population === undefined) continue;
        if (ground.slopeAt(x, z) > (population.slopeMax ?? ruleSlopeMax)) continue;
        const y = ground.sampleHeight(x, z);
        const altitude = population.altitude ?? rule.altitude;
        if (altitude?.min !== undefined && y < altitude.min) continue;
        if (altitude?.max !== undefined && y > altitude.max) continue;
        const scale = sampleRange(population.scale, unit01(hash, 4));
        const widthScale =
          population.widthScale === undefined
            ? 1
            : sampleRange(population.widthScale, unit01(hash, 9));
        const yaw =
          population.yaw === 'random'
            ? unit01(hash, 5) * dmath.TAU
            : population.yaw === 'rows'
              ? -angle
              : 0;
        const [r, g, b] = tintFor(population, hash);
        ruleCandidates.push({
          model: (() => {
            const variants = population.variants;
            const model =
              variants?.[
                pickWeighted(
                  unit01(hash, 10),
                  variants.map((v) => v.weight),
                )
              ]?.model ?? population.model;
            return input.modelAt?.(model, x, z) ?? model;
          })(),
          base: input.modelAt?.(population.model, x, z) ?? population.model,
          candidate: { x, y: y - 0.15, z, yaw, scale, widthScale, r, g, b, u, cx, cz },
        });
      }
    }
    if (ruleCandidates.length > cap) {
      ruleCandidates.sort(
        (p, q) =>
          p.candidate.u - q.candidate.u ||
          p.candidate.cz - q.candidate.cz ||
          p.candidate.cx - q.candidate.cx,
      );
      ruleCandidates.length = cap;
    }
    for (const entry of ruleCandidates) accepted.push({ ...entry, rule: ruleIndex, layer });
    yield { done: ruleIndex + 1, total: doc.rules.length };
  }

  // Cap each pool as a whole by the same acceptance draw, so thinning stays uniform across rules
  // and a tighter budget keeps a nested subset of a looser one. Ground cover has its own pool:
  // thousands of clumps must never thin the trees.
  const byDraw = (p: (typeof accepted)[number], q: (typeof accepted)[number]): number =>
    p.candidate.u - q.candidate.u ||
    p.rule - q.rule ||
    p.candidate.cz - q.candidate.cz ||
    p.candidate.cx - q.candidate.cx;
  const pool = (
    layer: 'canopy' | 'understory' | 'groundcover' | 'agriculture',
    maxInstances: number,
    maxModels: number,
  ) => {
    const entries = accepted.filter((entry) => entry.layer === layer);
    if (entries.length > maxInstances) {
      entries.sort(byDraw);
      entries.length = Math.max(0, maxInstances);
    }
    const counts = new Map<string, number>();
    for (const entry of entries) counts.set(entry.base, (counts.get(entry.base) ?? 0) + 1);
    // Reserve one fallback per species before spending spare draws on interchangeable forms.
    // Adding variants must not thin a forest or evict its less common species.
    const kept = new Set(
      [...counts.entries()]
        .sort((p, q) => q[1] - p[1] || (p[0] < q[0] ? -1 : 1))
        .slice(0, Math.max(0, maxModels))
        .map(([model]) => model),
    );
    const retained = entries.filter((entry) => kept.has(entry.base));
    const variantCounts = new Map<string, number>();
    for (const entry of retained)
      if (!kept.has(entry.model))
        variantCounts.set(entry.model, (variantCounts.get(entry.model) ?? 0) + 1);
    for (const [model] of [...variantCounts.entries()]
      .sort((p, q) => q[1] - p[1] || (p[0] < q[0] ? -1 : 1))
      .slice(0, Math.max(0, maxModels - kept.size)))
      kept.add(model);
    return retained.map((entry) =>
      kept.has(entry.model) ? entry : { ...entry, model: entry.base },
    );
  };
  const perModel = new Map<string, Candidate[]>();
  for (const entry of [
    ...pool('canopy', input.budget.maxInstances, input.budget.maxPropModels),
    ...pool('understory', understoryInstances, understoryModels),
    ...pool('groundcover', groundCoverInstances, groundCoverModels),
    ...pool('agriculture', agricultureInstances, agricultureModels),
  ]) {
    let list = perModel.get(entry.model);
    if (list === undefined) {
      list = [];
      perModel.set(entry.model, list);
    }
    list.push(entry.candidate);
  }
  const models = [...perModel.entries()]
    .map(([model, candidates]) => ({ model, candidates }))
    .sort((p, q) => (p.model < q.model ? -1 : p.model > q.model ? 1 : 0));
  const sets: PlacementSet[] = [];
  for (const { model, candidates } of models) {
    candidates.sort((p, q) => p.cz - q.cz || p.cx - q.cx || p.u - q.u);
    const data = new Float32Array(candidates.length * PLACEMENT_STRIDE);
    candidates.forEach((candidate, index) => {
      const offset = index * PLACEMENT_STRIDE;
      data[offset] = candidate.x;
      data[offset + 1] = candidate.y;
      data[offset + 2] = candidate.z;
      data[offset + 3] = candidate.yaw;
      data[offset + 4] = candidate.scale * candidate.widthScale;
      data[offset + 5] = candidate.scale;
      data[offset + 6] = candidate.scale * candidate.widthScale;
      data[offset + 7] = candidate.r;
      data[offset + 8] = candidate.g;
      data[offset + 9] = candidate.b;
    });
    sets.push({ setId: `scatter:${model}`, modelRef: model, count: candidates.length, data });
  }
  return sets;
}

/** Run the stepwise sampler to completion. */
export function samplePlacements(input: ScatterSampleInput): PlacementSet[] {
  const generator = samplePlacementsSteps(input);
  for (;;) {
    const next = generator.next();
    if (next.done === true) return next.value;
  }
}
