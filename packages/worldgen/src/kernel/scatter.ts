/**
 * World-anchored prop placement. Candidates live on a jittered grid in the request frame, so a
 * cell yields the same candidate for every caller that covers it (adjacent batches never
 * duplicate or miss a prop, coarser detail tiers show nested subsets). Rules pick species,
 * scale, heading, and tint from independent streams of the cell hash. The stepwise form yields
 * between chunks of cells so a host can stay responsive and abort.
 *
 * `crowns` rules stand apart: they put a plant on every shrub crown the ground paints, and those
 * plants come back as `ScatterSample.near`, outside every pool and cap but `maxNearInstances`, for
 * a host to draw around its camera only (the ground's paint carries them farther out). Capped
 * with the rest, they once kept a few thousand of a batch's tens of thousands of crowns, and every
 * other crown faded from a dark disc to bare ground as it was reached.
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
  type NearPlacements,
  PLACEMENT_STRIDE,
  type PlacementSet,
  type ScatterExclusion,
  type ScatterRequest,
  type WorldgenProgress,
} from './types';

/**
 * The shrub crowns a host's ground material paints, for `crowns` rules: one candidate crown per
 * pattern cell, in request-local meters.
 */
export interface ScatterGroundCrowns {
  /** Pattern cells whose crowns may fall in this request-local rectangle: [i0, j0, i1, j1]. */
  cells(bounds: Bounds2): [i0: number, j0: number, i1: number, j1: number];
  /**
   * Cell (i, j)'s crown: center, radius, the least brush (0..1) at which it is painted, and
   * optionally where in a host's thinning band its plant stops standing (0..1, carried to
   * `NearPlacements.reach`), when the ground hands the crown back to its paint there.
   */
  crown(
    i: number,
    j: number,
  ): { x: number; z: number; radius: number; brush: number; reach?: number };
  /**
   * Share of an appearance class's brush the ground keeps at (x, z), where built-up ground paves
   * over it; omitted means all of it.
   */
  open?(x: number, z: number, appearance: string): number;
}

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
  /** Instances and model varieties for `garden` rules: planted yards, parks and verges. */
  maxGardenInstances?: number;
  maxGardenModels?: number;
  /**
   * Plants `crowns` rules may stand for the near layer (`ScatterSample.near`), across all of them
   * (default: every one). Past it the lowest acceptance draws stay.
   */
  maxNearInstances?: number;
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
  /**
   * Tree line in request-local meters: the world height above which trees and brush (the canopy
   * and understory layers) do not grow. Stands thin out over the `TREELINE_FADE` meters below
   * it. Ground cover and crops are unaffected; undefined anywhere means no limit there.
   */
  treeline?: (x: number, z: number) => number | undefined;
  /** The ground's painted shrub crowns; `crowns` rules place nothing without them. */
  crowns?: ScatterGroundCrowns;
}

/** Mean radius of the painted crowns a population without a `width` is scaled around, meters. */
const CROWN_MEAN_RADIUS = 1.8;

/**
 * Meters below a tree line over which stands thin from full density to none: closed forest
 * opens into parkland and scattered trees before it stops.
 */
export const TREELINE_FADE = 350;

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

const weightsOf = new WeakMap<object, number[]>();

/** A population's variant weights, read once per variant list. */
function variantWeights(variants: readonly { weight: number }[]): number[] {
  let weights = weightsOf.get(variants);
  if (weights === undefined) {
    weights = variants.map((variant) => variant.weight);
    weightsOf.set(variants, weights);
  }
  return weights;
}

interface RuleCandidate {
  candidate: Candidate;
  model: string;
  base: string;
}

/** A plant on a painted crown: its rule, and where its crown hands back to the paint. */
interface NearCandidate extends RuleCandidate {
  rule: number;
  reach?: number;
}

/** The order a rule over its cap keeps candidates by: lowest draw, then cell (unique per rule). */
function drawOrder(u: number, cz: number, cx: number, q: Candidate): number {
  return u - q.u || cz - q.cz || cx - q.cx;
}

/**
 * The `cap` candidates of one rule with the lowest draws: in arrival order while no more than
 * `cap` arrive, else in draw order. That is what keeping every candidate, then sorting and
 * truncating, gives, without holding them all: a dense rule over a large request once held millions
 * of candidates to keep a few thousand. Past the cap the kept ones are a max-heap (`heap`, indices
 * into `items`), so a candidate is compared with the worst one kept.
 */
class LowestDraws<T extends RuleCandidate = RuleCandidate> {
  private readonly items: T[] = [];
  private heap: number[] | undefined;
  constructor(private readonly cap: number) {}

  /** True when a candidate with this draw and cell would not be kept (only once past the cap). */
  rejects(u: number, cz: number, cx: number): boolean {
    const heap = this.heap;
    if (heap === undefined) return false;
    const worst = this.items[heap[0] as number];
    return worst === undefined || drawOrder(u, cz, cx, worst.candidate) > 0;
  }

  add(entry: T): void {
    if (this.heap === undefined) {
      if (this.items.length < this.cap) {
        this.items.push(entry);
        return;
      }
      this.heap = this.items.map((_, index) => index);
      for (let i = (this.heap.length >> 1) - 1; i >= 0; i--) this.siftDown(i);
    }
    const top = this.heap[0];
    if (top === undefined) return;
    const { u, cz, cx } = entry.candidate;
    if (drawOrder(u, cz, cx, (this.items[top] as RuleCandidate).candidate) >= 0) return;
    this.items[top] = entry;
    this.siftDown(0);
  }

  result(): T[] {
    if (this.heap !== undefined)
      this.items.sort((p, q) =>
        drawOrder(p.candidate.u, p.candidate.cz, p.candidate.cx, q.candidate),
      );
    return this.items;
  }

  /** Whether kept item `a` comes after `b` in draw order (worse). */
  private after(a: number, b: number): boolean {
    const p = (this.items[a] as RuleCandidate).candidate;
    return drawOrder(p.u, p.cz, p.cx, (this.items[b] as RuleCandidate).candidate) > 0;
  }

  private siftDown(start: number): void {
    const heap = this.heap as number[];
    let at = start;
    for (;;) {
      const left = at * 2 + 1;
      if (left >= heap.length) return;
      const right = left + 1;
      let worst = left;
      if (right < heap.length && this.after(heap[right] as number, heap[left] as number))
        worst = right;
      if (!this.after(heap[worst] as number, heap[at] as number)) return;
      const swap = heap[at] as number;
      heap[at] = heap[worst] as number;
      heap[worst] = swap;
      at = worst;
    }
  }
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

/** What a scatter document places over one request. */
export interface ScatterSample {
  /** Every rule's plants but the `crowns` rules', by model, within the budget's pools and caps. */
  placements: PlacementSet[];
  /**
   * The `crowns` rules' plants, one on each painted crown, for a host to draw near its camera
   * (see `NearPlacements`). Absent when no `crowns` rule placed one.
   */
  near?: NearPlacements;
}

/** Edge of a `NearPlacements` cell in local meters: a camera's reach spans a few dozen of them. */
const NEAR_CELL = 32;

/** Sample every rule of a scatter document over one request, yielding between cell chunks. */
export function* sampleScatterSteps(
  input: ScatterSampleInput,
): Generator<WorldgenProgress, ScatterSample, void> {
  const { request, doc, ground } = input;
  if (request.polygons.length === 0) return { placements: [] };
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
  const gardenInstances = input.budget.maxGardenInstances ?? 0;
  const gardenModels = input.budget.maxGardenModels ?? 0;
  const gardenOpen = gardenInstances > 0 && gardenModels > 0;
  if (!canopyOpen && !groundOpen && !understoryOpen && !agricultureOpen && !gardenOpen)
    return { placements: [] };
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
    layer: 'canopy' | 'understory' | 'groundcover' | 'agriculture' | 'garden';
    /** The rule's kept share at this tier, and how far its crowns may widen to hold cover. */
    keep: number;
    growth: number;
  }> = [];
  // The plants on the painted crowns, every `crowns` rule's together: kept whole (a crown left
  // without its plant fades to bare ground as it is reached), so only `maxNearInstances` bounds
  // them, never a layer's pool or a rule's cap.
  const nearCap = input.budget.maxNearInstances ?? Number.POSITIVE_INFINITY;
  const near = new LowestDraws<NearCandidate>(Math.max(0, nearCap));
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
        : layer === 'garden'
          ? !gardenOpen
          : layer === 'groundcover'
            ? !groundOpen
            : layer === 'understory'
              ? !understoryOpen
              : !canopyOpen
    )
      continue;
    const crowns = rule.crowns !== undefined ? input.crowns : undefined;
    if (
      rule.crowns !== undefined
        ? crowns === undefined || !(nearCap > 0)
        : rule.densityPerHectare <= 0
    )
      continue;
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
    // Crowns are kept whole: a painted crown with no plant on it would vanish as it is reached.
    const keep =
      crowns !== undefined
        ? keepFor(rule, doc, input.tier) > 0
          ? 1
          : 0
        : keepFor(rule, doc, input.tier) * request.keep;
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
    const ruleCandidates = new LowestDraws(cap);
    if (crowns !== undefined) {
      const brushes = rule.crowns as Record<string, number>;
      const [i0, j0, i1, j1] = crowns.cells(visit);
      for (let cz = j0; cz <= j1; cz++) {
        for (let cx = i0; cx <= i1; cx++) {
          if (++visited % CHUNK === 0) yield { done: ruleIndex, total: doc.rules.length };
          const crown = crowns.crown(cx, cz);
          const { x, z } = crown;
          if (x < bounds[0] || x >= bounds[2] || z < bounds[1] || z >= bounds[3]) continue;
          let polygonIndex = labels.get(x, z) - 1;
          // The crown belongs to the ground's own polygon here, beneath any scatter-only one.
          if (request.polygons[polygonIndex]?.ground === false)
            for (polygonIndex--; polygonIndex >= 0; polygonIndex--) {
              const beneath = request.polygons[polygonIndex];
              if (beneath === undefined || beneath.ground === false) continue;
              if (pointInPolygon([x, z], beneath.ring, beneath.holes)) break;
            }
          if (polygonIndex < 0 || matches[polygonIndex] !== true) continue;
          const polygon = request.polygons[polygonIndex];
          if (polygon === undefined) continue;
          let hash = hashCoord(cx, cz, salt);
          if (polygon.seed !== undefined) {
            if (!pointInPolygon([x, z], polygon.ring, polygon.holes)) continue;
            hash = fmix32(hash ^ polygon.seed);
          }
          const appearance = polygon.appearance ?? polygon.label;
          const brush = (brushes[appearance] ?? 0) * (crowns.open?.(x, z, appearance) ?? 1);
          if (crown.brush > brush) continue;
          const u = unit01(hash, 2);
          if (near.rejects(u, cz, cx)) continue;
          if (exclusion.get(x, z) !== 0) continue;
          if (nearWater !== undefined && nearWater.get(x, z) === 0) continue;
          if (input.acceptsRule !== undefined && !input.acceptsRule(rule, x, z)) continue;
          const population = rule.populations[pickWeighted(unit01(hash, 3), weights)];
          if (population === undefined) continue;
          if (ground.slopeAt(x, z) > (population.slopeMax ?? ruleSlopeMax)) continue;
          const y = ground.sampleHeight(x, z);
          const altitude = population.altitude ?? rule.altitude;
          if (altitude?.min !== undefined && y < altitude.min) continue;
          if (altitude?.max !== undefined && y > altitude.max) continue;
          if (input.treeline !== undefined) {
            const line = input.treeline(x, z);
            if (line !== undefined && y >= line) continue;
          }
          // Fitted to the crown across; a wider crown also stands taller, by its square root.
          const across =
            population.width !== undefined
              ? (2 * crown.radius) / population.width
              : (crown.radius / CROWN_MEAN_RADIUS) *
                (population.widthScale === undefined
                  ? 1
                  : sampleRange(population.widthScale, unit01(hash, 9)));
          const scale = sampleRange(population.scale, unit01(hash, 4)) * Math.sqrt(across);
          const variants = population.variants;
          const variant =
            variants?.[pickWeighted(unit01(hash, 10), variantWeights(variants))]?.model ??
            population.model;
          const [r, g, b] = tintFor(population, hash);
          near.add({
            model: input.modelAt?.(variant, x, z) ?? variant,
            base: input.modelAt?.(population.model, x, z) ?? population.model,
            rule: ruleIndex,
            ...(crown.reach !== undefined ? { reach: crown.reach } : {}),
            candidate: {
              x,
              y: y - 0.15,
              z,
              yaw: population.yaw === 'none' ? 0 : unit01(hash, 5) * dmath.TAU,
              scale,
              widthScale: across / scale,
              r,
              g,
              b,
              u,
              cx,
              cz,
            },
          });
        }
      }
      yield { done: ruleIndex + 1, total: doc.rules.length };
      continue;
    }
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
        // Past the rule's cap, a draw that cannot make the cut skips the lookups below.
        if (ruleCandidates.rejects(unit01(hash, 2), cz, cx)) continue;
        if (row?.headland && polygon) {
          let margin = false;
          for (const ring of [polygon.ring, ...(polygon.holes ?? [])]) {
            for (let i = 0; i < ring.length; i++) {
              const a = ring[i],
                b = ring[(i + 1) % ring.length];
              if (!a || !b) continue;
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
        if (
          input.treeline !== undefined &&
          rule.layer !== 'groundcover' &&
          rule.layer !== 'agriculture'
        ) {
          const line = input.treeline(x, z);
          if (line !== undefined) {
            const below = line - y;
            if (below <= 0) continue;
            if (below < TREELINE_FADE && unit01(hash, 11) >= below / TREELINE_FADE) continue;
          }
        }
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
        // No closure here: one capturing this cell's values made V8 allocate a scope, with its
        // numbers boxed, for every cell visited, rejected or not (gigabytes for a large request).
        const variants = population.variants;
        const variant =
          variants?.[pickWeighted(unit01(hash, 10), variantWeights(variants))]?.model ??
          population.model;
        ruleCandidates.add({
          model: input.modelAt?.(variant, x, z) ?? variant,
          base: input.modelAt?.(population.model, x, z) ?? population.model,
          candidate: { x, y: y - 0.15, z, yaw, scale, widthScale, r, g, b, u, cx, cz },
        });
      }
    }
    const growth = Math.max(1, rule.lod?.coverGrowth ?? doc.defaults.lod.coverGrowth ?? 1);
    for (const entry of ruleCandidates.result())
      accepted.push({ ...entry, rule: ruleIndex, layer, keep, growth });
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
    layer: 'canopy' | 'understory' | 'groundcover' | 'agriculture' | 'garden',
    maxInstances: number,
    maxModels: number,
  ) => {
    const entries = accepted.filter((entry) => entry.layer === layer);
    const sampled = entries.length;
    if (entries.length > maxInstances) {
      entries.sort(byDraw);
      entries.length = Math.max(0, maxInstances);
    }
    // Thinned crowns widen to hold the cover the full stand would show from above.
    const budgetShare = sampled > 0 ? entries.length / sampled : 1;
    if (layer === 'canopy' || layer === 'understory')
      for (let index = 0; index < entries.length; index++) {
        const entry = entries[index] as (typeof entries)[number];
        const grow = Math.min(
          entry.growth,
          1 / Math.sqrt(Math.max(1e-6, entry.keep * budgetShare)),
        );
        if (grow <= 1) continue;
        const lift = Math.sqrt(grow);
        entries[index] = {
          ...entry,
          candidate: {
            ...entry.candidate,
            scale: entry.candidate.scale * lift,
            widthScale: entry.candidate.widthScale * lift,
          },
        };
      }
    if (layer !== 'garden') return admit(entries, maxModels, false);
    // A host draws each model once per quarter of the batch, so planting chooses its models
    // quarter by quarter: the same draws, and a neighborhood that differs from the next one
    // instead of one handful of species for the whole batch.
    const midX = (bounds[0] + bounds[2]) / 2,
      midZ = (bounds[1] + bounds[3]) / 2;
    const quarters: (typeof entries)[] = [[], [], [], []];
    for (const entry of entries)
      (
        quarters[
          (entry.candidate.x >= midX ? 1 : 0) + (entry.candidate.z >= midZ ? 2 : 0)
        ] as typeof entries
      ).push(entry);
    return quarters.flatMap((quarter) => admit(quarter, maxModels, true));
  };
  /** The entries a model budget keeps, each with the model it is drawn as. */
  function admit(entries: typeof accepted, maxModels: number, byRole: boolean): typeof accepted {
    const counts = new Map<string, number>();
    for (const entry of entries) counts.set(entry.base, (counts.get(entry.base) ?? 0) + 1);
    // Reserve one fallback per species before spending spare draws on interchangeable forms.
    // Adding variants must not thin a forest or evict its less common species.
    const kept = new Set(
      [...counts.entries()]
        .sort((p, q) => q[1] - p[1] || (p[0] < q[0] ? -1 : 1))
        .slice(0, Math.max(0, byRole ? 0 : maxModels))
        .map(([model]) => model),
    );
    if (byRole) {
      // Planting is by role: a rule is the shrubs of a yard, its beds, its small trees. Counted
      // together the beds alone would take every slot, and a rule left with no species drops
      // out, so the few trees and hedges would vanish. Each rule's commonest species is kept
      // first, largest rule first, then each rule's second, until the slots are spent.
      const perRule = new Map<number, Map<string, number>>();
      for (const entry of entries) {
        let byBase = perRule.get(entry.rule);
        if (byBase === undefined) {
          byBase = new Map();
          perRule.set(entry.rule, byBase);
        }
        byBase.set(entry.base, (byBase.get(entry.base) ?? 0) + 1);
      }
      const ranked = [...perRule.entries()]
        .map(([rule, byBase]) => ({
          rule,
          total: [...byBase.values()].reduce((sum, count) => sum + count, 0),
          species: [...byBase.entries()].sort((p, q) => q[1] - p[1] || (p[0] < q[0] ? -1 : 1)),
        }))
        .sort((p, q) => q.total - p.total || p.rule - q.rule);
      for (let round = 0; kept.size < maxModels; round++) {
        let offered = false;
        for (const { species } of ranked) {
          const next = species[round];
          if (next === undefined) continue;
          offered = true;
          if (kept.size < maxModels) kept.add(next[0]);
        }
        if (!offered) break;
      }
    }
    // A species past the cap gives its places to its own rule's most common kept species, so a
    // tight budget simplifies a mixed stand rather than thinning it. A rule with no kept species
    // (a crop row, a lone riparian stand) still drops out.
    const ruleCounts = new Map<number, Map<string, number>>();
    for (const entry of entries) {
      if (!kept.has(entry.base)) continue;
      let byBase = ruleCounts.get(entry.rule);
      if (byBase === undefined) {
        byBase = new Map();
        ruleCounts.set(entry.rule, byBase);
      }
      byBase.set(entry.base, (byBase.get(entry.base) ?? 0) + 1);
    }
    const fallback = new Map<number, string>();
    for (const [rule, byBase] of ruleCounts)
      fallback.set(
        rule,
        [...byBase.entries()].sort((p, q) => q[1] - p[1] || (p[0] < q[0] ? -1 : 1))[0]?.[0] ?? '',
      );
    const retained = entries.flatMap((entry) => {
      if (kept.has(entry.base)) return [entry];
      const base = fallback.get(entry.rule);
      return base === undefined ? [] : [{ ...entry, base, model: base }];
    });
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
  }
  const perModel = new Map<string, Candidate[]>();
  for (const entry of [
    ...pool('canopy', input.budget.maxInstances, input.budget.maxPropModels),
    ...pool('understory', understoryInstances, understoryModels),
    ...pool('groundcover', groundCoverInstances, groundCoverModels),
    ...pool('agriculture', agricultureInstances, agricultureModels),
    ...pool('garden', gardenInstances, gardenModels),
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
      writePlacement(data, index * PLACEMENT_STRIDE, candidate);
    });
    sets.push({ setId: `scatter:${model}`, modelRef: model, count: candidates.length, data });
  }
  const crowned = near.result();
  return crowned.length > 0
    ? { placements: sets, near: nearPlacements(crowned, bounds) }
    : { placements: sets };
}

/** One candidate as `PLACEMENT_STRIDE` floats at `offset`. */
function writePlacement(data: Float32Array, offset: number, candidate: Candidate): void {
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
}

/**
 * The crowns' plants bucketed into `NEAR_CELL` squares over the request's bounds, cell by cell
 * and, within a cell, by crown (then rule), so the output depends on nothing but the plants.
 */
function nearPlacements(plants: readonly NearCandidate[], bounds: Bounds2): NearPlacements {
  const columns = Math.max(1, Math.ceil((bounds[2] - bounds[0]) / NEAR_CELL));
  const rows = Math.max(1, Math.ceil((bounds[3] - bounds[1]) / NEAR_CELL));
  const cellOf = (candidate: Candidate): number => {
    const column = Math.floor((candidate.x - bounds[0]) / NEAR_CELL);
    const row = Math.floor((candidate.z - bounds[1]) / NEAR_CELL);
    return (
      Math.min(rows - 1, Math.max(0, row)) * columns + Math.min(columns - 1, Math.max(0, column))
    );
  };
  const ordered = plants
    .map((plant) => ({ plant, cell: cellOf(plant.candidate) }))
    .sort(
      (p, q) =>
        p.cell - q.cell ||
        p.plant.candidate.cz - q.plant.candidate.cz ||
        p.plant.candidate.cx - q.plant.candidate.cx ||
        p.plant.rule - q.plant.rule,
    );
  const models = [...new Set(plants.map((plant) => plant.model))].sort((p, q) =>
    p < q ? -1 : p > q ? 1 : 0,
  );
  const indexOf = new Map(models.map((model, index) => [model, index]));
  const data = new Float32Array(ordered.length * PLACEMENT_STRIDE);
  const model = new Uint16Array(ordered.length);
  const start = new Uint32Array(columns * rows + 1);
  // The crowns' reach values are lattice bytes over 255: a byte holds each exactly.
  const reach = plants.some((plant) => plant.reach !== undefined)
    ? new Uint8Array(ordered.length)
    : undefined;
  ordered.forEach(({ plant, cell }, index) => {
    writePlacement(data, index * PLACEMENT_STRIDE, plant.candidate);
    model[index] = indexOf.get(plant.model) ?? 0;
    if (reach !== undefined)
      reach[index] = Math.round(Math.min(1, Math.max(0, plant.reach ?? 1)) * 255);
    start[cell + 1] = (start[cell + 1] as number) + 1;
  });
  for (let cell = 0; cell < columns * rows; cell++)
    start[cell + 1] = (start[cell + 1] as number) + (start[cell] as number);
  return {
    models,
    count: ordered.length,
    data,
    model,
    ...(reach !== undefined ? { reach } : {}),
    cell: NEAR_CELL,
    originX: bounds[0],
    originZ: bounds[1],
    columns,
    rows,
    start,
  };
}

/** Run the stepwise sampler to completion. */
export function sampleScatter(input: ScatterSampleInput): ScatterSample {
  const generator = sampleScatterSteps(input);
  for (;;) {
    const next = generator.next();
    if (next.done === true) return next.value;
  }
}

/**
 * `sampleScatterSteps`' placements alone: what every rule but a `crowns` rule places (those
 * plants are its `near`).
 */
export function* samplePlacementsSteps(
  input: ScatterSampleInput,
): Generator<WorldgenProgress, PlacementSet[], void> {
  return (yield* sampleScatterSteps(input)).placements;
}

/** `sampleScatter`'s placements alone; the `crowns` rules' plants are its `near`. */
export function samplePlacements(input: ScatterSampleInput): PlacementSet[] {
  return sampleScatter(input).placements;
}
