import fs from 'node:fs';
import {
  beam,
  beamPath,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  abox,
  extrude,
  lathe,
  rgb,
  tri,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';

const plan = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url)));
const frame = JSON.parse(fs.readFileSync(new URL('../map-frame.json', import.meta.url)));
const { foundation, boulderHeight, spireHeight, deckY } = plan.dimensions;
const tau = 2 * Math.PI;
const surfaces = {
  leaf: { slot: 'wall', localRef: 'palette:#ffffff', roughness: 0.57, metallic: 0.33 },
  spire: { slot: 'roof', localRef: 'palette:#ffffff', roughness: 0.46, metallic: 0.31 },
  rock: { slot: 'foundation', graph: 'stone_sandstone', roughness: 0.98 },
  deck: { slot: 'wall', graph: 'stone_limestone', roughness: 0.91 },
  wall: { slot: 'foundation', graph: 'stone_ashlar', roughness: 0.98 },
  rail: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.62, metallic: 0.18 },
};
const leafTone = rgb('c18f30');
const brightGold = rgb('d5a641');
const darkGold = rgb('966324');
const railTone = rgb('c29c53');
const granite = rgb('5b4e44');
const pavement = rgb('c8bbab');
const masonry = rgb('755b48');
const sienna = rgb('9a694f');
const shade = ([r, g, b], w) => [r * w, g * w, b * w];

// Elevation, center, and principal radii describe the two observed silhouettes.
// The underside narrows to its eastward contact while the west face overhangs.
const boulderSections = [
  [-0.09, 0.18, -0.16, 0.55, 0.52],
  [0.15, -0.6, 0.11, 1.64, 1.25],
  [0.51, -1.38, 0.32, 2.72, 2.15],
  [1.1, -1.57, 0.43, 3.46, 2.78],
  [1.95, -1.44, 0.32, 3.94, 3.13],
  [2.88, -1.18, 0.15, 4.36, 3.45],
  [3.86, -0.94, -0.03, 4.48, 3.63],
  [4.8, -0.78, -0.14, 4.29, 3.45],
  [5.65, -0.55, -0.37, 3.82, 3.1],
  [6.36, -0.37, -0.51, 3.22, 2.55],
  [6.95, -0.49, -0.7, 2.41, 1.93],
  [7.35, -0.58, -0.72, 1.72, 1.43],
  [boulderHeight, -0.65, -0.7, 1.26, 1.21],
];

function boulderRing([y, x, z, rx, rz], row, sides, lod) {
  return Array.from({ length: sides }, (_, i) => {
    const t = (i * tau) / sides - 0.11;
    const taper = Math.min(1, rx / 3);
    const lobes =
      1 + (0.069 * Math.sin(3 * t + 0.53 * row) + 0.032 * Math.cos(5 * t - 0.4 * row)) * taper;
    const small = lod >= 2 ? 0.021 * Math.sin(11 * t + 0.83 * row) * taper : 0;
    return [
      x + rx * Math.cos(t) * (lobes + small),
      y + 0.18 * Math.sin(t + row * 0.21) * taper + 0.11 * Math.sin(t * 4 - 0.35 * row) * taper,
      z + rz * Math.sin(t) * (lobes + small),
    ];
  });
}

function closedRings(out, slot, rings, color, variance) {
  const sides = rings[0].length;
  for (let j = 0; j + 1 < rings.length; j++) {
    for (let i = 0; i < sides; i++) {
      const next = (i + 1) % sides;
      const a = rings[j][i];
      const b = rings[j + 1][i];
      const c = rings[j + 1][next];
      const d = rings[j][next];
      const tone =
        1 + variance * (0.68 * Math.sin(i * 1.83 + j * 1.1) + 0.32 * Math.cos(i * 2.63 - j * 1.21));
      tri(out, slot, a, b, c, shade(color, tone));
      tri(out, slot, a, c, d, shade(color, tone * (1 - variance * 0.12)));
    }
  }
  // The upper rings are nearly level. A center anchor keeps crown and ledge facets continuous.
  const top = rings.at(-1);
  const center = top.reduce((sum, p) => sum.map((v, i) => v + p[i] / sides), [0, 0, 0]);
  for (let i = 0; i < sides; i++) {
    tri(out, slot, center, top[(i + 1) % sides], top[i], color);
  }
}

function boulder(out, lod) {
  const rows = [
    [0, 2, 4, 6, 8, 10, 12],
    [0, 1, 3, 5, 7, 9, 11, 12],
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
  ][lod];
  const sections = rows.map((row) => ({ row, section: boulderSections[row] }));
  if (lod === 3) {
    for (let i = sections.length - 1; i > 0; i--) {
      const low = sections[i - 1].section;
      const high = sections[i].section;
      sections.splice(i, 0, {
        row: i - 0.5,
        section: low.map((value, j) => (value + high[j]) / 2),
      });
    }
  }
  const sides = [12, 24, 40, 64][lod];
  const rings = sections.map(({ row, section }) => boulderRing(section, row, sides, lod));
  closedRings(out, 'leaf', rings, leafTone, [0.06, 0.09, 0.13, 0.15][lod]);
}

function outcrop(out, lod) {
  const sides = [9, 12, 19, 25][lod];
  const ring = (x, y, z, rx, rz, offset) =>
    Array.from({ length: sides }, (_, i) => {
      const t = (i * tau) / sides + offset;
      const swell = 1 + 0.13 * Math.cos(t * 3 + 0.2) + 0.07 * Math.sin(t * 5 - offset);
      return [
        x + rx * Math.cos(t) * swell,
        y - 0.76 * Math.sin(t - 0.15) + 0.45 * Math.sin(t * 4 + offset),
        z + rz * Math.sin(t) * swell,
      ];
    });
  closedRings(
    out,
    'rock',
    [
      ring(-1.05, foundation, 1.85, 5.02, 4.89, 0),
      ring(-1.87, -5.1, 1.5, 5.48, 4.42, 0.02),
      ring(-1.4, -2.45, 0.85, 5.29, 4.16, -0.03),
      ring(-0.6, -0.53, 0.44, 4.15, 3.3, 0.01),
      ring(0.15, -0.03, 0.02, 1.42, 1.39, 0.02),
    ],
    granite,
    0.21,
  );
}

const stupaProfile = [
  [0, 1.35],
  [0.35, 1.48],
  [0.49, 1.49],
  [0.62, 1.59],
  [0.75, 1.58],
  [0.85, 1.36],
  [1.02, 1.29],
  [1.23, 1.08],
  [1.48, 0.95],
  [1.58, 0.93],
  [1.63, 1.02],
  [1.79, 1.02],
  [1.88, 0.88],
  [2.17, 0.74],
  [2.45, 0.56],
  [2.69, 0.4],
  [2.81, 0.54],
  [2.92, 0.54],
  [3.2, 0.42],
  [3.53, 0.31],
  [3.78, 0.25],
  [4.08, 0.16],
  [4.26, 0.22],
  [4.43, 0.26],
  [4.54, 0.16],
  [4.82, 0.17],
  [5.03, 0.14],
  [5.3, 0.26],
  [5.4, 0.25],
  [5.7, 0.17],
  [6.25, 0.11],
  [6.64, 0.076],
  [6.91, 0.061],
  [7.08, 0.04],
  [spireHeight, 0],
];

function stupa(out, lod) {
  const base = boulderHeight - 0.09;
  const center = [-0.65, -0.7];
  const samples =
    lod === 0
      ? [0, 3, 5, 8, 11, 14, 16, 19, 21, 23, 26, 28, 30, 34].map((j) => stupaProfile[j])
      : stupaProfile;
  const sides = [12, 22, 32, 46][lod];
  const surface = (profile, tone) =>
    lathe(
      out,
      'spire',
      center,
      profile.map(([y, r]) => [base + y, r, r]),
      sides,
      tone,
    );
  surface(samples, brightGold);
  surface(
    [
      [4.51, 0.16],
      [4.61, 0.38],
      [4.72, 0.79],
      [4.8, 0.87],
      [4.86, 0.61],
      [4.84, 0.13],
    ],
    brightGold,
  );
  if (lod < 2) return;
  for (const [y, r] of [
    [0.52, 1.53],
    [0.69, 1.61],
    [1.68, 1.04],
    [1.78, 1.04],
    [2.85, 0.56],
    [3.16, 0.46],
    [3.42, 0.37],
    [3.66, 0.318],
    [3.87, 0.258],
    [4.04, 0.216],
  ]) {
    surface(
      [
        [y - 0.024, r - 0.02],
        [y, r],
        [y + 0.033, r - 0.009],
      ],
      y > 3 ? brightGold : darkGold,
    );
  }
  const tips = lod === 3 ? 24 : 14;
  for (let i = 0; i < tips; i++) {
    const t = (i * tau) / tips;
    const u = Math.cos(t);
    const v = Math.sin(t);
    const point = (r, y) => [center[0] + r * u, base + y, center[1] + r * v];
    beamPath(
      out,
      'spire',
      [point(0.5, 4.79), point(0.86, 4.83), point(0.98, 4.98)],
      0.018,
      0.019,
      brightGold,
    );
    beam(out, 'spire', point(0.84, 4.81), point(0.86, 4.71), 0.018, 0.022, darkGold);
  }
}

const nearDeck = [
  [-1.15, 1.51],
  [2.52, 0.83],
  [5.3, 1.06],
  [7.47, -0.57],
  [8.85, -0.95],
  [8.86, 2.58],
  [6.36, 4.13],
  [2.23, 4.82],
  [-0.87, 3.68],
];
const platform = [
  [8.35, -4.36],
  [12.27, -6.35],
  [19.63, -6.82],
  [22.63, -4.0],
  [22.63, 3.18],
  [18.97, 5.24],
  [12.07, 4.57],
  [8.61, 2.77],
];

function railLine(out, line, lod, ornamental = false) {
  const top = 1.04;
  const raised = (p, h) => [p[0], p[1] + h, p[2]];
  beamPath(
    out,
    'rail',
    line.map((p) => raised(p, top)),
    0.06,
    0.066,
    railTone,
  );
  if (lod === 0) return;
  beamPath(
    out,
    'rail',
    line.map((p) => raised(p, 0.16)),
    0.06,
    0.055,
    railTone,
  );
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1];
    const b = line[i];
    const length = Math.hypot(b[0] - a[0], b[2] - a[2]);
    const count = Math.max(1, Math.round(length / 1.17));
    const at = (k, h) => a.map((v, axis) => v + ((b[axis] - v) * k) / count + (axis === 1 ? h : 0));
    for (let j = 0; j < (i === line.length - 1 ? count + 1 : count); j++) {
      beam(out, 'rail', at(j, -0.04), at(j, top + 0.08), 0.074, 0.079, railTone);
    }
    if (lod < 2) continue;
    for (let j = 0; j < count; j++) {
      if (ornamental && lod === 3 && length / count > 0.8) {
        const focal = at(j + 0.5, 0.6);
        const ring = [];
        for (let k = 0; k < 10; k++) {
          const t = (k * tau) / 10;
          const edge = at(j + 0.5 + 0.33 * Math.cos(t), 0.6 + 0.33 * Math.sin(t));
          ring.push(edge);
          beam(out, 'rail', focal, edge, 0.017, 0.019, railTone);
        }
        beamPath(out, 'rail', ring, 0.022, 0.025, railTone, true);
      } else {
        for (const f of [0.29, 0.53, 0.77])
          beam(out, 'rail', at(j + f, 0.15), at(j + f, top), 0.028, 0.034, railTone);
      }
    }
  }
}

function pavedSlab(out, outline, floor, top, sideColor, faceColor) {
  extrude(out, 'wall', outline, floor, top, sideColor, { top: false });
  const ids = earcut(outline.flat(), [], 2);
  const points = outline.map(([x, z]) => [x, top, z]);
  for (let i = 0; i < ids.length; i += 3) {
    tri(out, 'deck', points[ids[i]], points[ids[i + 2]], points[ids[i + 1]], faceColor);
  }
}

function ledgeAccess(out, lod) {
  pavedSlab(out, nearDeck, deckY - 0.42, deckY, sienna, pavement);
  pavedSlab(out, platform, -3.15, deckY + 0.31, masonry, pavement);
  extrude(out, 'wall', platform, deckY + 0.11, deckY + 0.22, sienna, { top: false });
  extrude(
    out,
    'wall',
    [
      [-0.7, 2.3],
      [2.2, 3.73],
      [5.3, 3.49],
      [5.48, 2.6],
      [1.86, 1.51],
    ],
    -3.8,
    deckY - 0.36,
    masonry,
    { top: false },
  );
  railLine(
    out,
    [nearDeck[6], nearDeck[7], nearDeck[8], nearDeck[0]].map(([x, z]) => [x, deckY, z]),
    lod,
    true,
  );
  railLine(
    out,
    [nearDeck[0], nearDeck[1], nearDeck[2], nearDeck[3], nearDeck[4]].map(([x, z]) => [
      x,
      deckY,
      z,
    ]),
    lod,
    true,
  );
  railLine(
    out,
    [platform[4], platform[5], platform[6]].map(([x, z]) => [x, deckY + 0.31, z]),
    lod,
  );
  railLine(
    out,
    [platform[0], platform[1], platform[2]].map(([x, z]) => [x, deckY + 0.31, z]),
    lod,
  );
  const yTop = deckY + 0.31;
  const yBottom = -1.93;
  const first = [8.79, 2.24];
  const last = [6.25, 11.24];
  const stairs = [4, 16, 24, 24][lod];
  const at = (t, dx = 0) => [
    first[0] + (last[0] - first[0]) * t + dx,
    first[1] + (last[1] - first[1]) * t,
  ];
  for (let j = 0; j < stairs; j++) {
    const a = j / stairs;
    const b = (j + 1) / stairs;
    const y = yTop + (yBottom - yTop) * a;
    pavedSlab(
      out,
      [at(a, -0.83), at(b, -0.83), at(b, 0.83), at(a, 0.83)],
      y - 0.68,
      y,
      masonry,
      shade(pavement, j % 4 === 0 ? 0.91 : 0.97),
    );
  }
  for (const dx of [-0.88, 0.88]) {
    railLine(
      out,
      [
        [first[0] + dx, yTop, first[1]],
        [last[0] + dx, yBottom, last[1]],
      ],
      lod,
    );
  }
  if (lod < 2) return;
  for (let j = 0; j < 6; j++) {
    const x = 12.1 + j * 1.14;
    abox(out, 'wall', [x, deckY + 0.31, 3.04], [x + 0.76, deckY + 0.5, 3.37], masonry);
    abox(out, 'rail', [x - 0.015, deckY + 0.49, 3.03], [x + 0.775, deckY + 0.55, 3.38], darkGold);
  }
}

function build(out, lod) {
  outcrop(out, lod);
  ledgeAccess(out, lod);
  boulder(out, lod);
  stupa(out, lod);
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'kyaiktiyo-pagoda-model.mjs';
const camera = [-27, 14, -31];
const lookAt = [2.2, 4.8, 0.5];
export const model = {
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
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'Myanmar’s Golden Rock at Kyaiktiyo, with its crown stupa, cliff ledge and guarded approach.',
  camera,
  lookAt,
  sunDirection: [-20, 42, -32],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: [
    ...new Set(Object.values(surfaces).flatMap(({ graph }) => graph ?? [])),
  ],
  recipeDependencies: [
    'place-recipe-kit.mjs',
    'authored-structure-mesh.mjs',
    'polygon-triangulation.mjs',
  ],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'golden-rock-from-approach', position: [24, 10, -19], lookAt: [1.9, 5.2, -0.5] },
    { name: 'cliff-edge-and-crown-stupa', position: [-26, 7, 17], lookAt: [-1.9, 5.6, 0] },
    { name: 'guarded-bridge-and-pilgrim-steps', position: [20, 11, 17], lookAt: [6, 2.05, 1.7] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'kyaiktiyo-pagoda-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.66,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.28, surfaces },
      street: { export: 'street', errorMeters: 0.1, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.036, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original mesh under repository license. © OpenStreetMap contributors. Mapzen open elevation.',
};
