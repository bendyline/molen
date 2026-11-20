import controls from '../plan-controls.json' with { type: 'json' };
import { beamPath } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  areaSign,
  block,
  closed,
  edge,
  face,
  mix,
  pairs,
  palette,
  panel,
  pavilion,
  rect,
  shell,
  surface,
  trimBlock,
  up,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';

const surfaces = {
  wall: surface('wall', 'plaster_lime'),
  sandstone: surface('trim', 'stone_sandstone'),
  base: surface('foundation', 'stone_ashlar'),
  slate: surface('roof', 'slate'),
  tile: surface('roof', 'tile_ceramic'),
  glass: surface('window', 'window_punched', 0.47, 0.17),
  wood: surface('door', 'wood_plain'),
  iron: surface('trim', 'metal_painted', 0.76, 0.18),
};
const C = palette({
  house: 'd0c1a7',
  rear: 'c5baa5',
  pale: 'dfd0b4',
  sandstone: 'b9a38a',
  base: '969085',
  dark: '746959',
  recess: '655d50',
  glass: '747d7b',
  wood: '877162',
  slate: '6b7175',
  ridge: '61676b',
  tile: '996f5f',
  tileShade: '866356',
  garden: 'ded8c9',
  iron: '666c67',
});
const streetGroups = [
  [2.07],
  [4.52, 6.1],
  [9.06],
  [12.08, 13.68],
  [16.75, 18.35],
  [21.44],
  [24.38, 25.97],
];

function moldedBand(out, lod, w, low, high, depth, tint) {
  if (lod < 2) panel(out, 'sandstone', w, 0, w.length, low, high, depth, tint);
  else trimBlock(out, 'sandstone', w, 0, w.length, low, high, -0.085, depth, tint);
}

function window(out, lod, w, x, low, spring, width, rise, formal = false, timber = false) {
  const a = x - width / 2;
  const b = x + width / 2;
  const depth = 0.035;
  const aperture = timber ? 'wood' : 'glass';
  const tint = timber ? C.wood : C.glass;
  panel(out, aperture, w, a, b, low, spring + 0.016, depth, tint);
  if (rise) {
    const steps = [4, 6, 8, 12][lod];
    const span = Array.from({ length: steps + 1 }, (_, i) => {
      const t = (i * Math.PI) / steps;
      return [x + (width * Math.cos(t)) / 2, spring + rise * Math.sin(t)];
    });
    face(
      out,
      aperture,
      span.map(([u, y]) => w.p(u, y, depth)),
      w.normal,
      tint,
    );
    if (lod > 0) {
      const rim = span.map(([u, y]) => [x + (u - x) * 1.23, spring + (y - spring) * 1.19 + 0.041]);
      for (let j = 0; j < steps; j++) {
        const [l, f] = span[j];
        const [r, g] = span[j + 1];
        const [p, h] = rim[j];
        const [q, k] = rim[j + 1];
        const stone = lod === 3 && j % 2 ? C.pale : C.sandstone;
        face(
          out,
          'sandstone',
          [w.p(l, f, 0.094), w.p(r, g, 0.094), w.p(q, k, 0.121), w.p(p, h, 0.121)],
          w.normal,
          stone,
        );
      }
      if (formal && lod > 1) {
        const h = spring + rise * 1.18;
        face(
          out,
          'sandstone',
          [
            w.p(x - 0.077, h - 0.08, 0.155),
            w.p(x + 0.077, h - 0.08, 0.155),
            w.p(x + 0.14, h + 0.19, 0.178),
            w.p(x - 0.14, h + 0.19, 0.178),
          ],
          w.normal,
          C.pale,
        );
      }
    }
  } else if (lod > 0)
    panel(out, 'sandstone', w, a - 0.11, b + 0.11, spring, spring + 0.11, 0.121, C.sandstone);

  if (lod === 0) return;
  for (const x of [a, b])
    panel(out, 'sandstone', w, x - 0.077, x + 0.077, low, spring + 0.024, 0.114, C.pale);
  if (lod === 1)
    panel(out, 'sandstone', w, a - 0.14, b + 0.14, low - 0.12, low + 0.015, 0.134, C.pale);
  else {
    trimBlock(
      out,
      'sandstone',
      w,
      a - 0.165,
      b + 0.165,
      low - 0.14,
      low + 0.017,
      -0.015,
      0.247,
      C.pale,
    );
    for (const u of [x - 0.029, x + 0.029])
      panel(out, 'wood', w, u - 0.015, u + 0.015, low + 0.14, spring, 0.067, C.wood);
    for (const y of [low + (spring - low) * 0.65, spring - 0.04])
      panel(out, 'wood', w, a + 0.033, b - 0.033, y, y + 0.047, 0.082, C.wood);
    if (lod === 3 && formal) {
      for (const z of [a + width * 0.16, b - width * 0.16])
        panel(
          out,
          'sandstone',
          w,
          z - 0.078,
          z + 0.078,
          low - 0.35,
          low - 0.141,
          0.156,
          C.sandstone,
        );
    }
  }
}

function street(out, lod, w, eave) {
  moldedBand(out, lod, w, 0.7, 0.88, 0.135, C.base);
  moldedBand(out, lod, w, 4.025, 4.22, 0.207, C.sandstone);
  moldedBand(out, lod, w, 4.22, 4.35, 0.255, C.pale);
  moldedBand(out, lod, w, eave - 0.49, eave - 0.27, 0.322, C.sandstone);
  moldedBand(out, lod, w, eave - 0.25, eave + 0.03, 0.408, C.pale);
  for (const [index, group] of streetGroups.entries()) {
    for (const [i, u] of group.entries()) {
      if (index > 0) window(out, lod, w, u, 1.24, 3.25, 1.17, 0.57, true);
      window(out, lod, w, u, 4.79, 6.95, 1.25, 0.56, true);
      window(out, lod, w, u, 8.31, 10.18, 1.19, 0.31, true);
      if (lod > 0 || i === 0) window(out, lod, w, u, 11.78, 13.73, 1.16, 0, true);
    }
    if (lod > 0) {
      const l = group[0] - 0.8;
      const r = group.at(-1) + 0.8;
      panel(out, 'sandstone', w, l, r, 7.67, 7.81, 0.195, C.pale);
      if (lod > 1) trimBlock(out, 'sandstone', w, l, r, 7.81, 7.91, -0.02, 0.285, C.pale);
    }
  }

  panel(out, 'sandstone', w, 0.42, 3.22, 0.91, 3.58, 0.097, C.sandstone);
  panel(out, 'glass', w, 0.59, 3.03, 1.22, 3.42, 0.116, C.glass);
  if (lod > 0) {
    for (const x of [1.42, 2.21])
      panel(out, 'wood', w, x - 0.042, x + 0.042, 1.22, 3.42, 0.149, C.wood);
    panel(out, 'wood', w, 0.62, 3.0, 2.96, 3.02, 0.158, C.wood);
    panel(out, 'sandstone', w, 15.0 - 0.27, 15.0 + 0.27, 5.77, 6.35, 0.146, C.dark);
    panel(out, 'iron', w, 15.0 - 0.2, 15.0 + 0.2, 5.82, 6.29, 0.162, C.iron);
  }
  if (lod === 3) {
    const span = 0.72;
    const n = Math.floor(w.length / span);
    for (let i = 1; i < n; i++) {
      const x = i * span;
      trimBlock(
        out,
        'sandstone',
        w,
        x - 0.075,
        x + 0.075,
        eave - 0.76,
        eave - 0.49,
        0.01,
        0.321,
        C.sandstone,
      );
    }
    for (const [x, y] of [
      [0.24, 0.8],
      [w.length - 0.28, 0.8],
    ]) {
      const p = (h) => w.p(x, h, 0.149);
      beamPath(out, 'iron', [p(y), p(eave - 0.35)], 0.075, 0.083, C.iron);
    }
  }
}

function mainRoof(out, lod, d) {
  const [a, b, c, e] = d.outline;
  const floor = [a, b, c, e].map(([x, z]) => [
    x + Math.sign(x) * 0.34,
    d.houseEavesMeters,
    z + Math.sign(z) * 0.35,
  ]);
  const top = [
    [-8.9, d.houseRoofMeters, -0.48],
    [-8.9, d.houseRoofMeters, 0.49],
    [8.93, d.houseRoofMeters, 0.49],
    [8.93, d.houseRoofMeters, -0.48],
  ];
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    face(out, 'slate', [floor[i], floor[j], top[j], top[i]], up, i % 2 ? C.slate : C.ridge);
    if (lod > 1) beamPath(out, 'slate', [floor[i], top[i], top[j]], 0.134, 0.145, C.ridge);
  }
  face(out, 'slate', top, up, C.ridge);
  for (const [x, z] of [
    [-7.35, 1.76],
    [7.59, -0.71],
  ]) {
    block(out, 'wall', x, d.houseRoofMeters - 0.79, z, 0.64, 2.01, 0.72, C.sandstone);
    if (lod > 0)
      block(out, 'slate', x - 0.1, d.houseRoofMeters + 1.19, z - 0.1, 0.84, 0.2, 0.92, C.ridge);
  }
}

function mainHouse(out, lod, d, grade) {
  const { outline, houseEavesMeters: eave } = d;
  const direction = areaSign(outline);
  shell(out, outline, (p) => Math.min(grade(p) - 0.29, 0), 0.64, {
    wall: 'base',
    color: C.base,
    roof: 'wall',
    roofColor: C.house,
  });
  shell(out, outline, () => 0.62, eave, {
    wall: 'wall',
    color: C.house,
    roof: 'wall',
    roofColor: C.house,
  });
  for (const [[a, b], i] of pairs(closed(outline)).map((pair, i) => [pair, i])) {
    const order = i === 3 ? [b, a] : [a, b];
    const w = edge(...order, i === 3 ? -direction : direction);
    if (i === 3) {
      street(out, lod, w, eave);
      continue;
    }
    moldedBand(out, lod, w, eave - 0.3, eave - 0.065, 0.254, C.pale);
    if (i === 2) continue;
    const count = i === 1 ? 8 : 4;
    const distance = w.length / count;
    for (let k = 0; k < count; k++) {
      const x = (k + 0.5) * distance;
      if (i === 1 && k === 4) window(out, lod, w, x, 0.73, 2.91, 1.47, 0.36, true, true);
      else window(out, lod, w, x, 1.4, 3.34, 1.1, 0.23);
      for (const [base, top] of [
        [4.83, 7.07],
        [8.56, 10.58],
        [11.86, 13.68],
      ]) {
        if (lod === 0 && k % 2) continue;
        window(out, lod, w, x, base, top, 1.15, i === 1 && base < 8 ? 0.16 : 0);
      }
    }
  }
  mainRoof(out, lod, d);
}

function gardenHouse(out, lod, d, grade) {
  const outline = d.parts.garden;
  const mid = 7.63;
  const { gardenEavesMeters: eave, gardenRoofMeters: peak } = d;
  const direction = areaSign(outline);
  shell(out, outline, (p) => Math.min(grade(p) - 0.27, 0.15), eave, {
    wall: 'wall',
    color: C.garden,
    roof: 'wall',
    roofColor: C.garden,
  });
  const xz = [
    [2.32, eave],
    [3.46, eave + 1.9],
    [5.36, peak],
    [9.71, peak],
    [11.63, eave + 1.9],
    [12.98, eave],
  ];
  const near = xz.map(([x, y]) => [x, y, 17.22]);
  const far = xz.map(([x, y]) => [x, y, 50.43]);
  for (let i = 0; i < near.length - 1; i++)
    face(out, 'tile', [near[i], near[i + 1], far[i + 1], far[i]], up, i < 2 ? C.tile : C.tileShade);
  for (const [p, n] of [
    [near, [0, 0, -1]],
    [far, [0, 0, 1]],
  ])
    face(out, 'wall', p, n, C.garden);
  const long = edge(outline.at(-1), outline[0], direction);
  for (let i = 0; i < 6; i++) {
    const u = (long.length * (i + 0.5)) / 6;
    window(out, lod, long, u, 0.52, 2.51, 1.23, 0.38, false, i === 1 || i === 4);
    const [, , z] = long.p(u, 0);
    const plinth = 4.46;
    block(out, 'wall', 2.99, plinth, z - 0.68, 2.61, 1.92, 1.36, C.garden);
    block(out, 'slate', 2.9, plinth + 1.91, z - 0.75, 2.75, 0.14, 1.51, C.slate);
    const dormer = edge([2.985, z + 0.64], [2.985, z - 0.64]);
    window(out, lod, dormer, 0.65, plinth + 0.12, plinth + 1.57, 0.76, 0);
    if (lod === 3) block(out, 'iron', 2.875, plinth + 0.058, z - 0.55, 0.16, 0.055, 1.09, C.iron);
  }
  if (lod > 1) {
    for (const [a, b] of [
      [near[0], far[0]],
      [near[5], far[5]],
      [near[2], far[2]],
      [near[3], far[3]],
    ])
      beamPath(out, 'slate', [a, b], 0.117, 0.107, C.ridge);
    const e = edge([mid - 2.3, 17.22], [mid + 2.3, 17.22]);
    window(out, lod, e, e.length * 0.5, 4.12, 5.62, 1.11, 0.22);
  }
}

function build(out, lod, d, grade) {
  mainHouse(out, lod, d, grade);
  gardenHouse(out, lod, d, grade);
}

const home = pavilion(
  import.meta.url,
  {
    surfaces,
    brief:
      'The surviving Leipzig home of Felix Mendelssohn with its grouped Late-Classical street arches, warm sandstone detailing, low slate hip, and the white garden house with terracotta dormered roof.',
    camera: [44, 29, -55],
    lookAt: [1, 7.1, 10],
    yaw: -0.75,
    sun: [-290, 620, -680],
    views: [
      {
        name: 'goldschmidtstrasse-grouped-arches',
        position: [1.9, 9.7, -44],
        lookAt: [0, 8.2, -7.5],
      },
      {
        name: 'garden-house-dormers-and-open-court',
        position: [-20, 13, 35],
        lookAt: [8, 3.95, 33],
      },
      { name: 'hipped-roof-and-courtyard-facade', position: [-30, 32, 37], lookAt: [-2, 9, 1.5] },
    ],
  },
  build,
);

export const { model, skyline, district, street: streetLod, closeup } = home;
export { streetLod as street };
model.category = 'historic-house';
model.buildingCutout = {
  outline: controls.dimensions.outline,
  outlines: [controls.dimensions.outline, controls.dimensions.parts.garden],
  minimumCoverage: 0.9,
  basis:
    'The separate masks replace the named house and garden house while leaving the area between them open.',
};
