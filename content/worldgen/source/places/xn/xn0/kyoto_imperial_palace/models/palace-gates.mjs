/** Gate frames and characteristic sweeping roofs of the Kyoto palace enclosure. */
import { beamPath } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  face,
  transform,
  triangle,
} from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const color = {
  timber: rgb('543e30'),
  red: rgb('b84632'),
  darkRed: rgb('8e392e'),
  woodEdge: rgb('765d46'),
  bark: rgb('514239'),
  tile: rgb('646c71'),
  collar: rgb('c5a15b'),
  white: rgb('e0d2b6'),
  stone: rgb('a49b86'),
  recess: rgb('514234'),
};
const mix = (a, b, t) => a + (b - a) * t;

function sweptGable(out, width, depth, eaves, height, red, lod) {
  const slot = red ? 'tile' : 'bark';
  const tint = red ? color.tile : color.bark;
  const profile =
    lod === 0
      ? [
          [-1, 0],
          [0, 1],
          [1, 0],
        ]
      : [
          [-1, 0],
          [-0.72, 0.1],
          [-0.44, 0.31],
          [-0.2, 0.64],
          [0, 1],
          [0.2, 0.64],
          [0.44, 0.31],
          [0.72, 0.1],
          [1, 0],
        ];
  const pt = ([d, h], side) => [
    side * width * (0.5 - h * 0.035),
    eaves + height * h,
    (d * depth) / 2,
  ];
  for (let i = 1; i < profile.length; i++) {
    const a = profile[i - 1],
      b = profile[i];
    face(out, slot, [pt(a, -1), pt(b, -1), pt(b, 1), pt(a, 1)], tint);
    for (const side of [-1, 1]) {
      const p = pt(a, side),
        q = pt(b, side);
      const center = [side * width * 0.466, eaves - 0.06, 0];
      const tri = [p, q, center];
      triangle(out, 'timber', side < 0 ? tri.reverse() : tri, red ? color.darkRed : color.timber);
    }
  }
  if (lod === 0) return;
  const ends = width * 0.48;
  beamPath(
    out,
    slot,
    [
      [-ends, eaves + height + 0.14, 0],
      [-ends + 0.45, eaves + height, 0],
      [ends - 0.45, eaves + height, 0],
      [ends, eaves + height + 0.14, 0],
    ],
    0.19,
    0.17,
    tint,
  );
  if (lod > 2)
    for (const side of [-1, 1]) {
      beamPath(
        out,
        slot,
        profile.map((p) => pt(p, side)),
        0.17,
        0.18,
        tint,
      );
      beamPath(
        out,
        'timber',
        profile.map((p) => {
          const [x, y, z] = pt(p, side);
          return [x * 0.996, y - 0.19, z];
        }),
        0.13,
        0.14,
        red ? color.darkRed : color.woodEdge,
      );
    }
}

function facadeGable(out, width, z, eave, wood, lod) {
  const w = width * 0.49;
  const n = lod === 3 ? 19 : 6;
  box(out, 'timber', [-w, eave - 0.5, z - 0.28], [w, eave - 0.18, z + 0.29], wood);
  for (let i = 0; i < n; i++) {
    const x = mix(-w + 0.11, w - 0.11, (i + 0.5) / n);
    box(
      out,
      'timber',
      [x - 0.051, eave - 0.31, z - 0.36],
      [x + 0.051, eave - 0.095, z + 0.38],
      wood,
    );
    if (lod > 2)
      box(
        out,
        'metal',
        [x - 0.075, eave - 0.24, z - 0.39],
        [x + 0.075, eave - 0.1, z + 0.41],
        color.collar,
      );
  }
}

function closedGate(out, post, d, grade, red, height, lod) {
  const z = 0;
  box(
    out,
    'timber',
    [-post, grade + 0.29, z - 0.15],
    [post, grade + height * 0.64, z + 0.15],
    red ? color.darkRed : color.recess,
  );
  if (lod < 3) return;
  for (let i = -5; i <= 5; i++) {
    const x = (i * post) / 5.5;
    box(
      out,
      'timber',
      [x - 0.035, grade + 0.32, d - 0.21],
      [x + 0.035, grade + height * 0.51, d - 0.08],
      red ? color.red : color.woodEdge,
    );
  }
}

export function buildPalaceGate(out, gate, lod) {
  const { center, heading, floor, width, depth, eaves, rise, red, open } = gate;
  const wood = red ? color.red : color.timber;
  const r = transform(out, heading, [center[0], floor, center[1]]);
  const halfW = width / 2,
    halfD = depth / 2;
  const post = halfW * 0.55,
    d = halfD * 0.52;
  const y = 0.26;
  if (lod < 2) {
    box(r, 'timber', [-post - 0.33, -0.38, -d], [-post + 0.25, eaves, d], wood);
    box(r, 'timber', [post - 0.25, -0.38, -d], [post + 0.33, eaves, d], wood);
    if (lod === 1)
      box(
        r,
        'stone',
        [-halfW * 0.82, -0.62, -halfD * 0.82],
        [halfW * 0.82, y, halfD * 0.82],
        color.stone,
      );
    sweptGable(r, width, depth, eaves, rise, red, 0);
    return;
  }
  box(
    r,
    'stone',
    [-halfW * 0.82, -0.81, -halfD * 0.82],
    [halfW * 0.82, y, halfD * 0.82],
    color.stone,
  );
  for (const x of [-post, post])
    for (const z of [-d, d]) {
      const w = red ? 0.32 : 0.3;
      box(
        r,
        'stone',
        [x - w - 0.19, y - 0.02, z - w - 0.19],
        [x + w + 0.19, y + 0.19, z + w + 0.19],
        color.stone,
      );
      box(r, 'timber', [x - w, y + 0.11, z - w], [x + w, eaves - 0.09, z + w], wood);
      if (lod > 2)
        box(
          r,
          'metal',
          [x - w - 0.04, eaves - 1.02, z - w - 0.04],
          [x + w + 0.04, eaves - 0.87, z + w + 0.04],
          red ? color.collar : color.woodEdge,
        );
    }
  const fringe = halfD * 0.92;
  box(
    r,
    'timber',
    [-halfW * 0.88, eaves - 0.47, -fringe],
    [halfW * 0.88, eaves - 0.07, fringe],
    wood,
  );
  if (lod > 2) for (const z of [-fringe, fringe]) facadeGable(r, width, z, eaves, wood, lod);
  const threshold = y + 0.11;
  if (open) {
    for (const s of [-1, 1])
      box(
        r,
        'timber',
        [s * post - 0.09, threshold, -0.37],
        [s * post + 0.09, eaves - 0.83, d * 0.96],
        wood,
      );
  } else {
    closedGate(r, post, d, threshold, red, eaves, lod);
  }
  if (red) {
    for (const s of [-1, 1]) {
      const x = s * halfW * 0.81;
      box(
        r,
        'plaster',
        [x - halfW * 0.145, y, -0.34],
        [x + halfW * 0.145, eaves - 0.51, 0.34],
        color.white,
      );
    }
  }
  sweptGable(r, width, depth, eaves, rise, red, lod);
}
