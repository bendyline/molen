/** Walls, ground fit, and foundation skirts for one outline. */

import { densifyEdge } from './geometry2d';
import type { BuildingOpening } from './interior-types';
import type { MeshBufferBuilder } from './mesh-buffers';
import type { HeightSampler, MaterialSlot, RGB, Vec2, Vec3 } from './types';

export interface WallUv {
  /** `meters`: U along the wall and V up the wall in meters; `cell`: U in bays, V in floors. */
  mode: 'meters' | 'cell';
  bayWidth: number;
  floorHeight: number;
  /** Seeded shift so neighbouring buildings never align (meters or cells per `mode`). */
  offsetU: number;
  offsetV: number;
  mirror: boolean;
}

export interface WallSurface {
  slot: MaterialSlot;
  ref: string;
  color: RGB;
}

export interface GroundFit {
  base: number;
  minGround: number;
  maxGround: number;
  meanGround: number;
}

/**
 * Sample the ground under an outline (vertices plus edge samples every `spacing` meters) and
 * choose the platform height: never above the highest sample, at most `terraceLimit` above the
 * mean, so nothing floats and steep sites sink the uphill wall instead of growing a cliff.
 */
export function groundFit(
  outline: readonly Vec2[],
  ground: HeightSampler,
  terraceLimit = 4,
  spacing = 8,
): GroundFit {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  let sum = 0;
  let count = 0;
  for (let index = 0; index < outline.length; index++) {
    const a = outline[index] as Vec2;
    const b = outline[(index + 1) % outline.length] as Vec2;
    const samples = densifyEdge(a, b, spacing);
    samples.pop();
    for (const point of samples) {
      const height = ground.sampleHeight(point[0], point[1]);
      min = Math.min(min, height);
      max = Math.max(max, height);
      sum += height;
      count++;
    }
  }
  if (count === 0) return { base: 0, minGround: 0, maxGround: 0, meanGround: 0 };
  const mean = sum / count;
  return {
    base: Math.min(max, mean + terraceLimit),
    minGround: min,
    maxGround: max,
    meanGround: mean,
  };
}

function edgeNormal(a: Vec2, b: Vec2): Vec2 {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const length = Math.hypot(dx, dz) || 1;
  return [dz / length, -dx / length];
}

function wallUv(uv: WallUv, s: number, length: number, y: number, base: number): Vec2 {
  const centred = uv.mode === 'cell' ? s - (length % uv.bayWidth) / 2 : s;
  let u = uv.mode === 'cell' ? centred / uv.bayWidth : centred;
  u += uv.offsetU;
  if (uv.mirror) u = -u;
  const v = (uv.mode === 'cell' ? (y - base) / uv.floorHeight : y - base) + uv.offsetV;
  return [u, v];
}

/**
 * One quad per ring edge from `bottom` up to `top` (a constant or a function of the 2D point).
 * `base` anchors the facade UVs even when the wall extends down to support a sloped site.
 * Rings must use the canonical orientation (outer positive, holes negative) so `edgeNormal` faces
 * outward. `seamEdges` (outer ring only) are inset 2 cm so two clipped pieces never overlap.
 */
export function buildWalls(
  rings: readonly (readonly Vec2[])[],
  base: number,
  top: number | ((p: Vec2) => number),
  uv: WallUv,
  surface: WallSurface,
  seamEdges: ReadonlySet<number> | undefined,
  out: MeshBufferBuilder,
  bottom: number = base,
  openings: readonly BuildingOpening[] = [],
  inward = false,
): void {
  const topAt = typeof top === 'number' ? (): number => top : top;
  rings.forEach((ring, ringIndex) => {
    for (let index = 0; index < ring.length; index++) {
      const a = ring[index] as Vec2;
      const b = ring[(index + 1) % ring.length] as Vec2;
      const normal = edgeNormal(a, b);
      const inset = ringIndex === 0 && seamEdges?.has(index) === true ? 0.02 : 0;
      const ax = a[0] - normal[0] * inset;
      const az = a[1] - normal[1] * inset;
      const bx = b[0] - normal[0] * inset;
      const bz = b[1] - normal[1] * inset;
      const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (length < 1e-6) continue;
      const topA = topAt(a);
      const topB = topAt(b);
      const n: Vec3 = [normal[0] * (inward ? -1 : 1), 0, normal[1] * (inward ? -1 : 1)];
      const cuts = ringIndex === 0 ? openings.filter((opening) => opening.edge === index) : [];
      if (cuts.length > 0) {
        const stops = [
          ...new Set([
            0,
            length,
            ...cuts.flatMap((o) => [Math.max(0, o.start), Math.min(length, o.end)]),
          ]),
        ].sort((a, b) => a - b);
        for (let part = 0; part + 1 < stops.length; part++) {
          const s0 = stops[part] as number,
            s1 = stops[part + 1] as number;
          const lo = topA + ((topB - topA) * s0) / length,
            hi = topA + ((topB - topA) * s1) / length;
          const intervals = cuts
            .filter((o) => (s0 + s1) / 2 > o.start && (s0 + s1) / 2 < o.end)
            .sort((a, b) => a.bottom - b.bottom);
          const bands: Array<[number, number, number]> = [];
          let cursor = bottom;
          for (const cut of intervals) {
            bands.push([cursor, Math.min(cut.bottom, lo), Math.min(cut.bottom, hi)]);
            cursor = Math.max(cursor, cut.top);
          }
          bands.push([cursor, lo, hi]);
          for (const [low, high0, high1] of bands) {
            if (high0 <= low || high1 <= low) continue;
            const p = (s: number, y: number): Vec3 => [
              ax + ((bx - ax) * s) / length,
              y,
              az + ((bz - az) * s) / length,
            ];
            out.addQuad(
              surface.slot,
              surface.ref,
              [p(s0, low), p(s1, low), p(s1, high1), p(s0, high0)],
              n,
              [
                wallUv(uv, s0, length, low, base),
                wallUv(uv, s1, length, low, base),
                wallUv(uv, s1, length, high1, base),
                wallUv(uv, s0, length, high0, base),
              ],
              surface.color,
            );
          }
        }
      } else
        out.addQuad(
          surface.slot,
          surface.ref,
          [
            [ax, bottom, az],
            [bx, bottom, bz],
            [bx, topB, bz],
            [ax, topA, az],
          ],
          n,
          [
            wallUv(uv, 0, length, bottom, base),
            wallUv(uv, length, length, bottom, base),
            wallUv(uv, length, length, topB, base),
            wallUv(uv, 0, length, topA, base),
          ],
          surface.color,
        );
    }
  });
}

/** Quads from the platform down to the terrain wherever the ground falls below the base. */
export function buildFoundationSkirt(
  outline: readonly Vec2[],
  ground: HeightSampler,
  base: number,
  depth: number,
  spacing: number,
  surface: WallSurface,
  out: MeshBufferBuilder,
): number {
  let quads = 0;
  for (let index = 0; index < outline.length; index++) {
    const a = outline[index] as Vec2;
    const b = outline[(index + 1) % outline.length] as Vec2;
    const normal = edgeNormal(a, b);
    const samples = densifyEdge(a, b, spacing);
    let distance = 0;
    for (let step = 0; step + 1 < samples.length; step++) {
      const p = samples[step] as Vec2;
      const q = samples[step + 1] as Vec2;
      const gp = ground.sampleHeight(p[0], p[1]);
      const gq = ground.sampleHeight(q[0], q[1]);
      const segment = Math.hypot(q[0] - p[0], q[1] - p[1]);
      if (gp < base - 0.05 || gq < base - 0.05) {
        const lowP = Math.min(gp, base) - depth;
        const lowQ = Math.min(gq, base) - depth;
        out.addQuad(
          surface.slot,
          surface.ref,
          [
            [p[0], lowP, p[1]],
            [q[0], lowQ, q[1]],
            [q[0], base, q[1]],
            [p[0], base, p[1]],
          ],
          [normal[0], 0, normal[1]],
          [
            [distance, lowP - base],
            [distance + segment, lowQ - base],
            [distance + segment, 0],
            [distance, 0],
          ],
          surface.color,
        );
        quads++;
      }
      distance += segment;
    }
  }
  return quads;
}
