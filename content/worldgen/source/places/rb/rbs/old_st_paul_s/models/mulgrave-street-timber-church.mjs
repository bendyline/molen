import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  facade,
  fbox,
  gableRoof,
  lathe,
  outwardRing,
  quad4,
  rgb,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import { cap } from '../../../../r1/r1f/adelaide_railway_station/models/classical.mjs';
import site from '../site-controls.json' with { type: 'json' };

export const surfaces = {
  boarding: { slot: 'wall', graph: 'wood_board_batten', roughness: 0.94 },
  trim: { slot: 'trim', graph: 'wood_painted_lap', roughness: 0.91 },
  slate: { slot: 'roof', graph: 'shingle_asphalt', roughness: 0.97 },
  foundation: { slot: 'foundation', graph: 'stone_granite', roughness: 0.96 },
  louver: { slot: 'trim', graph: 'metal_painted', roughness: 0.89 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.65 },
};

const white = rgb('e1e0d6'),
  cream = rgb('e8e5d7'),
  shadow = rgb('c6c4b8'),
  rock = rgb('a19c8f');
const roof = rgb('8d9197'),
  slate = rgb('777d85'),
  warm = rgb('786b5a'),
  glass = rgb('586366');
const dark = rgb('524d43'),
  navy = rgb('3f4d52');
const F = facade(site.frame.origin, site.frame.along);
const xz = (u, d) => {
  const [x, , z] = F.P(u, 0, d);
  return [x, z];
};
const edges = (ring) => ring.map((p, i) => wallFace(p, ring[(i + 1) % ring.length]));
const rectangle = (u, d, U, D) => [xz(u, d), xz(U, d), xz(U, D), xz(u, D)];

function band(out, slot, f, a, b, y, Y, d, color) {
  quad4(out, slot, f.P(a, y, d), f.P(b, y, d), f.P(b, Y, d), f.P(a, Y, d), color);
}
function lancet(out, f, center, width, y, top, detail, color) {
  const a = center - width * 0.5,
    b = center + width * 0.5,
    shoulder = top - width * 0.67;
  const steps = detail < 2 ? 4 : 8,
    d = 0.027;
  band(out, 'glass', f, a, b, y, shoulder, d, color);
  for (let i = 0; i < steps; i++) {
    const t = i / steps,
      T = (i + 1) / steps,
      u = a + (b - a) * t,
      v = a + (b - a) * T;
    const Y = shoulder + (top - shoulder) * Math.pow(1 - Math.abs(2 * t - 1), 0.72);
    const Z = shoulder + (top - shoulder) * Math.pow(1 - Math.abs(2 * T - 1), 0.72);
    tri(out, 'glass', f.P(center, shoulder, d), f.P(v, Z, d), f.P(u, Y, d), color);
    if (detail > 1) {
      const mid = f.P(u, Y, 0.035),
        end = f.P(v, Z, 0.035);
      beam(out, 'trim', mid, end, 0.055, 0.052, cream);
    }
  }
  if (detail > 0) {
    for (const u of [a, b]) band(out, 'trim', f, u - 0.06, u + 0.06, y, shoulder, 0.059, cream);
    band(out, 'trim', f, a - 0.09, b + 0.09, y - 0.065, y, 0.06, shadow);
  }
  if (detail > 1)
    band(out, 'louver', f, center - 0.022, center + 0.022, y, top - 0.165, 0.053, warm);
}
function solid(out, ring, y, Y, color, slot = 'boarding') {
  for (const f of edges(outwardRing(ring))) band(out, slot, f, 0, f.length, y, Y, 0, color);
}
function atEntrance(f) {
  const [x, z] = f.origin;
  return (
    [x - site.tower.entrance[0][0], z - site.tower.entrance[0][1]].every(
      (n) => Math.abs(n) < 0.035,
    ) ||
    [x - site.tower.entrance[1][0], z - site.tower.entrance[1][1]].every((n) => Math.abs(n) < 0.035)
  );
}
function wallBase(out, detail) {
  for (const f of edges(outwardRing(site.outline))) {
    const w = f.length;
    if (w > 4.4 && w < 5 && atEntrance(f)) {
      const a = w * 0.285,
        b = w * 0.715;
      for (const [lo, hi] of [
        [0, a],
        [b, w],
      ])
        band(out, 'boarding', f, lo, hi, site.foundation, 4.62, 0, white);
      band(out, 'boarding', f, a, b, 2.41, 4.62, 0, white);
      band(out, 'glass', f, a, b, site.floor, 2.41, -0.73, navy);
      fbox(out, 'trim', f, a - 0.11, a, site.floor, 2.47, -0.52, 0.09, cream);
      fbox(out, 'trim', f, b, b + 0.11, site.floor, 2.47, -0.52, 0.09, cream);
    } else {
      band(out, 'boarding', f, 0, w, site.foundation, 4.62, 0, white);
      if (w > 1.95) {
        const count = Math.round(w / (detail === 0 ? 6.65 : 3.12));
        for (let j = 0; j < count; j++)
          lancet(
            out,
            f,
            (w * (j + 0.5)) / count,
            Math.min(0.88, (w / count) * 0.48),
            1.38,
            3.62,
            detail,
            glass,
          );
      }
    }
    band(out, 'foundation', f, 0, w, site.foundation, 0.18, 0.019, rock);
    if (detail > 0) band(out, 'trim', f, 0, w, 4.36, 4.62, 0.08, cream);
  }
  cap(out, 'slate', site.outline, 4.609, slate);
}
function shed(out, u, U, d, D, other) {
  const y = other ? 7.04 : 4.61,
    Y = other ? 4.61 : 7.04;
  quad4(out, 'slate', F.P(u, y, d), F.P(U, y, d), F.P(U, Y, D), F.P(u, Y, D), roof);
}
function gable(out, u, d, U, D, width, eave, ridge, overhang = 0.19) {
  gableRoof(out, 'slate', xz(u, d), xz(U, D), width, eave, ridge, roof, {
    endSlot: 'boarding',
    endColor: white,
    overhang,
  });
}
function churchRoofs(out, detail) {
  solid(out, rectangle(0.05, -14.28, 32.86, -5.62), 4.54, 7.04, white);
  gable(out, 0.05, -9.95, 32.89, -9.95, 8.66, 7.04, 12.18);
  shed(out, 0.11, 27.59, -0.15, -5.62, false);
  const p = F.P;
  quad4(
    out,
    'slate',
    p(27.28, 4.62, -19.31),
    p(1.37, 4.62, -19.31),
    p(1.37, 7.04, -14.27),
    p(27.28, 7.04, -14.27),
    slate,
  );
  const wings = [
    [14.48, -8.31, 22.5, 5.11, 8.01, 5.85, 9.33],
    [16.93, -22.92, 23.81, -13.11, 6.91, 5.65, 8.86],
  ];
  for (const [u, d, U, D, w, y, Y] of wings) {
    solid(out, rectangle(u, d, U, D), 4.58, y, white);
    gable(out, (u + U) * 0.5, d, (u + U) * 0.5, D, w, y, Y);
  }
  gable(out, 0.08, -16.71, 5.2, -16.71, 2.74, 4.61, 6.34, 0.14);
  gable(out, 0.01, -2.58, 5.44, -2.58, 2.79, 4.62, 6.28, 0.14);
  gable(out, 27.48, -1.8, 33.48, -1.8, 3.92, 4.62, 6.42, 0.14);
  if (detail > 0) {
    for (const [u, d] of [
      [15.03, -7.54],
      [28.5, -9.93],
      [17.95, -20.32],
    ])
      fbox(out, 'trim', F, u - 0.13, u + 0.13, 9.18, 9.68, d - 0.12, d + 0.12, shadow);
  }
}
function spire(out, detail) {
  const t = site.tower,
    top = t.eaves,
    base = top + 0.24;
  solid(out, rectangle(-1.7, -15.18, 2.96, -10.56), 4.61, top, white);
  fbox(out, 'trim', F, -1.9, 3.14, top - 0.18, top + 0.08, -15.41, -10.32, cream);
  const [x, z] = t.center,
    n = 8;
  const ring = Array.from({ length: n }, (_, i) => {
    const a = t.rotation + (2 * Math.PI * i) / n;
    return [x + 1.71 * Math.cos(a), z + 1.71 * Math.sin(a)];
  });
  lathe(
    out,
    'slate',
    t.center,
    [
      [top + 0.079, 2.62, 2.62],
      [base + 0.48, 1.72, 1.72],
    ],
    n,
    slate,
    { rotation: t.rotation, capTop: false },
  );
  solid(out, ring, base + 0.38, t.belfryTop, white);
  for (const f of edges(outwardRing(ring))) {
    const u = f.length * 0.5;
    lancet(out, f, u, 0.71, base + 0.54, t.belfryTop - 0.36, detail, dark);
    if (detail > 1)
      for (let i = 0; i < 7; i++)
        band(
          out,
          'louver',
          f,
          u - 0.312,
          u + 0.312,
          base + 0.63 + i * 0.188,
          base + 0.701 + i * 0.188,
          0.082,
          warm,
        );
  }
  const shape =
    detail === 0
      ? [
          [t.belfryTop, 1.79, 1.79],
          [22.73, 0.061, 0.061],
        ]
      : [
          [t.belfryTop, 1.79, 1.79],
          [11.66, 1.327, 1.327],
          [15.1, 0.865, 0.865],
          [19.88, 0.35, 0.35],
          [22.73, 0.061, 0.061],
        ];
  lathe(out, 'slate', t.center, shape, 8, slate, { rotation: t.rotation });
  lathe(
    out,
    'louver',
    t.center,
    [
      [22.72, 0.1, 0.1],
      [23.02, 0.075, 0.075],
      [t.tip, 0.018, 0.018],
    ],
    6,
    warm,
  );
  if (detail > 1)
    beam(out, 'louver', [x - 0.32, 23.38, z], [x + 0.32, 23.38, z], 0.045, 0.051, warm);
  gable(out, -2.23, -12.86, -1.68, -12.86, 2.77, 2.52, 4.19, 0.075);
  fbox(out, 'foundation', F, -2.34, -1.69, -0.36, site.floor, -14.76, -10.96, rock);
}
function build(out, detail) {
  wallBase(out, detail);
  churchRoofs(out, detail);
  spire(out, detail);
}

export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = buildCloseup;
