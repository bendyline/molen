import {
  areaSign,
  block,
  closed,
  edge,
  mix,
  pairs,
  palette,
  panel,
  pavilion,
  planarMid,
  rect,
  shell,
  surface,
  trimBlock,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';

const surfaces = {
  base: surface('foundation', 'concrete_plain'),
  wall: surface('wall', 'concrete_plain'),
  screen: surface('trim', 'metal_painted', 0.72, 0.14),
  roof: surface('roof', 'metal_standing_seam', 0.74, 0.22),
  glass: surface('window', 'window_grid', 0.42, 0.08),
};
const C = palette({
  base: '9b978b',
  wall: 'c0bcae',
  pale: 'd0ccc1',
  core: 'b4b4a8',
  dark: '5d6762',
  glass: '648787',
  deepGlass: '41686b',
  louvre: 'a9aaa0',
  roof: 'a3a7a0',
  shoulder: 'bbbeb5',
  red: '8e413a',
  surround: 'a25045',
  warm: '918273',
  deepGreen: '667455',
  green: '84926d',
});
function edges(poly) {
  const sign = areaSign(poly);
  return pairs(closed(poly)).map(([a, b]) => ({ a, b, w: edge(a, b, sign) }));
}
function slab(out, poly, low, high, color, roof = C.roof) {
  shell(out, poly, typeof low === 'number' ? () => low : low, high, {
    wall: 'wall',
    color,
    roof: 'roof',
    roofColor: roof,
  });
}
function section(poly, boundary, dir) {
  const points = [];
  for (const [a, b] of pairs(closed(poly))) {
    const da = dir * (a[0] - boundary),
      db = dir * (b[0] - boundary);
    if (da >= 0) points.push(a);
    if (da * db < 0) points.push([boundary, mix(a[1], b[1], da / (da - db))]);
  }
  return points;
}
function wallBand(out, w, lo, hi, depth, color) {
  trimBlock(out, 'wall', w, 0, w.length, lo, hi, 0.003, depth, color);
}
function glazing(out, w, left, right, low, high, lod, color = C.glass, protrusion = 0.034) {
  if (right - left < 0.32 || high - low < 0.35) return;
  panel(out, 'glass', w, left, right, low, high, protrusion, color);
  if (!lod) return;
  const step = [0, 4.4, 2.5, 1.75][lod];
  const count = Math.ceil((right - left) / step);
  for (let i = 1; i < count; i++) {
    const u = mix(left, right, i / count);
    panel(out, 'screen', w, u - 0.044, u + 0.044, low, high, protrusion + 0.03, C.dark);
  }
  if (lod > 1) {
    const y = high - Math.min((high - low) * 0.23, 0.8);
    panel(out, 'screen', w, left, right, y - 0.029, y + 0.029, protrusion + 0.03, C.dark);
  }
}
function podium(out, outlines, grade) {
  for (const p of outlines) {
    shell(out, p, (q) => Math.min(grade(q) - 0.26, -0.7), 0.12, {
      wall: 'base',
      color: C.base,
      roof: 'wall',
      roofColor: C.pale,
    });
  }
}
function undercroft(out, lod) {
  // The mapped Knowledge Walk follows the open north-south passage between the wings.
  const x = -8.84,
    left = -12.2,
    right = -5.56;
  const approaches = [rect(-47, 11.5, left, 16.4), rect(left, -36.8, right, 51.2)];
  for (const p of approaches)
    shell(out, p, () => -0.22, 0.03, {
      wall: 'base',
      color: C.base,
      roof: 'wall',
      roofColor: C.pale,
    });
  for (const z of [-28.8, -7.9, 15.7, 33.6]) {
    for (const side of [-1, 1]) {
      block(out, 'wall', x + side * 3.09 - 0.23, 0.04, z - 0.28, 0.46, 18.32, 0.56, C.green);
    }
  }
  slab(out, rect(left, -37.7, right, 48.6), 18.34, 19.07, C.deepGreen, C.shoulder);
  if (!lod) return;
  for (const [l, r, z] of [
    [-14.0, -4.5, 2.4],
    [-13.5, -1.3, 27.5],
  ]) {
    const top = z > 15 ? 12.87 : 4.64;
    slab(out, rect(l, z - 1.25, r, z + 1.2), top - 0.31, top, C.green, C.pale);
    for (const { w } of edges(rect(l, z - 1.25, r, z + 1.2)).filter(({ w }) => w.length > 3)) {
      glazing(out, w, 0.11, w.length - 0.11, top + 0.06, top + 0.98, lod, C.glass);
    }
  }
  const corridorWall = edge([left, -35.2], [left, 47.3]);
  for (let i = 0; i < 4; i++) {
    const step = corridorWall.length / 4;
    wallBand(
      out,
      { ...corridorWall, length: step - 0.36, p: (u, y, d) => corridorWall.p(u + i * step, y, d) },
      18.24,
      18.47,
      0.14,
      C.deepGreen,
    );
  }
}
function landSide(out, p, lod) {
  slab(out, p, 4.66, 16.83, C.wall);
  const low = section(p, -30.8, 1);
  slab(out, low, 0.05, 4.64, C.green, C.pale);
  for (const { a, b, w } of edges(p)) {
    if (w.length < 3.4 || (Math.abs(a[0] + 12.15) < 0.14 && Math.abs(b[0] + 12.15) < 0.14))
      continue;
    const street = w.normal[0] < -0.37;
    glazing(out, w, 0.3, w.length - 0.3, 7.55, 14.8, lod, street ? C.deepGlass : C.glass);
    if (!street) continue;
    wallBand(out, w, 16.35, 16.98, 0.27, C.pale);
    wallBand(out, w, 5.53, 5.83, 0.2, C.deepGreen);
    const count = Math.ceil(w.length / (lod === 0 ? 3.15 : 1.1));
    for (let i = 1; i < count; i++) {
      const u = (i * w.length) / count;
      const width = lod === 0 ? 0.17 : 0.075,
        outer = lod > 1 ? 0.48 : 0.32;
      trimBlock(
        out,
        'screen',
        w,
        u - width,
        u + width,
        6.32,
        16.4,
        0.04,
        outer,
        i % 4 === 0 ? C.green : C.louvre,
      );
    }
  }
}
function riverSide(out, p, grade, lod) {
  const core = section(p, 35.95, -1);
  slab(out, core, 0.08, 17.24, C.core);
  slab(out, rect(1.45, -34.6, 32.8, 42.7), 17.2, 21.6, C.core, C.shoulder);
  const taller = rect(9.2, -24.8, 26.9, 30.8);
  slab(out, taller, 21.58, 22.34, C.shoulder);
  const outer = section(p, 35.95, 1);
  slab(out, outer, 0.08, 0.56, C.pale);
  const screenRoof = rect(31.3, -38.85, 42.46, -18.6);
  slab(out, screenRoof, 16.4, 17.28, C.pale);
  slab(out, rect(32.65, 25.95, 45.22, 46.45), 12.15, 12.84, C.pale);
  for (const { w } of edges(core)) {
    if (w.length < 6.5 || w.normal[0] < -0.35) continue;
    if (w.normal[0] > 0.4) {
      for (const [lo, hi] of [
        [1.05, 3.88],
        [5.28, 8.36],
        [9.08, 12.63],
        [13.5, 16.55],
      ]) {
        glazing(out, w, 0.4, w.length - 0.4, lo, hi, lod);
      }
      for (const [lo, hi] of [
        [4.25, 4.72],
        [8.5, 8.95],
        [12.84, 13.24],
        [16.84, 17.34],
      ]) {
        wallBand(out, w, lo, hi, 0.42, C.wall);
      }
      continue;
    }
    for (const [lo, hi] of [
      [4.95, 8.45],
      [9.3, 12.38],
      [13.72, 16.14],
    ])
      glazing(out, w, 0.55, w.length - 0.55, lo, hi, lod, C.deepGlass);
  }
  for (const [x, z] of [
    [39.5, -35.5],
    [39.5, -22.3],
    [41.36, 29.2],
    [41.36, 43.5],
  ]) {
    const hi = z < 0 ? 16.4 : 12.15;
    block(out, 'wall', x - 0.23, 0.54, z - 0.23, 0.46, hi - 0.54, 0.46, C.deepGreen);
  }
  const red = rect(35.8, -10.35, 46.06, 4.49);
  slab(out, red, 4.6, 12.9, C.red, C.surround);
  for (const { w } of edges(red).slice(0, 3)) {
    if (w.normal[0] < -0.35) continue;
    const margin = w.normal[0] > 0.8 ? 0.6 : 1.13;
    glazing(out, w, margin, w.length - margin, 5.12, 12.27, lod, C.deepGlass, 0.036);
    if (lod > 0) wallBand(out, w, 8.67, 8.9, 0.11, C.surround);
  }
  if (lod > 0) {
    const e = edge([44.7, 27], [44.7, 45.7], -1);
    panel(out, 'glass', e, 0, e.length, 0.59, 1.44, 0.022, C.glass);
    for (const t of [0.06, 0.29, 0.51, 0.72, 0.93]) {
      const u = e.length * t;
      trimBlock(out, 'screen', e, u - 0.035, u + 0.035, 0.58, 1.44, 0.033, 0.095, C.dark);
    }
  }
  const top = 0.56; // The deck’s walking surface where the stairs begin.
  const near = 45.05,
    far = 56.8,
    front = 30.2,
    back = 38.45;
  const end = Math.max(grade([far, front]), grade([far, back])) + 0.08;
  const count = [6, 11, 22, 28][lod];
  for (let i = 0; i < count; i++) {
    const x = mix(near, far, i / count);
    const next = mix(near, far, (i + 1) / count);
    const step = mix(top, end, i / (count - 1));
    shell(out, rect(x, front, next, back), (q) => Math.min(grade(q) - 0.18, step - 0.14), step, {
      wall: 'base',
      color: C.base,
      roof: 'wall',
      roofColor: C.pale,
    });
  }
}
function edgeAnnex(out, p, grade, lod) {
  const center = planarMid(p);
  const ground = grade(center);
  slab(out, p, (q) => Math.min(grade(q) - 0.21, ground - 0.3), ground + 6.9, C.wall);
  for (const { w } of edges(p)) {
    if (w.normal[0] > 0.25) {
      glazing(out, w, 0.75, w.length - 0.75, ground + 0.91, ground + 3.06, lod);
      glazing(out, w, 0.75, w.length - 0.75, ground + 3.53, ground + 6.18, lod);
      wallBand(out, w, ground + 3.04, ground + 3.5, 0.17, C.pale);
    } else {
      glazing(out, w, 1.15, w.length * 0.38, ground + 0.75, ground + 3.18, lod, C.deepGlass);
    }
  }
}
function draw(out, lod, { polygons }, grade) {
  const [full, annex] = polygons;
  const land = section(full, -12.15, -1),
    river = section(full, -5.56, 1);
  podium(out, [land, river], grade);
  landSide(out, land, lod);
  riverSide(out, river, grade, lod);
  undercroft(out, lod);
  edgeAnnex(out, annex, grade, lod);
}
const library = pavilion(
  import.meta.url,
  {
    surfaces,
    camera: [164, 86, 107],
    lookAt: [0, 7, 6],
    yaw: 1.1,
    sun: [370, 580, -530],
    brief:
      'State Library of Queensland on Brisbane’s South Bank, with its open Knowledge Walk, projecting Red Box reading room, river decks and separate Edge building.',
    views: [
      {
        name: 'brisbane-river-reading-room-and-decks',
        position: [139, 62, 89],
        lookAt: [16, 7, 8],
      },
      { name: 'stanley-place-exterior-blades', position: [-122, 38, 28], lookAt: [-22, 8, 0] },
      {
        name: 'knowledge-walk-entrance-and-bridges',
        position: [-8.8, 6.8, 70],
        lookAt: [-8.8, 5.5, 4],
      },
      { name: 'the-edge-riverside-annex', position: [82, 19, 108], lookAt: [34, 0, 74] },
      { name: 'library-terraces-and-roof', position: [-89, 102, -78], lookAt: [0, 12, 9] },
    ],
  },
  draw,
);
export const { skyline, district, street, closeup } = library;
export const model = { ...library.model, category: 'library' };
