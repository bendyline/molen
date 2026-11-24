import { readFileSync } from 'node:fs';
import {
  abox,
  facade,
  fbox,
  opening,
  quad4,
  rgb,
  tri,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const read = (file) => JSON.parse(readFileSync(new URL('../' + file + '.json', import.meta.url)));
const plan = read('plan-controls');
const frame = read('map-frame');

const surfaces = {
  brick: { slot: 'wall', graph: 'brick_flemish', roughness: 0.91 },
  plaster: { slot: 'foundation', graph: 'plaster_lime', roughness: 0.94 },
  roof: { slot: 'roof', graph: 'metal_corrugated', roughness: 0.85 },
  wood: { slot: 'trim', graph: 'wood_plain', roughness: 0.83 },
  iron: { slot: 'trim', graph: 'metal_painted', roughness: 0.79 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.58 },
};
const walls = rgb('916c57');
const lowerBrick = rgb('d2c5a7');
const stone = rgb('a99b83');
const roofGrey = rgb('85877d');
const verandahRoof = rgb('767970');
const floor = rgb('927e61');
const white = rgb('e9dcc1');
const green = rgb('536050');
const glass = rgb('40463b');
const front = 5.55;
const rear = -6.95;
const half = 7.69;
const porch = 8.92;
const edge = 10.65;
const upperFloor = 3.66;
const fascia = 6.54;
const plinth = 0.22;

function hip(out, x0, x1, z0, z1, eave, ridge, inset, palette) {
  const m = (z0 + z1) / 2;
  const a = [x0, eave, z1];
  const b = [x1, eave, z1];
  const c = [x1, eave, z0];
  const d = [x0, eave, z0];
  const l = [x0 + inset, ridge, m];
  const r = [x1 - inset, ridge, m];
  quad4(out, 'roof', a, b, r, l, palette);
  tri(out, 'roof', b, c, r, palette);
  quad4(out, 'roof', c, d, l, r, palette);
  tri(out, 'roof', d, a, l, palette);
}

function chimney(out, x, z, from, top, level) {
  abox(out, 'brick', [x - 0.48, from, z - 0.32], [x + 0.48, top - 0.17, z + 0.32], walls);
  abox(out, 'brick', [x - 0.55, top - 0.22, z - 0.39], [x + 0.55, top - 0.1, z + 0.39], walls);
  abox(out, 'plaster', [x - 0.59, top - 0.11, z - 0.44], [x + 0.59, top, z + 0.44], lowerBrick);
  if (level >= 1) {
    for (const dx of [-0.35, 0, 0.35]) {
      abox(
        out,
        'brick',
        [x + dx - 0.106, top, z - 0.109],
        [x + dx + 0.106, top + 0.23, z + 0.109],
        walls,
      );
    }
  }
}

function verandahRoofSurfaces(out) {
  const a = [-edge - 0.19, fascia, porch + 0.2];
  const b = [edge + 0.19, fascia, porch + 0.2];
  const c = [edge + 0.19, fascia, rear - 0.13];
  const d = [-edge - 0.19, fascia, rear - 0.13];
  const e = [-half - 0.02, 7.26, front - 0.065];
  const f = [half + 0.02, 7.26, front - 0.065];
  const g = [half + 0.02, 7.26, rear - 0.13];
  const h = [-half - 0.02, 7.26, rear - 0.13];
  quad4(out, 'roof', a, b, f, e, verandahRoof);
  quad4(out, 'roof', b, c, g, f, verandahRoof);
  quad4(out, 'roof', d, a, e, h, verandahRoof);
  const under = ([x, y, z]) => [x, y - 0.105, z];
  quad4(out, 'wood', under(b), under(a), under(e), under(f), floor);
  quad4(out, 'wood', under(c), under(b), under(f), under(g), floor);
  quad4(out, 'wood', under(a), under(d), under(h), under(e), floor);
}

function flatBar(out, F, u0, y0, u1, y1, width, depth, palette) {
  const length = Math.hypot(u1 - u0, y1 - y0);
  const dx = ((y1 - y0) * width) / (2 * length);
  const dy = ((u0 - u1) * width) / (2 * length);
  const a = F.P(u0 + dx, y0 + dy, depth);
  const b = F.P(u0 - dx, y0 - dy, depth);
  const c = F.P(u1 - dx, y1 - dy, depth);
  const d = F.P(u1 + dx, y1 + dy, depth);
  quad4(out, 'iron', a, b, c, d, palette);
  quad4(out, 'iron', b, a, d, c, palette);
}

function verandahSide(out, F, length, bays, level, sharedCorner = -1) {
  const step = length / bays;
  fbox(out, 'wood', F, 0, length, upperFloor - 0.18, upperFloor + 0.085, -0.14, 0.083, white);
  fbox(out, 'wood', F, -0.16, length + 0.16, fascia - 0.15, fascia + 0.015, -0.15, 0.075, white);
  fbox(out, 'iron', F, 0, length, 4.56, 4.62, -0.08, 0.018, green);
  fbox(out, 'iron', F, 0, length, 3.79, 3.84, -0.07, 0.015, green);
  for (let i = 0; i <= bays; ++i) {
    const u = i * step;
    if (i !== sharedCorner) {
      fbox(out, 'iron', F, u - 0.052, u + 0.052, plinth, fascia - 0.12, -0.09, 0.025, green);
      if (level >= 1) {
        for (const y of [plinth + 0.07, upperFloor + 0.07, fascia - 0.27]) {
          fbox(out, 'iron', F, u - 0.09, u + 0.09, y - 0.052, y + 0.047, -0.13, 0.07, white);
        }
      }
    }
    if (i === bays) continue;
    const steps = [4, 8, 14, 20][level];
    const edgeHeight = (t) => 2.67 + 0.59 * Math.sin(Math.PI * t);
    for (let j = 0; j < steps; ++j) {
      const t = j / steps;
      const next = (j + 1) / steps;
      const at = u + step * t;
      const to = u + step * next;
      const a = F.P(at, edgeHeight(t), 0.006);
      const b = F.P(to, edgeHeight(next), 0.006);
      const c = F.P(to, upperFloor - 0.11, 0.006);
      const d = F.P(at, upperFloor - 0.11, 0.006);
      quad4(out, 'wood', a, b, c, d, white);
      quad4(out, 'wood', b, a, d, c, white);
      if (level >= 2)
        fbox(
          out,
          'wood',
          F,
          at + 0.025,
          at + 0.052,
          edgeHeight(t) + 0.035,
          upperFloor - 0.135,
          0.009,
          0.022,
          lowerBrick,
        );
    }
    const bars = [1, 9, 14, 19][level];
    for (let j = 1; j <= bars; ++j) {
      const pos = u + (j * step) / (bars + 1);
      if (level <= 1) {
        fbox(out, 'iron', F, pos - 0.018, pos + 0.018, 3.8, 4.58, -0.058, -0.025, white);
      } else {
        for (const sign of [-1, 1]) {
          flatBar(out, F, pos, 3.81, pos + sign * 0.067, 4.08, 0.019, sign * 0.013 - 0.042, white);
          flatBar(out, F, pos + sign * 0.067, 4.08, pos, 4.56, 0.019, sign * 0.013 - 0.042, white);
        }
      }
    }
    if (level >= 1) {
      for (const sign of [-1, 1]) {
        const p = sign > 0 ? u : u + step;
        flatBar(out, F, p, fascia - 0.52, p + 0.36 * sign, fascia - 0.13, 0.036, -0.035, white);
        if (level >= 3)
          flatBar(
            out,
            F,
            p + 0.065 * sign,
            fascia - 0.47,
            p + 0.35 * sign,
            fascia - 0.21,
            0.024,
            -0.016,
            white,
          );
      }
    }
  }
}

function window(out, F, u, upper, level, door = false) {
  const y = upper ? (door ? upperFloor + 0.085 : 4.32) : door ? 0.28 : 1.05;
  const h = door ? 2.62 : upper ? 1.75 : 1.79;
  opening(out, F, u, y, door ? 1.25 : 1.01, h, {
    glassSlot: 'glass',
    glass,
    frameSlot: 'wood',
    frame: upper ? white : green,
    frameWidth: level >= 1 ? 0.1 : 0,
    frameDepth: 0.07,
    d: 0.025,
    sill: !door && level >= 1,
    transoms: level >= 2 ? (door ? 2 : 1) : 0,
    mullions: level >= 2 ? 1 : 0,
    mullionColor: white,
  });
  if (upper && level >= 2) {
    fbox(
      out,
      'brick',
      F,
      u - 0.59,
      u + 0.59,
      y + h + 0.025,
      y + h + 0.165,
      0.005,
      0.04,
      rgb('a47c60'),
    );
  }
}

function lobby(out, level) {
  const a = -3.45;
  const b = 3.45;
  const z = 11.1;
  abox(out, 'plaster', [a, -0.25, 7.28], [b, 2.97, z], lowerBrick);
  hip(out, a - 0.2, b + 0.2, 7.8, 12.27, 2.79, 3.36, 0.73, verandahRoof);
  const F = facade([0, 12.17], [1, 0]);
  for (const u of [-3.37, 3.37]) {
    fbox(out, 'wood', F, u - 0.071, u + 0.071, 0.05, 2.8, -0.045, 0.08, white);
  }
  fbox(out, 'wood', F, a - 0.16, b + 0.16, 2.6, 2.83, -0.06, 0.06, white);
  const wall = facade([0, z], [1, 0]);
  window(out, wall, 0, false, level, true);
  if (level >= 1) {
    for (const u of [-2.21, 2.21]) window(out, wall, u, false, level);
    abox(out, 'wood', [-1.33, 2.83, z], [1.33, 3.17, z + 0.11], green);
  }
  abox(out, 'plaster', [-2.06, -0.09, z], [2.06, 0.13, z + 1.1], stone);
  abox(out, 'plaster', [-1.98, 0.1, z], [1.98, 0.25, z + 0.7], stone);
}

function build(out, level) {
  abox(out, 'plaster', [-edge, -0.55, rear], [edge, plinth, porch], stone);
  abox(out, 'plaster', [-half, plinth, rear], [half, upperFloor, front], lowerBrick);
  abox(out, 'brick', [-half, upperFloor, rear], [half, 7.44, front], walls);
  abox(
    out,
    'wood',
    [-edge + 0.035, upperFloor - 0.09, rear],
    [edge - 0.035, upperFloor + 0.083, porch],
    floor,
  );
  hip(out, -half - 0.48, half + 0.48, rear - 0.55, front + 0.56, 7.48, 9.75, 5.7, roofGrey);
  abox(out, 'wood', [-half - 0.44, 7.31, rear - 0.49], [half + 0.44, 7.46, front + 0.49], white);
  chimney(out, -3.75, -0.34, 8.58, 10.5, level);
  chimney(out, 3.51, -0.98, 8.6, 10.93, level);
  verandahRoofSurfaces(out);
  verandahSide(out, facade([-edge, porch], [1, 0]), 2 * edge, 5, level);
  verandahSide(out, facade([edge, porch], [0, -1]), porch - rear, 5, level, 0);
  verandahSide(out, facade([-edge, rear], [0, 1]), porch - rear, 5, level, 5);
  lobby(out, level);

  abox(out, 'plaster', [-2.65, -0.37, -20.1], [4.1, 3.19, rear + 0.2], lowerBrick);
  hip(out, -2.83, 4.3, -20.42, rear, 3.29, 4.63, 3.28, roofGrey);
  if (level >= 1) {
    chimney(out, -0.86, -13.89, 3.75, 5.23, level);
    const F = facade([4.1, -13.4], [0, -1]);
    for (const u of [-4.15, -0.35, 3.3]) window(out, F, u, false, level, u < -4);
    window(out, facade([0.4, -20.1], [-1, 0]), 0, false, level);
    for (const u of [-5.83, -2.92, 0.05, 2.97, 5.87]) {
      window(out, facade([0, front], [1, 0]), u, true, level, Math.abs(u) > 2.5 && Math.abs(u) < 4);
      if (Math.abs(u) > 3.54) window(out, facade([0, front], [1, 0]), u, false, level);
    }
    for (const sign of [-1, 1]) {
      const F = facade([sign * half, -0.32], [0, -sign]);
      for (const u of [-4.27, -1.5, 1.48, 4.21]) {
        window(out, F, u, false, level, u > 3);
        window(out, F, u, true, level, u < -3);
      }
    }
  }
  if (level >= 2) {
    const F = facade([0, front + 0.5], [1, 0]);
    for (let i = -10; i <= 10; ++i) {
      const u = i * 0.73;
      fbox(out, 'wood', F, u - 0.049, u + 0.049, 7.14, 7.48, -0.36, 0.012, white);
    }
    const back = facade([0, rear], [-1, 0]);
    for (const u of [-5.8, -3.13, 0, 3.13, 5.8]) window(out, back, u, true, level);
  }
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);
const recipe = 'bourke-post-office-model.mjs';
const camera = [24, 10.8, 37];
const lookAt = [0, 4.29, -1.6];

export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'historic-post-office',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'approximate-visualization',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'Bourke Post Office’s corrugated iron hips, corbelled chimneys, decorated verandah and Oxley Street entrance lobby.',
  camera,
  lookAt,
  sunDirection: [-28, 47, 38],
  mediumFiContext: {
    scale: 0.84,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: Object.values(surfaces).flatMap(({ graph }) => graph ?? []),
  recipeDependencies: ['place-recipe-kit.mjs', 'authored-structure-mesh.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'oxley-street-verandah', position: camera, lookAt },
    { name: 'ironwork-and-front-lobby', position: [-12.7, 6.2, 25.5], lookAt: [-0.6, 3.85, 6.6] },
    { name: 'roof-chimneys-and-rear-wing', position: [-26, 16.0, -32], lookAt: [0.5, 4.7, -5] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'bourke-post-office-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.6,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.25, surfaces },
      street: { export: 'street', errorMeters: 0.11, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.042, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original geometry informed by the NSW State Archives public-domain photograph, state cadastre and Geoscience Australia open elevation.',
};
