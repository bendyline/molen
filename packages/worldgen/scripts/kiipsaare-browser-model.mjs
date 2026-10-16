/** Distant derivatives of the abandoned lighthouse; the detailed source keeps its representative pose. */
import { sphere } from './authored-structure-mesh.mjs';
import { ring, shell } from './lighthouse-expansion-models.mjs';
import { lathe, transformed } from './lighthouse-models.mjs';
import { box, quad, tube } from './structure-mesh.mjs';

const TAU = Math.PI * 2,
  tilt = (-2 * Math.PI) / 180,
  ct = Math.cos(tilt),
  st = Math.sin(tilt),
  dark = [0.11, 0.135, 0.14],
  rust = [0.43, 0.32, 0.2];
export const kiipsaareRadius = (y) => 1.21 - y * 0.0115;
export const kiipsaareHoles = [
  { y: 0.6, h: 1.9, theta: Math.PI / 8 },
  { y: 6.5, h: 0.7, theta: Math.PI / 20 },
  { y: 11.8, h: 0.7, theta: Math.PI / 20 },
  { y: 17.2, h: 0.7, theta: Math.PI / 20 },
].map((h) => ({
  ...h,
  angle: 0,
  w: 2 * kiipsaareRadius(h.y + h.h / 2) * Math.sin(h.theta),
  depth: 0.24,
}));
const bands = [
    0, 0.35, 0.6, 2.5, 3.2, 4.7, 5, 6.5, 7.2, 9, 11.8, 12.5, 13, 16, 17.2, 17.9, 19, 21.75, 22.65,
  ],
  P = (r, y, a) => [r * Math.sin(a), y, r * Math.cos(a)];
const color = (y) =>
  (y > 5 && y < 9) || (y > 13 && y < 16) || (y > 19 && y < 21.75)
    ? [0.85, 0.83, 0.72]
    : [0.6, 0.55, 0.45];
const means = { concrete: [0.710816, 0.710816, 0.681928], metal: [0.908889, 0.908889, 0.908889] };
function pose(out, skyline) {
  const p = ([x, y, z]) => [x * ct + y * st, -x * st + y * ct, z];
  return Object.fromEntries(
    ['addQuad', 'addTriangle', 'addConvexPolygon'].map((name) => [
      name,
      (slot, ref, ps, n, uv, c) =>
        out[name](
          slot,
          ref,
          ps.map(p),
          p(n),
          uv,
          skyline ? c.map((v, i) => v * (means[slot]?.[i] ?? 1)) : c,
        ),
    ]),
  );
}
function flat(out, slot, y, r, h, c, n) {
  lathe(
    out,
    slot,
    [
      [y, r],
      [y + h, r],
    ],
    c,
    n,
  );
}
function build(out, district) {
  const o = pose(out, !district),
    n = district ? 16 : 8,
    profile = (district ? bands : [0, 4.7, 5, 9, 13, 16, 19, 21.75, 22.65]).map((y) => [
      y,
      kiipsaareRadius(y),
    ]);
  if (district) {
    shell(
      {
        addQuad(slot, ref, ...a) {
          if (ref === 'metric:uv' || slot === 'glass') o.addQuad(slot, ref, ...a);
        },
        addTriangle(...a) {
          o.addTriangle(...a);
        },
      },
      {
        profile,
        segments: n,
        slot: 'concrete',
        color,
        holes: kiipsaareHoles.map((h) => ({
          ...h,
          trimSlot: 'concrete',
          trimColor: [0.6, 0.56, 0.45],
        })),
      },
    );
    for (const h of kiipsaareHoles) {
      const w = h.w / 2,
        r = kiipsaareRadius(h.y + h.h / 2),
        z = r * Math.cos(h.theta);
      for (const x of [-w, w])
        box(
          o,
          'concrete',
          [x - 0.045, h.y, z - 0.26],
          [x + 0.045, h.y + h.h, z + 0.025],
          [0.6, 0.56, 0.45],
        );
      for (const y of [h.y, h.y + h.h])
        box(
          o,
          'concrete',
          [-w - 0.04, y - 0.045, z - 0.26],
          [w + 0.04, y + 0.045, z + 0.025],
          [0.6, 0.56, 0.45],
        );
    }
  } else {
    for (let j = 1; j < profile.length; j++)
      lathe(
        o,
        'concrete',
        [profile[j - 1], profile[j]],
        color((profile[j - 1][0] + profile[j][0]) / 2),
        n,
      );
    for (const h of kiipsaareHoles) {
      const z = kiipsaareRadius(h.y + h.h / 2) + 0.005;
      quad(
        o,
        'glass',
        [
          [-h.w / 2, h.y, z],
          [h.w / 2, h.y, z],
          [h.w / 2, h.y + h.h, z],
          [-h.w / 2, h.y + h.h, z],
        ],
        [0, 0, 1],
        dark,
      );
    }
  }
  lathe(
    o,
    'concrete',
    [
      [0, 1.38],
      [0.25, 1.38],
      [0.55, 1.22],
    ],
    [0.48, 0.43, 0.34],
    n,
  );
  lathe(
    o,
    'concrete',
    [
      [4.7, 1.17],
      [4.8, 1.31],
      [4.95, 1.31],
      [5.04, 1.16],
    ],
    [0.72, 0.69, 0.59],
    n,
  );
  if (district)
    for (let y = 1; y < 22; y += 1.12) {
      if (kiipsaareHoles.some((h) => y >= h.y && y <= h.y + h.h)) continue;
      flat(o, 'concrete', y, kiipsaareRadius(y) + 0.007, 0.027, [0.48, 0.45, 0.37], n);
    }
  lathe(
    o,
    'concrete',
    [
      [22.55, 0.94],
      [22.82, 1.72],
      [23.03, 1.72],
      [23.08, 1.52],
    ],
    [0.47, 0.48, 0.42],
    n,
  );
  for (const y of [23.16, 23.96]) {
    if (district) ring(o, 'metal', y, 1.585, 1.635, 0.04, [0.64, 0.61, 0.51], n);
    else flat(o, 'metal', y, 1.635, 0.04, [0.64, 0.61, 0.51], n);
  }
  const posts = district ? 14 : 8;
  for (let i = 0; i < posts; i++) {
    const a = (i * TAU) / posts;
    if (district)
      tube(o, 'metal', P(1.61, 23.06, a), P(1.61, 23.96, a), 0.025, [0.64, 0.61, 0.51], 4);
    else {
      const t = transformed(o, a);
      quad(
        t,
        'metal',
        [
          [-0.025, 23.06, 1.61],
          [0.025, 23.06, 1.61],
          [0.025, 23.96, 1.61],
          [-0.025, 23.96, 1.61],
        ],
        [0, 0, 1],
        [0.64, 0.61, 0.51],
      );
    }
  }
  // Open lantern: neither glazing nor a working lens is invented for the abandoned tower.
  for (const y of [23.1, 23.967, 24.8]) {
    if (district) ring(o, 'metal', y, 1.01, 1.08, 0.05, rust, 16);
    else flat(o, 'metal', y, 1.08, 0.05, rust, 10);
  }
  for (let i = 0; i < 10; i++) {
    const a = (i * TAU) / 10;
    tube(o, 'metal', P(1.04, 23.1, a), P(1.04, 24.8, a), 0.035, rust, district ? 4 : 3);
  }
  lathe(
    o,
    'metal',
    [
      [24.8, 1.2064],
      [24.94, 1.2064],
      [25.15, 0.9984],
      [25.44, 0.3952],
      [25.6, 0.065],
    ],
    rust,
    n,
  );
  sphere(o, 'metal', [0, 25.76, 0], [0.13, 0.16, 0.13], rust, 8, 4);
  tube(o, 'metal', [0, 25.7, 0], [0, 26, 0], 0.025, [0.49, 0.36, 0.22], district ? 4 : 3);
  box(o, 'concrete', [-0.48, 0.1, 0.8], [0.48, 0.27, 1.5], [0.58, 0.53, 0.43]);
  if (district) box(o, 'concrete', [-0.4, 0.27, 0.8], [0.4, 0.45, 1.4], [0.64, 0.6, 0.5]);
}
export function buildKiipsaareSkyline(out) {
  build(out, false);
}
export function buildKiipsaareDistrict(out) {
  build(out, true);
}
