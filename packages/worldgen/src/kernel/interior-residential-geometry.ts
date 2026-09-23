import { distancePointToRing } from './geometry2d';
import { interiorToWorld } from './interior-site';
import type { InteriorPlan, InteriorProfile } from './interior-types';
import { type MeshBufferBuilder, normalize3 } from './mesh-buffers';
import type { Vec2, Vec3 } from './types';

type Box = (
  out: MeshBufferBuilder,
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  d: number,
  color: string,
  material?: string,
) => void;

/** Partitions have explicit hall-facing doors, trim and skirting. Stair treads are visual;
 * a closed wedge supplies smooth capsule collision, with guarded slab openings and landings. */
export function* buildResidentialStructure(
  plan: InteriorPlan,
  structure: MeshBufferBuilder,
  steps: MeshBufferBuilder,
  collision: MeshBufferBuilder,
  box: Box,
  palette: InteriorProfile['palette'],
): Generator<void, void, void> {
  const site = plan.site;
  const seen = new Set<string>();
  for (const room of plan.rooms) {
    if (!room.program) continue;
    const level = room.level ?? 0,
      storey = plan.storeys[level];
    if (!storey) throw new Error('Room references a missing storey');
    const y = storey.floor - site.floor,
      h = storey.ceiling - storey.floor;
    const [x0, z0, x1, z1] = room.bounds;
    if (room.program === 'bathroom') {
      box(
        structure,
        (x0 + x1) / 2,
        y + 0.003,
        (z0 + z1) / 2,
        x1 - x0,
        0.004,
        z1 - z0,
        '#c3d1cb',
        'interior:ceramic',
      );
    }
    const edges: Array<[Vec2, Vec2, 'left' | 'right' | 'front' | 'back']> = [
      [[x0, z0], [x0, z1], 'left'],
      [[x1, z0], [x1, z1], 'right'],
      [[x0, z0], [x1, z0], 'front'],
      [[x0, z1], [x1, z1], 'back'],
    ];
    for (const [a, b, side] of edges) {
      if (room.program === 'stairwell' && side !== 'back') continue;
      const key = `${level}:${a.join(',')}:${b.join(',')}`;
      if (seen.has(key)) continue;
      seen.add(key);
      // The exterior shell already supplies boundary walls and transparent apertures.
      if (
        [a, b, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] as Vec2].every(
          (p) => distancePointToRing(interiorToWorld(site, p), site.outline) < 0.55,
        )
      )
        continue;
      const vertical = side === 'left' || side === 'right';
      const start = vertical ? a[1] : a[0],
        end = vertical ? b[1] : b[0];
      const door = room.door?.side === side ? room.door.at : undefined;
      const segment = (
        lo: number,
        hi: number,
        bottom: number,
        height: number,
        color: string,
        thickness = 0.12,
        material = 'interior:plaster',
      ): void => {
        if (hi - lo < 0.001 || height < 0.001) return;
        box(
          structure,
          vertical ? a[0] : (lo + hi) / 2,
          y + bottom + height / 2,
          vertical ? (lo + hi) / 2 : a[1],
          vertical ? thickness : hi - lo,
          height,
          vertical ? hi - lo : thickness,
          color,
          material,
        );
      };
      const bands: Array<[number, number]> =
        door === undefined
          ? [[start, end]]
          : [
              [start, door - 0.58],
              [door + 0.58, end],
            ];
      for (const band of bands) {
        const [lo, hi] = band;
        segment(lo, hi, 0, h, palette.wall);
        segment(lo, hi, 0, 0.12, '#ede6d5', 0.15, 'interior:wood');
      }
      if (door !== undefined) {
        segment(door - 0.58, door + 0.58, 2.2, h - 2.2, palette.wall);
        for (const s of [door - 0.62, door + 0.62])
          segment(s - 0.035, s + 0.035, 0, 2.25, '#e9e0cd', 0.18, 'interior:wood');
        segment(door - 0.65, door + 0.65, 2.2, 0.075, '#e9e0cd', 0.18, 'interior:wood');
      }
    }
    // One ceiling fitting per room, including service rooms; no light object per fitting.
    box(
      structure,
      (x0 + x1) / 2,
      storey.ceiling - site.floor - 0.055,
      (z0 + z1) / 2,
      0.48,
      0.09,
      0.48,
      '#f5e8c6',
      'interior:lamp',
    );
    yield;
  }
  for (const stair of plan.stairs) {
    const [x0, z0, x1, z1] = stair.bounds;
    const lower = plan.storeys[stair.lower],
      upper = plan.storeys[stair.upper];
    if (!lower || !upper) throw new Error('Stair references a missing storey');
    const lo = lower.floor,
      hi = upper.floor;
    const rise = hi - lo,
      run = z1 - z0;
    const point = (x: number, y: number, z: number): Vec3 => {
      const p = interiorToWorld(site, [x, z]);
      return [p[0], y, p[1]];
    };
    const tangent: Vec3 = [site.inward[1], 0, -site.inward[0]];
    const normal = normalize3([-site.inward[0] * rise, run, -site.inward[1] * rise]);
    collision.addQuad(
      'wall',
      'interior:plain',
      [point(x0, lo, z0), point(x1, lo, z0), point(x1, hi, z1), point(x0, hi, z1)],
      normal,
      [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
      ],
      [1, 1, 1],
    );
    for (const x of [x0, x1]) {
      const sign = x === x0 ? -1 : 1;
      collision.addTriangle(
        'wall',
        'interior:plain',
        [point(x, lo, z0), point(x, lo, z1), point(x, hi, z1)],
        [tangent[0] * sign, 0, tangent[2] * sign],
        [
          [0, 0],
          [1, 0],
          [1, 1],
        ],
        [1, 1, 1],
      );
    }
    collision.addQuad(
      'wall',
      'interior:plain',
      [point(x0, lo, z1), point(x1, lo, z1), point(x1, hi, z1), point(x0, hi, z1)],
      [site.inward[0], 0, site.inward[1]],
      [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
      ],
      [1, 1, 1],
    );
    for (let i = 0; i < stair.steps; i++) {
      const top = (rise * (i + 1)) / stair.steps,
        depth = run / stair.steps;
      box(
        steps,
        (x0 + x1) / 2,
        lo - site.floor + top / 2,
        z0 + (i + 0.5) * depth,
        x1 - x0,
        top,
        depth,
        palette.wood,
        'interior:wood',
      );
      box(
        steps,
        (x0 + x1) / 2,
        lo - site.floor + top - 0.025,
        z0 + (i + 0.5) * depth,
        x1 - x0 + 0.02,
        0.05,
        depth + 0.015,
        '#b39673',
        'interior:wood',
      );
      if (i % 8 === 0) yield;
    }
    // Upper guard walls are solid: a capsule cannot escape between balusters or cut across
    // the side of a stair. Their trim supplies the readable handrail silhouette.
    for (const x of [x0 - 0.07, x1 + 0.07]) {
      box(
        structure,
        x,
        hi - site.floor + 0.46,
        (z0 + z1) / 2,
        0.12,
        0.92,
        run + 0.12,
        palette.wall,
        'interior:plaster',
      );
      box(
        structure,
        x,
        hi - site.floor + 0.96,
        (z0 + z1) / 2,
        0.17,
        0.08,
        run + 0.16,
        palette.wood,
        'interior:wood',
      );
      // Slab reveals under the guards close the thickness of the cut floor edge.
      box(
        structure,
        x,
        hi - site.floor - 0.08,
        (z0 + z1) / 2,
        0.12,
        0.16,
        run,
        palette.wall,
        'interior:plaster',
      );
    }
    box(
      structure,
      (x0 + x1) / 2,
      hi - site.floor + 0.46,
      z0 - 0.07,
      x1 - x0 + 0.26,
      0.92,
      0.12,
      palette.wall,
      'interior:plaster',
    );
    box(
      structure,
      (x0 + x1) / 2,
      hi - site.floor + 0.96,
      z0 - 0.07,
      x1 - x0 + 0.3,
      0.08,
      0.17,
      palette.wood,
      'interior:wood',
    );
    yield;
  }
}
