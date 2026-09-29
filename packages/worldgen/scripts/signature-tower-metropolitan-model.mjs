/** Restored Metropolitan Life clock tower: original exterior reconstruction from LPC1530. */
import { ShapeUtils, Vector2 } from 'three';
import {
  beam,
  chamferedRectangle,
  loft,
  normalFor,
  radialRing,
  sphere,
} from './authored-structure-mesh.mjs';
import { face, grid, mappedCap, mappedSolid, tri } from './signature-tower-expansion-models.mjs';
import { box, tube } from './structure-mesh.mjs';

const stone = [0.77, 0.745, 0.68],
  white = [0.85, 0.85, 0.78],
  glass = [0.12, 0.17, 0.18],
  bronze = [0.22, 0.16, 0.085],
  gold = [0.79, 0.54, 0.13],
  dark = [0.065, 0.075, 0.07];
const half = (y) => [
  12.954 - (0.3048 * Math.min(y, 146)) / 146,
  11.43 - (0.2286 * Math.min(y, 146)) / 146,
];
function fronts(y = 0, scale = 1) {
  const h = half(y);
  return [
    {
      axis: 0,
      sign: 1,
      width: 2 * h[1] * scale,
      at: (u, v, d = 0) => [half(v)[0] * scale + d, v, (-u * half(v)[1]) / h[1]],
    },
    {
      axis: 1,
      sign: 1,
      width: 2 * h[0] * scale,
      at: (u, v, d = 0) => [(u * half(v)[0]) / h[0], v, half(v)[1] * scale + d],
    },
    {
      axis: 0,
      sign: -1,
      width: 2 * h[1] * scale,
      at: (u, v, d = 0) => [-half(v)[0] * scale - d, v, (u * half(v)[1]) / h[1]],
    },
    {
      axis: 1,
      sign: -1,
      width: 2 * h[0] * scale,
      at: (u, v, d = 0) => [(-u * half(v)[0]) / h[0], v, -half(v)[1] * scale - d],
    },
  ];
}
const rect = (w, d) => [
  [-w, -d],
  [-w, d],
  [w, d],
  [w, -d],
];
function patch(out, at, x0, x1, y0, y1, color = stone, slot = 'limestone', depth = 0) {
  if (x1 - x0 < 0.008 || y1 - y0 < 0.008) return;
  face(
    out,
    slot,
    [at(x0, y0, depth), at(x1, y0, depth), at(x1, y1, depth), at(x0, y1, depth)],
    color,
  );
}
function strip(out, at, x0, x1, y0, y1, depth, color = stone, slot = 'carved') {
  const a = [at(x0, y0, depth), at(x1, y0, depth), at(x1, y1, depth), at(x0, y1, depth)],
    b = [at(x0, y0, -0.22), at(x1, y0, -0.22), at(x1, y1, -0.22), at(x0, y1, -0.22)];
  face(out, slot, a, color);
  for (let i = 0; i < 4; i++) face(out, slot, [a[i], b[i], b[(i + 1) % 4], a[(i + 1) % 4]], color);
}
function windows(out, at, width, y0, y1, spans, { project = false, material = 'limestone' } = {}) {
  const lo = y0 + 0.7,
    hi = y1 - 0.58;
  patch(out, at, -width / 2, width / 2, y0, lo, stone, material);
  patch(out, at, -width / 2, width / 2, hi, y1, stone, material);
  let x = -width / 2;
  for (const [a, b] of spans) {
    patch(out, at, x, a, lo, hi, stone, material);
    x = b;
    const t = 0.12;
    strip(out, at, a, a + t, lo, hi, 0.09);
    strip(out, at, b - t, b, lo, hi, 0.09);
    strip(out, at, a + t, b - t, lo, lo + t, 0.09);
    strip(out, at, a + t, b - t, hi - t, hi, 0.09);
    grid(
      out,
      [
        at(a + t, lo + t, -0.2),
        at(b - t, lo + t, -0.2),
        at(b - t, hi - t, -0.2),
        at(a + t, hi - t, -0.2),
      ],
      glass,
      2,
      3.7,
      0.045,
      [0.5, 0.52, 0.49],
    );
    if (project) strip(out, at, a - 0.06, b + 0.06, y0 + 0.3, lo, 0.24);
  }
  patch(out, at, x, width / 2, lo, hi, stone, material);
}
function triples(width, count = 3) {
  const centers = [-width * 0.285, 0, width * 0.285],
    ww = width > 24 ? 1.2192 : 1.0668,
    gap = 0.28;
  return centers.flatMap((c) =>
    Array.from({ length: count }, (_, i) => [
      c + (i - (count - 1) / 2) * (ww + gap) - ww / 2,
      c + (i - (count - 1) / 2) * (ww + gap) + ww / 2,
    ]),
  );
}
function band(out, y0, y1, s = 0.04, color = stone) {
  const h = half(y0);
  mappedSolid(out, 'carved', rect(h[0] + s, h[1] + s), y0, y1, color);
}

function arc(cx, cy, rx, ry, a, b, n = 22) {
  return Array.from({ length: n + 1 }, (_, i) => {
    const t = a + ((b - a) * i) / n;
    return [cx + Math.cos(t) * rx, cy + Math.sin(t) * ry];
  });
}
const pi = Math.PI;
const digits = {
  0: [arc(0.5, 0.5, 0.4, 0.47, 0, 2 * pi, 36)],
  1: [
    [
      [0.14, 0.77],
      [0.5, 0.97],
      [0.5, 0.03],
    ],
    [
      [0.18, 0.03],
      [0.86, 0.03],
    ],
  ],
  2: [[...arc(0.5, 0.75, 0.42, 0.23, pi, -0.6), [0.1, 0.03], [0.94, 0.03]]],
  3: [[...arc(0.45, 0.74, 0.44, 0.24, 2.5, -pi / 2), ...arc(0.45, 0.27, 0.44, 0.25, pi / 2, -2.5)]],
  4: [
    [
      [0.7, 0.96],
      [0.06, 0.34],
      [0.98, 0.34],
    ],
    [
      [0.71, 0.97],
      [0.71, 0.03],
    ],
  ],
  5: [[[0.92, 0.96], [0.13, 0.96], [0.08, 0.54], ...arc(0.46, 0.29, 0.44, 0.27, 2.1, -2.5)]],
  6: [[...arc(0.53, 0.5, 0.44, 0.47, 0.8, pi * 1.1), ...arc(0.52, 0.3, 0.41, 0.28, pi, -pi)]],
  7: [
    [
      [0.06, 0.97],
      [0.97, 0.97],
      [0.26, 0.03],
    ],
  ],
  8: [arc(0.5, 0.75, 0.36, 0.22, 0, 2 * pi, 28), arc(0.5, 0.28, 0.43, 0.26, 0, 2 * pi, 30)],
  9: [[...arc(0.48, 0.72, 0.41, 0.26, 0, 2 * pi), ...arc(0.48, 0.5, 0.41, 0.47, 0.4, -2.2)]],
};
function ring(out, at, cx, cy, r0, r1, depth, color, slot = 'carved', count = 128) {
  for (let i = 0; i < count; i++) {
    const a = (i / count) * 2 * pi,
      b = ((i + 1) / count) * 2 * pi,
      pt = (r, t) => at(cx + Math.sin(t) * r, cy + Math.cos(t) * r, depth);
    face(out, slot, [pt(r0, a), pt(r1, a), pt(r1, b), pt(r0, b)].toReversed(), color);
  }
}
function disk(out, at, cx, cy, r, depth, color, slot = 'carved', count = 128) {
  for (let i = 0; i < count; i++) {
    const a = (-i / count) * 2 * pi,
      b = (-(i + 1) / count) * 2 * pi;
    tri(
      out,
      slot,
      [
        at(cx, cy, depth),
        at(cx + Math.sin(a) * r, cy + Math.cos(a) * r, depth),
        at(cx + Math.sin(b) * r, cy + Math.cos(b) * r, depth),
      ],
      color,
    );
  }
}
function path(out, at, points, r, color, depth, slot = 'metal') {
  for (let i = 1; i < points.length; i++)
    tube(out, slot, at(...points[i - 1], depth), at(...points[i], depth), r, color, 6);
}
function clock(out, at) {
  const cy = 110.7,
    r = 4.0386;
  disk(out, at, 0, cy, r, 0.29, white);
  ring(out, at, 0, cy, r, r + 0.3, 0.31, stone);
  ring(out, at, 0, cy, r + 0.3, r + 0.39, 0.25, stone);
  ring(out, at, 0, cy, 3.71, 3.77, 0.32, [0.13, 0.35, 0.37], 'recess');
  // Mosaic central star, all original geometry and shared neutral surfaces.
  for (let i = 0; i < 32; i++) {
    const a = (-i / 32) * 2 * pi,
      b = (-(i + 1) / 32) * 2 * pi,
      mid = (a + b) / 2;
    tri(
      out,
      'recess',
      [
        at(0, cy, 0.32),
        at(Math.sin(a) * 1.55, cy + Math.cos(a) * 1.55, 0.32),
        at(Math.sin(mid) * 0.95, cy + Math.cos(mid) * 0.95, 0.32),
      ],
      [0.19, 0.39, 0.4],
    );
    tri(
      out,
      'recess',
      [
        at(0, cy, 0.32),
        at(Math.sin(mid) * 0.95, cy + Math.cos(mid) * 0.95, 0.32),
        at(Math.sin(b) * 1.55, cy + Math.cos(b) * 1.55, 0.32),
      ],
      [0.19, 0.39, 0.4],
    );
  }
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * 2 * pi;
    disk(out, at, Math.sin(a) * 3.88, cy + Math.cos(a) * 3.88, 0.13335, 0.36, bronze, 'metal', 12);
  }
  for (let n = 1; n <= 12; n++) {
    const a = (n / 12) * 2 * pi,
      txt = String(n),
      cx = Math.sin(a) * 2.8,
      ny = cy + Math.cos(a) * 2.8 - 0.61;
    for (let k = 0; k < txt.length; k++)
      for (const stroke of digits[txt[k]]) {
        const points = stroke.map(([x, y]) => [
          cx + (k - (txt.length - 1) / 2) * 0.71 + (x - 0.5) * 0.61,
          ny + y * 1.2192,
        ]);
        path(out, at, points, 0.054, bronze, 0.375);
        path(out, at, points, 0.031, [0.065, 0.08, 0.077], 0.42);
      }
  }
  for (const [angle, tip, tail, w] of [
    [pi / 3, 3.5, 1.68, 0.1],
    [-pi / 3, 2.55, 1.514, 0.15],
  ]) {
    const p = [
        [-w, -tail],
        [w, -tail],
        [w * 0.65, tip - 0.25],
        [0, tip],
        [-w * 0.65, tip - 0.25],
      ],
      center = [0, cy];
    const pts = p.map(([x, y]) => [
      center[0] + x * Math.cos(angle) + y * Math.sin(angle),
      center[1] - x * Math.sin(angle) + y * Math.cos(angle),
    ]);
    for (const ix of ShapeUtils.triangulateShape(
      pts.map((p) => new Vector2(...p)),
      [],
    )) {
      let q = ix.map((i) => at(...pts[i], 0.51));
      if (
        normalFor(...q).reduce((s, v, i) => s + v * normalFor(at(0, 0), at(1, 0), at(0, 1))[i], 0) <
        0
      )
        q = q.toReversed();
      tri(out, 'metal', q, dark);
    }
  }
  disk(out, at, 0, cy, 0.25, 0.57, bronze, 'metal', 32);
  // Raised fruit-and-leaf wreath, with individual curved leaves around the rim.
  for (let i = 0; i < 56; i++) {
    const a = (i / 56) * 2 * pi,
      c = [Math.sin(a) * 4.2, cy + Math.cos(a) * 4.2],
      d = [Math.cos(a), -Math.sin(a)],
      v = [Math.sin(a), Math.cos(a)];
    for (const side of [-1, 1]) {
      const pts = [
        [c[0] - 0.19 * d[0], c[1] - 0.19 * d[1]],
        [c[0] + side * 0.2 * v[0], c[1] + side * 0.2 * v[1]],
        [c[0] + 0.32 * d[0], c[1] + 0.32 * d[1]],
      ];
      const ridge = at(c[0] + 0.08 * d[0], c[1] + 0.08 * d[1], 0.48);
      for (let k = 0; k < 3; k++) {
        let p = [at(...pts[k], 0.34), at(...pts[(k + 1) % 3], 0.34), ridge];
        const n = normalFor(...p),
          target = normalFor(at(0, 0), at(1, 0), at(0, 1));
        if (n.reduce((s, v, i) => s + v * target[i], 0) < 0) p = p.toReversed();
        tri(out, 'carved', p, stone);
      }
    }
    if (i % 4 === 0) sphere(out, 'carved', at(c[0], c[1], 0.45), [0.13, 0.13, 0.13], stone, 10, 6);
  }
  // Shell and opposed stylized dolphin scrolls preserve the surviving spandrel motif.
  for (const sx of [-1, 1])
    for (const sy of [-1, 1]) {
      const cx = sx * 3.8,
        yy = cy + sy * 3.8;
      for (let j = 0; j < 9; j++) {
        const a = (-0.8 + j * 0.2) * pi,
          pts = arc(cx, yy, 0.46, 0.45, a, a + 0.12, 6);
        path(out, at, [[cx, yy - 0.35], ...pts], 0.047, stone, 0.38, 'carved');
      }
      for (const sign of [-1, 1]) {
        const pts = arc(cx + sign * 0.65, yy - 0.28, 0.48, 0.35, 0.1, 1.8 * pi, 24);
        path(out, at, pts, 0.067, stone, 0.37, 'carved');
        sphere(
          out,
          'carved',
          at(cx + sign * 0.46, yy - 0.38, 0.42),
          [0.13, 0.2, 0.1],
          stone,
          10,
          8,
        );
      }
    }
}

/** A real arched masonry screen: both faces and each intrados remain visible. */
function archScreen(out, at, width, y0, y1, count, openingWidth, spring) {
  const holes = [],
    pitch = (width - 1.4) / count;
  for (let i = 0; i < count; i++) {
    const cx = (i - (count - 1) / 2) * pitch,
      r = openingWidth / 2;
    holes.push([[cx - r, y0 + 0.45], [cx + r, y0 + 0.45], ...arc(cx, spring, r, r, 0, pi, 28)]);
  }
  const outer = [
      [-width / 2, y0],
      [width / 2, y0],
      [width / 2, y1],
      [-width / 2, y1],
    ],
    all = [outer, ...holes],
    flat = all.flat();
  for (const ix of ShapeUtils.triangulateShape(
    outer.map((p) => new Vector2(...p)),
    holes.map((h) => h.map((p) => new Vector2(...p))),
  )) {
    for (const [d, reverse] of [
      [0, false],
      [-0.65, true],
    ]) {
      let q = ix.map((i) => at(...flat[i], d)),
        n = normalFor(...q),
        target = normalFor(at(0, 0), at(1, 0), at(0, 1));
      if (n.reduce((s, v, i) => s + v * target[i], 0) < 0 !== reverse) q = q.toReversed();
      tri(out, 'limestone', q, stone);
    }
  }
  for (const h of holes)
    for (let i = 0; i < h.length; i++) {
      const a = h[i],
        b = h[(i + 1) % h.length];
      face(
        out,
        'carved',
        [at(...a, 0), at(...a, -0.65), at(...b, -0.65), at(...b, 0)].toReversed(),
        stone,
      );
    }
  for (let i = 0; i < count; i++) {
    const cx = (i - (count - 1) / 2) * pitch,
      r = openingWidth / 2;
    for (let j = 0; j < 18; j++) {
      const a = (j / 18) * pi,
        b = ((j + 1) / 18) * pi,
        pts = [
          at(cx + Math.cos(a) * r, spring + Math.sin(a) * r, 0.025),
          at(cx + Math.cos(a) * (r + 0.28), spring + Math.sin(a) * (r + 0.28), 0.025),
          at(cx + Math.cos(b) * (r + 0.28), spring + Math.sin(b) * (r + 0.28), 0.025),
          at(cx + Math.cos(b) * r, spring + Math.sin(b) * r, 0.025),
        ];
      face(
        out,
        'carved',
        pts,
        stone.map((v) => v * (j % 2 ? 0.985 : 1.015)),
      );
    }
    strip(out, at, cx - r, cx + r, y0 + 0.5, y0 + 0.78, 0.07);
    strip(out, at, cx - r, cx + r, y0 + 1.7, y0 + 1.9, 0.12);
    for (let x = cx - r + 0.25; x < cx + r - 0.2; x += 0.45)
      strip(out, at, x - 0.08, x + 0.08, y0 + 0.78, y0 + 1.7, 0.07);
  }
}

function archedDormer(out, at, cx, cy, width, height, slot = 'carved', color = stone) {
  const r = width / 2,
    spring = cy + height - r,
    outline = [[cx - r, cy], [cx + r, cy], ...arc(cx, spring, r, r, 0, pi, 22)],
    inner = [
      [cx - r + 0.16, cy + 0.16],
      [cx + r - 0.16, cy + 0.16],
      ...arc(cx, spring, r - 0.16, r - 0.16, 0, pi, 22),
    ];
  // Stand the flat vertical window ahead of the sloping roof, with a complete hood return.
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i],
      b = outline[(i + 1) % outline.length],
      c = inner[i],
      d = inner[(i + 1) % inner.length];
    face(out, slot, [at(...a, 0.42), at(...b, 0.42), at(...d, 0.42), at(...c, 0.42)], color);
    face(out, slot, [at(...a, 0.42), at(...a, -0.36), at(...b, -0.36), at(...b, 0.42)], color);
  }
  for (const ix of ShapeUtils.triangulateShape(
    inner.map((p) => new Vector2(...p)),
    [],
  )) {
    let p = ix.map((i) => at(...inner[i], 0.39));
    const n = normalFor(...p),
      target = normalFor(at(0, 0), at(1, 0), at(0, 1));
    if (n.reduce((s, v, i) => s + v * target[i], 0) < 0) p = p.toReversed();
    tri(out, 'glass', p, glass);
  }
}

function roof(out) {
  const h0 = [10.6, 9.1],
    h1 = [3.3, 2.8],
    lo = 165,
    hi = 187.8,
    hw = (y) => h0.map((h, i) => h + ((h1[i] - h) * (y - lo)) / (hi - lo));
  loft(
    out,
    'carved',
    [rect(...h0).map(([x, z]) => [x, lo, z]), rect(...h1).map(([x, z]) => [x, hi, z])],
    stone,
  );
  for (const axis of [0, 1])
    for (const sign of [-1, 1]) {
      const at = (u, y, d = 0) =>
          axis === 0 ? [sign * (hw(y)[0] + d), y, -sign * u] : [sign * u, y, sign * (hw(y)[1] + d)],
        w = h0[1 - axis];
      for (const slope of [-0.62, 0.62])
        for (let offset = -32; offset < 32; offset += 2.1) {
          let previous;
          for (let y = lo + 0.15; y < hi - 0.1; y += 0.14) {
            const u = offset + slope * (y - lo);
            if (Math.abs(u) < hw(y)[1 - axis] - 0.27) {
              const p = at(u, y, 0.028);
              if (previous) tube(out, 'carved', previous, p, 0.034, [0.62, 0.6, 0.55], 4);
              previous = p;
            } else previous = undefined;
          }
        }
      const counts = axis === 1 ? [4, 3, 2, 1] : [3, 2, 1, 1];
      for (let row = 0; row < 4; row++) {
        const y = lo + 1.0 + row * 5.25,
          count = counts[row],
          step = (hw(y)[1 - axis] * 1.45) / Math.max(count, 2);
        for (let i = 0; i < count; i++) {
          const u = (i - (count - 1) / 2) * step,
            depth = hw(y + 1)[axis] + 0.3;
          const vertical = (x, v, d = 0) =>
            axis === 0 ? [sign * (depth + d), v, -sign * x] : [sign * x, v, sign * (depth + d)];
          archedDormer(out, vertical, u, y, 1.08, 1.58);
        }
      }
      for (const u of [-1, 1])
        beam(
          out,
          'carved',
          at(u * (w - 0.12), lo, 0.06),
          at(u * (h1[1 - axis] - 0.1), hi, 0.06),
          0.35,
          0.21,
          stone,
        );
    }
}

function bell(out, cx, cz, r, top) {
  const profile = [
      [190.3, r],
      [190.4, r * 1.03],
      [190.6, r * 0.9],
      [191.1, r * 0.65],
      [top - 0.25, r * 0.5],
      [top, r * 0.25],
    ],
    rings = profile.map(([y, rr]) => radialRing(y, rr, rr, 48, [cx, cz]));
  loft(out, 'metal', rings, bronze, { cap: false });
  loft(
    out,
    'metal',
    profile
      .slice(0, -1)
      .map(([y, rr]) =>
        radialRing(y + 0.04, Math.max(rr - 0.06, 0.03), Math.max(rr - 0.06, 0.03), 48, [
          cx,
          cz,
        ]).toReversed(),
      ),
    bronze,
    { cap: false },
  );
  for (const s of [-1, 1])
    box(
      out,
      'metal',
      [cx + s * (r + 0.25) - 0.08, 189.8, cz - 0.18],
      [cx + s * (r + 0.25) + 0.08, top + 0.12, cz + 0.18],
      dark,
    );
  tube(out, 'metal', [cx - r - 0.35, top, cz], [cx + r + 0.35, top, cz], 0.09, dark, 8);
  tube(out, 'metal', [cx, 190.1, cz], [cx, top, cz], 0.055, dark, 8);
}
function cupola(out) {
  const platform = chamferedRectangle(0, 188.2, 0, 9.2, 8, 1.0).map(([x, _y, z]) => [x, z]);
  mappedSolid(out, 'carved', platform, 187.8, 188.55, stone);
  for (const axis of [0, 1])
    for (const sign of [-1, 1]) {
      const w = axis === 0 ? 4 : 4.6,
        side = axis === 0 ? 4.6 : 4,
        at = (u, y, d = 0) =>
          axis === 0 ? [sign * (side + d), y, -sign * u] : [sign * u, y, sign * (side + d)];
      strip(out, at, -w + 0.85, w - 0.85, 189.25, 189.5, 0.06);
      for (let u = -w + 1; u < w - 0.9; u += 0.4)
        tube(out, 'carved', at(u, 188.55), at(u, 189.25), 0.07, stone, 8);
      for (let u = -w + 0.65; u < w - 0.55; u += 1.65)
        beam(out, 'carved', at(u, 186.25, -1.05), at(u, 187.8, -0.07), 0.4, 0.46, stone);
    }
  const ring = radialRing(189.5, 3.55, 3.55, 8, [0, 0], pi / 8);
  // LPC plate13 shows an octagonal masonry core and substantial corner piers.
  loft(
    out,
    'limestone',
    [
      radialRing(189.5, 2.4, 2.4, 8, [0, 0], pi / 8),
      radialRing(199.4, 2.4, 2.4, 8, [0, 0], pi / 8),
    ],
    stone,
  );
  loft(
    out,
    'carved',
    [
      radialRing(189.5, 3.95, 3.95, 8, [0, 0], pi / 8),
      radialRing(190.3, 3.95, 3.95, 8, [0, 0], pi / 8),
    ],
    stone,
  );
  for (let i = 0; i < 8; i++) {
    const p = ring[i],
      a = Math.atan2(p[2], p[0]);
    const column = rect(0.51, 0.43).map(([r, t]) => [
      p[0] + r * Math.cos(a) - t * Math.sin(a),
      p[2] + r * Math.sin(a) + t * Math.cos(a),
    ]);
    mappedSolid(out, 'carved', column, 190.3, 199.8, stone);
  }
  loft(
    out,
    'carved',
    [
      radialRing(198.75, 3.95, 3.95, 8, [0, 0], pi / 8),
      radialRing(199.8, 3.95, 3.95, 8, [0, 0], pi / 8),
    ],
    stone,
  );
  loft(
    out,
    'carved',
    [radialRing(199.8, 4, 4, 8, [0, 0], pi / 8), radialRing(200.3, 4, 4, 8, [0, 0], pi / 8)],
    stone,
  );
  bell(out, 4.05, 0, 0.75, 192.4);
  bell(out, -4.05, 0, 0.56, 192.1);
  bell(out, 0, 3.5, 0.47, 191.8);
  bell(out, 0, -3.5, 0.4, 191.7);
  const rings = Array.from({ length: 24 }, (_, j) => {
    const t = ((j / 23) * pi) / 2,
      r = 0.88 + 3.12 * Math.cos(t);
    return radialRing(200.3 + 5.65 * Math.sin(t), r, r, 8, [0, 0], pi / 8);
  });
  loft(out, 'stainless', rings, gold);
  for (let i = 0; i < 8; i++) {
    for (let j = 1; j < rings.length; j++) {
      const p = rings[j - 1][i],
        q = rings[j][i];
      tube(out, 'stainless', p, q, 0.035, [0.5, 0.33, 0.07], 4);
    }
  }
  for (let j = 3; j < rings.length - 2; j += 3) {
    const row = rings[j].map(([x, y, z]) => [x * 1.003, y, z * 1.003]);
    for (let i = 0; i < 8; i++)
      tube(out, 'stainless', row[i], row[(i + 1) % 8], 0.023, [0.5, 0.33, 0.07], 4);
  }
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * 2 * pi,
      at = (u, y, d = 0) => [
        (3.8 + d) * Math.sin(a) + u * Math.cos(a),
        y,
        (3.8 + d) * Math.cos(a) - u * Math.sin(a),
      ];
    archedDormer(out, at, 0, 200.42, 1.76, 2.2, 'stainless', gold);
  }
  loft(
    out,
    'stainless',
    [
      radialRing(206.0, 1.95, 1.95, 8, [0, 0], pi / 8),
      radialRing(206.25, 1.95, 1.95, 8, [0, 0], pi / 8),
    ],
    gold,
  );
  const top = radialRing(207.25, 1.95, 1.95, 8, [0, 0], pi / 8);
  for (let i = 0; i < 8; i++) {
    const a = top[i],
      b = top[(i + 1) % 8];
    beam(out, 'stainless', a, b, 0.08, 0.07, gold);
    for (let j = 0; j < 5; j++) {
      const t = j / 5,
        p = a.map((v, k) => v + (b[k] - v) * t);
      tube(out, 'stainless', [p[0], 206.25, p[2]], p, 0.025, gold, 6);
    }
  }
  loft(
    out,
    'stainless',
    [
      radialRing(206.25, 1.35, 1.35, 8, [0, 0], pi / 8),
      radialRing(208.15, 1.1, 1.1, 8, [0, 0], pi / 8),
    ],
    gold,
  );
  const low = radialRing(208.15, 1.2192, 1.2192, 8, [0, 0], pi / 8),
    upper = radialRing(210.65, 1.2192, 1.2192, 8, [0, 0], pi / 8);
  for (let i = 0; i < 8; i++)
    grid(
      out,
      [low[i], low[(i + 1) % 8], upper[(i + 1) % 8], upper[i]],
      [0.39, 0.49, 0.45],
      3,
      4,
      0.09,
      gold,
      'stainless',
    );
  loft(
    out,
    'stainless',
    [
      radialRing(210.65, 1.45, 1.45, 8, [0, 0], pi / 8),
      radialRing(211.5, 0.4, 0.4, 8, [0, 0], pi / 8),
    ],
    gold,
  );
  for (const p of upper)
    beam(
      out,
      'stainless',
      [p[0], 210.5, p[2]],
      [p[0] * 1.28, 211.55, p[2] * 1.28],
      0.09,
      0.1,
      gold,
    );
  sphere(out, 'stainless', [0, 212.03, 0], [0.43, 0.43, 0.43], gold, 32, 18);
  loft(
    out,
    'stainless',
    [radialRing(212.37, 0.14, 0.14, 16), radialRing(213.36, 0.018, 0.018, 16)],
    gold,
  );
}

export function buildMetropolitan(out) {
  const ground = rect(...half(0));
  mappedCap(out, 'foundation', ground, 0, [0.4, 0.4, 0.38], [], true);
  for (const f of fronts()) {
    const { at, width, axis, sign } = f;
    patch(out, at, -width / 2, width / 2, 0, 1.524, [0.43, 0.45, 0.44], 'stone');
    windows(
      out,
      at,
      width,
      1.524,
      7.2,
      [-1, 0, 1].map((i) => [i * width * 0.28 - width * 0.11, i * width * 0.28 + width * 0.11]),
      { material: 'carved' },
    );
    windows(out, at, width, 7.2, 10.4, triples(width));
    for (let floor = 3; floor <= 28; floor++) {
      const lo = 10.4 + (floor - 3) * 4.33,
        hi = lo + 4.33;
      let spans = triples(width);
      if (floor >= 25 && floor <= 27) spans = spans.filter(([a, b]) => Math.abs((a + b) / 2) > 5);
      windows(out, at, width, lo, hi, spans, {
        project: floor % 2 === 1,
        material: floor >= 20 ? 'limestone' : 'marble',
      });
    }
    for (let row = 0; row < 2; row++) {
      const spans = Array.from({ length: 10 }, (_, i) => {
        const x = ((i - 4.5) * (width - 2.4)) / 10;
        return [x - 0.62, x + 0.62];
      });
      windows(out, at, width, 122.98 + row * 3.55, 126.53 + row * 3.55, spans);
    }
    clock(out, at);
    archScreen(out, at, width, 130.08, 144.2, 5, axis === 0 ? 3.5814 : 3.94, 138.9);
    windows(
      out,
      at,
      width,
      144.2,
      148.1,
      Array.from({ length: 5 }, (_, i) => {
        const c = ((i - 2) * (width - 2)) / 5;
        return [c - 0.55, c + 0.55];
      }),
    );
    // Current broad street-level entrance faces Madison; other sides retain separate windows.
    if (axis === 0 && sign === 1) {
      strip(out, at, -2.15, 2.15, 0, 4.7, 0.28, [0.34, 0.37, 0.35], 'stone');
      grid(
        out,
        [at(-1.8, 0.12, 0.32), at(1.8, 0.12, 0.32), at(1.8, 4.3, 0.32), at(-1.8, 4.3, 0.32)],
        glass,
        1.2,
        2.5,
        0.095,
        bronze,
      );
      for (const u of [-0.7, 0.7])
        tube(out, 'metal', at(u, 1.1, 0.44), at(u, 2.0, 0.44), 0.025, bronze, 8);
    }
  }
  band(out, 10.22, 10.42, 0.13);
  band(out, 129.82, 130.08, 0.16);
  band(out, 148.1, 148.65, 0.26);
  // Open gallery surrounds a smaller windowed setback, which continues upward as the plinth.
  for (const { at, width } of fronts(0, 0.81))
    for (let row = 0; row < 8; row++)
      windows(out, at, width, 130.08 + row * 4.36, 134.44 + row * 4.36, triples(width, 2));
  for (const { at, width } of fronts()) {
    strip(out, at, -width / 2, width / 2, 150.0, 150.27, 0.2);
    for (let x = -width / 2 + 0.35; x < width / 2 - 0.2; x += 0.5)
      strip(out, at, x - 0.09, x + 0.09, 148.65, 150, 0.14);
  }
  const h = half(148.1);
  mappedCap(out, 'carved', rect(...h), 148.65, stone, [rect(h[0] * 0.81, h[1] * 0.81)]);
  mappedSolid(out, 'carved', rect(10.7, 9.2), 164.7, 165, stone);
  roof(out);
  cupola(out);
}
