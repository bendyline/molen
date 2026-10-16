/** Warwick: polygonal Guy tower,lobed Caesar tower,gate/barbican and river ranges. */
import './install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import earcut from 'earcut';
import { normalFor } from './authored-structure-mesh.mjs';

const root = '../../../content/worldgen/source/places/gc/gcq/n0290_warwick_castle/';
const read = (n) => JSON.parse(readFileSync(new URL(root + n, import.meta.url)));
const frame = read('map-frame.json'),
  refs = read('reference-metadata.json'),
  c = frame.controls;
export const warwickPalette = {
  stone: '#d2c6ac',
  wall: '#e1d3b7',
  trim: '#eadecb',
  roof: '#697177',
  wood: '#ba9875',
  recess: '#4d6178',
  paving: '#aaa59a',
  grass: '#8aa065',
  clock: '#45617c',
  gold: '#e7b52a',
};
const colors = Object.fromEntries(
  Object.entries(warwickPalette).map(([k, h]) => [
    k,
    h
      .slice(1)
      .match(/../g)
      .map((v) => {
        const s = parseInt(v, 16) / 255;
        return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
      }),
  ]),
);
function face(o, p, col = 'wall', slot = 'sandstone', target) {
  if (target && normalFor(...p.slice(0, 3)).reduce((s, v, i) => s + v * target[i], 0) < 0)
    p = [...p].reverse();
  for (let i = 1; i < p.length - 1; i++) {
    const t = [p[0], p[i], p[i + 1]],
      n = normalFor(...t);
    if (Math.hypot(...n) < 0.5) continue;
    const a = Math.abs(n[1]) > 0.7 ? 1 : Math.abs(n[0]) > Math.abs(n[2]) ? 0 : 2;
    o.addTriangle(
      slot,
      'palette:#ffffff',
      t,
      n,
      t.map((v) => (a === 1 ? [v[0], v[2]] : a === 0 ? [v[2], v[1]] : [v[0], v[1]])),
      colors[col],
    );
  }
}
function box(o, x, y, z, w, h, depth, col = 'stone', slot = 'sandstone') {
  const a = x - w / 2,
    b = x + w / 2,
    u = z - depth / 2,
    v = z + depth / 2,
    t = y + h;
  for (const [p, n] of [
    [
      [
        [a, y, v],
        [b, y, v],
        [b, t, v],
        [a, t, v],
      ],
      [0, 0, 1],
    ],
    [
      [
        [b, y, u],
        [a, y, u],
        [a, t, u],
        [b, t, u],
      ],
      [0, 0, -1],
    ],
    [
      [
        [a, y, u],
        [a, y, v],
        [a, t, v],
        [a, t, u],
      ],
      [-1, 0, 0],
    ],
    [
      [
        [b, y, v],
        [b, y, u],
        [b, t, u],
        [b, t, v],
      ],
      [1, 0, 0],
    ],
    [
      [
        [a, t, u],
        [b, t, u],
        [b, t, v],
        [a, t, v],
      ],
      [0, 1, 0],
    ],
  ])
    face(o, p, col, slot, n);
}
function local(o, center, y = 0, a = 0) {
  const rot = ([x, h, z]) => [
    Math.cos(a) * x + Math.sin(a) * z,
    h,
    -Math.sin(a) * x + Math.cos(a) * z,
  ];
  return Object.fromEntries(
    ['addQuad', 'addTriangle', 'addConvexPolygon'].map((k) => [
      k,
      (s, r, p, n, uv, col) =>
        o[k](
          s,
          r,
          p.map((v) => {
            const q = rot(v);
            return [q[0] + center[0], q[1] + y, q[2] + center[1]];
          }),
          rot(n),
          uv,
          col,
        ),
    ]),
  );
}
function lineFrame(o, a, b, y = 0) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1];
  return {
    length: Math.hypot(dx, dz),
    q: local(o, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], y, -Math.atan2(dz, dx)),
  };
}
function polygon(o, loop, y, col, slot = 'sandstone') {
  const ix = earcut(loop.flat());
  for (let i = 0; i < ix.length; i += 3)
    face(
      o,
      ix.slice(i, i + 3).map((k) => [loop[k][0], y, loop[k][1]]),
      col,
      slot,
      [0, 1, 0],
    );
}
function rings(o, center, levels, n, col = 'stone', slot = 'sandstone', phase = 0, cap = true) {
  const circle = ([y, r]) =>
    Array.from({ length: n }, (_, i) => {
      const a = phase + (i * Math.PI * 2) / n;
      return [center[0] + Math.cos(a) * r, y, center[1] + Math.sin(a) * r];
    });
  for (let j = 1; j < levels.length; j++) {
    const a = circle(levels[j - 1]),
      b = circle(levels[j]);
    for (let i = 0; i < n; i++) {
      const k = (i + 1) % n,
        p = [a[i], a[k], b[k], b[i]],
        target = [(a[i][0] + a[k][0]) / 2 - center[0], 0, (a[i][2] + a[k][2]) / 2 - center[1]];
      face(o, p, col, slot, target);
    }
  }
  if (cap) {
    const r = circle(levels.at(-1));
    polygon(
      o,
      r.map((p) => [p[0], p[2]]),
      r[0][1],
      col,
      slot,
    );
  }
}
/** A real opening: pier masses, spandrels and soffits leave the arch empty. */
function arcade(
  o,
  length,
  depth,
  bottom,
  top,
  bays,
  span,
  spring,
  rise,
  d,
  col = 'stone',
  slot = 'sandstone',
  pointed = false,
) {
  const pitch = length / bays,
    pier = pitch - span;
  box(o, -length / 2 + pier / 4, bottom, 0, pier / 2, top - bottom, depth, col, slot);
  box(o, length / 2 - pier / 4, bottom, 0, pier / 2, top - bottom, depth, col, slot);
  for (let i = 1; i < bays; i++)
    box(o, -length / 2 + i * pitch, bottom, 0, pier, top - bottom, depth, col, slot);
  for (let j = 0; j < bays; j++) {
    const mid = -length / 2 + (j + 0.5) * pitch,
      steps = d >= 2 ? 6 : 4;
    const curve = Array.from({ length: steps + 1 }, (_, i) => {
      const t = i / steps;
      const half = span / 2,
        radius = (half * half + rise * rise) / (2 * half),
        offset = Math.min(t, 1 - t) * span - radius;
      return [
        mid + (t - 0.5) * span,
        spring +
          (pointed
            ? Math.sqrt(Math.max(0, radius * radius - offset * offset))
            : rise * Math.sin(Math.PI * t)),
      ];
    });
    for (let i = 0; i < steps; i++) {
      const a = curve[i],
        b = curve[i + 1];
      for (const s of [-1, 1])
        face(
          o,
          [
            [a[0], a[1], (s * depth) / 2],
            [b[0], b[1], (s * depth) / 2],
            [b[0], top, (s * depth) / 2],
            [a[0], top, (s * depth) / 2],
          ],
          col,
          slot,
          [0, 0, s],
        );
      face(
        o,
        [
          [a[0], a[1], -depth / 2],
          [b[0], b[1], -depth / 2],
          [b[0], b[1], depth / 2],
          [a[0], a[1], depth / 2],
        ],
        col,
        slot,
        [0, -1, 0],
      );
    }
  }
  face(
    o,
    [
      [-length / 2, top, -depth / 2],
      [length / 2, top, -depth / 2],
      [length / 2, top, depth / 2],
      [-length / 2, top, depth / 2],
    ],
    col,
    slot,
    [0, 1, 0],
  );
}
function pane(o, x, y, z, w, h, d, pointed = false, outward) {
  const p = pointed
    ? [
        [x - w / 2, y, z],
        [x + w / 2, y, z],
        [x + w / 2, y + h * 0.65, z],
        [x, y + h, z],
        [x - w / 2, y + h * 0.65, z],
      ]
    : [
        [x - w / 2, y, z],
        [x + w / 2, y, z],
        [x + w / 2, y + h, z],
        [x - w / 2, y + h, z],
      ];
  face(o, p, 'recess', 'glass', [0, 0, outward ?? (z < 0 ? -1 : 1)]);
  if (d >= 3) {
    box(o, x, y - 0.3, z, w + 0.6, 0.3, 0.3, 'trim');
    if (!pointed) box(o, x, y + h, z, w + 0.6, 0.3, 0.3, 'trim');
    box(o, x, y, z, 0.3, h, 0.3, 'trim');
  }
}

function hip(o, x, y, z, length, depth, rise, col = 'roof', slot = 'tile', pyramid = false) {
  const a = x - length / 2,
    b = x + length / 2,
    u = z - depth / 2,
    v = z + depth / 2;
  const inset = pyramid ? length / 2 : Math.min(depth / 2, length * 0.28),
    r0 = [a + inset, y + rise, z],
    r1 = [b - inset, y + rise, z];
  for (const p of [
    [[a, y, u], [b, y, u], r1, r0],
    [[b, y, v], [a, y, v], r0, r1],
    [[a, y, v], [a, y, u], r0],
    [[b, y, u], [b, y, v], r1],
  ])
    face(o, p, col, slot, [0, 1, 0]);
}
function winding(loop) {
  return Math.sign(
    loop.reduce((s, p, i) => {
      const q = loop[(i + 1) % loop.length];
      return s + p[0] * q[1] - q[0] * p[1];
    }, 0),
  );
}
// Remove only small plan deviations at far levels; the master retains all mapped vertices.
function simple(loop, tolerance) {
  const out = loop.map((p) => [...p]);
  for (let pass = 0; pass < 4; pass++) {
    let removed = false;
    for (let i = out.length - 1; i >= 0 && out.length > 4; i--) {
      const p = out[i],
        a = out[(i + out.length - 1) % out.length],
        b = out[(i + 1) % out.length],
        dx = b[0] - a[0],
        dz = b[1] - a[1],
        l2 = dx * dx + dz * dz;
      const t = l2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / l2)) : 0;
      if (Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dz) < tolerance) {
        out.splice(i, 1);
        removed = true;
      }
    }
    if (!removed) break;
  }
  return out;
}
function annulus(o, a, b, ay, by, col, slot) {
  const vertices = [...a.map((p) => [p[0], ay, p[1]]), ...b.map((p) => [p[0], by, p[1]])];
  const ix = earcut(
    vertices.flatMap((p) => [p[0], p[2]]),
    [a.length],
  );
  for (let i = 0; i < ix.length; i += 3)
    face(
      o,
      ix.slice(i, i + 3).map((k) => vertices[k]),
      col,
      slot,
      [0, 1, 0],
    );
}
const outer = frame.geometry.outline.slice(0, -1),
  court = frame.geometry.holes[0].slice(0, -1);
const flatMeans = read('surface-means.json');
function height(p) {
  return p[1] > 23 && p[0] > -55 ? 28 : p[0] > 51 ? 22 : 21;
}
function walls(o, loop, inner, d) {
  const sign = winding(loop) * (inner ? -1 : 1);
  for (let i = 0; i < loop.length; i++) {
    const a = loop[i],
      b = loop[(i + 1) % loop.length],
      dx = b[0] - a[0],
      dz = b[1] - a[1],
      length = Math.hypot(dx, dz),
      top = (height(a) + height(b)) / 2,
      { q } = lineFrame(o, a, b);
    if (length < 0.05) continue;
    const normal = [(sign * dz) / length, 0, (-sign * dx) / length],
      low = inner ? 11 : (a[1] + b[1]) / 2 > 25 ? 0 : 11;
    function panel(p, r, y0, y1) {
      if (y1 > y0)
        face(
          o,
          [
            [p[0], y0, p[1]],
            [r[0], y0, r[1]],
            [r[0], y1, r[1]],
            [p[0], y1, p[1]],
          ],
          'wall',
          'sandstone',
          normal,
        );
    }
    if (a[0] > 51 && b[0] > 51 && Math.min(a[1], b[1]) < 8.8 && Math.max(a[1], b[1]) > 4.4) {
      const cuts = [
          0,
          1,
          ...[4.4, 8.8].map((z) => (z - a[1]) / dz).filter((t) => t > 0 && t < 1),
        ].sort((a, b) => a - b),
        point = (t) => [a[0] + t * dx, a[1] + t * dz];
      for (let j = 1; j < cuts.length; j++) {
        const p = point(cuts[j - 1]),
          r = point(cuts[j]),
          z = (p[1] + r[1]) / 2;
        if (z > 4.4 && z < 8.8) {
          panel(p, r, low, 11);
          panel(p, r, 18.8, top);
        } else panel(p, r, low, top);
      }
    } else panel(a, b, low, top);
    if (length > 6 && d > 0) {
      box(q, 0, top - 0.8, 0, length, 0.8, inner ? 0.7 : 1.2, 'stone', 'sandstone');
      const count = d === 0 ? Math.floor(length / 10) : Math.floor(length / 4.8);
      for (let j = 0; j < count; j++)
        box(
          q,
          ((j + 0.5) * length) / count - length / 2,
          top,
          0,
          d === 0 ? 3.8 : 2.4,
          1.5,
          1.2,
          'stone',
          'sandstone',
        );
    }
    if (d < 1 || length < 6 || top < 26) continue;
    const count = Math.max(1, Math.floor(length / (d === 1 ? 13 : 7))),
      z = -sign * 0.1;
    for (let j = 0; j < count; j++)
      for (const y of d === 1 ? [18] : inner ? [13, 21] : [6.5, 14, 21]) {
        const x = ((j + 0.5) * length) / count - length / 2,
          w = d >= 2 ? 2.2 : 1.6;
        pane(q, x, y, z, w, 3.9, 0, true, -sign);
        if (d >= 2) {
          box(q, x, y - 0.3, z, w + 0.7, 0.35, 0.45, 'trim', 'sandstone');
          box(q, x, y, z, 0.35, 2.9, 0.35, 'trim', 'sandstone');
        }
        if (d >= 3)
          for (const s of [-1, 1])
            box(q, x + s * (w / 2 + 0.25), y, z, 0.4, 3.2, 0.4, 'trim', 'sandstone');
      }
    if (d >= 2 && !inner && length > 8)
      for (let j = 0; j < count; j++)
        box(q, ((j + 0.5) * length) / count - length / 2, 1, z, 1.3, 11, 1.5, 'stone', 'sandstone');
  }
}
function cap(o, a, b) {
  const v = [...a, ...b],
    ix = earcut(v.flat(), [a.length]);
  for (let i = 0; i < ix.length; i += 3)
    face(
      o,
      ix.slice(i, i + 3).map((j) => [v[j][0], height(v[j]) - 0.8, v[j][1]]),
      'roof',
      'foliage',
      [0, 1, 0],
    );
}
function hull(points) {
  const p = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  const a = [],
    b = [];
  for (const q of p) {
    while (a.length > 1 && cross(a.at(-2), a.at(-1), q) <= 0) a.pop();
    a.push(q);
  }
  for (const q of p.toReversed()) {
    while (b.length > 1 && cross(b.at(-2), b.at(-1), q) <= 0) b.pop();
    b.push(q);
  }
  return a.slice(0, -1).concat(b.slice(0, -1));
}
function terrain(o, d) {
  const p = simple(hull(outer), d === 0 ? 2 : 1),
    base = p.map((v) => v.map((n) => n * 1.07));
  // River-facing bank is a retaining stone mass;other sides remain a turf proxy.
  const bank = {
    addTriangle: (slot, ref, points, normal, uv, color) => {
      const river = points.reduce((sum, p) => sum + p[2], 0) / 3 > 25;
      o.addTriangle(
        river ? 'sandstone' : slot,
        ref,
        points,
        normal,
        uv,
        river ? colors.stone : color,
      );
    },
  };
  annulus(bank, base, p, 0, 11, 'grass', 'foliage');
  polygon(o, p, 11, 'grass', 'foliage');
  const m = c.motte,
    n = d < 2 ? 8 : 12;
  const ellipse = (y, rx, rz) =>
    Array.from({ length: n }, (_, i) => {
      const a = (i * Math.PI * 2) / n;
      return [m.center[0] + Math.cos(a) * rx, y, m.center[1] + Math.sin(a) * rz];
    });
  const stages = [ellipse(11, m.baseX, m.baseZ), ellipse(20, 15, 18), ellipse(27, m.topX, m.topZ)];
  for (let j = 1; j < stages.length; j++)
    for (let i = 0; i < n; i++) {
      const k = (i + 1) % n;
      face(
        o,
        [stages[j - 1][i], stages[j - 1][k], stages[j][k], stages[j][i]],
        'grass',
        'foliage',
        [stages[j - 1][i][0] - m.center[0], 1, stages[j - 1][i][2] - m.center[1]],
      );
    }
  polygon(
    o,
    stages[2].map((p) => [p[0], p[2]]),
    27,
    'grass',
    'foliage',
  );
  const gate = local(o, [-60, 0], 0, -Math.PI / 2);
  arcade(gate, 9, 1.5, 27, 33, 1, 3.4, 29.6, 1.8, d, 'stone', 'sandstone', true);
  for (const z of [-5, 5])
    rings(
      o,
      [-60, z],
      [
        [27, 1.6],
        [34, 1.6],
        [35, 1.9],
      ],
      6,
      'stone',
      'sandstone',
    );
  // Two stepped rampart runs climb the mount; blocks merge by material.
  if (d > 0) {
    const steps = d < 2 ? 4 : 8;
    for (const s of [-1, 1])
      for (let i = 0; i < steps; i++) {
        const x = -44 - i * 2.2,
          z = s * (17 - i * 0.65),
          y = 21 + i * 1.35;
        box(o, x, y, z, 2.4, 3, 1.2, 'stone', 'sandstone');
      }
  }
}
function crowned(o, center, radius, base, top, n, d) {
  const q = local(o, center);
  if (d === 0 && radius < 5) {
    rings(
      q,
      [0, 0],
      [
        [base, radius],
        [top, radius],
      ],
      6,
      'stone',
      'sandstone',
    );
    return;
  }
  rings(
    q,
    [0, 0],
    [
      [base, radius],
      [top - 4, radius],
      [top - 2.5, radius + 1],
      [top - 1.5, radius + 1],
    ],
    n,
    'stone',
    'sandstone',
  );
  const count = d === 0 ? (radius > 5 ? 4 : 0) : d === 1 ? Math.min(n, 5) : n;
  for (let i = 0; i < count; i++) {
    const a = (i * Math.PI * 2) / count,
      v = local(
        q,
        [Math.cos(a) * (radius + 0.55), Math.sin(a) * (radius + 0.55)],
        0,
        Math.PI / 2 - a,
      );
    box(v, 0, top - 1.5, 0, d === 0 ? 2.7 : 1.65, 1.5, 1.1, 'stone', 'sandstone');
  }
  if (d < 1) return;
  for (let i = 0; i < n; i++) {
    const a = ((i + 0.5) * Math.PI * 2) / n,
      v = local(q, [0, 0], 0, Math.PI / 2 - a),
      r = radius * Math.cos(Math.PI / n) + 0.08;
    for (const y of d === 1
      ? [base + 10]
      : [base + 3, base + 10, base + 18].filter((y) => y < top - 4))
      pane(v, 0, y, -r, 0.7, 1.9, 0, true);
    if (d >= 2) box(v, 0, top - 4.6, -r - 0.35, 0.6, 1.4, 0.9, 'stone', 'sandstone');
  }
}
function caesar(o, d) {
  const t = c.caesar,
    n = [12, 18, 24, 36][d],
    q = local(o, t.center);
  const lobes = Array.from({ length: 3 }, (_, i) => {
    const a = (i * Math.PI * 2) / 3 + 0.3;
    return [t.lobeOffset * Math.cos(a), t.lobeOffset * Math.sin(a)];
  });
  const loop = Array.from({ length: n }, (_, i) => {
    const a = (i * Math.PI * 2) / n,
      dx = Math.cos(a),
      dz = Math.sin(a),
      rs = lobes.map(([x, z]) => {
        const dot = x * dx + z * dz,
          perp = x * dz - z * dx;
        return dot + Math.sqrt(Math.max(0, t.lobeRadius * t.lobeRadius - perp * perp));
      }),
      r = Math.max(...rs);
    return [r * dx, r * dz];
  });
  const levels =
      d === 0
        ? [
            [0, 1.16],
            [28, 1],
            [30, 1.17],
            [38.5, 0.92],
          ]
        : [
            [0, 1.16],
            [9, 1],
            [28, 1],
            [30, 1.17],
            [33, 1.17],
            [33, 0.92],
            [38.5, 0.92],
          ],
    points = ([y, s]) => loop.map((p) => [p[0] * s, y, p[1] * s]);
  for (let j = 1; j < levels.length; j++) {
    const a = points(levels[j - 1]),
      b = points(levels[j]);
    for (let i = 0; i < n; i++) {
      const k = (i + 1) % n;
      face(q, [a[i], a[k], b[k], b[i]], 'stone', 'sandstone', [a[i][0], 0, a[i][2]]);
    }
  }
  polygon(
    q,
    loop.map((p) => p.map((v) => v * 0.92)),
    38.5,
    'stone',
    'sandstone',
  );
  const count = d === 0 ? 6 : d === 1 ? 9 : 18;
  for (let i = 0; i < count; i++) {
    const index = Math.floor((i * n) / count),
      p = loop[index],
      a = Math.atan2(p[1], p[0]),
      v = local(q, [p[0] * 0.92, p[1] * 0.92], 0, Math.PI / 2 - a);
    box(v, 0, 38.5, 0, d === 0 ? 2 : 1.1, 1.5, 0.9, 'stone', 'sandstone');
  }
  if (d >= 2)
    for (let i = 0; i < 12; i++) {
      const p = loop[Math.floor((i * n) / 12)],
        a = Math.atan2(p[1], p[0]),
        v = local(q, [p[0] * 1.14, p[1] * 1.14], 0, Math.PI / 2 - a);
      box(v, 0, 31.4, 0, 1, 1.6, 0.8, 'stone', 'sandstone');
    }
  if (d >= 1)
    for (let i = 0; i < n; i += d === 1 ? 3 : 2) {
      const p = loop[i],
        a = Math.atan2(p[1], p[0]),
        v = local(q, [0, 0], 0, Math.PI / 2 - a),
        r = Math.hypot(...p) + 0.06;
      for (const y of d === 1 ? [20, 35] : [10, 19, 26, 35])
        pane(v, 0, y, y === 35 ? -r * 0.92 : -r, 0.75, 2.3, 0, true);
      if (d >= 2) box(v, 0, 27.7, -r * 1.13, 0.7, 1.8, 0.85, 'stone', 'sandstone');
    }
}
function gatehouse(o, d) {
  const g = c.gate,
    q = local(o, g.center, 0, -Math.PI / 2);
  arcade(q, g.width, g.depth, 11, g.top, 1, 4.2, 15.8, 2.4, d, 'stone', 'sandstone', true);
  for (const p of g.turrets) crowned(o, p, g.turretRadius, 11, 35, d < 2 ? 6 : 8, d);
  if (d >= 1) box(q, 0, 18.5, g.depth / 2 + 0.1, 3.7, 1.6, 0.5, 'wood', 'wood');
  // Clock faces the courtyard; diamond/color survive district,lettering is omitted.
  if (d >= 1) {
    const y = 29,
      z = g.depth / 2 + 0.12,
      r = 2.1;
    face(
      q,
      [
        [0, y - r, z],
        [r, y, z],
        [0, y + r, z],
        [-r, y, z],
      ],
      'clock',
      'foliage',
      [0, 0, 1],
    );
    if (d >= 2) {
      box(q, 0, y - 0.15, z + 0.06, 0.32, 1.55, 0.12, 'gold', 'foliage');
      box(q, -0.62, y + 0.66, z + 0.07, 1.4, 0.32, 0.12, 'gold', 'foliage');
      for (const h of [20, 25]) pane(q, 0, h, z, 1.3, 2, 0, false, 1);
    }
  }
  const b = c.barbican,
    front = local(o, [b.front, b.center[1]], 0, -Math.PI / 2);
  arcade(front, b.depth, 1.4, 11, b.top, 1, 4.2, 15.8, 2.4, d, 'stone', 'sandstone', true);
  for (const z of [2.2, 10.8]) crowned(o, [77, z], 1.4, 11, 23, 6, d);
  for (const s of [-1, 1]) box(o, 70, 11, 6.6 + s * 4.5, 18, 10, 1.2, 'stone', 'sandstone');
  const bridge = c.bridge;
  if (d === 0) {
    box(o, 91, 10.3, 6.6, 24, 0.7, 4.7, 'stone', 'sandstone');
    for (const x of [82, 100]) box(o, x, 0, 6.6, 2.5, 10.3, 3.3, 'stone', 'sandstone');
  } else {
    const q = local(o, bridge.center);
    arcade(q, 24, 4.7, 0, 10.3, 3, 6.4, 6.6, 2.5, d, 'stone', 'sandstone');
    box(q, 0, 10.3, 0, 24, 0.7, 4.7, 'stone', 'sandstone');
    for (const z of [-2.35, 2.35]) box(q, 0, 11, z, 24, 0.8, 0.5, 'stone', 'sandstone');
  }
}
function domestic(o, d) {
  // Low slate pitches sit behind the castellated domestic parapets.
  for (const [x, z, w, depth] of [
    [-40, 44, 27, 11],
    [-5, 38, 49, 24],
    [38, 44, 30, 11],
  ])
    hip(o, x, 26, z, w, depth, 3, 'roof', 'slate');
  const h = c.domestic.clockBayCenter;
  box(o, h[0], 26, h[1], 6, c.domestic.clockBayTop - 26, 5, 'wall', 'sandstone');
  if (d >= 1) {
    for (const p of [
      [-24, 27],
      [-9, 24],
      [17, 33],
      [31, 39],
    ]) {
      const q = local(o, p);
      box(q, 0, 11, 0, 5, 17, 2.2, 'wall', 'sandstone');
      for (const y of [13.2, 21.5]) pane(q, 0, y, -1.15, 3, 4.2, 0, true);
      if (d >= 2) {
        box(q, 0, 19.3, -1.15, 5.2, 0.45, 0.5, 'trim', 'sandstone');
        box(q, 0, 11, -1.17, 0.4, 15.3, 0.35, 'trim', 'sandstone');
      }
    }
  }
  if (d >= 2) {
    for (const x of [-45, -24, 3, 22, 43]) {
      box(o, x, 28, 43, 1.7, 4, 1.5, 'stone', 'sandstone');
      box(o, x, 32, 43, 2, 0.4, 1.8, 'trim', 'sandstone');
    }
    for (const x of [-18, -14]) box(o, x, 33, 27.5, 1, 3, 1.2, 'stone', 'sandstone');
  }
}
function build(o, d) {
  terrain(o, d);
  const a = d < 2 ? simple(outer, d === 0 ? 1.8 : 0.5) : outer,
    b = d < 2 ? simple(court, d === 0 ? 1.6 : 0.4) : court;
  walls(o, a, false, d);
  walls(o, b, true, d);
  cap(o, a, b);
  crowned(o, c.guy.center, c.guy.radius, 11, 40, 12, d);
  caesar(o, d);
  for (const t of c.minorTowers) crowned(o, t.center, t.radius, t.base, t.top, d < 2 ? 6 : 8, d);
  gatehouse(o, d);
  domestic(o, d);
}
export const buildWarwickRuntime = (o, level = 'closeup') =>
  build(o, { skyline: 0, district: 1, street: 2, closeup: 3 }[level] ?? 3);
export const buildWarwickSkyline = (o) =>
  build(
    Object.fromEntries(
      ['addQuad', 'addTriangle', 'addConvexPolygon'].map((k) => [
        k,
        (s, r, p, n, uv, col) =>
          o[k](
            'silhouette',
            r,
            p,
            n,
            uv,
            col.map((v, i) => v * (flatMeans[s]?.[i] ?? 1)),
          ),
      ]),
    ),
    0,
  );
export const warwickStudy = {
  id: 'N0290',
  key: 'warwick_castle',
  title: 'Warwick Castle',
  category: 'castle',
  wikidataId: 'Q941276',
  mapFrame: 'map-frame.json',
  fidelityTarget: 'medium-fi',
  build: (o) => buildWarwickRuntime(o),
  brief:
    'Buff sandstone castle with open courtyard,many-sided Guy tower,lobed two-stage Caesar tower,clocked twin-turret gatehouse and projecting barbican,castellated river ranges with low slate roofs,octagonal western towers and a stepped grassy motte.',
  appearance: {
    standard: 'docs-src/guide/medium-fi.md',
    paletteSrgb: warwickPalette,
    colorEncoding: 'sRGB decoded to linear COLOR_0',
    flatSurfaceMeansLinear: flatMeans,
    materialBudget: 5,
    identityFeatures: [
      'Polygonal Guy tower and lobed two-stage Caesar tower',
      'Twin-turret clock gatehouse and projecting barbican',
      'Open court,castellated river ranges and stepped motte',
    ],
  },
  sourceFacts: {
    mapIdentity: 'relation/553839 exactQ941276',
    mappedEnvelopeMeters: [158.229, 102.573],
    operatorLocalTowerHeightsMeters: { Guy: 29, Caesar: 40 },
    measuredCommonDatumAvailable: false,
    maximumModelY: 40,
  },
  reconstruction: frame.reconstruction,
  scaleBasis:
    'Cached exact curtain/domestic/court rings. Operator29/40m tower heights use different bases;all common datum,upper form and attachment controls are estimates.',
  refs: refs.references.map((r) => r.url),
  sourceDocuments: ['map-frame.json', 'reference-metadata.json', 'surface-means.json'],
  nativeAxes: frame.nativeAxes,
  sourceNotice:
    'Mapped curtain/domestic/court rings reproduce attributed OpenStreetMap data underODbL-1.0. Other geometry is original approximate authoring. No downloaded mesh,research photograph or unique texture is embedded;three existing shared material graphs supply reusable surfaces.',
  sourceLicense:
    'Original geometry under repository license. Mapped rings © OpenStreetMap contributors,ODbL-1.0. Photographs are private external research only,not redistributed or embedded.',
  dataAttribution:
    '© OpenStreetMap contributors;Warwick Castle operator;Historic England;primary photographers Gernot Keller,DeFacto and Haydn Curtis.',
  geographic: () => ({
    status: 'research-only',
    replaceFootprint: false,
    groundModelY: 0,
    reviewStatus: 'Inactive geographic draft;review pending',
    notes:
      'Undirected cached axis. Signed gate direction,relative tower/base datum,motte/approach fit and real terrain pending.',
  }),
  geographicNote:
    'Original approximate exterior on mapped castle/court rings;inactive until real-site review.',
  limitations: refs.limitations,
  importReason:
    'Preserve the two distinct main tower forms,clock gate/barbican and open court within medium-fi budgets.',
  mediumFiContext: { scale: '2', neighborStyle: 'molen.worldgen.catalog.english_terrace' },
  camera: { position: [170, 100, 135], lookAt: [0, 20, 0], fov: 43 },
  qaCameras: [
    { name: 'main-towers-gate-and-barbican', position: [184, 55, -35], lookAt: [44, 25, 5] },
    { name: 'caesar-lobes-and-upper-stage', position: [104, 31, 84], lookAt: [61, 25, 43] },
    { name: 'open-court-and-domestic-roofs', position: [-12, 158, 127], lookAt: [0, 18, 0] },
    { name: 'courtyard-clock-and-gate-opening', position: [5, 24, 6.6], lookAt: [56, 24, 6.6] },
    { name: 'river-domestic-window-bays', position: [-30, 35, 102], lookAt: [-5, 20, 39] },
    { name: 'motte-gate-and-stepped-ramparts', position: [-26, 42, -4], lookAt: [-61, 26, 0] },
  ],
};
