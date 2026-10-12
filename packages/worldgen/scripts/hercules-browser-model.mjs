/** Authored far silhouette: retain the landing, helical bands, two octagonal stages and offset stair spine. */
import { beam, loft, radialRing } from './authored-structure-mesh.mjs';
import { buildHerculesDistrict } from './hercules-detail-model.mjs';
import { lathe, panel, squareCornice, transformed } from './lighthouse-models.mjs';
import { box, quad, tube } from './structure-mesh.mjs';

export { buildHerculesDistrict };

const stone = [0.56, 0.51, 0.42],
  pale = [0.64, 0.6, 0.51],
  dark = [0.09, 0.115, 0.12];
const means = {
  ashlar: [0.687437, 0.660738, 0.602857],
  granite: [0.701109, 0.701109, 0.701109],
  metal: [0.908889, 0.908889, 0.908889],
};
function tint(out) {
  return Object.fromEntries(
    ['addQuad', 'addTriangle', 'addConvexPolygon'].map((k) => [
      k,
      (s, r, p, n, uv, c) =>
        out[k](
          s,
          r,
          p,
          n,
          uv,
          c.map((v, i) => v * (means[s]?.[i] ?? 1)),
        ),
    ]),
  );
}
export function buildHerculesSkyline(destination) {
  const out = tint(destination);
  loft(out, 'ashlar', [radialRing(0, 16.2, 16.2, 12), radialRing(1.4, 16.2, 16.2, 12)], stone);
  for (let i = 0; i < 12; i++) {
    const a = (i * Math.PI) / 6,
      b = ((i + 1) * Math.PI) / 6,
      start = [Math.cos(a) * 15.7, Math.sin(a) * 15.7],
      end = [Math.cos(b) * 15.7, Math.sin(b) * 15.7];
    if (i === 2 || i === 3) {
      const clipped = i === 2 ? end : start,
        fixed = i === 2 ? start : end,
        x = i === 2 ? 2.8 : -2.8;
      clipped[1] += ((x - clipped[0]) / (fixed[0] - clipped[0])) * (fixed[1] - clipped[1]);
      clipped[0] = x;
    }
    beam(out, 'ashlar', [start[0], 2, start[1]], [end[0], 2, end[1]], 0.63, 1.2, stone);
  }
  box(out, 'granite', [-2.5, 0, 14.7], [2.5, 1.4, 16], pale);
  for (let i = 0; i < 8; i++)
    box(out, 'granite', [-2.5, 0, 16 + i * 0.35], [2.5, 1.4 - i * 0.17, 16.35 + i * 0.35], pale);
  box(out, 'ashlar', [-5.875, 1.4, -5.875], [5.875, 35.78, 5.875], stone);
  for (let face = 0; face < 4; face++) {
    const o = transformed(out, (face * Math.PI) / 2);
    for (let row = 0; row < 5; row++)
      for (const column of [-1, 1]) {
        const y = 3 + face * 1.575 + row * 6.3;
        panel(
          o,
          column < 0 || row === 4 ? 'ashlar' : 'glass',
          column * 2.25 - 0.55,
          column * 2.25 + 0.55,
          y,
          y + 2.35,
          5.881,
          column < 0 || row === 4 ? stone.map((v) => v * 0.87) : dark,
        );
      }
    for (let turn = 0; turn < 6; turn++) {
      const low = 1.2 + turn * 6.3 + face * 1.575,
        high = low + 1.575;
      if (low < 1.4 || high > 34.88) continue;
      quad(
        o,
        'granite',
        [
          [-5.875, low - 0.115, 5.96],
          [5.875, high - 0.115, 5.96],
          [5.875, high + 0.115, 5.96],
          [-5.875, low + 0.115, 5.96],
        ],
        [0, 0, 1],
        pale,
      );
    }
  }
  squareCornice(out, 35.55, 6.4);
  loft(
    out,
    'ashlar',
    [
      [36.05, 5],
      [36.5, 4.8],
      [37.15, 4.55],
      [38, 4.42],
      [42.55, 4.42],
    ].map(([y, r]) =>
      radialRing(y, r / Math.cos(Math.PI / 8), r / Math.cos(Math.PI / 8), 8, [0, 0], Math.PI / 8),
    ),
    stone,
  );
  for (let face = 0; face < 4; face++)
    panel(transformed(out, (face * Math.PI) / 2), 'glass', -0.52, 0.52, 38.75, 40.55, 4.435, dark);
  for (const [y, r] of [
    [42.5, 4.85],
    [42.82, 4.96],
    [43.15, 4.72],
  ])
    lathe(
      out,
      'granite',
      [
        [y, r],
        [y + 0.17, r],
      ],
      pale,
      8,
    );
  loft(
    out,
    'ashlar',
    [43.32, 47.6].map((y) => radialRing(y, 2.5, 2.5, 8, [0, 0], Math.PI / 8)),
    stone,
  );
  for (let face = 0; face < 8; face++)
    panel(transformed(out, (face * Math.PI) / 4), 'glass', -0.38, 0.38, 44.25, 45.75, 2.32, dark);
  lathe(
    out,
    'granite',
    [
      [47.55, 2.65],
      [47.82, 2.78],
      [48.02, 2.65],
    ],
    pale,
    8,
  );
  lathe(
    out,
    'metal',
    [
      [48.05, 1.94],
      [48.21, 1.94],
      [48.28, 1.78],
    ],
    dark,
    8,
  );
  lathe(
    out,
    'glass',
    [
      [48.28, 1.7444],
      [50.18, 1.7444],
    ],
    [0.27, 0.39, 0.42],
    8,
  );
  lathe(
    out,
    'metal',
    [
      [50.18, 2.0648],
      [50.32, 2.0648],
      [50.53, 1.7088],
      [50.94, 0.6764],
      [51.13, 0.065],
    ],
    dark,
    8,
  );
  const spine = transformed(out, 0, [2.5, 0, -2.15]);
  lathe(
    spine,
    'ashlar',
    [
      [43.2, 0.65],
      [50, 0.5],
      [54, 0.28],
      [54.35, 0.08],
    ],
    stone,
    8,
  );
  tube(spine, 'metal', [0, 54.3, 0], [0, 55, 0], 0.013, dark, 4);
}
