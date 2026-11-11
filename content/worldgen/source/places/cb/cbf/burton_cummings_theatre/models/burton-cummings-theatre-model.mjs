/** The former Walker Theatre on Smith Street, with its 2014 marquee and green blade sign. */
import fs from 'node:fs';
import { createRequire } from 'node:module';
import {
  beam, beamPath, normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { B as box, rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { quad } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const requireFromWorldgen = createRequire(new URL('../../../../../../../../packages/worldgen/package.json', import.meta.url));
const { default: earcut } = requireFromWorldgen('earcut');
const read = (name) => JSON.parse(fs.readFileSync(new URL(`../${name}.json`, import.meta.url)));
const plan = read('plan-controls'), s = plan.section;
const [outline] = read('map-frame').geometry.polygons;
const terrain = read('terrain-grid');

const surfaces = {
  brick: { slot: 'wall', graph: 'brick', roughness: 0.94, metallic: 0 },
  stone: { slot: 'wall', graph: 'stone_limestone', roughness: 0.91, metallic: 0 },
  trim: { slot: 'trim', graph: 'stone_limestone_raw', roughness: 0.88, metallic: 0 },
  roof: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.83, metallic: 0.12 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.62, metallic: 0.14 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.49, metallic: 0.12 },
};
const c = Object.fromEntries(Object.entries({
  brick: 'b0a589', brickLow: '89856d', brickShade: 'a29b82', trim: 'cfbda0',
  stone: 'c0af93', darkStone: '9e8d75', white: 'e1d6be', roof: '777672',
  sign: '36745a', green: '425e4c', dark: '313531', glass: '494c47', pane: 'cad2cf',
  black: '393836', cream: 'e5e5d6', lettering: 'dce2d1',
}).map(([name, hex]) => [name, rgb(hex)]));
const up = [0, 1, 0], forward = [0, 0, 1], white = 'palette:#ffffff';
const [left, right] = [outline[s.frontEdges[1]][0], outline[s.frontEdges[0]][0]];
const z = s.frontZ;

function face(out, slot, points, expected, tint) {
  let normal = normalFor(...points);
  if (normal.reduce((sum, value, i) => sum + value * expected[i], 0) < 0) {
    points = [...points].reverse();
    normal = normalFor(...points);
  }
  if (points.length === 4) quad(out, slot, points, normal, tint);
  else out.addTriangle(slot, white, points, normal, [[0, 0], [1, 0], [0, 1]], tint);
}

function ground([x, z]) {
  const u = (x - terrain.origin[0]) / terrain.stepMeters;
  const v = (z - terrain.origin[1]) / terrain.stepMeters;
  const i = Math.floor(u), j = Math.floor(v), dx = u - i, dz = v - j;
  const a = terrain.heightsMeters[j], b = terrain.heightsMeters[j + 1];
  return (a[i] * (1 - dx) + a[i + 1] * dx) * (1 - dz) +
    (b[i] * (1 - dx) + b[i + 1] * dx) * dz - terrain.modelDatumElevationMeters;
}

const foundation = (p) => Math.min(s.floor - 0.49, ground(p) - 0.31);
const wallAt = (out, slot, a, b, low, high, z, tint) =>
  face(out, slot, [[a, low, z], [b, low, z], [b, high, z], [a, high, z]], forward, tint);

function planar(out, slot, ring, holes, to3d, normal, tint) {
  const xy = [...ring, ...holes.flat()];
  let next = ring.length;
  const indices = earcut(xy.flat(), holes.map((hole) => {
    const offset = next;
    next += hole.length;
    return offset;
  }));
  for (let i = 0; i < indices.length; i += 3) {
    const [a, b, c] = indices.slice(i, i + 3).map((index) => xy[index]);
    const area = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    if (Math.abs(area) < 1e-8) continue;
    face(out, slot, [a, b, c].map(to3d), normal, tint);
  }
}

function brickEdge(out, a, b, high, material, tint, lod) {
  const [x, z] = a, [u, v] = b, normal = [v - z, 0, x - u];
  const low = [foundation(a), foundation(b)], width = Math.hypot(u - x, v - z);
  face(out, material, [[x, low[0], z], [u, low[1], v], [u, high, v], [x, high, z]], normal, tint);
  if (lod < 2 || width < 1.0) return;
  const xOff = 0.024 * normal[0] / width, zOff = 0.024 * normal[2] / width;
  face(out, 'brick', [[x + xOff, low[0], z + zOff], [u + xOff, low[1], v + zOff],
    [u + xOff, 1.32, v + zOff], [x + xOff, 1.32, z + zOff]], normal, c.brickLow);
}

function building(out, lod) {
  const main = [...outline.slice(11), ...outline.slice(0, 3)];
  const lobby = outline.slice(2, 12);
  const elevation = (ring, y, skipEdge) => {
    for (let i = 0; i < ring.length - 1; i++) {
      if (i === skipEdge) continue;
      brickEdge(out, ring[i], ring[i + 1], y, 'brick', y === s.lobbyTop ? c.brick : c.brickShade, lod);
    }
    brickEdge(out, ring.at(-1), ring[0], y, 'brick', c.brick, lod);
    planar(out, 'roof', ring, [], ([x, z]) => [x, y - 0.04, z], up, c.roof);
  };
  elevation(main, s.auditoriumTop);
  elevation(lobby, s.lobbyTop, 7);
  const [x, u, p, q] = s.flyBounds;
  box(out, 'brick', (x + u) / 2, s.auditoriumTop - 0.06, (p + q) / 2, u - x,
    s.flyTop - s.auditoriumTop + 0.06, q - p, c.brickShade);
  box(out, 'roof', (x + u) / 2, s.flyTop - 0.12, (p + q) / 2, u - x + 0.16, 0.16, q - p + 0.16, c.roof);
  if (!lod) return;
  for (const [xx, zz, w, d] of [[-7.1, -9.9, 4.1, 2.2], [9.4, -6.2, 3.7, 3.1]]) {
    box(out, 'roof', xx, s.auditoriumTop - 0.03, zz, w, 0.52, d, c.dark);
  }
  for (const x of [-16.7, -11.14, -5.58, 0.4, 6.2, 11.9]) {
    const rear = -24.88 - 0.0063 * (x + 20);
    box(out, 'metal', x, s.floor, rear - 0.035, 1.55, 2.67, 0.095, c.dark);
    if (lod >= 2) {
      box(out, 'trim', x, 2.65, rear - 0.09, 1.72, 0.14, 0.22, c.darkStone);
    }
  }
  if (lod < 2) return;
  const stairX = [-15.65, -5.30, 5.05], rear = -25.23;
  for (const x of stairX) {
    for (const h of [3.62, 7.56, 11.50]) {
      box(out, 'metal', x, h - 0.12, rear - 0.62, 1.70, 0.14, 1.50, c.black);
      box(out, 'metal', x, h, rear + 0.17, 0.94, 1.89, 0.08, c.black);
      for (const sign of [-1, 1]) {
        beam(out, 'metal', [x + sign * 0.72, h + 0.80, rear - 1.36], [x + sign * 0.72, h + 0.80, rear],
          0.045, 0.045, c.black);
        beam(out, 'metal', [x + sign * 0.52, h, rear - 1.24], [x + 2.84 + sign * 0.52, h - 3.56, rear - 1.24],
          0.078, 0.079, c.black);
      }
      if (lod === 3) {
        for (let i = 0; i < 14; i++) {
          box(out, 'metal', x + i * 0.205, h - i * 0.25 - 0.04, rear - 1.24, 0.24, 0.055, 0.98, c.black);
        }
      }
    }
  }
}

function entrance(out, lod) {
  const x = s.entranceAxis;
  const { bottom, spring, top, width } = s.arch;
  const facade = [[left, 4.68], [right, 4.68], [right, s.lobbyTop], [left, s.lobbyTop]];
  const count = [6, 9, 13, 18][lod];
  const arc = Array.from({ length: count + 1 }, (_, i) => {
    const angle = Math.PI * i / count;
    return [x - width / 2 * Math.cos(angle), spring + (top - spring) * Math.sin(angle)];
  });
  const opening = [[x - width / 2, bottom], ...arc, [x + width / 2, bottom]];
  const front = ([x, y]) => [x, y, z];
  planar(out, 'stone', facade, [opening], front, forward, c.stone);
  planar(out, 'glass', opening, [], ([u, y]) => [u, y, z - 0.28], forward, c.glass);
  for (let i = 1; i <= opening.length; i++) {
    const [a, y] = opening[i - 1], [b, h] = opening[i % opening.length];
    const points = [[a, y, z], [b, h, z], [b, h, z - 0.28], [a, y, z - 0.28]];
    face(out, 'stone', points, normalFor(...points), c.darkStone);
  }
  wallAt(out, 'stone', left, right, s.floor - 0.48, s.floor, z, c.darkStone);
  wallAt(out, 'metal', left, right, s.floor, 4.69, z, c.green);
  for (const [u, v] of [[x - 4.32, x - 1.15], [x - 0.85, x + 2.65], [x + 2.96, x + 5.1]]) {
    box(out, 'glass', (u + v) / 2, s.floor + 0.08, z + 0.035, v - u, 3.27, 0.09, c.dark);
    if (!lod) continue;
    for (const t of [u, (u + v) / 2, v]) box(out, 'metal', t, s.floor, z + 0.087, 0.076, 3.48, 0.10, c.green);
    box(out, 'metal', (u + v) / 2, 3.25, z + 0.096, v - u, 0.095, 0.10, c.green);
  }
  const belt = (y, height, projection, tint) =>
    box(out, 'trim', (left + right) / 2, y, z + 0.045, right - left + 0.18, height, projection, tint);
  belt(10.64, 0.30, 0.49, c.trim);
  belt(11.04, 0.18, 0.68, c.white);
  belt(12.84, 0.24, 0.48, c.white);
  if (!lod) return;
  beamPath(out, 'trim', [[x - width / 2 - 0.13, bottom, z + 0.12],
    ...arc.map(([u, y]) => [x + (u - x) * 1.062, y + 0.12, z + 0.12]),
    [x + width / 2 + 0.13, bottom, z + 0.12]], 0.25, 0.24, c.trim);
  for (const u of [x - 2.40, x, x + 2.40]) {
    const y = spring + (top - spring) * Math.sqrt(1 - Math.pow((2 * (u - x)) / width, 2));
    box(out, 'metal', u, bottom, z - 0.19, 0.11, y - bottom, 0.10, c.dark);
  }
  for (const y of [6.44, 7.62]) {
    box(out, 'metal', x, y, z - 0.19, width - 0.08, 0.086, 0.10, c.dark);
  }
  box(out, 'trim', x, top - 0.12, z + 0.18, 0.42, 0.45, 0.32, c.white);
  for (const [u, blind] of [[x - 4.43, true], [x, false], [x + 4.43, true]]) {
    box(out, 'trim', u, 11.36, z + 0.06, 1.81, 1.26, 0.18, c.trim);
    box(out, blind ? 'stone' : 'glass', u, 11.48, z + 0.166, 1.25, 0.91, 0.075, blind ? c.darkStone : c.glass);
    if (lod < 2) continue;
    if (blind) {
      beamPath(out, 'trim', [[u - 0.57, 12.30, z + 0.22], [u - 0.33, 12.10, z + 0.22],
        [u, 12.04, z + 0.22], [u + 0.33, 12.10, z + 0.22], [u + 0.57, 12.30, z + 0.22]],
        0.088, 0.10, c.trim);
    } else box(out, 'trim', u, 11.53, z + 0.221, 0.083, 0.84, 0.087, c.trim);
  }
  if (lod < 2) return;
  for (let i = 0; i < 34; i++) {
    const u = left + 0.36 + i * (right - left - 0.72) / 33;
    box(out, 'trim', u, 10.43, z + 0.155, 0.155, 0.23, 0.27, c.trim);
  }
  for (const u of [left + 0.19, right - 0.19]) {
    for (let i = 0; i < 10; i++) {
      box(out, 'trim', u, 5.0 + i * 0.57, z + 0.055, 0.41 + (i % 2) * 0.10, 0.42, 0.13, c.trim);
    }
  }
}

const glyphs = {
  C: ['01110', '11001', '11000', '11000', '11000', '11001', '01110'],
  U: ['11011', '11011', '11011', '11011', '11011', '11011', '01110'],
  M: ['10001', '11011', '11111', '10101', '10001', '10001', '10001'],
  I: ['11111', '00100', '00100', '00100', '00100', '00100', '11111'],
  N: ['11001', '11001', '11101', '10101', '10111', '10011', '10011'],
  G: ['01110', '11001', '11000', '11011', '11001', '11001', '01110'],
  S: ['01111', '11000', '11000', '01110', '00011', '00011', '11110'],
};

function marquee(out, lod) {
  const { frontZ, bottom, top } = s.canopy;
  const depth = frontZ - z + 0.13, w = right - left + 0.23;
  const x = (left + right) / 2, mid = (frontZ + z) / 2;
  box(out, 'metal', x, bottom, mid, w, top - bottom, depth, c.black);
  box(out, 'glass', x, bottom + 0.14, frontZ + 0.033, w - 0.32, top - bottom - 0.25, 0.074, c.pane);
  box(out, 'glass', left - 0.14, bottom + 0.14, mid, 0.064, top - bottom - 0.25, depth - 0.16, c.pane);
  const sign = s.sign;
  box(out, 'metal', sign.x, sign.bottom, sign.z, 0.23, sign.top - sign.bottom, 1.65, c.sign);
  if (!lod) return;
  for (const u of [left + 0.30, right - 0.30]) {
    box(out, 'metal', u, s.floor, frontZ - 0.34, 0.14, bottom - s.floor + 0.09, 0.14, c.black);
  }
  for (const h of [bottom + 0.43, bottom + 0.72]) {
    box(out, 'metal', x, h, frontZ + 0.074, w - 0.36, 0.016, 0.014, c.white);
  }
  for (const yy of [sign.bottom + 0.31, sign.top - 0.29]) {
    box(out, 'metal', sign.x, yy, z - 0.05, 0.14, 0.14, 1.24, c.black);
  }
  if (lod < 2) return;
  for (const side of [-1, 1]) {
    const xx = sign.x + side * 0.119, normal = [side, 0, 0];
    for (const [letterIndex, letter] of [...'CUMMINGS'].entries()) {
      const yy = sign.top - 0.42 - letterIndex * 0.96;
      for (const [row, pattern] of glyphs[letter].entries()) {
        for (const [column, active] of [...pattern].entries()) {
          if (active !== '1') continue;
          const a = sign.z - side * ((column - 2.5) * 0.185);
          const b = a - side * 0.185;
          const h = yy - row * 0.098;
          face(out, 'glass', [[xx, h - 0.098, a], [xx, h - 0.098, b], [xx, h, b], [xx, h, a]], normal, c.lettering);
        }
      }
    }
  }
}

function build(out, lod) {
  building(out, lod);
  entrance(out, lod);
  marquee(out, lod);
}

export const theatreSkyline = (out) => build(out, 0);
export const theatreDistrict = (out) => build(out, 1);
export const theatreStreet = (out) => build(out, 2);
export const theatreCloseup = (out) => build(out, 3);

const recipe = 'burton-cummings-theatre-model.mjs';
const camera = [-44, 25, 66], lookAt = [-1.1, 9.1, -3.2];
const authoredLevels = Object.fromEntries([
  ['district', 'theatreDistrict', 0.29], ['street', 'theatreStreet', 0.13], ['closeup', 'theatreCloseup', 0.036],
].map(([level, entry, errorMeters]) => [level, { export: entry, errorMeters, surfaces }]));

export const theatreModel = {
  id: plan.model, key: plan.model, title: plan.title, cell: plan.cell, wikidataId: plan.wikidataId,
  recipe, surfaces, build: theatreCloseup, category: 'theatre', quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json', geographicStatus: 'historical-proposal', orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief: 'The 2014 Burton Cummings Theatre in Winnipeg, with its limestone Smith Street arch, green blade sign, cream marquee and attached buff-brick auditorium and stage tower.',
  appearance: { kind: 'historical', representedDate: plan.representedDate, validFrom: plan.validFrom, validUntil: plan.validUntil, currentWorldEligible: false },
  camera, lookAt,
  buildingCutout: { outline, minimumCoverage: 0.92, basis: 'Named whole theatre outline from OpenStreetMap way 33166375.' },
  mediumFiContext: { scale: 0.82, groundY: 0, terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' } },
  embeddedCanonicalGraphs: ['brick', 'stone_limestone', 'stone_limestone_raw', 'metal_standing_seam', 'metal_painted'],
  qaCameras: [
    { name: 'smith-street-limestone-arch-and-marquee', position: [0.3, 7.2, 44], lookAt: [5.4, 7.0, 13.4] },
    { name: 'buff-brick-entrance-return-and-blade-sign', position: [-26, 8.7, 48], lookAt: [1.8, 7.8, 8.1] },
    { name: 'auditorium-and-stage-tower', position: [48, 26, -59], lookAt: [-2.3, 9.5, -8.7] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `whole-burton-cummings-${reviewLod}`, position: camera, lookAt, reviewLod,
  })),
  runtimeLodOverlay: { module: `content/worldgen/source/places/${plan.cell}/${plan.model}/models/${recipe}`,
    level: 'skyline', export: 'theatreSkyline', errorMeters: 0.74, surfaces, authoredLevels },
  limitations: plan.limitations,
  sourceLicense: 'Original geometry under the repository license, OpenStreetMap ODbL 1.0 and one exact Qualla CC0 photo.',
};
