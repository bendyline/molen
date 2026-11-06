/** Written archaeological court/niche controls; explicit estimated historical exterior. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import fs from 'node:fs';
import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import { normalFor } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
export const P = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url)));
export const surfaces = {
  cladding: { slot: 'wall', graph: 'metal_corrugated', roughness: 0.67, metallic: 0.25 },
  concrete: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.96, metallic: 0 },
  frame: { slot: 'trim', graph: 'metal_painted', roughness: 0.5, metallic: 0.35 },
  mirror: { slot: 'window', graph: 'metal_stainless_polished', roughness: 0.08, metallic: 1 },
  vent: { slot: 'trim', graph: 'metal_painted', roughness: 0.8, metallic: 0.1 },
};
const colors = {
  cladding: rgb('dddeda'),
  concrete: rgb('a6a7a3'),
  frame: rgb('3c6082'),
  mirror: rgb('c7d9dd'),
  vent: rgb('4a535b'),
};
export const componentEvidence = [];
function face(o, k, p, n) {
  let normal = normalFor(...p);
  if (normal.reduce((s, v, i) => s + v * n[i], 0) < 0) {
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
    throw Error('Invalid sanctuary cap');
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
function prism(o, k, r, y0, y1) {
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
      [b[1] - a[1], 0, a[0] - b[0]],
    );
  }
  cap(o, k, r, y0, -1);
  cap(o, k, r, y1, 1);
}
const rect = (x0, z0, x1, z1) => [
  [x0, z0],
  [x1, z0],
  [x1, z1],
  [x0, z1],
];

const ring = (r, n) =>
  Array.from({ length: n }, (_, i) => [
    r * Math.cos((i * Math.PI * 2) / n),
    r * Math.sin((i * Math.PI * 2) / n),
  ]);
function box(o, k, x0, z0, x1, z1, y0, y1) {
  prism(o, k, rect(x0, z0, x1, z1), y0, y1);
}
function beam(o, a, b, w) {
  const d = b.map((v, i) => v - a[i]),
    l = Math.hypot(...d),
    u = d.map((v) => v / l),
    cross = (a, b) => [
      a[1] * b[2] - a[2] * b[1],
      a[2] * b[0] - a[0] * b[2],
      a[0] * b[1] - a[1] * b[0],
    ],
    q = cross(u, Math.abs(u[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0]),
    ql = Math.hypot(...q),
    v = q.map((x) => x / ql),
    t = cross(u, v),
    ps = [a, b].flatMap((p) =>
      [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ].map(([x, z]) => p.map((e, i) => e + ((v[i] * x + t[i] * z) * w) / 2)),
    );
  for (const ids of [
    [0, 3, 2, 1],
    [4, 5, 6, 7],
    [0, 1, 5, 4],
    [1, 2, 6, 5],
    [2, 3, 7, 6],
    [3, 0, 4, 7],
  ]) {
    const p = ids.map((i) => ps[i]),
      centre = p[0].map((_, i) => p.reduce((s, p) => s + p[i], 0) / 4),
      mid = a.map((e, i) => (e + b[i]) / 2);
    face(
      o,
      'frame',
      p,
      centre.map((e, i) => e - mid[i]),
    );
  }
}
function annulus(o, r0, r1, y0, y1, n, omitFront = false) {
  for (let i = 0; i < n; i++) {
    const a = (i * Math.PI * 2) / n,
      b = ((i + 1) * Math.PI * 2) / n,
      m = (a + b) / 2;
    if (omitFront && Math.sin(m) > 0 && Math.abs(Math.cos(m) * r1) < P.slitWidth / 2) continue;
    const p = [
      [r0 * Math.cos(a), r0 * Math.sin(a)],
      [r1 * Math.cos(a), r1 * Math.sin(a)],
      [r1 * Math.cos(b), r1 * Math.sin(b)],
      [r0 * Math.cos(b), r0 * Math.sin(b)],
    ];
    prism(o, 'cladding', p, y0, y1);
  }
}
function clippedRoof(n, side) {
  let ps = ring(P.radius, n),
    out = [];
  for (let i = 0; i < ps.length; i++) {
    const a = ps[i],
      b = ps[(i + 1) % ps.length],
      ia = side * a[0] >= P.slitWidth / 2,
      ib = side * b[0] >= P.slitWidth / 2;
    if (ia) out.push(a);
    if (ia !== ib) {
      const x = (side * P.slitWidth) / 2,
        t = (x - a[0]) / (b[0] - a[0]);
      out.push([x, a[1] + t * (b[1] - a[1])]);
    }
  }
  return out;
}
export function buildHouse(o, _f, lod = 3) {
  componentEvidence.length = 0;
  const n = [16, 28, 44, 60][lod],
    top = P.floor + P.designHeight,
    base = P.floor + P.baseHeight,
    opening = top - P.shutterHeight;
  prism(o, 'concrete', ring(P.radius, n), P.foundationBottom, base);
  annulus(o, P.radius - 0.6, P.radius, base, opening, n);
  annulus(o, P.radius - 0.6, P.radius, opening, top - 0.6, n, true);
  for (const side of [-1, 1]) {
    prism(o, 'cladding', clippedRoof(n, side), top - 0.6, top);
    const x = side * (P.slitWidth / 2 + 1.2);
    box(o, 'cladding', x - 0.9, 24, x + 0.9, 25.2, opening, top);
    box(o, 'cladding', x - 0.9, -24, x + 0.9, 25.2, top - 0.6, top);
  }
  prism(o, 'concrete', ring(11, [8, 12, 20, 28][lod]), base, 18);
  prism(o, 'frame', ring(13.8, [8, 12, 20, 28][lod]), 20, 22);
  const centres = [
      [0, 0],
      ...Array.from({ length: 6 }, (_, i) => [
        8.55 * Math.cos((i * Math.PI) / 3),
        8.55 * Math.sin((i * Math.PI) / 3),
      ]),
    ],
    segments = [6, 12, 20, 28][lod];
  for (const [x, z] of centres) {
    prism(
      o,
      'frame',
      ring(4.3, segments).map((p) => [p[0] + x, p[1] + z]),
      22,
      23.6,
    );
    prism(
      o,
      'mirror',
      ring(P.mirrorDiameter / 2, segments).map((p) => [p[0] + x, p[1] + z]),
      23.6,
      P.mirrorY,
    );
  }
  for (const side of [-1, 1]) {
    beam(o, [side * 13, 18, -6], [side * 13, 32, 0], 1.3);
    beam(o, [side * 13, 18, 6], [side * 13, 32, 0], 1.3);
    beam(o, [side * 13, 32, 0], [0, P.secondaryY, -1], 0.55);
    beam(o, [side * 10, 22, -7], [0, P.secondaryY, -1], 0.45);
  }
  prism(
    o,
    'frame',
    ring(1.8, [6, 10, 16, 20][lod]).map((p) => [p[0], p[1] - 1]),
    P.secondaryY - 0.6,
    P.secondaryY,
  );
  let vents = 0;
  if (lod > 0) {
    const rows = lod === 1 ? 3 : 6,
      cols = lod === 1 ? 28 : 60;
    for (let row = 0; row < rows; row++)
      for (let i = 0; i < cols; i++) {
        const a = ((i + 0.5) * Math.PI * 2) / cols;
        if (Math.sin(a) > 0 && Math.abs(P.radius * Math.cos(a)) < P.slitWidth / 2 + 1) continue;
        const span = (Math.PI / cols) * 0.68,
          y = base + 3 + row * (44 / rows),
          r = P.radius + 0.025,
          p = [
            [r * Math.cos(a - span), y, r * Math.sin(a - span)],
            [r * Math.cos(a + span), y, r * Math.sin(a + span)],
            [r * Math.cos(a + span), y + 2.1, r * Math.sin(a + span)],
            [r * Math.cos(a - span), y + 2.1, r * Math.sin(a - span)],
          ];
        face(o, 'vent', p, [Math.cos(a), 0, Math.sin(a)]);
        vents++;
      }
  }
  if (lod > 1) {
    for (const side of [-1, 1])
      for (const z of [-5, 5]) beam(o, [side * 13, 22, z], [side * 8, 28, z], 0.3);
    box(o, 'vent', -3, P.radius - 0.05, 3, P.radius + 0.06, P.floor + 0.3, P.floor + 5);
  }
  componentEvidence.push({
    lod,
    plannedDesign: true,
    asBuilt: false,
    wholeEnclosure: true,
    baseHeight: P.baseHeight,
    designHeight: P.designHeight,
    nominalDiameter: 60,
    actualOpenFrontAndRoofAperture: true,
    estimatedLShutters: 2,
    primaryMirrorSegments: 7,
    nominalMirrorDiameter: 8.4,
    pierAndMount: true,
    abstractWindVentPanels: vents,
    allImagesUnused: true,
  });
}
export const houseSkyline = (o, f) => buildHouse(o, f, 0),
  houseDistrict = (o, f) => buildHouse(o, f, 1),
  houseStreet = (o, f) => buildHouse(o, f, 2),
  houseCloseup = (o, f) => buildHouse(o, f, 3);
const root = 'content/worldgen/source/places/66/66v/giant_magellan_summit_enclosure',
  camera = [98, 88, 112],
  look = [0, 30, 0];
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
  portableGroundY: 0,
  mediumFiContext: {
    scale: 1,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: [
    'metal_corrugated',
    'concrete_plain',
    'metal_painted',
    'metal_stainless_polished',
  ],
  qaCameras: [
    {
      name: 'planned-open-enclosure-seven-mirrors-and-shutters',
      position: [0, 110, 75],
      lookAt: [0, 24, 0],
    },
    { name: 'opposite-complete-cylindrical-enclosure', position: [-98, 82, -108], lookAt: look },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'planned-enclosure-' + reviewLod,
    position: camera,
    lookAt: look,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: root + '/models/house-model.mjs',
    level: 'skyline',
    export: 'houseSkyline',
    errorMeters: 0.2,
    surfaces,
    authoredLevels: {
      district: { export: 'houseDistrict', errorMeters: 0.12, surfaces },
      street: { export: 'houseStreet', errorMeters: 0.04, surfaces },
      closeup: { export: 'houseCloseup', errorMeters: 0.02, surfaces },
    },
  },
  limitations: P.limitations,
  sourceLicense:
    'Original deterministic planned-design interpretation under repository license from2024designer numerical text. All photographs, figures, renderings and artwork unused. Geometry sections, panel distribution, colours, telescope framing and geographic ground ties are estimates. Explicitly not an as-built or operating current enclosure; no future completion date assigned.',
};
