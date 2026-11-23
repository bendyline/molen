import fs from 'node:fs';
import {
  beam,
  beamPath,
  loft,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  abox,
  extrude,
  facade,
  fbox,
  rgb,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import {
  at,
  cap,
  face,
  mix,
  up,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';

const read = (file) => JSON.parse(fs.readFileSync(new URL('../' + file, import.meta.url)));
const plan = read('plan-controls.json');
const frame = read('map-frame.json');
const { frontBuilding } = read('native-map/snake-temple-compound-footprints.json');
const { outline } = frame.geometry;
const dimensions = plan.dimensions;
const surfaces = {
  brick: { slot: 'wall', graph: 'brick_flemish', roughness: 0.94 },
  footing: { slot: 'foundation', graph: 'stone_ashlar', roughness: 0.96 },
  paving: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.92 },
  wood: { slot: 'trim', graph: 'wood_plain', roughness: 0.91 },
  tile: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.9 },
  glaze: { slot: 'trim', graph: 'tile_glazed', roughness: 0.78 },
  door: { slot: 'door', localRef: 'palette:#ffffff', roughness: 0.9 },
  ornamental: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.89 },
};
const brick = rgb('a85b43');
const lighterBrick = rgb('ac6550');
const stone = rgb('a29e91');
const gray = rgb('87867e');
const paving = rgb('a8a194');
const timber = rgb('59403a');
const shadow = rgb('322b26');
const cinnabar = rgb('964236');
const blue = rgb('516987');
const green = rgb('507456');
const gold = rgb('c4a05d');
const cream = rgb('c8c1a7');
const tile = rgb('786762');
const slate = rgb('696863');
const oxide = rgb('965f4b');
const leaves = rgb('517347');
const courtyardY = 0.45;
const porchCenter = 1.24;

function box(out, slot, [x0, z0, x1, z1], low, high, color) {
  abox(out, slot, [x0, low, z0], [x1, high, z1], color, { bottom: false });
}

function pane(out, slot, F, a, b, low, high, depth, tone) {
  face(
    out,
    slot,
    [F.P(a, low, depth), F.P(b, low, depth), F.P(b, high, depth), F.P(a, high, depth)],
    [F.normal[0], 0, F.normal[1]],
    tone,
  );
}

function shrineWall(out, lod) {
  extrude(out, 'footing', outline, -2.75, 0.68, stone, { top: false });
  extrude(out, 'brick', outline, 0.66, dimensions.mainEaveEstimate - 0.19, brick, { top: false });
  cap(out, 'brick', outline, dimensions.mainEaveEstimate - 0.19, shadow);
  const front = facade([porchCenter, 0.948], [1, 0]);
  fbox(out, 'wood', front, -6.54, 6.38, 3.42, 4.39, -0.15, 0.18, timber);
  const doors = [
    [-4.86, 1.66],
    [-2.37, 1.68],
    [0, 2.26],
    [2.34, 1.7],
    [4.81, 1.35],
  ];
  for (const [center, w] of doors) {
    pane(out, 'door', front, center - w / 2, center + w / 2, 0.68, 3.55, 0.073, shadow);
    if (lod === 0) continue;
    fbox(
      out,
      'wood',
      front,
      center - w / 2 - 0.054,
      center - w / 2 + 0.062,
      0.66,
      3.58,
      0.05,
      0.15,
      timber,
    );
    fbox(
      out,
      'wood',
      front,
      center + w / 2 - 0.062,
      center + w / 2 + 0.054,
      0.66,
      3.58,
      0.05,
      0.15,
      timber,
    );
    if (center !== 0) {
      pane(out, 'ornamental', front, center - w * 0.39, center + w * 0.39, 2.02, 3.23, 0.085, gold);
      pane(
        out,
        'ornamental',
        front,
        center - w * 0.38,
        center + w * 0.38,
        0.91,
        1.73,
        0.091,
        cream,
      );
      if (lod > 1)
        for (let i = -3; i <= 3; i++) {
          const u = center + i * w * 0.107;
          beam(
            out,
            'wood',
            front.P(u, 2.02, 0.091),
            front.P(u + w * 0.16, 3.23, 0.092),
            0.026,
            0.025,
            timber,
          );
          beam(
            out,
            'wood',
            front.P(u, 3.23, 0.092),
            front.P(u + w * 0.16, 2.02, 0.091),
            0.026,
            0.025,
            timber,
          );
        }
    }
  }
  if (lod > 0) {
    fbox(out, 'wood', front, -3.47, 3.47, 3.12, 3.57, 0.04, 0.23, cinnabar);
    fbox(out, 'wood', front, -0.74, 0.74, 3.7, 4.13, 0.04, 0.16, gold);
    for (const [a, b] of [
      [2, 3],
      [0, 1],
      [4, 5],
      [5, 0],
    ]) {
      const wall = wallFace(outline[b], outline[a]);
      for (let u = 1.1; u < wall.length - 0.75; u += 3.22)
        pane(out, 'door', wall, u - 0.37, u + 0.37, 1.94, 3.09, 0.07, shadow);
    }
  }
}

const roofs = [
  {
    x: 1.1,
    z: -7.98,
    half: 7.08,
    span: 8.94,
    eave: 4.44,
    ridge: dimensions.mainRidgeEstimate,
    curl: 0.79,
    design: 'hall',
  },
  {
    x: -7.73,
    z: -10.13,
    half: 2.26,
    span: 7.15,
    eave: 3.76,
    ridge: 5.16,
    curl: 0.5,
    design: 'side',
  },
  {
    x: porchCenter,
    z: 2.18,
    half: 4.38,
    span: 2.55,
    eave: 4.22,
    ridge: dimensions.porchRidgeEstimate,
    curl: 0.78,
    design: 'porch',
  },
  { x: 1.14, z: 13.78, half: 6.62, span: 5.7, eave: 4.25, ridge: 6.11, curl: 0.55, design: 'side' },
];
function roofPoint(r, u, t, side) {
  const edge = Math.pow(Math.abs(u), 5);
  return [
    r.x + u * r.half * (0.89 + 0.11 * t),
    mix(r.ridge, r.eave, t) - 0.4 * Math.sin(Math.PI * t) + r.curl * edge * (0.7 + 0.3 * t),
    r.z + side * r.span * t,
  ];
}

function roof(out, r, lod) {
  const u = [
    [-1, -0.76, 0, 0.76, 1],
    [-1, -0.83, -0.52, 0, 0.52, 0.83, 1],
    [-1, -0.91, -0.75, -0.5, 0, 0.5, 0.75, 0.91, 1],
    [-1, -0.96, -0.87, -0.74, -0.54, -0.28, 0, 0.28, 0.54, 0.74, 0.87, 0.96, 1],
  ][lod];
  const t = lod === 3 ? [0, 0.17, 0.4, 0.63, 0.83, 1] : [0, 0.4, 0.73, 1];
  for (const side of [-1, 1]) {
    for (let i = 1; i < u.length; i++) {
      for (let j = 1; j < t.length; j++) {
        const points = [
          roofPoint(r, u[i - 1], t[j], side),
          roofPoint(r, u[i], t[j], side),
          roofPoint(r, u[i], t[j - 1], side),
          roofPoint(r, u[i - 1], t[j - 1], side),
        ];
        face(out, 'tile', points, up, (i + j) % 5 === 0 ? slate : tile);
        face(
          out,
          'wood',
          points.map(([x, y, z]) => [x, y - 0.16, z]),
          [0, -1, 0],
          timber,
        );
      }
    }
    const eave = u.map((f) => roofPoint(r, f, 1, side));
    if (lod === 0) beam(out, 'wood', eave[0], eave.at(-1), 0.25, 0.23, timber);
    else {
      beamPath(out, 'wood', eave, 0.3, 0.28, timber);
      beamPath(
        out,
        'glaze',
        eave.map(([x, y, z]) => [x, y + 0.09, z + side * 0.052]),
        0.11,
        0.09,
        blue,
      );
    }
    for (const tip of [-1, 1]) {
      const verge = t.map((f) => roofPoint(r, tip, f, side));
      if (lod > 0) beamPath(out, 'glaze', verge, 0.12, 0.13, blue);
      for (let k = 1; k < verge.length; k++) {
        const a = verge[k - 1],
          b = verge[k];
        const lowerA = [a[0], r.eave - 0.26, a[2]],
          lowerB = [b[0], r.eave - 0.26, b[2]];
        face(
          out,
          'brick',
          [a, b, lowerB, lowerA],
          [tip, 0, 0],
          r.design === 'porch' ? timber : oxide,
        );
      }
    }
    if (lod > 1) {
      const n = lod === 3 ? Math.floor(r.half * 7) : Math.floor(r.half * 3);
      for (let j = 1; j < n; j++) {
        const x = (j / n) * 2 - 1;
        const courses = t.map((fraction) => roofPoint(r, x, fraction, side));
        beamPath(
          out,
          'tile',
          courses.map(([a, b, c]) => [a, b + 0.019, c]),
          0.075,
          0.064,
          j % 8 === 0 ? oxide : gray,
        );
      }
    }
  }
  if (lod === 0) {
    const ends = u.map((f) => roofPoint(r, f, 0, 1));
    beam(out, 'glaze', ends[0], ends.at(-1), 0.12, 0.13, blue);
    return;
  }
  const crest = u.map((f) => roofPoint(r, f, 0, 1));
  for (const [height, tone, width] of [
    [0.055, blue, 0.22],
    [0.19, oxide, 0.15],
    [0.26, gold, 0.068],
  ])
    beamPath(
      out,
      'glaze',
      crest.map(([x, y, z]) => [x, y + height, z]),
      width,
      width,
      tone,
    );
  if (r.design !== 'side') ridgeDragons(out, r, lod);
}

function ridgeDragons(out, r, lod) {
  const h = r.design === 'porch' ? dimensions.ridgeOrnamentHeightEstimate : 0.9;
  for (const side of [-1, 1]) {
    const profile = [
      [0.9, 0],
      [0.76, 0.29],
      [0.65, 0.69],
      [0.56, 0.82],
      [0.47, 0.62],
      [0.46, 0.41],
      [0.37, 0.52],
    ];
    const path = profile.map(([u, y]) => {
      const [x, base, z] = roofPoint(r, side * u, 0, 1);
      return [x, base + 0.2 + y * h, z + (0.89 - u) * 0.35];
    });
    beamPath(out, 'glaze', path, 0.135, 0.17, green);
    if (lod < 2) continue;
    const head = path.at(-1);
    const shoulder = path[2];
    beam(
      out,
      'glaze',
      head,
      [head[0] - side * 0.21, head[1] + 0.11, head[2] + 0.04],
      0.12,
      0.15,
      blue,
    );
    beam(
      out,
      'glaze',
      head,
      [head[0] + side * 0.09, head[1] + 0.26, head[2] - 0.105],
      0.052,
      0.065,
      gold,
    );
    for (let i = 1; i < 5; i++) {
      const p = path[i];
      beam(
        out,
        'glaze',
        p,
        [p[0] + side * 0.12, p[1] + 0.13 + (i % 2) * 0.058, p[2] - 0.065],
        0.044,
        0.06,
        gold,
      );
    }
    if (lod === 3)
      for (const p of [path[1], shoulder, path[4]])
        beam(out, 'glaze', p, [p[0] - side * 0.15, p[1] - 0.15, p[2] + 0.18], 0.081, 0.074, blue);
  }
  const [x, y, z] = roofPoint(r, 0, 0, 1);
  loft(
    out,
    'glaze',
    [
      [0.2, 0.22],
      [0.32, 0.21],
      [0.51, 0.13],
      [0.59, 0.064],
    ].map(([a, b]) => radialRing(y + a, b, b, 6, [x, z])),
    gold,
  );
}

function porch(out, lod) {
  box(out, 'footing', [-3.59, 0.23, 6.08, 4.5], -0.42, courtyardY + 0.11, gray);
  box(out, 'paving', [-4.63, 0.45, 7.31, 7.9], -0.94, courtyardY - 0.02, paving);
  for (let i = 0; i < 3; i++)
    box(
      out,
      'footing',
      [-4.68 + i * 0.05, 7.86 - i * 0.32, 7.35 - i * 0.05, 8.89 - i * 0.31],
      -1.0,
      courtyardY - 0.54 + i * 0.16,
      stone,
    );
  for (const x of [porchCenter - 2.92, porchCenter + 2.91]) {
    box(out, 'footing', [x - 0.24, 3.5, x + 0.24, 4.0], 0.52, 0.83, stone);
    box(out, 'footing', [x - 0.17, 3.59, x + 0.17, 3.92], 0.83, 2.46, stone);
    box(out, 'wood', [x - 0.16, 3.6, x + 0.16, 3.91], 2.46, 4.56, timber);
    if (lod > 0) {
      for (const [low, w] of [
        [4.03, 0.29],
        [4.18, 0.45],
        [4.3, 0.61],
      ])
        box(out, 'wood', [x - w, 3.46, x + w, 4.05], low, low + 0.14, cinnabar);
      beam(
        out,
        'ornamental',
        [x, 4.05, 3.92],
        [x + Math.sign(porchCenter - x) * 0.49, 4.26, 4.07],
        0.11,
        0.13,
        gold,
      );
    }
  }
  box(out, 'wood', [-2.96, 3.46, 5.48, 4.26], 4.19, 4.51, timber);
  if (lod < 2) return;
  box(out, 'wood', [0.53, 1.83, 1.95, 2.47], 0.56, 1.48, cinnabar);
  box(out, 'ornamental', [0.49, 1.77, 2.0, 2.52], 1.49, 1.57, gold);
  const pots = [
    [-2.68, 5.11],
    [5.32, 5.2],
  ];
  for (const center of pots) {
    loft(
      out,
      'footing',
      [
        [0.43, 0.34],
        [0.54, 0.42],
        [1.01, 0.45],
      ].map(([y, r]) => radialRing(y, r, r, 8, center)),
      stone,
    );
    loft(
      out,
      'ornamental',
      [
        [0.97, 0.18],
        [1.16, 0.45],
        [1.38, 0.52],
        [1.61, 0.39],
        [1.69, 0.19],
      ].map(([y, r]) => radialRing(y, r, r, 9, center)),
      leaves,
    );
    if (lod === 3)
      loft(
        out,
        'ornamental',
        [
          [1.56, 0.14],
          [1.69, 0.31],
          [1.88, 0.39],
          [2.03, 0.23],
          [2.07, 0.09],
        ].map(([y, r]) => radialRing(y, r, r, 8, center)),
        leaves,
      );
  }
}

function frontRange(out, lod) {
  const ring = frontBuilding.local;
  extrude(out, 'footing', ring, -0.69, 1.2, gray, { top: false });
  extrude(out, 'brick', ring, 1.18, 4.29, lighterBrick, { top: false });
  cap(out, 'brick', ring, 4.29, shadow);
  const F = wallFace(ring[1], ring[0]);
  for (const t of [0.26, 0.5, 0.74]) {
    const c = F.length * t;
    pane(out, 'door', F, c - 0.66, c + 0.66, 1.2, 3.5, 0.032, shadow);
    if (lod > 1) pane(out, 'ornamental', F, c - 0.056, c + 0.056, 1.28, 3.37, 0.092, cream);
  }
}

function build(out, lod) {
  shrineWall(out, lod);
  frontRange(out, lod);
  for (const p of roofs) roof(out, p, lod);
  porch(out, lod);
}
export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'snake-temple-model.mjs';
const camera = [26, 18, 40];
const lookAt = [0.5, 3, -0.8];
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'religious',
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'The main Snake Temple shrine with an open timber entrance, upturned ceramic ridges, brick wings and a small paved approach.',
  surfaces,
  build: closeup,
  limitations: plan.limitations,
  camera,
  lookAt,
  sunDirection: [-23, 39, 51],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline,
    minimumCoverage: 0.9,
    basis: 'Native mapped footprint of the main northern shrine.',
  },
  embeddedCanonicalGraphs: [
    'brick_flemish',
    'stone_ashlar',
    'concrete_plain',
    'wood_plain',
    'tile_ceramic',
    'tile_glazed',
  ],
  recipeDependencies: [
    'montreal-museum-pavilion-geometry.mjs',
    'polygon-triangulation.mjs',
    'authored-structure-mesh.mjs',
    'place-recipe-kit.mjs',
  ],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    {
      name: 'courtyard-and-dragon-portico',
      position: [-4.1, 3.5, 8.02],
      lookAt: [1.24, 4.4, 1.83],
    },
    { name: 'swept-roofs-and-forecourt-building', position: [-20, 26, 30], lookAt: [0, 3, 1] },
    { name: 'front-bay-and-timber-columns', position: [12, 7.0, 7.99], lookAt: [1.35, 3.47, 1.93] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'snake-temple-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.77,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.33, surfaces },
      street: { export: 'street', errorMeters: 0.14, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.06, surfaces },
    },
  },
  sourceLicense:
    'Original mesh under repository license. © OpenStreetMap contributors. Mapzen open terrain.',
};
