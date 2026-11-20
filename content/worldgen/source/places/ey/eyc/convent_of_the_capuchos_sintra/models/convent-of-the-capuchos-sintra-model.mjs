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
  planarMid,
  ring,
  shell,
  surface,
  trimBlock,
  up,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';
import triangulate from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';

const read = (file) => JSON.parse(readFileSync(new URL('../' + file, import.meta.url)));
const plan = read('plan-controls.json');
const d = plan.dimensions;
const grade = floorSampler(read('terrain-grid.json'));

const tone = palette({
  granite: '969083',
  mortar: 'a39a88',
  rock: '858275',
  highRock: '9e9b89',
  moss: '757863',
  stone: '9e988b',
  paved: 'b8ae99',
  ridge: 'a56c56',
  roof: '8b5142',
  roofLight: 'a1624e',
  lime: 'b8b1a0',
  cork: '95826a',
  wood: '594837',
  dark: '393b31',
  water: '61736e',
});
const surfaces = {
  stone: surface('wall', 'stone_granite', 0.97),
  ashlar: surface('foundation', 'stone_ashlar', 0.96),
  roof: surface('roof', 'tile_ceramic', 0.93),
  plaster: surface('trim', 'plaster_lime', 0.94),
  wood: surface('trim', 'wood_plain', 0.94),
  water: surface('window', 'window_grid', 0.36),
};

function clip(points, axis, cut, keep) {
  const out = [];
  for (const [a, b] of pairs(closed(points))) {
    const insideA = keep * (a[axis] - cut) >= 0;
    const insideB = keep * (b[axis] - cut) >= 0;
    if (insideA) out.push(a);
    if (insideA !== insideB) {
      const t = (cut - a[axis]) / (b[axis] - a[axis]);
      if (t > 0.000001 && t < 0.999999) out.push(a.map((v, i) => mix(v, b[i], t)));
    }
  }
  return out;
}

const rooms = [
  { range: [-10.5, -3.0], eave: 2.13, ridgeX: 0.7, roofWidth: 6.9, rise: 1.2 },
  { range: [-3.0, 3.2], eave: 2.54, ridgeX: 1.25, roofWidth: 6.7, rise: 0.94 },
  { range: [3.2, 9.45], eave: 3.27, ridgeX: 1.0, roofWidth: 8.8, rise: 1.27 },
  { range: [9.45, 15.3], eave: 4.03, ridgeX: -3.45, roofWidth: 7.3, rise: 1.02 },
  { range: [15.3, 20.3], eave: 5.2, ridgeX: -6.6, roofWidth: 6.2, rise: 1.1 },
];
const height = ({ ridgeX, eave, roofWidth, rise }, [x]) =>
  eave + rise * Math.max(0, 1 - Math.abs(x - ridgeX) / roofWidth);

function tiledRidge(out, outline, profile) {
  const triangles = triangulate(outline.flat());
  for (let i = 0; i < triangles.length; i += 3) {
    const tri = triangles.slice(i, i + 3).map((i) => outline[i]);
    const zBand = clip(clip(tri, 1, profile.range[0], 1), 1, profile.range[1], -1);
    if (zBand.length < 3) continue;
    for (const side of [-1, 1]) {
      const section = clip(zBand, 0, profile.ridgeX, side);
      if (section.length < 3) continue;
      const xyz = section.map((p) => at(p, height(profile, p)));
      const polygonArea = Math.abs(
        pairs(closed(section)).reduce((s, [[a, b], [c, d]]) => s + a * d - b * c, 0),
      );
      if (polygonArea > 0.000001)
        face(out, 'roof', xyz, up, side === -1 ? tone.roofLight : tone.roof);
    }
  }
}

function sliceIntervals(outline, z) {
  const cuts = pairs(closed(outline))
    .filter(([a, b]) => a[1] > z !== b[1] > z)
    .map(([a, b]) => mix(a[0], b[0], (z - a[1]) / (b[1] - a[1])))
    .sort((a, b) => a - b);
  return cuts
    .filter((_, i) => i % 2 === 0)
    .map((x, i) => [
      [x, z],
      [cuts[i * 2 + 1], z],
    ]);
}

function facadeBetween(out, a, b, profile, normal, color) {
  const middle = (x) => {
    const t = (x - a[0]) / (b[0] - a[0]);
    return [x, mix(a[1], b[1], t)];
  };
  const crossesRidge = a[0] > profile.ridgeX !== b[0] > profile.ridgeX;
  const splits = crossesRidge ? [a, middle(profile.ridgeX), b] : [a, b];
  for (const [p, q] of pairs(splits)) {
    if (Math.hypot(q[0] - p[0], q[1] - p[1]) < 0.0001) continue;
    face(
      out,
      'stone',
      [
        at(p, grade(p) - 0.26),
        at(q, grade(q) - 0.26),
        at(q, height(profile, q) - 0.026),
        at(p, height(profile, p) - 0.026),
      ],
      normal,
      color,
    );
  }
}

function roofStep(out, interval, a, b) {
  const [p, q] = interval;
  const cuts = [p[0], a.ridgeX, b.ridgeX, q[0]]
    .filter((x) => x >= p[0] && x <= q[0])
    .sort((a, b) => a - b);
  for (const [left, right] of pairs(cuts)) {
    if (right - left < 0.0001) continue;
    const l = [left, p[1]],
      r = [right, p[1]];
    const atA = [height(a, l), height(a, r)],
      atB = [height(b, l), height(b, r)];
    const points = [
      at(l, Math.min(atA[0], atB[0])),
      at(r, Math.min(atA[1], atB[1])),
      at(r, Math.max(atA[1], atB[1])),
      at(l, Math.max(atA[0], atB[0])),
    ];
    if (Math.max(...atA.map((h, i) => Math.abs(h - atB[i]))) > 0.001) {
      if (Math.abs(atA[0] - atB[0]) < 0.00001) points.pop();
      if (Math.abs(atA[1] - atB[1]) < 0.00001) points.splice(2, 1);
      if (points.length > 2)
        face(out, 'stone', points, [0, 0, atA[0] + atA[1] < atB[0] + atB[1] ? -1 : 1], tone.mortar);
    }
  }
}

function styledPortal(out, w, u, base, width, height, lod) {
  const a = u - width / 2,
    b = u + width / 2;
  panel(
    out,
    'plaster',
    w,
    a - 0.095,
    b + 0.095,
    base - 0.04,
    base + height + 0.14,
    0.036,
    tone.lime,
  );
  panel(out, 'wood', w, a, b, base, base + height, 0.063, tone.dark);
  if (lod < 2) return;
  panel(out, 'wood', w, a + 0.09, a + 0.17, base, base + height, 0.081, tone.cork);
  panel(out, 'wood', w, b - 0.17, b - 0.09, base, base + height, 0.081, tone.cork);
  panel(
    out,
    'wood',
    w,
    a + 0.07,
    b - 0.07,
    base + height - 0.12,
    base + height - 0.04,
    0.083,
    tone.cork,
  );
  if (lod === 3) {
    for (const offset of [0.22, 0.41, 0.57]) {
      const y = base + height * offset;
      panel(out, 'wood', w, a + 0.16, a + 0.22, y, y + 0.045, 0.085, tone.cork);
      panel(out, 'wood', w, b - 0.22, b - 0.16, y + 0.03, y + 0.065, 0.085, tone.cork);
    }
  }
}

function mainConvent(out, lod) {
  const outline = d.rooms[0].points;
  for (const r of rooms) tiledRidge(out, outline, r);
  for (const [r, next] of pairs(rooms))
    for (const interval of sliceIntervals(outline, r.range[1])) roofStep(out, interval, r, next);
  const sign = areaSign(outline);
  for (const [i, [a, b]] of pairs(closed(outline)).entries()) {
    const w = edge(a, b, sign);
    const segments = [0, 1];
    for (const r of rooms) {
      const t = (r.range[1] - a[1]) / (b[1] - a[1]);
      if (t > 0.00001 && t < 0.99999) segments.push(t);
    }
    const interpolate = (t) => a.map((n, k) => mix(n, b[k], t));
    for (const [s, t] of pairs(segments.sort((a, b) => a - b))) {
      const m = interpolate((s + t) * 0.5);
      const section = rooms.find((r) => m[1] < r.range[1]);
      facadeBetween(
        out,
        interpolate(s),
        interpolate(t),
        section,
        w.normal,
        i % 4 === 0 ? tone.mortar : tone.granite,
      );
    }
    if (w.length < 1.14) continue;
    const mid = interpolate(0.5),
      y = grade(mid);
    if (i === 11 || i === 17 || i === 25 || i === 33) {
      styledPortal(
        out,
        w,
        w.length * 0.5,
        y + 0.11,
        Math.min(0.97, w.length * 0.5),
        i === 11 ? 1.61 : 1.43,
        lod,
      );
    } else if (lod > 0 && i % 2 === 1 && w.length > 1.85) {
      styledPortal(out, w, w.length * 0.47, y + 1.11, Math.min(0.52, w.length * 0.21), 0.59, lod);
    }
  }
  const x = 2.3,
    z = -7.05,
    base = 3.03;
  block(out, 'stone', x - 0.63, base, z - 0.44, 1.26, 2.6, 0.88, tone.granite);
  block(out, 'ashlar', x - 0.72, base + 2.52, z - 0.53, 1.44, 0.23, 1.06, tone.mortar);
  if (lod > 0) {
    for (const side of [-1, 1]) {
      const w = {
        normal: [0, 0, side],
        p: (u, y, offset = 0) => [u, y, z + side * (0.445 + offset)],
      };
      for (const u of [x - 0.32, x, x + 0.32])
        panel(out, 'wood', w, u - 0.08, u + 0.08, base + 2.1, base + 2.35, 0.014, tone.dark);
    }
  }
}

function minorRoom(out, room, lod) {
  const outline = room.points,
    center = planarMid(outline),
    datum = grade(center);
  const broad = room.type === 'granary';
  const xs = outline.map((p) => p[0]);
  const roof = {
    range: [-30, 28],
    eave: datum + (broad ? 2.68 : 2.32),
    ridgeX: center[0],
    roofWidth: Math.max(1.4, (Math.max(...xs) - Math.min(...xs)) * 0.49),
    rise: broad ? 1.13 : 0.78,
  };
  tiledRidge(out, outline, roof);
  const edges = pairs(closed(outline)),
    sign = areaSign(outline);
  for (const [i, [a, b]] of edges.entries()) {
    const w = edge(a, b, sign);
    facadeBetween(out, a, b, roof, w.normal, room.type === 'chapel' ? tone.lime : tone.mortar);
    if (w.normal[0] > 0.4 && w.length > 1.55) {
      styledPortal(
        out,
        w,
        w.length * 0.52,
        grade(planarMid([a, b])) + 0.09,
        Math.min(1.17, w.length * 0.52),
        broad ? 1.54 : 1.51,
        lod,
      );
    } else if (lod > 0 && w.length > 2.65 && i % 2 === 0) {
      styledPortal(out, w, w.length * 0.47, grade(planarMid([a, b])) + 0.96, 0.46, 0.47, lod);
    }
  }
}

function roughGranite(out, x, z, width, depth, h, index, lod) {
  const y = grade([x, z]);
  const n = lod === 0 ? 5 : 7;
  const shape = (i, level, span) => {
    const a = ((i + 0.15 * (level + index)) * 2 * Math.PI) / n;
    const variation = 0.88 + 0.12 * Math.sin((i + index) * 2.4 + level);
    return [
      x + Math.cos(a) * width * span * variation,
      y + level * h + (level > 0.15 ? 0.14 * h * Math.sin(i * 1.9 + index) : 0),
      z + Math.sin(a) * depth * span * variation,
    ];
  };
  for (let i = 0; i < n; i++) {
    const a = shape(i, -0.18, 0.97),
      b = shape(i + 1, -0.18, 0.97);
    const c = shape(i + 1, 0.4, 1.0),
      d = shape(i, 0.4, 1.0);
    const e = shape(i, 0.82, 0.56),
      f = shape(i + 1, 0.82, 0.56);
    const theta = ((i + 0.5) * 2 * Math.PI) / n;
    const normal = [Math.cos(theta), 0.4, Math.sin(theta)];
    face(out, 'stone', [a, b, c], normal, tone.rock);
    face(out, 'stone', [a, c, d], normal, i % 3 === 0 ? tone.moss : tone.rock);
    face(out, 'stone', [d, c, f], normal, tone.rock);
    face(out, 'stone', [d, f, e], normal, tone.highRock);
    face(out, 'stone', [e, f, [x - width * 0.1, y + h, z]], up, tone.highRock);
  }
}

function stoneTerrace(out, points, y, lod) {
  shell(out, points, (p) => Math.min(y - 0.09, grade(p) - 0.15), y, {
    wall: 'ashlar',
    color: tone.stone,
  });
  cap(out, 'ashlar', points, y, tone.paved);
  if (lod > 1) {
    const [a, b] = points;
    const w = edge(a, b, areaSign(points));
    trimBlock(out, 'stone', w, 0, w.length, y - 0.18, y + 0.28, 0.005, 0.145, tone.granite);
  }
}

function fountain(out, center, y, radius, lod) {
  const n = 8;
  ring(
    out,
    'ashlar',
    center,
    [
      [y - 0.033, radius],
      [y + 0.3, radius],
      [y + 0.39, radius * 0.95],
      [y + 0.35, radius * 0.78],
      [y + 0.21, radius * 0.76],
    ],
    n,
    tone.granite,
  );
  const [x, z] = center;
  for (let i = 0; i < n; i++) {
    const pt = (t) => [
      x + radius * 0.75 * Math.cos((2 * Math.PI * t) / n),
      y + 0.224,
      z + radius * 0.75 * Math.sin((2 * Math.PI * t) / n),
    ];
    face(out, 'water', [[x, y + 0.224, z], pt(i), pt(i + 1)], up, tone.water);
  }
  if (lod > 0) block(out, 'ashlar', x - 0.12, y + 0.19, z - 0.11, 0.23, 0.48, 0.22, tone.stone);
}

function surroundings(out, lod) {
  const near = [11.45, 0.82],
    [cx, cz] = d.courtyard,
    [x, z] = d.crossCourtyard;
  stoneTerrace(
    out,
    [
      [8.38, -2.14],
      [15.6, -2.66],
      [15.1, 3.51],
      [9.38, 3.89],
    ],
    grade(near) + 0.27,
    lod,
  );
  stoneTerrace(
    out,
    [
      [17.3, -4.8],
      [24.92, -5.3],
      [25.66, 1.42],
      [17.95, 1.89],
    ],
    grade(d.courtyard) + 0.12,
    lod,
  );
  fountain(out, near, grade(near) + 0.3, 1.03, lod);
  fountain(out, [cx, cz], grade(d.courtyard) + 0.15, 1.22, lod);

  for (const [i, [u, v, w, m, h]] of [
    [9.6, 5.62, 1.49, 1.75, 2.45],
    [12.98, 5.75, 2.7, 1.38, 2.31],
    [-11.35, 8.49, 2.31, 2.34, 3.68],
    [-6.1, 18.85, 2.66, 1.68, 2.2],
    [-14.19, 15.1, 3.09, 2.16, 2.36],
    [5.06, -4.26, 1.55, 1.6, 1.06],
    [16.2, -5.04, 1.81, 0.88, 1.06],
    [-11.68, 1.27, 2.35, 1.31, 1.82],
  ].entries())
    roughGranite(out, u, v, w, m, h, i, lod);
  for (const [dx, dz, k] of [
    [-1.85, 0.85, 1.15],
    [0, 0, 1.87],
    [1.9, -0.41, 1.15],
  ]) {
    const u = x + dx,
      v = z + dz,
      y = grade([u, v]);
    block(out, 'ashlar', u - 0.29, y - 0.06, v - 0.24, 0.58, 0.31, 0.48, tone.stone);
    block(out, 'wood', u - 0.048, y + 0.15, v - 0.05, 0.096, k, 0.1, tone.wood);
    block(out, 'wood', u - k * 0.23, y + k * 0.68, v - 0.049, k * 0.46, 0.09, 0.099, tone.wood);
  }
}

function build(out, lod) {
  mainConvent(out, lod);
  for (const room of d.rooms.slice(1)) minorRoom(out, room, lod);
  surroundings(out, lod);
}
export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'convent-of-the-capuchos-sintra-model.mjs';
const camera = [49, 34, 49],
  lookAt = [-6, 2, 1];
export const capuchosConventModel = {
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
    'The Fountain Courtyard establishes the contact datum. The rooms and retaining stones touch the independent original terrain.',
  brief:
    'Sintra’s Convent of the Capuchos, with small tiled rooms built around granite outcrops, stone chapels and the fountain approach.',
  camera,
  lookAt,
  sunDirection: [47, 43, 30],
  mediumFiContext: {
    scale: 1,
    groundY: -2.8,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: d.outline,
    outlines: d.polygons,
    minimumCoverage: 0.91,
    basis:
      'The named convent and separate native buildings are individually masked where the model replaces generated footprints.',
  },
  embeddedCanonicalGraphs: Object.values(surfaces).map((s) => s.graph),
  recipeDependencies: ['montreal-museum-pavilion-geometry.mjs', 'polygon-triangulation.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-003.PROGRESS.md',
  qaCameras: [
    { name: 'fountain-approach-and-tiled-convent', position: [55, 12, 18], lookAt: [4, 3, 0] },
    { name: 'stone-court-and-rock-integrated-walls', position: [22, 5, 12], lookAt: [4, 2.5, 4] },
    { name: 'small-chapels-and-granary', position: [-38, 18, 34], lookAt: [-11, 3, 5] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'capuchos-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.72,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.42, surfaces },
      street: { export: 'street', errorMeters: 0.19, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.06, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original mesh under the repository license. Tagido’s local photographs were released to the public domain. Native map data © OpenStreetMap contributors, ODbL 1.0.',
};
