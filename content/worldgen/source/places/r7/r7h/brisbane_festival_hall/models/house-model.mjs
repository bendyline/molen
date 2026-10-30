/** Complete historical Brisbane Festival Hall; no imagery is consumed. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import fs from 'node:fs';
import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import {
  beam,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
export const P = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url))),
  H = P.building;
export const surfaces = {
  wall: { slot: 'wall', graph: 'stucco', roughness: 0.92, metallic: 0 },
  foundation: { slot: 'foundation', graph: 'brick', roughness: 0.98, metallic: 0 },
  roof: { slot: 'roof', graph: 'metal_painted', roughness: 0.7, metallic: 0.22 },
  trim: { slot: 'trim', graph: 'concrete_plain', roughness: 0.94, metallic: 0 },
  window: { slot: 'window', graph: 'window_punched', roughness: 0.38, metallic: 0.12 },
  door: { slot: 'door', graph: 'metal_painted', roughness: 0.72, metallic: 0.18 },
};
const colors = {
  wall: rgb('d4cdb6'),
  foundation: rgb('8e6850'),
  roof: rgb('7c8584'),
  trim: rgb('ece2c8'),
  window: rgb('344d59'),
  door: rgb('555f62'),
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
const square = (x, z, w) => [
  [x - w / 2, z - w / 2],
  [x + w / 2, z - w / 2],
  [x + w / 2, z + w / 2],
  [x - w / 2, z + w / 2],
];
const rect = (x0, x1, z0, z1) => [
  [x0, z0],
  [x1, z0],
  [x1, z1],
  [x0, z1],
];
function slopedWing(o, r, upper) {
  const y = H.sideInnerRoof;
  for (let i = 0; i < 4; i++) {
    const a = r[i],
      b = r[(i + 1) % 4],
      p = [
        [a[0], y, a[1]],
        [b[0], y, b[1]],
        [b[0], upper[(i + 1) % 4], b[1]],
        [a[0], upper[i], a[1]],
      ].filter(
        (p, i, a) => !a.slice(0, i).some((q) => q.every((v, k) => Math.abs(v - p[k]) < 1e-8)),
      );
    if (p.length > 2) face(o, 'wall', p, [b[1] - a[1], 0, -(b[0] - a[0])]);
  }
  face(
    o,
    'roof',
    r.map((p, i) => [p[0], upper[i], p[1]]),
    [0, 1, 0],
  );
  cap(o, 'roof', r, y, -1);
}
function raisedRoof(o) {
  const x0 = -9,
    x1 = 39,
    profile = [
      [-13.5, H.centralEave],
      [H.centralRidgeZ, H.centralRidge],
      [14.5, H.centralEave],
    ];
  for (const [x, n] of [
    [x0, [-1, 0, 0]],
    [x1, [1, 0, 0]],
  ])
    face(
      o,
      'roof',
      profile.map((p) => [x, p[1], p[0]]),
      n,
    );
  for (let i = 0; i < 3; i++) {
    const a = profile[i],
      b = profile[(i + 1) % 3];
    face(
      o,
      'roof',
      [
        [x0, a[1], a[0]],
        [x1, a[1], a[0]],
        [x1, b[1], b[0]],
        [x0, b[1], b[0]],
      ],
      i < 2 ? [0, 1, 0] : [0, -1, 0],
    );
  }
}
function panel(o, a, b, t, y, w, h, lod, k = 'window') {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    L = Math.hypot(dx, dz),
    U = [dx / L, dz / L],
    N = [U[1], -U[0]],
    p = (u, Y, d = 0.04) => [
      a[0] + dx * t + U[0] * u + N[0] * d,
      Y,
      a[1] + dz * t + U[1] * u + N[1] * d,
    ];
  face(o, k, [p(-w / 2, y), p(w / 2, y), p(w / 2, y + h), p(-w / 2, y + h)], [N[0], 0, N[1]]);
  if (lod > 0) {
    for (const u of [-w / 2, w / 2])
      beam(o, 'trim', p(u, y, 0.08), p(u, y + h, 0.08), 0.065, 0.075, colors.trim);
    if (lod > 1)
      beam(o, 'trim', p(-w / 2, y + h, 0.08), p(w / 2, y + h, 0.08), 0.08, 0.1, colors.trim);
  }
  if (lod === 3) beam(o, 'door', p(0, y, 0.065), p(0, y + h, 0.065), 0.055, 0.06, colors.door);
}
const glyphs = {
  F: [
    [0, 0, 0, 1],
    [0, 1, 0.6, 1],
    [0, 0.55, 0.45, 0.55],
  ],
  E: [
    [0, 0, 0, 1],
    [0, 1, 0.6, 1],
    [0, 0.5, 0.5, 0.5],
    [0, 0, 0.6, 0],
  ],
  S: [
    [0.6, 1, 0, 1],
    [0, 1, 0, 0.5],
    [0, 0.5, 0.6, 0.5],
    [0.6, 0.5, 0.6, 0],
    [0.6, 0, 0, 0],
  ],
  T: [
    [0, 1, 0.7, 1],
    [0.35, 1, 0.35, 0],
  ],
  I: [[0.3, 0, 0.3, 1]],
  V: [
    [0, 1, 0.3, 0],
    [0.3, 0, 0.6, 1],
  ],
  A: [
    [0, 0, 0.3, 1],
    [0.3, 1, 0.6, 0],
    [0.15, 0.5, 0.45, 0.5],
  ],
  L: [
    [0, 1, 0, 0],
    [0, 0, 0.6, 0],
  ],
  H: [
    [0, 0, 0, 1],
    [0.6, 0, 0.6, 1],
    [0, 0.5, 0.6, 0.5],
  ],
};
function plainName(o) {
  let x = 7;
  for (const c of 'FESTIVAL HALL') {
    for (const [a, b, d, e] of glyphs[c] ?? [])
      beam(
        o,
        'trim',
        [x + a * 0.85, 7.8 + b * 0.85, 29.11],
        [x + d * 0.85, 7.8 + e * 0.85, 29.11],
        0.065,
        0.1,
        colors.trim,
      );
    x += 0.85;
  }
}
export function buildHouse(o, _frame, lod = 3) {
  componentEvidence.length = 0;
  const r = P.estimatedHistoricalRing;
  polygon(o, 'foundation', r, H.basementBottom, H.estimatedBaseBandTop);
  polygon(o, 'wall', r, H.estimatedBaseBandTop, H.mainWallTop);
  componentEvidence.push('entire-estimated-historical-hall-podium-all-foyers-and-four-facades');
  slopedWing(o, rect(-15, 45, -28, -13.5), [
    H.sideOuterRoof,
    H.sideOuterRoof,
    H.sideInnerRoof,
    H.sideInnerRoof,
  ]);
  slopedWing(o, rect(-15, 45, 14.5, 29), [
    H.sideInnerRoof,
    H.sideInnerRoof,
    H.sideOuterRoof,
    H.sideOuterRoof,
  ]);
  componentEvidence.push('both-complete-estimated-raked-seating-wing-roof-volumes');
  polygon(o, 'wall', H.centralAuditoriumRing, H.mainWallTop, H.centralEave);
  raisedRoof(o);
  componentEvidence.push('complete-raised-central-auditorium-walls-roof-and-both-end-foyer-roofs');
  for (let i = 0; i < 4; i++) {
    const a = r[i],
      b = r[(i + 1) % 4],
      L = Math.hypot(b[0] - a[0], b[1] - a[1]),
      n = i % 2 ? P.facade.estimatedAlbertBayCount : P.facade.estimatedCharlotteBayCount;
    for (let j = 0; j < n; j++) {
      const t = (j + 0.5) / n;
      panel(o, a, b, t, 4.4, (L / n) * 0.7, 1.6, lod);
      if (i === 2 && j < 3) panel(o, a, b, t, P.floor, 2, 2.7, lod, 'window');
      else if (i === 3 && j < 3) panel(o, a, b, t, P.floor, 2, 2.7, lod, 'door');
      if (lod > 1 && j < n - 1) {
        const q = [a[0] + ((b[0] - a[0]) * (j + 1)) / n, a[1] + ((b[1] - a[1]) * (j + 1)) / n];
        polygon(o, 'trim', square(...q, 0.12), H.estimatedBaseBandTop, H.mainWallTop);
      }
    }
  }
  const r2 = H.centralAuditoriumRing;
  for (let i = 0; i < 4; i++) {
    const a = r2[i],
      b = r2[(i + 1) % 4],
      L = Math.hypot(b[0] - a[0], b[1] - a[1]),
      n = i % 2 ? 6 : P.facade.estimatedClerestoryBayCount;
    for (let j = 0; j < n; j++) panel(o, a, b, (j + 0.5) / n, 12.5, (L / n) * 0.75, 1.9, lod);
  }
  componentEvidence.push('all-foyer-entries-and-estimated-modernist-window-clerestory-census');
  polygon(o, 'trim', rect(-15, 5, 29, 30.8), 3.55, 3.7);
  polygon(o, 'trim', rect(-16.8, -15, 9, 29), 3.55, 3.7);
  if (lod > 1) plainName(o);
  componentEvidence.push('complete-corner-entry-canopies-and-original-plain-name-lettering');
  if (lod === 3)
    for (let j = 0; j < 9; j++) {
      const x = -9 + ((j + 0.5) * 48) / 9;
      for (const [a, b] of [
        [
          [-13.5, H.centralEave],
          [H.centralRidgeZ, H.centralRidge],
        ],
        [
          [H.centralRidgeZ, H.centralRidge],
          [14.5, H.centralEave],
        ],
      ])
        beam(
          o,
          'roof',
          [x, a[1] + 0.025, a[0]],
          [x, b[1] + 0.025, b[0]],
          0.055,
          0.065,
          colors.roof,
        );
    }
  componentEvidence.push('original-estimated-cream-brick-metal-finish-no-photo-or-artwork-trace');
}
export const houseSkyline = (o, f) => buildHouse(o, f, 0),
  houseDistrict = (o, f) => buildHouse(o, f, 1),
  houseStreet = (o, f) => buildHouse(o, f, 2),
  houseCloseup = (o, f) => buildHouse(o, f, 3);
const root = 'content/worldgen/source/places/r7/r7h/brisbane_festival_hall',
  camera = [93, 48, 104],
  look = [15, 8, 0.5];
export const houseModel = {
  key: P.model,
  id: P.model,
  title: 'Brisbane Festival Hall — whole historical hall and roofs',
  wikidataId: 'Q4968565',
  cell: 'r7/r7h',
  category: 'civic-institutional',
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
  embeddedCanonicalGraphs: ['stucco', 'brick', 'metal_painted', 'concrete_plain', 'window_punched'],
  qaCameras: [
    {
      name: 'whole-historical-hall-all-raised-and-seating-roof-volumes',
      position: camera,
      lookAt: look,
    },
    {
      name: 'full-charlotte-facade-raked-side-roofs-and-raised-auditorium',
      position: [13, 20, 93],
      lookAt: look,
    },
    {
      name: 'complete-albert-entry-foyer-and-both-canopies',
      position: [-64, 20, 56],
      lookAt: [2, 6, 9],
    },
    { name: 'entire-roof-all-side-wings-and-rear-foyers', position: [69, 55, -77], lookAt: look },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `whole-festival-hall-${reviewLod}`,
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
    'Original procedural complete historical BrisbaneFestivalHall under repository license. Primary original2002ICOMOSwritten raised auditorium/raked seating wings/modernist facade facts and originaldesigner oral-history actual-built-shape statement. Original adjacent numerical Charlotte/Albert controls and publishedQ4968565point provide context only, actual historical footprint absent. Whole plan/all sections/roof profiles/census/finish/grade explicitly estimated with20percentplan uncertainty. No photographs/figures/sketches/audio/video/drawings or historical logo copied; no modernTower/predecessor/neighbor/one-facade proxy or photographic/survey/current replacement claim.',
};
