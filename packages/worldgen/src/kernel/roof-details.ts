/** Dormers intersect the host roof analytically and stay below its original ridge envelope. */
import { directionToWorld, toWorld } from './footprint';
import { type MeshBufferBuilder, normalize3 } from './mesh-buffers';
import type { RecipeRoof } from './recipe';
import type { RoofSurface, WingRoofInput, WingRoofKind } from './roofs';
import type { Vec3 } from './types';

export function buildRoofDormers(
  kind: WingRoofKind,
  input: WingRoofInput,
  spec: NonNullable<RecipeRoof['dormers']>,
  window: RoofSurface,
  out: MeshBufferBuilder,
  limit: number,
): number {
  if (input.tier > 1 || !['gable', 'hip', 'mansard', 'gambrel'].includes(kind)) return 0;
  const along = input.wing.longAxis === 'u';
  const a0 = along ? input.wing.u0 : input.wing.v0;
  const a1 = along ? input.wing.u1 : input.wing.v1;
  const b0 = along ? input.wing.v0 : input.wing.u0;
  const b1 = along ? input.wing.v1 : input.wing.u1;
  const half = (b1 - b0) / 2;
  const lower = kind === 'mansard' || kind === 'gambrel';
  const rise = lower ? Math.max(input.lowerRise, kind === 'mansard' ? 1 : input.rise) : input.rise;
  const run =
    kind === 'mansard'
      ? Math.min(2.2, ((0.6 * Math.min(a1 - a0, b1 - b0)) / 2) * rise) / rise
      : kind === 'gambrel'
        ? 0.55 * half
        : half;
  if (rise < 0.3 || run * rise < 0.8 || run < 0.4 || limit < 1) return 0;
  const margin = kind === 'hip' ? half + 0.4 : kind === 'mansard' ? run + 0.3 : 0.8;
  const length = a1 - a0 - 2 * margin;
  const count = Math.min(6, Math.floor(length / Math.max(2.2, spec.perRidgeMeters)));
  if (count < 1) return 0;
  const point = (a: number, b: number, y: number): Vec3 => {
    const world = toWorld(input.frame, along ? [a, b] : [b, a]);
    return [world[0], y, world[1]];
  };
  const normal = (a: number, b: number, y: number): Vec3 => {
    const direction = directionToWorld(input.frame, along ? [a, b] : [b, a]);
    return normalize3([direction[0], y, direction[1]]);
  };
  const quad = (
    points: [Vec3, Vec3, Vec3, Vec3],
    n: Vec3,
    surface: RoofSurface,
    width = 1,
    height = 1,
  ): void =>
    out.addQuad(
      surface.slot,
      surface.ref,
      points,
      n,
      [
        [0, 0],
        [width, 0],
        [width, height],
        [0, height],
      ],
      surface.color,
    );
  const triangle = (points: [Vec3, Vec3, Vec3], n: Vec3, surface: RoofSurface): void =>
    out.addTriangle(
      surface.slot,
      surface.ref,
      points,
      n,
      [
        [0, 0],
        [1, 0],
        [0.5, 1],
      ],
      surface.color,
    );
  const frontRun = Math.min(0.45, run * 0.18);
  const height = Math.min(1.5, (run - frontRun) * rise * 0.86);
  if (height < 0.65) return 0;
  const width = Math.min(1.65, (length / count) * 0.58, height * 1.5);
  let emitted = 0;
  for (const sign of [-1, 1]) {
    const edge = sign === -1 ? b0 : b1;
    const front = edge - sign * frontRun;
    const bottom = input.eave + frontRun * rise + 0.015;
    const peak = bottom + height;
    const back = front - (sign * height) / rise;
    const sill = bottom + height * 0.13;
    const lintel = bottom + height * 0.65;
    const frontPoint = (a: number, y: number, proud = 0): Vec3 => point(a, front + sign * proud, y);
    for (let i = 0; i < count && emitted < limit; i++) {
      const center = a0 + margin + (length * (i + 0.5)) / count;
      const left = center - width / 2,
        right = center + width / 2;
      const top = spec.style === 'gable' ? bottom + height * 0.74 : peak - height * 0.18;
      const sideBack = front - (sign * (top - bottom)) / rise;
      const outward = normal(0, sign, 0);
      quad(
        [
          frontPoint(left, bottom),
          frontPoint(right, bottom),
          frontPoint(right, top),
          frontPoint(left, top),
        ],
        outward,
        input.surfaces.wall,
        width,
        top - bottom,
      );
      for (const [a, side] of [
        [left, -1],
        [right, 1],
      ] as const)
        triangle(
          [
            frontPoint(a, bottom),
            frontPoint(a, top),
            point(a, spec.style === 'gable' ? sideBack : back, spec.style === 'gable' ? top : peak),
          ],
          normal(side, 0, 0),
          input.surfaces.wall,
        );
      if (spec.style === 'gable') {
        triangle(
          [frontPoint(left, top), frontPoint(right, top), frontPoint(center, peak)],
          outward,
          input.surfaces.wall,
        );
        const roofRise = (peak - top) / (width / 2);
        for (const [a, side] of [
          [left, -1],
          [right, 1],
        ] as const)
          quad(
            [
              frontPoint(a, top),
              frontPoint(center, peak),
              point(center, back, peak),
              point(a, sideBack, top),
            ],
            normal(side * roofRise, 0, 1),
            input.surfaces.roof,
            width / 2,
            height / rise,
          );
      } else {
        quad(
          [
            frontPoint(left, top),
            frontPoint(right, top),
            point(right, back, peak),
            point(left, back, peak),
          ],
          normal(0, (sign * (peak - top)) / (height / rise), 1),
          input.surfaces.roof,
          width,
          height / rise,
        );
      }
      const windowLeft = center - width * 0.29,
        windowRight = center + width * 0.29;
      quad(
        [
          frontPoint(windowLeft, sill, 0.02),
          frontPoint(windowRight, sill, 0.02),
          frontPoint(windowRight, lintel, 0.02),
          frontPoint(windowLeft, lintel, 0.02),
        ],
        outward,
        window,
      );
      const trim = Math.min(0.09, width * 0.08);
      const strips: Array<[number, number, number, number]> = [
        [windowLeft - trim, windowLeft, sill - trim, lintel + trim],
        [windowRight, windowRight + trim, sill - trim, lintel + trim],
        [windowLeft, windowRight, sill - trim, sill],
        [windowLeft, windowRight, lintel, lintel + trim],
        [center - trim / 3, center + trim / 3, sill, lintel],
      ];
      for (const [s0, s1, y0, y1] of strips)
        quad(
          [
            frontPoint(s0, y0, 0.055),
            frontPoint(s1, y0, 0.055),
            frontPoint(s1, y1, 0.055),
            frontPoint(s0, y1, 0.055),
          ],
          outward,
          input.surfaces.trim,
          s1 - s0,
          y1 - y0,
        );
      emitted++;
    }
  }
  return emitted;
}
