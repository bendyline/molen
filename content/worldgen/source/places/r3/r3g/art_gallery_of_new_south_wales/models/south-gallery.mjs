import {
  beamPath,
  loft,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { deform } from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import {
  facade,
  fbox,
  gableRoof,
  opening,
  outwardRing,
  quad4,
  rgb,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import { lettering } from '../../../../../../../../packages/worldgen/scripts/stadium-lettering.mjs';
import { cap } from '../../../../r1/r1f/adelaide_railway_station/models/classical.mjs';
import site from '../site-controls.json' with { type: 'json' };

export const surfaces = {
  wall: { slot: 'wall', graph: 'stone_sandstone', roughness: 0.95 },
  trim: { slot: 'trim', graph: 'stone_sandstone_raw', roughness: 0.91 },
  base: { slot: 'foundation', graph: 'stone_ashlar', roughness: 0.95 },
  roof: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.88 },
  metal: { slot: 'trim', graph: 'metal_bronze_cast', roughness: 0.8, metallic: 0.12 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.52 },
};
const tan = rgb('c5a581');
const pale = rgb('d2b291');
const shade = rgb('a88b70');
const roof = rgb('7d796e');
const plinth = rgb('918879');
const bronze = rgb('6c6c5b');
const dark = rgb('4c443b');
const glass = rgb('5e6867');
const front = facade([0, 0], [1, 0]);
const { portico, origin, axes } = site;
const { left, right, grade, peak } = portico;
const mid = (left + right) / 2;
const eave = 10.98;
const columnU = (i) => left + 1.15 + (i * (right - left - 2.3)) / 5;
const world = ([u, y, d]) => [
  origin[0] + u * axes.along[0] + d * axes.front[0],
  y,
  origin[1] + u * axes.along[1] + d * axes.front[1],
];
const band = (out, slot, a, b, y0, y1, d0, d1, tint, bottom = false) =>
  fbox(out, slot, front, a, b, y0, y1, d0, d1, tint, { bottom });
const sides = (ring) => outwardRing(ring).map((a, i, r) => wallFace(a, r[(i + 1) % r.length]));

function facadeWings(out, detail) {
  for (const f of sides(site.core)) {
    const frontWall = f.normal[1] > 0.97 && f.origin[1] > -10;
    const back = f.origin[1] < -49;
    const color = back ? rgb('b5a99a') : tan;
    fbox(out, 'base', f, 0, f.length, site.foundationBottom, 0.02, -0.09, 0, plinth);
    fbox(out, 'wall', f, 0, f.length, 0, eave, -0.09, 0, color);
    if (f.length < 3) continue;
    if (frontWall || detail > 1) {
      fbox(out, 'trim', f, 0, f.length, eave - 0.83, eave - 0.52, 0.008, 0.27, pale);
      fbox(out, 'trim', f, 0, f.length, eave - 0.31, eave, 0.007, 0.36, shade);
      fbox(out, 'trim', f, 0, f.length, 0.09, 0.26, 0, 0.19, pale);
    }
    if (detail < 1) continue;
    const bays = Math.max(1, Math.round(f.length / (frontWall ? 5.52 : 6.9)));
    const pitch = f.length / bays;
    for (let i = 0; i < bays; i++) {
      const x = (i + 0.5) * pitch;
      if (frontWall && Math.abs(f.P(x, 0)[0] - mid) < 10.1) continue;
      const w = pitch * 0.68;
      const y = frontWall ? 4.82 : -0.43;
      const y1 = frontWall ? 7.25 : 3.6;
      const p = f.P;
      if (frontWall) {
        fbox(
          out,
          'trim',
          f,
          x - w / 2 - 0.14,
          x + w / 2 + 0.14,
          y - 0.15,
          y + 0.08,
          0.015,
          0.22,
          pale,
        );
        fbox(out, 'trim', f, x - w / 2 - 0.14, x + w / 2 + 0.14, y1, y1 + 0.18, 0.015, 0.22, pale);
        quad4(
          out,
          'metal',
          p(x - w / 2, y, 0.055),
          p(x + w / 2, y, 0.055),
          p(x + w / 2, y1, 0.055),
          p(x - w / 2, y1, 0.055),
          bronze,
        );
        if (detail > 1)
          for (let k = 0; k < 4; k++) {
            const c = x + w * ((k + 1) / 5 - 0.5);
            const h = y + 0.58 + ((i + k * 3) % 4) * 0.34;
            beamPath(
              out,
              'metal',
              [p(c - 0.13, y + 0.32, 0.14), p(c + 0.07, h, 0.144), p(c + 0.21, y1 - 0.2, 0.14)],
              0.1,
              0.047,
              rgb('85816f'),
            );
          }
      } else if (back && f.length > 4 && detail > 1) {
        opening(out, f, x, y, w, y1 - y, {
          frameSlot: 'trim',
          glassSlot: 'glass',
          frame: pale,
          glass,
          frameWidth: 0.15,
          frameDepth: 0.14,
          mullions: 2,
          sill: false,
        });
      }
    }
  }
  cap(out, 'roof', site.core, eave, roof);
}

function column(out, u, detail) {
  const d = -0.94;
  const profile =
    detail === 0
      ? [
          [grade, 0.53],
          [8.91, 0.48],
        ]
      : [
          [grade, 0.64],
          [grade + 0.16, 0.64],
          [grade + 0.27, 0.49],
          [grade + 0.43, 0.49],
          [8.44, 0.38],
          [8.54, 0.45],
          [8.72, 0.54],
          [8.91, 0.55],
        ];
  const segments = [6, 10, 24, 48][detail];
  loft(
    out,
    'trim',
    profile.map(([y, r]) =>
      radialRing(y, r, r, segments, [u, d]).map(([x, h, z], i) => {
        const flute = detail < 2 || h < grade + 0.4 || h > 8.45 ? 1 : i % 2 === 0 ? 1 : 0.946;
        return [u + (x - u) * flute, h, d + (z - d) * flute];
      }),
    ),
    pale,
  );
  if (detail > 0) band(out, 'trim', u - 0.64, u + 0.64, 8.78, 9.15, d - 0.51, d + 0.52, tan, true);
  if (detail > 1)
    for (const sign of [-1, 1]) {
      const path = Array.from({ length: 13 }, (_, i) => {
        const t = i / 12,
          angle = t * Math.PI * 3.25,
          radius = 0.205 * (1 - t) + 0.02;
        return [
          u + sign * 0.44 + sign * Math.cos(angle) * radius,
          8.91 + Math.sin(angle) * radius,
          d + 0.51,
        ];
      });
      beamPath(out, 'trim', path, 0.055, 0.06, pale);
    }
}

const extra = {
  G: [
    [0.96, 0.88],
    [0.67, 1],
    [0.23, 1],
    [0.04, 0.73],
    [0.04, 0.26],
    [0.23, 0],
    [0.74, 0],
    [0.96, 0.22],
    [0.96, 0.47],
    [0.56, 0.47],
  ],
  O: [
    [0.22, 0],
    [0.75, 0],
    [0.94, 0.25],
    [0.94, 0.75],
    [0.75, 1],
    [0.22, 1],
    [0.04, 0.75],
    [0.04, 0.25],
    [0.22, 0],
  ],
  U: [
    [0.04, 1],
    [0.04, 0.21],
    [0.22, 0],
    [0.73, 0],
    [0.92, 0.21],
    [0.92, 1],
  ],
  Y: [
    [0.04, 1],
    [0.48, 0.53],
    [0.92, 1],
  ],
  W: [
    [0, 1],
    [0.17, 0],
    [0.45, 0.68],
    [0.72, 0],
    [0.94, 1],
  ],
};
function title(out) {
  const text = 'ART GALLERY OF NEW SOUTH WALES';
  const width = 14.68,
    advance = width / text.length,
    y = 9.92,
    height = 0.37,
    d = 0.1;
  lettering(
    deform(out, ([u, y, d]) => [u + mid, y, d]),
    text.replace(/[GOUYW]/g, ' '),
    { width, height, y, z: d, color: dark, stroke: 0.035, slot: 'metal' },
  );
  for (let i = 0; i < text.length; i++) {
    const shape = extra[text[i]];
    if (!shape) continue;
    const path = shape.map(([a, b]) => [
      mid + (i - text.length / 2 + a * 0.75) * advance,
      y + b * height,
      d,
    ]);
    beamPath(out, 'metal', path, 0.035, 0.035, dark);
    if (text[i] === 'Y') beamPath(out, 'metal', [path[1], [path[1][0], y, d]], 0.035, 0.035, dark);
  }
}

function entry(out, detail) {
  const rear = -9.31;
  band(out, 'base', left - 0.65, right + 0.65, site.foundationBottom, grade, rear, 0.17, plinth);
  const stepCount = 5;
  for (let i = 0; i < stepCount; i++) {
    const y = grade - ((grade + 0.07) * i) / stepCount;
    const d = 0.16 + (i + 1) * 0.49;
    band(
      out,
      'trim',
      left - 0.65 - i * 0.042,
      right + 0.65 + i * 0.042,
      y - 0.196,
      y,
      d - 0.5,
      d,
      pale,
    );
  }
  for (let i = 0; i < portico.columnCount; i++) column(out, columnU(i), detail);
  band(out, 'trim', left - 0.31, right + 0.31, 9.11, 9.53, rear, 0.17, shade, true);
  band(out, 'trim', left - 0.59, right + 0.59, 9.51, 10.59, rear, 0.073, pale);
  band(out, 'trim', left - 0.81, right + 0.81, 10.57, 10.89, rear - 0.3, 0.36, shade, true);
  const depth = -6.11,
    half = (right - left) / 2;
  gableRoof(out, 'roof', [mid, depth], [mid, 0.08], half * 2 + 1.06, 10.87, peak, roof, {
    overhang: 0.24,
    endSlot: 'trim',
    endColor: tan,
  });
  if (detail > 0) {
    const G = [
      [left - 0.59, 10.92, 0.102],
      [mid, peak - 0.12, 0.102],
      [right + 0.59, 10.92, 0.102],
    ];
    beamPath(out, 'trim', G, 0.29, 0.25, pale);
    const door = facade([0, rear], [1, 0]);
    for (const u of [-5.69, 0, 5.69]) {
      opening(out, door, u, grade, u === 0 ? 3.28 : 1.89, 5.13, {
        glassSlot: 'glass',
        frameSlot: 'trim',
        frame: shade,
        glass: dark,
        frameWidth: 0.19,
        frameDepth: 0.27,
        transoms: detail > 1 ? 2 : 0,
        sill: false,
      });
    }
  }
  if (detail === 3) title(out);
  if (detail > 1) {
    for (const u of [left + 0.35, right - 0.35]) {
      beamPath(
        out,
        'metal',
        [
          [u, 0.81, 2.52],
          [u, 1.73, 0.06],
        ],
        0.045,
        0.045,
        bronze,
      );
      beamPath(
        out,
        'metal',
        [
          [u, 0.05, 2.52],
          [u, 0.81, 2.52],
        ],
        0.047,
        0.047,
        bronze,
      );
    }
  }
}

function build(out, detail) {
  const local = deform(out, world);
  facadeWings(local, detail);
  entry(local, detail);
  const raisedRoofs = [
    [-31.75, 24, -47.2, -21.1],
    [-42.12, 6.85, -64.39, -54.78],
    [-21.19, 28.67, -94.66, -74.71],
  ];
  for (const [a, b, c, d] of raisedRoofs) {
    band(local, 'roof', a, b, eave - 0.06, eave + 0.76, c, d, roof);
    if (detail > 0) {
      const u = (a + b) / 2;
      gableRoof(local, 'roof', [u, c], [u, d], b - a, eave + 0.74, eave + 1.54, roof, {
        overhang: 0.12,
        endSlot: 'roof',
      });
    }
  }
}
export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = buildCloseup;
