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
import { dilate, RasterGrid, rasterizePolygon, rasterizePolyline } from './raster';
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
}

export interface ScatterSampleInput {
  request: ScatterRequest;
  doc: ScatterDoc;
  pack: PackIdentity;
  ground: HeightSampler;
  budget: ScatterBudget;
  /** Detail tier (0 = full); selects `keepByTier`. */
  tier: number;
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
    if (exclusion.ring !== undefined) {
      rasterizePolygon(raster, exclusion.ring, [], 1);
    } else if (exclusion.polyline !== undefined) {
      rasterizePolyline(raster, exclusion.polyline, (exclusion.width ?? 0) / 2 + radius, 1);
    }
  }
  const ringRadius = Math.max(
    0,
    ...exclusions
      .filter((exclusion) => exclusion.ring !== undefined)
      .map((exclusion) =>
        exclusion.kind !== undefined ? avoid[exclusion.kind] : exclusion.radius,
      ),
  );
  if (ringRadius > 0) dilate(raster, Math.ceil(ringRadius / cell));
  return raster;
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
  if (input.budget.maxInstances <= 0 || input.budget.maxPropModels <= 0) return [];
  const bounds = request.emitBounds;
  const rasterCell = rasterCellFor(bounds);
  const labels = buildLabelRaster(request, rasterCell);
  const polygonBounds = request.polygons.map((polygon) => ringBounds(polygon.ring));
  const exclusionCache = new Map<string, RasterGrid>();
  const frame = request.frame;
  const accepted: Array<{ candidate: Candidate; model: string; rule: number }> = [];
  const scatterId = { id: doc.id, version: doc.version };
  let visited = 0;

  for (let ruleIndex = 0; ruleIndex < doc.rules.length; ruleIndex++) {
    const rule = doc.rules[ruleIndex] as ScatterRule;
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
    const salt = propSalt(input.pack, scatterId, rule.id);
    const cellMeters = Math.max(
      0.5,
      Math.sqrt(10_000 / rule.densityPerHectare),
      rule.minSpacing / 0.3,
    );
    const cellFrame = cellMeters * frame.unitsPerMeter;
    const weights = rule.populations.map((population) => population.weight);
    const ruleSlopeMax = rule.slopeMax ?? doc.defaults.slopeMax;
    const cap = Math.min(
      rule.lod?.maxInstancesPerBatch ?? doc.defaults.lod.maxInstancesPerBatch,
      input.budget.maxInstancesPerRule,
    );
    const clusterScale =
      rule.clustering !== undefined ? rule.clustering.scale * frame.unitsPerMeter : 1;
    // Global (frame) coordinates of the visited bounds select the cell range.
    const cellX0 = Math.floor(((visit[0] - frame.originX) * frame.unitsPerMeter) / cellFrame);
    const cellX1 = Math.floor(((visit[2] - frame.originX) * frame.unitsPerMeter) / cellFrame);
    const cellZ0 = Math.floor(((visit[1] - frame.originZ) * frame.unitsPerMeter) / cellFrame);
    const cellZ1 = Math.floor(((visit[3] - frame.originZ) * frame.unitsPerMeter) / cellFrame);
    const ruleCandidates: Array<{ candidate: Candidate; model: string }> = [];
    for (let cz = cellZ0; cz <= cellZ1; cz++) {
      for (let cx = cellX0; cx <= cellX1; cx++) {
        if (++visited % CHUNK === 0) yield { done: ruleIndex, total: doc.rules.length };
        let hash = hashCoord(cx, cz, salt);
        const gx = (cx + 0.5 + (unit01(hash, 0) - 0.5) * JITTER) * cellFrame;
        const gz = (cz + 0.5 + (unit01(hash, 1) - 0.5) * JITTER) * cellFrame;
        const x = gx / frame.unitsPerMeter + frame.originX;
        const z = gz / frame.unitsPerMeter + frame.originZ;
        if (x < bounds[0] || x >= bounds[2] || z < bounds[1] || z >= bounds[3]) continue;
        const polygonIndex = labels.get(x, z) - 1;
        if (polygonIndex < 0 || matches[polygonIndex] !== true) continue;
        const polygon = request.polygons[polygonIndex];
        if (polygon?.seed !== undefined) {
          // Small owner patches need exact containment at land-use boundaries, beyond the mask.
          if (!pointInPolygon([x, z], polygon.ring, polygon.holes)) continue;
          hash = fmix32(hash ^ polygon.seed);
        }
        if (exclusion.get(x, z) !== 0) continue;
        const u = unit01(hash, 2);
        let factor = request.polygons[polygonIndex]?.density ?? 1;
        if (rule.clustering !== undefined) {
          const noise = fbm2(
            gx / clusterScale,
            gz / clusterScale,
            salt + rule.clustering.seedOffset,
            3,
            2,
            0.5,
          );
          const ramp =
            ((noise - rule.clustering.threshold) * rule.clustering.contrast) /
            (1 - rule.clustering.threshold);
          factor *= ramp < 0 ? 0 : ramp > 1 ? 1 : ramp;
        }
        if (u >= factor * keep) continue;
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
        const yaw = population.yaw === 'random' ? unit01(hash, 5) * dmath.TAU : 0;
        const [r, g, b] = tintFor(population, hash);
        ruleCandidates.push({
          model: population.model,
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
    for (const entry of ruleCandidates) accepted.push({ ...entry, rule: ruleIndex });
    yield { done: ruleIndex + 1, total: doc.rules.length };
  }

  // Cap the batch as a whole by the same acceptance draw, so thinning stays uniform across rules
  // and a tighter budget keeps a nested subset of a looser one.
  if (accepted.length > input.budget.maxInstances) {
    accepted.sort(
      (p, q) =>
        p.candidate.u - q.candidate.u ||
        p.rule - q.rule ||
        p.candidate.cz - q.candidate.cz ||
        p.candidate.cx - q.candidate.cx,
    );
    accepted.length = input.budget.maxInstances;
  }
  const perModel = new Map<string, Candidate[]>();
  for (const entry of accepted) {
    let list = perModel.get(entry.model);
    if (list === undefined) {
      list = [];
      perModel.set(entry.model, list);
    }
    list.push(entry.candidate);
  }
  // Cap distinct models deterministically: keep the most populated sets.
  const models = [...perModel.entries()]
    .map(([model, candidates]) => ({ model, candidates }))
    .sort((p, q) => q.candidates.length - p.candidates.length || (p.model < q.model ? -1 : 1))
    .slice(0, Math.max(0, input.budget.maxPropModels))
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
