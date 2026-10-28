/** Original photo-led Pupin Bridge exterior; no downloaded geometry or private textures. */
import {
  beam,
  beamPath,
  chamferedRectangle,
  cross,
  loft,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';
import { pupinPiers } from './pupin-plan.mjs';

export const pupinControls = {
  originMeters: 64.2,
  waterY: 1.4533966064453,
  halfLength: 746.095,
  width: 29.107,
  main: [-746.095, -651.095, -479.095, -384.095],
  // Standard-terrain visualization grade, not a measured structural profile.
  profile: [
    [-746.095, 24.8],
    [-651.095, 25.3],
    [-479.095, 25.3],
    [-384.095, 25],
    [0, 23.8],
    [300, 19.5],
    [550, 12.7],
    [746.095, 4.8],
  ],
  piers: pupinPiers,
};
const C = pupinControls;
export const pupinSurfaces = {
  far: { slot: 'foundation', localRef: 'palette:#ffffff', roughness: 1, metallic: 0 },
  concrete: { slot: 'wall', graph: 'concrete_plain', roughness: 0.96, metallic: 0 },
  paving: { slot: 'foundation', graph: 'concrete_plain', roughness: 1, metallic: 0 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.74, metallic: 0.2 },
};
const linear = (hex) =>
  hex.match(/../g).map((h) => {
    const s = Number.parseInt(h, 16) / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
const color = {
  concrete: linear('d2cec5'),
  edge: linear('e0dcd1'),
  paving: linear('bbb9af'),
  road: linear('56595b'),
  line: linear('eee9d4'),
  metal: linear('c8c9c5'),
  bearing: linear('555c60'),
  lamp: linear('e7e4d9'),
};
const config = {
  skyline: { curve: 2, detail: -1 },
  district: { curve: 5, detail: 0 },
  street: { curve: 14, detail: 1 },
  closeup: { curve: 28, detail: 2 },
  master: { curve: 44, detail: 3 },
};
export function pupinDeckY(x) {
  for (let i = 1; i < C.profile.length; i++) {
    const [a, y] = C.profile[i - 1],
      [b, v] = C.profile[i];
    if (x <= b) return y + Math.max(0, Math.min(1, (x - a) / (b - a))) * (v - y);
  }
  return C.profile.at(-1)[1];
}
export const pupinWalkOffset = (x) =>
  0.18 * Math.max(0, Math.min(1, (C.halfLength - Math.abs(x)) / 14));
export function pupinGirderDepth(x) {
  const [a, b, c, d] = C.main;
  if (x < b) {
    const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
    return 2.4 + 6.6 * t * t;
  }
  if (x < c) {
    const t = (x - b) / (c - b);
    return 2.4 + 6.6 * (2 * t - 1) ** 2;
  }
  if (x < d) {
    const t = (x - c) / (d - c);
    return 2.4 + 6.6 * (1 - t) ** 2;
  }
  return 2.2 - 0.9 * Math.max(0, Math.min(1, (x - 500) / (C.halfLength - 500)));
}
const unique = (values) => [...new Set(values)].sort((a, b) => a - b);
function writer(out, far) {
  const emit = (slot, _ref, p, hint, _uv, tint) => {
    for (let i = 1; i < p.length - 1; i++) {
      let t = [p[0], p[i], p[i + 1]],
        n = normalFor(...t);
      if (hint && n.reduce((sum, v, j) => sum + v * hint[j], 0) < 0) t = [t[0], t[2], t[1]];
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
      const y = pupinDeckY(x) + (typeof offset === 'function' ? offset(x) : offset);
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
const walkStations = () =>
  unique([...C.profile.map((p) => p[0]), -C.halfLength + 14, C.halfLength - 14]);
function deck(o, cfg) {
  const xs = unique([
    ...C.profile.map((p) => p[0]),
    ...C.main.flatMap((x, i) =>
      i
        ? Array.from(
            { length: cfg.curve + 1 },
            (_, j) => C.main[i - 1] + ((x - C.main[i - 1]) * j) / cfg.curve,
          )
        : [x],
    ),
  ]);
  for (const sign of [-1, 1]) {
    const mid = sign * 7.45;
    if (cfg.detail < 0) {
      loft(
        o,
        'concrete',
        xs.map((x) => {
          const y = pupinDeckY(x);
          return [
            [x, y - pupinGirderDepth(x), mid - 7.1],
            [x, y, mid - 7.1],
            [x, y, mid + 7.1],
            [x, y - pupinGirderDepth(x), mid + 7.1],
          ];
        }),
        color.concrete,
      );
    } else {
      slab(
        o,
        'concrete',
        C.profile.map((p) => p[0]),
        mid - 7.1,
        mid + 7.1,
        0,
        0.45,
        color.concrete,
      );
      loft(
        o,
        'concrete',
        xs.map((x) => {
          const y = pupinDeckY(x);
          return [
            [x, y - pupinGirderDepth(x), mid - 3.65],
            [x, y - 0.36, mid - 5.65],
            [x, y - 0.36, mid + 5.65],
            [x, y - pupinGirderDepth(x), mid + 3.65],
          ];
        }),
        color.concrete,
      );
      slab(
        o,
        'concrete',
        walkStations(),
        sign < 0 ? -14.55 : 11.15,
        sign < 0 ? -11.15 : 14.55,
        (x) => pupinWalkOffset(x) + 0.015,
        0.22,
        color.paving,
      );
      slab(
        o,
        'concrete',
        walkStations(),
        sign < 0 ? -14.55 : 14.27,
        sign < 0 ? -14.27 : 14.55,
        (x) => pupinWalkOffset(x) + 0.18,
        0.2,
        color.edge,
      );
    }
    slab(
      o,
      'paving',
      C.profile.map((p) => p[0]),
      sign < 0 ? -11.05 : 0.85,
      sign < 0 ? -0.85 : 11.05,
      0.015,
      0.025,
      color.road,
    );
  }
}
function piers(o, cfg) {
  for (const p of C.piers)
    for (const [side, ground] of p.ground.entries()) {
      const z = side ? 7.45 : -7.45,
        base = ground - C.originMeters - 0.8,
        top = pupinDeckY(p.x) - pupinGirderDepth(p.x) - 0.16;
      if (top <= base + 0.4) continue;
      const width = p.main ? 4.8 : 2.1,
        depth = p.main ? 5.6 : 3;
      if (cfg.detail < 0) {
        box(
          o,
          'concrete',
          [p.x - width / 2, base, z - depth / 2],
          [p.x + width / 2, top, z + depth / 2],
          color.concrete,
        );
        continue;
      }
      box(
        o,
        'concrete',
        [p.x - width * 0.8, base, z - depth * 0.75],
        [p.x + width * 0.8, base + 0.85, z + depth * 0.75],
        color.concrete,
      );
      if (cfg.detail <= 1)
        box(
          o,
          'concrete',
          [p.x - width / 2, base + 0.6, z - depth / 2],
          [p.x + width / 2, top - 0.65, z + depth / 2],
          color.concrete,
        );
      else
        loft(
          o,
          'concrete',
          [
            [base + 0.6, width, depth],
            [Math.max(base + 0.9, top - 1), width, depth],
            [top - 0.3, width + 0.35, depth + (p.main ? 0.4 : 1.2)],
          ].map(([y, w, d]) => chamferedRectangle(p.x, y, z, w, d, 0.3)),
          color.concrete,
        );
      box(
        o,
        'concrete',
        [p.x - (p.main ? 2.8 : 1.8), top - 0.7, z - (p.main ? 4.2 : 5.3)],
        [p.x + (p.main ? 2.8 : 1.8), top + (cfg.detail === 0 ? 0.16 : 0), z + (p.main ? 4.2 : 5.3)],
        color.concrete,
      );
      if (cfg.detail >= 1) {
        for (const dz of [-3, 3])
          box(
            o,
            'metal',
            [p.x - 0.6, top, z + dz - 0.5],
            [p.x + 0.6, top + 0.2, z + dz + 0.5],
            color.bearing,
          );
        if (cfg.detail >= 2 && !p.main) {
          for (const dz of [-3.2, 3.2])
            beam(
              o,
              'concrete',
              [p.x, top - 1.2, z + Math.sign(dz) * 1.5],
              [p.x, top - 0.25, z + dz],
              0.5,
              0.55,
              color.concrete,
            );
        }
      }
    }
  // End abutment faces are bounded to the bridge footprint; approach terrain stays independent.
  for (const side of [-1, 1]) {
    const x = side * C.halfLength,
      ground = side < 0 ? 18.1 : 3.4,
      y = pupinDeckY(x);
    box(o, 'concrete', [x - 1.2, ground, -14.55], [x + 1.2, y - 0.35, 14.55], color.concrete);
    slab(o, 'paving', [x - 1.8, x + 1.8], -15.25, 15.25, 0.005, 0.3, color.paving);
  }
}
function line(o, p, tint) {
  o.addQuad('paving', 'palette:#ffffff', p, [0, 1, 0], [], tint);
}
function markings(o, cfg) {
  if (cfg.detail < 0) return;
  const step = cfg.detail === 0 ? 100 : cfg.detail === 1 ? 18 : 9,
    length = cfg.detail === 0 ? 25 : cfg.detail === 1 ? 6 : 3;
  for (const z of [-7.65, -4.25, 4.25, 7.65])
    for (let x = -C.halfLength + 2; x < C.halfLength - 2; x += step) {
      const b = Math.min(C.halfLength - 1, x + length);
      line(
        o,
        [
          [x, pupinDeckY(x) + 0.021, z - 0.065],
          [x, pupinDeckY(x) + 0.021, z + 0.065],
          [b, pupinDeckY(b) + 0.021, z + 0.065],
          [b, pupinDeckY(b) + 0.021, z - 0.065],
        ],
        color.line,
      );
    }
  if (cfg.detail >= 1)
    for (const z of [-10.75, -1.05, 1.05, 10.75])
      for (let i = 1; i < C.profile.length; i++) {
        const a = C.profile[i - 1][0],
          b = C.profile[i][0];
        line(
          o,
          [
            [a, pupinDeckY(a) + 0.021, z - 0.055],
            [a, pupinDeckY(a) + 0.021, z + 0.055],
            [b, pupinDeckY(b) + 0.021, z + 0.055],
            [b, pupinDeckY(b) + 0.021, z - 0.055],
          ],
          color.line,
        );
      }
  if (cfg.detail >= 2)
    for (const x of C.piers.map((p) => p.x))
      line(
        o,
        [
          [x - 0.04, pupinDeckY(x) + 0.022, -11],
          [x - 0.04, pupinDeckY(x) + 0.022, 11],
          [x + 0.04, pupinDeckY(x) + 0.022, 11],
          [x + 0.04, pupinDeckY(x) + 0.022, -11],
        ],
        color.bearing,
      );
}
function barriers(o, cfg) {
  if (cfg.detail < 0) return;
  const xs = C.profile.map((p) => p[0]);
  const walks = walkStations();
  for (const sign of [-1, 1]) {
    const outer = sign * 14.37,
      inner = sign * 11.15,
      median = sign * 0.68;
    if (cfg.detail === 0) {
      slab(
        o,
        'metal',
        walks,
        outer - 0.05,
        outer + 0.05,
        (x) => pupinWalkOffset(x) + 1.18,
        0.15,
        color.metal,
      );
      slab(o, 'metal', xs, median - 0.07, median + 0.07, 0.78, 0.18, color.metal);
      continue;
    }
    for (const y of [0.55, 1.18])
      slab(
        o,
        'metal',
        walks,
        outer - 0.035,
        outer + 0.035,
        (x) => pupinWalkOffset(x) + y,
        0.065,
        color.metal,
      );
    const outerStep = cfg.detail === 1 ? 8 : cfg.detail === 2 ? 4 : 2;
    for (let x = -C.halfLength + 1; x < C.halfLength; x += outerStep)
      beam(
        o,
        'metal',
        [x, pupinDeckY(x) + pupinWalkOffset(x) + 0.16, outer],
        [x, pupinDeckY(x) + pupinWalkOffset(x) + 1.18, outer],
        0.065,
        0.065,
        color.metal,
      );
    for (const z of [inner, median]) {
      for (const y of [0.46, 0.76])
        slab(o, 'metal', xs, z - 0.055, z + 0.055, y, 0.14, color.metal);
      const step = cfg.detail === 1 ? 24 : cfg.detail === 2 ? 8 : 4;
      for (let x = -C.halfLength + 1; x < C.halfLength; x += step)
        beam(
          o,
          'metal',
          [x, pupinDeckY(x), z],
          [x, pupinDeckY(x) + 0.8, z],
          0.09,
          0.1,
          color.metal,
        );
    }
  }
}
function lamps(o, cfg) {
  if (cfg.detail < 0) return;
  const step = cfg.detail === 0 ? 90 : 45;
  for (let x = -C.halfLength + 22; x < C.halfLength - 15; x += step) {
    const y = pupinDeckY(x),
      z = 0.7;
    box(o, 'concrete', [x - 0.32, y, z - 0.32], [x + 0.32, y + 0.35, z + 0.32], color.edge);
    beam(o, 'metal', [x, y + 0.25, z], [x, y + 10.2, z], 0.14, 0.14, color.metal);
    if (cfg.detail <= 1) {
      beam(o, 'metal', [x, y + 10.2, -4.8], [x, y + 10.2, 5.5], 0.12, 0.12, color.metal);
      if (cfg.detail === 1)
        for (const tip of [-4.8, 5.5])
          box(
            o,
            'metal',
            [x - 0.55, y + 10.16, tip - 0.22],
            [x + 0.55, y + 10.4, tip + 0.22],
            color.bearing,
          );
      continue;
    }
    for (const side of [-1, 1]) {
      beamPath(
        o,
        'metal',
        [
          [x, y + 9.3, z],
          [x, y + 10.25, z + side * 0.7],
          [x, y + 10.55, z + side * 2.4],
          [x, y + 10.65, z + side * 5],
        ],
        0.1,
        0.1,
        color.metal,
      );
      box(
        o,
        'metal',
        [x - 0.55, y + 10.56, z + side * 5 - 0.22],
        [x + 0.55, y + 10.8, z + side * 5 + 0.22],
        color.bearing,
      );
      box(
        o,
        'metal',
        [x - 0.46, y + 10.54, z + side * 5 - 0.18],
        [x + 0.46, y + 10.57, z + side * 5 + 0.18],
        color.lamp,
      );
    }
  }
}
export function buildPupinLevel(target, level = 'master') {
  const cfg = config[level];
  if (!cfg) throw Error('Unknown Pupin level');
  const o = writer(target, level === 'skyline');
  deck(o, cfg);
  piers(o, cfg);
  markings(o, cfg);
  barriers(o, cfg);
  lamps(o, cfg);
}
export const buildPupinSkyline = (o) => buildPupinLevel(o, 'skyline');
export const buildPupinDistrict = (o) => buildPupinLevel(o, 'district');
export const buildPupinStreet = (o) => buildPupinLevel(o, 'street');
export const buildPupinCloseup = (o) => buildPupinLevel(o, 'closeup');
