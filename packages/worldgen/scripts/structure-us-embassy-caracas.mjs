/** Caracas chancery: native three-building hillside group and stepped brick roofs. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { cross, normalFor } from './authored-structure-mesh.mjs';
import { rgb } from './landmark-model-helpers.mjs';

const p = JSON.parse(
    fs.readFileSync(
      new URL(
        '../../../content/worldgen/source/places/d9/d9b/embassy_of_the_united_states_caracas/plan-controls.json',
        import.meta.url,
      ),
    ),
  ),
  A = p.parameters.architecturalSections,
  B = p.buildings.map((b) => ({ ...b, P: b.outline.slice(0, -1) })),
  ref = 'palette:#ffffff',
  C = {
    brick: rgb('a87e66'),
    concrete: rgb('c5c0ae'),
    roof: rgb('a9a99b'),
    glass: rgb('485b57'),
    metal: rgb('b8bfb6'),
  },
  surfaces = {
    brick: { slot: 'wall', graph: 'brick_longformat', roughness: 0.97, metallic: 0 },
    concrete: { slot: 'wall', graph: 'stucco', roughness: 0.96, metallic: 0 },
    roof: { slot: 'roof', graph: 'concrete_plain', roughness: 0.96, metallic: 0 },
    glass: { slot: 'window', localRef: ref, roughness: 0.67, metallic: 0.03 },
    metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.84, metallic: 0.16 },
  },
  sub = (a, b) => a.map((v, i) => v - b[i]),
  dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0),
  unit = (v) => v.map((q) => q / Math.hypot(...v));
function T(o, k, q, n, col = C[k]) {
  q = q.map((v) => v.map(Math.fround));
  const cr = cross(sub(q[1], q[0]), sub(q[2], q[0]));
  if (Math.hypot(...cr) < 1e-8) return;
  if (n && dot(cr, n) < 0) [q[1], q[2]] = [q[2], q[1]];
  const N = normalFor(...q);
  o.addTriangle(
    k,
    ref,
    q,
    N,
    q.map((v) =>
      Math.abs(N[1]) > 0.65 ? [v[0], v[2]] : [Math.abs(N[0]) > 0.65 ? v[2] : v[0], v[1]],
    ),
    col,
  );
}
function Q(o, k, q, n, col = C[k]) {
  T(o, k, q.slice(0, 3), n, col);
  T(o, k, [q[0], q[2], q[3]], n, col);
}
function flat(o, k, P, y, up = true, col = C[k]) {
  const ids = earcut(P.flat());
  for (let i = 0; i < ids.length; i += 3)
    T(
      o,
      k,
      ids.slice(i, i + 3).map((j) => [P[j][0], y, P[j][1]]),
      [0, up ? 1 : -1, 0],
      col,
    );
}
function faces(P) {
  if (
    P.reduce(
      (a, q, i) => a + q[0] * P[(i + 1) % P.length][1] - P[(i + 1) % P.length][0] * q[1],
      0,
    ) < 0
  )
    P = P.toReversed();
  return P.map((a, i) => {
    const b = P[(i + 1) % P.length],
      len = Math.hypot(...sub(b, a)),
      u = [(b[0] - a[0]) / len, 0, (b[1] - a[1]) / len],
      n = [u[2], 0, -u[0]];
    return {
      len,
      u,
      n,
      point: (x, y, z = 0) => [a[0] + u[0] * x + n[0] * z, y, a[1] + u[2] * x + n[2] * z],
    };
  });
}
function prism(o, k, P, y0, y1, col = C[k]) {
  for (const f of faces(P))
    Q(o, k, [f.point(0, y0), f.point(f.len, y0), f.point(f.len, y1), f.point(0, y1)], f.n, col);
  flat(o, k, P, y0, false, col);
  flat(o, k, P, y1, true, col);
}
function box(o, k, x, y, z, w, h, l, col = C[k]) {
  prism(
    o,
    k,
    [
      [x - w / 2, z - l / 2],
      [x + w / 2, z - l / 2],
      [x + w / 2, z + l / 2],
      [x - w / 2, z + l / 2],
    ],
    y,
    y + h,
    col,
  );
}
function face(o, k, f, R, z = 0, holes = [], col = C[k]) {
  const all = [R, ...holes].flat(),
    starts = holes.map((_, i) => R.length + holes.slice(0, i).reduce((s, h) => s + h.length, 0)),
    ix = earcut(all.flat(), starts);
  for (let i = 0; i < ix.length; i += 3)
    T(
      o,
      k,
      ix.slice(i, i + 3).map((j) => f.point(...all[j], z)),
      f.n,
      col,
    );
}
const rect = (x0, x1, y0, y1) => [
  [x0, y0],
  [x1, y0],
  [x1, y1],
  [x0, y1],
];
function windows(o, k, f, y0, y1, rows, d, pitch = A.windowPitch) {
  const hs = [],
    N = d === 0 ? Math.floor(f.len / 8.0) : Math.floor(f.len / (d === 1 ? 8 : pitch)),
    w = A.windowWidth;
  for (const y of rows)
    if (y > y0 + 0.4 && y + A.windowHeight < y1 - 0.35)
      for (let i = 0; i < N; i++) {
        const x = (f.len * (i + 1)) / (N + 1);
        if (x - w / 2 > 0.5 && x + w / 2 < f.len - 0.5)
          hs.push(rect(x - w / 2, x + w / 2, y, y + A.windowHeight));
      }
  if (d === 0) {
    face(o, k, f, rect(0, f.len, y0, y1));
    for (const h of hs) face(o, 'glass', f, h, 0.015);
    return;
  }
  face(o, k, f, rect(0, f.len, y0, y1), 0, hs);
  for (const h of hs) {
    face(o, 'glass', f, h, -A.recessDepth);
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4,
        a = h[i],
        b = h[j],
        n = [f.u[0] * (b[1] - a[1]), a[0] - b[0], f.u[2] * (b[1] - a[1])].map((v) => -v);
      Q(
        o,
        k,
        [
          f.point(...a),
          f.point(...b),
          f.point(...b, -A.recessDepth),
          f.point(...a, -A.recessDepth),
        ],
        n,
      );
    }
    if (d > 1) {
      const x0 = h[0][0],
        x1 = h[1][0],
        y0 = h[0][1],
        y1 = h[2][1];
      for (const R of [
        rect(x0 - 0.075, x0, y0 - 0.065, y1 + 0.065),
        rect(x1, x1 + 0.075, y0 - 0.065, y1 + 0.065),
        rect(x0, x1, y0 - 0.065, y0),
        rect(x0, x1, y1, y1 + 0.065),
      ])
        face(o, 'concrete', f, R, 0.018);
      face(
        o,
        'metal',
        f,
        rect((x0 + x1) / 2 - 0.018, (x0 + x1) / 2 + 0.018, y0 + 0.02, y1 - 0.02),
        -0.18,
      );
      if (d === 3) {
        Q(
          o,
          'concrete',
          [
            f.point(x0 - 0.1, y0 - 0.09, -0.25),
            f.point(x1 + 0.1, y0 - 0.09, -0.25),
            f.point(x1 + 0.1, y0 - 0.09, 0.12),
            f.point(x0 - 0.1, y0 - 0.09, 0.12),
          ],
          [0, 1, 0],
        );
      }
    }
  }
}
function building(o, k, P, y0, y1, rows, d, pitch) {
  for (const f of faces(P)) windows(o, k, f, y0, y1, rows, d, pitch);
  flat(o, k, P, y0, false);
  flat(o, 'roof', P, y1);
  parapet(o, P, y1, d);
}
function parapet(o, P, y, d) {
  for (const f of faces(P)) {
    if (d === 0) {
      face(o, 'roof', f, rect(0, f.len, y - 0.1, y + 0.22), 0.012);
      continue;
    }
    const R = [
      f.point(0, y, -A.parapetWidth),
      f.point(f.len, y, -A.parapetWidth),
      f.point(f.len, y, 0),
      f.point(0, y, 0),
    ].map((q) => [q[0], q[2]]);
    prism(o, 'roof', R, y, y + A.parapetHeight);
  }
}
function clip(P, value, greater) {
  const R = [];
  for (let i = 0; i < P.length; i++) {
    const a = P[i],
      b = P[(i + 1) % P.length],
      da = (a[1] - value) * (greater ? 1 : -1),
      db = (b[1] - value) * (greater ? 1 : -1);
    if (da >= 0) R.push(a);
    if (da >= 0 !== db >= 0) {
      const t = (value - a[1]) / (b[1] - a[1]);
      R.push([a[0] + (b[0] - a[0]) * t, value]);
    }
  }
  return R;
}
function inset(P, u, v, shiftU = 0, shiftV = 0) {
  const a = P[0],
    U = sub(P[1], a),
    V = sub(P[3], a),
    point = (x, z) => a.map((q, i) => q + U[i] * x + V[i] * z);
  return [
    [0.5 - u / 2 + shiftU, 0.5 - v / 2 + shiftV],
    [0.5 + u / 2 + shiftU, 0.5 - v / 2 + shiftV],
    [0.5 + u / 2 + shiftU, 0.5 + v / 2 + shiftV],
    [0.5 - u / 2 + shiftU, 0.5 + v / 2 + shiftV],
  ].map((q) => point(...q));
}
function dish(o, c, r, d) {
  const n = unit([0.72, 0.65, 0.12]),
    u = unit(cross(n, [0, 1, 0])),
    v = cross(n, u),
    N = [6, 8, 16, 24][d],
    rings = [1, 2, 3, 5][d],
    point = (rho, t, back) =>
      c.map(
        (q, i) =>
          q +
          u[i] * rho * Math.cos(t) +
          v[i] * rho * Math.sin(t) +
          n[i] * (rho * rho * 0.14 - (back ? 0.07 : 0)),
      );
  for (let j = 0; j < rings; j++)
    for (let i = 0; i < N; i++) {
      const r0 = (r * j) / rings,
        r1 = (r * (j + 1)) / rings,
        a = (i * 2 * Math.PI) / N,
        b = ((i + 1) * 2 * Math.PI) / N;
      for (const back of [false, true])
        Q(
          o,
          'metal',
          [point(r0, a, back), point(r1, a, back), point(r1, b, back), point(r0, b, back)],
          n.map((q) => q * (back ? -1 : 1)),
        );
    }
  if (d > 0)
    for (let i = 0; i < N; i++) {
      const a = (i * 2 * Math.PI) / N,
        b = ((i + 1) * 2 * Math.PI) / N;
      Q(
        o,
        'metal',
        [point(r, a, false), point(r, b, false), point(r, b, true), point(r, a, true)],
        sub(point(r, (a + b) / 2, false), c),
      );
    }
}
function roofPlant(o, d) {
  for (const [x, z, w, l, h] of [
    [34, -7, 5, 4, 2.1],
    [21, 3, 4.2, 3.5, 1.5],
  ]) {
    box(o, 'roof', x, A.mainTop + 0.1, z, w + 0.4, 0.28, l + 0.4);
    box(o, 'metal', x, A.mainTop + 0.38, z, w, h, l);
    if (d > 1)
      for (let i = 0; i < 5; i++)
        box(o, 'glass', x, A.mainTop + 0.65 + i * 0.23, z + l / 2 + 0.01, w - 0.35, 0.055, 0.02);
  }
  box(o, 'metal', 36, A.mainTop, -9, 0.25, 2.9, 0.25);
  dish(o, [36, A.mainTop + 3.0, -9], A.dishRadius, d);
  if (d > 0) {
    box(o, 'metal', 25, A.mainTop, 1, 0.18, 2.2, 0.18);
    dish(o, [25, A.mainTop + 2.3, 1], 1.2, d);
  }
  if (d > 1) {
    for (const [x, z] of [
      [17, 6],
      [42, 20],
      [30, 18],
    ]) {
      box(o, 'roof', x, A.mainTop, z, 1.3, 0.3, 1.3);
      box(o, 'metal', x, A.mainTop + 0.3, z, 0.65, 0.8, 0.65);
    }
  }
}
function build(o, _f, d = 3) {
  const main = B[0],
    north = B[1],
    west = B[2];
  building(o, 'brick', main.P, main.parameters.floorY, A.mainTop, A.mainWindowRows, d);
  building(
    o,
    'brick',
    clip(main.P, A.mainRaisedSouth.z, true),
    A.mainTop,
    A.mainRaisedSouth.top,
    [A.mainUpperWindowRow],
    d,
  );
  building(
    o,
    'brick',
    clip(main.P, A.mainRaisedNorth.z, false),
    A.mainTop,
    A.mainRaisedNorth.top,
    [],
    d,
  );
  const N = north.parameters.architecturalSections;
  building(o, 'brick', north.P, north.parameters.floorY, N.bodyTop, [-2.5, 2.0, 5.5], d, 4.8);
  const lower = inset(north.P, 0.7, 0.62, -0.04, 0.01),
    upper = inset(north.P, 0.41, 0.39, -0.08, -0.03);
  building(o, 'brick', lower, N.bodyTop, N.roofLowerBoxTop, [], d);
  building(o, 'brick', upper, N.roofLowerBoxTop, N.roofUpperBoxTop, [], d);
  if (d > 0) {
    for (const f of faces(upper))
      if (f.len > 10) {
        const x = f.len / 2;
        face(
          o,
          'metal',
          f,
          rect(x - 1.4, x + 1.4, N.roofLowerBoxTop + 1.2, N.roofLowerBoxTop + 3.0),
          0.02,
        );
        if (d > 1)
          for (let i = 0; i < 6; i++)
            face(
              o,
              'glass',
              f,
              rect(
                x - 1.25,
                x + 1.25,
                N.roofLowerBoxTop + 1.4 + i * 0.23,
                N.roofLowerBoxTop + 1.47 + i * 0.23,
              ),
              0.03,
            );
      }
  }
  building(
    o,
    'concrete',
    west.P,
    west.parameters.floorY,
    west.parameters.architecturalSections.bodyTop,
    [5.0],
    d,
    4.8,
  );
  if (d > 0) {
    const boxP = inset(west.P, 0.38, 0.42, 0.04, 0);
    prism(o, 'metal', boxP, 9.8, 11.25);
  }
  roofPlant(o, d);
}
export const caracasEmbassySkyline = (o, f) => build(o, f, 0);
export const caracasEmbassyDistrict = (o, f) => build(o, f, 1);
export const caracasEmbassyStreet = (o, f) => build(o, f, 2);
export const caracasEmbassyCloseup = (o, f) => build(o, f, 3);
export const usEmbassyCaracasModel = {
  id: 'embassy_of_the_united_states_caracas',
  key: 'embassy_of_the_united_states_caracas',
  cell: 'd9/d9b',
  recipe: 'structure-us-embassy-caracas.mjs',
  title: 'Embassy of the United States, Caracas',
  category: 'civic-institutional',
  progressLedger: 'qualla-002.PROGRESS.md',
  build,
  surfaces,
  brief: p.authoringDirection,
  camera: [172, 85, 178],
  lookAt: [0, 5, 0],
  portableGroundY: -10.15,
  mediumFiContext: { scale: 2.9, groundY: -10.15 },
  qaCameras: [
    {
      name: 'whole-three-building-chancery-stepped-roof-and-native-plan',
      position: [160, 72, 170],
      lookAt: [0, 5, 0],
      reviewLod: 'skyline',
    },
    {
      name: 'main-brick-chancery-native-raised-southend-and-narrow-window-recesses',
      position: [101, 23, 93],
      lookAt: [31, 2, 37],
    },
    {
      name: 'northern-brick-block-and-two-stepped-roof-volumes',
      position: [-65, 33, -101],
      lookAt: [2, 9, -48],
    },
    {
      name: 'bounded-roof-mechanical-volumes-and-dishes',
      position: [73, 31, 13],
      lookAt: [31, 12, -6],
    },
    {
      name: 'western-intrinsic-service-building-on-separate-structural-reference-floor',
      position: [-80, 22, -3],
      lookAt: [-33, 7, -28],
    },
  ],
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis: `${p.geometryBasis} ${p.sectionBasis}`,
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-us-embassy-caracas.mjs',
    level: 'skyline',
    export: 'caracasEmbassySkyline',
    errorMeters: 1.8,
    surfaces,
    authoredLevels: {
      district: { export: 'caracasEmbassyDistrict', errorMeters: 0.65, surfaces },
      street: { export: 'caracasEmbassyStreet', errorMeters: 0.18, surfaces },
      closeup: { export: 'caracasEmbassyCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: [
    p.geometryBasis,
    p.sectionBasis,
    'Whole modernchanceryarchitecturegroup/all26nativecontrols: complete18controlmainbuilding/twofourcontrolintrinsicblocks, redbrickmasses/narrowwindowrows/raisednative-clippedmainends/insetnorthroofboxes/palewestserviceblock/boundedvisibleplantanddishvocabulary. Compoundfence/guardbooths/park/roads/landscape/flag/lettering/privateinteriors andhistoric1958premises excluded.',
    'Onlyexact2684x1796 ZiaLater2015Own/selfCC0 publishedQuallaoriginal/nativeSHA1matched/personallyinspected. Existingimageryinventorypassed after provenance lookup followed originalPNG MIME; no sourcebody/media/rightsmetadata changes or supplementary imagery/generatedphotographs/photo textures.',
    'Blockroles/floorreferences/hiddenfacades/windowcensus/roofsections/plant-anddishconfiguration/currentfinish are originalbounded estimates. Modern physicalbuilding only, no claim aboutcurrentdiplomaticoperations. Flat reviewground cannot represent separatehillsidefloorlevels, so higherblocks mayfloat in diagnosticviews; inspect originalsourceground separately.',
    'Independent600m129x129field/16641samples/four rawtiles frozen before anyfloors/geometry. Fixed994.0135m provider datum andflatmain-10/north-6/west+3m referencefloors unsurveyed. Groundgrid/PNG/rawtiles unchanged; precisefooting/threshold/hostcontact unresolved, geographicpreview/replaceFootprintfalse; no fittedterrain or artificialsiteplate.',
  ],
};
