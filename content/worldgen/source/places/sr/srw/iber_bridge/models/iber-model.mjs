/** Original main Ibër Bridge: paired swept perforated canopies, concrete crossing and cable-linked lamps. */
import {
  beam,
  beamPath,
  cross,
  loft,
  normalFor,
  normalize,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

export const iberControls = {
  originMeters: 498.8518249511719,
  waterY: 0.8,
  halfLength: 49.47457730957641,
  bodyHalfLength: 45.6,
  width: 23.2,
  profile: [
    [-49.47457730957641, 7.55],
    [-45.6, 7.6],
    [-15.2, 8.3],
    [15.2, 8.3],
    [45.6, 7.2],
    [49.47457730957641, 7.15],
  ],
  piers: [-15.2, 15.2],
  canopyInner: 7.1,
  canopyOuter: 10.8,
  lampStations: [-40, -26.666667, -13.333333, 0, 13.333333, 26.666667, 40],
};
const C = iberControls;
export const iberSurfaces = {
  far: { slot: 'foundation', localRef: 'palette:#ffffff', roughness: 1, metallic: 0 },
  concrete: { slot: 'wall', graph: 'concrete_plain', roughness: 0.96, metallic: 0 },
  road: { slot: 'foundation', graph: 'concrete_plain', roughness: 1, metallic: 0 },
  paving: { slot: 'foundation', graph: 'stone_granite', roughness: 1, metallic: 0 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.65, metallic: 0.25 },
  canopy: {
    slot: 'roof',
    graph: 'metal_perforated_round',
    roughness: 0.72,
    metallic: 0.25,
    doubleSided: true,
  },
};
const linear = (hex) =>
  hex.match(/../g).map((h) => {
    const s = Number.parseInt(h, 16) / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
const color = {
  concrete: linear('d2cfc7'),
  paving: linear('bcb6a8'),
  road: linear('66676a'),
  steel: linear('d8d9d3'),
  roof: linear('deded5'),
  dark: linear('384849'),
  mark: linear('d8d6c9'),
  glass: linear('ede5ce'),
};
const config = {
  skyline: { curve: 3, roof: 8, detail: -1 },
  district: { curve: 8, roof: 12, detail: 0 },
  street: { curve: 16, roof: 32, detail: 1 },
  closeup: { curve: 32, roof: 64, detail: 2 },
  master: { curve: 52, roof: 96, detail: 3 },
};
export function iberDeckY(x) {
  for (let i = 1; i < C.profile.length; i++) {
    const [a, y] = C.profile[i - 1],
      [b, v] = C.profile[i];
    if (x <= b) return y + Math.max(0, Math.min(1, (x - a) / (b - a))) * (v - y);
  }
  return C.profile.at(-1)[1];
}
export const iberWalkOffset = (x) =>
  0.18 * Math.max(0, Math.min(1, (C.halfLength - Math.abs(x)) / 7));
export function iberGirderDepth(x) {
  const cuts = [-45.6, -15.2, 15.2, 45.6];
  for (let i = 1; i < cuts.length; i++)
    if (x <= cuts[i]) {
      const t = Math.max(0, Math.min(1, (x - cuts[i - 1]) / (cuts[i] - cuts[i - 1])));
      return 1.1 + 2 * (2 * t - 1) ** 2;
    }
  return 3.1;
}
export function iberCanopyPoint(x, side, edge) {
  const t = Math.max(-1, Math.min(1, x / C.bodyHalfLength)),
    shape = Math.max(0, 1 - t * t),
    outer = C.canopyOuter;
  const z = edge === 'inner' ? outer - (outer - C.canopyInner) * shape : outer;
  const y = iberDeckY(x) + iberWalkOffset(x) + 0.45 + (edge === 'inner' ? 6.25 : 3.25) * shape;
  return [x, y, side * z];
}
const unique = (xs) => [...new Set(xs)].sort((a, b) => a - b),
  profileXs = () => C.profile.map((p) => p[0]),
  walkXs = () => unique([...profileXs(), -C.halfLength + 7, C.halfLength - 7]);
function writer(out, far) {
  const emit = (slot, _ref, p, hint, _uv, tint) => {
    for (let i = 1; i < p.length - 1; i++) {
      let t = [p[0], p[i], p[i + 1]],
        n = normalFor(...t);
      if (hint && n.reduce((s, v, j) => s + v * hint[j], 0) < 0) t = [t[0], t[2], t[1]];
      const area = cross(
        t[1].map((v, j) => v - t[0][j]),
        t[2].map((v, j) => v - t[0][j]),
      );
      if (Math.hypot(...area) < 1e-9) continue;
      out.addTriangle(
        far ? 'far' : slot,
        'palette:#ffffff',
        t,
        normalFor(...t),
        [
          [0, 0],
          [1, 0],
          [1, 1],
        ],
        far ? tint.map((v) => v * 0.65) : tint,
      );
    }
  };
  return Object.fromEntries(['addTriangle', 'addQuad', 'addConvexPolygon'].map((k) => [k, emit]));
}
function slab(o, slot, xs, z0, z1, offset, depth, tint) {
  loft(
    o,
    slot,
    xs.map((x) => {
      const y = iberDeckY(x) + (typeof offset === 'function' ? offset(x) : offset);
      return [
        [x, y - depth, z0],
        [x, y, z0],
        [x, y, z1],
        [x, y - depth, z1],
      ];
    }),
    tint,
  );
}
function tube(o, slot, points, radius, sides, tint) {
  const rings = points.map((p, i) => {
    const a = points[Math.max(0, i - 1)],
      b = points[Math.min(points.length - 1, i + 1)],
      axis = normalize(b.map((v, j) => v - a[j])),
      u = normalize(cross(axis, Math.abs(axis[1]) < 0.95 ? [0, 1, 0] : [1, 0, 0])),
      v = cross(axis, u);
    return Array.from({ length: sides }, (_, j) => {
      const angle = (j * Math.PI * 2) / sides;
      return p.map((n, k) => n + radius * (Math.cos(angle) * u[k] + Math.sin(angle) * v[k]));
    });
  });
  loft(o, slot, rings, tint);
}
function crossing(o, cfg) {
  slab(o, 'concrete', profileXs(), -11.6, 11.6, 0, 0.6, color.concrete);
  slab(o, 'road', profileXs(), -6.1, 6.1, 0.016, 0.03, color.road);
  for (const side of [-1, 1]) {
    slab(
      o,
      'paving',
      walkXs(),
      side < 0 ? -11.6 : 6.1,
      side < 0 ? -6.1 : 11.6,
      (x) => iberWalkOffset(x) + 0.016,
      0.23,
      color.paving,
    );
    if (cfg.detail >= 0)
      tube(
        o,
        'concrete',
        profileXs().map((x) => [x, iberDeckY(x) - 0.12, side * 11.5]),
        0.32,
        cfg.detail >= 2 ? 12 : 6,
        color.concrete,
      );
  }
  const intervals = [-45.6, -15.2, 15.2, 45.6],
    xs = unique(
      intervals.flatMap((b, i) =>
        i
          ? Array.from(
              { length: cfg.curve + 1 },
              (_, j) => intervals[i - 1] + ((b - intervals[i - 1]) * j) / cfg.curve,
            )
          : [b],
      ),
    );
  for (const z of [-8.8, -2.9, 2.9, 8.8])
    loft(
      o,
      'concrete',
      xs.map((x) => {
        const y = iberDeckY(x);
        return [
          [x, y - iberGirderDepth(x), z - 0.6],
          [x, y - 0.45, z - 1.05],
          [x, y - 0.45, z + 1.05],
          [x, y - iberGirderDepth(x), z + 0.6],
        ];
      }),
      color.concrete,
    );
  for (const x of C.piers) {
    const top = iberDeckY(x) - 3.05,
      base = -0.2;
    loft(
      o,
      'concrete',
      [-9.9, 9.9].map((z) => [
        [x - 1.35, base, z],
        [x + 1.35, base, z],
        [x + 4.1, top, z],
        [x - 4.1, top, z],
      ]),
      color.concrete,
    );
    box(o, 'concrete', [x - 4.3, top - 0.15, -10.8], [x + 4.3, top + 0.28, 10.8], color.concrete);
    if (cfg.detail >= 1) {
      box(o, 'concrete', [x - 2.2, -0.35, -10.5], [x + 2.2, 0.35, 10.5], color.concrete);
      for (const z of [-8.8, -2.9, 2.9, 8.8])
        box(
          o,
          'metal',
          [x - 0.8, top + 0.2, z - 0.45],
          [x + 0.8, top + 0.36, z + 0.45],
          color.dark,
        );
    }
  }
  for (const side of [-1, 1]) {
    const a = side < 0 ? -C.halfLength - 1.5 : 45,
      b = side < 0 ? -45 : C.halfLength + 1.5;
    slab(o, 'concrete', [a, b], -11.6, 11.6, -0.35, 3.3, color.concrete);
    slab(o, 'paving', [a, b], -12.8, 12.8, 0.005, 0.35, color.paving);
  }
}
function canopies(o, cfg) {
  for (const side of [-1, 1]) {
    const xs = Array.from({ length: cfg.roof + 1 }, (_, i) => -45.6 + (91.2 * i) / cfg.roof);
    for (let i = 1; i < xs.length; i++) {
      const a = xs[i - 1],
        b = xs[i],
        p = [
          iberCanopyPoint(a, side, 'inner'),
          iberCanopyPoint(a, side, 'outer'),
          iberCanopyPoint(b, side, 'outer'),
          iberCanopyPoint(b, side, 'inner'),
        ];
      o.addQuad('canopy', 'palette:#ffffff', p, [0, 1, 0], [], color.roof);
    }
    if (cfg.detail < 0) continue;
    const sides = cfg.detail >= 2 ? 10 : 6;
    for (const edge of ['inner', 'outer'])
      tube(
        o,
        'metal',
        xs.map((x) => iberCanopyPoint(x, side, edge)),
        0.12,
        sides,
        color.steel,
      );
    const step = cfg.detail === 0 ? 6 : cfg.detail === 1 ? 2 : cfg.detail === 2 ? 1 : 0.65;
    for (let x = -44.8; x < 45; x += step)
      beam(
        o,
        'metal',
        iberCanopyPoint(Math.max(-45.5, x - 0.24), side, 'inner'),
        iberCanopyPoint(Math.min(45.5, x + 0.24), side, 'outer'),
        0.085,
        0.11,
        color.steel,
      );
  }
}
function rails(o, cfg) {
  for (const side of [-1, 1]) {
    const z = side * 11.35;
    if (cfg.detail < 0) {
      slab(
        o,
        'metal',
        walkXs(),
        z - 0.06,
        z + 0.06,
        (x) => iberWalkOffset(x) + 1.12,
        0.13,
        color.dark,
      );
      continue;
    }
    for (const y of [0.4, 1.12])
      slab(
        o,
        'metal',
        walkXs(),
        z - 0.045,
        z + 0.045,
        (x) => iberWalkOffset(x) + y,
        0.075,
        color.dark,
      );
    const step = cfg.detail === 0 ? 12 : cfg.detail === 1 ? 0.75 : cfg.detail === 2 ? 0.36 : 0.18;
    for (let x = -C.halfLength + 0.45; x < C.halfLength - 0.3; x += step) {
      const y = iberDeckY(x) + iberWalkOffset(x);
      beam(o, 'metal', [x, y + 0.18, z], [x, y + 1.12, z], 0.038, 0.045, color.dark);
    }
    for (let x = -C.halfLength + 0.5; x < C.halfLength; x += cfg.detail === 0 ? 9 : 3) {
      const y = iberDeckY(x) + iberWalkOffset(x);
      box(o, 'metal', [x - 0.09, y + 0.14, z - 0.09], [x + 0.09, y + 1.3, z + 0.09], color.dark);
      if (cfg.detail >= 2)
        box(
          o,
          'metal',
          [x - 0.13, y + 1.26, z - 0.13],
          [x + 0.13, y + 1.35, z + 0.13],
          color.steel,
        );
    }
  }
}
function lamps(o, cfg) {
  for (const side of [-1, 1]) {
    const z = side * 6.45;
    for (const x of C.lampStations) {
      const y = iberDeckY(x) + iberWalkOffset(x);
      if (cfg.detail < 0) {
        beam(o, 'metal', [x, y, z], [x, y + 9.7, z], 0.24, 0.24, color.dark);
        continue;
      }
      box(o, 'concrete', [x - 0.46, y, z - 0.46], [x + 0.46, y + 0.24, z + 0.46], color.concrete);
      loft(
        o,
        'metal',
        [
          [y + 0.2, 0.37],
          [y + 1, 0.19],
          [y + 9.2, 0.15],
        ].map(([v, w]) => [
          [x - w, v, z - w],
          [x - w, v, z + w],
          [x + w, v, z + w],
          [x + w, v, z - w],
        ]),
        color.dark,
      );
      box(o, 'metal', [x - 0.16, y + 9.15, z - 0.16], [x + 0.16, y + 9.8, z + 0.16], color.glass);
      beam(o, 'metal', [x, y + 7.25, z], [x, y + 7.05, side * 3.5], 0.065, 0.08, color.dark);
      box(
        o,
        'metal',
        [x - 0.43, y + 6.96, side * 3.5 - 0.2],
        [x + 0.43, y + 7.15, side * 3.5 + 0.2],
        color.dark,
      );
      if (cfg.detail >= 1) {
        beam(
          o,
          'metal',
          [x, y + 8, z],
          iberCanopyPoint(x, side, 'inner'),
          0.055,
          0.055,
          color.dark,
        );
        box(
          o,
          'metal',
          [x - 0.32, y + 6.93, side * 3.5 - 0.15],
          [x + 0.32, y + 6.97, side * 3.5 + 0.15],
          color.glass,
        );
      }
    }
    if (cfg.detail >= 1)
      for (let i = 1; i < C.lampStations.length; i++) {
        const a = C.lampStations[i - 1],
          b = C.lampStations[i],
          n = cfg.detail === 1 ? 4 : cfg.detail === 2 ? 8 : 12;
        for (const offset of [0, 0.15])
          beamPath(
            o,
            'metal',
            Array.from({ length: n + 1 }, (_, j) => {
              const t = j / n,
                x = a + (b - a) * t;
              return [x, iberDeckY(x) + 8.9 - 0.55 * 4 * t * (1 - t) + offset, z];
            }),
            0.018,
            0.02,
            color.dark,
          );
      }
  }
}
function roadLine(o, cfg) {
  if (cfg.detail < 1) return;
  for (let x = -43; x < 44; x += 8) {
    const b = Math.min(44, x + 3);
    o.addQuad(
      'road',
      'palette:#ffffff',
      [
        [x, iberDeckY(x) + 0.022, -0.05],
        [x, iberDeckY(x) + 0.022, 0.05],
        [b, iberDeckY(b) + 0.022, 0.05],
        [b, iberDeckY(b) + 0.022, -0.05],
      ],
      [0, 1, 0],
      [],
      color.mark,
    );
  }
}
export function buildIberLevel(target, level = 'master') {
  const cfg = config[level];
  if (!cfg) throw Error('Unknown Iber level');
  const o = writer(target, level === 'skyline');
  crossing(o, cfg);
  canopies(o, cfg);
  rails(o, cfg);
  lamps(o, cfg);
  roadLine(o, cfg);
}
export const buildIberSkyline = (o) => buildIberLevel(o, 'skyline');
export const buildIberDistrict = (o) => buildIberLevel(o, 'district');
export const buildIberStreet = (o) => buildIberLevel(o, 'street');
export const buildIberCloseup = (o) => buildIberLevel(o, 'closeup');
