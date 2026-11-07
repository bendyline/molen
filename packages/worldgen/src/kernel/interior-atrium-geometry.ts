import type { Bounds2 } from './geometry2d';
import { interiorToWorld } from './interior-site';
import { buildPlate, type InteriorBox } from './interior-tower-geometry';
import type {
  InteriorAtriumPlan,
  InteriorPlan,
  InteriorProfile,
  InteriorShop,
  InteriorStorey,
} from './interior-types';
import type { MeshBufferBuilder } from './mesh-buffers';
import { normalize3 } from './mesh-buffers';
import { parseColor } from './schema-common';
import type { Vec2, Vec3 } from './types';

const WALL = 0.14;
const DOOR = 3.4;
const FASCIA = 0.9;
const RAIL = 1.05;
const GLASS_HEIGHT = 2.9;
const FASCIAS = ['#23384a', '#7c2f2b', '#2f5d50', '#3b3b42', '#8a6d2f', '#4a3a66'] as const;

function ring(site: InteriorPlan['site'], r: Bounds2): Vec2[] {
  const [x0, z0, x1, z1] = r;
  return (
    [
      [x0, z0],
      [x0, z1],
      [x1, z1],
      [x1, z0],
    ] as Vec2[]
  ).map((p) => interiorToWorld(site, p));
}

/** A shopfront: glass either side of a wide opening under a colored fascia. */
function buildFront(
  shop: InteriorShop,
  elevation: number,
  height: number,
  structure: MeshBufferBuilder,
  furniture: MeshBufferBuilder,
  glassBoxes: MeshBufferBuilder,
  box: InteriorBox,
): void {
  const [x0, z0, x1, z1] = shop.bounds;
  const alongX = shop.facing === 'z-' || shop.facing === 'z+';
  const width = alongX ? x1 - x0 : z1 - z0;
  const fixed =
    shop.facing === 'x-' ? x0 : shop.facing === 'x+' ? x1 : shop.facing === 'z-' ? z0 : z1;
  const center = alongX ? (x0 + x1) / 2 : (z0 + z1) / 2;
  const at = (
    along: number,
    y: number,
    size: number,
    tall: number,
    out: MeshBufferBuilder,
    color: string,
    material?: string,
  ): void => {
    if (alongX) box(out, along, y, fixed, size, tall, WALL, color, material);
    else box(out, fixed, y, along, WALL, tall, size, color, material);
  };
  const fascia = FASCIAS[Math.floor(shop.seed * 997) % FASCIAS.length] as string;
  const top = Math.min(GLASS_HEIGHT, height - FASCIA);
  at(center, elevation + top + FASCIA / 2, width, FASCIA, furniture, fascia);
  at(
    center,
    elevation + top + FASCIA + (height - top - FASCIA) / 2,
    width,
    Math.max(0.05, height - top - FASCIA),
    structure,
    '#d7d4ca',
  );
  if (shop.anchor) return;
  const pane = (width - DOOR) / 2;
  if (pane < 0.4) return;
  for (const side of [-1, 1]) {
    const along = center + side * (DOOR / 2 + pane / 2);
    at(along, elevation + top / 2, pane, top, glassBoxes, '#cfe0e4');
  }
}

/** Walkways and shop walls. */
export function* buildAtriumStructure(
  plan: InteriorPlan,
  structure: MeshBufferBuilder,
  glass: MeshBufferBuilder,
  furniture: MeshBufferBuilder,
  box: InteriorBox,
  palette: InteriorProfile['palette'],
): Generator<void, void, void> {
  const site = plan.site;
  const atrium = plan.atrium as InteriorAtriumPlan;
  const voidRings = atrium.voids.map((v) => ring(site, v));
  const count = plan.storeys.length;
  for (const [level, storey] of plan.storeys.entries()) {
    buildPlate(
      plan,
      storey,
      level === 0,
      plan.storeys[level + 1],
      level > 0 ? voidRings : [],
      level + 1 < count ? voidRings : [],
      palette,
      structure,
      glass,
    );
    const elevation = storey.floor - site.floor;
    const height = storey.ceiling - storey.floor;
    const drawn = new Set<string>();
    const wall = (x: number, z: number, w: number, d: number): void => {
      const key = `${x.toFixed(2)}:${z.toFixed(2)}:${w.toFixed(2)}`;
      if (drawn.has(key)) return;
      drawn.add(key);
      box(structure, x, elevation + height / 2, z, w, height, d, palette.wall);
    };
    for (const shop of atrium.shops) {
      const [x0, z0, x1, z1] = shop.bounds;
      if (shop.facing !== 'x-') wall(x0, (z0 + z1) / 2, WALL, z1 - z0);
      if (shop.facing !== 'x+') wall(x1, (z0 + z1) / 2, WALL, z1 - z0);
      if (shop.facing !== 'z-') wall((x0 + x1) / 2, z0, x1 - x0, WALL);
      if (shop.facing !== 'z+') wall((x0 + x1) / 2, z1, x1 - x0, WALL);
      buildFront(shop, elevation, height, structure, furniture, furniture, box);
    }
    yield;
    if (level > 0)
      for (const [x0, z0, x1, z1] of atrium.voids) {
        // Balustrades, left open only where an escalator comes up through the end of a well.
        const stops = atrium.escalators.filter(
          (e) =>
            e.upper === level &&
            e.bounds[0] >= x0 &&
            e.bounds[2] <= x1 &&
            e.bounds[1] >= z0 - 0.01 &&
            e.bounds[3] <= z1 + 0.01,
        );
        const starts = atrium.escalators.filter(
          (e) =>
            e.lower === level &&
            e.bounds[0] >= x0 &&
            e.bounds[2] <= x1 &&
            e.bounds[1] >= z0 - 0.01 &&
            e.bounds[3] <= z1 + 0.01,
        );
        const y = elevation + RAIL / 2;
        for (const x of [x0, x1])
          box(structure, x, y, (z0 + z1) / 2, 0.08, RAIL, z1 - z0, '#b9c4c8', 'interior:plain');
        if (stops.length === 0 && starts.length === 0) {
          for (const z of [z0, z1])
            box(structure, (x0 + x1) / 2, y, z, x1 - x0, RAIL, 0.08, '#b9c4c8', 'interior:plain');
        } else if (stops.length > 0) {
          // The run lands on the bridge at the far end; a car cannot fall in from the near one.
          box(structure, (x0 + x1) / 2, y, z0, x1 - x0, RAIL, 0.08, '#b9c4c8', 'interior:plain');
          const side = (x1 - x0 - 3.4) / 2;
          if (side > 0.2)
            for (const x of [x0 + side / 2, x1 - side / 2])
              box(structure, x, y, z1, side, RAIL, 0.08, '#b9c4c8', 'interior:plain');
        }
      }
  }
  for (const escalator of atrium.escalators)
    buildEscalator(
      escalator.bounds,
      plan.storeys[escalator.lower] as InteriorStorey,
      plan.storeys[escalator.upper] as InteriorStorey,
    );
  // Daylight down the void, from the top floor's ceiling.
  const roof = (plan.storeys.at(-1) as InteriorStorey).ceiling - site.floor - 0.03;
  for (const [x0, z0, x1, z1] of atrium.gallerias) {
    const alongX = x1 - x0 > z1 - z0;
    const length = alongX ? x1 - x0 : z1 - z0;
    const panels = Math.max(1, Math.floor(length / 7));
    for (let i = 0; i < panels; i++) {
      const t = (i + 0.5) / panels;
      if (alongX)
        box(
          furniture,
          x0 + (x1 - x0) * t,
          roof,
          (z0 + z1) / 2,
          5,
          0.05,
          2.4,
          '#fff8e4',
          'interior:lamp',
        );
      else
        box(
          furniture,
          (x0 + x1) / 2,
          roof,
          z0 + (z1 - z0) * t,
          2.4,
          0.05,
          5,
          '#fff8e4',
          'interior:lamp',
        );
    }
  }
  yield;

  function buildEscalator(
    [x0, z0, x1, z1]: Bounds2,
    lower: InteriorStorey,
    upper: InteriorStorey,
  ): void {
    const p = (x: number, z: number, y: number): Vec3 => {
      const q = interiorToWorld(site, [x, z]);
      return [q[0], y, q[1]];
    };
    const a = p(x0, z0, lower.floor),
      b = p(x1, z0, lower.floor),
      c = p(x1, z1, upper.floor),
      d = p(x0, z1, upper.floor);
    const e1: Vec3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]],
      e2: Vec3 = [d[0] - a[0], d[1] - a[1], d[2] - a[2]];
    const raw: Vec3 = [
      e1[1] * e2[2] - e1[2] * e2[1],
      e1[2] * e2[0] - e1[0] * e2[2],
      e1[0] * e2[1] - e1[1] * e2[0],
    ];
    const normal = normalize3(raw[1] >= 0 ? raw : [-raw[0], -raw[1], -raw[2]]);
    structure.addQuad(
      'wall',
      'interior:plain',
      [a, b, c, d],
      normal,
      [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
      ],
      parseColor('#5e6569'),
    );
    // Balustrades either side, closed to the floor below.
    for (const x of [x0, x1]) {
      const low = p(x, z0, lower.floor),
        high = p(x, z1, upper.floor);
      const lowTop = p(x, z0, lower.floor + RAIL),
        highTop = p(x, z1, upper.floor + RAIL);
      const base = p(x, z1, lower.floor);
      const side = interiorToWorld(site, [x + 1, z0]);
      const origin = interiorToWorld(site, [x, z0]);
      const n = normalize3([side[0] - origin[0], 0, side[1] - origin[1]]);
      for (const sign of [1, -1]) {
        const face: Vec3 = [n[0] * sign, 0, n[2] * sign];
        structure.addQuad(
          'wall',
          'interior:plain',
          [low, high, highTop, lowTop],
          face,
          [
            [0, 0],
            [1, 0],
            [1, 1],
            [0, 1],
          ],
          parseColor('#c7d3d7'),
        );
        structure.addTriangle(
          'wall',
          'interior:plain',
          [low, base, high],
          face,
          [
            [0, 0],
            [1, 0],
            [1, 1],
          ],
          parseColor('#7f878a'),
        );
      }
    }
  }
}
