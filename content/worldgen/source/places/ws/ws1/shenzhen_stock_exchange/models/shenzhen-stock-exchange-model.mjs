/** 2013 Futian stock exchange with a three-storey cantilever over a public square. */
import fs from 'node:fs';
import { beamPath } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  B as box,
  rgb,
} from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';
import { quad } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (name) => JSON.parse(fs.readFileSync(new URL(`../${name}.json`, import.meta.url)));
const plan = read('plan-controls');
const { podium, lowerTower, upperTower, plaza } = read('map-frame').geometry;
const d = plan.dimensions;
const ref = 'palette:#ffffff';
const c = Object.fromEntries(
  Object.entries({
    shell: '909ba0',
    tintA: '788690',
    tintB: '818e98',
    tintC: '8e9ba1',
    tintD: '899797',
    recess: '505f6a',
    white: 'aeb8b9',
    lip: 'a5aeb1',
    sash: '6e7a7e',
    grille: '636f73',
    podium: '94a0a3',
    glass: '647783',
    darkGlass: '45565d',
    glassLight: '87969a',
    pavement: 'aaa9a1',
    edge: '91908b',
    soffit: 'a8aeab',
    roof: '929ca0',
    atriumFrame: 'a8aeab',
    brace: '9ca3a4',
    planter: 'b3b6ad',
    garden: '71816a',
    shrubs: '66775d',
  }).map(([key, tint]) => [key, rgb(tint)]),
);
const surfaces = {
  panel: { slot: 'wall', localRef: ref, roughness: 0.46, metallic: 0.29 },
  glazing: { slot: 'window', localRef: ref, roughness: 0.26, metallic: 0.38 },
  steel: { slot: 'trim', graph: 'metal_painted', roughness: 0.62, metallic: 0.21 },
  concrete: { slot: 'wall', graph: 'concrete_plain', roughness: 0.93 },
  roof: { slot: 'roof', localRef: ref, roughness: 0.9 },
};
const from2 = ([x, z], y) => [x, y, z];

function shell(out, slot, ring, low, high, color, roof = slot) {
  const winding = Math.sign(
    ring.reduce((area, [x, z], i) => {
      const [u, v] = ring[(i + 1) % ring.length];
      return area + x * v - u * z;
    }, 0),
  );
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length];
    const normal = [winding * (b[1] - a[1]), 0, winding * (a[0] - b[0])];
    quad(out, slot, [from2(a, low), from2(b, low), from2(b, high), from2(a, high)], normal, color);
  }
  const indices = earcut(ring.flat());
  for (let i = 0; i < indices.length; i += 3) {
    const indexes = indices.slice(i, i + 3);
    for (const [height, normal] of [
      [low, [0, -1, 0]],
      [high, [0, 1, 0]],
    ]) {
      const positions = indexes.map((index) => from2(ring[index], height));
      out.addTriangle(
        roof,
        ref,
        positions,
        normal,
        indexes.map((index) => ring[index]),
        color,
      );
    }
  }
}

function bounds(ring) {
  const xs = ring.map((p) => p[0]),
    zs = ring.map((p) => p[1]);
  return [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)];
}

function facade(x, z, side) {
  const [nx, nz] = [
    [0, 1],
    [1, 0],
    [0, -1],
    [-1, 0],
  ][side];
  return {
    normal: [nx, 0, nz],
    p: (u, y, off = 0) => [x + nz * u + nx * off, y, z - nx * u + nz * off],
  };
}
function plate(out, face, slot, u0, u1, y0, y1, depth, tint) {
  quad(
    out,
    slot,
    [face.p(u0, y0, depth), face.p(u1, y0, depth), face.p(u1, y1, depth), face.p(u0, y1, depth)],
    face.normal,
    tint,
  );
}

function rectangleFacades(ring) {
  const [left, right, north, south] = bounds(ring);
  const cx = (left + right) / 2,
    cz = (north + south) / 2;
  return [
    [cx, south, right - left],
    [right, cz, south - north],
    [cx, north, right - left],
    [left, cz, south - north],
  ].map(([x, z, span], side) => ({ face: facade(x, z, side), span }));
}

function supportedBase(out, detail) {
  shell(out, 'concrete', plaza, d.foundationY, d.entryFloorY, c.pavement);
  const [, , north, south] = bounds(lowerTower);
  box(out, 'concrete', 0, -5.7, 0, 57, 6.55, 56, c.edge);
  box(out, 'panel', 0, 0.55, 0, 54.75, d.podiumRoofY - 0.55, 53.6, c.darkGlass);
  for (const [end, side] of [
    [south, 0],
    [north, 2],
  ]) {
    const sign = Math.sign(end);
    const face = facade(0, end, side);
    const glazing = c.glass;
    const divisions = detail > 1 ? 14 : detail ? 9 : 6;
    for (let col = 0; col < divisions; col++) {
      const u0 = -24.8 + (49.6 * col) / divisions,
        u1 = -24.8 + (49.6 * (col + 1)) / divisions;
      plate(
        out,
        face,
        'glazing',
        u0 + 0.105,
        u1 - 0.105,
        2.3,
        d.podiumSoffitY - 0.72,
        0.025,
        col % 3 === 1 ? c.glassLight : glazing,
      );
    }
    for (const y of [2.2, 8.6, 16.2, 23.75, 31.6, 35.3]) {
      plate(out, face, 'steel', -25, 25, y, y + (detail > 0.0 ? 0.3 : 0.42), 0.055, c.atriumFrame);
    }
    for (const x of [-22.6, 22.6]) {
      const foot = [x, 0.3, end - sign * 0.64];
      const head = [x, d.podiumSoffitY + 0.55, end - sign * 0.7];
      beamPath(out, 'steel', [foot, head], 2.0, 2.0, c.atriumFrame);
      beamPath(
        out,
        'steel',
        [
          [x * 0.36, 0.35, end + sign * 0.08],
          [x * 0.84, d.podiumSoffitY + 0.35, end + sign * 0.08],
        ],
        1.7,
        1.7,
        c.brace,
      );
    }
    if (detail) {
      plate(out, face, 'panel', -7.5, 7.5, 0.78, 5.35, 0.078, c.darkGlass);
      for (const x of [-6.8, -3.4, 0, 3.4, 6.8])
        plate(out, face, 'steel', x - 0.15, x + 0.15, 0.75, 5.6, 0.105, c.sash);
      box(out, 'steel', 0, 5.47, end + 1.7 * sign, 19, 0.66, 4.9, c.soffit);
    }
  }
  if (!detail) return;
  for (const [x, side] of [
    [-24.86, 3],
    [24.86, 1],
  ]) {
    for (const end of [north, south]) {
      const from = Math.sign(end) * 26.5;
      const face = facade(x, (end + from) / 2, side);
      const half = Math.abs(end - from) / 2;
      plate(out, face, 'glazing', -half, half, 0.68, d.podiumSoffitY, 0.012, c.glass);
      for (const y of [8.6, 17.3, 26, 34.4]) {
        plate(out, face, 'steel', -half, half, y, y + 0.31, 0.047, c.grille);
      }
      for (const u of [-half + 0.11, 0, half - 0.11]) {
        plate(out, face, 'steel', u - 0.105, u + 0.105, 0.67, d.podiumSoffitY, 0.066, c.grille);
      }
    }
  }
}

function raisedPodium(out, detail) {
  shell(out, 'panel', podium, d.podiumSoffitY, d.podiumRoofY, c.podium, 'roof');
  for (const { face, span } of rectangleFacades(podium)) {
    const blockCount = [5, 18, 32, 41][detail];
    const bands = d.podiumFloorLevels;
    for (let row = 0; row < bands.length - 1; row++) {
      const y0 = bands[row] + 0.48,
        y1 = bands[row + 1] - 0.47;
      for (let col = 0; col < blockCount; col++) {
        const u0 = -span / 2 + (span * col) / blockCount;
        const u1 = -span / 2 + (span * (col + 1)) / blockCount;
        const glass = [c.tintB, c.tintC, c.glassLight, c.tintA][(col * 7 + row * 5) % 4];
        plate(out, face, 'glazing', u0 + 0.15, u1 - 0.15, y0, y1, 0.037, glass);
        if (detail > 1) {
          plate(out, face, 'steel', u0 + 0.12, u0 + 0.24, y0, y1, 0.119, c.white);
        }
      }
      plate(
        out,
        face,
        'steel',
        -span / 2,
        span / 2,
        bands[row] + 0.14,
        bands[row] + 0.47,
        0.132,
        c.sash,
      );
    }
    plate(out, face, 'concrete', -span / 2, span / 2, 36.1, 37.1, 0.07, c.soffit);
    plate(out, face, 'steel', -span / 2, span / 2, 63.35, 64, 0.075, c.lip);
  }
  for (const x of [-53.5, 53.5]) {
    box(out, 'roof', x, d.podiumRoofY - 0.02, 0, 46, 0.62, 73, c.pavement);
    for (const z of [-26.5, 0, 26.5]) {
      box(out, 'concrete', x, d.podiumRoofY + 0.58, z, 31, 0.46, 13.6, c.planter);
      box(out, 'roof', x, d.podiumRoofY + 1.03, z, 28.8, detail > 1 ? 0.41 : 0.25, 11.8, c.garden);
      if (detail >= 2)
        for (const offset of [-11, -5, 1, 7, 12]) {
          box(out, 'roof', x + offset, d.podiumRoofY + 1.22, z + 2.6, 3.2, 0.72, 4.5, c.shrubs);
        }
    }
  }
}

function tower(out, detail) {
  const minY = d.podiumRoofY;
  const top = d.towerTopY;
  shell(out, 'panel', upperTower, minY, top, c.shell, 'roof');
  const rows = [9, 18, 36, 36][detail],
    cols = [4, 9, 12, 12][detail];
  const faceHeight = top - minY - 4.2;
  for (const { face, span } of rectangleFacades(upperTower)) {
    const end = span / 2 - 1.16;
    for (let row = 0; row < rows; row++) {
      const y0 = minY + 0.8 + (row * faceHeight) / rows,
        y1 = minY + 0.8 + ((row + 1) * faceHeight) / rows;
      const rowHeight = y1 - y0;
      for (let col = 0; col < cols; col++) {
        const x0 = -end + (2 * end * col) / cols,
          x1 = -end + (2 * end * (col + 1)) / cols;
        const colWidth = x1 - x0;
        const glass = [c.tintA, c.tintB, c.tintC, c.tintD][(row * 5 + col * 17) % 4];
        const jamb = detail === 3 ? 0.56 : detail === 2 ? 0.47 : detail === 1 ? 0.46 : 0.56;
        plate(
          out,
          face,
          'glazing',
          x0 + jamb,
          x1 - jamb,
          y0 + rowHeight * 0.17,
          y1 - rowHeight * 0.18,
          0.049,
          glass,
        );
        if (detail < 2) continue;
        plate(
          out,
          face,
          'steel',
          x0 + jamb - 0.15,
          x0 + jamb + 0.09,
          y0 + rowHeight * 0.17,
          y1 - rowHeight * 0.18,
          0.125,
          c.lip,
        );
        if (detail === 3) {
          const lo = y0 + rowHeight * 0.16,
            hi = y0 + rowHeight * 0.23;
          plate(out, face, 'panel', x0 + jamb, x1 - jamb, lo, hi, 0.115, c.recess);
          if ((row + col) % 3 === 0) {
            const u = x0 + colWidth * 0.64;
            plate(
              out,
              face,
              'steel',
              u - 0.06,
              u + 0.06,
              y0 + rowHeight * 0.23,
              y1 - rowHeight * 0.18,
              0.102,
              c.sash,
            );
          }
        }
      }
    }
    if (detail)
      for (const y of [minY + 0.48, top - 3.42, top - 1.61]) {
        plate(out, face, 'steel', -span / 2, span / 2, y, y + 0.41, 0.13, c.lip);
      }
  }
  if (detail) {
    box(out, 'concrete', 0, top - 1.41, 0, 46, 1.25, 47, c.roof);
    box(out, 'panel', -5.7, top - 3.48, -4.8, 21.5, 3.25, 14.2, c.grille);
  }
}

function draw(out, detail) {
  supportedBase(out, detail);
  raisedPodium(out, detail);
  tower(out, detail);
}
export const skyline = (out) => draw(out, 0);
export const district = (out) => draw(out, 1);
export const street = (out) => draw(out, 2);
export const closeup = (out) => draw(out, 3);

const id = plan.model;
const slug = id.replaceAll('_', '-');
const camera = [318, 221, 373];
const lookAt = [0, 116, 0];
const module = `content/worldgen/source/places/${plan.cell}/${id}/models/${slug}-model.mjs`;
export const model = {
  id,
  title: plan.title,
  key: id,
  cell: plan.cell,
  recipe: `${slug}-model.mjs`,
  surfaces,
  build: closeup,
  wikidataId: plan.wikidataId,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: plan.sectionBasis,
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'The Futian headquarters of Shenzhen Stock Exchange, with a gridded glass tower, raised cantilevered exchange podium and open space underneath.',
  camera,
  lookAt,
  sunDirection: [124, 189, 109],
  recipeDependencies: ['generate-motat-building.mjs', 'polygon-triangulation.mjs'],
  embeddedCanonicalGraphs: ['concrete_plain', 'metal_painted'],
  mediumFiContext: {
    scale: 1,
    cameraYaw: 0.78,
    groundY: 0,
    focus: { center: lookAt },
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  qaCameras: [
    { name: 'exchange-tower-and-podium', position: [318, 210, 362], lookAt: [0, 116, 0] },
    { name: 'open-plaza-beneath-cantilever', position: [102, 13, 107], lookAt: [21, 26, 10] },
    { name: 'roof-garden-and-office-grid', position: [172, 122, -150], lookAt: [8, 83, -6] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `${slug}-${reviewLod}`,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 3.6,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 1.47, surfaces },
      street: { export: 'street', errorMeters: 0.54, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.18, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceDocuments: plan.requiredSourceDocuments,
  sourceLicense:
    'Original geometry based on native OSM building parts, written architectural and engineering facts, and original public Terrarium elevation. No reference imagery used.',
};
