/** Written archaeological court/niche controls; explicit estimated historical exterior. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import fs from 'node:fs';
import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import { normalFor } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
export const P = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url)));
export const surfaces = {
  earth: { slot: 'wall', graph: 'earth_adobe', roughness: 1, metallic: 0 },
  plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.98, metallic: 0 },
  floor: { slot: 'foundation', graph: 'earth_rammed', roughness: 1, metallic: 0 },
  timber: { slot: 'trim', graph: 'wood_plain', roughness: 0.96, metallic: 0 },
};
const colors = {
  earth: rgb('baa17e'),
  plaster: rgb('d9c6a3'),
  floor: rgb('b49b77'),
  timber: rgb('725438'),
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

function box(o, k, x0, z0, x1, z1, y0, y1) {
  prism(o, k, rect(x0, z0, x1, z1), y0, y1);
}
function room(o, r, lod) {
  const t = P.wallThickness,
    y = r.floor,
    top = y + r.height,
    w = P.doorWidth / 2;
  box(o, 'floor', r.x0, r.z0, r.x1, r.z1, r.foundationBottom, y);
  const front = r.doorSide,
    axis = front === 'east' || front === 'west' ? 'z' : 'x',
    mid = axis === 'z' ? (r.z0 + r.z1) / 2 : (r.x0 + r.x1) / 2;
  for (const side of ['west', 'east', 'north', 'south']) {
    const a =
      side === 'west'
        ? [r.x0, r.z0, r.x0 + t, r.z1]
        : side === 'east'
          ? [r.x1 - t, r.z0, r.x1, r.z1]
          : side === 'north'
            ? [r.x0 + t, r.z0, r.x1 - t, r.z0 + t]
            : [r.x0 + t, r.z1 - t, r.x1 - t, r.z1];
    if (side !== front) {
      box(o, 'earth', ...a, y, top);
      continue;
    }
    if (axis === 'z') {
      box(o, 'earth', a[0], a[1], a[2], mid - w, y, top);
      box(o, 'earth', a[0], mid + w, a[2], a[3], y, top);
      box(o, 'earth', a[0], mid - w, a[2], mid + w, y + P.doorHeight, top);
    } else {
      box(o, 'earth', a[0], a[1], mid - w, a[3], y, top);
      box(o, 'earth', mid + w, a[1], a[2], a[3], y, top);
      box(o, 'earth', mid - w, a[1], mid + w, a[3], y + P.doorHeight, top);
    }
    if (lod >= 1) {
      const a2 = [...a];
      if (axis === 'z') {
        a2[1] = mid - w - 0.1;
        a2[3] = mid + w + 0.1;
      } else {
        a2[0] = mid - w - 0.1;
        a2[2] = mid + w + 0.1;
      }
      box(o, 'timber', ...a2, y + P.doorHeight - 0.02, y + P.doorHeight + 0.17);
    }
  }
  box(o, 'plaster', r.x0 - 0.07, r.z0 - 0.07, r.x1 + 0.07, r.z1 + 0.07, top, top + 0.24);
  if (lod > 0)
    for (const a of [
      [r.x0, r.z0, r.x1, r.z0 + 0.18],
      [r.x0, r.z1 - 0.18, r.x1, r.z1],
      [r.x0, r.z0 + 0.18, r.x0 + 0.18, r.z1 - 0.18],
      [r.x1 - 0.18, r.z0 + 0.18, r.x1, r.z1 - 0.18],
    ])
      box(o, 'earth', ...a, top + 0.24, top + 0.55);
  if (lod >= 2) {
    for (let z = r.z0 + 0.5; z < r.z1 - 0.2; z += 0.8) {
      box(o, 'timber', r.x0 - 0.16, z - 0.055, r.x0 + 0.25, z + 0.055, top - 0.15, top - 0.02);
      box(o, 'timber', r.x1 - 0.25, z - 0.055, r.x1 + 0.16, z + 0.055, top - 0.15, top - 0.02);
    }
  }
  if (lod >= 3) {
    box(o, 'plaster', r.x0 - 0.1, r.z0 - 0.1, r.x1 + 0.1, r.z0 + 0.06, top - 0.08, top);
    box(o, 'plaster', r.x0 - 0.1, r.z1 - 0.06, r.x1 + 0.1, r.z1 + 0.1, top - 0.08, top);
  }
}
export function buildHouse(o, _frame, lod = 3) {
  componentEvidence.length = 0;
  for (const r of P.rooms) room(o, r, lod);
  componentEvidence.push({
    lod,
    wholeAnnex: true,
    estimatedCells: 8,
    estimatedMeetingHalls: 1,
    estimatedCommonRooms: 1,
    actualOpenDoorways: 10,
    roofedRooms: 10,
    terracedPlinths: 10,
    roomFunctionsFromWrittenSource: true,
    layoutAndCensusEstimated: true,
    allImagesUnused: true,
  });
}
export const houseSkyline = (o, f) => buildHouse(o, f, 0),
  houseDistrict = (o, f) => buildHouse(o, f, 1),
  houseStreet = (o, f) => buildHouse(o, f, 2),
  houseCloseup = (o, f) => buildHouse(o, f, 3);
const root = 'content/worldgen/source/places/tw/tw0/fondukistan_monastic_annex',
  camera = [29, 26, 34],
  look = [0, 1, 1];
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
  embeddedCanonicalGraphs: ['earth_adobe', 'plaster_lime', 'earth_rammed', 'wood_plain'],
  qaCameras: [
    { name: 'terraced-cells-common-room-and-meeting-hall', position: camera, lookAt: look },
    { name: 'opposite-complete-annex-and-open-courtyard', position: [-29, 23, -30], lookAt: look },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'whole-annex-' + reviewLod,
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
    'Original deterministic historical structural interpretation under repository license, using written monastic room functions and original estimated dimensions. Every photograph, artwork, diagram and plan image unused. Source texts retain their original authorship; no image license is granted or inferred. Exact cell census, layout, shells, roof sections, finishes, terraced plinths, body placement/facing and700CEappearance are original estimates. No current-world activation.',
};
