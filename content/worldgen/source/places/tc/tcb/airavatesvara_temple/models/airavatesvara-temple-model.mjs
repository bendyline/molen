import controls from '../plan-controls.json' with { type: 'json' };
import { beamPath } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  areaSign,
  block,
  closed,
  edge,
  face,
  mix,
  pairs,
  palette,
  panel,
  pavilion,
  rect,
  ring,
  shell,
  surface,
  up,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';

const surfaces = {
  stone: surface('wall', 'stone_sandstone_raw', 0.94),
  carved: surface('trim', 'stone_sandstone'),
  stair: surface('foundation', 'stone_ashlar'),
  cover: surface('roof', 'stone_sandstone'),
  opening: surface('door', 'stone_sandstone_raw'),
  bronze: surface('trim', 'metal_bronze_cast', 0.83, 0.22),
};
const C = palette({
  base: 'a89071',
  wet: '95836f',
  wall: 'bda384',
  wallDark: 'aa8e71',
  warm: 'c8ab86',
  edge: 'd3b68d',
  crown: 'c3a47b',
  shadow: '7e6955',
  dark: '433a2e',
  bronze: '68776e',
});
const podium = 3.48;

function scaled(outline, center, factor) {
  return outline.map(([x, z]) => [mix(center[0], x, factor), mix(center[1], z, factor)]);
}

function slab(out, shape, y, h, material, tone) {
  shell(out, shape, () => y, y + h, {
    wall: material,
    roof: material,
    color: tone,
    roofColor: tone,
  });
}

function frieze(out, lod, w, y, spacing, span = w.length) {
  if (lod < 2) return;
  const count = Math.max(2, Math.round(span / spacing));
  for (let i = 0; i < count; i++) {
    const u = ((i + 0.5) * span) / count;
    const r = Math.min(0.15, spacing * 0.22);
    const h = i % 3 === 1 ? 0.2 : 0.13;
    face(
      out,
      'carved',
      [
        w.p(u - r, y - 0.06, 0.026),
        w.p(u + r, y - 0.06, 0.026),
        w.p(u + r, y + 0.055, 0.044),
        w.p(u, y + h, 0.11),
        w.p(u - r, y + 0.055, 0.044),
      ],
      w.normal,
      i % 3 ? C.warm : C.shadow,
    );
  }
}

function column(out, lod, x, z, base, top, width, tone = C.warm) {
  const h = top - base;
  if (h < 0.48) return;
  const half = width * 0.5;
  if (lod < 2) {
    block(out, 'carved', x - half, base, z - half, width, h, width, tone);
    if (lod === 1)
      block(
        out,
        'carved',
        x - width * 0.7,
        top - h * 0.12,
        z - width * 0.7,
        width * 1.4,
        h * 0.12,
        width * 1.4,
        C.edge,
      );
    return;
  }
  const box = (y, f, d, tint) =>
    block(
      out,
      'carved',
      x - (width * f) / 2,
      y,
      z - (width * f) / 2,
      width * f,
      d,
      width * f,
      tint,
    );
  box(base, 1.33, h * 0.12, C.base);
  box(top - 0.13 * h, 1.55, h * 0.13, C.edge);
  ring(
    out,
    'carved',
    [x, z],
    [
      [base + 0.12 * h, width * 0.63],
      [base + 0.19 * h, half],
      [base + 0.32 * h, width * 0.42],
      [top - 0.29 * h, width * 0.38],
      [top - 0.21 * h, width * 0.53],
      [top - 0.135 * h, width * 0.53],
    ],
    lod === 3 ? 8 : 5,
    tone,
  );
  if (lod === 3) {
    box(base + 0.325 * h, 0.97, h * 0.085, C.edge);
    box(top - 0.22 * h, 1.13, h * 0.043, C.warm);
  }
}

function niche(out, lod, w, u, y, height, width, projection, figure = true) {
  const left = u - width * 0.5;
  const right = u + width * 0.5;
  const spring = y + height * 0.68;
  const top = y + height;
  const segments = [2, 4, 6, 8][lod];
  const arched = Array.from({ length: segments + 1 }, (_, i) => {
    const t = i / segments;
    return [mix(left, right, t), spring + Math.sin(t * Math.PI) * (top - spring)];
  });
  panel(out, 'opening', w, left, right, y, spring + 0.006, projection, C.dark);
  face(
    out,
    'opening',
    arched.map(([x, v]) => w.p(x, v, projection)),
    w.normal,
    C.dark,
  );
  if (lod < 2) return;
  const border = [[left, y], ...arched, [right, y]];
  if (lod === 3)
    beamPath(
      out,
      'carved',
      border.map(([x, v]) => w.p(x, v, projection + 0.072)),
      width * 0.16,
      width * 0.2,
      C.edge,
    );
  else {
    const outer = (x, v) => w.p(u + (x - u) * 1.17, y + (v - y) * 1.055, projection + 0.035);
    for (const [[x, v], [a, b]] of pairs(border))
      face(
        out,
        'carved',
        [w.p(x, v, projection + 0.033), w.p(a, b, projection + 0.033), outer(a, b), outer(x, v)],
        w.normal,
        C.edge,
      );
  }
  if (!figure) return;
  const [x, , z] = w.p(u, y, projection + 0.12);
  const toe = height * 0.07;
  ring(
    out,
    'carved',
    [x, z],
    [
      [y, width * 0.22],
      [y + toe, width * 0.25],
      [y + height * 0.22, width * 0.19],
      [y + height * 0.55, width * 0.16],
      [y + height * 0.65, width * 0.22],
      [y + height * 0.75, width * 0.13],
      [y + height * 0.89, width * 0.055],
    ],
    lod === 3 ? 8 : 4,
    C.wallDark,
  );
}

function terrace(out, lod, shape, grade) {
  shell(out, shape, (p) => Math.min(grade(p) - 0.44, 0), podium - 0.17, {
    wall: 'stair',
    roof: 'cover',
    color: C.base,
    roofColor: C.warm,
  });
  const direction = areaSign(shape);
  for (const [a, b] of pairs(closed(shape))) {
    const w = edge(a, b, direction);
    for (const [y, h, depth, tint] of [
      [0.38, 0.21, 0.12, C.wet],
      [0.78, 0.26, 0.14, C.edge],
      [1.21, 0.13, 0.29, C.warm],
      [1.44, 0.32, 0.35, C.edge],
      [1.94, 0.31, 0.11, C.shadow],
      [2.35, 0.31, 0.27, C.warm],
      [2.98, 0.16, 0.27, C.edge],
      [3.18, 0.28, 0.11, C.warm],
    ]) {
      if (lod === 0 && ![1.44, 2.35, 3.18].includes(y)) continue;
      panel(out, 'carved', w, 0, w.length, y, y + h, depth, tint);
      if (lod > 1 && [1.44, 2.35, 3.18].includes(y))
        beamPath(
          out,
          'carved',
          [w.p(0, y + h, depth * 0.6), w.p(w.length, y + h, depth * 0.6)],
          0.19,
          h * 0.59,
          tint,
        );
    }
    frieze(out, lod, w, 2.73, lod === 3 ? 0.61 : 1.25);
  }
}

function sanctuary(out, lod, d) {
  const center = [-24.23, -1.11];
  const form = rect(-32.32, -9.72, -15.55, 7.52);
  const baseTop = 8.73;
  slab(out, form, podium - 0.01, baseTop - podium + 0.02, 'stone', C.wallDark);
  slab(out, scaled(form, center, 1.027), baseTop - 0.5, 0.62, 'carved', C.edge);
  for (const [a, b] of pairs(closed(form))) {
    const w = edge(a, b);
    const count = lod < 2 ? 3 : 5;
    for (let i = 0; i < count; i++) {
      const u = ((i + 0.5) * w.length) / count;
      niche(out, lod, w, u, podium + 0.89, 2.9, 1.2, 0.043, lod === 3 || i === 2);
      if (lod > 1 || (lod === 1 && i === 1))
        for (const r of [u - 1.02, u + 1.02]) {
          const [x, , z] = w.p(r, 0, 0.31);
          column(out, lod === 3 ? 3 : 1, x, z, podium, baseTop - 0.52, 0.49);
        }
    }
  }

  const heights = [baseTop, 11.27, 13.71, 15.91, 17.96, 19.96];
  for (let i = 0; i < d.towerLevels; i++) {
    const base = heights[i];
    const h = heights[i + 1] - base;
    const scale = [0.9, 0.76, 0.625, 0.495, 0.364][i];
    const stage = scaled(form, center, scale);
    slab(out, stage, base, h + 0.015, 'stone', i % 2 ? C.wallDark : C.wall);
    if (lod > 0) slab(out, scaled(form, center, scale + 0.035), base, h * 0.19, 'carved', C.warm);
    slab(out, scaled(form, center, scale + 0.04), base + h * 0.74, h * 0.19, 'carved', C.edge);
    if (lod === 0) continue;
    for (const [a, b] of pairs(closed(stage))) {
      const w = edge(a, b);
      const count = i <= 1 ? 5 : i === 2 ? 4 : 3;
      const spacing = w.length / count;
      for (let j = 0; j < count; j++) {
        const u = (j + 0.5) * spacing;
        const emphasized = j === Math.floor(count / 2);
        const projection = emphasized ? 0.29 : 0.19;
        panel(
          out,
          'carved',
          w,
          u - spacing * 0.34,
          u + spacing * 0.34,
          base + h * 0.19,
          base + h * (emphasized ? 0.73 : 0.68),
          projection,
          C.warm,
        );
        niche(
          out,
          lod,
          w,
          u,
          base + h * 0.24,
          h * 0.44,
          spacing * 0.44,
          projection + 0.025,
          lod === 3,
        );
      }
      frieze(out, lod, w, base + h * 0.91, lod === 3 ? 0.8 : 1.3);
    }
  }
  slab(out, scaled(form, center, 0.285), 19.78, 1.25, 'stone', C.crown);
  slab(out, scaled(form, center, 0.31), 20.58, 0.28, 'carved', C.edge);
  ring(
    out,
    'cover',
    center,
    lod === 0
      ? [
          [20.74, 2.27],
          [22.35, 0.85],
          [23.07, 0.34],
        ]
      : [
          [20.68, 2.23],
          [21, 2.36],
          [21.29, 2.18],
          [22.04, 1.62],
          [22.62, 0.95],
          [23.07, 0.33],
        ],
    lod === 0 ? 8 : 12,
    C.crown,
  );
  ring(
    out,
    'bronze',
    center,
    [
      [23.03, 0.31],
      [23.37, 0.26],
      [23.58, 0.35],
      [23.77, 0.12],
      [d.mappedTowerHeightMeters, 0.026],
    ],
    lod === 0 ? 4 : 8,
    C.bronze,
  );
  if (lod > 1) {
    const crownFaces = scaled(form, center, 0.29);
    for (const [a, b] of pairs(closed(crownFaces)))
      niche(
        out,
        lod,
        edge(a, b),
        Math.hypot(b[0] - a[0], b[1] - a[1]) * 0.5,
        20.8,
        1.6,
        1.17,
        0.37,
      );
  }
}

function mandapas(out, lod) {
  const central = rect(-16.1, -9.53, 9.66, 7.55);
  const open = rect(8.6, -11.63, 32.09, 11.02);
  slab(out, central, podium - 0.04, 5.09, 'stone', C.wallDark);
  slab(out, rect(-16.4, -9.84, 9.95, 7.86), 8.29, 0.63, 'cover', C.edge);
  slab(out, rect(-14.09, -7.5, 0.9, 5.31), 8.89, 2.86, 'stone', C.warm);
  slab(out, rect(-14.31, -7.67, 1.1, 5.47), 11.56, 0.31, 'cover', C.edge);
  const roof = 8.09;
  slab(out, rect(8.32, -11.85, 32.33, 11.24), roof, 0.83, 'cover', C.edge);
  slab(out, rect(8.58, -11.62, 32.11, 11.06), roof + 0.78, 0.63, 'carved', C.warm);
  slab(out, rect(10.8, -8.78, 28.85, 8.04), podium, roof - podium, 'opening', C.dark);
  for (const [[a, b], i] of pairs(closed(open)).map((pair, i) => [pair, i])) {
    if (i === 3) continue;
    const w = edge(a, b);
    const count = i === 1 ? 8 : 9;
    for (let j = 0; j < count; j++) {
      const u = ((j + 0.5) * w.length) / count;
      const [x, , z] = w.p(u, 0, -0.31);
      if (lod > 0 || j % 3 === 0)
        column(
          out,
          lod === 1 ? 0 : lod,
          x,
          z,
          podium,
          roof,
          j === 0 || j === count - 1 ? 0.86 : 0.65,
        );
      if (lod > 0) {
        const f = podium + 0.57;
        if (j === 0 || j === count - 1) niche(out, lod, w, u, f, 2.81, 1.03, 0.024);
        const thickness = 0.37;
        const crown = [
          [u - thickness, 9.42],
          [u - 0.29, 9.85],
          [u - 0.12, 10.2],
          [u + 0.13, 10.17],
          [u + 0.28, 9.87],
          [u + thickness, 9.42],
        ];
        face(
          out,
          'carved',
          crown.map(([q, y]) => w.p(q, y, 0.027)),
          w.normal,
          C.crown,
        );
      }
    }
    frieze(out, lod, w, 8.62, lod === 3 ? 0.54 : 1.12);
  }
  for (const [a, b] of pairs(closed(central))) {
    const w = edge(a, b);
    const n = Math.max(2, Math.round(w.length / 3.17));
    for (let j = 0; j < n; j++) {
      const x = ((j + 0.5) * w.length) / n;
      if (lod > 0) niche(out, lod, w, x, podium + 0.77, 3.02, 0.83, 0.047, lod === 3);
      if (lod > 1) {
        const [u, , v] = w.p(x - 0.93, 0, 0.25);
        column(out, lod, u, v, podium, 8.33, 0.4);
      }
    }
  }
}

function chariot(out, lod, grade) {
  const left = 16.78;
  const right = 24.03;
  const high = podium;
  const stepCount = lod === 0 ? 3 : 11;
  for (let i = 0; i < stepCount; i++) {
    const near = 15.95 - (5.01 * (i + 1)) / stepCount;
    const y = mix(0.17, high, (i + 1) / stepCount);
    const bottom = Math.min(-0.53, grade([20, near]) - 0.28);
    block(
      out,
      'stair',
      left + 0.78,
      bottom,
      near,
      right - left - 1.56,
      y - bottom,
      5.02 / stepCount,
      C.warm,
    );
  }
  const points = [
    [left - 0.12, 11.02],
    [left - 0.11, 16.4],
    [left + 0.67, 16.4],
    [left + 0.67, 11.02],
  ];
  for (const x of [0, right - left - 0.55])
    slab(
      out,
      points.map(([u, z]) => [u + x, z]),
      -0.38,
      1.85,
      'stair',
      C.base,
    );

  for (const [x, z] of [
    [left + 0.1, 16.48],
    [right - 0.13, 16.48],
  ]) {
    const normal = [0, 0, 1];
    const y = 1.16;
    const count = [8, 12, 16, 24][lod];
    const rad = 0.91;
    const wheel = (a, r, d = 0) => [x + Math.cos(a) * r, y + Math.sin(a) * r, z + d];
    for (let i = 0; i < count; i++) {
      const a = (i * 2 * Math.PI) / count;
      const b = ((i + 1) * 2 * Math.PI) / count;
      face(
        out,
        'carved',
        [wheel(a, rad), wheel(b, rad), wheel(b, rad * 0.82, 0.15), wheel(a, rad * 0.82, 0.15)],
        normal,
        C.edge,
      );
      if (lod > 1 && i % (lod === 3 ? 3 : 2) === 0)
        beamPath(
          out,
          'carved',
          [wheel(a, rad * 0.14, 0.19), wheel(a, rad * 0.83, 0.13)],
          0.11,
          0.13,
          C.warm,
        );
    }
    face(
      out,
      'carved',
      Array.from({ length: 8 }, (_, i) => wheel((i * Math.PI) / 4, 0.185, 0.2)),
      normal,
      C.crown,
    );
    if (lod > 1) {
      const body = [
        [x, 1.62, 15.22],
        [x - 0.05, 1.54, 15.75],
        [x, 1.86, 16.36],
        [x, 2.37, 16.52],
      ];
      beamPath(out, 'carved', body, 0.43, 0.46, C.wallDark);
      beamPath(
        out,
        'carved',
        [
          [x, 2.37, 16.49],
          [x, 2.45, 16.78],
          [x, 2.26, 17.03],
        ],
        0.23,
        0.23,
        C.edge,
      );
      for (const sign of [-1, 1])
        beamPath(
          out,
          'carved',
          [
            [x + sign * 0.14, 1.72, 16.36],
            [x + sign * 0.14, 1.55, 16.71],
            [x + sign * 0.16, 1.19, 16.92],
          ],
          0.13,
          0.14,
          C.warm,
        );
    }
  }
}

function courtGalleries(out, lod, d, grade) {
  const outer = d.outline;
  const inner = d.parts.court;
  const left = outer[0][0] + 0.13;
  const right = outer[1][0] - 0.13;
  const north = outer[0][1] + 0.12;
  const south = outer[2][1] - 0.12;
  const sign = -areaSign(inner);
  for (const [a, b] of pairs(closed(inner))) {
    const w = edge(a, b, sign);
    const p = (u, y, d = 0) => w.p(u, y, d);
    const start = p(0, 0);
    const end = p(w.length, 0);
    const xAxis = Math.abs(start[0] - end[0]) > Math.abs(start[2] - end[2]);
    const wallNormal = w.normal[xAxis ? 2 : 0];
    const fixed = xAxis ? (wallNormal > 0 ? north : south) : wallNormal > 0 ? left : right;
    const joined = (u, h) => {
      const v = p(u, h);
      v[xAxis ? 2 : 0] = fixed;
      return v;
    };
    const rim = (u, y) => {
      const a = p(u, y);
      const b = joined(u, y);
      const d = Math.hypot(a[0] - b[0], a[2] - b[2]);
      return p(u, y, -Math.min(d, 5.6));
    };
    const baseAt = (u) => {
      const [x, , z] = p(u, 0);
      return Math.max(0.52, Math.min(5.9, grade([x, z]) + 0.45));
    };
    const atRightGate =
      !xAxis && a[0] > 39 && b[0] > 39 && Math.min(a[1], b[1]) < 0 && Math.max(a[1], b[1]) > 0;
    const count = Math.max(1, Math.round(w.length / [12, 4.3, 3.65, 3.12][lod]));
    for (let j = 0; j < count; j++) {
      const from = (j * w.length) / count;
      const to = ((j + 1) * w.length) / count;
      const mid = (from + to) * 0.5;
      const f = baseAt(from);
      const t = baseAt(to);
      const skip = atRightGate && Math.abs(p(mid, 0)[2] + 1.08) < 2.5;
      const roofAt = (u) => baseAt(u) + 3.65;
      const h = roofAt(from);
      const k = roofAt(to);
      face(
        out,
        'cover',
        [p(from, h), p(to, k), rim(to, k + 0.15), rim(from, h + 0.15)],
        up,
        C.warm,
      );
      face(
        out,
        'carved',
        [p(from, h - 0.27), p(to, k - 0.27), p(to, k + 0.17, 0.15), p(from, h + 0.17, 0.15)],
        w.normal,
        C.edge,
      );
      if (skip) continue;
      face(out, 'stone', [p(from, 0.03), p(to, 0.03), p(to, t), p(from, f)], w.normal, C.base);
      face(
        out,
        'carved',
        [
          p(from, f - 0.25, 0.08),
          p(to, t - 0.25, 0.08),
          p(to, t + 0.05, 0.08),
          p(from, f + 0.05, 0.08),
        ],
        w.normal,
        C.warm,
      );
      const [x, , z] = p(mid, 0, -0.21);
      if (lod > 0) column(out, [0, 0, 1, 2][lod], x, z, baseAt(mid), roofAt(mid), 0.43);
    }
  }
  for (const [a, b] of pairs(closed(outer))) {
    const w = edge(a, b, areaSign(outer));
    const cuts = [0, w.length];
    const eastGate = a[0] > 45 && b[0] > 45;
    if (eastGate) {
      const center = -1.08 - a[1];
      cuts.splice(1, 0, center - 2.38, center + 2.38);
    }
    for (const [[from, to], i] of pairs(cuts).map((pair, i) => [pair, i])) {
      if (eastGate && i === 1) continue;
      const width = to - from;
      const count = Math.max(1, Math.ceil(width / 9));
      for (let j = 0; j < count; j++) {
        const u = from + (j * width) / count;
        const v = from + ((j + 1) * width) / count;
        const atGround = (x) => {
          const [u, , z] = w.p(x, 0);
          return grade([u, z]);
        };
        const y = atGround(u);
        const h = atGround(v);
        const wall = [w.p(u, y - 0.34), w.p(v, h - 0.34), w.p(v, h + 3.43), w.p(u, y + 3.43)];
        face(out, 'stone', wall, w.normal, C.wallDark);
        if (lod > 1) {
          face(
            out,
            'stone',
            wall,
            w.normal.map((n) => -n),
            C.shadow,
          );
        }
        if (lod === 3) {
          beamPath(out, 'cover', [w.p(u, y + 3.41), w.p(v, h + 3.41)], 0.32, 0.22, C.edge);
        }
      }
    }
  }
  const shrine = d.parts['north-shrine'];
  const g = Math.max(...shrine.map(grade)) - 0.04;
  slab(out, shrine, g - 1.25, 4.84, 'stone', C.wallDark);
  const center = shrine.reduce(([x, z], [a, b]) => [x + a / 4, z + b / 4], [0, 0]);
  slab(out, scaled(shrine, center, 1.043), g + 3.47, 0.43, 'carved', C.edge);
  slab(out, scaled(shrine, center, 0.83), g + 3.92, 0.8, 'cover', C.warm);
  if (lod > 0) {
    const side = edge(shrine[0], shrine[3]);
    niche(out, lod, side, side.length / 2, g + 0.45, 2.26, 0.87, 0.041);
  }
}

function build(out, lod, d, grade) {
  const temple = d.parts['principal-temple'];
  const plinth = temple.filter((_, i) => i !== 6 && i !== 7);
  terrace(out, lod, plinth, grade);
  sanctuary(out, lod, d);
  mandapas(out, lod);
  chariot(out, lod, grade);
  courtGalleries(out, lod, d, grade);
}

const structure = pavilion(
  import.meta.url,
  {
    surfaces,
    brief:
      'The standing Chola temple at Darasuram with a richly tiered 24 m stone vimana, pillared mandapa, south chariot-shaped stair, open court and perimeter galleries.',
    camera: [61, 33, 68],
    lookAt: [-5, 7.1, -1],
    yaw: 0.52,
    sun: [414, 620, 501],
    views: [
      {
        name: 'five-tier-vimana-and-molded-sanctuary',
        position: [-51, 14, 23],
        lookAt: [-22, 11, -1.5],
      },
      { name: 'pillared-hall-and-south-chariot', position: [41, 12, 26], lookAt: [22, 5.6, 8.2] },
      { name: 'main-court-and-cloister', position: [44, 30, -56], lookAt: [-5, 5, -10] },
    ],
  },
  build,
);
export const { model, skyline, district, street, closeup } = structure;
model.category = 'temple';
model.buildingCutout = {
  outline: controls.dimensions.outline,
  minimumCoverage: 0.9,
  basis:
    'Replace the named temple precinct building relation using its mapped outer cloister. The court remains open within the authored structure.',
};
