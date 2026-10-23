/** 'N0551': Yuetan's mapped bell tower, triple-arch gate and hall, with surviving enclosure forms. */
import { normalFor } from './authored-structure-mesh.mjs';
import {
  openingBuilder,
  openingReveals,
  openingShape,
  prepareOpening,
} from './authored-wall-openings.mjs';
import { buildChineseHipRoof } from './chinese-roof-geometry.mjs';
import { box, loft, prism, rect } from './khmer-structure-geometry.mjs';

function place(face, b) {
  const c = Math.cos(b.angle ?? 0),
    s = Math.sin(b.angle ?? 0);
  return (role, ps, n) =>
    face(
      role,
      ps.map(([x, y, z]) => [b.center[0] + c * x - s * z, y, b.center[1] + s * x + c * z]),
      [c * n[0] - s * n[2], n[1], s * n[0] + c * n[2]],
    );
}
function pierced(f, holes, d) {
  const prepared = holes.map((h) => prepareOpening(h, 0, d)),
    out = openingBuilder({ addTriangle: (role, _ref, ps, n) => f(role, ps, n) }, prepared);
  return {
    prepared,
    face: (role, ps, n) => {
      for (let i = 1; i < ps.length - 1; i++)
        if (Math.hypot(...normalFor(ps[0], ps[i], ps[i + 1])) > 0.5)
          out.addTriangle(role, 'palette:#ffffff', [ps[0], ps[i], ps[i + 1]], n, [], []);
    },
  };
}
function heritageRoof(f, b, d) {
  if (d === 0) {
    buildChineseHipRoof(f, b, d);
    return;
  }
  const { low: y, rise: h } = b,
    w = b.width + 1.3,
    dep = b.depth + 1.3,
    span = Math.max(w * 0.62, w - dep * 0.46),
    inner = dep * 0.6,
    outer = [
      [-w / 2, -dep / 2],
      [w / 2, -dep / 2],
      [w / 2, dep / 2],
      [-w / 2, dep / 2],
    ],
    innerRing = [
      [-span / 2, -inner / 2],
      [span / 2, -inner / 2],
      [span / 2, inner / 2],
      [-span / 2, inner / 2],
    ];
  const split = (ring) =>
      ring.flatMap((a, i) => {
        const b = ring[(i + 1) % ring.length];
        return [a, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]];
      }),
    edge = split(outer),
    inside = split(innerRing);
  for (let i = 0; i < 8; i++) {
    const j = (i + 1) % 8,
      a = edge[i],
      bb = edge[j],
      c = inside[j],
      e = inside[i],
      ya = y + (i % 2 === 0 ? 0.34 : 0.04),
      yb = y + (j % 2 === 0 ? 0.34 : 0.04),
      target = [a[0] + bb[0], 1, a[1] + bb[1]];
    f(
      'roof',
      [
        [a[0], ya, a[1]],
        [bb[0], yb, bb[1]],
        [c[0], y + h * 0.32, c[1]],
        [e[0], y + h * 0.32, e[1]],
      ],
      target,
    );
    f(
      'roof',
      [
        [a[0], y, a[1]],
        [bb[0], y, bb[1]],
        [bb[0], yb, bb[1]],
        [a[0], ya, a[1]],
      ],
      [target[0], 0, target[2]],
    );
  }
  const rows = d === 1 ? 2 : 4;
  for (const side of [-1, 1]) {
    for (let k = 0; k < rows; k++) {
      const a = k / rows,
        bb = (k + 1) / rows,
        z0 = ((side * inner) / 2) * (1 - a),
        z1 = ((side * inner) / 2) * (1 - bb),
        y0 = y + h * (0.32 + 0.68 * Math.pow(a, 1.35)),
        y1 = y + h * (0.32 + 0.68 * Math.pow(bb, 1.35));
      f(
        'roof',
        [
          [-span / 2, y0, z0],
          [span / 2, y0, z0],
          [span / 2, y1, z1],
          [-span / 2, y1, z1],
        ],
        [0, 1, side],
      );
    }
    f(
      'green',
      [
        [(side * span) / 2, y + h * 0.32, -inner / 2],
        [(side * span) / 2, y + h * 0.32, inner / 2],
        [(side * span) / 2, y + h, 0],
      ],
      [side, 0, 0],
    );
  }
  f(
    'roof',
    outer.map(([x, z]) => [x, y, z]),
    [0, -1, 0],
  );
  box(f, 'roof', 0, y + h, 0, span + 0.2, 0.19, 0.28);
  for (const side of [-1, 1]) {
    loft(
      f,
      'roof',
      (side * span) / 2,
      0,
      [
        [y + h, 0.4],
        [y + h + 0.28, 0.46],
        [y + h + 0.6, 0.28],
        [y + h + 0.9, 0.12],
      ],
      d >= 2,
    );
    if (d >= 2)
      for (let j = 0; j < 3; j++)
        loft(
          f,
          'roof',
          side * (span / 2 + 0.2 + j * 0.2),
          0,
          [
            [y + h + 0.2 + j * 0.1, 0.22],
            [y + h + 0.42 + j * 0.1, 0.28],
            [y + h + 0.6 + j * 0.1, 0.08],
          ],
          true,
        );
  }
}
function band(f, w, dep, y, d) {
  if (d === 0) return;
  box(f, 'blue', 0, y, 0, w, 0.65, dep);
  for (const sign of [-1, 1]) {
    const z = sign * (dep / 2 + 0.008),
      count = Math.max(2, Math.round(w / 3));
    for (let i = 0; i < count; i++) {
      const x = -w / 2 + ((i + 0.5) * w) / count,
        a = (w / count) * 0.38;
      f(
        'green',
        [
          [x - a, y + 0.055, z],
          [x + a, y + 0.055, z],
          [x + a, y + 0.32, z],
          [x - a, y + 0.32, z],
        ],
        [0, 0, sign],
      );
      if (d >= 2) {
        const q = 0.12;
        f(
          'gold',
          [
            [x, y + 0.06, z + sign * 0.004],
            [x + q, y + 0.185, z + sign * 0.004],
            [x, y + 0.31, z + sign * 0.004],
            [x - q, y + 0.185, z + sign * 0.004],
          ],
          [0, 0, sign],
        );
      }
    }
  }
}
function panel(f, x, z, F, w, h, d, role = 'wood') {
  box(f, role, x, F, z, w, h, 0.12);
  if (d === 0) return;
  box(f, 'inset', x, F + h * 0.4, z + 0.075, w * 0.78, h * 0.52, 0.08);
  const n = d === 1 ? 3 : d === 2 ? 6 : 10,
    m = d === 1 ? 3 : d === 2 ? 5 : 9;
  for (let i = 0; i <= n; i++)
    box(f, role, x - w * 0.39 + (i * w * 0.78) / n, F + h * 0.4, z + 0.13, 0.045, h * 0.52, 0.07);
  for (let i = 0; i <= m; i++)
    box(f, role, x, F + h * (0.4 + (0.52 * i) / m), z + 0.13, w * 0.78, 0.045, 0.07);
  if (d >= 2)
    for (const sign of [-1, 1])
      box(f, 'gold', x + sign * w * 0.34, F + 0.18, z + 0.075, 0.035, h * 0.24, 0.025);
}
function steps(f, b, w, dep, count, sample) {
  const c = Math.cos(b.angle),
    s = Math.sin(b.angle),
    at = (x, z) => sample(b.center[0] + c * x - s * z, b.center[1] + s * x + c * z),
    lo = Math.max(...[-w / 2, 0, w / 2].map((x) => at(x, dep / 2 + 1.5))) + 0.035,
    base = Math.min(b.baseY, lo - 0.4);
  for (let i = 0; i < count; i++)
    box(
      f,
      'stone',
      0,
      base,
      dep / 2 + ((i + 0.5) * 1.5) / count,
      w,
      b.floorY - ((b.floorY - lo) * (i + 1)) / count - base,
      1.5 / count,
    );
}
function bell(face, b, d, sample) {
  const f = place(face, b),
    F = b.floorY,
    w = b.width - 4,
    dep = b.depth - 4,
    p = rect(0, 0, w, dep),
    hole = {
      center: [0, 0],
      axis: [1, 0],
      width: 3.8,
      bottom: F + 0.03,
      spring: 3.4,
      height: 5.4,
      shape: 'round',
      depth: dep + 1,
    },
    cut = pierced(f, [hole], d);
  prism(f, 'gray', p, b.baseY, F);
  prism(cut.face, 'stone', p, F, F + 1.15);
  prism(cut.face, 'wall', p, F + 1.15, F + 6.1);
  openingReveals(
    { addTriangle: (_s, _r, ps, n) => f('wall', ps, n) },
    p.outline,
    () => F,
    () => F + 6.1,
    cut.prepared,
    [],
  );
  buildChineseHipRoof(
    f,
    { x: 0, z: 0, width: b.width - 3, depth: b.depth - 3, low: F + 6.1, rise: 1.3 },
    d,
  );
  const upper = rect(0, 0, w - 0.45, dep - 0.45),
    win = {
      center: [0, (dep - 0.45) / 2 - 0.12],
      axis: [1, 0],
      width: 2.25,
      bottom: F + 7.5,
      spring: 1.45,
      height: 2.5,
      shape: 'round',
      depth: 0.7,
    },
    up = pierced(f, d === 0 ? [] : [win], d);
  prism(up.face, 'wood', upper, F + 7.05, F + 10.85);
  const shape = openingShape(win, d),
    h = prepareOpening(win, 0, d);
  f(
    'inset',
    shape.map(([u, y]) => h.point(u, y, d === 0 ? 0.13 : -0.35)),
    [0, 0, 1],
  );
  openingReveals(
    { addTriangle: (_s, _r, ps, n) => f('wood', ps, n) },
    upper.outline,
    () => F + 7.05,
    () => F + 10.85,
    up.prepared,
    [],
  );
  if (d >= 1)
    for (let i = -3; i <= 3; i++)
      box(f, 'wood', i * 0.29, F + 7.55, win.center[1] + 0.04, 0.055, 1.85, 0.08);
  band(f, w + 0.1, dep + 0.1, F + 10.35, d);
  heritageRoof(
    f,
    { x: 0, z: 0, width: b.width - 1.3, depth: b.depth - 1.3, low: F + 11.05, rise: 3.3 },
    d,
  );
  steps(f, b, 4.8, dep, d === 0 ? 1 : 3, sample);
}
function leaf(f, h, d) {
  const shape = openingShape(h, d),
    z = h.z ?? 0;
  for (const sign of [-1, 1])
    f(
      'wood',
      shape.map(([x, y]) => [h.center[0] + x, y, z + sign * 0.065]),
      [0, 0, sign],
    );
  for (let i = 0; i < shape.length; i++) {
    const j = (i + 1) % shape.length,
      a = shape[i],
      b = shape[j];
    f(
      'wood',
      [
        [h.center[0] + a[0], a[1], z - 0.065],
        [h.center[0] + b[0], b[1], z - 0.065],
        [h.center[0] + b[0], b[1], z + 0.065],
        [h.center[0] + a[0], a[1], z + 0.065],
      ],
      [b[1] - a[1], a[0] - b[0], 0],
    );
  }
  if (d >= 2)
    for (let i = 0; i < 6; i++)
      for (let j = 0; j < 7; j++)
        box(
          f,
          'metal',
          h.center[0] + ((i - 2.5) * h.width) / 7,
          h.bottom + 0.3 + j * 0.48,
          z + 0.09,
          0.075,
          0.075,
          0.055,
        );
  if (d >= 1) box(f, 'inset', h.center[0], h.bottom, z + 0.073, 0.035, h.height, 0.015);
}
function gate(face, b, d, sample) {
  const f = place(face, b),
    F = b.floorY,
    w = b.width - 2.3,
    dep = b.depth - 2.2,
    p = rect(0, 0, w, dep),
    xs = [-w * 0.31, 0, w * 0.31],
    holes = xs.map((x, i) => ({
      center: [x, 0],
      axis: [1, 0],
      width: i === 1 ? 4.2 : 3.8,
      bottom: F + 0.03,
      spring: 3.2,
      height: 5.35,
      shape: 'round',
      depth: dep + 1,
    })),
    cut = pierced(f, d === 0 ? [holes[1]] : holes, d);
  prism(f, 'gray', p, b.baseY, F);
  prism(cut.face, 'stone', p, F, F + 0.9);
  prism(cut.face, 'wall', p, F + 0.9, F + 6.9);
  openingReveals(
    { addTriangle: (_s, _r, ps, n) => f('wall', ps, n) },
    p.outline,
    () => F,
    () => F + 6.9,
    cut.prepared,
    [],
  );
  for (const i of [0, 2]) leaf(f, { ...holes[i], z: -dep / 2 + (d === 0 ? -0.08 : 0.35) }, d);
  band(f, w + 0.2, dep + 0.2, F + 6.15, d);
  heritageRoof(
    f,
    { x: 0, z: 0, width: b.width - 1.3, depth: b.depth - 1.3, low: F + 6.9, rise: 2.9 },
    d,
  );
  steps(f, b, w - 0.5, dep, d === 0 ? 1 : 3, sample);
}
function hall(face, b, d, sample) {
  const f = place(face, b),
    F = b.floorY,
    w = b.width - 2,
    dep = b.depth - 2,
    holes = Array.from({ length: 6 }, (_, i) => ({
      center: [(i - 2.5) * w * 0.13, dep / 2 - 0.12],
      axis: [1, 0],
      width: w * 0.123,
      bottom: F + 0.12,
      height: 3.2,
      shape: 'rect',
      depth: 0.6,
    })),
    cut = pierced(f, holes, d),
    p = rect(0, 0, w, dep);
  if (d === 0) {
    prism(f, 'gray', p, b.baseY, F);
    prism(f, 'wall', p, F, F + 4.5);
    f(
      'wood',
      [
        [-w * 0.4, F + 0.12, dep / 2 + 0.01],
        [w * 0.4, F + 0.12, dep / 2 + 0.01],
        [w * 0.4, F + 3.32, dep / 2 + 0.01],
        [-w * 0.4, F + 3.32, dep / 2 + 0.01],
      ],
      [0, 0, 1],
    );
    heritageRoof(
      f,
      { x: 0, z: 0, width: b.width - 1.3, depth: b.depth - 1.3, low: F + 4.5, rise: 2.8 },
      d,
    );
    steps(f, b, w * 0.8, dep, 1, sample);
    return;
  }
  prism(f, 'gray', p, b.baseY, F);
  prism(cut.face, 'wall', p, F, F + 4.5);
  for (const h of holes) panel(f, h.center[0], dep / 2 - 0.28, F + 0.12, h.width, 3.2, d);
  openingReveals(
    { addTriangle: (_s, _r, ps, n) => f('wood', ps, n) },
    p.outline,
    () => F,
    () => F + 4.5,
    cut.prepared,
    [],
  );
  band(f, w + 0.3, dep + 0.3, F + 3.75, d);
  heritageRoof(
    f,
    { x: 0, z: 0, width: b.width - 1.3, depth: b.depth - 1.3, low: F + 4.5, rise: 2.8 },
    d,
  );
  steps(f, b, w * 0.8, dep, d === 0 ? 1 : 3, sample);
}
function wall(face, a, b, H, role, roof, sample) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    len = Math.hypot(dx, dz),
    nx = (-dz / len) * 0.35,
    nz = (dx / len) * 0.35,
    p = [
      [a[0] + nx, a[1] + nz],
      [b[0] + nx, b[1] + nz],
      [b[0] - nx, b[1] - nz],
      [a[0] - nx, a[1] - nz],
    ],
    lo = p.map(([x, z]) => [x, sample(x, z) - 0.4, z]),
    hi = p.map(([x, z]) => [x, sample(x, z) + H, z]);
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    face(role, [lo[i], lo[j], hi[j], hi[i]], [p[j][1] - p[i][1], 0, p[i][0] - p[j][0]]);
  }
  face(
    roof,
    [hi[0], hi[1], [b[0], sample(...b) + H + 0.27, b[1]], [a[0], sample(...a) + H + 0.27, a[1]]],
    [nx, 1, nz],
  );
  face(
    roof,
    [hi[2], hi[3], [a[0], sample(...a) + H + 0.27, a[1]], [b[0], sample(...b) + H + 0.27, b[1]]],
    [-nx, 1, -nz],
  );
}
function inner(face, r, d, sample) {
  const I = r.inner,
    corners = [
      [I.west, I.north],
      [I.east, I.north],
      [I.east, I.south],
      [I.west, I.south],
    ];
  for (let i = 0; i < 4; i++)
    wall(face, corners[i], corners[(i + 1) % 4], I.height, 'gray', 'grayRoof', sample);
  const floor = Math.max(...[-14, 0, 14].map((u) => sample(I.west, I.gateZ + u))) + 0.06,
    f = place(face, { center: [I.west - 0.4, I.gateZ], angle: Math.PI / 2 });
  for (const x of [-10, 0, 10]) {
    const top = x === 0 ? 4.8 : 4.1,
      span = x === 0 ? 6.0 : 5.0;
    for (const sign of [-1, 1]) {
      const u = x + (sign * span) / 2;
      box(f, 'stone', u, floor, 0, 0.55, top + 0.7, 0.6);
      const foot = sample(I.west - 0.4, I.gateZ + u) - 0.35;
      box(f, 'stone', u, foot, 0.25, 0.85, floor + 0.2 - foot, 1.15);
      if (d >= 1)
        loft(
          f,
          'stone',
          u,
          0,
          [
            [floor + top + 0.7, 0.44],
            [floor + top + 0.85, 0.78],
            [floor + top + 1.18, 0.5],
            [floor + top + 1.43, 0.08],
          ],
          d >= 2,
        );
    }
    const foot =
      Math.min(...[-span / 2, 0, span / 2].map((u) => sample(I.west - 0.4, I.gateZ + x + u))) -
      0.35;
    box(f, 'stone', x, foot, 0, span + 0.3, floor + 0.08 - foot, 1.0);
    box(f, 'stone', x, floor + top - 0.65, 0, span, 0.65, 0.5);
    box(f, 'gray', x, floor, 0, span - 0.55, top - 0.65, 0.18);
    if (d >= 1) box(f, 'stone', x, floor + top - 0.4, 0.28, span - 0.45, 0.11, 0.12);
  }
}
export function buildMoonTempleHeritage(face, d, r, sample) {
  bell(face, r.bell, d, sample);
  gate(face, r.gate, d, sample);
  hall(face, r.hall, d, sample);
  inner(face, r, d, sample);
  for (const run of r.outerRuns)
    for (let i = 1; i < run.length; i++)
      wall(face, run[i - 1], run[i], 3.2, 'wall', 'roof', sample);
  const b = r.gate,
    c = Math.cos(b.angle),
    s = Math.sin(b.angle),
    half = (b.width - 2.3) / 2;
  for (const [sign, end] of [
    [-1, [-1, -105]],
    [1, [24, -105]],
  ])
    wall(
      face,
      end,
      [b.center[0] + sign * c * half, b.center[1] + sign * s * half],
      3.2,
      'wall',
      'roof',
      sample,
    );
}
