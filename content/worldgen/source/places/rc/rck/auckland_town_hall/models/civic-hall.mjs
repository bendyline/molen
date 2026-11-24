import {
  beamPath,
  loft,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { cleanRing } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import {
  facade,
  fan,
  fbox,
  opening,
  outwardRing,
  quad4,
  rgb,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import {
  archOver,
  cap,
  clock,
} from '../../../../r1/r1f/adelaide_railway_station/models/classical.mjs';
import site from '../site-controls.json' with { type: 'json' };

export const surfaces = {
  sandstone: { slot: 'wall', graph: 'stone_limestone', roughness: 0.94 },
  stone: { slot: 'trim', graph: 'stone_limestone_raw', roughness: 0.91 },
  basalt: { slot: 'foundation', graph: 'stone_basalt', roughness: 0.96 },
  roof: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.86 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.81 },
  copper: { slot: 'roof', graph: 'metal_copper', roughness: 0.86 },
  glazing: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.52 },
  canopyGlass: {
    slot: 'window',
    localRef: 'palette:#e5f3f9',
    roughness: 0.36,
    alphaMode: 'BLEND',
    baseColorFactor: [1, 1, 1, 0.63],
    doubleSided: true,
  },
};
const stone = rgb('c6bda8'),
  beige = rgb('aa9e89'),
  trim = rgb('d0c6ae');
const shadow = rgb('555a55'),
  dark = rgb('646460'),
  roof = rgb('777f7c');
const copper = rgb('63908a'),
  glass = rgb('57606a'),
  wood = rgb('514138');
const eave = 12.09,
  base = site.foundationBottom;
const outer = outwardRing(cleanRing(site.outline));
const edges = (ring) => outwardRing(ring).map((a, i, r) => wallFace(a, r[(i + 1) % r.length]));
const panel = (out, slot, f, a, b, y0, y1, d, color) => {
  const p = f.P;
  quad4(out, slot, p(a, y0, d), p(b, y0, d), p(b, y1, d), p(a, y1, d), color);
};

function walls(out, detail) {
  for (const f of edges(outer)) {
    const L = f.length;
    panel(out, 'basalt', f, 0, L, base, 2.22, 0, dark);
    panel(out, 'sandstone', f, 0, L, 2.22, eave, 0, stone);
    if (detail > 0 || L > 3.5) {
      if (detail > 0) {
        panel(out, 'stone', f, 0, L, 2.13, 2.38, 0.09, trim);
        panel(out, 'stone', f, 0, L, 8.28, 8.46, 0.13, trim);
      }
      panel(out, 'stone', f, 0, L, eave - 0.49, eave - 0.11, 0.22, beige);
    }
    if (detail === 0) continue;
    if (L < 1.05) continue;
    const count = Math.max(1, Math.round(L / 4.21)),
      step = L / count;
    const w = Math.min(1.58, step * 0.58);
    const large = L > 4 && detail > 0;
    for (let i = 0; i < count; i++) {
      const u = (i + 0.5) * step;
      if (large) {
        const y = 4.1,
          high = 7.12;
        panel(out, 'glazing', f, u - w * 0.5, u + w * 0.5, y, high, 0.035, glass);
        if (detail > 1) {
          fbox(out, 'stone', f, u - w * 0.5 - 0.14, u - w * 0.5 + 0.02, y, high, 0.018, 0.16, trim);
          fbox(out, 'stone', f, u + w * 0.5 - 0.02, u + w * 0.5 + 0.14, y, high, 0.018, 0.16, trim);
          fbox(
            out,
            'stone',
            f,
            u - w * 0.5 - 0.21,
            u + w * 0.5 + 0.21,
            y - 0.18,
            y - 0.025,
            0.02,
            0.22,
            beige,
          );
          fbox(
            out,
            'stone',
            f,
            u - w * 0.5 - 0.22,
            u + w * 0.5 + 0.22,
            high + 0.015,
            high + 0.25,
            0.018,
            0.29,
            trim,
          );
          fbox(out, 'metal', f, u - 0.048, u + 0.048, y, high, 0.048, 0.088, shadow);
          fbox(out, 'metal', f, u - w * 0.5, u + w * 0.5, y + 1.26, y + 1.32, 0.048, 0.088, shadow);
        }
      }
      panel(out, 'glazing', f, u - w * 0.42, u + w * 0.42, 9.05, 10.93, 0.038, glass);
      if (detail > 1) {
        fbox(out, 'stone', f, i * step - 0.13, i * step + 0.13, 3.95, 7.92, 0, 0.2, trim);
        fbox(out, 'stone', f, u - w * 0.45, u + w * 0.45, 8.88, 9.05, 0.041, 0.2, trim);
      }
    }
    if (detail > 1) {
      for (let j = 0; j < L; j += detail === 3 ? 0.62 : 1.2)
        fbox(out, 'stone', f, j, Math.min(j + 0.17, L), 11.42, 11.66, 0.025, 0.25, trim);
      if (L > 5)
        for (const y of [-0.33, 0.34, 1.01, 1.68])
          panel(out, 'basalt', f, 0, L, y, y + 0.055, 0.063, rgb('75716b'));
    }
  }
  cap(out, 'roof', outer, eave, roof);
}

function entries(out, detail) {
  for (const { point, wall, grade } of site.entrances) {
    const edge = wallFace(...wall),
      f = facade(point, edge.along);
    const side = detail > 0 ? 0.31 : 0.24;
    const y = grade,
      spring = y + 2.17,
      top = y + 3.65;
    fbox(out, 'basalt', f, -1.54, 1.54, base, y, -0.12, 1.44, dark);
    for (const sign of [-1, 1]) {
      const u = sign * 1.11;
      fbox(out, 'stone', f, u - side, u + side, y, top, 0, 0.63, trim);
      fbox(out, 'basalt', f, u - side - 0.07, u + side + 0.07, y, y + 0.28, -0.02, 0.69, dark);
    }
    if (detail > 1) archOver(out, f, 0, 0.95, spring, top, 0.59, detail);
    else fbox(out, 'stone', f, -0.97, 0.97, spring + 0.65, top, 0, 0.63, trim, true);
    panel(out, 'glazing', f, -0.96, 0.96, y, top, 0.026, wood);
    fbox(out, 'stone', f, -1.47, 1.47, top - 0.12, top + 0.08, -0.02, 0.82, beige, true);
    if (detail > 1) {
      fbox(out, 'metal', f, -0.058, 0.058, y + 0.019, spring + 0.16, 0.05, 0.082, shadow);
      fbox(out, 'metal', f, -0.96, 0.96, spring - 0.06, spring + 0.015, 0.05, 0.09, shadow);
    }
  }
}

function panelRoofs(out, detail) {
  for (const { kind, roof: y, outline } of site.roofs) {
    const wall = kind === 'glass' || kind === 'canopy';
    const ring = outwardRing(cleanRing(outline));
    const eaveY = wall ? y - 0.16 : kind === 'great' ? 12.8 : 12.53;
    const bottom = wall ? eaveY - 0.17 : eave - 0.3;
    for (const f of edges(ring))
      panel(out, wall ? 'stone' : 'sandstone', f, 0, f.length, bottom, eaveY, 0, beige);
    if (wall) {
      cap(
        out,
        kind === 'glass' ? 'canopyGlass' : 'roof',
        ring,
        eaveY,
        kind === 'glass' ? rgb('96a7af') : roof,
      );
      if (detail > 0) {
        const ports = ring.filter((_, i) => i % Math.max(1, Math.floor(ring.length / 4)) === 0);
        for (const point of ports) {
          const F = facade(point, [1, 0]);
          fbox(
            out,
            'metal',
            F,
            -0.082,
            0.082,
            kind === 'glass' ? -1.25 : 1.47,
            eaveY,
            -0.079,
            0.087,
            shadow,
          );
        }
      }
    } else {
      const [x, z] = ring.reduce(
        ([a, b], [x, z]) => [a + x / ring.length, b + z / ring.length],
        [0, 0],
      );
      const taper = kind === 'admin' ? 0.24 : 0.44;
      const shape = ring.map(([a, b]) => [x + (a - x) * taper, z + (b - z) * taper]);
      for (let i = 0; i < ring.length; i++) {
        const j = (i + 1) % ring.length,
          [a, b] = ring[i],
          [c, d] = ring[j],
          [e, k] = shape[j],
          [h, l] = shape[i];
        quad4(out, 'roof', [a, eaveY, b], [c, eaveY, d], [e, y, k], [h, y, l], roof);
      }
      cap(out, 'roof', shape, y, roof);
      if (detail > 1) {
        const sl = edges(shape).filter((f) => f.length > 2.5);
        for (const f of sl)
          panel(out, 'stone', f, 0, f.length, y - 0.02, y + 0.19, 0.04, rgb('9d9f96'));
        if (kind === 'great')
          for (const u of [-5.2, 0, 5.2]) {
            const f = facade([x + u * 0.72, z - u * 0.69], [0.72, -0.69]);
            fbox(out, 'sandstone', f, -0.53, 0.53, y - 0.12, y + 0.6, -0.56, 0.56, trim);
            fbox(out, 'roof', f, -0.61, 0.61, y + 0.53, y + 0.79, -0.61, 0.61, roof);
            fbox(out, 'stone', f, -0.41, 0.41, y + 0.79, y + 1.05, -0.37, 0.37, trim);
          }
      }
    }
  }
}

const {
  center: [tx, tz],
  angle,
} = site.tower;
const plan = (x, z) => [
  tx + x * Math.cos(angle) - z * Math.sin(angle),
  tz + x * Math.sin(angle) + z * Math.cos(angle),
];
const towerRing = (size) =>
  [
    [-1, -1],
    [-1, 1],
    [1, 1],
    [1, -1],
  ].map(([x, z]) => plan((x * size) / 2, (z * size) / 2));
const octagon = (size) =>
  [
    [-1, -0.69],
    [-1, 0.69],
    [-0.69, 1],
    [0.69, 1],
    [1, 0.69],
    [1, -0.69],
    [0.69, -1],
    [-0.69, -1],
  ].map(([x, z]) => plan((x * size) / 2, (z * size) / 2));
function tier(out, color, profile, slot = 'sandstone') {
  loft(
    out,
    slot,
    profile.map(([y, w]) => towerRing(w).map(([x, z]) => [x, y, z])),
    color,
  );
}

function lantern(out, detail) {
  const high = 32.13,
    low = 27.26,
    ring = detail === 0 ? towerRing(4.12) : octagon(4.12);
  for (const f of edges(ring)) {
    if (f.length < 1.4) {
      fbox(out, 'stone', f, 0, f.length, low, high, -0.16, 0, trim);
      continue;
    }
    const l = f.length / 2,
      r = detail === 0 ? 0.68 : 1.02,
      spring = 30.04;
    fbox(out, 'stone', f, 0, l - r, low, high, -0.4, 0, trim);
    fbox(out, 'stone', f, l + r, f.length, low, high, -0.4, 0, trim);
    if (detail > 1) archOver(out, f, l, r, spring, high, 0.45, detail);
    else panel(out, 'stone', f, l - r, l + r, spring + 0.57, high, 0.018, trim);
    if (detail > 0) {
      fbox(out, 'stone', f, l - r, l + r, low, low + 0.18, -0.38, 0.06, beige);
      if (detail > 1)
        for (let i = 0; i < 5; i++) {
          const u = l - r + 0.22 + (i * (2 * r - 0.44)) / 4;
          fbox(out, 'metal', f, u - 0.042, u + 0.042, low + 0.17, low + 0.95, -0.24, -0.17, shadow);
        }
    }
  }
  const capProfile = [
    [32.04, 4.2],
    [32.28, 4.5],
    [32.57, 4.29],
    [32.82, 3.77],
  ];
  if (detail === 0) tier(out, trim, capProfile, 'stone');
  else
    loft(
      out,
      'stone',
      capProfile.map(([y, w]) => octagon(w).map(([x, z]) => [x, y, z])),
      trim,
    );
  const sizes = [12, 18, 28, 40][detail];
  const dome = [
    [32.79, 1.86],
    [33.1, 1.74],
    [33.56, 1.57],
    [34.19, 1.25],
    [34.71, 0.76],
    [35.01, 0.23],
  ];
  loft(
    out,
    'copper',
    dome.map(([y, r]) => radialRing(y, r, r, sizes, [tx, tz], angle)),
    copper,
  );
  if (detail > 1)
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4 + angle;
      const path = dome.map(([y, r]) => [
        tx + (r + 0.026) * Math.cos(a),
        y,
        tz + (r + 0.026) * Math.sin(a),
      ]);
      beamPath(out, 'copper', path, 0.066, 0.049, rgb('729694'));
    }
  loft(
    out,
    'metal',
    [
      [34.99, 0.18],
      [35.26, 0.28],
      [35.58, 0.19],
      [35.7, 0.087],
      [site.tower.height, 0.027],
    ].map(([y, r]) => radialRing(y, r, r, 8, [tx, tz])),
    shadow,
  );
}

function tower(out, detail) {
  const foot = site.tower.outline;
  for (const f of edges(foot)) panel(out, 'sandstone', f, 0, f.length, 10.19, 20.28, 0, stone);
  tier(
    out,
    beige,
    [
      [13.45, 5.06],
      [13.62, 5.51],
      [14.07, 5.5],
    ],
    'stone',
  );
  tier(
    out,
    trim,
    [
      [17.01, 5.08],
      [17.12, 5.52],
      [17.66, 5.61],
      [17.84, 5.06],
    ],
    'stone',
  );
  tier(out, stone, [
    [20.12, 5.07],
    [20.46, 5.74],
    [20.88, 5.74],
    [21.23, 4.69],
    [26.24, 4.69],
  ]);
  tier(
    out,
    trim,
    [
      [26.17, 4.73],
      [26.41, 5.21],
      [26.75, 5.21],
      [27.32, 4.24],
    ],
    'stone',
  );
  for (const f of edges(towerRing(4.7))) {
    if (detail === 0) {
      const path = Array.from({ length: 12 }, (_, i) =>
        f.P(
          f.length / 2 + 1.43 * Math.cos((i * Math.PI) / 6),
          23.53 + 1.43 * Math.sin((i * Math.PI) / 6),
          0.052,
        ),
      );
      fan(out, 'glazing', path, rgb('cbd0c1'));
    } else clock(out, f, f.length / 2, 23.53, 1.38, detail, 0.118);
    if (detail > 1) {
      for (const u of [0.43, f.length - 0.43])
        fbox(out, 'stone', f, u - 0.235, u + 0.235, 21.13, 26.12, 0.014, 0.21, trim);
      const mid = f.length / 2;
      const gable = [
        f.P(mid - 1.73, 26.06, 0.29),
        f.P(mid, 27.06, 0.31),
        f.P(mid + 1.73, 26.06, 0.29),
      ];
      beamPath(out, 'stone', gable, 0.18, 0.19, trim);
      const shell = Array.from({ length: 7 }, (_, i) => {
        const a = (i * Math.PI) / 6;
        return f.P(mid + Math.cos(a) * 0.46, 26.29 + Math.sin(a) * 0.43, 0.24);
      });
      beamPath(out, 'stone', shell, 0.086, 0.082, beige);
    }
  }
  if (detail > 0)
    for (const f of edges(towerRing(5.13))) {
      const w = f.length / 3.5;
      for (const u of [-w, 0, w])
        panel(
          out,
          'glazing',
          f,
          f.length / 2 + u - 0.35,
          f.length / 2 + u + 0.35,
          18.18,
          19.88,
          0.062,
          shadow,
        );
    }
  lantern(out, detail);
}

function roundedFront(out, detail) {
  if (detail === 0) return;
  const path = site.outline.slice(12, 25);
  for (let i = 0; i < path.length - 1; i++) {
    const f = wallFace(path[i], path[i + 1]);
    fbox(out, 'stone', f, -0.04, f.length + 0.04, 2.59, 3.31, 0.009, 0.45, trim);
    fbox(out, 'stone', f, -0.04, f.length + 0.04, 9.32, 9.77, 0.012, 0.49, beige);
    fbox(out, 'stone', f, -0.04, f.length + 0.04, 10.97, 11.32, 0.014, 0.55, trim);
  }
  for (const i of [0, 4, 8, 12]) {
    const point = path[i];
    const prev = path[Math.max(0, i - 1)],
      next = path[Math.min(path.length - 1, i + 1)];
    const f = wallFace(prev, next);
    const [x, z] = point.map((v, axis) => v + f.normal[axis] * 0.295);
    const sizes = [5, 9, 15, 22][detail];
    const rings = [
      [3.21, 0.45],
      [3.43, 0.45],
      [3.56, 0.3],
      [9.07, 0.245],
      [9.24, 0.31],
      [9.43, 0.41],
    ];
    loft(
      out,
      'stone',
      rings.map(([y, r]) => radialRing(y, r, r, sizes, [x, z])),
      trim,
    );
  }
  for (const i of [2, 6, 10]) {
    const p = path[i],
      f = facade(p, wallFace(path[i - 1], path[i + 1]).along);
    const r = 0.37;
    const dial = (r, d) =>
      Array.from({ length: detail === 1 ? 10 : 18 }, (_, n) => {
        const a = (n * 2 * Math.PI) / (detail === 1 ? 10 : 18);
        return f.P(Math.cos(a) * r, 4.82 + Math.sin(a) * r, d);
      });
    fan(out, 'stone', dial(r + 0.09, 0.095), trim);
    fan(out, 'glazing', dial(r, 0.113), shadow);
    if (detail > 1)
      opening(out, f, 0, 5.69, 0.95, 2.78, {
        head: 'flat',
        glassSlot: 'glazing',
        frameSlot: 'stone',
        glass,
        frame: trim,
        frameWidth: 0.1,
        frameDepth: 0.17,
        mullions: 1,
        transoms: 2,
      });
  }
  if (detail > 1)
    for (let i = 0; i < path.length - 1; i++) {
      const f = wallFace(path[i], path[i + 1]);
      fbox(out, 'stone', f, -0.032, f.length + 0.032, 11.88, 12.08, 0.02, 0.41, trim);
      fbox(out, 'stone', f, -0.043, f.length + 0.043, 12.62, 12.76, 0.012, 0.42, trim);
      const count = Math.max(1, Math.ceil(f.length / 0.27));
      for (let j = 0; j < count; j++) {
        const u = ((j + 0.5) * f.length) / count;
        fbox(out, 'stone', f, u - 0.085, u + 0.085, 12.07, 12.63, 0.14, 0.29, trim);
      }
    }
}

function build(out, detail) {
  walls(out, detail);
  panelRoofs(out, detail);
  entries(out, detail);
  roundedFront(out, detail);
  tower(out, detail);
}
export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = buildCloseup;
