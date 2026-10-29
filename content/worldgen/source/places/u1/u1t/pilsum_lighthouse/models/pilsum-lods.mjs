/** Pilsum browser models: source dimensions, seven daymark bands and signed sector windows. */
import {
  normalFor,
  sphere,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  ring,
  shell,
} from '../../../../../../../../packages/worldgen/scripts/lighthouse-expansion-models.mjs';
import {
  lathe,
  transformed,
} from '../../../../../../../../packages/worldgen/scripts/lighthouse-models.mjs';
import {
  box,
  quad,
  tube,
} from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const TAU = Math.PI * 2;
const red = [0.76, 0.038, 0.022],
  yellow = [0.97, 0.67, 0.012];
const dark = [0.043, 0.049, 0.039],
  roof = [0.19, 0.19, 0.13];
const course = (10.15 - 0.3) / 7;
const colorAt = (y) =>
  Math.floor(Math.max(0, Math.min(6.999, (y - 0.3) / course))) % 2 ? yellow : red;
const polar = (r, y, a) => [r * Math.sin(a), y, r * Math.cos(a)];
export const pilsumApertures = [
  { angle: 0, y: 0.32, w: 0.84, h: 1.93, depth: 0.12 },
  ...[1.56, 4.99].map((y) => ({ angle: Math.PI, y, w: 0.57, h: 0.86, depth: 0.1 })),
  ...[2.1, 3.56].map((angle) => ({ angle, y: 7.99, w: 1.74, h: 1.85, depth: 0.11 })),
];

function bracket(out, angle) {
  const o = transformed(out, angle),
    profile = [
      [9.86, 2.18],
      [9.88, 2.27],
      [10.13, 2.46],
      [10.2, 2.46],
      [10.2, 2.18],
    ];
  for (const sign of [-1, 1]) {
    const p = profile.map(([y, z]) => [sign * 0.035, y, z]);
    if (normalFor(...p.slice(0, 3))[0] * sign < 0) p.reverse();
    o.addConvexPolygon('metal', 'metric:uv', p, [sign, 0, 0], (p) => [p[2], p[1]], red);
  }
  for (let i = 0; i < profile.length; i++) {
    const a = profile[i],
      b = profile[(i + 1) % profile.length],
      p = [
        [-0.035, ...a],
        [0.035, ...a],
        [0.035, ...b],
        [-0.035, ...b],
      ];
    quad(o, 'metal', p, normalFor(...p.slice(0, 3)), red);
  }
}
function hood(out, a, y, width) {
  const o = transformed(out, a),
    c = colorAt(y),
    p = [
      [-width / 2, y - 0.025, 2.36],
      [width / 2, y - 0.025, 2.36],
      [width / 2, y + 0.15, 2.215],
      [-width / 2, y + 0.15, 2.215],
    ];
  box(o, 'metal', [-width / 2, y - 0.025, 2.195], [width / 2, y + 0.15, 2.22], c);
  quad(o, 'metal', p, normalFor(...p.slice(0, 3)), c);
  for (const x of [-width / 2, width / 2]) {
    const p = [
      [x, y - 0.025, 2.215],
      [x, y - 0.025, 2.36],
      [x, y + 0.15, 2.215],
    ];
    if (normalFor(...p)[0] * x < 0) p.reverse();
    o.addTriangle(
      'metal',
      'metric:uv',
      p,
      normalFor(...p),
      p.map((v) => [v[2], v[1]]),
      c,
    );
  }
}
function windowFrames(out, h, bars) {
  const o = transformed(out, h.angle),
    z = Math.sqrt(2.2 ** 2 - (h.w / 2) ** 2) - 0.07;
  // Broad black optical frames remain at district; barred small windows are close-view detail.
  for (const yy of [h.y, h.y + h.h * 0.49, h.y + h.h])
    box(o, 'metal', [-h.w / 2, yy - 0.029, z - 0.025], [h.w / 2, yy + 0.029, z + 0.055], dark);
  box(o, 'metal', [-0.025, h.y, z - 0.025], [0.025, h.y + h.h, z + 0.055], dark);
  if (bars && h.h < 1.3) {
    for (let yy = h.y + 0.1; yy < h.y + h.h; yy += 0.16)
      box(
        o,
        'metal',
        [-h.w * 0.47, yy - 0.008, z + 0.054],
        [h.w * 0.47, yy + 0.008, z + 0.07],
        dark,
      );
    for (let x = -h.w * 0.4; x < h.w * 0.49; x += 0.12)
      box(o, 'metal', [x - 0.008, h.y, z + 0.054], [x + 0.008, h.y + h.h, z + 0.07], dark);
  }
}
function body(out, sides, pierced) {
  lathe(
    out,
    'brick',
    [
      [0, 2.48],
      [0.25, 2.48],
    ],
    [0.42, 0.38, 0.29],
    sides,
  );
  lathe(
    out,
    'metal',
    [
      [0.25, 2.28],
      [0.31, 2.28],
    ],
    [0.19, 0.2, 0.15],
    sides,
  );
  if (pierced)
    shell(out, {
      profile: Array.from({ length: 8 }, (_, i) => [0.3 + i * course, 2.2]),
      slot: 'metal',
      color: colorAt,
      segments: sides,
      holes: (Array.isArray(pierced) ? pierced : pilsumApertures).map((h) => ({
        ...h,
        trimSlot: 'metal',
        trimColor: dark,
      })),
    });
  else
    for (let i = 0; i < 7; i++)
      lathe(
        out,
        'metal',
        [
          [0.3 + i * course, 2.2],
          [0.3 + (i + 1) * course, 2.2],
        ],
        i % 2 ? yellow : red,
        sides,
      );
  for (let i = 0; i < 2; i++)
    box(
      out,
      'granite',
      [-0.65, 0, 2.16],
      [0.65, 0.28 - i * 0.14, 2.67 + i * 0.29],
      [0.43, 0.43, 0.37],
    );
}
function crown(
  out,
  { sides, posts, rings, vents, seams, ballSides, ballRings, tubeSides, brackets = true },
) {
  ring(out, 'metal', 10.15, 1.9, 2.42, 0.09, red, sides);
  for (let i = 0; i < posts; i++) {
    const a = (i * TAU) / posts;
    if (brackets) bracket(out, a);
    tube(out, 'metal', polar(2.41, 10.23, a), polar(2.61, 10.69, a), 0.023, red, tubeSides);
  }
  for (const t of rings)
    ring(
      out,
      'metal',
      10.23 + 0.46 * t,
      2.41 + 0.2 * t - 0.014,
      2.41 + 0.2 * t + 0.015,
      0.022,
      red,
      sides,
    );
  lathe(
    out,
    'metal',
    [
      [10.24, 2.41],
      [10.3, 2.41],
      [11.38, 0.15],
    ],
    roof,
    sides,
  );
  for (let i = 0; i < seams; i++)
    tube(
      out,
      'metal',
      polar(2.4, 10.31, (i * TAU) / seams),
      polar(0.15, 11.39, (i * TAU) / seams),
      0.017,
      roof.map((v) => v * 0.7),
      tubeSides,
    );
  if (vents)
    for (let i = 0; i < 4; i++) {
      const a = ((i + 0.5) * TAU) / 4,
        r = 1.2,
        y = 10.3 + ((2.41 - r) / (2.41 - 0.15)) * 1.08;
      lathe(
        transformed(out, 0, polar(r, 0, a)),
        'metal',
        [
          [y, 0.053],
          [y + 0.13, 0.053],
          [y + 0.15, 0.092],
          [y + 0.18, 0.086],
        ],
        roof,
        8,
      );
    }
  lathe(
    out,
    'metal',
    [
      [11.36, 0.15],
      [11.48, 0.15],
      [11.56, 0.13],
    ],
    roof,
    Math.min(sides, 16),
  );
  sphere(out, 'metal', [0, 11.69, 0], [0.23, 0.23, 0.23], red, ballSides, ballRings);
  tube(out, 'metal', [0, 11.89, 0], [0, 12.45, 0], 0.011, dark, tubeSides);
}
function near(out, cfg) {
  body(out, cfg.sides, true);
  for (const h of pilsumApertures.filter((h) => h.angle !== 0)) windowFrames(out, h, cfg.bars);
  box(out, 'metal', [-0.37, 0.36, 2.052], [0.37, 2.21, 2.116], [0.21, 0.23, 0.17]);
  for (const y of [0.61, 1.37, 2.03])
    box(out, 'metal', [-0.33, y - 0.023, 2.116], [0.33, y + 0.023, 2.139], [0.13, 0.15, 0.12]);
  if (cfg.bars) {
    tube(out, 'metal', [0.25, 1.15, 2.15], [0.25, 1.36, 2.15], 0.022, [0.6, 0.6, 0.5], 6);
    for (const y of [0.53, 1.93])
      box(out, 'metal', [-0.4, y - 0.05, 2.115], [-0.27, y + 0.05, 2.158], [0.12, 0.13, 0.1]);
  }
  for (const a of [0.95, 2.86, 4.85]) hood(out, a, 9.38, 0.43);
  for (const a of [1.35, 2.5, 3.8, 5.15]) hood(out, a, 2.66, 0.44);
  if (cfg.plateJoints)
    for (let j = 0; j < 7; j++)
      for (let i = 0; i < 12; i++) {
        const a = ((i + (j % 2) * 0.5) * TAU) / 12,
          y0 = 0.3 + j * course,
          y1 = y0 + course;
        const cuts = pilsumApertures.filter(
          (h) =>
            Math.abs(Math.atan2(Math.sin(a - h.angle), Math.cos(a - h.angle))) <
              Math.asin(h.w / 4.4) + 0.025 &&
            h.y < y1 &&
            h.y + h.h > y0,
        );
        const ends = [
          y0,
          y1,
          ...cuts.flatMap((h) => [Math.max(y0, h.y - 0.08), Math.min(y1, h.y + h.h + 0.08)]),
        ].sort((a, b) => a - b);
        for (let k = 1; k < ends.length; k++)
          if (
            ends[k] - ends[k - 1] > 0.03 &&
            !cuts.some(
              (h) =>
                (ends[k] + ends[k - 1]) / 2 > h.y - 0.08 &&
                (ends[k] + ends[k - 1]) / 2 < h.y + h.h + 0.08,
            )
          ) {
            const o = transformed(out, a);
            box(
              o,
              'metal',
              [-0.016, ends[k - 1] + 0.01, 2.188],
              [0.016, ends[k] - 0.01, 2.214],
              colorAt((y0 + y1) / 2),
            );
          }
      }
  crown(out, cfg);
}
export function pilsumSkyline(out) {
  body(
    out,
    12,
    pilsumApertures.filter((h) => h.angle !== 0 && h.h > 1.3),
  );
  box(out, 'metal', [-0.42, 0.32, 2.13], [0.42, 2.25, 2.22], dark);
  // Open roof rail at distance: four canted uprights and one polygonal top rail.
  crown(out, {
    sides: 12,
    posts: 4,
    rings: [1],
    vents: false,
    seams: 0,
    ballSides: 8,
    ballRings: 4,
    tubeSides: 4,
    brackets: false,
  });
}
export function pilsumDistrict(out) {
  near(out, {
    sides: 24,
    posts: 8,
    rings: [0.24, 1],
    vents: false,
    seams: 0,
    ballSides: 10,
    ballRings: 5,
    tubeSides: 4,
    bars: false,
    plateJoints: false,
  });
}
export function pilsumStreet(out) {
  near(out, {
    sides: 48,
    posts: 20,
    rings: [0.24, 0.59, 1],
    vents: true,
    seams: 16,
    ballSides: 16,
    ballRings: 8,
    tubeSides: 6,
    bars: false,
    plateJoints: false,
  });
}
export function pilsumCloseup(out) {
  near(out, {
    sides: 64,
    posts: 20,
    rings: [0.24, 0.59, 1],
    vents: true,
    seams: 16,
    ballSides: 24,
    ballRings: 12,
    tubeSides: 8,
    bars: true,
    plateJoints: true,
  });
}
