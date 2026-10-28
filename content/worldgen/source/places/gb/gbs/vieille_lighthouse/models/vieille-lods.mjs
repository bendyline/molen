/** Complete source-local distant levels; the detailed exterior master stays unchanged. */
import {
  beam,
  loft,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  face,
  transform,
} from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import {
  ring,
  shell,
} from '../../../../../../../../packages/worldgen/scripts/lighthouse-expansion-models.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const stone = [0.43, 0.415, 0.345],
  trim = [0.59, 0.58, 0.5],
  iron = [0.12, 0.145, 0.135],
  glass = [0.16, 0.23, 0.25];
const square = (y, r) => [
  [-r, y, -r],
  [-r, y, r],
  [r, y, r],
  [r, y, -r],
];
const profile = (out, slot, rows, color, n) =>
  loft(
    out,
    slot,
    rows.map(([y, r]) => radialRing(y, r, r, n)),
    color,
  );
const radius = (y) => 3.217 + ((2.77 - 3.217) * (y - 3.7)) / 16.5;
function card(out, x, y, w, h, z, color, slot = 'glass') {
  face(
    out,
    slot,
    [
      [x - w / 2, y, z],
      [x + w / 2, y, z],
      [x + w / 2, y + h, z],
      [x - w / 2, y + h, z],
    ],
    color,
  );
}
function envelope(out, district) {
  const n = district ? 16 : 8;
  loft(
    out,
    'granite',
    [square(0, 4.1), square(0.5, 4.1), square(3.3, 3.36), square(3.7, 3.28)],
    [0.36, 0.37, 0.32],
  );
  loft(out, 'ashlar', [square(3.7, 3.217), square(20.2, 2.77)], stone);
  for (const side of [0, 1, 3]) {
    const f = transform(out, (side * Math.PI) / 2);
    for (const y of [4.55, 8.6, 12.65, 16.7]) {
      const z = radius(y) + 0.01;
      card(f, 0, y, 0.54, 1.15, z, glass);
      if (district) {
        for (const x of [-0.325, 0.325])
          card(f, x, y - 0.08, 0.11, 1.31, z + 0.01, trim, 'granite');
        for (const yy of [y - 0.08, y + 1.15])
          card(f, 0, yy, 0.76, 0.11, z + 0.01, trim, 'granite');
      }
    }
  }
  const turret = transform(out, 0, [0, 0, -2.48]);
  if (district)
    shell(turret, {
      profile: [
        [3.3, 1.51],
        [20.2, 1.24],
      ],
      holes: [
        { angle: Math.PI, y: 3.8, w: 0.9, h: 1.85, trimColor: trim },
        ...[8.7, 12.9, 17.1].map((y) => ({ angle: Math.PI, y, w: 0.34, h: 0.64, trimColor: trim })),
      ],
      slot: 'ashlar',
      color: stone,
      segments: n,
    });
  else {
    profile(
      turret,
      'ashlar',
      [
        [3.3, 1.51],
        [20.2, 1.24],
      ],
      stone,
      n,
    );
    const f = transform(turret, Math.PI);
    for (const [y, w, h] of [
      [3.8, 0.9, 1.85],
      [8.7, 0.34, 0.64],
      [12.9, 0.34, 0.64],
      [17.1, 0.34, 0.64],
    ]) {
      const z = 1.51 - (0.27 * (y - 3.3)) / 16.9 + 0.01;
      card(f, 0, y, w, h, z, glass);
    }
  }
  if (district)
    for (let y = 4, k = 0; y < 20.2; y += 1.14, k++) {
      const r = radius(y);
      for (const x of [-1, 1])
        for (const z of [-1, 1])
          box(
            out,
            'granite',
            [x * r - (k % 2 ? 0.22 : 0.32), y, z * r - (k % 2 ? 0.32 : 0.22)],
            [x * r + (k % 2 ? 0.22 : 0.32), y + 0.43, z * r + (k % 2 ? 0.32 : 0.22)],
            trim,
          );
    }
  loft(out, 'granite', [square(3.5, 3.38), square(3.7, 3.44), square(3.87, 3.34)], trim);
  // Paired corbel rhythm is denser at district distance; far wedges retain the teeth silhouette.
  for (let side = 0; side < 4; side++) {
    const f = transform(out, (side * Math.PI) / 2),
      count = district ? 7 : 3;
    for (let i = 0; i < count; i++) {
      const x = -2.7 + (5.4 * i) / (count - 1);
      if (district) {
        box(f, 'granite', [x - 0.19, 19.6, 2.71], [x + 0.19, 20.25, 3.03], [0.49, 0.48, 0.415]);
        box(f, 'granite', [x - 0.25, 20.72, 2.76], [x + 0.25, 21.39, 3.67], trim);
      }
      beam(f, 'granite', [x, 19.75, 2.82], [x, 21.25, 3.56], 0.33, 0.32, trim);
    }
  }
  loft(
    out,
    'granite',
    [square(21.35, 3.71), square(21.6, 3.78), square(21.83, 3.78), square(22, 3.61)],
    trim,
  );
  ring(turret, 'granite', 21.35, 0.05, 1.65, 0.65, trim, n);
  for (let side = 0; side < 4; side++) {
    const f = transform(out, (side * Math.PI) / 2);
    box(f, 'granite', [-3.61, 22, 3.3], [3.61, 22.57, 3.6], stone);
    // Far railing strips leave the gallery open above its parapet.
    card(f, 0, 23.27, 6.78, 0.055, 3.39, iron, 'metal');
    if (district) {
      card(f, 0, 22.41, 6.78, 0.055, 3.39, iron, 'metal');
      for (const x of [-2.5, -1.25, 0, 1.25, 2.5])
        box(f, 'metal', [x - 0.023, 22.35, 3.367], [x + 0.023, 23.3, 3.413], iron);
    }
  }
  for (const x of [-3.35, 3.35])
    for (const z of [-3.35, 3.35]) {
      box(out, 'granite', [x - 0.23, 22.4, z - 0.35], [x + 0.23, 23.28, z + 0.35], trim);
      box(out, 'metal', [x - 0.023, 22.35, z - 0.023], [x + 0.023, 23.3, z + 0.023], iron);
    }
  profile(
    out,
    'granite',
    [
      [22.03, 2.02],
      [23.55, 2.02],
    ],
    trim,
    n,
  );
  profile(
    out,
    'metal',
    [
      [23.55, 1.56],
      [23.78, 1.56],
    ],
    iron,
    n,
  );
  profile(
    out,
    'glass',
    [
      [23.78, 1.5288],
      [25.3, 1.5288],
    ],
    [0.27, 0.39, 0.42],
    n,
  );
  for (let i = 0; i < (district ? 8 : 4); i++) {
    const a = (i * Math.PI * 2) / (district ? 8 : 4),
      x = Math.sin(a) * 1.56,
      z = Math.cos(a) * 1.56;
    box(out, 'metal', [x - 0.045, 23.72, z - 0.045], [x + 0.045, 25.3, z + 0.045], iron);
  }
  for (const y of [district ? 24.4425 : 25.3, 25.3]) {
    if (!district && y === 25.3) break;
    profile(
      out,
      'metal',
      [
        [y, 1.5912],
        [y + 0.055, 1.5912],
      ],
      iron,
      n,
    );
  }
  profile(
    out,
    'metal',
    [
      [25.3, 1.8096],
      [25.44, 1.8096],
      [25.65, 1.4976],
      [26.06, 0.5928],
      [26.25, 0.065],
    ],
    iron,
    n,
  );
  box(out, 'metal', [-0.027, 26.25, -0.027], [0.027, 26.9, 0.027], iron);
  for (const x0 of [-2.31, 0.1]) {
    face(
      out,
      'glass',
      [
        [x0, 22.02, 3.8],
        [x0 + 2.2, 22.02, 3.8],
        [x0 + 2.2, 23.25, 3.03],
        [x0, 23.25, 3.03],
      ],
      [0.075, 0.115, 0.16],
    );
    if (district)
      for (const x of [x0, x0 + 2.2])
        beam(out, 'metal', [x, 22.02, 3.82], [x, 23.25, 3.05], 0.023, 0.028, [0.85, 0.85, 0.79]);
  }
  for (const [x, z] of [
    [-2.6, 1.2],
    [2.7, -0.8],
  ]) {
    box(out, 'metal', [x - 0.031, 22, z - 0.031], [x + 0.031, 25.2, z + 0.031], iron);
    box(out, 'metal', [x - 0.38, 24.48, z - 0.023], [x + 0.38, 24.52, z + 0.023], iron);
  }
  // The surviving north entrance flight remains; the lost loading mast is not reconstructed.
  const entry = transform(out, Math.PI);
  for (let i = 0; i < 13; i += district ? 1 : 2) {
    const y = 3.65 - i * 0.265;
    box(entry, 'granite', [-0.7, y, 3.8 + i * 0.31], [0.7, y + 0.24, 4.11 + i * 0.31], stone);
  }
  beam(entry, 'granite', [0, 3.42, 3.85], [0, 0.23, 7.83], 1.4, 0.28, stone);
  for (const x of [-0.8, 0.8])
    beam(entry, 'metal', [x, 4.7, 3.8], [x, 1.15, 7.84], 0.062, 0.062, iron);
  if (district) {
    const access = transform(out, -Math.PI / 2, [-0.08, 0, 0]);
    for (const x of [-0.31, 0.31])
      beam(access, 'metal', [x, 22.03, 2.17], [x, 23.59, 2.17], 0.07, 0.07, iron);
    for (let y = 22.15; y < 23.59; y += 0.44)
      beam(access, 'metal', [-0.31, y, 2.17], [0.31, y, 2.17], 0.054, 0.054, iron);
  }
}
export function vieilleSkyline(out) {
  const target = Object.fromEntries(
    ['addQuad', 'addTriangle', 'addConvexPolygon'].map((method) => [
      method,
      (slot, ref, p, n, uv, color) =>
        out[method](slot, ref, p, n, uv, slot === 'glass' ? color : color.map((v) => v * 0.65)),
    ]),
  );
  envelope(target, false);
}
export const vieilleDistrict = (out) => envelope(out, true);
