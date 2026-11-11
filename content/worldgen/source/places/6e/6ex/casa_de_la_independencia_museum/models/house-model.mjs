/** The restored colonial house at Presidente Franco and 14 de Mayo in Asunción. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import fs from 'node:fs';
import { normalFor } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';

const plan = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url)));
export const surfaces = {
  wash: { slot: 'wall', graph: 'plaster_lime', roughness: 0.94, metallic: 0 },
  tile: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.9, metallic: 0 },
  brick: { slot: 'foundation', graph: 'brick', roughness: 0.92, metallic: 0 },
  timber: { slot: 'trim', graph: 'wood_plain', roughness: 0.86, metallic: 0 },
  iron: { slot: 'trim', graph: 'metal_painted', roughness: 0.72, metallic: 0.18 },
  recess: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.89, metallic: 0 },
};
const colors = {
  wash: rgb('e9e7db'),
  tile: rgb('a76a40'),
  brick: rgb('986747'),
  timber: rgb('453c2c'),
  iron: rgb('30322d'),
  recess: rgb('222621'),
};
const [eastCorner, westCorner, westBack, eastBack, eastBend] = plan.nativeRing;
const mainFront = eastCorner[1];
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const xAt = (a, b, z) => mix(a, b, (z - a[1]) / (b[1] - a[1]))[0];
const westAt = (z) => [xAt(westCorner, westBack, z), z];
const eastAt = (z) => [
  z <= eastBend[1] ? xAt(eastCorner, eastBend, z) : xAt(eastBend, eastBack, z),
  z,
];
const v = ([x, z], y) => [x, y, z];

function face(mesh, surface, points, outward, tint = colors[surface]) {
  let normal = normalFor(...points);
  if (normal.reduce((dot, value, axis) => dot + value * outward[axis], 0) < 0) {
    points = [...points].reverse();
    normal = normalFor(...points);
  }
  mesh.addConvexPolygon(surface, 'palette:#ffffff', points, normal, ([x, y]) => [x, y], tint);
}
function prism(mesh, surface, ring, low, high, tint) {
  const winding =
    ring.reduce((a, [x, z], i) => {
      const [nextX, nextZ] = ring[(i + 1) % ring.length];
      return a + x * nextZ - z * nextX;
    }, 0) > 0
      ? 1
      : -1;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length];
    face(
      mesh,
      surface,
      [v(a, low), v(b, low), v(b, high), v(a, high)],
      [(b[1] - a[1]) * winding, 0, (a[0] - b[0]) * winding],
      tint,
    );
  }
  face(
    mesh,
    surface,
    ring.map((p) => v(p, low)),
    [0, -1, 0],
    tint,
  );
  face(
    mesh,
    surface,
    ring.map((p) => v(p, high)),
    [0, 1, 0],
    tint,
  );
}
function rect(mesh, surface, left, front, right, back, low, high, tint) {
  prism(
    mesh,
    surface,
    [
      [left, front],
      [right, front],
      [right, back],
      [left, back],
    ],
    low,
    high,
    tint,
  );
}
function shell(mesh, ring, floor, eave) {
  prism(mesh, 'brick', ring, plan.foundationBottom, floor, rgb('c6bfb0'));
  prism(mesh, 'wash', ring, floor, eave);
}
function gable(mesh, ring, eave, ridge, lod, withEaves = true) {
  const [a, b, c, d] = ring;
  const ends = [mix(a, d, 0.49), mix(b, c, 0.49)];
  for (const [p, q, mid] of [
    [a, d, ends[0]],
    [b, c, ends[1]],
  ]) {
    face(mesh, 'wash', [v(p, eave), v(q, eave), v(mid, ridge - 0.03)], [p === a ? -1 : 1, 0, 0]);
  }
  const extend = (p, x, z) => [p[0] + x, p[1] + z];
  const overhang = withEaves ? 0.35 : 0.22;
  const eaves = [
    [extend(a, -overhang, -0.42), extend(b, overhang, -0.42)],
    [extend(d, -overhang, 0.42), extend(c, overhang, 0.42)],
  ];
  const peak = [extend(ends[0], -overhang, 0), extend(ends[1], overhang, 0)];
  for (const [p, q] of eaves) {
    face(mesh, 'tile', [v(p, eave), v(q, eave), v(peak[1], ridge), v(peak[0], ridge)], [0, 1, 0]);
    face(
      mesh,
      'timber',
      [v(p, eave - 0.11), v(q, eave - 0.11), v(peak[1], ridge - 0.14), v(peak[0], ridge - 0.14)],
      [0, -1, 0],
    );
    face(
      mesh,
      'tile',
      [v(p, eave - 0.11), v(q, eave - 0.11), v(q, eave), v(p, eave)],
      [0, 0, p === eaves[0][0] ? -1 : 1],
    );
    if (!lod) continue;
    const span = Math.hypot(q[0] - p[0], q[1] - p[1]);
    const rows = Math.round(span / [1, 0.72, 0.46, 0.34][lod]);
    const half = [0, 0.115, 0.086, 0.067][lod] / span;
    for (let row = 0; row < rows; row++) {
      const t = (row + 0.5) / rows;
      const left = t - half,
        right = t + half;
      const crest = 0.085;
      for (const [u, w, h0, h1] of [
        [left, t, 0, crest],
        [t, right, crest, 0],
      ]) {
        face(
          mesh,
          'tile',
          [
            v(mix(p, q, u), eave + h0),
            v(mix(p, q, w), eave + h1),
            v(mix(...peak, w), ridge + h1),
            v(mix(...peak, u), ridge + h0),
          ],
          [0, 1, 0],
          row % 5 === 0 ? rgb('9b5b37') : rgb('b27546'),
        );
      }
    }
  }
}

// The same trim profile is used along the long street face and across the gable end.
function wall(a, b) {
  const width = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const normal = [(b[1] - a[1]) / width, 0, (a[0] - b[0]) / width];
  const point = (u, y, offset = 0) => {
    const [x, z] = mix(a, b, u / width);
    return [x + normal[0] * offset, y, z + normal[2] * offset];
  };
  return { point, normal, width };
}
function trim(mesh, side, surface, left, bottom, right, top, offset, depth = 0.045) {
  const near = [
    [left, bottom],
    [right, bottom],
    [right, top],
    [left, top],
  ].map(([u, y]) => side.point(u, y, offset));
  const far = [
    [left, bottom],
    [right, bottom],
    [right, top],
    [left, top],
  ].map(([u, y]) => side.point(u, y, offset + depth));
  face(mesh, surface, far, side.normal);
  const dx = side.normal[2],
    dz = -side.normal[0];
  const normals = [
    [0, -1, 0],
    [-dx, 0, -dz],
    [0, 1, 0],
    [dx, 0, dz],
  ];
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    face(mesh, surface, [near[i], near[j], far[j], far[i]], normals[i]);
  }
}
function archProfile(width, rise, segments) {
  return Array.from({ length: segments + 1 }, (_, i) => {
    const t = (Math.PI * i) / segments;
    return [(-Math.cos(t) * width) / 2, Math.sin(t) * rise];
  });
}
function opening(mesh, side, center, bottom, width, shoulder, door, lod) {
  const curve = archProfile(width, width * 0.13, lod < 2 ? 6 : 10);
  const arch = curve.map(([x, y]) => side.point(center + x, shoulder + y, 0.018));
  face(
    mesh,
    'recess',
    [
      side.point(center - width / 2, bottom, 0.018),
      side.point(center + width / 2, bottom, 0.018),
      ...arch.reverse(),
    ],
    side.normal,
  );
  if (!door)
    trim(
      mesh,
      side,
      'wash',
      center - width / 2 - 0.17,
      bottom - 0.15,
      center + width / 2 + 0.17,
      bottom,
      0.035,
      0.15,
    );
  if (!lod) return;
  for (let i = 1; i < curve.length; i++) {
    const [[ax, ay], [bx, by]] = curve.slice(i - 1, i + 1);
    const over = door ? 0.35 : 0.31;
    face(
      mesh,
      'wash',
      [
        side.point(center + ax * 1.4, shoulder + ay + over, 0.09),
        side.point(center + bx * 1.4, shoulder + by + over, 0.09),
        side.point(center + bx * 1.4, shoulder + by + over + 0.12, 0.09),
        side.point(center + ax * 1.4, shoulder + ay + over + 0.12, 0.09),
      ],
      side.normal,
      rgb('dedace'),
    );
  }
  if (door) {
    trim(
      mesh,
      side,
      'timber',
      center - width * 0.41,
      bottom,
      center - width * 0.37,
      shoulder,
      0.024,
    );
    trim(
      mesh,
      side,
      'timber',
      center + width * 0.37,
      bottom,
      center + width * 0.41,
      shoulder,
      0.024,
    );
  } else {
    const bars = lod > 1 ? [-0.32, -0.16, 0, 0.16, 0.32] : [-0.26, 0, 0.26];
    for (const fraction of bars) {
      const u = center + width * fraction;
      trim(mesh, side, 'iron', u - 0.021, bottom, u + 0.021, shoulder + 0.035, 0.083, 0.027);
    }
    for (const fraction of [0.32, 0.72]) {
      const y = bottom + (shoulder - bottom) * fraction;
      trim(mesh, side, 'iron', center - width / 2, y, center + width / 2, y + 0.045, 0.092, 0.033);
    }
  }
}
function streetSteps(mesh, center, low, width, sideApproach = false) {
  const levels = Math.ceil((plan.frontFloor - low) / 0.17);
  for (let i = 0; i < levels; i++) {
    const run = 0.31 * (levels - i);
    const y = low + ((i + 1) / levels) * (plan.frontFloor - low);
    if (sideApproach) {
      rect(
        mesh,
        'brick',
        center - run,
        mainFront - 1.1,
        center + 0.1,
        mainFront + 0.04,
        plan.foundationBottom,
        y,
      );
    } else {
      rect(
        mesh,
        'brick',
        center - width / 2,
        mainFront - run,
        center + width / 2,
        mainFront + 0.03,
        plan.foundationBottom,
        y,
      );
    }
  }
}
function courtGateway(mesh, lod) {
  const start = plan.frontRearEdge,
    end = eastBack[1],
    center = plan.gatewayCenter;
  const shoulder = 2.99,
    rise = 0.32,
    width = 2.18,
    eave = 3.58;
  const section = (z) => [eastAt(z), [eastAt(z)[0] - 0.49, z]];
  const span = (lo, hi) => [section(lo)[1], section(lo)[0], section(hi)[0], section(hi)[1]];
  for (const [lo, hi] of [
    [start, center - width / 2],
    [center + width / 2, eastBend[1]],
    [eastBend[1], end],
  ]) {
    prism(mesh, 'wash', span(lo, hi), plan.foundationBottom, eave);
  }
  const arch = archProfile(width, rise, lod > 1 ? 12 : 6);
  for (let i = 1; i < arch.length; i++) {
    const [[u0, h0], [u1, h1]] = arch.slice(i - 1, i + 1);
    const [a, b] = section(center + u0),
      [c, d] = section(center + u1);
    const y0 = shoulder + h0,
      y1 = shoulder + h1;
    face(mesh, 'wash', [v(a, y0), v(c, y1), v(c, eave), v(a, eave)], [1, 0, 0]);
    face(mesh, 'wash', [v(b, y0), v(d, y1), v(d, eave), v(b, eave)], [-1, 0, 0]);
    face(mesh, 'wash', [v(a, y0), v(c, y1), v(d, y1), v(b, y0)], [0, -1, 0]);
  }
  prism(
    mesh,
    'brick',
    span(center - width / 2, center + width / 2),
    plan.foundationBottom,
    plan.gatewaySill,
  );
  const pitch = (z, offset, y) => [eastAt(z)[0] + offset, y, z];
  for (const [lo, hi] of [
    [start, eastBend[1]],
    [eastBend[1], end],
  ]) {
    face(
      mesh,
      'tile',
      [
        pitch(lo, 0.34, eave),
        pitch(hi, 0.34, eave),
        pitch(hi, -0.18, eave + 0.34),
        pitch(lo, -0.18, eave + 0.34),
      ],
      [0, 1, 0],
    );
    face(
      mesh,
      'tile',
      [
        pitch(lo, -0.71, eave),
        pitch(hi, -0.71, eave),
        pitch(hi, -0.18, eave + 0.34),
        pitch(lo, -0.18, eave + 0.34),
      ],
      [0, 1, 0],
    );
  }
}

export function buildHouse(mesh, _frame, lod = 3) {
  const frontBackWest = westAt(plan.frontRearEdge),
    frontBackEast = eastAt(plan.frontRearEdge);
  const front = [westCorner, eastCorner, frontBackEast, frontBackWest];
  const rear = [westAt(plan.rearFrontEdge), eastAt(plan.rearFrontEdge), eastBack, westBack];
  shell(mesh, front, plan.frontFloor, plan.mainEave);
  shell(mesh, rear, plan.rearFloor, plan.backEave);
  gable(mesh, front, plan.mainEave, plan.mainRidge, lod);
  gable(mesh, rear, plan.backEave, plan.backRidge, lod, false);
  const franco = wall(westCorner, eastCorner);
  const side = wall(eastCorner, frontBackEast);
  for (const [x, door] of [
    [-10.15, false],
    [-5.9, false],
    [-1.5, true],
    [3.1, false],
    [7.7, true],
  ]) {
    opening(
      mesh,
      franco,
      x - westCorner[0],
      plan.frontFloor + (door ? 0.01 : 0.55),
      door ? 1.59 : 1.37,
      plan.frontFloor + (door ? 2.56 : 2.46),
      door,
      lod,
    );
  }
  for (const u of [3.3, 6.5])
    opening(mesh, side, u, plan.frontFloor + 0.5, 1.21, plan.frontFloor + 2.32, false, lod);
  rect(
    mesh,
    'wash',
    westCorner[0] + 0.28,
    mainFront - 0.7,
    eastCorner[0] - 0.62,
    mainFront + 0.035,
    plan.foundationBottom,
    plan.frontFloor,
  );
  streetSteps(mesh, -1.5, -0.08, 1.78);
  streetSteps(mesh, 7.08, 0.34, 0, true);

  courtGateway(mesh, lod);
  const westWall = [
    frontBackWest,
    [frontBackWest[0] + 0.37, frontBackWest[1]],
    [rear[0][0] + 0.37, rear[0][1]],
    rear[0],
  ];
  prism(mesh, 'wash', westWall, plan.foundationBottom, 2.82);
  const galleryFront = plan.rearFrontEdge - 2.2;
  const left = rear[0][0] + 0.8,
    right = rear[1][0] - 1;
  rect(
    mesh,
    'brick',
    left,
    galleryFront,
    right,
    plan.rearFrontEdge,
    plan.foundationBottom,
    plan.rearFloor,
  );
  face(
    mesh,
    'tile',
    [
      [left, 3.53, galleryFront],
      [right, 3.53, galleryFront],
      [right, 4.05, plan.rearFrontEdge + 0.16],
      [left, 4.05, plan.rearFrontEdge + 0.16],
    ],
    [0, 1, 0],
  );
  for (const t of [0.04, 0.27, 0.5, 0.73, 0.96]) {
    const x = left + (right - left) * t;
    rect(
      mesh,
      'timber',
      x - 0.115,
      galleryFront + 0.21,
      x + 0.115,
      galleryFront + 0.44,
      plan.rearFloor,
      3.66,
    );
  }
}
export const houseSkyline = (mesh, frame) => buildHouse(mesh, frame, 0);
export const houseDistrict = (mesh, frame) => buildHouse(mesh, frame, 1);
export const houseStreet = (mesh, frame) => buildHouse(mesh, frame, 2);
export const houseCloseup = (mesh, frame) => buildHouse(mesh, frame, 3);
const camera = [38, 21, -45];
const lookAt = [0, 2.9, 0];
const modelPath = 'content/worldgen/source/places/6e/6ex/casa_de_la_independencia_museum';
export const houseModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  recipe: 'house-model.mjs',
  surfaces,
  build: buildHouse,
  category: 'landmark',
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'Whitewashed colonial corner house with raised street entries, rounded window hoods, red tile roofs, a central garden court, and the 14 de Mayo gateway.',
  appearance: {
    kind: 'historical',
    representedDate: plan.representedDate,
    validFrom: plan.validFrom,
    validUntil: plan.validUntil,
    currentWorldEligible: false,
  },
  camera,
  lookAt,
  portableGroundY: 0,
  mediumFiContext: {
    scale: 1,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: ['plaster_lime', 'tile_ceramic', 'brick', 'wood_plain', 'metal_painted'],
  qaCameras: [
    { name: 'presidente-franco-and-14-de-mayo', position: [26, 7, -35], lookAt: [-0.5, 2.9, -12] },
    { name: 'gateway-and-open-garden-court', position: [29, 18, 23], lookAt: [2, 2.9, 6] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'whole-house-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: modelPath + '/models/house-model.mjs',
    level: 'skyline',
    export: 'houseSkyline',
    errorMeters: 0.19,
    surfaces,
    authoredLevels: {
      district: { export: 'houseDistrict', errorMeters: 0.12, surfaces },
      street: { export: 'houseStreet', errorMeters: 0.06, surfaces },
      closeup: { export: 'houseCloseup', errorMeters: 0.025, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original deterministic geometry under the repository license. Exact published Qualla exterior photographs by Mil va and Fernando Boccia are public domain under their creator dedications. The map is attributed to OpenStreetMap contributors under ODbL.',
};
