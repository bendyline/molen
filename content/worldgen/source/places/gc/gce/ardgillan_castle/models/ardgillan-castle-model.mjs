import { readFileSync } from 'node:fs';
import {
  beam,
  loft,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  areaSign,
  block,
  closed,
  edge,
  face,
  floorSampler,
  mix,
  pairs,
  palette,
  panel,
  plane,
  surface,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';

const read = (file) => JSON.parse(readFileSync(new URL('../' + file, import.meta.url)));
const plan = read('plan-controls.json');
const { dimensions: d } = plan;
const terrain = floorSampler(read('terrain-grid.json'));
const colors = palette({
  render: '99988d',
  grey: '8d8c82',
  wing: 'a3a095',
  dressing: 'aca99b',
  shadow: '79796f',
  glass: '555e59',
  sash: 'd5ceb9',
  door: '655448',
  slate: '64676b',
  roofTall: '5c5d5d',
  clay: '8d5a4b',
  stone: '948b7b',
  glasshouse: 'a5bdb4',
  ribs: 'd4d8c4',
  paleSlate: '777b75',
});
const surfaces = {
  render: { slot: 'wall', localRef: 'palette:#ffffff', roughness: 0.93 },
  wall: surface('wall', 'stone_ashlar', 0.92),
  roof: { slot: 'roof', localRef: 'palette:#ffffff', roughness: 0.88 },
  trim: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.87 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.45 },
  glasshouse: {
    slot: 'window',
    localRef: 'palette:#fefefe',
    roughness: 0.33,
    alphaMode: 'BLEND',
    baseColorFactor: [1, 1, 1, 0.53],
    doubleSided: true,
  },
  doors: { slot: 'door', localRef: 'palette:#ffffff', roughness: 0.86 },
};

const up = [0, 1, 0];
function deck(out, outline, holes, y, slot, c) {
  const starts = holes.map(
    (_, i) => outline.length + holes.slice(0, i).reduce((a, b) => a + b.length, 0),
  );
  const points = [...outline, ...holes.flat()];
  const indices = earcut(points.flat(), starts);
  for (let i = 0; i < indices.length; i += 3) {
    face(
      out,
      slot,
      indices.slice(i, i + 3).map((j) => [points[j][0], y, points[j][1]]),
      up,
      c,
    );
  }
}

function wallSegment(out, shape, i, bottom, top, slot, c) {
  const a = shape[i],
    b = shape[(i + 1) % shape.length];
  const w = edge(a, b, areaSign(shape));
  const [lo, hi] = [bottom(a), bottom(b)];
  face(
    out,
    slot,
    [[a[0], lo, a[1]], [b[0], hi, b[1]], w.p(w.length, top), w.p(0, top)],
    w.normal,
    c,
  );
  return w;
}
function gable(out, x0, x1, z0, z1, eave, ridge, tint, reverse = false) {
  const center = (z0 + z1) / 2;
  const point = (x, y, z) => (reverse ? [z, y, x] : [x, y, z]);
  const corners = [
    point(x0, eave, z0),
    point(x1, eave, z0),
    point(x1, eave, z1),
    point(x0, eave, z1),
  ];
  const a = point(x0, ridge, center),
    b = point(x1, ridge, center);
  face(out, 'roof', [corners[0], corners[1], b, a], up, tint);
  face(out, 'roof', [corners[2], corners[3], a, b], up, tint);
  face(out, 'render', [corners[3], corners[0], a], reverse ? [0, 0, -1] : [-1, 0, 0], colors.grey);
  face(out, 'render', [corners[1], corners[2], b], reverse ? [0, 0, 1] : [1, 0, 0], colors.grey);
}

function merlons(out, w, y, level) {
  const grid = level === 0 ? 2.32 : 1.37;
  const n = Math.max(1, Math.floor(w.length / grid));
  for (let i = 0; i < n; i++) {
    const width = w.length / n,
      u = (i + 0.2) * width,
      v = u + width * 0.54;
    const height = level === 0 ? 0.64 : 0.78;
    panel(out, 'render', w, u, v, y, y + height, 0.055, colors.render);
    if (level > 0) {
      const a = w.p(u, y + height, 0.065),
        b = w.p(v, y + height, 0.065);
      const c = w.p(v, y + height, -0.3),
        d = w.p(u, y + height, -0.3);
      face(out, 'trim', [a, b, c, d], up, colors.dressing);
    }
    if (level >= 2) {
      panel(
        out,
        'render',
        { ...w, normal: w.normal.map((v) => -v) },
        u,
        v,
        y,
        y + height,
        -0.3,
        colors.grey,
      );
    }
  }
}

function sash(out, w, u, y, width, height, level) {
  const half = width / 2;
  panel(
    out,
    'trim',
    w,
    u - half - 0.11,
    u + half + 0.11,
    y - 0.09,
    y + height + 0.1,
    0.029,
    colors.dressing,
  );
  panel(out, 'glass', w, u - half, u + half, y, y + height, 0.053, colors.glass);
  if (level >= 1) {
    panel(out, 'trim', w, u - 0.041, u + 0.041, y, y + height, 0.071, colors.sash);
    panel(
      out,
      'trim',
      w,
      u - half,
      u + half,
      y + height * 0.53,
      y + height * 0.53 + 0.058,
      0.078,
      colors.sash,
    );
  }
  if (level >= 2) {
    for (let i = 1; i <= 4; i++) {
      const h = y + (height * i) / 5;
      panel(out, 'trim', w, u - half, u + half, h, h + 0.042, 0.08, colors.sash);
    }
    panel(
      out,
      'trim',
      w,
      u - half - 0.15,
      u + half + 0.15,
      y - 0.18,
      y - 0.07,
      0.14,
      colors.dressing,
    );
  }
}

function decorativeHead(out, w, u, y, width, level) {
  const steps = level === 3 ? 7 : 4;
  const rise = 0.68;
  const crest = Array.from({ length: steps * 2 + 1 }, (_, i) => {
    const t = i / steps - 1;
    return [u + width * t * 0.5, y + rise * (1 - t * t) * (1 - 0.49 * Math.abs(t))];
  });
  for (const [a, b] of pairs(crest)) {
    face(
      out,
      'trim',
      [
        w.p(a[0], a[1], 0.058),
        w.p(b[0], b[1], 0.058),
        w.p(b[0], b[1] + 0.105, 0.078),
        w.p(a[0], a[1] + 0.105, 0.078),
      ],
      w.normal,
      colors.shadow,
    );
  }
}

function house(out, level) {
  const floor = (p) => Math.min(-0.4, terrain(p) - 0.48);
  const serviceY = 5.6;
  deck(out, d.outline, d.holes, serviceY, 'roof', colors.slate);
  const outer = d.outline;
  for (let i = 0; i < outer.length; i++) {
    const curvedWest = i < 17;
    const curvedCentral = i >= 23 && i <= 32;
    const curvedEast = i >= 37 && i <= 42;
    const core = i >= 17 && i <= 44;
    if (curvedWest || curvedCentral || curvedEast) continue;
    const wallHeight = core ? (i === 19 || i === 35 ? d.parapet + 0.43 : d.parapet) : serviceY;
    const w = wallSegment(
      out,
      outer,
      i,
      floor,
      wallHeight,
      core ? 'render' : 'wall',
      core ? colors.render : colors.stone,
    );
    if (!core) continue;
    if (w.length >= 2.2) merlons(out, w, wallHeight, level);
    if (level >= 1 && w.length >= 3.6) {
      const cols = Math.max(1, Math.round(w.length / 3.25));
      for (let j = 0; j < cols; j++) {
        const u = ((j + 0.5) * w.length) / cols;
        for (const [y, h] of [
          [0.78, 2.44],
          [4.03, 2.54],
          [7.25, 2.36],
        ]) {
          sash(out, w, u, y, Math.min(1.12, (w.length / cols) * 0.52), h, level);
        }
        if (i === 19 || i === 35) decorativeHead(out, w, u, 9.83, 1.63, level);
      }
    }
    if (level >= 2 && w.length >= 3.5) {
      for (const u of [0.16, w.length - 0.42]) {
        for (let j = 0; j < 9; j++) {
          const y = 0.2 + j * 1.35;
          panel(out, 'trim', w, u, u + 0.26, y, y + 0.86, 0.1, colors.dressing);
        }
      }
    }
  }
  for (const hole of d.holes) {
    const inward = [...hole].reverse();
    for (let i = 0; i < inward.length; i++) {
      const w = wallSegment(out, inward, i, floor, serviceY, 'wall', colors.stone);
      if (level >= 1 && w.length > 3.8) {
        const cols = Math.max(1, Math.round(w.length / 5.0));
        for (let j = 0; j < cols; j++)
          sash(out, w, ((j + 0.5) * w.length) / cols, 1.33, 1.05, 1.66, level);
      }
    }
  }

  const mainRanges = [
    [-16.1, 4.44, -4.62, 0.78, d.houseEaves],
    [4.33, 28.0, -10.1, -0.42, d.houseEaves - 0.32],
    [-18.0, 4.4, -14.9, -11.86, 10.78],
  ];
  for (const [west, east, south, north, eaves] of mainRanges) {
    block(
      out,
      'render',
      west,
      serviceY - 0.05,
      south,
      east - west,
      eaves - serviceY + 0.05,
      north - south,
      colors.render,
    );
  }
  const entrance = edge(outer[33], outer[34], areaSign(outer));
  const middle = entrance.length * 0.49;
  panel(out, 'trim', entrance, middle - 1.12, middle + 1.12, 0.2, 3.46, 0.085, colors.dressing);
  panel(out, 'doors', entrance, middle - 0.87, middle + 0.87, 0.29, 3.16, 0.102, colors.door);
  if (level >= 1) {
    panel(out, 'trim', entrance, middle - 1.25, middle + 1.25, 3.39, 3.55, 0.14, colors.shadow);
  }
  // Primary ranges rise above the service perimeter. Their slate profiles sit behind the parapet.
  gable(out, -16.1, 4.44, -4.62, 2.35, d.houseEaves, d.mainRoofRidge, colors.roofTall);
  gable(out, 4.33, 28.0, -10.1, 0.22, d.houseEaves - 0.32, d.mainRoofRidge - 0.32, colors.roofTall);
  gable(out, -18.0, 4.4, -14.9, -11.76, 10.78, 11.63, colors.slate);
  gable(out, -86.8, -40.6, -20.95, -16.9, 5.1, 7.15, colors.slate);
  gable(out, -87.6, -18.9, -42.7, -35.7, 5.21, 8.03, colors.slate);
  gable(out, -24.0, -19.0, -42.8, -12.1, 5.14, 7.24, colors.paleSlate, true);
  gable(out, 25.5, 47.88, -25.7, -18.9, 5.1, 7.34, colors.paleSlate);

  if (level >= 1) {
    for (const [x, z] of [
      [-11.8, -3.4],
      [-1.43, -3.0],
      [11.2, -6.0],
      [23.8, -6.2],
    ]) {
      block(out, 'render', x - 0.44, 11.2, z - 0.46, 0.88, 2.04, 0.92, colors.grey);
      block(out, 'trim', x - 0.51, 13.14, z - 0.51, 1.02, 0.2, 1.02, colors.dressing);
      if (level >= 2) {
        const ring = (y, r) => radialRing(y, r, r, 8, [x, z]);
        loft(out, 'trim', [ring(13.3, 0.25), ring(13.71, 0.21), ring(13.76, 0.25)], colors.clay);
      }
    }
  }
}

function turret(out, { center, radius }, level, index) {
  const [x, z] = center,
    sides = [10, 16, 24, 32][level],
    y = d.turret - (index === 2 ? 0.91 : 0);
  const r = (h, rad) => radialRing(h, rad, rad, sides, center, Math.PI / sides);
  const base = Math.min(-0.63, terrain(center) - 0.38);
  loft(
    out,
    'render',
    [
      r(base, radius),
      r(y - 0.85, radius),
      r(y - 0.57, radius + 0.105),
      r(y - 0.2, radius + 0.105),
      r(y, radius),
    ],
    colors.render,
  );
  const count = level === 0 ? 5 : 8;
  for (let i = 0; i < count; i++) {
    const a = (i * 2 * Math.PI) / count,
      b = a + (0.45 * 2 * Math.PI) / count;
    const p = (h, k, o) => [x + o * Math.cos(k), h, z + o * Math.sin(k)];
    const rad = radius + 0.018;
    face(
      out,
      'render',
      [p(y - 0.14, a, rad), p(y - 0.14, b, rad), p(y + 0.76, b, rad), p(y + 0.76, a, rad)],
      [Math.cos((a + b) / 2), 0, Math.sin((a + b) / 2)],
      colors.grey,
    );
    if (level >= 2) {
      face(
        out,
        'trim',
        [
          p(y + 0.76, a, rad),
          p(y + 0.76, b, rad),
          p(y + 0.76, b, rad - 0.24),
          p(y + 0.76, a, rad - 0.24),
        ],
        up,
        colors.dressing,
      );
    }
  }
  if (level >= 1) {
    for (const angle of [0.42, 1.58, 2.62]) {
      const origin = [
        x + Math.cos(angle) * (radius + 0.006),
        z + Math.sin(angle) * (radius + 0.006),
      ];
      const tx = Math.sin(angle),
        tz = -Math.cos(angle);
      const w = {
        normal: [Math.cos(angle), 0, Math.sin(angle)],
        p: (u, y, off = 0) => [
          origin[0] + tx * u + w.normal[0] * off,
          y,
          origin[1] + tz * u + w.normal[2] * off,
        ],
      };
      sash(out, w, 0, 3.3, 0.92, 2.12, level);
      sash(out, w, 0, 6.8, 0.91, 2.18, level);
      panel(out, 'glass', w, -0.061, 0.061, 10.15, 11.55, 0.03, colors.shadow);
    }
  }
}

function greenhouse(out, level) {
  const angle = -0.161;
  const c = Math.cos(angle),
    s = Math.sin(angle);
  const datum = d.greenDatum;
  const p = (u, dy, v) => [111.42 + u * c - v * s, datum + dy, 4.35 + u * s + v * c];
  const north = [-s, 0, c],
    south = [s, 0, -c];
  const low = 0.25,
    sill = 1.62,
    eave = 2.78,
    ridge = 6.08;
  for (let i = 0; i < d.garden.length; i++)
    wallSegment(
      out,
      d.garden,
      i,
      (a) => Math.min(terrain(a) - 0.23, datum - 0.04),
      datum + low,
      'wall',
      colors.stone,
    );
  deck(out, d.garden, [], datum + low, 'wall', colors.stone);
  const transparent = level >= 2 ? 'glasshouse' : 'glass';
  for (const [a, b] of [
    [-17.65, -4.45],
    [4.45, 16.8],
  ]) {
    const far = -5.74,
      back = 5.4;
    const frontEdge = [p(a, low, far), p(b, low, far), p(b, eave, far), p(a, eave, far)];
    face(out, transparent, frontEdge, south, colors.glasshouse);
    face(
      out,
      transparent,
      [p(a, eave, far), p(b, eave, far), p(b, ridge, back), p(a, ridge, back)],
      up,
      colors.glasshouse,
    );
    face(
      out,
      transparent,
      [p(b, low, back), p(a, low, back), p(a, ridge, back), p(b, ridge, back)],
      north,
      colors.glasshouse,
    );
    const n = a + b < 0 ? [-c, 0, -s] : [c, 0, s],
      edge = a + b < 0 ? a : b;
    face(
      out,
      transparent,
      [p(edge, low, far), p(edge, low, back), p(edge, ridge, back), p(edge, eave, far)],
      n,
      colors.glasshouse,
    );
    if (level >= 1) {
      for (const h of [low, sill, eave]) {
        beam(out, 'trim', p(a, h, far), p(b, h, far), 0.105, 0.1, colors.ribs);
      }
      beam(out, 'trim', p(a, ridge, back), p(b, ridge, back), 0.12, 0.15, colors.ribs);
      const count = level === 1 ? 10 : level === 2 ? 17 : 24;
      for (let i = 0; i <= count; i++) {
        const u = mix(a, b, i / count);
        beam(
          out,
          'trim',
          p(u, low, far - 0.025),
          p(u, eave, far - 0.025),
          0.056,
          0.056,
          colors.ribs,
        );
        beam(
          out,
          'trim',
          p(u, eave + 0.034, far),
          p(u, ridge + 0.034, back),
          0.07,
          0.062,
          colors.ribs,
        );
      }
    }
  }

  const skirt = level === 0 ? 8 : level === 1 ? 10 : level === 2 ? 18 : 30;
  const ringDepth = -5.36;
  const profile = [
    [low, 4.45],
    [2.6, 4.45],
    [3.28, 4.31],
    [4.15, 3.72],
    [4.89, 2.52],
    [5.18, 1.1],
    [5.25, 0.27],
  ];
  const ring = (pair, i) =>
    p(
      Math.cos((Math.PI * i) / skirt) * pair[1],
      pair[0],
      ringDepth - Math.sin((Math.PI * i) / skirt) * pair[1] * 0.66,
    );
  const rows = profile.map((row) => Array.from({ length: skirt + 1 }, (_, i) => ring(row, i)));
  for (const [lo, hi] of pairs(rows)) {
    for (let i = 0; i < skirt; i++) {
      const angle = (Math.PI * (i + 0.5)) / skirt;
      const n = [
        Math.cos(angle) * c + Math.sin(angle) * s,
        0,
        Math.cos(angle) * s - Math.sin(angle) * c,
      ];
      face(out, transparent, [lo[i], lo[i + 1], hi[i + 1], hi[i]], n, colors.glasshouse);
    }
  }
  if (level >= 1) {
    for (let j = 0; j <= skirt; j++) {
      for (const [a, b] of pairs(rows)) beam(out, 'trim', a[j], b[j], 0.063, 0.063, colors.ribs);
    }
    for (const i of [1, 3, 5]) {
      for (const [a, b] of pairs(rows[i])) beam(out, 'trim', a, b, 0.055, 0.06, colors.ribs);
    }
  }
  const lanternFront = [
    p(-2.47, 5.3, -2.8),
    p(2.47, 5.3, -2.8),
    p(2.47, 6.39, -2.8),
    p(-2.47, 6.39, -2.8),
  ];
  face(out, transparent, lanternFront, south, colors.glasshouse);
  face(
    out,
    transparent,
    [p(-2.47, 6.39, -2.8), p(2.47, 6.39, -2.8), p(2.47, 6.97, 3.4), p(-2.47, 6.97, 3.4)],
    up,
    colors.glasshouse,
  );
  if (level >= 1) {
    for (const [a, b] of pairs(closed(lanternFront)))
      beam(out, 'trim', a, b, 0.12, 0.12, colors.ribs);
    for (let i = -2; i <= 2; i++)
      beam(
        out,
        'trim',
        p(i * 0.82, 5.3, -2.83),
        p(i * 0.82, 6.4, -2.83),
        0.067,
        0.067,
        colors.ribs,
      );
  }
}
function build(out, level) {
  house(out, level);
  for (const [i, t] of d.towers.entries()) turret(out, t, level, i);
  greenhouse(out, level);
}
export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);
const recipe = 'ardgillan-castle-model.mjs';
const camera = [111, 37, 116],
  lookAt = [25, 6, -7];
const errors = { district: 0.49, street: 0.17, closeup: 0.07 };
export const ardgillanCastleAsset = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  category: 'castle-palace',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis:
    'Original coastal escarpment elevation in the exact mapped frame for the castellated house and separate rose-garden conservatory.',
  brief:
    'Ardgillan Castle’s battlemented Gothic fronts and round towers, open service courts and Victorian conservatory with a domed plant house.',
  camera,
  lookAt,
  sunDirection: [25, 107, 137],
  mediumFiContext: {
    scale: 1,
    groundY: -0.2,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: d.outline,
    outlines: [d.outline, d.garden],
    minimumCoverage: 0.92,
    basis: 'Two separately mapped standing structures, the house and Victorian conservatory.',
  },
  embeddedCanonicalGraphs: ['stone_ashlar'],
  recipeDependencies: ['montreal-museum-pavilion-geometry.mjs', 'polygon-triangulation.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-003.PROGRESS.md',
  qaCameras: [
    { name: 'north-battlements-and-sash-windows', position: [-30, 9, 78], lookAt: [4, 7, -3] },
    {
      name: 'rear-service-ranges-and-open-courts',
      position: [-46, 28, -86],
      lookAt: [-31, 5, -21],
    },
    {
      name: 'victorian-conservatory-glazing-and-cupola',
      position: [90, 13, -30],
      lookAt: [112, 4, 1],
    },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'ardgillan-castle-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.98,
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
    'Original mesh under repository license. Geographic vectors © OpenStreetMap contributors, ODbL 1.0.',
};
