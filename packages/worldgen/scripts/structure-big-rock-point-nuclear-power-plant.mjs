/** Big Rock Point: representative early-operation exterior, historical viewing only. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { beam, cross, normalFor } from './authored-structure-mesh.mjs';
import { rgb } from './landmark-model-helpers.mjs';
import { box } from './structure-mesh.mjs';

const plan = JSON.parse(
  fs.readFileSync(
    new URL(
      '../../../content/worldgen/source/places/f0/f05/big_rock_point_nuclear_power_plant/plan-controls.json',
      import.meta.url,
    ),
  ),
);
const ref = 'palette:#ffffff';
const C = {
  shell: rgb('a9b8b0'),
  wall: rgb('c7c8b8'),
  roof: rgb('8a9187'),
  steel: rgb('7f8f87'),
  dark: rgb('576761'),
  red: rgb('a97061'),
  white: rgb('d4d3c4'),
  glass: rgb('536e72'),
  concrete: rgb('a6aa9b'),
};
const surfaces = {
  shell: { slot: 'wall', graph: 'metal_painted', roughness: 0.87, metallic: 0.12 },
  wall: { slot: 'wall', graph: 'concrete_plain', roughness: 0.96, metallic: 0 },
  steel: { slot: 'trim', graph: 'metal_painted', roughness: 0.88, metallic: 0.14 },
  roof: { slot: 'roof', localRef: ref, roughness: 0.98, metallic: 0 },
  glass: { slot: 'window', localRef: 'palette:#feffff', roughness: 0.36, metallic: 0.06 },
};
function tri(o, s, ps, n, col = C[s]) {
  const rounded = ps.map((p) => p.map(Math.fround));
  const cr = cross(
    rounded[1].map((v, i) => v - rounded[0][i]),
    rounded[2].map((v, i) => v - rounded[0][i]),
  );
  if (Math.hypot(...cr) < 1e-8) return;
  if (n && cr.reduce((v, p, i) => v + p * n[i], 0) < 0) ps = [ps[0], ps[2], ps[1]];
  const normal = normalFor(...ps),
    a = normal.map(Math.abs);
  const uv =
    a[1] > 0.65 ? (p) => [p[0], p[2]] : a[0] > a[2] ? (p) => [p[2], p[1]] : (p) => [p[0], p[1]];
  o.addTriangle(s, ref, ps, normal, ps.map(uv), col);
}
function Q(o, s, ps, n, col = C[s]) {
  tri(o, s, [ps[0], ps[1], ps[2]], n, col);
  tri(o, s, [ps[0], ps[2], ps[3]], n, col);
}
const rect = (x, y, w, h) => [
  [x - w / 2, y],
  [x + w / 2, y],
  [x + w / 2, y + h],
  [x - w / 2, y + h],
];
function panel(o, s, outer, holes, p, n, col = C[s]) {
  const rings = [outer, ...holes],
    pts = rings.flat();
  const starts = holes.map(
    (_, i) => outer.length + holes.slice(0, i).reduce((v, r) => v + r.length, 0),
  );
  const ix = earcut(pts.flat(), starts);
  for (let j = 0; j < ix.length; j += 3)
    tri(
      o,
      s,
      ix.slice(j, j + 3).map((i) => p(...pts[i])),
      n,
      col,
    );
}
function glazed(o, r, p, n, d) {
  const depth = d > 1 ? -0.2 : -0.08,
    back = (x, y) => p(x, y, depth);
  panel(o, 'glass', r, [], back, n);
  if (d === 0) return;
  for (let i = 0; i < 4; i++) {
    const a = r[i],
      b = r[(i + 1) % 4];
    Q(
      o,
      'steel',
      [p(...a), p(...b), back(...b), back(...a)],
      normalFor(p(...a), p(...b), back(...b)),
    );
  }
  const [a, b, , e] = r,
    mx = (a[0] + b[0]) / 2,
    my = (a[1] + e[1]) / 2;
  if (d > 1) {
    panel(
      o,
      'steel',
      rect(mx, my - 0.04, b[0] - a[0], 0.08),
      [],
      (x, y) => p(x, y, -0.12),
      n,
      C.white,
    );
    panel(o, 'steel', rect(mx, a[1], 0.075, e[1] - a[1]), [], (x, y) => p(x, y, -0.12), n, C.white);
    if (d === 3)
      for (const k of [0.23, 0.77])
        panel(
          o,
          'steel',
          rect(a[0] + k * (b[0] - a[0]), a[1], 0.055, e[1] - a[1]),
          [],
          (x, y) => p(x, y, -0.12),
          n,
          C.white,
        );
  }
}
function walls(o, lo, hi, height, d, windows) {
  const ring = [
    [lo[0], hi[1]],
    [hi[0], hi[1]],
    [hi[0], lo[1]],
    [lo[0], lo[1]],
  ];
  for (let i = 0; i < 4; i++) {
    const a = ring[i],
      b = ring[(i + 1) % 4],
      len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const u = [(b[0] - a[0]) / len, (b[1] - a[1]) / len],
      n = [-u[1], 0, u[0]];
    const p = (x, y, z = 0) => [a[0] + u[0] * x + n[0] * z, y, a[1] + u[1] * x + n[2] * z];
    const hs = windows(i, len, d).map((h) => rect(...h));
    panel(
      o,
      'wall',
      [
        [0, 0],
        [len, 0],
        [len, height],
        [0, height],
      ],
      d === 0 ? [] : hs,
      p,
      n,
    );
    for (const h of hs) glazed(o, h, p, n, d);
    if (d > 0) {
      panel(
        o,
        'steel',
        rect(len / 2, height - 0.18, len, 0.22),
        [],
        (x, y) => p(x, y, 0.08),
        n,
        C.white,
      );
      panel(o, 'wall', rect(len / 2, 0.1, len, 0.35), [], (x, y) => p(x, y, 0.06), n, C.concrete);
    }
  }
  box(o, 'roof', [lo[0], height - 0.1, lo[1]], [hi[0], height + 0.12, hi[1]], C.roof);
  if (d > 1) {
    box(
      o,
      'wall',
      [lo[0] - 0.07, height, lo[1] - 0.07],
      [hi[0] + 0.07, height + 0.32, lo[1] + 0.12],
      C.white,
    );
    box(
      o,
      'wall',
      [lo[0] - 0.07, height, hi[1] - 0.12],
      [hi[0] + 0.07, height + 0.32, hi[1] + 0.07],
      C.white,
    );
  }
}
function cylinder(o, s, x, z, y0, y1, r0, r1, n, col = C[s], cap = true) {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2,
      b = ((i + 1) / n) * Math.PI * 2;
    const p = (angle, y, r) => [x + Math.cos(angle) * r, y, z + Math.sin(angle) * r];
    Q(
      o,
      s,
      [p(a, y0, r0), p(b, y0, r0), p(b, y1, r1), p(a, y1, r1)],
      [Math.cos((a + b) / 2), 0, Math.sin((a + b) / 2)],
      col,
    );
    if (cap) {
      tri(o, s, [[x, y1, z], p(a, y1, r1), p(b, y1, r1)], [0, 1, 0], col);
      tri(o, s, [[x, y0, z], p(a, y0, r0), p(b, y0, r0)], [0, -1, 0], col);
    }
  }
}
function ring(o, x, z, y, r, w, n, col = C.steel) {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2,
      b = ((i + 1) / n) * Math.PI * 2;
    beam(
      o,
      'steel',
      [x + Math.cos(a) * r, y, z + Math.sin(a) * r],
      [x + Math.cos(b) * r, y, z + Math.sin(b) * r],
      w,
      w,
      col,
    );
  }
}
function shell(o, d) {
  const x = 18,
    z = -3,
    r = 19.812,
    cy = 11.2776,
    n = [16, 32, 64, 96][d],
    rows = [6, 12, 24, 40][d];
  const bottom = Math.asin(-cy / r),
    top = Math.PI / 2,
    latitudes = new Set([bottom, 0, top]);
  for (let j = 1; j < rows; j++) latitudes.add(bottom + ((top - bottom) * j) / rows);
  const ls = [...latitudes].sort((a, b) => a - b),
    p = (a, t, off = 0) => [
      x + Math.cos(a) * (r + off) * Math.cos(t),
      cy + Math.sin(t) * (r + off),
      z + Math.sin(a) * (r + off) * Math.cos(t),
    ];
  for (let j = 1; j < ls.length; j++)
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2,
        b = ((i + 1) / n) * Math.PI * 2,
        t = ls[j - 1],
        v = ls[j];
      Q(
        o,
        'shell',
        [p(a, t), p(b, t), p(b, v), p(a, v)],
        [
          Math.cos((a + b) / 2) * Math.cos((t + v) / 2),
          Math.sin((t + v) / 2),
          Math.sin((a + b) / 2) * Math.cos((t + v) / 2),
        ],
      );
    }
  const rb = Math.sqrt(r * r - cy * cy);
  cylinder(o, 'wall', x, z, -0.5, 0.2, rb + 0.3, rb + 0.3, n, C.concrete);
  cylinder(o, 'steel', x, z, cy - 0.13, cy + 0.13, r + 0.24, r + 0.24, n, C.steel, false);
  // The exposed lower shell curves inward toward grade; ribs follow that profile.
  const ribCount = [8, 12, 24, 24][d],
    segs = d > 1 ? 4 : 2;
  for (let i = 0; i < ribCount; i++) {
    const a = (i / ribCount) * Math.PI * 2;
    for (let j = 0; j < segs; j++) {
      const t = bottom + ((0 - bottom) * j) / segs,
        v = bottom + ((0 - bottom) * (j + 1)) / segs;
      beam(o, 'steel', p(a, t, 0.3), p(a, v, 0.3), d === 0 ? 0.4 : 0.23, 0.25, C.steel);
    }
  }
  if (d > 0) {
    const crownY = 29.25,
      crownR = Math.sqrt(r * r - (crownY - cy) * (crownY - cy));
    ring(o, x, z, crownY + 0.1, crownR, 0.18, n, C.steel);
    ring(o, x, z, crownY + 1.05, crownR, 0.075, n, C.steel);
    for (let i = 0; i < [0, 12, 24, 36][d]; i++) {
      const a = (i / [0, 12, 24, 36][d]) * Math.PI * 2;
      beam(
        o,
        'steel',
        [x + Math.cos(a) * crownR, crownY, z + Math.sin(a) * crownR],
        [x + Math.cos(a) * crownR, crownY + 1.05, z + Math.sin(a) * crownR],
        0.065,
        0.065,
        C.steel,
      );
    }
    const angle = 3.55,
      end = Math.asin((crownY - cy) / r),
      ladderRows = d > 1 ? 30 : 12,
      sideAngle = 0.65 / r;
    for (let j = 0; j < ladderRows; j++) {
      const t = bottom + ((end - bottom) * j) / ladderRows,
        v = bottom + ((end - bottom) * (j + 1)) / ladderRows;
      for (const a of [angle - sideAngle, angle + sideAngle])
        beam(o, 'steel', p(a, t, 0.38), p(a, v, 0.38), 0.075, 0.075, C.dark);
      if (d > 1)
        beam(
          o,
          'steel',
          p(angle - sideAngle, t, 0.38),
          p(angle + sideAngle, t, 0.38),
          0.055,
          0.055,
          C.dark,
        );
    }
  }
}
function stack(o, d) {
  const n = [8, 12, 24, 40][d],
    h = 73.152,
    r = (y) => 1.65 - ((1.65 - 1.05) * y) / h;
  cylinder(o, 'wall', -6, -22, -0.4, 0.5, 2.15, 2.15, n, C.concrete);
  for (let i = 0; i < 7; i++) {
    const y0 = (i * h) / 7,
      y1 = ((i + 1) * h) / 7;
    cylinder(o, 'steel', -6, -22, y0, y1, r(y0), r(y1), n, i % 2 === 0 ? C.red : C.white, false);
  }
  // Thin dark inset at the top reads as an open mouth, without any internal equipment.
  cylinder(o, 'roof', -6, -22, h - 0.14, h, 1.02, 1.02, n, C.dark);
  if (d > 1) {
    for (const yy of [15, 42, 68]) ring(o, -6, -22, yy, r(yy) + 0.04, 0.06, n, C.steel);
    for (const x of [-6.28, -5.72])
      beam(o, 'steel', [x, 0.5, -23.75], [x, 72.3, -23.12], 0.055, 0.055, C.steel);
    if (d === 3)
      for (let y = 1; y < 72; y += 0.45)
        beam(
          o,
          'steel',
          [-6.28, y, -23.75 + (0.63 * y) / 72],
          [-5.72, y, -23.75 + (0.63 * y) / 72],
          0.045,
          0.045,
          C.steel,
        );
  }
}
function build(o, _frame, d = 3) {
  shell(o, d);
  stack(o, d);
  walls(o, [-42, -18], [-4, 14], 20.5, d, (i, len) => {
    const result = [];
    if (i === 0 || i === 2) {
      const count = d === 0 ? 1 : d === 1 ? 5 : 10;
      for (let k = 0; k < count; k++)
        result.push([(len * (k + 0.5)) / count, 17.9, (len / count) * 0.79, 1.55]);
    } else if (d > 1) {
      for (let k = 0; k < 4; k++) result.push([(len * (k + 0.5)) / 4, 2.5, 2.6, 3.4]);
    }
    return result;
  });
  walls(o, [-38, 13], [0, 29], 12.5, d, (i, len) => {
    const result = [],
      count = d === 0 ? 1 : i % 2 === 0 ? 6 : 3;
    for (let k = 0; k < count; k++)
      for (const y of [2.4, 7.8])
        result.push([
          (len * (k + 0.5)) / count,
          y,
          d === 0 ? len * 0.85 : (len / count) * 0.6,
          2.65,
        ]);
    return result;
  });
  // Front piers are deeper than the glazing: the facade retains its vertical rhythm.
  for (let i = 0; i < 7; i++) {
    const x = -38 + (i * 38) / 6;
    box(o, 'steel', [x - 0.34, 0.3, 29.02], [x + 0.34, 12.75, 29.65], C.dark);
  }
  box(o, 'roof', [-21, 3.7, 29], [-13, 4.05, 33.8], C.dark);
  for (const x of [-20.65, -13.35]) box(o, 'steel', [x, 0, 33.4], [x + 0.1, 3.75, 33.55], C.steel);
  box(o, 'wall', [-20, -0.25, 31], [-14, 0.05, 34], C.concrete);
  box(o, 'wall', [-3, 0, -10], [8, 10, 9], C.wall);
  walls(o, [37, -10], [53, 5], 8.6, d, (i, len) => {
    if (i % 2 === 0)
      return [
        [len * 0.3, 3.5, 2, 2.1],
        [len * 0.7, 3.5, 2, 2.1],
      ];
    return [[len * 0.5, 4, 2.4, 2.6]];
  });
  box(o, 'wall', [33, 0, -7], [39, 5, 2], C.concrete);
  if (d > 0) {
    for (const x of [41.5, 48.5])
      box(o, 'steel', [x - 0.08, 0.5, 5.02], [x + 0.08, 8.5, 5.22], C.steel);
    if (d > 1)
      for (let y = 4.1; y < 6.5; y += 0.32)
        box(o, 'steel', [43, y, 5.09], [46, y + 0.08, 5.23], C.steel);
    for (const [x, z, w, l] of [
      [-30, -4, 2.8, 2],
      [-14, -9, 2.2, 1.8],
      [-20, 20, 2, 1.6],
    ]) {
      const y = z > 13 ? 12.62 : 20.62;
      box(o, 'steel', [x - w / 2, y, z - l / 2], [x + w / 2, y + 0.7, z + l / 2], C.steel);
    }
  }
}
export const bigRockPointSkyline = (o, f) => build(o, f, 0);
export const bigRockPointDistrict = (o, f) => build(o, f, 1);
export const bigRockPointStreet = (o, f) => build(o, f, 2);
export const bigRockPointModel = {
  id: 'big_rock_point_nuclear_power_plant',
  key: 'big_rock_point_nuclear_power_plant',
  recipe: 'structure-big-rock-point-nuclear-power-plant.mjs',
  cell: 'f0/f05',
  title: 'Big Rock Point Nuclear Power Plant',
  category: 'industrial',
  progressLedger: 'qualla-002.PROGRESS.md',
  build,
  surfaces,
  appearance: plan.appearance,
  brief:
    'Representative circa1963historical Big Rock Point principal station exterior: clipped spherical steel containment, equatorial rim/outer ribs/crown walkway and curved access ladder, tapered red/white striped stack, attached high flat-roof turbine hall/clerestory, front two-storey glazed pier block/canopy and intrinsic shoreward water building/short service connection. No plant internals, modern spent-fuel yard or landscape. Photographic plan/sections and colors are estimates; historical-only.',
  camera: [130, 85, 155],
  lookAt: [2, 28, 0],
  portableGroundY: -0.55,
  mediumFiContext: { scale: 1.7, groundY: -0.55 },
  qaCameras: [
    {
      name: 'clipped-sphere-equatorial-rim-and-front-pier-block',
      position: [80, 28, 104],
      lookAt: [10, 16, 8],
    },
    {
      name: 'sphere-crown-walkway-and-exterior-access-ladder',
      position: [-28, 48, -48],
      lookAt: [13, 24, -6],
    },
    {
      name: 'tapered-striped-stack-and-hall-clerestory',
      position: [-81, 53, 50],
      lookAt: [-17, 34, -8],
    },
    {
      name: 'shoreward-water-building-and-lower-shell-ribs',
      position: [85, 18, -34],
      lookAt: [33, 10, -4],
    },
  ],
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  groundContactBasis:
    plan.geometryBasis +
    ' Independent restored-site terrain frozen at fixed southwest approach before geometry. Historic plant grades/shore/foundations remain approximate.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-big-rock-point-nuclear-power-plant.mjs',
    level: 'skyline',
    export: 'bigRockPointSkyline',
    errorMeters: 1.5,
    surfaces,
    authoredLevels: {
      district: { export: 'bigRockPointDistrict', errorMeters: 0.65, surfaces },
      street: { export: 'bigRockPointStreet', errorMeters: 0.2, surfaces },
    },
  },
  limitations: [
    plan.geometryBasis,
    'Historical representative circa1963appearance only, with1963-01-01through1964-01-01viewing range. DOE archive photos are undated;1963is an interpretation of early-operation configuration, not their exposure date or proof of unchanged later years. Original station demolished; never current-world eligible.',
    'Three exact already-published QuallaDOE exterior originals/native SHA1s and primary PD-USGov-DOE/ENERGY.GOVreviewed government-work releases bind all reference imagery. Generated Qualla categories omit the grant, recovered through exact primary proof without editing media metadata. Interior/fish images, modern marker artwork, attribution-licensed1970/NRCphotos and postcards unused. No generated bitmap or copied image pixels.',
    'Nominal130ftdiameter shell/28ftburied/102ftvisible and240ftstack are owner text controls. Above-grade clipped spherical shell preserves inward-curving lower profile, rim/ribs/crown walkway/ladder, seven alternating broad stack bands, attached tall turbinehall/clerestory, lower front glazed pier block/canopy and shoreward cooling-water building. Module dimensions/bearing/hidden sections/window counts/roof vents/ribs/crown details are bounded photographic estimates. Muted blue-green shell and pale walls are material estimates from monochrome; red/white stack is confirmed by owner text. No engineering/interior/operational replica claim.',
    'Switchyard/powerlines, detached sheds, parking/roads, vegetation, shoreline riprap/lake, people/vehicles/lettering, modern marker and spent-fuel storage excluded. No whole-site slab. Fixed independent modern Terrarium field remains unchanged; restored shore/greenfield differs from historic station grading. Exact historical ground/foundation/host attachment unverified.',
  ],
};
