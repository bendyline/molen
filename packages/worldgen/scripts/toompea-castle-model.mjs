/** Mapped Toompea exterior. Y=0 is Castle Square; western masonry descends below it. */
import './install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import earcut from 'earcut';
import { loft, normalFor, radialRing } from './authored-structure-mesh.mjs';
import { box } from './structure-mesh.mjs';

const frame = JSON.parse(
  readFileSync(
    new URL(
      '../../../content/worldgen/source/places/ud/ud9/n0263_toompea_castle/map-frame.json',
      import.meta.url,
    ),
  ),
);
const part = (id) => frame.parts.find((p) => p.id.endsWith(`/${id}`));
export const toompeaPalette = {
  pink: '#e6b4ae',
  cream: '#eee6d9',
  grey: '#adb4ba',
  stone: '#c9bc9f',
  roof: '#aa6e54',
  metal: '#68716c',
  glass: '#4d6178',
  trim: '#49545e',
  paving: '#b8b0a0',
  gold: '#cfb66b',
  blue: '#3985be',
  black: '#3b3e42',
  white: '#eeeae2',
};
const colors = Object.fromEntries(
  Object.entries(toompeaPalette).map(([k, h]) => [
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
    rot = ([u, y, v]) => [c * u + s * v, y, -s * u + c * v];
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
const rect = (o, s, x, y, z, w, h, d, c) =>
  box(o, s, [x - w / 2, y, z - d / 2], [x + w / 2, y + h, z + d / 2], colors[c]);
function face(o, s, p, c, up = false) {
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
      colors[c],
    );
  }
}
function floor(o, rings, y, c = 'paving', s = 'limestone') {
  const pts = rings.flat(),
    holes = [];
  let offset = rings[0].length;
  for (const r of rings.slice(1)) {
    holes.push(offset);
    offset += r.length;
  }
  const indices = earcut(pts.flat(), holes, 2);
  for (let i = 0; i < indices.length; i += 3)
    face(
      o,
      s,
      indices.slice(i, i + 3).map((j) => [pts[j][0], y, pts[j][1]]),
      c,
      true,
    );
}
function shell(o, outer, holes, base, top, c = 'pink', s = 'plaster') {
  const rs = [ring(outer), ...holes.map((p) => ring(p, true))];
  for (const r of rs)
    for (let i = 0; i < r.length; i++) {
      const a = r[i],
        b = r[(i + 1) % r.length];
      face(
        o,
        s,
        [
          [a[0], base, a[1]],
          [b[0], base, b[1]],
          [b[0], top, b[1]],
          [a[0], top, a[1]],
        ],
        c,
      );
    }
  floor(o, rs, top, c, s);
}
function hip(o, p, eave, ridge, c = 'roof', slot = 'tile', inset = 0.13) {
  const a = mix(p[0], p[3], 0.5),
    b = mix(p[1], p[2], 0.5),
    r0 = mix(a, b, inset),
    r1 = mix(a, b, 1 - inset);
  for (const q of [
    [p[0], p[1], r1, r0],
    [p[2], p[3], r0, r1],
    [p[3], p[0], r0],
    [p[1], p[2], r1],
  ])
    face(
      o,
      slot,
      q.map((v, i) => [v[0], i < 2 ? eave : ridge, v[1]]),
      c,
      true,
    );
}
function panel(o, x, y, z, w, h, c, s = 'plaster') {
  face(
    o,
    s,
    [
      [x - w / 2, y, z],
      [x + w / 2, y, z],
      [x + w / 2, y + h, z],
      [x - w / 2, y + h, z],
    ],
    c,
  );
}
function arch(o, x, y, z, w, h, c, s = 'glass', segments = 6) {
  const r = w / 2,
    cy = y + h - r;
  face(
    o,
    s,
    [
      [x - r, y, z],
      [x + r, y, z],
      ...Array.from({ length: segments + 1 }, (_, i) => [
        x + r * Math.cos((i * Math.PI) / segments),
        cy + r * Math.sin((i * Math.PI) / segments),
        z,
      ]),
    ],
    c,
  );
}
function window(o, x, y, z, w, h, d, { arched = false, dark = false } = {}) {
  const p = arched ? arch : panel;
  if (d >= 2) p(o, x, y - 0.16, z, w + 0.36, h + 0.32, dark ? 'trim' : 'cream', 'plaster');
  p(o, x, y, z + 0.025, w, h, 'glass', 'glass');
  if (d === 3 && w >= 1.4) {
    // Broad, coplanar color strips give the crossbar without a closed mesh per frame.
    panel(o, x, y, z + 0.06, 0.23, h, 'cream');
    panel(o, x, y + h * 0.56, z + 0.06, w, 0.23, 'cream');
  }
}
function windows(o, p, base, top, d, c = 'pink', options = {}) {
  if (!d) return;
  const r = ring(p, options.courtyard);
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (l < 4 || options.skip?.(a, b)) continue;
    const g = edge(o, a, b),
      n = Math.max(1, Math.round(l / 4.5));
    for (let j = 0; j < n; j++)
      for (const y of top - base > 11
        ? [base + 1.25, base + 5.8, top - 3.15]
        : [base + 1.2, top - 3.2])
        window(g, ((j + 0.5) * l) / n, y, 0.05, 1.45, 2.1, d, { dark: c === 'grey' });
  }
}
function flag(o, x, z, base, height, width, d) {
  rect(o, 'foliage', x, base, z, d ? 0.26 : 0.4, height, 0.28, 'white');
  const top = base + height - 0.6,
    fh = width * 0.62;
  for (let stripe = 0; stripe < 3; stripe++) {
    const c = ['blue', 'black', 'white'][stripe],
      n = d ? 4 : 1;
    for (let i = 0; i < n; i++) {
      const u = i / n,
        v = (i + 1) / n,
        a = [
          x + u * width,
          top - (stripe * fh) / 3 - u * 0.25,
          z + (d ? 0.35 * Math.sin(u * Math.PI * 2) : 0),
        ],
        b = [
          x + v * width,
          top - (stripe * fh) / 3 - v * 0.25,
          z + (d ? 0.35 * Math.sin(v * Math.PI * 2) : 0),
        ];
      const p = [a, b, [b[0], b[1] - fh / 3, b[2]], [a[0], a[1] - fh / 3, a[2]]];
      face(o, 'foliage', p, c);
      face(o, 'foliage', [...p].reverse(), c);
    }
  }
}
function tower(o, id, d, { base, top, console = false, flagged = false }) {
  const p = ring(part(id).outline),
    xs = p.map((v) => v[0]),
    zs = p.map((v) => v[1]),
    x = (Math.min(...xs) + Math.max(...xs)) / 2,
    z = (Math.min(...zs) + Math.max(...zs)) / 2;
  const radius = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs)) / 2,
    n = d === 0 ? 8 : d === 1 ? 12 : 24;
  loft(
    o,
    'limestone',
    [
      radialRing(base, radius * 0.93, radius * 0.93, n, [x, z]),
      radialRing(top - 4.5, radius * 0.97, radius * 0.97, n, [x, z]),
      radialRing(top - 3.6, radius * 1.04, radius * 1.04, n, [x, z]),
      radialRing(top, radius * 1.04, radius * 1.04, n, [x, z]),
    ],
    colors.stone,
  );
  if (console)
    loft(
      o,
      'limestone',
      [
        radialRing(base - 3, 0.55, 0.55, n, [x, z]),
        radialRing(base, radius * 0.93, radius * 0.93, n, [x, z]),
      ],
      colors.stone,
    );
  if (d) {
    const rr = radialRing(top, radius * 0.98, radius * 0.98, n, [x, z]);
    floor(o, [rr.map((p) => [p[0], p[2]])], top - 0.5, 'metal', 'tile');
    for (let i = 0; i < n; i++) {
      const a = (i * Math.PI * 2) / n,
        g = local(o, x + Math.sin(a) * radius, z + Math.cos(a) * radius, a);
      if (flagged && d >= 2) {
        // The crown's repeated pointed corbel rhythm is a shallow facet, not masonry blocks.
        face(
          g,
          'limestone',
          [
            [-0.5, top - 3.5, radius * 0.04 + 0.08],
            [0.5, top - 3.5, radius * 0.04 + 0.08],
            [0, top - 5.3, -0.35],
          ],
          'stone',
        );
      }
      if (i % (d === 1 ? 3 : 4) === 0)
        for (const y of flagged
          ? [base + 8, base + 19, base + 29, top - 1.6]
          : [base + 3, top - 2.3])
          window(g, 0, y, 0.08, 0.43, 1.55, 1);
      if (console && i % 2 === 0) rect(g, 'limestone', 0, top, 0, radius * 0.45, 0.7, 0.7, 'stone');
    }
  }
  if (flagged) {
    if (d) rect(o, 'plaster', x, top - 0.5, z, 3.1, 1.6, 2.4, 'cream');
    flag(o, x, z, top, 12, 5.3, d);
  }
}
function west(o, d) {
  const line = [
    [-64, -33],
    [-48, -36],
    [-8, -39],
    [27, -32],
    [42, -27],
    [67, -16],
  ];
  for (let i = 0; i < line.length - 1; i++) {
    const a = line[i],
      b = line[i + 1],
      g = edge(o, b, a),
      l = Math.hypot(b[0] - a[0], b[1] - a[1]),
      base = -12 + i,
      top = 13 + i;
    rect(g, 'limestone', l / 2, base, 0, l, top - base, 2.2, 'stone');
    if (d) {
      const bays = Math.max(1, Math.floor(l / 6));
      for (let j = 0; j < bays; j++) {
        const x = ((j + 0.5) * l) / bays;
        rect(g, 'limestone', x, top, 0, 1.4, 0.7, 2.3, 'stone');
        window(g, x, top - 5, 1.16, 1.4, 3, d);
        if (d >= 2) window(g, x, top - 10, 1.16, 0.6, 1.4, 1);
      }
      if (d >= 2 && i === 1)
        for (const x of [l * 0.2, l * 0.8])
          rect(g, 'limestone', x, base, 0.7, 2.7, 9, 3.7, 'stone');
    }
  }
  // Low west office range behind the stone curtain; raised ground floors are approximate.
  const p = part(1196525127).outline;
  shell(o, p, [], -1, 10, 'cream');
  hip(
    o,
    [
      [-48, -35],
      [-12, -35],
      [-12, -26],
      [-48, -28],
    ],
    10,
    13.4,
  );
  windows(o, p, -1, 10, d);
}
function palace(o, d) {
  const east = [
    [-63.82, 24.945],
    [18.571, 24.082],
    [18.707, 38.981],
    [-63.266, 39.425],
  ];
  const south = [
    [-65.466, -18.531],
    [-54.678, -18.531],
    [-54.678, 39.381],
    [-63.266, 39.425],
  ];
  shell(o, east, [], 0, 14);
  shell(o, south, [], 0, 14);
  hip(o, [east[0], east[1], east[2], east[3]], 14, 20);
  hip(o, [south[0], south[3], south[2], south[1]], 14, 20);
  // Remaining southern offices wrap the main open courtyard.
  const extra = [
    [-65.4, -18.5],
    [-64, -29],
    [-59, -35],
    [-48, -35],
    [-45.6, 16.5],
    [-29, 16.5],
    [-29, 24.6],
    [-55, 25],
  ];
  shell(o, extra, [], 0, 14, 'cream');
  hip(
    o,
    [
      [-59, -32],
      [-48, -32],
      [-46, 17],
      [-56, 18],
    ],
    14,
    19,
  );
  hip(
    o,
    [
      [-56, 17],
      [-29, 17],
      [-29, 25],
      [-55, 25],
    ],
    14,
    18.5,
  );
  if (d) {
    windows(o, extra, 0, 14, d, 'cream');
  }
  const facade = local(o, -22.6, 39.2, 0.0054),
    front = local(facade, 0, 1.55);
  // Central projection: a three-opening arcade supports the balcony and four upper bays.
  arcade(front, [-5.15, 0, 5.15], 2.15, 4.1, 15.3, 5, 3, d, 'pink');
  rect(front, 'plaster', 0, 5, 0, 15.3, 9, 3, 'pink');
  if (d) {
    // Recessed entrance doors sit behind the open arcade, on the palace elevation.
    for (const x of [-5.15, 0, 5.15]) window(facade, x, 0.15, 0.08, 3.5, 3.75, d, { arched: true });
    for (const x of [-5.4, -1.8, 1.8, 5.4]) {
      window(front, x, 6, 1.56, 2.05, 3.35, d, { arched: true });
      window(front, x, 11, 1.56, 1.95, 2.1, d);
    }
    for (const x of [-7.3, 7.3]) rect(front, 'plaster', x, 5, 1.8, 0.6, 8.8, 0.55, 'cream');
    rect(front, 'plaster', 0, 4.65, 2.1, 16.4, 0.5, 2.3, 'cream');
    rect(front, 'plaster', 0, 13.9, 1.65, 16, 0.6, 0.8, 'cream');
    rect(front, 'plaster', 0, 5.7, 3.05, 16, 0.25, 0.35, 'trim');
    if (d >= 2)
      for (let x = -7.7; x <= 7.7; x += 0.9)
        rect(front, 'plaster', x, 5.1, 3.05, 0.3, 0.65, 0.3, 'trim');
  }
  pediment(front, d);
  if (!d) return;
  // Main elevation uses separate ranges, preserving the central arcades as actual openings.
  for (const [x0, x1, n] of [
    [-40.5, -31.5, 2],
    [-31.5, -8.3, 5],
    [8.3, 31.5, 5],
    [31.5, 40.5, 2],
  ]) {
    const wing = local(facade, 0, Math.abs(x0) > 31 ? 0.12 : 0);
    for (let j = 0; j < n; j++) {
      const x = x0 + ((j + 0.5) * (x1 - x0)) / n;
      for (const [y, h] of [
        [1.2, 2.5],
        [6.2, 3],
        [11.1, 2],
      ])
        window(wing, x, y, 0.06, 1.6, h, d, { arched: y === 1.2 });
      if (d >= 2) {
        rect(wing, 'plaster', x + ((x1 - x0) / n) * 0.47, 4.8, 0.25, 0.55, 9.2, 0.4, 'cream');
        if (Math.abs(x) > 31)
          face(
            wing,
            'plaster',
            [
              [x - 1.15, 9.65, 0.3],
              [x + 1.15, 9.65, 0.3],
              [x, 10.35, 0.3],
            ],
            'cream',
          );
      }
    }
    for (const y of [4.65, 13.8])
      rect(wing, 'plaster', (x0 + x1) / 2, y, 0.18, x1 - x0, 0.35, 0.55, 'cream');
  }
  // End pediments are silhouettes, not ornament repeated across every bay.
  for (const x of [-36, 36]) {
    face(
      facade,
      'plaster',
      [
        [x - 5, 14, 0.1],
        [x + 5, 14, 0.1],
        [x, 17.6, 0.1],
      ],
      'cream',
    );
    if (d >= 2)
      face(
        facade,
        'plaster',
        [
          [x - 3.8, 14.4, 0.13],
          [x + 3.8, 14.4, 0.13],
          [x, 17.1, 0.13],
        ],
        'pink',
      );
  }
  const sg = edge(o, south[0], south[3]),
    sl = Math.hypot(south[0][0] - south[3][0], south[0][1] - south[3][1]);
  for (let i = 0; i < 11; i++)
    for (const [y, h] of [
      [1.2, 2.5],
      [6.2, 3],
      [11.1, 2],
    ])
      window(sg, ((i + 0.5) * sl) / 11, y, 0.08, 1.5, h, d);
  for (const y of [4.7, 13.8]) rect(sg, 'plaster', sl / 2, y, 0.15, sl, 0.4, 0.5, 'cream');
  if (d >= 2)
    for (let i = 0; i <= 11; i++)
      rect(sg, 'plaster', (i * sl) / 11, 4.7, 0.14, 0.55, 9.3, 0.5, 'cream');
  windows(o, east, 0, 14, d, 'pink', { skip: (a, b) => a[1] > 38 && b[1] > 38 });
  windows(o, south, 0, 14, d, 'pink', { skip: (a, b) => a[0] < -63 && b[0] < -63 });
}
function pediment(o, d) {
  const points = [
    [-8.2, 14.5],
    [-6.4, 14.8],
    [-4.8, 15.5],
    [-3.1, 16.9],
    [-2.6, 17.3],
    [-1.8, 17.2],
    [-1.5, 16.8],
    [-1.8, 16.4],
    [-0.7, 16.2],
    [-0.4, 18.2],
    [0.4, 18.2],
    [0.7, 16.2],
    [1.8, 16.4],
    [1.5, 16.8],
    [1.8, 17.2],
    [2.6, 17.3],
    [3.1, 16.9],
    [4.8, 15.5],
    [6.4, 14.8],
    [8.2, 14.5],
  ];
  const flat = [[-8.2, 14], ...points, [8.2, 14]],
    idx = earcut(flat.flat(), [], 2);
  for (let i = 0; i < idx.length; i += 3)
    face(
      o,
      'plaster',
      idx.slice(i, i + 3).map((j) => [flat[j][0], flat[j][1], 1.6]),
      'pink',
    );
  if (d) {
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i],
        b = points[i + 1];
      face(
        o,
        'plaster',
        [
          [a[0], a[1], 1.68],
          [b[0], b[1], 1.68],
          [b[0], b[1] + 0.26, 1.68],
          [a[0], a[1] + 0.26, 1.68],
        ],
        'cream',
      );
    }
    face(
      o,
      'foliage',
      [
        [-0.9, 15.05, 1.72],
        [0.9, 15.05, 1.72],
        [0.85, 16.25, 1.72],
        [-0.85, 16.25, 1.72],
      ],
      'gold',
    );
    if (d >= 2)
      for (const y of [15.23, 15.58, 15.93]) panel(o, 0, y, 1.75, 1.15, 0.2, 'blue', 'foliage');
    flag(o, 0, 1.4, 18.2, 4.6, 2.1, d);
  }
}
function arcade(o, centers, radius, height, width, top, depth, d, c = 'grey') {
  const n = d >= 2 ? 8 : 4,
    spring = height - radius,
    edges = [-width / 2, ...centers.flatMap((x) => [x - radius, x + radius]), width / 2];
  for (let i = 0; i < edges.length; i += 2)
    rect(o, 'plaster', (edges[i] + edges[i + 1]) / 2, 0, 0, edges[i + 1] - edges[i], top, depth, c);
  for (const x of centers) {
    for (const z of [-depth / 2, depth / 2])
      for (let i = 0; i < n; i++) {
        const a = (i * Math.PI) / n,
          b = ((i + 1) * Math.PI) / n,
          p = [
            [x + radius * Math.cos(b), spring + radius * Math.sin(b), z],
            [x + radius * Math.cos(a), spring + radius * Math.sin(a), z],
            [x + radius * Math.cos(a), top, z],
            [x + radius * Math.cos(b), top, z],
          ];
        face(o, 'plaster', z < 0 ? [...p].reverse() : p, c);
      }
    for (let i = 0; i < n; i++) {
      const a = (i * Math.PI) / n,
        b = ((i + 1) * Math.PI) / n;
      face(
        o,
        'plaster',
        [
          [x + radius * Math.cos(a), spring + radius * Math.sin(a), -depth / 2],
          [x + radius * Math.cos(a), spring + radius * Math.sin(a), depth / 2],
          [x + radius * Math.cos(b), spring + radius * Math.sin(b), depth / 2],
          [x + radius * Math.cos(b), spring + radius * Math.sin(b), -depth / 2],
        ],
        c,
      );
    }
    for (const sign of [-1, 1]) {
      const x0 = x + sign * radius,
        p = [
          [x0, 0, -depth / 2],
          [x0, 0, depth / 2],
          [x0, spring, depth / 2],
          [x0, spring, -depth / 2],
        ];
      face(o, 'plaster', sign < 0 ? p : [...p].reverse(), c);
    }
  }
}
function parliament(o, d) {
  const p = part(3280904),
    outer = [0, 2, 3, 4, 5, 10, 13, 15, 16, 17, 18].map((i) => p.outline[i]),
    hole = ring(p.holes[0]);
  shell(o, outer, [hole], 0, 16, 'grey');
  floor(o, [hole], 0);
  const r = [
    [-7.2, -35.4],
    [-10.6, 19.7],
    [6.2, 19.5],
    [8, -30.4],
  ];
  hip(o, r, 16, 20);
  hip(
    o,
    [
      [-6, -35.4],
      [40, -25],
      [36, -16],
      [8, -24],
    ],
    16,
    20,
  );
  hip(
    o,
    [
      [40, -25],
      [38, 13.5],
      [25.7, 0.8],
      [27.9, -16.7],
    ],
    16,
    20,
  );
  hip(
    o,
    [
      [6.9, 12.9],
      [38.1, 13.5],
      [25.7, 0.8],
      [14.45, 0.67],
    ],
    16,
    20,
  );
  if (d)
    windows(o, outer, 0, 16, d, 'grey', {
      skip: (a, b) => a[0] < -7 && b[0] < -7 && Math.abs(a[1] - b[1]) > 50,
    });
  // Main chamber elevation faces west into the large court, with three arched entrances.
  const g = edge(o, [-7.865, -35.344], [-10.6, 19.685]),
    l = Math.hypot(2.735, 55.029);
  // A shallow external porch preserves the three open approaches without promising interiors.
  const porch = local(g, l * 0.52, 0.95);
  arcade(porch, [-6, 0, 6], 2.1, 4.4, 18.6, 5, 1.8, d);
  if (d) {
    for (let i = 0; i < 12; i++) {
      const x = ((i + 0.5) * l) / 12;
      window(g, x, 12.7, 0.08, 1.35, 2, d, { dark: true });
      if (Math.abs(x - l * 0.52) > 10)
        for (const y of [1.3, 6.2]) window(g, x, y, 0.08, 1.5, 2.8, d, { dark: true });
    }
    for (const x of [-6, 0, 6]) {
      arch(porch, x, 6, 1, 2.9, 5.5, 'trim', 'plaster');
      window(porch, x, 6.3, 1.03, 2.3, 4.9, d, { arched: true });
      if (d >= 2)
        for (const side of [-1, 1])
          for (let y = 6.5; y < 9.9; y += 0.65)
            face(
              porch,
              'plaster',
              [
                [x + side * 1.65, y, 1.08],
                [x + side * 1.65, y + 0.65, 1.08],
                [x + side * 1.25, y + 0.325, 1.08],
              ],
              'trim',
            );
    }
    const count = d === 1 ? 16 : 30;
    for (let i = 0; i < count; i++)
      face(
        g,
        'plaster',
        [
          [(i * l) / count, 15.9, 0.08],
          [((i + 1) * l) / count, 15.9, 0.08],
          [((i + 0.5) * l) / count, 15.15, 0.1],
        ],
        'trim',
      );
    if (d >= 2) windows(o, hole, 0, 16, d, 'grey', { courtyard: true });
    for (const t of [0.22, 0.5, 0.78]) {
      const q = local(g, l * t, -4.1);
      arch(q, 0, 17.1, 0, 2.5, 1.4, 'cream', 'plaster');
      arch(q, 0, 17.2, 0.04, 2.1, 1.15, 'glass', 'glass');
    }
  }
}
function north(o, d) {
  const buildings = [
    { id: 3502563, base: 0, eave: 13.5, roof: 17, color: 'cream', corners: [1, 0, 5, 2] },
    { id: 1183974193, base: -3, eave: 10.5, roof: 14, color: 'cream', corners: [2, 0, 9, 4] },
    { id: 1183974194, base: 0, eave: 13.5, roof: 17, color: 'cream', corners: [7, 0, 4, 6] },
    { id: 1184227445, base: -3, eave: 13, roof: 16, color: 'cream', corners: [1, 2, 8, 0] },
    { id: 1184227444, base: -3, eave: 5, roof: 13, color: 'grey', corners: [1, 2, 4, 0] },
    { id: 1181395223, base: -4, eave: 4, roof: 9, color: 'cream', corners: [1, 0, 5, 2] },
  ];
  for (const b of buildings) {
    const p = part(b.id).outline;
    shell(o, p, [], b.base, b.eave, b.color);
    if (d) windows(o, p, b.base, b.eave, d, b.color);
    // Roof corners use mapped points. Small irregular ledges stay flat instead of overshooting.
    hip(
      o,
      b.corners.map((i) => p[i]),
      b.eave,
      b.roof,
    );
  }
  const wall = part(1181395222).outline;
  shell(o, wall, [], -7, 20, 'stone', 'limestone');
  // Plain connecting range north of the palace, with mapped passage kept below it.
  rect(o, 'plaster', -2.3, 4.5, 22, 16, 9, 4.5, 'cream');
  if (d >= 2) for (const x of [-8, -3, 2]) window(o, x, 7, 24.3, 1.4, 2.5, d);
}
export function buildToompeaRuntime(o, level) {
  const d = { skyline: 0, district: 1, street: 2, closeup: 3 }[level] ?? 3;
  // Courtyard pavement at the declared attachment plane. The actual cliff is terrain-owned.
  for (const h of frame.geometry.holes) floor(o, [h], 0);
  west(o, d);
  palace(o, d);
  parliament(o, d);
  north(o, d);
  tower(o, 3502550, d, { base: -12, top: 33.6, flagged: true });
  tower(o, 3502551, d, { base: 17, top: 25, console: true });
  tower(o, 3502547, d, { base: -3, top: 25 });
  if (d >= 2)
    for (const [x, z, y] of [
      [-56, 7, 18],
      [-41, 31, 18],
      [-2, 30, 18],
      [58, 1, 14],
      [32, -21, 19],
      [4, -8, 19],
      [5, 8, 19],
    ]) {
      rect(o, 'plaster', x, y, z, 1.3, 3.6, 1.5, 'cream');
      rect(o, 'plaster', x, y + 3.4, z, 1.65, 0.35, 1.8, 'cream');
    }
}
export const buildToompeaSkyline = (o) =>
  buildToompeaRuntime(
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
export const toompeaStudy = {
  id: 'N0263',
  key: 'toompea_castle',
  title: 'Toompea Castle',
  category: 'castle',
  wikidataId: 'Q859010',
  mapFrame: 'map-frame.json',
  fidelityTarget: 'medium-fi',
  build: (o) => buildToompeaRuntime(o),
  brief:
    'Mapped Toompea compound with pink east and south palace fronts, Baroque central gable, open courts, grey Riigikogu building, limestone western wall, Tall Hermann flag tower, Landskrone and console-mounted Pilsticker.',
  appearance: {
    standard: 'docs-src/guide/medium-fi.md',
    paletteSrgb: toompeaPalette,
    colorEncoding: 'sRGB decoded to linear COLOR_0',
    materialBudget: 5,
    identityFeatures: [
      'Tall Hermann with its broad cylindrical crown and Estonian tricolor',
      'Pink palace with a curved central gable, balcony and three entrance arches',
      'Limestone west curtain and grey courtyard parliament with triangular cornice',
    ],
  },
  sourceFacts: {
    mapIdentity:
      'relation/3502552 exact Wikidata Q859010; separate named tower and building-part polygons',
    mappedCourtyards: 3,
    mappedTallHermannHeightMeters: 45.6,
    mappedLandskroneHeightMeters: 28,
    mappedPilstickerHeightMeters: 32,
    publishedWesternFacadeLengthMeters: 149,
    publishedFlagElevationAboveSeaMeters: 95,
    surveyedVerticalDatum: false,
  },
  reconstruction: {
    basis:
      'Attributed OSM component footprints and heights, Riigikogu architectural descriptions and official exterior photographs',
    scope:
      'Present-day exterior compound; no room interiors, adjacent cathedral, Governor’s Garden or cliff terrain',
    referenceState: 'Three surviving towers; the demolished Stür den Kerl is deliberately absent',
  },
  scaleBasis:
    'Mapped horizontal scale and component height tags. Castle Square is Y=0. Tall Hermann starts at -12m and its stone crown is 33.6m, retaining 45.6m tower height; a reconstructed 12m mast reaches 45.6m above the square. Northern bases -7m/-3m and all inter-part vertical offsets are photographic estimates, not an elevation survey. The published 95m flag elevation is not used as model height.',
  refs: [
    'https://www.riigikogu.ee/en/visit-us/toompea-castle/toompea-castle-riigikogu-building/',
    'https://www.riigikogu.ee/en/visit-us/toompea-castle/tall-hermann-toompea-towers/',
    'https://www.riigikogu.ee/en/visit-us/photos-castle-riigikogu/',
    'https://www.openstreetmap.org/relation/3502552',
    'https://www.openstreetmap.org/relation/3502550',
  ],
  sourceDocuments: ['map-frame.json', 'reference-metadata.json'],
  dataAttribution:
    'Footprints © OpenStreetMap contributors, ODbL-1.0. Riigikogu photographs are linked visual evidence, not redistributed textures or geometry.',
  nativeAxes: {
    up: '+Y',
    longitudinal: '+X north along the palace',
    front: '+Z east toward Castle Square',
    origin:
      'Mapped compound center; Y=0 Castle Square attachment plane; western foundations extend to Y=-12',
  },
  geographic: () => ({
    status: 'research-only',
    replaceFootprint: false,
    groundModelY: 0,
    reviewStatus: 'Signed mapped frame; cliff, corner ground datums and real-site contact pending',
  }),
  geographicNote:
    'Exact-QID component footprints resolve tower identity and the east-facing palace. Western foundations extend below the eastern street datum. Require real terrain review before activation; the surrounding gardens and cathedral are excluded.',
  limitations: [
    'Heights tagged in OSM use different local ground levels; reconstructed offsets, roof junctions and northern terrain require geographic review.',
    'The Baroque gable, state arms, triangular ornament and stone corbels are simplified medium-fi geometry. Flags are static geometric tricolors. No navigable interiors.',
    'Synthetic neighbor renders do not verify castle-rock fit, continuous-motion shimmer or physical-device performance.',
  ],
  importReason:
    'Preserve mapped courtyards, the three surviving towers and distinct palace/parliament elevations within the medium-fi budgets.',
  mediumFiContext: { scale: '2.1', neighborStyle: 'molen.worldgen.catalog.bohemian_townhouse' },
  camera: { position: [-146, 83, 188], lookAt: [-8, 12, 0], fov: 43 },
  qaCameras: [
    { name: 'east-palace-and-gable', position: [-24, 16, 120], lookAt: [-23, 9, 38] },
    { name: 'west-wall-and-hermann', position: [-105, 40, -112], lookAt: [-10, 10, -26] },
    { name: 'parliament-courtyard', position: [-41, 9, 7], lookAt: [-9, 9, 0] },
    { name: 'mapped-courtyard-plan', position: [0, 240, 0], lookAt: [0, 0, 0] },
    { name: 'hermann-crown-and-flag', position: [-92, 44, -60], lookAt: [-64, 34, -33] },
    { name: 'north-console-and-landskrone', position: [126, 27, 12], lookAt: [57, 12, 6] },
  ],
};
