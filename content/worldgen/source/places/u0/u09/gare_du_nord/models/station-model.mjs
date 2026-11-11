import { readFileSync } from 'node:fs';
import {
  beam,
  beamPath,
  loft,
  normalFor,
  radialRing,
  sphere,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';

export const layout = JSON.parse(readFileSync(new URL('../layout.json', import.meta.url)));
export const stationSurfaces = {
  stone: { slot: 'wall', graph: 'stone_limestone', roughness: 0.84 },
  carved: { slot: 'trim', graph: 'stone_limestone_raw', roughness: 0.79 },
  glass: { slot: 'window', graph: 'window_grid', roughness: 0.46 },
  iron: { slot: 'trim', graph: 'metal_painted', roughness: 0.65, metallic: 0.31 },
  roof: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.75 },
  timber: { slot: 'roof', graph: 'wood_plain', roughness: 0.83 },
  paving: { slot: 'foundation', graph: 'stone_ashlar', roughness: 0.9 },
};
const palette = {
  stone: 'c9b99f',
  shadow: 'b2a389',
  trim: 'd9ccb0',
  warm: 'd6c7aa',
  relief: 'c1b096',
  dark: '646052',
  glass: '627781',
  recess: '414e51',
  roof: '717b7d',
  ridge: '879294',
  iron: '485c54',
  gold: 'b29b6a',
  timber: '9b815e',
  paving: 'ada698',
  tactile: 'c9be96',
  slab: '929083',
  paper: 'e0daca',
};
const color = Object.fromEntries(
  Object.entries(palette).map(([key, hex]) => [
    key,
    hex.match(/../g).map((pair) => {
      const v = Number.parseInt(pair, 16) / 255;
      return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    }),
  ]),
);
const detailByLevel = { skyline: 0, district: 1, street: 2, closeup: 3, master: 4 };
const ref = 'palette:#ffffff',
  up = [0, 1, 0],
  down = [0, -1, 0],
  south = [-1, 0, 0],
  north = [1, 0, 0];
const mix = (a, b, t) => a + (b - a) * t,
  at = ([x, z], y) => [x, y, z];
function face(out, slot, tint, points, towards) {
  for (let i = 1; i < points.length - 1; i++) {
    let p = [points[0], points[i], points[i + 1]],
      n = normalFor(...p);
    if (n.reduce((sum, v, j) => sum + v * towards[j], 0) < 0) {
      p = p.toReversed();
      n = normalFor(...p);
    }
    if (Math.hypot(...n) > 0.5) out.addTriangle(slot, ref, p, n, undefined, color[tint]);
  }
}
function block(out, slot, tint, [x, z], [w, d], low, high) {
  const ring = (y) =>
    [
      [-1, -1],
      [-1, 1],
      [1, 1],
      [1, -1],
    ].map(([u, v]) => [x + u * w * 0.5, y, z + v * d * 0.5]);
  loft(out, slot, [ring(low), ring(high)], color[tint]);
}
function lathe(out, slot, tint, x, z, rows, sides) {
  loft(
    out,
    slot,
    rows.map(([y, a, b = a]) => radialRing(y, a, b, sides, [x, z])),
    color[tint],
  );
}
const front = (z) => {
  const rows = layout.frontage,
    n = Math.min(rows.length - 2, Math.max(0, Math.floor(z - rows[0][0]))),
    a = rows[n],
    b = rows[n + 1];
  const t = Math.min(1, Math.max(0, (z - a[0]) / (b[0] - a[0])));
  return [mix(a[1], b[1], t), mix(a[2], b[2], t)];
};
const facade = (z, y, d = 0) => [-32.07 - d, y, z];
function panel(out, slot, tint, p, n, a, b, low, high, depth = 0) {
  if (b - a < 0.009 || high - low < 0.009) return;
  face(
    out,
    slot,
    tint,
    [p(a, low, depth), p(b, low, depth), p(b, high, depth), p(a, high, depth)],
    n,
  );
}
function band(out, p, n, a, b, y, h, depth, tint = 'trim') {
  panel(out, 'carved', tint, p, n, a, b, y, y + h, depth);
  face(out, 'carved', tint, [p(a, y + h), p(b, y + h), p(b, y + h, depth), p(a, y + h, depth)], up);
}
function stroke(out, slot, tint, p, n, [x, y], [u, v], width, depth) {
  const length = Math.hypot(u - x, v - y),
    dx = ((y - v) * width * 0.5) / length,
    dy = ((u - x) * width * 0.5) / length;
  face(
    out,
    slot,
    tint,
    [
      p(x + dx, y + dy, depth),
      p(u + dx, v + dy, depth),
      p(u - dx, v - dy, depth),
      p(x - dx, y - dy, depth),
    ],
    n,
  );
}
function wallForms(out, detail) {
  for (const form of layout.forms)
    for (const region of detail < 2 ? form.coarse : form.regions) {
      const { rings, vertices, triangles, bottoms } = region;
      for (const [j, ring] of rings.entries())
        for (const [i, a] of ring.entries()) {
          const k = (i + 1) % ring.length,
            b = ring[k],
            length = Math.hypot(b[0] - a[0], b[1] - a[1]);
          if (length < 0.03) continue;
          const n = [(a[1] - b[1]) / length, 0, (b[0] - a[0]) / length],
            z = (a[1] + b[1]) / 2;
          const frontage =
            form.name === 'head' && z > -76 && z < 79 && a[0] < -29.7 && b[0] < -29.7;
          const shedJoin = form.name === 'head' && n[0] > 0.8 && z > -58 && z < 77 && a[0] > -12;
          if (frontage || shedJoin) continue;
          const tint = form.name === 'east' ? 'shadow' : 'stone';
          face(
            out,
            'stone',
            tint,
            [at(a, bottoms[j][i]), at(b, bottoms[j][k]), at(b, form.top), at(a, form.top)],
            n,
          );
          if (!detail || length < 5 || j > 0) continue;
          const p = (u, y, d = 0) => [
            mix(a[0], b[0], u / length) + d * n[0],
            y,
            mix(a[1], b[1], u / length) + d * n[2],
          ];
          band(out, p, n, 0, length, form.top - 0.7, 0.44, 0.18);
          const count = Math.max(1, Math.floor(length / (form.name === 'east' ? 3.85 : 5.5)));
          for (let k = 0; k < count; k++) {
            const u = ((k + 0.5) * length) / count,
              w = Math.min(1.46, (length / count) * 0.32);
            for (const row of form.name === 'head' ? [6.4, 13.2] : [4.8, 9.4]) {
              panel(out, 'glass', 'glass', p, n, u - w, u + w, row, row + 2.78, 0.027);
              if (detail >= 2) band(out, p, n, u - w - 0.13, u + w + 0.13, row - 0.19, 0.14, 0.145);
            }
          }
        }
      for (const tri of triangles)
        face(
          out,
          'roof',
          'roof',
          tri.map((i) => at(vertices[i], form.top)),
          up,
        );
    }
  const { rings, vertices, triangles } = layout.annexPart;
  const ring = rings[0],
    bottom = 15.65,
    top = 18.06;
  for (const [i, a] of ring.entries()) {
    const b = ring[(i + 1) % ring.length],
      n = [a[1] - b[1], 0, b[0] - a[0]];
    face(out, 'glass', 'glass', [at(a, bottom), at(b, bottom), at(b, top), at(a, top)], n);
  }
  for (const tri of triangles)
    face(
      out,
      'roof',
      'roof',
      tri.map((i) => at(vertices[i], top)),
      up,
    );
}
const arches = [
  { z: -66.1, r: 7.6, spring: 12.8, rise: 6.36, top: 22.1, doors: 3, statues: 2 },
  { z: -22.5, r: 7.55, spring: 15.3, rise: 7.1, top: 24.7, doors: 3, statues: 2 },
  { z: 1.1, r: 13.3, spring: 16.8, rise: 12.1, top: 32.0, doors: 6, statues: 6 },
  { z: 24.9, r: 7.45, spring: 15.3, rise: 7.1, top: 24.7, doors: 3, statues: 2 },
  { z: 68.1, r: 7.65, spring: 12.8, rise: 6.4, top: 22.1, doors: 3, statues: 2 },
];
const gaps = [
  [-76, -73.7, 21.4],
  [-58.5, -30.05, 21.4],
  [-14.95, -12.2, 26.0],
  [14.4, 17.45, 26.0],
  [32.35, 60.45, 21.4],
  [75.75, 79, 21.4],
];
function entrance(out, a, b, doors, detail) {
  const p = facade;
  if (detail === 0) {
    const low = Math.min(front(a)[1], front(b)[1]) - 0.35;
    panel(out, 'stone', 'stone', p, south, a, b, low, 7.7);
    panel(
      out,
      'glass',
      'recess',
      p,
      south,
      a + 0.2,
      b - 0.2,
      Math.max(front(a)[1], front(b)[1]) + 0.11,
      5.86,
      0.028,
    );
    return;
  }
  for (let i = 0; i < doors; i++) {
    const u = mix(a, b, i / doors),
      v = mix(a, b, (i + 1) / doors),
      m = (u + v) * 0.5,
      low = front(m)[1];
    const w = (v - u) * 0.354;
    for (const [start, end] of [
      [u, m - w],
      [m + w, v],
    ])
      panel(
        out,
        'stone',
        'stone',
        p,
        south,
        start,
        end,
        Math.min(front(start)[1], front(end)[1], low) - 0.34,
        7.06,
      );
    panel(out, 'glass', 'recess', p, south, m - w, m + w, low, 5.95, -0.22);
    panel(out, 'stone', 'stone', p, south, m - w, m + w, 5.95, 7.06);
    if (detail >= 2) {
      panel(out, 'iron', 'iron', p, south, m - 0.058, m + 0.058, low, 5.92, -0.18);
      panel(out, 'iron', 'iron', p, south, m - w, m + w, 4.58, 4.7, -0.18);
      band(out, p, south, m - w - 0.19, m + w + 0.19, 5.89, 0.22, 0.27);
      block(out, 'paving', 'paving', [-32.34, m], [0.65, w * 2], low - 0.12, low + 0.012);
    }
  }
  band(out, p, south, a, b, 7.05, 0.74, 0.68);
}
function archFace(out, s, detail) {
  const { z, r, spring, rise, top, doors, statues } = s;
  const p = facade,
    a = z - r,
    b = z + r,
    base = 8.0;
  entrance(out, a, b, doors, detail);
  const count = [5, 8, 12, 18, 22][detail];
  const arch = Array.from({ length: count + 1 }, (_, i) => {
    const t = (Math.PI * i) / count;
    return [z - r * Math.cos(t), spring + rise * Math.sin(t)];
  });
  const pediment = (u) => top - Math.abs(u - z) * (doors === 6 ? 0.196 : 0.163);
  panel(out, 'glass', 'glass', p, south, a, b, base, spring, -0.19);
  face(
    out,
    'glass',
    'glass',
    arch.map(([u, y]) => p(u, y, -0.19)),
    south,
  );
  for (let i = 1; i < arch.length; i++) {
    const [u, y] = arch[i - 1],
      [v, e] = arch[i];
    face(out, 'stone', 'stone', [p(u, y), p(v, e), p(v, pediment(v)), p(u, pediment(u))], south);
    if (!detail) continue;
    const expand = (u, y) => [z + (u - z) * 1.055, spring + (y - spring) * 1.045 + 0.28];
    const [x0, y0] = expand(u, y),
      [x1, y1] = expand(v, e);
    face(
      out,
      'carved',
      i % 4 === 0 ? 'warm' : 'trim',
      [p(u, y, 0.26), p(v, e, 0.26), p(x1, y1, 0.24), p(x0, y0, 0.24)],
      south,
    );
    if (detail >= 2)
      face(
        out,
        'carved',
        'shadow',
        [p(u, y, -0.19), p(v, e, -0.19), p(v, e, 0.26), p(u, y, 0.26)],
        down,
      );
    if (detail >= 3) {
      const t = (i - 0.5) / count,
        theta = Math.PI * t;
      const m = z - (r + 0.36) * Math.cos(theta),
        h = spring + (rise + 0.38) * Math.sin(theta);
      const width = 0.16 + 0.05 * (i % 2);
      const pos = p(m, h, 0.3);
      sphere(out, 'carved', pos, [0.13, width, width], color.relief, 6, 3);
    }
  }
  const crest = [
    [a, pediment(a)],
    [z, top],
    [b, pediment(b)],
  ];
  for (let i = 1; i < crest.length; i++)
    stroke(out, 'carved', 'trim', p, south, crest[i - 1], crest[i], 0.65, 0.38);
  if (!detail) return;
  const vertical = doors === 6 ? 10 : 6;
  for (let i = 1; i < vertical; i++) {
    const u = mix(a, b, i / vertical),
      height = spring + rise * Math.sqrt(Math.max(0, 1 - Math.pow((u - z) / r, 2)));
    const w = i % 2 === 0 ? 0.21 : 0.055;
    panel(
      out,
      i % 2 === 0 ? 'carved' : 'iron',
      i % 2 === 0 ? 'trim' : 'iron',
      p,
      south,
      u - w,
      u + w,
      base,
      height - 0.12,
      0.035,
    );
  }
  for (const y of detail >= 2
    ? [10.45, 13.1, 15.6, 17.85, 20.2, 22.5, 24.8, 27.1]
    : [10.45, 15.6]) {
    const w = y <= spring ? r : r * Math.sqrt(Math.max(0, 1 - Math.pow((y - spring) / rise, 2)));
    if (y < spring + rise - 0.12)
      panel(out, 'iron', 'iron', p, south, z - w, z + w, y - 0.055, y + 0.055, 0.025);
  }
  band(out, p, south, a, b, 8.25, 0.38, 0.57);
  band(out, p, south, a, b, 13.36, 0.25, 0.28);
  if (detail >= 2)
    for (let i = 0; i < statues; i++) {
      const u = mix(a, b, (i + 0.62) / (statues + 0.24));
      figure(out, u, 8.64, doors === 6 ? 2.68 : 2.28, detail, i, 0.8);
    }
}
function figure(out, z, y, size, detail, variation, depth) {
  const x = facade(z, y, depth)[0],
    height = size;
  block(out, 'carved', 'trim', [x, z], [0.89, 0.98], y - 0.23, y + 0.18);
  if (detail <= 1) {
    lathe(
      out,
      'carved',
      'stone',
      x,
      z,
      [
        [y + 0.12, 0.34],
        [y + height * 0.67, 0.24],
        [y + height * 0.87, 0.19],
        [y + height, 0.14],
      ],
      5,
    );
    return;
  }
  const lean = ((variation % 3) - 1) * 0.13;
  const rings = [
    [y + 0.15, 0.38, 0.34, 0],
    [y + height * 0.32, 0.33, 0.33, lean * 0.4],
    [y + height * 0.62, 0.3, 0.3, lean],
    [y + height * 0.78, 0.28, 0.37, lean * 1.3],
    [y + height * 0.87, 0.17, 0.2, lean * 1.35],
  ].map(([y, a, b, c]) => radialRing(y, a, b, detail >= 3 ? 9 : 6, [x, z + c]));
  loft(out, 'carved', rings, color.relief);
  sphere(
    out,
    'carved',
    [x - 0.07, y + height * 0.94, z + lean * 1.4],
    [0.175, 0.23, 0.165],
    color.warm,
    detail >= 3 ? 8 : 6,
    detail >= 3 ? 5 : 3,
  );
  if (detail < 3) return;
  for (const side of [-1, 1]) {
    const start = [x - 0.1, y + height * 0.73, z + lean + side * 0.32];
    const end = [
      x - 0.27,
      y + height * (side === 1 && variation % 2 === 0 ? 0.51 : 0.29),
      z + lean + side * 0.27,
    ];
    beam(out, 'carved', start, end, 0.15, 0.16, color.trim);
    if (variation % 4 === 0)
      beam(
        out,
        'carved',
        [x - 0.35, y + 0.2, z + side * 0.37],
        [x - 0.35, y + height * 0.61, z + side * 0.37],
        0.081,
        0.093,
        color.relief,
      );
  }
  for (let i = 0; i < 5; i++) {
    const u = z + (i - 2) * 0.103;
    face(
      out,
      'carved',
      i % 2 === 0 ? 'trim' : 'stone',
      [
        [x - 0.36, y + 0.22, u - 0.035],
        [x - 0.43, y + height * 0.36, u + 0.08],
        [x - 0.27, y + height * 0.7, u + 0.12],
      ],
      south,
    );
  }
}
const letters = {
  G: [
    [
      [0.81, 0.89],
      [0.34, 0.96],
      [0.12, 0.7],
      [0.12, 0.25],
      [0.34, 0.05],
      [0.81, 0.12],
      [0.81, 0.5],
      [0.52, 0.5],
    ],
  ],
  A: [
    [
      [0.07, 0],
      [0.48, 1],
      [0.91, 0],
    ],
    [
      [0.27, 0.4],
      [0.7, 0.4],
    ],
  ],
  R: [
    [
      [0.13, 0],
      [0.13, 1],
      [0.66, 1],
      [0.82, 0.78],
      [0.66, 0.55],
      [0.13, 0.55],
    ],
    [
      [0.48, 0.55],
      [0.89, 0],
    ],
  ],
  E: [
    [
      [0.86, 1],
      [0.14, 1],
      [0.14, 0],
      [0.86, 0],
    ],
    [
      [0.14, 0.54],
      [0.69, 0.54],
    ],
  ],
  D: [
    [
      [0.14, 0],
      [0.14, 1],
      [0.55, 1],
      [0.86, 0.77],
      [0.86, 0.25],
      [0.55, 0],
      [0.14, 0],
    ],
  ],
  U: [
    [
      [0.12, 1],
      [0.12, 0.23],
      [0.31, 0],
      [0.65, 0],
      [0.86, 0.23],
      [0.86, 1],
    ],
  ],
  N: [
    [
      [0.13, 0],
      [0.13, 1],
      [0.87, 0],
      [0.87, 1],
    ],
  ],
  O: [
    [
      [0.32, 1],
      [0.67, 1],
      [0.88, 0.76],
      [0.88, 0.24],
      [0.67, 0],
      [0.32, 0],
      [0.11, 0.24],
      [0.11, 0.76],
      [0.32, 1],
    ],
  ],
};
function word(out, text, z, y, scale, depth, tint) {
  const step = scale * 1.06,
    start = z - ((text.length - 0.1) * step) / 2;
  for (const [i, char] of [...text].entries())
    for (const run of letters[char] ?? [])
      for (let j = 1; j < run.length; j++) {
        const p = ([x, y0]) => [start + step * i + x * scale, y + y0 * scale];
        stroke(out, 'iron', tint, facade, south, p(run[j - 1]), p(run[j]), scale * 0.084, depth);
      }
}
function clock(out, detail) {
  if (detail < 2) return;
  const z = 1.1,
    y = 18.64,
    rad = 1.33,
    n = detail >= 3 ? 32 : 16,
    p = facade;
  const ring = (r, d) =>
    Array.from({ length: n }, (_, i) =>
      p(z + r * Math.cos((2 * Math.PI * i) / n), y + r * Math.sin((2 * Math.PI * i) / n), d),
    );
  const a = ring(rad + 0.16, 0.38),
    b = ring(rad, 0.42);
  face(out, 'carved', 'paper', b, south);
  for (let i = 0; i < n; i++)
    face(out, 'carved', 'relief', [a[i], a[(i + 1) % n], b[(i + 1) % n], b[i]], south);
  for (let i = 0; i < 12; i++) {
    const t = (i * Math.PI) / 6,
      p = (radius) => [z + radius * Math.sin(t), y + radius * Math.cos(t)];
    stroke(out, 'iron', 'recess', facade, south, p(rad - 0.26), p(rad - 0.14), 0.058, 0.456);
  }
  stroke(out, 'iron', 'recess', p, south, [z, y], [z - 0.45, y + 0.42], 0.105, 0.478);
  stroke(out, 'iron', 'recess', p, south, [z, y], [z + 0.49, y + 0.74], 0.074, 0.478);
}
function frontArchitecture(out, detail) {
  for (const s of arches) archFace(out, s, detail);
  for (const [a, b, top] of gaps) {
    const count = Math.max(1, Math.round((b - a) / 5.12));
    entrance(out, a, b, count, detail);
    panel(out, 'stone', 'stone', facade, south, a, b, 7.6, top);
    band(out, facade, south, a, b, top - 0.72, 0.54, 0.45);
    if (!detail) continue;
    for (let i = 0; i < count; i++) {
      const u = mix(a, b, (i + 0.5) / count),
        w = Math.min(1.42, ((b - a) / count) * 0.31);
      panel(out, 'glass', 'glass', facade, south, u - w, u + w, 9.0, 12.4, 0.027);
      panel(out, 'glass', 'glass', facade, south, u - w, u + w, 14.0, 17.1, 0.027);
      if (detail >= 2) {
        band(out, facade, south, u - w - 0.13, u + w + 0.13, 8.84, 0.13, 0.24);
        panel(out, 'iron', 'iron', facade, south, u - 0.055, u + 0.055, 9, 12.4, 0.051);
        panel(out, 'iron', 'iron', facade, south, u - 0.055, u + 0.055, 14, 17.1, 0.051);
      }
    }
  }
  for (const [i, z] of [-58.6, -31.2, -13.3, 15.8, 33.7, 59.8].entries()) {
    const x = -32.07,
      ground = front(z)[1],
      top = Math.abs(z) < 19 ? 27.5 : 23.9;
    const depth = 0.92,
      base = ground - 0.3;
    block(out, 'stone', 'warm', [x - 0.35, z], [1.65, 2.7], base, top);
    if (detail) {
      for (const s of [-1, 1]) {
        const u = z + s * 0.74;
        const rows = [
          [base + 0.08, 0.46],
          [base + 1.25, 0.51],
          [base + 1.51, 0.43],
          [top - 3.3, 0.31],
          [top - 3.12, 0.44],
          [top - 2.86, 0.51],
        ];
        lathe(
          out,
          'carved',
          'trim',
          x - depth,
          u,
          detail === 1 ? rows.filter((_, i) => [0, 3, 5].includes(i)) : rows,
          detail >= 3 ? 12 : 6,
        );
      }
      band(out, facade, south, z - 1.46, z + 1.46, top - 2.66, 0.38, 1.23);
      band(out, facade, south, z - 1.65, z + 1.65, top - 0.33, 0.45, 1.23);
      if (detail >= 2) {
        word(out, 'NORD', z, top - 1.8, 0.44, 1.23, 'dark');
        figure(out, z - 0.67, top + 0.18, 2.34, detail, i, 1.16);
        if (Math.abs(z) < 19) figure(out, z + 0.66, top + 0.18, 2.4, detail, i + 2, 1.16);
      }
    }
  }
  if (detail) figure(out, 1.1, 32.38, 2.95, detail, 1, 0.48);
  if (detail >= 2) {
    clock(out, detail);
    word(out, 'GARE DU NORD', 1.1, 6.47, 1.03, 0.33, 'paper');
    const frontBeam = [facade(-28, 5.68, 0.7), facade(30.8, 5.68, 0.7)];
    beam(out, 'iron', frontBeam[0], frontBeam[1], 0.18, 0.16, color.iron);
    for (let i = 0; i < 12; i++) {
      const u = mix(-27.5, 30.3, i / 11);
      beam(out, 'iron', facade(u, 5.68, 0.11), facade(u, 5.65, 2.33), 0.14, 0.16, color.iron);
      if (detail >= 3)
        beam(out, 'iron', facade(u, 5.65, 2.28), facade(u, 6.16, 0.04), 0.089, 0.095, color.iron);
    }
    face(
      out,
      'glass',
      'glass',
      [
        facade(-28, 5.68, 0.06),
        facade(30.8, 5.68, 0.06),
        facade(30.8, 5.6, 2.38),
        facade(-28, 5.6, 2.38),
      ],
      up,
    );
  }
}

function roofY(r, z) {
  const side = z <= r.ridge ? r.ridge - r.z0 : r.z1 - r.ridge;
  return r.peak - ((r.peak - r.eave) * Math.abs(z - r.ridge)) / side;
}
function shedRoof(out, detail) {
  for (const r of layout.roofRuns) {
    const { x0, x1, z0, z1, ridge, glass } = r;
    const marks =
      detail === 0 ? [z0, ridge, z1] : [z0, ridge - glass / 2, ridge, ridge + glass / 2, z1];
    face(
      out,
      'roof',
      'roof',
      [
        [x0, Math.min(r.eave - 0.25, 21.3), z0],
        [x0, r.peak - 0.25, ridge],
        [x0, Math.min(r.eave - 0.25, 21.3), z1],
      ],
      south,
    );
    for (let i = 1; i < marks.length; i++) {
      const a = marks[i - 1],
        b = marks[i],
        y = roofY(r, a),
        h = roofY(r, b),
        slot = i === 2 || i === 3 ? 'glass' : 'roof';
      const s = detail === 0 ? 'roof' : slot;
      face(
        out,
        s,
        s === 'roof' ? 'roof' : 'ridge',
        [
          [x0, y, a],
          [x1, y, a],
          [x1, h, b],
          [x0, h, b],
        ],
        up,
      );
      const soffit = detail >= 2 ? (s === 'glass' ? 'glass' : 'timber') : 'roof';
      face(
        out,
        soffit,
        soffit === 'glass' ? 'ridge' : soffit,
        [
          [x0, y - 0.25, a],
          [x1, y - 0.25, a],
          [x1, h - 0.25, b],
          [x0, h - 0.25, b],
        ],
        down,
      );
      for (const [x, n] of [
        [x0, south],
        [x1, north],
      ])
        face(
          out,
          'roof',
          'roof',
          [
            [x, y, a],
            [x, h, b],
            [x, h - 0.25, b],
            [x, y - 0.25, a],
          ],
          n,
        );
    }
    if (detail >= 2) {
      const max = detail >= 3 ? 33 : 16;
      for (let i = 0; i <= max; i++) {
        const x = mix(x0 + 0.15, x1 - 0.15, i / max);
        const pts = [z0, ridge - glass / 2, ridge, ridge + glass / 2, z1].map((z) => [
          x,
          roofY(r, z) + 0.05,
          z,
        ]);
        beamPath(out, 'iron', pts, 0.09, 0.11, color.ridge);
      }
    }
    const endY = r.eave - 2.08,
      n = detail >= 2 ? 9 : detail === 1 ? 4 : 2;
    for (let i = 0; i < n; i++) {
      const a = mix(z0, z1, i / n),
        b = mix(z0, z1, (i + 1) / n),
        x = x1 - 0.18;
      const topA = roofY(r, a) - 0.3,
        topB = roofY(r, b) - 0.3;
      if (topA > endY && topB > endY)
        face(
          out,
          'glass',
          'glass',
          [
            [x, endY, a],
            [x, endY, b],
            [x, topB, b],
            [x, topA, a],
          ],
          north,
        );
      if (detail >= 2)
        beam(out, 'iron', [x + 0.018, endY, a], [x + 0.018, topA, a], 0.16, 0.16, color.iron);
    }
    beam(
      out,
      'iron',
      [x1, r.eave - 2.04, z0],
      [x1, r.eave - 2.04, z1],
      detail >= 2 ? 0.27 : 0.53,
      0.32,
      color.iron,
    );
  }
}
function shedFrames(out, detail) {
  const frames = layout.frames.filter(
    (_, i) => detail >= 3 || i % (detail === 2 ? 2 : detail === 1 ? 3 : 7) === 0,
  );
  for (const { x, feet } of frames) {
    for (const [i, [z, y]] of feet.entries()) {
      const peak = i === 1 || i === 2 ? 21.6 : 17.1;
      if (detail >= 3)
        lathe(
          out,
          'iron',
          'iron',
          x,
          z,
          [
            [y, 0.42],
            [y + 0.72, 0.4],
            [y + 1.0, 0.24],
            [peak - 1.19, 0.23],
            [peak - 0.88, 0.38],
            [peak - 0.38, 0.47],
            [peak, 0.3],
          ],
          8,
        );
      else block(out, 'iron', 'iron', [x, z], [0.49, 0.54], y, peak);
      if (detail >= 2) {
        const side = i % 2 === 0 ? 1 : -1;
        beam(
          out,
          'iron',
          [x, peak - 2.86, z],
          [x, peak - 0.35, z + side * 4.1],
          0.21,
          0.24,
          color.iron,
        );
        if (detail >= 3)
          for (let k = 1; k <= 3; k++) {
            const u = k / 4;
            beam(
              out,
              'iron',
              [x, mix(peak - 2.86, peak - 0.35, u), z + side * 4.1 * u],
              [x, peak - 0.22, z + side * 4.1 * u],
              0.115,
              0.12,
              color.iron,
            );
          }
      }
    }
    for (const roof of layout.roofRuns) {
      const { z0, z1, ridge, eave, peak } = roof;
      if (detail === 0) continue;
      const points = [
        [x, eave - 0.27, z0],
        [x, peak - 0.27, ridge],
        [x, eave - 0.27, z1],
      ];
      beamPath(out, 'iron', points, 0.22, 0.33, color.iron);
      if (detail >= 2) {
        beam(out, 'iron', points[0], points[2], 0.16, 0.17, color.iron);
        for (const p of [0.25, 0.5, 0.75]) {
          const z = mix(z0, z1, p),
            y = roofY(roof, z) - 0.35;
          beam(out, 'iron', [x, eave - 0.31, z], [x, y, z], 0.12, 0.14, color.iron);
          if (detail >= 3)
            beam(
              out,
              'iron',
              [x, eave - 0.31, z],
              [x, roofY(roof, z + 2.9) - 0.34, z + 2.9],
              0.087,
              0.1,
              color.iron,
            );
        }
      }
    }
  }
}
function aisleWalls(out, detail) {
  if (!detail) return;
  for (const side of [-1, 1]) {
    const z = side === -1 ? -28.62 : 30.72;
    for (let i = 0; i < layout.frames.length - 1; i++) {
      const a = layout.frames[i].x,
        b = layout.frames[i + 1].x;
      const p = (x, y, d = 0) => [x, y, z + side * d],
        n = [0, 0, side],
        u = (a + b) / 2;
      if (detail === 1) {
        panel(out, 'stone', 'stone', p, n, a, b, 15.3, 21.64);
        continue;
      }
      const nArch = detail >= 3 ? 10 : 6,
        rad = (b - a) * 0.421,
        base = 15.15,
        rs = 5.03;
      const path = Array.from({ length: nArch + 1 }, (_, j) => {
        const t = (Math.PI * j) / nArch;
        return [u - rad * Math.cos(t), base + rs * Math.sin(t)];
      });
      face(
        out,
        'glass',
        'glass',
        path.map(([x, y]) => p(x, y, 0.017)),
        n,
      );
      const inside = n.map((v) => -v);
      face(
        out,
        'glass',
        'glass',
        path.map(([x, y]) => p(x, y, -0.11)),
        inside,
      );
      for (let j = 1; j < path.length; j++) {
        const [[x, y], [v, h]] = path.slice(j - 1, j + 1);
        face(out, 'stone', 'stone', [p(x, y), p(v, h), p(v, 21.62), p(x, 21.62)], n);
        face(
          out,
          'stone',
          'stone',
          [p(x, y, -0.11), p(v, h, -0.11), p(v, 21.62, -0.11), p(x, 21.62, -0.11)],
          inside,
        );
        stroke(out, 'carved', 'trim', p, n, [x, y], [v, h], 0.19, 0.062);
      }
      panel(out, 'stone', 'stone', p, n, a, a + (b - a) * 0.08, base, 21.63);
      panel(out, 'stone', 'stone', p, n, b - (b - a) * 0.08, b, base, 21.63);
      band(out, p, n, a, b, 14.7, 0.4, 0.17);
      if (detail >= 3)
        for (const q of [-0.52, 0, 0.52])
          panel(
            out,
            'iron',
            'iron',
            p,
            n,
            u + rad * q - 0.05,
            u + rad * q + 0.05,
            base,
            base + rs * Math.sqrt(1 - q * q),
            0.04,
          );
    }
  }
}
function platforms(out, detail) {
  if (detail === 0) return;
  for (const platform of layout.platforms) {
    const rows = platform.rows;
    for (let i = 1; i < rows.length; i++) {
      const [x, a, b, y] = rows[i - 1],
        [v, c, d, h] = rows[i];
      face(
        out,
        'paving',
        'paving',
        [
          [x, y, a],
          [v, h, c],
          [v, h, d],
          [x, y, b],
        ],
        up,
      );
      if (detail === 1) continue;
      for (const [u, w, s] of [
        [a, c, -1],
        [b, d, 1],
      ]) {
        face(
          out,
          'paving',
          'slab',
          [
            [x, y, u],
            [v, h, w],
            [v, h - 0.61, w],
            [x, y - 0.61, u],
          ],
          [0, 0, s],
        );
        const p = 0.16 * s;
        face(
          out,
          'paving',
          'tactile',
          [
            [x, y + 0.013, u - p],
            [v, h + 0.013, w - p],
            [v, h + 0.013, w - 3 * p],
            [x, y + 0.013, u - 3 * p],
          ],
          up,
        );
      }
    }
    if (detail >= 3)
      for (const [i, [x, a, b, y]] of rows.entries()) {
        if (i % 2 !== 0) continue;
        const z = (a + b) / 2;
        beam(out, 'iron', [x, y, z], [x, y + 3.18, z], 0.12, 0.12, color.iron);
        beam(out, 'iron', [x, y + 3.0, z - 0.63], [x, y + 3.0, z + 0.63], 0.29, 0.16, color.recess);
        if (detail >= 4)
          sphere(out, 'glass', [x, y + 3.42, z], [0.17, 0.19, 0.17], color.paper, 8, 4);
      }
  }
}
export function buildStationLevel(out, level) {
  const detail = detailByLevel[level];
  wallForms(out, detail);
  frontArchitecture(out, detail);
  shedRoof(out, detail);
  shedFrames(out, detail);
  aisleWalls(out, detail);
  platforms(out, detail);
}
export const buildStationSkyline = (out) => buildStationLevel(out, 'skyline');
export const buildStationDistrict = (out) => buildStationLevel(out, 'district');
export const buildStationStreet = (out) => buildStationLevel(out, 'street');
export const buildStationCloseup = (out) => buildStationLevel(out, 'closeup');
