/** Thessaloniki's surviving two-cylinder fortification and arched corbel gallery. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import { beam, loft, normalFor, radialRing, torus } from './authored-structure-mesh.mjs';
import { B, rgb } from './landmark-model-helpers.mjs';
import { quad } from './structure-mesh.mjs';

const tau = Math.PI * 2;
const stone = rgb('b7ad98'),
  pale = rgb('c6bdaa'),
  brick = rgb('a67d67'),
  dark = rgb('3b4140'),
  steel = rgb('9caaa5'),
  paving = rgb('b6b2a6');
function facing(o, a, x = 0, z = 0) {
  const c = Math.cos(a),
    s = Math.sin(a),
    v = (p) => [c * p[0] + s * p[2], p[1], -s * p[0] + c * p[2]],
    q = (p) => {
      const r = v(p);
      return [r[0] + x, r[1], r[2] + z];
    };
  return {
    addTriangle: (s, r, p, n, u, c) => o.addTriangle(s, r, p.map(q), v(n), u, c),
    addQuad: (s, r, p, n, u, c) => o.addQuad(s, r, p.map(q), v(n), u, c),
    addConvexPolygon: (s, r, p, n, u, c) => {
      const pp = p.map(q),
        uv = p.map(u);
      return o.addConvexPolygon(s, r, pp, v(n), (p) => uv[pp.indexOf(p)], c);
    },
  };
}
function face(o, slot, x, y, z, w, h, c) {
  quad(
    o,
    slot,
    [
      [x - w / 2, y, z],
      [x + w / 2, y, z],
      [x + w / 2, y + h, z],
      [x - w / 2, y + h, z],
    ],
    [0, 0, 1],
    c,
  );
}
function round(o, slot, r, y0, y1, n, c) {
  loft(o, slot, [radialRing(y0, r, r, n), radialRing(y1, r, r, n)], c);
}
function wedge(o, slot, r0, r1, a, b, y0, y1, n, c) {
  const point = (r, t, y) => [r * Math.sin(t), y, r * Math.cos(t)];
  const q = (p) => quad(o, slot, p, normalFor(p[0], p[1], p[2]), c);
  for (let i = 0; i < n; i++) {
    const aa = a + ((b - a) * i) / n,
      bb = a + ((b - a) * (i + 1)) / n;
    q([point(r1, aa, y0), point(r1, bb, y0), point(r1, bb, y1), point(r1, aa, y1)]);
    q([point(r0, bb, y0), point(r0, aa, y0), point(r0, aa, y1), point(r0, bb, y1)]);
    q([point(r0, aa, y1), point(r1, aa, y1), point(r1, bb, y1), point(r0, bb, y1)]);
    q([point(r0, bb, y0), point(r1, bb, y0), point(r1, aa, y0), point(r0, aa, y0)]);
  }
  if (b - a < tau - 1e-6) {
    q([point(r0, a, y0), point(r1, a, y0), point(r1, a, y1), point(r0, a, y1)]);
    q([point(r1, b, y0), point(r0, b, y0), point(r0, b, y1), point(r1, b, y1)]);
  }
}
const mainOpenings = [
  { a: 0, y: 0.18, h: 2.45, w: 1.48, door: true },
  ...Array.from({ length: 5 }, (_, row) =>
    Array.from({ length: 7 }, (_, i) => ({
      a: (i / 7) * tau + (row % 2) * 0.29 - 0.45,
      y: [3.3, 8.2, 13.5, 18.5, 23.1][row] + ((i % 3) - 1) * 0.23,
      h: row < 2 ? 1.22 : 1.04,
      w: row < 2 ? 0.65 : 0.6,
      flat: row < 2 && i % 3 === 1,
    })),
  ).flat(),
];
const topOpenings = Array.from({ length: 6 }, (_, i) => ({
  a: (i * tau) / 6 + 0.2,
  y: 28.6,
  h: 1.35,
  w: 0.62,
}));
function shell(o, d, r, y0, y1, holes, slot = 'stone') {
  const cuts = (d === 0 ? holes.filter((h) => h.door) : holes).map((h) => ({
      ...h,
      half: h.w / 2 / r,
    })),
    segments = [10, 20, 48, 96][d],
    angles = [
      ...new Set([
        0,
        tau,
        ...Array.from({ length: segments }, (_, i) => (i / segments) * tau),
        ...cuts.flatMap((h) => [-1, 1].map((s) => (((h.a + s * h.half) % tau) + tau) % tau)),
      ]),
    ].sort((a, b) => a - b);
  const point = (a, y, depth = 0) => [(r - depth) * Math.sin(a), y, (r - depth) * Math.cos(a)];
  const strip = (a, b, lo, hi) => {
    if (hi - lo < 1e-6) return;
    quad(
      o,
      slot,
      [point(a, lo), point(b, lo), point(b, hi), point(a, hi)],
      [Math.sin((a + b) / 2), 0, Math.cos((a + b) / 2)],
      stone,
    );
  };
  for (let i = 0; i < angles.length - 1; i++) {
    const a = angles[i],
      b = angles[i + 1],
      mid = (a + b) / 2,
      omit = cuts
        .filter(
          (h) => Math.abs(Math.atan2(Math.sin(mid - h.a), Math.cos(mid - h.a))) < h.half - 1e-7,
        )
        .sort((a, b) => a.y - b.y);
    let y = y0;
    for (const h of omit) {
      strip(a, b, y, h.y);
      y = h.y + h.h;
    }
    strip(a, b, y, y1);
  }
  for (const h of cuts) {
    const a = h.a - h.half,
      b = h.a + h.half,
      depth = h.door ? 0.85 : 0.52,
      q = facing(o, h.a, r * Math.sin(h.a), r * Math.cos(h.a));
    for (const [angle, reverse] of [
      [a, false],
      [b, true],
    ]) {
      const p = [
        point(angle, h.y),
        point(angle, h.y + h.h),
        point(angle, h.y + h.h, depth),
        point(angle, h.y, depth),
      ];
      quad(
        o,
        slot,
        reverse ? [...p].reverse() : p,
        reverse ? [-Math.cos(angle), 0, Math.sin(angle)] : [Math.cos(angle), 0, -Math.sin(angle)],
        pale,
      );
    }
    for (const [y, up] of [
      [h.y, true],
      [h.y + h.h, false],
    ]) {
      const p = [point(a, y), point(b, y), point(b, y, depth), point(a, y, depth)];
      quad(o, slot, up ? p : [...p].reverse(), [0, up ? 1 : -1, 0], pale);
    }
    face(q, h.door ? 'metal' : 'glass', 0, h.y, -depth, h.w * 0.97, h.h, dark);
    if (d > 0 && !h.flat) {
      const spring = h.y + h.h - h.w * 0.4,
        n = d < 2 ? 3 : 10;
      for (let j = 0; j < n; j++) {
        const x0 = -h.w / 2 + (h.w * j) / n,
          x1 = -h.w / 2 + (h.w * (j + 1)) / n,
          arch = (x) => spring + h.w * 0.4 * Math.sqrt(Math.max(0, 1 - ((x * 2) / h.w) ** 2)),
          p = [
            [x0, arch(x0), 0.008],
            [x1, arch(x1), 0.008],
            [x1, h.y + h.h + 0.005, 0.008],
            [x0, h.y + h.h + 0.005, 0.008],
          ];
        quad(q, slot, p, [0, 0, 1], stone);
      }
      if (d > 1) {
        for (let j = 0; j < n; j++) {
          const a = (Math.PI * j) / n,
            b = (Math.PI * (j + 1)) / n,
            p = [
              [(h.w / 2) * Math.cos(a), spring + h.w * 0.4 * Math.sin(a), 0.02],
              [(h.w / 2) * Math.cos(b), spring + h.w * 0.4 * Math.sin(b), 0.02],
              [(h.w / 2 + 0.13) * Math.cos(b), spring + (h.w * 0.4 + 0.15) * Math.sin(b), 0.02],
              [(h.w / 2 + 0.13) * Math.cos(a), spring + (h.w * 0.4 + 0.15) * Math.sin(a), 0.02],
            ];
          quad(q, 'trim', p, [0, 0, 1], pale);
        }
      }
    }
    if (d > 1 && !h.door) {
      for (const x of [-0.16, 0.16])
        B(q, 'metal', x, h.y + 0.03, -0.19, 0.025, h.h - 0.07, 0.04, dark);
      for (const y of [h.y + 0.35, h.y + 0.75])
        if (y < h.y + h.h - 0.1) B(q, 'metal', 0, y, -0.19, h.w - 0.04, 0.025, 0.04, dark);
    }
  }
}
function mainDoor(o, d) {
  if (d === 0) return;
  const q = facing(o, 0, 0, 10.85),
    half = 0.77,
    spring = 1.95,
    apex = 2.63;
  face(q, 'metal', 0, 0.18, -0.83, 1.42, 2.25, dark);
  B(q, 'metal', 0, 0.2, -0.77, 0.05, 1.9, 0.07, dark);
  if (d > 1) {
    B(q, 'metal', 0.3, 1.1, -0.72, 0.1, 0.025, 0.08, steel);
    for (const y of [0.72, 1.6]) B(q, 'metal', -0.66, y, -0.74, 0.15, 0.045, 0.05, steel);
  }
  // Broad pointed relieving arch and pale plaster field visible in the street-side original.
  const points = [
    [-1.12, 0.18],
    [-1.12, 2.25],
    [-0.96, 2.72],
    [-0.5, 3.32],
    [0, 3.65],
    [0.5, 3.32],
    [0.96, 2.72],
    [1.12, 2.25],
    [1.12, 0.18],
  ];
  for (let i = 0; i < points.length - 1; i++) {
    const [x, y] = points[i],
      [xx, yy] = points[i + 1];
    if (i === 0 || i === 7) continue;
    beam(q, 'trim', [x, y, 0.04], [xx, yy, 0.04], 0.17, 0.16, pale);
  }
  for (const sign of [-1, 1])
    quad(
      q,
      'trim',
      [
        [sign * half, 0.18, 0.025],
        [sign * 1.12, 0.18, 0.025],
        [sign * 1.12, 2.25, 0.025],
        [sign * half, spring, 0.025],
      ],
      [0, 0, 1],
      pale,
    );
  const n = d === 1 ? 6 : 12;
  for (let j = 0; j < n; j++) {
    const x0 = -half + (2 * half * j) / n,
      x1 = -half + (2 * half * (j + 1)) / n,
      low = (x) => spring + (apex - spring) * (1 - Math.abs(x / half)),
      high = (x) => 3.64 - 1.12 * Math.abs(x / half);
    quad(
      q,
      'trim',
      [
        [x0, low(x0), 0.025],
        [x1, low(x1), 0.025],
        [x1, high(x1), 0.025],
        [x0, high(x0), 0.025],
      ],
      [0, 0, 1],
      pale,
    );
  }
  B(q, 'trim', 0, -0.15, 0.34, 1.8, 0.22, 1.1, paving);
}

const archControls = JSON.parse(
  fs.readFileSync(
    new URL(
      '../../../content/worldgen/source/places/sx/sx0/white_tower_of_thessaloniki/corbel-arch-construction-controls.json',
      import.meta.url,
    ),
  ),
);
function metricTriangle(o, slot, p, c) {
  const normal = normalFor(...p),
    drop = normal.map(Math.abs).indexOf(Math.max(...normal.map(Math.abs))),
    axes = [0, 1, 2].filter((i) => i !== drop);
  o.addTriangle(
    slot,
    'palette:#ffffff',
    p,
    normal,
    p.map((p) => [p[axes[0]], p[axes[1]]]),
    c,
  );
}
function metricQuad(o, slot, p, c) {
  for (const ids of [
    [0, 1, 2],
    [0, 2, 3],
  ])
    metricTriangle(
      o,
      slot,
      ids.map((i) => p[i]),
      c,
    );
}
function stonePrism(o, slot, outline, back, front, c) {
  // Counterclockwise XY outline, closed end caps and real return faces.
  for (const [z, reverse] of [
    [front, false],
    [back, true],
  ]) {
    const points = outline.map((p) => [...p, z]),
      v = reverse ? [...points].reverse() : points;
    for (let i = 1; i < v.length - 1; i++) metricTriangle(o, slot, [v[0], v[i], v[i + 1]], c);
  }
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i],
      b = outline[(i + 1) % outline.length];
    metricQuad(
      o,
      slot,
      [
        [...a, back],
        [...b, back],
        [...b, front],
        [...a, front],
      ],
      c,
    );
  }
}
function closedCorbelArches(o) {
  const c = archControls,
    pitch = tau / c.arches;
  for (let i = 0; i < c.arches; i++) {
    const angle = i * pitch,
      q = facing(o, angle, c.radius * Math.sin(angle), c.radius * Math.cos(angle));
    // Each joint separates one actual wedge-shaped stone with an intrados and back.
    for (let j = 0; j < c.voussoirs; j++) {
      const a = (Math.PI * j) / c.voussoirs + (j === 0 ? 0 : c.jointRadians / 2),
        b = (Math.PI * (j + 1)) / c.voussoirs - (j === c.voussoirs - 1 ? 0 : c.jointRadians / 2);
      for (let k = 0; k < c.archSubsegments; k++) {
        const aa = a + ((b - a) * k) / c.archSubsegments,
          bb = a + ((b - a) * (k + 1)) / c.archSubsegments,
          p = (rx, ry, t) => [rx * Math.cos(t), c.spring + ry * Math.sin(t)];
        stonePrism(
          q,
          'archVoussoir',
          [
            p(c.halfWidth, c.innerHeight, aa),
            p(c.outerWidth, c.outerHeight, aa),
            p(c.outerWidth, c.outerHeight, bb),
            p(c.halfWidth, c.innerHeight, bb),
          ],
          c.back,
          c.front,
          j % 3 === 0 ? pale : stone,
        );
      }
    }
    const curve = (x) =>
      c.spring + c.outerHeight * Math.sqrt(Math.max(0, 1 - (x / c.outerWidth) ** 2));
    for (let j = 0; j < c.spandrelSegments; j++) {
      const a = -c.outerWidth + (2 * c.outerWidth * j) / c.spandrelSegments,
        b = -c.outerWidth + (2 * c.outerWidth * (j + 1)) / c.spandrelSegments;
      stonePrism(
        q,
        'archSpandrel',
        [
          [a, curve(a)],
          [b, curve(b)],
          [b, c.top],
          [a, c.top],
        ],
        c.back,
        c.front - 0.022,
        pale,
      );
    }
    const edge = c.radius * Math.tan(pitch / 2) + 0.01;
    for (const [a, b] of [
      [-edge, -c.outerWidth],
      [c.outerWidth, edge],
    ])
      stonePrism(
        q,
        'archSpandrel',
        [
          [a, c.spring],
          [b, c.spring],
          [b, c.top],
          [a, c.top],
        ],
        c.back,
        c.front - 0.022,
        pale,
      );
    const a = angle + pitch / 2,
      k = c.brackets,
      out = facing(o, a, k.radius * Math.sin(a), k.radius * Math.cos(a)),
      rings = k.rings.map(([y, w, back, front]) => {
        const x = w / 2,
          t = Math.min(k.chamfer, w / 5, (front - back) / 4);
        return [
          [-x + t, back],
          [-x, back + t],
          [-x, front - t],
          [-x + t, front],
          [x - t, front],
          [x, front - t],
          [x, back + t],
          [x - t, back],
        ].map(([x, z]) => [x, y, z]);
      });
    for (let j = 1; j < rings.length; j++)
      for (let k = 0; k < 8; k++) {
        const n = (k + 1) % 8;
        metricQuad(
          out,
          'steppedCorbel',
          [rings[j - 1][k], rings[j - 1][n], rings[j][n], rings[j][k]],
          stone,
        );
      }
    for (const [r, reverse] of [
      [rings[0], true],
      [rings.at(-1), false],
    ]) {
      const v = reverse ? [...r].reverse() : r;
      for (let i = 1; i < v.length - 1; i++)
        metricTriangle(out, 'steppedCorbel', [v[0], v[i], v[i + 1]], pale);
    }
  }
}

function corbels(o, d) {
  if (d === 3) {
    closedCorbelArches(o);
    return;
  }
  const n = 38,
    pitch = tau / n,
    arcSteps = d < 2 ? 2 : d === 2 ? 7 : 10;
  for (let i = 0; i < n; i++) {
    const a = i * pitch,
      q = facing(o, a, 11.2 * Math.sin(a), 11.2 * Math.cos(a)),
      half = 0.54,
      spring = 26.0,
      top = 27.25;
    for (let j = 0; j < arcSteps; j++) {
      const x0 = -half + (2 * half * j) / arcSteps,
        x1 = -half + (2 * half * (j + 1)) / arcSteps,
        curve = (x) => spring + 0.55 * Math.sqrt(Math.max(0, 1 - (x / half) ** 2)),
        lo = curve(x0),
        hi = curve(x1);
      quad(
        q,
        'trim',
        [
          [x0, lo, 0.02],
          [x1, hi, 0.02],
          [x1, top, 0.02],
          [x0, top, 0.02],
        ],
        [0, 0, 1],
        pale,
      );
      quad(
        q,
        'trim',
        [
          [x0, lo, -0.46],
          [x1, hi, -0.46],
          [x1, hi, 0.02],
          [x0, lo, 0.02],
        ],
        normalFor([x0, lo, -0.46], [x1, hi, -0.46], [x1, hi, 0.02]),
        stone,
      );
      if (d > 2) beam(q, 'trim', [x0, lo + 0.07, 0.035], [x1, hi + 0.07, 0.035], 0.12, 0.13, pale);
    }
    // Close the spandrel beside each arch; keep the niche below the curve open.
    const edge = 11.2 * Math.tan(pitch / 2) + 0.01;
    for (const sign of [-1, 1]) {
      const x0 = sign < 0 ? -edge : half;
      const x1 = sign < 0 ? -half : edge;
      face(q, 'trim', (x0 + x1) / 2, spring, 0.02, x1 - x0, top - spring, pale);
    }
    const support = facing(
      o,
      a + pitch / 2,
      10.92 * Math.sin(a + pitch / 2),
      10.92 * Math.cos(a + pitch / 2),
    );
    B(support, 'trim', 0, 25.3, 0, 0.48, 1.95, 0.65, stone);
    if (d > 1) {
      B(support, 'trim', 0, 25.15, -0.1, 0.34, 0.25, 0.42, pale);
      B(support, 'trim', 0, 25.0, -0.18, 0.25, 0.2, 0.26, pale);
    }
  }
}
function crown(o, d, r, base, top, count) {
  const n = [8, 24, 48, 96][d],
    pitch = tau / count;
  wedge(o, 'brick', r - 0.62, r, 0, tau, base - 0.65, base, n, brick);
  for (let i = 0; i < count; i++) {
    const a = i * pitch,
      half = pitch * 0.3;
    wedge(o, 'brick', r - 0.62, r, a - half, a + half, base, top, d < 2 ? 1 : 2, brick);
    if (d > 1)
      wedge(
        o,
        'trim',
        r - 0.65,
        r + 0.035,
        a - half - 0.002,
        a + half + 0.002,
        top,
        top + 0.065,
        2,
        pale,
      );
    if (d > 1) {
      const left = a + half,
        right = a + pitch - half,
        y = base + 0.06,
        rr = r - 0.3;
      beam(
        o,
        'metal',
        [rr * Math.sin(left), y, rr * Math.cos(left)],
        [rr * Math.sin(right), y, rr * Math.cos(right)],
        0.028,
        0.028,
        steel,
      );
      beam(
        o,
        'metal',
        [rr * Math.sin(left), top - 0.13, rr * Math.cos(left)],
        [rr * Math.sin(right), top - 0.13, rr * Math.cos(right)],
        0.028,
        0.028,
        steel,
      );
      for (let j = 0; j <= (d === 2 ? 1 : 3); j++) {
        const t = left + ((right - left) * j) / (d === 2 ? 1 : 3);
        beam(
          o,
          'metal',
          [rr * Math.sin(t), y, rr * Math.cos(t)],
          [rr * Math.sin(t), top - 0.13, rr * Math.cos(t)],
          0.022,
          0.022,
          steel,
        );
      }
    }
  }
}
function masonry(o, d) {
  if (d < 2) return;
  const rows = d === 2 ? 18 : 52,
    cols = d === 2 ? 22 : 76,
    colors = [rgb('beb4a1'), rgb('b0a692'), rgb('bdb29d'), rgb('b5aa96'), rgb('c0b6a3')];
  for (let row = 0; row < rows; row++)
    for (let col = 0; col < cols; col++) {
      const a = ((col + (row % 2) * 0.47 + ((row * 13 + col * 7) % 11) * 0.018) / cols) * tau,
        y = 0.35 + ((row + ((col * 17 + row * 7) % 9) * 0.026) * 25.0) / rows,
        h = ((0.4 + 0.12 * ((col + row) % 3)) * 25) / rows,
        w = ((0.48 + 0.1 * ((col * 7 + row) % 4)) * tau * 10.85) / cols;
      if (
        mainOpenings.some(
          (opening) =>
            y < opening.y + opening.h + 0.12 &&
            y + h > opening.y - 0.1 &&
            Math.abs(Math.atan2(Math.sin(a - opening.a), Math.cos(a - opening.a))) <
              ((opening.w + w) * 0.5) / 10.85 + 0.01,
        )
      )
        continue;
      const q = facing(o, a, 10.86 * Math.sin(a), 10.86 * Math.cos(a));
      face(q, 'stone', 0, y, 0.005, w, h, colors[(row * 5 + col * 3) % colors.length]);
    }
}
export function whiteTowerOfThessaloniki(o, _frame, d = 3) {
  const n = [8, 16, 48, 96][d];
  round(o, 'stone', 10.96, -0.65, 0.12, n, stone);
  shell(o, d, 10.85, -0.65, 26.8, mainOpenings);
  mainDoor(o, d);
  masonry(o, d);
  if (d === 0) {
    wedge(o, 'trim', 10.6, 11.32, 0, tau, 26.35, 27.3, n, pale);
  } else corbels(o, d);
  wedge(o, 'paving', 5.5, 10.75, 0, tau, 27.32, 27.45, n, paving);
  crown(o, d, 11.32, 27.7, 29.15, d === 0 ? 26 : 38);
  shell(o, d, 5.98, 27.35, 31.92, topOpenings);
  round(o, 'paving', 5.4, 31.94, 32.02, n, paving);
  crown(o, d, 6.05, 32.25, 33.9, d === 0 ? 20 : 28);
  if (d > 0) {
    torus(
      o,
      'trim',
      [0, 15.25, 0],
      10.92,
      0.12,
      pale,
      d === 1 ? 16 : d === 2 ? 24 : 64,
      d === 3 ? 6 : 4,
    );
    torus(
      o,
      'trim',
      [0, 31.85, 0],
      6.03,
      0.1,
      pale,
      d === 1 ? 16 : d === 2 ? 24 : 64,
      d === 3 ? 6 : 4,
    );
  } else {
    wedge(o, 'trim', 10.82, 11.05, 0, tau, 15.12, 15.38, n, pale);
  }
  round(o, 'metal', 0.055, 32.02, 42.6, d === 0 ? 4 : 8, steel);
  if (d > 0)
    for (let i = 0; i < 4; i++) {
      const a = (i * tau) / 4;
      beam(
        o,
        'metal',
        [0, 38.6, 0],
        [5.55 * Math.sin(a), 32.25, 5.55 * Math.cos(a)],
        0.018,
        0.018,
        steel,
      );
    }
  if (d > 1) {
    const q = facing(o, -0.75, 6.08 * Math.sin(-0.75), 6.08 * Math.cos(-0.75));
    for (const x of [-0.24, 0.24]) B(q, 'metal', x, 28.5, 0.12, 0.035, 5.7, 0.07, steel);
    for (let y = 28.6; y < 34.1; y += 0.35) B(q, 'metal', 0, y, 0.12, 0.52, 0.035, 0.07, steel);
  }
}
export function whiteTowerOfThessalonikiSkyline(o) {
  whiteTowerOfThessaloniki(o, undefined, 0);
}
export function whiteTowerOfThessalonikiDistrict(o) {
  whiteTowerOfThessaloniki(o, undefined, 1);
}
export function whiteTowerOfThessalonikiStreet(o) {
  whiteTowerOfThessaloniki(o, undefined, 2);
}
const surfaces = {
  stone: { slot: 'wall', graph: 'stone_limestone_raw', roughness: 0.95, metallic: 0 },
  trim: { slot: 'trim', graph: 'stone_limestone_raw', roughness: 0.94, metallic: 0 },
  brick: {
    slot: 'wall',
    graph: 'brick',
    roughness: 0.94,
    metallic: 0,
    baseColorFactor: [0.64, 0.79, 0.85, 1],
  },
  paving: { slot: 'roof', graph: 'stone_limestone', roughness: 0.92, metallic: 0 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.78, metallic: 0.2 },
  archVoussoir: { slot: 'trim', graph: 'stone_limestone_raw', roughness: 0.94, metallic: 0 },
  archSpandrel: { slot: 'trim', graph: 'stone_limestone_raw', roughness: 0.94, metallic: 0 },
  steppedCorbel: { slot: 'trim', graph: 'stone_limestone_raw', roughness: 0.94, metallic: 0 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.65, metallic: 0 },
};
export const whiteTowerOfThessalonikiModel = {
  id: 'white_tower_of_thessaloniki',
  key: 'white_tower_of_thessaloniki',
  recipe: 'structure-white-tower-of-thessaloniki.mjs',
  cell: 'sx/sx0',
  title: 'White Tower of Thessaloniki',
  brief:
    'Warm weathered cylindrical stone fortification with sparse recessed arched windows, pointed street entrance, cordon, genuine arched corbel niches, brick crenellations, annular terrace around narrower upper turret, safety grilles and axial mast. Surviving standalone tower; former enclosure walls/plaza and interiors excluded.',
  camera: [-37, 31, 48],
  lookAt: [0, 18, 0],
  qaCameras: [
    { name: 'front', position: [0, 23, 90], lookAt: [0, 20, 0] },
    { name: 'front-detail', position: [-17, 33, 27], lookAt: [0, 28, 0] },
    { name: 'back', position: [48, 27, -72], lookAt: [0, 18, 0] },
    { name: 'base-detail', position: [-11, 5, 22], lookAt: [0, 2.1, 10] },
    { name: 'corbel-detail', position: [-4, 28.2, 15.7], lookAt: [0, 26.4, 10.9] },
    { name: 'corbel-intrados', position: [-2.4, 24.9, 14.5], lookAt: [0, 26.55, 11.1] },
  ],
  mediumFiContext: { scale: 1.2 },
  build: whiteTowerOfThessaloniki,
  surfaces,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview',
  groundContactBasis:
    'Bounded32m land review using unchanged original DeltaDTM v1.1.1 pixels, datum3.0965865mEGM2008 at existing dry approach[0,13]. Existing footing, architecture, anchor, heading and dry reference unchanged. Source one arcsecond(~30m);1m review spacing is interpolation, not source resolution. Rejected Terrarium retained; another host ground field requires its own contact review.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-white-tower-of-thessaloniki.mjs',
    level: 'skyline',
    export: 'whiteTowerOfThessalonikiSkyline',
    errorMeters: 0.9,
    surfaces,
    authoredLevels: {
      district: { export: 'whiteTowerOfThessalonikiDistrict', errorMeters: 0.5, surfaces },
      street: { export: 'whiteTowerOfThessalonikiStreet', errorMeters: 0.35, surfaces },
    },
  },
  limitations: [
    'Current medium-fi exterior uses the exact cleared Qualla Ktrepas2019 photographer CC0 native and exact named photographer CC0/public-domain originals. Earlier attribution/private/museum/aerial reference controls are historical and excluded. Closed physical arch voussoirs/spandrels and stepped corbels rebuilt from inspected current natives. Operator33.9m masonry height/21.7m body diameter retained. Map root22.9m corbel/12m upper diameter are controls, not survey. Exact window distribution, profiles, masonry pattern, threshold and mast fittings remain estimates.',
    'Physical window/door recesses at district and above. Skyline retains entry recess and simplified26/20-merlon crenellated silhouette but replaces arched corbels with a broad projecting band and omits small windows/grilles. Main entrance represented closed; no playable or surveyed interiors. Flags, cars/trees, signs, interpretation furniture, former outer enclosure and plaza excluded.',
    'Bounded32m land preview uses independently reproduced DeltaDTM v1.1.1 original one arcsecond coastal heights, resampled at1m; not a surveyed site/floor or a1m source. Existing geometry and dry reference unchanged. Rejected Terrarium retained. Sea and surrounding square excluded; no NODATA filling, flattening, cutout or footprint replacement. Another host field requires contact review.',
  ],
};
