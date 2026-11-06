/** Reported whole Pink Hall; written dimensions and five-bay census, all imagery unused. */
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
  pink: { slot: 'wall', graph: 'plaster_lime', roughness: 0.98, metallic: 0 },
  trim: { slot: 'trim', graph: 'stone_limestone_raw', roughness: 0.97, metallic: 0 },
  roof: { slot: 'roof', graph: 'concrete_plain', roughness: 1, metallic: 0 },
  wood: { slot: 'trim', graph: 'wood_plain', roughness: 0.9, metallic: 0 },
  base: { slot: 'foundation', graph: 'stone_limestone_raw', roughness: 1, metallic: 0 },
};
const colors = {
  pink: rgb('d8a69d'),
  trim: rgb('dfd2b5'),
  roof: rgb('a59d8c'),
  wood: rgb('4c4139'),
  base: rgb('9e9587'),
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
  const t = new MeshBufferBuilder();
  if (
    !t.addCap(
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
    throw Error('Invalid hall cap');
  const m = t.finalize();
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
  ],
  L = P.length / 2,
  D = P.depth / 2;
function arch(o, left, right, lod) {
  const n = [4, 6, 10, 16][lod],
    mid = (left + right) / 2,
    r = (right - left) / 2,
    profile = Array.from({ length: n + 1 }, (_, i) => {
      const a = Math.PI - (i * Math.PI) / n;
      return [mid + r * Math.cos(a), P.archSpring + r * Math.sin(a)];
    });
  profile.push([right, P.arcadeTop], [left, P.arcadeTop]);
  for (let i = 0; i < profile.length; i++) {
    const a = profile[i],
      b = profile[(i + 1) % profile.length],
      k = i < n ? 'trim' : 'pink';
    face(
      o,
      k,
      [
        [a[0], a[1], D],
        [b[0], b[1], D],
        [b[0], b[1], D - P.porticoDepth],
        [a[0], a[1], D - P.porticoDepth],
      ],
      [b[1] - a[1], a[0] - b[0], 0],
    );
  }
  for (const [z, s] of [
    [D, 1],
    [D - P.porticoDepth, -1],
  ]) {
    const t = new MeshBufferBuilder();
    if (
      !t.addCap(
        'pink',
        'palette:#ffffff',
        profile,
        [],
        () => z,
        [0, 1, 0],
        (p) => p,
        colors.pink,
      )
    )
      throw Error('Invalid arcade profile');
    const m = t.finalize();
    for (let i = 0; i < m.indices.length; i += 3)
      face(
        o,
        'pink',
        Array.from(m.indices.slice(i, i + 3)).map((j) => [
          m.positions[j * 3],
          m.positions[j * 3 + 2],
          m.positions[j * 3 + 1],
        ]),
        [0, 0, s],
      );
  }
}
function column(o, x, lod) {
  const n = [6, 8, 12, 16][lod],
    ring = (r) =>
      Array.from({ length: n }, (_, i) => [
        x + r * Math.cos((i * Math.PI * 2) / n),
        D - 0.28 + r * Math.sin((i * Math.PI * 2) / n),
      ]);
  prism(o, 'trim', rect(x - 0.43, D - 0.71, x + 0.43, D + 0.15), P.floor, P.floor + 0.3);
  prism(o, 'trim', ring(0.24), P.floor + 0.3, P.archSpring - 0.25);
  prism(o, 'trim', rect(x - 0.46, D - 0.74, x + 0.46, D + 0.18), P.archSpring - 0.25, P.archSpring);
  if (lod > 1) {
    prism(o, 'trim', ring(0.31), P.floor + 0.3, P.floor + 0.45);
    prism(o, 'trim', ring(0.31), P.archSpring - 0.45, P.archSpring - 0.25);
  }
}
function jharokha(o, x, lod) {
  const w = 0.85,
    pr = P.jharokhaProjection,
    r =
      lod === 0
        ? rect(x - w, D - 0.03, x + w, D + pr)
        : [
            [x - w, D - 0.03],
            [x + w, D - 0.03],
            [x + w, D + 0.46],
            [x + 0.52, D + pr],
            [x - 0.52, D + pr],
            [x - w, D + 0.46],
          ],
    scaled = r.map(([X, Z]) => [x + (X - x) * 1.12, D + (Z - D) * 1.12]);
  prism(o, 'pink', r, P.jharokhaSill, P.jharokhaTop);
  prism(o, 'trim', scaled, P.jharokhaSill - 0.15, P.jharokhaSill);
  prism(o, 'trim', scaled, P.jharokhaTop, P.jharokhaTop + 0.18);
  face(
    o,
    'wood',
    [
      [x - 0.48, P.jharokhaSill + 0.35, D + pr + 0.003],
      [x + 0.48, P.jharokhaSill + 0.35, D + pr + 0.003],
      [x + 0.48, P.jharokhaTop - 0.28, D + pr + 0.003],
      [x - 0.48, P.jharokhaTop - 0.28, D + pr + 0.003],
    ],
    [0, 0, 1],
  );
  if (lod > 1) {
    for (const X of [x - 0.52, x, x + 0.52])
      beam(
        o,
        'trim',
        [X, P.jharokhaSill + 0.25, D + pr + 0.014],
        [X, P.jharokhaTop - 0.2, D + pr + 0.014],
        0.055,
        0.055,
        colors.trim,
      );
    for (const X of [x - 0.55, x + 0.55])
      beam(
        o,
        'trim',
        [X, P.jharokhaSill - 0.6, D + 0.02],
        [X, P.jharokhaSill - 0.13, D + pr * 0.85],
        0.16,
        0.16,
        colors.trim,
      );
  }
}
export function buildHouse(o, _frame, lod = 3) {
  componentEvidence.length = 0;
  prism(o, 'base', P.nativeRing, P.foundationBottom, P.floor);
  prism(o, 'pink', rect(-L, -D, L, D - P.porticoDepth), P.floor, P.roof - 0.24);
  prism(o, 'pink', rect(-L, D - P.porticoDepth, L, D), P.arcadeTop, P.roof - 0.24);
  prism(o, 'roof', P.nativeRing, P.roof - 0.24, P.roof);
  for (const r of [
    rect(-L, -D, L, -D + 0.32),
    rect(-L, D - 0.32, L, D),
    rect(-L, -D + 0.32, -L + 0.32, D - 0.32),
    rect(L - 0.32, -D + 0.32, L, D - 0.32),
  ])
    prism(o, 'pink', r, P.roof, P.parapetTop);
  const a = -L + 0.63,
    b = L - 0.63,
    step = (b - a) / 5,
    nodes = Array.from({ length: 6 }, (_, i) => a + i * step);
  prism(o, 'pink', rect(-L, D - P.porticoDepth, a + 0.28, D), P.floor, P.arcadeTop);
  prism(o, 'pink', rect(b + 0.28, D - P.porticoDepth, L, D), P.floor, P.arcadeTop);
  let columns = 0,
    arches = 0,
    windows = 0;
  for (let i = 1; i < 6; i++) {
    column(o, nodes[i], lod);
    columns++;
    prism(
      o,
      'pink',
      rect(nodes[i] - 0.28, D - P.porticoDepth, nodes[i] + 0.28, D),
      P.archSpring,
      P.arcadeTop,
    );
  }
  for (let i = 0; i < 5; i++) {
    arch(o, nodes[i] + 0.28, nodes[i + 1] - 0.28, lod);
    arches++;
    jharokha(o, (nodes[i] + nodes[i + 1]) / 2, lod);
    windows++;
  }
  face(
    o,
    'wood',
    [
      [-1, P.floor, D - P.porticoDepth + 0.004],
      [1, P.floor, D - P.porticoDepth + 0.004],
      [1, 3.75, D - P.porticoDepth + 0.004],
      [-1, 3.75, D - P.porticoDepth + 0.004],
    ],
    [0, 0, 1],
  );
  let rearWindows = 0;
  if (lod > 0) {
    for (const x of [-10, -5, 0, 5, 10])
      for (const y of [2.1, 7.4]) {
        face(
          o,
          'wood',
          [
            [x - 0.65, y, -D - 0.004],
            [x + 0.65, y, -D - 0.004],
            [x + 0.65, y + 1.7, -D - 0.004],
            [x - 0.65, y + 1.7, -D - 0.004],
          ],
          [0, 0, -1],
        );
        rearWindows++;
      }
    for (const y of [P.arcadeTop, P.roof - 0.32])
      prism(o, 'trim', rect(-L - 0.07, -D - 0.07, L + 0.07, D + 0.07), y, y + 0.14);
  }
  if (lod > 1)
    for (const y of [1.1, P.arcadeTop - 0.3]) {
      prism(o, 'trim', rect(-L, -D - 0.04, L, -D), y, y + 0.09);
    }
  componentEvidence.push({
    lod,
    wholeReportedRectangularHall: true,
    reportedLengthFeet: 95,
    reportedDepthFeet: 36,
    reportedHeightFeet: 40,
    actualCourtyardArches: arches,
    outerColumnSupports: columns,
    endWallPiers: 1,
    projectingJharokhas: windows,
    closedRearAndEnds: true,
    closedWholeRoof: true,
    closedGatewayPanel: true,
    rearWindowEstimates: rearWindows,
    allAppearanceImagesUnused: true,
    reportedDimensionsConfirmedExterior: false,
    bodyCoordinateSurveyed: false,
    footprintMeasured: false,
    heightMeasured: false,
    nativeTenCornerContextNotWholeHall: true,
    noUnsupportedMainDome: true,
    parentPalaceNotCompleted: true,
  });
}
export const houseSkyline = (o, f) => buildHouse(o, f, 0),
  houseDistrict = (o, f) => buildHouse(o, f, 1),
  houseStreet = (o, f) => buildHouse(o, f, 2),
  houseCloseup = (o, f) => buildHouse(o, f, 3);
const root = 'content/worldgen/source/places/tt/ttv/mubarak_mandi_pink_hall',
  camera = [38, 26, 36],
  look = [0, 5.5, 0];
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
  embeddedCanonicalGraphs: ['plaster_lime', 'stone_limestone_raw', 'concrete_plain', 'wood_plain'],
  qaCameras: [
    { name: 'whole-five-arch-courtyard-facade-and-jharokhas', position: camera, lookAt: look },
    { name: 'opposite-complete-hall-rear-roof-and-ends', position: [-38, 24, -36], lookAt: look },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'whole-pink-hall-' + reviewLod,
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
    'Original deterministic geometry under repository license; primary author written dimensional/bay controls and official textual museum identity/finish only. All appearance photographs, plans, artwork and diagrams unused. Native OSM context © OpenStreetMap contributors, ODbL-1.0. Whole reported rectangle registered approximately at native museum context; inside/outside dimensions, sections, facade/roof details, height datum and precise2012condition remain interpretations. No whole-palace completion or current activation.',
};
