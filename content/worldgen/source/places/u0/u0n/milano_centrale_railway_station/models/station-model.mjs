/** Milano Centrale's Piazza frontage, raised track deck and five open train sheds. */
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
  stone: { slot: 'wall', graph: 'stone_limestone_raw', roughness: 0.88 },
  concrete: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.95 },
  steel: { slot: 'trim', graph: 'metal_painted', roughness: 0.79, metallic: 0.15 },
  roof: {
    slot: 'roof',
    graph: 'metal_standing_seam',
    roughness: 0.8,
    metallic: 0.1,
    doubleSided: true,
  },
  glass: {
    slot: 'window',
    graph: 'window_grid',
    roughness: 0.42,
    alphaMode: 'BLEND',
    baseColorFactor: [1, 1, 1, 0.63],
    doubleSided: true,
  },
};
const colors = {
  limestone: [0.645, 0.586, 0.478],
  ivory: [0.761, 0.696, 0.583],
  base: [0.56, 0.542, 0.488],
  recess: [0.49, 0.463, 0.408],
  bronze: [0.22, 0.245, 0.216],
  iron: [0.245, 0.278, 0.273],
  steel: [0.4, 0.43, 0.425],
  glass: [0.39, 0.5, 0.58],
  zinc: [0.32, 0.347, 0.327],
  silver: [0.53, 0.537, 0.48],
  copper: [0.365, 0.595, 0.523],
  roof: [0.31, 0.342, 0.327],
  dark: [0.153, 0.189, 0.195],
  ballast: [0.275, 0.251, 0.211],
  deck: [0.48, 0.462, 0.425],
  step: [0.675, 0.647, 0.575],
  rail: [0.5, 0.524, 0.51],
  ties: [0.302, 0.266, 0.214],
  yellow: [0.75, 0.557, 0.2],
};
const tiers = { skyline: 0, district: 1, street: 2, closeup: 3, master: 4 };
const ref = 'palette:#ffffff',
  up = [0, 1, 0],
  west = [-1, 0, 0],
  east = [1, 0, 0],
  mix = (a, b, t) => a + (b - a) * t;
const rod = (out, slot, tone, a, b, w, d = w) => beam(out, slot, a, b, w, d, colors[tone]);
function face(out, slot, tone, points, dir) {
  points = points
    .map((p) => p.map(Math.fround))
    .filter((p, i, all) => !all.slice(0, i).some((q) => q.every((v, j) => v === p[j])));
  if (points.length < 3) return;
  let n = normalFor(...points);
  if (dir && n.reduce((s, v, i) => s + v * dir[i], 0) < 0) {
    points = points.toReversed();
    n = normalFor(...points);
  }
  if (Math.hypot(...n) < 0.5) return;
  if (points.length === 3) out.addTriangle(slot, ref, points, n, undefined, colors[tone]);
  else out.addQuad(slot, ref, points, n, undefined, colors[tone]);
}
const rect = (x0, x1, z0, z1) => [
  [x0, z0],
  [x0, z1],
  [x1, z1],
  [x1, z0],
];
function box(out, slot, tone, x0, x1, z0, z1, y0, y1) {
  const r = rect(x0, x1, z0, z1);
  loft(
    out,
    slot,
    [y0, y1].map((y) => r.map(([x, z]) => [x, y, z])),
    colors[tone],
  );
}
function flat(out, slot, tone, ring, heights) {
  const ix = earcut(ring.flat());
  for (let i = 0; i < ix.length; i += 3)
    face(
      out,
      slot,
      tone,
      ix
        .slice(i, i + 3)
        .map((j) => [ring[j][0], Array.isArray(heights) ? heights[j] : heights, ring[j][1]]),
      up,
    );
}
function walls(ring) {
  const sign = Math.sign(
    ring.reduce((s, [x, z], i) => {
      const [a, b] = ring[(i + 1) % ring.length];
      return s + x * b - z * a;
    }, 0),
  );
  return ring
    .map(([x, z], i) => {
      const j = (i + 1) % ring.length,
        [a, b] = ring[j],
        length = Math.hypot(a - x, b - z),
        nx = (sign * (b - z)) / length,
        nz = (sign * (x - a)) / length;
      return {
        i,
        j,
        length,
        n: [nx, 0, nz],
        p: (t, y, offset = 0) => [mix(x, a, t) + offset * nx, y, mix(z, b, t) + offset * nz],
      };
    })
    .filter((s) => s.length > 0.045);
}
function slab(out, slot, tone, ring, low, high) {
  const y = (row, i) => (Array.isArray(row) ? row[i] : row);
  flat(out, slot, tone, ring, high);
  for (const { i, j, n, p } of walls(ring))
    face(
      out,
      slot,
      tone,
      [p(0, y(low, i)), p(1, y(low, j)), p(1, y(high, j)), p(0, y(high, i))],
      n,
    );
}
function panel(out, slot, tone, side, a, b, y, Y, offset) {
  const { p, n } = side;
  face(out, slot, tone, [p(a, y, offset), p(b, y, offset), p(b, Y, offset), p(a, Y, offset)], n);
}
function windows(out, side, a, b, y, Y, tier) {
  if (tier === 1) {
    panel(out, 'steel', 'dark', side, a, b, y, Y, 0.105);
    return;
  }
  if (tier >= 3) panel(out, 'stone', 'ivory', side, a - 0.009, b + 0.009, y - 0.2, Y + 0.21, 0.088);
  panel(out, 'steel', 'dark', side, a, b, y, Y, 0.112);
  panel(out, 'glass', 'glass', side, a + 0.005, b - 0.005, y + 0.09, Y - 0.12, 0.132);
  for (const t of tier === 2 ? [mix(a, b, 0.5)] : [mix(a, b, 0.33), mix(a, b, 0.67)]) {
    const half = 0.048 / side.length;
    panel(out, 'steel', 'bronze', side, t - half, t + half, y, Y, 0.171);
  }
  if (tier >= 3)
    panel(
      out,
      'steel',
      'bronze',
      side,
      a,
      b,
      mix(y, Y, 0.65) - 0.052,
      mix(y, Y, 0.65) + 0.052,
      0.168,
    );
}
function body(out, b, tier) {
  slab(out, 'stone', 'limestone', b.ring, b.base, b.top);
  if (tier > 0) flat(out, 'roof', 'zinc', b.ring, b.top + 0.013);
  for (const side of walls(b.ring)) {
    const { p, length } = side;
    if (length < 5) continue;
    const low = Math.min(b.top - 2, Math.max(b.base[side.i], b.base[side.j]) + 1.1);
    if (tier >= 2) panel(out, 'stone', 'base', side, 0, 1, low - 0.5, low + 0.35, 0.071);
    panel(out, 'stone', 'ivory', side, 0, 1, b.top - 1.03, b.top - 0.28, 0.19);
    if (tier >= 2 && b.kind === 'frontWing')
      panel(out, 'stone', 'base', side, 0, 1, b.top - 1.51, b.top - 1.27, 0.145);
    if (tier === 0 || length < 9) continue;
    const bays = Math.round(length / (b.kind === 'crossHall' ? 8.4 : tier === 1 ? 10.5 : 6.9));
    for (let i = 0; i < bays; i++) {
      const t = (i + 0.5) / bays,
        half = 0.27 / bays;
      if (tier > 1 && b.top - low > 8.2)
        windows(out, side, t - half, t + half, low + 1.6, low + 4.85, tier);
      windows(out, side, t - half, t + half, b.top - 6.5, b.top - 2.0, tier);
      if (tier >= 2 && i > 0) {
        const mid = i / bays,
          half = 0.33 / length;
        if (tier >= 3)
          rod(
            out,
            'stone',
            'ivory',
            p(mid, low + 0.42, 0.31),
            p(mid, b.top - 1.05, 0.31),
            0.69,
            0.42,
          );
        else
          panel(
            out,
            'stone',
            'ivory',
            side,
            mid - half,
            mid + half,
            low + 0.42,
            b.top - 1.05,
            0.19,
          );
      }
    }
  }
}
const stepset = Object.values(layout.steps).flat();
function col(out, x, z, bottom, top, tier) {
  const sides = tier === 0 ? 4 : tier === 1 ? 6 : 12;
  const rings = [
    [bottom, 0.88],
    [bottom + 0.44, 0.84],
    [bottom + 0.73, 0.62],
    [top - 1.0, 0.56],
    [top - 0.59, 0.68],
    [top - 0.28, 0.85],
    [top, 0.88],
  ];
  const profile =
    tier === 0
      ? [rings[0], rings.at(-1)]
      : tier === 1
        ? [rings[0], rings[2], rings[3], rings.at(-1)]
        : rings;
  loft(
    out,
    'stone',
    profile.map(([y, r]) => radialRing(y, r, r, sides, [x, z])),
    colors.ivory,
  );
  if (tier >= 3)
    for (let i = 0; i < 12; i++) {
      const a = (2 * Math.PI * i) / 12,
        dx = Math.cos(a),
        dz = Math.sin(a);
      rod(
        out,
        'stone',
        'limestone',
        [x + 0.61 * dx, bottom + 0.88, z + 0.61 * dz],
        [x + 0.55 * dx, top - 1.15, z + 0.55 * dz],
        0.062,
      );
    }
}
function westPanel(out, slot, tone, x, a, b, y, Y) {
  face(
    out,
    slot,
    tone,
    [
      [x, y, a],
      [x, y, b],
      [x, Y, b],
      [x, Y, a],
    ],
    west,
  );
}
function gateArch(out, x, z, w, y, head, top, tier, open) {
  const n = [4, 6, 9, 12, 12][tier],
    points = Array.from({ length: n + 1 }, (_, i) => {
      const a = (Math.PI * i) / n;
      return [z - (Math.cos(a) * w) / 2, head + Math.sin(a) * w * 0.25];
    });
  if (!open) westPanel(out, 'steel', 'dark', x - 0.016, z - w / 2, z + w / 2, y, head);
  for (let i = 1; i < points.length; i++) {
    const [a, h] = points[i - 1],
      [b, H] = points[i];
    face(
      out,
      'stone',
      'limestone',
      [
        [x, h, a],
        [x, H, b],
        [x, top, b],
        [x, top, a],
      ],
      west,
    );
    if (tier > 0) {
      const ring = tier >= 2 ? 0.57 : 0.31;
      face(
        out,
        'stone',
        'ivory',
        [
          [x - 0.12, h, a],
          [x - 0.12, H, b],
          [x - 0.12, H + ring, b],
          [x - 0.12, h + ring, a],
        ],
        west,
      );
      if (open)
        face(
          out,
          'stone',
          'recess',
          [
            [x, h, a],
            [x + 1.95, h, a],
            [x + 1.95, H, b],
            [x, H, b],
          ],
          [0, -1, 0],
        );
      else
        face(
          out,
          'steel',
          'dark',
          [
            [x - 0.014, head, a],
            [x - 0.014, head, b],
            [x - 0.014, H, b],
            [x - 0.014, h, a],
          ],
          west,
        );
    }
  }
  if (tier >= 2)
    box(
      out,
      'stone',
      'ivory',
      x - 0.48,
      x - 0.17,
      z - 0.29,
      z + 0.29,
      head + w * 0.25 - 0.12,
      head + w * 0.25 + 0.77,
    );
}
function railLateralAt(points, x) {
  const i = points.findIndex((p) => p[0] >= x);
  if (i <= 0) return undefined;
  const [a, b] = points.slice(i - 1, i + 1);
  return mix(a[2], b[2], (x - a[0]) / (b[0] - a[0]));
}
function barrel(out, { x0, x1, start, end, eave, rise }, tier, { train = false } = {}) {
  const arcSteps = train ? [6, 8, 12, 22, 32][tier] : [4, 6, 10, 14, 20][tier],
    length = x1 - x0;
  const at = (x, i, offset = 0) => {
    const t = (x - x0) / length,
      f = i / arcSteps,
      lo = mix(start[0], end[0], t),
      hi = mix(start[1], end[1], t),
      angle = Math.PI * f;
    return [x, eave + (rise + offset) * Math.sin(angle), mix(lo, hi, (1 - Math.cos(angle)) * 0.5)];
  };
  const count = train ? [1, 2, 6, 15, 30][tier] : [1, 2, 3, 5, 9][tier];
  for (let j = 0; j < count; j++) {
    const a = mix(x0, x1, j / count),
      b = mix(x0, x1, (j + 1) / count);
    for (let i = 0; i < arcSteps; i++) {
      const t = (i + 0.5) / arcSteps,
        glazed = train && Math.abs(t - 0.5) < (tier === 0 ? 0.14 : 0.132);
      const pts = [at(a, i), at(b, i), at(b, i + 1), at(a, i + 1)],
        dir = [0, Math.sin(Math.PI * t), -Math.cos(Math.PI * t)];
      face(
        out,
        glazed ? 'glass' : 'roof',
        glazed ? 'glass' : j % 4 === 1 ? 'silver' : 'zinc',
        pts,
        dir,
      );
      if (train && !glazed && tier >= 2)
        face(
          out,
          'roof',
          'roof',
          pts.map((p) => [p[0], p[1] - 0.24, p[2]]),
          dir.map((v) => -v),
        );
    }
  }
  for (const x of [x0, x1])
    for (let i = 1; i <= arcSteps; i++) {
      const a = at(x, i - 1),
        b = at(x, i);
      if (tier > 0)
        face(
          out,
          'steel',
          'steel',
          [a, b, [b[0], b[1] - 0.31, b[2]], [a[0], a[1] - 0.31, a[2]]],
          x === x0 ? west : east,
        );
      if (!train)
        face(
          out,
          'stone',
          'limestone',
          [[x, eave, a[2]], [x, eave, b[2]], b, a],
          x === x0 ? west : east,
        );
    }
  if (!train || tier === 0) return;
  const trussCount = [0, 2, 6, 13, 21][tier];
  for (let j = 0; j < trussCount; j++) {
    const x = mix(x0 + 1.35, x1 - 1.35, j / (trussCount - 1));
    for (let i = 1; i <= arcSteps; i++) {
      const a = at(x, i - 1, -0.3),
        b = at(x, i, -0.3);
      if (tier >= 3) rod(out, 'steel', 'iron', a, b, 0.23, 0.37);
      else
        face(
          out,
          'steel',
          'iron',
          [a, b, [b[0], b[1] - 0.32, b[2]], [a[0], a[1] - 0.32, a[2]]],
          west,
        );
      if (tier >= 3 && i % 2 === 0) {
        const top = at(x, i - 1, 0.005),
          low = at(x, i, -0.77);
        rod(out, 'steel', 'iron', top, low, 0.105, 0.16);
      }
    }
    for (const i of [0, arcSteps]) {
      const a = at(x, i);
      const railCenters = layout.tracks
        .map((t) => railLateralAt(t.points, x))
        .filter(Number.isFinite);
      const support =
        [0, 1.85, -1.85, 3, -3, 4.2, -4.2, 5.6, -5.6]
          .map((d) => a[2] + d)
          .find((z) => railCenters.every((r) => Math.abs(r - z) > 1.73)) ?? a[2];
      rod(out, 'steel', 'iron', [a[0], layout.deckY, support], a, 0.32, 0.42);
    }
  }
  for (const i of [0, Math.round(arcSteps * 0.34), Math.round(arcSteps * 0.66), arcSteps])
    rod(out, 'steel', 'steel', at(x0, i, -0.22), at(x1, i, -0.22), 0.26, 0.23);
  if (tier >= 2)
    for (const i of [Math.floor(arcSteps * 0.46), Math.ceil(arcSteps * 0.54)])
      rod(out, 'steel', 'iron', at(x0, i, -0.26), at(x1, i, -0.26), 0.16, 0.16);
}
function frontage(out, tier) {
  const x = -49.61,
    left = -24.69,
    right = 34.03,
    base = 1.42,
    portal = [
      [left, -20.15],
      [-10.05, -0.55],
      [10.25, 18.75],
      [28.85, right],
    ];
  slab(out, 'concrete', 'step', layout.vestibule, -4.1, base);
  for (const [z, dir] of [
    [left, [0, 0, -1]],
    [right, [0, 0, 1]],
  ]) {
    const points = [
      [-44, base, z],
      [-12.64, base, z],
      [-12.64, 11.7, z],
      [-44, 11.7, z],
    ];
    face(out, 'stone', 'limestone', points, dir);
    face(
      out,
      'stone',
      'recess',
      points.map(([x, y, z]) => [x, y, z - dir[2] * 0.28]),
      dir.map((v) => -v),
    );
  }
  for (const [a, b] of portal) {
    if (tier === 0) westPanel(out, 'stone', 'limestone', x, a, b, -0.86, 11.8);
    else box(out, 'stone', 'limestone', x, -37.9, a, b, -0.86, 11.8);
  }
  for (const [a, b] of [
    [-20.15, -10.05],
    [-0.55, 10.25],
    [18.75, 28.85],
  ])
    gateArch(out, x + 0.88, (a + b) * 0.5, b - a, base, 8.3, 12.2, tier, true);
  box(out, 'stone', 'ivory', x - 0.57, -38, left - 0.51, right + 0.51, 11.77, 13.25);
  box(out, 'stone', 'limestone', x + 0.49, -38, left, right, 13.25, 15.25);
  box(out, 'stone', 'ivory', x - 0.24, -38, left - 0.19, right + 0.19, 15.25, 15.74);
  for (const z of [-22.4, -8.52, -2.16, 11.85, 17.2, 31.02])
    col(out, x - 0.35, z, base, 11.82, tier);
  if (tier <= 1) {
    for (const group of Object.values(layout.steps)) {
      const s = group.at(-1);
      box(
        out,
        'concrete',
        'step',
        s.x,
        x,
        s.z - s.width * 0.5,
        s.z + s.width * 0.5,
        -4.05,
        base - 0.05,
      );
    }
  } else
    for (const s of stepset) {
      const r = rect(s.x, s.x + 0.445, s.z - s.width * 0.5, s.z + s.width * 0.5);
      slab(out, 'concrete', 'step', r, -4.05, s.y);
    }
  box(out, 'stone', 'limestone', -40.17, -9.48, left - 0.32, right + 0.22, 15.25, 25.1);
  box(out, 'stone', 'ivory', -40.72, -9.42, left - 0.59, right + 0.52, 24.95, 25.65);
  const bays = [
    [-24.72, -6.92],
    [-6.92, 13.86],
    [13.86, 33.97],
  ];
  for (const [a, b] of bays) {
    barrel(
      out,
      { x0: -40.22, x1: -9.41, start: [a, b], end: [a, b], eave: 25.62, rise: 3.72 },
      tier,
    );
    const mid = (a + b) / 2;
    if (tier > 0) gateArch(out, -40.31, mid, 10.55, 18.1, 22.15, 25.65, tier, false);
    westPanel(out, 'steel', 'dark', -40.33, mid - 5.25, mid + 5.25, 18.05, 22.15);
    if (tier >= 1)
      for (const t of [-2.7, 0, 2.7])
        rod(
          out,
          'steel',
          'bronze',
          [-40.37, 18.05, mid + t],
          [-40.37, 24.07 - 0.17 * Math.abs(t), mid + t],
          0.17,
          0.11,
        );
    if (tier >= 2)
      for (const side of [-1, 1]) {
        const z = mid + side * 6.5;
        box(out, 'stone', 'ivory', -41.13, -40.15, z - 0.72, z + 0.72, 15.72, 25.95);
        box(out, 'stone', 'limestone', -41.23, -40.11, z - 1.1, z + 1.1, 24.82, 26.22);
        box(out, 'stone', 'ivory', -41.39, -40.11, z - 1.15, z + 1.15, 26.12, 26.56);
      }
  }
  if (tier > 0) {
    box(out, 'stone', 'recess', -12.63, -9.3, -24.77, 34.13, 1.42, 15.25);
    for (const z of [-15.1, 4.85, 23.8])
      westPanel(out, 'steel', 'dark', -12.67, z - 4.25, z + 4.25, 1.43, 8.9);
  }
  if (tier >= 1)
    for (const z of [-85.2, -27.5, 36.95, 97.1]) {
      box(out, 'stone', 'ivory', -40.18, -36.25, z - 1.12, z + 1.12, 2.9, 18.5);
      box(out, 'stone', 'ivory', -40.44, -36.01, z - 1.45, z + 1.45, 18.5, 19.22);
    }
  for (const [x0, x1, a, b, rise, y] of [
    [-38.64, -9.21, -83.8, -29.8, 3.5, 16.68],
    [-39, -9.75, 38.15, 96.05, 3.5, 16.68],
    [-10.27, 31.89, -25.9, 35.05, 5.05, 30.59],
  ]) {
    barrel(out, { x0, x1, start: [a, b], end: [a, b], eave: y, rise }, tier);
  }
  if (tier > 0)
    for (const [a, b] of [
      [-26.35, -19.2],
      [2.5, 8.5],
      [27.2, 35.5],
    ])
      box(out, 'roof', 'copper', -10.7, 32.33, a, b, 30.6, 30.77);
}
function track(out, route, tier) {
  const span = tier === 1 ? 15 : tier === 2 ? 8 : tier === 3 ? 4 : 2,
    points = route.filter((_, i) => i % span === 0 || i === route.length - 1);
  for (let i = 1; i < points.length; i++) {
    const [a, b] = points.slice(i - 1, i + 1),
      p = (s, d, h = 0) => [s[0], s[1] + h, s[2] + d];
    face(
      out,
      'concrete',
      'ballast',
      [p(a, -1.06, -0.117), p(b, -1.06, -0.117), p(b, 1.06, -0.117), p(a, 1.06, -0.117)],
      up,
    );
    for (const z of [-0.7175, 0.7175]) {
      if (tier >= 3) rod(out, 'steel', 'rail', p(a, z), p(b, z), 0.084, 0.098);
      else
        face(
          out,
          'steel',
          'rail',
          [p(a, z - 0.065), p(b, z - 0.065), p(b, z + 0.065), p(a, z + 0.065)],
          up,
        );
    }
  }
  if (tier >= 2)
    for (let i = 1; i < route.length; i += tier === 2 ? 2 : 1) {
      const [a, b] = route.slice(i - 1, i + 1),
        sub = tier === 4 ? 4 : tier === 3 ? 2 : 1;
      for (let j = 0; j < sub; j++) {
        const t = (j + 0.5) / sub,
          x = mix(a[0], b[0], t),
          y = mix(a[1], b[1], t) - 0.078,
          z = mix(a[2], b[2], t);
        face(
          out,
          'concrete',
          'ties',
          [
            [x - 0.17, y, z - 0.94],
            [x + 0.17, y, z - 0.94],
            [x + 0.17, y, z + 0.94],
            [x - 0.17, y, z + 0.94],
          ],
          up,
        );
      }
    }
  if (tier >= 2) {
    const [x, y, z] = route[0];
    rod(
      out,
      'steel',
      'iron',
      [x - 0.88, y + 0.48, z - 0.95],
      [x - 0.88, y + 0.48, z + 0.95],
      0.22,
      0.26,
    );
    for (const k of [-0.65, 0.65])
      rod(out, 'steel', 'iron', [x - 0.88, y + 0.48, z + k], [x + 0.85, y, z + k], 0.12, 0.14);
  }
}
function railDeck(out, tier) {
  slab(out, 'concrete', 'ballast', layout.raisedDeck, layout.raisedBase, layout.deckY);
  for (const a of layout.apron) slab(out, 'concrete', 'ballast', a.ring, a.base, a.top);
  for (const p of layout.platforms) {
    if (tier <= 1) {
      flat(out, 'concrete', 'deck', p.ring, p.top);
      continue;
    }
    slab(out, 'concrete', 'deck', p.ring, p.under, p.top);
    if (tier >= 2)
      for (const side of walls(p.ring)) {
        const { p: point, i, j, n, length } = side;
        if (length < 5 || Math.abs(n[0]) > 0.7) continue;
        const a = point(0, p.top[i] + 0.013, -0.11),
          b = point(1, p.top[j] + 0.013, -0.11);
        const q = ([x, y, z]) => [x - 0.08 * n[0], y, z - 0.08 * n[2]];
        face(out, 'concrete', 'yellow', [a, b, q(b), q(a)], up);
      }
  }
  if (tier > 0) for (const { points } of layout.tracks) track(out, points, tier);
}
export function buildMilanoCentraleLevel(out, level) {
  const tier = tiers[level];
  if (tier === undefined) throw Error(`Unknown Milano Centrale level ${level}`);
  railDeck(out, tier);
  for (const b of layout.bodies) body(out, b, tier);
  frontage(out, tier);
  for (const s of layout.sheds) barrel(out, s, tier, { train: true });
}
export const buildMilanoCentraleSkyline = (out) => buildMilanoCentraleLevel(out, 'skyline');
export const buildMilanoCentraleDistrict = (out) => buildMilanoCentraleLevel(out, 'district');
export const buildMilanoCentraleStreet = (out) => buildMilanoCentraleLevel(out, 'street');
export const buildMilanoCentraleCloseup = (out) => buildMilanoCentraleLevel(out, 'closeup');
