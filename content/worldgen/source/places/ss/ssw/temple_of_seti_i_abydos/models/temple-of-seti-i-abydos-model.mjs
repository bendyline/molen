import { readFileSync } from 'node:fs';
import {
  areaSign,
  at,
  block,
  cap,
  closed,
  edge,
  face,
  floorSampler,
  mix,
  pairs,
  palette,
  panel,
  plane,
  rect,
  ring,
  shell,
  stairs,
  surface,
  up,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';

const read = (file) => JSON.parse(readFileSync(new URL('../' + file, import.meta.url)));
const plan = read('plan-controls.json');
const d = plan.dimensions;
const grade = floorSampler(read('terrain-grid.json'));
const F = d.porticoFloor;
const [left, right] = d.frontX,
  front = d.frontZ,
  mid = d.mainAxis;
const side = F + 6.15,
  top = F + 6.92;
const sandstone = palette({
  ash: 'b2a38a',
  dressed: 'baa88a',
  cream: 'c6b596',
  light: 'cab99b',
  slate: '9b8d76',
  shaded: '9d8a6e',
  dull: 'aa9575',
  rock: '9e8d73',
  shadow: '776955',
  joint: '927e60',
  gravel: 'b6a88e',
});
const surfaces = {
  limestone: surface('wall', 'stone_limestone', 0.96),
  ashlar: surface('foundation', 'stone_ashlar', 0.96),
  sand: surface('wall', 'stone_sandstone_raw', 0.98),
  carved: surface('trim', 'stone_sandstone', 0.97),
  slab: surface('roof', 'stone_limestone_weathered', 0.96),
};

function roofAndSideWalls(out, lod) {
  const ring = d.roof,
    sign = areaSign(ring);
  for (const [[a, b], i] of pairs(closed(ring)).map((pair, i) => [pair, i])) {
    const w = edge(a, b, sign);
    if (a[1] > front - 1.1 && b[1] > front - 1.1) continue;
    const bottom = (p) => Math.min(F - 0.21, grade(p) - 0.36);
    face(
      out,
      'limestone',
      [at(a, bottom(a)), at(b, bottom(b)), at(b, side), at(a, side)],
      w.normal,
      i % 3 === 0 ? sandstone.dressed : sandstone.ash,
    );
    if (lod > 0) {
      panel(out, 'carved', w, 0, w.length, side - 0.33, side - 0.17, 0.043, sandstone.cream);
      if (lod > 1) {
        for (const y of [F + 1.41, F + 2.79, F + 4.16]) {
          panel(out, 'carved', w, 0, w.length, y, y + 0.041, 0.012, sandstone.shaded);
        }
      }
    }
  }

  shell(out, ring, () => side, top, { wall: 'limestone', color: sandstone.cream });
  cap(out, 'slab', ring, top, sandstone.ash);
  cap(out, 'ashlar', ring, F - 0.03, sandstone.dull);

  if (lod > 0) {
    const endx = [-55.0, 48.5];
    for (const z of [
      -102.7, -98.8, -94.9, -91.0, -87.1, -83.2, -79.3, -75.4, -71.5, -67.6, -63.7, -59.8, -55.9,
      -52, -48.1,
    ]) {
      const x = z < -70.0 ? endx[0] : left + 0.58;
      block(
        out,
        'slab',
        x,
        top + 0.014,
        z,
        endx[1] - x,
        0.028,
        lod === 3 ? 0.088 : 0.056,
        sandstone.shaded,
      );
    }
    if (lod > 1) {
      for (const x of [
        -52.18, -46.87, -38.76, -31.3, -23.15, -15.14, -7.41, 4.4, 13.3, 23.5, 31.38, 40.5,
      ]) {
        const z = x < left ? -69.4 : front - 0.42;
        block(out, 'slab', x, top + 0.012, -104.52, 0.082, 0.039, z + 104.52, sandstone.shaded);
      }
    }
  }
}

function reliefPanel(out, w, left, right, base, high, lod) {
  const mid = (left + right) / 2,
    half = (right - left) / 2;
  panel(out, 'carved', w, left + 0.11, right - 0.11, base, high, 0.035, sandstone.dressed);
  if (lod < 2) return;
  const y = base + (high - base) * 0.52;
  for (const s of [-1, 1]) {
    const pos = mid + s * half * 0.43;
    panel(out, 'carved', w, pos - 0.08, pos + 0.08, y - 0.58, y + 0.15, 0.058, sandstone.joint);
    const motive = [
      [pos - 0.13, y + 0.12],
      [pos + 0.12, y + 0.12],
      [pos + 0.066, y + 0.41],
      [pos - 0.066, y + 0.41],
    ];
    face(
      out,
      'carved',
      motive.map(([x, y]) => w.p(x, y, 0.06)),
      w.normal,
      sandstone.shaded,
    );
  }
  if (lod === 3) {
    const n = 9;
    for (let i = 0; i < n; i++) {
      const q = left + ((right - left) * (i + 1)) / (n + 1);
      const low = base + 0.19 + 0.075 * (i % 3);
      panel(out, 'carved', w, q - 0.021, q + 0.021, low, low + 0.2, 0.065, sandstone.shaded);
    }
  }
}

function portico(out, lod) {
  const z = front - 1.43,
    beams = plane(z + 0.72, 1);
  for (let i = 0; i < 12; i++) {
    const x = left + 2.26 + ((right - left - 4.52) * i) / 11,
      radius = 0.88;
    const foot = F + 0.03;
    block(
      out,
      'limestone',
      x - radius,
      foot,
      z - radius,
      2 * radius,
      side - foot,
      2 * radius,
      i % 4 === 0 ? sandstone.light : sandstone.dressed,
    );
    if (lod > 0) {
      block(
        out,
        'ashlar',
        x - radius - 0.081,
        F - 0.035,
        z - radius - 0.1,
        1.922,
        0.27,
        1.96,
        sandstone.ash,
      );
      panel(
        out,
        'carved',
        beams,
        x - radius,
        x + radius,
        side - 0.25,
        side - 0.1,
        0.166,
        sandstone.cream,
      );
      if (lod > 1)
        reliefPanel(out, plane(z + radius, 1), x - radius, x + radius, F + 0.84, F + 3.64, lod);
    }
  }
  const ceil = plane(front + 0.08, 1);
  panel(
    out,
    'limestone',
    ceil,
    left - 0.24,
    right + 0.21,
    side,
    side + 0.67,
    0.02,
    sandstone.cream,
  );
  if (lod > 0)
    panel(
      out,
      'carved',
      ceil,
      left - 0.14,
      right + 0.11,
      side + 0.42,
      side + 0.49,
      0.043,
      sandstone.shaded,
    );
  const rear = front - 7.54,
    doorway = 2.02;
  const y = F + 0.03;
  block(
    out,
    'limestone',
    left - 0.19,
    y,
    rear,
    mid - doorway - left + 0.19,
    side - y,
    1.17,
    sandstone.shaded,
  );
  block(
    out,
    'limestone',
    mid + doorway,
    y,
    rear,
    right - mid - doorway,
    side - y,
    1.17,
    sandstone.ash,
  );
  block(
    out,
    'carved',
    mid - doorway,
    F + 4.18,
    rear,
    2 * doorway,
    side - F - 4.18,
    1.38,
    sandstone.dressed,
  );
  const wall = plane(rear + 1.18, 1);
  for (const u of [
    left + 3.65,
    left + 10.35,
    left + 17.35,
    right - 17.2,
    right - 10.43,
    right - 3.82,
  ]) {
    panel(out, 'carved', wall, u - 1.48, u + 1.48, y + 0.16, y + 3.78, 0.025, sandstone.slate);
    if (lod > 1) reliefPanel(out, wall, u - 1.21, u + 1.21, y + 1.16, y + 3.51, lod);
  }
  if (lod > 0) {
    const threshold = rect(mid - doorway - 0.22, rear - 2.68, mid + doorway + 0.22, rear + 1.34);
    shell(out, threshold, () => F - 0.09, F + 0.12, { wall: 'ashlar', color: sandstone.ash });
    cap(out, 'ashlar', threshold, F + 0.12, sandstone.cream);
  }
}

function hypostyleHalls(out, lod) {
  if (lod === 0) return;
  const rowX = [-2.86, 1.67, 6.13, 10.74, 15.23, 19.63, 24.26, 28.77, 33.24, 37.78, 42.33, 46.82];
  for (const [j, z] of d.innerRows.entries()) {
    if (lod === 1 && j >= 2) continue;
    const bottom = F + (j > 1 ? 0.32 : 0.16),
      radius = j > 1 ? 0.7 : 0.79;
    for (const [i, x] of rowX.entries()) {
      const n = lod === 3 ? 12 : 8,
        tone = i % 3 === 0 ? sandstone.cream : sandstone.dressed;
      ring(
        out,
        'limestone',
        [x, z],
        [
          [bottom, radius + 0.18],
          [bottom + 0.21, radius + 0.16],
          [bottom + 0.23, radius],
          [side - 1.02, radius * 0.92],
          [side - 0.43, radius + 0.2],
          [side - 0.05, radius + 0.23],
        ],
        n,
        tone,
      );
      if (lod > 1)
        block(
          out,
          'carved',
          x - radius - 0.18,
          side - 0.25,
          z - radius - 0.18,
          2 * radius + 0.36,
          0.28,
          2 * radius + 0.36,
          sandstone.light,
        );
    }
  }
  const chapelWidth = (right - left) / 7;
  for (let i = 0; i < 8; i++) {
    const x = left + chapelWidth * i;
    block(
      out,
      'limestone',
      x - 0.38,
      F + 0.22,
      -98.72,
      0.76,
      side - F - 0.37,
      16.89,
      sandstone.ash,
    );
  }
  const chamberBack = plane(-98.79, 1);
  for (let i = 0; i < 7; i++) {
    const x = left + (i + 0.5) * chapelWidth;
    panel(
      out,
      'carved',
      chamberBack,
      x - 2.17,
      x + 2.17,
      F + 1.38,
      F + 4.96,
      0.062,
      sandstone.dressed,
    );
  }
}

function blockAndRubble(out, x, z, width, length, height, variation, lod) {
  const y = grade([x, z]),
    r = rect(x - width / 2, z - length / 2, x + width / 2, z + length / 2);
  const bound = r.map(([a, b], i) => [
    a + 0.13 * Math.sin(i + variation),
    b + 0.14 * Math.cos(i + variation),
  ]);
  const h = y + height;
  shell(out, bound, (p) => Math.min(h - 0.09, grade(p) - 0.09), h, {
    wall: 'sand',
    color: variation % 3 === 0 ? sandstone.ash : sandstone.rock,
  });
  cap(out, 'sand', bound, h, sandstone.dressed);
  if (lod > 1 && width > 2.6 && height > 0.73) {
    const w = edge(bound[2], bound[3], 1);
    panel(
      out,
      'carved',
      w,
      0,
      w.length,
      y + height * 0.53,
      y + height * 0.53 + 0.042,
      0.011,
      sandstone.joint,
    );
  }
}

function courtCourse(out, a, b, centre, width, course, lod) {
  const n = lod === 0 ? 4 : lod === 1 ? 7 : 10;
  for (let i = 0; i < n; i++) {
    const w = (b - a) / n,
      q = (i + 0.5) / n,
      x = mix(a, b, q),
      variation = 0.48 + 0.51 * Math.pow(Math.sin(q * 17 + course), 2);
    if (i % 4 === 3 && width > 1.5) continue;
    blockAndRubble(
      out,
      x,
      centre,
      w * (i % 3 === 0 ? 0.77 : 0.94),
      width,
      variation * (course % 2 === 0 ? 0.83 : 1.3),
      i + course,
      lod,
    );
  }
}

function forecourts(out, lod) {
  stairs(
    out,
    grade,
    'ashlar',
    mid - 4.32,
    mid + 4.32,
    -38.19,
    front + 0.19,
    F + 0.08,
    lod === 0 ? 3 : 6,
    sandstone.cream,
  );
  const fore = rect(left - 0.95, front - 0.16, right + 0.42, front + 0.61);
  shell(out, fore, (p) => Math.min(F - 0.09, grade(p) - 0.27), F + 0.025, {
    wall: 'ashlar',
    color: sandstone.dressed,
  });
  cap(out, 'ashlar', fore, F + 0.025, sandstone.ash);

  const [a, b, c] = d.priestsCourts;
  for (const [z, zone, width] of [
    [a + 1.3, 1, 1.69],
    [b - 1.05, 3, 2.2],
    [c - 4.5, 4, 1.3],
  ]) {
    courtCourse(out, left - 0.61, mid - 5.9, z, width, zone, lod);
    courtCourse(out, mid + 5.9, right, z, width, zone + 1, lod);
  }
  for (const [x, offset] of [
    [left - 0.55, 0],
    [right + 0.24, 1],
  ]) {
    const steps = lod === 0 ? 6 : lod === 1 ? 9 : 15;
    for (let i = 0; i < steps; i++) {
      if (i % 7 === 6) continue;
      const p = (i + 0.5) / steps,
        z = mix(a + 2, c - 4, p);
      const height = 0.33 + 0.62 * Math.pow(Math.sin(p * 23 + offset), 2);
      blockAndRubble(
        out,
        x + 0.11 * Math.sin(i),
        z,
        1.19,
        (mix(a + 2, c - 4, 1) / steps) * 0.64,
        height,
        i + offset,
        lod,
      );
    }
  }
  if (lod > 0) {
    const centre = [mid, -22, mid, 39];
    for (let i = 0; i < (lod === 1 ? 7 : 14); i++) {
      const count = lod === 1 ? 7 : 14,
        p0 = mix(centre[1], centre[3], i / count),
        p1 = mix(centre[1], centre[3], (i + 1) / count) - 0.11;
      const outline = rect(mid - 2.45, p0, mid + 2.45, p1);
      face(
        out,
        'ashlar',
        outline.map((p) => at(p, grade(p) + 0.052)),
        up,
        sandstone.gravel,
      );
    }
    for (const [i, [x, z, s]] of [
      [-1.4, 18.6, 1.35],
      [2.8, -20.7, 1.6],
      [37.46, -26.57, 1.6],
      [7.26, 24.97, 0.83],
      [36.48, 6.27, 1.18],
      [11.05, -17.76, 0.95],
      [39.19, -18.16, 0.79],
      [-0.83, -13.7, 1.2],
      [7.87, -30.06, 0.92],
      [36.4, 29.1, 1.27],
      [6.94, 2.95, 0.8],
    ].entries()) {
      blockAndRubble(out, x, z, s * 1.22, s * 0.87, s * 0.69, i, lod);
    }
  }
}

function build(out, lod) {
  roofAndSideWalls(out, lod);
  portico(out, lod);
  hypostyleHalls(out, lod);
  forecourts(out, lod);
}
export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'temple-of-seti-i-abydos-model.mjs';
const camera = [94, 54, 45],
  lookAt = [3, 2.9, -43];
export const abydosTempleModel = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'religious',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'approximate-visualization',
  groundContactBasis:
    'The surviving limestone portico contacts the independent original court field. The mapped roof and original enclosure establish the axis.',
  brief:
    'The standing Temple of Seti I at Abydos, with its limestone row of twelve piers, L-shaped roof, two interior columned halls and ruined forecourts.',
  camera,
  lookAt,
  sunDirection: [-52, 44, 77],
  mediumFiContext: {
    scale: 1,
    groundY: -2.1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: d.roof,
    minimumCoverage: 0.92,
    basis: 'The exact standing temple and south wing footprint supplies the replacement outline.',
  },
  embeddedCanonicalGraphs: Object.values(surfaces).map((s) => s.graph),
  recipeDependencies: ['montreal-museum-pavilion-geometry.mjs', 'polygon-triangulation.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-003.PROGRESS.md',
  qaCameras: [
    { name: 'surviving-portico-from-second-court', position: [14, 14, 40], lookAt: [21, 3, -49] },
    { name: 'limestone-piers-and-ruined-steps', position: [27, 5, -6], lookAt: [21, 3, -43] },
    { name: 'l-shaped-roof-and-courts', position: [138, 105, -22], lookAt: [0, 1, -34] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'abydos-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.89,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.49, surfaces },
      street: { export: 'street', errorMeters: 0.24, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.06, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original mesh under the repository license. Chapultepec’s Qualla photograph and Bell’s 1915 print are public domain. Native map data © OpenStreetMap contributors, ODbL 1.0.',
};
