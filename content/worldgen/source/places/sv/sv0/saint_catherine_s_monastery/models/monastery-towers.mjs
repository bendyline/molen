/** The open, stepped campanile and the separate square, whitewashed minaret. */
import {
  loft,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  face,
  transform,
} from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const carved = rgb('d0b597');
const ochre = rgb('b7966f');
const white = rgb('e2d4af');
const pale = rgb('c8bc9f');
const dark = rgb('625448');
const brown = rgb('685140');
const grey = rgb('a99b80');

function cap(out, horizontal, y, rise, slot, color, lod) {
  const sides = [6, 10, 14, 20][lod];
  const profile = [
    [0, 1],
    [0.22, 0.97],
    [0.55, 0.82],
    [0.83, 0.51],
    [0.97, 0.18],
    [1, 0.045],
  ];
  const rings = (lod === 0 ? [profile[0], profile[2], profile[4], profile[5]] : profile).map(
    ([h, r]) => radialRing(y + rise * h, horizontal * r, horizontal * r, sides),
  );
  loft(out, slot, rings, color);
}

function collar(out, half, y, thickness, color) {
  box(out, 'dress', [-half, y, -half], [half, y + thickness, half], color);
}

function openArches(out, half, floor, stage, lod) {
  const z = half,
    line = floor + stage * 0.58,
    rise = stage * 0.25;
  const opening = half * [0, 0.46, 0.62, 0.62][lod];
  const divisions = [0, 4, 6, 9][lod];
  const support = half * 0.19;
  for (const angle of [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2]) {
    const front = transform(out, angle);
    const right = (x) => [x, line, z];
    for (const x of [-half, half - support])
      box(front, 'dress', [x, floor, z - 0.28], [x + support, line + rise, z], carved);
    for (const center of [-half * 0.405, half * 0.405]) {
      const radius = Math.min(opening / 2, half * 0.36);
      const a = center - radius,
        b = center + radius;
      const y0 = floor + stage * 0.11;
      const top = floor + stage - 0.12;
      const at = (x) => [
        x,
        line + Math.sqrt(Math.max(0, 1 - Math.pow((x - center) / radius, 2))) * rise,
        z,
      ];
      box(front, 'dress', [a - 0.11, y0, z - 0.16], [a, line, z + 0.045], ochre);
      box(front, 'dress', [b, y0, z - 0.16], [b + 0.11, line, z + 0.045], ochre);
      for (let k = 0; k < divisions; k++) {
        const u = a + ((b - a) * k) / divisions,
          v = a + ((b - a) * (k + 1)) / divisions;
        const p = at(u),
          q = at(v);
        face(front, 'dress', [p, q, [v, top, z], [u, top, z]], carved);
        if (lod > 1)
          face(front, 'dress', [q, p, [p[0], p[1], z - 0.18], [q[0], q[1], z - 0.18]], ochre);
      }
    }
    box(
      front,
      'dress',
      [-half * 0.08, floor, z - 0.22],
      [half * 0.08, floor + stage - 0.23, z],
      ochre,
    );
    face(
      front,
      'dress',
      [
        right(-half + support),
        right(-half + support * 1.6),
        [-half + support * 1.6, floor + stage - 0.12, z],
        [-half + support, floor + stage - 0.12, z],
      ],
      carved,
    );
    face(
      front,
      'dress',
      [
        right(half - support * 1.6),
        right(half - support),
        [half - support, floor + stage - 0.12, z],
        [half - support * 1.6, floor + stage - 0.12, z],
      ],
      carved,
    );
  }
}

export function buildCampanile(out, { width, floor, plinthRise, stageHeights, domeRise }, lod) {
  let half = width / 2;
  box(out, 'granite', [-half, floor - 2.11, -half], [half, floor + plinthRise, half], ochre);
  let level = floor + plinthRise;
  for (const [stage, h] of stageHeights.entries()) {
    const molding = [0.28, 0.25, 0.28][stage];
    collar(out, half + 0.19, level - molding, molding, carved);
    if (lod === 0 || stage === 0) {
      box(out, 'dress', [-half, level, -half], [half, level + h - 0.1, half], carved);
      if (lod === 0)
        box(
          out,
          'timber',
          [-half * 0.54, level + 0.41, half - 0.01],
          [half * 0.54, level + h - 0.43, half + 0.05],
          dark,
        );
    } else {
      openArches(out, half, level, h, lod);
    }
    if (lod > 1) collar(out, half + 0.025, level + 0.1, 0.12, ochre);
    level += h;
    half *= 0.92;
  }
  collar(out, half + 0.38, level - 0.3, 0.37, carved);
  collar(out, half + 0.16, level + 0.065, 0.12, ochre);
  cap(out, half * 0.75, level + 0.17, domeRise, 'dress', pale, lod);
  const tip = level + domeRise + 0.17;
  box(out, 'timber', [-0.051, tip - 0.01, -0.055], [0.051, tip + 0.61, 0.055], brown);
  if (lod > 0) box(out, 'timber', [-0.235, tip + 0.3, -0.05], [0.235, tip + 0.39, 0.05], brown);
}

export function buildMinaret(out, { width, floor, shaftTop, crown }, lod) {
  const w = width / 2;
  const balcony = shaftTop - 1.94;
  box(out, 'plaster', [-w, floor - 1.8, -w], [w, balcony, w], white);
  box(
    out,
    'dress',
    [-w - 0.28, balcony - 0.63, -w - 0.28],
    [w + 0.28, balcony - 0.39, w + 0.28],
    grey,
  );
  box(
    out,
    'dress',
    [-w - 0.45, balcony - 0.29, -w - 0.45],
    [w + 0.45, balcony - 0.06, w + 0.45],
    pale,
  );
  box(out, 'plaster', [-w * 0.75, balcony, -w * 0.75], [w * 0.75, shaftTop, w * 0.75], white);
  collar(out, w * 0.83, shaftTop - 0.1, 0.2, pale);
  cap(out, w * 0.73, shaftTop + 0.1, crown - shaftTop - 0.1, 'plaster', white, lod);
  if (lod > 0)
    for (const angle of [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2]) {
      const front = transform(out, angle);
      box(
        front,
        'timber',
        [-0.21, balcony + 0.23, w * 0.75],
        [0.21, shaftTop - 0.48, w * 0.75 + 0.045],
        dark,
      );
      const half = w + 0.38;
      box(
        front,
        'timber',
        [-half, balcony + 0.72, half - 0.035],
        [half, balcony + 0.79, half + 0.035],
        brown,
      );
      const n = lod > 1 ? 8 : 4;
      for (let i = 0; i < n; i++) {
        const x = -half + (2 * half * (i + 0.34)) / n;
        box(
          front,
          'timber',
          [x - 0.033, balcony - 0.075, half - 0.034],
          [x + 0.033, balcony + 0.76, half + 0.034],
          brown,
        );
      }
    }
  box(out, 'timber', [-0.031, crown - 0.04, -0.031], [0.031, crown + 0.42, 0.031], grey);
}

export function galleryCupola(out, radius, height, rise, lod) {
  cap(out, radius, height, rise, 'dress', ochre, lod);
}
