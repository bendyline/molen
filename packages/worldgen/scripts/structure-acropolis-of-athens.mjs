/** Surviving Acropolis architecture; original component plans and public-domain exterior photographs. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { beam, cross, normalFor, sphere } from './authored-structure-mesh.mjs';
import { rgb } from './landmark-model-helpers.mjs';

const plan = JSON.parse(
    fs.readFileSync(
      new URL(
        '../../../content/worldgen/source/places/sw/swb/acropolis_of_athens/plan-controls.json',
        import.meta.url,
      ),
    ),
  ),
  tau = Math.PI * 2,
  ref = 'palette:#ffffff',
  levels = plan.estimatedLevels;
const C = {
    marble: rgb('d7cbb1'),
    fresh: rgb('e4dfd0'),
    stone: rgb('a89a82'),
    dark: rgb('8e816e'),
  },
  surfaces = {
    marble: { slot: 'wall', graph: 'stone_granite', roughness: 0.94, metallic: 0 },
    fresh: { slot: 'trim', graph: 'stone_granite', roughness: 0.94, metallic: 0 },
    stone: { slot: 'foundation', graph: 'stone_granite', roughness: 0.99, metallic: 0 },
    dark: { slot: 'trim', localRef: ref, roughness: 1, metallic: 0 },
  };
const area = (p) =>
    p.reduce(
      (s, a, i) => s + a[0] * p[(i + 1) % p.length][1] - p[(i + 1) % p.length][0] * a[1],
      0,
    ) / 2,
  bounds = (p) => [
    Math.min(...p.map((p) => p[0])),
    Math.min(...p.map((p) => p[1])),
    Math.max(...p.map((p) => p[0])),
    Math.max(...p.map((p) => p[1])),
  ],
  center = (p) => {
    const b = bounds(p);
    return [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2];
  },
  rect = (x, z, w, l) => [
    [x - w / 2, z - l / 2],
    [x + w / 2, z - l / 2],
    [x + w / 2, z + l / 2],
    [x - w / 2, z + l / 2],
  ],
  circle = (x, z, r, n) =>
    Array.from({ length: n }, (_, i) => [
      x + r * Math.cos((i * tau) / n),
      z + r * Math.sin((i * tau) / n),
    ]);
function tri(o, s, p, h, col = C[s]) {
  p = p.map((p) => p.map(Math.fround));
  const n = cross(
    p[1].map((v, i) => v - p[0][i]),
    p[2].map((v, i) => v - p[0][i]),
  );
  if (Math.hypot(...n) < 1e-8) return;
  if (h && n.reduce((s, v, i) => s + v * h[i], 0) < 0) [p[1], p[2]] = [p[2], p[1]];
  o.addTriangle(
    s,
    ref,
    p,
    normalFor(...p),
    p.map((p) => [p[0] + p[2], p[1]]),
    col,
  );
}
function Q(o, s, p, h, col) {
  tri(o, s, [p[0], p[1], p[2]], h, col);
  tri(o, s, [p[0], p[2], p[3]], h, col);
}
function cap(o, s, rings, y, col = C[s], up = true) {
  const ps = rings.flat(),
    holes = [];
  let n = 0;
  for (let i = 0; i < rings.length; i++) {
    if (i) holes.push(n);
    n += rings[i].length;
  }
  const ix = earcut(ps.flat(), holes);
  for (let i = 0; i < ix.length; i += 3)
    tri(
      o,
      s,
      ix.slice(i, i + 3).map((j) => [ps[j][0], y, ps[j][1]]),
      [0, up ? 1 : -1, 0],
      col,
    );
}
function shell(o, s, a, b, y0, y1, col = C[s]) {
  const sign = area(a) > 0 ? 1 : -1;
  for (let i = 0; i < a.length; i++) {
    const j = (i + 1) % a.length;
    Q(
      o,
      s,
      [
        [a[i][0], y0, a[i][1]],
        [a[j][0], y0, a[j][1]],
        [b[j][0], y1, b[j][1]],
        [b[i][0], y1, b[i][1]],
      ],
      [sign * (a[j][1] - a[i][1]), 0, sign * (a[i][0] - a[j][0])],
      col,
    );
  }
}
function prism(o, s, p, y0, y1, col = C[s], bottom = true) {
  shell(o, s, p, p, y0, y1, col);
  cap(o, s, [p], y1, col);
  if (bottom) cap(o, s, [p], y0, col, false);
}
function holed(o, s, p, holes, y0, y1, col = C[s]) {
  for (const [i, r] of [p, ...holes].entries()) {
    const rr = area(r) * (i ? -1 : 1) > 0 ? r : [...r].reverse();
    shell(o, s, rr, rr, y0, y1, col);
  }
  cap(o, s, [p, ...holes], y1, col);
}
const B = (o, s, a, b, w, h = w, col = C[s]) => beam(o, s, a, b, w, h, col),
  vary = (c, k) => c.map((v) => Math.min(1, Math.max(0, v * k)));
function round(o, s, x, z, profile, n, col = C[s], flute = false) {
  let last;
  for (const [y, r] of profile) {
    const p = Array.from({ length: n }, (_, i) => {
      const a = (i * tau) / n,
        rr = r * (flute ? 1 - (0.055 * (1 - Math.cos(a * (n < 40 ? 10 : 20)))) / 2 : 1);
      return [x + rr * Math.cos(a), z + rr * Math.sin(a)];
    });
    if (last) shell(o, s, last.p, p, last.y, y, col);
    else cap(o, s, [p], y, col, false);
    last = { p, y };
  }
  cap(o, s, [last.p], last.y, col);
}
function shaft(o, x, z, r, y, h, d, ionic = false) {
  if (d === 0) {
    // Four closed faces avoid disappearing crossed cards at far viewing angles.
    const v = [
        [x - r, y, z],
        [x + r, y, z],
        [x, y + h, z - r * 0.8],
        [x, y + h, z + r * 0.8],
      ],
      c = [x, y + h / 2, z];
    for (const ids of [
      [0, 1, 2],
      [0, 3, 1],
      [0, 2, 3],
      [1, 3, 2],
    ]) {
      const p = ids.map((i) => v[i]),
        m = [0, 1, 2].map((i) => p.reduce((a, p) => a + p[i] / 3, 0) - c[i]);
      tri(o, 'marble', p, m);
    }
    return;
  }
  const n = d === 3 ? (r < 0.8 ? 20 : 40) : d === 2 ? 4 : 3;
  round(
    o,
    'marble',
    x,
    z,
    d === 2
      ? [
          [y, r],
          [y + h, r * 0.78],
        ]
      : [
          [y, r],
          [y + h * 0.28, r * 0.97],
          [y + h, r * 0.78],
        ],
    n,
    C.marble,
    d === 3,
  );
  if (ionic && d === 3) {
    round(
      o,
      'fresh',
      x,
      z,
      [
        [y - 0.25, r * 1.28],
        [y - 0.08, r * 1.3],
        [y, r],
      ],
      d === 3 ? 20 : 10,
    );
    for (const s of [-1, 1]) {
      const xx = x + s * r * 0.9;
      round(
        o,
        'marble',
        xx,
        z,
        [
          [y + h, r * 0.31],
          [y + h + 0.22, r * 0.4],
        ],
        d === 3 ? 12 : 6,
      );
      if (d === 3) {
        const ps = Array.from({ length: 13 }, (_, i) => {
          const a = (i * tau) / 12;
          return [xx + Math.cos(a) * r * 0.3, y + h + 0.16 + Math.sin(a) * r * 0.3, z + r * 0.6];
        });
        for (let i = 1; i < ps.length; i++) B(o, 'fresh', ps[i - 1], ps[i], 0.07);
      }
    }
  }
  if (ionic) prism(o, 'fresh', rect(x, z, r * 2.7, r * 2.1), y + h, y + h + 0.32);
}
function simplify(p, tol) {
  if (!tol) return p;
  const q = [p[0]];
  for (let i = 1; i < p.length; i++)
    if (Math.hypot(p[i][0] - q.at(-1)[0], p[i][1] - q.at(-1)[1]) >= tol) q.push(p[i]);
  return q.length >= 3
    ? q
    : p.filter(
        (_v, i) =>
          i === 0 || i === Math.floor(p.length / 3) || i === Math.floor((2 * p.length) / 3),
      );
}
function parthenon(o, d) {
  const f = levels.parthenon,
    parts = plan.parthenon.members,
    stems = parts.filter(
      (p) =>
        p.properties.description?.startsWith('Κίονες') && p.properties.description.endsWith('_01'),
    );
  for (const p of parts) {
    const t = p.properties,
      desc = t.description ?? '',
      lo = f + (+t.min_height || 0),
      hi = f + (+t.height || 0),
      poly = p.outline;
    if (!t.height) continue;
    if (desc.startsWith('Κίονες')) {
      if (desc.endsWith('_01')) {
        const c = center(poly),
          b = bounds(poly),
          r = Math.max(b[2] - b[0], b[3] - b[1]) / 2;
        shaft(o, ...c, r, lo, hi - lo, d);
      } else if (d >= 2 && desc.endsWith('_02')) {
        const c = center(poly),
          b = bounds(poly),
          r = (b[2] - b[0]) / 2;
        round(
          o,
          'marble',
          ...c,
          [
            [lo, r * 0.65],
            [hi - 0.06, r],
            [hi, r],
          ],
          d === 3 ? 20 : 8,
        );
      } else if (d >= 1 && desc.endsWith('_03')) prism(o, 'fresh', poly, lo, hi);
      continue;
    }
    if (desc.startsWith('Τρίγλυφα')) {
      if (d === 3) {
        prism(o, 'marble', poly, lo, hi);
        if (d === 3) {
          const b = bounds(poly),
            c = center(poly),
            along = b[2] - b[0] > b[3] - b[1];
          for (const k of [-0.23, 0, 0.23]) {
            const x = c[0] + (along ? k : 0),
              z = c[1] + (along ? 0 : k);
            Q(
              o,
              'dark',
              [
                [x - 0.018, lo + 0.15, z],
                [x + 0.018, lo + 0.15, z],
                [x + 0.018, hi - 0.1, z],
                [x - 0.018, hi - 0.1, z],
              ],
              [0, 0, 1],
            );
          }
        }
      }
      continue;
    }
    if (desc.startsWith('Wall')) {
      if (d < 2 && !desc.includes('_01_')) continue;
      prism(
        o,
        'marble',
        simplify(poly, d < 2 ? 0.45 : 0),
        lo,
        d < 2 ? f + Math.min(10, +t.height + 4) : hi,
      );
      continue;
    }
    if (t['roof:shape']) {
      const b = bounds(poly);
      if (t['roof:shape'] === 'gabled') {
        const x0 = b[0],
          x1 = b[2],
          z0 = b[1],
          z1 = b[3],
          zm = (z0 + z1) / 2;
        for (const [x, h] of [
          [x0, [-1, 0, 0]],
          [x1, [1, 0, 0]],
        ])
          tri(
            o,
            'marble',
            [
              [x, lo, z0],
              [x, hi, zm],
              [x, lo, z1],
            ],
            h,
          );
        Q(
          o,
          'fresh',
          [
            [x0, lo, z0],
            [x1, lo, z0],
            [x1, hi, zm],
            [x0, hi, zm],
          ],
          [0, 1, -1],
        );
        Q(
          o,
          'fresh',
          [
            [x0, hi, zm],
            [x1, hi, zm],
            [x1, lo, z1],
            [x0, lo, z1],
          ],
          [0, 1, 1],
        );
      } else {
        const yy = (z) =>
          lo + (hi - lo) * (1 - Math.abs(z) / Math.max(Math.abs(b[1]), Math.abs(b[3])));
        for (const x of [b[0], b[2]])
          Q(
            o,
            'marble',
            [
              [x, lo, b[1]],
              [x, lo, b[3]],
              [x, yy(b[3]), b[3]],
              [x, yy(b[1]), b[1]],
            ],
            [x === b[0] ? -1 : 1, 0, 0],
          );
        Q(
          o,
          'fresh',
          [
            [b[0], yy(b[1]), b[1]],
            [b[2], yy(b[1]), b[1]],
            [b[2], yy(b[3]), b[3]],
            [b[0], yy(b[3]), b[3]],
          ],
          [0, 1, 0],
        );
      }
      continue;
    }
    if (desc.startsWith('Γείσο')) {
      prism(o, 'marble', poly, lo, hi);
      if (desc.endsWith('_01')) prism(o, 'marble', poly, f + 12.24, lo);
      if (desc.endsWith('_02')) prism(o, 'marble', poly, f + 13.6, hi);
      continue;
    }
    if (d < 2 && desc.startsWith('Σκαλιά')) continue;
    if (d === 0 && desc.startsWith('Κριπίδωμα') && +t.height < 1.8) continue;
    prism(o, 'marble', poly, lo, hi);
  }
  if (d === 3) {
    for (const p of stems) {
      const c = center(p.outline),
        b = bounds(p.outline),
        r = (b[2] - b[0]) / 2,
        h = +p.properties.height,
        y = +p.properties.min_height;
      for (let k = 1; k < 6; k++) {
        const yy = f + y + ((h - y) * k) / 6;
        Q(
          o,
          'stone',
          [
            [c[0] - r, yy - 0.012, c[1] + r * 0.78],
            [c[0] + r, yy - 0.012, c[1] + r * 0.78],
            [c[0] + r, yy + 0.012, c[1] + r * 0.78],
            [c[0] - r, yy + 0.012, c[1] + r * 0.78],
          ],
          [0, 0, 1],
          vary(C.marble, 0.86),
        );
      }
    }
  }
}
function caryatid(o, x, z, y, h, d) {
  if (d < 2) {
    shaft(o, x, z, 0.26, y, h, d);
    return;
  }
  const c = C.marble;
  round(
    o,
    'marble',
    x,
    z,
    [
      [y, 0.37],
      [y + 0.12, 0.38],
      [y + h * 0.45, 0.24],
      [y + h * 0.7, 0.34],
      [y + h * 0.78, 0.24],
    ],
    d === 3 ? 16 : 8,
    c,
    d === 3,
  );
  sphere(
    o,
    'marble',
    [x, y + h * 0.88, z],
    [0.22, 0.29, 0.23],
    c,
    d === 3 ? 10 : 6,
    d === 3 ? 5 : 3,
  );
  round(
    o,
    'fresh',
    x,
    z,
    [
      [y + h * 0.98, 0.28],
      [y + h + 0.13, 0.34],
    ],
    d === 3 ? 12 : 6,
  );
  if (d === 3) {
    for (const s of [-1, 1])
      B(
        o,
        'marble',
        [x + s * 0.3, y + h * 0.71, z],
        [x + s * 0.3, y + h * 0.43, z + 0.09],
        0.15,
        0.14,
      );
    for (const k of [-0.2, -0.1, 0, 0.1, 0.2])
      B(o, 'fresh', [x + k, y + 0.12, z + 0.29], [x + k * 0.55, y + h * 0.48, z + 0.2], 0.035);
  }
}
function erechtheum(o, d) {
  const base = levels.erechtheum,
    p = plan.erechtheum.outline,
    x0 = -7.4,
    x1 = 15,
    z0 = -74,
    z1 = -59.5;
  prism(o, 'marble', p, base - 1, base);
  const y = base + 0.45,
    h = 6.7;
  // Main roofless cella, east open hexastyle, west wall with genuine openings.
  for (const z of [z0, z1]) B(o, 'marble', [x0, base + h / 2, z], [x1, base + h / 2, z], 0.75, h);
  B(o, 'marble', [x0, base + 1.35, z0], [x0, base + 1.35, z1], 0.7, 2.7);
  for (const z of [z0, z1]) B(o, 'marble', [x0, base + 4.8, z], [x0, base + 4.8, z + 1], 0.8, 4.2);
  for (let i = 0; i < 6; i++)
    shaft(o, x1, z0 + 0.65 + (i * (z1 - z0 - 1.3)) / 5, 0.34, y, 5.8, d, true);
  for (let i = 0; i < 4; i++)
    shaft(o, x0, z0 + 1.4 + (i * (z1 - z0 - 2.8)) / 3, 0.35, base + 2.7, 3.1, d, true);
  for (const z of [z0, z1]) B(o, 'fresh', [x0, base + 7, z], [x1, base + 7, z], 1.05, 0.65);
  for (const x of [x0, x1]) B(o, 'fresh', [x, base + 7, z0], [x, base + 7, z1], 1.05, 0.65);
  // Larger north Ionic porch, open between supports and into high framed doorway.
  const nx0 = -11.4,
    nx1 = 0.7,
    nz = -81.4;
  for (let i = 0; i < 4; i++)
    shaft(o, nx0 + 1 + (i * (nx1 - nx0 - 2)) / 3, nz + 0.45, 0.37, base - 1.9, 7.8, d, true);
  for (const x of [nx0 + 1, nx1 - 1]) shaft(o, x, -77.1, 0.37, base - 1.9, 7.8, d, true);
  prism(o, 'fresh', rect((nx0 + nx1) / 2, -78.5, nx1 - nx0, 6.4), base + 6.2, base + 6.8);
  for (const z of [-74, -72.5]) B(o, 'fresh', [-5, base + 2.1, z], [-5, base + 6.4, z], 0.45, 0.45);
  // Six replica Caryatids under their actual surviving flat porch cap; no invented main roof.
  const sx = -3.5,
    sz = -57.2;
  prism(o, 'marble', rect(sx, -59, 6.8, 4.7), base + 0.1, base + 1.6);
  for (let i = 0; i < 4; i++) caryatid(o, sx - 2.5 + (i * 5) / 3, sz, base + 1.6, 2.25, d);
  for (const x of [sx - 2.5, sx + 2.5]) caryatid(o, x, -59.7, base + 1.6, 2.25, d);
  prism(o, 'fresh', rect(sx, -58.6, 6.9, 4.6), base + 4, base + 4.65);
  if (d >= 2) {
    for (const z of [z0, z1])
      for (let k = 0; k < 7; k++)
        B(
          o,
          'stone',
          [x0, base + 0.6 + k * 0.84, z],
          [x1, base + 0.6 + k * 0.84, z],
          0.028,
          0.025,
          vary(C.marble, 0.85),
        );
  }
}
function propylaea(o, d) {
  const y = levels.propylaea,
    r = plan.propylaea,
    wall = r.members.find((f) => f.id === 'way/910010390'),
    holes = r.members.filter((f) => f.role === 'inner').map((f) => f.outline);
  holed(o, 'marble', wall.outline, holes, y, y + 8.6);
  for (const f of r.members.filter((f) => f.role === 'outer' && f !== wall)) {
    const c = center(f.outline),
      b = bounds(f.outline),
      rad = (b[2] - b[0]) / 2;
    shaft(o, ...c, rad, y - 1.3, 8.8, d, c[0] > -128);
    if (d >= 1) prism(o, 'fresh', rect(...c, rad * 2.5, rad * 2.5), y + 7.6, y + 8.2);
  }
  // Six-column east front, two north/south west porch wings; west front partial colonnade mapped above.
  for (let i = 0; i < 6; i++) shaft(o, -107.5, -59.3 + i * 3.08, 0.72, y, 8.5, d);
  for (const z of [-64.7, -39.2])
    for (let i = 0; i < 3; i++) shaft(o, -136.8 + i * 4.7, z, 0.56, y - 1.3, 7.5, d);
  for (const x of [-130, -107.5]) B(o, 'fresh', [x, y + 8.7, -60.2], [x, y + 8.7, -43], 1.65, 1.6);
  for (const z of [-60, -42.9]) B(o, 'fresh', [-130, y + 9.2, z], [-107, y + 9.2, z], 1.1, 0.6);
  if (d >= 2) {
    for (const z of [-64.7, -39.2])
      B(o, 'fresh', [-137.6, y + 6.4, z], [-126, y + 6.4, z], 1.3, 1.25);
    const p = rect(-131.3, -71.9, 12.8, 16);
    prism(o, 'fresh', p, y + 8.6, y + 8.9);
  }
  // Intrinsic western marble ascent, no citadel-wide artificial platform.
  const n = [1, 5, 12, 24][d];
  for (let i = 0; i < n; i++) {
    const x = -166 + (i * 33) / n;
    prism(o, 'marble', rect(x + 16.5 / n, -52, 33 / n, 16), (i * 15) / n, ((i + 1) * 15) / n);
  }
}
function nike(o, d) {
  const y = levels.nike,
    outer = plan.nike.members.find((m) => m.role === 'outer').outline,
    inner = plan.nike.members.find((m) => m.role === 'inner').outline,
    b = bounds(outer),
    x0 = b[0],
    x1 = b[2],
    z0 = b[1],
    z1 = b[3];
  prism(o, 'stone', rect((x0 + x1) / 2, (z0 + z1) / 2, x1 - x0 + 3, z1 - z0 + 3), y - 9, y - 1.1);
  prism(o, 'marble', outer, y - 1.1, y);
  const ib = bounds(inner),
    mid = (ib[1] + ib[3]) / 2;
  for (const z of [ib[1], ib[3]])
    B(o, 'marble', [ib[0], y + 2.05, z], [ib[2], y + 2.05, z], 0.5, 4.1);
  for (const x of [ib[0], ib[2]]) {
    for (const [za, zb] of [
      [ib[1], mid - 0.75],
      [mid + 0.75, ib[3]],
    ])
      B(o, 'marble', [x, y + 2.05, za], [x, y + 2.05, zb], 0.5, 4.1);
    B(o, 'fresh', [x, y + 3.85, mid - 0.9], [x, y + 3.85, mid + 0.9], 0.6, 0.5);
  }
  for (const x of [x0 + 0.7, x1 - 0.7])
    for (let i = 0; i < 4; i++)
      shaft(o, x, z0 + 0.9 + (i * (z1 - z0 - 1.8)) / 3, 0.27, y, 4.1, d, true);
  for (const z of [z0 + 0.2, z1 - 0.2])
    B(o, 'fresh', [x0, y + 4.6, z], [x1, y + 4.6, z], 0.6, 0.85);
  for (const x of [x0 + 0.2, x1 - 0.2])
    B(o, 'fresh', [x, y + 4.6, z0], [x, y + 4.6, z1], 0.6, 0.85);
  if (d >= 2) {
    for (let i = 0; i < 3; i++)
      prism(
        o,
        'fresh',
        rect((x0 + x1) / 2, (z0 + z1) / 2, x1 - x0 + 1 - i * 0.32, z1 - z0 + 1 - i * 0.32),
        y - 1.1 + i * 0.3,
        y - 0.8 + i * 0.3,
      );
  }
}
function fortifications(o, d) {
  for (const f of plan.wall.members) {
    if (f.properties.natural === 'cliff') continue;
    const p = simplify(f.outline, d === 0 ? 12 : d === 1 ? 3 : 0),
      b = bounds(p);
    if (p.length < 2) continue;
    const western = (b[0] + b[2]) / 2 < -120,
      top = western ? levels.propylaea : levels.wallTop;
    // Relation members are adjoining boundary polylines, not closed wall-plan polygons.
    for (let i = 1; i < p.length; i++)
      B(o, 'stone', [p[i - 1][0], top - 7, p[i - 1][1]], [p[i][0], top - 7, p[i][1]], 1.8, 14);
    if (d === 3) {
      for (let i = 1; i < p.length; i++) {
        const a = p[i - 1],
          b = p[i],
          len = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (len > 2)
          for (let j = 0; j < 9; j++)
            Q(
              o,
              'dark',
              [
                [a[0], top - 13 + j * 1.4, a[1]],
                [b[0], top - 13 + j * 1.4, b[1]],
                [b[0], top - 12.97 + j * 1.4, b[1]],
                [a[0], top - 12.97 + j * 1.4, a[1]],
              ],
              [b[1] - a[1], 0, a[0] - b[0]],
            );
      }
    }
  }
  const g = plan.gate.outline;
  const clip = (p, z, less) => {
    const q = [];
    for (let i = 0; i < p.length; i++) {
      const a = p[i],
        b = p[(i + 1) % p.length],
        aa = less ? a[1] <= z : a[1] >= z,
        bb = less ? b[1] <= z : b[1] >= z;
      if (aa) q.push(a);
      if (aa !== bb) {
        const t = (z - a[1]) / (b[1] - a[1]);
        q.push([a[0] + t * (b[0] - a[0]), z]);
      }
    }
    return q;
  };
  prism(o, 'stone', clip(g, -55, true), 0, 4.6);
  prism(o, 'stone', clip(g, -51, false), 0, 4.6);
  prism(o, 'stone', g, 4.6, 6.8);
  const bb = bounds(g); // Gate towers are separate ends of the actual indented plan.
  B(o, 'marble', [bb[0], 5.7, (bb[1] + bb[3]) / 2], [bb[2], 5.7, (bb[1] + bb[3]) / 2], 2, 1.3);
  const a = plan.agrippa.outline;
  for (const k of [0, 1, 2]) {
    const c = center(a),
      p = a.map((v) => v.map((x, i) => c[i] + (x - c[i]) * (1 - k * 0.05)));
    prism(o, 'stone', p, levels.agrippa + k * 2.8, levels.agrippa + (k + 1) * 2.8);
  }
  const r = plan.roma.outline,
    c = center(r);
  if (d === 0) cap(o, 'marble', [r], levels.parthenon);
  else {
    round(
      o,
      'marble',
      ...c,
      [
        [levels.parthenon - 0.2, 4.15],
        [levels.parthenon + 0.3, 4.15],
      ],
      d === 3 ? 24 : 12,
    );
    for (let i = 0; i < 9; i++) {
      const a = (i * tau) / 9;
      round(
        o,
        'marble',
        c[0] + 3.1 * Math.cos(a),
        c[1] + 3.1 * Math.sin(a),
        [
          [levels.parthenon + 0.3, 0.28],
          [levels.parthenon + 0.8, 0.28],
        ],
        6,
      );
    }
  }
}
// Half-round stone seating has genuine open orchestra and permanent stage wall openings.
function theatre(o, d, kind) {
  const odeon = kind === 'odeon',
    floor = odeon ? levels.odeon : levels.dionysus,
    c = odeon ? [-198, 51] : [69, 143],
    yaw = odeon ? 0.105 : -0.09,
    R = odeon ? 40 : 51,
    r = odeon ? 12 : 16,
    rows = [1, 3, 6, 19][d],
    segs = [8, 12, 24, 40][d],
    rise = odeon ? 19 : 17,
    theta = odeon ? Math.PI : Math.PI * 1.12,
    P = (r, a, y) => {
      const x = r * Math.cos(a),
        z = -r * Math.sin(a);
      return [
        c[0] + Math.cos(yaw) * x + Math.sin(yaw) * z,
        y,
        c[1] - Math.sin(yaw) * x + Math.cos(yaw) * z,
      ];
    };
  for (let j = 0; j < rows; j++) {
    const r0 = r + ((R - r) * j) / rows,
      r1 = r + ((R - r) * (j + 1)) / rows,
      y0 = floor + (rise * j) / rows,
      y1 = floor + (rise * (j + 1)) / rows;
    for (let i = 0; i < segs; i++) {
      const a0 = (Math.PI - theta) / 2 + (i * theta) / segs,
        a1 = (Math.PI - theta) / 2 + ((i + 1) * theta) / segs;
      Q(o, 'marble', [P(r0, a0, y0), P(r1, a0, y0), P(r1, a1, y0), P(r0, a1, y0)], [0, 1, 0]);
      if (d) Q(o, 'stone', [P(r1, a0, y0), P(r1, a0, y1), P(r1, a1, y1), P(r1, a1, y0)], [0, 0, 1]);
    }
  }
  const n = odeon ? 24 : 28,
    ps = circle(...c, r, n);
  cap(o, 'stone', [ps], floor - 0.05);
  if (odeon) {
    const xx = [-238, -158],
      z = 65; // Surviving three-level stage screen, multiple real arched voids.
    for (const [k, start, end, top] of [
      [0, -238, -225, 24],
      [1, -225, -206, 14],
      [2, -206, -181, 15],
      [3, -181, -158, 24],
    ]) {
      const count = k === 0 || k === 3 ? 3 : 4,
        w = (end - start) / count;
      for (let i = 0; i < count; i++) {
        const x = start + (i + 0.5) * w;
        arch(o, d, x, z, w * 0.62, 2.1, floor, 6.2, 1.5);
        arch(o, d, x, z, w * 0.6, 2.1, floor + 8.4, 5.2, 1.5);
        if (top > 20) arch(o, d, x, z, w * 0.6, 2.1, floor + 16, 6.4, 1.5);
      }
      B(o, 'stone', [start, floor + 7.4, z], [end, floor + 7.4, z], 2.1, 1.6);
      B(o, 'stone', [start, floor + 15, z], [end, floor + 15, z], 2.1, 1.5);
    }
    for (const x of xx) B(o, 'stone', [x, floor + 5, z], [x, floor + 5, 38], 2.3, 10);
  } else {
    const z = 156;
    B(o, 'stone', [35, floor + 0.8, z], [104, floor + 0.8, z], 5, 1.6);
    if (d >= 2)
      for (let i = 0; i < 18; i++)
        prism(o, 'marble', rect(41 + i * 3.2, z, 1.4, 2.3), floor + 1.5, floor + 2.6);
  }
}
function arch(o, d, x, z, w, depth, y, h, pier) {
  const spring = y + h - w / 2,
    n = [1, 1, 4, 7][d],
    a0 = x - w / 2,
    a1 = x + w / 2;
  prism(o, 'stone', rect(a0 - pier / 2, z, pier, depth), y, y + h + 0.3);
  prism(o, 'stone', rect(a1 + pier / 2, z, pier, depth), y, y + h + 0.3);
  for (let i = 0; i < n; i++) {
    const a = (i * Math.PI) / n,
      b = ((i + 1) * Math.PI) / n;
    const p = [
      [x + (Math.cos(a) * w) / 2, spring + (Math.sin(a) * w) / 2],
      [x + (Math.cos(b) * w) / 2, spring + (Math.sin(b) * w) / 2],
      [x + Math.cos(b) * (w / 2 + 0.55), spring + Math.sin(b) * (w / 2 + 0.55)],
      [x + Math.cos(a) * (w / 2 + 0.55), spring + Math.sin(a) * (w / 2 + 0.55)],
    ];
    for (const dz of [-depth / 2, depth / 2])
      Q(
        o,
        'stone',
        p.map((p) => [p[0], p[1], z + dz]),
        [0, 0, dz < 0 ? -1 : 1],
      );
    Q(
      o,
      'stone',
      [
        [p[0][0], p[0][1], z - depth / 2],
        [p[1][0], p[1][1], z - depth / 2],
        [p[1][0], p[1][1], z + depth / 2],
        [p[0][0], p[0][1], z + depth / 2],
      ],
      [0, -1, 0],
    );
  }
  B(o, 'stone', [a0 - pier, y + h + 0.4, z], [a1 + pier, y + h + 0.4, z], depth, 0.8);
}
function stoa(o, d) {
  const p = plan.stoa.outline,
    y = levels.stoa,
    a = p[0],
    b = p[1],
    n = [5, 7, 14, 24][d],
    len = Math.hypot(b[0] - a[0], b[1] - a[1]),
    yaw = Math.atan2(b[1] - a[1], b[0] - a[0]);
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n,
      x = a[0] + (b[0] - a[0]) * t,
      z = a[1] + (b[1] - a[1]) * t;
    if (d < 2) {
      B(o, 'stone', [x, y + 1.9, z], [x, y + 5.8, z], 1.3, 1.3);
    } else {
      const T = (p) => [
          x + Math.cos(yaw) * p[0] + Math.sin(yaw) * p[2],
          p[1],
          z + Math.sin(yaw) * p[0] - Math.cos(yaw) * p[2],
        ],
        proxy = {
          addTriangle(s, r, ps, _n, uv, col) {
            o.addTriangle(s, r, ps.map(T), normalFor(...ps.map(T)), uv, col);
          },
          addQuad(s, r, ps, _n, uv, col) {
            o.addQuad(s, r, ps.map(T), normalFor(...ps.map(T)), uv, col);
          },
          addConvexPolygon(s, r, ps, _n, uv, col) {
            o.addConvexPolygon(s, r, ps.map(T), normalFor(...ps.map(T)), uv, col);
          },
        };
      arch(proxy, d, 0, 0, len / n - 1.1, 1.3, y, 6.2, 0.55);
    }
  }
  B(o, 'stone', [a[0], y + 6.5, a[1]], [b[0], y + 6.5, b[1]], 1.5, 1.1);
  B(o, 'stone', [a[0], y + 0.3, a[1]], [b[0], y + 0.3, b[1]], 1.8, 0.6);
}
function build(o, _f, d = 3) {
  if (d === 0) return skyline(o);
  if (d === 1) return district(o);
  parthenon(o, d);
  erechtheum(o, d);
  propylaea(o, d);
  nike(o, d);
  fortifications(o, d);
  theatre(o, d, 'odeon');
  theatre(o, d, 'dionysus');
  stoa(o, d);
}
function skyline(o) {
  const f = levels.parthenon,
    parts = plan.parthenon.members;
  for (const p of parts) {
    const t = p.properties,
      desc = t.description ?? '';
    if (desc.startsWith('Κίονες') && desc.endsWith('_01')) {
      const c = center(p.outline),
        b = bounds(p.outline);
      shaft(
        o,
        ...c,
        (b[2] - b[0]) / 2,
        f + (+t.min_height || 0),
        +t.height - (+t.min_height || 0),
        0,
      );
    }
  }
  // Thin capped cornice strips preserve the missing central southern entablature.
  for (const p of parts.filter((p) => p.properties.description === 'Γείσο_01_02'))
    prism(o, 'marble', simplify(p.outline, 0.4), f + 12.3, f + 15.34);
  prism(o, 'marble', rect(0, 0, 70, 32), f, f + 1.8);
  for (const x of [-20, 22]) B(o, 'marble', [x, f + 5, -10], [x, f + 5, 10], 1.2, 7);
  for (const x of [-34, 34]) {
    const h = x < 0 ? 4.5 : 1.5;
    for (const z of [-15, 15])
      tri(
        o,
        'marble',
        [
          [x, f + 15, z],
          [x, f + 15, 0],
          [x, f + 15 + h, 0],
        ],
        [x < 0 ? -1 : 1, 0, 0],
      );
  }
  for (const [x, z, y, h, w, l] of [
    [-1, -66.5, 27, 7, 23, 15],
    [-131, -72, 15, 8.5, 12, 15],
    [-113, -51, 15, 9, 4, 16],
    [-147, -37, 12, 4.8, 6, 5],
  ]) {
    const p = rect(x, z, w, l);
    for (let i = 0; i < 4; i++) {
      const a = p[i],
        b = p[(i + 1) % 4];
      Q(
        o,
        'marble',
        [
          [a[0], y, a[1]],
          [b[0], y, b[1]],
          [b[0], y + h, b[1]],
          [a[0], y + h, a[1]],
        ],
        [b[1] - a[1], 0, a[0] - b[0]],
      );
    }
  }
  for (const [x, z, y, h, n, span] of [
    [15, -67, 27, 6, 6, 13],
    [-130, -53, 14, 9, 6, 19],
    [-147, -37, 12, 4.2, 4, 6],
  ])
    for (let i = 0; i < n; i++) shaft(o, x, z - span / 2 + (i * span) / (n - 1), 0.48, y, h, 0);
  for (let i = 0; i < 6; i++) shaft(o, -6 + i * 1.1, -57.2, 0.22, 28.5, 2.3, 0);
  prism(o, 'fresh', rect(-3.5, -58.6, 7, 4.6), 31, 31.65);
  prism(o, 'fresh', rect(-5.3, -78.5, 12, 6), 33.2, 33.8);
  prism(o, 'stone', rect(-147, -37, 13, 11), 3, 11);
  for (const f of plan.wall.members) {
    if (f.properties.natural === 'cliff') continue;
    const p = simplify(f.outline, 12);
    for (let i = 1; i < p.length; i++) {
      const a = p[i - 1],
        b = p[i],
        top = (a[0] + b[0]) / 2 < -120 ? 15 : 30;
      Q(
        o,
        'stone',
        [
          [a[0], top - 14, a[1]],
          [b[0], top - 14, b[1]],
          [b[0], top, b[1]],
          [a[0], top, a[1]],
        ],
        [b[1] - a[1], 0, a[0] - b[0]],
      );
      Q(
        o,
        'stone',
        [
          [a[0], top - 14, a[1]],
          [b[0], top - 14, b[1]],
          [b[0], top, b[1]],
          [a[0], top, a[1]],
        ],
        [a[1] - b[1], 0, b[0] - a[0]],
      );
    }
  }
  for (const [cx, cz, r, y] of [
    [-198, 51, 40, -21],
    [69, 143, 51, -14],
  ])
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 8,
        b = ((i + 1) * Math.PI) / 8;
      Q(
        o,
        'marble',
        [
          [cx + 12 * Math.cos(a), y, cz - 12 * Math.sin(a)],
          [cx + r * Math.cos(a), y + 18, cz - r * Math.sin(a)],
          [cx + r * Math.cos(b), y + 18, cz - r * Math.sin(b)],
          [cx + 12 * Math.cos(b), y, cz - 12 * Math.sin(b)],
        ],
        [0, 1, 0],
      );
    }
  for (const [x, w, h] of [
    [-231, 14, 23],
    [-211, 25, 14],
    [-184, 29, 14],
    [-164, 12, 23],
  ]) {
    B(o, 'stone', [x - w / 2, -14, 65], [x + w / 2, -14, 65], 2, 2);
    B(o, 'stone', [x - w / 2, -6, 65], [x + w / 2, -6, 65], 2, 2);
    for (const s of [-1, 1]) shaft(o, x + (s * w) / 2, 65, 0.75, -21, h, 0);
  }
  B(o, 'stone', [-152, -8.5, 61], [-2, -8.5, 115], 1.5, 2);
  for (let i = 0; i < 5; i++) shaft(o, -145 + i * 34, 64 + i * 12, 0.6, -15, 6, 0);
  prism(o, 'stone', plan.agrippa.outline, 8, 16);
  prism(o, 'stone', plan.gate.outline, 0, 6);
  cap(o, 'marble', [plan.roma.outline], 30);
}
function district(o) {
  skyline(o);
  theatre(o, 1, 'odeon');
  theatre(o, 1, 'dionysus');
}
export const acropolisSkyline = (o, f) => build(o, f, 0);
export const acropolisDistrict = (o, f) => build(o, f, 1);
export const acropolisStreet = (o, f) => build(o, f, 2);
export const acropolisModel = {
  id: 'acropolis_of_athens',
  key: 'acropolis_of_athens',
  recipe: 'structure-acropolis-of-athens.mjs',
  cell: 'sw/swb',
  title: 'Acropolis of Athens',
  category: 'archaeological-ensemble',
  progressLedger: 'qualla-002.PROGRESS.md',
  build,
  surfaces,
  brief:
    'Surviving Acropolis ensemble from native architectural component plans: roofless Parthenon/fluted peristyle and broken pediments, Erechtheion/Ionic porches/six Caryatids, monumental Propylaea, Nike/bastion, Beulé Gate/Agrippa, intrinsic stone fortifications/Roma ruins and lower-slope Odeon/Dionysus theatres/Stoa remains. Genuine open ruins and stage arches, original representative carved detail; no conjectural temple reconstruction or natural hill mesh.',
  camera: [-330, 240, 350],
  lookAt: [-45, 10, 30],
  portableGroundY: -23,
  mediumFiContext: { scale: 3.1, groundY: -23 },
  qaCameras: [
    {
      name: 'complete-surviving-compound',
      position: [-460, 410, 450],
      lookAt: [-48, 10, 35],
      reviewLod: 'skyline',
    },
    {
      name: 'parthenon-broken-pediments-open-cella-and-fluted-peristyle',
      position: [-74, 73, 64],
      lookAt: [0, 38, 0],
    },
    {
      name: 'erechtheion-six-caryatids-and-ionic-porches',
      position: [-28, 51, -29],
      lookAt: [0, 31, -68],
    },
    {
      name: 'propylaea-athena-nike-and-beule-approach',
      position: [-207, 65, 10],
      lookAt: [-135, 20, -53],
    },
    {
      name: 'odeon-stage-archways-and-open-stone-seating',
      position: [-200, 28, 107],
      lookAt: [-198, -7, 40],
    },
  ],
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis:
    'Fixed west approach outside Beulé Gate before independent raw terrain acquisition; approximate relative architecture levels and wall contact, no natural hill/citadel terrain replacement.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-acropolis-of-athens.mjs',
    level: 'skyline',
    export: 'acropolisSkyline',
    errorMeters: 8,
    surfaces,
    authoredLevels: {
      district: { export: 'acropolisDistrict', errorMeters: 3, surfaces },
      street: { export: 'acropolisStreet', errorMeters: 1, surfaces },
    },
  },
  limitations: [
    plan.geometryBasis,
    plan.levelBasis,
    'Eight exact published Qualla originals actually inspected with native SHA1/explicit own-work CC0, PD-self or Adam Carr PD-user-en grants. Two Odeon originals are retained as source copies with primary release because old Qualla category metadata omitted its PD-self basis; no new imagery fetched. No questionable or other-licensed imagery used.',
    'Complete surviving compound is interpreted at medium fidelity. Hidden elevations, floor/threshold differences, fortification sections, ruined crown profiles, masonry seams and detailed sculpture are estimates. Six on-site Caryatids are original representative draped figures, not a copy of museum artifacts. No roof is restored over the main temples. hekatompedon_temple Hekatompedon, all conjectural archaic predecessors and Panathenaic Stadium are excluded.',
    'Native exact architectural perimeters/columns control plan, but current restoration state may differ from mapped parts or dated photos. Temporary scaffolds/cranes and modern worksheds/lifts/museum are omitted. Surviving low foundations retain low heights; natural cliff-tagged wall members are excluded.',
    'Raw source relief frozen separately before geometry at fixed west contact:118.0403m provider datum,800m grid, no flattening/fitting. Discontinuous rocky plateau is not constructed as an asset mesh. Distributed intrinsic masonry/temple platform levels remain approximate; exact host-terrain contact is unverified. Flat review stageY-23 shows the architecture without certifying its fit to any host DEM.',
  ],
};
