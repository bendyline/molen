import { readFileSync } from 'node:fs';
import {
  abox,
  extrude,
  facade,
  fan,
  fbox,
  lathe,
  opening,
  outwardRing,
  quad4,
  rgb,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';

const read = (file) => JSON.parse(readFileSync(new URL('../' + file, import.meta.url)));
const plan = read('plan-controls.json');
const frame = read('map-frame.json');
const { localRings } = read('native-map/san-jose-museum-of-art-building-parts.json');
const surfaces = {
  sandstone: { slot: 'wall', graph: 'stone_ashlar', roughness: 0.94 },
  carved: { slot: 'trim', graph: 'stone_ashlar', roughness: 0.88 },
  slate: { slot: 'roof', graph: 'tile_flat', roughness: 0.86 },
  wall: { slot: 'wall', graph: 'concrete_panel', roughness: 0.91 },
  barrel: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.76 },
  trim: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.86 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.53 },
};
const stone = rgb('b69e72');
const ashlar = rgb('c0aa81');
const stoneDark = rgb('8f7a5d');
const pale = rgb('c9c4b1');
const slate = rgb('535253');
const metal = rgb('979c9b');
const glass = rgb('49585c');
const rail = rgb('464b49');
const clockGlass = rgb('9aa49c');

function box(out, slot, lo, hi, color) {
  abox(out, slot, lo, hi, color, { bottom: false });
}

function volume(
  out,
  slot,
  ring,
  low,
  high,
  tint,
  { roofSlot = slot, roofTint = tint, roof = true } = {},
) {
  extrude(out, slot, ring, low, high, tint, { top: false });
  if (!roof) return;
  const indices = earcut(ring.flat());
  for (let i = 0; i < indices.length; i += 3) {
    const [a, b, c] = indices.slice(i, i + 3).map((id) => [ring[id][0], high, ring[id][1]]);
    const up = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]);
    if (up > 0) tri(out, roofSlot, a, b, c, roofTint);
    else tri(out, roofSlot, a, c, b, roofTint);
  }
}

function panel(out, slot, F, u0, u1, y0, y1, d, color) {
  quad4(out, slot, F.P(u0, y0, d), F.P(u1, y0, d), F.P(u1, y1, d), F.P(u0, y1, d), color);
}

function sash(out, F, u, y, w, h, level, head = 'flat') {
  if (level === 0) {
    const half = w / 2;
    const rise = head === 'round' ? half : 0;
    panel(out, 'glass', F, u - half, u + half, y, y + h - rise, 0.055, glass);
    if (rise) {
      fan(
        out,
        'glass',
        [0, 1, 2, 3, 4].map((i) => {
          const angle = (i * Math.PI) / 4;
          return F.P(u + Math.cos(angle) * half, y + h - rise + Math.sin(angle) * rise, 0.055);
        }),
        glass,
      );
    }
    return;
  }
  opening(out, F, u, y, w, h, {
    head,
    glassSlot: 'glass',
    frameSlot: 'carved',
    glass,
    frame: ashlar,
    frameWidth: head === 'flat' ? 0.13 : 0.25,
    frameDepth: 0.12,
    mullions: level > 0 ? 1 : 0,
    transoms: level > 1 ? 1 : 0,
    mullionColor: rail,
  });
}

function archPair(out, F, u, level) {
  sash(out, F, u, 1.27, 2.1, 3.86, level, 'round');
  sash(out, F, u, 7.02, 1.31, 2.61, level);
}

function hip(out, bounds, eaves, top) {
  const [left, right, rear, front] = bounds;
  const z0 = rear + (front - rear) * 0.28;
  const z1 = front - (front - rear) * 0.29;
  const ridgeX = (left + right) / 2;
  const a = [left, eaves, rear];
  const b = [right, eaves, rear];
  const c = [right, eaves, front];
  const d = [left, eaves, front];
  const e = [ridgeX, top, z0];
  const f = [ridgeX, top, z1];
  tri(out, 'slate', a, e, b, slate);
  quad4(out, 'slate', b, e, f, c, slate);
  tri(out, 'slate', c, f, d, slate);
  quad4(out, 'slate', d, f, e, a, slate);
}

function postOffice(out, level) {
  const full = localRings[688307262];
  const footprint = outwardRing(
    full.filter((_, i) => level > 1 || i < 7 || i > 62 || i % (level === 0 ? 7 : 4) === 0),
  );
  const eaves = plan.dimensions.historicEavesEstimateM;
  volume(out, 'sandstone', footprint, -0.62, eaves, stone, {
    roofSlot: 'slate',
    roofTint: slate,
  });
  hip(out, [-34, -15.8, -16.8, 14.15], eaves - 0.02, plan.dimensions.historicHipRidgeEstimateM);
  hip(out, [-27.4, -9.03, 2.18, 19.9], eaves - 0.02, 14.15);
  const bay = [-22.945, 19.935];
  const facets = [12, 16, 24, 32][level];
  lathe(
    out,
    'slate',
    bay,
    [
      [eaves - 0.08, 3.99, 3.99],
      [eaves + 0.19, 3.99, 3.99],
      [13.46, 0.06, 0.06],
    ],
    facets,
    slate,
  );
  if (level > 0)
    lathe(
      out,
      'trim',
      bay,
      [
        [13.45, 0.075, 0.075],
        [13.96, 0.014, 0.014],
      ],
      8,
      rail,
    );

  const front = facade([-16.3, 20.255], [1, 0]);
  sash(out, front, 0, 0.56, 2.31, 4.49, level, 'round');
  sash(out, facade([-10.99, 14.257], [1, 0]), 0, 6.91, 1.34, 2.72, level);
  const west = facade([-35.174, 8.3], [0, 1]);
  for (const u of [-3.6, 0.4, 4.31]) archPair(out, west, u, level);
  const side = facade([-33.538, -7.5], [0, 1]);
  for (const u of [-6.25, -2, 2.22, 6.08]) archPair(out, side, u, level);
  if (level > 0) {
    const back = facade([-26.8, -16.904], [-1, 0]);
    for (const u of [-4.1, 0, 4.1]) sash(out, back, u, 7.12, 1.21, 2.46, level);
  }
  for (const h of level === 0 ? [5.89] : [0.7, 5.89, 6.14, 10.22]) {
    for (let i = 0; i < footprint.length; i++) {
      const F = wallFace(footprint[i], footprint[(i + 1) % footprint.length]);
      panel(out, 'carved', F, 0, F.length, h, h + (h < 6 ? 0.16 : 0.11), 0.024, ashlar);
    }
  }

  for (const u of [-0.61, 0, 0.61]) {
    const a = u * 0.94;
    const F = facade(
      [bay[0] + Math.sin(a) * 3.77, bay[1] + Math.cos(a) * 3.77],
      [Math.cos(a), -Math.sin(a)],
    );
    sash(out, F, 0, 1.42, 1.29, 3.96, level, 'round');
    sash(out, F, 0, 6.85, 1.29, 2.76, level);
  }
  const crown = [
    [-2.03, 5.14],
    [0, 7.15],
    [2.03, 5.14],
  ];
  fan(
    out,
    'carved',
    crown
      .slice()
      .reverse()
      .map(([x, y]) => front.P(x, y, 0.18)),
    ashlar,
  );
  for (const [from, to] of [
    [crown[0], crown[1]],
    [crown[1], crown[2]],
  ]) {
    quad4(
      out,
      'carved',
      front.P(...from, 0.32),
      front.P(...to, 0.32),
      front.P(to[0], to[1] + 0.18, 0.32),
      front.P(from[0], from[1] + 0.18, 0.32),
      ashlar,
    );
  }
  for (let i = 0; i < (level === 0 ? 1 : 4); i++) {
    fbox(out, 'carved', front, -1.27, 1.27, -0.1, 0.15 * (i + 1), 0, 1.12 - i * 0.232, stoneDark);
  }
}

function clock(out, F, level) {
  const y = 22.51;
  const facets = [12, 16, 24, 32][level];
  const disc = (slot, radius, depth, color) =>
    fan(
      out,
      slot,
      Array.from({ length: facets }, (_, i) => {
        const a = (i * 2 * Math.PI) / facets;
        return F.P(Math.cos(a) * radius, y + Math.sin(a) * radius, depth);
      }),
      color,
    );
  disc('carved', 1.66, 0.12, ashlar);
  disc('trim', 1.4, 0.15, rail);
  disc('glass', 1.23, 0.19, clockGlass);
  for (const [angle, length] of [
    [2.35, 0.7],
    [0.78, 1.07],
  ]) {
    const x = length * Math.cos(angle);
    const dy = length * Math.sin(angle);
    quad4(
      out,
      'trim',
      F.P(-0.065, y - 0.045, 0.22),
      F.P(0.08, y - 0.055, 0.22),
      F.P(x + 0.035, y + dy, 0.22),
      F.P(x - 0.03, y + dy, 0.22),
      rail,
    );
  }
  if (level > 0) {
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI) / 6;
      const p = (r, t) => F.P(r * Math.cos(a + t), y + r * Math.sin(a + t), 0.23);
      quad4(out, 'trim', p(0.96, -0.037), p(1.16, -0.037), p(1.16, 0.037), p(0.96, 0.037), rail);
    }
  }
}

function cornerTower(out, level) {
  const left = -33.207;
  const right = left + plan.dimensions.towerWidthM;
  const back = 11.932;
  const front = back + plan.dimensions.towerDepthM;
  const top = plan.dimensions.towerHeightM;
  box(out, 'sandstone', [left, -0.62, back], [right, top - 0.48, front], stone);
  for (const [height, width, thick] of [
    [0.72, 0.1, 0.19],
    [5.88, 0.12, 0.27],
    [10.25, 0.18, 0.31],
    [18.49, 0.17, 0.19],
    [19.55, 0.22, 0.23],
    [25.4, 0.25, 0.26],
    [25.78, 0.43, 0.29],
    [26.07, 0.55, 0.46],
  ]) {
    box(
      out,
      'carved',
      [left - width, height, back - width],
      [right + width, height + thick, front + width],
      ashlar,
    );
  }
  const x = (left + right) / 2;
  const z = (back + front) / 2;
  const plaza = facade([x, front], [1, 0]);
  const west = facade([left, z], [0, 1]);
  const rear = facade([x, back], [-1, 0]);
  const east = facade([right, z], [0, -1]);
  for (const F of [plaza, west]) {
    sash(out, F, 0, 0.72, 2.96, 4.45, level, 'round');
    for (const u of [-0.85, 0.85]) sash(out, F, u, 7.13, 1.12, 2.63, level);
  }
  for (const F of [plaza, west, rear]) {
    clock(out, F, level);
    sash(out, F, 0, 14.95, 0.35, 1.58, 0, 'round');
    for (const u of [-0.82, 0, 0.82]) {
      panel(out, 'glass', F, u - 0.28, u + 0.28, 19.88, 20.82, 0.045, rail);
    }
    for (const u of level === 0 ? [-0.95, 0, 0.95] : [-1.32, -0.66, 0, 0.66, 1.32]) {
      fbox(out, 'carved', F, u - 0.125, u + 0.125, 17.57, 18.9, 0.025, 0.42, ashlar);
    }
  }
  if (level > 1) {
    for (const F of [plaza, west, rear, east]) {
      for (let u = -3.28; u < 3.35; u += 0.48) {
        fbox(out, 'carved', F, u - 0.09, u + 0.09, 24.88, 25.48, 0.05, 0.245, ashlar);
      }
    }
  }
}

function galleries(out, level) {
  const eaves = plan.dimensions.newWingMappedHeightM - 0.64;
  const modern = rgb('bcb9ac');
  const frontShell = localRings[688307266];
  const mainShell = localRings[688307267];
  const rearShell = localRings[995947776];
  volume(out, 'wall', frontShell, -0.68, eaves, pale);
  volume(out, 'wall', rearShell, -0.68, eaves - 0.65, modern);
  volume(out, 'wall', mainShell, -0.68, eaves - 0.29, modern, { roof: false });
  volume(out, 'wall', localRings[995947779], -0.68, eaves - 0.65, modern);
  volume(out, 'wall', localRings[995947777], -0.68, eaves + 2.02, modern);

  const x0 = -2.02;
  const x1 = 36.22;
  const z = 0.805;
  const base = eaves - 0.3;
  const samples = [5, 8, 12, 16][level];
  const barrel = Array.from({ length: samples + 1 }, (_, i) => {
    const u = i / samples;
    return [base + 1.69 * Math.sin(u * Math.PI), z - 7.91 + u * 15.82];
  });
  for (let i = 1; i < barrel.length; i++) {
    const [y0, z0] = barrel[i - 1];
    const [y1, z1] = barrel[i];
    quad4(out, 'barrel', [x0, y0, z0], [x0, y1, z1], [x1, y1, z1], [x1, y0, z0], metal);
  }
  fan(out, 'wall', barrel.map(([y, z]) => [x0, y, z]).reverse(), pale);
  fan(
    out,
    'wall',
    barrel.map(([y, z]) => [x1, y, z]),
    pale,
  );

  const entry = facade([-5.85, 13.213], [1, 0]);
  panel(out, 'glass', entry, -2.28, 2.24, 0.43, 13.38, 0.028, glass);
  for (const u of [-1.37, -0.43, 0.52, 1.45]) {
    panel(out, 'trim', entry, u - 0.039, u + 0.039, 0.43, 13.38, 0.046, metal);
  }
  for (let y = 2; y < 13; y += 1.42) {
    panel(out, 'trim', entry, -2.28, 2.24, y, y + 0.058, 0.047, metal);
  }
  const elevation = facade([0, 17.555], [1, 0]);
  for (let u = 7.1; u <= 33.3; u += 3.48) {
    panel(out, 'glass', elevation, u - 1.29, u + 1.12, 0.58, 5, 0.041, glass);
    fbox(out, 'wall', elevation, u - 1.46, u + 1.49, 4.91, 5.59, 0, 0.52, pale);
    if (level > 0) {
      tri(
        out,
        'wall',
        elevation.P(u - 1.39, 2.01, 0.053),
        elevation.P(u - 1.39, 4.97, 0.51),
        elevation.P(u - 0.37, 4.97, 0.052),
        pale,
      );
    }
  }
  if (level > 1) {
    for (const u of [5.58, 11.95, 18.45, 24.95, 31.52]) {
      panel(out, 'wall', elevation, u, u + 0.02, 5.63, eaves - 0.03, 0.013, modern);
    }
  }
}

function build(out, level) {
  postOffice(out, level);
  cornerTower(out, level);
  galleries(out, level);
}
export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'san-jose-museum-of-art-model.mjs';
const camera = [-45, 19, 71];
const lookAt = [-3, 10.5, 5];
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: 'San José Museum of Art',
  wikidataId: plan.wikidataId,
  category: 'museum',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief: 'The sandstone Old Post Office and its corner clock tower beside the modern gallery wing.',
  camera,
  lookAt,
  sunDirection: [-48, 57, 81],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: frame.geometry.outline,
    minimumCoverage: 0.9,
    basis: 'Native museum building outline including the historic tower and adjacent gallery wing.',
  },
  embeddedCanonicalGraphs: ['stone_ashlar', 'tile_flat', 'concrete_panel', 'metal_standing_seam'],
  recipeDependencies: ['place-recipe-kit.mjs', 'polygon-triangulation.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'market-and-plaza-clock-tower', position: [-57, 12, 57], lookAt: [-25, 13.2, 13.5] },
    { name: 'plaza-entrance-and-galleries', position: [11, 11, 61], lookAt: [3, 9.2, 13] },
    { name: 'san-fernando-roofline', position: [-63, 20, -34], lookAt: [-17, 10, 0] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'san-jose-museum-of-art-' + reviewLod,
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
      district: { export: 'district', errorMeters: 0.36, surfaces },
      street: { export: 'street', errorMeters: 0.12, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.05, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original mesh under repository license. © OpenStreetMap contributors. Mapzen open terrain.',
};
