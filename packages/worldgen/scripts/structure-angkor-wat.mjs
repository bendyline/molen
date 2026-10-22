/** Complete ancient Angkor Wat architecture from native plans and cleared photographs. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { beam, cross, normalFor } from './authored-structure-mesh.mjs';
import { rgb } from './landmark-model-helpers.mjs';
import { box } from './structure-mesh.mjs';

const plan = JSON.parse(
    fs.readFileSync(
      new URL(
        '../../../content/worldgen/source/places/w6/w63/angkor_wat/plan-controls.json',
        import.meta.url,
      ),
    ),
  ),
  ref = 'palette:#ffffff',
  C = {
    stone: rgb('9f998d'),
    roof: rgb('6f6b61'),
    trim: rgb('a6a092'),
    laterite: rgb('9b8269'),
    dark: rgb('514d43'),
  },
  surfaces = {
    stone: { slot: 'wall', graph: 'stone_granite', roughness: 0.99, metallic: 0 },
    roof: { slot: 'roof', graph: 'stone_granite', roughness: 0.99, metallic: 0 },
    trim: { slot: 'trim', graph: 'stone_granite', roughness: 0.99, metallic: 0 },
    laterite: { slot: 'foundation', graph: 'stone_granite', roughness: 0.99, metallic: 0 },
    dark: { slot: 'door', localRef: ref, roughness: 1, metallic: 0 },
  };
const area = (p) =>
  p.reduce((s, a, i) => {
    const b = p[(i + 1) % p.length];
    return s + a[0] * b[1] - b[0] * a[1];
  }, 0) / 2;
const bounds = (p) => {
  const x = p.map((v) => v[0]),
    z = p.map((v) => v[1]);
  return [Math.min(...x), Math.min(...z), Math.max(...x), Math.max(...z)];
};
const center = (p) => {
  const b = bounds(p);
  return [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2];
};
const rect = (p) => {
  const b = bounds(p);
  return [
    [b[0], b[1]],
    [b[2], b[1]],
    [b[2], b[3]],
    [b[0], b[3]],
  ];
};
const scale = (p, s, c = center(p)) => p.map((v) => v.map((x, i) => c[i] + (x - c[i]) * s));
function tri(o, s, p, n, col = C[s]) {
  const f = p.map((v) => v.map(Math.fround)),
    a = f[1].map((v, i) => v - f[0][i]),
    b = f[2].map((v, i) => v - f[0][i]),
    q = cross(a, b);
  if (Math.hypot(...q) < 1e-8) return;
  if (q.reduce((s, v, i) => s + v * n[i], 0) < 0) p = [p[0], p[2], p[1]];
  o.addTriangle(
    s,
    ref,
    p,
    normalFor(...p),
    p.map((v) => [v[0] + v[2], v[1]]),
    col,
  );
}
function Q(o, s, p, n, col = C[s]) {
  tri(o, s, p.slice(0, 3), n, col);
  tri(o, s, [p[0], p[2], p[3]], n, col);
}
const B = (o, s, x, y, z, w, h, dep) =>
  box(o, s, [x - w / 2, y, z - dep / 2], [x + w / 2, y + h, z + dep / 2], C[s]);
function plate(o, rings, y, s = 'stone') {
  const ps = rings.flat(),
    ix = earcut(
      ps.flat(),
      rings.slice(1).map((_, i) => rings.slice(0, i + 1).reduce((s, p) => s + p.length, 0)),
    );
  for (let i = 0; i < ix.length; i += 3)
    tri(
      o,
      s,
      ix.slice(i, i + 3).map((j) => [ps[j][0], y, ps[j][1]]),
      [0, 1, 0],
    );
}
function prism(o, rings, y0, y1, s = 'stone', taper = 1) {
  plate(
    o,
    rings.map((p) => scale(p, taper)),
    y1,
    s,
  );
  for (let k = 0; k < rings.length; k++) {
    let p = rings[k];
    if (area(p) * (k ? -1 : 1) < 0) p = [...p].reverse();
    const q = scale(p, taper);
    for (let i = 0; i < p.length; i++) {
      const j = (i + 1) % p.length,
        a = p[i],
        b = p[j];
      Q(
        o,
        s,
        [
          [a[0], y0, a[1]],
          [b[0], y0, b[1]],
          [q[j][0], y1, q[j][1]],
          [q[i][0], y1, q[i][1]],
        ],
        [b[1] - a[1], 0, a[0] - b[0]],
      );
    }
  }
}
function band(o, p, y, width = 0.22, h = 0.16) {
  for (let i = 0; i < p.length; i++) {
    const a = p[i],
      b = p[(i + 1) % p.length],
      len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len < 0.05) continue;
    const n = [(b[1] - a[1]) / len, -(b[0] - a[0]) / len],
      P = (p, y, t) => [p[0] + n[0] * t, y, p[1] + n[1] * t];
    Q(
      o,
      'trim',
      [
        P(a, y - h / 2, width / 2),
        P(b, y - h / 2, width / 2),
        P(b, y + h / 2, width / 2),
        P(a, y + h / 2, width / 2),
      ],
      [n[0], 0, n[1]],
    );
    Q(
      o,
      'trim',
      [
        P(a, y + h / 2, -width / 2),
        P(b, y + h / 2, -width / 2),
        P(b, y + h / 2, width / 2),
        P(a, y + h / 2, width / 2),
      ],
      [0, 1, 0],
    );
  }
}
function panel(
  o,
  a,
  b,
  y0,
  y1,
  d,
  { open = true, spacing = 3.6, door = false, balusters = true } = {},
) {
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  if (length < 0.04 || y1 - y0 < 0.05) return;
  const u = [(b[0] - a[0]) / length, (b[1] - a[1]) / length],
    n = [u[1], -u[0]],
    P = (x, y, depth = 0) => [a[0] + u[0] * x + n[0] * depth, y, a[1] + u[1] * x + n[1] * depth],
    count =
      d >= 2 ? Math.max(1, Math.floor(length / (d === 2 ? Math.max(spacing, 14) : spacing))) : 0,
    holes = [],
    low = door ? y0 : y0 + 0.55,
    high = y1 - 0.5;
  if (open && length > 2.8 && high - low > 1.2)
    for (let i = 0; i < count; i++) {
      const x = ((i + 0.5) * length) / count,
        w = Math.min(door ? 2.5 : 2.05, length / count - 0.65);
      holes.push([
        [x - w / 2, low],
        [x + w / 2, low],
        [x + w / 2, high],
        [x - w / 2, high],
      ]);
    }
  const outer = [
      [0, y0],
      [length, y0],
      [length, y1],
      [0, y1],
    ],
    ps = [outer, ...holes].flat(),
    ix = earcut(
      ps.flat(),
      holes.map((_, i) => 4 + i * 4),
    );
  for (let i = 0; i < ix.length; i += 3)
    tri(
      o,
      'stone',
      ix.slice(i, i + 3).map((j) => P(...ps[j])),
      [n[0], 0, n[1]],
    );
  for (const hole of holes) {
    for (let j = 0; j < 4; j++) {
      const a = hole[j],
        b = hole[(j + 1) % 4];
      Q(o, 'stone', [P(...a), P(...b), P(...b, -0.45), P(...a, -0.45)], [0, 1, 0]);
    }
    if (d < 3) continue;
    const x = (hole[0][0] + hole[1][0]) / 2,
      w = hole[1][0] - hole[0][0];
    for (const xx of [x - w / 2 - 0.09, x + w / 2 + 0.09])
      Q(
        o,
        'trim',
        [
          P(xx - 0.08, low - 0.08, 0.07),
          P(xx + 0.08, low - 0.08, 0.07),
          P(xx + 0.08, high + 0.08, 0.07),
          P(xx - 0.08, high + 0.08, 0.07),
        ],
        [n[0], 0, n[1]],
      );
    for (const yy of [low - 0.08, high + 0.08])
      Q(
        o,
        'trim',
        [
          P(x - w / 2 - 0.2, yy - 0.08, 0.07),
          P(x + w / 2 + 0.2, yy - 0.08, 0.07),
          P(x + w / 2 + 0.2, yy + 0.08, 0.07),
          P(x - w / 2 - 0.2, yy + 0.08, 0.07),
        ],
        [n[0], 0, n[1]],
      );
    if (!door && balusters)
      for (let j = 1; j <= 4; j++) {
        const xx = x - w / 2 + (j * w) / 5;
        Q(
          o,
          'stone',
          [
            P(xx - 0.055, low, -0.18),
            P(xx + 0.055, low, -0.18),
            P(xx + 0.055, high, -0.18),
            P(xx - 0.055, high, -0.18),
          ],
          [n[0], 0, n[1]],
        );
        Q(
          o,
          'stone',
          [P(xx, low, -0.24), P(xx, low, -0.12), P(xx, high, -0.12), P(xx, high, -0.24)],
          [u[0], 0, u[1]],
        );
        const y = (low + high) / 2;
        Q(
          o,
          'trim',
          [
            P(xx - 0.11, y, -0.17),
            P(xx, y - 0.12, -0.17),
            P(xx + 0.11, y, -0.17),
            P(xx, y + 0.12, -0.17),
          ],
          [n[0], 0, n[1]],
        );
      }
  }
}
function shell(o, p, y0, y1, d, options = {}) {
  let poly = p;
  if (area(poly) < 0) poly = [...poly].reverse();
  for (let i = 0; i < poly.length; i++)
    panel(o, poly[i], poly[(i + 1) % poly.length], y0, y1, d, options);
}
function vault(o, p, floor, ridge, d) {
  const bb = bounds(p),
    alongX = bb[2] - bb[0] > bb[3] - bb[1],
    c = center(p),
    len = alongX ? bb[2] - bb[0] : bb[3] - bb[1],
    w = alongX ? bb[3] - bb[1] : bb[2] - bb[0],
    eave = ridge - 2,
    point = (a, y, b) => (alongX ? [c[0] + a, y, c[1] + b] : [c[0] + b, y, c[1] + a]),
    sections = d === 0 ? 2 : d === 1 ? 3 : d === 2 ? 4 : 6;
  if (d === 0) {
    prism(o, [rect(p)], floor, ridge, 'roof');
    return;
  }
  shell(o, p, floor, eave, d, { open: true, spacing: 5.2, balusters: floor >= 11 });
  for (let j = 0; j < sections; j++) {
    const t0 = j / sections,
      t1 = (j + 1) / sections,
      angle = (t) => Math.PI * (t - 0.5),
      z = (t) => (Math.sin(angle(t)) * w) / 2,
      y = (t) => eave + Math.cos(angle(t)) * 2;
    Q(
      o,
      'roof',
      [
        point(-len / 2, y(t0), z(t0)),
        point(len / 2, y(t0), z(t0)),
        point(len / 2, y(t1), z(t1)),
        point(-len / 2, y(t1), z(t1)),
      ],
      [0, 1, 0],
    );
  }
  for (const sign of [-1, 1]) {
    const ps = [
      [0, eave],
      ...Array.from({ length: sections + 1 }, (_, j) => {
        const a = Math.PI * (j / sections - 0.5);
        return [(Math.sin(a) * w) / 2, eave + Math.cos(a) * 2];
      }),
    ];
    for (let i = 1; i < ps.length - 1; i++)
      tri(
        o,
        'roof',
        [ps[0], ps[i], ps[i + 1]].map(([z, y]) => point((sign * len) / 2, y, z)),
        alongX ? [sign, 0, 0] : [0, 0, sign],
      );
  }
  if (d >= 2) {
    for (const z of [-w / 2, w / 2])
      beam(
        o,
        'trim',
        point(-len / 2, eave - 0.08, z),
        point(len / 2, eave - 0.08, z),
        0.35,
        0.24,
        C.trim,
      );
    if (d === 3)
      for (let x = -len / 2 + 0.6; x < len / 2; x += 4.4)
        for (let j = 0; j < sections; j++) {
          const a = Math.PI * (j / sections - 0.5),
            b = Math.PI * ((j + 1) / sections - 0.5);
          Q(
            o,
            'roof',
            [
              point(x - 0.025, eave + Math.cos(a) * 2 + 0.035, (Math.sin(a) * w) / 2),
              point(x + 0.025, eave + Math.cos(a) * 2 + 0.035, (Math.sin(a) * w) / 2),
              point(x + 0.025, eave + Math.cos(b) * 2 + 0.035, (Math.sin(b) * w) / 2),
              point(x - 0.025, eave + Math.cos(b) * 2 + 0.035, (Math.sin(b) * w) / 2),
            ],
            [0, 1, 0],
          );
        }
  }
}
function stairs(o, a, b, w, y0, y1, d) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]),
    n = [(b[1] - a[1]) / len, -(b[0] - a[0]) / len],
    count = d === 0 ? 1 : Math.max(1, Math.ceil(Math.abs(y1 - y0) / [1, 1.6, 1.1, 0.27][d]));
  for (let i = 0; i < count; i++) {
    const t0 = i / count,
      t1 = (i + 1) / count,
      pa = a.map((v, k) => v + (b[k] - v) * t0),
      pb = a.map((v, k) => v + (b[k] - v) * t1),
      y = y0 + (y1 - y0) * t1,
      p = [
        [pa[0] - (n[0] * w) / 2, pa[1] - (n[1] * w) / 2],
        [pb[0] - (n[0] * w) / 2, pb[1] - (n[1] * w) / 2],
        [pb[0] + (n[0] * w) / 2, pb[1] + (n[1] * w) / 2],
        [pa[0] + (n[0] * w) / 2, pa[1] + (n[1] * w) / 2],
      ];
    prism(o, [p], Math.min(y0, y) - 0.18, y, 'stone');
  }
}
function lotus(o, t, d) {
  const [x, z] = t.center,
    central = Math.hypot(x, z) < 6,
    levels = plan.parts
      .filter(
        (p) =>
          p.properties.note === 'simplified shape' &&
          Math.hypot(...center(p.outline).map((v, i) => v - t.center[i])) < 4,
      )
      .sort((a, b) => +a.properties.min_height - +b.properties.min_height),
    base = central
      ? plan.parts.find((p) => p.properties.note === 'central sanctuary')
      : plan.parts.find(
          (p) =>
            p.properties['building:part'] === 'temple' &&
            +p.properties.height === 26 &&
            Math.hypot(...center(p.outline).map((v, i) => v - t.center[i])) < 4,
        );
  const p = d < 2 ? rect(base.outline) : base.outline,
    y0 = 23,
    y1 = +base.properties.height;
  prism(o, [p], y0, y1, 'stone');
  if (d)
    for (const [dx, dz] of [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ]) {
      const b = bounds(p),
        xx = x + (dx * (b[2] - b[0])) / 2,
        zz = z + (dz * (b[3] - b[1])) / 2,
        across = [-dz, dx],
        a = [xx - across[0] * 1.4, zz - across[1] * 1.4],
        b2 = [xx + across[0] * 1.4, zz + across[1] * 1.4];
      Q(
        o,
        'dark',
        [
          [a[0], y0 + 0.15, a[1]],
          [b2[0], y0 + 0.15, b2[1]],
          [b2[0], Math.min(y1 - 0.3, y0 + 5.3), b2[1]],
          [a[0], Math.min(y1 - 0.3, y0 + 5.3), a[1]],
        ],
        [dx, 0, dz],
      );
    }
  if (d === 0) {
    const bottom = central ? 35 : 26,
      top = central ? 63 : 44,
      r = central ? 7.8 : 6.8,
      rings = Array.from({ length: 4 }, (_, j) =>
        Array.from({ length: 8 }, (_, i) => {
          const a = (i * Math.PI) / 4,
            rr = r * [1, 0.76, 0.45, 0.18][j];
          return [x + Math.cos(a) * rr, bottom + ((top - bottom) * j) / 3, z + Math.sin(a) * rr];
        }),
      );
    for (let j = 1; j < rings.length; j++)
      for (let i = 0; i < 8; i++)
        Q(
          o,
          'stone',
          [rings[j - 1][i], rings[j - 1][(i + 1) % 8], rings[j][(i + 1) % 8], rings[j][i]],
          [rings[j][i][0] - x, 0, rings[j][i][2] - z],
        );
    return;
  }
  if (central) {
    const shoulder = plan.parts.find((p) => p.id === 'way/888649879');
    prism(o, [d === 1 ? rect(shoulder.outline) : shoulder.outline], 35, 39, 'stone');
  }
  for (const l of levels) {
    const p = d === 1 ? rect(l.outline) : l.outline,
      low = +l.properties.min_height,
      high = +l.properties.height;
    const pieces = d === 3 ? Math.ceil((high - low) / 2) : 1;
    for (let k = 0; k < pieces; k++) {
      const a = k / pieces,
        b = (k + 1) / pieces,
        shape = scale(p, 1 - 0.14 * a);
      prism(
        o,
        [shape],
        low + (high - low) * a,
        low + (high - low) * b,
        'stone',
        pieces > 1 ? 0.92 : 0.86,
      );
    }
    if (d === 3) {
      band(o, p, low + 0.1, 0.34, 0.18);
      band(o, scale(p, 0.88), high - 0.18, 0.34, 0.24);
      if (d === 3)
        for (const [a, b] of p
          .filter((_, i) => i % 2 === 0)
          .map((a) => {
            const i = p.indexOf(a);
            return [a, p[(i + 1) % p.length]];
          })) {
          const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
          if (len < 2) continue;
          const u = [(b[0] - a[0]) / len, (b[1] - a[1]) / len],
            n = [u[1], -u[0]],
            count = Math.max(1, Math.floor(len / 2.6));
          for (let j = 0; j < count; j++) {
            const xx = a[0] + (u[0] * len * (j + 0.5)) / count,
              zz = a[1] + (u[1] * len * (j + 0.5)) / count,
              y = low + (high - low) * 0.3;
            const shape = [
                [-0.55, 0],
                [0.55, 0],
                [0.55, 0.8],
                [0.3, 1.2],
                [0, 1.65],
                [-0.3, 1.2],
                [-0.55, 0.8],
              ],
              P = ([a, b]) => [xx + u[0] * a + n[0] * 0.08, y + b, zz + u[1] * a + n[1] * 0.08],
              middle = P([0, 0.6]);
            for (let k = 0; k < shape.length; k++)
              tri(
                o,
                'trim',
                [middle, P(shape[k]), P(shape[(k + 1) % shape.length])],
                [n[0], 0, n[1]],
              );
            Q(
              o,
              'dark',
              [P([-0.22, 0.08]), P([0.22, 0.08]), P([0.22, 0.7]), P([-0.22, 0.7])],
              [n[0], 0, n[1]],
            );
          }
        }
    }
  }
  const top = central ? 62 : 43;
  prism(o, [scale(levels.at(-1).outline, 0.85)], top, top + 1.1, 'stone', 0.45);
}
function library(o, p, d, index) {
  const floor = index < 2 ? 1.4 : index < 4 ? 4 : 11,
    poly = d < 2 ? rect(p.outline) : p.outline,
    bb = bounds(poly),
    [x, z] = center(poly),
    w = bb[2] - bb[0],
    dep = bb[3] - bb[1];
  if (d) prism(o, [poly], index < 2 ? -0.4 : floor - 1.1, floor, 'stone');
  if (d === 0) {
    prism(o, [poly], floor, floor + 6, 'stone');
    return;
  }
  shell(o, poly, floor, floor + 4.7, d, { open: d === 3, door: true, spacing: 5.5 });
  vault(
    o,
    [
      [x - w * 0.32, z - dep * 0.28],
      [x + w * 0.32, z - dep * 0.28],
      [x + w * 0.32, z + dep * 0.28],
      [x - w * 0.32, z + dep * 0.28],
    ],
    floor + 4.1,
    floor + 7.1,
    d === 2 ? 1 : d,
  );
  for (const sign of [-1, 1])
    stairs(
      o,
      [x + sign * (w / 2 + 3.8), z],
      [x + (sign * w) / 2, z],
      3.8,
      Math.max(0, floor - 2.6),
      floor,
      d,
    );
  if (d === 3)
    for (const y of [floor - 0.8, floor - 0.25, floor + 4.4]) band(o, poly, y, 0.35, 0.18);
}
function gate(o, p, d, index) {
  const poly = d < 2 ? rect(p.outline) : p.outline,
    bb = bounds(poly),
    [x, z] = center(poly),
    west = index === 0;
  if (d) prism(o, [poly], -0.5, 1.3, 'stone');
  if (!west) {
    const h = index === 1 ? 6.2 : 5.2;
    if (d === 0) {
      prism(o, [poly], 1.3, h, 'stone');
      return;
    }
    shell(o, poly, 1.3, h, d, { open: true, door: true, spacing: 5 });
    // Surviving fragmented gateway walls; no complete invented vanished wing roofs.
    for (let i = 0; i < poly.length; i += 2) {
      const a = poly[i],
        b = poly[(i + 1) % poly.length];
      beam(o, 'trim', [a[0], h, a[1]], [b[0], h, b[1]], 0.5, 0.38, C.trim);
    }
    return;
  }
  if (d === 0) {
    prism(o, [poly], 1.3, 10.5, 'stone');
    for (const dz of [-32, 0, 32]) B(o, 'stone', x, 10, z + dz, 10, dz === 0 ? 12 : 7, 10);
    return;
  }
  shell(o, poly, 1.3, 7.6, d, { open: true, door: true, spacing: 4.3 });
  vault(
    o,
    [
      [x - 4, z - (bb[3] - bb[1]) / 2],
      [x + 4, z - (bb[3] - bb[1]) / 2],
      [x + 4, z + (bb[3] - bb[1]) / 2],
      [x - 4, z + (bb[3] - bb[1]) / 2],
    ],
    7.3,
    10.5,
    d,
  );
  for (const [i, dz] of [-32, 0, 32].entries()) {
    const top = [17, 22, 16][i],
      size = 11;
    for (let j = 0; j < 3; j++)
      B(
        o,
        'stone',
        x,
        9 + (j * (top - 9)) / 3,
        z + dz,
        size - j * 2.0,
        (top - 9) / 3,
        size - j * 2.0,
      );
    if (d >= 2)
      for (let j = 0; j < 3; j++)
        band(
          o,
          [
            [x - size / 2 + j, z + dz - size / 2 + j],
            [x + size / 2 - j, z + dz - size / 2 + j],
            [x + size / 2 - j, z + dz + size / 2 - j],
            [x - size / 2 + j, z + dz + size / 2 - j],
          ],
          9 + (j * (top - 9)) / 3,
          0.5,
          0.3,
        );
  }
}
function build(o, _frame, d = 3) {
  // Only intrinsic temple platforms/courts, never a slab over the 82ha enclosure.
  for (const [i, g] of plan.galleries.entries()) {
    const rings = [g.outline, ...g.holes].map((p) => (d < 2 ? rect(p) : p)),
      floor = [4, 11, 23][i],
      previous = [-0.5, 4, 11][i];
    prism(o, rings, previous, floor, 'stone');
    for (const hole of rings.slice(1)) plate(o, [hole], floor - 0.12, 'stone');
    if (d === 3)
      for (const y of d === 3
        ? [previous + 0.4, previous + (floor - previous) * 0.45, floor - 0.3]
        : [floor - 0.3])
        band(o, rings[0], y, 0.5, 0.22);
  }
  const round = plan.parts.filter((p) => p.properties['roof:shape'] === 'round');
  for (const p of round) {
    // Library roof returns are authored with their full native parent libraries below.
    if (['way/886988158', 'way/886988159'].includes(p.id)) continue;
    const high = +p.properties.height,
      low = +(p.properties.min_height ?? 4);
    vault(o, d < 2 ? rect(p.outline) : p.outline, low, high, d);
  }
  if (d)
    for (const p of plan.derivedPavilions) {
      const rings = d === 1 ? [rect(p.rings[0])] : p.rings;
      if (d === 3)
        shell(o, rings[0], p.estimatedFloor, p.estimatedEave, d, {
          open: true,
          door: true,
          spacing: 5.5,
        });
      else prism(o, rings, p.estimatedFloor, p.estimatedEave, 'stone');
      prism(o, rings, p.estimatedEave, p.estimatedRidge, 'roof', 0.55);
      if (d === 3) band(o, rings[0], p.estimatedEave, 0.45, 0.25);
    }
  for (const t of plan.towerPositions) lotus(o, t, d);
  plan.libraries.forEach((p, i) => {
    library(o, p, d, i);
  });
  plan.gates.forEach((p, i) => {
    gate(o, p, d, i);
  });
  const crossing = plan.other.find((p) => p.id === 'way/888569856');
  prism(o, [d < 2 ? rect(crossing.outline) : crossing.outline], 0.5, 4, 'stone');
  const honor = plan.other.find((p) => p.id === 'way/642066967');
  prism(o, [d < 2 ? rect(honor.outline) : honor.outline], -0.5, 1.4, 'stone');
  for (const w of plan.walls)
    for (let i = 1; i < w.outline.length; i++) {
      const a = w.outline[i - 1],
        b = w.outline[i];
      beam(o, 'laterite', [a[0], 2, a[1]], [b[0], 2, b[1]], 1.1, 4.5, C.laterite);
      if (d >= 2) beam(o, 'trim', [a[0], 4.3, a[1]], [b[0], 4.3, b[1]], 1.4, 0.38, C.trim);
    }
  prism(o, [d < 2 ? rect(plan.causeway.outline) : plan.causeway.outline], -1.5, 0.6, 'laterite');
  for (const wall of d ? plan.innerApproachWalls : [])
    for (let i = 1; i < wall.outline.length; i++) {
      const a = wall.outline[i - 1],
        b = wall.outline[i];
      beam(o, 'stone', [a[0], 0.45, a[1]], [b[0], 0.45, b[1]], 0.75, 1.3, C.stone);
    }
  const [xw, zw] = center(plan.gates[0].outline),
    xh = bounds(honor.outline)[0];
  prism(
    o,
    [
      [
        [xw, zw - 4.6],
        [xh, zw - 4.6],
        [xh, zw + 4.6],
        [xw, zw + 4.6],
      ],
    ],
    -0.35,
    0.7,
    'stone',
  );
  if (d >= 2)
    for (const side of [-1, 1]) {
      const z = zw + side * 5;
      beam(o, 'trim', [xw + 10, 1.2, z], [xh - 5, 1.2, z], 0.27, 0.3, C.trim);
      for (let x = xw + 13; x < xh - 6; x += d === 3 ? 6 : 15)
        B(o, 'stone', x, 0.4, z, 0.4, 0.8, 0.4);
      // Original representative multi-headed naga silhouette, not copied sculptural anatomy.
      for (const x of [xw + 11, xh - 7])
        for (let j = -2; j <= 2; j++)
          beam(
            o,
            'trim',
            [x, 1, z],
            [x + Math.abs(j) * 0.25, 2.2 - Math.abs(j) * 0.12, z + j * 0.25],
            0.17,
            0.18,
            C.trim,
          );
    }
  stairs(
    o,
    [bounds(honor.outline)[2], zw],
    [bounds(plan.galleries[0].outline)[0], zw],
    10,
    1.4,
    4,
    d,
  );
  for (const sign of [-1, 1]) {
    stairs(o, [-42, sign * 18], [-29, sign * 18], 4.6, 11, 23, d);
    stairs(o, [23, sign * 50], [23, sign * 33], 4.2, 11, 23, d);
    stairs(o, [sign * 90, 0], [sign * 69, 0], 5, 4, 11, d);
    stairs(o, [-134, sign * 65], [-118, sign * 65], 6, 0.7, 4, d);
  }
}
export const angkorSkyline = (o, f) => build(o, f, 0);
export const angkorDistrict = (o, f) => build(o, f, 1);
export const angkorStreet = (o, f) => build(o, f, 2);
export const angkorWatModel = {
  id: 'angkor_wat',
  key: 'angkor_wat',
  recipe: 'structure-angkor-wat.mjs',
  cell: 'w6/w63',
  title: 'Angkor Wat',
  category: 'temple',
  progressLedger: 'qualla-002.PROGRESS.md',
  build,
  surfaces,
  brief:
    'Complete ancient Angkor Wat architectural ensemble: native three concentric galleries/open courts, five articulated lotus-bud towers, curved corbelled stone roofs, real gallery openings/colonnade and turned balusters, layered plinths/steep steps, six libraries and cruciform galleries, full outer laterite enclosure/four gateways, monumental west gopura and ancient causeway/naga rails. Exact native master plans with photographically estimated sections/repeats and simplified far levels; no natural moat/forest/site slab or later separate monastery/stupa.',
  camera: [-245, 138, 220],
  lookAt: [-12, 24, 0],
  portableGroundY: -0.25,
  mediumFiContext: { scale: 1.1, groundY: -0.25 },
  qaCameras: [
    {
      name: 'full-ancient-enclosure-four-gates-and-west-causeway',
      position: [-1310, 920, 1030],
      lookAt: [-130, 13, 0],
    },
    {
      name: 'five-lotus-towers-open-upper-courts-and-vaulted-galleries',
      position: [95, 85, 112],
      lookAt: [0, 33, 0],
    },
    {
      name: 'western-colonnade-libraries-and-cruciform-galleries',
      position: [-210, 47, 105],
      lookAt: [-80, 12, 0],
    },
    {
      name: 'western-gopura-ancient-causeway-and-outer-library',
      position: [-680, 72, 195],
      lookAt: [-470, 7, -2],
    },
  ],
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis:
    'Fixed west bank approach outside the exact native ancient causeway before terrain acquisition. Bounded intrinsic architectural plinths/courts/steps and thin footings only; no fitted or flattened entire enclosure. Raw relief retained separately; vegetation/building returns make precise host contact unverified.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-angkor-wat.mjs',
    level: 'skyline',
    export: 'angkorSkyline',
    errorMeters: 10,
    surfaces,
    authoredLevels: {
      district: { export: 'angkorDistrict', errorMeters: 4, surfaces },
      street: { export: 'angkorStreet', errorMeters: 1.4, surfaces },
    },
  },
  limitations: [
    plan.geometryBasis,
    plan.derivedPavilionBasis,
    'All ancient structures in scope are retained, including six mapped libraries, cruciform galleries, ancient west causeway, four outer gateways and full enclosure wall polylines. The present conservation state of concealed N/S/E gateway wings is conservatively represented by broken walls/lintels, not complete invented roofs. Separate later Chedei Chey Non stupa, modern monasteries/floating bridge/access facilities and neighboring temples are excluded.',
    'Mapped native roof/tower heights are simplified estimates. Gallery platform/court levels4/11/23m, six library floor sections, vaulted profiles, tier taper/lotus finials, plinth/door/pediment details, stone/baluster/column counts, naga anatomy and exact stair landings remain photographic medium-fi estimates. Native master footprints/courtyard topology are retained; distant levels simplify small projections and roof sections. Individual ancient sculpture/epic relief figures are original representative motifs, not an exact census or photograph texture.',
    'Nine exact Balon Greyjoy December2019own-work CC0 originals inspected after the Qualla-first scan. The ambiguous-source1866record, blank postcard backs, unrelated neighboring temples, regional map alias and all other-licensed imagery are unused. No visitor/sign/modern mural or landscape imagery is reproduced.',
    'Raw source terrain is preserved separately without flattening or fitting; coarse building/vegetation returns vary by about24m across the central native footprint and do not establish surveyed temple ground. Review stage is flatY-.25 for legible architecture; actual native geographic alignment is approximate preview, not verified precise thresholds/ground contact or a full enclosure terrain replacement. Cultural plinth/court/causeway surfaces stay bounded to intrinsic architecture, with no82ha ground slab or natural moat/forest mesh.',
  ],
};
