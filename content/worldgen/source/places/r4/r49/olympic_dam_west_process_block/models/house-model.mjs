/** Whole mapped process block. Internal plant layout and sections are explicit estimates. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import fs from 'node:fs';
import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import {
  beam,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
export const P = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url)));
export const surfaces = {
  foundation: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.97, metallic: 0 },
  pale: { slot: 'wall', graph: 'metal_corrugated', roughness: 0.84, metallic: 0.2 },
  grey: { slot: 'wall', graph: 'metal_corrugated', roughness: 0.88, metallic: 0.2 },
  warm: { slot: 'wall', graph: 'metal_corrugated', roughness: 0.85, metallic: 0.18 },
  dark: { slot: 'wall', graph: 'metal_corrugated', roughness: 0.9, metallic: 0.2 },
  roof: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.84, metallic: 0.2 },
  vessel: { slot: 'wall', graph: 'metal_painted', roughness: 0.86, metallic: 0.2 },
  steel: { slot: 'trim', graph: 'metal_painted', roughness: 0.86, metallic: 0.25 },
  duct: { slot: 'trim', graph: 'metal_painted', roughness: 0.9, metallic: 0.25 },
  opening: { slot: 'window', graph: 'metal_painted', roughness: 0.95, metallic: 0.05 },
};
const colors = {
  foundation: rgb('979b90'),
  pale: rgb('c7c7b6'),
  grey: rgb('96a39b'),
  warm: rgb('d4ccb3'),
  dark: rgb('6a7a73'),
  roof: rgb('b8bdb1'),
  vessel: rgb('8e9a91'),
  steel: rgb('62766f'),
  duct: rgb('9da89c'),
  opening: rgb('344943'),
};
export const componentEvidence = [];
export function planAt(u, v) {
  const [a, b, c, d] = P.nativeRing;
  return [
    a[0] * (1 - u) * (1 - v) + b[0] * u * (1 - v) + c[0] * u * v + d[0] * (1 - u) * v,
    a[1] * (1 - u) * (1 - v) + b[1] * u * (1 - v) + c[1] * u * v + d[1] * (1 - u) * v,
  ];
}
export const housingPlan = (h) => {
  const [u0, v0, u1, v1] = h.uv;
  return [planAt(u0, v0), planAt(u1, v0), planAt(u1, v1), planAt(u0, v1)];
};
const xyz = (uv, y) => {
  const [x, z] = planAt(...uv);
  return [x, y, z];
};
function face(o, k, p, n) {
  let normal = normalFor(...p);
  if (n && normal.reduce((s, v, i) => s + v * n[i], 0) < 0) {
    p = [...p].reverse();
    normal = normalFor(...p);
  }
  o.addConvexPolygon(k, 'palette:#ffffff', p, normal, (q) => [q[0], q[1]], colors[k]);
}
function cap(o, k, r, y, up) {
  const b = new MeshBufferBuilder();
  if (
    !b.addCap(
      k,
      'palette:#ffffff',
      r,
      [],
      () => y,
      [0, up, 0],
      (p) => p,
      colors[k],
    )
  )
    throw Error('Invalid process block cap');
  const m = b.finalize();
  for (let i = 0; i < m.indices.length; i += 3)
    face(
      o,
      k,
      Array.from(m.indices.slice(i, i + 3)).map((j) =>
        Array.from(m.positions.slice(j * 3, j * 3 + 3)),
      ),
      [0, up, 0],
    );
}
function prism(o, k, r, y0, y1, top = k) {
  const sg = Math.sign(
    r.reduce((s, a, i) => {
      const b = r[(i + 1) % r.length];
      return s + a[0] * b[1] - a[1] * b[0];
    }, 0),
  );
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length];
    face(
      o,
      k,
      [
        [a[0], y0, a[1]],
        [b[0], y0, b[1]],
        [b[0], y1, b[1]],
        [a[0], y1, a[1]],
      ],
      [(b[1] - a[1]) * sg, 0, -(b[0] - a[0]) * sg],
    );
  }
  cap(o, k, r, y0, -1);
  cap(o, top, r, y1, 1);
}
function rail(o, a, b, y, lod) {
  const A = xyz(a, y),
    B = xyz(b, y),
    L = Math.hypot(B[0] - A[0], B[2] - A[2]),
    n = [-(B[2] - A[2]) / L, (B[0] - A[0]) / L];
  for (const side of [-1, 1]) {
    const at = (t, h) => [
      A[0] + (B[0] - A[0]) * t + n[0] * side * 0.8,
      h,
      A[2] + (B[2] - A[2]) * t + n[1] * side * 0.8,
    ];
    for (const h of [y + 0.55, y + 1.05])
      beam(o, 'steel', at(0, h), at(1, h), 0.055, 0.055, colors.steel);
    const bays = Math.ceil(L / (lod === 2 ? 5 : 3));
    for (let j = 0; j <= bays; j++)
      beam(o, 'steel', at(j / bays, y), at(j / bays, y + 1.05), 0.055, 0.055, colors.steel);
  }
}
function pipe(o, a, b, r, lod) {
  const d = b.map((v, i) => v - a[i]),
    L = Math.hypot(...d),
    v = d.map((x) => x / L),
    up = Math.abs(v[1]) > 0.95 ? [1, 0, 0] : [0, 1, 0],
    cross = (a, b) => [
      a[1] * b[2] - a[2] * b[1],
      a[2] * b[0] - a[0] * b[2],
      a[0] * b[1] - a[1] * b[0],
    ],
    q = cross(v, up),
    ql = Math.hypot(...q),
    n = q.map((x) => x / ql),
    m = cross(v, n),
    count = [6, 8, 10, 12][lod],
    ring = (c) =>
      Array.from({ length: count }, (_, i) =>
        c.map(
          (x, k) =>
            x +
            r *
              (Math.cos((i * 2 * Math.PI) / count) * n[k] +
                Math.sin((i * 2 * Math.PI) / count) * m[k]),
        ),
      ),
    A = ring(a),
    B = ring(b);
  for (let i = 0; i < count; i++) {
    const j = (i + 1) % count;
    face(o, 'duct', [A[i], A[j], B[j], B[i]]);
    face(
      o,
      'duct',
      [a, A[j], A[i]],
      v.map((x) => -x),
    );
    face(o, 'duct', [b, B[i], B[j]], v);
  }
}
export function buildHouse(o, _frame, lod = 3) {
  componentEvidence.length = 0;
  const R = P.nativeRing,
    inner = R.map((p) => p.map((v) => v * P.perimeterInnerScale));
  for (let i = 0; i < R.length; i++) {
    const j = (i + 1) % R.length;
    prism(o, 'foundation', [R[i], R[j], inner[j], inner[i]], P.foundationBottom, P.floor);
  }
  for (const h of P.housings) {
    const r = housingPlan(h);
    prism(o, 'foundation', r, P.foundationBottom, h.bottom);
    prism(o, h.color, r, h.bottom, h.top, 'roof');
  }
  let columns = 0,
    upperBeams = 0,
    lowerBeams = 0,
    braces = 0;
  for (const u of P.columnU)
    for (const v of P.columnV) {
      const a = xyz([u, v], P.floor),
        b = xyz([u, v], P.frameTop);
      beam(o, 'steel', a, b, lod === 0 ? 0.55 : 0.4, lod === 0 ? 0.55 : 0.4, colors.steel);
      columns++;
    }
  const frame = (y, lower) => {
    for (const v of P.columnV)
      for (let i = 1; i < P.columnU.length; i++) {
        beam(
          o,
          'steel',
          xyz([P.columnU[i - 1], v], y),
          xyz([P.columnU[i], v], y),
          0.45,
          0.55,
          colors.steel,
        );
        lower ? lowerBeams++ : upperBeams++;
      }
    for (const u of P.columnU)
      for (let i = 1; i < P.columnV.length; i++) {
        beam(
          o,
          'steel',
          xyz([u, P.columnV[i - 1]], y),
          xyz([u, P.columnV[i]], y),
          0.45,
          0.55,
          colors.steel,
        );
        lower ? lowerBeams++ : upperBeams++;
      }
  };
  frame(P.frameTop, false);
  if (lod > 0) frame(P.frameMid, true);
  if (lod > 1)
    for (const v of [P.columnV[0], P.columnV.at(-1)])
      for (let i = 1; i < P.columnU.length; i++) {
        const a = [P.columnU[i - 1], v],
          b = [P.columnU[i], v];
        beam(o, 'steel', xyz(a, P.floor + 0.2), xyz(b, P.frameMid), 0.15, 0.15, colors.steel);
        beam(o, 'steel', xyz(a, P.frameMid), xyz(b, P.frameTop), 0.15, 0.15, colors.steel);
        braces += 2;
      }
  const segments = [8, 12, 16, 24][lod];
  for (const v of P.vessels) {
    const center = planAt(...v.uv),
      ring = Array.from({ length: segments }, (_, i) => [
        center[0] + Math.cos((i * 2 * Math.PI) / segments) * v.radius,
        center[1] + Math.sin((i * 2 * Math.PI) / segments) * v.radius,
      ]);
    prism(o, 'foundation', ring, P.foundationBottom, P.floor);
    prism(o, 'vessel', ring, P.floor, v.top, 'roof');
    if (lod > 0)
      for (let i = 0; i < ring.length; i++) {
        const a = ring[i],
          b = ring[(i + 1) % ring.length];
        for (const y of [P.floor + 0.4, v.top * 0.5, v.top - 0.2])
          beam(o, 'steel', [a[0], y, a[1]], [b[0], y, b[1]], 0.08, 0.09, colors.steel);
      }
    if (lod > 1)
      for (let i = 0; i < ring.length; i++) {
        const a = ring[i],
          b = ring[(i + 1) % ring.length];
        beam(o, 'steel', [a[0], v.top, a[1]], [a[0], v.top + 1, a[1]], 0.055, 0.055, colors.steel);
        beam(
          o,
          'steel',
          [a[0], v.top + 1, a[1]],
          [b[0], v.top + 1, b[1]],
          0.05,
          0.05,
          colors.steel,
        );
      }
  }
  let secondarySkids = 0,
    secondaryVessels = 0,
    secondaryPipeRuns = 0;
  for (let ui = 1; ui < P.columnU.length; ui++)
    for (let vi = 1; vi < P.columnV.length; vi++) {
      const u = (P.columnU[ui - 1] + P.columnU[ui]) / 2,
        v = (P.columnV[vi - 1] + P.columnV[vi]) / 2 + (u > 0.75 ? 0.05 : 0);
      if (
        P.housings.some(
          (h) =>
            u >= h.uv[0] - 1e-9 &&
            u <= h.uv[2] + 1e-9 &&
            v >= h.uv[1] - 1e-9 &&
            v <= h.uv[3] + 1e-9,
        )
      )
        continue;
      secondarySkids++;
      const pad = [
        planAt(u - 0.085, v - 0.065),
        planAt(u + 0.085, v - 0.065),
        planAt(u + 0.085, v + 0.065),
        planAt(u - 0.085, v + 0.065),
      ];
      prism(o, 'foundation', pad, P.foundationBottom, P.floor + 0.35);
      if (lod === 0) {
        prism(
          o,
          'vessel',
          [
            planAt(u - 0.072, v - 0.018),
            planAt(u + 0.072, v - 0.018),
            planAt(u + 0.072, v + 0.018),
            planAt(u - 0.072, v + 0.018),
          ],
          P.floor + 0.35,
          P.frameMid - 0.8,
          'roof',
        );
        secondaryVessels += 3;
      } else {
        const n = [8, 12, 16, 20][lod];
        for (const du of [-0.055, 0, 0.055]) {
          const c = planAt(u + du, v),
            r = 2.1,
            ring = Array.from({ length: n }, (_, i) => [
              c[0] + r * Math.cos((i * 2 * Math.PI) / n),
              c[1] + r * Math.sin((i * 2 * Math.PI) / n),
            ]);
          prism(o, 'vessel', ring, P.floor + 0.35, P.frameMid - 0.8, 'roof');
          secondaryVessels++;
          if (lod > 0) {
            pipe(
              o,
              [c[0], P.frameMid - 0.8, c[1]],
              xyz([u + du, v + 0.07], P.frameMid - 0.4),
              0.35,
              lod,
            );
            secondaryPipeRuns++;
          }
        }
      }
      if (lod > 0) {
        for (const dv of [-0.035, 0.035]) {
          pipe(
            o,
            xyz([u - 0.08, v + dv], P.floor + 1.4),
            xyz([u + 0.08, v + dv], P.floor + 1.4),
            0.65,
            lod,
          );
          secondaryPipeRuns++;
        }
        pipe(
          o,
          xyz([u - 0.075, v + 0.07], P.frameMid - 0.4),
          xyz([u + 0.075, v + 0.07], P.frameMid - 0.4),
          0.45,
          lod,
        );
        secondaryPipeRuns++;
      }
    }
  // Partial upper cladding and closed service panels are estimated details within frozen frame sections.
  for (const i of [0, 1, 3]) {
    const a = planAt(P.columnU[i] + 0.01, P.columnV[0]),
      b = planAt(P.columnU[i + 1] - 0.01, P.columnV[0]);
    face(o, i === 1 ? 'grey' : 'dark', [
      [a[0], P.frameMid + 0.4, a[1]],
      [b[0], P.frameMid + 0.4, b[1]],
      [b[0], P.frameTop - 0.3, b[1]],
      [a[0], P.frameTop - 0.3, a[1]],
    ]);
  }
  if (lod > 1)
    for (const h of P.housings) {
      const r = housingPlan(h),
        sg = Math.sign(
          r.reduce((s, a, i) => {
            const b = r[(i + 1) % r.length];
            return s + a[0] * b[1] - a[1] * b[0];
          }, 0),
        );
      for (let i = 0; i < r.length; i++) {
        const a = r[i],
          b = r[(i + 1) % r.length],
          L = Math.hypot(b[0] - a[0], b[1] - a[1]),
          n = [((b[1] - a[1]) / L) * sg, (-(b[0] - a[0]) / L) * sg],
          at = (t, y) => [
            a[0] + (b[0] - a[0]) * t + n[0] * 0.04,
            y,
            a[1] + (b[1] - a[1]) * t + n[1] * 0.04,
          ];
        for (const t of [0.3, 0.65]) {
          const w = Math.min(0.1, 2 / L),
            y0 = h.bottom + Math.min(3, (h.top - h.bottom) * 0.35),
            y1 = y0 + 1.2;
          face(
            o,
            'opening',
            [at(t - w, y0), at(t + w, y0), at(t + w, y1), at(t - w, y1)],
            [n[0], 0, n[1]],
          );
          for (let y = y0 + 0.2; y < y1; y += 0.2)
            beam(o, 'steel', at(t - w, y), at(t + w, y), 0.035, 0.05, colors.steel);
        }
      }
    }
  let ductSegments = 0;
  const inlet = P.ductRoutes[0][0];
  beam(
    o,
    'duct',
    xyz(inlet.slice(0, 2), P.housings[0].top),
    xyz(inlet.slice(0, 2), inlet[2]),
    1.8,
    1.8,
    colors.duct,
  );
  ductSegments++;
  for (const route of P.ductRoutes)
    for (let i = 1; i < route.length; i++) {
      const a = route[i - 1],
        b = route[i];
      beam(o, 'duct', xyz(a.slice(0, 2), a[2]), xyz(b.slice(0, 2), b[2]), 1.8, 1.8, colors.duct);
      ductSegments++;
    }
  for (const w of P.walkways) {
    beam(o, 'steel', xyz(w.start, w.y), xyz(w.end, w.y), 1.8, 0.25, colors.steel);
    if (lod > 1) rail(o, w.start, w.end, w.y, lod);
  }
  let steps = 0,
    divisions = 0;
  if (lod > 1) {
    beam(
      o,
      'steel',
      xyz([0.5, 0.68], P.frameMid),
      xyz([0.5, 0.47], P.frameMid),
      1.8,
      0.25,
      colors.steel,
    );
    rail(o, [0.5, 0.68], [0.5, 0.47], P.frameMid, lod);
    const a = planAt(0.5, 0.9),
      b = planAt(0.5, 0.68),
      dx = b[0] - a[0],
      dz = b[1] - a[1],
      L = Math.hypot(dx, dz),
      n = [-dz / L, dx / L],
      count = lod === 2 ? 18 : 24;
    for (let j = 1; j <= count; j++) {
      const t = j / count,
        x = a[0] + dx * t,
        z = a[1] + dz * t,
        y = P.floor + (P.frameMid - P.floor) * t;
      beam(
        o,
        'steel',
        [x - n[0] * 0.8, y, z - n[1] * 0.8],
        [x + n[0] * 0.8, y, z + n[1] * 0.8],
        0.32,
        0.14,
        colors.steel,
      );
      steps++;
    }
    for (const s of [-1, 1])
      beam(
        o,
        'steel',
        [a[0] + n[0] * s * 0.8, P.floor + 1, a[1] + n[1] * s * 0.8],
        [b[0] + n[0] * s * 0.8, P.frameMid + 1, b[1] + n[1] * s * 0.8],
        0.06,
        0.06,
        colors.steel,
      );
  }
  if (lod === 3)
    for (const h of P.housings) {
      const r = housingPlan(h);
      for (let i = 0; i < r.length; i++) {
        const a = r[i],
          b = r[(i + 1) % r.length],
          L = Math.hypot(b[0] - a[0], b[1] - a[1]),
          count = Math.max(1, Math.ceil(L / 7));
        for (let j = 1; j < count; j++) {
          const t = j / count,
            x = a[0] + (b[0] - a[0]) * t,
            z = a[1] + (b[1] - a[1]) * t;
          beam(o, 'steel', [x, h.bottom + 0.1, z], [x, h.top - 0.1, z], 0.05, 0.05, colors.steel);
          divisions++;
        }
      }
    }
  componentEvidence.push({
    lod,
    wholeIndependentProcessBlock: true,
    nativeControls: R.length,
    perimeterFoundations: 4,
    columns,
    upperBeams,
    lowerBeams,
    housingCount: P.housings.length,
    containedVessels: P.vessels.length,
    ductSegments,
    maintenanceWalks: P.walkways.length,
    secondarySkids,
    secondaryVessels,
    secondaryPipeRuns,
    secondaryEquipmentClustersMergedForSkyline: lod === 0,
    estimatedDetailWithinFrozenSections: true,
    braces,
    steps,
    panelDivisions: divisions,
    internalYardsOpen: true,
    noUniformWholePlanRoof: true,
    notWholeFactoryProxy: true,
    heightMeasured: false,
    internalLayoutMeasured: false,
  });
}
export const houseSkyline = (o, f) => buildHouse(o, f, 0),
  houseDistrict = (o, f) => buildHouse(o, f, 1),
  houseStreet = (o, f) => buildHouse(o, f, 2),
  houseCloseup = (o, f) => buildHouse(o, f, 3);
const root = 'content/worldgen/source/places/r4/r49/olympic_dam_west_process_block',
  span = Math.max(
    ...[0, 1].map(
      (k) =>
        Math.max(...P.nativeRing.map((p) => p[k])) - Math.min(...P.nativeRing.map((p) => p[k])),
    ),
  ),
  camera = [span * 1.15, span * 0.7, span],
  look = [0, 7.5, 0];
export const houseModel = {
  id: P.model,
  key: P.model,
  cell: P.cell,
  title: P.title,
  recipe: 'house-model.mjs',
  surfaces,
  build: buildHouse,
  category: 'landmark',
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-002.PROGRESS.md',
  brief: P.limitations.join(' '),
  appearance: {
    kind: 'historical',
    representedDate: P.representedDate,
    validFrom: P.validFrom,
    validUntil: P.validUntil,
    currentWorldEligible: false,
  },
  camera,
  lookAt: look,
  portableGroundY: -1.35,
  mediumFiContext: {
    scale: 1,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: [
    'metal_corrugated',
    'metal_standing_seam',
    'metal_painted',
    'concrete_plain',
  ],
  qaCameras: [
    {
      name: 'whole-process-block-open-framework-and-roofed-masses',
      position: camera,
      lookAt: look,
    },
    {
      name: 'opposite-whole-block-vessels-ducts-and-open-yards',
      position: [-camera[0], camera[1] * 0.9, -camera[2]],
      lookAt: look,
    },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'whole-industrial-process-block-' + reviewLod,
    position: camera,
    lookAt: look,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: root + '/models/house-model.mjs',
    level: 'skyline',
    export: 'houseSkyline',
    errorMeters: 2,
    surfaces,
    authoredLevels: {
      district: { export: 'houseDistrict', errorMeters: 0.15, surfaces },
      street: { export: 'houseStreet', errorMeters: 0.05, surfaces },
      closeup: { export: 'houseCloseup', errorMeters: 0.02, surfaces },
    },
  },
  limitations: P.limitations,
  sourceLicense:
    'Original deterministic geometry under repository license. Whole original four-corner numerical block outline © OpenStreetMap contributors, ODbL-1.0. Existing published public-domain NASA JSC ISS038-E-29810 and ISS038-E-29809 originals supply broad western process-block appearance only. No photo texture. Internal layout, heights, equipment census, access, exact function/date continuity and vertical tie remain explicit estimates.',
};
