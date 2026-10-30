/** Independent authored browser tiers; the original detailed master is never rewritten here. */
import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import {
  beam,
  loft,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

export const tolbiacBrowserSurfaces = {
  far: { slot: 'foundation', localRef: 'palette:#ffffff', roughness: 0.94 },
  stone: { slot: 'wall', graph: 'stone_limestone_raw', roughness: 0.95 },
  weathered: { slot: 'foundation', graph: 'stone_limestone_weathered', roughness: 0.96 },
  road: { slot: 'roof', graph: 'concrete_plain', roughness: 0.97 },
  iron: { slot: 'trim', graph: 'metal_painted', roughness: 0.65, metallic: 0.35 },
  glass: {
    slot: 'window',
    localRef: 'palette:#ffffff',
    roughness: 0.18,
    baseColorFactor: [1, 1, 1, 0.32],
    alphaMode: 'BLEND',
    doubleSided: true,
  },
  mark: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.87 },
};
export const tolbiacBrowserControls = {
  arches: [
    { c: -71.8, rx: 14.5, rise: 7.09 },
    { c: -37.7, rx: 16, rise: 7.76 },
    { c: 0, rx: 17.5, rise: 8.18 },
    { c: 37.7, rx: 16, rise: 7.76 },
    { c: 71.8, rx: 14.5, rise: 7.09 },
  ],
  piers: [
    [-55.6, 1.7],
    [-19.7, 2.2],
    [19.7, 2.2],
    [55.6, 1.7],
  ],
  spring: -1,
  originShift: 1.1,
  deckStart: -101.9,
  deckEnd: 96.6,
  bodyEnd: 86.3,
  railStart: -89,
  railEnd: 91,
};
const C = tolbiacBrowserControls,
  road = (x) => 8.62 - 0.017 * (Math.sqrt(x * x + 16) - 4);
export const tolbiacBrowserDeck = (x) => road(x) + C.originShift;
export const tolbiacBrowserArch = (a, x) =>
  0.1 + a.rise * Math.sqrt(Math.max(0, 1 - ((x - a.c) / a.rx) ** 2));
const color = {
  stone: [0.68, 0.65, 0.56],
  mortar: [0.43, 0.425, 0.37],
  trim: [0.82, 0.8, 0.72],
  iron: [0.075, 0.09, 0.087],
  road: [0.25, 0.265, 0.26],
  walk: [0.41, 0.4, 0.36],
  glass: [0.88, 0.92, 0.89],
  mark: [0.85, 0.83, 0.69],
};
const tiers = {
  skyline: {
    arch: 4,
    step: 64,
    curve: 3,
    pier: 4,
    panels: 0,
    holes: 0,
    round: 0,
    lamps: 0,
    dentil: 0,
    stones: false,
    soffit: 0,
  },
  district: {
    arch: 8,
    step: 32,
    curve: 3,
    pier: 8,
    panels: 8,
    holes: 1,
    round: 1,
    lamps: 2,
    dentil: 0,
    stones: false,
    soffit: 0,
  },
  street: {
    arch: 16,
    step: 12,
    curve: 8,
    pier: 16,
    panels: 24,
    holes: 5,
    round: 1,
    lamps: 4,
    dentil: 4.48,
    stones: true,
    soffit: 0,
  },
  closeup: {
    arch: 28,
    step: 3.2,
    curve: 16,
    pier: 32,
    panels: 48,
    holes: 9,
    round: 4,
    lamps: 8,
    dentil: 1.12,
    stones: true,
    soffit: 0,
  },
};
const sample = (n, fn) => Array.from({ length: n + 1 }, (_, i) => fn(i / n));
function writer(target, far) {
  return Object.fromEntries(
    ['addQuad', 'addTriangle', 'addConvexPolygon'].map((name) => [
      name,
      (slot, ref, points, hint, _uv, tint) => {
        for (let i = 1; i < points.length - 1; i++) {
          let p = [points[0], points[i], points[i + 1]].map((q) => [q[0], q[1] + 1.1, q[2]]),
            n = normalFor(...p);
          if (hint && n.reduce((s, v, j) => s + v * hint[j], 0) < 0) {
            p = [p[0], p[2], p[1]];
            n = normalFor(...p);
          }
          if (Math.hypot(...n) < 0.9) continue;
          target.addTriangle(
            far ? 'far' : slot,
            ref,
            p,
            n,
            p.map((q) => [q[0], q[1]]),
            tint,
          );
        }
      },
    ]),
  );
}
function clean(ring) {
  return ring.filter((p, i) => {
    const q = ring[(i + ring.length - 1) % ring.length];
    return Math.hypot(p[0] - q[0], p[1] - q[1]) > 1e-6;
  });
}
function clip(poly, signed) {
  const result = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i],
      b = poly[(i + 1) % poly.length],
      da = signed(a),
      db = signed(b);
    if (da >= 0) result.push(a);
    if (da < 0 !== db < 0) result.push(a.map((v, k) => v + ((b[k] - v) * da) / (da - db)));
  }
  return clean(result);
}
/** Use the public kernel cap API for hole-aware triangulation, then map that plane into 3D. */
function triangles(outer, holes = []) {
  const b = new MeshBufferBuilder();
  if (
    !b.addCap(
      'wall',
      'palette:#ffffff',
      clean(outer),
      holes,
      () => 0,
      [0, 1, 0],
      (p) => p,
      [1, 1, 1],
    )
  )
    throw Error('Invalid Tolbiac browser cap');
  const m = b.finalize();
  return Array.from({ length: m.indices.length / 3 }, (_, i) =>
    Array.from({ length: 3 }, (_, j) => {
      const k = m.indices[i * 3 + j];
      return [m.positions[k * 3], m.positions[k * 3 + 2]];
    }),
  );
}
function slab(o, ring, bottom, top, slot, tint) {
  ring = clean(ring);
  if (ring.length < 3) return;
  const area = ring.reduce((sum, p, i) => {
    const q = ring[(i + 1) % ring.length];
    return sum + p[0] * q[1] - q[0] * p[1];
  }, 0);
  const ts = triangles(ring);
  for (const t of ts)
    for (const [h, ny] of [
      [bottom, -1],
      [top, 1],
    ])
      o.addTriangle(
        slot,
        'palette:#ffffff',
        t.map((p) => [p[0], h(p[0]), p[1]]),
        [0, ny, 0],
        [],
        tint,
      );
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length],
      q = [
        [a[0], bottom(a[0]), a[1]],
        [b[0], bottom(b[0]), b[1]],
        [b[0], top(b[0]), b[1]],
        [a[0], top(a[0]), a[1]],
      ];
    const n = normalFor(...q);
    o.addQuad(slot, 'palette:#ffffff', q, area > 0 ? n.map((v) => -v) : n, [], tint);
  }
}
function prismX(o, slot, xs, z0, z1, bottom, top, tint) {
  loft(
    o,
    slot,
    xs.map((x) => [
      [x, bottom(x), z0],
      [x, top(x), z0],
      [x, top(x), z1],
      [x, bottom(x), z1],
    ]),
    tint,
  );
}
function curve(a, b, c, d, n) {
  return sample(n, (t) =>
    a.map(
      (v, k) =>
        v * Math.pow(1 - t, 3) +
        3 * b[k] * t * (1 - t) ** 2 +
        3 * c[k] * t * t * (1 - t) +
        d[k] * Math.pow(t, 3),
    ),
  );
}
export function tolbiacBrowserWings(n = 16) {
  return [
    [
      ...curve([-89, -10.05], [-96.3, -10.05], [-95.75, -14.9], [-95.77, -18.66], n),
      [-100.53, -18.55],
    ],
    [...curve([-89, 10.05], [-98.3, 9.4], [-97.2, 14.9], [-97.08, 18.12], n), [-103.24, 17.73]],
    curve([91, -10.05], [94.1, -10.05], [95.6, -11.8], [96.93, -14.42], n),
    curve([91, 10.05], [93.6, 10.05], [95.2, 11.9], [96.26, 13.98], n),
  ];
}
function capsule(cx, y, r, n) {
  return Array.from({ length: n }, (_, i) => {
    const a = (-i * 2 * Math.PI) / n;
    return [cx + Math.cos(a) * r, y, Math.sin(a) * r + (Math.sin(a) >= 0 ? 9.8 : -9.8)];
  });
}
function cutwaters(o, S) {
  for (const [x, r] of C.piers) {
    box(o, 'stone', [x - r, -1.1, -10], [x + r, road(x) - 0.25, 10], color.mortar);
    loft(
      o,
      'weathered',
      [capsule(x, -1.1, r + 0.22, S.pier), capsule(x, 1.78, r + 0.12, S.pier)],
      color.stone.map((v) => v * 0.77),
    );
    loft(
      o,
      'stone',
      [
        capsule(x, 1.8, r + 0.3, S.pier),
        capsule(x, 2.02, r + 0.3, S.pier),
        capsule(x, 2.52, r - 0.14, S.pier),
      ],
      color.stone,
    );
    if (S.panels)
      for (const side of [-1, 1]) {
        const z = side * 10.18,
          y = road(x);
        box(o, 'stone', [x - 0.48, 2.22, z - 0.15], [x + 0.48, y + 1.36, z + 0.15], color.stone);
        box(o, 'stone', [x - 0.56, y + 1.36, z - 0.22], [x + 0.56, y + 1.48, z + 0.22], color.trim);
      }
  }
}
function vaults(o, S) {
  for (const a of C.arches) {
    const at = (t, off = 0) => {
      const nx = Math.cos(t) / a.rx,
        ny = Math.sin(t) / a.rise,
        d = Math.hypot(nx, ny);
      return [
        a.c + a.rx * Math.cos(t) + (off * nx) / d,
        -1 + a.rise * Math.sin(t) + (off * ny) / d,
      ];
    };
    loft(
      o,
      'stone',
      sample(S.arch, (t) => {
        const [x, y] = at(Math.PI * (1 - t));
        return [
          [x, y, -10],
          [x, road(x) - 0.28, -10],
          [x, road(x) - 0.28, 10],
          [x, y, 10],
        ];
      }),
      color.mortar,
    );
    if (S.stones)
      for (let i = 0; i < S.arch; i++) {
        const a0 = (Math.PI * (i + 0.017)) / S.arch,
          a1 = (Math.PI * (i + 0.983)) / S.arch,
          p = at(a0),
          q = at(a1),
          u = at(a0, 0.98),
          v = at(a1, 0.98);
        for (const side of [-1, 1])
          slabFace(
            o,
            [p, q, v, u],
            side < 0 ? -10.075 : 10.02,
            side < 0 ? -10.02 : 10.075,
            'stone',
            color.stone.map((x) => x + ((i % 3) - 1) * 0.012),
          );
        for (let k = 0; k < S.soffit; k++) {
          const z = -10 + (20 * k) / S.soffit;
          slabFace(
            o,
            [at(a0, -0.012), at(a1, -0.012), at(a1, 0.01), at(a0, 0.01)],
            z + 0.008,
            z + 20 / S.soffit - 0.008,
            'weathered',
            color.stone.map((x) => x * 0.72),
          );
        }
      }
  }
}
function slabFace(o, xy, z0, z1, slot, tint) {
  const ts = triangles(xy);
  for (const t of ts)
    for (const [z, nz] of [
      [z0, -1],
      [z1, 1],
    ])
      o.addTriangle(
        slot,
        'palette:#ffffff',
        t.map((p) => [p[0], p[1], z]),
        [0, 0, nz],
        [],
        tint,
      );
  for (let i = 0; i < xy.length; i++) {
    const p = xy[i],
      q = xy[(i + 1) % xy.length],
      ps = [
        [p[0], p[1], z0],
        [q[0], q[1], z0],
        [q[0], q[1], z1],
        [p[0], p[1], z1],
      ];
    o.addQuad(slot, 'palette:#ffffff', ps, normalFor(...ps), [], tint);
  }
}
function deckAndWings(o, S) {
  const wings = tolbiacBrowserWings(S.curve),
    outline = [...wings[0].toReversed(), ...wings[2], ...wings[3].toReversed(), ...wings[1]],
    xs = [
      ...new Set([
        C.deckStart,
        C.deckEnd,
        -4,
        0,
        4,
        ...sample(
          Math.ceil((C.deckEnd - C.deckStart) / S.step),
          (t) => C.deckStart + (C.deckEnd - C.deckStart) * t,
        ),
      ]),
    ].sort((a, b) => a - b);
  for (const side of [-1, 1])
    slab(
      o,
      clip(outline, (p) => side * p[0] - 86.3),
      () => -1.1,
      (x) => road(x) - 0.28,
      'stone',
      color.mortar,
    );
  prismX(o, 'road', xs, -6, 6, (x) => road(x) - 0.15, road, color.road);
  for (const side of [-1, 1]) {
    const sidewalk = clip(outline, (p) => side * p[1] - 6),
      start = Math.min(...sidewalk.map((p) => p[0])),
      end = Math.max(...sidewalk.map((p) => p[0])),
      stations = [...new Set([start, end, ...xs.filter((x) => x > start && x < end)])].sort(
        (a, b) => a - b,
      );
    for (let i = 1; i < stations.length; i++)
      slab(
        o,
        clip(
          clip(sidewalk, (p) => p[0] - stations[i - 1]),
          (p) => stations[i] - p[0],
        ),
        (x) => road(x) - 0.25,
        (x) => road(x) + 0.16,
        'road',
        color.walk,
      );
    if (S.panels)
      prismX(
        o,
        'stone',
        xs,
        side * 6 - 0.12,
        side * 6 + 0.12,
        (x) => road(x) - 0.02,
        (x) => road(x) + 0.17,
        color.trim,
      );
  }
  for (const path of wings) {
    for (const [dy, width, depth] of S.panels
      ? [
          [0.82, 0.42, 1.04],
          [1.36, 0.57, 0.1],
        ]
      : [[1.36, 0.57, 0.1]])
      for (let i = 1; i < path.length; i++) {
        const a = path[i - 1],
          b = path[i];
        beam(
          o,
          'stone',
          [a[0], road(a[0]) + dy, a[1]],
          [b[0], road(b[0]) + dy, b[1]],
          width,
          depth,
          color.trim,
        );
      }
    if (S.panels) {
      const [x, z] = path.at(-1),
        y = road(x);
      box(o, 'stone', [x - 0.42, -1.1, z - 0.42], [x + 0.42, y + 1.35, z + 0.42], color.stone);
      if (S.panels >= 24)
        box(o, 'stone', [x - 0.51, y + 1.35, z - 0.51], [x + 0.51, y + 1.49, z + 0.51], color.trim);
    }
  }
  if (S.panels) {
    prismX(
      o,
      'mark',
      xs,
      -0.055,
      0.055,
      (x) => road(x) + 0.01,
      (x) => road(x) + 0.02,
      color.mark,
    );
    for (const z of [-4.5, 4.5])
      for (let x = C.deckStart + 2; x < C.deckEnd - 1; x += 5.2)
        beam(
          o,
          'mark',
          [x, road(x) + 0.013, z],
          [Math.min(x + 2.8, C.deckEnd), road(Math.min(x + 2.8, C.deckEnd)) + 0.013, z],
          0.35,
          0.008,
          [0.83, 0.83, 0.72],
        );
  }
}
function hole(cx, cy, r, straight, n) {
  return [
    ...sample(n, (t) => [
      cx + r * Math.cos(Math.PI * t),
      cy + straight + r * Math.sin(Math.PI * t),
    ]),
    ...sample(n, (t) => [
      cx + r * Math.cos(Math.PI + Math.PI * t),
      cy - straight + r * Math.sin(Math.PI + Math.PI * t),
    ]),
  ];
}
function panel(o, x0, x1, z, S) {
  const y = road((x0 + x1) / 2) + 0.24,
    outer = [
      [x0, y],
      [x1, y],
      [x1, y + 1.06],
      [x0, y + 1.06],
    ],
    holes = Array.from({ length: S.holes }, (_, i) =>
      hole(
        x0 + ((x1 - x0) * (i + 0.5)) / S.holes,
        y + 0.535,
        Math.min(0.103, ((x1 - x0) / S.holes) * 0.275),
        0.274,
        S.round,
      ),
    ),
    ts = triangles(outer, holes);
  for (const dz of [-0.2, 0.2])
    for (const t of ts)
      o.addTriangle(
        'stone',
        'palette:#ffffff',
        t.map((p) => [p[0], p[1], z + dz]),
        [0, 0, Math.sign(dz)],
        [],
        color.trim,
      );
  for (const ring of [outer, ...holes])
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i],
        b = ring[(i + 1) % ring.length],
        q = [
          [a[0], a[1], z - 0.2],
          [b[0], b[1], z - 0.2],
          [b[0], b[1], z + 0.2],
          [a[0], a[1], z + 0.2],
        ],
        hint = ring === outer ? normalFor(...q) : normalFor(...q).map((v) => -v);
      o.addQuad('stone', 'palette:#ffffff', q, hint, [], color.stone);
    }
}
function borders(o, S) {
  const xs = S.panels
    ? sample(Math.max(6, Math.ceil(180 / S.step)), (t) => -89 + 180 * t)
    : [-89, -4, 4, 91];
  for (const side of [-1, 1]) {
    const z = side * 10.05;
    for (const [dy, width, height] of S.panels
      ? [
          [-0.25, 0.72, 0.14],
          [0.15, 0.62, 0.15],
          [1.31, 0.57, 0.1],
        ]
      : [[1.31, 0.57, 0.1]])
      prismX(
        o,
        'stone',
        xs,
        z - width / 2,
        z + width / 2,
        (x) => road(x) + dy,
        (x) => road(x) + dy + height,
        color.trim,
      );
    if (S.dentil)
      for (let x = -89; x < 91; x += S.dentil)
        box(
          o,
          'stone',
          [x, road(x) - 0.59, z - 0.17],
          [Math.min(91, x + Math.min(0.55, S.dentil * 0.7)), road(x) - 0.35, z + 0.17],
          color.stone,
        );
    if (S.panels) {
      const step = 180 / S.panels;
      for (let i = 0; i < S.panels; i++) {
        const a = -89 + i * step + 0.22,
          b = -89 + (i + 1) * step - 0.22;
        if (i === 0)
          slabFace(
            o,
            [
              [a, road((a + b) / 2) + 0.24],
              [b, road((a + b) / 2) + 0.24],
              [b, road((a + b) / 2) + 1.3],
              [a, road((a + b) / 2) + 1.3],
            ],
            z - 0.2,
            z + 0.2,
            'stone',
            color.trim,
          );
        else panel(o, a, b, z, S);
      }
      for (let i = 0; i <= S.panels; i++) {
        const x = -89 + i * step,
          y = road(x);
        box(o, 'stone', [x - 0.22, y + 0.2, z - 0.25], [x + 0.22, y + 1.35, z + 0.25], color.trim);
        if (S.panels >= 24)
          box(o, 'stone', [x - 0.26, y + 1.35, z - 0.3], [x + 0.26, y + 1.46, z + 0.3], color.trim);
      }
    }
  }
}
function lamp(o, x, z, S) {
  const y = road(x) + 0.16,
    n = S.lamps;
  if (n === 2) {
    beam(o, 'iron', [x, y, z], [x, y + 5.4, z], 0.12, 0.12, color.iron);
    box(o, 'glass', [x - 0.2, y + 4.7, z - 0.2], [x + 0.2, y + 5.38, z + 0.2], color.glass);
    return;
  }
  const lathe = (slot, profile, tint) =>
    loft(
      o,
      slot,
      profile.map(([h, r]) =>
        Array.from({ length: n }, (_, i) => {
          const a = (-i * 2 * Math.PI) / n;
          return [x + r * Math.cos(a), y + h, z + r * Math.sin(a)];
        }),
      ),
      tint,
    );
  lathe(
    'iron',
    [
      [0, 0.29],
      [0.2, 0.24],
      [0.7, 0.14],
      [1.1, 0.14],
      [1.27, 0.095],
      [4.52, 0.07],
      [4.68, 0.09],
    ],
    color.iron,
  );
  lathe(
    'glass',
    [
      [4.66, 0.08],
      [4.83, 0.18],
      [5.2, 0.24],
      [5.38, 0.26],
    ],
    color.glass,
  );
  lathe(
    'iron',
    [
      [5.37, 0.31],
      [5.45, 0.31],
      [5.63, 0.14],
      [5.79, 0.14],
      [5.87, 0.065],
    ],
    color.iron,
  );
  if (n >= 8)
    for (const side of [-1, 1])
      beam(
        o,
        'iron',
        [x + side * 0.08, y + 4.66, z],
        [x + side * 0.26, y + 5.38, z],
        0.019,
        0.022,
        color.iron,
      );
}
export function buildTolbiacBrowser(target, level = 'closeup') {
  const S = tiers[level];
  if (!S) throw Error(`Unknown Tolbiac tier ${level}`);
  const o = writer(target, level === 'skyline');
  vaults(o, S);
  cutwaters(o, S);
  deckAndWings(o, S);
  borders(o, S);
  if (S.lamps)
    for (const x of S.lamps === 2 ? [-74.4, 74.4] : [-93, -74.4, -37.2, 0, 37.2, 74.4, 93])
      for (const side of [-1, 1]) lamp(o, x, side * 6.85, S);
  if (level === 'closeup') {
    const center = -89 + 180 / 96,
      y = road(center);
    for (const dx of [-0.75, 0.75])
      box(
        o,
        'stone',
        [center + dx - 0.69, y + 0.37, -9.854],
        [center + dx + 0.69, y + 0.99, -9.824],
        [0.92, 0.9, 0.84],
      );
  }
}
export const buildTolbiacSkyline = (o) => buildTolbiacBrowser(o, 'skyline');
export const buildTolbiacDistrict = (o) => buildTolbiacBrowser(o, 'district');
export const buildTolbiacStreet = (o) => buildTolbiacBrowser(o, 'street');
export const buildTolbiacCloseup = (o) => buildTolbiacBrowser(o, 'closeup');
