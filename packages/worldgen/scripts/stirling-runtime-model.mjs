/** Reviewed Stirling derivative; unchanged original recipe preserves its detailed master. */
import './install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import earcut from 'earcut';
import { loft, normalFor, radialRing } from './authored-structure-mesh.mjs';
import { box } from './structure-mesh.mjs';

const frame = JSON.parse(
  readFileSync(
    new URL(
      '../../../content/worldgen/source/places/gc/gcv/n0262_stirling_castle/map-frame.json',
      import.meta.url,
    ),
  ),
);
const part = (id) => frame.parts.find((p) => p.id.endsWith(`/${id}`));
export const stirlingPalette = {
  stone: '#bdbaad',
  trim: '#dedbcf',
  ochre: '#f0dba0',
  roof: '#616875',
  pane: '#4d6178',
  paving: '#b8b0a0',
  lawn: '#91a86e',
};
const color = Object.fromEntries(
  Object.entries(stirlingPalette).map(([k, h]) => [
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
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const area = (p) =>
  p.reduce((v, a, i) => {
    const b = p[(i + 1) % p.length];
    return v + a[0] * b[1] - b[0] * a[1];
  }, 0) / 2;
function ring(p, positive = false) {
  const r = p.slice();
  if (r[0][0] === r.at(-1)[0] && r[0][1] === r.at(-1)[1]) r.pop();
  if (area(r) > 0 !== positive) r.reverse();
  return r;
}
function local(o, x, z, a = 0) {
  const c = Math.cos(a),
    s = Math.sin(a),
    rot = ([u, y, v]) => [u * c + v * s, y, -u * s + v * c];
  return Object.fromEntries(
    ['addQuad', 'addTriangle', 'addConvexPolygon'].map((k) => [
      k,
      (slot, r, p, n, uv, col) =>
        o[k](
          slot,
          r,
          p.map((v) => {
            const q = rot(v);
            return [q[0] + x, q[1], q[2] + z];
          }),
          rot(n),
          uv,
          col,
        ),
    ]),
  );
}
const edge = (o, a, b) => local(o, a[0], a[1], Math.atan2(a[1] - b[1], b[0] - a[0]));
const rect = (o, s, x, y, z, w, h, d, c = 'stone') =>
  box(o, s, [x - w / 2, y, z - d / 2], [x + w / 2, y + h, z + d / 2], color[c]);
function face(o, s, p, c = 'stone', up = false) {
  if (up && normalFor(p[0], p[1], p[2])[1] < 0) p = [...p].reverse();
  for (let i = 1; i < p.length - 1; i++) {
    const t = [p[0], p[i], p[i + 1]];
    o.addTriangle(
      s,
      'palette:#ffffff',
      t,
      normalFor(...t),
      [
        [0, 0],
        [1, 0],
        [0, 1],
      ],
      color[c],
    );
  }
}
function floor(o, rings, y, s = 'sandstone', c = 'paving') {
  const pts = rings.flat(),
    holes = [];
  let offset = rings[0].length;
  for (const r of rings.slice(1)) {
    holes.push(offset);
    offset += r.length;
  }
  const idx = earcut(pts.flat(), holes, 2);
  for (let i = 0; i < idx.length; i += 3)
    face(
      o,
      s,
      idx.slice(i, i + 3).map((j) => [pts[j][0], y, pts[j][1]]),
      c,
      true,
    );
}
function shell(o, outer, holes, y0, y1, s = 'sandstone', c = 'stone') {
  const rings = [ring(outer), ...holes.map((p) => ring(p, true))];
  for (const p of rings)
    for (let i = 0; i < p.length; i++) {
      const a = p[i],
        b = p[(i + 1) % p.length];
      face(
        o,
        s,
        [
          [a[0], y0, a[1]],
          [b[0], y0, b[1]],
          [b[0], y1, b[1]],
          [a[0], y1, a[1]],
        ],
        c,
      );
    }
  floor(o, rings, y1, s, c);
}
function bar(o, a, b, y, h, w, c = 'stone', s = 'sandstone') {
  const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
  rect(edge(o, a, b), s, l / 2, y, 0, l, h, w, c);
}
function gable(o, p, eaves, ridge, s = 'slate', c = 'roof') {
  // A four-sided roof footprint; the long opposing sides meet at the ridge.
  const a = mix(p[0], p[3], 0.5),
    b = mix(p[1], p[2], 0.5);
  for (const q of [
    [p[0], p[1], b, a],
    [p[2], p[3], a, b],
  ])
    face(
      o,
      s,
      q.map((v, i) => [v[0], i < 2 ? eaves : ridge, v[1]]),
      c,
      true,
    );
  for (const q of [
    [p[3], p[0], a],
    [p[1], p[2], b],
  ])
    face(
      o,
      s,
      q.map((v, i) => [v[0], i < 2 ? eaves : ridge, v[1]]),
      c,
      true,
    );
}
function roofRect(o, w, l, y, r) {
  gable(
    o,
    [
      [-w / 2, -l / 2],
      [-w / 2, l / 2],
      [w / 2, l / 2],
      [w / 2, -l / 2],
    ],
    y,
    r,
  );
}
function pane(o, x, y, z, w, h, d, { arched = false, stone = 'trim', surface = 'sandstone' } = {}) {
  const profile = (width, height, depth) => {
    const left = x - width / 2,
      right = x + width / 2;
    if (!arched)
      return [
        [left, y, depth],
        [right, y, depth],
        [right, y + height, depth],
        [left, y + height, depth],
      ];
    const radius = width / 2,
      cy = y + height - radius,
      n = d >= 2 ? 6 : 3;
    return [
      [left, y, depth],
      [right, y, depth],
      ...Array.from({ length: n + 1 }, (_, i) => [
        x + radius * Math.cos((i * Math.PI) / n),
        cy + radius * Math.sin((i * Math.PI) / n),
        depth,
      ]),
    ];
  };
  if (d >= 2) face(o, surface, profile(w + 0.5, h + 0.3, z), stone);
  face(o, 'glass', profile(w, h, z + 0.04), 'pane');
  if (d === 3 && w > 2) {
    // Only the Hall's large windows retain bars at the compound's ~0.45m detail cutoff.
    rect(o, surface, x, y, z + 0.11, 0.45, h, 0.45, stone);
    rect(o, surface, x, y + h * 0.51, z + 0.11, w, 0.45, 0.45, stone);
  }
}
function windows(o, p, y0, y1, d, { hall = false, palace = false } = {}) {
  if (!d) return;
  const r = ring(p);
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (l < 4) continue;
    const g = edge(o, a, b),
      n = Math.max(1, Math.round(l / (hall ? 6 : 5)));
    const short = y1 - y0 < 8;
    for (let j = 0; j < n; j++)
      for (const y of hall ? [y0 + 5] : short ? [y0 + 0.8] : [y0 + 2.2, y1 - 4]) {
        pane(
          g,
          ((j + 0.5) * l) / n,
          y,
          0.06,
          hall ? 2.3 : 1.35,
          hall ? 5.6 : short ? Math.min(2.4, y1 - y0 - 1.6) : 2.4,
          d,
          { arched: hall },
        );
        if (palace && d >= 2) {
          // Coarse pilaster and niche rhythm, not a replica of individual sculptures.
          rect(g, 'sandstone', (j * l) / n + 0.7, y1 - 7, 0.3, 0.5, 5.5, 0.55, 'trim');
          if (d === 3) {
            rect(g, 'sandstone', (j * l) / n + 0.7, y1 - 6, 0.65, 0.55, 1.4, 0.55, 'stone');
            rect(g, 'sandstone', (j * l) / n + 0.7, y1 - 4.4, 0.65, 0.5, 0.5, 0.5, 'stone');
          }
        }
      }
  }
}
function battlements(o, p, y, d, s = 'sandstone', c = 'stone') {
  if (!d) return;
  for (let i = 0; i < p.length; i++) {
    const a = p[i],
      b = p[(i + 1) % p.length],
      g = edge(o, a, b),
      l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    bar(o, a, b, y - 0.3, 0.5, 0.85, c, s);
    const n = Math.max(1, Math.floor(l / (d === 1 ? 4 : 2.5)));
    for (let j = 0; j < n; j++)
      rect(g, s, ((j + 0.5) * l) / n, y, 0, Math.min(1.25, (l / n) * 0.48), 0.8, 0.9, c);
  }
}
function hall(o, d) {
  const p = part(68955265).outline;
  shell(o, p, [], 0, 22, 'plaster', 'ochre');
  windows(o, p, 7, 22, d, { hall: true });
  const g = local(o, 17.105, 15.807, -0.4798);
  roofRect(g, 13.35, 43, 22, 31.3);
  // Crow-stepped gables and their broad central chimney survive even at skyline level.
  for (const z of [-21.5, 21.5]) {
    const steps = d ? 5 : 2;
    for (let i = 0; i < steps; i++) {
      const width = 13.8 * (1 - i / (steps + 0.45)),
        base = 22 + (i * 9.5) / steps;
      rect(g, 'plaster', 0, base, z, width, 9.5 / steps + 0.08, 0.75, 'ochre');
    }
    rect(g, 'plaster', 0, 30.5, z, 1.5, 3.5, 1.3, 'ochre');
    if (d) rect(g, 'plaster', 0, 33.6, z, 2, 0.4, 1.7, 'ochre');
  }
  if (d) {
    battlements(
      g,
      [
        [-6.8, -21.5],
        [-6.8, 21.5],
        [6.8, 21.5],
        [6.8, -21.5],
      ],
      22.4,
      d,
      'plaster',
      'ochre',
    );
    for (const x of [-6.75, 6.75]) {
      loft(
        g,
        'plaster',
        [
          radialRing(20.5, 1.15, 1.15, d === 1 ? 8 : 12, [x, -20]),
          radialRing(25.2, 1.15, 1.15, d === 1 ? 8 : 12, [x, -20]),
        ],
        color.ochre,
      );
      loft(
        g,
        'slate',
        [radialRing(25.2, 1.2, 1.2, 8, [x, -20]), radialRing(27.2, 0.15, 0.15, 8, [x, -20])],
        color.roof,
      );
      for (const z of [-8, 9]) rect(g, 'plaster', x, 22, z, 1.1, 5, 1.2, 'ochre');
    }
    if (d >= 2) {
      for (const x of [-6.8, 6.8])
        for (let z = -19; z <= 20; z += 3.3) rect(g, 'plaster', x, 21.3, z, 0.9, 0.8, 0.6, 'ochre');
      // South dais projects to both sides; mapped bays are retained in the base shell.
      for (const a of [Math.PI / 2, -Math.PI / 2]) {
        const q = local(g, a > 0 ? 7.65 : -7.65, 15, a);
        pane(q, 0, 12.5, 0.13, 3.25, 6.5, d, { arched: true, stone: 'ochre', surface: 'plaster' });
      }
    }
  }
}
function palace(o, d) {
  const mapped = part(1083531),
    outer = [23, 0, 3, 11, 20].map((i) => mapped.outline[i]),
    hole = ring(mapped.holes[0]);
  shell(o, outer, [hole], 0, 20);
  floor(o, [hole], 7);
  windows(o, outer, 7, 20, d, { palace: true });
  if (d >= 2) windows(o, [...hole].reverse(), 7, 20, d);
  // The four ranges preserve the Lion's Den as open space. Roofs meet along corner hips.
  const a = [-31.4, 14.7],
    b = [-50.758, 40.862],
    c = [-11.734, 57.062],
    e = [-2.172, 27.492];
  const h = [
    [-33.476, 22.555],
    [-40.225, 33.59],
    [-18.587, 43.071],
    [-13.576, 31.471],
  ];
  for (const p of [
    [a, b, h[1], h[0]],
    [b, c, h[2], h[1]],
    [c, e, h[3], h[2]],
    [e, a, h[0], h[3]],
  ])
    gable(o, p, 20, 27.5);
  const t = local(o, -36.8, 51.3, -0.42);
  rect(t, 'sandstone', 0, 4, 0, 6.8, 21, 6.3);
  roofRect(t, 7.4, 7, 25, 30);
  if (d) {
    for (const y of [10, 17, 22]) pane(t, 0, y, 3.18, 1.3, 2, d);
    for (const p of [a, b, c, e]) {
      loft(
        o,
        'sandstone',
        [radialRing(18.5, 1, 1, 8, p), radialRing(23, 1.1, 1.1, 8, p)],
        color.stone,
      );
      loft(
        o,
        'slate',
        [radialRing(23, 1.25, 1.25, 8, p), radialRing(26, 0.1, 0.1, 8, p)],
        color.roof,
      );
    }
    for (const p of [
      [-40, 24],
      [-9, 41],
    ])
      rect(o, 'sandstone', p[0], 24, p[1], 1.7, 5, 1.7);
    for (const p of [outer, hole])
      for (let i = 0; i < p.length; i++)
        bar(o, p[i], p[(i + 1) % p.length], 18.8, 0.45, 0.5, 'trim');
  }
  const bridge = edge(o, [-3, 31], [5, 34]),
    length = Math.hypot(8, 3),
    w = 3.6;
  for (const z of [-w / 2, w / 2]) {
    const g = z < 0 ? local(bridge, length / 2, z, Math.PI) : local(bridge, length / 2, z);
    for (const side of [-1, 1]) {
      const p = [
        [0, 13.5, 0.02],
        [(side * length) / 2, 10.4, 0.02],
        [(side * length) / 2, 17.6, 0.02],
        [0, 17.6, 0.02],
      ];
      face(g, 'sandstone', side < 0 ? p.reverse() : p);
    }
    if (d)
      for (const x of [-2.4, 0, 2.4])
        face(
          g,
          'glass',
          [
            [x - 0.65, 14, 0.05],
            [x + 0.65, 14, 0.05],
            [x + 0.65, 15.7, 0.05],
            [x, 16.35, 0.05],
            [x - 0.65, 15.7, 0.05],
          ],
          'pane',
        );
  }
  face(
    bridge,
    'sandstone',
    [
      [0, 10.4, -w / 2],
      [length / 2, 13.5, -w / 2],
      [length / 2, 13.5, w / 2],
      [0, 10.4, w / 2],
    ],
    'stone',
  );
  face(
    bridge,
    'sandstone',
    [
      [length / 2, 13.5, -w / 2],
      [length, 10.4, -w / 2],
      [length, 10.4, w / 2],
      [length / 2, 13.5, w / 2],
    ],
    'stone',
  );
  bar(o, [-3, 31], [5, 34], 17.6, 0.55, 4, 'roof', 'slate');
}
function chapel(o, d) {
  const p = part(68955287).outline;
  const q = [p[0], p[1], p[2], p[3], p[4]];
  shell(o, q, [], 0, 19);
  gable(o, [p[0], p[4], p[3], p[2]], 19, 26);
  if (!d) return;
  const g = edge(o, p[4], p[0]),
    l = Math.hypot(p[4][0] - p[0][0], p[4][1] - p[0][1]);
  for (const f of [0.12, 0.3, 0.7, 0.88]) pane(g, l * f, 11.5, 0.07, 1.8, 4.5, d, { arched: true });
  pane(g, l / 2, 8, 0.1, 2.2, 4.8, d, { arched: true });
  if (d >= 2) {
    for (const x of [-2, -1.45, 1.45, 2])
      rect(g, 'sandstone', l / 2 + x, 8, 0.35, 0.4, 5.2, 0.5, 'trim');
    rect(g, 'sandstone', l / 2, 13.2, 0.35, 5, 0.65, 0.65, 'trim');
    face(
      g,
      'sandstone',
      [
        [l / 2 - 2.5, 13.85, 0.6],
        [l / 2 + 2.5, 13.85, 0.6],
        [l / 2, 15.2, 0.6],
      ],
      'trim',
    );
  }
}
function king(o, d) {
  const p = part(68955260).outline;
  const q = [0, 1, 2, 3, 5, 8, 10, 11, 17].map((i) => p[i]);
  shell(o, q, [], 0, 22);
  gable(o, [p[1], p[5], p[8], p[0]], 22, 29);
  windows(o, q, 8, 22, d);
  const g = local(o, -22, -36, -0.205);
  rect(g, 'sandstone', 0, 19, 0, 16, 6, 11);
  roofRect(g, 16.8, 11.8, 25, 31);
  if (d) {
    for (const x of [-7, 7]) {
      loft(
        g,
        'sandstone',
        [radialRing(20.5, 1.35, 1.35, 8, [x, 4]), radialRing(26.5, 1.35, 1.35, 8, [x, 4])],
        color.stone,
      );
      loft(
        g,
        'slate',
        [radialRing(26.5, 1.5, 1.5, 8, [x, 4]), radialRing(30, 0.1, 0.1, 8, [x, 4])],
        color.roof,
      );
    }
    for (const z of [-22, -7]) rect(o, 'sandstone', -30, 26, z, 1.5, 5.5, 2.1);
  }
}
function portal(o, w, h, depth, base, d, pier = 2) {
  // Open barrel vault. No backing quad or floor obstruction through the arch.
  const r = w / 2,
    spring = base + h - r,
    n = d >= 2 ? 8 : d ? 4 : 2,
    top = base + h + 2.8;
  for (const z of [-depth / 2, depth / 2]) {
    const g = z < 0 ? local(o, 0, z, Math.PI) : local(o, 0, z);
    rect(g, 'sandstone', -r - pier / 2, base, 0, pier, top - base, 0.35);
    rect(g, 'sandstone', r + pier / 2, base, 0, pier, top - base, 0.35);
    for (let i = 0; i < n; i++) {
      const a = (i * Math.PI) / n,
        b = ((i + 1) * Math.PI) / n;
      face(g, 'sandstone', [
        [r * Math.cos(b), spring + r * Math.sin(b), 0],
        [r * Math.cos(a), spring + r * Math.sin(a), 0],
        [r * Math.cos(a), top, 0],
        [r * Math.cos(b), top, 0],
      ]);
    }
  }
  for (const x of [-r, r]) {
    const p = [
      [x, base, -depth / 2],
      [x, base, depth / 2],
      [x, spring, depth / 2],
      [x, spring, -depth / 2],
    ];
    face(o, 'sandstone', x < 0 ? [...p].reverse() : p, 'stone');
  }
  for (let i = 0; i < n; i++) {
    const a = (i * Math.PI) / n,
      b = ((i + 1) * Math.PI) / n;
    face(o, 'sandstone', [
      [r * Math.cos(a), spring + r * Math.sin(a), -depth / 2],
      [r * Math.cos(a), spring + r * Math.sin(a), depth / 2],
      [r * Math.cos(b), spring + r * Math.sin(b), depth / 2],
      [r * Math.cos(b), spring + r * Math.sin(b), -depth / 2],
    ]);
  }
  rect(o, 'sandstone', 0, top - 0.3, 0, w + pier * 2, 0.4, depth);
}
function forework(o, d) {
  const g = local(o, 5.22, 70.0, -0.2949);
  portal(g, 3.8, 5.2, 6.2, 4, d, 1.15);
  rect(g, 'sandstone', 0, 0, 0, 10.2, 4, 8);
  for (const x of [-6.6, 6.6]) {
    const n = d >= 2 ? 16 : d ? 8 : 6,
      r = 2.55;
    loft(
      g,
      'sandstone',
      [radialRing(2, r, r, n, [x, 3.1]), radialRing(15, r, r, n, [x, 3.1])],
      color.stone,
    );
    if (d) {
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4,
          q = local(g, x + Math.sin(a) * r, 3.1 + Math.cos(a) * r, a);
        rect(q, 'sandstone', 0, 15, 0, 1.05, 0.8, 0.8);
        if (d >= 2) {
          pane(q, 0, 6, 0.06, 0.38, 1.75, 1);
          pane(q, 0, 11, 0.06, 0.38, 1.75, 1);
        }
      }
      pane(g, x, 6, 5.68, 0.38, 1.75, 1);
    }
  }
  // Secondary pedestrian openings are genuine holes beside the main gate.
  for (const x of [-3.5, 3.5]) portal(local(g, x, 0), 0.9, 2.9, 6.2, 4, d, 0.45);
  bar(o, [-35, 57], [-1, 67], 4, 8, 2.8);
  bar(o, [13, 71], [48, 66], 4, 7, 3);
  battlements(
    o,
    [
      [-35, 57],
      [-1, 67],
    ],
    12,
    d,
  );
  rect(o, 'sandstone', 40, 2, 68, 12, 9, 10);
  if (d >= 2)
    for (let x = 36; x <= 44; x += 4) {
      rect(o, 'glass', x, 11.6, 69, 0.7, 0.7, 3.4, 'pane');
      rect(o, 'sandstone', x, 11, 69, 1.7, 0.7, 1.7);
    }
}
function smallBuilding(o, id, base, eaves, ridge, d) {
  if (!d) {
    const p = part(id).outline,
      lo = [0, 1].map((i) => Math.min(...p.map((q) => q[i]))),
      hi = [0, 1].map((i) => Math.max(...p.map((q) => q[i])));
    rect(
      o,
      'sandstone',
      (lo[0] + hi[0]) / 2,
      base,
      (lo[1] + hi[1]) / 2,
      hi[0] - lo[0],
      ridge - base,
      hi[1] - lo[1],
    );
    return;
  }

  const p = ring(part(id).outline).filter(
      (p, i, all) =>
        d ||
        i === 0 ||
        Math.abs(
          (p[0] - all[(i + all.length - 1) % all.length][0]) *
            (all[(i + 1) % all.length][1] - p[1]) -
            (p[1] - all[(i + all.length - 1) % all.length][1]) *
              (all[(i + 1) % all.length][0] - p[0]),
        ) > 0.15,
    ),
    a = p[0],
    b = p[1];
  shell(o, p, [], base, eaves);
  // Rectangular bounding roof along the first mapped edge; only low ancillary buildings use it.
  const angle = Math.atan2(a[1] - b[1], b[0] - a[0]),
    c = Math.cos(angle),
    s = Math.sin(angle);
  const xy = p.map(([x, z]) => [c * x - s * z, s * x + c * z]);
  const min = [0, 1].map((i) => Math.min(...xy.map((p) => p[i]))),
    max = [0, 1].map((i) => Math.max(...xy.map((p) => p[i])));
  const center = min.map((v, i) => (v + max[i]) / 2),
    g = local(o, c * center[0] + s * center[1], -s * center[0] + c * center[1], angle);
  // ridge follows the longest box direction
  if (max[0] - min[0] > max[1] - min[1])
    roofRect(
      local(g, 0, 0, Math.PI / 2),
      max[1] - min[1] + 0.5,
      max[0] - min[0] + 0.5,
      eaves,
      ridge,
    );
  else roofRect(g, max[0] - min[0] + 0.5, max[1] - min[1] + 0.5, eaves, ridge);
  if (d >= 2) windows(o, p, base, eaves, d);
}

const grade = JSON.parse(
  readFileSync(
    new URL(
      '../../../content/worldgen/source/places/gc/gcv/n0262_stirling_castle/site-grade.json',
      import.meta.url,
    ),
  ),
);
export function stirlingGround(x, z) {
  const g = grade.grid,
    u = Math.max(0, Math.min(g.width - 1.000001, (x - g.origin[0]) / g.stepMeters)),
    v = Math.max(0, Math.min(g.height - 1.000001, (z - g.origin[1]) / g.stepMeters)),
    i = Math.floor(u),
    j = Math.floor(v),
    fx = u - i,
    fz = v - j,
    at = (a, b) => g.heights[(j + b) * g.width + i + a] - grade.datumMeters;
  return (
    (at(0, 0) * (1 - fx) + at(1, 0) * fx) * (1 - fz) + (at(0, 1) * (1 - fx) + at(1, 1) * fx) * fz
  );
}
const MEANS = {
  sandstone: [0.6849383831581978, 0.6023767969729558, 0.46768227309766186],
  plaster: [0.8560149893924018, 0.8277277519506693, 0.7276425175607023],
  slate: [0.5949296246834199, 0.6327938708909794, 0.6537532348745474],
};
const shift = (o, y, baked = false) =>
  Object.fromEntries(
    ['addQuad', 'addTriangle', 'addConvexPolygon'].map((k) => [
      k,
      (s, r, p, n, uv, c) =>
        o[k](
          s,
          r,
          p.map((v) => [v[0], v[1] + y, v[2]]),
          n,
          uv,
          baked ? c.map((v, i) => v * (MEANS[s]?.[i] ?? 1)) : c,
        ),
    ]),
  );
export const stirlingGateControls = {
  forework: {
    center: [5.22, 70],
    angle: -0.2949,
    width: 3.8,
    depth: 6.2,
    floor: grade.foreworkFloor,
  },
  north: { center: [34, -17], angle: Math.PI, width: 4, depth: 5, floor: grade.northGateFloor },
  newPort: {
    center: [-3.68025, 112.9895],
    angle: Math.atan2(-7.506, 6.238),
    width: 4.2,
    depth: 6.8,
    floor: grade.newPortFloor,
  },
};
function apron(o, center, angle, start, len, width, y) {
  const [x, z] = center,
    dx = Math.sin(angle),
    dz = Math.cos(angle),
    nx = (Math.cos(angle) * width) / 2,
    nz = (-Math.sin(angle) * width) / 2,
    end = stirlingGround(x + dx * (start + len), z + dz * (start + len)) + 0.05;
  face(
    o,
    'sandstone',
    [
      [x + dx * start - nx, y + 0.04, z + dz * start - nz],
      [x + dx * start + nx, y + 0.04, z + dz * start + nz],
      [x + dx * (start + len) + nx, end, z + dz * (start + len) + nz],
      [x + dx * (start + len) - nx, end, z + dz * (start + len) - nz],
    ],
    'paving',
    true,
  );
}
function gradedWall(o, a, b, h, w, segmentLength = 12) {
  const l = Math.hypot(b[0] - a[0], b[1] - a[1]),
    n = Math.max(1, Math.ceil(l / segmentLength));
  for (let i = 0; i < n; i++) {
    const aa = mix(a, b, i / n),
      bb = mix(a, b, (i + 1) / n),
      ya = stirlingGround(...aa) - 0.8,
      yb = stirlingGround(...bb) - 0.8,
      g = edge(o, aa, bb),
      ll = l / n;
    for (const sign of [-1, 1]) {
      const p = [
        [0, ya, (sign * w) / 2],
        [ll, yb, (sign * w) / 2],
        [ll, yb + h, (sign * w) / 2],
        [0, ya + h, (sign * w) / 2],
      ];
      face(g, 'sandstone', sign > 0 ? p : [...p].reverse());
    }
    face(
      g,
      'sandstone',
      [
        [0, ya + h, -w / 2],
        [0, ya + h, w / 2],
        [ll, yb + h, w / 2],
        [ll, yb + h, -w / 2],
      ],
      'stone',
      true,
    );
  }
}
function outerCloseHeight(z) {
  return Math.min(
    4 + grade.architectureShift,
    grade.foreworkFloor + ((65 - z) * (4 + grade.architectureShift - grade.foreworkFloor)) / 25,
  );
}
function gradedPlatform(o, poly) {
  const p = ring(poly);
  for (let i = 0; i < p.length; i++) {
    const a = p[i],
      b = p[(i + 1) % p.length];
    face(o, 'sandstone', [
      [a[0], grade.foundationFloor, a[1]],
      [b[0], grade.foundationFloor, b[1]],
      [b[0], outerCloseHeight(b[1]), b[1]],
      [a[0], outerCloseHeight(a[1]), a[1]],
    ]);
  }
  const ids = earcut(p.flat(), undefined, 2);
  for (let i = 0; i < ids.length; i += 3)
    face(
      o,
      'sandstone',
      ids.slice(i, i + 3).map((j) => [p[j][0], outerCloseHeight(p[j][1]), p[j][1]]),
      'paving',
      true,
    );
}
function enclosure(o, d) {
  const source = frame.geometry.outline,
    ids = d
      ? [0, 3, 9, 12, 18, 26, 28, 33, 35, 36, 38, 40, 43, 48, 58, 62, 64, 71, 78, 83]
      : [0, 3, 9, 18, 26, 28, 33, 35, 36, 38, 43, 58, 64, 71, 78, 83];
  for (let i = 0; i < ids.length; i++) {
    if (
      (ids[i] === 35 && ids[(i + 1) % ids.length] === 36) ||
      (ids[i] === 36 && ids[(i + 1) % ids.length] === 38)
    )
      continue;
    const a = source[ids[i]],
      b = source[ids[(i + 1) % ids.length]],
      z = (a[1] + b[1]) / 2;
    gradedWall(o, a, b, z < -40 ? 4.5 : z < 70 ? 10 : 7, 1.8, d ? 12 : Infinity);
  }
  const platform = [
    source[64],
    source[18],
    source[26],
    [0, 65],
    source[43],
    source[58],
    source[62],
  ];
  gradedPlatform(o, platform);
  const inner = [
    [-30, -41],
    [23, -17],
    [21, 31],
    [-31, 16],
    [-43, -3],
  ];
  shell(o, inner, [], grade.foundationFloor, grade.workingCourtFloor);
  // Local terrace slope connects the outer close to the raised inner close.
  face(
    o,
    'sandstone',
    [
      [0, grade.foreworkFloor, 65],
      [35, grade.foreworkFloor, 65],
      [32, grade.workingCourtFloor, 28],
      [-4, grade.workingCourtFloor, 25],
    ],
    'paving',
    true,
  );
  gradedWall(o, [-29, -44], [27, -21], 8, 2.2, d ? 12 : Infinity);
  for (const [name, ctl] of Object.entries(stirlingGateControls)) {
    if (name === 'forework') continue;
    const g = local(o, ...ctl.center, ctl.angle);
    portal(g, ctl.width, 5, ctl.depth, ctl.floor, d);
    if (name === 'north') {
      if (d) roofRect(g, 8, 6, ctl.floor + 8, ctl.floor + 11.5);
    } else {
      for (const x of [-15, 15]) rect(g, 'sandstone', x, ctl.floor, 0, 21.8, 7, 2.2);
      if (d)
        for (const x of [-5, 5]) {
          loft(
            g,
            'sandstone',
            [
              radialRing(ctl.floor + 5, 1.1, 1.1, 8, [x, 0]),
              radialRing(ctl.floor + 8.5, 1.1, 1.1, 8, [x, 0]),
            ],
            color.stone,
          );
          loft(
            g,
            'slate',
            [
              radialRing(ctl.floor + 8.5, 1.3, 1.3, 8, [x, 0]),
              radialRing(ctl.floor + 10, 0.15, 0.15, 8, [x, 0]),
            ],
            color.roof,
          );
        }
    }
    apron(o, ctl.center, ctl.angle, ctl.depth / 2, 8, ctl.width + 0.4, ctl.floor);
    apron(o, ctl.center, ctl.angle + Math.PI, ctl.depth / 2, 8, ctl.width + 0.4, ctl.floor);
  }
}
function reviewed(o, level) {
  const d = { skyline: 0, district: 1, street: 2, closeup: 3 }[level],
    raw = shift(o, 0, level === 'skyline'),
    main = shift(raw, grade.architectureShift);
  enclosure(raw, d);
  hall(main, d);
  palace(main, d);
  chapel(main, d);
  king(main, d);
  forework(shift(raw, grade.foreworkFloor - 4), d);
  const f = stirlingGateControls.forework;
  apron(raw, f.center, f.angle, 4, 14, 10.2, f.floor);
  apron(raw, f.center, f.angle + Math.PI, 4, 14, 10.2, f.floor);
  for (const [id, base, eaves, ridge] of [
    [68955282, 0, 4, 6.5],
    [68955271, 0, 4, 6.8],
    [68955312, 0, 3, 5],
    [68955243, 4, 10, 14],
    [748875706, 4, 11, 15],
    [748875670, 0, 5, 7.5],
    [68955266, 0, 5.5, 8],
    [68955308, 0, 4.5, 6.5],
    [748875669, 4, 9, 12],
    [68955274, 0, 4.5, 7],
  ]) {
    if (!d && ![68955282, 68955243, 748875706, 748875670, 68955274].includes(id)) continue;
    if (d === 1 && [68955308, 748875669].includes(id)) continue;
    const p = part(id).outline,
      floor = Math.max(...p.map((q) => stirlingGround(...q))) + 0.12;
    smallBuilding(shift(raw, floor - base), id, base, eaves, ridge, d);
  }
}
export const buildStirlingReviewedMaster = (o) => reviewed(o, 'closeup');
export const buildStirlingReviewedSkyline = (o) => reviewed(o, 'skyline');
export const buildStirlingReviewedDistrict = (o) => reviewed(o, 'district');
export const buildStirlingReviewedStreet = (o) => reviewed(o, 'street');
export const buildStirlingReviewedCloseup = (o) => reviewed(o, 'closeup');
