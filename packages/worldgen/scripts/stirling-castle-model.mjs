/** Present-day Stirling Castle: mapped compound, bounded medium-fi exterior. */
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
    const steps = d ? 5 : 3;
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
  // Covered bridge to the Hall remains above the sloped passage.
  bar(o, [-3, 31], [5, 34], 14.2, 3.4, 3.4);
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
    n = d >= 2 ? 8 : 4,
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
  for (const x of [-r, r])
    face(
      o,
      'sandstone',
      [
        [x, base, -depth / 2],
        [x, base, depth / 2],
        [x, spring, depth / 2],
        [x, spring, -depth / 2],
      ],
      'stone',
    );
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
  portal(g, 3.8, 5.2, 6.2, 4, d, d ? 0.9 : 2);
  // Approach ramp reaches the vault floor and connects through to the upper court.
  rect(g, 'sandstone', 0, 0, -0.2, 12.4, 4, 14);
  face(
    g,
    'sandstone',
    [
      [-6.2, 4, 6.8],
      [6.2, 4, 6.8],
      [6.2, 0, 23],
      [-6.2, 0, 23],
    ],
    'paving',
    true,
  );
  face(
    g,
    'sandstone',
    [
      [-6.2, 0, 6.8],
      [-6.2, 4, 6.8],
      [-6.2, 0, 23],
    ],
    'stone',
  );
  face(
    g,
    'sandstone',
    [
      [6.2, 0, 23],
      [6.2, 4, 6.8],
      [6.2, 0, 6.8],
    ],
    'stone',
  );
  for (const x of [-6.1, 6.1]) {
    const n = d >= 2 ? 16 : 8,
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
  if (d) for (const x of [-3.5, 3.5]) portal(local(g, x, 0), 0.9, 2.9, 6.2, 4, d, 0.45);
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
  const p = ring(part(id).outline),
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
function enclosure(o, d) {
  const source = frame.geometry.outline;
  const ids = d
    ? [
        0, 3, 4, 8, 9, 12, 16, 18, 22, 26, 28, 31, 33, 35, 36, 38, 39, 40, 41, 43, 48, 52, 58, 60,
        62, 64, 67, 71, 75, 78, 83,
      ]
    : [0, 3, 9, 12, 18, 26, 28, 33, 35, 36, 38, 40, 43, 58, 64, 71, 78, 83];
  const p = ids.map((i) => source[i]);
  for (let i = 0; i < p.length; i++) {
    const a = p[i],
      b = p[(i + 1) % p.length],
      z = (a[1] + b[1]) / 2;
    // The long south-east boundary is a visitor route, not a solid enclosing building.
    if (
      (ids[i] === 35 && ids[(i + 1) % ids.length] === 36) ||
      (ids[i] === 36 && ids[(i + 1) % ids.length] === 38)
    )
      continue;
    const height = z < -40 ? 4.5 : z < 70 ? 10 : 7;
    if (d) bar(o, a, b, 0, height, 1.8);
    else {
      // Distant walls need both visible faces and a top, but no hidden segment end caps.
      const g = edge(o, a, b),
        l = Math.hypot(b[0] - a[0], b[1] - a[1]);
      face(g, 'sandstone', [
        [0, 0, 0.9],
        [l, 0, 0.9],
        [l, height, 0.9],
        [0, height, 0.9],
      ]);
      face(g, 'sandstone', [
        [l, 0, -0.9],
        [0, 0, -0.9],
        [0, height, -0.9],
        [l, height, -0.9],
      ]);
      face(
        g,
        'sandstone',
        [
          [0, height, -0.9],
          [0, height, 0.9],
          [l, height, 0.9],
          [l, height, -0.9],
        ],
        'stone',
        true,
      );
    }
    if (d >= 2) bar(o, a, b, height - 0.3, 0.6, 2.1, 'trim');
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
  shell(o, platform, [], 0, 4);
  const inner = [
    [-30, -41],
    [23, -17],
    [21, 31],
    [-31, 16],
    [-43, -3],
  ];
  shell(o, inner, [], 4, 8);
  // Broad ramps connect the forework, outer close and inner close.
  face(
    o,
    'sandstone',
    [
      [0, 4, 65],
      [35, 4, 65],
      [32, 8, 28],
      [-4, 8, 25],
    ],
    'paving',
    true,
  );
  floor(
    o,
    [
      [
        [-56, 58],
        [-5, 70],
        [-10, 87],
        [-60, 99],
      ],
    ],
    0.1,
    'foliage',
    'lawn',
  );
  floor(
    o,
    [
      [
        [-5, -135],
        [25, -150],
        [56, -110],
        [54, -45],
        [-17, -50],
      ],
    ],
    0.08,
    'foliage',
    'lawn',
  );
  // North curtain and low arched gate to the lower bailey.
  bar(o, [-29, -44], [27, -21], 1, 8, 2.2);
  const north = local(o, 34, -17, Math.PI);
  portal(north, 4, 5, 5, 0, d);
  if (d) roofRect(north, 8, 6, 8, 11.5);
  // New Port at the outer defensive line, with modest pepper-pot sentry turrets.
  const entry = local(o, -3, 113, 0.73);
  portal(entry, 4.2, 5, 5, 0, d);
  for (const x of [-15, 15]) rect(entry, 'sandstone', x, 0, 0, 21.8, 7, 2.2);
  bar(o, [-22.3, 130.3], [-45.3, 107.9], 0, 7, 2.2);
  bar(o, [16.3, 95.7], [64.8, 109.6], 0, 7, 2.2);
  if (d)
    for (const x of [-5, 5]) {
      loft(
        entry,
        'sandstone',
        [radialRing(5, 1.1, 1.1, 8, [x, 0]), radialRing(8.5, 1.1, 1.1, 8, [x, 0])],
        color.stone,
      );
      loft(
        entry,
        'slate',
        [radialRing(8.5, 1.3, 1.3, 8, [x, 0]), radialRing(10, 0.15, 0.15, 8, [x, 0])],
        color.roof,
      );
    }
}
export function buildStirlingRuntime(o, level) {
  const d = { skyline: 0, district: 1, street: 2, closeup: 3 }[level] ?? 3;
  enclosure(o, d);
  hall(o, d);
  palace(o, d);
  chapel(o, d);
  king(o, d);
  forework(o, d);
  for (const [id, base, eaves, ridge] of [
    [68955282, 0, 4, 6.5],
    [68955271, 0, 4, 6.8],
    [68955312, 0, 3, 5],
    [68955243, 4, 10, 14],
    [748875706, 4, 11, 15],
    [748875670, 0, 5, 7.5],
    [68955266, 0, 5.5, 8],
  ])
    if (d || [68955282, 68955243, 748875706, 748875670].includes(id))
      smallBuilding(o, id, base, eaves, ridge, d);
  if (d >= 2)
    for (const [id, base, eaves, ridge] of [
      [68955308, 0, 4.5, 6.5],
      [748875669, 4, 9, 12],
      [68955274, 0, 4.5, 7],
    ])
      smallBuilding(o, id, base, eaves, ridge, d);
  if (d < 2) {
    // Keep the outermost small store's extent even when its detailed roof drops away.
    const p = part(68955274).outline;
    const lo = [0, 1].map((i) => Math.min(...p.map((p) => p[i])));
    const hi = [0, 1].map((i) => Math.max(...p.map((p) => p[i])));
    rect(
      o,
      'sandstone',
      (lo[0] + hi[0]) / 2,
      0,
      (lo[1] + hi[1]) / 2,
      hi[0] - lo[0],
      5.4,
      hi[1] - lo[1],
    );
  }
}
export const buildStirlingSkyline = (o) =>
  buildStirlingRuntime(
    Object.fromEntries(
      ['addQuad', 'addTriangle', 'addConvexPolygon'].map((k) => [
        k,
        (s, r, p, n, uv, c) =>
          o[k](
            s,
            r,
            p,
            n,
            uv,
            c.map((v) => v * (['glass', 'foliage'].includes(s) ? 1 : 0.65)),
          ),
      ]),
    ),
    'skyline',
  );
export const stirlingStudy = {
  id: 'N0262',
  key: 'stirling_castle',
  title: 'Stirling Castle',
  category: 'castle',
  wikidataId: 'Q756268',
  mapFrame: 'map-frame.json',
  fidelityTarget: 'medium-fi',
  build: (o) => buildStirlingRuntime(o),
  brief:
    'Present-day fortified compound with ochre Great Hall, open Lion’s Den palace court, Chapel Royal, King’s Old Building, low twin-drum Forework and walled Nether Bailey.',
  appearance: {
    standard: 'docs-src/guide/medium-fi.md',
    paletteSrgb: stirlingPalette,
    colorEncoding: 'sRGB decoded to linear COLOR_0',
    materialBudget: 5,
    identityFeatures: [
      'Ochre Great Hall with crow-stepped gables and paired dais bays',
      'Renaissance palace around the open Lion’s Den',
      'Truncated twin-drum gatehouse and elongated fortified site',
    ],
  },
  sourceFacts: {
    mapIdentity:
      'way/100542995 exact Wikidata Q756268; named component footprints including relation/1083531 palace',
    mappedCourtyard: true,
    surveyedVerticalDatum: false,
  },
  reconstruction: {
    basis:
      'Attributed OSM component footprints and Historic Environment Scotland architectural inventory, route plan and exterior photographs',
    scope:
      'Exterior ensemble and simplified defensive enclosure; interiors, gardens outside the wall, statues and volcanic cliff excluded',
    referenceState:
      'Present-day restored Great Hall and truncated Forework; not a reconstruction of the tall medieval gatehouse',
  },
  scaleBasis:
    'Mapped plan dimensions. Synthetic lower-bailey datum Y=0; inner close Y=8. Hall eaves 22m and chimney 34m, palace ridge 27.5m, gatehouse wallwalk 15m above datum are proportional photographic estimates, not surveyed heights.',
  refs: [
    'https://portal.historicenvironment.scot/designation/SM90291',
    'https://www.historicenvironment.scot/publications/all/publication/?publicationId=420047e5-b241-4318-9127-a5f400f193f9',
    'https://app-hes-pubs-prod-neu-01.azurewebsites.net/api/file/1a36b0f6-f3e3-4374-b1d2-a603009ca16a',
    'https://www.openstreetmap.org/way/100542995',
    'https://www.openstreetmap.org/relation/1083531',
  ],
  sourceDocuments: ['map-frame.json', 'reference-metadata.json'],
  dataAttribution:
    'Footprints © OpenStreetMap contributors, ODbL-1.0. HES guide images are linked visual evidence only; no third-party images or meshes are redistributed.',
  nativeAxes: {
    up: '+Y',
    longitudinal: '+Z southeast toward the entrance',
    front: '+Z southeast',
    origin: 'Mapped compound frame center; Y=0 synthetic lower-bailey datum',
  },
  geographic: () => ({
    status: 'research-only',
    replaceFootprint: false,
    reviewStatus: 'Signed component frame; steep castle-rock terrain and elevation datum pending',
  }),
  geographicNote:
    'The historic castle boundary encloses multiple buildings and open space. Do not replace it with a single generic building. Exact-QID parts anchor this ensemble, but vertical fit and approach-gate alignment need real-site review.',
  limitations: [
    'Heights, relative court levels, roof shapes, ornamental rhythms and small turrets are photographic approximations. Individual Renaissance sculptures and interior rooms are omitted.',
    'Northern magazines and outer ancillary buildings are simplified; the esplanade, cliffs and off-site gardens are excluded.',
    'Context renders use synthetic procedural neighbors. Geographic placement, continuous-motion shimmer and physical-device performance remain unmeasured.',
  ],
  importReason:
    'Preserve the mapped compound and identity features; each level removes selected detail within medium-fi budgets.',
  mediumFiContext: { scale: '2.1', neighborStyle: 'molen.worldgen.catalog.english_terrace' },
  camera: { position: [225, 150, 285], lookAt: [0, 8, 5], fov: 43 },
  qaCameras: [
    { name: 'forework-and-ochre-hall', position: [70, 35, 148], lookAt: [7, 16, 41] },
    { name: 'inner-close', position: [-12, 14, 8], lookAt: [21, 19, 9] },
    { name: 'compound-plan', position: [0, 475, 0], lookAt: [0, 0, 0] },
    { name: 'lions-den-and-palace', position: [-87, 64, 96], lookAt: [-26, 15, 34] },
    { name: 'gate-passage', position: [1, 6.6, 90], lookAt: [6, 7, 60] },
    { name: 'north-bailey-and-chapel', position: [106, 65, -139], lookAt: [-4, 14, -18] },
  ],
};
