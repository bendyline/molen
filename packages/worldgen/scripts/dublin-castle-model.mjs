/** OPW Dublin Castle campus: open courts, Gothic chapel, two medieval towers and clock pavilions. */
import './install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import earcut from 'earcut';
import { normalFor } from './authored-structure-mesh.mjs';
import { box } from './structure-mesh.mjs';

const frame = JSON.parse(
  readFileSync(
    new URL(
      '../../../content/worldgen/source/places/gc/gc7/n0275_dublin_castle/map-frame.json',
      import.meta.url,
    ),
  ),
);
export const dublinPalette = {
  stone: '#bdb7a6',
  trim: '#ded8c7',
  brick: '#ba8269',
  roof: '#68717a',
  copper: '#82b8a0',
  glass: '#4d6178',
  paving: '#b5afa1',
  grass: '#8aa065',
  red: '#b86f62',
  ochre: '#dbc480',
  blue: '#8cabc1',
  cream: '#e6decc',
  dark: '#4f5559',
};
const colors = Object.fromEntries(
  Object.entries(dublinPalette).map(([key, hex]) => [
    key,
    hex
      .slice(1)
      .match(/../g)
      .map((v) => {
        const s = parseInt(v, 16) / 255;
        return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
      }),
  ]),
);
const rect = (o, x, y, z, w, h, depth, col = 'stone', slot = 'limestone') =>
  box(o, slot, [x - w / 2, y, z - depth / 2], [x + w / 2, y + h, z + depth / 2], colors[col]);
function local(o, x, z, angle = 0) {
  const c = Math.cos(angle),
    s = Math.sin(angle);
  const rot = ([u, y, v]) => [c * u + s * v, y, -s * u + c * v];
  return Object.fromEntries(
    ['addQuad', 'addTriangle', 'addConvexPolygon'].map((k) => [
      k,
      (slot, ref, p, n, uv, col) =>
        o[k](
          slot,
          ref,
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
function face(o, points, col = 'stone', slot = 'limestone', target) {
  let p = points;
  if (target && normalFor(...p.slice(0, 3)).reduce((s, v, i) => s + v * target[i], 0) < 0)
    p = [...p].reverse();
  for (let i = 1; i < p.length - 1; i++) {
    const t = [p[0], p[i], p[i + 1]],
      n = normalFor(...t);
    if (Math.hypot(...n) < 0.5) continue;
    const axis = Math.abs(n[1]) > 0.7 ? 1 : Math.abs(n[0]) > Math.abs(n[2]) ? 0 : 2;
    o.addTriangle(
      slot,
      'palette:#ffffff',
      t,
      n,
      t.map((v) => (axis === 1 ? [v[0], v[2]] : axis === 0 ? [v[2], v[1]] : [v[0], v[1]])),
      colors[col],
    );
  }
}
function slab(o, loops, heights, col = 'paving', slot = 'limestone') {
  const p = loops.flat(),
    holes = [];
  let total = loops[0].length;
  for (let i = 1; i < loops.length; i++) {
    holes.push(total);
    total += loops[i].length;
  }
  const ids = earcut(p.flat(), holes, 2),
    ys = loops.flatMap((l, i) => l.map(() => heights[i]));
  for (let i = 0; i < ids.length; i += 3)
    face(
      o,
      ids.slice(i, i + 3).map((j) => [p[j][0], ys[j], p[j][1]]),
      col,
      slot,
      [0, 1, 0],
    );
}
function edgeFrame(o, a, b) {
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  return {
    length,
    q: local(o, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, Math.atan2(b[1] - a[1], a[0] - b[0])),
  };
}
function pane(o, x, y, z, width, height, d, col = 'glass') {
  face(
    o,
    [
      [x - width / 2, y, z],
      [x + width / 2, y, z],
      [x + width / 2, y + height, z],
      [x - width / 2, y + height, z],
    ],
    col,
    'glass',
    [0, 0, 1],
  );
  if (d < 3) return;
  // Planar broad strips avoid uploading hidden sides on hundreds of repeated window frames.
  const strip = (left, bottom, right, top) =>
    face(
      o,
      [
        [left, bottom, z + 0.12],
        [right, bottom, z + 0.12],
        [right, top, z + 0.12],
        [left, top, z + 0.12],
      ],
      'trim',
      'limestone',
      [0, 0, 1],
    );
  strip(x - width / 2 - 0.46, y, x - width / 2, y + height);
  strip(x + width / 2, y, x + width / 2 + 0.46, y + height);
  strip(x - width / 2 - 0.46, y - 0.46, x + width / 2 + 0.46, y);
  strip(x - width / 2 - 0.46, y + height, x + width / 2 + 0.46, y + height + 0.46);
}
function gable(o, w, depth, y, top, col = 'roof', wall = 'stone') {
  for (const s of [-1, 1]) {
    face(
      o,
      [
        [-w / 2, y, (s * depth) / 2],
        [w / 2, y, (s * depth) / 2],
        [0, top, (s * depth) / 2],
      ],
      wall,
      'limestone',
      [0, 0, s],
    );
    face(
      o,
      [
        [(s * w) / 2, y, -depth / 2],
        [(s * w) / 2, y, depth / 2],
        [0, top, depth / 2],
        [0, top, -depth / 2],
      ],
      col,
      'slate',
      [s, 1, 0],
    );
  }
}

function drum(o, rings, n, col = 'stone', slot = 'limestone', cap = true) {
  const loop = (r) =>
    Array.from({ length: n }, (_, i) => [
      r * Math.sin((i * 2 * Math.PI) / n),
      r * Math.cos((i * 2 * Math.PI) / n),
    ]);
  for (let j = 1; j < rings.length; j++) {
    const [lo, r0] = rings[j - 1],
      [hi, r1] = rings[j],
      a = loop(r0),
      b = loop(r1);
    for (let i = 0; i < n; i++) {
      const k = (i + 1) % n;
      face(
        o,
        [
          [...a[i].slice(0, 1), lo, a[i][1]],
          [a[k][0], lo, a[k][1]],
          [b[k][0], hi, b[k][1]],
          [b[i][0], hi, b[i][1]],
        ],
        col,
        slot,
        [a[i][0] + a[k][0], 0, a[i][1] + a[k][1]],
      );
    }
  }
  if (cap) slab(o, [loop(rings.at(-1)[1])], [rings.at(-1)[0]], col, slot);
}
function pointed(o, x, y, z, w, h, d) {
  face(
    o,
    [
      [x - w / 2, y, z],
      [x + w / 2, y, z],
      [x + w / 2, y + h * 0.68, z],
      [x, y + h, z],
      [x - w / 2, y + h * 0.68, z],
    ],
    'glass',
    'glass',
    [0, 0, 1],
  );
  if (d === 3) {
    for (const s of [-1, 1])
      rect(o, x + s * (w / 2 + 0.23), y, z + 0.1, 0.46, h * 0.69, 0.46, 'trim');
    if (y >= 0.46) rect(o, x, y - 0.46, z + 0.1, w + 0.92, 0.46, 0.5, 'trim');
    // Only a broad central tracery member survives the campus' 0.15% detail scale.
    rect(o, x, y, z + 0.12, 0.46, h * 0.78, 0.46, 'trim');
  }
}
function archScreen(o, width, depth, top, spring, peak, d) {
  const steps = d >= 2 ? 8 : 4;
  for (const z of [-depth / 2, depth / 2]) {
    const profile = [
      [-width / 2, 0],
      [-width * 0.29, 0],
    ];
    for (let i = 0; i <= steps; i++) {
      const u = -1 + (2 * i) / steps;
      profile.push([
        u * width * 0.29,
        spring + Math.sqrt(Math.max(0, 1 - u * u)) * (peak - spring),
      ]);
    }
    profile.push([width * 0.29, 0], [width / 2, 0]);
    for (let i = 1; i < profile.length; i++) {
      const a = profile[i - 1],
        b = profile[i];
      if (a[0] === b[0]) continue;
      face(
        o,
        [
          [a[0], a[1], z],
          [b[0], b[1], z],
          [b[0], top, z],
          [a[0], top, z],
        ],
        'trim',
        'limestone',
        [0, 0, z],
      );
    }
    if (d >= 2) {
      // Broad rustication, restricted to gate piers rather than a grid of stone boxes.
      for (const x of [-width * 0.4, width * 0.4])
        for (const y of [1.3, 3.1, 4.9])
          rect(o, x, y, z + Math.sign(z) * 0.12, width * 0.17, 0.46, 0.46, 'stone');
    }
  }
  for (const s of [-1, 1]) rect(o, s * width * 0.395, 0, 0, width * 0.21, top, depth, 'trim');
  rect(o, 0, top - 0.5, 0, width, 0.5, depth, 'trim');
}
function range(o, r, d, painted = false) {
  const [a, b] = r.ends,
    length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const q = local(o, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, Math.atan2(a[1] - b[1], b[0] - a[0]));
  rect(
    q,
    0,
    0,
    0,
    length,
    r.wallTop,
    r.depth,
    r.color ?? 'brick',
    r.color === 'stone' ? 'limestone' : 'brick',
  );
  gable(
    local(q, 0, 0, Math.PI / 2),
    r.depth + 0.6,
    length + 0.6,
    r.wallTop,
    r.roofTop,
    'roof',
    'stone',
  );
  if (painted) {
    // Existing garden-facing painted sections; no repainting of courtyard brick facades.
    for (let i = 0; i < 3; i++) {
      const left = -length / 2 + (i * length) / 3,
        right = left + length / 3;
      face(
        q,
        [
          [left, 3.9, r.depth / 2 + 0.015],
          [right, 3.9, r.depth / 2 + 0.015],
          [right, r.wallTop, r.depth / 2 + 0.015],
          [left, r.wallTop, r.depth / 2 + 0.015],
        ],
        ['ochre', 'red', 'cream'][i],
        'plaster',
        [0, 0, 1],
      );
    }
  }
  if (!d) return;
  const rows = r.wallTop > 12 ? [1.8, 6.5, 11.5] : [1.4, 4.7];
  for (const s of [-1, 1]) {
    const f = local(q, 0, s * (r.depth / 2 + 0.03), s < 0 ? Math.PI : 0);
    const count = Math.max(3, Math.floor(length / (d === 1 ? 8 : 3.8)));
    for (let i = 0; i < count; i++) {
      const x = -length / 2 + ((i + 0.5) * length) / count;
      for (const y of rows)
        pane(f, x, y, 0, 1.5, y > 5 ? 2.5 : 2.1, d === 3 && i % 3 === 1 && y === 6.5 ? 3 : 2);
    }
    rect(f, 0, r.wallTop - 0.6, 0.1, length, 0.6, 0.6, 'trim');
    if (d >= 2) rect(f, 0, 5.5, 0.05, length, 0.46, 0.55, 'trim');
  }
  if (d >= 2) {
    const count = Math.max(1, Math.floor(length / 22));
    for (let i = 0; i < count; i++) {
      const x = -length / 2 + ((i + 0.5) * length) / count;
      rect(q, x, r.roofTop - 1.8, -r.depth * 0.16, 1.4, 3.6, 1.5, 'brick', 'brick');
      if (d === 3) rect(q, x, r.roofTop + 1.4, -r.depth * 0.16, 1.9, 0.46, 1.9, 'trim');
    }
  }
}
function clock(o, x, y, z, radius, d) {
  const n = d >= 2 ? 16 : 8;
  const p = Array.from({ length: n }, (_, i) => [
    x + radius * Math.sin((i * 2 * Math.PI) / n),
    y + radius * Math.cos((i * 2 * Math.PI) / n),
    z,
  ]);
  face(o, p, 'dark', 'glass', [0, 0, 1]);
  // Clock hands, not subpixel hour ticks, carry recognition.
  rect(o, x, y, z + 0.06, 0.46, radius * 0.85, 0.46, 'cream');
  rect(o, x - radius * 0.45, y, z + 0.06, radius * 0.9, 0.46, 0.46, 'cream');
}
function bedford(o, d) {
  const t = frame.controls.bedford,
    q = local(o, ...t.center, t.heading),
    [w, depth] = t.plan;
  const central = 15.5;
  for (const s of [-1, 1])
    rect(q, (s * (central + w)) / 4, 0, 0, (w - central) / 2, t.wallTop, depth, 'brick', 'brick');
  for (const x of [-5.15, 0, 5.15]) archScreen(local(q, x, 0), 5.15, depth, 5.4, 2.6, 4.25, d);
  rect(q, 0, 5.4, 0, central + 0.6, 0.5, depth + 0.8, 'trim');
  rect(q, 0, 5.9, -depth / 2 + 0.5, central, 4.6, 1, 'brick', 'brick');
  for (const x of [-7.2, -2.4, 2.4, 7.2]) {
    const c = local(q, x, depth / 2 + 0.3);
    drum(
      c,
      [
        [5.9, 0.6],
        [10.1, 0.48],
      ],
      d >= 2 ? 8 : 4,
      'trim',
    );
    if (d >= 2) rect(c, 0, 10.1, 0, 1.3, 0.55, 1.2, 'trim');
  }
  gable(local(q, 0, 0, Math.PI / 2), depth + 0.8, w + 0.8, 10.5, 13.8, 'roof', 'brick');
  face(
    q,
    [
      [-8.4, 10.5, depth / 2 + 0.65],
      [8.4, 10.5, depth / 2 + 0.65],
      [0, 14.6, depth / 2 + 0.65],
    ],
    'trim',
    'limestone',
    [0, 0, 1],
  );
  rect(q, 0, 12.5, 0, 8.7, 4.1, 8.7, 'trim');
  drum(
    q,
    [
      [16.6, 3.85],
      [27.8, 3.85],
      [28.5, 4.7],
    ],
    8,
    'stone',
  );
  drum(
    q,
    [
      [28.5, 4.7],
      [29, 4.45],
      [29.8, 3.3],
      [30.8, 2],
      [31.8, 1.6],
      [32.7, 1.45],
      [33.5, 0.55],
    ],
    d >= 2 ? 16 : 8,
    'copper',
    'patina',
  );
  rect(q, 0, 33.5, 0, 0.5, 0.5, 0.5, 'trim');
  if (d) {
    for (const s of [-1, 1]) {
      const f = local(q, 0, s * (depth / 2 + 0.04), s < 0 ? Math.PI : 0);
      for (const x of [-11.4, 11.4]) for (const y of [1.4, 6.8]) pane(f, x, y, 0, 1.8, 2.6, d);
    }
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2,
        f = local(q, Math.sin(a) * 3.87, Math.cos(a) * 3.87, a);
      clock(f, 0, 25.4, 0, 1.35, d);
      if (d >= 2) pointed(f, 0, 18.2, 0, 1.65, 4.2, 0);
    }
    if (d >= 2)
      for (let i = 0; i < 8; i++) {
        const a = (i * 2 * Math.PI) / 8;
        drum(
          local(q, Math.sin(a) * 4, Math.cos(a) * 4),
          [
            [17, 0.5],
            [23.1, 0.5],
          ],
          6,
          'trim',
        );
      }
  }
  for (const s of [-1, 1]) {
    const g = local(q, s * 22.5, 0);
    archScreen(g, 10.5, 3.8, 8.7, 3.6, 6.4, d);
    face(
      g,
      [
        [-5.6, 8.7, 2.1],
        [5.6, 8.7, 2.1],
        [0, 11.4, 2.1],
      ],
      'trim',
      'limestone',
      [0, 0, 1],
    );
    if (d >= 2) {
      rect(g, 0, 11.4, 0, 1.6, 0.65, 1.5, 'trim');
      // Broad stylized Justice/Fortitude figures; fine attributes are deliberately omitted.
      drum(
        g,
        [
          [12.05, 0.65],
          [14.2, 0.48],
        ],
        6,
        'stone',
      );
      drum(
        g,
        [
          [14.2, 0.48],
          [15.1, 0.4],
        ],
        6,
        'stone',
      );
    }
  }
}
function medievalTowers(o, d) {
  const r = frame.controls.record,
    q = local(o, ...r.center),
    n = d >= 2 ? 24 : d ? 16 : 12;
  drum(
    q,
    [
      [0, r.radius + 0.6],
      [2.6, r.radius],
      [r.wallTop, r.radius],
      [r.corbelTop, r.radius + 1],
    ],
    n,
  );
  const ring = (rad) =>
    Array.from({ length: n }, (_, i) => [
      rad * Math.sin((i * 2 * Math.PI) / n),
      rad * Math.cos((i * 2 * Math.PI) / n),
    ]);
  slab(q, [ring(r.radius + 1), ring(r.radius - 0.8)], [r.corbelTop, r.corbelTop], 'trim');
  drum(
    q,
    [
      [r.corbelTop, r.radius + 1],
      [23.6, r.radius + 1],
    ],
    n,
    'stone',
    'limestone',
    false,
  );
  drum(
    q,
    [
      [r.corbelTop + 0.05, 2.5],
      [24, 1.5],
      [24.4, 0.4],
    ],
    n,
    'roof',
    'slate',
  );
  const count = d >= 2 ? 20 : 12;
  for (let i = 0; i < count; i++) {
    const a = (i * 2 * Math.PI) / count,
      f = local(q, Math.sin(a) * (r.radius + 0.6), Math.cos(a) * (r.radius + 0.6), a);
    rect(f, 0, 23.6, 0, 1.45, 1.2, 1.1, 'trim');
    if (d >= 2) rect(f, 0, 20.5, -0.5, 0.55, 1.8, 1.5, 'stone');
  }
  if (d)
    for (const a of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
      const f = local(q, Math.sin(a) * (r.radius + 0.03), Math.cos(a) * (r.radius + 0.03), a);
      pane(f, 0, 15, 0, 2.2, 3, d);
      if (d >= 2) pane(f, -1.5, 7.2, 0, 1.1, 1.6, 0);
    }
  const b = frame.controls.bermingham,
    bb = local(o, ...b.center);
  drum(
    bb,
    [
      [0, b.radius + 0.65],
      [4, b.radius],
    ],
    n,
  );
  drum(
    bb,
    [
      [4, b.radius],
      [b.wallTop, b.radius],
    ],
    n,
    'blue',
    'plaster',
  );
  drum(
    bb,
    [
      [b.wallTop, b.radius],
      [b.roofTop, b.radius * 0.3],
    ],
    n,
    'roof',
    'slate',
  );
  if (d)
    for (const a of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
      const f = local(bb, Math.sin(a) * (b.radius + 0.03), Math.cos(a) * (b.radius + 0.03), a);
      pointed(f, 0, 7, 0, 2.1, 3.9, d);
      if (d >= 2) {
        pointed(f, 0, 12.8, 0, 2.3, 4.3, d);
        pane(f, 0, 18.1, 0, 1.2, 1.4, 0);
      }
    }
}
function chapel(o, d) {
  const t = frame.controls.chapel,
    q = local(o, ...t.center, t.heading),
    [w, depth] = t.plan;
  rect(q, 0, 0, 0, w, t.wallTop, depth);
  gable(local(q, 0, 0, Math.PI / 2), depth + 0.6, w + 0.6, t.wallTop, t.roofTop, 'roof');
  const count = d ? 6 : 4;
  for (const s of [-1, 1]) {
    const f = local(q, 0, s * (depth / 2 + 0.04), s < 0 ? Math.PI : 0);
    for (let i = 0; i <= count; i++) {
      const x = -w / 2 + (i * w) / count;
      rect(f, x, 0, 0.65, 0.8, 11.4, 1.6, 'trim');
      rect(f, x, 11.4, 0.5, 0.75, 3.7, 1.2, 'trim');
      // Chunky pinnacles stay legible; no fine crockets or carved heads.
      drum(
        local(f, x, 0.5),
        [
          [15.1, 0.65],
          [17.8, 0.2],
        ],
        d >= 2 ? 6 : 4,
        'trim',
      );
      if (d && i < count) pointed(f, x + w / count / 2, 3.4, 0.02, 2.25, 7.4, d);
    }
    rect(f, 0, 12, 0.2, w, 0.6, 0.7, 'trim');
  }
  const east = local(q, w / 2 + 0.03, 0, Math.PI / 2);
  if (d) pointed(east, 0, 2.8, 0, 4.4, 9.4, d);
  const bell = local(q, -w / 2 + 2.1, 0, Math.PI / 2);
  for (const x of [-1, 1]) rect(bell, x, 17.8, 0, 0.65, 2.3, 1.2, 'trim');
  rect(bell, 0, 20.1, 0, 2.7, 0.3, 1.3, 'trim');
  if (d >= 2)
    drum(
      local(bell, 0, 0),
      [
        [18.3, 0.55],
        [19.25, 0.35],
      ],
      6,
      'dark',
      'slate',
    );
}
function chester(o, d) {
  const t = frame.controls.chester,
    q = local(o, ...t.center, t.heading),
    [w, depth] = t.plan;
  for (const x of [-w / 2 + 3.5, w / 2 - 3.5])
    range(
      q,
      {
        ends: [
          [x, -depth / 2],
          [x, depth / 2],
        ],
        depth: 7,
        wallTop: t.wallTop,
        roofTop: t.roofTop,
        color: 'brick',
      },
      d,
    );
  range(
    q,
    {
      ends: [
        [-w / 2, -depth / 2],
        [w / 2, -depth / 2],
      ],
      depth: 9,
      wallTop: t.wallTop,
      roofTop: t.roofTop,
      color: 'brick',
    },
    d,
  );
  slab(
    q,
    [
      [
        [-w / 2 + 7, -depth / 2 + 4.5],
        [w / 2 - 7, -depth / 2 + 4.5],
        [w / 2 - 7, depth / 2],
        [-w / 2 + 7, depth / 2],
      ],
    ],
    [12.4],
    'glass',
    'glass',
  );
  const c = local(q, 0, -depth / 2);
  rect(c, 0, 15.4, 0, 4.8, 5.4, 4.8, 'cream', 'plaster');
  drum(
    c,
    [
      [20.8, 3.2],
      [21.5, 2.8],
      [23.1, 1.4],
      [24.4, 0.45],
    ],
    d >= 2 ? 12 : 8,
    'copper',
    'patina',
  );
  if (d)
    for (const a of [0, Math.PI / 2, Math.PI, Math.PI * 1.5])
      clock(local(c, Math.sin(a) * 2.42, Math.cos(a) * 2.42, a), 0, 18.5, 0, 1.1, d);
}
function grounds(o, d) {
  const c = frame.controls;
  slab(o, [frame.geometry.outline.slice(0, -1)], [0], 'paving');
  slab(o, [c.upperCourt], [0.035]);
  slab(o, [c.lowerCourt], [0.035]);
  const q = local(o, ...c.garden.center),
    n = d >= 2 ? 48 : 24;
  const circle = (radius) =>
    Array.from({ length: n }, (_, i) => [
      radius * Math.cos((i * 2 * Math.PI) / n),
      radius * Math.sin((i * 2 * Math.PI) / n),
    ]);
  slab(q, [circle(c.garden.radius + 2), circle(c.garden.radius)], [0.07, 0.07]);
  slab(q, [circle(c.garden.radius)], [0.08], 'grass', 'foliage');
  if (d) {
    // Broad curving bands evoke the documented sea-serpent paths without tiny paving joints.
    const steps = d === 1 ? 8 : d === 2 ? 16 : 24;
    for (let j = 0; j < 6; j++) {
      const f = local(q, 0, 0, (j * Math.PI) / 3),
        path = Array.from({ length: steps + 1 }, (_, i) => {
          const a = (i * 2 * Math.PI) / steps;
          return [11 + 9 * Math.cos(a), 9 * Math.sin(a) + 3 * Math.sin(2 * a)];
        });
      for (let i = 1; i < path.length; i++) {
        const a = path[i - 1],
          b = path[i],
          len = Math.hypot(b[0] - a[0], b[1] - a[1]),
          u = ((b[1] - a[1]) / len) * 0.42,
          v = ((a[0] - b[0]) / len) * 0.42;
        face(
          f,
          [
            [a[0] + u, 0.095, a[1] + v],
            [b[0] + u, 0.095, b[1] + v],
            [b[0] - u, 0.095, b[1] - v],
            [a[0] - u, 0.095, a[1] - v],
          ],
          'trim',
          'limestone',
          [0, 1, 0],
        );
      }
    }
    for (let i = 0; i < c.garden.boundary.length; i++) {
      const { q: f, length } = edgeFrame(o, c.garden.boundary[i], c.garden.boundary[(i + 1) % 4]);
      if (i !== 0) rect(f, 0, 0, 0, length, 1.5, 0.65);
    }
  }
  const coach = c.coachHouse,
    [a, b] = coach.ends,
    length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const ch = local(o, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, Math.atan2(a[1] - b[1], b[0] - a[0]));
  rect(ch, 0, 0, 0, length, coach.wallTop, coach.depth);
  gable(local(ch, 0, 0, Math.PI / 2), coach.depth, length, coach.wallTop, coach.roofTop, 'roof');
  for (const x of [-length / 2, -length / 4, 0, length / 4, length / 2]) {
    rect(ch, x, 0, -coach.depth / 2, 2.2, 9.8, 2.2, 'trim');
    for (const u of [-0.8, 0.8]) rect(ch, x + u, 9.8, -coach.depth / 2, 0.7, 0.8, 2.2, 'trim');
  }
  if (d) {
    const f = local(ch, 0, -coach.depth / 2 - 0.03, Math.PI);
    for (const x of [-length * 0.36, -length * 0.14, length * 0.14, length * 0.36])
      pointed(f, x, 2, 0, 1.2, 3.7, d);
    pointed(f, 0, 0, 0, 3.3, 6.8, d);
  }
}
export function buildDublinRuntime(o, level = 'closeup') {
  const d = { skyline: 0, district: 1, street: 2, closeup: 3 }[level],
    c = frame.controls;
  grounds(o, d);
  for (const [key, r] of Object.entries(c.ranges)) range(o, r, d, key === 'south');
  bedford(o, d);
  medievalTowers(o, d);
  chapel(o, d);
  chester(o, d);
  // Low crenellated garden-side link around the Record Tower; no fake medieval keep.
  if (d >= 2) {
    const q = local(o, c.record.center[0] - 10, c.record.center[1] + 7);
    rect(q, 0, 0, 0, 12, 5.2, 4.5);
    for (const x of [-4.5, 0, 4.5]) pointed(local(q, 0, 2.27), x, 1.2, 0, 1.8, 2.8, d);
    for (const x of [-5, -2.5, 0, 2.5, 5]) rect(q, x, 5.2, 2, 1.1, 0.85, 1.2, 'trim');
  }
}
function skylineCampus(o) {
  const c = frame.controls;
  // Keep the same mapped ground boundary at every level to avoid a ground-plane jump.
  slab(o, [frame.geometry.outline.slice(0, -1)], [0], 'paving');
  for (const [key, r] of Object.entries(c.ranges)) range(o, r, 0, key === 'south');
  const garden = local(o, ...c.garden.center),
    circle = Array.from({ length: 16 }, (_, i) => [
      c.garden.radius * Math.cos((i * Math.PI) / 8),
      c.garden.radius * Math.sin((i * Math.PI) / 8),
    ]);
  slab(garden, [circle], [0.08], 'grass', 'foliage');
  const record = c.record,
    q = local(o, ...record.center);
  drum(
    q,
    [
      [0, record.radius],
      [21.2, record.radius],
      [23.6, record.radius + 1],
    ],
    8,
  );
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    rect(local(q, Math.sin(a) * 9.1, Math.cos(a) * 9.1, a), 0, 23.6, 0, 1.6, 1.2, 1.1, 'trim');
  }
  const berm = local(o, ...c.bermingham.center);
  drum(
    berm,
    [
      [0, 7],
      [20.4, 7],
      [21.5, 2],
    ],
    8,
    'blue',
    'plaster',
  );
  const t = c.bedford,
    b = local(o, ...t.center, t.heading),
    [w, depth] = t.plan;
  rect(b, 0, 0, 0, w, 10.5, depth, 'brick', 'brick');
  gable(local(b, 0, 0, Math.PI / 2), depth, w, 10.5, 13.8, 'roof', 'brick');
  face(
    b,
    [
      [-8.4, 10.5, depth / 2 + 0.05],
      [8.4, 10.5, depth / 2 + 0.05],
      [0, 14.6, depth / 2 + 0.05],
    ],
    'trim',
    'limestone',
    [0, 0, 1],
  );
  rect(b, 0, 12.5, 0, 8.7, 4.1, 8.7, 'trim');
  drum(
    b,
    [
      [16.6, 3.85],
      [28.5, 3.85],
    ],
    8,
    'stone',
  );
  drum(
    b,
    [
      [28.5, 4.7],
      [29.8, 3.3],
      [31.2, 1.6],
      [32.7, 1.45],
      [33.5, 0.55],
    ],
    8,
    'copper',
    'patina',
  );
  rect(b, 0, 33.5, 0, 0.5, 0.5, 0.5, 'trim');
  for (const s of [-1, 1]) archScreen(local(b, s * 22.5, 0), 10.5, 3.8, 8.7, 3.6, 6.4, 0);
  const chapel = c.chapel,
    ch = local(o, ...chapel.center, chapel.heading),
    [cw, cd] = chapel.plan;
  rect(ch, 0, 0, 0, cw, 12.6, cd);
  gable(local(ch, 0, 0, Math.PI / 2), cd + 0.6, cw + 0.6, 12.6, 18.2, 'roof');
  for (const x of [-cw / 2, cw / 2])
    for (const z of [-cd / 2, cd / 2]) rect(ch, x, 0, z, 0.9, 17.8, 1.2, 'trim');
  const bell = local(ch, -cw / 2 + 2.1, 0, Math.PI / 2);
  for (const x of [-1, 1]) rect(bell, x, 17.8, 0, 0.65, 2.3, 1.2, 'trim');
  rect(bell, 0, 20.1, 0, 2.7, 0.3, 1.3, 'trim');
  chester(o, 0);
  range(o, c.coachHouse, 0);
}
export const buildDublinSkyline = (o) =>
  skylineCampus(
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
            c.map((v) => v * (s === 'glass' || s === 'foliage' ? 1 : 0.65)),
          ),
      ]),
    ),
  );
export const dublinStudy = {
  id: 'N0275',
  key: 'dublin_castle',
  title: 'Dublin Castle',
  category: 'castle',
  wikidataId: 'Q742767',
  mapFrame: 'map-frame.json',
  fidelityTarget: 'medium-fi',
  build: (o) => buildDublinRuntime(o),
  brief:
    'Dublin Castle current exterior campus: open Georgian Upper and Lower Courts, Bedford clock pavilion and flanking gates, round Record and Bermingham towers, pinnacled Gothic Chapel Royal, circular Dubh Linn garden, Coach House and Chester Beatty clock range.',
  appearance: {
    standard: 'docs-src/guide/medium-fi.md',
    paletteSrgb: dublinPalette,
    colorEncoding: 'sRGB decoded to linear COLOR_0',
    materialBudget: 7,
    materialBudgetReason:
      'Seven merged groups distinguish stone/brick/render, slate/copper roofing, glazing and lawn across the mixed historic campus; five shared graphs, no private textures.',
    identityFeatures: [
      'Round medieval Record Tower beside pinnacled Gothic Chapel Royal',
      'Bedford octagonal clock tower and green ogee dome above an open court with flanking gates',
      'Circular serpent-pattern garden south of painted State Apartments and blue Bermingham Tower',
    ],
  },
  sourceFacts: {
    mapIdentity: 'way/350242806 exact Q742767',
    mappedSitePlanMeters: [262.431, 245.981],
    publishedRecordWallThicknessUpToMeters: 4.8,
    bedfordFacadeBays: 5,
    bedfordFacadeStoreys: 2,
  },
  reconstruction: {
    basis:
      'Exact mapped campus perimeter, OPW current illustrated site map, north-up strategic-plan base map and current exterior/aerial photographs',
    scope:
      'Existing exterior ranges and courts; future proposals, neighboring buildings, full interiors and temporary events excluded',
  },
  scaleBasis:
    'Mapped262.431×245.981m entire campus fixes registration. All component dimensions and elevations interpreted, including Bedford34m finial and Record24.8m crown. No published overall height or surveyed component footprint is claimed.',
  refs: [
    'https://dublincastle.ie/wp-content/uploads/2017/01/DublinCastle_Maps_website.pdf',
    'https://dublincastle.ie/strategicframeworkplan/',
    'https://dublincastle.ie/the-medieval-tower/',
    'https://dublincastle.ie/the-chapel-royal/',
    'https://dublincastle.ie/the-bedford-tower-castle-gates-guard-house/',
    'https://dublincastle.ie/the-clock-tower-building-the-state-stables/',
    'https://dublincastle.ie/the-castle-gardens/',
    'https://www.buildingsofireland.ie/buildings-search/building/50910292/dublin-castle-bermingham-tower-dublin-castle-dublin-2-co-dublin',
    frame.sourceUrl,
  ],
  sourceDocuments: ['map-frame.json', 'reference-metadata.json'],
  sourceLicense:
    'Original geometry under repository license. OSM geometry © OpenStreetMap contributors, ODbL-1.0. Operator/NIAH drawings and photos linked as research only, not redistributed.',
  dataAttribution:
    '© OpenStreetMap contributors, ODbL-1.0. OPW, Grafton and NIAH primary references used as research only.',
  nativeAxes: frame.nativeAxes,
  geographic: () => ({
    status: 'research-only',
    replaceFootprint: false,
    groundModelY: 0,
    notes:
      'Signed campus axis from OPW base plan and mapped site; individual heights/dimensions inferred. Actual terrain and entry contact pending.',
    reviewStatus: 'Research frame only; terrain/approaches pending',
  }),
  geographicNote:
    'Exact campus perimeter and interpreted OPW components establish orientation; geographic activation requires terrain/approach and footprint interaction review. Synthetic captures establish appearance only.',
  limitations: JSON.parse(
    readFileSync(
      new URL(
        '../../../content/worldgen/source/places/gc/gc7/n0275_dublin_castle/reference-metadata.json',
        import.meta.url,
      ),
    ),
  ).limitations,
  importReason:
    'Preserve open quadrangle, Record/chapel pairing, Bedford green clock dome, round southern garden and mixed brick/painted/stone ranges in all levels.',
  mediumFiContext: { scale: '1.2', neighborStyle: 'molen.worldgen.catalog.english_terrace' },
  camera: { position: [200, 155, 220], lookAt: [-25, 10, -28], fov: 43 },
  qaCameras: [
    { name: 'record-tower-and-gothic-chapel', position: [62, 34, 13], lookAt: [17, 11, -40] },
    { name: 'bedford-tower-and-gates', position: [-57, 27, -43], lookAt: [-57, 15, -102] },
    { name: 'upper-court-brick-quadrangle', position: [-90, 37, -64], lookAt: [-38, 8, -74] },
    { name: 'garden-and-painted-state-wings', position: [-12, 40, 70], lookAt: [-49, 11, -33] },
    { name: 'chester-beatty-and-coach-house', position: [-17, 37, 3], lookAt: [-62, 9, 40] },
    { name: 'current-campus-plan', position: [0, 360, 1], lookAt: [0, 0, 0] },
  ],
};
