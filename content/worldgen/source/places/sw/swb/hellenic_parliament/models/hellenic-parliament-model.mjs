/** Hellenic Parliament, in the former Royal Palace at Syntagma Square. */
import fs from 'node:fs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';
import {
  box as meshBox,
  profile,
  quad,
} from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (name) => JSON.parse(fs.readFileSync(new URL(`../${name}.json`, import.meta.url)));
const plan = read('plan-controls');
const { outline, courtyards } = read('map-frame').geometry;
const d = plan.dimensions;
const wall = outline.filter((_, i) => ![11, 12, 31, 32].includes(i));
const palette = 'palette:#ffffff';
const c = Object.fromEntries(
  Object.entries({
    ochre: 'cfb689',
    shaded: 'c0a679',
    center: 'd2b88a',
    court: 'cbbb9c',
    ivory: 'ddd2b7',
    marble: 'd2c7b0',
    pale: 'e4d9bd',
    plinth: 'aaa393',
    groove: 'b5a17d',
    roof: '9f988b',
    parapet: 'c8b28c',
    glass: '656d67',
    sash: 'bebbb0',
    shadow: '897653',
    terrace: 'b7b2a6',
  }).map(([name, hex]) => [name, rgb(hex)]),
);
const surfaces = {
  plaster: { slot: 'wall', graph: 'stucco', roughness: 0.95 },
  stone: { slot: 'wall', graph: 'stone_limestone_raw', roughness: 0.91 },
  trim: { slot: 'trim', localRef: palette, roughness: 0.9 },
  roof: { slot: 'roof', localRef: palette, roughness: 0.95 },
  opening: { slot: 'window', localRef: palette, roughness: 0.7 },
};
const box = (out, slot, x0, x1, y0, y1, z0, z1, tint) =>
  meshBox(out, slot, [x0, y0, z0], [x1, y1, z1], tint);
const at = ([x, z], y) => [x, y, z];

function edges(ring, inside = false) {
  const area = ring.reduce((sum, [x, z], i) => {
    const [xx, zz] = ring[(i + 1) % ring.length];
    return sum + x * zz - xx * z;
  }, 0);
  const sign = Math.sign(area) * (inside ? -1 : 1);
  return ring.map(([x, z], i) => {
    const [xx, zz] = ring[(i + 1) % ring.length];
    const dx = xx - x,
      dz = zz - z;
    const len = Math.hypot(dx, dz);
    const nx = (sign * dz) / len,
      nz = (-sign * dx) / len;
    const p = (u, y, a = 0) => [x + (u * dx) / len + nx * a, y, z + (u * dz) / len + nz * a];
    return { len, p, normal: [nx, 0, nz] };
  });
}
function panel(out, face, slot, u0, u1, y0, y1, projection, tint) {
  const p = face.p;
  quad(
    out,
    slot,
    [p(u0, y0, projection), p(u1, y0, projection), p(u1, y1, projection), p(u0, y1, projection)],
    face.normal,
    tint,
  );
}
function band(out, face, u0, u1, y0, y1, depth, tint) {
  const p = face.p;
  panel(out, face, 'trim', u0, u1, y0, y1, depth, tint);
  quad(
    out,
    'trim',
    [p(u0, y1, 0), p(u1, y1, 0), p(u1, y1, depth), p(u0, y1, depth)],
    [0, 1, 0],
    tint,
  );
}
function slab(out, ring, inner, y, tint) {
  let n = ring.length;
  const holes = inner.map((item) => {
    const i = n;
    n += item.length;
    return i;
  });
  const points = [...ring, ...inner.flat()];
  const indices = earcut(points.flat(), holes);
  for (let i = 0; i < indices.length; i += 3) {
    const tri = indices.slice(i, i + 3).map((index) => points[index]);
    out.addTriangle(
      'roof',
      palette,
      tri.map((p) => at(p, y)),
      [0, 1, 0],
      tri,
      tint,
    );
  }
}

function window(out, face, u, y, w, h, level, detail = true) {
  const half = w / 2;
  if (level >= 1) {
    panel(
      out,
      face,
      'stone',
      u - half - 0.17,
      u + half + 0.17,
      y - 0.1,
      y + h + 0.12,
      0.07,
      c.pale,
    );
  }
  panel(out, face, 'opening', u - half, u + half, y, y + h, 0.093, c.glass);
  if (level >= 2 && detail) {
    band(out, face, u - half - 0.26, u + half + 0.26, y - 0.2, y - 0.045, 0.28, c.ivory);
    band(out, face, u - half - 0.21, u + half + 0.21, y + h + 0.04, y + h + 0.17, 0.21, c.marble);
    panel(out, face, 'trim', u - 0.037, u + 0.037, y, y + h, 0.109, c.sash);
    if (level >= 3)
      panel(
        out,
        face,
        'trim',
        u - half,
        u + half,
        y + h * 0.69,
        y + h * 0.69 + 0.045,
        0.112,
        c.sash,
      );
  }
}

function perimeter(out, level) {
  for (const face of edges(wall)) {
    const n = face.len;
    panel(out, face, 'stone', 0, n, d.foundationY, d.baseY, 0, c.plinth);
    panel(out, face, 'plaster', 0, n, d.baseY, d.parapetY, 0, c.ochre);
    if (level === 0)
      panel(out, face, 'trim', 0, n, d.parapetY - 0.52, d.parapetY + 0.02, 0.2, c.pale);
    else band(out, face, 0, n, d.parapetY - 0.55, d.parapetY + 0.02, 0.24, c.pale);
    if (n < 4.2) continue;
    const courses =
      level === 0
        ? [[16.0, 0.29, 0.25]]
        : [
            [8.9, 0.22, 0.17],
            [16.0, 0.29, 0.25],
            [23.85, 0.26, 0.18],
          ];
    for (const [y, height, depth] of courses) {
      band(out, face, 0, n, y, y + height, depth, c.marble);
    }
    const middleWest = face.normal[0] > 0.94 && Math.abs(n - d.westPorticoWidth) < 0.3;
    if (!middleWest) {
      const count = Math.max(1, Math.round(n / (level === 0 ? 8.15 : 5.16)));
      const windows =
        level === 0
          ? [
              [11.14, 3.35],
              [18.28, 3.02],
            ]
          : [
              [4.13, 2.63],
              [11.14, 3.35],
              [18.28, 3.02],
            ];
      for (let i = 0; i < count; i++) {
        const u = ((i + 0.5) * n) / count;
        for (const [y, h] of windows)
          window(out, face, u, y, Math.min(1.78, (n / count) * 0.46), h, level);
      }
    }
    if (level >= 2 && n > 12) {
      const count = Math.floor(n / (level === 3 ? 1.18 : 2.34));
      for (let i = 1; i < count; i++) {
        const u = (i * n) / count;
        panel(out, face, 'trim', u - 0.09, u + 0.09, 24.91, 25.15, 0.17, c.ivory);
      }
    }
  }
  slab(out, wall, courtyards, d.roofY, c.roof);
}

function innerCourts(out, level) {
  for (const ring of courtyards) {
    const y = 5.0;
    slab(out, ring, [], y, c.terrace);
    for (const face of edges(ring, true)) {
      const n = face.len;
      panel(out, face, 'plaster', 0, n, y, d.roofY, 0, c.court);
      if (level === 0 || n < 4) continue;
      band(out, face, 0, n, d.roofY - 0.25, d.roofY + 0.21, 0.14, c.marble);
      const count = Math.round(n / 3.7);
      for (let i = 0; i < count; i++) {
        const u = ((i + 0.5) * n) / count;
        for (const y0 of [6.2, 12.1, 18.24]) {
          window(out, face, u, y0, 1.36, 2.47, level, false);
        }
      }
    }
  }
}

function column(out, x, z, floor, cap, w, level) {
  const r = w / 2;
  if (level === 0) {
    box(out, 'stone', x - r, x + r, floor, cap, z - r, z + r, c.ivory);
    return;
  }
  const h = cap - floor;
  profile(
    out,
    [
      [floor, r * 1.23, r * 1.23],
      [floor + 0.2, r * 1.23, r * 1.23, 'stone', c.marble],
      [floor + 0.32, r, r, 'stone', c.ivory],
      [floor + h * 0.51, r * 0.97, r * 0.97, 'stone', c.ivory],
      [cap - 0.57, r * 0.79, r * 0.79, 'stone', c.ivory],
      [cap - 0.31, r * 1.09, r * 1.09, 'trim', c.pale],
      [cap, r * 1.14, r * 1.14, 'trim', c.pale],
    ],
    [6, 6, 10, 14][level],
    [x, z],
  );
}

function westEntrance(out, level) {
  const x = d.frontFaceX;
  const z = d.westCenterZ;
  const half = d.westPorticoWidth / 2;
  const back = x - 0.18;
  const facade = x + 0.53;
  const edge = d.porticoX;
  const y = d.baseY;
  const top = 9.27;
  box(out, 'plaster', back, facade, y, d.parapetY, z - half, z + half, c.center);
  box(out, 'stone', back, edge + 0.13, y - 0.2, y + 0.2, z - half - 0.2, z + half + 0.2, c.marble);
  box(
    out,
    'stone',
    back,
    edge + 0.09,
    top - 0.69,
    top - 0.15,
    z - half - 0.2,
    z + half + 0.2,
    c.marble,
  );
  box(
    out,
    'trim',
    back,
    edge + 0.31,
    top - 0.16,
    top + 0.29,
    z - half - 0.45,
    z + half + 0.45,
    c.pale,
  );
  for (let i = 0; i < 8; i++) {
    const pos = z - half + 0.95 + (i * (2 * half - 1.9)) / 7;
    column(out, edge - 0.7, pos, y + 0.18, top - 0.67, 1.16, level);
  }
  const face = { p: (u, yy, a = 0) => [facade + a, yy, z + u], normal: [1, 0, 0] };
  for (const center of [-6.96, 0, 6.96]) {
    panel(out, face, 'opening', center - 0.96, center + 0.96, y + 0.22, 7.2, 0.05, c.shadow);
  }
  for (const [floor, height] of [
    [10.68, 3.97],
    [18.25, 4.1],
  ]) {
    for (const u of [-2.05, 0, 2.05]) window(out, face, u, floor, 1.32, height, level);
    for (const u of [-7.1, 7.1]) window(out, face, u, floor, 1.77, height * 0.84, level);
  }
  for (const floor of [9.89, 16.06, 23.84])
    band(out, face, -half, half, floor, floor + 0.3, 0.34, c.pale);
  const base = [facade + 0.21, d.parapetY, z - half];
  const end = [facade + 0.21, d.parapetY, z + half];
  const apex = [facade + 0.21, d.pedimentPeakY, z];
  out.addTriangle(
    'plaster',
    palette,
    [base, end, apex],
    [1, 0, 0],
    [
      [0, 0],
      [1, 0],
      [0.5, 1],
    ],
    c.ochre,
  );
  for (const side of [-1, 1]) {
    const verge = [facade + 0.49, d.parapetY, z + side * (half + 0.16)];
    const peak = [facade + 0.49, d.pedimentPeakY + 0.18, z];
    quad(
      out,
      'trim',
      [verge, peak, [peak[0], peak[1] + 0.22, peak[2]], [verge[0], verge[1] + 0.22, verge[2]]],
      [1, 0, 0],
      c.ivory,
    );
    quad(
      out,
      'roof',
      [verge, [back - 3.1, verge[1], verge[2]], [back - 3.1, peak[1], 0 + z], peak],
      [0, 1, 0],
      c.roof,
    );
  }
  const steps = level >= 1 ? 7 : 3;
  for (let i = 0; i < steps; i++) {
    const t = i / steps;
    box(
      out,
      'stone',
      edge - 0.1,
      edge + 3.14 - t * 3.04,
      -1.45,
      (y * (i + 1)) / steps,
      z - 5.65,
      z + 5.65,
      c.terrace,
    );
  }
  if (level >= 1) {
    box(
      out,
      'trim',
      x - 0.16,
      x - 0.05,
      d.pedimentPeakY,
      d.pedimentPeakY + 5.85,
      z - 0.048,
      z + 0.048,
      c.sash,
    );
  }
}

function secondaryEntrances(out, level) {
  const z = d.westCenterZ;
  box(out, 'stone', -44.3, -39.86, 4.3, 4.62, z - 3.7, z + 3.7, c.marble);
  box(out, 'stone', -44.4, -39.83, 9.25, 10.06, z - 3.78, z + 3.78, c.marble);
  for (let i = 0; i < 6; i++) column(out, -43.52, z - 3.05 + i * 1.22, 4.58, 9.25, 0.81, level);
  box(out, 'opening', -40.32, -40.28, 4.65, 8.64, z - 1.16, z + 1.16, c.shadow);
  const x = -2.13;
  box(out, 'stone', x - 7.15, x + 7.15, 3.55, 4.45, 35.5, 38.52, c.marble);
  box(out, 'stone', x - 7.4, x + 7.4, 10.15, 10.93, 35.43, 38.65, c.pale);
  for (let i = 0; i < 6; i++) column(out, x - 6.1 + i * 2.44, 37.89, 4.35, 10.18, 1.0, level);
  box(out, 'opening', x - 1.32, x + 1.32, 4.5, 8.9, 35.9, 35.94, c.shadow);
}

function draw(out, level) {
  perimeter(out, level);
  innerCourts(out, level);
  westEntrance(out, level);
  secondaryEntrances(out, level);
}
export const skyline = (out) => draw(out, 0);
export const district = (out) => draw(out, 1);
export const street = (out) => draw(out, 2);
export const closeup = (out) => draw(out, 3);
const id = plan.model;
const slug = id.replaceAll('_', '-');
const camera = [127, 69, 106];
const lookAt = [4, 12, -11];
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
    'Hellenic Parliament in Athens, with its ochre neoclassical palace wings, recessed entry doors, Doric porticos and shallow central west pediment.',
  camera,
  lookAt,
  sunDirection: [171, 151, 106],
  recipeDependencies: ['generate-motat-building.mjs', 'polygon-triangulation.mjs'],
  embeddedCanonicalGraphs: ['stucco', 'stone_limestone_raw'],
  mediumFiContext: {
    scale: 1,
    cameraYaw: 0.86,
    groundY: 0,
    focus: { center: lookAt },
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  qaCameras: [
    { name: 'syntagma-and-parliament', position: [108, 46, -91], lookAt: [12, 11, -11] },
    { name: 'west-doric-portico-and-pediment', position: [92, 13, -17], lookAt: [37, 14, -11.2] },
    { name: 'roof-courts-and-north-portico', position: [-14, 83, 105], lookAt: [0, 12, -10] },
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
    errorMeters: 2.0,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.92, surfaces },
      street: { export: 'street', errorMeters: 0.31, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.1, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceDocuments: plan.requiredSourceDocuments,
  sourceLicense:
    'Original model from the exact cleared Qualla originals, the mapped Parliament envelope and the Parliament’s official history, with original local terrain.',
};
