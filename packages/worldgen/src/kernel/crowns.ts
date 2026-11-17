/**
 * Crowns: the tall features a building is known by from a distance (a tower under a spire, a
 * belfry, a dome on its drum, a minaret, a stepped temple tower), built from the building's own
 * wall and roof surfaces on whatever outline it has. A crown stands inside the footprint and
 * starts below the eave, so it needs no join with the roof it rises through.
 */

import { dmath } from '@bendyline/molen-kernel/determinism';
import { directionToWorld, type FootprintAnalysis, toLocal, toWorld } from './footprint';
import { pointInRing, ringBounds } from './geometry2d';
import { type MeshBufferBuilder, normalize3 } from './mesh-buffers';
import type { RoofSurface } from './roofs';
import { unit01 } from './seed';
import type { BuildingCrown, Vec2, Vec3 } from './types';

export interface CrownInput {
  analysis: FootprintAnalysis;
  /** The build outline (snapped when the footprint is rectilinear). */
  outline: readonly Vec2[];
  /** Wall base and wall top. */
  base: number;
  eave: number;
  /** Highest point of the roof. */
  roofTop: number;
  wall: RoofSurface;
  roof: RoofSurface;
  window: RoofSurface;
  /** Seed for which end or corner a crown takes. */
  salt: number;
}

interface Placement {
  /** Center in world X/Z. */
  at: Vec2;
  /** Unit vectors of the footprint frame in world X/Z. */
  u: Vec2;
  v: Vec2;
}

function clamp(value: number, lo: number, hi: number): number {
  return value < lo ? lo : value > hi ? hi : value;
}

/** A regular prism or frustum between two heights, sides only; `sides` 4 is square to the frame. */
function prism(
  place: Placement,
  sides: number,
  r0: number,
  y0: number,
  r1: number,
  y1: number,
  surface: RoofSurface,
  out: MeshBufferBuilder,
): void {
  // A square's corners sit on the frame diagonals, so its faces are square to the building.
  const turn = sides === 4 ? dmath.PI / 4 : 0;
  const scale = sides === 4 ? Math.SQRT2 : 1;
  const point = (index: number, radius: number, y: number): Vec3 => {
    const angle = turn + (index / sides) * dmath.TAU;
    const a = dmath.cos(angle) * radius * scale;
    const b = dmath.sin(angle) * radius * scale;
    return [
      place.at[0] + place.u[0] * a + place.v[0] * b,
      y,
      place.at[1] + place.u[1] * a + place.v[1] * b,
    ];
  };
  const slant = Math.hypot(y1 - y0, (r0 - r1) * scale);
  for (let index = 0; index < sides; index++) {
    const a = point(index, r0, y0);
    const b = point(index + 1, r0, y0);
    const c = point(index + 1, r1, y1);
    const d = point(index, r1, y1);
    const mid = turn + ((index + 0.5) / sides) * dmath.TAU;
    const na = dmath.cos(mid);
    const nb = dmath.sin(mid);
    const lean = (r0 - r1) * scale;
    const normal = normalize3([
      (place.u[0] * na + place.v[0] * nb) * (y1 - y0),
      lean,
      (place.u[1] * na + place.v[1] * nb) * (y1 - y0),
    ]);
    const width = Math.hypot(b[0] - a[0], b[2] - a[2]);
    if (r1 <= 1e-6) {
      out.addTriangle(
        surface.slot,
        surface.ref,
        [a, b, d],
        normal,
        [
          [0, 0],
          [width, 0],
          [width / 2, slant],
        ],
        surface.color,
      );
      continue;
    }
    out.addQuad(
      surface.slot,
      surface.ref,
      [a, b, c, d],
      normal,
      [
        [0, y0],
        [width, y0],
        [width, y0 + slant],
        [0, y0 + slant],
      ],
      surface.color,
    );
  }
}

/** A level cap over a prism's top (a gallery floor, a tier's shoulder). */
function cap(
  place: Placement,
  sides: number,
  radius: number,
  y: number,
  surface: RoofSurface,
  out: MeshBufferBuilder,
): void {
  const turn = sides === 4 ? dmath.PI / 4 : 0;
  const scale = sides === 4 ? Math.SQRT2 : 1;
  const points: Vec3[] = [];
  for (let index = 0; index < sides; index++) {
    const angle = turn + (index / sides) * dmath.TAU;
    const a = dmath.cos(angle) * radius * scale;
    const b = dmath.sin(angle) * radius * scale;
    points.push([
      place.at[0] + place.u[0] * a + place.v[0] * b,
      y,
      place.at[1] + place.u[1] * a + place.v[1] * b,
    ]);
  }
  out.addConvexPolygon(
    surface.slot,
    surface.ref,
    points,
    [0, 1, 0],
    (p) => [p[0], p[2]],
    surface.color,
  );
}

/** A dark opening on each face of a square tower, just proud of it. */
function louvres(
  place: Placement,
  half: number,
  y0: number,
  y1: number,
  width: number,
  surface: RoofSurface,
  out: MeshBufferBuilder,
): void {
  const faces: Array<[Vec2, Vec2]> = [
    [place.u, place.v],
    [[-place.u[0], -place.u[1]], place.v],
    [place.v, place.u],
    [[-place.v[0], -place.v[1]], place.u],
  ];
  for (const [normal, along] of faces) {
    const cx = place.at[0] + normal[0] * (half + 0.03);
    const cz = place.at[1] + normal[1] * (half + 0.03);
    const p = (side: number, y: number): Vec3 => [
      cx + along[0] * side * (width / 2),
      y,
      cz + along[1] * side * (width / 2),
    ];
    out.addQuad(
      surface.slot,
      surface.ref,
      [p(-1, y0), p(1, y0), p(1, y1), p(-1, y1)],
      [normal[0], 0, normal[1]],
      [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
      ],
      surface.color,
    );
  }
}

/**
 * Build a request's crowns. Each stands where its kind belongs (a tower at one end of the long
 * axis, a dome over the middle, a minaret at a corner) and is sized from the footprint.
 */
export function buildCrowns(
  crowns: readonly BuildingCrown[],
  input: CrownInput,
  out: MeshBufferBuilder,
): void {
  const { analysis, outline } = input;
  const frame = analysis.frame;
  const bounds = ringBounds(outline.map((point) => toLocal(frame, point)));
  const long = Math.max(bounds[2] - bounds[0], bounds[3] - bounds[1]);
  const short = Math.min(bounds[2] - bounds[0], bounds[3] - bounds[1]);
  if (short < 3.5) return;
  const alongU = bounds[2] - bounds[0] >= bounds[3] - bounds[1];
  const u = directionToWorld(frame, [1, 0]);
  const v = directionToWorld(frame, [0, 1]);
  const cu = (bounds[0] + bounds[2]) / 2;
  const cv = (bounds[1] + bounds[3]) / 2;
  const wallHeight = input.eave - input.base;
  /** A point `a` along the long axis and `b` across it, from the footprint's middle. */
  const spot = (a: number, b: number): Vec2 =>
    toWorld(frame, alongU ? [cu + a, cv + b] : [cu + b, cv + a]);
  /** Pull a crown toward the middle until it stands on the building. */
  const seated = (a: number, b: number): Vec2 => {
    for (const pull of [1, 0.8, 0.55, 0.3, 0]) {
      const at = spot(a * pull, b * pull);
      if (pointInRing(at, outline)) return at;
    }
    return spot(0, 0);
  };
  const end = unit01(input.salt, 0) < 0.5 ? -1 : 1;
  const side = unit01(input.salt, 1) < 0.5 ? -1 : 1;
  const sunk = Math.max(input.base, input.eave - 1);
  for (const crown of crowns) {
    switch (crown) {
      case 'spire':
      case 'belfry': {
        const half = clamp(short * 0.21, 1.5, 3.6);
        const place: Placement = { at: seated(end * (long / 2 - half - 0.15), 0), u, v };
        const top =
          crown === 'spire'
            ? Math.max(input.roofTop + half * 1.6, input.base + wallHeight * 1.7)
            : Math.max(input.roofTop + half * 2.2, input.base + wallHeight * 2.1);
        prism(place, 4, half, sunk, half, top, input.wall, out);
        const open = Math.min(half * 1.5, 3);
        louvres(
          place,
          half,
          top - open - half * 0.3,
          top - half * 0.3,
          half * 0.7,
          input.window,
          out,
        );
        const rise = crown === 'spire' ? half * 3.6 : half * 0.75;
        const eaves = half + 0.18;
        prism(place, 4, eaves, top, 0, top + rise, input.roof, out);
        break;
      }
      case 'dome': {
        const radius = clamp(short * 0.3, 1.8, 9);
        const place: Placement = { at: seated(0, 0), u, v };
        const drum = input.roofTop + radius * 0.25;
        prism(place, 12, radius, sunk, radius, drum, input.wall, out);
        // Three rings to the crown: a faceted hemisphere, a touch taller than it is wide.
        const rings = [0, 0.42, 0.78, 1];
        for (let ring = 0; ring + 1 < rings.length; ring++) {
          const a0 = (rings[ring] as number) * (dmath.PI / 2);
          const a1 = (rings[ring + 1] as number) * (dmath.PI / 2);
          prism(
            place,
            12,
            dmath.cos(a0) * radius * 1.02,
            drum + dmath.sin(a0) * radius * 1.08,
            ring + 2 === rings.length ? 0 : dmath.cos(a1) * radius * 1.02,
            drum + dmath.sin(a1) * radius * 1.08,
            input.roof,
            out,
          );
        }
        break;
      }
      case 'minaret': {
        const radius = clamp(short * 0.07, 0.8, 1.5);
        const place: Placement = {
          at: seated(end * (long / 2 - radius - 0.4), side * (short / 2 - radius - 0.4)),
          u,
          v,
        };
        const top = clamp(input.base + wallHeight * 2.4, input.roofTop + 7, input.base + 46);
        const gallery = sunk + (top - sunk) * 0.76;
        prism(place, 8, radius, sunk, radius * 0.92, gallery, input.wall, out);
        prism(place, 8, radius * 1.5, gallery, radius * 1.5, gallery + 0.55, input.wall, out);
        cap(place, 8, radius * 1.5, gallery + 0.55, input.wall, out);
        prism(place, 8, radius * 0.74, gallery + 0.55, radius * 0.7, top, input.wall, out);
        prism(place, 8, radius * 0.86, top, 0, top + radius * 3.2, input.roof, out);
        break;
      }
      case 'shikhara': {
        const place: Placement = {
          at: seated(end * (long / 2 - clamp(short * 0.3, 1.6, 5) - 0.2), 0),
          u,
          v,
        };
        let half = clamp(short * 0.3, 1.6, 5);
        let y = sunk;
        let top = Math.max(input.roofTop + half * 0.7, input.eave + half);
        // Four storeys, each narrower and shorter than the one below, under a pointed cap.
        for (let tier = 0; tier < 4; tier++) {
          const next = half * 0.76;
          prism(place, 4, half, y, half * 0.9, top, input.wall, out);
          cap(place, 4, half * 0.9, top, input.wall, out);
          y = top;
          top += next * 1.15;
          half = next;
        }
        prism(place, 4, half * 0.8, y, 0, y + half * 1.7, input.roof, out);
        break;
      }
    }
  }
}
