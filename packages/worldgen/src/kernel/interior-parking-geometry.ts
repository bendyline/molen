import { dmath } from '@bendyline/molen-kernel/determinism';
import { resolveInteriorProfile } from './interior-catalog';
import { interiorToLocal, interiorToWorld } from './interior-site';
import type {
  InteriorCatalogDoc,
  InteriorGeometry,
  InteriorPlan,
  InteriorStorey,
  ParkingLayout,
  ParkingPlan,
  ParkingRamp,
} from './interior-types';
import { MeshBufferBuilder, normalize3 } from './mesh-buffers';
import { modelBox } from './model-primitives';
import { parseColor } from './schema-common';
import type { Vec2, Vec3 } from './types';
import { buildWalls } from './walls';

const SLAB = 'interior:deck';
const CONCRETE = '#a9aeb2';
const LINE = '#f2f0e6';
const CURB = '#d0a93a';
const APRON = '#6d7073';
const GUARD = 1;
const WALL = 0.2;
const LINE_WIDTH = 0.1;
const LIGHT_SPACING = 7.8;
/** The first and last meters of a ramp ease the change of grade, so cars do not ground out. */
const EASE = 3;
/** Painted on columns and spandrels: most garages color their levels for finding your car. */
const LEVEL_COLORS = ['#3b78b5', '#3f9c6b', '#d9a93a', '#c7603f', '#8461b8', '#3aa3a8'] as const;

type Corners = [Vec3, Vec3, Vec3, Vec3];

function unitUv(a: Vec3, b: Vec3, c: Vec3, d: Vec3): [Vec2, Vec2, Vec2, Vec2] {
  const width = Math.hypot(b[0] - a[0], b[2] - a[2], b[1] - a[1]);
  const height = Math.hypot(d[0] - a[0], d[2] - a[2], d[1] - a[1]);
  void c;
  return [
    [0, 0],
    [width, 0],
    [width, height],
    [0, height],
  ];
}

export function* generateParkingGeometrySteps(
  plan: InteriorPlan,
  catalog: InteriorCatalogDoc,
): Generator<void, InteriorGeometry, void> {
  const site = plan.site;
  const layout = site.parking as ParkingLayout;
  const parking = plan.parking as ParkingPlan;
  const palette = resolveInteriorProfile(site.labels, catalog).palette;
  const structure = new MeshBufferBuilder(),
    paint = new MeshBufferBuilder(),
    empty = new MeshBufferBuilder();
  const yaw = dmath.atan2(site.inward[0], site.inward[1]);
  const world = (x: number, z: number, y: number): Vec3 => {
    const p = interiorToWorld(site, [x, z]);
    return [p[0], y, p[1]];
  };
  const box = (
    out: MeshBufferBuilder,
    x: number,
    z: number,
    y0: number,
    y1: number,
    w: number,
    d: number,
    color: string,
    material = SLAB,
  ): void => {
    const p = interiorToWorld(site, [x, z]);
    modelBox(out, [p[0], (y0 + y1) / 2, p[1]], [w, y1 - y0, d], color, yaw, material);
  };
  const quad = (
    out: MeshBufferBuilder,
    corners: Corners,
    normal: Vec3,
    color: string,
    material = SLAB,
  ): void => {
    out.addQuad('wall', material, corners, normal, unitUv(...corners), parseColor(color));
  };
  const storeys = plan.storeys;
  const roofDeck = (storeys.at(-1) as InteriorStorey).floor;
  const openingAt = (level: number): Vec2[][] =>
    layout.ramps
      .filter((r) => r.upper === level)
      .map(({ bounds: [x0, z0, x1, z1] }) =>
        (
          [
            [x0, z0],
            [x0, z1],
            [x1, z1],
            [x1, z0],
          ] as Vec2[]
        ).map((p) => interiorToWorld(site, p)),
      );
  for (const [level, storey] of storeys.entries()) {
    const holes = [...site.holes, ...openingAt(level)];
    // The roof deck's surface is the exterior roof, cut for the ramp in the same place.
    if (!storey.open)
      structure.addCap(
        'wall',
        SLAB,
        site.outline,
        holes,
        () => storey.floor,
        [0, 1, 0],
        (p) => interiorToLocal(site, p),
        parseColor(palette.floor),
      );
    const above = storeys[level + 1];
    if (!storey.open && above)
      structure.addCap(
        'wall',
        SLAB,
        site.outline,
        [...site.holes, ...openingAt(level + 1)],
        () => storey.ceiling,
        [0, -1, 0],
        (p) => p,
        parseColor(palette.wall),
      );
    yield;
  }
  buildWalls(
    [site.outline, ...site.holes],
    site.floor - 0.04,
    roofDeck,
    { mode: 'meters', bayWidth: 1, floorHeight: 3, offsetU: 0, offsetV: 0, mirror: false },
    { slot: 'wall', ref: SLAB, color: parseColor(palette.wall) },
    undefined,
    structure,
    site.floor - 0.04,
    site.openings,
    true,
  );
  for (const apron of layout.aprons) {
    if (apron.length !== 4) continue;
    quad(structure, apron as Corners, [0, 1, 0], APRON);
  }

  // Columns, with each storey's color at a driver's eye height.
  for (const [level, storey] of storeys.entries()) {
    if (storey.open) continue;
    const band = LEVEL_COLORS[level % LEVEL_COLORS.length] as string;
    for (const [x, z] of parking.columns) {
      box(structure, x, z, storey.floor, storey.ceiling, 0.5, 0.5, CONCRETE);
      box(paint, x, z, storey.floor + 0.9, storey.floor + 1.8, 0.52, 0.52, band);
    }
    yield;
  }

  // Stall lines and aisle lights. Paint has no collision: nothing here should stop a car.
  const { stallWidth, stallDepth, axis } = layout;
  const seen = new Set<string>();
  const lines: { x: number; z: number; w: number; d: number }[] = [];
  const line = (x: number, z: number, w: number, d: number): void => {
    const key = `${x.toFixed(2)}:${z.toFixed(2)}`;
    if (seen.has(key)) return;
    seen.add(key);
    lines.push({ x, z, w, d });
  };
  for (const stall of parking.stalls) {
    const [cx, cz] = stall.center;
    const [nx, nz] = stall.nose;
    for (const side of [-0.5, 0.5]) {
      if (axis === 'x') line(cx + side * stallWidth, cz, LINE_WIDTH, stallDepth);
      else line(cx, cz + side * stallWidth, stallDepth, LINE_WIDTH);
    }
    // The far end of the bay, facing the row behind it or the wall.
    if (axis === 'x') line(cx, cz + (nz * stallDepth) / 2, stallWidth, LINE_WIDTH);
    else line(cx + (nx * stallDepth) / 2, cz, LINE_WIDTH, stallWidth);
  }
  for (const storey of storeys) {
    const y = storey.floor + 0.015;
    for (const l of lines) {
      const hw = l.w / 2,
        hd = l.d / 2;
      quad(
        paint,
        [
          world(l.x - hw, l.z - hd, y),
          world(l.x + hw, l.z - hd, y),
          world(l.x + hw, l.z + hd, y),
          world(l.x - hw, l.z + hd, y),
        ],
        [0, 1, 0],
        LINE,
      );
    }
    yield;
  }
  for (const storey of storeys) {
    if (storey.open) continue;
    const y = storey.ceiling - 0.05;
    for (const [x0, z0, x1, z1] of layout.aisles) {
      const along = axis === 'x' ? x1 - x0 : z1 - z0;
      const count = Math.max(1, Math.floor(along / LIGHT_SPACING));
      for (let i = 0; i < count; i++) {
        const t = (i + 0.5) / count;
        if (axis === 'x')
          box(
            paint,
            x0 + (x1 - x0) * t,
            (z0 + z1) / 2,
            y,
            y + 0.05,
            1.3,
            0.14,
            '#fff4d6',
            'interior:lamp',
          );
        else
          box(
            paint,
            (x0 + x1) / 2,
            z0 + (z1 - z0) * t,
            y,
            y + 0.05,
            0.14,
            1.3,
            '#fff4d6',
            'interior:lamp',
          );
      }
    }
    yield;
  }

  for (const ramp of layout.ramps) {
    const lower = storeys[ramp.lower] as InteriorStorey,
      upper = storeys[ramp.upper] as InteriorStorey;
    buildRamp(ramp, lower.floor, upper.floor, upper.open === true);
    yield;
  }

  /** Lane surface and walls, in (along, across) so one code path serves either aisle axis. */
  function buildRamp(ramp: ParkingRamp, y0: number, y1: number, toRoof: boolean): void {
    const [bx0, bz0, bx1, bz1] = ramp.bounds;
    const alongX = ramp.axis === 'x';
    const [a0, c0, a1, c1] = alongX ? [bx0, bz0, bx1, bz1] : [bz0, bx0, bz1, bx1];
    const run = a1 - a0;
    const rise = y1 - y0;
    const ease = Math.min(EASE, run / 4);
    const slope = rise / (run - ease);
    const stations: [number, number][] = [
      [0, 0],
      [ease, (slope * ease) / 2],
      [run - ease, rise - (slope * ease) / 2],
      [run, rise],
    ];
    const at = (t: number): number => (ramp.climb === 1 ? a0 + t : a1 - t);
    const p = (along: number, across: number, y: number): Vec3 =>
      alongX ? world(along, across, y) : world(across, along, y);
    for (let i = 0; i + 1 < stations.length; i++) {
      const [ta, ha] = stations[i] as [number, number],
        [tb, hb] = stations[i + 1] as [number, number];
      const ua = at(ta),
        ub = at(tb);
      const a = p(ua, c0, y0 + ha),
        b = p(ub, c0, y0 + hb),
        c = p(ub, c1, y0 + hb),
        d = p(ua, c1, y0 + ha);
      const e1: Vec3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]],
        e2: Vec3 = [d[0] - a[0], d[1] - a[1], d[2] - a[2]];
      const raw: Vec3 = [
        e1[1] * e2[2] - e1[2] * e2[1],
        e1[2] * e2[0] - e1[0] * e2[2],
        e1[0] * e2[1] - e1[1] * e2[0],
      ];
      const normal = normalize3(raw[1] >= 0 ? raw : [-raw[0], -raw[1], -raw[2]]);
      quad(structure, [a, b, c, d], normal, palette.floor);
      // A wall each side: closed down to the deck, a guard above the lane.
      for (const [outer, inner] of [
        [c0, c0 + WALL],
        [c1, c1 - WALL],
      ] as const) {
        const faces: [number, number][] = [
          [outer, Math.sign(outer - inner)],
          [inner, Math.sign(inner - outer)],
        ];
        for (const [across, sign] of faces) {
          const facing = p(0, sign, 0),
            base = p(0, 0, 0);
          const n: Vec3 = normalize3([facing[0] - base[0], 0, facing[2] - base[2]]);
          quad(
            structure,
            [
              p(ua, across, y0),
              p(ub, across, y0),
              p(ub, across, y0 + hb + GUARD),
              p(ua, across, y0 + ha + GUARD),
            ],
            n,
            CONCRETE,
          );
        }
        quad(
          structure,
          [
            p(ua, outer, y0 + ha + GUARD),
            p(ub, outer, y0 + hb + GUARD),
            p(ub, inner, y0 + hb + GUARD),
            p(ua, inner, y0 + ha + GUARD),
          ],
          [0, 1, 0],
          CURB,
        );
      }
    }
    // Under the high end, closing the lane on the deck it left.
    const high = at(run),
      low = at(0);
    const thick = alongX ? [WALL, c1 - c0] : [c1 - c0, WALL];
    const middle = (c0 + c1) / 2;
    const center = (along: number): [number, number] =>
      alongX ? [along, middle] : [middle, along];
    const [hx, hz] = center(high + ramp.climb * (WALL / 2));
    box(structure, hx, hz, y0, y1, thick[0] as number, thick[1] as number, CONCRETE);
    // A guard across the low end of the opening, on the deck above the lane's mouth.
    const [lx, lz] = center(low - ramp.climb * (WALL / 2));
    box(structure, lx, lz, y1, y1 + GUARD, thick[0] as number, thick[1] as number, CONCRETE);
    if (toRoof)
      box(
        paint,
        lx,
        lz,
        y1 + GUARD,
        y1 + GUARD + 0.02,
        thick[0] as number,
        thick[1] as number,
        CURB,
      );
  }

  const s = structure.finalize(),
    p = paint.finalize(),
    none = empty.finalize();
  return {
    structure: s,
    furniture: none,
    glass: none,
    steps: p,
    collision: none,
    bytes: s.bytes + p.bytes,
  };
}
