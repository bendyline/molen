/** Ambassador Hotel opening-year exterior; explicit historical viewing only. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { beam, normalFor } from './authored-structure-mesh.mjs';
import { rgb } from './landmark-model-helpers.mjs';
import { box } from './structure-mesh.mjs';

const plan = JSON.parse(
  fs.readFileSync(
    new URL(
      '../../../content/worldgen/source/places/9q/9q5/ambassador_hotel_los_angeles/plan-controls.json',
      import.meta.url,
    ),
  ),
);
const ref = 'palette:#ffffff',
  C = {
    wall: rgb('d8d2b9'),
    trim: rgb('c6bea5'),
    base: rgb('aaa58e'),
    roof: rgb('696354'),
    glass: rgb('536762'),
    wood: rgb('686452'),
  };
const surfaces = {
  wall: { slot: 'wall', graph: 'plaster_lime', roughness: 0.96, metallic: 0 },
  trim: { slot: 'trim', graph: 'wood_plain', roughness: 0.94, metallic: 0 },
  base: { slot: 'wall', graph: 'concrete_plain', roughness: 0.97, metallic: 0 },
  roof: { slot: 'roof', graph: 'tile_flat', roughness: 0.96, metallic: 0 },
  glass: { slot: 'window', localRef: 'palette:#feffff', roughness: 0.36, metallic: 0.06 },
};
const P = (p) => [
  (p[0] - plan.plotFrame.blockOrigin[0]) * plan.plotFrame.metersPerPixel,
  (p[1] - plan.plotFrame.blockOrigin[1]) * plan.plotFrame.metersPerPixel,
];
const upper = [
  [595, 260],
  [626, 249],
  [648, 305],
  [648, 346],
  [777, 346],
  [777, 305],
  [794, 255],
  [826, 267],
  [808, 318],
  [808, 456],
  [827, 498],
  [798, 512],
  [777, 457],
  [777, 401],
  [648, 401],
  [648, 456],
  [629, 512],
  [599, 498],
  [615, 456],
  [615, 318],
].map(P);
const area = (r) =>
    r.reduce((s, p, i) => s + p[0] * r[(i + 1) % r.length][1] - r[(i + 1) % r.length][0] * p[1], 0),
  clockwise = (r) => (area(r) < 0 ? r : [...r].reverse());
function tri(o, s, ps, n, color = C[s]) {
  if (n && normalFor(...ps).reduce((v, p, i) => v + p * n[i], 0) < 0) ps = [ps[0], ps[2], ps[1]];
  const normal = normalFor(...ps),
    a = normal.map(Math.abs),
    uv =
      a[1] > 0.65 ? (p) => [p[0], p[2]] : a[0] > a[2] ? (p) => [p[2], p[1]] : (p) => [p[0], p[1]];
  o.addTriangle(s, ref, ps, normal, ps.map(uv), color);
}
function Q(o, s, ps, n, color = C[s]) {
  tri(o, s, [ps[0], ps[1], ps[2]], n, color);
  tri(o, s, [ps[0], ps[2], ps[3]], n, color);
}
function cap(o, s, r, y, up = true) {
  const ix = earcut(r.flat());
  for (let j = 0; j < ix.length; j += 3)
    tri(
      o,
      s,
      ix.slice(j, j + 3).map((i) => [r[i][0], y, r[i][1]]),
      [0, up ? 1 : -1, 0],
    );
}
function frame(a, b) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]),
    u = [(b[0] - a[0]) / len, (b[1] - a[1]) / len],
    n = [-u[1], u[0]];
  return {
    len,
    u,
    n,
    p: (x, y, z = 0) => [a[0] + u[0] * x + n[0] * z, y, a[1] + u[1] * x + n[1] * z],
  };
}
const rect = (x, y, w, h) => [
  [x - w / 2, y],
  [x + w / 2, y],
  [x + w / 2, y + h],
  [x - w / 2, y + h],
];
function panel(o, s, outer, holes, f, depth = 0, color = C[s]) {
  const pts = [outer, ...holes].flat(),
    starts = holes.map(
      (_, i) => outer.length + holes.slice(0, i).reduce((s, r) => s + r.length, 0),
    ),
    ix = earcut(pts.flat(), starts);
  for (let j = 0; j < ix.length; j += 3)
    tri(
      o,
      s,
      ix.slice(j, j + 3).map((i) => f.p(...pts[i], depth)),
      [f.n[0], 0, f.n[1]],
      color,
    );
}
function strip(o, s, f, x, y, w, h, z = 0.025, color = C[s]) {
  panel(o, s, rect(x, y, w, h), [], f, z, color);
}
function window(o, f, h, d) {
  panel(o, 'glass', h.r, [], f, d < 2 ? 0.025 : -0.15);
  if (d < 2) return;
  for (let j = 0; j < 4; j++) {
    const a = h.r[j],
      b = h.r[(j + 1) % 4],
      ps = [f.p(...a), f.p(...b), f.p(...b, -0.15), f.p(...a, -0.15)];
    Q(o, 'wall', ps, normalFor(...ps));
  }
  strip(o, 'trim', f, h.x, h.y + h.height * 0.53, h.width, 0.065, -0.07, C.wood);
  if (h.width > 1.75) strip(o, 'trim', f, h.x, h.y, 0.065, h.height, -0.07, C.wood);
  if (d === 3) {
    for (const sg of [-1, 1])
      strip(o, 'trim', f, h.x + (sg * h.width) / 2, h.y, 0.08, h.height, 0.035, C.wood);
    strip(o, 'trim', f, h.x, h.y, h.width + 0.14, 0.08, 0.035, C.wood);
    strip(o, 'trim', f, h.x, h.y + h.height - 0.08, h.width + 0.14, 0.08, 0.035, C.wood);
    const a = f.p(h.x - h.width / 2 - 0.09, h.y - 0.07, 0.1),
      b = f.p(h.x + h.width / 2 + 0.09, h.y - 0.07, 0.1);
    beam(o, 'trim', a, b, 0.12, 0.18, C.trim);
    if (h.height > 1.8)
      strip(o, 'trim', f, h.x, h.y + h.height * 0.25, h.width, 0.04, -0.065, C.wood);
  }
}
function facade(o, a, b, low, high, d, rows, spacing = 3.3, entry = false) {
  const f = frame(a, b),
    pitch = d === 0 ? 13 : d === 1 ? 8 : d === 2 ? 5.0 : spacing,
    count = Math.max(1, Math.round(f.len / pitch)),
    holes = [],
    visible = d === 1 && rows.length > 3 ? rows.filter((_, i) => i % 2 === 0) : rows;
  if (d === 0) {
    panel(o, 'wall', rect(f.len / 2, low, f.len, high - low), [], f);
    for (let j = 0; j < count; j++)
      strip(o, 'glass', f, ((j + 0.5) * f.len) / count, low + 0.5, 1.25, high - low - 1.2, 0.025);
    return;
  }
  for (const y of visible)
    for (let j = 0; j < count; j++) {
      const x = ((j + 0.5) * f.len) / count,
        width = entry ? Math.min(2.3, (f.len / count) * 0.6) : 1.35,
        height = entry ? 2.6 : 2.25;
      if (y + height > high - 0.08 || y < low + 0.05) continue;
      holes.push({ x, y, width, height, r: rect(x, y, width, height) });
    }
  panel(o, 'wall', rect(f.len / 2, low, f.len, high - low), d < 2 ? [] : holes.map((h) => h.r), f);
  for (const h of holes) window(o, f, h, d);
  strip(o, 'wall', f, f.len / 2, high - 0.26, f.len, 0.18, 0.04);
  if (d === 3 && high > 20)
    for (const x of [0.22, f.len - 0.22]) strip(o, 'wall', f, x, low, 0.3, high - low - 0.1, 0.05);
}
function block(o, ring, low, high, d, rows, spacing = 3.3) {
  const r = clockwise(ring);
  for (let j = 0; j < r.length; j++)
    facade(o, r[j], r[(j + 1) % r.length], low, high, d, rows, spacing);
  cap(o, 'base', r, low, false);
}
function offsetRing(r, distance) {
  const sign = area(r) > 0 ? 1 : -1;
  return r.map((p, i) => {
    const prev = r[(i + r.length - 1) % r.length],
      next = r[(i + 1) % r.length],
      a = frame(prev, p),
      b = frame(p, next),
      na = a.n.map((x) => -sign * x),
      nb = b.n.map((x) => -sign * x),
      den = 1 + na[0] * nb[0] + na[1] * nb[1];
    return p.map(
      (v, k) =>
        v +
        Math.max(
          -distance * 3,
          Math.min(distance * 3, ((na[k] + nb[k]) * distance) / Math.max(0.1, den)),
        ),
    );
  });
}
function roofFaces(o, eaveRing, faces, eaveY, d) {
  for (const ps of faces)
    for (let j = 1; j < ps.length - 1; j++) tri(o, 'roof', [ps[0], ps[j], ps[j + 1]], [0, 1, 0]);
  // Closed eave lips and soffits follow the whole original splayed perimeter.
  for (let i = 0; i < eaveRing.length; i++) {
    const a = eaveRing[i],
      b = eaveRing[(i + 1) % eaveRing.length],
      f = frame(a, b),
      n = f.n.map((v) => -v),
      ps = [
        [a[0], eaveY, a[1]],
        [b[0], eaveY, b[1]],
        [b[0], eaveY - 0.18, b[1]],
        [a[0], eaveY - 0.18, a[1]],
      ];
    Q(o, 'trim', ps, [n[0], 0, n[1]]);
  }
  cap(o, 'trim', eaveRing, eaveY - 0.18, false);
  if (d > 1)
    for (const face of faces) {
      const n = normalFor(...face.slice(0, 3));
      if (Math.abs(n[1]) < 0.25) continue;
      // A few restrained courses give the dark roof scale without literal copied tile imagery.
      if (d === 3 && face.length === 4)
        for (const t of [0.2, 0.4, 0.6, 0.8]) {
          const a = face[0].map((v, k) => v + (face[3][k] - v) * t),
            b = face[1].map((v, k) => v + (face[2][k] - v) * t);
          beam(o, 'roof', a, b, 0.035, 0.035, C.roof);
        }
    }
}
function wingRoof(o, module, centers, d) {
  const e = offsetRing(module.ring.map(P), 0.65),
    y = 22.8,
    ridges = centers.map((p) => {
      const q = P(p);
      return [q[0], 28.2, q[1]];
    }),
    v = e.map((p) => [p[0], y, p[1]]),
    [r0, r1, r2, r3] = ridges;
  const faces = [
    [v[0], v[1], r0],
    [v[1], v[2], r1, r0],
    [v[2], v[3], r2, r1],
    [v[3], v[4], r3, r2],
    [v[4], v[5], r3],
    [v[5], v[6], r2, r3],
    [v[6], v[7], r1, r2],
    [v[7], v[0], r0, r1],
  ];
  roofFaces(o, e, faces, y, d);
  if (d > 0)
    for (let j = 1; j < ridges.length; j++)
      beam(o, 'roof', ridges[j - 1], ridges[j], 0.12, 0.14, C.roof);
}
function hipRect(o, ring, y, rise, d, overhang = 0.55) {
  const e = offsetRing(ring, overhang),
    xs = e.map((p) => p[0]),
    zs = e.map((p) => p[1]),
    x0 = Math.min(...xs),
    x1 = Math.max(...xs),
    z0 = Math.min(...zs),
    z1 = Math.max(...zs),
    alongX = x1 - x0 > z1 - z0,
    midX = (x0 + x1) / 2,
    midZ = (z0 + z1) / 2,
    r = alongX
      ? [
          [x0 + (z1 - z0) * 0.43, y + rise, midZ],
          [x1 - (z1 - z0) * 0.43, y + rise, midZ],
        ]
      : [
          [midX, y + rise, z0 + (x1 - x0) * 0.43],
          [midX, y + rise, z1 - (x1 - x0) * 0.43],
        ],
    v = [
      [x0, y, z0],
      [x1, y, z0],
      [x1, y, z1],
      [x0, y, z1],
    ],
    faces = alongX
      ? [
          [v[0], v[1], r[1], r[0]],
          [v[1], v[2], r[1]],
          [v[2], v[3], r[0], r[1]],
          [v[3], v[0], r[0]],
        ]
      : [
          [v[0], v[1], r[0]],
          [v[1], v[2], r[1], r[0]],
          [v[2], v[3], r[1]],
          [v[3], v[0], r[0], r[1]],
        ];
  roofFaces(o, e, faces, y, d);
  if (d > 0) beam(o, 'roof', r[0], r[1], 0.12, 0.14, C.roof);
}
function lower(o, d) {
  for (const m of plan.attachedLowerModulesPixels) {
    const r = m.ring.map(P),
      rows = m.name.includes('terrace') ? [0.6] : [0.8, 4.25];
    block(o, r, -1.2, m.eaves, d, rows, 3.9);
    if (m.name.includes('kitchen')) {
      cap(o, 'roof', r, m.eaves);
      const k = [
        [680, 251],
        [733, 251],
        [733, 296],
        [680, 296],
      ].map(P);
      block(o, k, m.eaves, 12.6, d, [10], 4.2);
      cap(o, 'roof', k, 12.6);
    } else if (m.name.includes('terrace')) {
      cap(o, 'roof', r, m.eaves);
      const rr = clockwise(r);
      if (d > 0)
        for (let i = 0; i < rr.length; i++) {
          const f = frame(rr[i], rr[(i + 1) % rr.length]);
          strip(o, 'wall', f, f.len / 2, m.eaves - 0.25, f.len, 0.25, 0.08);
        }
    } else hipRect(o, r, m.eaves, 1.4, d, 0.45);
  }
}
function entrance(o, d) {
  const x = 4.35,
    z = 18.5,
    w = 7.0,
    length = 7.4,
    y = 4.1,
    top = 4.65;
  box(o, 'roof', [x - w / 2, y, z - length / 2], [x + w / 2, top, z + length / 2], C.roof);
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) {
      const px = x + sx * (w / 2 - 0.28),
        pz = z + sz * (length / 2 - 0.28);
      box(o, 'wall', [px - 0.19, 0, pz - 0.19], [px + 0.19, y, pz + 0.19], C.wall);
      if (d > 1) box(o, 'wall', [px - 0.3, 3.78, pz - 0.3], [px + 0.3, y, pz + 0.3], C.wall);
    }
  if (d > 0) {
    for (const sz of [-1, 1])
      box(
        o,
        'wall',
        [x - w / 2, y - 0.21, z + (sz * length) / 2 - 0.08],
        [x + w / 2, y, z + (sz * length) / 2 + 0.08],
        C.wall,
      );
  }
  // Own shallow threshold steps only; no courtyard or whole-parcel pavement.
  for (let i = 0; i < 3; i++)
    box(
      o,
      'base',
      [x - 2.4, 0, 15.1 + i * 0.42],
      [x + 2.4, (3 - i) * 0.16, 15.1 + (i + 1) * 0.42],
      C.base,
    );
}
function roofService(o, d) {
  const centers = [
    [4.8, -11.6],
    [-18, -11.6],
  ];
  for (const [x, z] of centers) {
    box(o, 'wall', [x - 1.7, 26, z - 1.25], [x + 1.7, 30.5, z + 1.25], C.wall);
    box(o, 'trim', [x - 1.9, 30.5, z - 1.4], [x + 1.9, 31, z + 1.4], C.trim);
    if (d > 1) {
      const f = frame([x - 1.7, z + 1.27], [x + 1.7, z + 1.27]);
      for (let j = 0; j < (d === 3 ? 5 : 2); j++)
        strip(o, 'glass', f, 1.7, 28.2 + j * 0.3, 2.3, 0.11, 0.015);
    }
  }
}
function build(o, _frame, d = 3) {
  block(o, plan.outline, -1.2, 3.5, d, [1.0], 4.3);
  cap(o, 'roof', plan.outline, 3.5);
  block(o, upper, 3.5, 22.8, d, [5.1, 8.7, 12.3, 15.9, 19.5]);
  hipRect(o, plan.estimatedUpperModulesPixels[0].ring.map(P), 22.8, 5.4, d, 0.65);
  wingRoof(
    o,
    plan.estimatedUpperModulesPixels[1],
    [
      [615.7, 268.6],
      [631.5, 311.5],
      [631.5, 456],
      [619, 490.9],
    ],
    d,
  );
  wingRoof(
    o,
    plan.estimatedUpperModulesPixels[2],
    [
      [805.1, 275.2],
      [792.5, 311.5],
      [792.5, 456.5],
      [806.8, 491.1],
    ],
    d,
  );
  lower(o, d);
  entrance(o, d);
  roofService(o, d);
}
export const ambassadorSkyline = (o, f) => build(o, f, 0);
export const ambassadorDistrict = (o, f) => build(o, f, 1);
export const ambassadorStreet = (o, f) => build(o, f, 2);
export const ambassadorHotelModel = {
  id: 'ambassador_hotel_los_angeles',
  key: 'ambassador_hotel_los_angeles',
  recipe: 'structure-ambassador-hotel-los-angeles.mjs',
  cell: '9q/9q5',
  title: 'Ambassador Hotel, Los Angeles',
  category: 'hotel-commercial',
  progressLedger: 'qualla-002.PROGRESS.md',
  build,
  surfaces,
  appearance: plan.appearance,
  brief:
    'Opening-year1921historical Ambassador Hotel: complete H-shaped six-storey stucco guest block/four splayed arms/open courts, overhanging intersecting dark hipped roofs/terminal ridges and roof service stacks, traced larger lower casino/base, attached lower north dining/cafe block, rear kitchen/service projection and east indoor terrace/own open entrance canopy/threshold. Original period plans/aerial guide topology; exact upper floor/roof/window/section and street registration estimates. Historical-only1921; no modern hotel or current school model.',
  camera: [145, 94, 175],
  lookAt: [5, 13, -8],
  portableGroundY: -1.4,
  mediumFiContext: { scale: 1.9, groundY: -1.4 },
  qaCameras: [
    {
      name: 'east-h-shaped-guest-wings-open-court-and-entry',
      position: [98, 37, 130],
      lookAt: [3, 12, 2],
    },
    {
      name: 'splayed-wing-hipped-roof-eaves-and-sash-windows',
      position: [-77, 40, 77],
      lookAt: [-34, 19, 27],
    },
    {
      name: 'rear-service-block-and-west-open-court',
      position: [-95, 62, -135],
      lookAt: [0, 13, -42],
    },
    {
      name: 'north-attached-dining-block-and-terrace-canopy',
      position: [135, 30, 64],
      lookAt: [58, 6, -1],
    },
  ],
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  groundContactBasis:
    plan.geometryBasis +
    ' Independent modern terrain frozen at historical east entry before geometry. Old foundations/threshold/grade and changed school grading remain approximate; no flattening or parcel platform.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-ambassador-hotel-los-angeles.mjs',
    level: 'skyline',
    export: 'ambassadorSkyline',
    errorMeters: 1.7,
    surfaces,
    authoredLevels: {
      district: { export: 'ambassadorDistrict', errorMeters: 0.7, surfaces },
      street: { export: 'ambassadorStreet', errorMeters: 0.23, surfaces },
    },
  },
  limitations: [
    plan.geometryBasis,
    'Historical-only representative opening-year1921appearance, with explicit1921-01-01through1922-01-01viewing range. Photographs/plans were published in June/November1921; no exact exposure day, invariant later appearance or current surviving hotel is claimed. Modern school/park/marker are not substituted for former building geometry.',
    'Four exact native Qualla originals were inspected:1921Comstockaerial and casino/base/basement plans, plus November1921BuildingReviewplot signed MyronHunt. Exact nativeSHA1/pinned publisher/date/archival plate/PD-US records qualify; omitted generated category for the plot is resolved by hash-bound primary dated-publication proof, with Qualla media metadata untouched. No later postcard/2004facade/interior/portrait, generated bitmap or copied pixels.',
    'Whole central connected hotel assembly: six-storey Hguest block/four splayed arms and open courts, traced larger lower casino/base, low north dining/cafe/CocoanutGrove volume, rear kitchen/service and east indoor terrace/own open entrance canopy/threshold. Separate employee/garage ranges, detached resort cottages, gardens/tennis/roads/landscape, signage/artwork/interiors and modern campus excluded.',
    'The lower plans are not surveyed upper guest-floor plans. Upper Hunion,22.8meaves/28.2mridges/31mservice stacks, roof intersections, sash/window census, low-block sections/roof shape and entrance/hidden construction are bounded interpretations of the aerial and historic base/block plans. Pale warm stucco and dark tile/wood/glass are medium-fi material estimates from monochrome sources; no exact historic color survey or engineering replica claim.',
    'Native street junctions establish an approximate plot registration and metric scale, not original hotel corner surveys; changed road widths/paper reproduction introduce uncertainty. Raw300mcurrentTerrariumfield remains unchanged at fixed east entry.1921ground and modern campus grading differ; old footprint/threshold/bedrock/host contact remain unverified. No authored courtyard pavement or generic site slab.',
  ],
};
