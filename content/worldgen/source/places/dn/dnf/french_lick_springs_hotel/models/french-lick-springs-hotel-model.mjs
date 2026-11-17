/** The historic hotel wings at French Lick, Indiana. */
import fs from 'node:fs';
import {
  B as box,
  rgb,
} from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';
import {
  profile,
  quad,
} from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (name) => JSON.parse(fs.readFileSync(new URL(`../${name}.json`, import.meta.url)));
const plan = read('plan-controls');
const { outline } = read('map-frame').geometry;
const d = plan.dimensions;
const ref = 'palette:#ffffff';
const c = Object.fromEntries(
  Object.entries({
    yellow: 'c7ac7b',
    mellow: 'c0a677',
    ochre: 'b29a70',
    white: 'ded9c6',
    cream: 'd4ccb2',
    limestone: 'b1aba0',
    sill: 'c3c0ad',
    slate: '86847a',
    glass: '596462',
    sash: 'a8ac9f',
    plinth: '98948a',
    coping: 'b7b3a5',
    tile: 'a4937a',
    eave: 'c9c4b5',
    shadow: '746b58',
  }).map(([key, tint]) => [key, rgb(tint)]),
);
const surfaces = {
  brick: { slot: 'wall', graph: 'brick', roughness: 0.93 },
  stone: { slot: 'wall', graph: 'stone_limestone_raw', roughness: 0.91 },
  trim: { slot: 'trim', localRef: ref, roughness: 0.9 },
  roof: { slot: 'roof', localRef: ref, roughness: 0.94 },
  glass: { slot: 'window', localRef: ref, roughness: 0.66 },
};
const p3 = ([x, z], y) => [x, y, z];
const rect = (x0, z0, x1, z1) => [
  [x0, z0],
  [x1, z0],
  [x1, z1],
  [x0, z1],
];
const pick = (...indices) => indices.map((i) => outline[i]);

function shell(out, slot, ring, low, high, tint, cap = true) {
  const sign = winding(ring);
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length];
    quad(
      out,
      slot,
      [p3(a, low), p3(b, low), p3(b, high), p3(a, high)],
      [sign * (b[1] - a[1]), 0, sign * (a[0] - b[0])],
      tint,
    );
  }
  if (!cap) return;
  const triangles = earcut(ring.flat());
  for (let i = 0; i < triangles.length; i += 3) {
    const points = triangles.slice(i, i + 3).map((j) => ring[j]);
    out.addTriangle(
      'roof',
      ref,
      points.map((p) => p3(p, high)),
      [0, 1, 0],
      points,
      c.slate,
    );
  }
}

function winding(ring) {
  return Math.sign(
    ring.reduce((sum, [x, z], i) => {
      const [nx, nz] = ring[(i + 1) % ring.length];
      return sum + x * nz - nx * z;
    }, 0),
  );
}

function faces(ring) {
  const sign = winding(ring);
  return ring.map(([x, z], i) => {
    const [nx, nz] = ring[(i + 1) % ring.length];
    const dx = nx - x,
      dz = nz - z;
    const span = Math.hypot(dx, dz);
    const normal = [(sign * dz) / span, 0, (-sign * dx) / span];
    const along = (u, y, projection) => [
      x + (dx * u) / span + normal[0] * projection,
      y,
      z + (dz * u) / span + normal[2] * projection,
    ];
    return { span, normal, along, x, z, nx, nz };
  });
}

function panel(out, face, slot, x0, x1, y0, y1, offset, tint) {
  const f = face.along;
  quad(
    out,
    slot,
    [f(x0, y0, offset), f(x1, y0, offset), f(x1, y1, offset), f(x0, y1, offset)],
    face.normal,
    tint,
  );
}

function window(out, face, u, y, w, h, detail, arched = false, spacing = 3.3) {
  const half = w / 2;
  const steps = detail === 3 ? 9 : detail === 2 ? 6 : 3;
  const archRise = arched && detail >= 1 ? half * 0.83 : 0;
  const center = y + h - archRise;
  const net = w + Math.min(0.32, spacing - w);
  const tint = c.glass;
  panel(out, face, 'stone', u - net / 2, u + net / 2, y - 0.1, center + 0.14, 0.028, c.sill);
  panel(out, face, 'glass', u - half, u + half, y, center, 0.062, tint);
  if (archRise) {
    const p = (angle, rise, radius, off) =>
      face.along(u + Math.cos(angle) * radius, center + Math.sin(angle) * rise, off);
    for (let i = 0; i < steps; i++) {
      const a = (i * Math.PI) / steps,
        b = ((i + 1) * Math.PI) / steps;
      out.addTriangle(
        'glass',
        ref,
        [face.along(u, center, 0.062), p(a, archRise, half, 0.062), p(b, archRise, half, 0.062)],
        face.normal,
        [
          [0.5, 0],
          [1, 0],
          [0, 1],
        ],
        tint,
      );
      quad(
        out,
        'stone',
        [
          p(a, archRise, half, 0.063),
          p(a, archRise + 0.14, half + 0.11, 0.1),
          p(b, archRise + 0.14, half + 0.11, 0.1),
          p(b, archRise, half, 0.063),
        ],
        face.normal,
        c.cream,
      );
    }
  }
  if (detail >= 2) {
    panel(
      out,
      face,
      'trim',
      u - half - 0.115,
      u + half + 0.115,
      y - 0.13,
      y - 0.028,
      0.085,
      c.cream,
    );
    panel(out, face, 'trim', u - half, u + half, y + h * 0.52, y + h * 0.52 + 0.07, 0.097, c.sash);
  }
  if (detail >= 3) panel(out, face, 'trim', u - 0.048, u + 0.048, y + 0.02, center, 0.096, c.sash);
}

function courses(out, face, y, roof, detail) {
  const { span } = face;
  if (detail) panel(out, face, 'stone', 0, span, roof - 0.64, roof - 0.22, 0.13, c.eave);
  panel(out, face, 'trim', 0, span, roof - 0.28, roof + 0.08, 0.22, c.white);
  if (detail) {
    panel(out, face, 'stone', 0, span, roof - 1.11, roof - 0.83, 0.065, c.cream);
    panel(out, face, 'trim', 0, span, y + 3.31, y + 3.56, 0.095, c.limestone);
  }
  if (detail < 2) return;
  const count = Math.ceil(span / (detail === 3 ? 0.56 : 1.04));
  const gap = span / count;
  for (let i = 0; i < count; i++) {
    const u = gap * (i + 0.5);
    panel(
      out,
      face,
      'trim',
      u - gap * 0.18,
      u + gap * 0.18,
      roof - 0.48,
      roof - 0.27,
      0.235,
      c.white,
    );
  }
}

function wing(out, ring, floor, roof, storeys, detail, tint, formal = false, main = false) {
  shell(out, 'brick', ring, d.spaRoofY - 0.32, roof, tint);
  for (const face of faces(ring)) {
    if (face.span < 2.4) continue;
    courses(out, face, floor, roof, detail);
    if (!detail && (!formal || face.span < 13 || face.normal[0] < 0.55)) continue;
    const spacing = detail === 0 ? 8.5 : detail === 1 ? 5.8 : detail === 2 ? 4.17 : 3.45;
    const count = Math.max(1, Math.floor(face.span / spacing));
    const levels =
      detail === 0
        ? [storeys - 2]
        : Array.from({ length: storeys }, (_, i) => i).filter(
            (row) => detail > 1 || (formal && row === storeys - 2) || row % 2 === 0,
          );
    const step = (roof - floor - 1.12) / storeys;
    const bay = face.span / count;
    for (const row of levels) {
      const y = floor + 0.57 + row * step;
      if (y + 1.65 < d.spaRoofY - 0.46 && !main) continue;
      const arch = formal && row === storeys - 2;
      for (let i = 0; i < count; i++) {
        const u = (i + 0.5) * bay;
        const width = Math.min(bay * 0.59, detail === 0 ? 2.5 : 1.21);
        const tall = Math.min(step * 0.67, row === 0 ? 2.24 : 1.93);
        window(out, face, u, y, width, tall, detail, arch, bay);
      }
    }
  }
}

// Footprint is exact at the lower envelope. These section breaks follow the written survey
// and the photograph of the main and former bath ranges.
const sections = [
  {
    ring: [[54.1, -5.6], ...pick(10, 9), [71.9, 53.9], [58.7, 56.2], [54.1, 53.9]],
    floor: 2.1,
    roof: d.mainRoofY,
    storeys: 6,
    tint: c.yellow,
    formal: true,
    main: true,
  },
  {
    ring: [
      [53.1, 55.1],
      [70.1, 55.1],
      [73.8, 58.4],
      [73.8, 72.6],
      [70.8, 77.75],
      [56.7, 77.75],
      [53.1, 73.3],
    ],
    floor: 1.8,
    roof: d.mainTowerY,
    storeys: 6,
    tint: c.yellow,
    formal: true,
    main: true,
  },
  {
    ring: [
      [56.1, -30.1],
      [65.42, -29.77],
      [65.55, -5.61],
      [54.75, -5.5],
    ],
    floor: 1.1,
    roof: d.northPassageY,
    storeys: 4,
    tint: c.mellow,
    formal: false,
    main: true,
  },
  {
    ring: [...pick(13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25), [55.5, -32.8]],
    floor: -1.2,
    roof: d.northRoofY,
    storeys: 6,
    tint: c.mellow,
    formal: false,
  },
  {
    ring: [...pick(27, 28, 37, 38), [54.5, 11.37]],
    floor: 4,
    roof: d.westRoofY,
    storeys: 6,
    tint: c.yellow,
    formal: false,
  },
  {
    ring: [...pick(29, 30, 31, 32, 33, 34, 35, 36), [-31.5, 1.6]],
    floor: 4.6,
    roof: d.deluxeRoofY,
    storeys: 6,
    tint: c.mellow,
    formal: false,
  },
];

function wingTowers(out, detail) {
  const crown = d.mainRoofY;
  const towers = [
    {
      r: [
        [60.7, 4.05],
        [71.8, 4.05],
        [74.6, 6.9],
        [74.6, 15.7],
        [72, 18.2],
        [61.6, 18.2],
      ],
      roof: crown + 1.65,
    },
    { r: rect(-12.6, -5.42, 6.2, 3.45), roof: d.westRoofY + 2.2 },
    {
      r: [
        [-42.5, 2.6],
        [-41.3, 4.6],
        [-43.3, 9.8],
        [-46.5, 11.9],
        [-51.1, 8.8],
        [-51.4, 5.25],
      ],
      roof: d.deluxeRoofY + 1.5,
    },
  ];
  for (const t of towers) {
    shell(out, 'brick', t.r, t.roof - 4.3, t.roof, c.ochre);
    for (const face of faces(t.r)) {
      if (face.span < 2) continue;
      panel(out, face, 'trim', 0, face.span, t.roof - 0.4, t.roof + 0.06, 0.14, c.white);
      if (detail) window(out, face, face.span / 2, t.roof - 2.57, 0.88, 1.48, detail, true);
    }
  }
}

function bathhouseAndBase(out, detail) {
  shell(out, 'stone', outline, d.foundationY, d.mainEntryY, c.plinth, false);
  shell(out, 'brick', outline, d.mainEntryY - 0.01, d.spaRoofY, c.yellow);
  const spa = [...pick(0, 1, 2, 3, 4, 5, 6, 7, 8), [53.01, 78.16], ...pick(41, 42, 43)];
  for (const face of faces(spa)) {
    if (face.span < 2.98 || Math.max(face.z, face.nz) < 78.5) continue;
    courses(out, face, d.mainEntryY, d.spaRoofY, detail);
    const count = Math.max(1, Math.floor(face.span / (detail === 0 ? 8.6 : 3.42)));
    const spacing = face.span / count;
    for (let i = 0; i < count; i++) {
      const u = (i + 0.5) * spacing;
      for (const y of detail === 0 ? [5.52] : [2.82, 5.97]) {
        window(out, face, u, y, 1.08, 1.73, detail, false, spacing);
      }
    }
  }
  const crown = [...pick(5, 6, 7), [75.4, 78.24], [75.4, 92.4]];
  shell(out, 'brick', crown, 8.92, 10.88, c.ochre);
  for (const face of faces(crown))
    panel(out, face, 'trim', 0, face.span, 10.65, 10.91, 0.11, c.white);
}

function porch(out, detail) {
  const x = 75.06,
    start = 4.25,
    end = 72.5,
    span = end - start;
  const base = 2.38;
  box(out, 'stone', x, base - 0.54, (start + end) / 2, 5.15, 0.54, span, c.limestone);
  box(out, 'roof', x, 6.48, (start + end) / 2, 5.45, 0.26, span + 0.23, c.eave);
  box(out, 'trim', 77.85, 6.31, (start + end) / 2, 0.35, 0.52, span + 0.2, c.white);
  const count = [9, 14, 21, 24][detail];
  for (let i = 0; i < count; i++) {
    const z = start + (i * span) / (count - 1);
    const xx = 77.47;
    if (detail < 2) {
      box(out, 'trim', xx, base, z, 0.43, 4.14, 0.43, c.white);
      continue;
    }
    profile(
      out,
      [
        [base, 0.26, 0.26],
        [base + 0.19, 0.26, 0.26, 'trim', c.white],
        [base + 0.28, 0.167, 0.167, 'trim', c.white],
        [6.19, 0.14, 0.14, 'trim', c.white],
        [6.43, 0.235, 0.235, 'trim', c.white],
      ],
      detail >= 2 ? 8 : 6,
      [xx, z],
    );
    box(out, 'trim', xx, 6.34, z, 0.56, 0.17, 0.59, c.white);
    if (detail >= 2 && i % 3 === 1) box(out, 'trim', xx - 0.66, base, z, 0.22, 4.1, 0.22, c.white);
  }
  const stairsZ = 19.9,
    length = 9.1;
  for (let step = 0; step < (detail ? 7 : 3); step++) {
    const high = base - step * 0.245;
    box(
      out,
      'stone',
      78.2 + step * 0.46,
      high - 0.3,
      stairsZ,
      0.71,
      0.3,
      length + step * 0.18,
      c.limestone,
    );
  }
  if (detail >= 1) {
    box(out, 'trim', 78.2, 3.12, 47.1, 0.09, 0.14, 48.4, c.white);
    if (detail >= 2)
      for (let z = 25.2; z <= 71.4; z += 1.55)
        box(out, 'trim', 78.2, 2.38, z, 0.12, 0.76, 0.1, c.white);
  }
}

function draw(out, detail) {
  bathhouseAndBase(out, detail);
  for (const section of sections)
    wing(
      out,
      section.ring,
      section.floor,
      section.roof,
      section.storeys,
      detail,
      section.tint,
      section.formal,
      section.main,
    );
  wingTowers(out, detail);
  porch(out, detail);
}
export const skyline = (out) => draw(out, 0);
export const district = (out) => draw(out, 1);
export const street = (out) => draw(out, 2);
export const closeup = (out) => draw(out, 3);

const id = plan.model;
const slug = id.replaceAll('_', '-');
const camera = [299, 116, 218];
const lookAt = [19, 11, 0];
const module = `content/worldgen/source/places/${plan.cell}/${id}/models/${slug}-model.mjs`;
export const model = {
  id,
  title: plan.title,
  key: id,
  cell: plan.cell,
  recipe: `${slug}-model.mjs`,
  surfaces,
  build: closeup,
  wikidataId: plan.wikidataId,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: plan.sectionBasis,
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'French Lick Springs Hotel, with linked buff-brick wings, cornices and tower bays, a long white veranda and the lower former baths.',
  camera,
  lookAt,
  sunDirection: [130, 112, 64],
  recipeDependencies: ['generate-motat-building.mjs', 'polygon-triangulation.mjs'],
  embeddedCanonicalGraphs: ['brick', 'stone_limestone_raw'],
  mediumFiContext: {
    scale: 1,
    cameraYaw: 0.93,
    groundY: 0,
    focus: { center: lookAt },
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  qaCameras: [
    { name: 'hotel-wings-and-lawn', position: [197, 78, 188], lookAt: [8, 12, 7] },
    { name: 'spa-wing-and-annex-tower', position: [141, 12, 141], lookAt: [67, 12.6, 66] },
    { name: 'main-east-veranda-and-windows', position: [130, 13, 2], lookAt: [70, 11.5, 22] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `${slug}-${reviewLod}`,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 2.9,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 1.3, surfaces },
      street: { export: 'street', errorMeters: 0.45, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.13, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceDocuments: plan.requiredSourceDocuments,
  sourceLicense:
    'Original geometry based on the exact public-domain Qualla photograph, written National Register descriptions, native mapped perimeter and original terrain.',
};
