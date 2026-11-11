/** Bayterek’s tower, golden sphere, plaza plinth and two mapped stair flights. */
import { readFileSync } from 'node:fs';
import {
  beam,
  beamPath,
  loft,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';

export const layout = JSON.parse(readFileSync(new URL('../layout.json', import.meta.url)));
export const towerSurfaces = {
  paving: { slot: 'foundation', graph: 'stone_granite' },
  plinth: { slot: 'wall', graph: 'stone_limestone_raw' },
  steel: { slot: 'trim', graph: 'metal_painted' },
  gold: { slot: 'trim', graph: 'metal_stainless_polished', metallic: 0.88, roughness: 0.14 },
};
const levels = { skyline: 0, district: 1, street: 2, closeup: 3, master: 4 };
const colors = {
  stone: 'beb7aa',
  tread: 'bcb4a7',
  riser: 'a39a8d',
  joint: '928c83',
  wall: '8f6f5e',
  plinth: 'a5836a',
  cap: 'c6b7a3',
  steel: 'e8e8e1',
  steelShade: 'bec4c6',
  steelTrim: 'd6dbdc',
  glass: '59777c',
  glassDark: '496065',
  glassCool: '5d7f88',
  goldPale: 'f0d581',
  gold: 'e9c569',
  gold2: 'dfba5f',
  gold3: 'dfc171',
  upperGold: 'd2bf76',
  upperGold2: 'd8c680',
  goldBand: 'f3dca2',
  seam: '8d7f48',
  mast: '737e80',
  red: 'ab463a',
};
const C = Object.fromEntries(
  Object.entries(colors).map(([name, hex]) => [
    name,
    hex.match(/../g).map((pair) => {
      const s = parseInt(pair, 16) / 255;
      return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    }),
  ]),
);
const ref = 'palette:#ffffff',
  TAU = Math.PI * 2;
const mix = (a, b, t) => a + (b - a) * t;
const lerp = (a, b, t) => a.map((v, i) => mix(v, b[i], t));
const [cx, cz] = layout.center;
const polar = (r, y, a) => [cx + r * Math.cos(a), y, cz + r * Math.sin(a)];
const around = (n) => Array.from({ length: n }, (_, i) => (TAU * i) / n);
const radial = ([x, , z]) => [x - cx, 0, z - cz];
function face(out, slot, tone, points, normal) {
  if (normalFor(...points).reduce((s, v, i) => s + v * normal[i], 0) < 0)
    points = points.toReversed();
  const tris =
    points.length === 3 ? [points] : [points.slice(0, 3), [points[0], points[2], points[3]]];
  for (const p of tris) out.addTriangle(slot, ref, p, normalFor(...p), undefined, C[tone]);
}
function disk(out, slot, tone, r, y, n) {
  for (const a of around(n))
    face(out, slot, tone, [[cx, y, cz], polar(r, y, a), polar(r, y, a + TAU / n)], [0, 1, 0]);
}
function roundWall(out, slot, tone, r0, y0, r1, y1, n) {
  for (const a of around(n)) {
    const b = a + TAU / n,
      p = polar(r0, y0, a);
    face(out, slot, tone, [p, polar(r0, y0, b), polar(r1, y1, b), polar(r1, y1, a)], radial(p));
  }
}
function annulus(out, slot, tone, r0, r1, y, n) {
  for (const a of around(n)) {
    const b = a + TAU / n;
    face(
      out,
      slot,
      tone,
      [polar(r0, y, a), polar(r1, y, a), polar(r1, y, b), polar(r0, y, b)],
      [0, 1, 0],
    );
  }
}
function roundRail(out, slot, tone, r, y, n, width, depth) {
  beamPath(
    out,
    slot,
    around(n).map((a) => polar(r, y, a)),
    width,
    depth,
    C[tone],
    true,
  );
}

function steps(out, s, tier) {
  const count = tier ? s.risers : Math.min(s.risers, 5);
  const y = (across) =>
    across < 0
      ? mix(s.footHeights[0], s.footHeights[1], across + 1)
      : mix(s.footHeights[1], s.footHeights[2], across);
  const foot = (t, side, rise) => {
    const z = mix(s.bottomWidth, s.topWidth, t) * side * 0.5;
    const [x, zz] = lerp(s.foot, s.top, t);
    return [x + s.across[0] * z, rise, zz + s.across[1] * z];
  };
  // Keep the first tread above the viewer's thin native path overlay.
  const tread = (i, side) => mix(y(side) + 0.11, s.topY - 0.005, i / (count - 1));
  for (let i = 0; i < count; i++) {
    const a = i / count,
      b = (i + 1) / count,
      l = tread(i, -1),
      r = tread(i, 1);
    face(
      out,
      'paving',
      'tread',
      [foot(a, -1, l), foot(b, -1, l), foot(b, 1, r), foot(a, 1, r)],
      [0, 1, 0],
    );
    const lower = (side) => (i > 0 ? tread(i - 1, side) : y(side) - 0.07);
    face(
      out,
      'paving',
      'riser',
      [foot(a, -1, lower(-1)), foot(a, 1, lower(1)), foot(a, 1, r), foot(a, -1, l)],
      [-s.dir[0], 0, -s.dir[1]],
    );
    for (const side of [-1, 1]) {
      const v = tread(i, side);
      face(
        out,
        'plinth',
        'plinth',
        [
          foot(a, side, layout.groundBottom),
          foot(b, side, layout.groundBottom),
          foot(b, side, v),
          foot(a, side, v),
        ],
        [s.across[0] * side, 0, s.across[1] * side],
      );
    }
    if (tier >= 3 && i > 0) {
      const l = foot(a + 0.003, -1, tread(i, -1) + 0.012),
        r = foot(a + 0.003, 1, tread(i, 1) + 0.012);
      beam(out, 'paving', l, r, 0.066, 0.021, C.joint);
    }
  }
  if (tier >= 2)
    for (const side of [-1, 1]) {
      const a = foot(0.12, side, mix(y(side), s.topY, 0.12) + 0.19),
        b = foot(0.96, side, s.topY + 0.24);
      beam(out, 'plinth', a, b, 0.33, 0.25, C.cap);
    }
}

function pedestal(out, tier) {
  const { deckRadius: r, deckY: y, groundBottom: bottom, towerBaseY: base } = layout;
  const n = [16, 24, 40, 56, 64][tier];
  roundWall(out, 'plinth', 'wall', r - 0.08, bottom, r, y - 0.35, n);
  roundWall(out, 'plinth', 'cap', r, y - 0.35, r - 0.1, y, n);
  disk(out, 'paving', 'stone', r - 0.1, y, n);
  if (tier >= 1) {
    annulus(out, 'paving', 'joint', r - 0.49, r - 0.35, y + 0.012, n);
    annulus(out, 'paving', 'cap', 9.08, 9.26, y + 0.015, n);
  }
  const shoulder = tier === 0 ? 10 : 20;
  roundWall(out, 'plinth', 'wall', 6.82, y + 0.012, 6.71, base + 0.65, shoulder);
  roundWall(out, 'plinth', 'cap', 6.71, base + 0.65, 6.42, base + 0.87, shoulder);
  disk(out, 'plinth', 'plinth', 6.42, base + 0.87, shoulder);
  if (tier >= 2) {
    // The two recessed entry screens face the mapped axial approaches.
    for (const sign of [-1, 1]) {
      const z0 = cz - 1.49,
        z1 = cz + 1.49,
        x = cx + sign * 6.67;
      face(
        out,
        'steel',
        'glassDark',
        [
          [x, y + 0.06, z0],
          [x, y + 0.06, z1],
          [x, base + 0.54, z1],
          [x, base + 0.54, z0],
        ],
        [sign, 0, 0],
      );
      for (const dz of [-1.51, -0.49, 0.49, 1.51])
        beam(
          out,
          'steel',
          [x + sign * 0.03, y + 0.04, cz + dz],
          [x + sign * 0.03, base + 0.63, cz + dz],
          0.073,
          0.09,
          C.steelShade,
        );
    }
  }
  for (const s of layout.stairs) steps(out, s, tier);
}

function shaft(out, tier) {
  const n = tier ? 16 : 8,
    base = layout.towerBaseY;
  const use = tier ? layout.shaft : [layout.shaft[0], layout.shaft[3], layout.shaft.at(-1)];
  for (let i = 1; i < use.length; i++) {
    const [y, r] = use[i - 1],
      [h, s] = use[i];
    for (const [j, a] of around(n).entries()) {
      const b = a + TAU / n,
        p = polar(r, y + base, a),
        tone = (j + i) % 5 === 0 ? 'glassDark' : j % 4 === 0 ? 'glassCool' : 'glass';
      face(
        out,
        'steel',
        tone,
        [p, polar(r, y + base, b), polar(s, h + base, b), polar(s, h + base, a)],
        radial(p),
      );
    }
  }
  if (tier >= 2) {
    const panels = tier >= 3 ? 16 : 8;
    for (const a of around(panels))
      beamPath(
        out,
        'steel',
        use.map(([y, r]) => polar(r + 0.045, y + base, a)),
        0.08,
        0.07,
        C.steelTrim,
      );
    for (const [y, r] of use.slice(1, -1))
      roundRail(out, 'steel', 'steelShade', r + 0.065, y + base, n, 0.09, 0.1);
  }
}

function ribState(point, offset, table = layout.ribs) {
  const i = table.findIndex((row) => row[0] >= offset);
  const [a, b] =
    i <= 0
      ? i === 0
        ? [table[0], table[1]]
        : [table.at(-2), table.at(-1)]
      : [table[i - 1], table[i]];
  const v = Math.max(0, Math.min(1, (offset - a[0]) / (b[0] - a[0])));
  const radialScale = mix(a[1], b[1], v);
  return {
    center: [
      cx + (point[0] - cx) * radialScale,
      layout.towerBaseY + offset,
      cz + (point[1] - cz) * radialScale,
    ],
    width: mix(a[2], b[2], v),
  };
}
function leg(out, tip, tier) {
  const [x, z] = tip,
    angle = Math.atan2(z - cz, x - cx),
    c = Math.cos(angle),
    s = Math.sin(angle);
  const use =
    tier >= 2
      ? layout.ribs
      : tier === 1
        ? layout.ribs.filter((_, i) => i !== 2 && i !== 5)
        : [0, 3, 5, 7, 9].map((i) => layout.ribs[i]);
  const ring = ({ center: [x, y, z], width }, factor = 1) =>
    [
      [-1, -1],
      [-1, 1],
      [1, 1],
      [1, -1],
    ].map(([a, b]) => [
      x + factor * width * (c * a - s * b * 0.69) * 0.5,
      y,
      z + factor * width * (s * a + c * b * 0.69) * 0.5,
    ]);
  const rows = use.map(([offset]) => ring(ribState(tip, offset)));
  const contact = ring({ center: [x, layout.deckY + 0.016, z], width: tier ? 1.09 : 0.84 });
  loft(out, 'steel', [contact, ...rows], C.steel, { cap: false });
  if (tier >= 3) {
    const base = [x, layout.deckY + 0.026, z];
    for (const t of [-1, 1]) {
      const p = [base[0] - s * t * 0.42, base[1], base[2] + c * t * 0.42];
      beam(out, 'steel', p, [p[0], p[1] + 0.17, p[2]], 0.16, 0.13, C.mast);
    }
  }
}
function lattice(out, tier) {
  const tips = tier ? layout.tips : layout.tips.filter((_, i) => i % 2 === 0);
  for (const tip of tips) leg(out, tip, tier);
  const tied = tier >= 2 ? layout.ties : tier === 1 ? [35, 49, 61, 72, 80.5] : [42, 73];
  for (const y of tied) {
    const frame = tips.map((p) => ribState(p, y).center);
    beamPath(
      out,
      'steel',
      frame,
      tier >= 2 ? 0.19 : 0.23,
      tier >= 2 ? 0.19 : 0.24,
      C.steelTrim,
      true,
    );
  }
  if (tier) {
    const stages =
      tier === 1
        ? [
            [55, 67],
            [72, 80.5],
          ]
        : tier === 2
          ? [
              [28, 35],
              [42, 49],
              [49, 55],
              [61, 67],
              [67, 72],
              [72, 76],
              [76, 80.5],
            ]
          : layout.ties.slice(0, -1).map((y, i) => [y, layout.ties[i + 1]]);
    for (const [a, b] of stages) {
      for (let i = 0; i < tips.length; i++) {
        const first = tips[i],
          second = tips[(i + 1) % tips.length];
        if (tier !== 1 || i % 2 === 0)
          beam(
            out,
            'steel',
            ribState(first, a).center,
            ribState(second, b).center,
            tier === 1 ? 0.13 : 0.115,
            0.1,
            C.steelShade,
          );
        if (tier >= 2)
          beam(
            out,
            'steel',
            ribState(second, a).center,
            ribState(first, b).center,
            0.107,
            0.1,
            C.steelTrim,
          );
      }
    }
  }
  for (const [i, tip] of tips.entries()) {
    if (tier === 0 && i % 2 === 1) continue;
    const endpoint = ribState(tip, 92.4).center;
    const a = ribState(tip, 77).center;
    const middle = lerp(a, endpoint, 0.53);
    const angle = Math.atan2(tip[1] - cz, tip[0] - cx);
    const d = endpoint[0] - cx,
      e = endpoint[2] - cz,
      r = Math.hypot(d, e),
      shoulder = Math.hypot(a[0] - cx, a[2] - cz);
    const arms = tier >= 3 ? [-0.083, 0.083] : [i % 2 ? -0.077 : 0.077];
    for (const side of arms) {
      const arm = polar(shoulder - 0.42, a[1] - 0.95, angle + side);
      beam(out, 'steel', arm, endpoint, tier >= 2 ? 0.14 : 0.2, 0.15, C.steel);
      if (tier >= 2) {
        const q = lerp(arm, endpoint, 0.55);
        beam(out, 'steel', middle, q, 0.13, 0.12, C.steelTrim);
        if (tier >= 3)
          beam(
            out,
            'steel',
            lerp(arm, endpoint, 0.27),
            lerp(a, endpoint, 0.49),
            0.085,
            0.084,
            C.steelShade,
          );
      }
    }
    if (tier >= 3 && i % 2 === 0) {
      const a = polar(r, endpoint[1], angle),
        b = polar(r, endpoint[1] + 0.37, angle);
      beam(out, 'steel', a, b, 0.11, 0.11, C.red);
    }
  }
}

function crown(out, tier) {
  const y = layout.towerBaseY + 79.9,
    n = [12, 20, 28, 40, 48][tier];
  annulus(out, 'steel', 'steelShade', 6.1, 12.45, y, n);
  roundWall(out, 'steel', 'steelTrim', 12.45, y - 0.25, 12.45, y, n);
  if (tier) {
    roundRail(out, 'steel', 'steel', 12.31, y + 0.93, n, 0.1, 0.1);
    for (const a of around(tier >= 2 ? 24 : 12))
      beam(out, 'steel', polar(12.31, y, a), polar(12.31, y + 0.93, a), 0.078, 0.076, C.steelShade);
    if (tier >= 3) {
      roundRail(out, 'steel', 'steelTrim', 12.31, y + 0.53, n, 0.06, 0.068);
      for (const a of around(16))
        beam(
          out,
          'steel',
          polar(5.72, y - 2.3, a),
          polar(12.24, y - 0.18, a),
          0.15,
          0.17,
          C.steelShade,
        );
    }
  }
  roundWall(out, 'steel', 'steelShade', 5.55, y - 1.65, 6.4, y + 2.0, n);
}

function globe(out, tier) {
  const {
    center: [x, y, z],
    radius: r,
    roofY,
    mastY,
  } = layout.sphere;
  const meridians = [12, 24, 32, 40, 48][tier],
    latitudes = [7, 12, 14, 16, 20][tier];
  const phi = (i) => (Math.PI * i) / latitudes,
    theta = (j) => (TAU * j) / meridians;
  const point = (p, t, radius = r) => [
    x + radius * Math.sin(p) * Math.cos(t),
    y + radius * Math.cos(p),
    z + radius * Math.sin(p) * Math.sin(t),
  ];
  for (let i = 0; i < latitudes; i++)
    for (let j = 0; j < meridians; j++) {
      const a = phi(i),
        b = phi(i + 1),
        c = theta(j),
        d = theta(j + 1),
        tone =
          tier === 0
            ? 'gold'
            : i === Math.floor(latitudes * 0.5)
              ? 'goldBand'
              : i < latitudes * 0.45
                ? j % 5 === 1
                  ? 'upperGold2'
                  : 'upperGold'
                : ['gold', 'goldPale', 'gold2', 'gold', 'gold3'][(i * 2 + j * 3) % 5];
      const p = point(a, c),
        q = point(a, d),
        u = point(b, d),
        v = point(b, c);
      const points = i === 0 ? [p, u, v] : i === latitudes - 1 ? [p, q, u] : [p, q, u, v];
      face(
        out,
        'gold',
        tone,
        points,
        point((a + b) / 2, (c + d) / 2).map((v, k) => v - [x, y, z][k]),
      );
      if (tier >= 3 && i > 0 && i < latitudes - 1) {
        const gap = 0.0028;
        const normal = point((a + b) / 2, c).map((v, k) => v - [x, y, z][k]);
        face(
          out,
          'gold',
          'seam',
          [
            point(a, c - gap, r + 0.012),
            point(a, c + gap, r + 0.012),
            point(b, c + gap, r + 0.012),
            point(b, c - gap, r + 0.012),
          ],
          normal,
        );
        if (i > 1)
          face(
            out,
            'gold',
            'seam',
            [
              point(a - gap, c, r + 0.012),
              point(a - gap, d, r + 0.012),
              point(a + gap, d, r + 0.012),
              point(a + gap, c, r + 0.012),
            ],
            normal,
          );
      }
    }
  const n = tier >= 2 ? 12 : 6;
  const ring = (y, r) =>
    around(n)
      .toReversed()
      .map((a) => [x + r * Math.cos(a), y, z + r * Math.sin(a)]);
  loft(
    out,
    'steel',
    [
      ring(roofY - 0.18, 0.62),
      ring(roofY + 0.26, 0.42),
      ring(mastY - 0.4, 0.086),
      ring(mastY, 0.063),
    ],
    C.mast,
  );
  if (tier >= 3)
    beam(
      out,
      'steel',
      [x - 0.42, roofY + 0.73, z],
      [x + 0.42, roofY + 0.73, z],
      0.12,
      0.1,
      C.steelTrim,
    );
}

export function buildTowerLevel(out, level = 'master') {
  const tier = levels[level];
  if (tier === undefined) throw Error(`Unknown Bayterek tier ${level}`);
  pedestal(out, tier);
  shaft(out, tier);
  lattice(out, tier);
  crown(out, tier);
  globe(out, tier);
}
export const buildTowerSkyline = (out) => buildTowerLevel(out, 'skyline');
export const buildTowerDistrict = (out) => buildTowerLevel(out, 'district');
export const buildTowerStreet = (out) => buildTowerLevel(out, 'street');
export const buildTowerCloseup = (out) => buildTowerLevel(out, 'closeup');
