import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  block,
  cap,
  closed,
  face,
  pairs,
  palette,
  pavilion,
  rect,
  surface,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';
import { lettering } from '../../../../../../../../packages/worldgen/scripts/stadium-lettering.mjs';

const surfaces = {
  stone: surface('wall', 'stone_granite', 0.91),
  sanded: surface('trim', 'stone_granite', 0.86),
};
const colors = palette({ stone: '8c8b80', nib: '9a9789', plate: '9f9c8f', text: '5a5b52' });
const letterStrokes = {
  U: [
    [
      [0, 1],
      [0, 0.17],
      [0.22, 0],
      [0.78, 0],
      [1, 0.17],
      [1, 1],
    ],
  ],
  Y: [
    [
      [0, 1],
      [0.5, 0.48],
      [1, 1],
    ],
    [
      [0.5, 0.48],
      [0.5, 0],
    ],
  ],
  1: [
    [
      [0.24, 0.73],
      [0.53, 1],
      [0.53, 0],
    ],
    [
      [0.22, 0],
      [0.82, 0],
    ],
  ],
  2: [
    [
      [0, 0.78],
      [0.18, 1],
      [0.83, 1],
      [1, 0.72],
      [0, 0],
      [1, 0],
    ],
  ],
  8: [
    [
      [0.24, 0.53],
      [0, 0.26],
      [0.15, 0],
      [0.85, 0],
      [1, 0.26],
      [0.76, 0.53],
      [0.24, 0.53],
      [0, 0.76],
      [0.15, 1],
      [0.85, 1],
      [1, 0.76],
      [0.76, 0.53],
    ],
  ],
  9: [
    [
      [0, 0.02],
      [0.64, 0],
      [1, 0.32],
      [1, 0.83],
      [0.82, 1],
      [0.18, 1],
      [0, 0.83],
      [0, 0.62],
      [0.18, 0.47],
      [1, 0.47],
    ],
  ],
  J: [
    [
      [0, 0.16],
      [0.22, 0],
      [0.72, 0],
      [1, 0.2],
      [1, 1],
    ],
  ],
  W: [
    [
      [0, 1],
      [0.19, 0],
      [0.5, 0.48],
      [0.81, 0],
      [1, 1],
    ],
  ],
  G: [
    [
      [1, 0.85],
      [0.77, 1],
      [0.21, 1],
      [0, 0.8],
      [0, 0.2],
      [0.21, 0],
      [0.84, 0],
      [1, 0.23],
      [1, 0.51],
      [0.56, 0.51],
    ],
  ],
};

function inscribedLine(out, text, width, height, baseline, z) {
  const stroke = height * 0.067;
  const encoded = [...text].map((c) => (c === 'O' ? '0' : letterStrokes[c] ? ' ' : c)).join('');
  lettering(out, encoded, {
    width,
    height,
    y: baseline,
    z,
    color: colors.text,
    slot: 'sanded',
    stroke,
  });
  const advance = width / text.length;
  for (const [i, c] of [...text].entries()) {
    for (const line of letterStrokes[c] ?? []) {
      const point = ([x, y]) => [
        (i - text.length / 2 + x * 0.75) * advance,
        baseline + y * height,
        z,
      ];
      for (const [a, b] of pairs(line))
        beam(out, 'sanded', point(a), point(b), stroke, stroke, colors.text);
    }
  }
}

function splayedCap(out, width, depth, floor) {
  const bottom = rect(-width / 2 - 0.04, -depth / 2 - 0.04, width / 2 + 0.04, depth / 2 + 0.04);
  const top = rect(-width / 2 + 0.15, -depth / 2 + 0.064, width / 2 - 0.15, depth / 2 - 0.064);
  for (const [i, [a, b]] of pairs(closed(bottom)).entries()) {
    const c = top[(i + 1) % top.length];
    const d = top[i];
    face(
      out,
      'sanded',
      [
        [a[0], floor, a[1]],
        [b[0], floor, b[1]],
        [c[0], floor + 0.2, c[1]],
        [d[0], floor + 0.2, d[1]],
      ],
      [0, 1, 0],
      colors.nib,
    );
  }
  cap(out, 'sanded', top, floor + 0.2, colors.nib);
}

function draw(out, lod, { floor, width, height, depth, baseDepth }, grade) {
  const bed = Math.min(grade([-width * 0.55, 0]), grade([width * 0.55, 0]), floor - 0.45) - 0.22;
  block(
    out,
    'stone',
    -width / 2 - 0.27,
    bed,
    -baseDepth / 2,
    width + 0.54,
    floor - bed,
    baseDepth,
    colors.stone,
  );
  block(
    out,
    'sanded',
    -width / 2 - 0.19,
    floor - 0.025,
    -baseDepth / 2 + 0.067,
    width + 0.38,
    0.15,
    baseDepth - 0.134,
    colors.nib,
  );
  block(
    out,
    'stone',
    -width / 2 - 0.12,
    floor + 0.125,
    -depth / 2 - 0.12,
    width + 0.24,
    0.17,
    depth + 0.24,
    colors.stone,
  );
  block(
    out,
    'sanded',
    -width / 2 - 0.17,
    floor + 0.288,
    -depth / 2 - 0.146,
    width + 0.34,
    0.065,
    depth + 0.292,
    colors.nib,
  );
  const base = floor + 0.35;
  const top = floor + height;
  const back = -depth / 2;
  const front = depth / 2;
  const inset = 0.027;
  block(out, 'stone', -width / 2, base, back, width, top - base, depth - inset, colors.plate);
  const border = 0.13;
  for (const x of [-width / 2, width / 2 - border])
    block(out, 'sanded', x, base, front - inset, border, top - base, inset, colors.nib);
  for (const y of [base, top - border])
    block(
      out,
      'sanded',
      -width / 2 + border,
      y,
      front - inset,
      width - 2 * border,
      border,
      inset,
      colors.nib,
    );
  splayedCap(out, width, depth, top);
  if (lod === 0) return;
  const z = front - inset + 0.004;
  inscribedLine(out, 'TAI TAM TUK RESERVOIR', 2.18, 0.098, base + 0.39, z);
  if (lod > 1) inscribedLine(out, '2 FEBRUARY 1918', 1.64, 0.083, base + 0.57, z);
  if (lod > 2) {
    inscribedLine(out, 'SIR HENRY MAY', 1.59, 0.091, base + 0.74, z);
    inscribedLine(out, 'D JAFFE   W CHATHAM   SANG LEE', 2.48, 0.058, base + 0.2, z);
  }
}

const stone = pavilion(
  import.meta.url,
  {
    surfaces,
    camera: [3.5, 2.8, 6.1],
    lookAt: [0, 1.08, 0],
    yaw: -0.31,
    brief:
      'The 1918 Tai Tam Tuk Reservoir Memorial Stone with a stepped granite base, splayed cap and inset dedication.',
    views: [
      { name: 'recessed-reservoir-dedication', position: [0.82, 2, 3.8], lookAt: [0, 1.2, 0.24] },
      { name: 'moulded-base-and-splayed-cap', position: [-2.8, 2.7, 3.3], lookAt: [0, 1, 0] },
      {
        name: 'roadside-stone-and-survey-grade',
        position: [3.3, 3.9, 5.6],
        lookAt: [0.1, 0.8, 0.25],
      },
    ],
  },
  draw,
);
export const { model, skyline, district, street, closeup } = stone;
model.category = 'monument';
model.mediumFiContext.scale = 0.095;
model.recipeDependencies.push('authored-structure-mesh.mjs', 'stadium-lettering.mjs');
model.sourceLicense =
  'Independent reconstruction from the Hong Kong heritage boundary, original terrain and documented 1918 inscription.';
