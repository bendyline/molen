import fs from 'node:fs';
import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  abox,
  facade,
  fbox,
  outwardRing,
  quad4,
  rgb,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const plan = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url)));
const frame = JSON.parse(fs.readFileSync(new URL('../map-frame.json', import.meta.url)));
const front = outwardRing(frame.geometry.outline);
const rear = outwardRing(frame.features[1].points);
const { foundation, frontTop, frontEave, plinth, rearTop } = plan.dimensions;
const brick = rgb('5e6257');
const darkBrick = rgb('50584e');
const granite = rgb('a5a59a');
const stone = rgb('9d9a88');
const tile = rgb('616963');
const tileLight = rgb('888c80');
const beamColor = rgb('554538');
const wood = rgb('473b31');
const darkRed = rgb('6e392e');
const glaze = rgb('536b59');
const cream = rgb('c2ba9a');
const iron = rgb('41473c');
const materials = {
  brick: { slot: 'wall', graph: 'brick', roughness: 0.96 },
  stone: { slot: 'foundation', graph: 'stone_granite', roughness: 0.94 },
  trim: { slot: 'trim', graph: 'plaster_lime', roughness: 0.93 },
  tile: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.93 },
  wood: { slot: 'trim', graph: 'wood_weatherboard', roughness: 0.88 },
  painted: { slot: 'trim', graph: 'wood_painted_lap', roughness: 0.88 },
  rail: { slot: 'trim', graph: 'metal_painted', roughness: 0.9 },
};

const bounds = (ring) => ({
  x0: Math.min(...ring.map(([x]) => x)),
  x1: Math.max(...ring.map(([x]) => x)),
  z0: Math.min(...ring.map(([, z]) => z)),
  z1: Math.max(...ring.map(([, z]) => z)),
});
const frontBounds = bounds(front);
const rearBounds = bounds(rear);
const center = 0.69;
const middleEnd = 12.65;
const rearStart = 18.36;
const firstCourt = [frontBounds.z1 - 0.09, rearBounds.z0 + 0.1];
const secondCourt = [middleEnd - 0.1, rearStart + 0.1];

function paving(out, x0, x1, z0, z1, low, high) {
  quad4(out, 'stone', [x0, low, z0], [x0, high, z1], [x1, high, z1], [x1, low, z0], granite);
  quad4(
    out,
    'stone',
    [x0, foundation, z0],
    [x0, foundation, z1],
    [x0, high, z1],
    [x0, low, z0],
    stone,
  );
  quad4(
    out,
    'stone',
    [x1, foundation, z1],
    [x1, foundation, z0],
    [x1, low, z0],
    [x1, high, z1],
    stone,
  );
  quad4(
    out,
    'stone',
    [x0, foundation, z0],
    [x0, low, z0],
    [x1, low, z0],
    [x1, foundation, z0],
    stone,
  );
}

function sides(out, ring, y0, y1) {
  for (let i = 0; i < ring.length; i++) {
    const f = wallFace(ring[i], ring[(i + 1) % ring.length]);
    const l = f.length;
    if (Math.abs(f.normal[0]) < 0.8) continue;
    quad4(out, 'brick', f.P(0, y0), f.P(l, y0), f.P(l, y1), f.P(0, y1), brick);
    const skirt = Math.max(0.46, y0 + 0.42);
    fbox(out, 'stone', f, 0.015, l - 0.015, y0, skirt, -0.052, 0.047, stone);
  }
}

function gateway(out, frontFace, width, ground, top, passHalf, passTop, lod, showGate) {
  fbox(out, 'brick', frontFace, -width / 2, -passHalf, ground, top, -0.29, 0, darkBrick);
  fbox(out, 'brick', frontFace, passHalf, width / 2, ground, top, -0.29, 0, darkBrick);
  fbox(out, 'wood', frontFace, -passHalf, passHalf, passTop, top, -0.32, 0.074, wood);
  for (const k of [-1, 1]) {
    const a = k * passHalf;
    fbox(out, 'trim', frontFace, a - 0.105, a + 0.105, ground, passTop + 0.14, -0.14, 0.12, cream);
    if (lod < 1 || !showGate) continue;
    const railCore = k * (passHalf + (width / 2 - passHalf) * 0.51);
    const span = (width / 2 - passHalf) * 0.89;
    const count = lod === 1 ? 6 : lod === 2 ? 14 : 22;
    for (let i = 0; i <= count; i++) {
      const u = railCore - span / 2 + (span * i) / count;
      fbox(
        out,
        'rail',
        frontFace,
        u - 0.022,
        u + 0.022,
        ground + 0.09,
        ground + 2.08,
        0.111,
        0.183,
        iron,
      );
    }
    for (const y of [ground + 0.24, ground + 1.95])
      fbox(
        out,
        'rail',
        frontFace,
        railCore - span / 2,
        railCore + span / 2,
        y,
        y + 0.046,
        0.125,
        0.194,
        iron,
      );
  }
}

function roofs(out, hall, eave, highest, lod, ornamental) {
  const xMid = (hall.x0 + hall.x1) / 2;
  const zMid = (hall.z0 + hall.z1) / 2;
  const halfX = (hall.x1 - hall.x0) / 2 + 0.68;
  const halfZ = (hall.z1 - hall.z0) / 2 + 0.63;
  const shoulders = [1, 0.635, 0.337, 0.123, 0];
  const ridge = highest - (ornamental ? 0.69 : 0.63);
  const point = (u, j, sign) => {
    const flank = Math.abs(u);
    const curl = flank * flank * flank * flank;
    const v = j / (shoulders.length - 1);
    const y = eave + (ridge - eave) * shoulders[j] + curl * (0.43 - v * 0.27);
    return [xMid + u * halfX, y, zMid + sign * halfZ * v];
  };
  const count = [4, 8, 10, 14][lod];
  for (const sign of [-1, 1]) {
    for (let i = 0; i < count; i++) {
      const a = -1 + (2 * i) / count,
        b = -1 + (2 * (i + 1)) / count;
      for (let j = 0; j < shoulders.length - 1; j++) {
        const q = [
          point(a, j, sign),
          point(b, j, sign),
          point(b, j + 1, sign),
          point(a, j + 1, sign),
        ];
        if (sign > 0) q.reverse();
        quad4(out, 'tile', ...q, tile);
      }
      const p = point(a, 4, sign),
        q = point(b, 4, sign);
      const under = (v) => [v[0], v[1] - 0.19, v[2] + sign * 0.018];
      if (sign < 0) quad4(out, 'wood', under(q), under(p), p, q, beamColor);
      else quad4(out, 'wood', under(p), under(q), q, p, beamColor);
    }
    for (const u of [-1, 1]) {
      for (let j = 0; j < shoulders.length - 1; j++) {
        const a = point(u, j, sign),
          b = point(u, j + 1, sign);
        if (lod > 0) beam(out, 'tile', a, b, 0.17, 0.18, tileLight);
        const wallY = eave - 0.35;
        const e = [a, [a[0], wallY, a[2]], [b[0], wallY, b[2]], b];
        if (u * sign > 0) e.reverse();
        quad4(out, 'brick', ...e, darkBrick);
      }
    }
    if (lod < 2) continue;
    const ribs = lod === 2 ? 11 : 29;
    for (let i = 0; i <= ribs; i++) {
      const u = -0.963 + (1.926 * i) / ribs;
      const offset = ([x, y, z]) => [x, y + 0.039, z];
      for (let j = 0; j < shoulders.length - 1; j++) {
        beam(
          out,
          'tile',
          offset(point(u, j, sign)),
          offset(point(u, j + 1, sign)),
          0.075,
          0.052,
          i % 5 === 0 ? tileLight : tile,
        );
      }
    }
  }
  const spans = lod === 0 ? 4 : 10;
  for (let i = 0; i < spans; i++) {
    const at = (k, up) => {
      const [x, y, z] = point(-1 + (2 * k) / spans, 0, 1);
      return [x, y + up, z];
    };
    beam(out, 'painted', at(i, 0.11), at(i + 1, 0.11), 0.29, 0.3, ornamental ? glaze : tileLight);
    if (lod > 0) beam(out, 'trim', at(i, 0.256), at(i + 1, 0.256), 0.135, 0.09, cream);
    if (ornamental && lod > 1)
      beam(
        out,
        'painted',
        at(i + 0.12, 0.31),
        at(i + 0.83, 0.31),
        0.074,
        0.08,
        i % 2 === 0 ? darkRed : glaze,
      );
  }
  for (const s of [-1, 1]) {
    const [x, y, z] = point(s, 0, 1);
    const top = Math.max(y + 0.21, highest);
    tri(
      out,
      'painted',
      [x - s * 0.77, y + 0.15, z - 0.09],
      [x, top, z - 0.09],
      [x, y + 0.15, z - 0.09],
      glaze,
    );
    tri(
      out,
      'painted',
      [x, y + 0.15, z + 0.09],
      [x, top, z + 0.09],
      [x - s * 0.77, y + 0.15, z + 0.09],
      glaze,
    );
  }
}

function frontHall(out, lod) {
  const b = frontBounds;
  paving(out, b.x0, b.x1, b.z0, b.z1, plinth, plinth);
  sides(out, front, foundation, frontEave + 0.04);
  const entry = facade([0.94, b.z0 + 0.16], [-1, 0]);
  const exit = facade([0.84, b.z1 - 0.08], [1, 0]);
  gateway(out, entry, b.x1 - b.x0, plinth, frontEave, 1.73, 3.08, lod, true);
  gateway(out, exit, b.x1 - b.x0, plinth, frontEave, 1.71, 2.86, lod, false);
  fbox(out, 'trim', entry, -7.71, 7.68, frontEave - 0.34, frontEave - 0.07, -0.21, 0.1, cream);
  fbox(out, 'painted', entry, -1.49, 1.49, 3.13, 3.46, 0.074, 0.154, darkRed);
  if (lod > 0) {
    for (const u of [-6.45, -4.56, -2.2, 2.2, 4.54, 6.44]) {
      fbox(out, 'wood', entry, u - 0.1, u + 0.1, plinth, frontEave - 0.08, 0.004, 0.167, beamColor);
      fbox(
        out,
        'painted',
        entry,
        u - 0.26,
        u + 0.26,
        frontEave - 0.64,
        frontEave - 0.29,
        0.064,
        0.198,
        glaze,
      );
    }
    for (const u of [-5.62, 5.62]) {
      fbox(out, 'trim', entry, u - 0.36, u + 0.36, 2.76, 3.22, 0.035, 0.145, cream);
    }
    for (const u of [-1.91, 1.91])
      fbox(out, 'trim', entry, u - 0.12, u + 0.12, 0.72, 3.12, 0.131, 0.239, granite);
  }
  roofs(out, b, frontEave, frontTop, lod, true);
}

function courtyard(out, limits, low, high, lod) {
  paving(out, -7.0, 8.28, limits[0], limits[1], low, high);
  for (const x of [-7.35, 7.95]) {
    abox(out, 'brick', [x - 0.19, foundation, limits[0]], [x + 0.19, 3.02, limits[1]], brick, {
      bottom: false,
    });
    abox(out, 'tile', [x - 0.25, 2.96, limits[0]], [x + 0.25, 3.11, limits[1]], tile, {
      bottom: false,
    });
  }
  if (lod > 1) {
    for (const z of [limits[0] + 1.2, limits[1] - 1.1]) {
      const grade = low + ((high - low) * (z - limits[0])) / (limits[1] - limits[0]);
      abox(
        out,
        'stone',
        [center - 1.4, grade, z],
        [center + 1.4, grade + 0.027, z + 0.087],
        stone,
        { bottom: false },
      );
    }
  }
}

function linkedHalls(out, lod) {
  const rearB = rearBounds;
  courtyard(out, firstCourt, 0.25, 1.01, lod);
  courtyard(out, secondCourt, 1.08, 1.4, lod);
  for (const [z0, z1, grade, eave, top] of [
    [rearB.z0, middleEnd, 1.01, 4.84, 7.45],
    [rearStart, rearB.z1, 1.41, 5.38, rearTop],
  ]) {
    const r = outwardRing([
      [rearB.x0 + 0.1, z0],
      [rearB.x1 - 0.14, z0],
      [rearB.x1 - 0.14, z1],
      [rearB.x0 + 0.1, z1],
    ]);
    const width = rearB.x1 - rearB.x0 - 0.23;
    paving(out, rearB.x0 + 0.1, rearB.x1 - 0.14, z0, z1, grade, grade);
    sides(out, r, foundation, eave);
    gateway(out, facade([0.34, z0], [-1, 0]), width, grade, eave, 1.67, eave - 0.65, lod, false);
    if (z1 === rearB.z1)
      abox(
        out,
        'brick',
        [rearB.x0 + 0.1, foundation, z1 - 0.31],
        [rearB.x1 - 0.14, eave, z1],
        brick,
        { bottom: false },
      );
    else
      gateway(out, facade([0.34, z1], [1, 0]), width, grade, eave, 1.66, eave - 0.65, lod, false);
    roofs(out, bounds(r), eave, top, lod, false);
  }
}

function build(out, lod) {
  frontHall(out, lod);
  linkedHalls(out, lod);
}
export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);
const recipe = 'tang-chung-ling-ancestral-hall-model.mjs';
const camera = [24, 18, -46];
const lookAt = [0, 3, 5];
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'religious',
  surfaces: materials,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'The Tang Chung Ling Ancestral Hall’s three linked halls, open courtyards, dark brick, and ornamental Cantonese gray tile roofs.',
  camera,
  lookAt,
  sunDirection: [-28, 47, -62],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: frame.geometry.outline,
    outlines: [front, rear],
    minimumCoverage: 0.92,
    basis: 'Both individually named Hong Kong Lands Department structures.',
  },
  embeddedCanonicalGraphs: [
    ...new Set(Object.values(materials).flatMap(({ graph }) => graph ?? [])),
  ],
  recipeDependencies: ['place-recipe-kit.mjs', 'authored-structure-mesh.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'three-halls-and-two-courtyards', position: camera, lookAt },
    { name: 'entrance-tile-and-ridge-detail', position: [2, 4.9, -35], lookAt: [0.95, 3, -16.6] },
    { name: 'central-axes-and-rose-tiles', position: [-23, 24, 11], lookAt: [1, 4, 6] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'tang-chung-ling-ancestral-hall-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.92,
    surfaces: materials,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.41, surfaces: materials },
      street: { export: 'street', errorMeters: 0.14, surfaces: materials },
      closeup: { export: 'closeup', errorMeters: 0.06, surfaces: materials },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original mesh under repository license. © OpenStreetMap contributors. Building surveys and original elevation data from the Hong Kong Lands Department.',
};
