/** Rhodes Acropolis: observed 2011 Apollo ruins, restored Odeon and surviving stadium. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { cross, normalFor } from './authored-structure-mesh.mjs';
import { rgb } from './landmark-model-helpers.mjs';

const p = JSON.parse(
    fs.readFileSync(
      new URL(
        '../../../content/worldgen/source/places/sw/swk/acropolis_of_rhodes/plan-controls.json',
        import.meta.url,
      ),
    ),
  ),
  ref = 'palette:#ffffff',
  tau = Math.PI * 2;
const C = { temple: rgb('cbb18a'), ruin: rgb('b8ac93'), seat: rgb('e2d9c5'), wall: rgb('b5ab95') },
  surfaces = {
    temple: { slot: 'wall', graph: 'stone_sandstone_raw', roughness: 0.97, metallic: 0 },
    ruin: { slot: 'foundation', graph: 'stone_limestone_weathered', roughness: 1, metallic: 0 },
    seat: { slot: 'trim', graph: 'stone_limestone_raw', roughness: 0.97, metallic: 0 },
    wall: { slot: 'wall', graph: 'stone_limestone', roughness: 0.99, metallic: 0 },
  };
const color = (c, k) => c.map((v) => Math.min(1, v * k)),
  rect = (x, z, w, l) => [
    [x - w / 2, z - l / 2],
    [x + w / 2, z - l / 2],
    [x + w / 2, z + l / 2],
    [x - w / 2, z + l / 2],
  ],
  bounds = (r) => [
    Math.min(...r.map((v) => v[0])),
    Math.min(...r.map((v) => v[1])),
    Math.max(...r.map((v) => v[0])),
    Math.max(...r.map((v) => v[1])),
  ];
function T(o, s, q, h, col = C[s]) {
  q = q.map((v) => v.map(Math.fround));
  const n = cross(
    q[1].map((v, k) => v - q[0][k]),
    q[2].map((v, k) => v - q[0][k]),
  );
  if (Math.hypot(...n) < 1e-8) return;
  if (h && n.reduce((a, v, k) => a + v * h[k], 0) < 0) [q[1], q[2]] = [q[2], q[1]];
  o.addTriangle(
    s,
    ref,
    q,
    normalFor(...q),
    q.map((v) => [v[0] + v[2], v[1]]),
    col,
  );
}
function Q(o, s, q, h, col = C[s]) {
  T(o, s, [q[0], q[1], q[2]], h, col);
  T(o, s, [q[0], q[2], q[3]], h, col);
}
function cap(o, s, r, y, up = true, col = C[s]) {
  const ix = earcut(r.flat());
  for (let i = 0; i < ix.length; i += 3)
    T(
      o,
      s,
      ix.slice(i, i + 3).map((k) => [r[k][0], y, r[k][1]]),
      [0, up ? 1 : -1, 0],
      col,
    );
}
function prism(o, s, r, y0, y1, col = C[s]) {
  cap(o, s, r, y0, false, col);
  cap(o, s, r, y1, true, col);
  const a = r.reduce(
    (a, v, i) => a + v[0] * r[(i + 1) % r.length][1] - r[(i + 1) % r.length][0] * v[1],
    0,
  );
  for (let i = 0; i < r.length; i++) {
    const u = r[i],
      v = r[(i + 1) % r.length];
    Q(
      o,
      s,
      [
        [u[0], y0, u[1]],
        [v[0], y0, v[1]],
        [v[0], y1, v[1]],
        [u[0], y1, u[1]],
      ],
      [Math.sign(a) * (v[1] - u[1]), 0, Math.sign(a) * (u[0] - v[0])],
      col,
    );
  }
}
function B(o, s, x, z, w, l, y, h, col) {
  prism(o, s, rect(x, z, w, l), y, y + h, col);
}
function segment(o, s, a, b, width, y, h, col = C[s]) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]),
    n = [(-(b[1] - a[1]) * width) / len / 2, ((b[0] - a[0]) * width) / len / 2];
  prism(
    o,
    s,
    [
      [a[0] + n[0], a[1] + n[1]],
      [b[0] + n[0], b[1] + n[1]],
      [b[0] - n[0], b[1] - n[1]],
      [a[0] - n[0], a[1] - n[1]],
    ],
    y,
    y + h,
    col,
  );
}
function courses(o, s, a, b, w, y, h, d, seed = 0) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]),
    rows = d > 1 ? Math.ceil(h / (d === 3 ? 0.45 : 0.9)) : 1,
    cols = d > 1 ? Math.ceil(len / (d === 3 ? 1.65 : 5)) : 1;
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < cols; i++) {
      const t0 = i / cols,
        t1 = (i + 1) / cols,
        g = d > 1 ? 0.012 : 0,
        A = a.map((v, k) => v + (b[k] - v) * t0),
        E = a.map((v, k) => v + (b[k] - v) * t1);
      segment(
        o,
        s,
        A,
        E,
        w,
        y + (j * h) / rows + g,
        h / rows - g,
        color(C[s], 0.94 + ((i * 7 + j * 3 + seed) % 9) * 0.014),
      );
    }
}
function ringStrip(o, s, r, width, y, h, d) {
  const cx = r.reduce((s, a) => s + a[0] / r.length, 0),
    cz = r.reduce((s, a) => s + a[1] / r.length, 0);
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      len = Math.hypot(b[0] - a[0], b[1] - a[1]),
      mx = (a[0] + b[0]) / 2,
      mz = (a[1] + b[1]) / 2,
      n = [-(b[1] - a[1]) / len, (b[0] - a[0]) / len],
      sg = (cx - mx) * n[0] + (cz - mz) * n[1] > 0 ? 1 : -1;
    courses(
      o,
      s,
      a.map((v, k) => v + (n[k] * sg * width) / 2),
      b.map((v, k) => v + (n[k] * sg * width) / 2),
      width,
      y,
      h,
      d,
      i,
    );
  }
}
function round(o, s, x, z, y0, y1, r0, r1, n, flute = false, col = C[s]) {
  const ring = (y, r) =>
      Array.from({ length: n }, (_, i) => {
        const a = (tau * i) / n,
          rr = r * (flute ? 1 - 0.045 * (1 - Math.cos(a * 20)) : 1);
        return [x + rr * Math.cos(a), y, z + rr * Math.sin(a)];
      }),
    a = ring(y0, r0),
    b = ring(y1, r1);
  cap(
    o,
    s,
    a.map((v) => [v[0], v[2]]),
    y0,
    false,
    col,
  );
  cap(
    o,
    s,
    b.map((v) => [v[0], v[2]]),
    y1,
    true,
    col,
  );
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    Q(
      o,
      s,
      [a[i], a[j], b[j], b[i]],
      [(a[i][0] + a[j][0]) / 2 - x, 0, (a[i][2] + a[j][2]) / 2 - z],
      col,
    );
  }
}
const tb = bounds(p.features[0].outline),
  ob = bounds(p.features[1].outline),
  ty = p.monumentLevels.temple,
  oy = p.monumentLevels.odeon,
  sy = p.monumentLevels.stadium;
const corner = [tb[2] - 2.25, tb[3] - 2.25],
  spacing = p.parameters.templeStandingSpacing,
  columns = [corner, [corner[0] - spacing, corner[1]], [corner[0], corner[1] - spacing]],
  broken = [corner[0], corner[1] - spacing * 2];
function temple(o, d) {
  const rise = p.parameters.templeStepRise;
  for (let k = 0; k < 3; k++) {
    const inset = k * 0.48,
      r = rect(
        (tb[0] + tb[2]) / 2,
        (tb[1] + tb[3]) / 2,
        tb[2] - tb[0] - inset * 2,
        tb[3] - tb[1] - inset * 2,
      );
    ringStrip(o, 'ruin', r, 1.35, ty - 0.12 + k * rise, rise, d);
  }
  const base = ty + 0.78,
    n = [8, 12, 20, 80][d];
  for (const [i, [x, z]] of [...columns, broken].entries()) {
    const h = i === 3 ? p.parameters.templeBrokenHeight : p.parameters.templeColumnHeight,
      drums = d === 0 ? 1 : d === 1 ? 4 : i === 3 ? 7 : 11;
    for (let j = 0; j < drums; j++) {
      const ya = base + (h * j) / drums,
        yb = base + (h * (j + 1)) / drums - (d > 1 ? 0.018 : 0),
        r0 = 0.88 - (0.14 * j) / drums,
        r1 = 0.88 - (0.14 * (j + 1)) / drums,
        cc = color(C.temple, 0.92 + ((j * 5 + i * 2) % 9) * 0.019);
      round(o, 'temple', x, z, ya, yb, r0, r1, n, d === 3, cc);
    }
    if (i < 3) {
      round(o, 'temple', x, z, base + h - 0.1, base + h + 0.14, 0.74, 0.98, n);
      B(o, 'temple', x, z, 2.03, 2.03, base + h + 0.14, 0.23);
      if (d > 1)
        for (let k = 0; k < 3; k++)
          round(
            o,
            'temple',
            x,
            z,
            base + h - 0.16 + k * 0.055,
            base + h - 0.13 + k * 0.055,
            0.77,
            0.77,
            n,
          );
    }
  }
  const top = base + p.parameters.templeColumnHeight + 0.37;
  for (const end of [columns[1], columns[2]]) {
    const a = columns[0],
      mid = [(a[0] + end[0]) / 2, (a[1] + end[1]) / 2],
      axis = a[0] === end[0] ? 'z' : 'x',
      length = spacing + 1.95;
    B(o, 'temple', ...mid, axis === 'x' ? length : 1.58, axis === 'x' ? 1.58 : length, top, 0.72);
    B(
      o,
      'temple',
      ...mid,
      axis === 'x' ? length + 0.12 : 1.78,
      axis === 'x' ? 1.78 : length + 0.12,
      top + 0.72,
      0.96,
      color(C.temple, 1.025),
    );
    B(
      o,
      'ruin',
      ...mid,
      axis === 'x' ? length + 0.4 : 2.06,
      axis === 'x' ? 2.06 : length + 0.4,
      top + 1.68,
      0.26,
    );
    if (d > 1) {
      const steps = Math.ceil(length / 0.72);
      for (let k = 0; k < steps; k++) {
        const t = (k + 0.5) / steps,
          P =
            axis === 'x'
              ? [mid[0] + (t - 0.5) * length, mid[1]]
              : [mid[0], mid[1] + (t - 0.5) * length];
        for (const side of [-1, 1])
          B(
            o,
            'temple',
            P[0] + (axis === 'z' ? side * 0.91 : 0),
            P[1] + (axis === 'x' ? side * 0.91 : 0),
            axis === 'x' ? 0.42 : 0.1,
            axis === 'x' ? 0.1 : 0.42,
            top + 0.8,
            0.7,
            color(C.temple, 0.96),
          );
        if (d === 3)
          for (const side of [-1, 1])
            for (let j = 0; j < 4; j++)
              B(
                o,
                'temple',
                P[0] + (axis === 'x' ? (j - 1.5) * 0.1 : side * 0.88),
                P[1] + (axis === 'z' ? (j - 1.5) * 0.1 : side * 0.88),
                0.065,
                0.065,
                top + 0.64,
                0.12,
              );
      }
    }
    // Broken upper blocks stop at the surviving L, never completing a roof/pediment.
    for (let k = 0; k < 3; k++) {
      const t = (k + 0.5) / 3,
        x = mid[0] + (axis === 'x' ? (t - 0.5) * length : 0),
        z = mid[1] + (axis === 'z' ? (t - 0.5) * length : 0);
      B(
        o,
        'temple',
        x,
        z,
        axis === 'x' ? length / 3 - 0.03 : 1.4,
        axis === 'z' ? length / 3 - 0.03 : 1.4,
        top + 1.94,
        k === 1 ? 0.49 : 0.27,
        color(C.temple, 1.035),
      );
    }
  }
  // Fragmentary low cella foundations; the exposed rock/soil between them remains a real void.
  const x0 = tb[0] + 5,
    x1 = tb[2] - 12,
    z0 = tb[1] + 6,
    z1 = tb[3] - 7;
  for (const [a, b, w, h] of [
    [[x0, z0], [x1, z0], 1.45, 0.66],
    [[x0, z1], [x1 - 4, z1], 1.7, 1.1],
    [[x0, z0], [x0, z1], 1.8, 0.82],
    [[x1 - 3, z0], [x1 - 3, z0 + 4], 1.3, 0.55],
  ])
    courses(o, 'ruin', a, b, w, ty - 0.12, h, d);
  if (d)
    for (let k = 0; k < [0, 7, 15, 28][d]; k++) {
      const x = tb[0] + 4 + ((k * 7.17) % (tb[2] - tb[0] - 10)),
        z = tb[1] + 4 + ((k * 3.61) % (tb[3] - tb[1] - 8));
      if (x > corner[0] - 10 && z > corner[1] - 10) continue;
      const r = rect(x, z, 0.7 + (k % 3) * 0.35, 0.6 + (k % 4) * 0.23).map((q, i) => [
        q[0] + (i === 1 ? 0.12 : 0),
        q[1] + (i === 2 ? 0.1 : 0),
      ]);
      prism(
        o,
        'ruin',
        r,
        ty - 0.08,
        ty + 0.22 + (k % 4) * 0.14,
        color(C.ruin, 0.93 + (k % 6) * 0.025),
      );
    }
}
const oc = [ob[0] + 11.25, (ob[1] + ob[3]) / 2],
  seatY = oy + 0.12,
  inner = 2.75,
  depth = 0.36,
  walk = 0.68;
function sector(o, r0, r1, a0, a1, y0, y1, d, col = C.seat) {
  const n = a1 - a0 < 0.2 ? 1 : d === 0 ? 4 : d === 1 ? 3 : d === 2 ? 4 : 18;
  for (let i = 0; i < n; i++) {
    const a = a0 + ((a1 - a0) * i) / n,
      b = a0 + ((a1 - a0) * (i + 1)) / n,
      P = (r, t, y) => [oc[0] + r * Math.cos(t), y, oc[1] + r * Math.sin(t)],
      ra = [P(r0, a, y1), P(r1, a, y1), P(r1, b, y1), P(r0, b, y1)];
    Q(o, 'seat', ra, [0, 1, 0], col);
    Q(
      o,
      'seat',
      [P(r0, a, y0), P(r0, b, y0), P(r0, b, y1), P(r0, a, y1)],
      [-Math.cos((a + b) / 2), 0, -Math.sin((a + b) / 2)],
      col,
    );
    Q(
      o,
      'seat',
      [P(r1, b, y0), P(r1, a, y0), P(r1, a, y1), P(r1, b, y1)],
      [Math.cos((a + b) / 2), 0, Math.sin((a + b) / 2)],
      col,
    );
    if (i === 0) Q(o, 'seat', [P(r0, a, y0), P(r1, a, y0), P(r1, a, y1), P(r0, a, y1)], null, col);
    if (i === n - 1)
      Q(o, 'seat', [P(r1, b, y0), P(r0, b, y0), P(r0, b, y1), P(r1, b, y1)], null, col);
  }
}
function odeon(o, d) {
  const lower = p.parameters.odeonLowerRows,
    upper = p.parameters.odeonUpperRows,
    rise = p.parameters.odeonSeatRise,
    groups =
      d === 0
        ? [
            [0, lower, 1],
            [lower, upper, 1],
          ]
        : [
            [0, lower, 5],
            [lower, upper, 4],
          ];
  for (const [start, rows, cunei] of groups) {
    for (let j = 0; j < (d === 0 ? 1 : rows); j += d === 1 ? 2 : 1) {
      const merged = d === 0 ? rows : d === 1 ? Math.min(2, rows - j) : 1;
      const row = start + j,
        r0 = inner + row * depth + (start ? walk : 0),
        r1 = r0 + depth * merged,
        y0 = seatY + row * rise,
        y1 = y0 + rise * merged;
      for (let k = 0; k < cunei; k++) {
        const gap = d === 0 ? 0 : 0.042,
          a0 = Math.PI / 2 + (Math.PI * k) / cunei + (k ? gap : 0),
          a1 = Math.PI / 2 + (Math.PI * (k + 1)) / cunei - (k < cunei - 1 ? gap : 0);
        sector(o, r0, r1, a0, a1, y0, y1, d, color(C.seat, 0.965 + ((j + k) % 4) * 0.012));
      }
    }
    if (d > 1)
      for (let k = 1; k < cunei; k++) {
        const a = Math.PI / 2 + (Math.PI * k) / cunei;
        for (let j = 0; j < rows * 2; j++) {
          const row = start + j / 2,
            r = inner + row * depth + (start ? walk : 0),
            rr = r + depth / 2,
            y = seatY + row * rise + rise / 2;
          sector(o, r, rr, a - 0.038, a + 0.038, y - 0.18, y, d === 3 ? 1 : 0, color(C.seat, 0.97));
        }
      }
  }
  const walkR = inner + lower * depth;
  sector(
    o,
    walkR,
    walkR + walk,
    Math.PI / 2,
    Math.PI * 1.5,
    seatY + lower * rise - 0.1,
    seatY + lower * rise,
    d,
    C.seat,
  );
  const orchestra = Array.from({ length: d === 0 ? 8 : d === 1 ? 16 : 32 }, (_, i) => [
    oc[0] + inner * Math.cos((i * tau) / (d === 0 ? 8 : d === 1 ? 16 : 32)),
    oc[1] + inner * Math.sin((i * tau) / (d === 0 ? 8 : d === 1 ? 16 : 32)),
  ]);
  prism(o, 'wall', orchestra, oy - 0.1, seatY - 0.025);
  const end = seatY + 19 * rise,
    west = ob[0],
    east = ob[2],
    north = ob[1],
    south = ob[3];
  courses(o, 'wall', [west, north], [west, south], 0.72, oy - 0.12, end - oy + 0.78, d);
  for (const z of [north, south]) {
    const n = d ? 9 : 2;
    for (let k = 0; k < n; k++) {
      const x0 = west + ((east - west) * k) / n,
        x1 = west + ((east - west) * (k + 1)) / n,
        h = 0.35 + (end - oy) * (1 - k / n);
      courses(o, 'wall', [x0, z], [x1, z], 0.7, oy - 0.12, h, d);
      if (d)
        for (let j = 0; j < 2; j++) {
          const xx = x0 + ((x1 - x0) * (j + 0.5)) / 2;
          B(
            o,
            'wall',
            xx,
            z + (z === north ? -1.2 : 1.2),
            (x1 - x0) / 2,
            1.6,
            oy - 0.12,
            h * 0.8 + (1 - j) * 0.11,
          );
        }
    }
  }
  // Two thin parodos retaining wedges flank the orchestra; no filled theater box.
  for (const side of [-1, 1]) {
    const z = oc[1] + side * inner,
      backZ = oc[1] + side * (inner + 19 * depth + walk);
    const q = [
      [oc[0] - 0.2, oy, z],
      [oc[0] - 0.2, oy, backZ],
      [oc[0] - 0.2, end, backZ],
      [oc[0] - 0.2, oy + 0.35, z],
    ];
    Q(o, 'seat', q, [1, 0, 0]);
    Q(
      o,
      'wall',
      q.map((v) => [v[0] - 0.5, v[1], v[2]]),
      [-1, 0, 0],
    );
    Q(
      o,
      'seat',
      [q[3], q[2], [q[2][0] - 0.5, q[2][1], q[2][2]], [q[3][0] - 0.5, q[3][1], q[3][2]]],
      [0, 1, 0],
    );
  }
  // Original complete mapped base boundary, including collinear split; east approach is low masonry, not a stage facade.
  for (let i = 0; i < p.features[1].outline.length; i++) {
    const a = p.features[1].outline[i],
      b = p.features[1].outline[(i + 1) % p.features[1].outline.length];
    segment(o, 'wall', a, b, 0.22, oy - 0.12, 0.18);
  }
}
const sr = p.features[2].outline,
  chain = [...sr.slice(1), sr[0]],
  sc = chain.reduce((s, a) => [s[0] + a[0] / chain.length, s[1] + a[1] / chain.length], [0, 0]);
function insetChain(width) {
  return chain.map((a, i) => {
    const prev = chain[Math.max(0, i - 1)],
      next = chain[Math.min(chain.length - 1, i + 1)],
      dx = next[0] - prev[0],
      dz = next[1] - prev[1],
      len = Math.hypot(dx, dz),
      n = [-dz / len, dx / len],
      sg = (sc[0] - a[0]) * n[0] + (sc[1] - a[1]) * n[1] > 0 ? 1 : -1;
    return [a[0] + n[0] * width * sg, a[1] + n[1] * width * sg];
  });
}
function stadium(o, d) {
  const rows = d === 0 ? 2 : p.parameters.stadiumRows,
    w = 3.85 / rows,
    rise = (7 * p.parameters.stadiumSeatRise) / rows;
  for (let k = 0; k < rows; k++) {
    const a = insetChain((rows - k) * w),
      b = insetChain((rows - k - 1) * w),
      y = sy + k * rise;
    for (let i = 0; i < chain.length - 1; i++) {
      const length = Math.hypot(chain[i + 1][0] - chain[i][0], chain[i + 1][1] - chain[i][1]),
        div = d === 3 ? Math.ceil(length / 2.7) : d === 2 ? Math.ceil(length / 9) : 1;
      for (let j = 0; j < div; j++) {
        const t0 = j / div,
          t1 = (j + 1) / div,
          L = (r, t) => [
            r[i][0] + (r[i + 1][0] - r[i][0]) * t,
            r[i][1] + (r[i + 1][1] - r[i][1]) * t,
          ],
          a0 = L(a, t0),
          a1 = L(a, t1),
          b0 = L(b, t0),
          b1 = L(b, t1),
          col = color(C.ruin, 0.94 + ((j + k + i) % 7) * 0.016),
          quad = [
            [a0[0], y + rise, a0[1]],
            [b0[0], y + rise, b0[1]],
            [b1[0], y + rise, b1[1]],
            [a1[0], y + rise, a1[1]],
          ];
        Q(o, 'ruin', quad, [0, 1, 0], col);
        Q(
          o,
          'ruin',
          [
            [a0[0], y, a0[1]],
            [a1[0], y, a1[1]],
            [a1[0], y + rise, a1[1]],
            [a0[0], y + rise, a0[1]],
          ],
          null,
          col,
        );
        if (k === rows - 1)
          Q(
            o,
            'ruin',
            [
              [b1[0], sy - 0.12, b1[1]],
              [b0[0], sy - 0.12, b0[1]],
              [b0[0], y + rise, b0[1]],
              [b1[0], y + rise, b1[1]],
            ],
            null,
            col,
          );
        if (j === 0 && i === 0)
          Q(
            o,
            'ruin',
            [
              [a0[0], sy - 0.12, a0[1]],
              [b0[0], sy - 0.12, b0[1]],
              [b0[0], y + rise, b0[1]],
              [a0[0], y + rise, a0[1]],
            ],
            null,
            col,
          );
        if (j === div - 1 && i === chain.length - 2)
          Q(
            o,
            'ruin',
            [
              [b1[0], sy - 0.12, b1[1]],
              [a1[0], sy - 0.12, a1[1]],
              [a1[0], y + rise, a1[1]],
              [b1[0], y + rise, b1[1]],
            ],
            null,
            col,
          );
      }
    }
  }
  if (d > 1)
    for (const side of [0, chain.length - 2]) {
      const a = chain[side],
        b = chain[side + 1],
        len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      for (let k = 1; k <= 5; k++) {
        const t = k / 6,
          x = a[0] + (b[0] - a[0]) * t,
          z = a[1] + (b[1] - a[1]) * t,
          n = [-(b[1] - a[1]) / len, (b[0] - a[0]) / len],
          sg = (sc[0] - x) * n[0] + (sc[1] - z) * n[1] > 0 ? 1 : -1;
        for (let j = 0; j < 14; j++) {
          const dist = 3.85 - ((j + 0.5) * 3.85) / 14,
            P = [x + n[0] * dist * sg, z + n[1] * dist * sg];
          segment(
            o,
            'ruin',
            [P[0] - ((b[0] - a[0]) * 0.4) / len, P[1] - ((b[1] - a[1]) * 0.4) / len],
            [P[0] + ((b[0] - a[0]) * 0.4) / len, P[1] + ((b[1] - a[1]) * 0.4) / len],
            3.85 / 14,
            sy + j * 0.16,
            0.16,
            color(C.ruin, 1.03),
          );
        }
      }
    }
}
function build(o, _f, d = 3) {
  temple(o, d);
  odeon(o, d);
  stadium(o, d);
}
export const acropolisOfRhodesSkyline = (o, f) => build(o, f, 0),
  acropolisOfRhodesDistrict = (o, f) => build(o, f, 1),
  acropolisOfRhodesStreet = (o, f) => build(o, f, 2),
  acropolisOfRhodesCloseup = (o, f) => build(o, f, 3);
export const acropolisOfRhodesModel = {
  id: 'acropolis_of_rhodes',
  key: 'acropolis_of_rhodes',
  cell: 'sw/swk',
  recipe: 'structure-acropolis-of-rhodes.mjs',
  title: 'Acropolis of Rhodes (2011)',
  category: 'archaeological',
  progressLedger: 'qualla-002.PROGRESS.md',
  build,
  surfaces,
  brief: p.authoringDirection,
  appearance: p.appearance,
  camera: [-165, 115, 220],
  lookAt: [0, -3, 0],
  portableGroundY: sy - 0.2,
  mediumFiContext: { scale: 1.5, groundY: sy - 0.2 },
  qaCameras: [
    {
      name: 'whole-three-monument-archaeological-ensemble',
      position: [-175, 120, 230],
      lookAt: [0, -4, -5],
      reviewLod: 'skyline',
    },
    {
      name: 'three-drum-columns-broken-shaft-and-open-l-entablature',
      position: [corner[0] + 19, ty + 17, corner[1] + 20],
      lookAt: [corner[0] - 2, ty + 5.8, corner[1] - 3],
    },
    {
      name: 'whole-east-facing-odeon-two-tier-cavea-orchestra-stairs',
      position: [oc[0] + 34, oy + 17, oc[1] + 18],
      lookAt: [oc[0] - 3, oy + 3, oc[1]],
    },
    {
      name: 'whole-open-stadium-long-low-stone-seating-curved-south-end',
      position: [-180, sy + 150, 10],
      lookAt: [63, sy + 1, 12],
    },
  ],
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  groundContactBasis:
    p.geometryBasis +
    ' Independent512mfield frozen before geometry; approximate horizontal monument levels/unknown2011thresholds and composite slope mismatch bounded, live host contact unverified.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-acropolis-of-rhodes.mjs',
    level: 'skyline',
    export: 'acropolisOfRhodesSkyline',
    errorMeters: 4,
    surfaces,
    authoredLevels: {
      district: { export: 'acropolisOfRhodesDistrict', errorMeters: 1.7, surfaces },
      street: { export: 'acropolisOfRhodesStreet', errorMeters: 0.7, surfaces },
      closeup: { export: 'acropolisOfRhodesCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: [
    p.geometryBasis,
    'Bounded three-monument2011ensemble, not every feature in the wider Acropolis. Full original4/5/13physical envelope vertices retained. Other sanctuaries/library/gymnasium/grottoes are outside this model; no complete ancient roof/cella/colonnade, imaginary intact theater or stadium superstructure.',
    'Historical-only observed2011appearance; Ministry2025text confirms subsequent Apollo dismantling/restoration.2011-04-16represented date/conservative2025-01-01upper viewing cutoff does not assert exact demolition date or certify2011..2024unchanged detail. No default current-world activation. Native current archaeological envelopes are coarse plan controls, not a2011survey.',
    'Apollo3standing columns/1broken shaft/corner L-shaped entablature/low stepped masonry and fragmentary foundations interpreted from exactCC0photos; corner,8.3m shafts/.88mradius/4.25m spacing, fine flutes/capital/frieze/chip/coursetop estimates. Exposed bedrock not modeled, arbitrary isolated architectural fragment positions representative and not an artifact survey.',
    'Odeon lower10rows/five cunei/four aisles, upper9rows/four cunei/three aisles,5.5morchestra supported by scholarlytext; actual restored structure represented with curved seats, walkway/parodos walls and side ramps.19x.31mverticals, seat depth/.68mwalkway/hidden side/rear details estimated; no ancient roof or invented stage elevation. Stadium7lowrows/3.85mbank width/side stair census are bounded photo estimates. Original13point stadium enclosure is retained; long and curved banks are polygonal, open earth/grass racing floor not a GLB slab.',
    'Qualla-first52families/zero conflicts; one exact publishedJebulonCC0original then four samecreator ownCC0originals individually inspected/nativeSHA1matched. No questionable/licensed imagery, protected ministry/diazoma drawings/photos, photo textures or media-metadata/policy edits. Shared sandstone/raw and weathered limestone graphs with original vertex colors.',
    'Independent512m129²16641samples/four originalTerrariumtiles frozen before geometry unchanged.74.5335mprovider-relative north-approach datum; original source DEM about3.84moutput pixel spacing may oversample much coarser data. Approximate temple/odeon/stadium horizontal levels from frozen provider field, not surveyed2011grade. Coarse composite rises across stadium rather than a surveyed level running floor, so native host contact remains unverified; no field fitting/flattening/reacquisition. Portable/shared/context flat fixtures separate and cannot prove geographic ground contact.',
  ],
};
