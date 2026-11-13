import { readFileSync } from 'node:fs';
import {
  beam,
  loft,
  normalFor,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { tubePath } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

export const layout = JSON.parse(readFileSync(new URL('../layout.json', import.meta.url)));
export const museumSurfaces = {
  concrete: { slot: 'wall', graph: 'concrete_panel', roughness: 0.84 },
  basalt: { slot: 'foundation', graph: 'stone_basalt', roughness: 0.9 },
  pale: { slot: 'trim', graph: 'stone_limestone_raw', roughness: 0.77 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.67, metallic: 0.25 },
  glass: { slot: 'window', graph: 'window_grid', roughness: 0.54 },
  roof: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.83 },
  bronze: { slot: 'trim', graph: 'metal_bronze_cast', roughness: 0.74, metallic: 0.53 },
  water: {
    slot: 'trim',
    localRef: 'palette:#506b5c',
    name: 'Court basin water',
    roughness: 0.24,
    metallic: 0.25,
  },
  curtain: {
    slot: 'trim',
    localRef: 'palette:#dce8e4',
    name: 'Falling water',
    roughness: 0.28,
    metallic: 0.12,
    alphaMode: 'BLEND',
    baseColorFactor: [1, 1, 1, 0.37],
    doubleSided: true,
  },
};
const tint = {
  concrete: 'bcb7a7',
  pale: 'd5d0bd',
  stone: 'a9a69b',
  basalt: '74736c',
  bed: '62645a',
  dark: '5e625a',
  walk: '98948b',
  glass: '556c6a',
  glow: '79928b',
  roof: 'a6a9a0',
  rib: '878e8b',
  silver: 'b4b8ae',
  bronze: '6d6e5d',
  carving: '92917c',
  bronzeShade: '5a6053',
  pond: '63786c',
  water: '596f65',
  spray: 'cddbd5',
  leaf: '717d54',
  reed: '979269',
  letter: '645d4e',
  flagGreen: '42735f',
  flagWhite: 'dfd9cb',
  flagRed: 'aa514c',
};
const color = Object.fromEntries(
  Object.entries(tint).map(([k, v]) => [
    k,
    v.match(/../g).map((c) => {
      const x = parseInt(c, 16) / 255;
      return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
    }),
  ]),
);
const detailByLevel = { skyline: 0, district: 1, street: 2, closeup: 3, master: 4 };
const ref = 'palette:#ffffff',
  up = [0, 1, 0],
  down = [0, -1, 0],
  west = [-1, 0, 0],
  tau = 2 * Math.PI;
const mix = (a, b, t) => a + (b - a) * t,
  pt = ([x, z], y) => [x, y, z];
const floorY = (x) => (x <= -91 ? 1.25 : x >= -79 ? 0.11 : mix(1.25, 0.11, (x + 91) / 12));
function face(out, slot, tint, points, towards) {
  for (let i = 1; i < points.length - 1; i++) {
    let p = [points[0], points[i], points[i + 1]],
      n = normalFor(...p);
    if (n.reduce((s, v, k) => s + v * towards[k], 0) < 0) {
      p = p.toReversed();
      n = normalFor(...p);
    }
    if (Math.hypot(...n) > 0.5) out.addTriangle(slot, ref, p, n, undefined, color[tint]);
  }
}
function block(out, slot, tint, x, z, w, d, low, high) {
  const ring = (y) =>
    [
      [-1, -1],
      [-1, 1],
      [1, 1],
      [1, -1],
    ].map(([u, v]) => [x + u * w * 0.5, y, z + v * d * 0.5]);
  loft(out, slot, [ring(low), ring(high)], color[tint]);
}
function surface(out, slot, tint, region, y, n = up) {
  for (const tri of region.triangles)
    face(
      out,
      slot,
      tint,
      tri.map((i) => pt(region.vertices[i], typeof y === 'number' ? y : y(region.vertices[i]))),
      n,
    );
}
function plaza(out, detail) {
  for (const shape of layout.floor) surface(out, 'basalt', 'walk', shape, (p) => floorY(p[0]));
  const panels = layout.apron,
    stride = detail === 0 ? 5 : detail === 1 ? 2 : 1;
  for (let i = 0; i < panels.length; ) {
    const a = panels[i];
    let j = i;
    while (
      j + 1 < panels.length &&
      j - i + 1 < stride &&
      (a.seam[0][0] === a.seam[1][0]
        ? panels[j + 1].seam[1][0] === a.seam[0][0]
        : panels[j + 1].seam[1][1] === a.seam[0][1])
    )
      j++;
    const b = panels[j];
    face(
      out,
      'basalt',
      'walk',
      [
        pt(a.level[0], a.levels[0]),
        pt(b.level[1], b.levels[1]),
        pt(b.seam[1], b.seamY[1]),
        pt(a.seam[0], a.seamY[0]),
      ],
      up,
    );
    face(
      out,
      'basalt',
      'walk',
      [
        pt(a.seam[0], a.seamY[0]),
        pt(b.seam[1], b.seamY[1]),
        pt(b.edge[1], b.edgeY[1]),
        pt(a.edge[0], a.edgeY[0]),
      ],
      up,
    );
    i = j + 1;
  }
}
function basin(out, p, detail) {
  const { outer, inner, rimY, waterY, bottomY } = p;
  surface(out, 'water', p.kind === 'reflecting' ? 'pond' : 'water', p.water, waterY);
  for (const [i, a] of outer.entries()) {
    const j = (i + 1) % outer.length,
      b = outer[j],
      c = inner[i],
      d = inner[j];
    const n = [a[1] - b[1], 0, b[0] - a[0]];
    face(out, 'basalt', 'basalt', [pt(a, rimY), pt(b, rimY), pt(d, rimY), pt(c, rimY)], up);
    face(
      out,
      'basalt',
      'dark',
      [pt(c, rimY), pt(d, rimY), pt(d, bottomY), pt(c, bottomY)],
      n.map((v) => -v),
    );
    if (rimY > 0.18)
      face(out, 'basalt', 'basalt', [pt(a, 0.09), pt(b, 0.09), pt(b, rimY), pt(a, rimY)], n);
  }
  if (detail < 2 || p.kind !== 'reflecting') return;
  const n = detail >= 3 ? 28 : 11;
  for (let i = 0; i < n; i++) {
    const x = -5.85 + i * 1.1,
      z = -17.05 + (i % 5) * 0.59;
    const s = ((i * 13) % 9) * 0.025;
    for (let j = 0; j < 3; j++) {
      const u = x + (j - 1) * 0.15,
        y = waterY + 0.2 + s + (j % 2) * 0.12,
        w = 0.09;
      face(
        out,
        'pale',
        j === 1 ? 'reed' : 'leaf',
        [
          [u - w, waterY, z],
          [u + w, waterY, z],
          [u + 0.16, y, z - 0.13],
        ],
        west,
      );
    }
    if (detail >= 3) {
      const a = 0.23 + (i % 4) * 0.03;
      face(
        out,
        'pale',
        'leaf',
        [
          [x - a, waterY + 0.016, z],
          [x, waterY + 0.016, z + a],
          [x + a, waterY + 0.016, z],
          [x, waterY + 0.016, z - a],
        ],
        up,
      );
    }
  }
}
function frame(a, b, n) {
  const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
  return {
    l,
    n,
    p: (u, y, d = 0) => [mix(a[0], b[0], u / l) + n[0] * d, y, mix(a[1], b[1], u / l) + n[2] * d],
  };
}
function panel(out, f, slot, tint, a, b, low, high, d = 0) {
  if (b - a < 0.01 || high - low < 0.01) return;
  const p = f.p;
  face(out, slot, tint, [p(a, low, d), p(b, low, d), p(b, high, d), p(a, high, d)], f.n);
}
function walls(out, detail) {
  for (const form of layout.forms)
    for (const region of form.regions) {
      const { rings, bottoms } = region;
      for (const [j, ring] of rings.entries())
        for (const [i, a] of ring.entries()) {
          const k = (i + 1) % ring.length,
            b = ring[k],
            l = Math.hypot(a[0] - b[0], a[1] - b[1]);
          if (l < 0.025) continue;
          const n = [(a[1] - b[1]) / l, 0, (b[0] - a[0]) / l],
            center = a.map((v, i) => (v + b[i]) * 0.5);
          const open = layout.facades.some(
            (f) =>
              f.n.reduce((s, v, i) => s + v * n[i], 0) > 0.77 &&
              (Math.abs(f.n[2]) > 0.6
                ? center[0] > f.start[0] - 1.1 &&
                  center[0] < f.end[0] + 1.1 &&
                  Math.abs(center[1] - f.start[1]) < 0.58
                : center[1] > f.start[1] - 0.7 &&
                  center[1] < f.end[1] + 0.7 &&
                  Math.abs(center[0] - f.start[0]) < 0.57),
          );
          if (open) continue;
          face(
            out,
            'concrete',
            form.name === 'rear' ? 'stone' : 'concrete',
            [pt(a, bottoms[j][i]), pt(b, bottoms[j][k]), pt(b, form.top), pt(a, form.top)],
            n,
          );
          if (detail === 0 || l < 3.6) continue;
          const f = frame(a, b, n);
          panel(out, f, 'basalt', 'basalt', 0.1, l - 0.1, 0.15, 1.05, 0.025);
          panel(out, f, 'pale', 'pale', 0.1, l - 0.1, form.top - 0.38, form.top, 0.07);
          if (detail >= 2 && l > 13 && Math.abs(n[2]) > 0.86) {
            const count = Math.floor(l / 7.0);
            for (let q = 0; q < count; q++) {
              const u = ((q + 0.5) * l) / count;
              panel(out, f, 'glass', 'glass', u - 1.78, u + 1.78, 3.5, 4.28, 0.029);
            }
          }
        }
      surface(out, 'roof', 'roof', region, form.top);
    }
}
function hexScreen(out, f, a, b, low, high, detail) {
  const p = f.p;
  if (detail === 0) {
    panel(out, f, 'pale', 'pale', a, b, low, high, 0.08);
    return;
  }
  panel(out, f, 'concrete', 'dark', a, b, low, high, -0.34);
  const rows = detail === 1 ? 2 : detail === 2 ? 3 : 4;
  const columns = Math.max(
    1,
    Math.floor((b - a) / (detail === 1 ? 2.95 : detail === 2 ? 1.79 : 1.24)),
  );
  const du = (b - a) / columns,
    dv = (high - low) / (rows + 0.35);
  for (let row = 0; row < rows; row++)
    for (let col = 0; col < columns; col++) {
      const shift = row % 2 === 0 ? 0 : 0.37,
        u = a + du * (col + 0.5 + shift),
        y = low + dv * (row + 0.61);
      if (u + du * 0.48 > b) continue;
      const outer = Array.from({ length: 6 }, (_, i) => {
        const t = ((i + 0.5) * tau) / 6;
        return [u + du * 0.54 * Math.cos(t), y + dv * 0.55 * Math.sin(t)];
      });
      const inner = outer.map(([x, z]) => [mix(u, x, 0.64), mix(y, z, 0.61)]);
      for (let i = 0; i < 6; i++) {
        const j = (i + 1) % 6;
        face(
          out,
          'pale',
          i < 3 ? 'pale' : 'concrete',
          [p(...outer[i], 0.05), p(...outer[j], 0.05), p(...inner[j], 0.22), p(...inner[i], 0.22)],
          f.n,
        );
        if (detail >= 3)
          face(
            out,
            'pale',
            'stone',
            [
              p(...inner[i], 0.22),
              p(...inner[j], 0.22),
              p(...inner[j], -0.05),
              p(...inner[i], -0.05),
            ],
            f.n,
          );
      }
    }
}
function courtyardFronts(out, detail) {
  for (const wall of layout.facades) {
    const f = frame(wall.start, wall.end, wall.n),
      p = f.p,
      l = f.l,
      top = wall.top;
    const depth = wall.mode === 'screen' ? 1.72 : 0.63;
    panel(out, f, 'concrete', 'concrete', 0, l, 0.1, 3.86, -depth);
    panel(out, f, 'concrete', 'concrete', 0, l, 3.95, 4.35, 0.06);
    panel(out, f, 'pale', 'pale', 0, l, top - 0.52, top + 0.013, 0.1);
    face(
      out,
      'concrete',
      'concrete',
      [p(0, 4, -depth), p(l, 4, -depth), p(l, 4, 0.04), p(0, 4, 0.04)],
      down,
    );
    if (wall.mode === 'screen') hexScreen(out, f, 0.21, l - 0.21, 4.35, top - 0.52, detail);
    else if (wall.mode === 'entry') {
      panel(out, f, 'glass', 'glass', 0.34, l - 0.34, 4.26, top - 0.42, -0.055);
      if (detail >= 2)
        for (let u = 1.5; u < l - 1; u += 2.22)
          panel(out, f, 'metal', 'dark', u - 0.065, u + 0.065, 4.3, top - 0.4, 0.027);
    } else panel(out, f, 'pale', 'stone', 0, l, 4.3, top - 0.43);
    const count = Math.max(1, Math.round(l / (detail >= 2 ? 4.75 : 8)));
    for (let i = 0; i < count; i++) {
      const u = (l * (i + 0.5)) / count,
        width = Math.min(1.75, (l / count) * 0.34);
      panel(
        out,
        f,
        'glass',
        i % 4 === 2 ? 'glow' : 'glass',
        u - width,
        u + width,
        0.45,
        3.51,
        -depth + 0.035,
      );
      if (detail >= 2) {
        panel(out, f, 'metal', 'dark', u - 0.05, u + 0.05, 0.45, 3.51, -depth + 0.07);
        beam(
          out,
          'concrete',
          p(u - width - 0.31, 0.105, -0.24),
          p(u - width - 0.31, 3.95, -0.24),
          0.34,
          0.48,
          color.concrete,
        );
      }
    }
    if (wall.mode === 'rear' && detail >= 2) {
      panel(out, f, 'glass', 'glass', l * 0.31, l * 0.67, 0.38, 4.05, 0.1);
      for (let k = 1; k < 8; k++) {
        const u = mix(l * 0.31, l * 0.67, k / 8);
        panel(out, f, 'metal', 'dark', u - 0.06, u + 0.06, 0.38, 4.06, 0.14);
      }
    }
  }
}
function line(out, slot, tint, f, [x, y], [u, v], w, d) {
  const len = Math.hypot(x - u, y - v),
    a = ((y - v) * w * 0.5) / len,
    b = ((u - x) * w * 0.5) / len;
  face(
    out,
    slot,
    tint,
    [f.p(x + a, y + b, d), f.p(u + a, v + b, d), f.p(u - a, v - b, d), f.p(x - a, y - b, d)],
    f.n,
  );
}
const letters = {
  A: [
    [
      [0, 0],
      [0.5, 1],
      [1, 0],
    ],
    [
      [0.19, 0.38],
      [0.81, 0.38],
    ],
  ],
  C: [
    [
      [1, 0.87],
      [0.66, 1],
      [0.24, 0.86],
      [0.08, 0.5],
      [0.24, 0.14],
      [0.66, 0],
      [1, 0.13],
    ],
  ],
  D: [
    [
      [0.1, 0],
      [0.1, 1],
      [0.55, 1],
      [0.92, 0.75],
      [0.92, 0.25],
      [0.55, 0],
      [0.1, 0],
    ],
  ],
  E: [
    [
      [0.95, 1],
      [0.1, 1],
      [0.1, 0],
      [0.95, 0],
    ],
    [
      [0.1, 0.52],
      [0.75, 0.52],
    ],
  ],
  G: [
    [
      [0.94, 0.88],
      [0.6, 1],
      [0.25, 0.87],
      [0.09, 0.62],
      [0.09, 0.3],
      [0.29, 0.05],
      [0.65, 0],
      [0.94, 0.13],
      [0.94, 0.47],
      [0.58, 0.47],
    ],
  ],
  I: [
    [
      [0.5, 0],
      [0.5, 1],
    ],
    [
      [0.19, 1],
      [0.81, 1],
    ],
    [
      [0.19, 0],
      [0.81, 0],
    ],
  ],
  L: [
    [
      [0.11, 1],
      [0.11, 0],
      [0.97, 0],
    ],
  ],
  M: [
    [
      [0.07, 0],
      [0.07, 1],
      [0.5, 0.4],
      [0.93, 1],
      [0.93, 0],
    ],
  ],
  N: [
    [
      [0.11, 0],
      [0.11, 1],
      [0.88, 0],
      [0.88, 1],
    ],
  ],
  O: [
    [
      [0.3, 1],
      [0.7, 1],
      [0.94, 0.75],
      [0.94, 0.25],
      [0.7, 0],
      [0.3, 0],
      [0.06, 0.25],
      [0.06, 0.75],
      [0.3, 1],
    ],
  ],
  P: [
    [
      [0.1, 0],
      [0.1, 1],
      [0.67, 1],
      [0.9, 0.78],
      [0.74, 0.55],
      [0.1, 0.55],
    ],
  ],
  R: [
    [
      [0.1, 0],
      [0.1, 1],
      [0.64, 1],
      [0.91, 0.78],
      [0.69, 0.54],
      [0.1, 0.54],
    ],
    [
      [0.54, 0.54],
      [0.93, 0],
    ],
  ],
  S: [
    [
      [0.89, 0.89],
      [0.6, 1],
      [0.28, 0.89],
      [0.11, 0.7],
      [0.29, 0.54],
      [0.71, 0.45],
      [0.91, 0.26],
      [0.72, 0.06],
      [0.4, 0],
      [0.11, 0.12],
    ],
  ],
  T: [
    [
      [0.05, 1],
      [0.95, 1],
    ],
    [
      [0.5, 1],
      [0.5, 0],
    ],
  ],
  U: [
    [
      [0.1, 1],
      [0.1, 0.25],
      [0.34, 0],
      [0.66, 0],
      [0.9, 0.25],
      [0.9, 1],
    ],
  ],
};
function entrance(out, detail) {
  const z0 = -30.12,
    z1 = 10.86,
    mid = (z0 + z1) * 0.5;
  const f = frame([-81.06, z0], [-81.06, z1], west),
    p = f.p;
  block(out, 'pale', 'pale', -79.0, mid, 4.16, z1 - z0, 4.28, 8.42);
  panel(out, f, 'glass', 'glass', 0.24, f.l - 0.24, 0.33, 4.27, -1.33);
  for (const sign of [-1, 1])
    block(out, 'concrete', 'stone', -80.35, mid + sign * (f.l / 2 + 1.41), 4.36, 3.2, 0.14, 9.03);
  if (!detail) return;
  const divisions = detail >= 3 ? 19 : detail === 2 ? 12 : 7;
  for (let i = 0; i <= divisions; i++) {
    const u = mix(0.31, f.l - 0.31, i / divisions);
    panel(out, f, 'metal', 'dark', u - 0.041, u + 0.041, 0.33, 4.24, -1.28);
    if (detail >= 2)
      panel(
        out,
        f,
        'glass',
        i % 3 === 0 ? 'glow' : 'glass',
        u + 0.13,
        Math.min(f.l - 0.33, u + 1.44),
        0.61,
        2.72,
        -1.27,
      );
  }
  panel(out, f, 'metal', 'dark', 0.25, f.l - 0.25, 2.73, 2.89, -1.22);
  if (detail >= 2) {
    const c = f.l / 2,
      y = 6.41,
      rad = 1.53,
      segments = detail >= 3 ? 28 : 13;
    const ring = Array.from({ length: segments }, (_, i) => [
      c + rad * Math.cos((tau * i) / segments),
      y + rad * Math.sin((tau * i) / segments),
    ]);
    face(
      out,
      'pale',
      'concrete',
      ring.map((v) => p(...v, 0.021)),
      west,
    );
    for (let i = 0; i < segments; i++)
      line(out, 'pale', 'stone', f, ring[i], ring[(i + 1) % segments], 0.066, 0.043);
    const profile = [
      [-0.94, -0.28],
      [-0.42, -0.42],
      [-0.08, 0.02],
      [-0.5, 0.26],
      [-0.09, 0.94],
      [0.16, 0.58],
      [0.73, 0.36],
      [0.47, 0.16],
      [0.17, 0.16],
      [0.45, -0.1],
      [0.31, -0.39],
      [-0.05, -0.53],
      [-0.45, -0.86],
      [-0.92, -0.69],
    ];
    face(
      out,
      'pale',
      'stone',
      profile.map(([a, b]) => p(c + a, y + b, 0.077)),
      west,
    );
    for (const sign of [-1, 1])
      for (let i = 0; i < 5; i++)
        line(
          out,
          'pale',
          'concrete',
          f,
          [c + sign * (0.12 + 0.05 * i), y - 0.62 + i * 0.12],
          [c + sign * (0.38 + 0.07 * i), y - 0.51 + i * 0.12],
          0.07,
          0.103,
        );
  }
  const sign = frame([-132.76, -26.05], [-132.76, 8.2], west);
  block(out, 'basalt', 'basalt', -132.1, -8.925, 1.32, 34.25, 1.25, 2.38);
  panel(out, sign, 'pale', 'pale', 0.29, sign.l - 0.29, 1.47, 2.21, 0.034);
  if (detail >= 2) {
    const text = 'MUSEO NACIONAL DE ANTROPOLOGIA',
      s = 0.65,
      w = (sign.l - 1.46) / text.length,
      start = (sign.l - text.length * w) / 2;
    for (const [i, char] of [...text].entries())
      for (const path of letters[char] ?? [])
        for (let j = 1; j < path.length; j++) {
          const p = ([x, y]) => [start + i * w + x * 0.83, 1.53 + y * s];
          line(out, 'metal', 'letter', sign, p(path[j - 1]), p(path[j]), 0.042, 0.045);
        }
  }
}
function architecturalFittings(out, detail) {
  const mast = [-115.6, 21.2],
    y = 1.25;
  const [x, z] = mast;
  block(out, 'basalt', 'basalt', x, z, 1.28, 1.28, y, y + 0.35);
  if (detail === 0) beam(out, 'metal', [x, y + 0.3, z], [x, 16.25, z], 0.14, 0.14, color.rib);
  else
    tubePath(
      out,
      'metal',
      [
        [x, y + 0.3, z],
        [x, 16.25, z],
      ],
      0.076,
      color.rib,
      detail >= 3 ? 8 : 4,
    );
  const width = 5.2,
    height = 2.78,
    top = 15.9;
  for (const [i, tint] of ['flagGreen', 'flagWhite', 'flagRed'].entries()) {
    const p = (t, y) => [x + 0.13 + Math.sin(t * Math.PI * 2) * 0.26, y, z + t * width];
    const a = i / 3,
      b = (i + 1) / 3;
    for (const sign of [-1, 1])
      face(
        out,
        'metal',
        tint,
        [p(a, top), p(b, top), p(b, top - height), p(a, top - height)],
        [sign, 0, 0],
      );
  }
  if (detail < 2) return;
  for (const [x, z] of [
    [-115, -43],
    [-115, 36],
    [-103, -45],
    [-103, 37],
  ]) {
    block(out, 'basalt', 'basalt', x, z, 3.15, 2.06, y, y + 0.4);
    block(out, 'pale', 'leaf', x, z, 2.84, 1.72, y + 0.4, y + 0.45);
  }
  for (const [x, z, base] of [
    [-63.2, 33.8, 8.62],
    [-48.6, 34.1, 8.62],
    [66.4, -51.2, 8.48],
    [87.2, -51.2, 8.48],
  ]) {
    block(out, 'roof', 'roof', x, z, 2.4, 1.45, base, base + 0.42);
    if (detail >= 3) {
      block(out, 'metal', 'rib', x, z, 2.54, 1.53, base + 0.42, base + 0.5);
      for (let i = 0; i < 5; i++)
        beam(
          out,
          'metal',
          [x - 1.02 + i * 0.5, base + 0.48, z - 0.67],
          [x - 1.02 + i * 0.5, base + 0.48, z + 0.67],
          0.055,
          0.07,
          color.dark,
        );
    }
  }
  if (detail >= 3)
    for (const x of [-123.4, -109.6]) {
      for (const z of [-34.9, 25.3]) {
        block(out, 'basalt', 'basalt', x, z, 2.9, 0.65, y + 0.03, y + 0.49);
        block(out, 'pale', 'stone', x, z, 3.04, 0.7, y + 0.49, y + 0.6);
      }
    }
}
function crossAt(ring, z) {
  return ring
    .flatMap(([a, b], i) => {
      const [c, d] = ring[(i + 1) % ring.length];
      return z >= Math.min(b, d) && z < Math.max(b, d) ? [mix(a, c, (z - b) / (d - b))] : [];
    })
    .sort((a, b) => a - b);
}
function canopy(out, detail) {
  const { top, edgeBottom, rimBottom, outer, hole, surface: shape } = layout.canopy;
  surface(out, 'roof', 'roof', shape, top);
  surface(out, 'metal', 'rib', shape, edgeBottom, down);
  for (const [ring, h, isHole] of [
    [outer, edgeBottom, false],
    [hole, rimBottom, true],
  ]) {
    for (const [i, a] of ring.entries()) {
      const b = ring[(i + 1) % ring.length],
        n = [a[1] - b[1], 0, b[0] - a[0]];
      face(
        out,
        'metal',
        isHole ? 'dark' : 'silver',
        [pt(a, h), pt(b, h), pt(b, top), pt(a, top)],
        isHole ? n.map((v) => -v) : n,
      );
    }
  }
  if (!detail) return;
  const min = Math.min(...outer.map((p) => p[1])),
    max = Math.max(...outer.map((p) => p[1]));
  const count = [0, 19, 56, 112, 164][detail];
  for (let i = 0; i < count; i++) {
    const z = mix(min + 0.2, max - 0.2, (i + 0.5) / count),
      [a, b] = crossAt(outer, z),
      holes = crossAt(hole, z);
    const intervals =
      holes.length === 2
        ? [
            [a, holes[0]],
            [holes[1], b],
          ]
        : [[a, b]];
    for (const [x, u] of intervals) {
      const w = ((max - min) / count) * 0.31,
        y = edgeBottom - 0.018;
      if (u - x < 0.1) continue;
      face(
        out,
        'metal',
        i % 4 === 0 ? 'dark' : 'silver',
        [
          [x + 0.035, y, z - w],
          [u - 0.035, y, z - w],
          [u - 0.035, y, z + w],
          [x + 0.035, y, z + w],
        ],
        down,
      );
    }
  }
}
function fountain(out, detail) {
  const c = layout.canopy,
    {
      center: [x, z],
      hole,
      top,
      rimBottom,
    } = c;
  const rings = (rows, n) => rows.map(([y, r]) => radialRing(y, r, r, n, [x, z]));
  loft(
    out,
    'bronze',
    rings(
      [
        [0.08, 1.85],
        [0.42, 1.88],
        [1.2, 1.69],
        [5.0, 1.54],
        [8.8, 1.51],
        [9.3, 1.81],
        [top + 0.56, 1.04],
        [13.37, 0.63],
      ],
      detail >= 2 ? 24 : detail === 1 ? 14 : 8,
    ),
    color.bronze,
  );
  const polar = (a, r, y) => [x + Math.cos(a) * r, y, z + Math.sin(a) * r];
  const struts = detail >= 3 ? 28 : detail === 2 ? 16 : detail === 1 ? 8 : 4;
  for (let i = 0; i < struts; i++) {
    const a = (i * tau) / struts;
    const inner = polar(a, 1.46, 9.58),
      rim = polar(a, 5.35, rimBottom + 0.38);
    if (detail === 0)
      face(
        out,
        'metal',
        'silver',
        [inner, rim, [rim[0], rim[1] + 0.22, rim[2]], [inner[0], inner[1] + 0.23, inner[2]]],
        up,
      );
    else beam(out, 'metal', inner, rim, 0.26, 0.39, color.silver);
  }
  for (const [i, [u, v]] of c.outer.entries()) {
    const b = c.outer[(i + 1) % c.outer.length],
      count = detail >= 2 ? 4 : 1;
    for (let j = 0; j < count; j++) {
      const t = (j + 0.5) / count,
        base = [mix(u, b[0], t), top + 0.045, mix(v, b[1], t)];
      if (detail >= 2)
        tubePath(out, 'metal', [[x, 12.86, z], base], detail >= 3 ? 0.041 : 0.057, color.rib, 3);
      else
        face(
          out,
          'metal',
          'rib',
          [[x, 12.86, z], [base[0], base[1] - 0.1, base[2]], base, [x, 12.94, z]],
          up,
        );
    }
  }
  if (detail >= 2) {
    for (let i = 0; i < (detail >= 3 ? 12 : 8); i++) {
      const count = detail >= 3 ? 12 : 8,
        a = (i * tau) / count;
      const p = (u, y, d = 0.037) => polar(a + u * 0.63, 1.58 + d + (y < 1.3 ? 0.12 : 0), y);
      const n = [Math.cos(a), 0, Math.sin(a)];
      const relief = [
        [
          [-0.56, 0.81],
          [-0.47, 1.45],
          [-0.62, 1.96],
          [-0.25, 2.3],
          [-0.04, 2.96],
          [0.14, 2.36],
          [0.52, 2.19],
          [0.48, 1.67],
          [0.64, 1.25],
          [0.38, 0.86],
        ],
        [
          [-0.4, 4.24],
          [-0.48, 4.85],
          [-0.14, 5.2],
          [0.16, 4.91],
          [0.52, 5.45],
          [0.62, 4.75],
          [0.34, 4.37],
        ],
      ];
      for (const glyph of relief) {
        const points = glyph.map(([u, y]) => p(u, y + (i % 3) * 0.29, 0.08));
        face(out, 'bronze', 'carving', points, n);
        if (detail >= 3)
          for (let j = 1; j < glyph.length; j++)
            beam(out, 'bronze', points[j - 1], points[j], 0.043, 0.046, color.bronzeShade);
      }
      if (detail >= 3)
        for (let k = 0; k < 5; k++) {
          const y = 5.93 + k * 0.37 + (i % 2) * 0.11;
          beam(
            out,
            'bronze',
            p(-0.56, y, 0.045),
            p(0.52, y + 0.13, 0.048),
            0.068,
            0.062,
            color.carving,
          );
        }
    }
  }
  if (detail === 0) return;
  const strands = detail === 1 ? 20 : detail === 2 ? 46 : detail === 3 ? 87 : 123;
  for (let i = 0; i < strands; i++) {
    const p = (i / strands) * hole.length,
      k = Math.floor(p),
      a = hole[k],
      b = hole[(k + 1) % hole.length],
      t = p - k;
    const u = mix(a[0], b[0], t),
      v = mix(a[1], b[1], t),
      angle = Math.atan2(v - z, u - x),
      n = [Math.cos(angle), 0, Math.sin(angle)];
    const w = detail === 1 ? 0.098 : detail === 2 ? 0.058 : 0.048 + (i % 4) * 0.013;
    const topY = rimBottom + 0.015,
      bottom = 0.153 + (i % 5) * 0.047;
    const edge = (sign, y, dr) => [
      u + n[0] * dr - sign * w * n[2],
      y,
      v + n[2] * dr + sign * w * n[0],
    ];
    face(
      out,
      'curtain',
      'spray',
      [edge(-1, bottom, 0.19), edge(1, bottom, 0.2), edge(1, topY, 0), edge(-1, topY, 0)],
      n,
    );
    if (detail >= 3 && i % 3 === 0) {
      const y = 0.16 + (i % 7) * 0.012;
      face(
        out,
        'curtain',
        'spray',
        [edge(-1, y, 0.45), edge(1, y, 0.48), edge(1, y, 0.11), edge(-1, y, 0.11)],
        up,
      );
    }
  }
}
export function buildMuseumLevel(out, level) {
  const detail = detailByLevel[level];
  plaza(out, detail);
  for (const p of layout.pools) basin(out, p, detail);
  walls(out, detail);
  courtyardFronts(out, detail);
  entrance(out, detail);
  architecturalFittings(out, detail);
  canopy(out, detail);
  fountain(out, detail);
}
export const buildMuseumSkyline = (out) => buildMuseumLevel(out, 'skyline');
export const buildMuseumDistrict = (out) => buildMuseumLevel(out, 'district');
export const buildMuseumStreet = (out) => buildMuseumLevel(out, 'street');
export const buildMuseumCloseup = (out) => buildMuseumLevel(out, 'closeup');
