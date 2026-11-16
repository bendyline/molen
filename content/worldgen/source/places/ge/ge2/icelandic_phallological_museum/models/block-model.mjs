/** Kalkofnsvegur 2, including the Icelandic Phallological Museum entrance on Reykjastræti. */
import { readFileSync } from 'node:fs';
import {
  loft,
  normalFor,
  radialRing,
  sphere,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';
export const layout = JSON.parse(readFileSync(new URL('../layout.json', import.meta.url)));
export const surfaces = {
  panel: { slot: 'wall', graph: 'concrete_panel', roughness: 0.87 },
  slab: { slot: 'roof', graph: 'concrete_plain', roughness: 0.89 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.73, metallic: 0.12 },
  paving: { slot: 'foundation', graph: 'stone_granite', roughness: 0.88 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.32, metallic: 0.12 },
};
const hues = {
  stone: 'b5b0a2',
  light: 'c3bcb0',
  shade: '928e81',
  seam: '79766b',
  roof: '92988f',
  plinth: '90918b',
  steel: '484d4d',
  mullion: '3c4547',
  rail: '73828a',
  grayglass: '7f9ba9',
  deepglass: '637e8a',
  tealGlass: '718c91',
  paleGlass: '9bb2ba',
  recess: '364449',
  warmGlass: 'a48772',
  lightGlass: 'bba88e',
  orange: 'a65b44',
  dark: '252c2e',
  sign: 'ece9e5',
  boulder: '9b9887',
  gravel: 'a4a296',
  duct: '898e8d',
  paleDuct: 'aeb1a9',
  red: 'ab4945',
};
const tint = Object.fromEntries(
  Object.entries(hues).map(([k, h]) => [
    k,
    h.match(/../g).map((v) => {
      const x = parseInt(v, 16) / 255;
      return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
    }),
  ]),
);
const levels = { skyline: 0, district: 1, street: 2, closeup: 3, master: 4 },
  up = [0, 1, 0];
const mix = (a, b, t) => a + (b - a) * t;
const P = ([x, z], y) => [x, y, z];
function tri(out, slot, key, p, n) {
  const normal = normalFor(...p);
  if (Math.hypot(...normal) < 0.9) return;
  const dot = normal.reduce((a, b, i) => a + b * n[i], 0);
  const points = dot < 0 ? p.toReversed() : p;
  out.addTriangle(slot, '', points, dot < 0 ? normal.map((v) => -v) : normal, undefined, tint[key]);
}
function quad(out, slot, key, [a, b, c, d], n) {
  tri(out, slot, key, [a, b, c], n);
  tri(out, slot, key, [a, c, d], n);
}
function horizontal(out, slot, key, ring, y) {
  const p = ring.map((p) => P(p, y));
  for (let i = 1; i + 1 < p.length; i++) tri(out, slot, key, [p[0], p[i], p[i + 1]], up);
}
function edge(ring, i) {
  const [x, z] = ring[i],
    [u, v] = ring[(i + 1) % ring.length],
    distance = Math.hypot(u - x, v - z);
  const a = (u - x) / distance,
    b = (v - z) / distance,
    n = [b, 0, -a];
  return { distance, n, point: (t, y, o = 0) => [x + a * t + b * o, y, z + b * t - a * o] };
}
function face(out, slot, key, e, a, b, y, h, o = 0) {
  if (b - a < 0.01 || h - y < 0.01) return;
  quad(
    out,
    slot,
    key,
    [e.point(a, y, o), e.point(b, y, o), e.point(b, h, o), e.point(a, h, o)],
    e.n,
  );
}
function prism(out, slot, key, e, x0, x1, y0, y1, d0, d1) {
  face(out, slot, key, e, x0, x1, y0, y1, d1);
  face(out, slot, key, { ...e, n: e.n.map((x) => -x) }, x0, x1, y0, y1, d0);
  for (const [h, sign] of [
    [y0, -1],
    [y1, 1],
  ])
    quad(
      out,
      slot,
      key,
      [e.point(x0, h, d0), e.point(x1, h, d0), e.point(x1, h, d1), e.point(x0, h, d1)],
      [0, sign, 0],
    );
  for (const [x, sign] of [
    [x0, -1],
    [x1, 1],
  ])
    quad(
      out,
      slot,
      key,
      [e.point(x, y0, d0), e.point(x, y0, d1), e.point(x, y1, d1), e.point(x, y1, d0)],
      [-e.n[2] * sign, 0, e.n[0] * sign],
    );
}
function spandrel(out, e, a, b, y, h) {
  const inset = -0.32;
  quad(
    out,
    'panel',
    'shade',
    [e.point(a, y, inset), e.point(b, y, inset), e.point(b, h, 0), e.point(a, h, 0)],
    e.n,
  );
}
function insetRing(ring, setbacks) {
  const planes = ring.map((_, i) => {
    const e = edge(ring, i);
    return { n: [e.n[0], e.n[2]], k: e.n[0] * ring[i][0] + e.n[2] * ring[i][1] - setbacks[i] };
  });
  return planes.map((b, i) => {
    const a = planes[(i + planes.length - 1) % planes.length],
      D = a.n[0] * b.n[1] - a.n[1] * b.n[0];
    return [(a.k * b.n[1] - b.k * a.n[1]) / D, (a.n[0] * b.k - b.n[0] * a.k) / D];
  });
}
const stepRings = [
  layout.footprint,
  insetRing(layout.footprint, [1.15, 1.1, 0.76, 1.0, 0.82]),
  insetRing(layout.footprint, [2.6, 2.17, 1.3, 1.62, 1.63]),
  insetRing(layout.footprint, [4.75, 3.2, 2.17, 2.75, 2.51]),
];
const floors = [
  { a: 0, b: 3.2, ring: 0, retail: true },
  { a: 3.2, b: 6.61, ring: 0, retail: true },
  { a: 6.61, b: 9.89, ring: 1 },
  { a: 9.89, b: 13.17, ring: 1 },
  { a: 13.17, b: 16.47, ring: 2 },
  { a: 16.47, b: 19.76, ring: 3 },
];
function stoneFrame(out, e, a, b, y, h, sill, d) {
  const width = b - a,
    inner = Math.min(0.25, width * 0.2);
  const A = a + inner,
    B = b - inner;
  face(out, 'panel', 'stone', e, a, A, y, h);
  face(out, 'panel', 'light', e, B, b, y, h);
  face(out, 'panel', 'shade', e, A, B, y, y + sill);
  face(out, 'panel', 'stone', e, A, B, h - 0.26, h);
  if (d >= 2) {
    for (const [t, sign] of [
      [A, 1],
      [B, -1],
    ])
      quad(
        out,
        'panel',
        'shade',
        [
          e.point(t, y + sill, -0.32),
          e.point(t, y + sill),
          e.point(t, h - 0.26),
          e.point(t, h - 0.26, -0.32),
        ],
        [-e.n[2] * sign, 0, e.n[0] * sign],
      );
    spandrel(out, e, A, B, h - 0.57, h - 0.26);
    quad(
      out,
      'panel',
      'light',
      [
        e.point(A, y + sill),
        e.point(B, y + sill),
        e.point(B, y + sill, -0.32),
        e.point(A, y + sill, -0.32),
      ],
      up,
    );
    if (d >= 3) face(out, 'panel', 'seam', e, a + 0.035, A - 0.018, y + 1.52, y + 1.531, 0.006);
  }
  return [A, B];
}
function window(out, e, A, B, y, h, i, d, retail, museum) {
  const low = y + (retail ? 0.11 : 0.37),
    high = h - 0.245,
    depth = d >= 2 ? -0.327 : -0.018;
  face(
    out,
    'glass',
    museum
      ? 'warmGlass'
      : retail
        ? i % 3 === 0
          ? 'lightGlass'
          : 'paleGlass'
        : ['grayglass', 'deepglass', 'tealGlass', 'paleGlass'][i % 4],
    e,
    A,
    B,
    low,
    high,
    depth,
  );
  if (d === 1) return;
  for (const x of [A + 0.036, B - 0.036, (A + B) / 2])
    face(out, 'metal', 'mullion', e, x - 0.026, x + 0.026, low, high, depth + 0.009);
  for (const v of [low + 0.055, high - 0.04, retail ? low + (high - low) * 0.72 : low + 0.09])
    face(out, 'metal', 'mullion', e, A, B, v - 0.028, v + 0.028, depth + 0.012);
  if (d >= 3) {
    const x = mix(A, B, 0.68),
      w = (B - A) * 0.04;
    face(
      out,
      'glass',
      i % 3 ? 'grayglass' : 'paleGlass',
      e,
      x - w,
      x + w,
      low + 0.08,
      high - 0.09,
      depth + 0.003,
    );
    if (i % 4 === 1 && !museum)
      face(
        out,
        'glass',
        'paleGlass',
        e,
        A + 0.085,
        mix(A, B, 0.43),
        low + 0.14,
        mix(low, high, 0.6),
        depth + 0.004,
      );
  }
}
function faceLevel(out, f, d, index) {
  const ring = stepRings[f.ring];
  for (let k = 0; k < ring.length; k++) {
    const e = edge(ring, k),
      n = Math.max(2, Math.round(e.distance / 3.18)),
      width = e.distance / n;
    if (d === 0) {
      face(out, 'panel', 'stone', e, 0, e.distance, f.a, f.b, -0.026);
      for (let i = 0; i < n; i++) {
        const a = i * width + 0.26,
          b = (i + 1) * width - 0.26;
        face(
          out,
          'glass',
          f.retail ? 'paleGlass' : 'grayglass',
          e,
          a,
          b,
          f.a + 0.38,
          f.b - 0.31,
          0.004,
        );
      }
      continue;
    }
    for (let i = 0; i < n; i++) {
      const a = i * width,
        b = (i + 1) * width;
      const museum = ((k === 0 && i >= n - 2) || (k === 1 && i < 3)) && f.retail;
      const [A, B] = stoneFrame(out, e, a, b, f.a, f.b, f.retail ? 0.11 : 0.37, d);
      window(out, e, A, B, f.a, f.b, index * 7 + i + k, d, f.retail, museum);
    }
  }
  horizontal(out, 'slab', 'roof', ring, f.b);
}
function terrace(out, ring, y, d) {
  for (let k = 0; k < ring.length; k++) {
    const e = edge(ring, k);
    face(out, 'glass', 'paleGlass', e, 0, e.distance, y + 0.04, y + 0.91, -0.12);
    if (d === 1) continue;
    const n = Math.ceil(e.distance / 1.65);
    face(out, 'metal', 'steel', e, 0, e.distance, y + 0.88, y + 0.94, -0.109);
    for (let i = 0; i <= n; i++) {
      const x = (i * e.distance) / n;
      face(out, 'metal', 'steel', e, x - 0.024, x + 0.024, y + 0.07, y + 0.94, -0.101);
    }
  }
}
function disk(out, e, x, y, d, rad, key, n, sign) {
  const center = e.point(x, y, d),
    normal = e.n.map((v) => v * sign);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2,
      b = ((i + 1) / n) * Math.PI * 2;
    tri(
      out,
      'metal',
      key,
      [
        center,
        e.point(x + Math.cos(a) * rad, y + Math.sin(a) * rad, d),
        e.point(x + Math.cos(b) * rad, y + Math.sin(b) * rad, d),
      ],
      normal,
    );
  }
}
function sign(out, e, x, y, d) {
  if (d === 0) return;
  const n = d === 4 ? 44 : d === 3 ? 32 : 12;
  prism(out, 'metal', 'dark', e, x - 0.041, x + 0.041, y - 0.38, y + 0.38, -0.01, 0.77);
  // A perpendicular panel with a pale circular museum mark on either face.
  const normal = [-e.n[2], 0, e.n[0]],
    point = (u, v, t) => e.point(x + t, v, u);
  const blade = { point, n: normal };
  for (const sign of [-1, 1]) {
    disk(out, blade, 0.44, y, sign * 0.048, 0.294, 'sign', n, sign);
    disk(out, blade, 0.44, y, sign * 0.052, 0.226, 'dark', n, sign);
    disk(out, blade, 0.44, y, sign * 0.056, 0.204, 'sign', n, sign);
    if (d >= 2) {
      const p = blade.point(0.44, y, sign * 0.061),
        pts = [
          [-0.13, 0.014],
          [-0.058, 0.048],
          [-0.017, 0.11],
          [0.061, 0.101],
          [0.08, 0.048],
          [0.147, 0.028],
          [0.095, -0.026],
          [0.043, -0.041],
          [-0.003, -0.092],
          [-0.092, -0.069],
          [-0.11, -0.018],
        ];
      for (let i = 0; i < pts.length; i++)
        tri(
          out,
          'metal',
          'dark',
          [
            p,
            ...[pts[i], pts[(i + 1) % pts.length]].map(([x, z]) =>
              blade.point(0.44 + x, y + z, sign * 0.061),
            ),
          ],
          normal.map((v) => v * sign),
        );
    }
  }
}
function entrance(out, d) {
  if (d === 0) return;
  const e = edge(layout.footprint, 0),
    n = Math.round(e.distance / 3.18),
    width = e.distance / n;
  const A = e.distance - width + 0.3,
    B = e.distance - 0.3,
    x = (A + B) / 2;
  // Frames, dark doors and warm recessed entry are made over the museum's first bay.
  face(out, 'glass', 'orange', e, A + 0.02, B - 0.02, 0.1, 2.63, -0.312);
  for (const u of [A + 0.06, x, B - 0.06])
    face(out, 'metal', 'mullion', e, u - 0.045, u + 0.045, 0.1, 2.65, -0.301);
  for (const y of [0.14, 2.5, 2.6])
    face(out, 'metal', 'mullion', e, A, B, y - 0.04, y + 0.04, -0.294);
  sign(out, e, A + 0.44, 2.85, d);
  sign(out, edge(layout.footprint, 1), 2.94, 2.86, d);
  if (d >= 2) {
    for (const s of [-1, 1])
      prism(
        out,
        'metal',
        'rail',
        e,
        x + s * 0.17 - 0.027,
        x + s * 0.17 + 0.027,
        1.0,
        1.27,
        -0.28,
        -0.2,
      );
    const p = e.point(B - 0.07, 0.11, 0.38);
    p[1] -= 0.13;
    loft(
      out,
      'metal',
      [
        radialRing(p[1] - 0.04, 0.37, 0.26, 18, [p[0], p[2]]),
        radialRing(p[1] - 0.012, 0.37, 0.27, 18, [p[0], p[2]]),
      ],
      tint.orange,
    );
    for (const [dx, y, dz, a, b, c] of [
      [-0.13, 0.11, -0.03, 0.15, 0.13, 0.14],
      [0.13, 0.12, 0.005, 0.14, 0.12, 0.14],
      [-0.065, 0.258, 0.02, 0.22, 0.108, 0.14],
    ]) {
      const angle = Math.atan2(0.12, 0.22),
        center = [p[0] + dx, p[1] + y, p[2] + dz];
      const turn = (x, y, z) => [
        center[0] + Math.cos(angle) * x - Math.sin(angle) * y,
        center[1] + Math.sin(angle) * x + Math.cos(angle) * y,
        center[2] + z,
      ];
      const segments = d === 4 ? 22 : d === 3 ? 16 : 8,
        rings = d === 4 ? 13 : d === 3 ? 10 : 5;
      const proxy = {
        addTriangle: (slot, ref, ps, n, uv, c) =>
          out.addTriangle(
            slot,
            ref,
            ps.map((q) => turn(...q)),
            [
              Math.cos(angle) * n[0] - Math.sin(angle) * n[1],
              Math.sin(angle) * n[0] + Math.cos(angle) * n[1],
              n[2],
            ],
            uv,
            c,
          ),
        addQuad: (slot, ref, ps, n, uv, c) =>
          out.addQuad(
            slot,
            ref,
            ps.map((q) => turn(...q)),
            [
              Math.cos(angle) * n[0] - Math.sin(angle) * n[1],
              Math.sin(angle) * n[0] + Math.cos(angle) * n[1],
              n[2],
            ],
            uv,
            c,
          ),
      };
      sphere(proxy, 'paving', [0, 0, 0], [a, b, c], tint.boulder, segments, rings);
    }
  }
}
function roofEquipment(out, d) {
  const [x, z] = layout.interior;
  const body = (x, z, a, b, y, h, key) =>
    box(out, 'slab', [x - a, y, z - b], [x + a, y + h, z + b], tint[key]);
  body(x, z - 4, 2.93, 4.18, 19.76, 1.67, 'duct');
  body(x + 3.37, z + 2.5, 1.23, 2.37, 19.76, 0.98, 'paleDuct');
  if (d < 2) return;
  for (const [u, v] of [
    [-2.6, 3.8],
    [2.7, -4.3],
    [0.7, 6.44],
    [4.7, 0.8],
  ]) {
    body(x + u, z + v, 0.73, 0.54, 19.76, 0.47, 'paleDuct');
    if (d >= 3)
      for (let i = 0; i < 6; i++)
        body(x + u - 0.49 + i * 0.195, z + v, 0.031, 0.45, 20.23, 0.049, 'duct');
  }
}
const shopMark = [
  [
    [0, 0],
    [0.22, 1],
  ],
  [
    [0.64, 0],
    [0.85, 1],
  ],
  [
    [0.15, 0.5],
    [0.73, 0.5],
  ],
  [
    [1.1, 0.04],
    [1.6, 0.97],
    [1.58, 0.18],
    [2.22, 0.93],
    [1.95, 0.06],
  ],
  [
    [0.72, 0.15],
    [1.2, 0.79],
  ],
  [
    [0.78, 0.22],
    [1.09, 0.64],
    [1.22, 0.71],
  ],
];
function retailSigns(out) {
  const e = edge(layout.footprint, 1);
  for (const center of [9.1, 45.2]) {
    const a = center - 1.06,
      b = center + 1.06;
    face(out, 'metal', 'sign', e, a, b, 3.45, 4.43, -0.305);
    for (const path of shopMark)
      for (let i = 1; i < path.length; i++) {
        const [x, y] = path[i - 1],
          [u, v] = path[i],
          x0 = a + 0.22 + x * 0.72,
          x1 = a + 0.22 + u * 0.72,
          y0 = 3.59 + y * 0.69,
          y1 = 3.59 + v * 0.69;
        const l = Math.hypot(x1 - x0, y1 - y0),
          dx = (-(y1 - y0) * 0.05) / l,
          dy = ((x1 - x0) * 0.05) / l;
        quad(
          out,
          'metal',
          'red',
          [
            e.point(x0 - dx, y0 - dy, -0.292),
            e.point(x1 - dx, y1 - dy, -0.292),
            e.point(x1 + dx, y1 + dy, -0.292),
            e.point(x0 + dx, y0 + dy, -0.292),
          ],
          e.n,
        );
      }
  }
}
export function buildMuseumLevel(out, level) {
  const d = levels[level];
  if (d === undefined) throw Error('Unknown Hafnartorg detail level');
  for (let i = 0; i < layout.footprint.length; i++) {
    const e = edge(layout.footprint, i);
    face(out, 'paving', 'plinth', e, 0, e.distance, -layout.footDepth, 0.1);
    if (d >= 1) face(out, 'panel', 'shade', e, 0, e.distance, 0.1, 0.23, 0.009);
  }
  for (const [i, f] of floors.entries()) faceLevel(out, f, d, i);
  if (d >= 1) for (const i of [1, 3, 4]) terrace(out, stepRings[floors[i].ring], floors[i].b, d);
  if (d >= 1)
    for (let i = 0; i < 5; i++) {
      const e = edge(stepRings[3], i);
      face(out, 'panel', 'stone', e, 0, e.distance, 19.74, 20.21);
    }
  roofEquipment(out, d);
  entrance(out, d);
  if (d >= 2) retailSigns(out);
}
export const buildSkyline = (out) => buildMuseumLevel(out, 'skyline');
export const buildDistrict = (out) => buildMuseumLevel(out, 'district');
export const buildStreet = (out) => buildMuseumLevel(out, 'street');
export const buildCloseup = (out) => buildMuseumLevel(out, 'closeup');
export const buildMaster = (out) => buildMuseumLevel(out, 'master');
