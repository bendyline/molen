/** Cozia's trilobed church, contiguous convent ranges and Olt retaining walls. */
import { readFileSync } from 'node:fs';
import {
  beamPath,
  loft,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  face,
  transform,
  triangle,
} from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (name) => JSON.parse(readFileSync(new URL('../' + name, import.meta.url)));
const plan = read('plan-controls.json');
const frame = read('map-frame.json');
const [churchTrace, rangeTrace, towerTrace] = frame.features.map((feature) => feature.points);
const surfaces = {
  masonry: { slot: 'foundation', graph: 'stone_ashlar', roughness: 0.95, metallic: 0 },
  stone: { slot: 'wall', graph: 'stone_limestone_raw', roughness: 0.94, metallic: 0 },
  brick: { slot: 'trim', graph: 'brick', roughness: 0.92, metallic: 0 },
  plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.92, metallic: 0 },
  roof: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.79, metallic: 0 },
  recess: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.93, metallic: 0 },
};
const tones = Object.fromEntries(
  Object.entries({
    pier: '9b927c',
    revetment: '756f5d',
    foundation: '918c77',
    paving: 'b1a591',
    stone: 'd5c6ab',
    molding: 'e0cdb2',
    brick: 'a87862',
    plaster: 'e2dacf',
    ivory: 'ece7d8',
    roof: '637570',
    roofLight: '728079',
    seam: '4c5d56',
    dark: '514737',
    wood: '70604c',
  }).map(([key, color]) => [key, rgb(color)]),
);

const ringAt = (footprint, y, push = 0, center = [0, 0]) =>
  footprint.map(([x, z]) => {
    const length = Math.hypot(x - center[0], z - center[1]) || 1;
    return [x + (push * (x - center[0])) / length, y, z + (push * (z - center[1])) / length];
  });

function orientedRing(trace) {
  const area = trace.reduce((sum, [x, z], i) => {
    const [nextX, nextZ] = trace[(i + 1) % trace.length];
    return sum + x * nextZ - nextX * z;
  }, 0);
  return area > 0 ? [...trace].reverse() : trace;
}

function wallBand(out, slot, trace, low, high, color, push = 0) {
  loft(out, slot, [ringAt(trace, low, push), ringAt(trace, high, push)], color, { cap: false });
}

function hipRoof(out, { x, z, angle = 0, width, depth, eave, rise, shortHip = false }, lod) {
  const roof = transform(out, angle, [x, eave, z]);
  const half = width / 2;
  const side = depth / 2;
  const length = Math.max(0.3, half - side * (shortHip ? 0.65 : 1.07));
  const a = [-half, 0, -side],
    b = [-half, 0, side];
  const c = [half, 0, side],
    d = [half, 0, -side];
  const west = [-length, rise, 0],
    east = [length, rise, 0];
  face(roof, 'roof', [b, c, east, west], tones.roof);
  face(roof, 'roof', [d, a, west, east], tones.roofLight);
  triangle(roof, 'roof', [a, b, west], tones.roofLight);
  triangle(roof, 'roof', [c, d, east], tones.roof);
  face(roof, 'roof', [d, c, b, a], tones.seam);
  if (lod < 2) return;
  beamPath(roof, 'roof', [west, east], 0.13, 0.1, tones.seam);
  const count = Math.ceil(length / (lod === 3 ? 0.75 : 1.6));
  for (let i = -count; i <= count; i++) {
    const px = (i * length) / (count + 1);
    const ridge = [px, rise + 0.028, 0];
    for (const eaveZ of [-side, side])
      beamPath(roof, 'roof', [[px, 0.028, eaveZ], ridge], 0.026, 0.032, tones.seam);
  }
}

function vaultedRoof(out, trace, center, y, rise, lod) {
  const low = ringAt(trace, y, 0.31, center);
  const shrunk = (scale, height) =>
    low.map(([x, , z]) => [
      center[0] + (x - center[0]) * scale,
      height,
      center[1] + (z - center[1]) * scale,
    ]);
  const profile =
    lod > 0
      ? [low, shrunk(0.8, y + rise * 0.55), shrunk(0.48, y + rise * 0.9), shrunk(0.16, y + rise)]
      : [low, shrunk(0.34, y + rise)];
  loft(out, 'roof', profile, tones.roof, { cap: false });
  const lip = profile.at(-1);
  out.addConvexPolygon('roof', 'palette:#ffffff', lip, [0, 1, 0], (p) => [p[0], p[2]], tones.roof);
}

function archedFrame(out, x, y, z, width, height, lod, slot = 'stone') {
  const half = width / 2;
  const spring = height - half;
  const n = lod === 3 ? 10 : 6;
  const arch = Array.from({ length: n + 1 }, (_, i) => {
    const theta = (Math.PI * i) / n;
    return [x + Math.cos(theta) * half, y + spring + Math.sin(theta) * half, z];
  });
  const shape = [[x + half, y, z], ...arch, [x - half, y, z]];
  out.addConvexPolygon(
    'recess',
    'palette:#ffffff',
    [...shape].reverse(),
    [0, 0, 1],
    (p) => [p[0], p[1]],
    tones.dark,
  );
  if (lod < 2) return;
  beamPath(
    out,
    slot,
    shape.map(([xx, yy, zz]) => [xx, yy, zz + 0.045]),
    lod === 3 ? 0.16 : 0.13,
    0.15,
    tones.molding,
  );
}

function porch(out, lod) {
  const x0 = -13.7;
  const x1 = -7.2;
  const width = 9.82;
  const front = transform(out, -Math.PI / 2, [x0, 0, 0]);
  const levels = [0.14, 3.68, 4.86];
  box(out, 'stone', [x0 - 0.29, -0.03, -5.02], [x1, 0.2, 5.02], tones.stone);
  box(out, 'stone', [x0, levels[1], -4.91], [x1, levels[2], 4.91], tones.molding);
  for (const z of [-4.5, -1.55, 1.55, 4.5]) {
    box(out, 'stone', [x0, levels[0], z - 0.31], [x0 + 0.53, 3.67, z + 0.31], tones.stone);
    if (lod > 0)
      box(out, 'stone', [x0 - 0.05, 2.78, z - 0.38], [x0 + 0.57, 2.99, z + 0.38], tones.molding);
  }
  for (const z of [-4.91, 4.91]) {
    const side = z > 0 ? 1 : -1;
    box(out, 'stone', [x0 + 2.8, levels[0], z - 0.23], [x0 + 3.42, 3.68, z + 0.23], tones.stone);
    box(out, 'stone', [x1 - 0.43, levels[0], z - 0.21], [x1, 3.68, z + 0.21], tones.stone);
    if (lod > 0) {
      const sideOut = transform(out, side === 1 ? 0 : Math.PI);
      for (const center of [-12.25, -9]) porchArch(sideOut, center * side, 4.93, 1.14, lod);
    }
  }
  if (lod > 0) for (const center of [-3, 0, 3]) porchArch(front, center, 0, 1.19, lod);
  hipRoof(
    out,
    { x: (x0 + x1) / 2, z: 0, width: 7.1, depth: width + 0.65, eave: 4.83, rise: 1.59 },
    lod,
  );
  box(out, 'stone', [x0 - 1.05, -0.14, -2.93], [x0 - 0.29, 0.04, 2.93], tones.paving);
}

function porchArch(out, center, z, half, lod) {
  const y = 2.48;
  const n = lod === 3 ? 12 : 7;
  const spring = Array.from({ length: n + 1 }, (_, i) => {
    const theta = (Math.PI * i) / n;
    return [center + Math.cos(theta) * half, y + Math.sin(theta) * half, z];
  });
  beamPath(out, 'stone', spring, 0.23, 0.34, tones.molding);
  for (let i = 0; i < n; i++) {
    const a = spring[i],
      b = spring[i + 1];
    face(out, 'stone', [b, a, [a[0], 3.7, z], [b[0], 3.7, z]], tones.stone);
  }
}

function church(out, lod) {
  const outline = orientedRing(churchTrace.map(([x, z]) => [Math.max(x, -7.22), z]));
  const mainEave = plan.church.eave;
  const simple = lod === 0 ? outline.filter((_, i) => i % 2 === 0) : outline;
  wallBand(out, 'masonry', simple, -2.9, 0.46, tones.foundation, 0.17);
  wallBand(out, 'stone', simple, 0.46, mainEave, tones.stone);
  for (const y of lod === 0 ? [7.48] : [1.24, 2.85, 3.89, 5.65, 6.95, 7.48])
    wallBand(out, 'brick', simple, y, y + (y === 7.48 ? 0.22 : 0.13), tones.brick, 0.068);
  wallBand(out, 'stone', simple, mainEave - 0.12, mainEave + 0.14, tones.molding, 0.16);
  hipRoof(out, { x: 0.7, z: 0, width: 17, depth: 10.35, eave: mainEave + 0.04, rise: 2.19 }, lod);
  for (const [offset, range, center] of [
    [-1, [3, 17], [6.8, -4.6]],
    [0, [15, 29], [10.9, 0]],
    [1, [27, 40], [6.7, 4.6]],
  ]) {
    const points = churchTrace.slice(...range);
    const outline = orientedRing(lod === 0 ? points.filter((_, i) => i % 2 === 0) : points);
    vaultedRoof(out, outline, center, mainEave + 0.025, offset === 0 ? 1.16 : 1.34, lod);
  }
  if (lod > 0) {
    for (const angle of [0, Math.PI]) {
      const side = transform(out, angle);
      archedFrame(side, -4.4 * Math.cos(angle), 3.02, 4.968, 0.97, 2.15, lod);
      const bezels = [
        [4.8, 2.86, 8.04],
        [7.4, 2.86, 8.69],
        [9.1, 2.86, 7.6],
      ];
      for (const [x, y, z] of bezels) archedFrame(side, x * Math.cos(angle), y, z, 0.62, 1.75, lod);
      if (lod > 1) {
        for (const x of [-5.87, -2.83, 1.13]) {
          loft(
            side,
            'brick',
            [radialRing(0.43, 0.17, 0.2, 7, [x, 4.95]), radialRing(6.76, 0.17, 0.2, 7, [x, 4.95])],
            tones.brick,
          );
        }
      }
    }
    archedFrame(transform(out, Math.PI / 2, [16.12, 0, 0]), 0, 2.84, 0, 0.77, 2, lod);
  }
  const [drumX, drumZ] = plan.church.drumCenter;
  const center = [drumX, drumZ];
  const start = plan.church.drumBase;
  const radial = (y, size, sides = 8) =>
    radialRing(start + y, size, size, sides, center, Math.PI / 8);
  loft(out, 'stone', [radial(-0.67, 3.29), radial(0.56, 3.02), radial(0.73, 2.48)], tones.stone);
  loft(out, 'stone', [radial(0.68, 2.42), radial(4.47, 2.42)], tones.stone);
  for (const y of lod === 0 ? [4.45] : [0.81, 2.7, 4.23, 4.45])
    loft(out, 'brick', [radial(y, 2.48), radial(y + 0.12, 2.48)], tones.brick, { cap: false });
  if (lod > 0) {
    for (let i = 0; i < 8; i++) {
      const angle = (i * Math.PI) / 4;
      const facade = transform(out, angle, [drumX, start, drumZ]);
      archedFrame(facade, 0, 1.27, 2.242, 0.79, 2.15, lod);
    }
  }
  const cap = lod === 0 ? 8 : 16;
  loft(
    out,
    'roof',
    [
      radial(4.52, 2.73, cap),
      radial(4.84, 2.6, cap),
      radial(5.49, 2.49, cap),
      radial(6.18, 1.82, cap),
      radial(6.66, 0.73, cap),
      radial(6.86, 0.12, cap),
    ],
    tones.roof,
  );
  cross(out, drumX, start + 6.86, drumZ, 1.05, lod);
  porch(out, lod);
}

function cross(out, x, y, z, height, lod) {
  const stem = lod > 0 ? 0.064 : 0.086;
  box(out, 'roof', [x - stem, y, z - stem], [x + stem, y + height, z + stem], tones.seam);
  box(
    out,
    'roof',
    [x - height * 0.28, y + height * 0.57, z - stem],
    [x + height * 0.28, y + height * 0.57 + stem, z + stem],
    tones.seam,
  );
}

function window(out, x, sill, width, height, lod) {
  const left = x - width / 2;
  const right = x + width / 2;
  face(
    out,
    'recess',
    [
      [left, sill, 0],
      [right, sill, 0],
      [right, sill + height, 0],
      [left, sill + height, 0],
    ],
    tones.dark,
  );
  if (lod > 1) {
    box(
      out,
      'plaster',
      [left - 0.12, sill - 0.105, -0.14],
      [right + 0.12, sill, 0.141],
      tones.ivory,
    );
    box(out, 'recess', [x - 0.048, sill, 0.012], [x + 0.048, sill + height, 0.064], tones.wood);
  }
}

function rangeWalls(out, lod) {
  const outline = orientedRing(rangeTrace);
  wallBand(out, 'plaster', outline, -0.6, 7.19, tones.plaster);
  if (lod > 0) wallBand(out, 'masonry', outline, -1.36, 0.53, tones.foundation, 0.055);
  if (lod > 0) {
    wallBand(out, 'plaster', outline, 7.01, 7.28, tones.ivory, 0.12);
    for (let i = 0; i < outline.length; i++) {
      const [x, z] = outline[i],
        [nextX, nextZ] = outline[(i + 1) % outline.length];
      const length = Math.hypot(nextX - x, nextZ - z);
      if (length < 2.7) continue;
      const angle = -Math.atan2(nextZ - z, nextX - x);
      const local = transform(out, angle, [
        x + Math.sin(angle) * 0.015,
        0,
        z + Math.cos(angle) * 0.015,
      ]);
      const bays = Math.max(1, Math.round(length / 3.24));
      for (let bay = 0; bay < bays; bay++) {
        const px = (length * (bay + 0.5)) / bays;
        window(local, px, 4.65, 0.94, 1.34, lod);
        if (length > 4.9 && (bay % 3 !== 2 || length > 12))
          window(local, px, 1.96, 0.78, 1.15, lod);
      }
    }
  }
  for (const span of lod === 0 ? plan.rangeRoofs.slice(0, 4) : plan.rangeRoofs)
    hipRoof(out, span, lod);
}

function retainingWall(out, lod) {
  const top = plan.riverBank;
  const bottom = plan.riverFloor;
  const upper = top.map(([x, z]) => [x, -0.29, z]);
  const shoulder = top.map(([x, z]) => [x + 1.83, -7.14, z]);
  const lower = top.map(([x, z], i) => [
    x + (i === 0 || i === top.length - 1 ? 2.18 : 4.7),
    bottom,
    z,
  ]);
  for (let i = 0; i < upper.length - 1; i++) {
    face(out, 'masonry', [shoulder[i + 1], shoulder[i], upper[i], upper[i + 1]], tones.pier);
    face(out, 'masonry', [lower[i + 1], lower[i], shoulder[i], shoulder[i + 1]], tones.revetment);
  }
  const courtEdge = [
    [30, -29],
    [34, -24],
    [38, 1],
    [46, 14],
    [51, 23],
    [47, 29],
    [41, 35],
    [31, 36],
  ];
  const courtY = -0.43;
  const courtWest = -21;
  for (let i = 0; i < courtEdge.length - 1; i++) {
    const [x1, z1] = courtEdge[i];
    const [x2, z2] = courtEdge[i + 1];
    face(
      out,
      'masonry',
      [
        [courtWest, courtY, z1],
        [courtWest, courtY, z2],
        [x2, courtY, z2],
        [x1, courtY, z1],
      ],
      tones.paving,
    );
  }
  const banks = orientedRing([[courtWest, -29], [courtWest, 36], ...[...courtEdge].reverse()]);
  if (lod > 0) wallBand(out, 'masonry', banks, -6.4, -0.51, tones.foundation);
  if (lod > 0) {
    for (const [x, z, width] of plan.buttresses) {
      const pier = transform(out, Math.PI / 2, [x, 0, z]);
      const ring = (y, depth, width) => [
        [-width, y, -0.81],
        [-width, y, depth],
        [width, y, depth],
        [width, y, -0.81],
      ];
      loft(
        pier,
        'masonry',
        [
          ring(bottom + 0.22, 5.09, width),
          ring(-5.4, 3.01, width * 0.76),
          ring(1.91, 0.45, width * 0.58),
        ],
        tones.pier,
      );
    }
  }
}

function turret(out, x, z, ground, height, radius, lod, rounded) {
  const sides = rounded ? (lod === 0 ? 8 : 12) : 4;
  const center = [x, z];
  const tower = (y, size) => radialRing(y, size, size, sides, center, rounded ? 0 : Math.PI / 4);
  loft(out, 'plaster', [tower(ground, radius), tower(height, radius)], tones.plaster);
  loft(
    out,
    'stone',
    [tower(height - 2, radius * 1.035), tower(height - 1.82, radius * 1.035)],
    tones.molding,
    { cap: false },
  );
  if (lod > 0) {
    for (let i = 0; i < (rounded ? 6 : 4); i++) {
      const angle = (2 * Math.PI * i) / (rounded ? 6 : 4);
      const face = transform(out, angle, [
        x + Math.sin(angle) * radius * (rounded ? 1.038 : 0.72),
        0,
        z + Math.cos(angle) * radius * (rounded ? 1.038 : 0.72),
      ]);
      window(face, 0, height - 1.64, 0.84, 1.38, lod);
    }
  }
  loft(
    out,
    'roof',
    [
      tower(height, radius * 1.15),
      tower(height + 0.18, radius * 1.12),
      tower(height + 1.42, radius * 0.66),
      tower(height + 2.21, Math.max(0.14, radius * 0.16)),
    ],
    tones.roof,
  );
  cross(out, x, height + 2.18, z, 0.53, lod);
}

function build(out, lod) {
  retainingWall(out, lod);
  rangeWalls(out, lod);
  church(out, lod);
  const towerCenter = [0, 1].map(
    (axis) => towerTrace.reduce((sum, point) => sum + point[axis], 0) / towerTrace.length,
  );
  turret(out, ...towerCenter, -0.76, 12.65, 3.03, lod, true);
  turret(out, 45.4, 26.63, 4.98, 10.76, 2.28, lod, false);
  if (lod > 0) turret(out, 35.7, 1.2, 7.36, 12.15, 1.88, lod, true);
}

export const coziaSkyline = (out) => build(out, 0);
export const coziaDistrict = (out) => build(out, 1);
export const coziaStreet = (out) => build(out, 2);
export const coziaCloseup = (out) => build(out, 3);

const recipe = 'cozia-monastery-model.mjs';
const camera = [94, 41, 58];
const lookAt = [14, 5.8, 0];
export const coziaModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  recipe,
  recipeDependencies: ['heritage-tower-detail-mesh.mjs'],
  surfaces,
  category: 'landmark',
  build: coziaCloseup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'Cozia Monastery above the Olt, with a trilobed stone church, tall drum, pale monastic wings, gray-green roofs and riverbank buttresses as documented in 2009.',
  appearance: {
    kind: 'historical',
    representedDate: plan.representedDate,
    validFrom: plan.validFrom,
    validUntil: plan.validUntil,
    currentWorldEligible: false,
  },
  camera,
  lookAt,
  sunDirection: [44, 50, 27],
  mediumFiContext: {
    scale: 1,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: [
    'stone_ashlar',
    'stone_limestone_raw',
    'brick',
    'plaster_lime',
    'metal_standing_seam',
  ],
  qaCameras: [
    { name: 'olt-riverfront-and-buttresses', position: [94, 5.6, 35], lookAt: [27, 4, 0] },
    { name: 'church-porch-and-trilobed-sanctuary', position: [-34, 12, 19], lookAt: [1, 7, 0] },
    { name: 'domed-drum-and-monastery-court', position: [-20, 29, -13], lookAt: [13, 6, 0] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'olt-frontage-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `content/worldgen/source/places/${plan.cell}/${plan.model}/models/${recipe}`,
    level: 'skyline',
    export: 'coziaSkyline',
    errorMeters: 0.48,
    surfaces,
    authoredLevels: Object.fromEntries(
      [
        ['district', 'coziaDistrict', 0.25],
        ['street', 'coziaStreet', 0.095],
        ['closeup', 'coziaCloseup', 0.041],
      ].map(([level, name, errorMeters]) => [level, { export: name, errorMeters, surfaces }]),
    ),
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original geometry under repository license. Public-domain photographs and album plates already on Qualla. Native OpenStreetMap data under ODbL 1.0.',
};
