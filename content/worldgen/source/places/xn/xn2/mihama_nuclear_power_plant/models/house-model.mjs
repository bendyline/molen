/** Whole mapped three-unit facility; early DOE architecture and explicit unseen-section estimates. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import fs from 'node:fs';
import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import { normalFor } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
export const P = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url)));
export const toWorld = (p) => p;
export const surfaces = {
  concrete: { slot: 'wall', graph: 'concrete_plain', roughness: 0.94, metallic: 0 },
  cladding: { slot: 'wall', graph: 'concrete_panel', roughness: 0.88, metallic: 0 },
  roof: { slot: 'roof', graph: 'metal_corrugated', roughness: 0.72, metallic: 0.32 },
  trim: { slot: 'trim', graph: 'metal_painted', roughness: 0.77, metallic: 0.18 },
  glass: {
    slot: 'window',
    localRef: 'palette:#344b50',
    roughness: 0.36,
    metallic: 0.1,
    alphaMode: 'OPAQUE',
  },
  door: { slot: 'door', localRef: 'palette:#686f6b', roughness: 0.87, metallic: 0.05 },
};
const C = {
    concrete: rgb('c1c1b6'),
    cladding: rgb('d6dad3'),
    roof: rgb('c9cecb'),
    trim: rgb('6c7775'),
    glass: rgb('344b50'),
    door: rgb('686f6b'),
  },
  ref = 'palette:#ffffff';
export const buildingEvidence = [],
  unitEvidence = [],
  windowEvidence = [];
function face(o, k, p, n) {
  // Curved end caps become triangles where the roof meets its spring line.
  const same = (a, b) => Math.hypot(...a.map((v, i) => v - b[i])) < 1e-7;
  p = p.filter((q, i) => i === 0 || !same(q, p[i - 1]));
  if (p.length > 2 && same(p[0], p.at(-1))) p.pop();
  if (p.length < 3) return;
  if (!n && k === 'roof') {
    n = normalFor(...p);
    if (n[1] < 0) n = n.map((v) => -v);
  }
  if (n && normalFor(...p).reduce((s, v, i) => s + v * n[i], 0) < 0) p = [...p].reverse();
  o.addConvexPolygon(k, ref, p, n ?? normalFor(...p), (q) => [q[0], q[1]], C[k]);
}
function tri(o, k, p, n) {
  if (n && normalFor(...p).reduce((s, v, i) => s + v * n[i], 0) < 0) p = [...p].reverse();
  o.addTriangle(
    k,
    ref,
    p,
    n ?? normalFor(...p),
    p.map((q) => [q[0], q[2]]),
    C[k],
  );
}
function cap(o, k, ring, y, up = true) {
  const b = new MeshBufferBuilder();
  if (
    !b.addCap(
      k,
      ref,
      ring,
      [],
      () => y,
      [0, up ? 1 : -1, 0],
      (q) => q,
      C[k],
    )
  )
    throw Error('Native facility roof cap failed');
  const m = b.finalize();
  for (let i = 0; i < m.indices.length; i += 3)
    tri(
      o,
      k,
      Array.from(m.indices.slice(i, i + 3), (j) => Array.from(m.positions.slice(j * 3, j * 3 + 3))),
      [0, up ? 1 : -1, 0],
    );
}
function edges(ring) {
  const area = ring.reduce((s, p, i) => {
    const q = ring[(i + 1) % ring.length];
    return s + p[0] * q[1] - q[0] * p[1];
  }, 0);
  return ring.map((a, i) => {
    const b = ring[(i + 1) % ring.length],
      L = Math.hypot(b[0] - a[0], b[1] - a[1]),
      U = [(b[0] - a[0]) / L, (b[1] - a[1]) / L],
      N = area > 0 ? [U[1], -U[0]] : [-U[1], U[0]];
    return { a, L, U, N };
  });
}
function wall(o, k, E, x0, x1, y0, y1, depth = 0) {
  const p = (x, y) => [
    E.a[0] + E.U[0] * x - E.N[0] * depth,
    y,
    E.a[1] + E.U[1] * x - E.N[1] * depth,
  ];
  face(o, k, [p(x0, y0), p(x1, y0), p(x1, y1), p(x0, y1)], [E.N[0], 0, E.N[1]]);
}
function opening(o, E, x0, x1, y0, y1, lod) {
  const depth = P.facades.recess,
    p = (x, y, d = 0) => [E.a[0] + E.U[0] * x - E.N[0] * d, y, E.a[1] + E.U[1] * x - E.N[1] * d];
  wall(o, 'glass', E, x0, x1, y0, y1, depth);
  for (const [a, b] of [
    [
      [x0, y0],
      [x1, y0],
    ],
    [
      [x1, y0],
      [x1, y1],
    ],
    [
      [x1, y1],
      [x0, y1],
    ],
    [
      [x0, y1],
      [x0, y0],
    ],
  ])
    face(o, 'concrete', [p(...a), p(...b), p(...b, depth), p(...a, depth)]);
  if (lod === 3) {
    wall(o, 'trim', E, (x0 + x1) / 2 - 0.045, (x0 + x1) / 2 + 0.045, y0, y1, depth - 0.04);
    wall(o, 'trim', E, x0, x1, y0, y0 + 0.07, depth - 0.03);
  }
  windowEvidence.push({
    point: p((x0 + x1) / 2 + 0.18, (y0 + y1) / 2),
    outward: [E.N[0], 0, E.N[1]],
    depth,
  });
}
function nativeShell(o, w, lod) {
  const ring = lod === 0 && w.role === 'service-building' ? rect(w) : w.outline,
    lo = w.floor - w.foundationDepth,
    hi = w.floor + w.height;
  cap(o, 'concrete', ring, lo, false);
  cap(o, 'roof', ring, hi);
  for (const E of edges(ring)) {
    wall(o, 'concrete', E, 0, E.L, lo, w.floor);
    const detail =
      lod > 1 &&
      E.L > 10 &&
      w.role !== 'service-building' &&
      w.role !== 'unit-3-round-containment-footprint';
    if (!detail) {
      wall(o, w.role === 'service-building' ? 'cladding' : 'concrete', E, 0, E.L, w.floor, hi);
      if (
        lod === 1 &&
        E.L > 25 &&
        w.role !== 'service-building' &&
        w.role !== 'unit-3-round-containment-footprint'
      )
        wall(
          o,
          'glass',
          E,
          1,
          E.L - 1,
          w.floor + w.height * 0.6,
          w.floor + w.height * 0.6 + 1,
          -0.035,
        );
      continue;
    }
    const rows = lod === 2 ? 2 : Math.max(2, Math.min(4, Math.floor(w.height / 4))),
      pitch = P.facades.pitch * (lod === 2 ? 1.65 : 1),
      count = Math.max(1, Math.floor((E.L - 2) / pitch)),
      span = (E.L - 2) / count,
      width = Math.min(3.8, span * 0.72),
      first = w.floor + 2.15,
      step = (w.height - 4) / rows;
    let y = w.floor;
    for (let row = 0; row < rows; row++) {
      const y0 = first + row * step,
        y1 = Math.min(hi - 0.7, y0 + P.facades.bandHeight);
      wall(o, 'cladding', E, 0, E.L, y, y0);
      let x = 0;
      for (let j = 0; j < count; j++) {
        const cx = 1 + (j + 0.5) * span,
          x0 = cx - width / 2,
          x1 = cx + width / 2;
        wall(o, 'cladding', E, x, x0, y0, y1);
        opening(o, E, x0, x1, y0, y1, lod);
        x = x1;
      }
      wall(o, 'cladding', E, x, E.L, y0, y1);
      y = y1;
    }
    wall(o, 'cladding', E, 0, E.L, y, hi);
  }
  if (w.roof === 'low-gable-estimate' && lod > 0) {
    const A = w.working,
      along = A.size[0] >= A.size[1] ? 0 : 1,
      c = A.box.map((p) => (p[0] + p[1]) / 2),
      rise = Math.min(2.2, Math.min(...A.size) * 0.13),
      p = (u, v, y) => [A.U[0] * u + A.V[0] * v, y, A.U[1] * u + A.V[1] * v];
    if (along === 0) {
      face(o, 'roof', [
        p(A.box[0][0], A.box[1][0], hi),
        p(A.box[0][1], A.box[1][0], hi),
        p(A.box[0][1], c[1], hi + rise),
        p(A.box[0][0], c[1], hi + rise),
      ]);
      face(o, 'roof', [
        p(A.box[0][0], c[1], hi + rise),
        p(A.box[0][1], c[1], hi + rise),
        p(A.box[0][1], A.box[1][1], hi),
        p(A.box[0][0], A.box[1][1], hi),
      ]);
    } else {
      face(o, 'roof', [
        p(A.box[0][0], A.box[1][0], hi),
        p(c[0], A.box[1][0], hi + rise),
        p(c[0], A.box[1][1], hi + rise),
        p(A.box[0][0], A.box[1][1], hi),
      ]);
      face(o, 'roof', [
        p(c[0], A.box[1][0], hi + rise),
        p(A.box[0][1], A.box[1][0], hi),
        p(A.box[0][1], A.box[1][1], hi),
        p(c[0], A.box[1][1], hi + rise),
      ]);
    }
  }
  if (w.roof === 'low-gable-estimate' && lod > 0) gableEnds(o, w);
  buildingEvidence.push({
    id: w.id,
    role: w.role,
    controls: w.outline.length,
    authoredControls: ring.length,
    base: w.floor,
    roof: hi,
  });
}
function gableEnds(o, w) {
  const A = w.working,
    hi = w.floor + w.height,
    rise = Math.min(2.2, Math.min(...A.size) * 0.13),
    c = A.box.map((p) => (p[0] + p[1]) / 2),
    point = (u, v, y) => [A.U[0] * u + A.V[0] * v, y, A.U[1] * u + A.V[1] * v];
  if (A.size[0] >= A.size[1])
    for (const i of [0, 1]) {
      const u = A.box[0][i],
        sign = i === 0 ? -1 : 1;
      tri(
        o,
        'cladding',
        [point(u, A.box[1][0], hi), point(u, A.box[1][1], hi), point(u, c[1], hi + rise)],
        [A.U[0] * sign, 0, A.U[1] * sign],
      );
    }
  else
    for (const i of [0, 1]) {
      const v = A.box[1][i],
        sign = i === 0 ? -1 : 1;
      tri(
        o,
        'cladding',
        [point(A.box[0][0], v, hi), point(A.box[0][1], v, hi), point(c[0], v, hi + rise)],
        [A.V[0] * sign, 0, A.V[1] * sign],
      );
    }
}
function rect(w) {
  const A = w.working;
  return [
    [A.box[0][0], A.box[1][0]],
    [A.box[0][1], A.box[1][0]],
    [A.box[0][1], A.box[1][1]],
    [A.box[0][0], A.box[1][1]],
  ].map(([u, v]) => [A.U[0] * u + A.V[0] * v, A.U[1] * u + A.V[1] * v]);
}
function tank(o, w, lod) {
  const ring =
      lod === 0
        ? Array.from({ length: 6 }, (_, i) => [
            w.center[0] + (Math.cos((i * 2 * Math.PI) / 6) * w.working.size[0]) / 2,
            w.center[1] + (Math.sin((i * 2 * Math.PI) / 6) * w.working.size[1]) / 2,
          ])
        : w.outline,
    lo = w.floor - w.foundationDepth,
    hi = w.floor + w.height;
  cap(o, 'concrete', ring, lo, false);
  for (const E of edges(ring)) wall(o, 'cladding', E, 0, E.L, lo, hi);
  const apex = [w.center[0], hi + (lod === 0 ? 0 : 0.5), w.center[1]];
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length];
    tri(o, 'roof', [[a[0], hi, a[1]], [b[0], hi, b[1]], apex], [0, 1, 0]);
  }
  buildingEvidence.push({
    id: w.id,
    role: w.role,
    controls: w.outline.length,
    authoredControls: ring.length,
  });
}
function ringBand(o, k, c, r0, r1, y, n, up = true) {
  for (let i = 0; i < n; i++) {
    const a = (i * 2 * Math.PI) / n,
      b = ((i + 1) * 2 * Math.PI) / n;
    face(
      o,
      k,
      [
        [c[0] + Math.cos(a) * r0, y, c[1] + Math.sin(a) * r0],
        [c[0] + Math.cos(b) * r0, y, c[1] + Math.sin(b) * r0],
        [c[0] + Math.cos(b) * r1, y, c[1] + Math.sin(b) * r1],
        [c[0] + Math.cos(a) * r1, y, c[1] + Math.sin(a) * r1],
      ],
      [0, up ? 1 : -1, 0],
    );
  }
}
function shield(o, A, lod) {
  const n = [6, 16, 32, 64][lod],
    H = A.floor + A.shieldHeight,
    c = A.center,
    R = A.radius,
    inner = R - P.shield.thickness;
  for (let i = 0; i < n; i++) {
    const a = (i * 2 * Math.PI) / n,
      b = ((i + 1) * 2 * Math.PI) / n;
    for (const [r, sign] of [
      [R, 1],
      [inner, -1],
    ])
      face(
        o,
        'concrete',
        [
          [c[0] + Math.cos(a) * r, A.floor, c[1] + Math.sin(a) * r],
          [c[0] + Math.cos(b) * r, A.floor, c[1] + Math.sin(b) * r],
          [c[0] + Math.cos(b) * r, H, c[1] + Math.sin(b) * r],
          [c[0] + Math.cos(a) * r, H, c[1] + Math.sin(a) * r],
        ],
        [Math.cos((a + b) / 2) * sign, 0, Math.sin((a + b) / 2) * sign],
      );
  }
  ringBand(o, 'concrete', c, R, inner, H, n);
  cap(
    o,
    'concrete',
    Array.from({ length: n }, (_, i) => [
      c[0] + Math.cos((i * 2 * Math.PI) / n) * R,
      c[1] + Math.sin((i * 2 * Math.PI) / n) * R,
    ]),
    A.floor,
    false,
  );
  const bands = lod === 3 ? Math.floor(A.shieldHeight / P.shield.coursePitch) : lod === 2 ? 6 : 0;
  for (let j = 1; j <= bands; j++) {
    const y = A.floor + (A.shieldHeight * j) / (bands + 1);
    for (let i = 0; i < n; i++) {
      const a = (i * 2 * Math.PI) / n,
        b = ((i + 1) * 2 * Math.PI) / n;
      face(
        o,
        'cladding',
        [
          [c[0] + Math.cos(a) * (R + 0.025), y, c[1] + Math.sin(a) * (R + 0.025)],
          [c[0] + Math.cos(b) * (R + 0.025), y, c[1] + Math.sin(b) * (R + 0.025)],
          [c[0] + Math.cos(b) * (R + 0.025), y + 0.045, c[1] + Math.sin(b) * (R + 0.025)],
          [c[0] + Math.cos(a) * (R + 0.025), y + 0.045, c[1] + Math.sin(a) * (R + 0.025)],
        ],
        [Math.cos((a + b) / 2), 0, Math.sin((a + b) / 2)],
      );
    }
  }
  const lat = [2, 4, 6, 8][lod],
    apex = A.floor + A.domeApex,
    base = apex - A.domeRise,
    rd = inner - 0.35,
    point = (i, j, under) => {
      const a = (i * 2 * Math.PI) / n,
        t = (j * Math.PI) / 2 / lat;
      return [
        c[0] + Math.cos(a) * rd * Math.cos(t),
        base + A.domeRise * Math.sin(t) - (under ? 0.18 : 0),
        c[1] + Math.sin(a) * rd * Math.cos(t),
      ];
    };
  for (const under of [false, true])
    for (let j = 0; j < lat; j++)
      for (let i = 0; i < n; i++) {
        const a = point(i, j, under),
          b = point(i + 1, j, under),
          cc = point(i + 1, j + 1, under),
          dd = point(i, j + 1, under),
          sign = under ? -1 : 1,
          t = ((j + 0.5) * Math.PI) / 2 / lat,
          v = ((i + 0.5) * 2 * Math.PI) / n,
          N = [
            Math.cos(v) * Math.cos(t) * sign,
            Math.sin(t) * sign,
            Math.sin(v) * Math.cos(t) * sign,
          ];
        if (j === lat - 1) tri(o, 'roof', [a, b, cc], N);
        else face(o, 'roof', [a, b, cc, dd], N);
      }
  unitEvidence.push({
    unit: A.ref,
    center: c,
    radius: R,
    shieldTop: H,
    metalDomeApex: apex,
    wholeShieldAndRecessedDome: true,
    estimatedUnphotographedCurrentSections: A.ref === 3,
  });
}
function barrel(o, lod) {
  const A = P.southBarrel,
    p = (u, v, y) => [A.U[0] * u + A.V[0] * v, y, A.U[1] * u + A.V[1] * v],
    n = [3, 6, 10, 16][lod],
    center = (A.vMin + A.vMax) / 2,
    r = (A.vMax - A.vMin) / 2,
    at = (t, u, under = false) =>
      p(u, center - Math.cos(t) * r, A.eave + Math.sin(t) * A.rise - (under ? 0.18 : 0));
  for (const under of [false, true])
    for (let i = 0; i < n; i++) {
      const a = (i * Math.PI) / n,
        b = ((i + 1) * Math.PI) / n,
        rawNormal = normalFor(at(a, A.uMin), at(a, A.uMax), at(b, A.uMax)),
        normal = rawNormal[1] < 0 ? rawNormal.map((v) => -v) : rawNormal;
      face(
        o,
        'roof',
        [at(a, A.uMin, under), at(a, A.uMax, under), at(b, A.uMax, under), at(b, A.uMin, under)],
        under ? normal.map((v) => -v) : normal,
      );
    }
  for (const u of [A.uMin, A.uMax])
    for (let i = 0; i < n; i++) {
      const a = (i * Math.PI) / n,
        b = ((i + 1) * Math.PI) / n;
      face(
        o,
        'cladding',
        [
          p(u, center - Math.cos(a) * r, A.eave),
          at(a, u),
          at(b, u),
          p(u, center - Math.cos(b) * r, A.eave),
        ],
        [A.U[0] * (u === A.uMin ? -1 : 1), 0, A.U[1] * (u === A.uMin ? -1 : 1)],
      );
    }
}
export function buildHouse(o, _frame, lod = 3) {
  buildingEvidence.length = 0;
  unitEvidence.length = 0;
  windowEvidence.length = 0;
  for (const w of P.buildings) {
    if (lod === 0 && (w.area < 500 || w.role === 'unit-3-round-containment-footprint')) continue;
    if (w.role === 'process-tank') tank(o, w, lod);
    else nativeShell(o, w, lod);
  }
  for (const u of P.units) shield(o, u, lod);
  barrel(o, lod);
}
export const houseSkyline = (o, f) => buildHouse(o, f, 0),
  houseDistrict = (o, f) => buildHouse(o, f, 1),
  houseStreet = (o, f) => buildHouse(o, f, 2),
  houseCloseup = (o, f) => buildHouse(o, f, 3);
const root = 'content/worldgen/source/places/xn/xn2/mihama_nuclear_power_plant',
  camera = [680, 260, -440],
  look = [60, 18, 25];
export const houseModel = {
  key: P.model,
  id: P.model,
  title: 'Mihama nuclear power plant — whole three-unit mapped layout',
  wikidataId: 'Q384685',
  cell: 'xn/xn2',
  category: 'industrial',
  recipe: 'house-model.mjs',
  surfaces,
  build: buildHouse,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  progressLedger: 'qualla-002.PROGRESS.md',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  groundContactBasis: P.sectionBasis,
  brief: P.geometryBasis,
  appearance: {
    kind: 'historical',
    representedDate: P.representedDate,
    validFrom: P.validFrom,
    validUntil: P.validUntil,
    currentWorldEligible: false,
  },
  camera,
  lookAt: look,
  portableGroundY: -0.4,
  mediumFiContext: {
    scale: 1,
    groundY: 0,
    far: 6000,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: [
    'concrete_plain',
    'concrete_panel',
    'metal_corrugated',
    'metal_painted',
  ],
  qaCameras: [
    {
      name: 'whole-three-unit-facility-and-all-intrinsic-native-buildings',
      position: camera,
      lookAt: look,
    },
    {
      name: 'southern-units-1-and-2-shields-domes-process-facades-and-barrel-roof',
      position: [300, 100, 390],
      lookAt: [100, 28, 150],
    },
    {
      name: 'northern-unit-3-native-round-shield-and-turbine-complex',
      position: [-330, 115, -195],
      lookAt: [-135, 28, -30],
    },
    {
      name: 'rear-main-complex-domes-and-separate-service-range',
      position: [-40, 120, 40],
      lookAt: [120, 25, 160],
    },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `whole-mihama-campus-${reviewLod}`,
    position: camera,
    lookAt: look,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `${root}/models/house-model.mjs`,
    level: 'skyline',
    export: 'houseSkyline',
    errorMeters: 4,
    surfaces,
    authoredLevels: {
      district: { export: 'houseDistrict', errorMeters: 1.4, surfaces },
      street: { export: 'houseStreet', errorMeters: 0.35, surfaces },
      closeup: { export: 'houseCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: P.limitations,
  sourceLicense:
    'Original authored geometry under repository license. Architectural imagery solely exact Qualla-published DOE043/044/045 originals with explicit nativePD-USGov-DOE/officialENERGY.GOV source/reviewedUnitedStatesGovernmentWork grants. All selectedoriginals individually inspected and originalbytes/nativeSHA1bound; no protected modern photographs/planpixels or source metadata changes. Exact whole three-unit facility native605420905/Q384685/71building-tank rings underODbL with primaryNRA/KEPCO reactor identity/status facts asTEXT. UnphotographedUnit3/currentauxiliary sections, all heights/roof/census/finish/grade are explicit architectural estimates. All three actualunits and complete sitebuilding/tank layout retained; parcel/ocean/naturalcliffs notextruded. Original fullfield/frame/mainparameters fixed before geometry.',
};
