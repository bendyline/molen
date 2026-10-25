/** Chamizal's connected cultural center: open C court, low wings and raised faceted theatre. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { beam, cross, normalFor } from './authored-structure-mesh.mjs';
import { rgb } from './landmark-model-helpers.mjs';
import { box } from './structure-mesh.mjs';

const plan = JSON.parse(
    fs.readFileSync(
      new URL(
        '../../../content/worldgen/source/places/9t/9ts/chamizal_cultural_center/plan-controls.json',
        import.meta.url,
      ),
    ),
  ),
  ref = 'palette:#ffffff';
const C = {
  stone: rgb('a8a895'),
  roof: rgb('616b63'),
  fascia: rgb('a08a76'),
  trim: rgb('c9c8b5'),
  glass: rgb('576b69'),
  joint: rgb('7b857b'),
};
const surfaces = {
  stone: { slot: 'wall', graph: 'stone_drywall', roughness: 0.99, metallic: 0 },
  roof: { slot: 'roof', localRef: ref, roughness: 0.97, metallic: 0 },
  fascia: { slot: 'roof', graph: 'metal_painted', roughness: 0.89, metallic: 0.12 },
  trim: { slot: 'trim', graph: 'concrete_plain', roughness: 0.96, metallic: 0 },
  glass: { slot: 'window', localRef: 'palette:#feffff', roughness: 0.37, metallic: 0.07 },
};
const area = (r) =>
    r.reduce((s, p, i) => s + p[0] * r[(i + 1) % r.length][1] - r[(i + 1) % r.length][0] * p[1], 0),
  clockwise = (r) => (area(r) < 0 ? r : [...r].reverse()),
  outline = clockwise(plan.outline),
  theatre = clockwise([
    [9, -13],
    [13, -18],
    [26, -18],
    [31, -12],
    [31, 11],
    [26, 16],
    [13, 16],
    [9, 11],
  ]);
function tri(o, s, ps, n, col = C[s]) {
  const v = ps.map((p) => p.map(Math.fround)),
    cr = cross(
      v[1].map((x, i) => x - v[0][i]),
      v[2].map((x, i) => x - v[0][i]),
    );
  if (Math.hypot(...cr) < 1e-8) return;
  if (n && cr.reduce((s, v, i) => s + v * n[i], 0) < 0) ps = [ps[0], ps[2], ps[1]];
  const normal = normalFor(...ps),
    a = normal.map(Math.abs),
    uv =
      a[1] > 0.65 ? (p) => [p[0], p[2]] : a[0] > a[2] ? (p) => [p[2], p[1]] : (p) => [p[0], p[1]];
  o.addTriangle(s, ref, ps, normal, ps.map(uv), col);
}
function Q(o, s, p, n, col = C[s]) {
  tri(o, s, [p[0], p[1], p[2]], n, col);
  tri(o, s, [p[0], p[2], p[3]], n, col);
}
function cap(o, r, y, s = 'roof', up = true) {
  const ix = earcut(r.flat());
  for (let j = 0; j < ix.length; j += 3)
    tri(
      o,
      s,
      ix.slice(j, j + 3).map((k) => [r[k][0], y, r[k][1]]),
      [0, up ? 1 : -1, 0],
    );
}
function frame(a, b) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]),
    u = [(b[0] - a[0]) / len, (b[1] - a[1]) / len],
    n = [-u[1], 0, u[0]];
  return {
    len,
    u,
    n,
    P: (x, y, z = 0) => [a[0] + u[0] * x + n[0] * z, y, a[1] + u[1] * x + n[2] * z],
  };
}
const rect = (x, y, w, h) => [
  [x - w / 2, y],
  [x + w / 2, y],
  [x + w / 2, y + h],
  [x - w / 2, y + h],
];
function panel(o, s, outer, holes, f, depth = 0, col = C[s]) {
  const pts = [outer, ...holes].flat(),
    starts = holes.map(
      (_, i) => outer.length + holes.slice(0, i).reduce((s, r) => s + r.length, 0),
    ),
    ix = earcut(pts.flat(), starts);
  for (let j = 0; j < ix.length; j += 3)
    tri(
      o,
      s,
      ix.slice(j, j + 3).map((k) => f.P(...pts[k], depth)),
      f.n,
      col,
    );
}
function strip(o, s, f, x, y, w, h, depth = 0, col = C[s]) {
  panel(o, s, rect(x, y, w, h), [], f, depth, col);
}
function block(o, s, f, x, y, w, h, front, back, col = C[s]) {
  const r = rect(x, y, w, h);
  panel(o, s, r, [], f, front, col);
  for (let i = 0; i < 4; i++) {
    const a = r[i],
      b = r[(i + 1) % 4],
      ps = [f.P(...a, front), f.P(...b, front), f.P(...b, back), f.P(...a, back)];
    Q(o, s, ps, normalFor(...ps), col);
  }
}
function portal(o, f, x, width, d) {
  const h = 3.55,
    depth = 2.25,
    left = x - width / 2,
    right = x + width / 2,
    r = rect(x, 0, width, h);
  panel(o, 'glass', r, [], f, -depth);
  for (const [a, b] of [
    [
      [left, 0],
      [left, h],
    ],
    [
      [left, h],
      [right, h],
    ],
    [
      [right, h],
      [right, 0],
    ],
  ]) {
    const ps = [f.P(...a), f.P(...b), f.P(...b, -depth), f.P(...a, -depth)];
    Q(o, 'stone', ps, normalFor(...ps));
  }
  if (d > 0) {
    strip(o, 'trim', f, x, h - 0.17, width, 0.18, -depth + 0.06);
    for (const u of [left + 0.12, right - 0.12])
      strip(o, 'trim', f, u, 0.08, 0.12, h - 0.12, -depth + 0.06);
    if (width > 6) strip(o, 'trim', f, x, 0.08, 0.18, h - 0.12, -depth + 0.06);
    if (d > 1) {
      for (const u of [x - 0.6, x + 0.6]) strip(o, 'trim', f, u, 0.08, 0.065, 2.4, -depth + 0.08);
      strip(o, 'trim', f, x, 2.48, width - 0.2, 0.08, -depth + 0.08);
    }
  }
}
function base(o, d) {
  const chosen = new Set([9, 11, 17, 35, 36, 37, 38]),
    rows = d > 1 ? [1.45, 3.05] : [];
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i],
      b = outline[(i + 1) % outline.length],
      f = frame(a, b),
      sourceIdx = plan.outline.findIndex((p) => p[0] === a[0] && p[1] === a[1]),
      isPortal = chosen.has(sourceIdx) && f.len > 6,
      holes = [];
    if (isPortal) {
      const count = sourceIdx === 38 ? 3 : sourceIdx === 35 || sourceIdx === 9 ? 2 : 1,
        gap = sourceIdx === 38 ? 2.0 : 1.0,
        width = sourceIdx === 9 ? 3.2 : Math.min(6.4, (f.len - gap * (count + 1)) / count);
      for (let j = 0; j < count; j++) {
        const x = sourceIdx === 9 ? (j === 0 ? 3.5 : f.len - 3.5) : (f.len * (j + 0.5)) / count;
        holes.push({ x, w: width });
      }
    }
    panel(
      o,
      'stone',
      [
        [0, -0.35],
        [f.len, -0.35],
        [f.len, 4.45],
        [0, 4.45],
      ],
      holes.map((h) => rect(h.x, 0, h.w, 3.55)),
      f,
    );
    for (const h of holes) portal(o, f, h.x, h.w, d);
    strip(o, 'roof', f, f.len / 2, 4.45, f.len, 0.24, 0.1);
    if (d > 0) {
      strip(o, 'stone', f, f.len / 2, -0.1, f.len, 0.22, 0.025);
      strip(o, 'trim', f, f.len / 2, 4.19, f.len, 0.16, 0.05);
    }
    if (d > 1 && holes.length === 0 && f.len > 7) {
      const count = Math.max(1, Math.floor(f.len / 6));
      for (let j = 1; j < count; j++)
        strip(o, 'stone', f, (j * f.len) / count, 0.35, 0.025, 3.6, 0.012, C.joint);
      for (const y of rows) strip(o, 'stone', f, f.len / 2, y, f.len, 0.025, 0.012, C.joint);
    }
  }
  cap(o, outline, 4.45, 'roof', false);
  cap(o, outline, 4.69);
  cap(o, outline, -0.35, 'stone', false);
}
function mainTheatre(o, d) {
  const center = [20, -1],
    expand = (r, q) =>
      r.map((v) => [center[0] + (v[0] - center[0]) * q, center[1] + (v[1] - center[1]) * q]),
    lower = expand(theatre, 1.08),
    upper = expand(theatre, 0.92);
  for (let i = 0; i < theatre.length; i++) {
    const a = theatre[i],
      b = theatre[(i + 1) % theatre.length],
      f = frame(a, b);
    strip(o, 'stone', f, f.len / 2, 0, f.len, 5.8);
    strip(o, 'glass', f, f.len / 2, 5.8, f.len, 1.32, -0.5);
    const aa = f.P(0, 5.8),
      bb = f.P(0, 7.12),
      cc = f.P(f.len, 7.12),
      dd = f.P(f.len, 5.8);
    Q(
      o,
      'roof',
      [aa, bb, f.P(0, 7.12, -0.5), f.P(0, 5.8, -0.5)],
      normalFor(aa, bb, f.P(0, 7.12, -0.5)),
    );
    Q(
      o,
      'roof',
      [dd, cc, f.P(f.len, 7.12, -0.5), f.P(f.len, 5.8, -0.5)],
      normalFor(dd, cc, f.P(f.len, 7.12, -0.5)),
    );
    for (const x of [0, f.len / 2]) block(o, 'trim', f, x, 5.7, 0.34, 1.4, 0.12, -0.6);
    const k = (i + 1) % theatre.length;
    Q(
      o,
      'fascia',
      [
        [lower[i][0], 7.1, lower[i][1]],
        [lower[k][0], 7.1, lower[k][1]],
        [upper[k][0], 9.0, upper[k][1]],
        [upper[i][0], 9.0, upper[i][1]],
      ],
      [f.n[0], 0.5, f.n[2]],
    );
    const edge = frame(upper[i], upper[k]);
    block(o, 'roof', edge, edge.len / 2, 9.0, edge.len, 0.2, 0.08, -0.08);
    if (d > 1) {
      const n = Math.max(1, Math.floor(f.len / 2.7));
      for (let j = 1; j < n; j++) {
        const t = j / n,
          A = [
            lower[i][0] * (1 - t) + lower[k][0] * t,
            7.1,
            lower[i][1] * (1 - t) + lower[k][1] * t,
          ],
          B = [
            upper[i][0] * (1 - t) + upper[k][0] * t,
            9.0,
            upper[i][1] * (1 - t) + upper[k][1] * t,
          ];
        beam(o, 'fascia', A, B, 0.035, 0.035, C.fascia);
      }
    }
  }
  cap(o, upper, 9.2);
  cap(o, lower, 7.1, 'roof', false);
  cap(o, theatre, 5.8, 'roof');
  // Tall narrow stone end fins are intrinsic to the photographed theatre composition.
  for (const [x, z] of [
    [8.7, -11.7],
    [31.4, 9.6],
  ])
    box(o, 'stone', [x - 0.38, -0.35, z - 1.7], [x + 0.38, 7.95, z + 1.7], C.stone);
}
function vents(o, d) {
  if (d === 0) return;
  for (const [x, z] of [
    [-52, -9],
    [-38, 11],
    [-25, 17],
    [19, -18],
  ]) {
    box(o, 'roof', [x - 0.75, 4.69, z - 0.45], [x + 0.75, 5.1, z + 0.45], C.roof);
    if (d > 1)
      for (let j = 0; j < 4; j++)
        box(
          o,
          'roof',
          [x - 0.78, 4.75 + j * 0.07, z + 0.46],
          [x + 0.78, 4.78 + j * 0.07, z + 0.49],
          C.roof,
        );
  }
}
function build(o, _f, d = 3) {
  base(o, d);
  mainTheatre(o, d);
  vents(o, d);
}
export const chamizalSkyline = (o, f) => build(o, f, 0);
export const chamizalDistrict = (o, f) => build(o, f, 1);
export const chamizalStreet = (o, f) => build(o, f, 2);
export const chamizalModel = {
  id: 'chamizal_cultural_center',
  key: 'chamizal_cultural_center',
  recipe: 'structure-chamizal-cultural-center.mjs',
  cell: '9t/9ts',
  title: 'Chamizal National Memorial Cultural Center',
  category: 'civic-cultural',
  progressLedger: 'qualla-002.PROGRESS.md',
  build,
  surfaces,
  brief:
    'Complete connected Chamizal Cultural Center/Visitor Center exterior on original42vertexC-shaped plan: open northwest innercourt, low faceted stone wings/deep open covered portals and recessed closed entry glazing, separately raised theatre volume with shadowed clerestory/white short supports/broad brown sloping faceted fascia/dark flat roofcap/tall stone end fins. Whole native building extent; photograph-interpreted roof/height/door subdivisions. No park/sitepavement/murals/sculptures/detachedfacilities/interior.',
  camera: [-110, 77, 127],
  lookAt: [-7, 4, 0],
  portableGroundY: -0.4,
  mediumFiContext: { scale: 1.65, groundY: -0.4 },
  qaCameras: [
    {
      name: 'whole-c-shaped-center-and-open-innercourt',
      position: [-65, 41, -77],
      lookAt: [-8, 4, 0],
    },
    {
      name: 'raised-theatre-faceted-fascia-clerestory-and-stone-fins',
      position: [63, 20, 43],
      lookAt: [20, 6, 0],
    },
    {
      name: 'courtyard-portals-stone-piers-and-recessed-entry-glazing',
      position: [-27, 2.2, -7],
      lookAt: [-5, 2, 8],
    },
    {
      name: 'west-low-wings-and-connected-south-roof',
      position: [-95, 23, 51],
      lookAt: [-39, 3, 0],
    },
  ],
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis:
    plan.geometryBasis +
    ' Unmodified independent160mfield frozen at fixed innercourt[-14,0]before geometry. Exact entrythreshold/plaza/stonebase/hostcontact unverified.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-chamizal-cultural-center.mjs',
    level: 'skyline',
    export: 'chamizalSkyline',
    errorMeters: 0.9,
    surfaces,
    authoredLevels: {
      district: { export: 'chamizalDistrict', errorMeters: 0.4, surfaces },
      street: { export: 'chamizalStreet', errorMeters: 0.14, surfaces },
    },
  },
  limitations: [
    plan.geometryBasis,
    'Whole named connected cultural center exterior only: museum/gallery/lobby/theatre and attached wings with original open northwest Ccourt/recesses. The central raised theatre section, roof partition/6–9mheight/clerestory/fin positions, entry/portico distribution and concealed rear elevations are bounded interpretations from one cleared NPSexterior, not surveyed roof or engineering replica. Main footprint remains original; innercourt is not extruded or paved.',
    'Exact already-published3072x2048QuallaNPSstaff2003exterior/nativeSHA1was inspected first; byte-identical primaryNPGalleryoriginal/explicit staff/public-domain release is the accepted control. Shared procedural stone/painted-metal/roof and muted glazing only, no copied pixels/generated bitmap. Unknown-author/attribution-licensed photographs, modern mural/sculptureartwork, performance/poster/interior/people imagery excluded. Current cosmetic condition and later concealed changes unverified.',
    'No55acrememorial grounds, esplanade/landscape/courtyardpavement/roads, detached administration/pavilions/outdoorstage, murals/sculpture/lettering, interiors/furniture/performers/people/vehicles. Own covered portals and short endfins are part of building; no invented park slab or artwork.',
    'Original160mTerrariumgrid/rawtiles/heightPNGretained unchanged at fixed innercourt[-14,0]. Exact plaza threshold/stonegrade and hostterraincontact remain unverified. Mapped roof-edge/wall correspondence and proposed source sections remain approximate; replaceFootprint=false.',
  ],
};
