import { readFileSync } from 'node:fs';
import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import {
  abox,
  extrude,
  facade,
  fbox,
  lathe,
  opening,
  quad4,
  rgb,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const read = (file) => JSON.parse(readFileSync(new URL('../' + file + '.json', import.meta.url)));
const plan = read('plan-controls');
const frame = read('map-frame');
const surfaces = {
  brick: { slot: 'wall', graph: 'brick_flemish', roughness: 0.95 },
  stone: { slot: 'wall', graph: 'stone_limestone', roughness: 0.91 },
  trim: { slot: 'trim', graph: 'stone_sandstone', roughness: 0.89 },
  copper: { slot: 'roof', graph: 'metal_painted', roughness: 0.86 },
  coping: { slot: 'trim', graph: 'metal_painted', roughness: 0.86 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.63 },
};
const brick = rgb('a17867');
const redBrick = rgb('986757');
const stone = rgb('baad95');
const cream = rgb('cec1a6');
const base = rgb('9b907c');
const copper = rgb('597168');
const roofShade = rgb('52665f');
const ridgeColor = rgb('6a7c72');
const glass = rgb('454c4c');
const reflection = rgb('65716e');
const drawRect = (x0, x1, z0, z1) => [
  [x0, z1],
  [x1, z1],
  [x1, z0],
  [x0, z0],
];
const p3 = ([x, z], y) => [x, y, z];
const lerp = (a, b, t) => a.map((x, i) => x + (b[i] - x) * t);
function oriented(a, b, width) {
  const axis = wallFace(a, b);
  const xy = (u, d) => {
    const [x, , z] = axis.P(u, 0, d);
    return [x, z];
  };
  return [
    xy(0, width / 2),
    xy(axis.length, width / 2),
    xy(axis.length, -width / 2),
    xy(0, -width / 2),
  ];
}

function simpleWindow(out, F, u, y, w, h, color = glass, d = 0.041) {
  quad4(
    out,
    'glass',
    F.P(u - w / 2, y, d),
    F.P(u + w / 2, y, d),
    F.P(u + w / 2, y + h, d),
    F.P(u - w / 2, y + h, d),
    color,
  );
}

function facadeBays(out, F, height, floors, level, focus, width) {
  const count = Math.max(1, Math.round(F.length / (level === 1 ? width * 1.19 : width)));
  const first = focus ? 5.0 : 1.52;
  for (let i = 0; i < count; i++) {
    const u = ((i + 0.5) * F.length) / count;
    for (let floor = 0; floor < floors; floor++) {
      const y = first + ((height - 2.65 - first) * floor) / Math.max(1, floors - 1);
      const w = focus ? 1.35 : 1.19;
      const h = focus ? 2.0 : 1.84;
      if (level < 3 || !focus) {
        if (level === 2 && focus) {
          quad4(
            out,
            'trim',
            F.P(u - w * 0.64, y - 0.13, 0.031),
            F.P(u + w * 0.64, y - 0.13, 0.031),
            F.P(u + w * 0.64, y + h + 0.12, 0.031),
            F.P(u - w * 0.64, y + h + 0.12, 0.031),
            cream,
          );
        }
        simpleWindow(out, F, u, y, w, h, floor % 3 === 1 ? reflection : glass);
        if (level === 3) {
          fbox(out, 'trim', F, u - w * 0.6, u + w * 0.6, y - 0.15, y - 0.045, 0.018, 0.164, stone);
          fbox(out, 'trim', F, u - 0.034, u + 0.034, y + 0.01, y + h - 0.01, 0.047, 0.089, cream);
        }
      } else {
        opening(out, F, u, y, w, h, {
          glassSlot: 'glass',
          frameSlot: 'trim',
          glass,
          frame: cream,
          frameWidth: 0.105,
          frameDepth: 0.16,
          head: floor === 0 && level === 3 ? 'tudor' : 'flat',
          sill: true,
          mullions: 1,
          transoms: level === 3 ? 1 : 0,
        });
      }
    }
  }
}

function walls(
  out,
  poly,
  top,
  floors,
  { color = brick, focus = false, visible = [0, 1, 2, 3], level },
) {
  for (let i = 0; i < poly.length; i++) {
    const F = wallFace(poly[i], poly[(i + 1) % poly.length]);
    const w = F.length;
    quad4(out, 'brick', F.P(0, 0.03), F.P(w, 0.03), F.P(w, top), F.P(0, top), color);
    const detailed = visible.includes(i);
    if (!detailed || w < 5.0) continue;
    if (level === 0) {
      if (focus && i === 0) fbox(out, 'stone', F, 0, w, 0.11, 3.46, -0.035, 0.116, stone);
      continue;
    }
    if (level === 1) {
      const baseHeight = focus ? 3.46 : 1.01;
      quad4(
        out,
        'stone',
        F.P(0, 0.11, 0.1),
        F.P(w, 0.11, 0.1),
        F.P(w, baseHeight, 0.1),
        F.P(0, baseHeight, 0.1),
        stone,
      );
      quad4(
        out,
        'trim',
        F.P(0, top - 0.31, 0.16),
        F.P(w, top - 0.31, 0.16),
        F.P(w, top + 0.05, 0.16),
        F.P(0, top + 0.05, 0.16),
        cream,
      );
    } else {
      fbox(out, 'stone', F, 0, w, 0.11, focus ? 3.46 : 1.01, -0.035, 0.116, stone);
      fbox(out, 'trim', F, 0, w, top - 0.31, top + 0.05, -0.052, 0.195, cream);
    }
    facadeBays(out, F, top, floors, level, focus && (i === 0 || i === 1), focus ? 3.3 : 4.6);
    if (level === 1) continue;
    for (const x of [0.31, w - 0.31])
      fbox(out, 'trim', F, x - 0.26, x + 0.26, 1.1, top - 0.18, 0.026, 0.135, stone);
    for (const y of [3.44, top - 4.02])
      fbox(out, 'trim', F, 0, w, y - 0.042, y + 0.15, 0.018, 0.113, cream);
  }
}

function copperRoof(out, poly, top, ridge, style = 'hip') {
  const [a, b, c, d] = poly;
  const depth = style === 'mansard' ? 0.67 : 0.59;
  const inset = style === 'tower' ? 0.32 : 0.12;
  const upper = [
    lerp(lerp(a, d, depth * 0.5), lerp(b, c, depth * 0.5), inset),
    lerp(lerp(b, c, depth * 0.5), lerp(a, d, depth * 0.5), inset),
    lerp(lerp(c, b, depth * 0.5), lerp(d, a, depth * 0.5), inset),
    lerp(lerp(d, a, depth * 0.5), lerp(c, b, depth * 0.5), inset),
  ];
  const broken = style === 'mansard' || style === 'tower';
  const knee = broken ? top + (ridge - top) * 0.81 : top + (ridge - top) * 0.56;
  for (let i = 0; i < poly.length; i++) {
    const k = (i + 1) % poly.length;
    quad4(
      out,
      'copper',
      p3(poly[i], top),
      p3(poly[k], top),
      p3(upper[k], knee),
      p3(upper[i], knee),
      i % 2 === 0 ? copper : roofShade,
    );
  }
  const insetHigh = style === 'mansard' ? 0.08 : 0.2;
  const A = lerp(upper[0], upper[3], 0.5),
    B = lerp(upper[1], upper[2], 0.5);
  const left = p3(lerp(A, B, insetHigh), ridge),
    right = p3(lerp(B, A, insetHigh), ridge);
  quad4(out, 'copper', p3(upper[0], knee), p3(upper[1], knee), right, left, copper);
  quad4(out, 'copper', p3(upper[2], knee), p3(upper[3], knee), left, right, copper);
  tri(out, 'copper', p3(upper[1], knee), p3(upper[2], knee), right, roofShade);
  tri(out, 'copper', p3(upper[3], knee), p3(upper[0], knee), left, roofShade);
  return { left, right };
}

function gable(out, x, z, w, h, y, sign, level) {
  const F = facade([x, z], [sign, 0]);
  const left = F.P(-w / 2, y),
    right = F.P(w / 2, y),
    top = F.P(0, y + h);
  quad4(out, 'brick', F.P(-w / 2, y - 1.32), F.P(w / 2, y - 1.32), right, left, redBrick);
  tri(out, 'stone', left, right, top, cream);
  quad4(out, 'copper', left, top, F.P(0, y + h, -2.9), F.P(-w / 2, y, -2.9), roofShade);
  quad4(out, 'copper', top, right, F.P(w / 2, y, -2.9), F.P(0, y + h, -2.9), copper);
  quad4(
    out,
    'stone',
    F.P(-w / 2, y - 1.32),
    left,
    F.P(-w / 2, y, -2.9),
    F.P(-w / 2, y - 1.32, -2.9),
    stone,
  );
  quad4(
    out,
    'stone',
    F.P(w / 2, y - 1.32),
    F.P(w / 2, y - 1.32, -2.9),
    F.P(w / 2, y, -2.9),
    right,
    stone,
  );
  if (level === 0) return;
  simpleWindow(out, F, 0, y - 0.84, w * 0.35, h * 0.64, glass, 0.064);
  if (level >= 2) {
    fbox(out, 'trim', F, -w * 0.255, w * 0.255, y - 1.02, y - 0.91, 0.04, 0.18, cream);
    fbox(out, 'trim', F, -0.053, 0.053, y - 0.88, y - 0.84 + h * 0.64, 0.064, 0.19, cream);
    fbox(out, 'trim', F, -0.058, 0.058, y + h, y + h + 0.55, -0.039, 0.099, cream);
  }
}

function belvedere(out, x, z, bottom, top, r, level) {
  if (level === 0) {
    lathe(
      out,
      'stone',
      [x, z],
      [
        [bottom, r, r],
        [top - 1.3, r, r],
      ],
      5,
      stone,
      { capTop: false },
    );
    lathe(
      out,
      'copper',
      [x, z],
      [
        [top - 1.3, r * 1.11, r * 1.11],
        [top - 0.59, r * 0.92, r * 0.92],
        [top + 0.04, 0.063, 0.063],
      ],
      5,
      copper,
      { capTop: false },
    );
    return;
  }
  const count = level === 0 ? 6 : level === 3 ? 12 : 8;
  lathe(
    out,
    'stone',
    [x, z],
    [
      [bottom, r * 0.78, r * 0.78],
      [bottom + 0.54, r, r],
      [top - 1.57, r, r],
      [top - 1.28, r * 1.12, r * 1.12],
    ],
    count,
    stone,
  );
  lathe(
    out,
    'copper',
    [x, z],
    [
      [top - 1.31, r * 1.15, r * 1.15],
      [top - 0.66, r * 0.92, r * 0.92],
      [top - 0.09, r * 0.31, r * 0.31],
      [top + 0.04, 0.063, 0.063],
    ],
    count,
    copper,
  );
  if (level < 2) return;
  for (const [dx, dz] of [
    [0, 1],
    [-1, 0],
    [1, 0],
    [0, -1],
  ]) {
    const F = facade([x + dx * r * 0.98, z + dz * r * 0.98], [dz, -dx]);
    simpleWindow(out, F, 0, top - 3.55, 0.66, 1.42, glass, 0.085);
  }
}

function entrance(out, level) {
  const F = facade([6, 32.43], [1, 0]);
  const w = 25.8;
  fbox(out, 'stone', F, 0, w, 0.16, 0.93, -2.35, 1.0, base);
  fbox(out, 'stone', F, 0, w, 3.08, 3.43, -1.1, 0.84, cream);
  for (let i = 0; i < 5; i++) {
    const u = ((i + 0.5) * w) / 5;
    const span = 3.62;
    if (level === 0) simpleWindow(out, F, u, 1.03, span, 1.92, glass, 0.05);
    else {
      opening(out, F, u, 0.76, span, 2.65, {
        head: 'tudor',
        rise: 0.52,
        glassSlot: 'glass',
        frameSlot: 'trim',
        glass,
        frame: cream,
        frameWidth: 0.19,
        d: 0.055,
        frameDepth: 0.18,
        sill: false,
        mullions: level >= 2 ? 2 : 0,
      });
      fbox(out, 'stone', F, u - 2.59, u - 2.38, 0.9, 3.07, -0.96, 0.23, stone);
    }
  }
  if (level >= 2)
    for (let step = 0; step < 3; step++) {
      fbox(
        out,
        'stone',
        F,
        8.1 - step * 0.13,
        17.15 + step * 0.13,
        0.31 - step * 0.16,
        0.46 - step * 0.16,
        0.96,
        1.5 + step * 0.36,
        stone,
      );
    }
}

function oriel(out, x, level) {
  const outline = [
    [x - 2.64, 31.01],
    [x - 1.57, 33.31],
    [x + 1.57, 33.31],
    [x + 2.64, 31.01],
  ];
  const floor = 5.02;
  const top = 23.24;
  for (let i = 0; i < 3; i++) {
    const F = wallFace(outline[i], outline[i + 1]);
    quad4(
      out,
      'stone',
      F.P(0, floor),
      F.P(F.length, floor),
      F.P(F.length, top),
      F.P(0, top),
      stone,
    );
    if (level === 0) continue;
    for (let n = 0; n < 5; n++) {
      const y = floor + 0.61 + n * 3.49;
      const u = F.length * 0.5;
      simpleWindow(out, F, u, y, i === 1 ? 1.57 : 0.72, 2.15, glass, 0.035);
      if (level >= 2 && i === 1)
        fbox(out, 'trim', F, u - 0.04, u + 0.04, y, y + 2.15, 0.032, 0.1, cream);
    }
    fbox(out, 'trim', F, 0, F.length, top - 0.21, top + 0.06, -0.02, 0.11, cream);
  }
  quad4(
    out,
    'coping',
    p3(outline[0], top),
    p3(outline[1], top),
    p3(outline[2], top),
    p3(outline[3], top),
    roofShade,
  );
}

function chimney(out, x, z, y, h, level) {
  const w = level === 0 ? 0.63 : 0.95;
  abox(out, 'brick', [x - w, y, z - 0.59], [x + w, h, z + 0.59], redBrick);
  if (level > 0)
    abox(
      out,
      'trim',
      [x - w - 0.16, h - 0.21, z - 0.74],
      [x + w + 0.16, h + 0.05, z + 0.74],
      cream,
    );
  if (level >= 2)
    for (const dx of [-0.38, 0.38])
      abox(
        out,
        'coping',
        [x + dx - 0.14, h, z - 0.17],
        [x + dx + 0.14, h + 0.4, z + 0.17],
        ridgeColor,
      );
}

const volumes = [
  {
    poly: drawRect(-6.36, 47.3, 10.65, 32.22),
    top: 24.08,
    ridge: 35.6,
    floors: 5,
    focus: true,
    style: 'mansard',
    visible: [0, 1, 3],
  },
  {
    poly: drawRect(-5.98, 6.75, -6.0, 24.6),
    top: 24.14,
    ridge: 35.73,
    floors: 6,
    style: 'hip',
    turn: true,
    visible: [1, 3],
  },
  {
    poly: drawRect(31.9, 47.16, -10.0, 25.41),
    top: 25.05,
    ridge: 34.32,
    floors: 6,
    style: 'hip',
    turn: true,
    visible: [1, 3],
  },
  {
    poly: drawRect(-9.98, 6.6, 11.96, 31.23),
    top: 25.18,
    ridge: 36.28,
    floors: 5,
    focus: true,
    style: 'tower',
    turn: true,
    visible: [0, 3],
  },
  {
    poly: drawRect(31.5, 47.45, 15.7, 31.0),
    top: 25.12,
    ridge: 36.7,
    floors: 5,
    focus: true,
    style: 'tower',
    turn: true,
    visible: [0, 1],
  },
  {
    poly: oriented([-71.3, -8.99], [-54.55, -61.95], 20.4),
    top: 24.85,
    ridge: 35.87,
    floors: 6,
    style: 'mansard',
    visible: [0, 1, 2],
  },
  {
    poly: oriented([-72.08, -18.4], [-68.1, -5.68], 17.55),
    top: 29.69,
    ridge: 48.95,
    floors: 7,
    style: 'tower',
    visible: [0, 1, 3],
  },
  {
    poly: drawRect(-64.3, -27.83, -19.7, -3.72),
    top: 25.19,
    ridge: 35.93,
    floors: 6,
    style: 'hip',
    visible: [0, 2],
  },
  {
    poly: drawRect(-39.8, -25.14, -13.8, 1.4),
    top: 28.72,
    ridge: 43.27,
    floors: 7,
    style: 'tower',
    turn: true,
    visible: [0, 3],
  },
  {
    poly: drawRect(-29.32, 13.26, -19.3, -4.3),
    top: 24.84,
    ridge: 36.7,
    floors: 6,
    style: 'mansard',
    visible: [0, 2],
  },
  {
    poly: drawRect(27.9, 71.95, -18.57, -2.57),
    top: 23.98,
    ridge: 34.35,
    floors: 6,
    style: 'mansard',
    visible: [0, 1, 2],
  },
];

function annexes(out, level) {
  const reception = drawRect(-40.25, -18.58, 4.53, 27.54);
  walls(out, reception, 8.65, 2, { color: redBrick, level, visible: [0, 1, 3] });
  copperRoof(out, reception, 8.64, 11.28);
  const ridge = drawRect(-35.3, -23.8, 9.11, 23.13);
  copperRoof(out, ridge, 10.14, 15.38, 'hip');
  const low = drawRect(-27.26, 27.59, -32.17, -18.98);
  walls(out, low, 7.11, 2, { color: brick, level, visible: [1, 2, 3] });
  abox(out, 'copper', [-27.26, 7.08, -32.17], [27.59, 7.34, -18.98], roofShade);
  const courtyard = drawRect(6.57, 31.4, -14.2, 10.95);
  walls(out, courtyard, 6.94, 1, { color: brick, level, visible: [1, 3] });
  abox(out, 'copper', [6.57, 6.9, -14.2], [31.4, 7.2, 10.95], roofShade);
  const southPorch = drawRect(47.26, 59.99, 11.77, 21.56);
  walls(out, southPorch, 7.41, 2, { color: stone, level });
  copperRoof(out, southPorch, 7.4, 9.74);
}

function build(out, level) {
  const footprint = frame.geometry.outline;
  extrude(out, 'stone', footprint, -3.05, 0.35, base, { top: false });
  const cap = new MeshBufferBuilder();
  if (
    !cap.addCap(
      'stone',
      'palette:#ffffff',
      footprint,
      [],
      () => 0.35,
      [0, 1, 0],
      (point) => point,
      base,
    )
  )
    throw new Error('Could not close the mapped hotel footprint');
  const foundation = cap.finalize();
  const pointAt = (index) => [...foundation.positions.subarray(index * 3, index * 3 + 3)];
  for (let i = 0; i < foundation.indices.length; i += 3) {
    const [a, b, c] = foundation.indices.subarray(i, i + 3);
    tri(out, 'stone', pointAt(a), pointAt(b), pointAt(c), base);
  }
  for (const volume of volumes) {
    const { poly, top, ridge, floors, style, turn } = volume;
    walls(out, poly, top, floors, { ...volume, level, color: volume.focus ? redBrick : brick });
    copperRoof(out, turn ? [...poly.slice(1), poly[0]] : poly, top - 0.045, ridge, style);
  }
  annexes(out, level);
  entrance(out, level);
  oriel(out, -1.43, level);
  oriel(out, 42.14, level);
  for (const [x, z, y, h] of [
    [22.1, 20, 30.9, 39.96],
    [-61.03, -6.94, 27.13, 39.77],
    [-53.6, -20.15, 27.2, 34.15],
    [62.0, -10.2, 31.1, 34.69],
  ])
    chimney(out, x, z, y, h, level);
  for (const [x, z, b, t, r] of [
    [-5.66, 28, 19.2, 30.4, 1.63],
    [45.96, 26.7, 17.1, 30.95, 1.74],
    [-59.5, -3.15, 21.3, 34.68, 1.72],
    [-46.5, -4.53, 20.9, 33.2, 1.54],
    [70.4, -3.38, 15.53, 27.14, 1.52],
  ])
    belvedere(out, x, z, b, t, r, level);
  if (level === 0) return;
  for (const x of [-3.1, 1.22, 9.55, 13.92, 18.25, 22.7, 27.02, 33.98, 39.04, 43.53])
    gable(out, x, 31.53, 2.46, 2.62, 25.69, 1, level);
  const wingDormers =
    level === 1
      ? [-62, -48, -27, -17, -6, 33, 45, 57, 68]
      : [-62, -54, -48, -42, -27, -22, -17, -12, -6, 33, 39, 45, 51, 57, 63, 68];
  for (const x of wingDormers)
    gable(out, x, x >= 30 ? -2.9 : -3.94, 2.17, 2.68, x >= 30 ? 25.42 : 26.38, 1, level);
  if (level >= 2) {
    for (const x of [-59, -49, -40, -26, -17, -8, 32, 41, 51, 61, 67])
      gable(out, x, x >= 30 ? -18.14 : -18.84, 2.18, 2.29, 25.18, -1, level);
    for (const x of [-3.87, 44.82]) {
      for (const dx of [-1.5, 0, 1.5]) {
        const F = facade([x + dx, 32.32], [1, 0]);
        fbox(out, 'trim', F, -0.13, 0.13, 5.21, 21.89, -0.12, 0.16, stone);
      }
    }
  }
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);
const recipe = 'empress-hotel-model.mjs';
const camera = [129, 61, 151],
  lookAt = [-5, 14, -2];
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'historic-hotel',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'The Empress Hotel in Victoria, with its harbor-facing stone entrance, brick wings, steep copper roofs and domed turrets.',
  camera,
  lookAt,
  sunDirection: [31, 73, 62],
  mediumFiContext: {
    scale: 1.21,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: frame.geometry.outline,
    minimumCoverage: 0.86,
    basis: 'Named OSM relation 1371841 places the full hotel footprint.',
  },
  embeddedCanonicalGraphs: Object.values(surfaces).flatMap(({ graph }) => graph ?? []),
  recipeDependencies: ['place-recipe-kit.mjs', 'authored-structure-mesh.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'inner-harbour-front', position: camera, lookAt },
    { name: 'front-loggia-and-roof', position: [39, 18, 85], lookAt: [20, 15, 24] },
    { name: 'rear-wing-and-copper-roofs', position: [-93, 70, -107], lookAt: [-10, 17, -13] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'empress-hotel-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.71,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.3, surfaces },
      street: { export: 'street', errorMeters: 0.093, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.024, surfaces },
    },
  },
};
