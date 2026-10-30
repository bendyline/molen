/** Complete historical Acropole Hotel and intrinsic patios; no imagery is consumed. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import fs from 'node:fs';
import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import { normalFor } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
export const P = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url))),
  H = P.building;
export const surfaces = {
  wall: { slot: 'wall', graph: 'stucco', roughness: 0.94, metallic: 0 },
  foundation: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.98, metallic: 0 },
  roof: { slot: 'roof', graph: 'concrete_plain', roughness: 0.97, metallic: 0 },
  trim: { slot: 'trim', graph: 'metal_painted', roughness: 0.72, metallic: 0.18 },
  window: { slot: 'window', graph: 'window_punched', roughness: 0.35, metallic: 0.1 },
  door: { slot: 'door', graph: 'wood_plain', roughness: 0.88, metallic: 0 },
};
const colors = {
  wall: rgb('b77756'),
  foundation: rgb('b0a18b'),
  roof: rgb('b5a58b'),
  trim: rgb('d0c4a8'),
  window: rgb('344c55'),
  door: rgb('426c8b'),
};
export const componentEvidence = [];
function face(o, k, p, n, tint = colors[k]) {
  let normal = normalFor(...p);
  if (n && normal.reduce((s, v, i) => s + v * n[i], 0) < 0) {
    p = [...p].reverse();
    normal = normalFor(...p);
  }
  o.addConvexPolygon(k, 'palette:#ffffff', p, normal, (q) => [q[0], q[1]], tint);
}
function cap(o, k, ring, y, up) {
  const b = new MeshBufferBuilder();
  if (
    !b.addCap(
      k,
      'palette:#ffffff',
      ring,
      [],
      () => y,
      [0, up, 0],
      (p) => p,
      colors[k],
    )
  )
    throw Error('Invalid whole hotel cap');
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
function polygon(o, k, r, y0, y1) {
  const sign = Math.sign(
    r.reduce((s, p, i) => {
      const q = r[(i + 1) % r.length];
      return s + p[0] * q[1] - p[1] * q[0];
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
      [(b[1] - a[1]) * sign, 0, -(b[0] - a[0]) * sign],
    );
  }
  cap(o, k, r, y0, -1);
  cap(o, k, r, y1, 1);
}
function strip(o, k, a, b, w, y0, y1) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    L = Math.hypot(dx, dz),
    n = [-dz / L, dx / L];
  polygon(
    o,
    k,
    [
      [a[0] - (n[0] * w) / 2, a[1] - (n[1] * w) / 2],
      [b[0] - (n[0] * w) / 2, b[1] - (n[1] * w) / 2],
      [b[0] + (n[0] * w) / 2, b[1] + (n[1] * w) / 2],
      [a[0] + (n[0] * w) / 2, a[1] + (n[1] * w) / 2],
    ],
    y0,
    y1,
  );
}
const square = (x, z, w) => [
  [x - w / 2, z - w / 2],
  [x + w / 2, z - w / 2],
  [x + w / 2, z + w / 2],
  [x - w / 2, z + w / 2],
];
function fenestration(o, a, b, t, y, w, h, lod, door = false) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    L = Math.hypot(dx, dz),
    U = [dx / L, dz / L],
    N = [U[1], -U[0]],
    c = [a[0] + dx * t, a[1] + dz * t],
    p = (u, Y, d = 0.04) => [c[0] + U[0] * u + N[0] * d, Y, c[1] + U[1] * u + N[1] * d],
    quad = (k, u0, u1, y0, y1, d, tint = colors[k]) =>
      face(o, k, [p(u0, y0, d), p(u1, y0, d), p(u1, y1, d), p(u0, y1, d)], [N[0], 0, N[1]], tint);
  quad(door ? 'door' : 'window', -w / 2, w / 2, y, y + h, 0.035);
  if (door) return;
  for (const side of [-1, 1]) {
    const u0 = side < 0 ? -w / 2 - 0.43 : w / 2 + 0.04,
      u1 = u0 + 0.39;
    quad('door', u0, u1, y - 0.04, y + h + 0.04, 0.095);
    if (lod > 1)
      for (let j = 0; j < 6; j++)
        quad(
          'door',
          u0 + 0.025,
          u1 - 0.025,
          y + 0.13 + (j * (h - 0.2)) / 6,
          y + 0.16 + (j * (h - 0.2)) / 6,
          0.13,
          rgb('345d7c'),
        );
  }
  if (lod > 0) {
    quad('trim', -w / 2 - 0.07, -w / 2, y - 0.05, y + h + 0.05, 0.085);
    quad('trim', w / 2, w / 2 + 0.07, y - 0.05, y + h + 0.05, 0.085);
    quad('trim', -w / 2, w / 2, y - 0.07, y, 0.085);
    quad('trim', -w / 2, w / 2, y + h, y + h + 0.07, 0.085);
  }
  if (lod === 3) {
    quad('trim', -0.025, 0.025, y, y + h, 0.065);
    quad('trim', -w / 2, w / 2, y + h * 0.62, y + h * 0.62 + 0.045, 0.065);
  }
}
export function buildHouse(o, _frame, lod = 3) {
  componentEvidence.length = 0;
  const r = P.nativeBuildingRing,
    body = r.map((p, i) => [p[0], p[1] - (i === 0 || i === 3 ? H.patioDepth : 0)]);
  polygon(o, 'foundation', r, H.basementBottom, P.floor);
  polygon(o, 'wall', body, P.floor, H.wallTop);
  componentEvidence.push('whole-original-four-control-three-storey-hotel-envelope');
  for (const y of H.patioLevels) polygon(o, 'foundation', r, y - H.slabThickness, y);
  polygon(o, 'roof', r, H.wallTop, H.roofDeckTop);
  for (let i = 0; i < 4; i++)
    strip(o, 'wall', r[i], r[(i + 1) % 4], 0.18, H.roofDeckTop, H.roofTop);
  componentEvidence.push('entire-main-roof-full-parapet-and-both-complete-patio-floors');
  const a = r[3],
    b = r[0],
    dx = b[0] - a[0],
    dz = b[1] - a[1],
    L = Math.hypot(dx, dz),
    N = [dz / L, -dx / L],
    p = (t, d = 0) => [a[0] + dx * t - N[0] * d, a[1] + dz * t - N[1] * d],
    n = P.facade.estimatedWestBayCount;
  for (let j = 0; j <= n; j++) {
    const A = p(j / n, 0.14);
    polygon(o, 'wall', square(...A, H.estimatedColumnWidth), P.floor, H.wallTop);
  }
  for (const y of H.patioLevels) {
    for (const Y of [y + 0.45, y + H.estimatedRailingHeight])
      strip(o, 'trim', p(0, 0.14), p(1, 0.14), lod === 0 ? 0.07 : 0.055, Y, Y + 0.055);
    for (let j = 0; j <= n; j++) {
      const A = p(j / n, 0.14);
      polygon(o, 'trim', square(...A, lod === 0 ? 0.06 : 0.045), y, y + H.estimatedRailingHeight);
    }
    for (const t of [0, 1])
      strip(
        o,
        'trim',
        p(t, 0.14),
        p(t, H.patioDepth),
        0.055,
        y + H.estimatedRailingHeight,
        y + H.estimatedRailingHeight + 0.055,
      );
  }
  componentEvidence.push('both-full-length-upper-street-patios-square-columns-and-complete-rails');
  for (let i = 0; i < 4; i++) {
    const A = body[i],
      B = body[(i + 1) % 4],
      count = i % 2 ? P.facade.estimatedOtherLongBayCount : P.facade.estimatedShortBayCount;
    for (let f = 0; f < 3; f++)
      for (let j = 0; j < count; j++) {
        const door = i === 3 && f === 0 && j === Math.floor(count / 2),
          y = P.floor + f * H.storeyHeight + (door ? 0 : 0.85);
        fenestration(
          o,
          A,
          B,
          (j + 0.5) / count,
          y,
          door ? 1.5 : P.facade.windowWidth,
          door ? 2.6 : P.facade.windowHeight,
          lod,
          door,
        );
      }
  }
  componentEvidence.push('all-four-complete-facades-with-original-blue-wood-shutter-geometry');
  componentEvidence.push('recessed-street-mainwall-and-estimated-closed-main-entry');
  if (lod > 1) {
    const A = p(0.45, H.patioDepth - 0.12),
      B = p(0.7, H.patioDepth - 0.12);
    strip(o, 'foundation', A, B, 0.55, P.floor - 0.12, P.floor + 0.08);
  }
  componentEvidence.push('original-estimated-clay-blue-cream-finish-no-source-textures-or-artwork');
}
export const houseSkyline = (o, f) => buildHouse(o, f, 0),
  houseDistrict = (o, f) => buildHouse(o, f, 1),
  houseStreet = (o, f) => buildHouse(o, f, 2),
  houseCloseup = (o, f) => buildHouse(o, f, 3);
const root = 'content/worldgen/source/places/sd/sdz/acropole_hotel',
  camera = [45, 27, 52],
  look = [0, 5, 0];
export const houseModel = {
  key: P.model,
  id: P.model,
  title: 'Acropole Hotel — whole historical Khartoum hotel',
  wikidataId: 'Q4676414',
  cell: 'sd/sdz',
  category: 'hotel-commercial',
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
  portableGroundY: -2.4,
  mediumFiContext: {
    scale: 1,
    groundY: 0,
    far: 5000,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: [
    'stucco',
    'concrete_plain',
    'metal_painted',
    'window_punched',
    'wood_plain',
  ],
  qaCameras: [
    {
      name: 'whole-three-storey-hotel-patios-blue-shutters-and-full-roof',
      position: camera,
      lookAt: look,
    },
    {
      name: 'both-complete-street-patios-columns-rails-and-recessed-mainwall',
      position: [7, 10, 37],
      lookAt: [0, 5, 5],
    },
    {
      name: 'blue-wooden-shutter-leaves-and-original-louvre-detail',
      position: [-15, 8, 20],
      lookAt: [-9, 6, 5],
    },
    { name: 'whole-main-roof-and-all-rear-side-facades', position: [-35, 30, -40], lookAt: look },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `whole-acropole-hotel-${reviewLod}`,
    position: camera,
    lookAt: look,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `${root}/models/house-model.mjs`,
    level: 'skyline',
    export: 'houseSkyline',
    errorMeters: 0.3,
    surfaces,
    authoredLevels: {
      district: { export: 'houseDistrict', errorMeters: 0.14, surfaces },
      street: { export: 'houseStreet', errorMeters: 0.06, surfaces },
      closeup: { export: 'houseCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: P.limitations,
  sourceLicense:
    'Original procedural whole historical AcropoleHotelKhartoum under repository license. Two first-hand written accounts supply three storeys/clay walls/blue wooden shutters/street patios/room balcony and wartime damaged phase; no photographs/audio/video/figures used. Original numerical wholehotel way203863108/paired namedPOI/Q4676414, quantized not node survey. Exact sections/roof/patio/census/finish/grade estimates explicit; historical2020 intact appearance never claimed current. No source texture/artwork/graphic/photographic/survey/current replacement claim.',
};
