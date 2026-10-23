/** Shared anatomical surfaces. All dimensions come from the same metrics as the rig. */
import { dmath, type Vec3 } from '@bendyline/molen-kernel/determinism';
import { jointIndex, jointPosition } from './body';
import { parseColor, type RGB } from './color';
import type { FigureMetrics } from './proportions';
import { type FigureRig, rigBindModel } from './rig';
import type {
  FigureRegion,
  FigureTier,
  RingRef,
  Skin,
  SkinnedMeshBuilder,
} from './skinned-mesh-builder';
import type { ResolvedFigureDescriptor } from './types';

export const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const scale = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s];
export const mix = (a: Vec3, b: Vec3, t: number): Vec3 => add(scale(a, 1 - t), scale(b, t));
export function unit(a: Vec3): Vec3 {
  return scale(a, 1 / (dmath.hypot(...a) || 1));
}
export const colorMix = (a: RGB, b: RGB, t: number): RGB => [
  dmath.lerp(a[0], b[0], t),
  dmath.lerp(a[1], b[1], t),
  dmath.lerp(a[2], b[2], t),
];

export interface AnimalContext {
  d: ResolvedFigureDescriptor;
  rig: FigureRig;
  m: FigureMetrics;
  tier: FigureTier;
  b: SkinnedMeshBuilder;
  J: (name: string) => number;
  P: (name: string) => Vec3;
  fur: RGB;
  markings: RGB;
  hair: RGB;
  eyes: RGB;
  dark: RGB;
  pink: RGB;
  sides: number;
  limbSides: number;
}

export function animalContext(
  d: ResolvedFigureDescriptor,
  rig: FigureRig,
  tier: FigureTier,
  b: SkinnedMeshBuilder,
): AnimalContext {
  const bind = rigBindModel(rig);
  const J = (name: string) => jointIndex(rig, name);
  return {
    d,
    rig,
    m: rig.metrics,
    tier,
    b,
    J,
    P: (name: string) => jointPosition(bind, J(name)),
    fur: parseColor(d.palette.skin),
    markings: parseColor(d.palette.markings),
    hair: parseColor(d.palette.hair),
    eyes: parseColor(d.palette.eyes),
    dark: parseColor('#201d1b'),
    pink: parseColor('#9e7069'),
    sides: tier === 0 ? 20 : tier === 1 ? 12 : 8,
    limbSides: tier === 0 ? 12 : tier === 1 ? 8 : 6,
  };
}

// Fold the circle explicitly: centerline surfaces must be bitwise mirror-complete.
export function circle(sides: number, i: number): [number, number] {
  if (i > sides / 2) {
    const [c, s] = circle(sides, sides - i);
    return [c, -s];
  }
  if (i > sides / 4) {
    const [c, s] = circle(sides, sides / 2 - i);
    return [-c, s];
  }
  const t = (dmath.TAU * i) / sides;
  return [dmath.cos(t), dmath.sin(t)];
}

/** Ring in an X/up plane, with independently shaped back and belly and surface coat colors. */
export function surfaceRing(
  c: AnimalContext,
  _region: FigureRegion,
  center: Vec3,
  up: Vec3,
  width: number,
  top: number,
  bottom: number,
  sides: number,
  weights: Skin,
  color: (p: Vec3, horizontal: number, vertical: number) => RGB,
  relief = 0,
  phase = 0,
): RingRef {
  let start = 0;
  for (let i = 0; i < sides; i++) {
    const [x, y] = circle(sides, i);
    const bump = 1 + relief * dmath.cos(phase + 6 * dmath.acos(dmath.clamp(y, -1, 1)));
    const p = add(
      center,
      add([x * width * bump, 0, 0], scale(up, y * (y > 0 ? top : bottom) * bump)),
    );
    const index = c.b.vertex(p, color(p, x, y), weights);
    if (i === 0) start = index;
  }
  return { start, sides, center };
}

export function coat(c: AnimalContext, p: Vec3, vertical: number): RGB {
  const { d, m, fur, markings } = c;
  if (d.species === 'cow') {
    const z = p[2] / m.bodyLength,
      y = (p[1] - m.legY) / m.bodyRadius;
    // Broad irregular patches, sampled on the visible surface rather than a buried overlay.
    const patch = dmath.sin(15 * z + 1.3 * dmath.sin(y * 3)) + 0.65 * dmath.cos(5 * y - 8 * z);
    return colorMix(fur, markings, dmath.clamp((patch - 0.12) * 5, 0, 1));
  }
  if (d.species === 'dog' || d.species === 'cat' || d.species === 'deer') {
    return colorMix(fur, markings, dmath.clamp((-vertical - 0.35) * 2.8, 0, 1));
  }
  return fur;
}

/** Swept appendage, with a stable frame for centerline tails and mirrored side features. */
export function tube(
  c: AnimalContext,
  region: FigureRegion,
  points: Vec3[],
  radii: number[],
  weights: Skin[],
  color: RGB,
  sides: number = c.limbSides,
): void {
  let previous: RingRef | undefined;
  let tangent: Vec3 | undefined;
  for (let i = 0; i < points.length; i++) {
    const point = points[i] as Vec3;
    const direction = unit(
      sub(points[Math.min(i + 1, points.length - 1)] as Vec3, points[Math.max(0, i - 1)] as Vec3),
    );
    const r = radii[i] as number,
      s = weights[i] as Skin;
    // Transport the frame along the curve. Independently choosing a helper for each ring
    // twists a hanging tail inside out when its slope crosses the vertical-axis threshold.
    const reference: Vec3 = tangent ?? (dmath.abs(direction[0]) < 0.9 ? [1, 0, 0] : [0, 0, 1]);
    const dot =
      reference[0] * direction[0] + reference[1] * direction[1] + reference[2] * direction[2];
    tangent = unit(sub(reference, scale(direction, dot)));
    const up: Vec3 = [
      direction[1] * tangent[2] - direction[2] * tangent[1],
      direction[2] * tangent[0] - direction[0] * tangent[2],
      direction[0] * tangent[1] - direction[1] * tangent[0],
    ];
    let start = 0;
    for (let j = 0; j < sides; j++) {
      const [x, y] = circle(sides, j);
      const index = c.b.vertex(add(point, add(scale(tangent, r * x), scale(up, r * y))), color, s);
      if (j === 0) start = index;
    }
    const ring: RingRef = { start, sides, center: point };
    if (previous) c.b.loft(region, previous, ring);
    else c.b.cap(region, ring, s, color, undefined, false);
    if (i === points.length - 1)
      c.b.cap(region, ring, s, color, add(point, scale(direction, r * 0.35)), true);
    previous = ring;
  }
}
