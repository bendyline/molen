import { readFileSync } from 'node:fs';
import {
  abox,
  extrude,
  facade,
  fan,
  fbox,
  quad4,
  rgb,
  roundArch,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import { face } from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';

const read = (name) => JSON.parse(readFileSync(new URL('../' + name + '.json', import.meta.url)));
const frame = read('map-frame');
const plan = read('plan-controls');
const outline = frame.geometry.outline;
const court = frame.geometry.holes[0];

const brick = rgb('a97c62');
const shadeBrick = rgb('986e58');
const limed = rgb('cebea0');
const frames = rgb('d8d0bb');
const tile = rgb('837066');
const lightTile = rgb('927a6a');
const darkTile = rgb('786961');
const glass = rgb('606765');
const shutters = rgb('606756');
const portal = rgb('635547');
const copper = rgb('7f8f82');
const shell = rgb('a59b86');
const surfaces = {
  brick: { slot: 'wall', graph: 'brick_flemish', roughness: 0.94 },
  trim: { slot: 'trim', graph: 'stone_limestone', roughness: 0.91 },
  tile: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.94 },
  timber: { slot: 'trim', graph: 'wood_painted_lap', roughness: 0.88 },
  copper: { slot: 'roof', graph: 'metal_copper', roughness: 0.86, metallic: 0.16 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.65 },
};
const ranges = [
  {
    // The lower Groot Heiligland range, parallel to the street.
    ring: [
      [-23.0, 28.3],
      [23.17, 28.35],
      [22.23, 14.905],
      [-23.48, 14.636],
    ],
    eave: 5.83,
    ridge: 9.23,
    tint: brick,
    tiles: tile,
  },
  {
    ring: [
      [25.42, -22.39],
      [25.78, 10.86],
      [17.996, 15.1],
      [17.536, -17.6],
    ],
    eave: 7.12,
    ridge: 11.42,
    tint: brick,
    tiles: tile,
  },
  {
    ring: [
      [-24.03, 17.0],
      [-29.46, -24.59],
      [-18.584, -24.52],
      court[0],
    ],
    eave: 7.18,
    ridge: 11.48,
    tint: shadeBrick,
    tiles: lightTile,
  },
  {
    // The higher regents' range has a level cornice above the second row of windows.
    ring: [
      court[1],
      court[2],
      [18.24, -24.4],
      [-18.08, -24.63],
    ],
    eave: 8.38,
    ridge: 12.45,
    tint: brick,
    tiles: lightTile,
  },
  {
    ring: [
      [-6.52, -24.63],
      [15.38, -23.95],
      [15.17, -30.06],
      [-6.29, -30.58],
    ],
    eave: 5.48,
    ridge: 8.23,
    tint: shadeBrick,
    tiles: darkTile,
  },
];

function box(out, material, x0, x1, z0, z1, y0, y1, tint) {
  abox(out, material, [x0, y0, z0], [x1, y1, z1], tint, { bottom: false });
}

function panel(out, material, wall, u0, u1, y0, y1, depth, tint) {
  quad4(
    out,
    material,
    wall.P(u0, y0, depth),
    wall.P(u1, y0, depth),
    wall.P(u1, y1, depth),
    wall.P(u0, y1, depth),
    tint,
  );
}

function sash(out, wall, u, bottom, width, height, lod, { arched = false, closed = false } = {}) {
  const l = u - width / 2,
    r = u + width / 2;
  const t = bottom + height;
  const margin = 0.105;
  panel(out, 'timber', wall, l - margin, r + margin, bottom - margin, t + margin, 0.035, frames);
  panel(out, 'glass', wall, l, r, bottom, t, 0.052, glass);
  panel(out, 'timber', wall, u - 0.045, u + 0.045, bottom, t, 0.067, frames);
  if (height > 1.8)
    panel(
      out,
      'timber',
      wall,
      l,
      r,
      bottom + height * 0.57,
      bottom + height * 0.57 + 0.095,
      0.067,
      frames,
    );
  if (lod >= 2) {
    for (const x of [u - width * 0.25, u + width * 0.25])
      panel(out, 'timber', wall, x - 0.018, x + 0.018, bottom, t, 0.072, frames);
    for (const v of [0.22, 0.41, 0.78])
      panel(
        out,
        'timber',
        wall,
        l,
        r,
        bottom + height * v,
        bottom + height * v + 0.035,
        0.073,
        frames,
      );
  }
  if (closed) {
    for (const [a, b] of [
      [l - 0.52, l - 0.1],
      [r + 0.1, r + 0.52],
    ]) {
      fbox(out, 'timber', wall, a, b, bottom, bottom + height * 0.53, 0.023, 0.108, shutters);
      if (lod === 3)
        panel(
          out,
          'timber',
          wall,
          a + 0.074,
          b - 0.074,
          bottom + 0.16,
          bottom + height * 0.46,
          0.12,
          rgb('707663'),
        );
    }
  }
  if (!arched) return;
  const arch = roundArch(width / 2 + 0.135, lod >= 2 ? 8 : 4);
  const to3 = ([x, y], dx = 0, dy = 0) => wall.P(u + x + dx, t + 0.09 + y * 0.42 + dy, 0.067);
  for (let i = 0; i < arch.length - 1; i++) {
    const a = arch[i],
      b = arch[i + 1];
    const z = i < arch.length / 2 ? -0.05 : 0.05;
    face(
      out,
      'trim',
      [to3(a), to3(b), to3(b, z, 0.13), to3(a, z, 0.13)],
      [wall.normal[0], 0, wall.normal[1]],
      i % 2 ? limed : frames,
    );
  }
}

function rangeRoof(out, { ring, eave, ridge, tint, tiles }) {
  const [a, b, c, d] = ring;
  const at = ([x, z], y) => [x, y, z];
  const midpoint = ([x, z], [u, v]) => [(x + u) * 0.5, (z + v) * 0.5];
  const p = at(midpoint(a, d), ridge),
    q = at(midpoint(b, c), ridge);
  face(out, 'tile', [at(a, eave), at(b, eave), q, p], [0, 1, 0], tiles);
  face(out, 'tile', [at(c, eave), at(d, eave), p, q], [0, 1, 0], tile);
  for (const [u, v, tip] of [
    [a, d, p],
    [c, b, q],
  ]) {
    const f = wallFace(u, v);
    face(out, 'brick', [at(u, eave), at(v, eave), tip], [f.normal[0], 0, f.normal[1]], tint);
  }
}

function gableOrnament(out, wall, x, base, w, rise, lod) {
  const steps = lod < 2 ? 3 : 5;
  for (let i = 0; i < steps; i++) {
    const y0 = base + (i * rise) / steps,
      y1 = y0 + rise / steps;
    const half = w / 2 - (i * w) / (2 * (steps + 0.2));
    fbox(out, 'brick', wall, x - half, x + half, y0, y1, -0.74, 0.39, brick);
    fbox(out, 'trim', wall, x - half - 0.08, x + half + 0.08, y1 - 0.12, y1, -0.8, 0.46, limed);
  }
  if (lod > 0) {
    const f = facade([wall.P(x, 0, 0.42)[0], wall.P(x, 0, 0.42)[2]], wall.along);
    sash(out, f, 0, base + 0.21, w * 0.27, rise * 0.43, lod, { arched: true });
  }
}

function surround(out, wall, center, height, width, lod) {
  const l = center - width / 2,
    r = center + width / 2;
  const arch = roundArch(width * 0.42, lod > 1 ? 10 : 6).reverse();
  const w = width * 0.42;
  const crest = height - w;
  fan(
    out,
    'glass',
    [[-w, 0.22], [w, 0.22], ...arch.map(([x, y]) => [x, crest + y])].map(([x, y]) =>
      wall.P(center + x, y, 0.083),
    ),
    portal,
  );
  for (const [a, b] of [
    [l - 0.26, l + 0.14],
    [r - 0.14, r + 0.26],
  ]) {
    fbox(out, 'trim', wall, a, b, 0.22, height + 0.15, -0.09, 0.4, limed);
    fbox(out, 'trim', wall, a - 0.11, b + 0.11, 0.15, 0.55, -0.13, 0.48, frames);
  }
  fbox(out, 'trim', wall, l - 0.49, r + 0.49, height - 0.14, height + 0.24, -0.1, 0.55, frames);
  if (lod >= 2) {
    for (const x of [
      center - width * 0.3,
      center - width * 0.15,
      center,
      center + width * 0.15,
      center + width * 0.3,
    ])
      panel(out, 'timber', wall, x - 0.028, x + 0.028, crest - 0.75, crest + 0.18, 0.107, frames);
  }
}

function streetFront(out, lod) {
  const f0 = wallFace(...ranges[0].ring.slice(0, 2));
  // The archived street face has two lower rows in a single tall sash, with green shutters.
  const center = 24.17;
  surround(out, f0, center, 5.66, 3.0, lod);
  fbox(out, 'trim', f0, center - 1.59, center + 1.59, 6.28, 6.68, -0.62, 0.53, limed);
  fbox(out, 'brick', f0, center - 1.44, center + 1.44, 5.65, 6.34, -0.66, 0.39, brick);
  if (lod >= 1) {
    for (const u of [
      1.9, 5.12, 8.35, 11.57, 14.8, 18.02, 21.25, 27.21, 30.41, 33.62, 36.84, 40.04, 43.21,
    ]) {
      sash(out, f0, u, 0.86, 1.76, 3.4, lod, { arched: true, closed: true });
    }
    fbox(out, 'trim', f0, 0.11, f0.length - 0.11, 5.47, 5.72, -0.02, 0.13, limed);
    for (const u of [9.25, 17.35, 30.95, 39.8]) gableOrnament(out, f0, u, 5.7, 2.85, 2.18, lod);
  }
  if (lod >= 2) {
    fbox(out, 'trim', f0, center - 0.53, center + 0.53, 6.68, 6.84, -0.19, 0.37, frames);
    fbox(out, 'trim', f0, center - 0.18, center + 0.18, 6.83, 7.65, -0.09, 0.19, limed);
    fbox(out, 'trim', f0, center - 0.14, center + 0.14, 7.65, 7.93, -0.08, 0.18, frames);
  }
}

function courtyard(out, lod) {
  const boundaries = [
    wallFace(court[1], court[2]),
    wallFace(court[0], court[1]),
    wallFace(court[2], court[3]),
    wallFace(court[3], court[0]),
  ];
  const rear = facade([-0.5, -15.575], [1, 0.004]);
  gableOrnament(out, rear, 0, 8.2, 6.85, 3.25, lod);
  surround(out, rear, 0, 5.83, 2.6, lod);
  if (lod === 0) return;
  for (const [i, f] of boundaries.entries()) {
    const count = i === 3 ? 11 : i === 0 ? 11 : 10;
    for (let n = 0; n < count; n++) {
      const u = ((n + 0.5) * f.length) / count;
      if ((i === 0 || i === 3) && Math.abs(u - f.length / 2) < 1.7) continue;
      const tall = i === 0 ? 4.45 : i === 3 ? 3.05 : 4.05;
      sash(out, f, u, 0.88, 1.83, tall, lod, { arched: true });
      if (i === 0 || (i !== 3 && lod >= 2))
        sash(out, f, u, i === 0 ? 5.95 : 5.36, 1.42, 1.35, lod, { arched: i === 0 });
    }
    const eave = [8.38, 7.18, 7.12, 5.83][i];
    fbox(out, 'trim', f, 0.25, f.length - 0.25, eave - 0.21, eave - 0.05, -0.09, 0.2, limed);
  }
  if (lod >= 2) {
    for (const x of [-13.6, -9.3, -5.8, 5.6, 9.1, 12.9]) {
      box(out, 'tile', x - 0.68, x + 0.68, -18.1, -16.9, 9.26, 10.59, tile);
      sash(out, facade([x, -16.87], [1, 0]), 0, 9.44, 0.72, 0.84, lod);
    }
  }
}

function lantern(out, lod) {
  const x = -0.58,
    z = -19.55;
  const h = 12.45;
  box(out, 'brick', x - 1.2, x + 1.2, z - 1.21, z + 1.21, h - 0.35, 13.91, brick);
  box(out, 'trim', x - 1.25, x + 1.25, z - 1.25, z + 1.25, 13.74, 14.09, limed);
  const n = lod > 0 ? 8 : 6;
  const tier = (radius, height) =>
    Array.from({ length: n }, (_, i) => {
      const a = (2 * Math.PI * i) / n;
      return [x + radius * Math.cos(a), height, z + radius * Math.sin(a)];
    });
  const lower = tier(0.95, 14.48);
  extrude(
    out,
    'tile',
    lower.map(([a, , b]) => [a, b]),
    14.03,
    14.48,
    tile,
    { top: false },
  );
  face(out, 'tile', lower, [0, 1, 0], tile);
  for (let i = 0; i < n; i++) {
    const a = (2 * Math.PI * i) / n,
      cx = x + 0.72 * Math.cos(a),
      cz = z + 0.72 * Math.sin(a);
    box(out, 'timber', cx - 0.079, cx + 0.079, cz - 0.079, cz + 0.079, 14.43, 16.49, frames);
  }
  const roof = [
    [0.98, 16.44],
    [0.89, 16.68],
    [0.61, 17.19],
    [0.23, 17.61],
  ].map(([radius, y]) => tier(radius, y));
  for (let j = 0; j < roof.length - 1; j++) {
    for (let i = 0; i < n; i++) {
      const k = (i + 1) % n;
      face(
        out,
        'copper',
        [roof[j][i], roof[j][k], roof[j + 1][k], roof[j + 1][i]],
        [0, 1, 0],
        copper,
      );
    }
  }
  face(out, 'copper', roof.at(-1), [0, 1, 0], copper);
  box(out, 'copper', x - 0.066, x + 0.066, z - 0.066, z + 0.066, 17.6, 18.17, copper);
}

function modelMesh(out, lod) {
  extrude(out, 'brick', outline, -0.42, 0.53, shell, { holes: [court], top: false });
  for (const [i, range] of ranges.entries()) {
    extrude(out, 'brick', range.ring, 0.50, range.eave, range.tint, { top: false });
    rangeRoof(out, range);
    if (lod >= 2) {
      for (const end of [0, 2]) {
        const f = wallFace(range.ring[end], range.ring[end + 1]);
        fbox(
          out,
          'trim',
          f,
          0.058,
          f.length - 0.058,
          range.eave - 0.18,
          range.eave + 0.03,
          -0.14,
          0.11,
          limed,
        );
      }
    }
    if (lod > 1 && i === 4)
      for (const x of [-2, 2.5, 7, 11.5])
        sash(out, facade([x, -30.34], [-1, 0]), 0, 1.65, 1.2, 2.33, lod);
  }
  streetFront(out, lod);
  courtyard(out, lod);
  lantern(out, lod);
}

export const skyline = (out) => modelMesh(out, 0);
export const district = (out) => modelMesh(out, 1);
export const street = (out) => modelMesh(out, 2);
export const closeup = (out) => modelMesh(out, 3);
const recipe = 'frans-hals-museum-model.mjs';
const camera = [61, 40, 78],
  lookAt = [-1, 5.4, -0.5];
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'cultural',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'The Frans Hals Museum’s historic Haarlem courtyard and almshouse wings, leaded façades and lantern.',
  camera,
  lookAt,
  sunDirection: [-49, 73, 51],
  mediumFiContext: {
    scale: 1.22,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline,
    minimumCoverage: 0.9,
    basis: 'The principal current BAG museum fabric around the open courtyard.',
  },
  embeddedCanonicalGraphs: Object.values(surfaces).flatMap(({ graph }) => graph ?? []),
  recipeDependencies: [
    'place-recipe-kit.mjs',
    'montreal-museum-pavilion-geometry.mjs',
    'authored-structure-mesh.mjs',
  ],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    {
      name: 'groot-heiligland-street-shutters-and-doorway',
      position: [9, 13, 65],
      lookAt: [0, 4.5, 25],
    },
    { name: 'regents-wing-and-courtyard-lantern', position: [4, 18, 10], lookAt: [0, 7, -19] },
    { name: 'historic-quadrangle-and-courtyard', position: [-56, 61, 49], lookAt: [0, 5, 0] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'frans-hals-museum-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.71,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.36, surfaces },
      street: { export: 'street', errorMeters: 0.17, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.062, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original model from CC0 De Boer archive photographs, ODbL BAG-derived OpenStreetMap footprints, and public AHN survey data.',
};
