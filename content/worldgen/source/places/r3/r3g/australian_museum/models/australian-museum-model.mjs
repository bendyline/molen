/** Standing exterior of the Australian Museum in Sydney. All dimensions are in metres. */
import { readFileSync } from 'node:fs';
import {
  beam,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { transform } from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import {
  B as box,
  rgb,
} from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { quad } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const load = (name) => JSON.parse(readFileSync(new URL('../' + name + '.json', import.meta.url)));
const plan = load('plan-controls');
const frame = load('map-frame');
const { barnet, lewis, vernon, parkes, atrium, research, easternAnnex, hall } = plan.section;
const surfaces = {
  sandstone: { slot: 'wall', graph: 'stone_sandstone', roughness: 0.92, metallic: 0 },
  trim: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.94, metallic: 0 },
  steel: { slot: 'trim', graph: 'metal_painted', roughness: 0.71, metallic: 0.12 },
  roof: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.78, metallic: 0.19 },
  glass: {
    slot: 'window',
    localRef: 'palette:#fffefe',
    roughness: 0.37,
    metallic: 0.11,
    alphaMode: 'BLEND',
    baseColorFactor: [1, 1, 1, 0.72],
    doubleSided: true,
  },
  shadow: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.92, metallic: 0 },
};
const color = Object.fromEntries(
  Object.entries({
    stone: 'b6a386',
    newStone: 'c4b598',
    pale: 'd1c4ab',
    lower: '9a886e',
    seam: '887b69',
    golden: 'bca075',
    lightGold: 'c8b08e',
    shadow: '505650',
    shaded: '656961',
    historicGlass: '637377',
    paleGrey: 'a8ada4',
    roof: '7b817b',
    roofPale: 'a1a39a',
    oldRoof: '777972',
    fascia: 'b9ad94',
    metal: '777f7d',
    graphite: '4d5659',
    steel: 'a2aead',
    darkGlass: '607679',
    glass: '9ab6b9',
    clear: 'bdcbcd',
    crystalBlue: '829fae',
    crystalViolet: 'aaa3bc',
    crystalGreen: 'bdc5a4',
    ramp: '818c8a',
    concrete: 'a2a2a0',
    terrace: 'a5a397',
    yard: '9c9c83',
  }).map(([key, value]) => [key, rgb(value)]),
);

const up = [0, 1, 0];
const front = [0, 0, 1];
const back = [0, 0, -1];
const lerp = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
function face(out, slot, points, direction, tint) {
  let n = normalFor(...points);
  if (n.reduce((sum, v, i) => sum + v * direction[i], 0) < 0) {
    points = [...points].reverse();
    n = normalFor(...points);
  }
  if (points.length === 4) quad(out, slot, points, n, tint);
  else
    out.addTriangle(
      slot,
      'palette:#ffffff',
      points,
      n,
      points.map(([x, , z]) => [x, z]),
      tint,
    );
}
function block(out, slot, [x0, x1, z0, z1], bottom, top, tint) {
  box(out, slot, (x0 + x1) / 2, bottom, (z0 + z1) / 2, x1 - x0, top - bottom, z1 - z0, tint);
}
function slab(out, slot, x0, x1, y, z0, z1, tint) {
  face(
    out,
    slot,
    [
      [x0, y, z0],
      [x1, y, z0],
      [x1, y, z1],
      [x0, y, z1],
    ],
    up,
    tint,
  );
}
const boundsExpand = ([x0, x1, z0, z1], delta) => [x0 - delta, x1 + delta, z0 - delta, z1 + delta];
function coping(out, bounds, y, tint = color.pale, extend = 0.25) {
  block(out, 'sandstone', boundsExpand(bounds, extend), y, y + 0.25, tint);
}
function gabledRoof(out, [x0, x1, z0, z1], y, rise, alongX, tint) {
  const a = [x0, y, z0],
    b = [x1, y, z0],
    c = [x1, y, z1],
    d = [x0, y, z1];
  const middle = [(x0 + x1) / 2, y + rise, (z0 + z1) / 2];
  if (alongX) {
    const west = [x0, middle[1], middle[2]],
      east = [x1, middle[1], middle[2]];
    face(out, 'roof', [a, b, east, west], up, tint);
    face(out, 'roof', [d, west, east, c], up, tint);
    face(out, 'sandstone', [a, west, d], [-1, 0, 0], color.stone);
    face(out, 'sandstone', [b, c, east], [1, 0, 0], color.stone);
  } else {
    const north = [middle[0], middle[1], z0],
      south = [middle[0], middle[1], z1];
    face(out, 'roof', [a, north, south, d], up, tint);
    face(out, 'roof', [b, c, south, north], up, tint);
    face(out, 'sandstone', [a, b, north], back, color.stone);
    face(out, 'sandstone', [d, south, c], front, color.stone);
  }
}
function hip(out, [x0, x1, z0, z1], y, rise, tint) {
  const w = x1 - x0,
    d = z1 - z0;
  const corners = [
    [x0, y, z0],
    [x1, y, z0],
    [x1, y, z1],
    [x0, y, z1],
  ];
  const topX = (x0 + x1) / 2,
    topZ = (z0 + z1) / 2;
  const [q, r] =
    w > d
      ? [
          [x0 + d * 0.37, y + rise, topZ],
          [x1 - d * 0.37, y + rise, topZ],
        ]
      : [
          [topX, y + rise, z0 + w * 0.37],
          [topX, y + rise, z1 - w * 0.37],
        ];
  const faces =
    w > d
      ? [
          [corners[0], corners[1], r, q],
          [corners[1], corners[2], r],
          [corners[2], corners[3], q, r],
          [corners[3], corners[0], q],
        ]
      : [
          [corners[0], corners[1], q],
          [corners[1], corners[2], r, q],
          [corners[2], corners[3], r],
          [corners[3], corners[0], q, r],
        ];
  for (const p of faces) face(out, 'roof', p, up, tint);
}

function rectangle(out, slot, x0, x1, y0, y1, z, tint) {
  face(
    out,
    slot,
    [
      [x0, y0, z],
      [x1, y0, z],
      [x1, y1, z],
      [x0, y1, z],
    ],
    front,
    tint,
  );
}
function opening(out, x, z, bottom, wide, height, lod, decor = 'square') {
  const left = x - wide / 2,
    right = x + wide / 2,
    top = bottom + height;
  if (lod)
    rectangle(
      out,
      'sandstone',
      left - 0.18,
      right + 0.18,
      bottom - 0.15,
      top + 0.16,
      z,
      color.pale,
    );
  rectangle(out, 'shadow', left, right, bottom, top, z + 0.025, color.shadow);
  if (!lod) return;
  rectangle(
    out,
    'shadow',
    left + 0.1,
    right - 0.1,
    bottom + 0.09,
    top - 0.12,
    z + 0.058,
    color.historicGlass,
  );
  if (lod >= 2) {
    box(out, 'sandstone', x, bottom - 0.17, z + 0.16, wide + 0.46, 0.13, 0.27, color.fascia);
  } else {
    rectangle(
      out,
      'sandstone',
      left - 0.21,
      right + 0.21,
      bottom - 0.17,
      bottom - 0.045,
      z + 0.135,
      color.fascia,
    );
  }
  if (lod >= 2) {
    for (const side of [-1, 1])
      box(
        out,
        'sandstone',
        x + side * (wide / 2 + 0.13),
        bottom - 0.04,
        z + 0.11,
        0.16,
        height + 0.01,
        0.16,
        color.lightGold,
      );
    box(out, 'shadow', x, bottom + 0.09, z + 0.085, 0.053, height - 0.2, 0.038, color.paleGrey);
    box(
      out,
      'shadow',
      x,
      bottom + height * 0.56,
      z + 0.085,
      wide - 0.13,
      0.055,
      0.04,
      color.paleGrey,
    );
  }
  if (decor === 'pediment') {
    const [a, b] = [left - 0.28, right + 0.28],
      y = top + 0.16;
    face(
      out,
      'sandstone',
      [
        [a, y, z + 0.14],
        [b, y, z + 0.14],
        [x, y + 0.41, z + 0.14],
      ],
      front,
      color.pale,
    );
    if (lod >= 2) {
      beam(out, 'sandstone', [a, y, z + 0.2], [x, y + 0.43, z + 0.2], 0.105, 0.17, color.pale);
      beam(out, 'sandstone', [x, y + 0.43, z + 0.2], [b, y, z + 0.2], 0.105, 0.17, color.pale);
    }
  } else if (lod >= 2) {
    box(out, 'sandstone', x, top + 0.11, z + 0.105, wide + 0.4, 0.1, 0.22, color.pale);
  }
}
function dentils(out, left, right, y, z, step, lod) {
  if (lod < 2) return;
  for (let x = left + 0.22; x < right - 0.17; x += step) {
    box(out, 'sandstone', x, y, z, 0.18, 0.19, 0.23, color.pale);
  }
}
function frontageBands(out, width, y, z) {
  for (const [bottom, height, projection, tone] of [
    [y - 0.4, 0.23, 0.23, color.lower],
    [y - 0.16, 0.13, 0.37, color.fascia],
    [y - 0.03, 0.18, 0.56, color.pale],
  ])
    box(out, 'sandstone', 0, bottom, z + projection * 0.42, width, height, projection, tone);
}
function balustrade(out, width, y, z, lod) {
  box(out, 'sandstone', 0, y, z, width, 0.67, 0.61, color.stone);
  box(out, 'sandstone', 0, y + 0.67, z, width + 0.22, 0.15, 0.69, color.pale);
  if (lod < 2) return;
  for (let x = -width / 2 + 0.57; x < width / 2 - 0.43; x += 0.73) {
    rectangle(out, 'shadow', x - 0.15, x + 0.14, y + 0.16, y + 0.55, z + 0.319, color.lower);
    box(out, 'sandstone', x, y + 0.16, z + 0.354, 0.09, 0.39, 0.11, color.fascia);
  }
}
function giantPier(out, x, z, start, end, lod) {
  box(out, 'sandstone', x, start, z, 1.24, 0.43, 0.76, color.fascia);
  box(out, 'sandstone', x, start + 0.39, z + 0.03, 1.07, end - start - 0.86, 0.69, color.pale);
  box(out, 'sandstone', x, end - 0.47, z + 0.1, 1.29, 0.33, 0.8, color.pale);
  box(out, 'sandstone', x, end - 0.12, z + 0.12, 1.47, 0.18, 0.91, color.pale);
  if (lod < 2) return;
  for (const side of [-1, 1]) {
    const a = [x + side * 0.34, end - 0.96, z + 0.39],
      b = [x + side * 0.59, end - 0.32, z + 0.47];
    beam(out, 'sandstone', a, b, 0.23, 0.22, color.lightGold);
    box(out, 'sandstone', x + side * 0.27, end - 0.49, z + 0.48, 0.29, 0.16, 0.22, color.pale);
  }
}
function barnetFacadePanel(out, panel, lod) {
  const { z, width, x, windows, pavilion } = panel;
  const o = transform(out, -Math.PI / 2, [x, 0, z]);
  if (pavilion) {
    block(o, 'sandstone', [-width / 2, width / 2, -1.65, 0.03], -2.7, 16.39, color.stone);
    balustrade(o, width + 0.24, 16.55, 0.03, lod);
    frontageBands(o, width + 0.64, 16.56, 0.09);
    // The end pavilions turn the corner with paired two-storey piers.
    for (const s of [-1, 1]) {
      const xx = s * (width / 2 - 0.36);
      box(o, 'sandstone', xx, 0.3, 0.13, 0.49, 15.8, 0.32, color.pale);
    }
  } else frontageBands(o, width + 0.48, 15.8, 0.07);
  const spacing = width / (windows + 0.2);
  const centers = Array.from({ length: windows }, (_, i) => (i - (windows - 1) / 2) * spacing);
  for (const [i, dx] of centers.entries()) {
    opening(
      o,
      dx,
      0.065,
      5.03,
      Math.min(1.44, spacing * 0.57),
      3.34,
      lod,
      i % 2 === 0 ? 'pediment' : 'square',
    );
    opening(o, dx, 0.065, 11.03, Math.min(1.36, spacing * 0.56), 2.54, lod);
    if (pavilion && lod) {
      const right = dx + spacing * 0.46;
      box(o, 'sandstone', right, 3.05, 0.08, 0.33, 12.37, 0.23, color.fascia);
    }
  }
  box(o, 'sandstone', 0, 3.51, 0.1, width, 0.29, 0.33, color.fascia);
  box(o, 'sandstone', 0, 9.99, 0.1, width, 0.22, 0.26, color.lightGold);
}
function westSteps(out, sign, lod) {
  const start = sign === -1 ? -0.16 : 0.94;
  const upper = 2.93;
  const at = (u) => sign * (13.95 - (13.95 - 9.06) * u);
  const count = [2, 7, 13, 16][lod];
  for (let i = 0; i < count; i++) {
    const b = at(i / count),
      e = at(1);
    block(
      out,
      'sandstone',
      [-56.72, -53.23, Math.min(b, e), Math.max(b, e)],
      start + ((upper - start) * i) / count,
      start + ((upper - start) * (i + 1)) / count + 0.016,
      color.fascia,
    );
  }
  if (!lod) return;
  for (const x of [-56.74, -53.18]) {
    const p = [
      [x, start - 0.28, at(0)],
      [x, upper - 0.23, at(1)],
      [x, upper + 0.58, at(1)],
      [x, start + 0.55, at(0)],
    ];
    face(out, 'sandstone', p, [x < -55 ? -1 : 1, 0, 0], color.stone);
    beam(
      out,
      'sandstone',
      [x, start + 0.55, at(0)],
      [x, upper + 0.58, at(1)],
      0.41,
      0.2,
      color.pale,
    );
  }
  const f = transform(out, sign < 0 ? Math.PI : 0, [-54.57, upper, sign * 9.2]);
  rectangle(f, 'shadow', -0.65, 0.65, 0, 2.3, 0.045, color.shadow);
  if (lod >= 2) {
    for (const x of [-0.79, 0.79]) box(f, 'sandstone', x, 0, 0.06, 0.19, 2.37, 0.22, color.pale);
    box(f, 'sandstone', 0, 2.28, 0.1, 1.76, 0.24, 0.29, color.pale);
  }
}
function barnetWing(out, lod) {
  const { wallX, north, south, back: backX, plinth, bodyTop, central, panels } = barnet;
  const main = [wallX, backX, north, south + 4.0];
  block(out, 'sandstone', main, -3.26, bodyTop, color.stone);
  coping(out, main, bodyTop - 0.04, color.pale, 0.27);
  hip(out, boundsExpand(main, 0.14), bodyTop + 0.12, 2.21, color.oldRoof);
  const centralBounds = [central.frontX, wallX + 0.22, -central.halfWidth, central.halfWidth];
  block(out, 'sandstone', centralBounds, -2.38, plinth, color.lower);
  block(out, 'sandstone', centralBounds, plinth, central.upperY, color.stone);
  coping(out, centralBounds, plinth - 0.16, color.fascia, 0.18);
  for (const panel of panels) barnetFacadePanel(out, panel, lod);
  const f = transform(out, -Math.PI / 2, [central.frontX, 0, 0]);
  for (const x of central.piers) giantPier(f, x, 0.18, plinth + 0.06, 16.9, lod);
  for (const x of [-5.05, 0, 5.12]) {
    opening(f, x, 0.066, 6.4, 1.44, 3.08, lod, 'pediment');
    opening(f, x, 0.066, 11.76, 1.42, 2.45, lod);
  }
  const width = central.halfWidth * 2 + 0.77;
  box(f, 'sandstone', 0, 16.93, 0.08, width, 1.46, 0.51, color.stone);
  frontageBands(f, width + 0.15, central.upperY + 0.12, 0.23);
  dentils(f, -width * 0.49, width * 0.49, central.upperY - 0.23, 0.62, 0.42, lod);
  const fin = central.peak - 0.27;
  const pediment = [
    [-width / 2, central.upperY + 0.13, 0.44],
    [width / 2, central.upperY + 0.13, 0.44],
    [0.03, fin, 0.44],
  ];
  face(f, 'sandstone', pediment, front, color.fascia);
  for (const p of [-1, 1]) {
    beam(
      f,
      'sandstone',
      [(p * width) / 2, central.upperY + 0.05, 0.54],
      [0, central.peak, 0.55],
      0.43,
      0.29,
      color.pale,
    );
    if (lod >= 2) {
      for (let t = 0.075; t < 0.98; t += 0.065) {
        const pt = lerp(
          [(p * width) / 2, central.upperY + 0.03, 0.62],
          [0, central.peak - 0.11, 0.62],
          t,
        );
        box(f, 'sandstone', pt[0], pt[1] - 0.3, pt[2], 0.18, 0.18, 0.23, color.pale);
      }
    }
  }
  const roofBox = [central.frontX - 0.16, -34.8, -width / 2 + 0.18, width / 2 - 0.18];
  gabledRoof(
    out,
    roofBox,
    central.upperY + 0.13,
    central.peak - central.upperY - 0.18,
    true,
    color.oldRoof,
  );
  if (lod) {
    const relief = [
      [0, 20.02, 0.479],
      [-1.2, 19.33, 0.501],
      [1.22, 19.34, 0.489],
    ];
    face(f, 'sandstone', relief, front, color.pale);
    for (const sign of [-1, 1]) {
      const pts = [
        [sign * 0.3, 19.47, 0.49],
        [sign * 1.09, 20.09, 0.5],
        [sign * 2.41, 19.55, 0.48],
      ];
      face(f, 'sandstone', pts, front, color.pale);
    }
  }
  westSteps(out, -1, lod);
  westSteps(out, 1, lod);
  // The early public entry now reads as a sequence of stone plinth and return stairs.
  if (lod >= 2) {
    for (const side of [-1, 1]) {
      for (let i = 0; i < 4; i++)
        box(f, 'sandstone', side * (10.3 + i * 0.82), -0.05, 0.32, 0.21, 1.05, 0.24, color.fascia);
    }
  }
}

function barnetSkyline(out) {
  const { wallX, north, south, back: backX, plinth, bodyTop, central, panels } = barnet;
  const main = [wallX, backX, north, south + 4.0];
  block(out, 'sandstone', main, -3.26, bodyTop, color.stone);
  hip(out, boundsExpand(main, 0.14), bodyTop + 0.12, 2.21, color.oldRoof);
  const centralBounds = [central.frontX, wallX + 0.22, -central.halfWidth, central.halfWidth];
  block(out, 'sandstone', centralBounds, -2.38, central.upperY, color.stone);
  const f = transform(out, -Math.PI / 2, [central.frontX, 0, 0]);
  box(f, 'sandstone', 0, plinth - 0.1, 0.18, 18.65, 0.45, 0.49, color.fascia);
  for (const x of central.piers) {
    box(f, 'sandstone', x, plinth + 0.06, 0.17, 1.11, 12.15, 0.64, color.pale);
    box(f, 'sandstone', x, 16.45, 0.23, 1.47, 0.56, 0.82, color.pale);
  }
  for (const x of [-5.05, 0, 5.12]) {
    opening(f, x, 0.067, 6.4, 1.44, 3.08, 0);
    opening(f, x, 0.067, 11.76, 1.42, 2.45, 0);
  }
  box(f, 'sandstone', 0, central.upperY - 0.16, 0.27, 19.09, 0.45, 0.71, color.pale);
  gabledRoof(
    out,
    [central.frontX - 0.43, -34.8, -9.45, 9.45],
    central.upperY + 0.13,
    central.peak - central.upperY - 0.18,
    true,
    color.oldRoof,
  );
  for (const p of panels) {
    const o = transform(out, -Math.PI / 2, [p.x, 0, p.z]);
    if (p.pavilion)
      block(o, 'sandstone', [-p.width / 2, p.width / 2, -1.8, 0.035], -2.48, 17.14, color.stone);
    for (const y of [5.2, 11.25]) {
      for (let i = 0; i < p.windows; i++) {
        opening(
          o,
          ((i - (p.windows - 1) / 2) * p.width) / (p.windows + 0.35),
          0.081,
          y,
          1.36,
          2.58,
          0,
        );
      }
    }
  }
  westSteps(out, -1, 0);
  westSteps(out, 1, 0);
}

function lewisWing(out, lod) {
  const { bounds, top, facing, count } = lewis;
  block(out, 'sandstone', bounds, -4.82, top, color.golden);
  coping(out, bounds, top - 0.05, color.pale, 0.23);
  hip(
    out,
    [bounds[0] + 0.38, bounds[1] - 0.49, bounds[2] + 0.61, bounds[3] - 0.52],
    top + 0.17,
    2.18,
    color.oldRoof,
  );
  const center = (bounds[0] + bounds[1]) / 2,
    width = bounds[1] - bounds[0];
  const f = transform(out, Math.PI, [center, 0, facing]);
  const rows = [
    [0.33, 2.1, 1.13],
    [4.1, 2.72, 1.43],
    [9.3, 3.0, 1.47],
    [13.13, 1.46, 1.13],
  ];
  for (const [bottom, height, w] of lod ? rows : rows.slice(1, 3)) {
    for (let j = 0; j < count; j += lod ? 1 : 2) {
      const x = (j - (count - 1) * 0.5) * ((width - 2.5) / count);
      opening(
        f,
        x,
        0.062,
        bottom,
        w,
        height,
        lod === 3 ? 2 : Math.min(lod, 1),
        bottom === 9.3 ? 'pediment' : 'square',
      );
    }
  }
  if (lod) frontageBands(f, width + 0.48, 15.53, 0.1);
  for (const y of lod ? [3.54, 8.32, 12.49] : [8.32])
    box(f, 'sandstone', 0, y, 0.11, width, 0.22, 0.3, color.fascia);
  if (lod) {
    for (const x of [-width / 2 + 0.29, width / 2 - 0.3])
      box(f, 'sandstone', x, -1.25, 0.06, 0.45, 16.84, 0.38, color.lightGold);
    const skylight = [bounds[0] + 3.6, bounds[1] - 3.2, -19.5, -14.2];
    block(out, 'steel', skylight, 17.54, 17.94, color.graphite);
    slab(
      out,
      'glass',
      skylight[0] + 0.15,
      skylight[1] - 0.15,
      17.96,
      skylight[2] + 0.13,
      skylight[3] - 0.13,
      color.clear,
    );
  }
}
function vernonWing(out, lod) {
  const { bounds, top, westReturn } = vernon;
  block(out, 'sandstone', bounds, -2.88, top, color.stone);
  block(out, 'sandstone', westReturn, -1.6, top + 0.32, color.newStone);
  coping(out, bounds, top - 0.1, color.pale, 0.21);
  coping(out, westReturn, top + 0.24, color.pale, 0.23);
  hip(
    out,
    [bounds[0] + 0.46, bounds[1] - 0.4, bounds[2] + 0.44, bounds[3] - 0.42],
    top + 0.32,
    2.82,
    color.oldRoof,
  );
  const segments = [
    [-50.61, -35.79, 5],
    [-32.86, -3.4, 8],
    [0.03, 23.65, 6],
  ];
  for (const [x0, x1, count] of segments) {
    const faceZ = x0 < westReturn[1] ? westReturn[3] : bounds[3];
    const f = transform(out, 0, [(x0 + x1) / 2, 0, faceZ + 0.07]);
    const width = x1 - x0;
    for (let j = 0; j < count; j += lod ? 1 : 2) {
      const dx = ((j + 0.5) / count - 0.5) * width;
      opening(f, dx, 0.035, 4.19, 1.1, 2.84, lod === 3 ? 2 : Math.min(lod, 1));
      opening(
        f,
        dx,
        0.035,
        9.17,
        1.25,
        3.06,
        lod === 3 ? 2 : Math.min(lod, 1),
        j % 3 === 0 ? 'pediment' : 'square',
      );
      if (lod >= 2)
        box(
          f,
          'sandstone',
          dx + (width / count) * 0.46,
          3.37,
          0.05,
          0.21,
          10.8,
          0.23,
          color.fascia,
        );
    }
    if (lod) frontageBands(f, width + 0.4, 14.95, 0.11);
  }
  const west = transform(out, -Math.PI / 2, [
    westReturn[0] - 0.02,
    0,
    (westReturn[2] + westReturn[3]) / 2,
  ]);
  opening(west, 0, 0.05, 4.39, 1.17, 2.9, lod);
  opening(west, 0, 0.05, 9.65, 1.16, 2.91, lod, 'pediment');
}
function lowerGlazing(out, x0, x1, z, y0, y1, pieces, lod) {
  const area = transform(out, Math.PI, [(x0 + x1) / 2, 0, z]);
  const width = x1 - x0;
  rectangle(area, 'shadow', -width / 2, width / 2, y0, y1, 0, color.graphite);
  if (!lod) return;
  const n = lod === 1 ? Math.max(2, Math.ceil(pieces / 2)) : pieces;
  const step = width / n;
  for (let i = 0; i < n; i++) {
    const a = -width / 2 + i * step,
      b = a + step;
    rectangle(
      area,
      'glass',
      a + 0.055,
      b - 0.053,
      y0 + 0.11,
      y1 - 0.1,
      0.042,
      i % 4 === 1 ? color.glass : color.darkGlass,
    );
    if (lod >= 2) box(area, 'steel', a + 0.02, y0, 0.09, 0.06, y1 - y0, 0.071, color.steel);
  }
}
function parkesWing(out, lod) {
  const { bounds, top, sandstoneFront } = parkes,
    [x0, x1, z0, z1] = bounds;
  const [a, b] = sandstoneFront;
  block(out, 'trim', bounds, -6.1, top - 0.32, color.concrete);
  block(out, 'sandstone', [a, b, z0 - 0.12, z0 + 0.36], -0.41, top - 0.31, color.golden);
  const head = top - 2.48;
  lowerGlazing(out, x0, a, z0 - 0.11, 0.36, head, 2, lod);
  lowerGlazing(out, b, x1, z0 - 0.11, 0.17, head, 4, lod);
  lowerGlazing(out, x0, x1, z0 - 0.17, top - 1.34, top - 0.43, 13, lod);
  block(out, 'roof', boundsExpand(bounds, 0.61), top - 0.23, top + 0.15, color.roof);
  block(
    out,
    'roof',
    [x0 + 0.75, x1 - 1.2, z0 + 3.1, z1 - 1.9],
    top + 0.14,
    top + 0.38,
    color.roofPale,
  );
  block(
    out,
    'steel',
    [x0 - 0.32, x1 + 0.15, z0 + 0.82, z0 + 1.13],
    top + 0.12,
    top + 0.91,
    color.metal,
  );
  if (lod >= 2) {
    for (let x = a + 1.12; x < b - 0.62; x += 2.92) {
      const f = transform(out, Math.PI, [x, 0, z0 - 0.137]);
      rectangle(f, 'shadow', -0.43, 0.44, -0.26, 0.49, 0.051, color.graphite);
    }
    for (const x of [a, b]) {
      for (let y = 1.8; y < head; y += 2.75) {
        beam(
          out,
          'steel',
          [x - 0.51, y, z0 - 0.14],
          [x + 0.51, y, z0 - 0.14],
          0.11,
          0.13,
          color.metal,
        );
      }
    }
  }
  if (lod) {
    for (const [x, z] of [
      [2.84, -11.1],
      [15.52, -2.22],
      [21.49, -11.05],
    ]) {
      box(out, 'trim', x, top + 0.29, z, 5.28, 1.72, 4.05, color.concrete);
      box(out, 'roof', x, top + 1.97, z, 5.54, 0.23, 4.29, color.roof);
    }
    const f = transform(out, 0, [(x0 + x1) / 2, 0, z1 + 0.071]);
    for (let level = 0; level < 3; level++) {
      const y = 6.66 + 3.04 * level;
      for (let j = 0; j < 8; j++)
        opening(f, (j - 3.5) * 3.66, 0.05, y, 1.42, 1.62, Math.min(1, lod));
    }
  }
}
function researchWing(out, lod) {
  const { bounds, top, fins } = research;
  const [x0, x1, z0, z1] = bounds;
  block(out, 'trim', bounds, -6.85, top, color.concrete);
  const shell = [x0 + 4.56, x1 + 0.15, z0 + 0.09, z1 - 0.12];
  block(out, 'steel', shell, 2.1, top - 0.38, color.metal);
  for (const [i, y] of fins.entries()) {
    if (!lod && i % 2) continue;
    const xEnd = x1 + 0.22 + (i % 3 === 1 ? 0.19 : 0);
    block(
      out,
      'roof',
      [x0 + 4.38, xEnd, z0 - 0.23, z0 + 0.17],
      y,
      y + 0.18,
      i % 3 === 0 ? color.roofPale : color.roof,
    );
    if (lod >= 2)
      block(
        out,
        'steel',
        [xEnd - 0.18, xEnd + 0.22, z0 - 0.12, z1 - 0.21],
        y - 0.02,
        y + 0.12,
        color.steel,
      );
  }
  // A short faceted glazed return gives the rounded upper entry core its silhouette.
  const cx = x0 + 8.21,
    cz = z0 + 2.14,
    radius = 3.36;
  const curved = Array.from({ length: lod >= 2 ? 13 : 7 }, (_, index) => {
    const n = lod >= 2 ? 12 : 6;
    const t = Math.PI + (index * Math.PI * 0.75) / n;
    return [cx + Math.cos(t) * radius, cz + Math.sin(t) * radius];
  });
  for (const [i, a] of curved.slice(0, -1).entries()) {
    const b = curved[i + 1];
    const normal = [(a[0] + b[0]) / 2 - cx, 0, (a[1] + b[1]) / 2 - cz];
    face(
      out,
      'shadow',
      [
        [a[0], -0.83, a[1]],
        [b[0], -0.83, b[1]],
        [b[0], top - 0.09, b[1]],
        [a[0], top - 0.09, a[1]],
      ],
      normal,
      color.darkGlass,
    );
    if (!lod) continue;
    for (const y of lod === 1 ? fins.filter((_, j) => j % 2 === 0) : fins) {
      beam(out, 'steel', [a[0], y, a[1]], [b[0], y, b[1]], 0.12, 0.15, color.steel);
    }
  }
  block(out, 'roof', boundsExpand(bounds, 0.27), top - 0.03, top + 0.32, color.roof);
  if (lod) {
    block(out, 'steel', [x0 + 5.3, x1 - 2.1, -5.14, 13.17], top + 0.17, top + 1.46, color.metal);
    coping(out, [x0 + 5.3, x1 - 2.1, -5.14, 13.17], top + 1.4, color.paleGrey, 0.24);
    const f = transform(out, Math.PI * 0.5, [x1 + 0.36, 0, (z0 + z1) / 2]);
    for (let row = 0; row < 3; row++) {
      for (let i = 0; i < (lod >= 2 ? 14 : 8); i++) {
        const n = lod >= 2 ? 14 : 8;
        const t = (i + 0.5) / n;
        const w = (z1 - z0 - 7) / n;
        const x = (0.5 - t) * (z1 - z0 - 7);
        rectangle(
          f,
          'shadow',
          x - w * 0.43,
          x + w * 0.43,
          10.3 + row * 2.22,
          11.62 + row * 2.22,
          0.055,
          i % 5 === 1 ? color.paleGrey : color.graphite,
        );
      }
    }
  }
}
function annex(out, lod) {
  const { bounds, top } = easternAnnex;
  block(out, 'trim', bounds, -7.65, top, color.terrace);
  coping(out, bounds, top - 0.14, color.paleGrey, 0.12);
  const [x0, x1, z0, z1] = bounds;
  hip(out, [x0 + 0.13, x1 - 0.07, z0 + 0.32, z1 - 0.27], top + 0.1, 1.66, color.oldRoof);
  const f = transform(out, Math.PI * 0.5, [x1 + 0.04, 0, (z0 + z1) / 2]);
  for (let i = 0; i < 10; i++) {
    const x = (i - 4.5) * 4.69;
    opening(f, x, 0.035, -1.18, 1.03, 2.06, Math.min(1, lod));
    opening(f, x, 0.035, 2.62, 1.12, 2.34, Math.min(1, lod));
    if (lod >= 2) box(f, 'trim', x - 1.62, -2.03, 0.074, 0.25, 8.93, 0.17, color.concrete);
  }
  for (const y of [1.41, 5.55, 8.42])
    box(f, 'trim', 0, y, 0.12, z1 - z0, 0.25, 0.27, color.paleGrey);
}

function atriumRoof(out, lod) {
  const { bounds, glassBounds, base, crest } = atrium;
  const [x0, x1, z0, z1] = glassBounds;
  const width = (z1 - z0) / 2;
  const center = (z0 + z1) / 2;
  // The old court is filled by the Still addition, with the glazing set in its roof.
  block(out, 'trim', bounds, -3.4, base - 0.25, color.concrete);
  const strips = [
    [bounds[0], x0, z0, z1],
    [x1, bounds[1], z0, z1],
    [bounds[0], bounds[1], bounds[2], z0],
    [bounds[0], bounds[1], z1, bounds[3]],
  ];
  for (const p of strips) block(out, 'roof', p, base - 0.25, base + 0.1, color.roofPale);
  for (const half of [-1, 1]) {
    const edge = center + half * width;
    face(
      out,
      lod ? 'glass' : 'roof',
      [
        [x0, base, edge],
        [x1, base, edge],
        [x1, crest, center],
        [x0, crest, center],
      ],
      up,
      color.clear,
    );
  }
  for (const x of [x0, x1]) {
    face(
      out,
      'steel',
      [
        [x, base, z0],
        [x, base, z1],
        [x, crest, center],
      ],
      [Math.sign(x - (x0 + x1) / 2), 0, 0],
      color.metal,
    );
  }
  if (!lod) return;
  beam(
    out,
    'steel',
    [x0, crest + 0.02, center],
    [x1, crest + 0.02, center],
    0.17,
    0.17,
    color.steel,
  );
  const n = [0, 5, 8, 10][lod];
  for (let i = 0; i <= n; i++) {
    const x = x0 + ((x1 - x0) * i) / n;
    for (const side of [-1, 1])
      beam(
        out,
        'steel',
        [x, base + 0.05, center + side * width],
        [x, crest + 0.05, center],
        0.12,
        0.13,
        color.steel,
      );
  }
}

function museumWalk(out, lod) {
  const { ramp, rampWidth } = hall;
  const half = rampWidth / 2;
  for (const [i, a] of ramp.slice(0, -1).entries()) {
    const b = ramp[i + 1],
      [x1, z1, y1] = a,
      [x2, z2, y2] = b;
    const p = [
      [x1, y1, z1 - half],
      [x2, y2, z2 - half],
      [x2, y2, z2 + half],
      [x1, y1, z1 + half],
    ];
    face(out, 'trim', p, up, color.ramp);
    for (const j of [0, 2]) {
      const k = (j + 1) % 4;
      const lower = (p) => [p[0], p[1] - 0.37, p[2]];
      face(
        out,
        'trim',
        [lower(p[j]), lower(p[k]), p[k], p[j]],
        j === 0 ? back : front,
        color.metal,
      );
      if (lod) {
        beam(
          out,
          'steel',
          p[j].map((v, k) => v + (k === 1 ? 0.91 : 0)),
          p[k].map((v, k) => v + (k === 1 ? 0.91 : 0)),
          0.071,
          0.078,
          color.steel,
        );
        if (lod >= 2) {
          const n = lod === 3 ? 10 : 6;
          for (let s = 0; s <= n; s++) {
            const [x, y, z] = lerp(p[j], p[k], s / n);
            box(out, 'steel', x, y, z, 0.063, 0.94, 0.077, color.metal);
          }
        } else {
          const [x, y, z] = lerp(p[j], p[k], 0.51);
          box(out, 'steel', x, y, z, 0.075, 0.94, 0.08, color.metal);
        }
      }
    }
    if (lod)
      for (const t of [0.42, 0.78]) {
        const [x, z, y] = lerp(a, b, t);
        const low = -5.7 + x * 0.011;
        box(out, 'trim', x, low, z, 0.49, y - low - 0.28, 0.52, color.metal);
      }
  }
}
function crystalHall(out, lod) {
  const { bounds, floor, top, link } = hall;
  const [x0, x1, z0, z1] = bounds;
  block(out, 'trim', bounds, floor - 0.35, floor, color.ramp);
  block(out, 'roof', boundsExpand(bounds, 0.13), top - 0.31, top + 0.1, color.roofPale);
  block(out, 'steel', link, floor - 0.32, floor + 0.1, color.metal);
  block(out, 'roof', link, top - 0.54, top - 0.24, color.roof);
  // The outer screen is pleated and the structure sits above the sheltered garden.
  const directions = [
    [0, 0, -1],
    [1, 0, 0],
    [0, 0, 1],
    [-1, 0, 0],
  ];
  const corners = [
    [x0, z0],
    [x1, z0],
    [x1, z1],
    [x0, z1],
  ];
  for (const [i, a] of corners.entries()) {
    const b = corners[(i + 1) % 4],
      direction = directions[i];
    const base = floor + 0.18,
      high = top - 0.27;
    // The west return has a real opening where the accessible walkway arrives.
    const start = i === 3 ? lerp(a, b, 0.72) : a;
    face(
      out,
      lod ? 'glass' : 'shadow',
      [
        [start[0], base, start[1]],
        [b[0], base, b[1]],
        [b[0], high, b[1]],
        [start[0], high, start[1]],
      ],
      direction,
      i === 0 ? color.glass : color.darkGlass,
    );
    if (lod) {
      for (const y of [floor + 0.06, top - 0.32]) {
        beam(out, 'steel', [a[0], y, a[1]], [b[0], y, b[1]], 0.14, 0.21, color.graphite);
      }
      box(out, 'steel', a[0], floor, a[1], 0.113, top - floor - 0.18, 0.12, color.steel);
    }
  }
  const shades = [
    color.crystalBlue,
    color.crystalViolet,
    color.crystalGreen,
    color.glass,
    color.clear,
  ];
  if (!lod) {
    const height = top - floor;
    for (let i = 0; i < 7; i++) {
      const cx = x0 + ((i + 0.5) * (x1 - x0)) / 7,
        dx = (x1 - x0) / 14 - 0.04;
      face(
        out,
        'shadow',
        [
          [cx - dx, floor + height * 0.61, z0 - 0.042],
          [cx, floor + height * 0.45, z0 - 0.048],
          [cx + dx, floor + height * 0.61, z0 - 0.042],
          [cx, floor + height * 0.77, z0 - 0.048],
        ],
        back,
        shades[i % 4],
      );
    }
  } else {
    const n = lod === 1 ? 8 : 12;
    const step = (x1 - x0) / n;
    for (let i = 0; i < n; i++) {
      const cx = x0 + (i + 0.5) * step,
        edge = step * 0.47;
      const z = z0 - 0.086;
      if (lod >= 2)
        box(
          out,
          'steel',
          cx - edge,
          floor + 0.05,
          z0,
          0.069,
          top - floor - 0.27,
          0.103,
          color.steel,
        );
      const rows = lod === 1 ? 2 : 4;
      for (let j = 0; j < rows; j++) {
        const y = floor + 3.52 + ((j + 0.24) * 4.49) / rows;
        const rh = rows === 2 ? 1.08 : 0.68;
        const tips = [
          [cx - edge, y, z],
          [cx, y - rh, z],
          [cx + edge, y, z],
          [cx, y + rh, z],
        ];
        const joint = [cx, y, z - (lod === 3 ? 0.34 : 0.25)];
        const tone = shades[(i * 7 + j * 3 + (Math.floor(i / 3) % 2)) % shades.length];
        face(out, 'glass', [tips[0], tips[1], joint, tips[3]], back, tone);
        face(
          out,
          'glass',
          [joint, tips[1], tips[2], tips[3]],
          back,
          tone.map((v) => v * 0.88),
        );
        if (lod === 3) {
          beam(out, 'steel', tips[0], tips[3], 0.03, 0.036, color.steel);
          beam(out, 'steel', tips[3], tips[2], 0.03, 0.036, color.steel);
        }
      }
    }
  }
  const gardenBottom = -5.8;
  for (const [x, z] of [
    [x0 + 0.94, z0 + 0.85],
    [x1 - 0.94, z0 + 0.85],
    [x0 + 0.94, z1 - 1],
    [x1 - 0.94, z1 - 1],
  ]) {
    box(out, 'steel', x, gardenBottom, z, 0.33, floor - gardenBottom, 0.34, color.graphite);
  }
  if (lod >= 2) {
    const linkZ0 = link[2],
      linkZ1 = link[3];
    for (const x of [link[0], link[1]]) {
      face(
        out,
        'glass',
        [
          [x, floor, linkZ0],
          [x, floor, linkZ1],
          [x, top - 0.54, linkZ1],
          [x, top - 0.54, linkZ0],
        ],
        [x < 0 ? -1 : 1, 0, 0],
        color.darkGlass,
      );
    }
  }
  museumWalk(out, lod);
}
function build(out, lod) {
  if (lod) barnetWing(out, lod);
  else barnetSkyline(out);
  lewisWing(out, lod);
  vernonWing(out, lod);
  parkesWing(out, lod);
  researchWing(out, lod);
  annex(out, lod);
  atriumRoof(out, lod);
  crystalHall(out, lod);
}
export const museumSkyline = (out) => build(out, 0);
export const museumDistrict = (out) => build(out, 1);
export const museumStreet = (out) => build(out, 2);
export const museumCloseup = (out) => build(out, 3);
const recipe = 'australian-museum-model.mjs';
const camera = [-138, 87, -102],
  lookAt = [-5, 8, 0];
export const museumModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  recipe,
  recipeDependencies: ['heritage-tower-detail-mesh.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  surfaces,
  wikidataId: 'Q769416',
  category: 'landmark',
  build: museumCloseup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'geographic-preview',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'The Australian Museum on College and William Streets, with the Barnet sandstone front, Lewis and Vernon wings, Parkes Farmer and research blocks, and Crystal Hall’s diamond glazing.',
  camera,
  lookAt,
  sunDirection: [-70, 84, -45],
  embeddedCanonicalGraphs: [
    'stone_sandstone',
    'concrete_plain',
    'metal_painted',
    'metal_standing_seam',
  ],
  buildingCutout: {
    outline: frame.geometry.outline,
    basis:
      'Exclude generic overlaps on the mapped Australian Museum building while preserving adjoining properties.',
  },
  mediumFiContext: {
    scale: 1,
    groundY: -0.15,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  qaCameras: [
    {
      name: 'college-street-giant-order-and-stairs',
      position: [-95, 10, -22],
      lookAt: [-53, 10, 0],
    },
    {
      name: 'william-street-crystal-hall-and-museum-walk',
      position: [-24, 10, -66],
      lookAt: [-1, 5.5, -34],
    },
    { name: 'eastern-wings-and-atrium-roof', position: [92, 75, -37], lookAt: [9, 9, -3] },
    { name: 'vernon-wing-and-southern-return', position: [-90, 31, 75], lookAt: [-14, 8, 25] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'museum-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'museumSkyline',
    errorMeters: 0.93,
    surfaces,
    authoredLevels: Object.fromEntries(
      [
        ['district', 'museumDistrict', 0.44],
        ['street', 'museumStreet', 0.18],
        ['closeup', 'museumCloseup', 0.065],
      ].map(([level, name, errorMeters]) => [level, { export: name, errorMeters, surfaces }]),
    ),
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original geometry under the repository license. The 1872 New South Wales photograph is public domain. The named modern photographers released their original photographs under CC0. OpenStreetMap geometry is ODbL 1.0.',
};
