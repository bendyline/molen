import { dmath } from '@bendyline/molen-kernel/determinism';
import { resolveInteriorProfile } from './interior-catalog';
import { buildDomesticFixture } from './interior-domestic-fixtures';
import { buildResidentialStructure } from './interior-residential-geometry';
import { interiorToLocal, interiorToWorld } from './interior-site';
import type {
  InteriorCatalogDoc,
  InteriorFixture,
  InteriorGeometry,
  InteriorPlan,
} from './interior-types';
import { MeshBufferBuilder } from './mesh-buffers';
import { modelBox } from './model-primitives';
import { parseColor } from './schema-common';
import { hashString, unit01 } from './seed';
import type { Vec2, Vec3 } from './types';
import { buildWalls } from './walls';

/** Structured low-poly furniture, baked into one shared vertex-color batch per interior. */
export function* generateInteriorGeometrySteps(
  plan: InteriorPlan,
  catalog: InteriorCatalogDoc,
): Generator<void, InteriorGeometry, void> {
  const site = plan.site;
  const palette = resolveInteriorProfile(site.labels, catalog).palette;
  const structure = new MeshBufferBuilder(),
    furniture = new MeshBufferBuilder(),
    glass = new MeshBufferBuilder(),
    steps = new MeshBufferBuilder(),
    collision = new MeshBufferBuilder();
  const domestic = plan.rooms.some((r) => r.program !== undefined);
  for (const [level, storey] of plan.storeys.entries()) {
    const holesAt = (ceiling: boolean): Vec2[][] => [
      ...site.holes,
      ...plan.stairs
        .filter((s) => (ceiling ? s.lower : s.upper) === level)
        .map((s) => {
          const [x0, z0, x1, z1] = s.bounds;
          return (
            [
              [x0, z0],
              [x0, z1],
              [x1, z1],
              [x1, z0],
            ] as Vec2[]
          ).map((p) => interiorToWorld(site, p));
        }),
    ];
    structure.addCap(
      'wall',
      domestic ? 'interior:wood' : 'interior:ceramic',
      site.outline,
      holesAt(false),
      () => storey.floor,
      [0, 1, 0],
      (p) => interiorToLocal(site, p),
      parseColor(palette.floor),
    );
    structure.addCap(
      'wall',
      'interior:plaster',
      site.outline,
      holesAt(true),
      () => storey.ceiling,
      [0, -1, 0],
      (p) => p,
      parseColor('#eee9dc'),
    );
    yield;
  }
  // Reverse-facing structural walls retain the same physical openings as the exterior.
  buildWalls(
    [site.outline, ...site.holes],
    site.floor - 0.04,
    plan.storeys[plan.storeys.length - 1]?.ceiling ?? site.ceiling,
    { mode: 'meters', bayWidth: 1, floorHeight: 3, offsetU: 0, offsetV: 0, mirror: false },
    { slot: 'wall', ref: 'interior:plaster', color: parseColor(palette.wall) },
    undefined,
    structure,
    site.floor - 0.04,
    site.openings,
    true,
  );
  if (site.access.length === 4)
    structure.addQuad(
      'wall',
      'palette:#ffffff',
      site.access as [Vec3, Vec3, Vec3, Vec3],
      [0, 1, 0],
      [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
      ],
      parseColor(palette.floor),
    );
  for (const opening of site.openings) {
    if (opening.kind !== 'window') continue;
    const a = site.outline[opening.edge] as Vec2,
      b = site.outline[(opening.edge + 1) % site.outline.length] as Vec2;
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const dx = (b[0] - a[0]) / length,
      dz = (b[1] - a[1]) / length;
    const p = (s: number, y: number): Vec3 => [a[0] + dx * s, y, a[1] + dz * s];
    const upperMissing = opening.bottom > (plan.storeys.at(-1)?.ceiling ?? site.ceiling);
    (upperMissing ? structure : glass).addQuad(
      'window',
      'palette:#ffffff',
      [
        p(opening.start, opening.bottom),
        p(opening.end, opening.bottom),
        p(opening.end, opening.top),
        p(opening.start, opening.top),
      ],
      [dz, 0, -dx],
      [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
      ],
      upperMissing ? parseColor(palette.wall) : [0.74, 0.86, 0.9],
    );
  }
  const yaw = dmath.atan2(site.inward[0], site.inward[1]);
  const box = (
    out: MeshBufferBuilder,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    color: string,
    material = 'interior:plain',
  ): void => {
    const p = interiorToWorld(site, [x, z]);
    modelBox(out, [p[0], site.floor + y, p[1]], [w, h, d], color, yaw, material);
  };
  yield* buildResidentialStructure(plan, structure, steps, collision, box, palette);
  for (const room of plan.rooms) {
    if (room.program) continue;
    const [x0, z0, x1, z1] = room.bounds,
      h = site.ceiling - site.floor;
    const mid = (x0 + x1) / 2,
      door = 1.2;
    for (const x of [x0, x1])
      box(structure, x, h / 2, (z0 + z1) / 2, 0.12, h, z1 - z0, palette.wall);
    box(structure, mid, h / 2, z1, x1 - x0, h, 0.12, palette.wall);
    for (const [lo, hi] of [
      [x0, mid - door / 2],
      [mid + door / 2, x1],
    ]) {
      if (lo !== undefined && hi !== undefined)
        box(structure, (lo + hi) / 2, h / 2, z0, hi - lo, h, 0.12, palette.wall);
    }
    const header = h - 2.15;
    if (header > 0) box(structure, mid, 2.15 + header / 2, z0, door, header, 0.12, palette.wall);
    yield;
  }
  for (const fixture of plan.fixtures) {
    buildFixture(fixture);
    yield;
  }
  function buildFixture(f: InteriorFixture): void {
    const [x0, z0, x1, z1] = f.bounds;
    const storey = plan.storeys[f.level ?? 0] ?? { floor: site.floor, ceiling: site.ceiling };
    const elevation = storey.floor - site.floor;
    const x = (x0 + x1) / 2,
      z = (z0 + z1) / 2,
      w = x1 - x0,
      d = z1 - z0;
    const put = (
      dx: number,
      y: number,
      dz: number,
      sx: number,
      sy: number,
      sz: number,
      color: string,
      material?: string,
    ): void =>
      box(
        furniture,
        x + dx,
        elevation + y,
        z + dz,
        sx,
        sy,
        sz,
        color,
        material ??
          (color === palette.wood
            ? 'interior:wood'
            : (f.kind === 'sofa' || f.kind === 'bed') && color !== metal
              ? 'interior:fabric'
              : 'interior:plain'),
      );
    const wood = palette.wood,
      accent =
        f.variant === undefined
          ? palette.accent
          : (['#597b77', '#aa775a', '#697c95', '#8d8069'][f.variant % 4] as string),
      metal = '#697173';
    if (buildDomesticFixture(f.kind, f.variant ?? 0, w, d, wood, accent, put)) return;
    if (f.kind === 'shelf' || f.kind === 'rack') {
      const h = Math.min(f.kind === 'rack' ? 3.2 : 1.9, site.ceiling - site.floor - 0.35);
      for (const dx of [-w / 2 + 0.05, w / 2 - 0.05])
        for (const dz of [-d / 2 + 0.05, d / 2 - 0.05]) put(dx, h / 2, dz, 0.08, h, 0.08, metal);
      const salt = hashString(`${plan.seed}|stock:${f.id}`);
      for (let level = 0; level < 4; level++) {
        const y = 0.15 + (level * (h - 0.2)) / 4;
        put(0, y, 0, w, 0.08, d, '#c7c4b7');
        for (let item = 0; item < 4; item++) {
          const color = ['#bd7251', '#839758', '#d1b165', '#879da4'][
            Math.floor(unit01(salt, level * 4 + item) * 4)
          ] as string;
          put(0, y + 0.22, -d / 2 + ((item + 0.5) * d) / 4, w * 0.83, 0.32, (d / 4) * 0.75, color);
        }
      }
    } else if (f.kind === 'table' || f.kind === 'desk') {
      const tw = Math.min(1.6, w * 0.58),
        td = Math.min(0.85, d * 0.5);
      put(0, 0.76, 0, tw, 0.08, td, wood);
      for (const dx of [-tw * 0.4, tw * 0.4])
        for (const dz of [-td * 0.38, td * 0.38]) put(dx, 0.36, dz, 0.06, 0.72, 0.06, metal);
      for (const sign of f.kind === 'desk' ? [1] : [-1, 1]) {
        put(0, 0.44, sign * d * 0.35, 0.42, 0.1, 0.42, accent);
        put(0, 0.72, sign * (d * 0.35 + 0.18), 0.42, 0.55, 0.07, accent);
        put(0, 0.2, sign * d * 0.35, 0.28, 0.4, 0.28, metal);
      }
      if (f.kind === 'desk') {
        put(0, 1.02, -td * 0.25, 0.5, 0.34, 0.06, '#303d43');
        put(0, 0.84, -td * 0.25, 0.07, 0.18, 0.08, metal);
      }
    } else if (f.kind === 'bed') {
      const bw = Math.min(1.65, w),
        bd = Math.min(1.95, d);
      put(0, 0.22, 0, bw, 0.4, bd, wood);
      put(0, 0.65, bd / 2 - 0.05, bw + 0.02, 1.05, 0.09, wood);
      put(0, 0.49, 0, bw, 0.2, bd, '#e5e0d5');
      put(0, 0.61, -bd * 0.13, bw * 0.98, 0.08, bd * 0.68, accent);
      put(0, 0.64, bd * 0.32, bw * 0.72, 0.16, 0.42, '#f1eee4');
    } else if (f.kind === 'sofa' || f.kind === 'bench') {
      put(0, 0.3, 0, w, 0.5, d * 0.75, wood);
      put(0, 0.62, d * 0.3, w, 0.75, 0.15, accent);
      if (f.kind === 'sofa') {
        for (const side of [-1, 1]) {
          put(side * w * 0.46, 0.54, 0, w * 0.08, 0.65, d, accent);
          put(side * w * 0.225, 0.59, -d * 0.07, w * 0.42, 0.15, d * 0.63, accent);
          put(side * w * 0.33, 0.8, d * 0.06, 0.3, 0.28, 0.18, side < 0 ? '#c4b492' : '#869184');
        }
      }
    } else {
      put(0, 0.49, 0, w, 0.98, d, accent);
      put(0, 1.03, 0, w + 0.04, 0.1, d + 0.04, '#d5d0c1');
      put(w * 0.25, 1.25, 0, 0.42, 0.34, 0.25, '#303d43');
      if (f.kind === 'counter') put(-w * 0.25, 1.16, 0, 0.52, 0.16, 0.5, metal);
    }
    // Flat luminous-looking ceiling fixtures; no per-building dynamic lights or shadow maps.
    box(
      furniture,
      x,
      storey.ceiling - site.floor - 0.04,
      z,
      Math.min(w, 1.2),
      0.05,
      0.35,
      '#fff7dc',
    );
  }
  const s = structure.finalize(),
    f = furniture.finalize(),
    g = glass.finalize(),
    t = steps.finalize(),
    c = collision.finalize();
  return {
    structure: s,
    furniture: f,
    glass: g,
    steps: t,
    collision: c,
    bytes: s.bytes + f.bytes + g.bytes + t.bytes + c.bytes,
  };
}
export function generateInteriorGeometry(
  plan: InteriorPlan,
  catalog: InteriorCatalogDoc,
): InteriorGeometry {
  const steps = generateInteriorGeometrySteps(plan, catalog);
  for (;;) {
    const step = steps.next();
    if (step.done) return step.value;
  }
}
