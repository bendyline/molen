import { readFileSync } from 'node:fs';
import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  areaSign,
  at,
  closed,
  edge,
  face,
  floorSampler,
  mix,
  palette,
  pairs,
  surface,
  up,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';

const read = (name) => JSON.parse(readFileSync(new URL('../' + name, import.meta.url)));
const plan = read('plan-controls.json');
const { dimensions: d } = plan;
const grade = floorSampler(read('terrain-grid.json'));
const tint = palette({
  concrete: 'c4b8a6',
  recessed: 'a8967f',
  cap: 'd2c8b7',
  paving: 'b3aa96',
  concreteLine: '847e71',
  grass: '79864c',
  grassSoft: '7e8a52',
  grassDull: '75804b',
  grassEdge: '625e3c',
  patina: '589488',
  lighterPatina: '73a59b',
  frame: '655e59',
  glass: '344550',
  lightGlass: '4e666d',
  fadedGlass: '41545a',
  window: '364145',
});
const surfaces = {
  concrete: surface('wall', 'concrete_boardformed', 0.93),
  paving: surface('foundation', 'concrete_plain', 0.91),
  grass: { slot: 'roof', localRef: 'palette:#ffffff', roughness: 0.97 },
  copper: surface('roof', 'metal_copper', 0.61, 0.31),
  metal: surface('trim', 'metal_painted', 0.52, 0.34),
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.36, metallic: 0.06 },
  reveal: { slot: 'trim', localRef: 'palette:#fffffe', roughness: 0.85 },
};
const part = (id) => d.parts[id];
const height = (id, [x, z]) => {
  const [east, south, floor] = part(id).fit;
  return east * x + south * z + floor;
};
const lerp = (a, b, t) => a.map((n, i) => mix(n, b[i], t));
const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const walls = (outline) => {
  const sign = areaSign(outline);
  return pairs(closed(outline)).map(([a, b]) => edge(a, b, sign));
};
const outward = (w, u, y, offset = 0) => w.p(u * w.length, y, offset);
const greens = [tint.grass, tint.grassSoft, tint.grass, tint.grassDull, tint.grassSoft];
const glassColors = [tint.glass, tint.fadedGlass, tint.lightGlass, tint.fadedGlass, tint.glass];

function roof(out, outline, elevation, slot, color, variations = false) {
  const indices = earcut(outline.flat());
  for (let i = 0; i < indices.length; i += 3) {
    const points = indices.slice(i, i + 3).map((index) => outline[index]);
    const paint = variations ? greens[(i / 3) % greens.length] : color;
    if (Math.abs(areaSign(points)) > 0)
      face(
        out,
        slot,
        points.map((p) => at(p, elevation(p))),
        up,
        paint,
      );
  }
}

function measuredVolume(out, id, level, roofSlot, roofTint, skinDepth) {
  const { outline } = part(id);
  const top = (p) => height(id, p);
  const floor = skinDepth
    ? (p) => top(p) - skinDepth
    : (p) => Math.min(top(p) - 0.3, grade(p) - 0.88, 0.25);
  roof(out, outline, top, roofSlot, roofTint, roofSlot === 'grass' && level >= 2);
  for (const [index, w] of walls(outline).entries()) {
    const a = outline[index];
    const b = outline[(index + 1) % outline.length];
    if (w.length < 0.08) continue;
    const highA = top(a);
    const highB = top(b);
    face(
      out,
      skinDepth ? roofSlot : 'concrete',
      [at(a, floor(a)), at(b, floor(b)), at(b, highB), at(a, highA)],
      w.normal,
      skinDepth ? roofTint : tint.concrete,
    );
    if (level >= 1 && roofSlot === 'grass') {
      face(
        out,
        'reveal',
        [
          outward(w, 0, highA - 0.18, 0.025),
          outward(w, 1, highB - 0.18, 0.025),
          outward(w, 1, highB, 0.025),
          outward(w, 0, highA, 0.025),
        ],
        w.normal,
        tint.grassEdge,
      );
    }
    if (level < 2 || skinDepth || w.length < 7) continue;
    const sections = Math.ceil(w.length / (level === 2 ? 13 : 7));
    for (let j = 1; j < sections; j++) {
      const t = j / sections;
      const y = mix(highA, highB, t);
      const low = mix(floor(a), floor(b), t);
      if (y - low > 1.1) {
        const u = 0.029 / w.length;
        face(
          out,
          'reveal',
          [
            outward(w, t - u, low, 0.028),
            outward(w, t + u, low, 0.028),
            outward(w, t + u, y - 0.16, 0.028),
            outward(w, t - u, y - 0.16, 0.028),
          ],
          w.normal,
          tint.concreteLine,
        );
      }
    }
  }
}

function wraparoundTerrace(out, level) {
  const { outline } = part(1119765002);
  const floor = (p) => Math.min(1.3, grade(p)) + 0.12;
  const cuts = level >= 3 ? 3 : 1;
  const indices = earcut(outline.flat());
  for (let i = 0; i < indices.length; i += 3) {
    const [a, b, c] = indices.slice(i, i + 3).map((k) => outline[k]);
    if (areaSign([a, b, c]) === 0) continue;
    for (let j = 0; j < cuts; j++) {
      for (let k = 0; k < cuts - j; k++) {
        const point = (u, v) =>
          a.map((x, axis) => x + ((b[axis] - x) * u) / cuts + ((c[axis] - x) * v) / cuts);
        const draw = (corners) =>
          face(
            out,
            'paving',
            corners.map((p) => at(p, floor(p))),
            up,
            tint.paving,
          );
        draw([point(j, k), point(j + 1, k), point(j, k + 1)]);
        if (j + k + 1 < cuts) draw([point(j + 1, k), point(j + 1, k + 1), point(j, k + 1)]);
      }
    }
  }
}

const copperSkins = [1119765012, 1119765013, 1119765014, 1119765015];
const frontSkinIndex = [1119765013, 1119765014, 1119765015, 1119765015];
function curtainWall(out, level) {
  const id = 1119765011;
  const { outline } = part(id);
  for (const [index, w] of walls(outline).slice(0, 4).entries()) {
    const a = outline[index];
    const b = outline[index + 1];
    const roofId = frontSkinIndex[index];
    const capA = Math.min(height(roofId, a), height(id, a) + 1.2);
    const capB = Math.min(height(roofId, b), height(id, b) + 1.2);
    const point = (u, t, offset = 0) =>
      outward(
        w,
        u,
        mix(
          mix(Math.min(1.3, grade(a)), Math.min(1.3, grade(b)), u) + 0.22,
          mix(capA, capB, u) - 0.14,
          t,
        ),
        -0.12 - t * (index >= 2 ? 1.28 : 0.86) + offset,
      );
    const panel = (slot, x, x2, y, y2, offset, color) =>
      face(
        out,
        slot,
        [point(x, y, offset), point(x2, y, offset), point(x2, y2, offset), point(x, y2, offset)],
        w.normal,
        color,
      );
    const panes = Math.max(1, Math.round(w.length / [10, 5.4, 3.0, 2.25][level]));
    for (let j = 0; j < panes; j++) {
      const u = j / panes;
      const v = (j + 1) / panes;
      panel('glass', u, v, 0.055, 0.986, 0, glassColors[(j + index) % glassColors.length]);
      if (level === 0) continue;
      const width = 0.1 / w.length;
      panel('metal', Math.max(0, u - width), u + width, 0.045, 0.996, 0.032, tint.frame);
    }
    panel('concrete', 0, 1, 0, 0.055, 0.026, tint.recessed);
    panel('metal', 0, 1, 0.969, 0.995, 0.025, tint.frame);
    if (level >= 1) {
      for (const t of level > 1 ? [0.32, 0.53, 0.75] : [0.51]) {
        panel('metal', 0, 1, t - 0.006, t + 0.008, 0.033, tint.frame);
      }
      if (index === 2) {
        panel('glass', 0.31, 0.68, 0.025, 0.37, 0.073, tint.lightGlass);
        for (const u of [0.31, 0.43, 0.55, 0.68]) {
          panel('metal', u - 0.0035, u + 0.0035, 0.025, 0.37, 0.086, tint.frame);
        }
        panel('metal', 0.31, 0.68, 0.36, 0.375, 0.087, tint.frame);
      }
    }
    if (level >= 2) {
      beam(out, 'copper', point(0, 1, 0.83), point(1, 1, 0.83), 0.29, 0.48, tint.lighterPatina);
    }
  }
}

const morse = {
  A: '.-',
  B: '-...',
  C: '-.-.',
  E: '.',
  F: '..-.',
  G: '--.',
  I: '..',
  J: '.---',
  L: '.-..',
  M: '--',
  N: '-.',
  O: '---',
  R: '.-.',
  S: '...',
  T: '-',
  U: '..-',
  W: '.--',
};
function marks(text) {
  const spans = [];
  let x = 0;
  for (const letter of text) {
    if (letter === ' ') {
      x += 4;
      continue;
    }
    for (const symbol of morse[letter]) {
      const width = symbol === '.' ? 1 : 3;
      spans.push([x, x + width]);
      x += width + 1;
    }
    x += 2;
  }
  return spans.map(([a, b]) => [a / x, b / x]);
}

const finId = 1119765017;
const fin = part(finId).outline;
const fitPeak = Math.max(...fin.map((p) => height(finId, p)));
const highFin = (p) => Math.min(d.peakHeight, height(finId, p) + d.peakHeight - fitPeak);
const lowFin = (p) => Math.min(highFin(p) - 0.78, 10.9 + Math.max(0, p[0] - 65) * 0.011);
function finWindows(out, side, text, start, end, row, level) {
  const lengths = side.map((i) => distance(fin[i], fin[(i + 1) % fin.length]));
  const total = lengths.reduce((sum, x) => sum + x, 0);
  const geometry = walls(fin);
  for (const [i, [a, b]] of marks(text).entries()) {
    const left = mix(start, end, a) * total;
    const right = mix(start, end, b) * total;
    if (level === 1 && i % 2 === 1 && b - a < 0.012) continue;
    let from = 0;
    for (const [k, index] of side.entries()) {
      const w = geometry[index];
      const to = from + lengths[k];
      const u = (Math.max(left, from) - from) / w.length;
      const v = (Math.min(right, to) - from) / w.length;
      from = to;
      if (v - u < 0.11 / w.length) continue;
      const point = (t, offset, depth) => {
        const p = lerp(fin[index], fin[(index + 1) % fin.length], t);
        return outward(w, t, mix(lowFin(p), highFin(p), row) + offset, depth);
      };
      face(
        out,
        'glass',
        [
          point(u, -0.17, 0.036),
          point(v, -0.17, 0.036),
          point(v, 0.17, 0.036),
          point(u, 0.17, 0.036),
        ],
        w.normal,
        tint.window,
      );
      if (level === 3) {
        face(
          out,
          'metal',
          [
            point(u, -0.21, 0.046),
            point(v, -0.21, 0.046),
            point(v, -0.15, 0.046),
            point(u, -0.15, 0.046),
          ],
          w.normal,
          tint.lighterPatina,
        );
      }
    }
  }
}
function risingFin(out, level) {
  roof(out, fin, highFin, 'copper', tint.lighterPatina);
  for (const [i, w] of walls(fin).entries()) {
    const a = fin[i];
    const b = fin[(i + 1) % fin.length];
    face(
      out,
      'copper',
      [at(a, lowFin(a)), at(b, lowFin(b)), at(b, highFin(b)), at(a, highFin(a))],
      w.normal,
      tint.patina,
    );
    if (level >= 2 && w.length > 2) {
      const n = Math.ceil(w.length / (level === 2 ? 6 : 3));
      for (let j = 1; j < n; j++) {
        const t = j / n;
        const p = lerp(a, b, t);
        const u = 0.019 / w.length;
        face(
          out,
          'reveal',
          [
            outward(w, t - u, lowFin(p) + 0.055, 0.023),
            outward(w, t + u, lowFin(p) + 0.055, 0.023),
            outward(w, t + u, highFin(p) - 0.064, 0.023),
            outward(w, t - u, highFin(p) - 0.064, 0.023),
          ],
          w.normal,
          tint.frame,
        );
      }
    }
  }
  if (level === 0) return;
  const north = [5, 6, 7, 8, 9, 10];
  finWindows(out, north, 'LEST WE FORGET', 0.18, 0.96, 0.65, level);
  finWindows(out, north, 'NOUBLIONS JAMAIS', 0.2, 0.97, 0.4, level);
  finWindows(out, [0, 1], 'CWM', 0.05, 0.45, 0.62, level);
}

function build(out, level) {
  roof(out, d.outline, (p) => Math.min(grade(p), 0.75) - 0.39, 'paving', tint.paving);
  for (const id of [103438390, 634068958, 634068959, 1119765003, 1119765004]) {
    measuredVolume(out, id, level, 'grass', tint.grass);
  }
  for (const id of [1119765005, 1119765006, 1119765007, 1119765008, 1119765009, 1119765010]) {
    measuredVolume(out, id, level, 'paving', tint.cap);
  }
  for (const id of copperSkins) measuredVolume(out, id, level, 'copper', tint.patina, 0.38);
  measuredVolume(out, 1119765016, level, 'copper', tint.patina);
  wraparoundTerrace(out, level);
  curtainWall(out, level);
  risingFin(out, level);
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'canadian-war-museum-model.mjs';
const camera = [271, 108, 174];
const lookAt = [27, 6, 15];
const errors = { district: 0.56, street: 0.22, closeup: 0.067 };
export const canadianWarMuseumAsset = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  category: 'museum-library',
  wikidataId: 'Q1032442',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis:
    'Natural Resources Canada bare-earth elevation at the mapped Vimy Place public approach.',
  brief:
    'Ottawa’s Canadian War Museum with walkable grass slopes, canted concrete and glass, and a rising copper fin with bilingual Morse windows.',
  camera,
  lookAt,
  sunDirection: [147, 121, 89],
  mediumFiContext: {
    scale: 1,
    groundY: -0.2,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  groundCutout: {
    outline: d.outline,
    basis:
      'The native footprint bounds the replacement of raster-returned roof surfaces by the built grass roofs, walls and terrace. The original elevation data is retained outside the footprint.',
  },
  buildingCutout: {
    outline: d.outline,
    minimumCoverage: 0.92,
    basis: 'Named museum and Vimy Place entry envelope, aligned to the verified terrain.',
  },
  embeddedCanonicalGraphs: [
    'concrete_boardformed',
    'concrete_plain',
    'metal_copper',
    'metal_painted',
  ],
  recipeDependencies: ['montreal-museum-pavilion-geometry.mjs', 'polygon-triangulation.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-003.PROGRESS.md',
  qaCameras: [
    { name: 'north-peak-and-morse-apertures', position: [162, 41, -115], lookAt: [91, 13, -33] },
    { name: 'tilted-vimy-place-curtain-wall', position: [209, 22, 28], lookAt: [121, 8, -14] },
    { name: 'broad-west-grass-roof', position: [-185, 64, 110], lookAt: [-37, 8, 25] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'canadian-war-museum-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 1.12,
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
    'Original mesh under repository license. © OpenStreetMap contributors. Natural Resources Canada elevation data under the Open Government Licence – Canada.',
};
