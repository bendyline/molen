/** St Pancras International, its Barlow shed, northern extension, and Midland Grand frontage. */
import { readFileSync } from 'node:fs';
import {
  beam,
  loft,
  normalFor,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';

export const layout = JSON.parse(readFileSync(new URL('../layout.json', import.meta.url)));
export const surfaces = {
  brick: { slot: 'wall', graph: 'brick_flemish', roughness: 0.92 },
  stone: { slot: 'trim', graph: 'stone_limestone_raw', roughness: 0.9 },
  concrete: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.95 },
  steel: { slot: 'trim', graph: 'metal_painted', roughness: 0.73, metallic: 0.18 },
  slate: { slot: 'roof', graph: 'slate', roughness: 0.87 },
  glass: {
    slot: 'window',
    graph: 'window_grid',
    roughness: 0.39,
    alphaMode: 'BLEND',
    baseColorFactor: [1, 1, 1, 0.72],
    doubleSided: true,
  },
  roofLight: {
    slot: 'roof',
    localRef: 'palette:#ffffff',
    name: 'Barlow crown glazing',
    roughness: 0.39,
    alphaMode: 'BLEND',
    baseColorFactor: [1, 1, 1, 0.45],
  },
  wood: { slot: 'trim', graph: 'wood_plain', roughness: 0.91 },
};
const colors = {
  brick: [0.48, 0.22, 0.143],
  darkBrick: [0.34, 0.145, 0.092],
  brickLight: [0.58, 0.28, 0.17],
  sand: [0.73, 0.62, 0.47],
  stone: [0.53, 0.47, 0.37],
  slate: [0.3, 0.35, 0.367],
  slateLight: [0.39, 0.43, 0.44],
  glass: [0.49, 0.63, 0.69],
  shadow: [0.115, 0.132, 0.147],
  iron: [0.32, 0.46, 0.54],
  lightIron: [0.55, 0.69, 0.73],
  steel: [0.43, 0.45, 0.44],
  zinc: [0.67, 0.69, 0.67],
  deck: [0.53, 0.51, 0.46],
  edge: [0.79, 0.75, 0.62],
  rail: [0.35, 0.36, 0.35],
  ballast: [0.29, 0.259, 0.22],
  tie: [0.25, 0.184, 0.135],
  gold: [0.75, 0.54, 0.253],
  clock: [0.91, 0.87, 0.78],
};
const levels = { skyline: 0, district: 1, street: 2, closeup: 3, master: 4 };
const ref = 'palette:#ffffff',
  up = [0, 1, 0],
  down = [0, -1, 0],
  mix = (a, b, t) => a + (b - a) * t;
const lerp = (a, b, t) => a.map((v, i) => mix(v, b[i], t));
const rod = (out, slot, tone, a, b, w, d = w) => beam(out, slot, a, b, w, d, colors[tone]);
function face(out, slot, tone, points, expected) {
  points = points
    .map((p) => p.map(Math.fround))
    .filter((p, i, all) => !all.slice(0, i).some((q) => q.every((v, j) => v === p[j])));
  if (points.length < 3) return;
  let normal = normalFor(...points);
  if (expected && normal.reduce((sum, n, i) => sum + n * expected[i], 0) < 0) {
    points = points.toReversed();
    normal = normalFor(...points);
  }
  if (Math.hypot(...normal) < 0.5) return;
  if (points.length === 3) out.addTriangle(slot, ref, points, normal, undefined, colors[tone]);
  else out.addQuad(slot, ref, points, normal, undefined, colors[tone]);
}
function flat(out, slot, tone, ring, height, normal = up) {
  const indices = earcut(ring.flat());
  for (let i = 0; i < indices.length; i += 3) {
    face(
      out,
      slot,
      tone,
      indices
        .slice(i, i + 3)
        .map((j) => [ring[j][0], Array.isArray(height) ? height[j] : height, ring[j][1]]),
      normal,
    );
  }
}
function walls(ring) {
  const sign = Math.sign(
    ring.reduce((v, [x, z], i) => {
      const [a, b] = ring[(i + 1) % ring.length];
      return v + x * b - z * a;
    }, 0),
  );
  return ring
    .map(([x, z], i) => {
      const j = (i + 1) % ring.length,
        [a, b] = ring[j],
        length = Math.hypot(a - x, b - z);
      const normal = [(sign * (b - z)) / length, 0, (sign * (x - a)) / length];
      return {
        i,
        j,
        length,
        normal,
        point: (u, y, d = 0) => [mix(x, a, u) + d * normal[0], y, mix(z, b, u) + d * normal[2]],
      };
    })
    .filter((s) => s.length > 0.06);
}
function ringAt(r, y) {
  return r.map(([x, z]) => [x, y, z]);
}
function square(x, z, w, d) {
  return [
    [x - w / 2, z - d / 2],
    [x - w / 2, z + d / 2],
    [x + w / 2, z + d / 2],
    [x + w / 2, z - d / 2],
  ];
}
function box(out, slot, tone, x, z, w, d, a, b) {
  loft(out, slot, [ringAt(square(x, z, w, d), a), ringAt(square(x, z, w, d), b)], colors[tone]);
}
function belt(out, side, y, height, tone = 'sand', depth = 0.1) {
  const { point: p, normal: n } = side;
  face(
    out,
    'stone',
    tone,
    [p(0, y, depth), p(1, y, depth), p(1, y + height, depth), p(0, y + height, depth)],
    n,
  );
}
function band(out, slot, tone, a, b, axis, width, normal) {
  const shift = (p, s) => p.map((v, i) => v + axis[i] * width * s * 0.5);
  face(out, slot, tone, [shift(a, -1), shift(b, -1), shift(b, 1), shift(a, 1)], normal);
}
function archShape(u, head, rise, pointed) {
  return head + rise * (pointed ? Math.pow(1 - Math.abs(u * 2 - 1), 0.69) : Math.sin(u * Math.PI));
}
function archInset(
  out,
  side,
  u,
  w,
  y,
  h,
  tier,
  { pointed = true, trim = true, glass = true, depth = 0.1 } = {},
) {
  const { point: p, normal: n } = side,
    a = u - w / 2,
    b = u + w / 2,
    head = y + h * 0.7,
    rise = h * 0.3;
  const slot = glass && tier >= 2 ? 'glass' : 'steel',
    tone = glass && tier >= 2 ? 'glass' : 'shadow';
  const segments = [2, 2, 3, 6, 10][tier];
  face(out, slot, tone, [p(a, y, depth), p(b, y, depth), p(b, head, depth), p(a, head, depth)], n);
  const crown = Array.from({ length: segments + 1 }, (_, i) => {
    const v = i / segments;
    return p(mix(a, b, v), archShape(v, head, rise, pointed), depth);
  });
  for (let i = 1; i < crown.length - 1; i++)
    face(out, slot, tone, [crown[0], crown[i], crown[i + 1]], n);
  if (trim && tier >= 3)
    for (let i = 0; i < segments; i++) {
      const f = i / segments,
        t = (i + 1) / segments,
        ax = mix(a, b, f),
        bx = mix(a, b, t),
        top = archShape(f, head, rise, pointed),
        end = archShape(t, head, rise, pointed),
        rim = 0.16 / side.length,
        z = depth + 0.08;
      face(
        out,
        'stone',
        'sand',
        [
          p(ax, top, z),
          p(bx, end, z),
          p(bx + rim * (2 * t - 1), end + 0.2, z),
          p(ax + rim * (2 * f - 1), top + 0.2, z),
        ],
        n,
      );
    }
  if (trim && tier >= 2) {
    const rim = 0.13 / side.length;
    for (const s of [-1, 1]) {
      const x = s < 0 ? a : b;
      face(
        out,
        'stone',
        'sand',
        [
          p(x, y, depth + 0.08),
          p(x + s * rim, y, depth + 0.08),
          p(x + s * rim, head + 0.13, depth + 0.08),
          p(x, head, depth + 0.08),
        ],
        n,
      );
    }
    if (tier >= 3) {
      face(
        out,
        'stone',
        'sand',
        [
          p(a - rim, y - 0.17, depth + 0.1),
          p(b + rim, y - 0.17, depth + 0.1),
          p(b + rim, y - 0.02, depth + 0.1),
          p(a - rim, y - 0.02, depth + 0.1),
        ],
        n,
      );
      const bar = 0.046 / side.length;
      face(
        out,
        'steel',
        'iron',
        [
          p(u - bar, y, depth + 0.06),
          p(u + bar, y, depth + 0.06),
          p(u + bar, head + h * 0.15, depth + 0.06),
          p(u - bar, head + h * 0.15, depth + 0.06),
        ],
        n,
      );
    }
  }
}
function railDeck(out, tier) {
  for (const b of layout.stationDeck) {
    flat(out, 'concrete', 'deck', b.ring, layout.deckY);
    for (const side of walls(b.ring)) {
      const { i, j, length, normal: n, point: p } = side,
        base = b.base[i],
        end = b.base[j];
      const north0 = p(0, 0)[0],
        north1 = p(1, 0)[0],
        portal = -212;
      const split = (portal - north0) / (north1 - north0);
      const sections =
        split > 0 && split < 1
          ? [
              [0, split],
              [split, 1],
            ]
          : [[0, 1]];
      for (const [u, v] of sections) {
        const openRoad = mix(north0, north1, (u + v) / 2) < portal,
          low = layout.deckY - 0.96;
        face(
          out,
          'brick',
          'darkBrick',
          [
            p(u, openRoad ? low : mix(base, end, u)),
            p(v, openRoad ? low : mix(base, end, v)),
            p(v, layout.deckY),
            p(u, layout.deckY),
          ],
          n,
        );
      }
      if (!tier || length < 2.8 || Math.min(north0, north1) < portal) continue;
      belt(out, side, layout.deckY - 0.32, 0.25, 'stone');
      const count = Math.floor(length / [18, 18, 13, 9.5, 6.85][tier]);
      for (let k = 0; k < count; k++) {
        const u = (k + 0.5) / count,
          floor = Math.max(0.12, mix(base, end, u) + 0.83);
        if (floor > 2.3) continue;
        archInset(out, side, u, 0.62 / count, floor, 4.15 - floor, tier, {
          pointed: false,
          glass: false,
          trim: tier === 4,
        });
      }
    }
  }
  for (const { ring, heights, patches } of layout.apron) {
    for (const patch of patches) {
      flat(out, 'concrete', 'deck', patch.ring, patch.heights);
      flat(
        out,
        'concrete',
        'deck',
        patch.ring,
        patch.heights.map((h) => h - 0.68),
        down,
      );
    }
    for (const { i, j, normal: n, point: p } of walls(ring))
      face(
        out,
        'concrete',
        'stone',
        [p(0, heights[i] - 0.68), p(1, heights[j] - 0.68), p(1, heights[j]), p(0, heights[i])],
        n,
      );
  }
  for (const { ring, levels } of layout.platforms) {
    flat(out, 'concrete', 'deck', ring, levels);
    if (!tier) continue;
    for (const { i, j, normal: n, point: p } of walls(ring)) {
      face(
        out,
        'concrete',
        'stone',
        [p(0, levels[i] - 0.97), p(1, levels[j] - 0.97), p(1, levels[j]), p(0, levels[i])],
        n,
      );
      if (tier >= 2)
        face(
          out,
          'stone',
          'edge',
          [
            p(0, levels[i] + 0.014),
            p(1, levels[j] + 0.014),
            p(1, levels[j] + 0.014, -0.19),
            p(0, levels[i] + 0.014, -0.19),
          ],
          up,
        );
    }
  }
}
function track(out, route, tier) {
  if (!tier) return;
  const stride = [1, 9, 5, 3, 2][tier],
    points = route.filter((_, i) => i % stride === 0 || i === route.length - 1);
  const offset = ([x, y, z], dz, dy) => [x, y + dy, z + dz];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1],
      b = points[i];
    face(
      out,
      'concrete',
      'ballast',
      [
        offset(a, -1.17, -0.07),
        offset(b, -1.17, -0.07),
        offset(b, 1.17, -0.07),
        offset(a, 1.17, -0.07),
      ],
      up,
    );
    if (tier < 2) continue;
    for (const dz of [-0.718, 0.718]) {
      const p = offset(a, dz, 0.055),
        q = offset(b, dz, 0.055);
      band(out, 'steel', 'rail', p, q, [0, 0, 1], tier === 2 ? 0.14 : 0.082, up);
      if (tier >= 3)
        face(out, 'steel', 'rail', [p, q, offset(b, dz, -0.058), offset(a, dz, -0.058)], [0, 0, 1]);
    }
    if (tier < 3) continue;
    const n = Math.ceil(Math.hypot(b[0] - a[0], b[2] - a[2]) / (tier === 4 ? 0.72 : 1.26));
    for (let j = 0; j < n; j++) {
      const p = lerp(a, b, (j + 0.5) / n);
      band(
        out,
        'wood',
        'tie',
        offset(p, -1.15, -0.035),
        offset(p, 1.15, -0.035),
        [1, 0, 0],
        0.22,
        up,
      );
    }
  }
  if (tier >= 2) {
    const [x, y, z] = route.at(-1);
    rod(out, 'steel', 'iron', [x, y + 0.8, z - 0.88], [x, y + 0.8, z + 0.88], 0.21, 0.27);
  }
}
function northExtension(out, tier) {
  const y = layout.modernY;
  for (const ring of layout.modern) {
    flat(out, 'slate', 'zinc', ring, y);
    flat(out, 'slate', 'slateLight', ring, y - 0.29, down);
    for (const side of walls(ring)) {
      const { point: p, normal: n, length } = side;
      face(out, 'steel', 'zinc', [p(0, y - 1.15), p(1, y - 1.15), p(1, y), p(0, y)], n);
      if (!tier || length < 2) continue;
      face(
        out,
        'glass',
        'glass',
        [p(0, y - 1.83, 0.03), p(1, y - 1.83, 0.03), p(1, y - 1.18, 0.03), p(0, y - 1.18, 0.03)],
        n,
      );
      if (tier < 3) continue;
      for (let j = 1; j < length / 3.8; j++)
        rod(
          out,
          'steel',
          'lightIron',
          p((j * 3.8) / length, y - 1.85, 0.04),
          p((j * 3.8) / length, y - 1.17, 0.04),
          0.093,
        );
    }
  }
  if (!tier) return;
  for (const [i, ring] of layout.skylights.entries()) {
    if (tier === 1 && i % 2) continue;
    flat(out, 'glass', 'glass', ring, y + 0.105);
    if (tier < 2) continue;
    for (const { point: p, length, normal: n } of walls(ring))
      if (length > 7) {
        face(
          out,
          'steel',
          'zinc',
          [p(0, y, 0.03), p(1, y, 0.03), p(1, y + 0.2, 0.03), p(0, y + 0.2, 0.03)],
          n,
        );
      }
  }
  for (const [i, [x, z]] of layout.northPosts.entries()) {
    if ((tier === 1 && i % 3) || (tier === 2 && i % 2)) continue;
    rod(
      out,
      'steel',
      'lightIron',
      [x, layout.platformY - 0.2, z],
      [x, y - 0.15, z],
      tier === 1 ? 0.58 : 0.42,
    );
    if (tier >= 3)
      for (const side of [-1, 1])
        rod(out, 'steel', 'lightIron', [x, y - 1.8, z], [x, y - 0.29, z + side * 1.72], 0.22);
  }
}
function shedPoint(x, t, offset = 0) {
  const { x0, x1, north, south, eave, rise } = layout.shed,
    f = (x - x0) / (x1 - x0);
  const [a, b] = lerp(north, south, f);
  return [
    x,
    eave + rise * Math.sin(Math.PI * t) + offset,
    mix(a, b, (1 - Math.cos(Math.PI * t)) * 0.5),
  ];
}
function gable(out, x, tier, div, side) {
  const n = [side, 0, 0],
    y = layout.shed.eave - 1.86;
  for (let i = 0; i < div; i++) {
    const a = shedPoint(x, i / div, -0.12),
      b = shedPoint(x, (i + 1) / div, -0.12);
    const p = [[x, y, a[2]], [x, y, b[2]], b, a];
    face(out, tier ? 'glass' : 'slate', tier ? 'glass' : 'slate', p, n);
    if (tier)
      face(
        out,
        'glass',
        'glass',
        p.map(([x, y, z]) => [x - side * 0.11, y, z]),
        [-side, 0, 0],
      );
  }
  if (!tier) return;
  const z0 = shedPoint(x, 0)[2],
    z1 = shedPoint(x, 1)[2],
    width = z1 - z0,
    X = x + side * 0.14;
  for (const h of [y, y + 3.5, y + 7.2]) {
    const r = Math.min(0.99, Math.max(0, (h - layout.shed.eave) / layout.shed.rise)),
      half = (width * Math.sqrt(1 - r * r)) / 2,
      z = (z0 + z1) / 2;
    rod(out, 'steel', 'iron', [X, h, z - half], [X, h, z + half], 0.2, 0.24);
  }
  const count = Math.ceil(
    width / (tier === 4 ? 1.09 : tier === 3 ? 1.85 : tier === 2 ? 3.35 : 6.2),
  );
  for (let i = 1; i < count; i++) {
    const t = i / count,
      z = mix(z0, z1, t),
      top = layout.shed.eave + layout.shed.rise * Math.sqrt(1 - Math.pow(2 * t - 1, 2));
    band(
      out,
      'steel',
      'lightIron',
      [X, y, z],
      [X, top - 0.16, z],
      [0, 0, 1],
      tier === 1 ? 0.24 : 0.14,
      n,
    );
  }
}
function barlowShed(out, tier) {
  const { x0, x1, eave } = layout.shed,
    div = [10, 14, 20, 32, 48][tier];
  for (let i = 0; i < div; i++) {
    const a = i / div,
      b = (i + 1) / div,
      glaze = (a + b) / 2 > 0.29 && (a + b) / 2 < 0.71;
    const skin = (y) => [
      shedPoint(x0, a, y),
      shedPoint(x1, a, y),
      shedPoint(x1, b, y),
      shedPoint(x0, b, y),
    ];
    const slot = glaze && tier ? 'roofLight' : 'slate',
      tone = glaze ? 'glass' : 'slate';
    face(out, slot, tone, skin(0), up);
    face(out, slot, glaze ? 'glass' : 'slateLight', skin(-0.16), down);
    if (tier >= 2 && i % 2 === 0) {
      band(
        out,
        'steel',
        'lightIron',
        shedPoint(x0, a, 0.04),
        shedPoint(x1, a, 0.04),
        [0, 0, 1],
        0.128,
        up,
      );
      band(
        out,
        'steel',
        'iron',
        shedPoint(x0, a, -0.2),
        shedPoint(x1, a, -0.2),
        [0, 0, 1],
        0.133,
        down,
      );
    }
  }
  gable(out, x0, tier, div, -1);
  gable(out, x1, tier, div, 1);
  if (!tier) return;
  const ribs = [0, 11, 18, 29, 43][tier],
    steps = tier < 3 ? div : Math.min(div, tier === 4 ? 32 : 23);
  for (let j = 0; j < ribs; j++) {
    const x = mix(x0 + 0.35, x1 - 0.35, j / (ribs - 1));
    for (let i = 0; i < steps; i++) {
      const a = i / steps,
        b = (i + 1) / steps,
        p = shedPoint(x, a, -0.39),
        q = shedPoint(x, b, -0.39);
      if (tier >= 3) {
        rod(out, 'steel', 'lightIron', p, q, 0.16, 0.16);
        const lower = shedPoint(x, a, -0.87),
          end = shedPoint(x, b, -0.87);
        if (tier === 4 || j % 2 === 0) {
          rod(out, 'steel', 'iron', lower, end, 0.12, 0.12);
          rod(out, 'steel', 'iron', i % 2 ? p : lower, i % 2 ? end : q, 0.079);
        }
      } else band(out, 'steel', 'lightIron', p, q, [1, 0, 0], 0.2, down);
    }
    if (tier >= 3)
      for (const edge of [0, 1]) {
        const [, , z] = shedPoint(x, edge, -0.86);
        rod(out, 'steel', 'iron', [x, eave - 4.25, z], [x, eave - 0.62, z], 0.29, 0.26);
      }
  }
}
function historicWalls(out, tier) {
  for (const { a, b, side } of layout.brickSides) {
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]),
      normal = [0, 0, side];
    const point = (t, y, d = 0) => [mix(a[0], b[0], t), y, mix(a[1], b[1], t) + d * side];
    const base = layout.deckY - 0.04,
      top = layout.shed.eave;
    for (const n of [normal, [0, 0, -side]])
      face(
        out,
        'brick',
        'brick',
        [point(0, base), point(1, base), point(1, top), point(0, top)],
        n,
      );
    if (!tier) continue;
    const segment = { point, normal, length };
    belt(out, segment, top - 0.49, 0.22, 'sand');
    belt(out, segment, base + 1.03, 0.17, 'stone');
    const count = Math.ceil(length / [15, 14, 8.1, 6.6, 5.9][tier]);
    for (let i = 0; i < count; i++) {
      const u = (i + 0.5) / count,
        y = base + 1.47;
      archInset(out, segment, u, 0.58 / count, y, 5.32, tier, { pointed: false, trim: tier >= 3 });
      if (tier >= 3 || (tier === 2 && i % 2 === 0)) {
        const t = i / count,
          [x, , z] = point(t, base, 0.32);
        box(out, 'brick', 'brickLight', x, z, 1.04, 1.02, base, top + 0.9);
        box(out, 'stone', 'sand', x, z, 1.24, 1.18, top + 0.84, top + 1.03);
      }
    }
  }
  for (const wing of layout.wingSections) {
    const top = 10.84;
    flat(out, 'slate', 'slateLight', wing.ring, top);
    for (const { normal: n, point: p } of walls(wing.ring))
      face(
        out,
        'brick',
        'brick',
        [p(0, layout.deckY - 0.025), p(1, layout.deckY - 0.025), p(1, top), p(0, top)],
        n,
      );
  }
  for (const { ring } of layout.elevators) {
    const top = layout.platformY + 3.1;
    flat(out, 'steel', 'zinc', ring, top);
    for (const { normal: n, point: p } of walls(ring))
      face(
        out,
        tier ? 'glass' : 'steel',
        'glass',
        [p(0, layout.deckY), p(1, layout.deckY), p(1, top), p(0, top)],
        n,
      );
  }
}
const hotelEave = 25.9;
function hotelRoof(out, { ring, rise }, tier) {
  const center = [0, 1].map((i) => ring.reduce((n, p) => n + p[i], 0) / ring.length);
  const ridge = ring.map((p) => p.map((v, i) => mix(v, center[i], i === 0 ? 0.68 : 0.48)));
  for (let i = 0; i < ring.length; i++) {
    const j = (i + 1) % ring.length;
    face(
      out,
      'slate',
      'slate',
      [...ringAt([ring[i], ring[j]], hotelEave), ...ringAt([ridge[j], ridge[i]], hotelEave + rise)],
      up,
    );
  }
  flat(out, 'slate', 'slateLight', ridge, hotelEave + rise);
  if (tier >= 2)
    for (const side of walls(ring)) {
      if (side.length < 7.5) continue;
      const [x, , z] = side.point(0.5, 0, -1.85);
      box(
        out,
        'brick',
        'darkBrick',
        x,
        z,
        1.4,
        1.52,
        hotelEave + rise * 0.65,
        hotelEave + rise + 1.38,
      );
      box(out, 'stone', 'sand', x, z, 1.62, 1.75, hotelEave + rise + 1.26, hotelEave + rise + 1.48);
    }
}
function dormer(out, side, t, u) {
  const { point: p, normal: n, length } = side,
    y = hotelEave - 0.19,
    w = (t === 2 ? 1.18 : 0.92) / length;
  const a = p(u - w, y, 0.31),
    b = p(u + w, y, 0.31),
    c = p(u, y + 3.82, 0.22),
    d = p(u, y + 3.88, -2.35);
  face(out, 'brick', 'brickLight', [a, b, c], n);
  face(out, 'slate', 'slate', [a, c, d], up);
  face(out, 'slate', 'slate', [b, c, d], up);
  face(
    out,
    'steel',
    'shadow',
    [p(u - w * 0.46, y + 0.53, 0.34), p(u + w * 0.46, y + 0.53, 0.34), p(u, y + 2.71, 0.28)],
    n,
  );
  if (t >= 3) rod(out, 'stone', 'sand', c, p(u, y + 4.18, 0.22), 0.21);
}
function entrance(out, side, base, end, tier) {
  const { point: p, normal: n, length } = side,
    mid = 0.52,
    w = 3.58 / length,
    a = mid - w,
    b = mid + w;
  const floor = mix(base, end, mid) + 0.85,
    spring = floor + 5.15,
    rise = 2.72,
    segments = tier >= 3 ? 10 : 4;
  const jamb = (u, v) =>
    face(
      out,
      'brick',
      'brick',
      [p(u, mix(base, end, u)), p(v, mix(base, end, v)), p(v, hotelEave), p(u, hotelEave)],
      n,
    );
  jamb(0, a);
  jamb(b, 1);
  const arch = (u) => archShape(u, spring, rise, true);
  for (let i = 0; i < segments; i++) {
    const u = i / segments,
      v = (i + 1) / segments,
      x = mix(a, b, u),
      z = mix(a, b, v),
      y = arch(u),
      h = arch(v);
    face(out, 'brick', 'brick', [p(x, y), p(z, h), p(z, hotelEave), p(x, hotelEave)], n);
    face(
      out,
      'stone',
      'sand',
      [p(x, y, 0.35), p(z, h, 0.35), p(z, h, -2.05), p(x, y, -2.05)],
      down,
    );
    if (tier)
      face(
        out,
        'stone',
        'sand',
        [
          p(x, y, 0.38),
          p(z, h, 0.38),
          p(z + (2 * v - 1) * 0.012, h + 0.43, 0.42),
          p(x + (2 * u - 1) * 0.012, y + 0.43, 0.42),
        ],
        n,
      );
  }
  for (const [u, sideSign] of [
    [a, -1],
    [b, 1],
  ]) {
    face(
      out,
      'stone',
      'sand',
      [p(u, floor, 0.35), p(u, floor, -2.05), p(u, spring, -2.05), p(u, spring, 0.35)],
      [-sideSign * n[2], 0, sideSign * n[0]],
    );
    if (tier) {
      const v = u + (sideSign * 0.5) / length;
      face(
        out,
        'stone',
        'sand',
        [p(u, floor, 0.37), p(v, floor, 0.37), p(v, spring + 0.35, 0.37), p(u, spring, 0.37)],
        n,
      );
    }
  }
  face(
    out,
    'stone',
    'stone',
    [p(a, floor, 0.35), p(b, floor, 0.35), p(b, floor, -2.06), p(a, floor, -2.06)],
    up,
  );
  face(
    out,
    'brick',
    'darkBrick',
    [
      p(a, floor, -2.07),
      p(b, floor, -2.07),
      p(b, spring + rise, -2.07),
      p(a, spring + rise, -2.07),
    ],
    n,
  );
  if (tier >= 2) {
    const door = (u, y) => p(u, y, -2.02);
    face(
      out,
      'steel',
      'shadow',
      [
        door(mid - 0.03, floor + 0.08),
        door(mid + 0.03, floor + 0.08),
        door(mid + 0.03, floor + 4.77),
        door(mid - 0.03, floor + 4.77),
      ],
      n,
    );
    rod(
      out,
      'stone',
      'sand',
      p(a - 0.012, spring + rise + 0.82, 0.42),
      p(b + 0.012, spring + rise + 0.82, 0.42),
      0.33,
      0.28,
    );
  }
  return [a - 0.022, b + 0.022];
}
function hotelWalls(out, { ring, base }, tier) {
  flat(out, 'slate', 'slateLight', ring, hotelEave - 0.04);
  for (const side of walls(ring)) {
    const { i, j, length, point: p, normal: n } = side;
    const [x, , z] = p(0.5, 0),
      hasEntrance = n[0] > 0.82 && x > 243 && x < 249 && z > -26 && z < -2 && length > 27;
    const opening = hasEntrance ? entrance(out, side, base[i], base[j], tier) : undefined;
    if (!opening)
      face(
        out,
        'brick',
        'brick',
        [p(0, base[i]), p(1, base[j]), p(1, hotelEave), p(0, hotelEave)],
        n,
      );
    if (!tier || length < 2.7) continue;
    for (const y of [2.12, 7.01, 12.22, 17.48, 22.3, 25.22])
      if (!opening || y > 9.2) belt(out, side, y, y > 24 ? 0.43 : 0.14);
    const count = Math.max(1, Math.round(length / [12, 11.8, 6.2, 5.05, 4.76][tier]));
    for (let j = 0; j < count; j++) {
      const u = (j + 0.5) / count;
      const ys = tier === 1 ? [5.0, 11.1, 18.5] : [3.2, 8.11, 13.4, 18.4, 22.74];
      for (const [row, y] of ys.entries()) {
        const h = row === 4 ? 2.04 : 3.51,
          w = (row === 0 ? 0.59 : 0.48) / count;
        if (opening && y < 9 && u + w * 0.5 > opening[0] && u - w * 0.5 < opening[1]) continue;
        archInset(out, side, u, w, y, h, tier, { trim: tier >= 3, pointed: row > 0 });
      }
      if (tier >= 2 && length >= 8.4 && j % 2 === 0) dormer(out, side, tier, u);
      if (tier >= 3 && j > 0 && (!opening || j / count < opening[0] || j / count > opening[1])) {
        const z = j / count;
        rod(out, 'stone', 'sand', p(z, 2.03, 0.13), p(z, 22.2, 0.13), 0.125);
      }
    }
  }
}
function clockDial(out, x, y, z, normal, tier) {
  const u = [normal[2], 0, -normal[0]],
    p = (a, b, d = 0) => [x + u[0] * a + d * normal[0], y + b, z + u[2] * a + d * normal[2]];
  const n = tier === 0 ? 10 : tier <= 2 ? 16 : 28;
  for (let i = 0; i < n; i++) {
    const a = (2 * Math.PI * i) / n,
      b = (2 * Math.PI * (i + 1)) / n;
    const v = (angle, r, d) => p(Math.cos(angle) * r, Math.sin(angle) * r, d);
    face(out, 'stone', 'clock', [p(0, 0, 0.053), v(a, 1.57, 0.053), v(b, 1.57, 0.053)], normal);
    if (tier)
      face(
        out,
        'steel',
        'gold',
        [v(a, 1.57, 0.054), v(b, 1.57, 0.054), v(b, 1.82, 0.054), v(a, 1.82, 0.054)],
        normal,
      );
  }
  if (!tier) return;
  for (const q of [p(0.56, 0.55, 0.12), p(-0.36, 1.08, 0.12)])
    rod(out, 'steel', 'shadow', p(0, 0, 0.12), q, 0.105);
  if (tier >= 3)
    for (let i = 0; i < 12; i++) {
      const t = (i * Math.PI) / 6,
        p0 = p(1.33 * Math.cos(t), 1.33 * Math.sin(t), 0.118),
        p1 = p(1.45 * Math.cos(t), 1.45 * Math.sin(t), 0.118);
      rod(out, 'steel', 'shadow', p0, p1, 0.074);
    }
}
function tower(out, t, tier) {
  const { x, z, w, d, base, shoulder, lantern, spire, clock } = t;
  box(out, 'brick', 'brickLight', x, z, w, d, base, shoulder);
  box(out, 'stone', 'sand', x, z, w + 0.52, d + 0.52, shoulder - 0.34, shoulder + 0.18);
  box(out, 'brick', 'darkBrick', x, z, w * 0.73, d * 0.74, shoulder, lantern);
  box(out, 'stone', 'sand', x, z, w * 0.82, d * 0.83, lantern - 0.22, lantern + 0.14);
  for (const side of walls(square(x, z, w, d))) {
    if (tier) {
      for (const y of [12.25, 17.5, 22.28, 28.3, shoulder - 3.3])
        if (y + 2.5 < shoulder)
          archInset(out, side, 0.5, 0.35, y, 2.91, tier, { pointed: true, trim: tier >= 3 });
      for (const y of [7.05, 17.4, 25.23, shoulder - 1.3]) belt(out, side, y, 0.19);
    }
    if (clock && (side.normal[0] > 0.5 || side.normal[2] < -0.5)) {
      const [a, b, c] = side.point(0.5, shoulder - 4.36, 0.165);
      clockDial(out, a, b, c, side.normal, tier);
    }
  }
  const n = tier === 0 ? 4 : 8;
  const spireRings = [
    radialRing(lantern, w * 0.43, d * 0.43, n, [x, z]),
    radialRing(lantern + (spire - lantern) * 0.61, w * 0.145, d * 0.145, n, [x, z]),
    radialRing(spire, 0.06, 0.06, n, [x, z]),
  ];
  loft(out, 'slate', spireRings, colors.slate);
  if (tier >= 2) {
    rod(out, 'steel', 'gold', [x, spire - 0.15, z], [x, spire + 0.83, z], 0.095);
    for (const sx of [-1, 1])
      for (const sz of [-1, 1]) {
        const a = x + sx * w * 0.42,
          b = z + sz * d * 0.42,
          base = shoulder - 1.11,
          crown = lantern + 0.89;
        loft(
          out,
          'brick',
          [
            radialRing(base, 0.87, 0.87, 6, [a, b]),
            radialRing(crown - 0.97, 0.79, 0.79, 6, [a, b]),
          ],
          colors.brickLight,
        );
        loft(
          out,
          'slate',
          [
            radialRing(crown - 0.97, 0.94, 0.94, 6, [a, b]),
            radialRing(crown + 1.68, 0.035, 0.035, 6, [a, b]),
          ],
          colors.slate,
        );
      }
  }
}
export function buildStPancrasLevel(out, level) {
  const tier = levels[level];
  if (tier === undefined) throw Error(`Unknown St Pancras detail level ${level}`);
  railDeck(out, tier);
  for (const route of layout.tracks) track(out, route, tier);
  northExtension(out, tier);
  historicWalls(out, tier);
  barlowShed(out, tier);
  for (const h of layout.hotelBodies) hotelWalls(out, h, tier);
  for (const roof of layout.hotelRoofs) hotelRoof(out, roof, tier);
  for (const t of layout.towers) tower(out, t, tier);
}
export const buildStPancrasSkyline = (out) => buildStPancrasLevel(out, 'skyline');
export const buildStPancrasDistrict = (out) => buildStPancrasLevel(out, 'district');
export const buildStPancrasStreet = (out) => buildStPancrasLevel(out, 'street');
export const buildStPancrasCloseup = (out) => buildStPancrasLevel(out, 'closeup');
