import { readFileSync } from 'node:fs';
import {
  areaSign,
  block,
  closed,
  edge,
  face,
  floorSampler,
  mix,
  opening,
  pairs,
  palette,
  panel,
  rect,
  shell,
  surface,
  up,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';

const read = (name) => JSON.parse(readFileSync(new URL('../' + name, import.meta.url)));
const plan = read('plan-controls.json');
const d = plan.dimensions;
const grade = floorSampler(read('terrain-grid.json'));
const c = palette({
  white: 'cfc6ae',
  cream: 'd3c9af',
  beige: 'beb59a',
  sand: 'b3a78c',
  trim: 'd5cab1',
  dark: '57564a',
  sash: '84806b',
  glass: '48524d',
  deck: '827863',
  stone: '8d8269',
  brick: '946b56',
  roof: '817568',
  shingle: '73685e',
  path: 'b9ac8a',
});
const surfaces = {
  siding: surface('wall', 'wood_weatherboard', 0.87),
  wood: surface('trim', 'wood_plain', 0.83),
  roof: surface('roof', 'shingle_cedar', 0.91),
  base: surface('foundation', 'stone_limestone_weathered', 0.93),
  brick: surface('wall', 'brick', 0.93),
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.45 },
};
const bounds = (ring) =>
  [0, 1].flatMap((axis) => {
    const v = ring.map((p) => p[axis]);
    return [Math.min(...v), Math.max(...v)];
  });
const floor = (ring) => {
  const [a, b, p, q] = bounds(ring);
  return grade([(a + b) / 2, (p + q) / 2]) + 0.62;
};

function rectangleWall(x0, x1, z0, z1, direction) {
  const [a, b] = direction;
  return a
    ? edge([a > 0 ? x1 : x0, a > 0 ? z0 : z1], [a > 0 ? x1 : x0, a > 0 ? z1 : z0])
    : edge([b > 0 ? x1 : x0, b > 0 ? z1 : z0], [b > 0 ? x0 : x1, b > 0 ? z1 : z0]);
}
function flashing(out, wall, y, color = c.trim) {
  panel(out, 'wood', wall, 0, wall.length, y - 0.075, y + 0.055, 0.06, color);
}
function useSashes(out, wall, y0, y1, count, level, shutters = false) {
  const set = wall.length / count;
  for (let i = 0; i < count; i++) {
    const center = (i + 0.5) * set;
    const width = Math.min(0.67, set * 0.27);
    const a = center - width,
      b = center + width;
    if (level < 2) {
      panel(out, 'glass', wall, a, b, y0, y1, 0.027, c.glass);
    } else {
      opening(out, wall, a, b, y0, y1, 'wood', c.glass, 'glass', c.trim, level, 0.027);
    }
    if (level >= 2) {
      panel(out, 'wood', wall, a, b, mix(y0, y1, 0.49), mix(y0, y1, 0.49) + 0.07, 0.075, c.trim);
      if (shutters) {
        panel(out, 'wood', wall, a - 0.31, a - 0.065, y0, y1, 0.074, c.dark);
        panel(out, 'wood', wall, b + 0.065, b + 0.31, y0, y1, 0.074, c.dark);
      }
    }
  }
}

function gabled(out, b, eave, ridge, axis, wallColor, level, overhang = 0.34) {
  const [a, b0, p, q] = b;
  const uv = axis === 'z' ? (x, z, y) => [x, y, z] : (x, z, y) => [z, y, x];
  const [u, v, start, end] = axis === 'z' ? b : [p, q, a, b0];
  const middle = (u + v) / 2;
  for (const [z, normal] of [
    [start, -1],
    [end, 1],
  ]) {
    face(
      out,
      'siding',
      [uv(u, z, eave), uv(v, z, eave), uv(middle, z, ridge)],
      axis === 'z' ? [0, 0, normal] : [normal, 0, 0],
      wallColor,
    );
  }
  const pt = (side, z, t, lift = 0) =>
    uv(mix(side, middle, t), z, mix(eave - 0.07, ridge + 0.09, t) + lift);
  for (const side of [u - overhang, v + overhang]) {
    const startLip = start - overhang;
    const endLip = end + overhang;
    face(
      out,
      'roof',
      [pt(side, startLip, 0), pt(side, endLip, 0), pt(side, endLip, 1), pt(side, startLip, 1)],
      up,
      c.roof,
    );
    if (level < 2) continue;
    for (const z of [startLip, endLip - 0.13]) {
      face(
        out,
        'wood',
        [
          pt(side, z, 0, 0.035),
          pt(side, z + 0.13, 0, 0.035),
          pt(side, z + 0.13, 1, 0.035),
          pt(side, z, 1, 0.035),
        ],
        up,
        c.trim,
      );
    }
    if (level === 3) {
      const t = 0.032;
      face(
        out,
        'roof',
        [
          pt(side, startLip, t, 0.019),
          pt(side, endLip, t, 0.019),
          pt(side, endLip, t + 0.006, 0.019),
          pt(side, startLip, t + 0.006, 0.019),
        ],
        up,
        c.shingle,
      );
    }
  }
}

function hipped(out, bounds, eave, peak) {
  const [x0, x1, z0, z1] = bounds;
  const corners = [
    [x0, eave, z0],
    [x1, eave, z0],
    [x1, eave, z1],
    [x0, eave, z1],
  ];
  const center = [(x0 + x1) / 2, peak, (z0 + z1) / 2];
  for (const [a, b] of pairs(closed(corners))) face(out, 'roof', [a, b, center], up, c.shingle);
}
function cabinMass(out, ring, floorY, eave, tint, level) {
  const sign = areaSign(ring);
  for (const [a, b] of pairs(closed(ring))) {
    const w = edge(a, b, sign);
    const bottom = Math.min(floorY - 0.17, grade(a) - 0.25, grade(b) - 0.25);
    panel(out, 'siding', w, 0, w.length, level ? floorY : bottom, eave, 0, tint);
    if (level) panel(out, 'base', w, 0, w.length, bottom, floorY, 0, c.stone);
  }
}
function porch(out, a, b, floorY, canopy, depth, level) {
  const w = edge(a, b);
  const pave = (u, y, v) => w.p(u, y, v);
  face(
    out,
    'wood',
    [
      pave(0, floorY, 0),
      pave(w.length, floorY, 0),
      pave(w.length, floorY, depth),
      pave(0, floorY, depth),
    ],
    up,
    c.deck,
  );
  if (level) panel(out, 'wood', w, 0, w.length, floorY - 0.17, floorY, depth, c.deck);
  face(
    out,
    'roof',
    [
      pave(0, canopy + 0.43, 0),
      pave(w.length, canopy + 0.43, 0),
      pave(w.length, canopy, depth + 0.19),
      pave(0, canopy, depth + 0.19),
    ],
    up,
    c.shingle,
  );
  if (level) panel(out, 'wood', w, 0, w.length, canopy - 0.105, canopy, depth + 0.18, c.trim);
  const count = level === 0 ? 1 : Math.ceil(w.length / (level === 1 ? 4.5 : 2.65));
  for (let i = 0; i <= count; i++) {
    const u = mix(0.18, w.length - 0.18, i / count);
    const [x, , z] = pave(u, floorY, depth - 0.13);
    if (level < 2) {
      panel(out, 'wood', w, u - 0.085, u + 0.085, floorY, canopy, depth - 0.12, c.deck);
      continue;
    }
    const support = Math.min(floorY - 0.1, grade([x, z]) - 0.22);
    block(out, 'base', x - 0.235, support, z - 0.235, 0.47, floorY - support, 0.47, c.stone);
    block(out, 'wood', x - 0.085, floorY, z - 0.085, 0.17, canopy - floorY, 0.17, c.trim);
    if (level >= 2) block(out, 'wood', x - 0.15, canopy - 0.15, z - 0.15, 0.3, 0.12, 0.3, c.sash);
  }
}

function residence(out, ring, i, level) {
  const [x0, x1, z0, z1] = bounds(ring);
  const mid = (x0 + x1) / 2;
  const y = floor(ring);
  const eave = y + (i === 6 ? 4.62 : i === 1 ? 4.32 : 3.78);
  const ridge = eave + (x1 - x0) * 0.34;
  const tint = [c.white, c.cream, c.beige, c.white][i % 4];
  cabinMass(out, ring, y, eave, tint, level);
  gabled(out, [x0, x1, z0, z1], eave, ridge, 'z', tint, level);
  const front = rectangleWall(x0, x1, z0, z1, [0, 1]);
  if (level) useSashes(out, front, y + 1.16, y + 2.74, 3, level);
  if (level >= 1) {
    for (const side of [
      [0, -1],
      [1, 0],
      [-1, 0],
    ]) {
      const wall = rectangleWall(x0, x1, z0, z1, side);
      useSashes(out, wall, y + 1.05, y + 2.68, level === 1 ? 2 : 4, level);
      flashing(out, wall, eave - 0.06);
    }
    const u = front.length / 2;
    opening(
      out,
      front,
      u - 0.55,
      u + 0.55,
      y + 0.02,
      y + 2.1,
      'wood',
      c.dark,
      'glass',
      c.trim,
      level,
      0.046,
    );
    useSashes(
      out,
      { normal: front.normal, p: (p, ht, offset) => front.p(p + u - 1.7, ht, offset), length: 3.4 },
      eave + 0.5,
      eave + 1.87,
      2,
      level,
    );
  }
  porch(out, [x1 - 0.13, z1], [x0 + 0.13, z1], y, eave - 0.42, 2.06, level);
  block(out, 'brick', mid + 0.41, ridge - 0.78, z0 + (z1 - z0) * 0.45, 0.57, 1.88, 0.84, c.brick);
  if (level >= 2) {
    block(
      out,
      'brick',
      mid + 0.34,
      ridge + 1.07,
      z0 + (z1 - z0) * 0.45 - 0.06,
      0.71,
      0.145,
      0.96,
      c.brick,
    );
    block(out, 'base', mid - 1.02, y - 0.36, z1 + 2.03, 2.04, 0.36, 0.56, c.stone);
  }
}

function hospital(out, level) {
  const [x0, x1, z0, z1] = bounds(d.hospital);
  const wardX = 298.04;
  const center = [x0 - 0.18, wardX + 0.66, 30.12, 44.7];
  const y = floor(d.hospital);
  const eave = y + 3.57;
  const top = y + 6.77;
  cabinMass(out, d.hospital, y, eave, c.cream, level);
  const centerRing = rect(center[0], center[2], center[1], center[3]);
  shell(out, centerRing, () => eave, top, {
    wall: 'siding',
    roof: 'siding',
    color: c.white,
    roofColor: c.white,
  });
  const hip = top + 2.15;
  hipped(
    out,
    [center[0] - 0.43, center[1] + 0.46, center[2] - 0.43, center[3] + 0.45],
    top + 0.06,
    hip,
  );
  for (const ward of [
    [x0, wardX, z0, center[2] + 0.5],
    [x0, wardX, center[3] - 0.55, z1],
  ]) {
    gabled(out, ward, eave, eave + 2.42, 'z', c.white, level, 0.51);
    if (level) {
      const w = rectangleWall(...ward, [-1, 0]);
      useSashes(out, w, y + 1.07, y + 2.81, 4, level, true);
    }
  }
  gabled(out, [wardX - 0.17, x1, 32.404, 38.885], eave, eave + 1.8, 'x', c.cream, level);
  const towerX = (center[0] + center[1]) / 2;
  const towerZ = (center[2] + center[3]) / 2;
  const b = [towerX - 1.72, towerX + 1.72, towerZ - 1.69, towerZ + 1.69];
  const belvedere = rect(b[0], b[2], b[1], b[3]);
  const base = hip - 0.68;
  shell(out, belvedere, () => base - 0.12, hip + 2.15, {
    wall: 'wood',
    roof: 'wood',
    color: c.dark,
    roofColor: c.dark,
  });
  hipped(out, [b[0] - 0.37, b[1] + 0.37, b[2] - 0.36, b[3] + 0.36], hip + 2.16, hip + 2.96);
  for (const direction of [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ]) {
    useSashes(
      out,
      rectangleWall(...b, direction),
      base + 0.82,
      hip + 1.98,
      level === 0 ? 1 : 3,
      level,
    );
    if (level >= 1) {
      useSashes(out, rectangleWall(...center, direction), eave + 0.52, top - 0.38, 3, level, true);
    }
  }
  porch(out, [x0, z1], [x0, z0], y, eave - 0.18, 2.52, level);
  porch(out, [x0, z0], [wardX, z0], y, eave - 0.18, 1.8, level);
  porch(out, [wardX, z1], [x0, z1], y, eave - 0.18, 1.8, level);
  for (const z of [center[2] + 1.18, center[3] - 1.15]) {
    block(out, 'brick', towerX + 0.37, hip - 0.94, z, 0.64, 2.17, 0.73, c.brick);
    if (level >= 2)
      block(out, 'brick', towerX + 0.299, hip + 1.22, z - 0.06, 0.79, 0.16, 0.86, c.brick);
  }
}

const barracksRoofSplits = [
  [
    [677, 640, 804, 657],
    [710, 657, 727, 710],
    [745, 657, 763, 710],
  ],
  [
    [858, 645, 982, 660],
    [913, 660, 927, 680],
    [889, 678, 956, 690],
  ],
  [
    [1041, 655, 1165, 670],
    [1041, 670, 1048, 688],
    [1071, 670, 1083, 700],
    [1099, 670, 1110, 702],
    [1156, 670, 1165, 689],
  ],
  [
    [1377, 628, 1504, 645],
    [1435, 645, 1449, 659],
    [1405, 658, 1471, 672],
  ],
];
const surveyPoint = (x, z) => [(x - 1071) * 0.54008, (z - 401) * 0.54008];
function barracks(out, ring, i, level) {
  const y = floor(ring),
    eave = y + 4.05;
  cabinMass(out, ring, y, eave, c.beige, level);
  for (const [part, [x, u, x1, u1]] of barracksRoofSplits[i].entries()) {
    const [a, p] = surveyPoint(x, u),
      [b, q] = surveyPoint(x1, u1);
    gabled(
      out,
      [a, b, p, q],
      eave,
      eave + Math.min(b - a, q - p) * 0.31,
      part === 0 ? 'x' : 'z',
      c.beige,
      level,
      0.38,
    );
    if (part === 0) {
      const wall = rectangleWall(a, b, p, q, [0, -1]);
      useSashes(out, wall, y + 1.15, y + 2.78, level === 0 ? 3 : Math.round((b - a) / 5), level);
      if (level >= 2) {
        const count = Math.round((b - a) / 9);
        for (let k = 1; k < count; k++)
          block(
            out,
            'brick',
            mix(a, b, k / count) - 0.25,
            eave + 1.1,
            (p + q) / 2 - 0.27,
            0.52,
            2.04,
            0.56,
            c.brick,
          );
      }
    }
  }
  if (level === 0) return;
  const sign = areaSign(ring);
  for (const [a, b] of pairs(closed(ring)).slice(1)) {
    const wall = edge(a, b, sign);
    if (wall.length < 4.5) continue;
    useSashes(out, wall, y + 1.06, y + 2.68, Math.max(1, Math.round(wall.length / 6.55)), level);
    flashing(out, wall, eave - 0.075);
  }
}
function surveyTrack(out, level) {
  for (const [a, b] of pairs(closed(d.parade))) {
    const w = edge(a, b, areaSign(d.parade));
    const count = Math.ceil(w.length / (level === 0 ? 62 : 19));
    const position = (t, v) => {
      const [x, , z] = w.p(w.length * t, 0, v);
      return [x, grade([x, z]) + 0.11, z];
    };
    for (let i = 0; i < count; i++) {
      const l = i / count,
        h = (i + 1) / count;
      const [a0, a1, b1, b0] = [position(l, 0), position(l, 3.4), position(h, 3.4), position(h, 0)];
      face(out, 'base', [a0, a1, b1], up, c.path);
      face(out, 'base', [a0, b1, b0], up, c.path);
    }
  }
}
function build(out, level) {
  surveyTrack(out, level);
  d.officers.forEach((row, i) => {
    residence(out, row, i, level);
  });
  hospital(out, level);
  d.barracks.forEach((row, i) => {
    barracks(out, row, i, level);
  });
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);
const recipe = 'fort-custer-montana-model.mjs';
const camera = [616, 248, 465],
  lookAt = [13, 4, 3];
const errors = { district: 0.83, street: 0.31, closeup: 0.1 };
export const fortCusterAsset = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  category: 'palace-castle-fort',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  groundContactBasis:
    'The USGS modern bare-earth height at the center of the parade ground on the historic reservation bluff.',
  brief:
    'The parade ground at historic Fort Custer, with the officers’ residences, hospital with belvedere and four measured barracks.',
  appearance: {
    kind: 'historical',
    representedDate: plan.representedDate,
    validFrom: plan.validFrom,
    validUntil: plan.validUntil,
    currentWorldEligible: false,
  },
  camera,
  lookAt,
  sunDirection: [-125, 210, 105],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: Object.values(surfaces).flatMap((s) => s.graph ?? []),
  recipeDependencies: ['montreal-museum-pavilion-geometry.mjs', 'polygon-triangulation.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-003.PROGRESS.md',
  qaCameras: [
    { name: 'officers-row-porches', position: [187, 11, -72], lookAt: [37, 4, -139] },
    { name: 'hospital-veranda-and-belvedere', position: [226, 11, 78], lookAt: [291, 5, 33] },
    { name: 'parade-and-mapped-barracks', position: [50, 39, 60], lookAt: [-41, 3, 144] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'fort-custer-montana-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 1.45,
    surfaces,
    authoredLevels: Object.fromEntries(
      Object.entries(errors).map(([name, errorMeters]) => [
        name,
        { export: name, errorMeters, surfaces },
      ]),
    ),
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original mesh under repository license. Terrain and archival plan from U.S. federal public-domain sources.',
};
