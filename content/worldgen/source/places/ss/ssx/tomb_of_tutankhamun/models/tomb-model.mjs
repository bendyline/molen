/** KV62's complete carved architecture on24November1922; underground volumes remain below grade. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import fs from 'node:fs';
import { normalFor } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';

const P = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url))),
  D = P.dimensions;
export const surfaces = {
  rock: { slot: 'wall', graph: 'stone_limestone_raw', roughness: 0.98, metallic: 0 },
  plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.96, metallic: 0 },
};
const C = { rock: rgb('b7ab91'), plaster: rgb('c9c0a5') },
  ochre = rgb('c8b77d');
export const partEvidence = [],
  stepEvidence = [],
  openingEvidence = [];
function tri(o, k, points, col = C[k]) {
  const p = points.map((q) => q.map(Math.fround)),
    n = normalFor(...p);
  if (!n.every(Number.isFinite)) throw Error('Degenerate tomb triangle');
  o.addTriangle(
    k,
    'palette:#ffffff',
    p,
    n,
    [
      [0, 0],
      [1, 0],
      [1, 1],
    ],
    col,
  );
}
function face(o, k, p, n, col) {
  if (n && normalFor(...p).reduce((s, v, i) => s + v * n[i], 0) < 0) p = p.slice().reverse();
  for (let i = 1; i < p.length - 1; i++) tri(o, k, [p[0], p[i], p[i + 1]], col);
}
function block(o, k, x0, x1, y0, y1, z0, z1, col) {
  for (const [p, n] of [
    [
      [
        [x0, y0, z1],
        [x1, y0, z1],
        [x1, y1, z1],
        [x0, y1, z1],
      ],
      [0, 0, 1],
    ],
    [
      [
        [x1, y0, z0],
        [x0, y0, z0],
        [x0, y1, z0],
        [x1, y1, z0],
      ],
      [0, 0, -1],
    ],
    [
      [
        [x0, y0, z0],
        [x0, y0, z1],
        [x0, y1, z1],
        [x0, y1, z0],
      ],
      [-1, 0, 0],
    ],
    [
      [
        [x1, y0, z1],
        [x1, y0, z0],
        [x1, y1, z0],
        [x1, y1, z1],
      ],
      [1, 0, 0],
    ],
    [
      [
        [x0, y1, z1],
        [x1, y1, z1],
        [x1, y1, z0],
        [x0, y1, z0],
      ],
      [0, 1, 0],
    ],
    [
      [
        [x0, y0, z0],
        [x1, y0, z0],
        [x1, y0, z1],
        [x0, y0, z1],
      ],
      [0, -1, 0],
    ],
  ])
    face(o, k, p, n, col);
}
function room(out, q, lod) {
  const [x0, x1, z0, z1] = q.bounds,
    y = q.floorY,
    h = q.clearHeight,
    t = D.roomRockShellThicknessEstimate,
    top = y + h;
  block(out, 'rock', x0, x1, y - 0.25, y, z0, z1);
  block(out, 'rock', x0, x1, top, top + t, z0, z1);
  if (q.id !== 'treasury-storechamber')
    block(out, 'rock', x0 - t, x0, y - 0.25, top + t, z0 - t, z1 + t);
  else {
    const burial = P.rooms.find((r) => r.id === 'sepulchral-hall');
    // Close the treasury return beyond the extent of the shared burial wall.
    if (z0 < burial.bounds[2])
      block(out, 'rock', x0 - t, x0, y - 0.25, top + t, z0 - t, burial.bounds[2]);
    if (z1 > burial.bounds[3])
      block(out, 'rock', x0 - t, x0, y - 0.25, top + t, burial.bounds[3], z1 + t);
  }
  // The burial east wall is shared with the treasury west wall; build it once.
  if (q.id === 'sepulchral-hall') {
    const d = P.doors.find((d) => d.id === 'treasury-open-connection'),
      a = d.center - d.width / 2,
      b = d.center + d.width / 2;
    block(out, 'rock', x1, x1 + t, y - 0.25, top + t, z0, a);
    block(out, 'rock', x1, x1 + t, y - 0.25, top + t, b, z1);
    block(out, 'rock', x1, x1 + t, y + d.height, top + t, a, b);
    block(out, 'rock', x1, x1 + t, y - 0.25, y, a, b);
    openingEvidence.push({
      id: d.id,
      axis: 'x',
      east: x1 + t,
      west: x1,
      z0: a,
      z1: b,
      floorY: y,
      clearHeight: d.height,
    });
  } else block(out, 'rock', x1, x1 + t, y - 0.25, top + t, z0 - t, z1 + t);
  block(out, 'rock', x0, x1, y - 0.25, top + t, z0 - t, z0);
  block(out, 'rock', x0, x1, y - 0.25, top + t, z1, z1 + t);
  if (q.id === 'sepulchral-hall' && lod >= 1) {
    const k = 0.003;
    face(
      out,
      'plaster',
      [
        [x0 + k, y, z0],
        [x0 + k, top, z0],
        [x0 + k, top, z1],
        [x0 + k, y, z1],
      ],
      [1, 0, 0],
      ochre,
    );
    for (const z of [z0 + k, z1 - k])
      face(
        out,
        'plaster',
        [
          [x0, y, z],
          [x1, y, z],
          [x1, top, z],
          [x0, top, z],
        ],
        [0, 0, z === z0 + k ? 1 : -1],
        ochre,
      );
    const d = P.doors.find((d) => d.id === 'treasury-open-connection'),
      a = d.center - d.width / 2,
      b = d.center + d.width / 2;
    for (const [za, zb, low, high] of [
      [z0, a, y, top],
      [b, z1, y, top],
      [a, b, y + d.height, top],
    ])
      face(
        out,
        'plaster',
        [
          [x1 - k, low, za],
          [x1 - k, high, za],
          [x1 - k, high, zb],
          [x1 - k, low, zb],
        ],
        [-1, 0, 0],
        ochre,
      );
  }
  partEvidence.push({
    id: q.id,
    kind: 'whole-underground-chamber',
    bounds: q.bounds,
    floorY: y,
    clearHeight: h,
    roofTop: top + t,
  });
}
function descendingPassage(out) {
  const p = P.passage,
    x0 = p.westX,
    x1 = p.eastX,
    z0 = -p.width / 2,
    z1 = p.width / 2,
    t = p.rockShellThicknessEstimate,
    floor = (x) => p.westFloorY + ((p.eastFloorY - p.westFloorY) * (x - x0)) / (x1 - x0);
  function slab(za, zb, lo, hi) {
    const a = [x0, floor(x0) + lo, za],
      b = [x1, floor(x1) + lo, za],
      c = [x1, floor(x1) + lo, zb],
      d = [x0, floor(x0) + lo, zb],
      A = [x0, floor(x0) + hi, za],
      B = [x1, floor(x1) + hi, za],
      CC = [x1, floor(x1) + hi, zb],
      DD = [x0, floor(x0) + hi, zb];
    for (const [ps, n] of [
      [
        [a, b, c, d],
        [0, -1, 0],
      ],
      [
        [A, B, CC, DD],
        [0, 1, 0],
      ],
      [
        [a, A, B, b],
        [0, 0, -1],
      ],
      [
        [d, c, CC, DD],
        [0, 0, 1],
      ],
      [
        [a, d, DD, A],
        [-1, 0, 0],
      ],
      [
        [b, B, CC, c],
        [1, 0, 0],
      ],
    ])
      face(out, 'rock', ps, n);
  }
  slab(z0, z1, -0.25, 0);
  slab(z0, z1, p.clearHeight, p.clearHeight + t);
  slab(z0 - t, z0, -0.25, p.clearHeight + t);
  slab(z1, z1 + t, -0.25, p.clearHeight + t);
  partEvidence.push({
    id: 'descending-passage',
    kind: 'closed-rockcut-descending-corridor',
    length: x1 - x0,
    width: p.width,
    eastFloor: p.eastFloorY,
    westFloor: p.westFloorY,
    clearHeight: p.clearHeight,
  });
}
function stairs(out, lod) {
  const p = P.stairs,
    run = p.run / p.count,
    w = p.width / 2,
    bottom = p.lowerY - 0.35;
  for (let i = 0; i < p.count; i++) {
    const x1 = p.upperX - i * run,
      x0 = x1 - run,
      y = p.topY - (i + 1) * p.stepRiseEstimate;
    block(out, 'rock', x0, x1, bottom, y, -w, w);
    stepEvidence.push({ index: i + 1, x0, x1, y, width: p.width });
  }
  const outer = p.outerShellWidthEstimate / 2;
  for (const side of [-1, 1]) {
    const z0 = side < 0 ? -outer : w,
      z1 = side < 0 ? -w : outer;
    block(out, 'rock', p.lowerX - 0.95, p.upperX + 0.5, bottom, p.topRimYEstimate, z0, z1);
  }
  // The intrinsic remaining bedrock lip roofs the lower part of the stair cut.
  block(
    out,
    'rock',
    p.lowerX - 0.95,
    p.lowerX + p.lowerRockRoofLengthEstimate,
    p.lowerY + p.rockRoofClearance,
    p.topRimYEstimate,
    -w,
    w,
  );
  if (lod >= 1)
    for (const side of [-1, 1])
      for (let i = 0; i < 5; i++) {
        const x = i * 0.86 - 0.2,
          z = side * (w + 0.32);
        block(
          out,
          'rock',
          x,
          x + 0.48,
          p.topRimYEstimate - 0.15,
          p.topRimYEstimate + 0.04 * Math.sin(i * 2.4 + 1),
          z - 0.21,
          z + 0.21,
        );
      }
  if (lod >= 2)
    for (let i = 0; i < 8; i++) {
      const y = p.lowerY + 0.3 + i * 0.31;
      for (const side of [-1, 1]) {
        const z = side * (w + 0.12);
        block(out, 'rock', -0.98, -0.87, y, y + 0.13, z - 0.12, z + 0.12);
      }
    }
  partEvidence.push({
    id: 'sixteen-step-entrance',
    kind: 'intrinsic-excavated-stairwell',
    count: p.count,
    width: p.width,
    upperFloor: p.topY,
    lowerFloor: p.lowerY,
    physicalOpening: P.physicalEntranceOpening,
  });
}
function sealedDoors(out, lod) {
  for (const d of P.doors.filter((d) => d.closed)) {
    const y = d.floorY,
      a = d.center - d.width / 2,
      b = d.center + d.width / 2;
    if (d.axis === 'x') {
      block(out, 'rock', d.plane - d.thickness, d.plane, y, y + d.height, a, b);
      for (const [xx, n] of [
        [d.plane + 0.002, [1, 0, 0]],
        [d.plane - d.thickness - 0.002, [-1, 0, 0]],
      ])
        face(
          out,
          'plaster',
          [
            [xx, y + 0.025, a + 0.025],
            [xx, y + d.height - 0.025, a + 0.025],
            [xx, y + d.height - 0.025, b - 0.025],
            [xx, y + 0.025, b - 0.025],
          ],
          n,
        );
    } else {
      block(out, 'rock', a, b, y, y + d.height, d.plane - d.thickness, d.plane);
      for (const [zz, n] of [
        [d.plane + 0.002, [0, 0, 1]],
        [d.plane - d.thickness - 0.002, [0, 0, -1]],
      ])
        face(
          out,
          'plaster',
          [
            [a + 0.025, y + 0.025, zz],
            [b - 0.025, y + 0.025, zz],
            [b - 0.025, y + d.height - 0.025, zz],
            [a + 0.025, y + d.height - 0.025, zz],
          ],
          n,
        );
    }
    if (lod >= 2)
      for (let row = 0; row < 5; row++)
        for (let col = 0; col < 3; col++) {
          const yy = y + 0.12 + (row * (d.height - 0.2)) / 5,
            cc = a + 0.12 + (col * (d.width - 0.22)) / 3,
            color = C.plaster.map((v) => v * (0.89 + 0.08 * Math.sin(row * 1.7 + col * 0.9) ** 2));
          if (d.axis === 'x')
            face(
              out,
              'plaster',
              [
                [d.plane + 0.004, yy, cc],
                [d.plane + 0.004, yy + 0.09, cc],
                [d.plane + 0.004, yy + 0.09, Math.min(b - 0.04, cc + 0.14)],
                [d.plane + 0.004, yy, Math.min(b - 0.04, cc + 0.14)],
              ],
              [1, 0, 0],
              color,
            );
          else
            face(
              out,
              'plaster',
              [
                [cc, yy, d.plane + 0.004],
                [Math.min(b - 0.04, cc + 0.14), yy, d.plane + 0.004],
                [Math.min(b - 0.04, cc + 0.14), yy + 0.09, d.plane + 0.004],
                [cc, yy + 0.09, d.plane + 0.004],
              ],
              [0, 0, 1],
              color,
            );
        }
    partEvidence.push({
      id: d.id,
      kind: 'historically-sealed-masonry-doorway',
      axis: d.axis,
      plane: d.plane,
      thickness: d.thickness,
      width: d.width,
      floorY: y,
      clearHeight: d.height,
      closed: true,
    });
  }
}
export function buildTomb(out, _frame, lod = 3) {
  partEvidence.length = 0;
  stepEvidence.length = 0;
  openingEvidence.length = 0;
  for (const q of P.rooms) room(out, q, lod);
  descendingPassage(out);
  stairs(out, lod);
  sealedDoors(out, lod);
}
export const tombSkyline = (o, f) => buildTomb(o, f, 0),
  tombDistrict = (o, f) => buildTomb(o, f, 1),
  tombStreet = (o, f) => buildTomb(o, f, 2),
  tombCloseup = (o, f) => buildTomb(o, f, 3);
const root = 'content/worldgen/source/places/ss/ssx/tomb_of_tutankhamun',
  ante = P.rooms.find((q) => q.id === 'antechamber'),
  burial = P.rooms.find((q) => q.id === 'sepulchral-hall'),
  annexe = P.rooms.find((q) => q.id === 'annexe'),
  store = P.rooms.find((q) => q.id === 'treasury-storechamber');
export const tombModel = {
  key: 'tomb_of_tutankhamun',
  id: 'tomb_of_tutankhamun',
  title: 'Tomb of Tutankhamun (KV62), Egypt (1922)',
  cell: 'ss/ssx',
  wikidataId: 'Q835309',
  category: 'monument',
  recipe: 'tomb-model.mjs',
  surfaces,
  build: buildTomb,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
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
  camera: [20, 15, 25],
  lookAt: [-6, -2, -2],
  portableGroundY: -14,
  mediumFiContext: {
    scale: 0.4,
    groundY: -14,
    far: 3000,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: ['stone_limestone_raw', 'plaster_lime'],
  groundCutout: {
    minHeight: -14,
    outline: P.physicalEntranceOpening,
    basis:
      'Only the actualcarvedentrancestairwell/portalvoid; no cutout aboveundergroundroomroofs or broadsitepad. Originalheightfield/datumretained. Historicgrade/registrationapproximate.',
  },
  qaCameras: [
    {
      name: 'whole-intrinsic-underground-architecture-diagnostic',
      position: [-24, 12, 20],
      lookAt: [-6, -3, -2],
    },
    {
      name: 'sixteen-steps-and-first-sealed-door',
      position: [5.8, 2.7, 3.5],
      lookAt: [0.5, -1.5, 0],
    },
    {
      name: 'first-sealed-door-under-original-rock-lip',
      position: [1.3, -1.6, 0.55],
      lookAt: [0, -2, 0],
    },
    {
      name: 'antechamber-and-sealed-northern-partition',
      position: [-11.4, ante.floorY + 1.3, 2.3],
      lookAt: [-11.35, ante.floorY + 1.2, -3.65],
    },
    {
      name: 'sepulchral-hall-and-open-treasury-connection',
      position: [-14.5, burial.floorY + 1.4, -5.1],
      lookAt: [-9.6, burial.floorY + 1.1, -7.1],
    },
    {
      name: 'annexe-and-fourth-sealed-door',
      position: [-15.6, annexe.floorY + 1.2, 1.2],
      lookAt: [-13.9, annexe.floorY + 0.75, 3.05],
    },
    {
      name: 'treasury-and-connecting-doorway',
      position: [-6.5, store.floorY + 1.3, -8],
      lookAt: [-9.6, store.floorY + 1, -7.1],
    },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `entrance-${reviewLod}`,
    position: [5.8, 2.7, 3.5],
    lookAt: [0.5, -1.5, 0],
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `${root}/models/tomb-model.mjs`,
    level: 'skyline',
    export: 'tombSkyline',
    errorMeters: 0.4,
    surfaces,
    authoredLevels: {
      district: { export: 'tombDistrict', errorMeters: 0.18, surfaces },
      street: { export: 'tombStreet', errorMeters: 0.06, surfaces },
      closeup: { export: 'tombCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: [P.geometryBasis, P.sectionBasis, P.geographicApproximation, ...P.limitations],
  sourceLicense:
    'Original authored architecture under repositorylicense. Already-clearedpublishedQuallaBurton1922contextfirst; exactMITlibrary1923NewYorkCarter/Macevolume/nativeNoCopyright-US/printedtitlecopyrightplanentrancestairsbound. Primaryfactualdimensions andOSMODbLactualKV62site/undergroundidentity. No modernprotectedplan/photo/canopy/replica, burialobjects/letteredsealsor copiedpaintedfigures/bakedphotography. Closedundergroundroomsremainbelowgrade; isolatedflatstageisdiagnostic.',
};
