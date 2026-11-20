import {
  beam,
  beamPath,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  areaSign,
  block,
  edge,
  face,
  mix,
  palette,
  panel,
  pavilion,
  rect,
  shell,
  surface,
  trimBlock,
  up,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';
import { lettering } from '../../../../../../../../packages/worldgen/scripts/stadium-lettering.mjs';

const surfaces = {
  masonry: surface('wall', 'stone_ashlar'),
  base: surface('foundation', 'concrete_plain'),
  roof: surface('roof', 'stone_limestone_raw'),
  glass: surface('window', 'window_grid', 0.42, 0.045),
  metal: surface('trim', 'metal_painted', 0.68, 0.11),
};
const C = palette({
  walls: 'ccbea0',
  rear: 'beae91',
  pale: 'd6cbb4',
  coping: 'e0d6bf',
  mortar: 'd4c6ae',
  paving: 'b6ac98',
  lower: 'a69a83',
  roof: 'bdb4a1',
  deep: '404848',
  glass: '73827f',
  glassLit: '829898',
  frame: '655f53',
  blue: '485f70',
  letters: 'd9d9c9',
});

function masonry(out, polygon, grade, top, color = C.walls) {
  shell(out, polygon, (p) => grade(p) - 0.21, top, {
    wall: 'masonry',
    color,
    roof: 'roof',
    roofColor: C.roof,
  });
}
function cornice(out, w, y, lod) {
  trimBlock(out, 'masonry', w, 0.03, w.length - 0.028, y - 0.23, y + 0.04, -0.02, 0.17, C.coping);
  if (lod >= 2)
    panel(out, 'masonry', w, 0.032, w.length - 0.032, y - 0.48, y - 0.415, 0.032, C.pale);
}
function glazing(out, w, u, width, y, top, lod) {
  const a = u - width / 2,
    b = u + width / 2;
  panel(out, 'glass', w, a, b, y, top, 0.044, C.glass);
  for (const r of [y - 0.1, top + 0.015])
    panel(out, 'masonry', w, a - 0.1, b + 0.1, r, r + 0.08, 0.068, C.pale);
  if (lod > 0)
    for (const x of [a, u, b]) panel(out, 'metal', w, x - 0.038, x + 0.038, y, top, 0.09, C.frame);
  if (lod >= 2)
    panel(out, 'metal', w, a, b, mix(y, top, 0.66), mix(y, top, 0.66) + 0.055, 0.09, C.frame);
}
function roofVolumes(out, lod) {
  if (lod === 0) {
    block(out, 'roof', -5.6, 5.8, -5.2, 11.2, 0.58, 10.4, C.roof);
    return;
  }
  block(out, 'masonry', -7.2, 5.54, -6.05, 14.4, 0.86, 12.1, C.pale);
  block(out, 'roof', -7.28, 6.38, -6.13, 14.56, 0.16, 12.26, C.roof);
  for (const x of [-18.9, 14.8, 41.15]) {
    const z = x > 35 ? -2.6 : 7.7;
    block(out, 'masonry', x, 5.39, z, 3.6, 0.55, 1.75, C.rear);
    block(out, 'roof', x - 0.07, 5.9, z - 0.06, 3.74, 0.115, 1.87, C.pale);
  }
  if (lod >= 2)
    for (const x of [-20.6, 10.8, -2.0])
      for (const z of [-8.9, -7.9]) block(out, 'roof', x, 5.76, z, 3.65, 0.16, 0.38, C.lower);
}
function galleries(out, p, grade, lod) {
  const h = 5.78;
  masonry(out, p, grade, h);
  const sign = areaSign(p);
  for (const [i, v] of p.entries()) {
    const w = edge(v, p[(i + 1) % p.length], sign);
    cornice(out, w, h, lod);
    if (i === 2) continue;
    const cells = i % 2 === 0 ? 5 : 10;
    const pitch = (w.length - 2.5) / cells;
    for (let j = 0; j < cells; j += lod === 0 ? 3 : 1) {
      const a = 1.25 + pitch * (j + 0.5);
      glazing(out, w, a, i % 2 === 0 ? 1.44 : 1.9, 3.25, 4.37, lod);
      if (lod >= 2)
        trimBlock(
          out,
          'masonry',
          w,
          a - pitch * 0.51,
          a - pitch * 0.51 + 0.16,
          2.68,
          4.75,
          -0.026,
          0.13,
          C.pale,
        );
    }
    if (lod >= 2)
      for (const y of [3.07, 4.58])
        panel(out, 'masonry', w, 0.16, w.length - 0.16, y, y + 0.055, 0.053, C.mortar);
  }
}
function entryConcourse(out, polygon, grade, lod) {
  const top = 5.39;
  const sign = areaSign(polygon);
  masonry(out, polygon, grade, top, C.pale);
  for (const [i, v] of polygon.entries()) {
    const w = edge(v, polygon[(i + 1) % polygon.length], sign);
    cornice(out, w, top, lod);
    if (lod > 0 && i !== 2 && w.length > 5.8)
      for (const ratio of [0.3, 0.7]) glazing(out, w, w.length * ratio, 1.25, 1.97, 3.64, lod);
  }
  const w = edge(polygon[2], polygon[3], sign);
  const mid = w.length * 0.48;
  const low = 0.56;
  const high = 3.63;
  panel(out, 'glass', w, mid - 3.25, mid + 3.25, low, high, 0.071, C.deep);
  for (const d of [-2.33, -1.16, 0, 1.16, 2.33]) {
    panel(out, 'glass', w, mid + d - 0.48, mid + d + 0.48, low + 0.07, 3.28, 0.075, C.glassLit);
    if (lod >= 2)
      panel(out, 'metal', w, mid + d - 0.034, mid + d + 0.034, 1.41, 1.72, 0.095, C.coping);
    if (lod === 3) {
      panel(out, 'metal', w, mid + d - 0.48, mid + d + 0.48, 2.72, 2.78, 0.099, C.frame);
      panel(out, 'metal', w, mid + d - 0.48, mid + d - 0.43, low + 0.08, 3.28, 0.102, C.frame);
    }
  }
  for (const u of [-3.44, 3.22])
    trimBlock(out, 'masonry', w, mid + u, mid + u + 0.22, 0.43, 4.72, -0.02, 0.25, C.coping);
  trimBlock(out, 'masonry', w, mid - 3.47, mid + 3.45, 4.62, 4.9, 0.01, 1.16, C.pale);
  panel(out, 'metal', w, mid - 2.82, mid + 2.83, 3.84, 4.52, 0.16, C.blue);
  if (lod >= 2) {
    const origin = w.p(mid, 0, 0.204);
    const rotate = ([x, y, z]) => [origin[0] + z, y, origin[2] - x];
    const signOut = Object.fromEntries(
      ['addQuad', 'addTriangle', 'addConvexPolygon'].map((method) => [
        method,
        (slot, ref, points, norm, ...args) =>
          out[method](slot, ref, points.map(rotate), [norm[2], norm[1], -norm[0]], ...args),
      ]),
    );
    const label = 'SLEMANI MUSEUM';
    const width = 5.05;
    const height = 0.34;
    const y = 4;
    const stroke = 0.037;
    lettering(signOut, label, {
      width,
      height,
      y,
      color: C.letters,
      slot: 'metal',
      stroke,
    });
    const advance = width / label.length;
    for (const [index, letter] of Array.from(label).entries()) {
      if (letter !== 'U') continue;
      const left = (index - label.length / 2) * advance;
      const glyph = [
        [0, 1],
        [0, 0.22],
        [0.2, 0],
        [0.8, 0],
        [1, 0.22],
        [1, 1],
      ];
      beamPath(
        signOut,
        'metal',
        glyph.map(([a, b]) => [left + a * advance * 0.75, y + b * height, 0]),
        stroke,
        stroke,
        C.letters,
      );
    }
  }
  const t0 = w.p(mid - 3.4, low, 0.02),
    t1 = w.p(mid + 3.4, low, 0.02);
  const p0 = w.p(mid - 3.4, low, 2.15),
    p1 = w.p(mid + 3.4, low, 2.15);
  const shape = [t0, t1, p1, p0].map(([x, , z]) => [x, z]);
  shell(out, shape, (p) => Math.min(-0.17, grade(p) - 0.16), low, {
    wall: 'base',
    color: C.lower,
    roof: 'base',
    roofColor: C.paving,
  });
  for (let k = 0; k < 3; k++) {
    const dist = 2.1 + k * 0.34;
    const a = w.p(mid - 3.12, low - k * 0.17, dist),
      b = w.p(mid + 3.12, low - k * 0.17, dist);
    const d = w.p(mid - 3.12, low - k * 0.17, dist + 0.34),
      c = w.p(mid + 3.12, low - k * 0.17, dist + 0.34);
    face(out, 'base', [a, b, c, d], up, C.pale);
    const y = low - (k + 1) * 0.17;
    face(out, 'base', [c, d, [d[0], y, d[2]], [c[0], y, c[2]]], w.normal, C.lower);
  }
  if (lod >= 2) {
    const a = w.p(mid + 3.45, 1.28, 0.6),
      b = w.p(mid + 3.45, 0.78, 3.14);
    beam(out, 'metal', a, b, 0.067, 0.067, C.frame);
    for (const t of [0.02, 0.52, 0.98]) {
      const p = a.map((v, i) => mix(v, b[i], t));
      beam(out, 'metal', [p[0], p[1] - 0.69, p[2]], p, 0.047, 0.047, C.frame);
    }
  }
  if (lod === 3)
    for (const delta of [-2.91, -1.47, 0, 1.47, 2.91]) {
      const a = w.p(mid + delta, low + 0.004, 0.19);
      const b = w.p(mid + delta, low + 0.004, 1.94);
      beam(out, 'base', a, b, 0.018, 0.006, C.lower);
    }
}
function draw(out, lod, { polygons }, grade) {
  galleries(out, polygons[0], grade, lod);
  entryConcourse(out, polygons[1], grade, lod);
  masonry(out, rect(29.71, 4.95, 30.49, 12.66), grade, 4.89, C.pale);
  roofVolumes(out, lod);
}
const museum = pavilion(
  import.meta.url,
  {
    surfaces,
    camera: [108, 27, 49],
    lookAt: [19, 2.9, 0],
    yaw: 0.62,
    sun: [540, 460, 556],
    brief:
      'The purpose-built Slemani Museum on Salim Street, with a low long gallery block and stepped street-facing entrance range.',
    views: [
      {
        name: 'salim-street-entrance-and-entry-range',
        position: [78, 10, 25],
        lookAt: [48, 2.6, 7],
      },
      { name: 'main-gallery-side-and-roof-massing', position: [23, 23, 60], lookAt: [3, 3, 0] },
      { name: 'rear-gallery-and-stone-elevations', position: [-55, 11, -41], lookAt: [-15, 3, 0] },
      { name: 'two-mapped-roof-outlines', position: [13, 80, -18], lookAt: [10, 2, 0] },
    ],
  },
  draw,
);
export const { skyline, district, street, closeup } = museum;
export const model = {
  ...museum.model,
  category: 'museum',
  recipeDependencies: [
    ...museum.model.recipeDependencies,
    'authored-structure-mesh.mjs',
    'stadium-lettering.mjs',
  ],
  sourceLicense:
    'Independent geometry from the current OpenStreetMap building outline, public Terrarium elevations and written records. No photographic references used.',
};
