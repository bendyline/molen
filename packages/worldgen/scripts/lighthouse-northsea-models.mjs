/** North Atlantic light stations with individually documented envelopes and equipment. */
import { beam, loft, normalFor, sphere } from './authored-structure-mesh.mjs';
import {
  facadeBlock,
  hipRoof,
  lighthouseStudy,
  ring,
  shell,
} from './lighthouse-expansion-models.mjs';
import { lathe, panel, railRing, transformed } from './lighthouse-models.mjs';
import { box, quad, tube } from './structure-mesh.mjs';

const white = [0.87, 0.86, 0.8],
  black = [0.085, 0.105, 0.11],
  red = [0.64, 0.11, 0.07];
const p = (r, y, a) => [Math.sin(a) * r, y, Math.cos(a) * r];
function lanternGlass(out, y0, y1, r, frame, n = 16, diagonal = false) {
  for (let i = 0; i < n; i++) {
    const a = (i * Math.PI * 2) / n,
      b = ((i + 1) * Math.PI * 2) / n,
      ps = [p(r, y0, a), p(r, y0, b), p(r, y1, b), p(r, y1, a)];
    quad(out, 'glass', ps, normalFor(...ps.slice(0, 3)), [0.23, 0.32, 0.34]);
    tube(out, 'metal', ps[0], ps[3], 0.027, frame, 8);
    if (diagonal) {
      const m = p(r, (y0 + y1) / 2, (a + b) / 2);
      tube(out, 'metal', ps[0], m, 0.023, frame, 8);
      tube(out, 'metal', m, ps[2], 0.023, frame, 8);
      tube(out, 'metal', ps[1], m, 0.023, frame, 8);
      tube(out, 'metal', m, ps[3], 0.023, frame, 8);
    }
  }
  for (const y of [y0, (y0 + y1) / 2, y1])
    ring(out, 'metal', y, r - 0.04, r + 0.04, 0.06, frame, 96);
}
function steps(
  out,
  { count = 7, height = 1.4, run = 2.8, z = 3, width = 1.8, color = white, rail = red },
) {
  for (let i = 0; i < count; i++)
    box(
      out,
      'concrete',
      [-width / 2, 0, z + (i * run) / count],
      [width / 2, height * (1 - i / count), z + ((i + 1) * run) / count],
      color,
    );
  for (const x of [-width / 2 - 0.08, width / 2 + 0.08]) {
    tube(out, 'metal', [x, height + 0.9, z], [x, 0.9, z + run], 0.027, rail, 8);
    for (let i = 0; i <= count; i += Math.ceil(count / 3))
      tube(
        out,
        'metal',
        [x, height * (1 - i / count), z + (i * run) / count],
        [x, height * (1 - i / count) + 0.9, z + (i * run) / count],
        0.03,
        rail,
        8,
      );
  }
}
function gable(out, rx, rz, y, rise, wall = white) {
  for (const s of [-1, 1]) {
    const ps =
      s > 0
        ? [
            [-rx, y, rz],
            [rx, y, rz],
            [rx, y + rise, 0],
            [-rx, y + rise, 0],
          ]
        : [
            [rx, y, -rz],
            [-rx, y, -rz],
            [-rx, y + rise, 0],
            [rx, y + rise, 0],
          ];
    quad(out, 'slate', ps, normalFor(...ps.slice(0, 3)), [0.13, 0.17, 0.2]);
    const points =
      s > 0
        ? [
            [rx, y, rz],
            [rx, y, -rz],
            [rx, y + rise, 0],
          ]
        : [
            [-rx, y, -rz],
            [-rx, y, rz],
            [-rx, y + rise, 0],
          ];
    out.addTriangle(
      'lap',
      'palette:#fff',
      points,
      normalFor(...points),
      points.map((q) => [q[2], q[1]]),
      wall,
    );
    for (const z of [-rz, rz])
      beam(out, 'wood', [s * rx, y, z], [s * rx, y + rise, 0], 0.13, 0.16, wall);
  }
}

export function buildFlannan(out) {
  const ochre = [0.71, 0.55, 0.29],
    stone = [0.49, 0.49, 0.42],
    steel = [0.55, 0.6, 0.58];
  // Exact L-shaped keeper footprint, with tower clasping the north-east corner.
  facadeBlock(out, {
    cx: -10.0,
    cz: 1.421,
    rx: 7.288,
    rz: 2.04,
    y0: 0,
    y1: 4.15,
    slot: 'ashlar',
    color: white,
    windows: [
      { face: 2, x: -4.9, y: 0.25, w: 1.05, h: 2.25, trim: 0.16 },
      { face: 2, x: -1.1, y: 1.2, w: 1.0, h: 1.55, trim: 0.16 },
      { face: 2, x: 2.5, y: 1.2, w: 1, h: 1.55, trim: 0.16 },
      { face: 2, x: 5.9, y: 1.2, w: 1, h: 1.55, trim: 0.16 },
      { face: 0, x: -5.2, y: 1.2, w: 1.05, h: 1.55, trim: 0.16 },
      { face: 0, x: -2.5, y: 0.22, w: 1.08, h: 2.3, trim: 0.16 },
    ],
  });
  facadeBlock(out, {
    cx: -6.532,
    cz: 7.39,
    rx: 6.311,
    rz: 3.93,
    y0: 0,
    y1: 4.15,
    slot: 'ashlar',
    color: white,
    windows: [
      ...[-4.0, 0, 4.0].map((x) => ({ face: 0, x, y: 1.13, w: 1.08, h: 1.65, trim: 0.17 })),
      { face: 1, x: -1.6, y: 0.2, w: 1.0, h: 2.25, trim: 0.16 },
      { face: 1, x: 1.7, y: 1.2, w: 1.05, h: 1.55, trim: 0.16 },
    ],
  });
  for (const [x0, x1, z0, z1] of [
    [-17.29, -2.71, -0.62, 3.46],
    [-12.844, -0.221, 3.46, 11.32],
  ]) {
    box(out, 'limestone', [x0 - 0.12, 4.1, z0 - 0.12], [x1 + 0.12, 4.32, z1 + 0.12], ochre);
    for (const z of [z0 + 0.05, z1 - 0.05])
      box(out, 'plaster', [x0, 4.32, z - 0.12], [x1, 4.65, z + 0.12], white);
    for (const x of [x0 + 0.05, x1 - 0.05])
      box(out, 'plaster', [x - 0.12, 4.32, z0], [x + 0.12, 4.65, z1], white);
  }
  // Ochre raised opening margins are visible primary-photo identity details.
  for (const x of [-10.532, -6.532, -2.532]) {
    for (const xx of [x - 0.63, x + 0.63])
      box(out, 'limestone', [xx - 0.09, 1.03, 11.27], [xx + 0.09, 2.88, 11.44], ochre);
    for (const yy of [1.04, 2.83])
      box(out, 'limestone', [x - 0.75, yy, 11.26], [x + 0.75, yy + 0.13, 11.44], ochre);
  }
  shell(out, {
    profile: [
      [0, 2.887],
      [14.75, 2.38],
    ],
    slot: 'ashlar',
    color: white,
    segments: 144,
    holes: [
      { angle: Math.PI / 2, y: 0.35, w: 1.1, h: 2.4, blind: true, trimColor: ochre },
      { angle: Math.PI / 2, y: 7.4, w: 0.9, h: 1.75, blind: true, trimColor: ochre },
      { angle: Math.PI / 2, y: 12.2, w: 0.85, h: 1.55, grid: true, trimColor: ochre },
    ],
  });
  lathe(
    out,
    'plaster',
    [
      [14.3, 2.4],
      [14.5, 2.58],
      [14.72, 2.75],
      [14.92, 3.03],
      [15.15, 3.12],
      [15.36, 3.12],
    ],
    white,
    128,
  );
  ring(out, 'metal', 15.36, 2.45, 3.2, 0.15, ochre, 128);
  shell(out, {
    profile: [
      [15.51, 2.46],
      [17.35, 2.46],
    ],
    slot: 'metal',
    color: ochre,
    segments: 128,
  });
  // Small circular watchroom portholes, rather than oversized conventional windows.
  for (let i = 0; i < 12; i++) {
    const o = transformed(out, (i * Math.PI) / 6),
      y = 16.55;
    sphere(o, 'glass', [0, y, 2.475], [0.083, 0.083, 0.025], black, 16, 8);
  }
  railRing(out, 15.52, 3.09, 0.92, ochre, 64);
  for (let i = 0; i < 64; i++)
    tube(
      out,
      'metal',
      p(3.09, 15.56, (i * Math.PI) / 32 + 0.024),
      p(3.09, 16.43, (i * Math.PI) / 32 + 0.024),
      0.016,
      ochre,
      6,
    );
  ring(out, 'metal', 17.35, 2.38, 3.07, 0.12, black, 96);
  railRing(out, 17.47, 3.0, 0.83, black, 40);
  for (let i = 0; i < 20; i++)
    beam(
      transformed(out, (i * Math.PI) / 10),
      'metal',
      [0, 16.86, 2.48],
      [0, 17.34, 2.98],
      0.065,
      0.09,
      black,
    );
  lanternGlass(out, 17.5, 21.58, 2.45, black, 16, true);
  ring(out, 'metal', 19.55, 2.41, 2.62, 0.07, black, 96);
  lathe(
    out,
    'metal',
    [
      [21.58, 2.48],
      [21.68, 2.69],
      [21.85, 2.64],
      [22.14, 2.3],
      [22.4, 1.76],
      [22.6, 0.85],
      [22.67, 0.18],
    ],
    black,
    128,
  );
  sphere(out, 'metal', [0, 22.78, 0], [0.16, 0.15, 0.16], black, 24, 12);
  tube(out, 'metal', [0, 22.89, 0], [0, 23, 0], 0.023, black, 8);
  railRing(out, 22.02, 1.3, 0.67, black, 16);
  // Roof-level south gantry: open lower braces, two banks of solar panels and accessible end railings.
  for (const x of [-12.2, -8.45, -4.7, -0.95]) {
    for (const z of [11.75, 13.15]) beam(out, 'metal', [x, 0, z], [x, 4.7, z], 0.11, 0.11, steel);
    beam(out, 'metal', [x, 4.6, 10.95], [x, 4.6, 13.5], 0.16, 0.16, steel);
  }
  for (const y of [1.1, 4.6])
    beam(out, 'metal', [-12.2, y, 13.15], [-0.95, y, 13.15], 0.12, 0.12, steel);
  for (const x of [-12.2, -8.45, -4.7])
    beam(out, 'metal', [x, 0.3, 13.15], [x + 3.75, 4.6, 13.15], 0.08, 0.08, steel);
  for (let i = 0; i < 10; i++) {
    const x = -11.95 + i * 1.08 + (i >= 7 ? 0.35 : 0),
      a = [x, 4.72, 13.3],
      b = [x + 0.98, 4.72, 13.3],
      c = [x + 0.98, 6.45, 12.7],
      d = [x, 6.45, 12.7],
      ps = [a, b, c, d];
    quad(out, 'glass', ps, normalFor(...ps.slice(0, 3)), [0.105, 0.17, 0.23]);
    quad(out, 'metal', [d, c, b, a], normalFor(d, c, b), steel);
    for (const [p0, p1] of [
      [a, b],
      [b, c],
      [c, d],
      [d, a],
    ])
      beam(out, 'metal', p0, p1, 0.035, 0.04, steel);
    for (let j = 1; j < 6; j++)
      beam(
        out,
        'metal',
        [x, 4.72 + (1.73 * j) / 6, 13.3 - (0.6 * j) / 6],
        [x + 0.98, 4.72 + (1.73 * j) / 6, 13.3 - (0.6 * j) / 6],
        0.012,
        0.016,
        steel,
      );
  }
  // Compact boundary follows the tower court, not the whole steep island slope.
  for (const [a, b] of [
    [
      [-18.8, 0, -4.4],
      [4.25, 0, -4.4],
    ],
    [
      [4.25, 0, -4.4],
      [4.25, 0, 14.6],
    ],
    [
      [-18.8, 0, -4.4],
      [-18.8, 0, 14.6],
    ],
    [
      [-18.8, 0, 14.6],
      [-16, 0, 14.6],
    ],
    [
      [-13.8, 0, 14.6],
      [4.25, 0, 14.6],
    ],
  ]) {
    beam(
      out,
      'rubble',
      a.map((v, i) => (i === 1 ? 1 : v)),
      b.map((v, i) => (i === 1 ? 1 : v)),
      0.5,
      2,
      stone,
    );
    beam(
      out,
      'granite',
      a.map((v, i) => (i === 1 ? 2.03 : v)),
      b.map((v, i) => (i === 1 ? 2.03 : v)),
      0.65,
      0.18,
      [0.58, 0.57, 0.47],
    );
  }
  for (const x of [-16, -13.8])
    box(out, 'rubble', [x - 0.37, 0, 14.24], [x + 0.37, 2.38, 14.96], stone);
}

export function buildSlettnes(out) {
  const iron = [0.68, 0.13, 0.085],
    bronze = [0.32, 0.18, 0.08];
  lathe(
    out,
    'concrete',
    [
      [0, 5],
      [0.52, 5],
      [0.75, 4.81],
    ],
    white,
    144,
  );
  const profile = [
      [0.75, 4.76],
      [17.2, 3.36],
      [21.1, 3.03],
      [25.2, 2.68],
      [29.1, 2.35],
      [35.1, 1.84],
    ],
    radius = (y) => 4.76 - ((y - 0.75) * 2.92) / 34.35;
  const color = (y) => ((y >= 17.2 && y < 21.1) || (y >= 25.2 && y < 29.1) ? white : iron);
  const holes = [3.7, 7.5, 11.3, 15.1, 18.9, 22.7, 26.5, 30.3, 33.1].map((y) => ({
    angle: 0,
    y,
    w: 0.48,
    h: 1.13,
    depth: 0.16,
    trimSlot: 'metal',
    trimColor: color(y),
    grid: false,
  }));
  holes.push({
    angle: Math.PI,
    y: 1.38,
    w: 1.02,
    h: 2.31,
    depth: 0.17,
    trimSlot: 'metal',
    trimColor: iron,
    pediment: true,
  });
  shell(out, { profile, holes, slot: 'metal', color, segments: 160 });
  for (const h of holes.filter((h) => h.angle === 0))
    for (const y of [h.y + 0.38, h.y + 0.76])
      beam(
        out,
        'metal',
        [-0.24, y, radius(y) - 0.12],
        [0.24, y, radius(y) - 0.12],
        0.028,
        0.033,
        color(y),
      );
  const entry = transformed(out, Math.PI);
  panel(entry, 'wood', -0.48, 0.48, 1.39, 3.68, 4.57, bronze);
  for (let x = -0.45; x < 0.47; x += 0.12)
    beam(entry, 'wood', [x, 1.42, 4.59], [x, 3.65, 4.59], 0.012, 0.022, [0.41, 0.25, 0.13]);
  steps(entry, { count: 7, height: 1.38, run: 2.8, z: 4.71, width: 2.3, rail: iron });
  // Subdued shallow casting joints and staggered fasteners; paint bands remain unbroken.
  for (let y = 2.2; y < 35.0; y += 1.43) {
    ring(out, 'metal', y, radius(y) - 0.017, radius(y) + 0.02, 0.024, color(y), 128);
    for (let i = 0; i < 16; i++) {
      const a = (i * Math.PI) / 8 + ((Math.floor(y / 1.43) % 2) * Math.PI) / 16;
      if (Math.abs(Math.sin(a)) < 0.12 && Math.cos(a) > 0) continue;
      sphere(
        out,
        'metal',
        p(radius(y) + 0.025, y + 0.065, a),
        [0.026, 0.026, 0.026],
        color(y),
        8,
        6,
      );
    }
  }
  lathe(
    out,
    'metal',
    [
      [35.06, 1.84],
      [35.2, 2.07],
      [35.52, 2.72],
      [35.72, 2.76],
    ],
    iron,
    128,
  );
  for (let i = 0; i < 16; i++)
    beam(
      transformed(out, (i * Math.PI) / 8),
      'metal',
      [0, 34.5, 1.9],
      [0, 35.53, 2.66],
      0.12,
      0.12,
      iron,
    );
  railRing(out, 35.75, 2.65, 0.91, iron, 40);
  lathe(
    out,
    'metal',
    [
      [35.74, 1.78],
      [36.2, 1.78],
    ],
    iron,
    96,
  );
  lanternGlass(out, 36.2, 37.76, 1.66, iron, 16);
  lathe(
    out,
    'metal',
    [
      [37.77, 1.83],
      [37.9, 1.84],
      [38.47, 0.47],
      [38.57, 0.3],
      [38.79, 0.28],
    ],
    iron,
    96,
  );
  sphere(out, 'metal', [0, 38.88, 0], [0.12, 0.12, 0.12], iron, 24, 10);
  for (const a of [-Math.PI / 2, Math.PI / 2]) {
    const o = transformed(out, a);
    box(o, 'metal', [-0.29, 36, 1.72], [0.29, 36.6, 2.0], iron);
    sphere(o, 'metal', [0, 36.45, 2.08], [0.28, 0.28, 0.1], [0.62, 0.64, 0.61], 32, 12);
  }
}

export function buildLindesnes(out) {
  const iron = [0.72, 0.09, 0.065],
    whiteMetal = [0.9, 0.89, 0.83];
  lathe(
    out,
    'concrete',
    [
      [0, 3.14],
      [0.92, 3.14],
      [1.05, 2.94],
    ],
    white,
    128,
  );
  lathe(
    out,
    'metal',
    [
      [1.03, 2.94],
      [1.15, 2.84],
      [1.24, 2.7],
    ],
    whiteMetal,
    128,
  );
  const profile = [
    [1.24, 2.7],
    [8.53, 2.1],
  ];
  shell(out, {
    profile,
    slot: 'metal',
    color: whiteMetal,
    segments: 160,
    holes: [
      {
        angle: 0,
        y: 1.45,
        w: 0.96,
        h: 2.02,
        depth: 0.16,
        trimSlot: 'metal',
        trimColor: whiteMetal,
        pediment: true,
      },
      ...[Math.PI / 2, Math.PI, -Math.PI / 2].flatMap((a) => [
        {
          angle: a,
          y: 4.2,
          w: 0.46,
          h: 0.88,
          depth: 0.12,
          trimSlot: 'metal',
          trimColor: whiteMetal,
          grid: true,
          pediment: true,
        },
        {
          angle: a,
          y: 7.02,
          w: 0.46,
          h: 0.88,
          depth: 0.12,
          trimSlot: 'metal',
          trimColor: whiteMetal,
          grid: true,
          pediment: true,
        },
      ]),
    ],
  });
  panel(out, 'wood', -0.43, 0.43, 1.45, 3.47, 2.48, [0.31, 0.16, 0.07]);
  steps(out, { height: 1.45, count: 8, run: 3.2, z: 2.83, width: 1.75, rail: iron });
  for (const y of [2.87, 4.74, 6.61, 8.47])
    ring(
      out,
      'metal',
      y,
      2.7 - ((y - 1.24) * 0.6) / 7.29 - 0.012,
      2.7 - ((y - 1.24) * 0.6) / 7.29 + 0.013,
      0.019,
      whiteMetal,
      128,
    );
  // March1913 drawing: pierced cast brackets support the lower gallery. Open circles survive near views.
  for (let i = 0; i < 16; i++) {
    const o = transformed(out, (i * Math.PI) / 8);
    beam(o, 'metal', [0, 7.68, 2.16], [0, 8.48, 3.08], 0.11, 0.11, whiteMetal);
    beam(o, 'metal', [0, 8.5, 2.08], [0, 8.5, 3.18], 0.12, 0.15, whiteMetal);
    tube(o, 'metal', [0, 7.7, 2.16], [0, 8.5, 2.13], 0.052, whiteMetal, 10);
    const c = [0, 8.23, 2.54],
      r = 0.135;
    for (let j = 0; j < 24; j++)
      tube(
        o,
        'metal',
        [0, c[1] + r * Math.sin((j * Math.PI) / 12), c[2] + r * Math.cos((j * Math.PI) / 12)],
        [
          0,
          c[1] + r * Math.sin(((j + 1) * Math.PI) / 12),
          c[2] + r * Math.cos(((j + 1) * Math.PI) / 12),
        ],
        0.032,
        whiteMetal,
        8,
      );
  }
  ring(out, 'metal', 8.53, 2.02, 3.22, 0.16, iron, 128);
  railRing(out, 8.7, 3.08, 0.94, iron, 80);
  for (let i = 0; i < 80; i++)
    tube(
      out,
      'metal',
      p(3.08, 8.73, (i * Math.PI) / 40 + 0.021),
      p(3.08, 9.6, (i * Math.PI) / 40 + 0.021),
      0.02,
      iron,
      8,
    );
  lathe(
    out,
    'metal',
    [
      [8.69, 2.04],
      [10.48, 2.04],
      [10.57, 2.31],
      [10.71, 2.34],
    ],
    iron,
    128,
  );
  lanternGlass(out, 10.72, 14.15, 2.18, iron, 16);
  // External cleaning cage and four tall antenna panels follow the current museum/2020 operator views.
  for (const y of [10.8, 11.9, 13.0, 14.15, 15.0]) railRing(out, y, 2.45, 0.015, iron, 32);
  for (let i = 0; i < 16; i++)
    tube(
      out,
      'metal',
      p(2.45, 10.77, (i * Math.PI) / 8),
      p(2.45, 15.12, (i * Math.PI) / 8),
      0.025,
      iron,
      8,
    );
  for (const a of [0, Math.PI / 2, Math.PI, -Math.PI / 2])
    box(transformed(out, a), 'metal', [-0.085, 14.18, 2.49], [0.085, 15.72, 2.65], iron);
  lathe(
    out,
    'metal',
    [
      [14.15, 2.34],
      [14.26, 2.36],
      [15.27, 0.37],
      [15.34, 0.26],
      [15.59, 0.25],
    ],
    iron,
    128,
  );
  sphere(out, 'metal', [0, 15.66, 0], [0.19, 0.14, 0.19], iron, 24, 10);
  tube(out, 'metal', [0, 15.8, 0], [0, 16.1, 0], 0.025, black, 8);
  // Connected machine house: operator measured10.4x6m plan, aligned independently to mapped walls.
  const house = transformed(out, 0.157, [-1.22, 0, -7.66]);
  facadeBlock(house, {
    rx: 5.2,
    rz: 3,
    y0: 0,
    y1: 3.36,
    slot: 'lap',
    color: white,
    windows: [
      { face: 0, x: -4.25, y: 0.1, w: 1.4, h: 2.18, trim: 0.1 },
      { face: 0, x: -1.6, y: 1.1, w: 1.25, h: 1.2, trim: 0.09 },
      { face: 0, x: 2.3, y: 1.1, w: 1.25, h: 1.2, trim: 0.09 },
      { face: 2, x: -2.3, y: 1.1, w: 1.25, h: 1.2, trim: 0.09 },
      { face: 2, x: 2.6, y: 1.1, w: 1.25, h: 1.2, trim: 0.09 },
      { face: 1, x: 0, y: 1.1, w: 1.3, h: 1.35, trim: 0.09 },
      { face: 3, x: 0, y: 1.1, w: 1.3, h: 1.35, trim: 0.09 },
    ],
  });
  gable(house, 5.37, 3.15, 3.36, 1.65);
  for (const [face, xs, width, height] of [
    [0, [-1.6, 2.3], 1.25, 1.2],
    [2, [-2.3, 2.6], 1.25, 1.2],
    [1, [0], 1.3, 1.35],
    [3, [0], 1.3, 1.35],
  ]) {
    const facade = transformed(house, (face * Math.PI) / 2);
    const z = (face % 2 ? 5.2 : 3) - 0.04;
    for (const x of xs) {
      beam(facade, 'wood', [x, 1.1, z], [x, 1.1 + height, z], 0.055, 0.05, white);
      beam(
        facade,
        'wood',
        [x - width / 2, 1.1 + height * 0.76, z],
        [x + width / 2, 1.1 + height * 0.76, z],
        0.04,
        0.05,
        white,
      );
    }
  }
  const horn = transformed(house, 0, [3.9, 0, 0]);
  facadeBlock(horn, {
    rx: 1.3,
    rz: 1.28,
    y0: 4.12,
    y1: 6.0,
    slot: 'lap',
    color: white,
    windows: [{ face: 1, x: 0, y: 5.25, w: 0.5, h: 0.35, trim: 0.035 }],
  });
  hipRoof(horn, 0, 0, 1.43, 1.4, 6.0, 0.38, black, 'metal');
  const hornFront = transformed(horn, Math.PI);
  panel(hornFront, 'wood', -1.29, 1.29, 4.28, 5.97, 1.29, [0.18, 0.19, 0.17]);
  // Hollow flare on the southern machinery-house ventilator/foghorn opening.
  const rings = [];
  for (const [z, r] of [
    [1.28, 0.2],
    [1.45, 0.23],
    [1.72, 0.48],
  ])
    rings.push(
      Array.from({ length: 48 }, (_, i) => [
        Math.cos((-i * Math.PI) / 24) * r,
        5.12 + Math.sin((-i * Math.PI) / 24) * r,
        z,
      ]),
    );
  loft(hornFront, 'metal', rings, black, { cap: false });
  const innerrings = rings
    .map((q) => q.map(([x, y, z]) => [x * 0.9, 5.12 + (y - 5.12) * 0.9, z]))
    .map((q) => q.reverse());
  loft(hornFront, 'metal', innerrings, [0.025, 0.03, 0.03], { cap: false });
  // Separate paired white pressure tanks, depicted on operator south facade and attached pipes.
  for (const x of [-2.7, 2.7]) {
    tube(house, 'metal', [x - 1.6, 1.6, -4.6], [x + 1.6, 1.6, -4.6], 0.87, whiteMetal, 64);
    for (const s of [-1, 1])
      sphere(house, 'metal', [x + s * 1.6, 1.6, -4.6], [0.37, 0.87, 0.87], whiteMetal, 32, 20);
    for (const xx of [x - 1.1, x + 1.1])
      box(house, 'concrete', [xx - 0.19, 0, -5.15], [xx + 0.19, 0.95, -4.05], white);
    tube(house, 'metal', [x, 2.44, -4.6], [x, 3.2, -4.6], 0.09, whiteMetal, 16);
    tube(house, 'metal', [x, 3.2, -4.6], [x, 3.2, -2.9], 0.09, whiteMetal, 16);
  }
}

export const lighthouseNorthseaStudies = [
  lighthouseStudy({
    id: 'N0658',
    key: 'flannan_isles_lighthouse',
    title: 'Flannan Isles Lighthouse',
    wikidataId: 'Q15217844',
    build: buildFlannan,
    size: [24, 23, 21],
    smoothNormalSlots: ['trim', 'foundation', 'wall'],
    visualBrief:
      'White taper and ochre margins with an L-shaped keeper house, blocked lower tower openings, curved cornice and golden watchroom, small portholes, black diagonal lantern glazing and domed cap. Full open-braced southern solar gantry and compact walled tower court.',
    sourceFacts: {
      heightMeters: 23,
      year: 1899,
      towerBaseDiameterMeters: 5.77345,
      basis:
        'NLB and HES publish23m. HES specifies stage details, portholes, blocked lower openings and keeper-window counts. Actual arc of exact-QID OSM854321119 fits5.773m diameter; remaining L-plan comes from that outline. Dated2018 original photographer exterior views govern solar gantry and current margins.',
    },
    referencePages: [
      'https://www.nlb.org.uk/lighthouses/flannan-islands/',
      'https://portal.historicenvironment.scot/designation/LB48143',
      'https://uklighthousetour.com/2018/06/03/the-flannans-finally/',
      'https://uklighthousetour.com/wp-content/uploads/2018/06/lighthouse2.jpg',
      'https://uklighthousetour.com/wp-content/uploads/2018/06/lighthouse3.jpg',
      'https://www.openstreetmap.org/way/854321119',
    ],
    geographicProposal: {
      anchor: [-7.58816108988, 58.288165646211],
      heading: 0.200781670264,
      elevationMode: 'terrain-contact',
      status: 'preview-proposal',
      source: 'https://www.openstreetmap.org/way/854321119',
      notes:
        'Origin fitted to mapped circular tower arc, not whole-house bbox. Mapped keeper block extends southwest; HES southern solar gantry resolves quadrant. Court wall extent is reconstructed compactly around building; remote landing/stair terrain is excluded.',
    },
    limitations: [
      'Detailed exterior follows dated2018 primary photographic appearance and heritage description; individual whitewash repairs are shared material. Tower court boundary is proportioned from photographs rather than a cadastral survey. Detached chapel, island landing rails and cliff stairs remain separate site geometry.',
    ],
    qaCameras: [
      { name: 'near-lantern', position: [9, 23, 12], lookAt: [0, 19, 0] },
      { name: 'near-solar-gantry', position: [-17, 8, 25], lookAt: [-6.5, 3.7, 11.5] },
      { name: 'near-court', position: [-29, 13, 27], lookAt: [-7, 4, 5] },
      { name: 'far-ensemble', position: [35, 25, 43], lookAt: [-5, 10, 4] },
    ],
  }),
  lighthouseStudy({
    id: 'N0659',
    key: 'slettnes_lighthouse',
    title: 'Slettnes Lighthouse',
    wikidataId: 'Q385142',
    build: buildSlettnes,
    size: [10, 39, 13],
    smoothNormalSlots: ['trim', 'foundation', 'wall'],
    visualBrief:
      'Exceptionally tall red cast-iron taper with two broad white bands, shallow cast-plate seams, nine narrow three-pane windows, white concrete base and stair with mahogany door. Open bracketed red gallery, slim lantern and capped red cone.',
    sourceFacts: {
      heightMeters: 39,
      foundationDiameterMeters: 10,
      basis:
        'Kystverket2013 conservation planpp17–18 and current operator describe39m cast-iron tower, white foundation, two white bands, three vertical window panes and mahogany door. Exact-QID OSM228886593 supplies circular base extent; iron cross-sections and equipment dimensions photo-proportioned.',
    },
    referencePages: [
      'https://www.kystverket.no/kystkultur/fyrstasjoner/slettnes-fyr/',
      'https://www.kystverket.no/globalassets/om-kystverket/kystkultur/fyr/troms-og-finnmark/slettnes-forvaltningsplan-15.-november-2013_kort_just-12-10-16_red.pdf',
      'https://www.openstreetmap.org/way/228886593',
    ],
    geographicProposal: {
      anchor: [28.218231728, 71.089563944],
      heading: -Math.PI / 2,
      elevationMode: 'terrain-contact',
      status: 'preview-proposal',
      source: 'https://www.openstreetmap.org/way/228886593',
      notes:
        'Exact-QID circular tower footprint fixes anchor; operatorp18 photograph explicitly looks east, placing authored window row on western face (+Z). Entrance is reconstructed opposite this row; tower itself is rotational. Host terrain supplies rocky promontory.',
    },
    limitations: [
      'Asset is the39m tower; detached station houses and engine building are distinct mapped structures. Casting seam spacing and gallery fittings follow conservation photographs rather than a complete manufacturing drawing.',
    ],
    qaCameras: [
      { name: 'near-gallery', position: [9, 38, 12], lookAt: [0, 36.5, 0] },
      { name: 'near-windows', position: [11, 24, 15], lookAt: [0, 22, 0] },
      { name: 'near-entry', position: [11, 5, -15], lookAt: [0, 2, -4] },
      { name: 'far-silhouette', position: [46, 25, 61], lookAt: [0, 18, 0] },
    ],
  }),
  lighthouseStudy({
    id: 'N0660',
    key: 'lindesnes_lighthouse',
    title: 'Lindesnes Lighthouse',
    wikidataId: 'Q773320',
    build: buildLindesnes,
    size: [15, 16.1, 19],
    smoothNormalSlots: ['trim', 'foundation', 'wall'],
    visualBrief:
      'White short cast-iron tower on a concrete foot, north entrance stair, pedimented small windows and pierced white gallery brackets. Tall red watchroom/lantern assembly, fine cleaning cage and red antenna panels, plus connected white clapboard machinery house with slate roof, rooftop horn and twin pressure tanks.',
    sourceFacts: {
      heightMeters: 16.1,
      mainHousePlanMeters: [10.4, 6],
      year: 1915,
      basis:
        'Kystverket2020 conservation planpp19–22 contains original1913 cast-plate/section drawings and cardinally labeled photographs; p28 dimensions machinery house10.4x6m and p29 shows horn/tanks. Official lighthouse list and museum give16.1m tower. Exact-QID node31289203, tower172893413 and mapped main entrance7453360612 establish position and azimuth.',
    },
    referencePages: [
      'https://www.kystverket.no/globalassets/om-kystverket/kystkultur/fyr/sorost/lindesnes-fyrstasjon_forvaltningsplan_14.-oktober-2020_red_sec_kort.pdf',
      'https://www.visitnorway.no/listings/lindesnes-fyr/16446/',
      'https://lindesnesfyr.no/en/staying-overnight/',
      'https://www.openstreetmap.org/node/31289203',
      'https://www.openstreetmap.org/node/7453360612',
      'https://www.openstreetmap.org/way/172893415',
    ],
    geographicProposal: {
      anchor: [7.0466733, 57.9824978],
      heading: -3.064754643641,
      elevationMode: 'terrain-contact',
      status: 'preview-proposal',
      source: 'https://www.openstreetmap.org/node/7453360612',
      notes:
        'Exact-QID node is the tower center. Measured vector to mapped main entrance fixes authored+Z north-slightly-west. Machinery house is independently rotated0.157rad to its mapped walls and extends south. Host terrain supplies the coastal rock contact.',
    },
    limitations: [
      'Exterior components use conservation drawings and2020 operator/museum appearance; exact bolt instances and internal lens mechanism are omitted at this shared-style exterior scope. Site houses farther down the rock and old beacon ruin are separate structures.',
    ],
    qaCameras: [
      { name: 'near-gallery', position: [8, 12, 11], lookAt: [0, 9.4, 0] },
      { name: 'near-lantern', position: [7, 16, 9], lookAt: [0, 13.1, 0] },
      { name: 'near-machine-house', position: [14, 9, -23], lookAt: [-1, 3, -8] },
      { name: 'far-ensemble', position: [27, 18, 33], lookAt: [0, 7, -3] },
    ],
  }),
];
