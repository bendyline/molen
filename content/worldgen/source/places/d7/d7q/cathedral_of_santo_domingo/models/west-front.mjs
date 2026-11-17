/** Renaissance west frontage documented on the published March 1915 plate. */
import { loft } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  face,
  triangle,
} from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';
import { portalArch } from './north-portal.mjs';

const stone = rgb('b5a687');
const pale = rgb('cdbb98');
const old = rgb('978a71');
const timber = rgb('655241');
const iron = rgb('575447');
const recess = rgb('423a30');

function rect(out, slot, a, b, y0, y1, z, color) {
  face(
    out,
    slot,
    [
      [a, y0, z],
      [b, y0, z],
      [b, y1, z],
      [a, y1, z],
    ],
    color,
  );
}
function sill(out, x, y, width, height, depth, color = pale) {
  box(out, 'dress', [x - width / 2, y, -0.27], [x + width / 2, y + height, depth], color);
}
function door(out, x, floor, lod) {
  const width = 2.86,
    y = floor + 0.18,
    top = floor + 4.89;
  rect(out, 'shadow', x - width / 2, x + width / 2, y, top, -0.33, recess);
  if (lod === 0) return;
  sill(out, x, floor + 4.88, width + 0.42, 0.27, 0.29);
  for (const sign of [-1, 1])
    sill(out, x + sign * (width / 2 + 0.08), floor + 0.2, 0.27, 4.91, 0.18, old);
  rect(out, 'wood', x - width * 0.43, x + width * 0.43, y + 0.1, top - 0.12, -0.27, timber);
  if (lod > 1)
    for (const s of [-1, 1])
      for (const dy of [0.5, 2.69])
        rect(
          out,
          'shadow',
          x + s * 0.62 - 0.31,
          x + s * 0.62 + 0.31,
          y + dy,
          y + dy + 1.25,
          -0.252,
          recess,
        );
}
function grille(out, x, floor, lod) {
  const y0 = floor + 6.21,
    spring = floor + 7.64,
    width = 4.23;
  portalArch(
    out,
    { x, width, floor: y0, spring, rise: 1.73, top: floor + 10.23, z: 0.028, depth: 0.49 },
    lod,
  );
  if (lod < 1) return;
  const half = width / 2;
  const count = lod > 1 ? 7 : 3;
  for (let i = 0; i < count; i++) {
    const u = ((i + 1) / (count + 1)) * 2 - 1;
    const h = spring + 1.73 * Math.sqrt(1 - u * u) - 0.079;
    rect(out, 'iron', x + u * half - 0.024, x + u * half + 0.024, y0 + 0.09, h, -0.095, iron);
  }
  for (const y of [y0 + 0.62, y0 + 1.26])
    rect(out, 'iron', x - half + 0.09, x + half - 0.09, y - 0.022, y + 0.022, -0.081, iron);
}
function pilaster(out, x, floor, top, wide, lod) {
  sill(out, x, floor, wide + 0.28, 0.38, 0.38, old);
  sill(out, x, floor + 0.37, wide, top - floor - 0.75, 0.25);
  sill(out, x, top - 0.4, wide + 0.26, 0.4, 0.47);
  if (lod < 2) return;
  for (let j = 0; j < 7; j++) {
    const y = floor + 0.87 + ((top - floor - 1.75) * j) / 7;
    rect(out, 'stone', x - wide * 0.32, x + wide * 0.32, y, y + 0.27, 0.258, j % 2 ? pale : old);
  }
}
function pinnacle(out, x, base, lod) {
  const ring = (y, r) =>
    [
      [-1, -1],
      [-1, 1],
      [1, 1],
      [1, -1],
    ].map(([a, b]) => [x + a * r, y, 0.18 + b * r]);
  loft(
    out,
    'dress',
    [ring(base, 0.42), ring(base + 0.28, 0.42), ring(base + 0.35, 0.25), ring(base + 1.7, 0.25)],
    pale,
  );
  loft(out, 'roof', [ring(base + 1.7, 0.34), ring(base + 2.38, 0.037)], old);
  if (lod > 2) sill(out, x, base + 0.56, 0.27, 0.58, 0.445, old);
}
export function buildWestFront(out, spec, floor, wingHeight, lod) {
  const half = spec.facadeWidth / 2,
    full = spec.width / 2,
    roof = spec.gableTop;
  const y0 = floor + 0.12;
  const cornice = spec.corniceTop;
  const gableSpan = half - 0.7;
  rect(out, 'stone', -full, -half, floor - 0.28, wingHeight, 0, stone);
  rect(out, 'stone', half, full, floor - 0.28, wingHeight, 0, stone);
  if (lod === 0) {
    rect(out, 'stone', -half, half, floor, cornice, 0.022, stone);
    for (const x of [-2.39, 2.39])
      rect(out, 'shadow', x - 1.4, x + 1.4, y0, floor + 4.89, 0.08, recess);
  } else {
    const xDoor = 2.41;
    const a = xDoor - 1.43,
      b = xDoor + 1.43;
    for (const [left, right] of [
      [-half, -b],
      [-a, a],
      [b, half],
    ])
      rect(out, 'stone', left, right, floor - 0.16, floor + 5.18, 0.03, stone);
    rect(out, 'dress', -half, half, floor + 5.18, floor + 6.23, 0.02, pale);
    rect(out, 'stone', -half, -4.71, floor + 6.23, floor + 10.23, 0.03, stone);
    rect(out, 'stone', 4.71, half, floor + 6.23, floor + 10.23, 0.03, stone);
    rect(out, 'dress', -0.37, 0.37, floor + 6.23, floor + 10.23, 0.15, pale);
    rect(out, 'stone', -half, half, floor + 10.23, cornice, 0.034, stone);
    for (const side of [-1, 1]) {
      door(out, side * xDoor, floor, lod);
      grille(out, side * 2.43, floor, lod);
      pilaster(out, side * (half - 0.47), floor, cornice - 0.44, 0.76, lod);
      pilaster(out, side * 4.94, floor, floor + 10.72, 0.47, lod);
    }
    pilaster(out, 0, floor, floor + 8.94, 0.49, lod);
  }
  sill(out, 0, floor + 5.22, half * 2 + 0.29, 0.28, 0.4, old);
  sill(out, 0, cornice - 1.17, half * 2 + 0.16, 0.34, 0.18, old);
  sill(out, 0, cornice - 0.4, half * 2 + 0.65, 0.44, 0.46);
  triangle(
    out,
    'dress',
    [
      [-gableSpan, cornice, 0.058],
      [gableSpan, cornice, 0.058],
      [0, roof, 0.058],
    ],
    pale,
  );
  triangle(
    out,
    'stone',
    [
      [gableSpan, cornice, -0.78],
      [-gableSpan, cornice, -0.78],
      [0, roof, -0.78],
    ],
    stone,
  );
  for (const side of [-1, 1]) {
    const x = side * gableSpan;
    const rim = [
      [x, cornice, -0.78],
      [x, cornice, 0.058],
      [0, roof, 0.058],
      [0, roof, -0.78],
    ];
    face(out, 'dress', side > 0 ? rim : [...rim].reverse(), pale);
  }
  if (lod > 0) {
    for (const side of [-1, 1]) {
      const x = side * (half - 0.72);
      pinnacle(out, x, cornice - 0.09, lod);
      face(
        out,
        'dress',
        [
          [0, roof, 0.086],
          [x, cornice, 0.087],
          [x, cornice + 0.185, 0.091],
          [0, roof + 0.13, 0.092],
        ],
        old,
      );
    }
    portalArch(
      out,
      {
        x: 0,
        width: 2.07,
        floor: cornice + 0.3,
        spring: cornice + 1.05,
        rise: 0.96,
        top: cornice + 2.34,
        z: 0.117,
        depth: 0,
      },
      lod,
    );
    const h = cornice + 0.39;
    for (const x of [-0.55, -0.18, 0.19, 0.54])
      rect(
        out,
        'iron',
        x - 0.032,
        x + 0.032,
        h,
        cornice + (Math.abs(x) > 0.35 ? 1.74 : 1.99),
        0.121,
        iron,
      );
    sill(out, 0, roof, 0.4, 0.78, 0.198);
  }
  if (lod > 1) {
    const span = half * 1.77;
    for (let i = 0; i < 18; i++) {
      const x = ((i + 0.5) / 18 - 0.5) * span;
      const d = i % 2 ? 0.14 : 0.19,
        y = cornice - 0.61;
      face(
        out,
        'dress',
        [
          [x - d, y, 0.094],
          [x, y - 0.16, 0.17],
          [x + d, y, 0.094],
          [x, y + 0.18, 0.127],
        ],
        i % 3 ? stone : old,
      );
    }
    for (let i = 0; i < 3; i++)
      box(
        out,
        'dress',
        [-half - 0.13, floor - 0.57, 0.03 + i * 0.37],
        [half + 0.13, floor + 0.08 - i * 0.141, 0.4 + i * 0.37],
        old,
      );
  }
}
