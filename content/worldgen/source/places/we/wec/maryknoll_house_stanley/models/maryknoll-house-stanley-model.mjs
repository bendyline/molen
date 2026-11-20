import controls from '../plan-controls.json' with { type: 'json' };
import { beamPath } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  areaSign,
  block,
  edge,
  face,
  mix,
  palette,
  panel,
  pairs,
  pavilion,
  plane,
  rect,
  shell,
  stairs,
  surface,
  up,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';

const surfaces = {
  brick: surface('wall', 'brick_flemish'),
  granite: surface('foundation', 'stone_granite'),
  tile: surface('roof', 'tile_glazed', 0.7, 0.06),
  grout: surface('trim', 'plaster_lime'),
  glass: surface('window', 'window_punched'),
  wood: surface('door', 'wood_plain'),
  metal: surface('trim', 'metal_bronze_cast', 0.8, 0.1),
};
const C = palette({
  red: 'a26156',
  darkBrick: '8d584b',
  plinth: '999187',
  stone: 'a79f90',
  roof: '416b5a',
  roll: '53796a',
  ridge: '365f4d',
  deepGreen: '3b5f4d',
  white: 'd1c6af',
  frame: 'd8ccba',
  grey: '86928f',
  glass: '687176',
  timber: '63554d',
  shadow: '656b64',
  metal: '8a8980',
  road: 'a19d92',
});
const mainEave = 12.45;
const wingEave = 8.64;
const near = -18.36;
const mainFront = 4;
const mainRear = 15.77;

function window(out, lod, w, u, floor, width, high, facing) {
  const a = u - width / 2;
  const b = u + width / 2;
  const bottom = floor + 0.91;
  const top = bottom + high;
  panel(out, 'glass', w, a, b, bottom, top, 0.032, C.glass);
  if (lod === 0) return;
  for (const y of [bottom, top - 0.09])
    panel(out, 'grout', w, a - 0.05, b + 0.05, y, y + 0.09, 0.08, C.frame);
  for (const x of [a - 0.02, b - 0.06, u - 0.045])
    panel(out, 'grout', w, x, x + 0.085, bottom, top, 0.083, C.frame);
  panel(out, 'granite', w, a - 0.12, b + 0.12, bottom - 0.15, bottom - 0.045, 0.116, C.stone);
  if (lod < 2) return;
  for (const i of [-1, 1]) {
    const x = u + i * width * 0.24;
    panel(out, 'grout', w, x - 0.023, x + 0.023, bottom, top, 0.087, C.white);
  }
  for (const y of [bottom + 0.43, bottom + high * 0.62])
    panel(out, 'grout', w, a, b, y - 0.027, y + 0.027, 0.086, C.white);
  if (lod === 3 && facing)
    panel(out, 'brick', w, a - 0.15, b + 0.15, top + 0.042, top + 0.125, 0.08, C.darkBrick);
}

function masonry(out, lod, outline, grade, eave, storeys, main = false) {
  const sign = areaSign(outline);
  shell(out, outline, (p) => grade(p) - 0.5, 0.82, {
    wall: 'granite',
    color: C.plinth,
    roofColor: C.plinth,
  });
  shell(out, outline, () => 0.78, eave, {
    wall: 'brick',
    color: C.red,
    roof: 'tile',
    roofColor: C.ridge,
  });
  for (const [[a, b], j] of pairs([...outline, outline[0]]).map((pair, i) => [pair, i])) {
    const w = edge(a, b, sign);
    if (w.length < 2.6) continue;
    panel(out, 'granite', w, 0, w.length, 0.83, 1.02, 0.048, C.stone);
    panel(out, 'grout', w, 0, w.length, eave - 0.26, eave - 0.08, 0.075, C.white);
    const bays = Math.max(1, Math.round(w.length / (main && w.length > 25 ? 3.32 : 3.16)));
    for (let floorLength = 0; floorLength < storeys; floorLength++) {
      const floor = 0.86 + floorLength * 3.6;
      if (floorLength > 0)
        panel(out, 'granite', w, 0, w.length, floor - 0.14, floor + 0.025, 0.052, C.stone);
      for (let k = 0; k < bays; k++) {
        const u = (w.length * (k + 0.5)) / bays;
        if (main && j === 2 && floorLength === 0 && Math.abs(u - w.length / 2) < 2.23) continue;
        if (lod === 0 && k % 2 === 1) continue;
        window(out, lod, w, u, floor, w.length > 10 ? 1.58 : 1.25, main ? 1.92 : 1.63, main);
      }
    }
  }
}

function pitchedGlazedRoof(out, lod, bounds, eave, rise, ridgeAlongX) {
  const [x0, z0, x1, z1] = bounds;
  const length = ridgeAlongX ? x1 - x0 : z1 - z0;
  const width = ridgeAlongX ? z1 - z0 : x1 - x0;
  const profile =
    lod === 0
      ? [
          [0, 0],
          [0.24, 0.1],
          [1, 1],
        ]
      : [
          [0, 0],
          [0.09, 0.028],
          [0.27, 0.13],
          [0.55, 0.43],
          [0.81, 0.76],
          [1, 1],
        ];
  const rings = profile.map(([t, h]) => {
    const e = Math.min(length * 0.19, width * 0.46) * t;
    const sh = (width * 0.5 - 0.052) * t;
    const y = eave + rise * h;
    return rect(
      x0 + (ridgeAlongX ? e : sh),
      z0 + (ridgeAlongX ? sh : e),
      x1 - (ridgeAlongX ? e : sh),
      z1 - (ridgeAlongX ? sh : e),
    ).map(([x, z]) => [x, y, z]);
  });
  for (const [a, b] of pairs(rings))
    for (let i = 0; i < 4; i++)
      face(
        out,
        'tile',
        [a[i], a[(i + 1) % 4], b[(i + 1) % 4], b[i]],
        up,
        (i + (ridgeAlongX ? 0 : 1)) % 3 ? C.roof : C.deepGreen,
      );
  face(out, 'tile', rings.at(-1), up, C.ridge);
  if (lod === 0) return;
  const edgePath = rings[0].slice();
  beamPath(out, 'tile', [...edgePath, edgePath[0]], 0.19, 0.2, C.ridge);
  const cap = rings.at(-1);
  const left = ridgeAlongX
    ? [(cap[0][0] + cap[3][0]) / 2, cap[0][1], (cap[0][2] + cap[3][2]) / 2]
    : [(cap[0][0] + cap[1][0]) / 2, cap[0][1], (cap[0][2] + cap[1][2]) / 2];
  const right = ridgeAlongX
    ? [(cap[1][0] + cap[2][0]) / 2, cap[1][1], (cap[1][2] + cap[2][2]) / 2]
    : [(cap[2][0] + cap[3][0]) / 2, cap[2][1], (cap[2][2] + cap[3][2]) / 2];
  beamPath(
    out,
    'tile',
    [[left[0], left[1] + 0.24, left[2]], left, right, [right[0], right[1] + 0.24, right[2]]],
    0.21,
    0.25,
    C.ridge,
  );
  if (lod === 1) return;
  for (let i = 0; i < 4; i++)
    beamPath(
      out,
      'tile',
      rings.map((r) => r[i]),
      0.15,
      0.19,
      C.ridge,
    );
  for (const i of ridgeAlongX ? [0, 2] : [1, 3]) {
    const count = Math.ceil(length / (lod === 2 ? 1.64 : 0.61));
    for (let j = 1; j < count; j++) {
      const t = j / count;
      beamPath(
        out,
        'tile',
        rings.map((r) => [
          mix(r[i][0], r[(i + 1) % 4][0], t),
          r[i][1] + 0.062,
          mix(r[i][2], r[(i + 1) % 4][2], t),
        ]),
        0.061,
        0.068,
        C.roll,
      );
    }
  }
}

function porch(out, lod, grade) {
  const front = mainFront - 2.32;
  const door = plane(mainFront - 0.024, -1);
  const floor = 0.86;
  const width = 3.65;
  stairs(out, grade, 'granite', -width, width, front - 1.25, front + 0.57, floor, 4, C.plinth);
  block(out, 'granite', -width, floor - 0.17, front, 2 * width, 0.17, 2.62, C.stone);
  for (const x of [-2.93, -1.54, 1.54, 2.93]) {
    block(out, 'granite', x - 0.16, floor, front + 0.18, 0.32, 2.84, 0.32, C.stone);
    if (lod > 1) {
      block(out, 'granite', x - 0.23, floor, front + 0.11, 0.46, 0.29, 0.46, C.plinth);
      block(out, 'granite', x - 0.22, floor + 2.68, front + 0.12, 0.44, 0.18, 0.44, C.white);
    }
  }
  panel(out, 'wood', door, -1.29, 1.29, floor, floor + 2.63, 0.05, C.timber);
  if (lod > 0)
    for (const x of [-1.31, 0, 1.31])
      panel(out, 'grout', door, x - 0.06, x + 0.06, floor, floor + 2.73, 0.076, C.white);
  pitchedGlazedRoof(
    out,
    Math.min(lod, 2),
    [-3.97, front - 0.2, 3.97, mainFront + 0.26],
    3.66,
    1.27,
    true,
  );
}

function seaVerandah(out, lod, grade) {
  const z = mainRear;
  const w = plane(z + 0.049, 1);
  for (const y of [3.93, 7.71]) {
    block(out, 'granite', -20.5, y - 0.13, z, 41.0, 0.29, 1.74, C.stone);
    block(out, 'brick', -20.5, y + 0.15, z + 1.52, 41.0, 0.71, 0.22, C.darkBrick);
    if (lod > 0)
      for (let i = 0; i <= 10; i++) {
        const x = -20.35 + 4.07 * i;
        block(out, 'brick', x - 0.14, y + 0.16, z + 1.43, 0.28, 3.31, 0.44, C.red);
        if (i === 10) continue;
        panel(out, 'glass', w, x + 0.44, x + 3.58, y + 0.78, y + 2.98, 0.002, C.shadow);
        if (lod > 1)
          for (let j = 1; j <= 5; j++) {
            const u = x + (4.07 * j) / 6;
            block(out, 'tile', u - 0.055, y + 0.86, z + 1.57, 0.11, 0.41, 0.12, C.ridge);
          }
      }
  }
  if (lod > 0)
    for (const x of [-19.7, 18.15])
      block(
        out,
        'granite',
        x,
        grade([x, z]) - 0.28,
        z + 0.1,
        1.4,
        0.55 - grade([x, z]),
        0.87,
        C.plinth,
      );
}

function roofDetails(out, lod) {
  for (const x of [-20.19, -18.74, 17.37, 18.83]) {
    const z = x < 0 ? 11.36 : 11.9;
    block(out, 'brick', x, mainEave + 1.56, z, 0.77, 2.35, 0.68, C.darkBrick);
    if (lod > 0)
      block(out, 'brick', x - 0.075, mainEave + 3.86, z - 0.068, 0.92, 0.17, 0.84, C.red);
  }
  block(out, 'tile', -0.34, 15.65, 9.69, 0.69, 0.72, 0.49, C.ridge);
  block(out, 'metal', -0.046, 16.36, 9.88, 0.1, 0.93, 0.078, C.metal);
  block(out, 'metal', -0.28, 16.86, 9.88, 0.56, 0.1, 0.078, C.metal);
}

function build(out, lod, { parts, mainStoreys, wingStoreys }, grade) {
  masonry(out, lod, parts['hilltop-main-range'], grade, mainEave, mainStoreys, true);
  for (const key of ['east-wing', 'west-wing'])
    masonry(out, lod, parts[key], grade, wingEave, wingStoreys);
  for (const [x, z] of [
    [-21.77, 1.82],
    [13.44, 1.51],
  ]) {
    const points = rect(x, z, x + 7.67, 4.3);
    shell(out, points, (p) => grade(p) - 0.34, 7.37, {
      wall: 'brick',
      color: C.darkBrick,
      roof: 'tile',
      roofColor: C.ridge,
    });
  }
  pitchedGlazedRoof(out, lod, [-23.23, 3.44, 22.71, 16.35], mainEave, 3.32, true);
  for (const [x0, x1, z] of [
    [-24.03, -11.15, 0.14],
    [11.12, 24.12, -0.09],
  ]) {
    pitchedGlazedRoof(out, lod, [x0, near + 2.99, x1, z + 0.5], wingEave, 2.54, false);
    pitchedGlazedRoof(
      out,
      Math.min(lod, 2),
      [x0 + 1.64, near - 0.38, x1 - 1.86, near + 5.7],
      wingEave - 0.42,
      1.96,
      true,
    );
  }
  roofDetails(out, lod);
  porch(out, lod, grade);
  seaVerandah(out, lod, grade);
}

const bundle = pavilion(
  import.meta.url,
  {
    surfaces,
    brief:
      'Maryknoll House’s historic brick main block and lower courtyard wings, fitted to the Stanley hillside, with green glazed Chinese tiled roofs, north entrance and stepped seaward verandah.',
    camera: [39, 34, -58],
    lookAt: [0, 7.7, 1.5],
    sun: [-419, 564, -789],
    yaw: -0.62,
    views: [
      { name: 'north-court-and-green-roofs', position: [-11, 21, -44], lookAt: [0, 8.2, 0.7] },
      {
        name: 'granite-porch-and-timber-windows',
        position: [1.1, 6.3, -12],
        lookAt: [0, 5.1, 3.45],
      },
      { name: 'seaward-brick-range-and-verandahs', position: [33, 18, 43], lookAt: [0, 7.1, 13.8] },
    ],
  },
  build,
);
export const { model, skyline, district, street, closeup } = bundle;
model.category = 'residence';
model.buildingCutout = {
  outline: [
    [-24, -19],
    [-11.15, -19],
    [-11.15, 3.56],
    [11.14, 3.56],
    [11.14, -19],
    [24, -19],
    [24, 4],
    [22.58, 4],
    [22.58, 16.92],
    [-22.95, 16.92],
    [-22.95, 4],
    [-24, 4],
  ],
  minimumCoverage: 0.9,
  basis:
    'Replace the three mapped historic volumes and narrow connections, leaving the north courtyard and nearby Stanley Knoll housing outside.',
};
