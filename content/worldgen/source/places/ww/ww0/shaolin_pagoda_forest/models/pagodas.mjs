import {
  loft,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  abox,
  extrude,
  fbox,
  rgb,
  tri,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import {
  courtFace,
  edges,
  positioned,
  rect,
} from '../../shaolin_monastery/models/temple-architecture.mjs';
import site from '../site-controls.json' with { type: 'json' };

export const surfaces = {
  brick: { slot: 'wall', graph: 'brick_flemish', roughness: 0.97 },
  stone: { slot: 'trim', graph: 'stone_limestone_weathered', roughness: 0.97 },
  cap: { slot: 'roof', graph: 'stone_limestone_raw', roughness: 0.96 },
};
const shades = [
  [rgb('a39274'), rgb('b0a38b'), rgb('858073')],
  [rgb('a29481'), rgb('b5ac99'), rgb('8f8c81')],
  [rgb('98856e'), rgb('a69a87'), rgb('7c776a')],
  [rgb('b0a18d'), rgb('b8ae9c'), rgb('99958a')],
];
const dark = rgb('777061'),
  pale = rgb('b3aa95');
const skyline = site.towers
  .slice()
  .sort((a, b) => b.height - a.height)
  .slice(0, 60);
const profileY = (s, h) => s.base + s.height * h;

function ring(p, normalHeight, factor, count = p.sides) {
  // Radius derives from the measured side-to-side width, so brick courses keep their metre scale.
  const r = (p.width * 0.5) / Math.cos(Math.PI / count);
  return radialRing(
    profileY(p, normalHeight),
    r * factor,
    r * factor,
    count,
    p.center,
    p.angle + Math.PI / count,
  );
}

function triangleCap(out, points, apex, tint) {
  for (let i = 0; i < points.length; i++)
    tri(out, 'cap', points[i], points[(i + 1) % points.length], apex, tint);
}

function distant(out, p, detail) {
  const [brick, stone, cap] = shades[p.tint],
    n = p.sides === 12 ? 8 : p.sides;
  const foot = ring(p, (p.foundation - p.base) / p.height, 1.02, n);
  const lip = ring(p, p.tiers > 1 ? 0.82 : 0.74, 0.77, n);
  loft(out, 'brick', [foot, lip], brick, { cap: false });
  triangleCap(out, lip, [p.center[0], profileY(p, 1), p.center[1]], cap);
  if (detail && p.principal)
    loft(out, 'stone', [ring(p, 0.15, 1.19, n), ring(p, 0.172, 1.19, n)], stone, { cap: false });
}

function vase(out, p, detail, [brick, stone, cap]) {
  const n = detail === 3 ? 12 : 8;
  const floor = [
    [(p.foundation - p.base) / p.height, 1.02],
    [0.115, 1.02],
    [0.185, 0.73],
    [0.28, 0.71],
  ];
  loft(
    out,
    'stone',
    floor.map(([h, r]) => ring(p, h, r, n)),
    stone,
    { cap: false },
  );
  const shell =
    detail === 3
      ? [
          [0.26, 0.6],
          [0.37, 0.56],
          [0.5, 0.87],
          [0.65, 0.98],
          [0.76, 0.91],
          [0.84, 0.61],
        ]
      : [
          [0.26, 0.6],
          [0.56, 0.93],
          [0.76, 0.92],
          [0.84, 0.62],
        ];
  loft(
    out,
    'brick',
    shell.map(([h, r]) => ring(p, h, r, n)),
    brick,
    { cap: false },
  );
  const roof = [
    [0.82, 0.61],
    [0.86, 0.46],
    [0.92, 0.37],
    [0.95, 0.21],
    [1, 0.035],
  ];
  loft(
    out,
    'cap',
    roof.map(([h, r]) => ring(p, h, r, n)),
    cap,
  );
}

function plaque(out, p, height, width, ringPoints, detail, tint) {
  const r = ringPoints.map(([x, , z]) => [x, z]);
  const faces = edges(r);
  const f = faces.reduce((a, b) => (b.normal[1] > a.normal[1] ? b : a));
  const u = f.length * 0.5;
  fbox(
    out,
    'stone',
    f,
    u - width * 0.58,
    u + width * 0.58,
    height - width * 0.72,
    height + width * 0.77,
    0,
    0.038,
    pale,
  );
  fbox(
    out,
    'stone',
    f,
    u - width * 0.43,
    u + width * 0.43,
    height - width * 0.51,
    height + width * 0.57,
    0.036,
    0.06,
    tint,
  );
  if (detail === 3 && p.principal)
    for (let j = 0; j < 5; j++) {
      const y = height + (j - 2) * width * 0.18;
      fbox(
        out,
        'stone',
        f,
        u - width * 0.27,
        u + width * 0.27,
        y - 0.013,
        y + 0.013,
        0.057,
        0.075,
        pale,
      );
    }
}

function stepped(out, p, detail) {
  const colors = shades[p.tint],
    [brick, stone, cap] = colors;
  if (p.sides === 12) {
    vase(out, p, detail, colors);
    return;
  }
  const base =
    p.principal || detail === 3
      ? [
          [(p.foundation - p.base) / p.height, 1.09],
          [0.068, 1.09],
          [0.093, 1.02],
          [0.124, 0.91],
        ]
      : [
          [(p.foundation - p.base) / p.height, 1.06],
          [0.1, 1.06],
        ];
  loft(
    out,
    'stone',
    base.map(([h, r]) => ring(p, h, r)),
    stone,
    { cap: false },
  );
  const count = p.tiers;
  const first = count === 1 ? 0.7 : count === 3 ? 0.52 : count === 5 ? 0.44 : 0.38;
  const top = 0.91;
  const spacing = count === 1 ? 0 : (top - first) / (count - 1);
  let from = 0.104,
    radius = 0.84;
  for (let i = 0; i < count; i++) {
    const h = first + i * spacing,
      r = p.principal ? 0.85 - 0.063 * i : 0.84 - 0.049 * i;
    const start = ring(p, from, radius);
    const end = ring(p, h - 0.018, r);
    const brim = r + (p.principal ? 0.141 : 0.117);
    const lip = ring(p, h, brim);
    const next = ring(p, h + 0.025, r * 0.937);
    if (detail === 2 && !p.principal) {
      loft(out, 'brick', [start, lip], brick, { cap: false });
      loft(out, 'cap', [lip, next], cap, { cap: false });
    } else {
      loft(out, 'brick', [start, end], brick, { cap: false });
      const roof =
        detail === 3
          ? [
              end,
              ring(p, h - 0.012, r + 0.037),
              ring(p, h - 0.008, brim - 0.024),
              lip,
              ring(p, h + 0.009, brim - 0.026),
              next,
            ]
          : [end, lip, next];
      loft(out, 'cap', roof, cap, { cap: false });
    }
    from = h + 0.025;
    radius = r * 0.937;
  }
  if (detail === 3) {
    const topR = radius * 0.51;
    const bulb = [
      [from, radius],
      [0.947, topR],
      [0.956, topR * 1.21],
      [0.975, topR * 0.67],
      [1, 0.035],
    ];
    loft(
      out,
      'stone',
      bulb.map(([h, r]) => ring(p, h, r)),
      stone,
    );
    if (p.principal || p.height > 5.3 || p.tint === 2)
      plaque(
        out,
        p,
        profileY(p, first * 0.61),
        Math.min(p.width * 0.27, 0.72),
        ring(p, 0.21, 0.84),
        detail,
        dark,
      );
  } else {
    triangleCap(out, ring(p, from, radius), [p.center[0], profileY(p, 1), p.center[1]], cap);
  }
}

function principalCourt(out, p, detail) {
  if (detail < 2) return;
  const [x, z] = p.center;
  const m = positioned(out, p.angle, [x, 0, z]),
    y = p.base - 0.035;
  const r = rect(-2.18, 2.18, -2.61, 3.14);
  extrude(m, 'stone', r, p.foundation - 0.15, y + 0.11, pale);
  const left = courtFace(0, 3.14, 4.36);
  for (const [a, b] of [
    [0, 1.42],
    [2.94, 4.36],
  ])
    fbox(m, 'stone', left, a, b, y + 0.1, y + 0.53, -0.205, 0.045, pale);
  for (const sign of [-1, 1]) {
    const a = sign * 2.04;
    abox(m, 'stone', [a - 0.09, y + 0.09, -2.59], [a + 0.09, y + 0.54, 3.1], pale, {
      bottom: false,
    });
  }
}

function build(out, detail) {
  const mesh = positioned(out, 0);
  for (const p of detail ? site.towers : skyline) {
    if (detail < 2) distant(mesh, p, detail);
    else stepped(mesh, p, detail);
    if (p.principal) principalCourt(mesh, p, detail);
  }
}
export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = buildCloseup;
