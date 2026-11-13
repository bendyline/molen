/** The July 2021 Sri Kurmanathaswamy Temple shrine and its courtyard ranges. */
import fs from 'node:fs';
import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import {
  beam,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  B as box,
  cleanRing,
  rgb,
} from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { quad } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (name) => JSON.parse(fs.readFileSync(new URL(`../${name}.json`, import.meta.url)));
const plan = read('plan-controls'),
  frame = read('map-frame');
const [outline] = frame.geometry.polygons,
  [courtOutline] = frame.geometry.holes;
const outer = cleanRing(outline),
  court = cleanRing(courtOutline);
const {
  foundationBottom,
  courtFloor,
  rangeSoffit,
  rangeTop,
  sanctum,
  hall,
  secondaryShrines,
  gate,
  flagstaff,
} = plan.section;
const surfaces = {
  sandstone: { slot: 'wall', graph: 'stone_sandstone_raw', roughness: 0.93, metallic: 0 },
  limestone: { slot: 'trim', graph: 'stone_limestone_weathered', roughness: 0.94, metallic: 0 },
  paving: { slot: 'roof', graph: 'stone_granite', roughness: 0.96, metallic: 0 },
  bronze: { slot: 'trim', graph: 'metal_bronze_cast', roughness: 0.75, metallic: 0.43 },
  detail: { slot: 'window', localRef: 'palette:#fffdfe', roughness: 0.83, metallic: 0 },
};
const colors = Object.fromEntries(
  Object.entries({
    outer: 'b29378',
    peach: 'c09c8b',
    court: 'b4a693',
    trim: 'c6b28e',
    ledge: '9f8f73',
    roof: 'a29783',
    base: '8f7d6d',
    gold: 'b09346',
    flag: '927542',
    shade: '67554a',
    sanctum: 'b09769',
    carved: 'bba37a',
    frieze: '9f885f',
    darkRed: 'a36a57',
    door: '574a3c',
  }).map(([k, v]) => [k, rgb(v)]),
);
const white = 'palette:#ffffff';
const area = (ring) =>
  ring.reduce((sum, p, i) => {
    const q = ring[(i + 1) % ring.length];
    return sum + p[0] * q[1] - p[1] * q[0];
  }, 0);
function face(out, slot, points, expected, tint) {
  let n = normalFor(...points);
  if (n.reduce((sum, value, i) => sum + value * expected[i], 0) < 0) {
    points = [...points].reverse();
    n = normalFor(...points);
  }
  if (points.length === 4) quad(out, slot, points, n, tint);
  else
    out.addTriangle(
      slot,
      white,
      points,
      n,
      [
        [0, 0],
        [1, 0],
        [0.5, 1],
      ],
      tint,
    );
}
function edge(a, b, sign = 1) {
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const dx = (b[0] - a[0]) / length,
    dz = (b[1] - a[1]) / length;
  const n = [dz * sign, 0, -dx * sign];
  return {
    length,
    n,
    point: (u, y, p = 0) => [a[0] + u * dx + p * n[0], y, a[1] + u * dz + p * n[2]],
  };
}
function edges(ring) {
  const sign = Math.sign(area(ring));
  return ring.map((p, i) => edge(p, ring[(i + 1) % ring.length], sign));
}
function panel(out, slot, e, a, b, bottom, top, p, tint) {
  face(
    out,
    slot,
    [e.point(a, bottom, p), e.point(b, bottom, p), e.point(b, top, p), e.point(a, top, p)],
    e.n,
    tint,
  );
}

function deck(out, ring, holes, height, slot, tint) {
  const mesh = new MeshBufferBuilder();
  if (
    !mesh.addCap(
      slot,
      white,
      ring,
      holes,
      () => height,
      [0, 1, 0],
      (p) => p,
      tint,
    )
  )
    throw Error('Could not triangulate the temple precinct and courtyard');
  const { indices, positions } = mesh.finalize();
  for (let i = 0; i < indices.length; i += 3) {
    const tri = Array.from(indices.slice(i, i + 3), (j) =>
      Array.from(positions.slice(j * 3, j * 3 + 3)),
    );
    face(out, slot, tri, [0, 1, 0], tint);
  }
}
function profile(out, slot, x, z, bands, n, tint) {
  const rings = bands.map(([y, r]) =>
    Array.from({ length: n }, (_, i) => {
      const t = (2 * Math.PI * i) / n;
      return [x + r * Math.cos(t), y, z + r * Math.sin(t)];
    }),
  );
  for (let j = 1; j < rings.length; j++)
    for (let i = 0; i < n; i++) {
      const k = (i + 1) % n,
        a = rings[j - 1],
        b = rings[j];
      face(
        out,
        slot,
        [a[i], a[k], b[k], b[i]],
        [a[i][0] + a[k][0] - 2 * x, 0, a[i][2] + a[k][2] - 2 * z],
        tint,
      );
    }
  const last = rings.at(-1);
  for (let i = 0; i < n; i++)
    face(out, slot, [[x, last[0][1], z], last[i], last[(i + 1) % n]], [0, 1, 0], tint);
}
function column(out, x, z, lod) {
  if (lod === 0) {
    box(out, 'sandstone', x, courtFloor, z, 0.51, rangeSoffit - courtFloor, 0.52, colors.trim);
    return;
  }
  box(out, 'sandstone', x, courtFloor, z, 0.73, 0.27, 0.73, colors.base);
  const detail = lod >= 2;
  const bands = detail
    ? [
        [courtFloor + 0.23, 0.34],
        [courtFloor + 0.38, 0.34],
        [courtFloor + 0.44, 0.24],
        [courtFloor + 0.89, 0.24],
        [courtFloor + 0.98, 0.3],
        [courtFloor + 1.18, 0.28],
        [courtFloor + 1.29, 0.235],
        [rangeSoffit - 0.64, 0.235],
        [rangeSoffit - 0.54, 0.32],
        [rangeSoffit - 0.34, 0.3],
        [rangeSoffit - 0.22, 0.41],
      ]
    : [
        [courtFloor + 0.27, 0.29],
        [courtFloor + 0.45, 0.23],
        [rangeSoffit - 0.56, 0.23],
        [rangeSoffit - 0.28, 0.39],
      ];
  profile(out, 'sandstone', x, z, bands, detail ? 8 : 4, colors.carved);
  box(out, 'limestone', x, rangeSoffit - 0.28, z, 0.9, 0.28, 0.87, colors.trim);
}
function precinct(out, lod) {
  deck(out, outer, [court], rangeTop, 'paving', colors.roof);
  deck(out, court, [], courtFloor, 'paving', colors.court);
  for (const e of edges(outer)) {
    const [x, , z] = e.point(e.length / 2, 0);
    const isGate = Math.abs(x - gate.x) < 0.4 && Math.abs(z - gate.z) < 0.12;
    const spans = isGate
      ? [
          [0, (e.length - gate.width) / 2],
          [(e.length + gate.width) / 2, e.length],
        ]
      : [[0, e.length]];
    if (isGate)
      panel(out, 'sandstone', e, spans[0][1], spans[1][0], gate.head, rangeTop, 0, colors.outer);
    for (const [a, b] of spans) {
      panel(out, 'sandstone', e, a, b, foundationBottom, rangeTop, 0, colors.peach);
      panel(out, 'sandstone', e, a, b, foundationBottom, courtFloor + 0.35, 0.065, colors.base);
    }
    panel(out, 'limestone', e, 0, e.length, rangeTop - 0.31, rangeTop + 0.08, 0.155, colors.ledge);
    if (lod) {
      panel(
        out,
        'limestone',
        e,
        0,
        e.length,
        rangeSoffit - 0.58,
        rangeSoffit - 0.38,
        0.06,
        colors.trim,
      );
      const bays = Math.max(1, Math.round(e.length / (lod >= 2 ? 2.68 : 3.9)));
      for (let i = 0; i < bays; i++) {
        const u = (e.length * (i + 0.5)) / bays;
        if (isGate && Math.abs(u - e.length / 2) < gate.width / 2 + 0.2) continue;
        panel(
          out,
          'limestone',
          e,
          u - 0.22,
          u + 0.22,
          courtFloor + 0.37,
          rangeSoffit - 0.51,
          0.105,
          colors.trim,
        );
        if (lod >= 2) {
          panel(
            out,
            'sandstone',
            e,
            u - 0.34,
            u + 0.34,
            courtFloor + 0.31,
            courtFloor + 0.56,
            0.16,
            colors.ledge,
          );
          panel(
            out,
            'limestone',
            e,
            u - 0.34,
            u + 0.34,
            rangeSoffit - 0.82,
            rangeSoffit - 0.48,
            0.16,
            colors.trim,
          );
        }
      }
    }
  }
  const sign = -Math.sign(area(court));
  for (let i = 0; i < court.length; i++) {
    const e = edge(court[i], court[(i + 1) % court.length], sign),
      [x, , z] = e.point(e.length / 2, 0);
    const attached = x > 0.7 && x < 20.0 && z > -6.02 && z < 9.36;
    panel(out, 'limestone', e, 0, e.length, rangeSoffit - 0.23, rangeTop, 0.04, colors.ledge);
    if (attached) {
      panel(out, 'sandstone', e, 0, e.length, courtFloor, rangeSoffit, 0, colors.outer);
      continue;
    }
    if (lod)
      panel(
        out,
        'sandstone',
        e,
        0,
        e.length,
        courtFloor - 0.03,
        courtFloor + 0.33,
        -0.045,
        colors.darkRed,
      );
    if (e.length < (lod ? 1.15 : 2.6)) continue;
    const count = Math.max(1, Math.round(e.length / (lod >= 2 ? 2.25 : lod === 1 ? 3.4 : 8.6)));
    for (let j = 0; j < count; j++) {
      const [px, , pz] = e.point((e.length * (j + 0.5)) / count, 0, -0.19);
      column(out, px, pz, lod);
    }
  }
}
const rect = ([a, b, c, d]) => [
  [a, c],
  [b, c],
  [b, d],
  [a, d],
];
const buildingBounds = ({ x, z, width, depth }) => [
  x - width / 2,
  x + width / 2,
  z - depth / 2,
  z + depth / 2,
];
function block(out, slot, bounds, base, top, tint) {
  const [a, b, c, d] = bounds;
  box(out, slot, (a + b) / 2, base, (c + d) / 2, b - a, top - base, d - c, tint);
}
function edgeCourse(out, e, y, height, depth, tint) {
  panel(out, 'limestone', e, 0, e.length, y, y + height, depth, tint);
}
function carvedWall(out, bounds, base, eaves, lod, temple = false) {
  block(out, 'sandstone', bounds, base, eaves, temple ? colors.sanctum : colors.outer);
  const [a, b, c, d] = bounds;
  block(
    out,
    'limestone',
    [a - 0.33, b + 0.33, c - 0.33, d + 0.33],
    base,
    base + 0.36,
    colors.ledge,
  );
  block(
    out,
    'sandstone',
    [a - 0.2, b + 0.2, c - 0.2, d + 0.2],
    base + 0.36,
    base + 0.59,
    colors.carved,
  );
  for (const e of edges(rect(bounds))) {
    edgeCourse(out, e, eaves - 0.41, 0.28, 0.16, colors.trim);
    if (!lod) continue;
    edgeCourse(out, e, base + 0.75, 0.23, 0.075, colors.ledge);
    edgeCourse(out, e, eaves - 0.79, 0.19, 0.075, colors.ledge);
    const bays = Math.max(2, Math.round(e.length / (lod >= 2 ? 1.85 : 2.8)));
    for (let i = 0; i < bays; i++) {
      const u = (e.length * (i + 0.5)) / bays,
        w = Math.min(0.86, (e.length / bays) * 0.49);
      const low = base + 1.14,
        head = eaves - 1.38;
      panel(out, 'detail', e, u - w / 2, u + w / 2, low, head, 0.038, colors.shade);
      panel(
        out,
        'limestone',
        e,
        u - w / 2 - 0.15,
        u + w / 2 + 0.15,
        head - 0.04,
        head + 0.26,
        0.105,
        colors.trim,
      );
      if (lod >= 2) {
        const [x, , z] = e.point(u, 0, 0.102);
        box(
          out,
          'sandstone',
          x,
          low + 0.23,
          z,
          0.31,
          Math.min(1.36, head - low - 0.35),
          0.31,
          colors.carved,
        );
        for (const side of [-1, 1]) {
          const p = u + side * (w / 2 + 0.1);
          panel(out, 'limestone', e, p - 0.059, p + 0.059, low - 0.12, head, 0.11, colors.carved);
        }
      }
    }
  }
}

function tierRelief(out, bounds, bottom, top, lod) {
  const height = top - bottom;
  for (const e of edges(rect(bounds))) {
    const count = Math.max(1, Math.round(e.length / (lod >= 2 ? 1.11 : 1.8)));
    for (let i = 0; i < count; i++) {
      const u = (e.length * (i + 0.5)) / count,
        w = Math.min(0.75, (e.length / count) * 0.65);
      panel(
        out,
        'limestone',
        e,
        u - w / 2,
        u + w / 2,
        bottom + 0.12 * height,
        top - 0.24 * height,
        0.053,
        colors.trim,
      );
      const crown = [
        [u - w / 2, top - 0.27 * height],
        [u + w / 2, top - 0.27 * height],
        [u, top - 0.04 * height],
      ].map(([u, y]) => e.point(u, y, 0.078));
      face(out, 'limestone', crown, e.n, colors.carved);
      if (lod >= 2) {
        panel(
          out,
          'detail',
          e,
          u - w * 0.25,
          u + w * 0.25,
          bottom + 0.17 * height,
          top - 0.33 * height,
          0.078,
          colors.frieze,
        );
        panel(
          out,
          'sandstone',
          e,
          u - w * 0.13,
          u + w * 0.13,
          bottom + 0.19 * height,
          top - 0.42 * height,
          0.096,
          colors.sanctum,
        );
        if (lod === 3)
          for (const side of [-1, 1])
            panel(
              out,
              'limestone',
              e,
              u + side * w * 0.39 - 0.027,
              u + side * w * 0.39 + 0.027,
              bottom + 0.13 * height,
              top - 0.3 * height,
              0.097,
              colors.trim,
            );
      }
    }
  }
}
function tieredShrine(out, shape, lod, main = false) {
  const { x, z, width, depth, eaves, top } = shape;
  const stackHeight = top - eaves,
    n = main ? 6 : lod ? 3 : 2;
  for (let i = 0; i < n; i++) {
    const y = eaves + (stackHeight * 0.75 * i) / n,
      height = (stackHeight * 0.75) / n;
    const scale = 1 - i * (main ? 0.102 : 0.174),
      w = width * scale,
      d = depth * scale;
    const bounds = [x - w / 2, x + w / 2, z - d / 2, z + d / 2];
    block(out, 'sandstone', bounds, y, y + height, colors.sanctum);
    if (lod)
      block(
        out,
        'limestone',
        [bounds[0] - 0.17, bounds[1] + 0.17, bounds[2] - 0.17, bounds[3] + 0.17],
        y + height * 0.7,
        y + height * 0.91,
        colors.carved,
      );
    if (lod) {
      block(
        out,
        'sandstone',
        [bounds[0] - 0.092, bounds[1] + 0.092, bounds[2] - 0.092, bounds[3] + 0.092],
        y + height * 0.89,
        y + height * 0.98,
        colors.frieze,
      );
      if (main || lod >= 2) tierRelief(out, bounds, y, y + height * 0.72, lod);
    }
  }
  const base = eaves + stackHeight * 0.75,
    r = width * (main ? 0.223 : 0.185);
  const segments = lod >= 2 ? 16 : lod ? 8 : 5;
  profile(
    out,
    'sandstone',
    x,
    z,
    [
      [base, r],
      [base + stackHeight * 0.062, r * 0.91],
      [base + stackHeight * 0.125, r * 0.62],
    ],
    segments,
    colors.carved,
  );
  if (main && lod)
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4,
        dx = Math.cos(a),
        dz = Math.sin(a);
      profile(
        out,
        'limestone',
        x + r * 0.73 * dx,
        z + r * 0.73 * dz,
        [
          [base + 0.02, r * 0.235],
          [base + stackHeight * 0.082, r * 0.17],
          [base + stackHeight * 0.115, r * 0.06],
        ],
        lod >= 2 ? 8 : 4,
        colors.trim,
      );
    }
  profile(
    out,
    'bronze',
    x,
    z,
    [
      [base + stackHeight * 0.115, r * 0.42],
      [base + stackHeight * 0.174, r * 0.34],
      [base + stackHeight * 0.193, r * 0.15],
      [top, r * 0.065],
    ],
    lod >= 2 ? 12 : lod ? 6 : 4,
    colors.gold,
  );
}
function shrine(out, lod) {
  carvedWall(out, buildingBounds(sanctum), sanctum.base, sanctum.eaves, lod, true);
  carvedWall(out, hall.bounds, hall.plinth, hall.eaves, lod);
  const [a, b, c, d] = hall.bounds;
  const x = (a + b) / 2;
  for (const edgeX of [a, b]) {
    const n = edgeX === a ? -1 : 1;
    face(
      out,
      'sandstone',
      [
        [edgeX, hall.eaves, c],
        [edgeX, hall.eaves, d],
        [x, hall.ridge, d],
        [x, hall.ridge, c],
      ],
      [0, 1, 0],
      colors.trim,
    );
    face(
      out,
      'sandstone',
      [
        [a, hall.eaves, n < 0 ? c : d],
        [b, hall.eaves, n < 0 ? c : d],
        [x, hall.ridge, n < 0 ? c : d],
      ],
      [0, 0, n],
      colors.carved,
    );
  }
  tieredShrine(out, sanctum, lod, true);
  for (const shape of secondaryShrines) tieredShrine(out, shape, lod);
  const f = flagstaff,
    y = courtFloor;
  box(out, 'limestone', f.x, y, f.z, 2.36, 0.32, 2.25, colors.ledge);
  box(out, 'sandstone', f.x, y + 0.32, f.z, 1.89, 0.85, 1.78, colors.sanctum);
  profile(
    out,
    'bronze',
    f.x,
    f.z,
    [
      [y + 1.14, 0.31],
      [y + 1.7, 0.25],
      [f.top - 0.22, 0.119],
      [f.top, 0.19],
    ],
    lod >= 2 ? 12 : 6,
    colors.flag,
  );
  if (lod >= 2)
    for (let i = 0; i < 11; i++) {
      const h = y + 1.89 + i * 0.88;
      profile(
        out,
        'bronze',
        f.x,
        f.z,
        [
          [h, 0.234 - 0.008 * i],
          [h + 0.07, 0.234 - 0.008 * i],
        ],
        8,
        colors.gold,
      );
    }
}
function entrance(out, lod) {
  const { x, z, width, head, top } = gate;
  const y = courtFloor,
    left = x - width / 2,
    right = x + width / 2;
  for (const px of [left - 0.36, right + 0.36]) {
    box(out, 'sandstone', px, y, z + 0.05, 0.71, head - y + 0.15, 1.23, colors.trim);
    if (lod) box(out, 'limestone', px, head - 0.33, z + 0.05, 0.88, 0.31, 1.34, colors.carved);
  }
  box(out, 'limestone', x, head - 0.02, z + 0.02, width + 1.81, 0.32, 1.45, colors.trim);
  const low = -0.63,
    count = lod >= 1 ? 3 : 2;
  for (let i = 0; i < count; i++) {
    const d = 0.31 + 0.48 * i,
      h = y - (0.52 * i) / count;
    box(out, 'sandstone', x, low, z + d / 2, width + 0.24, h - low, d, colors.ledge);
  }
  tieredShrine(out, { x, z: z - 0.81, width: 6.78, depth: 3.03, eaves: rangeTop, top }, lod);
}
function buildLevel(out, lod) {
  precinct(out, lod);
  shrine(out, lod);
  entrance(out, lod);
}
export const srikurmamSkyline = (out) => buildLevel(out, 0);
export const srikurmamDistrict = (out) => buildLevel(out, 1);
export const srikurmamStreet = (out) => buildLevel(out, 2);
export const srikurmamCloseup = (out) => buildLevel(out, 3);

const recipe = 'srikurmam-temple-model.mjs',
  camera = [-49, 32, 53],
  lookAt = [1, 5.6, 0];
const authoredLevels = Object.fromEntries(
  [
    ['district', 'srikurmamDistrict', 0.28],
    ['street', 'srikurmamStreet', 0.09],
    ['closeup', 'srikurmamCloseup', 0.038],
  ].map(([name, entry, errorMeters]) => [name, { export: entry, errorMeters, surfaces }]),
);
export const srikurmamTempleModel = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  title: plan.title,
  wikidataId: plan.wikidataId,
  recipe,
  surfaces,
  build: srikurmamCloseup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'The July 2021 Sri Kurmanathaswamy Temple in Srikurmam with a carved stone sanctum tower, brass flagstaff, connected halls and an open courtyard inside the roofed precinct.',
  appearance: {
    kind: 'historical',
    representedDate: plan.representedDate,
    validFrom: plan.validFrom,
    validUntil: plan.validUntil,
    currentWorldEligible: false,
  },
  camera,
  lookAt,
  buildingCutout: {
    outline,
    minimumCoverage: 0.93,
    basis:
      'The original outer precinct ring of relation 5943168. Its separate inner ring determines the open court in the model.',
  },
  mediumFiContext: {
    scale: 0.9,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: [
    'stone_sandstone_raw',
    'stone_limestone_weathered',
    'stone_granite',
    'metal_bronze_cast',
  ],
  qaCameras: [
    { name: 'sanctum-and-gilded-crown', position: [-19, 11, -19], lookAt: [5, 7.7, 0] },
    { name: 'precinct-and-open-courtyard', position: [-31, 43, -26], lookAt: [1, 5.3, 0] },
    { name: 'south-entrance-and-stone-courses', position: [-18, 10, 36], lookAt: [-1, 4.7, 14] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `whole-srikurmam-temple-${reviewLod}`,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `content/worldgen/source/places/${plan.cell}/${plan.model}/models/${recipe}`,
    level: 'skyline',
    export: 'srikurmamSkyline',
    errorMeters: 0.56,
    surfaces,
    authoredLevels,
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original deterministic geometry under the repository license. OpenStreetMap ODbL 1.0 footprint and exact CC0 originals by G.N. Subrahmanyam.',
};
