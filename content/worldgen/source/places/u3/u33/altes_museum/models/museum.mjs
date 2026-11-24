import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import {
  beam,
  loft,
  radialRing,
  sphere,
  torus,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { transform } from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import {
  abox,
  extrude,
  facade,
  fbox,
  gableRoof,
  opening,
  outwardRing,
  quad4,
  rgb,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import site from '../site-controls.json' with { type: 'json' };

export const surfaces = {
  stone: { slot: 'wall', graph: 'stone_sandstone', roughness: 0.95 },
  trim: { slot: 'trim', graph: 'stone_sandstone_raw', roughness: 0.91 },
  base: { slot: 'foundation', graph: 'stone_ashlar', roughness: 0.96 },
  roof: { slot: 'roof', graph: 'slate', roughness: 0.9 },
  bronze: { slot: 'trim', graph: 'metal_copper', roughness: 0.85, metallic: 0.15 },
  plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.95 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.67 },
};
const buff = rgb('aa9c86'),
  stone = rgb('b1a38d'),
  cap = rgb('bcb096'),
  dark = rgb('766f62');
const sandstone = rgb('978b7d'),
  slate = rgb('706d68'),
  glass = rgb('546470'),
  bronze = rgb('59675c');
const pompeian = rgb('934e46'),
  plaster = rgb('bea795'),
  gold = rgb('c4a96a');
const { frontLeft: left, frontRight: right, faceZ, rearZ, count } = site.colonnade;
const center = (left + right) / 2,
  L = right - left,
  floor = -3.48,
  deck = 2.71;
const angle = (site.planAngleDegrees * Math.PI) / 180;
function placed(out) {
  const m = transform(out, -angle);
  m.addCap = (slot, ref, ring, holes, grade, n, uv, tint) => {
    const q = new MeshBufferBuilder();
    if (!q.addCap('wall', ref, ring, holes, grade, n, uv, tint)) return false;
    const { positions, indices } = q.finalize();
    for (let i = 0; i < indices.length; i += 3) {
      const p = [0, 1, 2].map((j) => positions.slice(3 * indices[i + j], 3 * indices[i + j] + 3));
      m.addTriangle(
        slot,
        ref,
        p,
        n,
        [
          [0, 0],
          [1, 0],
          [1, 1],
        ],
        tint,
      );
    }
    return true;
  };
  return m;
}
function panel(o, F, slot, a, b, y, h, d, tint) {
  const p = F.P;
  quad4(o, slot, p(a, y, d), p(b, y, d), p(b, h, d), p(a, h, d), tint);
}
function rings(o, slot, x, z, profile, n, tint) {
  loft(
    o,
    slot,
    profile.map(([y, rx, rz = rx]) => radialRing(y, rx, rz, n, [x, z], Math.PI / 4)),
    tint,
  );
}

function lowerMuseum(out, detail) {
  const eave = site.mainRoofHeight - site.mappedRoofRise;
  for (const [outer, ...holes] of site.body) {
    extrude(out, 'stone', outer, floor, eave, buff, { holes, topSlot: 'roof', topColor: slate });
    if (!detail) continue;
    for (const r of [outwardRing(outer), ...holes.map((h) => outwardRing(h).reverse())]) {
      for (const [i, a] of r.entries()) {
        const F = wallFace(a, r[(i + 1) % r.length]);
        if (F.length < 6) continue;
        const [, , z] = F.P(F.length * 0.43, 0),
          front = z > rearZ - 0.095;
        if (front) continue;
        const n = Math.max(1, Math.floor(F.length / 5.76));
        const max = Math.min(1.97, (F.length / n) * 0.57);
        for (let j = 0; j < n; j++) {
          const u = (F.length * (j + 0.5)) / n;
          for (const y of [4.83, 12.32]) {
            if (detail < 3)
              panel(out, F, 'glass', u - max / 2, u + max / 2, y, y + 3.56, 0.049, glass);
            else
              opening(out, F, u, y, max, 3.59, {
                glass,
                frame: cap,
                frameSlot: 'trim',
                frameWidth: 0.24,
                frameDepth: 0.15,
                mullions: 1,
                transoms: 1,
              });
          }
        }
        fbox(out, 'trim', F, 0.14, F.length - 0.13, 17.86, 18.43, -0.15, 0.16, stone);
      }
    }
  }
  const rear = Math.min(...site.plan.map((p) => p[1])) + 0.43;
  const width = -16.14 - rear;
  gableRoof(
    out,
    'roof',
    [left + 1.05, rear + width / 2],
    [right - 1.05, rear + width / 2],
    width,
    eave,
    site.mainRoofHeight,
    slate,
    { overhang: 0.12, endSlot: 'roof', endColor: slate },
  );
  const { ring, height, rise } = site.rotunda,
    r = outwardRing(ring);
  const base = height - rise,
    peak = [center + 0.9, height, -3.19];
  extrude(out, 'stone', r, eave - 0.15, base, stone, { top: false });
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length];
    tri(out, 'roof', [a[0], base, a[1]], [b[0], base, b[1]], peak, slate);
  }
}

function shaft(out, x, z, detail) {
  const y0 = 3.22,
    y1 = 16.53;
  if (detail === 0) {
    rings(
      out,
      'trim',
      x,
      z,
      [
        [deck, 0.94],
        [y1, 0.71],
      ],
      4,
      stone,
    );
    abox(out, 'trim', [x - 0.98, y1, z - 0.86], [x + 0.98, y1 + 0.42, z + 0.86], cap, {
      bottom: false,
    });
    return;
  }
  const n = detail === 1 ? 8 : detail === 2 ? 18 : 60;
  const profile =
    detail === 1
      ? [
          [deck, 0.94],
          [3.06, 0.83],
          [3.37, 0.75],
          [y1, 0.638],
        ]
      : [
          [deck, 0.94],
          [deck + 0.24, 0.94],
          [deck + 0.37, 0.83],
          [y0, 0.83],
          [y0 + 0.15, 0.755],
          [9.56, 0.703],
          [y1, 0.638],
        ];
  const fluted = (y, r) => {
    const points = radialRing(y, r, r, n, [x, z], Math.PI / 8);
    if (detail !== 3 || y < y0 + 0.07) return points;
    return points.map(([a, y, b], i) =>
      i % 3 === 1 ? [x + (a - x) * 0.934, y, z + (b - z) * 0.934] : [a, y, b],
    );
  };
  loft(
    out,
    'trim',
    profile.map(([y, r]) => fluted(y, r)),
    stone,
  );
  rings(
    out,
    'trim',
    x,
    z,
    [
      [y1 - 0.04, 0.651],
      [y1 + 0.19, 0.91],
      [y1 + 0.42, 0.96],
    ],
    detail === 3 ? 20 : 8,
    cap,
  );
  abox(out, 'trim', [x - 1.02, y1 + 0.41, z - 0.93], [x + 1.02, y1 + 0.69, z + 0.93], cap, {
    bottom: false,
  });
  if (detail >= 2)
    for (const d of [-1, 1]) {
      // The paired scrolls distinguish the Ionic capitals above the fluted shafts.
      torus(
        out,
        'trim',
        [x + d * 0.67, y1 + 0.32, z + 0.74],
        0.307,
        0.054,
        cap,
        detail === 3 ? 15 : 9,
        5,
      );
    }
}

function pedestal(out, x, z, y, w, h) {
  abox(out, 'base', [x - w * 0.6, y, z - w * 0.46], [x + w * 0.6, y + h, z + w * 0.46], sandstone, {
    bottom: false,
  });
  abox(
    out,
    'trim',
    [x - w * 0.65, y + h - 0.15, z - w * 0.52],
    [x + w * 0.65, y + h + 0.058, z + w * 0.52],
    cap,
    { bottom: false },
  );
}

function sculpture(out, x, y, z, detail, sign, horse) {
  const n = detail === 0 ? 5 : detail === 1 ? 6 : 9,
    rings = detail < 2 ? 3 : 6;
  const s = horse ? 1 : 0.72;
  sphere(out, 'bronze', [x, y + s * 0.97, z], [s * 1.08, 0.51 * s, 0.33 * s], bronze, n, rings);
  sphere(
    out,
    'bronze',
    [x + sign * 0.93 * s, y + 1.53 * s, z],
    [0.34 * s, 0.49 * s, 0.25 * s],
    bronze,
    n,
    rings,
  );
  for (const d of [-1, 1])
    for (const side of [-1, 1])
      beam(
        out,
        'bronze',
        [x + side * 0.65 * s, y + 0.78 * s, z + d * 0.19 * s],
        [x + side * 0.77 * s + sign * 0.23 * s, y + (side === sign ? 0.37 : 0), z + d * 0.27 * s],
        0.162 * s,
        0.168 * s,
        bronze,
      );
  if (!detail) return;
  const h = horse ? 1.54 : 1.17,
    u = x - sign * 0.13 * s;
  sphere(out, 'bronze', [u, y + h + 0.44, z], [0.249, 0.46, 0.219], bronze, n, rings);
  sphere(
    out,
    'bronze',
    [u + sign * 0.044, y + h + 1.02, z],
    [0.173, 0.211, 0.163],
    bronze,
    n,
    rings,
  );
  for (const d of [-1, 1])
    beam(
      out,
      'bronze',
      [u, y + h + 0.62, z + d * 0.154],
      [u + sign * 0.41, y + h + 0.47, z + d * 0.218],
      0.112,
      0.105,
      bronze,
    );
}

const inscription =
  'FRIDERICVS GVILHELMVS III STVDIO ANTIQVITATIS OMNIGENAE ET ARTIVM LIBERALIVM MVSEVM CONSTITVIT MDCCCXXVIII';
const glyph = {
  A: [
    [0, 0, 0.5, 1],
    [0.5, 1, 1, 0],
    [0.21, 0.41, 0.79, 0.41],
  ],
  B: [
    [0, 0, 0, 1],
    [0, 1, 0.75, 1],
    [0.75, 1, 1, 0.77],
    [1, 0.77, 0.7, 0.5],
    [0.7, 0.5, 1, 0.24],
    [1, 0.24, 0.72, 0],
    [0.72, 0, 0, 0],
    [0, 0.5, 0.7, 0.5],
  ],
  C: [
    [1, 0.87, 0.71, 1],
    [0.71, 1, 0.14, 0.87],
    [0.14, 0.87, 0, 0.5],
    [0, 0.5, 0.14, 0.13],
    [0.14, 0.13, 0.71, 0],
    [0.71, 0, 1, 0.14],
  ],
  D: [
    [0, 0, 0, 1],
    [0, 1, 0.61, 1],
    [0.61, 1, 1, 0.73],
    [1, 0.73, 1, 0.29],
    [1, 0.29, 0.61, 0],
    [0.61, 0, 0, 0],
  ],
  E: [
    [0, 0, 0, 1],
    [0, 1, 1, 1],
    [0, 0.52, 0.84, 0.52],
    [0, 0, 1, 0],
  ],
  F: [
    [0, 0, 0, 1],
    [0, 1, 1, 1],
    [0, 0.52, 0.83, 0.52],
  ],
  G: [
    [1, 0.84, 0.66, 1],
    [0.66, 1, 0.16, 0.88],
    [0.16, 0.88, 0, 0.49],
    [0, 0.49, 0.15, 0.14],
    [0.15, 0.14, 0.66, 0],
    [0.66, 0, 1, 0.17],
    [1, 0.17, 1, 0.47],
    [0.57, 0.47, 1, 0.47],
  ],
  H: [
    [0, 0, 0, 1],
    [1, 0, 1, 1],
    [0, 0.5, 1, 0.5],
  ],
  I: [
    [0.5, 0, 0.5, 1],
    [0.18, 1, 0.82, 1],
    [0.18, 0, 0.82, 0],
  ],
  L: [
    [0, 1, 0, 0],
    [0, 0, 1, 0],
  ],
  M: [
    [0, 0, 0, 1],
    [0, 1, 0.5, 0.38],
    [0.5, 0.38, 1, 1],
    [1, 1, 1, 0],
  ],
  N: [
    [0, 0, 0, 1],
    [0, 1, 1, 0],
    [1, 0, 1, 1],
  ],
  O: [
    [0.21, 0, 0.79, 0],
    [0.79, 0, 1, 0.25],
    [1, 0.25, 1, 0.75],
    [1, 0.75, 0.79, 1],
    [0.79, 1, 0.21, 1],
    [0.21, 1, 0, 0.75],
    [0, 0.75, 0, 0.25],
    [0, 0.25, 0.21, 0],
  ],
  Q: [
    [0.21, 0, 0.79, 0],
    [0.79, 0, 1, 0.25],
    [1, 0.25, 1, 0.75],
    [1, 0.75, 0.79, 1],
    [0.79, 1, 0.21, 1],
    [0.21, 1, 0, 0.75],
    [0, 0.75, 0, 0.25],
    [0, 0.25, 0.21, 0],
    [0.54, 0.3, 1, -0.12],
  ],
  R: [
    [0, 0, 0, 1],
    [0, 1, 0.78, 1],
    [0.78, 1, 1, 0.75],
    [1, 0.75, 0.76, 0.49],
    [0.76, 0.49, 0, 0.49],
    [0.58, 0.49, 1, 0],
  ],
  S: [
    [1, 0.89, 0.64, 1],
    [0.64, 1, 0.18, 0.88],
    [0.18, 0.88, 0.13, 0.65],
    [0.13, 0.65, 0.84, 0.38],
    [0.84, 0.38, 0.92, 0.13],
    [0.92, 0.13, 0.65, 0],
    [0.65, 0, 0.1, 0.11],
  ],
  T: [
    [0, 1, 1, 1],
    [0.5, 1, 0.5, 0],
  ],
  V: [
    [0, 1, 0.5, 0],
    [0.5, 0, 1, 1],
  ],
  X: [
    [0, 0, 1, 1],
    [0, 1, 1, 0],
  ],
};
function letters(out, F, detail) {
  if (detail < 2) return;
  const pitch = (L - 5.33) / inscription.length,
    y = 18.97;
  for (const [i, ch] of Array.from(inscription).entries()) {
    const start = 2.58 + i * pitch;
    for (const [a, b, c, d] of glyph[ch] ?? []) {
      const x = start + a * pitch * 0.7,
        X = start + c * pitch * 0.7,
        Y = y + b * 0.63,
        Z = y + d * 0.63;
      const q = Math.hypot(X - x, Z - Y) || 1,
        ux = ((Z - Y) * 0.027) / q,
        uy = ((x - X) * 0.027) / q,
        p = F.P;
      quad4(
        out,
        'trim',
        p(x + ux, Y + uy, 0.046),
        p(X + ux, Z + uy, 0.046),
        p(X - ux, Z - uy, 0.046),
        p(x - ux, Y - uy, 0.046),
        gold,
      );
    }
  }
}

function portico(out, detail) {
  const F = facade([left, faceZ], [1, 0]),
    back = facade([left, rearZ], [1, 0]);
  fbox(out, 'base', F, 0, L, floor, deck, -8.21, 0.49, sandstone);
  const stairCount = detail === 0 ? 5 : detail === 1 ? 9 : 16;
  const reach = 5.92,
    w = 17.08;
  for (let i = 0; i < stairCount; i++) {
    const t = i / stairCount,
      u = (i + 1) / stairCount;
    abox(
      out,
      'base',
      [center - w, -0.48, faceZ + 0.38 + reach * t],
      [center + w, deck * (1 - t), faceZ + 0.392 + reach * u],
      i % 2 ? sandstone : stone,
      { bottom: false },
    );
  }
  for (const x of [left, right - 0.81])
    abox(out, 'stone', [x, deck, rearZ], [x + 0.81, 17.32, faceZ + 0.13], stone, { bottom: false });
  const first = left + 2.78,
    last = right - 2.69,
    z = faceZ - 0.79;
  for (let i = 0; i < count; i++) shaft(out, first + ((last - first) * i) / (count - 1), z, detail);
  for (const [y, h, d, color] of [
    [17.15, 1.45, 0.43, stone],
    [18.58, 1.36, 0.29, dark],
    [19.94, 0.73, 0.64, cap],
    [20.67, 0.35, 0.36, stone],
  ])
    fbox(out, 'trim', F, -0.17, L + 0.17, y, y + h, -8.3, d, color, { bottom: true });
  const lettering = facade([left, faceZ + 0.29], [1, 0]);
  letters(out, lettering, detail);
  for (const side of [-1, 1]) {
    const x = center + side * 22.1;
    pedestal(out, x, faceZ + 2.14, 0.18, 2.24, 1.79);
    if (detail) sculpture(out, x, 1.96, faceZ + 2.14, detail, side, true);
    const roofX = center + side * 12.87;
    pedestal(out, roofX, faceZ - 0.76, 21.0, 2.25, 0.81);
    sculpture(out, roofX, 21.81, faceZ - 0.76, detail, side, true);
  }
  if (!detail) return;
  for (let i = 0; i < 17; i++) {
    const u = 3.41 + ((L - 6.82) * i) / 16,
      x = left + u;
    if (Math.abs(x - center) < 13.64) continue;
    rings(
      out,
      'bronze',
      x,
      faceZ - 0.11,
      [
        [21.02, 0.32],
        [21.25, 0.39],
        [22.07, 0.31],
        [22.34, 0.12],
      ],
      detail >= 2 ? 8 : 4,
      bronze,
    );
  }
  const n = 14;
  for (let i = 0; i < n; i++) {
    const u = (L * (i + 0.5)) / n,
      w = (L / n) * 0.423;
    const central = Math.abs(u - L / 2) < 9.5;
    if (central) panel(out, back, 'glass', u - w, u + w, deck + 0.09, 16.83, 0.052, glass);
    else
      for (const y of [4.04, 7.84, 11.71]) {
        panel(out, back, 'trim', u - w, u + w, y - 0.16, y + 2.93, 0.041, cap);
        panel(out, back, 'plaster', u - w + 0.155, u + w - 0.155, y, y + 2.77, 0.057, pompeian);
      }
    if (detail >= 2)
      panel(out, back, 'trim', u - w - 0.22, u + w + 0.22, 14.62, 14.79, 0.054, plaster);
  }
}
function build(out, detail) {
  const m = placed(out);
  lowerMuseum(m, detail);
  portico(m, detail);
}
export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = buildCloseup;
