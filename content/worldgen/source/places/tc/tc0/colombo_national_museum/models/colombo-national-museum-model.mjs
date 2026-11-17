/** Colombo's white Italianate museum with open loggias and later gallery wings. */
import fs from 'node:fs';
import {
  beamPath,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  B as box,
  rgb,
} from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';
import { quad } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (name) => JSON.parse(fs.readFileSync(new URL(`../${name}.json`, import.meta.url)));
const plan = read('plan-controls');
const { outline } = read('map-frame').geometry;
const d = plan.dimensions;
const c = Object.fromEntries(
  Object.entries({
    ivory: 'dddace',
    cap: 'e8e2d0',
    stone: 'bdb7a7',
    shadow: 'a39c8f',
    rear: 'c4c2b4',
    foot: 'aaa595',
    roof: '777d78',
    ridge: '95938c',
    glass: '4e5952',
    wood: '5a594b',
    inner: 'b7b4a8',
    darkIron: '676c65',
  }).map(([name, tint]) => [name, rgb(tint)]),
);
const surfaces = {
  wall: { slot: 'wall', graph: 'plaster_lime', roughness: 0.95 },
  trim: { slot: 'trim', graph: 'stone_limestone_raw', roughness: 0.94 },
  base: { slot: 'foundation', graph: 'stone_ashlar', roughness: 0.96 },
  roof: { slot: 'roof', graph: 'metal_corrugated', roughness: 0.91, metallic: 0.05 },
  glass: { slot: 'window', localRef: 'palette:#fffffe', roughness: 0.9 },
  fittings: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.92 },
};
const north = [1, 0, 0];
const south = [-1, 0, 0];
const up = [0, 1, 0];
const front = d.frontFaceX;
const floor = d.frontFloorY;
const upper = d.secondFloorY;
const top = d.frontCorniceY;
const low = d.rearEaveY;

function face(out, slot, points, direction, tint) {
  let normal = normalFor(...points);
  if (normal.reduce((sum, v, i) => sum + v * direction[i], 0) < 0) {
    points = [...points].reverse();
    normal = normalFor(...points);
  }
  if (points.length === 4) quad(out, slot, points, normal, tint);
  else
    out.addTriangle(
      slot,
      'palette:#ffffff',
      points,
      normal,
      [
        [0, 0],
        [1, 0],
        [0.5, 1],
      ],
      tint,
    );
}

function edge([x, z], [nx, nz], sign) {
  const length = Math.hypot(nx - x, nz - z);
  const dx = (nx - x) / length;
  const dz = (nz - z) / length;
  const normal = [sign * dz, 0, -sign * dx];
  return {
    length,
    normal,
    at: (u, y, p = 0) => [x + dx * u + normal[0] * p, y, z + dz * u + normal[2] * p],
  };
}

function frontEdge(x, z0, z1) {
  return edge([x, z0], [x, z1], -1);
}

function surface(out, slot, e, a, b, low, high, p, tint) {
  face(
    out,
    slot,
    [e.at(a, low, p), e.at(b, low, p), e.at(b, high, p), e.at(a, high, p)],
    e.normal,
    tint,
  );
}

function trim(out, e, a, b, y, height, p, color = c.stone) {
  surface(out, 'trim', e, a, b, y, y + height, p, color);
  face(
    out,
    'trim',
    [
      e.at(a, y + height, 0),
      e.at(b, y + height, 0),
      e.at(b, y + height, p),
      e.at(a, y + height, p),
    ],
    up,
    color,
  );
}

function localCap(out, ring, y, color = c.roof) {
  const tris = earcut(ring.flat());
  for (let i = 0; i < tris.length; i += 3)
    face(
      out,
      'roof',
      tris.slice(i, i + 3).map((n) => [ring[n][0], y, ring[n][1]]),
      up,
      color,
    );
}

function arch(center, width, spring, rise, segments) {
  return Array.from({ length: segments + 1 }, (_, i) => {
    const angle = Math.PI * (1 - i / segments);
    return [center + width * Math.cos(angle), spring + rise * Math.sin(angle)];
  });
}

function glazing(out, e, u, w, sill, spring, rise, p, tint, detail) {
  const curve = arch(u, w / 2, spring, rise, [4, 6, 8, 12][detail]);
  surface(out, 'glass', e, u - w / 2, u + w / 2, sill, spring, p - 0.001, tint);
  for (let i = 1; i < curve.length; i++) {
    const [a, b] = [curve[i - 1], curve[i]];
    face(out, 'glass', [e.at(u, spring - 0.003, p), e.at(...a, p), e.at(...b, p)], e.normal, tint);
  }
  if (detail < 2) return;
  surface(out, 'fittings', e, u - 0.05, u + 0.05, sill, spring + rise * 0.85, p + 0.024, c.stone);
  surface(
    out,
    'fittings',
    e,
    u - w / 2,
    u + w / 2,
    spring - 0.04,
    spring + 0.04,
    p + 0.024,
    c.stone,
  );
}

function bay(out, e, range, sill, spring, rise, levelTop, detail, depth = 3.3) {
  const { start, end, width, closed } = range;
  const u = (start + end) / 2;
  const w = width / 2;
  if (detail === 0) {
    surface(out, 'wall', e, start, end, sill - 0.08, levelTop, 0, c.ivory);
    glazing(out, e, u, width, sill, spring, rise, 0.045, c.glass, detail);
    return;
  }
  const curve = arch(u, w, spring, rise, [4, 6, 10, 16][detail]);
  const jambs = [
    [start, u - w],
    [u + w, end],
  ];
  for (const [a, b] of jambs) {
    surface(out, 'wall', e, a, b, sill - 0.08, levelTop, 0, c.ivory);
    if (detail > 0) {
      trim(out, e, a + 0.055, b - 0.055, sill + 0.29, 0.16, 0.095);
      trim(out, e, a + 0.055, b - 0.055, spring - 0.21, 0.145, 0.14, c.cap);
    }
  }
  for (let i = 1; i < curve.length; i++) {
    const [a, b] = [curve[i - 1], curve[i]];
    face(
      out,
      'wall',
      [e.at(...a), e.at(...b), e.at(b[0], levelTop), e.at(a[0], levelTop)],
      e.normal,
      c.ivory,
    );
    if (detail >= 1)
      face(
        out,
        'trim',
        [e.at(...a), e.at(...b), e.at(...b, -0.38), e.at(...a, -0.38)],
        [0, -1, 0],
        c.inner,
      );
  }
  if (detail >= 2) {
    beamPath(
      out,
      'trim',
      curve.map(([u, y]) => e.at(u, y, 0.075)),
      0.18,
      0.14,
      c.cap,
    );
  }
  for (const sign of [-1, 1]) {
    const side = u + sign * w;
    const pos = e.at(side, 0);
    const target = e.at(u, 0).map((v, i) => v - pos[i]);
    face(
      out,
      'wall',
      [
        e.at(side, sill - 0.025),
        e.at(side, spring),
        e.at(side, spring, -0.55),
        e.at(side, sill - 0.025, -0.55),
      ],
      target,
      c.inner,
    );
  }
  if (closed) {
    glazing(out, e, u, width + 0.03, sill, spring, rise, -0.29, c.glass, detail);
  } else {
    surface(out, 'wall', e, u - w - 0.05, u + w + 0.05, sill - 0.05, levelTop, -depth, c.inner);
    glazing(
      out,
      e,
      u,
      width * 0.68,
      sill + 0.11,
      spring - 0.34,
      rise * 0.75,
      -depth + 0.014,
      c.wood,
      detail,
    );
    const tread = [
      e.at(u - w, sill),
      e.at(u + w, sill),
      e.at(u + w, sill, -depth),
      e.at(u - w, sill, -depth),
    ];
    face(out, 'trim', tread, up, c.stone);
  }
}

function run(out, e, detail, columns, { depth = 3.4, closure = [], lowerRise = 1.43 } = {}) {
  const bayWidth = e.length / columns;
  for (let i = 0; i < columns; i++) {
    const start = bayWidth * i;
    const end = start + bayWidth;
    const width = bayWidth * (closure.includes(i) ? 0.49 : 0.72);
    const range = { start, end, width, closed: closure.includes(i) };
    bay(out, e, range, floor, 4.74, lowerRise, upper, detail, depth);
    bay(out, e, range, upper, 10.62, 1.36, top - 0.49, detail, depth);
    if (detail >= 1 && !range.closed) {
      const middle = (start + end) / 2;
      trim(out, e, middle - width / 2, middle + width / 2, upper + 0.94, 0.12, 0.12, c.stone);
      if (detail >= 2)
        for (const fraction of [-0.38, -0.13, 0.13, 0.38]) {
          const u = middle + width * fraction;
          surface(
            out,
            'fittings',
            e,
            u - 0.046,
            u + 0.046,
            upper + 0.05,
            upper + 0.94,
            0.064,
            c.darkIron,
          );
        }
    }
  }
  surface(out, 'base', e, 0, e.length, -1.12, floor - 0.03, -0.03, c.foot);
  trim(out, e, 0, e.length, 6.85, 0.3, 0.28, c.cap);
  trim(out, e, 0, e.length, upper - 0.01, 0.19, 0.17);
  trim(out, e, 0, e.length, top - 0.5, 0.31, 0.34, c.cap);
  trim(out, e, 0, e.length, top - 0.17, 0.2, 0.47, c.cap);
}

function parapet(out, x, a, b, detail) {
  const length = b - a;
  const y = top + 0.035;
  box(out, 'trim', x, y, (a + b) / 2, 0.38, 0.23, length, c.stone);
  box(out, 'trim', x, y + 0.89, (a + b) / 2, 0.42, 0.15, length, c.cap);
  if (detail === 0) {
    box(out, 'wall', x, y + 0.2, (a + b) / 2, 0.27, 0.7, length, c.ivory);
    return;
  }
  const cnt = Math.round(length / (detail === 1 ? 1.33 : 0.67));
  for (let i = 0; i < cnt; i++)
    box(out, 'trim', x, y + 0.22, a + ((i + 0.5) * length) / cnt, 0.26, 0.67, 0.13, c.cap);
}

function pediment(out, x, center, half, high, detail) {
  const frontTriangle = [
    [x, top + 0.12, center - half],
    [x, high, center],
    [x, top + 0.12, center + half],
  ];
  const backTriangle = frontTriangle.map(([x, y, z]) => [x + 1.45, y, z]);
  face(out, 'wall', frontTriangle, south, c.ivory);
  face(out, 'wall', backTriangle, north, c.ivory);
  for (const i of [0, 1])
    face(
      out,
      'roof',
      [frontTriangle[i], frontTriangle[i + 1], backTriangle[i + 1], backTriangle[i]],
      up,
      c.roof,
    );
  beamPath(out, 'trim', frontTriangle, 0.29, 0.39, c.cap, true);
  if (detail >= 2)
    for (let z = center - half + 0.29; z < center + half - 0.1; z += 0.49)
      box(out, 'trim', x - 0.01, top - 0.17, z, 0.32, 0.18, 0.18, c.stone);
}

function historicFront(out, detail) {
  run(out, frontEdge(front, -28.114, -17.94), detail, 2, { closure: [1], depth: 3.3 });
  run(out, frontEdge(front, -17.94, -4.73), detail, 3, { depth: 4.1 });
  run(out, frontEdge(front, 7.23, 19.49), detail, 3, { depth: 4.1 });
  run(out, frontEdge(front, 19.49, 26.73), detail, 2, { closure: [0], depth: 3.3 });
  const x = d.porticoFrontX;
  const z = d.porticoCenterZ;
  const hw = d.porticoWidth / 2;
  run(out, frontEdge(x, z - hw, z + hw), detail, 3, { depth: 6.45 });
  run(out, edge([front, z - hw], [x, z - hw], -1), detail, 1, { depth: 1.6 });
  run(out, edge([x, z + hw], [front, z + hw], -1), detail, 1, { depth: 1.6 });
  box(out, 'wall', (x + front) / 2, top - 0.12, z, front - x, 0.18, d.porticoWidth, c.ivory);
  box(out, 'roof', (x + front) / 2, top + 0.06, z, front - x, 0.37, d.porticoWidth, c.roof);
  pediment(out, x - 0.15, z, hw + 0.2, d.centralPedimentY, detail);
  for (const [center, width] of [
    [-20.48, 3.37],
    [21.07, 3.27],
  ])
    pediment(out, front - 0.17, center, width, 16.22, detail);
  parapet(out, front + 0.06, -27.94, -23.91, detail);
  parapet(out, front + 0.06, -16.84, -4.74, detail);
  parapet(out, front + 0.06, 7.31, 17.69, detail);
  parapet(out, front + 0.06, 24.37, 26.58, detail);
  const stairCount = detail === 0 ? 2 : 5;
  for (let i = 0; i < stairCount; i++) {
    const run = 2.55 - (i * 1.98) / stairCount;
    const stepY = 0.16 + (i + 1) * ((floor - 0.16) / stairCount);
    box(
      out,
      'base',
      x - run / 2,
      -0.55,
      z,
      run,
      0.55 + stepY,
      d.porticoWidth - 0.97,
      i % 2 ? c.stone : c.foot,
    );
  }
}

function museumShell(out, detail) {
  const signed = Math.sign(
    outline.reduce((sum, [x, z], i) => {
      const [nx, nz] = outline[(i + 1) % outline.length];
      return sum + x * nz - nx * z;
    }, 0),
  );
  for (let i = 6; i < outline.length; i++) {
    const a = outline[i];
    const b = outline[(i + 1) % outline.length];
    const e = edge(a, b, signed);
    const frontReturn = i === 6 || i === 24;
    const eaves = frontReturn ? top : low;
    surface(out, 'base', e, 0, e.length, -5.1, floor, 0, c.foot);
    surface(out, 'wall', e, 0, e.length, floor, eaves, 0, frontReturn ? c.ivory : c.rear);
    if (detail > 0 && e.length > 8) {
      trim(out, e, 0, e.length, eaves - 0.32, 0.28, 0.24, c.cap);
      const spacing = frontReturn ? 4.1 : 5.6;
      const cnt = Math.max(1, Math.round(e.length / spacing));
      for (let j = 0; j < cnt; j++) {
        const center = ((j + 0.5) / cnt) * e.length;
        glazing(out, e, center, 1.84, 3.13, 5.83, 0.52, 0.033, c.glass, detail);
        if (frontReturn) glazing(out, e, center, 1.8, 8.52, 10.35, 0.98, 0.038, c.glass, detail);
      }
    }
  }
  const back = [outline[0], outline[6], ...outline.slice(7)];
  localCap(out, back, low, c.roof);
  box(out, 'wall', -33.6, low - 0.035, -0.64, 15.35, top - low + 0.036, 54.58, c.ivory);
  box(out, 'roof', -33.6, top - 0.14, -0.64, 15.4, 0.18, 54.68, c.roof);
}

function hip(out, x0, x1, z0, z1, y, lift, detail) {
  const ridgeZ = (z0 + z1) / 2;
  const setback = Math.min(4, (x1 - x0) * 0.22);
  const ridge = [
    [x0 + setback, y + lift, ridgeZ],
    [x1 - setback, y + lift, ridgeZ],
  ];
  for (const z of [z0, z1])
    face(out, 'roof', [[x0, y, z], [x1, y, z], ridge[1], ridge[0]], up, c.roof);
  face(out, 'roof', [[x0, y, z0], [x0, y, z1], ridge[0]], up, c.roof);
  face(out, 'roof', [[x1, y, z0], [x1, y, z1], ridge[1]], up, c.roof);
  if (detail > 1) beamPath(out, 'roof', ridge, 0.19, 0.24, c.ridge);
  if (detail >= 3) {
    for (let x = x0 + setback + 1.4; x < x1 - setback - 1.1; x += 1.65) {
      for (const z of [z0, z1])
        beamPath(
          out,
          'roof',
          [
            [x, y + 0.055, z],
            [x, y + lift + 0.055, ridgeZ],
          ],
          0.028,
          0.029,
          c.roof,
        );
    }
  }
}

function roofs(out, detail) {
  hip(out, -44.33, -27.11, -27.31, 25.88, top - 0.12, 1.68, detail);
  hip(out, -29.58, 7.05, -41.78, -21.1, low + 0.02, 2.71, detail);
  hip(out, -28.89, 6.64, 21.34, 40.24, low + 0.02, 2.44, detail);
  hip(out, -25.51, 17.05, -20.98, 21.2, low + 0.03, 2.64, detail);
  hip(out, 16.2, 57.58, -40.96, -16.5, low + 0.015, 2.85, detail);
  hip(out, 15.32, 58.03, 16.05, 41.7, low + 0.015, 2.73, detail);
  hip(out, 17.36, 63.44, -16.29, 15.96, low + 0.03, 3.14, detail);
}

function draw(out, detail) {
  museumShell(out, detail);
  historicFront(out, detail);
  roofs(out, detail);
}

export const skyline = (out) => draw(out, 0);
export const district = (out) => draw(out, 1);
export const street = (out) => draw(out, 2);
export const closeup = (out) => draw(out, 3);

const id = plan.model;
const slug = id.replaceAll('_', '-');
const camera = [-128, 45, 91];
const lookAt = [-4, 7.5, 2];
const module = `content/worldgen/source/places/${plan.cell}/${id}/models/${slug}-model.mjs`;

export const model = {
  id,
  title: plan.title,
  key: id,
  cell: plan.cell,
  recipe: `${slug}-model.mjs`,
  surfaces,
  build: closeup,
  wikidataId: 'Q2033487',
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: plan.sectionBasis,
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'The Colombo National Museum has a white Italianate façade with two arcaded levels, a projected central portico, pediments and low linked exhibit wings.',
  camera,
  lookAt,
  sunDirection: [-82, 112, 51],
  recipeDependencies: ['generate-motat-building.mjs', 'polygon-triangulation.mjs'],
  embeddedCanonicalGraphs: [
    'plaster_lime',
    'stone_limestone_raw',
    'stone_ashlar',
    'metal_corrugated',
  ],
  mediumFiContext: {
    scale: 1,
    cameraYaw: -2.1,
    groundY: 0,
    focus: { center: lookAt },
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  qaCameras: [
    {
      name: 'italianate-south-arcades-and-pediments',
      position: [-108, 13.5, 17],
      lookAt: [-44, 8.1, 0],
    },
    { name: 'projected-entry-and-open-loggias', position: [-72, 9.8, -22], lookAt: [-47, 7.9, 1] },
    { name: 'attached-museum-wing-and-grade', position: [99, 63, 73], lookAt: [13, 8.8, 0] },
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
    errorMeters: 1.08,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.39, surfaces },
      street: { export: 'street', errorMeters: 0.155, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.056, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceDocuments: plan.requiredSourceDocuments,
  sourceLicense:
    'Original geometry based on the exact public-domain Qualla photograph, written heritage records, native mapping and original terrain.',
};
