import { readFileSync } from 'node:fs';
import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  block,
  cap,
  closed,
  edge,
  face,
  mix,
  pairs,
  palette,
  pavilion,
  rect,
  ring,
  shell,
  surface,
  up,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';

const color = palette({
  pale: 'a39a88',
  limestone: '9a9080',
  warm: 'a29584',
  stratum: '918a7d',
  slate: '8a877d',
  side: '747269',
  interior: '63645b',
  back: '595a50',
  landing: '8f8a73',
  stair: 'a59b84',
  gold: 'ba8b46',
  ochre: 'a57537',
  ice: 'c0c9c5',
  iceBlue: 'a5b5b0',
  paleIce: 'd5d9ce',
});
const surfaces = {
  rock: surface('wall', 'stone_sandstone_raw', 0.99),
  band: surface('wall', 'stone_sandstone', 0.97),
  terrace: surface('foundation', 'stone_ashlar', 0.95),
  rail: surface('trim', 'metal_painted', 0.76, 0.14),
  ice: surface('trim', 'plaster_lime', 0.64),
};
const foreground = [0, 0.14, -1];
const caveWall = {
  wall: 'terrace',
  roof: 'terrace',
  color: color.landing,
  roofColor: color.stair,
};
function stoneTint(i, course, density) {
  const position = i / density;
  const vein = 0.5 + 0.34 * Math.sin(position * 1.5 + 0.17 * course);
  const strata = 0.55 + 0.24 * Math.sin(course * 1.39 + 0.12 * position);
  const range = color.stratum.map((v, k) => mix(v, color.pale[k], vein));
  return range.map((v, k) => mix(v, color.warm[k], strata * 0.46));
}

function outline(width, height, floor) {
  return [
    [-1, 0.0, 0.5],
    [-0.98, 0.19, 0.15],
    [-0.99, 0.4, 0.2],
    [-0.95, 0.63, -0.1],
    [-0.88, 0.75, -0.45],
    [-0.7, 0.86, -0.86],
    [-0.47, 0.93, -0.72],
    [-0.22, 0.93, -0.95],
    [0.02, 0.95, -0.85],
    [0.25, 0.98, -0.55],
    [0.48, 1, -0.42],
    [0.66, 0.83, 0.26],
    [0.82, 0.69, 0.36],
    [0.95, 0.47, 0.51],
    [0.98, 0.24, 0.77],
    [1, 0.0, 0.78],
  ].map(([u, v, z]) => [(width * u) / 2, floor + height * v, z]);
}
const bluff = [
  [-45, -9, -16],
  [-44, 3, -13],
  [-42, 13, -9.8],
  [-39, 23, -6.5],
  [-36, 29, -3.2],
  [-29, 33, 0.2],
  [-21, 37.8, 2.1],
  [-11, 34.7, 2.0],
  [0.4, 32.6, 0.3],
  [6.4, 32.1, -0.8],
  [13.8, 33.0, -2.5],
  [20.8, 36.8, -4.1],
  [27.4, 37.9, -4.7],
  [32.9, 31.6, -6.8],
  [35.8, 18.2, -8.9],
  [39.2, -9.0, -15.2],
];
const rearOutline = [
  [-53, 12],
  [-52.5, 19],
  [-50.8, 26],
  [-46, 33],
  [-39, 40],
  [-32, 45],
  [-24, 49],
  [-12, 53],
  [0, 53],
  [11, 52],
  [20, 49],
  [30, 43],
  [38, 35],
  [42, 25],
  [45, 18],
  [46, 10],
];

function subset(points, lod) {
  return lod === 0 ? points.filter((_, i) => i % 2 === 0 || i === points.length - 1) : points;
}
function interpolate(a, b, t) {
  return [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];
}
function segmented(points, steps) {
  const values = [];
  for (const [a, b] of pairs(points))
    for (let i = 0; i < steps; i++) values.push(interpolate(a, b, i / steps));
  values.push(points.at(-1));
  return values;
}
function strip(out, lower, upper, target, material, tint, code = 0) {
  for (let i = 0; i < lower.length - 1; i++) {
    const j = i + 1;
    const a = lower[i],
      b = lower[j],
      c = upper[i],
      d = upper[j];
    const dir = typeof target === 'function' ? target(a, b, c, d) : target;
    const light = tint(i, code);
    face(out, material(i, code), [a, b, d], dir, light);
    face(out, material(i, code), [a, d, c], dir, light);
  }
}
function fracturedRings(from, to, bands, lod, seed, target) {
  return Array.from({ length: bands + 1 }, (_, j) => {
    const t = j / bands;
    const rough = Math.sin(t * Math.PI);
    return from.map((a, i) => {
      const b = to[i];
      const p = interpolate(a, b, t);
      const n = (Math.sin(i * 2.31 + j * 1.89 + seed) + Math.cos(i * 0.78 - j * 3.47 + seed)) * 0.5;
      const layer = Math.cos(i * 0.7 + seed) * 0.37 + Math.sin(j * 0.94) * 0.58;
      const amplitude = lod === 0 ? 0.72 : lod === 1 ? 1.07 : 1.45;
      p[0] += n * 0.68 * rough;
      p[1] += layer * 0.93 * rough;
      p[2] += amplitude * n * rough + (target ? -0.69 : 0) * Math.sin(t * Math.PI);
      return p;
    });
  });
}
function rockFace(out, d, ground, lod) {
  const density = lod === 3 ? 3 : lod === 2 ? 2 : 1;
  const lip = segmented(subset(outline(d.openingWidth, d.openingHeight, d.floor), lod), density);
  const crest = segmented(subset(bluff, lod), density);
  const outsideRear = segmented(
    subset(
      rearOutline.map(([x, z]) => [x, ground([x, z]) - 0.47, z]),
      lod,
    ),
    density,
  );
  const fascia = fracturedRings(lip, crest, [2, 4, 6, 8][lod], lod, 4, true);
  for (const [[a, b], j] of pairs(fascia).map((pair, i) => [pair, i]))
    strip(
      out,
      a,
      b,
      foreground,
      (_, k) => (k === 2 && lod > 1 ? 'band' : 'rock'),
      (i, k) => stoneTint(i, k, density),
      j,
    );
  const backslope = fracturedRings(crest, outsideRear, [2, 3, 5, 7][lod], lod, 11, false);
  for (const [[a, b], j] of pairs(backslope).map((pair, i) => [pair, i]))
    strip(
      out,
      a,
      b,
      up,
      () => 'rock',
      (i, k) => stoneTint(i, k + 3, density),
      j,
    );
  for (const side of [0, lip.length - 1]) {
    const a = lip[side],
      b = crest[side],
      c = outsideRear[side];
    const qz = side === 0 ? -16 : -17.6;
    const qx = side === 0 ? -51.7 : 44.9;
    const q = [qx, ground([qx, qz]) - 0.44, qz];
    const outside = side === 0 ? [-1, 0.15, 0] : [1, 0.15, 0];
    face(out, 'rock', [a, b, q], foreground, color.side);
    face(out, 'rock', [b, c, q], outside, color.limestone);
    face(out, 'rock', [a, q, c], outside, color.stratum);
  }
}

function recess(out, d, lod) {
  const lip = subset(outline(d.openingWidth, d.openingHeight, d.floor), lod);
  const segments = lod > 1 ? 2 : 1;
  const throat = [
    { z: 0, scale: 1, floor: d.floor, height: 1, jitter: 0 },
    { z: 5.1, scale: 0.91, floor: -0.19, height: 0.86, jitter: 0.8 },
    { z: 10.7, scale: 0.8, floor: -0.81, height: 0.67, jitter: 0.86 },
    { z: 15.95, scale: 0.64, floor: -1.63, height: 0.51, jitter: 0.64 },
    { z: 20.3, scale: 0.47, floor: -2.06, height: 0.36, jitter: 0.54 },
    { z: d.caveDepth, scale: 0.23, floor: d.innerFloor, height: 0.2, jitter: 0.41 },
  ];
  const levels = lod === 0 ? throat.filter((_, i) => i === 0 || i === 2 || i === 5) : throat;
  const rings = levels.map(({ z, scale, floor, height, jitter }, j) =>
    segmented(
      lip.map(([x, y, p], i) => [
        x * scale + jitter * Math.cos(i * 0.78 + j),
        floor +
          (y - d.floor) * height +
          jitter * Math.sin(i * 2.77 + j * 1.91) * Math.sin((Math.PI * i) / (lip.length - 1)),
        z + p * (j === 0 ? 1 : 0.4) + jitter * Math.cos(i * 0.81),
      ]),
      segments,
    ),
  );
  const target = (a, b) => [-(a[0] + b[0]) / d.openingWidth, -1, -0.09];
  for (const [[a, b], j] of pairs(rings).map((pair, i) => [pair, i])) {
    strip(
      out,
      a,
      b,
      target,
      () => 'rock',
      (i, k) => {
        const tint = Math.min(
          0.9,
          k * 0.16 + 0.21 + 0.13 * Math.sin((i / segments) * 1.41 + 0.74 * k),
        );
        return color.interior.map((v, index) => mix(v, color.back[index], tint));
      },
      j,
    );
    const ar = a[0],
      al = a.at(-1),
      br = b[0],
      bl = b.at(-1);
    face(out, 'rock', [ar, al, bl], up, j === 0 ? color.side : color.interior);
    face(out, 'rock', [ar, bl, br], up, j === 0 ? color.side : color.interior);
  }
  const back = rings.at(-1),
    hub = [0, d.innerFloor + 1.25, d.caveDepth + 0.22];
  for (const [a, b] of pairs(closed(back))) face(out, 'rock', [a, b, hub], foreground, color.back);
}
function terrace(out, bounds, top, ground) {
  const poly = rect(...bounds);
  shell(out, poly, (p) => Math.min(top - 0.25, ground(p) - 0.3), top, caveWall);
}
function railing(out, a, b, y, top, lod, strict = false) {
  const w = edge(a, b);
  const mid = y + top * 0.53;
  const pieces = Math.max(
    2,
    Math.ceil(
      w.length / (lod === 0 ? 3.0 : lod === 1 ? 2.1 : lod === 2 ? 1.45 : strict ? 0.63 : 1.02),
    ),
  );
  // Continuous top and mid rails carry the visible yellow/orange line.
  beam(out, 'rail', w.p(0, y + top), w.p(w.length, y + top), 0.105, 0.101, color.gold);
  if (lod > 0) beam(out, 'rail', w.p(0, mid), w.p(w.length, mid), 0.064, 0.067, color.ochre);
  for (let i = 0; i <= pieces; i++) {
    const v = (w.length * i) / pieces;
    beam(
      out,
      'rail',
      w.p(v, y - 0.02),
      w.p(v, y + top + (strict ? 0.13 : 0)),
      lod < 2 ? 0.105 : 0.087,
      0.077,
      color.gold,
    );
  }
}
function pilgrimageTerrace(out, d, ground, lod) {
  terrace(out, [-16.6, -6.1, 16.8, 1.02], d.floor, ground);
  terrace(out, [-15.3, -12.2, 14.8, -7.2], -1.89, ground);
  const poly = [
    [-12.8, -23.6],
    [5.1, -26.7],
    [9.9, -22.6],
    [-8.4, -18.9],
  ];
  shell(out, poly, (p) => Math.min(-5.45, ground(p) - 0.45), -4.28, caveWall);
  railing(out, [-16.35, -5.86], [-2.7, -5.86], d.floor, 1.04, lod);
  railing(out, [2.7, -5.86], [16.5, -5.86], d.floor, 1.04, lod);
  railing(out, [-14.95, -11.89], [-2.7, -11.89], -1.89, 1.08, lod);
  railing(out, [2.7, -11.89], [14.57, -11.89], -1.89, 1.08, lod);
  const flights = [
    { x: -2.48, width: 4.96, lo: -12.47, hi: -5.83, bottom: -3.28, top: 0.31 },
    { x: 1.1, width: 4.21, lo: -23.91, hi: -11.85, bottom: -6.63, top: -1.84 },
  ];
  for (const f of flights) {
    const n = [3, 7, 12, 18][lod];
    for (let i = 0; i < n; i++) {
      const a = mix(f.lo, f.hi, i / n),
        b = mix(f.lo, f.hi, (i + 1) / n);
      const top = mix(f.bottom, f.top, (i + 1) / n);
      const floor = Math.min(top - 0.14, ground([f.x + 0.5 * f.width, a]) - 0.31);
      block(out, 'terrace', f.x, floor, a, f.width, top - floor, b - a, color.stair);
    }
    for (const side of [f.x + 0.17, f.x + f.width - 0.17]) {
      beam(
        out,
        'rail',
        [side, f.bottom + 0.95, f.lo],
        [side, f.top + 0.96, f.hi],
        0.088,
        0.095,
        color.ochre,
      );
      if (lod > 0)
        for (const q of [0, 0.23, 0.46, 0.7, 0.93]) {
          const z = mix(f.lo, f.hi, q),
            base = mix(f.bottom, f.top, q + 0.05);
          beam(
            out,
            'rail',
            [side, base - 0.04, z],
            [side, base + 0.89, z],
            0.075,
            0.089,
            color.gold,
          );
        }
    }
  }
}
function shrine(out, d, lod) {
  const floor = -2.1,
    center = [-0.08, 21.6];
  const poly = rect(-4.05, 17.7, 4.0, 22.86);
  shell(out, poly, () => floor - 0.64, floor, caveWall);
  const rings = [
    [floor, 1.09],
    [floor + 0.25, 1.07],
    [floor + 0.57, 0.93],
    [floor + 1.05, 0.76],
    [floor + 1.47, 0.56],
    [floor + 1.62, 0.25],
    [floor + 1.65, 0.06],
  ];
  const n = [8, 12, 18, 24][lod];
  ring(out, 'ice', center, rings, n, color.ice);
  ring(
    out,
    'ice',
    [-1.9, 20.92],
    [
      [floor, 0.42],
      [floor + 0.35, 0.36],
      [floor + 0.74, 0.11],
      [floor + 0.76, 0.033],
    ],
    Math.max(n - 4, 5),
    color.iceBlue,
  );
  if (lod > 0)
    ring(
      out,
      'ice',
      [-2.97, 21.25],
      [
        [floor, 0.35],
        [floor + 0.29, 0.25],
        [floor + 0.51, 0.04],
      ],
      Math.max(n - 6, 5),
      color.paleIce,
    );
  railing(out, [-3.81, 17.83], [3.8, 17.83], floor, 0.82, lod, true);
  if (lod > 0) {
    railing(out, [-3.81, 17.83], [-3.56, 21.1], floor, 0.82, lod, true);
    railing(out, [3.8, 17.83], [3.61, 21.0], floor, 0.82, lod, true);
  }
}
function draw(out, lod, d, ground) {
  rockFace(out, d, ground, lod);
  recess(out, d, lod);
  pilgrimageTerrace(out, d, ground, lod);
  shrine(out, d, lod);
}
const temple = pavilion(
  import.meta.url,
  {
    surfaces,
    camera: [46, 17, -107],
    lookAt: [0, 12, 6],
    yaw: 0.22,
    sun: [-43, 94, -71],
    brief:
      'The south-facing limestone mouth and constructed pilgrim terraces of Amarnath Cave Temple, showing its seasonal sacred ice formation.',
    views: [
      { name: 'limestone-mouth-from-the-lower-terrace', position: [5, 2, -57], lookAt: [0, 10, 0] },
      { name: 'stratified-cliff-and-stone-terraces', position: [-39, 23, -51], lookAt: [0, 13, 4] },
      {
        name: 'pilgrimage-steps-and-ochre-rails',
        position: [15, 1.9, -27],
        lookAt: [0, -0.25, -5],
      },
      {
        name: 'seasonal-ice-shrine-from-the-mouth',
        position: [1.2, 2.0, 3.5],
        lookAt: [0, -1.3, 21.5],
      },
    ],
  },
  draw,
);
export const { skyline, district, street, closeup } = temple;
const plan = JSON.parse(readFileSync(new URL('../plan-controls.json', import.meta.url)));
export const model = {
  ...temple.model,
  category: 'religious',
  recipeDependencies: [...temple.model.recipeDependencies, 'authored-structure-mesh.mjs'],
  sourceLicense:
    'Independent exterior and visible cave recess from public-domain Qualla photographs, official aperture dimensions and the original terrain input.',
  groundCutout: {
    outline: plan.dimensions.cavernCut,
    basis:
      'A bounded reversible hole at the represented natural cave void. The original elevation field supplies the surrounding exposed valley and cliff slopes.',
  },
};
