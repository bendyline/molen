/** Vera Mukhina's stainless-steel pair and the present VDNH exhibition pavilion. */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import {
  beam,
  cross,
  normalFor,
  normalize,
  sphere,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { tubePath } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';
const earcut = createRequire(
  new URL('../../../../../../../../packages/worldgen/package.json', import.meta.url),
)('earcut').default;
export const layout = JSON.parse(readFileSync(new URL('../layout.json', import.meta.url)));
const colors = {
  limestone: 'c1b9a8',
  ivory: 'cec7ba',
  ledge: 'aaa9a0',
  joint: 'a2998d',
  rose: '967a73',
  paleRose: 'ad9588',
  darkRose: '6d514b',
  red: '82635c',
  paving: 'a3988b',
  glass: '85989c',
  blueGlass: '6e858b',
  darkGlass: '60777c',
  frame: '8d8d81',
  reveal: '5c5b56',
  bronze: '55655e',
  bronzeLight: '6d7770',
  bronzeDark: '46544f',
  steel: 'abb0ad',
  lightSteel: 'b8bcb9',
  seam: '8d9491',
};
const rgb = Object.fromEntries(
  Object.entries(colors).map(([key, hex]) => [
    key,
    hex.match(/../g).map((pair) => {
      const value = parseInt(pair, 16) / 255;
      return value <= 0.04045 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
    }),
  ]),
);
export const surfaces = {
  granite: { slot: 'foundation', graph: 'stone_granite', roughness: 0.74 },
  limestone: { slot: 'wall', graph: 'stone_limestone', roughness: 0.82 },
  steel: { slot: 'trim', graph: 'metal_stainless', roughness: 0.34, metallic: 0.7 },
  bronze: { slot: 'trim', graph: 'metal_bronze_cast', roughness: 0.67, metallic: 0.35 },
  glass: { slot: 'window', graph: 'window_grid', roughness: 0.16, metallic: 0.15 },
};
const tier = { skyline: 0, district: 1, street: 2, closeup: 3, master: 4 };
const TAU = 2 * Math.PI,
  UP = [0, 1, 0],
  DOWN = [0, -1, 0],
  FRONT = [0, 0, 1];
const add = (a, b) => a.map((v, i) => v + b[i]),
  sub = (a, b) => a.map((v, i) => v - b[i]);
const scale = (a, s) => a.map((v) => v * s),
  dot = (a, b) => a.reduce((n, v, i) => n + v * b[i], 0);
const mix = (a, b, t) => a + (b - a) * t;
const average = (ps) => ps[0].map((_, i) => ps.reduce((n, p) => n + p[i], 0) / ps.length);

function tri(out, slot, tint, points, direction) {
  let normal = normalFor(...points);
  if (Math.hypot(...normal) < 0.99) return;
  if (direction && dot(normal, direction) < 0) {
    points = points.toReversed();
    normal = scale(normal, -1);
  }
  out.addTriangle(slot, '', points, normal, undefined, rgb[tint]);
}
function quad(out, slot, tint, [a, b, c, d], direction) {
  tri(out, slot, tint, [a, b, c], direction);
  tri(out, slot, tint, [a, c, d], direction);
}
function cap(out, slot, tint, ring, height, wanted) {
  const indices = earcut(ring.flat());
  for (let i = 0; i < indices.length; i += 3)
    tri(
      out,
      slot,
      tint,
      indices.slice(i, i + 3).map((k) => [ring[k][0], height, ring[k][1]]),
      wanted,
    );
}
function prism(out, slot, tint, ring, low, high) {
  const signed = ring.reduce((n, p, i) => {
    const q = ring[(i + 1) % ring.length];
    return n + p[0] * q[1] - p[1] * q[0];
  }, 0);
  for (const [i, a] of ring.entries()) {
    const b = ring[(i + 1) % ring.length],
      n = scale([b[1] - a[1], 0, a[0] - b[0]], Math.sign(signed));
    quad(
      out,
      slot,
      tint,
      [
        [a[0], low, a[1]],
        [b[0], low, b[1]],
        [b[0], high, b[1]],
        [a[0], high, a[1]],
      ],
      n,
    );
  }
  cap(out, slot, tint, ring, high, UP);
  cap(out, slot, tint, ring, low, DOWN);
}
const rect = (x0, z0, x1, z1) => [
  [x0, z0],
  [x1, z0],
  [x1, z1],
  [x0, z1],
];
function box(out, slot, tint, x0, y0, z0, x1, y1, z1) {
  prism(out, slot, tint, rect(x0, z0, x1, z1), y0, y1);
}
function wall(side, x, y0, z0, y1, z1) {
  return [
    [side * x, y0, z0],
    [side * x, y0, z1],
    [side * x, y1, z1],
    [side * x, y1, z0],
  ];
}
function steps(out, d) {
  const { halfWidth, frontZ, bottomZ, topY, risers } = layout.porch;
  const grouping = d === 0 ? 7 : d === 1 ? 2 : 1;
  for (let k = 0; k < risers; k += grouping) {
    const top = topY * (1 - k / risers),
      z0 = mix(frontZ, bottomZ, k / risers),
      z1 = mix(frontZ, bottomZ, (k + grouping) / risers);
    box(
      out,
      'granite',
      k % 2 ? 'paving' : 'ledge',
      -halfWidth,
      layout.datumToGround,
      z0,
      halfWidth,
      top,
      z1,
    );
    if (d >= 2)
      box(
        out,
        'granite',
        'paving',
        -halfWidth - 0.035,
        top - 0.073,
        z1 - 0.09,
        halfWidth + 0.035,
        top + 0.018,
        z1 + 0.027,
      );
  }
  if (d >= 1)
    for (const side of [-1, 1]) {
      const a = side * 7.21,
        b = side * 7.87;
      for (let i = 0; i < 4; i++) {
        const z = mix(frontZ, 26.3, i / 4),
          end = mix(frontZ, 26.3, (i + 1) / 4);
        box(
          out,
          'granite',
          'darkRose',
          Math.min(a, b),
          -2.15,
          z,
          Math.max(a, b),
          3.06 - i * 0.62,
          end,
        );
      }
    }
}
function glazedBay(out, side, x, z0, z1, y0, y1, tint) {
  const ps = wall(side, x, y0, z0, y1, z1);
  const right = side === 1 ? ps.toReversed() : ps;
  out.addQuad(
    'glass',
    'metric:uv',
    right,
    [side, 0, 0],
    [
      [0.055, 0.11],
      [0.945, 0.11],
      [0.945, 0.89],
      [0.055, 0.89],
    ],
    rgb[tint],
  );
}
function gallery(out, d) {
  box(out, 'limestone', 'limestone', -11.923, 1.72, -51.06, 10.957, 18.42, -4.76);
  box(out, 'limestone', 'ivory', -7.946, 0.4, -56.11, 7.204, 18.13, -51.055);
  box(out, 'limestone', 'limestone', -10.58, 16.94, -32.08, 9.61, 20.58, -5.82);
  for (const [y0, y1, w, z0, z1, tint] of [
    [17.37, 17.66, 0.18, -51.22, -4.51, 'ledge'],
    [18.04, 18.48, 0.27, -51.41, -4.32, 'ivory'],
    [18.6, 19.09, 0.59, -51.8, -4.05, 'limestone'],
    [19.32, 19.81, 0.88, -52.08, -3.8, 'ivory'],
    [20.36, 20.81, -0.77, -32.45, -5.62, 'ledge'],
    [21.02, 21.42, -0.55, -32.67, -5.42, 'ivory'],
  ]) {
    if (d === 0 && y0 !== 19.32 && y0 !== 21.02) continue;
    box(out, 'limestone', tint, -11.923 - w, y0, z0, 10.957 + w, y1, z1);
  }
  if (d === 0) return;
  const bays = d === 1 ? 3 : 7;
  for (const side of [-1, 1]) {
    const x = side === 1 ? 10.96 : 11.928,
      n = [side, 0, 0];
    const steps = [
      [-49.45, -42.2, 13.3],
      [-42.2, -35.65, 11.43],
      [-35.65, -28.65, 9.56],
      [-28.65, -21.6, 7.55],
      [-21.6, -11.05, 5.79],
    ];
    for (const [z0, z1, low] of steps) {
      quad(
        out,
        'limestone',
        'reveal',
        wall(side, x + 0.021, low - 0.22, z0 - 0.1, 16.48, z1 + 0.1),
        n,
      );
      for (let i = 0; i < bays; i++) {
        const a = mix(z0, z1, i / bays),
          b = mix(z0, z1, (i + 1) / bays);
        const rows = d === 1 ? 1 : Math.max(1, Math.round((16.22 - low) / 2.66));
        for (let j = 0; j < rows; j++)
          glazedBay(
            out,
            side,
            x + 0.044,
            a + 0.036,
            b - 0.036,
            mix(low, 16.22, j / rows) + 0.035,
            mix(low, 16.22, (j + 1) / rows) - 0.035,
            (i + j) % 6 === 1 ? 'blueGlass' : 'glass',
          );
        if (d >= 2) {
          const c = side * (x + 0.063);
          box(out, 'limestone', 'frame', c - 0.047, low, a - 0.024, c + 0.047, 16.23, a + 0.043);
        }
      }
      const center = side * (x + 0.11);
      box(
        out,
        'limestone',
        'ivory',
        center - 0.22,
        low - 0.19,
        z0 - 0.11,
        center + 0.22,
        low + 0.055,
        z1 + 0.11,
      );
    }
    if (d >= 2)
      for (const h of [2.7, 3.15, 16.63, 17.02]) {
        const a = side * (x + 0.08);
        box(out, 'limestone', 'ledge', a - 0.14, h, -50.95, a + 0.14, h + 0.14, -5.11);
      }
  }
  for (const x of [-6.65, -4.24, -1.83, 0.58, 2.99, 5.4]) {
    box(out, 'limestone', 'ledge', x - 0.21, 2.4, -56.23, x + 0.21, 17.55, -56.04);
    if (d >= 2) {
      quad(
        out,
        'glass',
        'darkGlass',
        [
          [x + 0.44, 5.25, -56.152],
          [x + 1.37, 5.25, -56.152],
          [x + 1.37, 16.38, -56.152],
          [x + 0.44, 16.38, -56.152],
        ],
        [0, 0, -1],
      );
      box(out, 'limestone', 'ivory', x + 1.68, 2.62, -56.37, x + 1.88, 17.81, -56.08);
    }
  }
}
const tower = [
  [-5.71, 2.17, -15.86, 5.42, 25.45, 10.84],
  [-5.71, 25.42, -12.57, 5.42, 29.36, 10.84],
  [-5.55, 29.34, -9.63, 5.27, 32.27, 10.7],
  [-4.67, 32.23, -8.14, 4.38, 34.5, 10.52],
];
function stoneFacing(out, d) {
  for (const [x0, y0, z0, x1, y1, z1] of tower) {
    box(out, 'granite', d === 0 ? 'limestone' : 'joint', x0, y0, z0, x1, y1, z1);
    if (d === 0) continue;
    const ny = Math.ceil((y1 - y0) / (d === 1 ? 2.05 : 0.83));
    for (let row = 0; row < ny; row++) {
      const low = mix(y0, y1, row / ny) + 0.016,
        high = mix(y0, y1, (row + 1) / ny) - 0.017;
      for (let f = 0; f < 4; f++) {
        const a = [x0, z0],
          b = [x1, z0],
          c = [x1, z1],
          e = [x0, z1],
          corners = [a, b, c, e];
        const q = corners[f],
          r = corners[(f + 1) % 4],
          dx = r[0] - q[0],
          dz = r[1] - q[1];
        const n = normalize([dz, 0, -dx]),
          count = Math.ceil(Math.hypot(dx, dz) / (d === 1 ? 3.2 : 1.62));
        for (let i = 0; i < count; i++) {
          const u = (i + 0.015) / count,
            v = (i + 0.985) / count,
            offset = 0.027 + (d >= 3 ? 0.017 * Math.abs(Math.sin(i * 2.5 + row * 1.7)) : 0.0);
          const at = (t, y) => [
            mix(q[0], r[0], t) + n[0] * offset,
            y,
            mix(q[1], r[1], t) + n[2] * offset,
          ];
          const sample = (1 + Math.sin(i * 7.12 + row * 3.77 + f * 1.53)) / 2;
          const transition = (low - 4.0) / 22;
          const tint =
            low < 9 && sample > transition + 0.1
              ? 'red'
              : sample > transition + 0.34
                ? 'rose'
                : sample > transition + 0.12
                  ? 'paleRose'
                  : sample < 0.36
                    ? 'ivory'
                    : 'limestone';
          quad(out, 'granite', tint, [at(u, low), at(v, low), at(v, high), at(u, high)], n);
        }
      }
    }
  }

  box(out, 'granite', 'darkRose', -7.2, 2.25, 8.95, 7.17, 9.7, 11.09);
  box(out, 'granite', 'red', -3.78, 3.25, 10.99, 3.77, 10.34, 11.48);
  box(out, 'granite', 'limestone', -2.68, 6.65, 11.48, 2.67, 10.15, 11.79);
  if (d > 0)
    for (const x of [-6.55, -4.94, 4.94, 6.55])
      box(out, 'granite', 'rose', x - 0.33, 2.55, 10.64, x + 0.33, 10.82, 11.41);
  if (d > 0) {
    for (const x of [-4.63, -3.28, -1.94, 1.94, 3.28, 4.63]) {
      const top = Math.abs(x) < 3 ? 33.86 : Math.abs(x) < 4 ? 32.16 : 28.67;
      box(out, 'limestone', 'ivory', x - 0.118, 10.4, 10.71, x + 0.118, top, 11.12);
    }
    for (const x of [-5.55, -2.5, -0.88, 0.88, 2.5, 5.55]) {
      const w = Math.abs(x) > 4 ? 0.64 : 0.76,
        y0 = 2.61,
        y1 = Math.abs(x) > 4 ? 5.62 : 6.26,
        z = 11.8;
      quad(
        out,
        'glass',
        'blueGlass',
        [
          [x - w, y0, z],
          [x + w, y0, z],
          [x + w, y1, z],
          [x - w, y1, z],
        ],
        FRONT,
      );
      if (d >= 2) box(out, 'limestone', 'frame', x - 0.048, y0, z - 0.02, x + 0.048, y1, z + 0.055);
    }
  }
  if (d >= 2) {
    const railing = [
      [-4.6, 34.93, -8.07],
      [-4.6, 34.93, 10.47],
      [4.32, 34.93, 10.47],
      [4.32, 34.93, -8.07],
      [-4.6, 34.93, -8.07],
    ];
    tubePath(out, 'steel', railing, 0.047, rgb.lightSteel, 5);
    for (const x of [-4.6, 4.32])
      for (let z = -7.6; z <= 10.45; z += 1.8) {
        beam(out, 'steel', [x, 34.53, z], [x, 34.94, z], 0.056, 0.056, rgb.steel);
      }
  }
}
function emblem(out, d) {
  if (d < 2) return;
  const center = [0, 8.41, 11.88],
    at = (x, y, z = 0) => add(center, [x, y, z]);
  sphere(out, 'bronze', center, [1.77, 1.47, 0.105], rgb.bronze, 18, 8);
  for (const side of [-1, 1]) {
    const curve = Array.from({ length: 14 }, (_, i) => {
      const a = (i * Math.PI) / 15 + 0.06;
      return at(side * (1.52 * Math.sin(a) + 0.13), -1.29 * Math.cos(a), 0.11);
    });
    tubePath(out, 'bronze', curve, 0.052, rgb.bronzeLight, 5);
    for (let i = 2; i < 13; i++) {
      const a = curve[i],
        b = add(a, [side * 0.17, 0.13, 0.095]);
      beam(out, 'bronze', a, b, 0.052, 0.075, rgb.bronzeLight);
      if (d >= 3)
        beam(out, 'bronze', a, add(a, [-side * 0.18, 0.147, 0.074]), 0.048, 0.058, rgb.bronzeLight);
    }
  }
  for (let i = 0; i < 13; i++) {
    const angle = (i - 6) * 0.132;
    beam(
      out,
      'bronze',
      at(Math.sin(angle) * 0.54, -0.68 + 0.54 * Math.cos(angle), 0.146),
      at(Math.sin(angle) * 1.1, -0.68 + 1.1 * Math.cos(angle), 0.145),
      0.03,
      0.04,
      rgb.bronzeLight,
    );
  }
  const star = Array.from({ length: 10 }, (_, i) => {
    const a = Math.PI / 2 + (i * TAU) / 10,
      r = i % 2 ? 0.109 : 0.245;
    return at(Math.cos(a) * r, 0.99 + Math.sin(a) * r, 0.166);
  });
  for (let i = 0; i < 10; i++)
    tri(out, 'bronze', 'bronzeLight', [at(0, 0.99, 0.206), star[i], star[(i + 1) % 10]], FRONT);
}
function relief(out, detail) {
  for (const side of [-1, 1]) {
    const x = side * 12.13;
    box(out, 'bronze', 'bronzeDark', x - 0.23, 3.1, 9.85, x + 0.23, 6.52, 22.05);
    if (detail < 2) continue;
    const people = detail === 2 ? 9 : 11;
    for (let i = 0; i < people; i++) {
      const z = 10.47 + (i * 10.75) / (people - 1),
        base = 3.26,
        height = 2.64 + 0.3 * Math.sin(i * 2.31 + side);
      const center = [x + side * 0.32, base + height * 0.54, z];
      sphere(out, 'bronze', center, [0.26, 0.7, 0.36], rgb.bronze, 6, 4);
      sphere(
        out,
        'bronze',
        [x + side * 0.36, base + height * 0.88, z + 0.09],
        [0.19, 0.28, 0.2],
        rgb.bronzeLight,
        6,
        4,
      );
      for (const leg of [-1, 1]) {
        const a = [x + side * 0.28, base + height * 0.48, z + leg * 0.16],
          b = [x + side * 0.3, base + 0.13, z + leg * 0.24 - 0.08 * Math.cos(i)];
        beam(out, 'bronze', a, b, 0.22, 0.19, rgb.bronze);
      }
      const raised = i % 4 === 2;
      for (const arm of [-1, 1]) {
        const a = [x + side * 0.3, base + height * 0.69, z + arm * 0.28];
        const elbow = [x + side * 0.43, base + height * (raised ? 0.86 : 0.51), z + arm * 0.42];
        const end = [x + side * 0.49, base + height * (raised ? 0.94 : 0.39), z + arm * 0.55];
        tubePath(out, 'bronze', [a, elbow, end], 0.097, rgb.bronzeLight, detail >= 3 ? 6 : 4);
      }
    }
  }
}
function pavilion(out, d) {
  for (const [i, ring] of layout.masks.entries())
    prism(
      out,
      'granite',
      i === 0 ? 'paving' : 'darkRose',
      ring,
      layout.datumToGround,
      i === 0 ? 1.98 : 3.1,
    );
  steps(out, d);
  gallery(out, d);
  stoneFacing(out, d);
  if (d >= 1) relief(out, d);
  emblem(out, d);
}

const figurePoint = ([x, y, z]) => [x, y + layout.sculptureY, z];
const strides = {
  worker: {
    front: [
      [-2.65, 10.16, 2.64, 1.35, 1.08],
      [-2.62, 8.92, 4.25, 1.38, 1.13],
      [-2.65, 7.09, 5.7, 1.28, 0.95],
      [-2.66, 5.4, 6.52, 1.13, 0.98],
      [-2.71, 3.78, 6.82, 0.95, 0.79],
      [-2.7, 1.31, 7.75, 0.67, 0.69],
      [-2.68, 0.31, 8.07, 0.64, 0.66],
    ],
    back: [
      [-3.02, 10.1, 1.01, 1.16, 1.04],
      [-3.08, 8.64, -1.1, 1.25, 1.03],
      [-3.1, 6.47, -3.09, 1.06, 0.97],
      [-3.16, 5.11, -4.3, 0.87, 0.77],
      [-3.21, 3.41, -5.51, 0.74, 0.72],
      [-3.28, 1.11, -7.28, 0.64, 0.58],
      [-3.29, 0.48, -7.45, 0.61, 0.54],
    ],
    high: [
      [-1.31, 15.82, 4.28, 0.94, 0.88],
      [-1.16, 17.38, 4.99, 0.94, 0.74],
      [-1.03, 18.52, 5.95, 0.75, 0.7],
      [-0.83, 20.02, 6.91, 0.66, 0.61],
      [-0.76, 21.45, 7.63, 0.47, 0.48],
      [-0.68, 22.47, 8.13, 0.44, 0.42],
      [-0.62, 22.94, 8.3, 0.57, 0.49],
    ],
    far: [
      [-3.85, 15.59, 2.79, 0.97, 0.82],
      [-4.71, 15.36, 1.04, 0.88, 0.77],
      [-5.12, 15.18, -0.67, 0.72, 0.65],
      [-5.23, 15.08, -2.12, 0.54, 0.47],
      [-5.24, 15.09, -3.54, 0.44, 0.38],
      [-5.18, 15.27, -4.71, 0.49, 0.35],
    ],
    body: [
      [9.33, -2.69, 1.87, 1.42, 1.23],
      [10.16, -2.66, 2.23, 1.56, 1.33],
      [10.91, -2.65, 2.49, 1.39, 1.14],
      [12.08, -2.66, 2.86, 1.24, 1.02],
      [13.28, -2.66, 3.12, 1.48, 1.14],
      [14.56, -2.62, 3.35, 1.76, 1.27],
      [15.49, -2.54, 3.64, 1.66, 1.19],
      [16.15, -2.52, 3.78, 1.37, 0.99],
      [16.75, -2.58, 4.04, 0.64, 0.63],
      [17.2, -2.54, 4.14, 0.6, 0.63],
    ],
    head: [-2.63, 18.34, 4.21],
    neckTwist: -0.14,
  },
  woman: {
    front: [
      [2.08, 9.81, 1.93, 1.08, 0.93],
      [2.36, 8.1, 4.36, 1.15, 0.92],
      [2.74, 6.14, 6.65, 0.93, 0.81],
      [2.82, 4.75, 7.16, 0.78, 0.73],
      [2.75, 2.96, 7.26, 0.67, 0.61],
      [2.66, 1.25, 7.86, 0.5, 0.55],
      [2.66, 0.31, 8.14, 0.48, 0.51],
    ],
    back: [
      [2.64, 9.67, 0.95, 1.02, 0.91],
      [2.75, 7.71, -1.56, 1.02, 0.93],
      [2.93, 6.34, -3.68, 0.88, 0.79],
      [2.94, 4.79, -4.61, 0.72, 0.7],
      [2.92, 2.91, -5.98, 0.58, 0.57],
      [2.91, 1.08, -7.25, 0.49, 0.52],
      [2.93, 0.31, -7.4, 0.48, 0.49],
    ],
    high: [
      [1.03, 15.28, 3.44, 0.84, 0.74],
      [0.8, 16.73, 4.48, 0.79, 0.68],
      [0.62, 17.94, 5.38, 0.65, 0.59],
      [0.44, 19.24, 6.33, 0.54, 0.51],
      [0.38, 20.79, 7.22, 0.45, 0.4],
      [0.33, 22.12, 8.1, 0.37, 0.36],
      [0.34, 22.83, 8.34, 0.48, 0.43],
    ],
    far: [
      [3.45, 15.18, 2.61, 0.78, 0.71],
      [4.27, 15.02, 1.05, 0.71, 0.62],
      [4.87, 14.72, -0.55, 0.59, 0.56],
      [5.13, 14.56, -2.06, 0.46, 0.45],
      [5.01, 14.51, -3.87, 0.36, 0.35],
      [4.62, 14.83, -5.32, 0.41, 0.34],
      [4.36, 14.96, -5.74, 0.45, 0.37],
    ],
    body: [
      [9.19, 2.51, 1.35, 1.56, 1.32],
      [10.14, 2.47, 1.87, 1.53, 1.26],
      [11.19, 2.39, 2.37, 1.2, 0.98],
      [12.15, 2.33, 2.61, 1.08, 0.95],
      [13.17, 2.26, 2.77, 1.32, 1.15],
      [14.23, 2.21, 2.96, 1.5, 1.23],
      [15.18, 2.22, 3.24, 1.41, 1.02],
      [15.89, 2.2, 3.33, 1.15, 0.8],
      [16.41, 2.21, 3.41, 0.54, 0.57],
      [16.95, 2.25, 3.49, 0.49, 0.54],
    ],
    head: [2.23, 18.09, 3.56],
    neckTwist: 0.16,
  },
};
const sides = [4, 8, 12, 17, 23];
function ribbonSkin(out, slot, tint, rings, capRings = true) {
  const N = rings[0].length;
  for (let j = 1; j < rings.length; j++)
    for (let i = 0; i < N; i++) {
      const k = (i + 1) % N,
        a = rings[j - 1][i],
        b = rings[j - 1][k],
        c = rings[j][k],
        e = rings[j][i];
      quad(out, slot, tint, [a, b, c, e]);
    }
  if (!capRings) return;
  for (const [r, reversed] of [
    [rings[0], true],
    [rings.at(-1), false],
  ]) {
    const c = average(r);
    for (let i = 0; i < N; i++) {
      const next = (i + 1) % N;
      tri(out, slot, tint, reversed ? [c, r[next], r[i]] : [c, r[i], r[next]]);
    }
  }
}
function subset(rows, d) {
  if (d >= 2) return rows;
  const n = rows.length;
  if (d === 1) return rows.filter((_, i) => i === n - 1 || i % 2 === 0);
  return rows.filter((_, i) => i === 0 || i === n - 1 || i === Math.floor(n * 0.55));
}
function sculptLimb(out, rows, d, tint = 'steel', transform = figurePoint, fold = 0.04) {
  const rs = subset(rows, d),
    N = sides[d],
    centers = rs.map(([x, y, z]) => transform([x, y, z]));
  let previous;
  const rings = centers.map((center, i) => {
    const next = centers[Math.min(i + 1, centers.length - 1)],
      before = centers[Math.max(0, i - 1)];
    const axis = normalize(sub(next, before));
    let u;
    if (previous) {
      const projected = sub(previous, scale(axis, dot(previous, axis)));
      if (Math.hypot(...projected) > 0.1) u = normalize(projected);
    }
    u ??= normalize(cross(axis, Math.abs(axis[1]) > 0.91 ? [1, 0, 0] : UP));
    previous = u;
    const v = cross(axis, u),
      width = rs[i][3],
      depth = rs[i][4] ?? width;
    return Array.from({ length: N }, (_, j) => {
      const a = (j * TAU) / N,
        k = 1 + fold * (0.75 * Math.sin(a * 3 + 0.79 * i) + 0.25 * Math.cos(a * 7 - 0.53 * i));
      return add(center, add(scale(u, width * k * Math.cos(a)), scale(v, depth * k * Math.sin(a))));
    });
  });
  ribbonSkin(out, 'steel', tint, rings);
}
function form(out, rows, d, tint, transform = figurePoint, fold = 0.045) {
  const N = sides[d];
  const rings = subset(rows, d).map(([y, x, z, w, h], i) =>
    Array.from({ length: N }, (_, j) => {
      const a = (j * TAU) / N,
        k = 1 + fold * (Math.sin(a * 3 + i * 0.53) + 0.35 * Math.cos(a * 5 - i * 0.71));
      return transform([x + w * k * Math.sin(a), y, z + h * k * Math.cos(a)]);
    }),
  );
  ribbonSkin(out, 'steel', tint, rings);
}
function face(out, model, d, worker) {
  const [x, y, z] = model.head,
    c = Math.cos(model.neckTwist),
    s = Math.sin(model.neckTwist);
  const P = ([u, v, w]) => figurePoint([x + u * c + w * s, y + v, z + w * c - u * s]);
  const q = worker ? 1.08 : 0.99,
    faceRows = [
      [-1.09, -0.015, 0.026, 0.41, 0.4],
      [-0.84, 0.004, 0.13, 0.57, 0.49],
      [-0.53, 0, 0.08, 0.69, 0.57],
      [-0.23, 0, 0.035, 0.72, 0.64],
      [0.08, 0, -0.03, 0.73, 0.64],
      [0.38, -0.026, -0.1, 0.68, 0.6],
      [0.69, -0.04, -0.18, 0.51, 0.47],
      [0.83, -0.04, -0.2, 0.24, 0.25],
    ].map(([y, x, z, w, h]) => [y, x, z, w * q, h * q]);
  form(out, faceRows, d, 'steel', P, 0.033);
  if (d === 0) return;
  const hair = worker
    ? [
        [-0.24, 0, -0.41, 0.7, 0.47],
        [0.17, -0.01, -0.29, 0.78, 0.56],
        [0.56, -0.07, -0.22, 0.67, 0.55],
        [0.85, -0.07, -0.24, 0.46, 0.36],
      ]
    : [
        [-0.92, 0.21, -0.5, 0.63, 0.43],
        [-0.42, 0.18, -0.42, 0.78, 0.49],
        [0.08, 0.06, -0.36, 0.82, 0.56],
        [0.48, -0.04, -0.26, 0.71, 0.56],
        [0.82, -0.1, -0.24, 0.47, 0.41],
      ];
  form(out, hair, d, 'seam', P, 0.055);
  const tip = P([0.005, -0.348, 0.884]),
    bridge = P([0, 0.17, 0.623]),
    b = P([0.19, -0.427, 0.65]),
    a = P([-0.175, -0.41, 0.647]),
    base = P([0, -0.55, 0.691]);
  for (const ps of [
    [a, tip, bridge],
    [tip, b, bridge],
    [b, tip, base],
    [tip, a, base],
  ])
    tri(out, 'steel', 'lightSteel', ps, FRONT);
  if (d < 2) return;
  for (const sign of [-1, 1]) {
    sculptLimb(
      out,
      [
        [sign * 0.13, 0.09, 0.634, 0.087],
        [sign * 0.29, 0.137, 0.614, 0.092],
        [sign * 0.54, 0.076, 0.488, 0.055],
      ],
      1,
      'seam',
      P,
    );
    sculptLimb(
      out,
      [
        [sign * 0.18, -0.075, 0.627, 0.041],
        [sign * 0.31, -0.052, 0.648, 0.054],
        [sign * 0.49, -0.113, 0.543, 0.03],
      ],
      1,
      'steel',
      P,
    );
    sculptLimb(
      out,
      [
        [sign * 0.22, -0.713, 0.535, 0.061],
        [sign * 0.092, -0.676, 0.652, 0.049],
        [0, -0.666, 0.668, 0.051],
      ],
      1,
      'seam',
      P,
    );
    sphere(
      out,
      'steel',
      P([sign * 0.67, -0.17, -0.09]),
      [0.15, 0.245, 0.165],
      rgb.steel,
      d >= 3 ? 10 : 6,
      d >= 3 ? 7 : 4,
    );
  }
  const strands = d === 2 ? 8 : d === 3 ? 13 : 21;
  for (let i = 0; i < strands; i++) {
    const a = ((i + 0.3) / strands) * Math.PI,
      x = 0.69 * Math.cos(a);
    const path = [
      [x, 0.53 + 0.16 * Math.sin(a), 0.31 * Math.sin(a)],
      [x * 0.89, 0.7, 0.08],
      [x * 0.85, 0.58, -0.32],
      [x * 0.89, 0.35, -0.6],
      [x + (worker ? 0 : 0.26), worker ? -0.07 : -0.62, -0.7],
    ].map(P);
    tubePath(out, 'steel', path, 0.043, rgb[i % 3 === 0 ? 'seam' : 'steel'], d >= 3 ? 6 : 4);
  }
}
function feet(out, model, d, worker) {
  for (const [name, track] of [
    ['front', model.front],
    ['back', model.back],
  ]) {
    const [x, , z] = track.at(-1),
      rear = name === 'back',
      shoeY = rear ? 0.24 : 0.21;
    const w = worker ? 0.67 : 0.51;
    const rows = [
      [x, shoeY, z - 0.43, w, 0.24],
      [x, shoeY - 0.05, z + 0.18, w * 0.96, 0.22],
      [x, shoeY - 0.06, z + 0.73, w * 0.95, 0.17],
      [x, shoeY - 0.075, z + 1.04, w * 0.72, 0.12],
    ];
    sculptLimb(out, rows, d, 'seam', figurePoint, 0.02);
  }
}
function hands(out, model, d) {
  if (d < 2) return;
  for (const [arm, reach] of [
    [model.high, 0.23],
    [model.far, -0.33],
  ]) {
    const [x, y, z] = arm.at(-1);
    for (let i = 0; i < 4; i++) {
      const a = x + (i - 1.5) * 0.187;
      sculptLimb(
        out,
        [
          [a, y - 0.19, z - 0.1, 0.122],
          [a, y + 0.063, z + reach, 0.105],
          [a - 0.04, y + 0.291, z + reach * 0.9, 0.085],
        ],
        1,
        'lightSteel',
      );
    }
    sculptLimb(
      out,
      [
        [x - 0.36, y - 0.18, z + 0.04, 0.14],
        [x - 0.51, y + 0.01, z + 0.3, 0.12],
        [x - 0.38, y + 0.24, z + 0.32, 0.09],
      ],
      1,
      'steel',
    );
  }
}
function joinCloth(out, rows, d, tint = 'steel') {
  const sample = subset(rows, d);
  const N = d === 0 ? 4 : d === 1 ? 6 : d === 2 ? 10 : d === 3 ? 14 : 20;
  const rings = sample.map(([center, edge, thickness], i) => {
    const tang = normalize(
      sub(sample[Math.min(i + 1, sample.length - 1)][0], sample[Math.max(0, i - 1)][0]),
    );
    const v = normalize(cross(tang, edge));
    return Array.from({ length: N }, (_, j) => {
      const a = (j * TAU) / N,
        p = Math.cos(a),
        q = Math.sin(a);
      const corrugation = 0.13 * Math.sin(7 * p + i * 0.74) + 0.11 * Math.cos(12 * p - i * 0.54);
      return figurePoint(add(center, add(scale(edge, p), scale(v, q * thickness + corrugation))));
    });
  });
  ribbonSkin(out, 'steel', tint, rings);
}
const dressRows = [
  [1.01, 2.83, -1.67, 1.58, 4.03],
  [1.59, 2.97, -1.57, 1.88, 4.44],
  [2.31, 3.06, -1.43, 1.71, 4.28],
  [2.96, 3.15, -1.09, 2.02, 4.23],
  [3.56, 3.2, -0.82, 1.82, 4.08],
  [4.14, 3.29, -0.68, 1.96, 4.02],
  [4.85, 3.15, -0.46, 1.82, 4.0],
  [5.52, 3.07, -0.26, 1.91, 3.93],
  [6.13, 2.99, -0.02, 1.73, 3.61],
  [6.7, 2.86, 0.17, 1.77, 3.45],
  [7.33, 2.75, 0.49, 1.67, 3.23],
  [7.92, 2.62, 0.84, 1.64, 2.83],
  [8.53, 2.58, 1.06, 1.6, 2.33],
  [9.23, 2.53, 1.4, 1.61, 1.92],
  [9.92, 2.47, 1.86, 1.59, 1.43],
  [10.64, 2.44, 2.11, 1.25, 1.03],
];
function skirt(out, d) {
  const rs =
    d >= 3
      ? dressRows
      : d === 2
        ? dressRows.filter((_, i) => i % 2 === 0 || i === dressRows.length - 1)
        : d === 1
          ? dressRows.filter((_, i) => i % 3 === 0)
          : [dressRows[0], dressRows[5], dressRows[9], dressRows.at(-1)];
  const N = [7, 10, 16, 25, 34][d];
  const rings = rs.map(([y, x, z, w, h]) =>
    Array.from({ length: N }, (_, j) => {
      const a = (j * TAU) / N,
        k = 1 + 0.064 * Math.cos(5 * a - 0.65 * y) + 0.036 * Math.sin(8 * a + 0.89 * y);
      return figurePoint([
        x + w * Math.sin(a) * k + 0.45 * (Math.cos(a) - 1),
        y +
          0.68 * Math.sin(a) * Math.sin((Math.PI * (y - 1.0)) / 9.7) +
          0.12 * Math.sin(3 * a - 0.4 * y),
        z + h * Math.cos(a) * k - 0.34 * Math.sin(a),
      ]);
    }),
  );
  ribbonSkin(out, 'steel', 'steel', rings);
}
function scarf(out, d) {
  const upper = [
    [[2.29, 16.57, 3.29], [0.79, 0.24, 0.11], 0.19],
    [[2.62, 17.0, 1.28], [0.94, 0.36, 0.19], 0.21],
    [[3.0, 17.1, -0.41], [0.97, 0.33, 0.2], 0.22],
    [[3.31, 16.91, -2.06], [1.06, 0.27, 0.27], 0.26],
    [[3.66, 16.46, -3.92], [1.02, 0.12, 0.29], 0.25],
    [[3.72, 15.85, -5.28], [0.86, 0.1, 0.27], 0.19],
    [[3.49, 15.19, -6.31], [0.72, 0.17, 0.34], 0.17],
    [[3.21, 14.71, -6.56], [0.54, 0.29, 0.35], 0.16],
    [[3.08, 14.22, -5.96], [0.49, 0.33, 0.24], 0.17],
    [[2.78, 13.68, -4.76], [0.61, 0.36, 0.1], 0.18],
    [[2.35, 13.49, -3.35], [0.62, 0.4, 0.15], 0.17],
    [[2.2, 13.85, -1.44], [0.58, 0.3, 0.2], 0.16],
  ];
  const lower = [
    [[2.5, 11.3, 2.78], [1.02, 0.27, 0.15], 0.23],
    [[2.52, 10.76, 1.12], [1.16, 0.37, 0.12], 0.2],
    [[2.11, 10.3, -0.91], [1.37, 0.46, 0.14], 0.25],
    [[1.38, 9.93, -2.72], [1.4, 0.47, 0.12], 0.28],
    [[0.86, 9.88, -4.89], [1.39, 0.45, 0.16], 0.2],
    [[0.92, 9.92, -6.29], [1.18, 0.42, 0.23], 0.18],
    [[1.22, 10.18, -7.26], [0.76, 0.51, 0.32], 0.13],
    [[1.45, 10.71, -7.4], [0.35, 0.37, 0.16], 0.115],
  ];
  joinCloth(out, upper, d, 'lightSteel');
  joinCloth(out, lower, d, 'steel');
  if (d >= 2) {
    const edge = upper.map(([center, across]) => figurePoint(add(center, scale(across, 0.9))));
    tubePath(out, 'steel', edge, 0.075, rgb.seam, d >= 3 ? 6 : 4);
  }
}
function tools(out, d) {
  const p = layout.sculpture.hammer;
  const stem = [
    [-0.58, 22.11, 8.36],
    [-0.59, 23.49, 8.58],
  ].map(figurePoint);
  beam(out, 'steel', ...stem, 0.335, 0.39, rgb.seam);
  const a = figurePoint(add(p, [-0.74, -0.035, -0.62])),
    b = figurePoint(add(p, [0.56, 0.02, 0.69]));
  beam(out, 'steel', a, b, 0.82, 0.76, rgb.lightSteel);
  const pivot = [0.54, 23.12, 8.48];
  beam(out, 'steel', figurePoint([0.34, 22.1, 8.31]), figurePoint(pivot), 0.32, 0.29, rgb.seam);
  // Two closed faces and a beveled edge form the cutting crescent.
  const n = [7, 12, 20, 30, 42][d],
    outer = [],
    inner = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n,
      a = -1.32 + t * 2.62;
    const u = 1.42 * Math.cos(a),
      v = 1.32 * Math.sin(a);
    const w = (0.294 * Math.sin(Math.PI * t) + 0.024) * (1 - 0.48 * t);
    outer.push(add(pivot, [u - 0.14, 0.06 + v, -u * 0.22]));
    inner.push(add(pivot, [(1 - w) * u - 0.14, 0.06 + (1 - w) * v, -(1 - w) * u * 0.22]));
  }
  outer.at(-1)[1] = 24.5;
  inner.at(-1)[1] = 24.455;
  const P = (point, z) => figurePoint(add(point, [0, 0, z]));
  for (let i = 0; i < n; i++) {
    const a = outer[i],
      b = outer[i + 1],
      c = inner[i + 1],
      e = inner[i];
    for (const sign of [-1, 1])
      quad(
        out,
        'steel',
        'lightSteel',
        [P(a, sign * 0.086), P(b, sign * 0.086), P(c, sign * 0.042), P(e, sign * 0.042)],
        [0, 0, sign],
      );
    quad(out, 'steel', 'seam', [P(a, -0.086), P(b, -0.086), P(b, 0.086), P(a, 0.086)], [1, 0, 0]);
    quad(out, 'steel', 'steel', [P(e, -0.042), P(c, -0.042), P(c, 0.042), P(e, 0.042)], [-1, 0, 0]);
  }
  for (const i of [0, n])
    quad(
      out,
      'steel',
      'steel',
      [P(outer[i], -0.086), P(inner[i], -0.042), P(inner[i], 0.042), P(outer[i], 0.086)],
      [0, i === 0 ? -1 : 1, 0],
    );
}
function joins(out, d) {
  if (d < 3) return;
  for (const { body } of Object.values(strides)) {
    for (const [i, row] of body.entries()) {
      if (i === 0 || i === body.length - 1 || i % 2 === 0) continue;
      const [y, x, z, w, h] = row;
      const path = Array.from({ length: d === 3 ? 13 : 20 }, (_, j) => {
        const a = ((j / (d === 3 ? 12 : 19)) * 1.72 - 0.86) * Math.PI;
        return figurePoint([x + w * Math.sin(a), y + 0.16 * Math.cos(2 * a), z + h * Math.cos(a)]);
      });
      tubePath(out, 'steel', path, 0.026, rgb.seam, 5);
    }
  }
}
function figures(out, d) {
  for (const [kind, model] of Object.entries(strides)) {
    const worker = kind === 'worker';
    form(out, model.body, d, 'steel', figurePoint, worker ? 0.057 : 0.052);
    for (const line of [model.front, model.back])
      sculptLimb(out, line, d, 'steel', figurePoint, worker ? 0.09 : 0.042);
    for (const line of [model.high, model.far])
      sculptLimb(out, line, d, 'steel', figurePoint, 0.042);
    feet(out, model, d, worker);
    hands(out, model, d);
    face(out, model, d, worker);
  }
  skirt(out, d);
  scarf(out, d);
  tools(out, d);
  joins(out, d);
}
export function buildMonument(out, level = 'master') {
  const d = tier[level];
  if (d === undefined) throw Error('Unknown Worker and Kolkhoz Woman LOD ' + level);
  pavilion(out, d);
  figures(out, d);
}
export const buildMonumentSkyline = (out) => buildMonument(out, 'skyline');
export const buildMonumentDistrict = (out) => buildMonument(out, 'district');
export const buildMonumentStreet = (out) => buildMonument(out, 'street');
export const buildMonumentCloseup = (out) => buildMonument(out, 'closeup');
