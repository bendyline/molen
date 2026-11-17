/** Open visitor facade and shallow ridge of the archive gallery. */
import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  face,
  transform,
  triangle,
} from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const tone = {
  cream: rgb('d0ba8b'),
  interior: rgb('d8d2ba'),
  roof: rgb('9a9993'),
  edge: rgb('a4875c'),
  slab: rgb('aa9c80'),
  glass: rgb('7a9ca3'),
  gold: rgb('c39a5b'),
  frame: rgb('a29478'),
  shadow: rgb('4e605e'),
  banner: rgb('315e73'),
};
const mix = (a, b, t) => a + (b - a) * t;

export function shallowGalleryRoof(out, { width, depth, eave, ridge }, lod) {
  const w = width / 2,
    d = depth / 2;
  const near = -d,
    far = d;
  const a = [-w, eave, near],
    b = [w, eave, near],
    c = [-w, eave, far],
    e = [w, eave, far];
  const p = [0, ridge, near],
    q = [0, ridge, far];
  face(out, 'roof', [a, c, q, p], tone.roof);
  face(out, 'roof', [p, q, e, b], tone.roof);
  if (lod > 0)
    box(out, 'trim', [-0.045, ridge - 0.035, near], [0.045, ridge + 0.075, far], tone.edge);
}

function solidStair(out, x, floor, length, level, direction, lod) {
  const count = lod === 2 ? 6 : 12;
  const step = length / count;
  for (let i = 0; i < count; i++) {
    const frac = (i + 1) / count;
    box(
      out,
      'stone',
      [x - 1.17, floor - 0.08, i * step],
      [x + 1.17, floor + level * frac, (i + 1) * step + 0.005],
      tone.slab,
    );
  }
  if (lod > 1)
    for (const s of [-1, 1]) {
      const side = x + 1.1 * s;
      beam(
        out,
        'trim',
        [side, floor + 0.84, 0],
        [side, floor + level + 0.84, length],
        0.075,
        0.09,
        tone.frame,
      );
      for (let i = 0; i <= 4; i++) {
        const t = i / 4;
        box(
          out,
          'trim',
          [side - 0.034, floor + level * t, length * t - 0.04],
          [side + 0.034, floor + level * t + 0.84, length * t + 0.04],
          direction < 0 ? tone.frame : tone.edge,
        );
      }
    }
}

function portal(out, eaves, lod) {
  const z = 2.54;
  const width = 3.63,
    y = 4.02;
  const door = 2.8;
  for (const s of [-1, 1]) {
    const x = s * door;
    box(out, 'stone', [x - 0.32, 0.04, z - 0.25], [x + 0.32, y, z + 0.26], tone.gold);
    if (lod > 1)
      box(out, 'trim', [x - 0.41, y - 0.18, z - 0.33], [x + 0.41, y + 0.08, z + 0.31], tone.edge);
  }
  box(out, 'wall', [-width, y - 0.06, z - 0.29], [width, y + 0.19, z + 0.43], tone.cream);
  triangle(
    out,
    'wall',
    [
      [width, y + 0.17, z - 0.29],
      [-width, y + 0.17, z - 0.29],
      [0, y + 1.12, z - 0.29],
    ],
    tone.cream,
  );
  for (const side of [-1, 1])
    box(
      out,
      'glazing',
      [side * door * 0.538 - 1.37, 0.23, z - 0.06],
      [side * door * 0.538 + 1.37, y - 0.14, z + 0.007],
      tone.glass,
    );
  box(out, 'trim', [-0.043, 0.16, z - 0.105], [0.043, y - 0.11, z + 0.021], tone.frame);
  box(
    out,
    'wall',
    [-width, eaves - 0.73, z + 0.03],
    [width, eaves - 0.47, z + 0.39],
    tone.interior,
  );
}

function glazedFront(out, half, base, span, lod) {
  const z = 0.03;
  const peak = (x) => base + span * (1 - Math.abs(x) / half);
  if (lod === 0) {
    triangle(
      out,
      'glazing',
      [
        [half, base, z],
        [-half, base, z],
        [0, peak(0), z],
      ],
      tone.shadow,
    );
    return;
  }
  const lines = lod === 1 ? 10 : lod === 2 ? 18 : 24;
  for (let i = 0; i < lines; i++) {
    const a = mix(-half, half, i / lines),
      b = mix(-half, half, (i + 1) / lines);
    const p = [a, peak(a), z],
      q = [b, peak(b), z];
    if (i === 0) triangle(out, 'glazing', [[b, base, z], [a, base, z], q], tone.glass);
    else if (i === lines - 1) triangle(out, 'glazing', [[b, base, z], [a, base, z], p], tone.glass);
    else face(out, 'glazing', [[b, base, z], [a, base, z], p, q], tone.glass);
    if (i > 0)
      box(
        out,
        'trim',
        [a - 0.035, base - 0.04, z - 0.085],
        [a + 0.035, peak(a) + 0.045, z + 0.028],
        tone.frame,
      );
  }
  for (const y of [0.42, 0.73]) {
    const w = half * (1 - y);
    box(
      out,
      'trim',
      [-w, base + y * span - 0.045, z - 0.08],
      [w, base + y * span + 0.037, z + 0.03],
      tone.frame,
    );
  }
  if (lod > 1)
    box(out, 'trim', [-0.54, base + 0.65, z - 0.15], [0.54, base + 1.73, z - 0.06], tone.banner);
}

export function buildArchiveFront(out, controls, lod) {
  const { frontCenter, frontWidth, floor, eave, ridge, entryCanopyDepth, glazedHeaderBottom } =
    controls;
  const r = transform(out, 0, [frontCenter[0], floor, frontCenter[1]]);
  const half = frontWidth / 2;
  const bridge = entryCanopyDepth;
  box(r, 'stone', [-half - 0.22, -1.33, -bridge - 0.49], [half + 0.22, 0.09, 6.1], tone.slab);
  box(r, 'roof', [-half - 0.46, eave - 0.34, -bridge], [half + 0.46, eave - 0.08, 1.45], tone.roof);
  box(
    r,
    'trim',
    [-half - 0.41, eave - 0.37, -bridge - 0.095],
    [half + 0.41, eave - 0.14, -bridge + 0.17],
    tone.edge,
  );
  for (const side of [-1, 1]) {
    const x = side * (half - 0.44);
    box(
      r,
      'wall',
      [x - 0.41, 0.09, -bridge + 0.31],
      [x + 0.41, eave - 0.18, -bridge + 1.06],
      tone.cream,
    );
    box(r, 'wall', [x - 0.45, 0.09, -0.15], [x + 0.45, eave - 0.06, 4.7], tone.cream);
    if (lod > 0) {
      const z = 0.12;
      box(r, 'trim', [x - 0.61, 0.45, z - 0.12], [x + 0.61, eave - 0.59, z + 0.01], tone.gold);
      const a = side * 7.0,
        b = side * (half - 0.91);
      face(
        r,
        'glazing',
        [
          [Math.max(a, b), 0.07, z],
          [Math.min(a, b), 0.07, z],
          [Math.min(a, b), eave - 0.43, z],
          [Math.max(a, b), eave - 0.43, z],
        ],
        tone.glass,
      );
    }
    if (lod > 1) {
      const wing = transform(r, (side * Math.PI) / 2, [side * 7.42, 0, 1.28]);
      solidStair(wing, 0, 0.14, 7.04, eave * 0.54, side, lod);
      box(
        r,
        'stone',
        [Math.min(side * 7, side * (half - 0.66)), eave * 0.51, 1.81],
        [Math.max(side * 7, side * (half - 0.66)), eave * 0.55, 6.1],
        tone.interior,
      );
    }
  }
  box(r, 'wall', [-half + 0.21, 0.1, 5.96], [half - 0.21, eave - 0.08, 6.26], tone.interior);
  if (lod > 0) portal(r, eave, lod);
  glazedFront(r, half, glazedHeaderBottom, ridge - glazedHeaderBottom, lod);
}
