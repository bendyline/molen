/** Cream entrance booths with terracotta trim and the separate memorial court. */
import {
  face,
  transform,
  triangle,
} from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const palette = {
  cream: rgb('d8c197'),
  oxide: rgb('9d513d'),
  red: rgb('a84633'),
  underline: rgb('ad7757'),
  frame: rgb('685848'),
  glass: rgb('4d6569'),
  paved: rgb('aaa291'),
  stone: rgb('c5c3b3'),
  dark: rgb('575f60'),
  plaque: rgb('aaaba0'),
  memorial: rgb('556a7e'),
  steel: rgb('879b9b'),
};
const mix = (a, b, t) => a + (b - a) * t;

function fixedJet(out, x, y, z, lod) {
  const mount = transform(out, -0.32, [x, y, z]);
  box(mount, 'trim', [-0.07, -0.39, -0.09], [0.07, 0.39, 0.09], palette.frame);
  const geometry = [
    [
      [0, 0.24, -1.13],
      [-1.22, 0, 0.67],
      [0, 0.2, 0.44],
    ],
    [
      [0, 0.24, -1.13],
      [0, 0.2, 0.44],
      [1.22, 0, 0.67],
    ],
    [
      [0, 0.52, -0.15],
      [0, 0.21, 0.75],
      [0, 0.21, 0.2],
    ],
  ];
  for (const f of geometry) {
    triangle(mount, 'trim', f, palette.steel);
    triangle(mount, 'trim', f.toReversed(), palette.steel);
  }
  if (lod > 2) box(mount, 'trim', [-0.38, 0.07, 0.32], [0.38, 0.16, 0.63], palette.dark);
}

export function buildPublicEntrance(
  out,
  { center, heading, floor, width, depth, wallHeight },
  lod,
) {
  const r = transform(out, heading, [center[0], floor, center[1]]);
  const w = width / 2,
    d = depth / 2;
  const post = w * 0.6;
  const e = wallHeight;
  box(r, 'stone', [-w - 0.76, -0.95, -d - 1.93], [w + 0.76, 0.08, d + 1.93], palette.paved);
  for (const s of [-1, 1]) {
    const x = s * w * 0.84;
    box(r, 'wall', [x - 1.99, 0, -d], [x + 1.99, e - 0.44, d], palette.cream);
    box(r, 'trim', [x - 2.11, e - 0.67, -d - 0.14], [x + 2.11, e - 0.36, d + 0.14], palette.oxide);
    box(r, 'trim', [x - 1.98, -0.02, -d - 0.04], [x + 1.98, 0.35, d + 0.04], palette.red);
    for (const direction of [-1, 1]) {
      const z = direction * d;
      box(r, 'trim', [x - 0.85, 1.46, z - 0.049], [x + 0.85, 2.93, z + 0.049], palette.glass);
      if (lod > 1)
        box(r, 'trim', [x - 0.034, 1.52, z - 0.078], [x + 0.034, 2.85, z + 0.078], palette.frame);
    }
  }
  for (const t of [-1, -0.36, 0.36, 1]) {
    const x = t * post;
    box(r, 'wall', [x - 0.19, 0.08, -0.84], [x + 0.19, e - 0.51, 0.86], palette.cream);
  }
  box(r, 'wall', [-post - 0.25, e - 1.12, -1.02], [post + 0.25, e - 0.25, 1.04], palette.cream);
  box(r, 'trim', [-w - 0.12, e - 0.31, -d - 0.05], [w + 0.12, e - 0.12, d + 0.08], palette.oxide);
  box(
    r,
    'wall',
    [-w - 0.16, e - 0.11, -d - 0.13],
    [w + 0.16, e + 0.15, d + 0.15],
    palette.underline,
  );
  if (lod > 0) {
    for (const x of [-post * 0.67, post * 0.67]) {
      box(r, 'trim', [x - 2.08, 0.56, -0.92], [x + 2.08, 0.68, -0.86], palette.oxide);
      box(r, 'trim', [x - 2.08, 2.29, -0.92], [x + 2.08, 2.41, -0.86], palette.oxide);
      const count = lod > 1 ? 14 : 7;
      for (let i = 0; i < count; i++) {
        const a = x + mix(-2.04, 2.04, i / (count - 1));
        box(r, 'trim', [a - 0.034, 0.32, -0.96], [a + 0.034, 2.72, -0.82], palette.red);
      }
    }
    fixedJet(r, -2.61, e + 0.48, -0.13, lod);
    fixedJet(r, 2.61, e + 0.5, -0.13, lod);
  }
}

export function buildMartyrsMonument(out, { center, heading, floor, width, depth, crown }, lod) {
  const r = transform(out, heading, [center[0], floor, center[1]]);
  const edge = width / 2;
  const n = [6, 11, 19, 25][lod];
  const front = (x) => -depth * 0.33 + depth * 0.31 * (x / edge) * (x / edge);
  for (let i = 0; i < n; i++) {
    const a = mix(-edge, edge, i / n),
      b = mix(-edge, edge, (i + 1) / n);
    const z = front(a),
      q = front(b);
    const y = 4.65 - (Math.abs(a + b) / (edge * 2)) * 0.21;
    const ground = [a, 0.29, z],
      p = [b, 0.29, q],
      cap = [a, y, z],
      e = [b, y, q];
    face(r, 'wall', [p, ground, cap, e], palette.stone);
    face(
      r,
      'wall',
      [
        [a, 0.23, z + 0.78],
        [b, 0.23, q + 0.78],
        [b, y, q + 0.78],
        [a, y, z + 0.78],
      ],
      palette.stone,
    );
    face(r, 'stone', [cap, [a, y, z + 0.78], [b, y, q + 0.78], e], palette.stone);
    if (lod > 0 && Math.abs(a + b) > 4.5) {
      const x = (a + b) / 2;
      const off = (left, right, low, high) =>
        face(
          r,
          'trim',
          [
            [right, low, front(right) - 0.052],
            [left, low, front(left) - 0.052],
            [left, high, front(left) - 0.052],
            [right, high, front(right) - 0.052],
          ],
          palette.plaque,
        );
      for (const slot of [1.08, 2.62]) off(x - (b - a) * 0.4, x + (b - a) * 0.4, slot, slot + 0.95);
    }
  }
  for (const x of [-edge, edge])
    box(
      r,
      'stone',
      [x - 0.22, -0.34, front(x) - 0.14],
      [x + 0.22, 4.68, front(x) + 0.93],
      palette.stone,
    );
  box(
    r,
    'stone',
    [-edge - 1.13, -1.04, -depth * 0.58],
    [edge + 1.13, 0.29, depth * 0.63],
    palette.paved,
  );
  box(r, 'stone', [-3.5, 0.28, -depth * 0.48], [3.5, 1.0, depth * 0.3], palette.dark);
  const low = 1.0,
    broad = 2.57,
    slim = 2.02,
    z = -depth * 0.36;
  box(r, 'trim', [-broad, low, z], [broad, crown - 2.04, z + 1.3], palette.memorial);
  box(r, 'trim', [-slim, crown - 2.05, z + 0.12], [slim, crown - 0.7, z + 1.22], palette.memorial);
  triangle(
    r,
    'trim',
    [
      [slim, crown - 0.7, z + 0.12],
      [-slim, crown - 0.7, z + 0.12],
      [0, crown, z + 0.12],
    ],
    palette.memorial,
  );
  triangle(
    r,
    'trim',
    [
      [-slim, crown - 0.7, z + 1.22],
      [slim, crown - 0.7, z + 1.22],
      [0, crown, z + 1.22],
    ],
    palette.memorial,
  );
  if (lod > 1) {
    box(r, 'trim', [-1.42, 3.15, z - 0.05], [1.42, crown - 2.56, z + 0.08], palette.dark);
    const n = lod > 2 ? 9 : 5;
    for (let i = 0; i < n; i++) {
      const y = mix(3.5, crown - 2.79, i / (n - 1));
      box(r, 'trim', [-1.16, y, z - 0.078], [1.16, y + 0.045, z - 0.044], palette.plaque);
    }
  }
}
