import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { withFootprintCaps } from '../../../../../../../../packages/worldgen/scripts/place-footprint-caps.mjs';
import {
  extrude,
  facade,
  fan,
  fbox,
  gableRoof,
  lathe,
  opening,
  outwardRing,
  quad4,
  rgb,
  roundArch,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import site from '../site-controls.json' with { type: 'json' };

export const surfaces = {
  wall: { slot: 'trim', graph: 'stone_limestone_raw', roughness: 0.94 },
  stone: { slot: 'trim', graph: 'stone_limestone_raw', roughness: 0.94 },
  columns: { slot: 'wall', graph: 'stone_granite', roughness: 0.94 },
  tile: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.94 },
  copper: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.88 },
  dark: { slot: 'door', graph: 'metal_painted', roughness: 0.73 },
  mosaic: { slot: 'trim', graph: 'tile_mosaic', roughness: 0.9 },
  paving: { slot: 'foundation', graph: 'stone_ashlar', roughness: 0.98 },
  green: { slot: 'trim', localRef: 'palette:#ffffff', name: 'courtyard-planting', roughness: 0.98 },
};

const F = facade(site.frame.origin, site.frame.along),
  P = F.P;
const xz = ([x, , z]) => [x, z];
const wall = rgb('c9b498'),
  pale = rgb('d2c7b0'),
  stone = rgb('bdb29d'),
  archShade = rgb('a49a84');
const clay = rgb('a26e53'),
  copper = rgb('71837b'),
  soil = rgb('9e9983'),
  lawn = rgb('708254');
const hedge = rgb('506841'),
  leaves = rgb('758553'),
  bark = rgb('746554');
const gold = rgb('c9ad68'),
  amber = rgb('b89b5e'),
  mosaicBlue = rgb('798986'),
  mosaicRed = rgb('a0765d');
const dark = rgb('526262'),
  door = rgb('5d685b');
const box = (out, s, u, U, y, Y, d, D, c) => fbox(out, s, F, u, U, y, Y, d, D, c);
const faces = (ring) => outwardRing(ring).map((a, i, r) => wallFace(a, r[(i + 1) % r.length]));
const rect = (u, U, d, D) =>
  [
    [u, d],
    [U, d],
    [U, D],
    [u, D],
  ].map(([a, b]) => xz(P(a, 0, b)));

function verticalFace(out, s, f, u, U, y, Y, d, tone) {
  const p = f.P;
  quad4(out, s, p(u, y, d), p(U, y, d), p(U, Y, d), p(u, Y, d), tone);
}
function shaft(out, u, d, y, Y, r, detail, tone) {
  const origin = xz(P(u, 0, d));
  if (detail < 2) {
    const n = detail === 0 ? 4 : 5;
    lathe(
      out,
      'columns',
      origin,
      [
        [y, r, r],
        [Y, r * 0.91, r * 0.91],
      ],
      n,
      tone,
      { capTop: false },
    );
    return;
  }
  const n = detail === 2 ? 7 : 12;
  lathe(
    out,
    'columns',
    origin,
    [
      [y, r * 1.29, r * 1.29],
      ...(detail === 3 ? [[y + 0.25, r * 1.15, r * 1.15]] : []),
      [y + 0.47, r, r],
      [Y - 0.41, r * 0.84, r * 0.84],
      ...(detail === 3 ? [[Y - 0.21, r * 1.02, r * 1.02]] : []),
      [Y, r * 1.3, r * 1.3],
    ],
    n,
    tone,
    { capTop: false },
  );
}

function gallery(out, detail) {
  const start = 0.81;
  for (const [u, U, a, b] of [
    [-38.45, 34.49, 48.35, 56.15],
    [-38.32, -24.62, -0.88, 48.39],
    [24.05, 34.42, -0.89, 48.39],
    [-25.25, 25.11, -6.38, 0.23],
  ])
    box(out, 'paving', u, U, -1.67, start, a, b, soil);
  extrude(out, 'stone', site.portico, 10.53, 11.75, stone, { topSlot: 'copper', topColor: copper });
  const rows = [
    { across: true, a: -23.23, b: 23.02, fixed: -0.67, n: 18, sky: 5, h: 12.02, c: rgb('b9a48d') },
    { across: true, a: -22.42, b: 22.26, fixed: -4.59, n: 18, sky: 0, h: 12.02, c: rgb('b9a48d') },
    { across: true, a: -31.44, b: 28.63, fixed: 49.21, n: 20, sky: 5, h: 10.65, c: pale },
    { across: true, a: -31.24, b: 28.43, fixed: 53.43, n: 20, sky: 0, h: 10.65, c: pale },
    { across: true, a: -30.43, b: 27.41, fixed: 55.62, n: 18, sky: 0, h: 9.31, c: pale },
    { across: false, a: 1.21, b: 46.51, fixed: -25.92, n: 14, sky: 4, h: 10.65, c: pale },
    { across: false, a: 1.36, b: 46.39, fixed: -32.21, n: 14, sky: 0, h: 10.65, c: pale },
    { across: false, a: 1.14, b: 46.51, fixed: 25.65, n: 14, sky: 4, h: 10.65, c: pale },
    { across: false, a: 1.14, b: 46.67, fixed: 30.99, n: 14, sky: 0, h: 10.65, c: pale },
  ];
  for (const row of rows) {
    const count = detail ? row.n : row.sky;
    for (let i = 0; i < count; i++) {
      const t = row.a + ((row.b - row.a) * (i + 0.5)) / count;
      const [u, d] = row.across ? [t, row.fixed] : [row.fixed, t];
      shaft(out, u, d, start, row.h, 0.47, detail, row.c);
    }
  }
  box(out, 'stone', -27.08, 25.65, 11.92, 13.91, -8.9, 0.71, pale);
  box(out, 'tile', -26.11, 25.12, 13.83, 14.13, -8.72, 0.57, clay);
  for (const [u, U] of [
    [-38.38, -34.33],
    [30.68, 34.7],
  ])
    box(out, 'wall', u, U, 0.66, 10.76, -10.13, 46.17, wall);
  for (const [u, U] of [
    [-38.48, -32.04],
    [27.9, 33.9],
  ]) {
    box(out, 'stone', u, U, 0.66, 11.49, 44.1, 55.98, stone);
    const x = (u + U) / 2;
    tri(out, 'stone', P(u, 11.45, 56.01), P(U, 11.45, 56.01), P(x, 13.08, 56.01), pale);
  }
  if (detail > 0) {
    const f = facade(xz(P(0, 0, 55.56)), F.along);
    const n = 18,
      a = -30.43,
      b = 27.41,
      span = (b - a) / n;
    for (let i = 0; i < n; i++) {
      const x = a + span * (i + 0.5),
        r = span * 0.448,
        spring = 9.2 - r;
      const inner = roundArch(r, detail === 3 ? 7 : 4);
      for (let j = 0; j < inner.length - 1; j++) {
        const [p, y] = inner[j],
          [q, Y] = inner[j + 1];
        quad4(
          out,
          'stone',
          f.P(x + p, spring + y, 0),
          f.P(x + q, spring + Y, 0),
          f.P(x + q, 10.77, 0),
          f.P(x + p, 10.77, 0),
          pale,
        );
        if (detail > 1)
          quad4(
            out,
            'stone',
            f.P(x + p, spring + y, -0.62),
            f.P(x + q, spring + Y, -0.62),
            f.P(x + q, spring + Y, 0),
            f.P(x + p, spring + y, 0),
            archShade,
          );
      }
      fbox(out, 'stone', f, x - span * 0.5, x - r, 7.84, 10.73, -0.51, 0.075, pale);
    }
  }
  const steps = [2, 3, 5, 8][detail];
  for (let i = 0; i < steps; i++)
    box(
      out,
      'paving',
      -26.19,
      25.9,
      -1.24,
      (0.81 * (i + 1)) / steps,
      53.31,
      58.94 - (3.03 * i) / steps,
      soil,
    );
}

function frescoFigure(out, u, y, h, c, detail) {
  const shapes = [
    [
      [-0.43, 0.04],
      [0.49, 0.04],
      [0.33, 0.71],
      [0.15, 0.89],
      [-0.21, 0.89],
      [-0.41, 0.42],
    ],
    [
      [-0.12, 0.85],
      [0.2, 0.85],
      [0.24, 1.02],
      [0.06, 1.13],
      [-0.11, 1.06],
    ],
  ];
  for (const [i, p] of shapes.entries()) {
    const pts = p.map(([x, v]) => P(u + x * h * 0.495, y + v * h, 0.134 + i * 0.006));
    fan(out, 'mosaic', pts, i === 1 ? stone : c);
  }
  if (detail > 1)
    verticalFace(out, 'mosaic', F, u - 0.16, u + 0.08, y + h * 0.17, y + h * 0.62, 0.154, gold);
}

function westFacade(out, detail) {
  const w = 17.45,
    y = 14.12,
    cornice = 23.84,
    rise = 4.21;
  box(out, 'wall', -25.12, 24.87, 0.84, 14.11, -3.73, -2.42, wall);
  box(out, 'wall', -w, w, y, cornice, -3.75, -0.031, wall);
  verticalFace(out, 'mosaic', F, -w + 0.42, w - 0.43, y + 0.91, cornice - 0.37, 0.055, gold);
  verticalFace(out, 'mosaic', F, -w + 0.43, w - 0.43, 21.15, 23.4, 0.091, mosaicBlue);
  tri(
    out,
    'mosaic',
    P(-w, y + 9.73, 0.089),
    P(w, y + 9.73, 0.089),
    P(0, cornice + rise, 0.089),
    gold,
  );
  for (const [u, c] of [
    [-9.87, dark],
    [0, dark],
    [9.87, dark],
  ]) {
    if (detail > 1)
      opening(out, facade(xz(P(0, 0, 0.103)), F.along), u, 15.45, 3.98, 5.12, {
        head: 'round',
        frameSlot: 'stone',
        glassSlot: 'dark',
        frame: amber,
        glass: c,
        frameWidth: 0.21,
        mullions: 2,
        transoms: 2,
      });
    else {
      const r = 1.91,
        base = 15.44,
        h = 18.58;
      fan(
        out,
        'dark',
        [
          P(u - r, base, 0.11),
          P(u + r, base, 0.11),
          ...roundArch(r, 5)
            .toReversed()
            .map(([x, y]) => P(u + x, h + y, 0.11)),
        ],
        c,
      );
    }
  }
  for (const u of [-14.25, -5.0, 5.03, 14.25])
    if (detail) frescoFigure(out, u, 15.48, 4.25, u < 0 ? mosaicRed : rgb('99826a'), detail);
  if (detail > 0) {
    frescoFigure(out, 0, 24.02, 2.88, mosaicBlue, detail);
    frescoFigure(out, -4.58, 24.0, 1.68, mosaicRed, detail);
    frescoFigure(out, 4.68, 24.0, 1.68, mosaicRed, detail);
    for (let i = 0; i < 10; i++) {
      const x = -15.76 + 3.49 * i;
      verticalFace(out, 'mosaic', F, x, x + 1.38, 21.69, 22.44, 0.142, i % 2 ? amber : stone);
    }
  }
  for (const v of [14.26, 23.67])
    box(out, 'stone', -w - 0.3, w + 0.3, v, v + 0.26, -0.35, 0.261, pale);
  for (const s of [-1, 1]) {
    if (detail)
      beam(out, 'stone', P(s * w, 23.72, 0.203), P(0, cornice + rise, 0.203), 0.25, 0.34, pale);
    box(out, 'stone', s * w - 0.14, s * w + 0.14, 14.47, 23.74, -0.074, 0.259, pale);
  }
  box(out, 'stone', -0.17, 0.17, cornice + rise - 0.04, cornice + rise + 2.1, -0.08, 0.19, pale);
  box(out, 'stone', -0.76, 0.76, cornice + rise + 1.34, cornice + rise + 1.55, -0.08, 0.19, pale);
  const back = facade(xz(P(0, 0, -2.39)), F.along);
  for (const [u, w, h] of [
    [-13.5, 3.21, 6.73],
    [0, 3.35, 7.48],
    [13.51, 3.22, 6.73],
  ]) {
    verticalFace(out, 'dark', back, u - w / 2, u + w / 2, 0.91, 1 + h, 0.085, door);
    if (detail > 0) {
      fbox(
        out,
        'stone',
        back,
        u - w / 2 - 0.16,
        u - w / 2 + 0.04,
        0.85,
        1 + h + 0.13,
        0.04,
        0.32,
        pale,
      );
      fbox(
        out,
        'stone',
        back,
        u + w / 2 - 0.03,
        u + w / 2 + 0.16,
        0.85,
        1 + h + 0.13,
        0.04,
        0.32,
        pale,
      );
      fbox(
        out,
        'stone',
        back,
        u - w / 2 - 0.29,
        u + w / 2 + 0.3,
        1 + h,
        1 + h + 0.24,
        0.042,
        0.153,
        pale,
      );
    }
  }
}

function building(out, detail) {
  for (const [name, shell, eave] of [
    ['nave', site.nave, 14.78],
    ['transept', site.transept, 20.31],
    ['apse', site.apse, 16.02],
  ]) {
    for (const [r, ...holes] of shell) {
      const outer = name === 'transept' ? r.filter((p) => p.every(Number.isFinite)) : r;
      extrude(out, 'wall', outer, -0.91, eave, wall, { holes, topSlot: 'tile', topColor: clay });
    }
  }
  box(out, 'wall', -17.32, 17.61, 13.44, 24.37, -107.66, -0.14, wall);
  gableRoof(out, 'tile', xz(P(0.14, 0, -107.58)), xz(P(0.14, 0, -0.43)), 34.5, 24.35, 31.38, clay, {
    overhang: 0.28,
    endSlot: 'wall',
    endColor: wall,
  });
  for (const [u, U, y, Y] of [
    [-37.36, -17.24, 14.58, 19.97],
    [33.2, 17.61, 14.6, 19.97],
  ]) {
    const rim = [P(u, y, -102.98), P(u, y, -12.11), P(U, Y, -12.11), P(U, Y, -102.98)];
    if (U < u) rim.reverse();
    quad4(out, 'tile', ...rim, clay);
  }
  gableRoof(
    out,
    'tile',
    xz(P(-37.68, 0, -121.56)),
    xz(P(36.37, 0, -122.18)),
    24.43,
    20.22,
    27.58,
    clay,
    { overhang: 0.21, endSlot: 'wall', endColor: wall },
  );
  if (detail > 0) {
    for (const [s, u, y] of [
      [-1, -17.34, 19.74],
      [1, 17.64, 19.74],
      [-1, -37.61, 9.93],
      [1, 33.31, 9.93],
    ]) {
      const f = facade(
        xz(P(u, 0, -54.63)),
        F.normal.map((v) => -s * v),
      );
      for (let i = 0; i < 13; i++) {
        const run = -42.01 + 7.13 * i,
          w = y > 15 ? 1.86 : 1.26;
        if (detail === 1 && i % 2 === 1) continue;
        if (detail > 1)
          opening(out, f, run, y, w, 3.35, {
            head: 'round',
            glassSlot: 'dark',
            frameSlot: 'stone',
            glass: dark,
            frame: stone,
            frameWidth: 0.13,
            mullions: detail > 2 ? 1 : 0,
          });
        else verticalFace(out, 'dark', f, run - w / 2, run + w / 2, y, y + 3.15, 0.08, dark);
      }
    }
  }
}

function northernPortico(out, detail) {
  for (const [ring, ...holes] of site.northPortico)
    extrude(out, 'stone', ring, 13.56, 14.4, pale, { holes, topSlot: 'tile', topColor: clay });
  if (detail > 0) {
    for (const u of [-50.98, -46.43])
      for (let i = 0; i < 6; i++)
        shaft(out, u, -132.02 + i * 5.03, 0.99, 13.57, 0.54, detail, pale);
    box(out, 'paving', -52.61, -37.49, -0.51, 0.99, -134.72, -104.07, soil);
  } else {
    box(out, 'wall', -51.05, -50.23, 0.61, 13.59, -133.22, -132.33, wall);
    box(out, 'wall', -51.05, -50.23, 0.61, 13.59, -107.1, -106.21, wall);
  }
}

function belfry(out, detail) {
  const u = -0.14,
    d = -155.27,
    center = xz(P(u, 0, d));
  box(out, 'wall', u - 6.61, u + 6.61, 2.09, 30.02, d - 6.25, d + 6.26, wall);
  for (const [y, w] of [
    [17.88, 6.83],
    [22.76, 6.77],
    [29.79, 6.93],
  ]) {
    if (detail === 0 && y === 17.88) continue;
    box(out, 'stone', u - w, u + w, y, y + 0.44, d - w, d + w, pale);
  }
  const r = 5.11;
  lathe(
    out,
    'stone',
    center,
    [
      [30.06, r, r],
      [31.25, r * 0.94, r * 0.94],
      [35.39, r * 0.92, r * 0.92],
      [36.33, r, r],
    ],
    detail > 1 ? 12 : detail ? 8 : 6,
    pale,
  );
  lathe(
    out,
    'stone',
    center,
    [
      [36.25, 3.96, 3.96],
      [37.66, 3.92, 3.92],
      [40.64, 3.78, 3.78],
      [41.29, 3.94, 3.94],
    ],
    detail > 1 ? 12 : detail ? 8 : 6,
    pale,
  );
  lathe(
    out,
    'copper',
    center,
    [
      [41.24, 3.71, 3.71],
      [42.28, 3.32, 3.32],
      [43.63, 1.85, 1.85],
      [44.48, 0.32, 0.32],
    ],
    detail > 1 ? 12 : detail ? 8 : 6,
    copper,
  );
  if (detail > 0) {
    const f = facade(
      xz(P(u, 0, d - 6.27)),
      F.along.map((v) => -v),
    );
    for (const du of [-3.64, 0, 3.63])
      opening(out, f, du, 22.9, 1.56, 4.52, {
        head: 'round',
        glassSlot: 'dark',
        frameSlot: 'stone',
        frame: pale,
        glass: dark,
        frameWidth: 0.13,
        mullions: detail > 2 ? 1 : 0,
      });
    const C = facade(
      xz(P(u, 0, d - 3.98)),
      F.along.map((v) => -v),
    );
    opening(out, C, 0, 36.93, 2.15, 2.83, {
      head: 'round',
      glassSlot: 'dark',
      frameSlot: 'stone',
      frame: pale,
      glass: dark,
      frameWidth: 0.12,
    });
  }
}

function palm(out, u, d, detail, h) {
  const center = xz(P(u, 0, d));
  lathe(
    out,
    'green',
    center,
    [[0.76, 0.31, 0.31], ...(detail ? [[h * 0.51, 0.23, 0.23]] : []), [h, 0.17, 0.17]],
    detail > 1 ? 7 : 5,
    bark,
  );
  const n = [4, 7, 9, 12][detail];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * 2 * Math.PI,
      s = Math.sin(a),
      c = Math.cos(a),
      len = 3.63 + 0.32 * Math.cos(i * 2.14);
    const p = (r, y, w) => P(u + r * c + w * s, y, d + r * s - w * c);
    const root = p(0, h, 0),
      crest = p(len * 0.55, h + 1.26, 0.01),
      end = p(len, h - 0.68, 0);
    const L = p(len * 0.57, h + 0.88, -0.63),
      R = p(len * 0.57, h + 0.88, 0.63);
    const tint = i % 3 ? leaves : hedge;
    tri(out, 'green', root, L, crest, tint);
    tri(out, 'green', L, end, crest, tint);
    tri(out, 'green', root, crest, R, tint);
    tri(out, 'green', crest, end, R, tint);
    if (detail > 1) {
      tri(out, 'green', root, p(len * 0.65, h + 0.32, -0.52), end, leaves);
      tri(out, 'green', root, end, p(len * 0.65, h + 0.32, 0.52), leaves);
    }
  }
}

function garden(out, detail) {
  const y = 0.74;
  extrude(out, 'paving', site.court, -1.95, y, soil);
  for (const [u, d] of [
    [-13.05, 12.12],
    [12.82, 12.12],
    [-13.05, 36.14],
    [12.82, 36.14],
  ]) {
    const ring = (a, b) =>
      [
        [u - a, d - b + 2],
        [u - a + 2, d - b],
        [u + a - 2, d - b],
        [u + a, d - b + 2],
        [u + a, d + b - 2],
        [u + a - 2, d + b],
        [u - a + 2, d + b],
        [u - a, d + b - 2],
      ].map((q) => xz(P(q[0], 0, q[1])));
    const clip = ring(9.61, 9.24);
    extrude(out, 'green', clip, y - 0.02, y + 0.033, lawn);
    if (detail)
      extrude(out, 'green', clip, y + 0.051, y + 0.45, hedge, { holes: [ring(9.2, 8.81)] });
    if (detail || u * d > 0) palm(out, u, d, detail, 14.42 + (0.19 * u) / 12);
  }
  box(out, 'paving', -1.39, 1.39, y, 1.09, 22.14, 25.42, stone);
  box(out, 'stone', -0.91, 0.91, 1.08, 3.14, 22.56, 25.03, pale);
  lathe(
    out,
    'stone',
    xz(P(0.03, 0, 23.9)),
    [
      [3.16, 0.78, 0.57],
      ...(detail
        ? [
            [4.22, 0.77, 0.55],
            [5.09, 0.63, 0.46],
            [5.91, 0.64, 0.43],
            [6.14, 0.32, 0.31],
            [6.62, 0.28, 0.24],
          ]
        : [[5.91, 0.64, 0.43]]),
      [6.79, 0.15, 0.14],
    ],
    detail > 1 ? 10 : 5,
    pale,
  );
  if (detail > 0) beam(out, 'stone', P(0.66, 4.19, 24.41), P(1.38, 7.07, 24.4), 0.12, 0.095, pale);
}
function build(sink, detail) {
  const out = withFootprintCaps(sink);
  building(out, detail);
  northernPortico(out, detail);
  belfry(out, detail);
  gallery(out, detail);
  garden(out, detail);
  westFacade(out, detail);
}
export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = buildCloseup;
