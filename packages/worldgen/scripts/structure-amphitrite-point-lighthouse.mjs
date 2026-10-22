/** Squat concrete Amphitrite Point lighthouse, signed native D-shaped plan. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { beam, normalFor, radialRing, sphere } from './authored-structure-mesh.mjs';
import { cleanRing, rgb } from './landmark-model-helpers.mjs';
import { quad } from './structure-mesh.mjs';

const plan = JSON.parse(
  fs.readFileSync(
    new URL(
      '../../../content/worldgen/source/places/c0/c0w/amphitrite_point_lighthouse/plan-controls.json',
      import.meta.url,
    ),
  ),
);
const ref = 'palette:#ffffff',
  colors = { white: rgb('dcded7'), red: rgb('963e39'), dark: rgb('58625e'), glass: rgb('b2c2be') };
const surfaces = {
  white: { slot: 'wall', graph: 'concrete_plain', roughness: 0.96, metallic: 0 },
  red: { slot: 'trim', graph: 'metal_painted', roughness: 0.86, metallic: 0.12 },
  dark: { slot: 'trim', graph: 'metal_painted', roughness: 0.91, metallic: 0.15 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.35, metallic: 0.1 },
};
const rear = plan.backCorners.map((p) => p.slice()),
  backCenter = [0, 1].map((k) => (rear[0][k] + rear[1][k]) / 2),
  width = Math.hypot(rear[1][0] - rear[0][0], rear[1][1] - rear[0][1]),
  u = [(rear[1][0] - rear[0][0]) / width, (rear[1][1] - rear[0][1]) / width],
  n = [-u[1], u[0]];
const p = (x, y, z) => [
  backCenter[0] + u[0] * x + n[0] * z,
  y,
  backCenter[1] + u[1] * x + n[1] * z,
];
function tri(out, slot, ps, target = null) {
  if (target && normalFor(...ps).reduce((s, v, i) => s + v * target[i], 0) < 0)
    ps = [ps[0], ps[2], ps[1]];
  out.addTriangle(
    slot,
    ref,
    ps,
    normalFor(...ps),
    ps.map((p) => [p[0], p[2]]),
    colors[slot],
  );
}
function cap(out, r, y, slot, up = true) {
  const ix = earcut(r.flat());
  for (let i = 0; i < ix.length; i += 3)
    tri(
      out,
      slot,
      ix.slice(i, i + 3).map((j) => [r[j][0], y, r[j][1]]),
      [0, up ? 1 : -1, 0],
    );
}
function shell(out, r0, r1, y0, y1, slot) {
  for (let i = 0; i < r0.length; i++) {
    const j = (i + 1) % r0.length,
      ps = [
        [r0[i][0], y0, r0[i][1]],
        [r0[j][0], y0, r0[j][1]],
        [r1[j][0], y1, r1[j][1]],
        [r1[i][0], y1, r1[i][1]],
      ];
    quad(out, slot, ps, normalFor(...ps), colors[slot]);
  }
}
function rectangle(x, z, w, depth) {
  return [
    [x - w / 2, z - depth / 2],
    [x - w / 2, z + depth / 2],
    [x + w / 2, z + depth / 2],
    [x + w / 2, z - depth / 2],
  ].map((q) => {
    const a = p(q[0], 0, q[1]);
    return [a[0], a[2]];
  });
}
function clockwise(r) {
  return r.reduce(
    (s, p, i) => s + p[0] * r[(i + 1) % r.length][1] - r[(i + 1) % r.length][0] * p[1],
    0,
  ) < 0
    ? r
    : [...r].reverse();
}
function prism(out, r, y0, y1, slot) {
  r = clockwise(r);
  shell(out, r, r, y0, y1, slot);
  cap(out, r, y0, slot, false);
  cap(out, r, y1, slot);
}
function panel(out, ring, depth, slot) {
  const ix = earcut(ring.flat());
  for (let i = 0; i < ix.length; i += 3)
    tri(
      out,
      slot,
      ix.slice(i, i + 3).map((j) => p(ring[j][0], ring[j][1], depth)),
      [-n[0], 0, -n[1]],
    );
}
function backWall(out, d) {
  const outline = [
      [-width / 2, -0.35],
      [width / 2, -0.35],
      [(width / 2) * 0.966, 2.25],
      [(-width / 2) * 0.966, 2.25],
    ],
    x = (plan.entrance[0] - backCenter[0]) * u[0] + (plan.entrance[1] - backCenter[1]) * u[1],
    door = [
      [x - 0.5, 0.28],
      [x + 0.5, 0.28],
      [x + 0.5, 2.04],
      [x - 0.5, 2.04],
    ],
    rings = [outline, door],
    pts = rings.flat(),
    ix = earcut(pts.flat(), [4]);
  for (let i = 0; i < ix.length; i += 3)
    tri(
      out,
      'white',
      ix.slice(i, i + 3).map((j) => p(...pts[j], 0)),
      [-n[0], 0, -n[1]],
    );
  panel(out, door, 0.16, 'dark');
  for (let i = 0; i < 4; i++) {
    const a = door[i],
      b = door[(i + 1) % 4],
      ps = [p(...a, 0), p(...b, 0), p(...b, 0.16), p(...a, 0.16)];
    quad(out, 'white', ps, normalFor(...ps), colors.white);
    if (d > 0) beam(out, 'white', p(...a, -0.015), p(...b, -0.015), 0.1, 0.1, colors.white);
  }
  if (d > 1) {
    for (const x of [-2.4, 2.45]) {
      const r = [
        [x - 0.35, 0.8],
        [x + 0.35, 0.8],
        [x + 0.35, 1.38],
        [x - 0.35, 1.38],
      ];
      panel(out, r, -0.018, 'dark');
      for (let i = 1; i < 5; i++)
        beam(
          out,
          'white',
          p(x - 0.33, 0.8 + i * 0.115, -0.03),
          p(x + 0.33, 0.8 + i * 0.115, -0.03),
          0.035,
          0.04,
          colors.white,
        );
    }
    if (d === 3) {
      beam(
        out,
        'dark',
        p(x + 0.34, 1.0, -0.055),
        p(x + 0.34, 1.17, -0.055),
        0.045,
        0.055,
        colors.dark,
      );
      for (const y of [0.55, 1.75])
        beam(
          out,
          'white',
          p(x - 0.46, y, -0.035),
          p(x - 0.35, y, -0.035),
          0.04,
          0.055,
          colors.white,
        );
    }
  }
}
function entrySteps(out, d) {
  const a = plan.approach,
    b = plan.entrance,
    len = Math.hypot(b[0] - a[0], b[1] - a[1]),
    v = [(b[0] - a[0]) / len, (b[1] - a[1]) / len],
    right = [-v[1], v[0]],
    steps = d === 0 ? 1 : 3;
  const point = (s, y, x = 0) => [
    a[0] + v[0] * s + right[0] * x,
    y,
    a[1] + v[1] * s + right[1] * x,
  ];
  for (let i = 0; i < steps; i++) {
    const s = len - 1.3 + (i / steps) * 1.3,
      t = len - 1.3 + ((i + 1) / steps) * 1.3,
      r = [point(s, 0, -0.7), point(t, 0, -0.7), point(t, 0, 0.7), point(s, 0, 0.7)].map((q) => [
        q[0],
        q[2],
      ]);
    prism(out, cleanRing(r), -0.25, ((i + 1) / steps) * 0.28, 'white');
  }
  if (d > 0)
    for (const side of [-1, 1]) {
      const x = side * 0.75;
      beam(
        out,
        'dark',
        point(len - 1.6, 0.9, x),
        point(len, 0.9 + 0.28, x),
        0.055,
        0.055,
        colors.dark,
      );
      for (const s of [len - 1.6, len - 0.8, len])
        beam(
          out,
          'dark',
          point(s, Math.max(0, ((s - (len - 1.3)) / 1.3) * 0.28), x),
          point(s, 0.9 + ((s - len + 1.6) / 1.6) * 0.28, x),
          0.055,
          0.055,
          colors.dark,
        );
    }
}
function lantern(out, d) {
  const center = p(0, 0, 5.4),
    c = [center[0], center[2]],
    count = 6,
    radius = 1.05,
    base = 3.98,
    lower = radialRing(base, radius, radius, count, c),
    sill = radialRing(base + 0.4, radius, radius, count, c),
    head = radialRing(5.44, radius, radius, count, c);
  const xz = (r) => r.map((p) => [p[0], p[2]]);
  shell(out, xz(lower), xz(sill), base, base + 0.4, 'red');
  cap(out, xz(lower), base, 'red', false);
  for (let i = 0; i < count; i++) {
    const j = (i + 1) % count,
      ps = [sill[i], sill[j], head[j], head[i]];
    quad(out, 'glass', ps, normalFor(...ps), colors.glass);
    if (d > 0) {
      beam(out, 'red', sill[i], head[i], 0.11, 0.1, colors.red);
      beam(out, 'red', sill[i], sill[j], 0.1, 0.1, colors.red);
      beam(out, 'red', head[i], head[j], 0.12, 0.12, colors.red);
    }
    if (d > 1) {
      const a = sill[i].map((v, k) => (v + sill[j][k]) / 2),
        b = head[i].map((v, k) => (v + head[j][k]) / 2);
      beam(out, 'red', a, b, 0.045, 0.055, colors.red);
    }
  }
  const roof = radialRing(5.48, 1.25, 1.25, count, c);
  for (let i = 0; i < count; i++)
    tri(out, 'red', [roof[i], roof[(i + 1) % count], [c[0], 6.04, c[1]]]);
  cap(out, xz(roof), 5.48, 'red', false);
  if (d > 0) {
    beam(out, 'dark', [c[0], 6.02, c[1]], [c[0], 7.25, c[1]], 0.045, 0.045, colors.dark);
    beam(
      out,
      'dark',
      [c[0] - 0.33, 6.85, c[1]],
      [c[0] + 0.33, 6.85, c[1]],
      0.025,
      0.025,
      colors.dark,
    );
    if (d > 1) {
      for (const side of [-1, 1])
        sphere(
          out,
          'dark',
          [c[0] + side * 0.33, 6.85, c[1]],
          [0.085, 0.055, 0.065],
          colors.dark,
          8,
          4,
        );
      beam(
        out,
        'dark',
        [c[0], 7.16, c[1] - 0.28],
        [c[0], 7.16, c[1] + 0.28],
        0.025,
        0.025,
        colors.dark,
      );
    }
  }
}
function build(out, _frame, d = 3) {
  const r = clockwise(cleanRing(plan.outline)),
    top = r.map((q) => {
      const x = q[0] - backCenter[0],
        z = q[1] - backCenter[1];
      return [backCenter[0] + x * 0.966, backCenter[1] + z * 0.966];
    });
  // Native entrance lies on a collinear subdivided rear edge. Keep one closed door recess.
  for (let i = 0; i < r.length; i++) {
    const j = (i + 1) % r.length,
      a = r[i],
      b = r[j],
      za = (a[0] - backCenter[0]) * n[0] + (a[1] - backCenter[1]) * n[1],
      zb = (b[0] - backCenter[0]) * n[0] + (b[1] - backCenter[1]) * n[1];
    if (Math.abs(za) < 0.08 && Math.abs(zb) < 0.08) continue;
    const ps = [
      [a[0], -0.35, a[1]],
      [b[0], -0.35, b[1]],
      [top[j][0], 2.25, top[j][1]],
      [top[i][0], 2.25, top[i][1]],
    ];
    quad(out, 'white', ps, normalFor(...ps), colors.white);
  }
  backWall(out, d);
  cap(out, top, 2.25, 'white');
  cap(out, r, -0.35, 'white', false);
  if (d > 0)
    for (let i = 0; i < top.length; i++) {
      const j = (i + 1) % top.length;
      beam(
        out,
        'white',
        [top[i][0], 2.25, top[i][1]],
        [top[j][0], 2.25, top[j][1]],
        0.13,
        0.18,
        colors.white,
      );
    }
  const upper = rectangle(0, 5.0, 6.25, 4.4);
  prism(out, upper, 2.27, 3.95, 'white');
  if (d > 0) {
    const rim = rectangle(0, 5.0, 6.45, 4.6);
    prism(out, rim, 3.93, 4.04, 'white');
    const v = [];
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      v.push([Math.cos(a) * 0.18, 3.12 + Math.sin(a) * 0.18]);
    }
    panel(out, v, 2.79, 'dark');
    if (d > 1)
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2,
          b = ((i + 1) / 12) * Math.PI * 2;
        beam(
          out,
          'white',
          p(Math.cos(a) * 0.23, 3.12 + Math.sin(a) * 0.23, 2.76),
          p(Math.cos(b) * 0.23, 3.12 + Math.sin(b) * 0.23, 2.76),
          0.04,
          0.035,
          colors.white,
        );
      }
  }
  lantern(out, d);
  entrySteps(out, d);
}
export const amphitriteSkyline = (o, f) => build(o, f, 0);
export const amphitriteDistrict = (o, f) => build(o, f, 1);
export const amphitriteStreet = (o, f) => build(o, f, 2);
export const amphitritePointModel = {
  id: 'amphitrite_point_lighthouse',
  key: 'amphitrite_point_lighthouse',
  recipe: 'structure-amphitrite-point-lighthouse.mjs',
  cell: 'c0/c0w',
  title: 'Amphitrite Point Lighthouse',
  category: 'lighthouse',
  progressLedger: 'qualla-002.PROGRESS.md',
  build,
  surfaces,
  brief:
    'Low broad white concrete lighthouse/service building on its complete native D-shaped footprint: gently battered lower wall, setback flat-roof upper storey with a small physical vent, short red hexagonal glazed lantern and hipped roof/weather mast, and recessed landward door with intrinsic short approach steps/handrails. Detached station, helipads, fence, trail and rocky landscape excluded.',
  camera: [26, 15, -30],
  lookAt: [0, 2.7, -1],
  portableGroundY: -0.18,
  mediumFiContext: { scale: 0.6 },
  qaCameras: [
    { name: 'mapped-landward-door-and-steps', position: [18, 5, -19], lookAt: [3, 1.7, -4] },
    { name: 'red-lantern-and-weather-mast', position: [9, 8, -10], lookAt: [0, 4.9, -0.3] },
    { name: 'rounded-seaward-body', position: [-17, 9, 17], lookAt: [-1, 2, 0] },
  ],
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis:
    'Exact named native building way374651008 retains the signed D-shaped service-body footprint. Original attached access footway374651033 fixes the landward entry and off-body dry approach datum before terrain sampling.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-amphitrite-point-lighthouse.mjs',
    level: 'skyline',
    export: 'amphitriteSkyline',
    errorMeters: 0.7,
    surfaces,
    authoredLevels: {
      district: { export: 'amphitriteDistrict', errorMeters: 0.3, surfaces },
      street: { export: 'amphitriteStreet', errorMeters: 0.1, surfaces },
    },
  },
  limitations: [
    'The full original named lighthouse way374651008/Q28375578 controls its irregular D-shaped lower plan, anchor and true-east orientation. Original attached footway fixes entrance/approach; neighboring station buildings and helipads are distinct objects. The native15mseamark light-height is a focal elevation above sea level, not a15mstructural height.',
    'One exact Qualla-published448x336TourismUcluelet2008PD-selforiginal controls broad low white massing, narrower upper storey, red lantern/hip roof, weather mast and access-step typology. About6mprimarystructure height, upper setbacks, glazing sections, slight wall batter, vents/door and small fittings are medium-fi photographic estimates; the image has limited detail. No attribution/share-alike alternative or supplemental photograph was used.',
    'Exterior assembly only. Lantern panes are restrained opaque glazing for portable appearance; internal optics, inscriptions, electrical/meteorological equipment and hidden fittings are not engineering reconstructions. Fine mullions/vent slats/weather fittings retire in lower LODs. Detached station/helipads, fence, Wild Pacific Trail, cliff rock/landscape and former wooden lighthouse excluded.',
    'Footings extend.35m below a fixed original approach datum and a short own-entry stair rises.28m. Exact rocky foundation and terrain/step contact remain approximate; source terrain is preserved and no whole-rock platform or blanket ground opening is introduced.',
  ],
};
