/** Lutsk Upper Castle: three brick towers, open triangular court and covered timber walk. */
import './install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import earcut from 'earcut';
import { normalFor } from './authored-structure-mesh.mjs';
import { box } from './structure-mesh.mjs';

const root = '../../../content/worldgen/source/places/u9/u94/n0277_lubart_s_castle/';
const frame = JSON.parse(readFileSync(new URL(`${root}map-frame.json`, import.meta.url)));
const references = JSON.parse(
  readFileSync(new URL(`${root}reference-metadata.json`, import.meta.url)),
);
export const lubartPalette = {
  brick: '#be8c70',
  trim: '#ded8c7',
  cream: '#e6dec9',
  ochre: '#daca99',
  roof: '#667079',
  blueRoof: '#6b889f',
  orangeRoof: '#b16e4e',
  glass: '#4d6178',
  wood: '#a77a54',
  paving: '#b5afa1',
  grass: '#8aa065',
};
const colors = Object.fromEntries(
  Object.entries(lubartPalette).map(([key, hex]) => [
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
const rect = (o, x, y, z, w, h, depth, col = 'brick', slot = 'brick') =>
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
function face(o, points, col = 'brick', slot = 'brick', target) {
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
function cap(o, loop, y, col = 'paving', slot = 'limestone') {
  const ids = earcut(loop.flat(), null, 2);
  for (let i = 0; i < ids.length; i += 3)
    face(
      o,
      ids.slice(i, i + 3).map((j) => [loop[j][0], y, loop[j][1]]),
      col,
      slot,
      [0, 1, 0],
    );
}
function edge(o, a, b) {
  return {
    length: Math.hypot(b[0] - a[0], b[1] - a[1]),
    q: local(o, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, Math.atan2(b[1] - a[1], a[0] - b[0])),
  };
}
function hip(o, w, depth, y, top, col = 'roof', slot = 'shingle') {
  // Four large hard faces, including a broad ridge on the long annexes.
  const ridge = Math.max(0, (w - depth) * 0.5);
  for (const s of [-1, 1]) {
    face(
      o,
      [
        [-w / 2, y, (s * depth) / 2],
        [w / 2, y, (s * depth) / 2],
        [ridge, top, 0],
        [-ridge, top, 0],
      ],
      col,
      slot,
      [0, 1, s],
    );
    face(
      o,
      [
        [(s * w) / 2, y, -depth / 2],
        [(s * w) / 2, y, depth / 2],
        [s * ridge, top, 0],
      ],
      col,
      slot,
      [s, 1, 0],
    );
  }
}
function pane(o, x, y, z, w, h, d, col = 'glass', slot = 'glass', rounded = false) {
  const spring = rounded ? h - w / 2 : h,
    n = d >= 2 ? 6 : 3;
  const loop = [
    [x - w / 2, y, z],
    [x + w / 2, y, z],
  ];
  if (rounded) {
    for (let i = 0; i <= n; i++) {
      const a = (i * Math.PI) / n;
      loop.push([x + (w / 2) * Math.cos(a), y + spring + (w / 2) * Math.sin(a), z]);
    }
  } else loop.push([x + w / 2, y + h, z], [x - w / 2, y + h, z]);
  face(o, loop, col, slot, [0, 0, 1]);
  if (d < 3 || col !== 'glass' || w < 0.7) return;
  // Sparse selected planar surrounds, wider than the model's0.174m closeup error.
  for (const s of [-1, 1])
    face(
      o,
      [
        [x + (s * w) / 2, y, z + 0.08],
        [x + s * (w / 2 + 0.24), y, z + 0.08],
        [x + s * (w / 2 + 0.24), y + spring, z + 0.08],
        [x + (s * w) / 2, y + spring, z + 0.08],
      ],
      'trim',
      'limestone',
      [0, 0, 1],
    );
  if (!rounded)
    face(
      o,
      [
        [x - w / 2 - 0.24, y + h, z + 0.08],
        [x + w / 2 + 0.24, y + h, z + 0.08],
        [x + w / 2 + 0.24, y + h + 0.24, z + 0.08],
        [x - w / 2 - 0.24, y + h + 0.24, z + 0.08],
      ],
      'trim',
      'limestone',
      [0, 0, 1],
    );
}
function merlon(o, x, width, y, top, thickness, d, curved = false) {
  const n = curved ? (d === 0 ? 2 : d === 1 ? 4 : 6) : 1;
  const profile = Array.from({ length: n + 1 }, (_, i) => [
    x - width / 2 + (i * width) / n,
    curved ? top - 0.55 + Math.sin((i * Math.PI) / n) * 0.55 : top,
  ]);
  for (const s of [-1, 1])
    for (let i = 0; i < n; i++)
      face(
        o,
        [
          [profile[i][0], y, (s * thickness) / 2],
          [profile[i + 1][0], y, (s * thickness) / 2],
          [profile[i + 1][0], profile[i + 1][1], (s * thickness) / 2],
          [profile[i][0], profile[i][1], (s * thickness) / 2],
        ],
        'brick',
        'brick',
        [0, 0, s],
      );
  if (d === 0) return;
  for (let i = 0; i < n; i++)
    face(
      o,
      [
        [profile[i][0], profile[i][1], -thickness / 2],
        [profile[i + 1][0], profile[i + 1][1], -thickness / 2],
        [profile[i + 1][0], profile[i + 1][1], thickness / 2],
        [profile[i][0], profile[i][1], thickness / 2],
      ],
      'brick',
      'brick',
      [0, 1, 0],
    );
  for (const i of [0, n])
    face(
      o,
      [
        [profile[i][0], y, -thickness / 2],
        [profile[i][0], y, thickness / 2],
        [profile[i][0], profile[i][1], thickness / 2],
        [profile[i][0], profile[i][1], -thickness / 2],
      ],
      'brick',
      'brick',
      [i === 0 ? -1 : 1, 0, 0],
    );
}
function crown(o, width, depth, y, top, d) {
  for (let i = 0; i < 4; i++) {
    const length = i % 2 ? depth : width,
      q = local(o, 0, 0, (i * Math.PI) / 2),
      e = local(q, 0, (i % 2 ? width : depth) / 2 - 0.3);
    rect(e, 0, y, 0, length, 0.75, 0.65);
    const n = d === 0 ? 3 : 4;
    for (let j = 0; j < n; j++)
      merlon(
        e,
        ((j + 0.5) * length) / n - length / 2,
        (length / n) * 0.64,
        y + 0.75,
        top,
        0.65,
        d,
        true,
      );
    if (d >= 2) rect(e, 0, y - 0.4, 0.08, length + 0.3, 0.32, 0.85);
  }
}
function buttress(o, x, z, width, depth, height) {
  const a = [
      [x - width / 2, 0, z],
      [x + width / 2, 0, z],
      [x + width / 2, 0, z + depth],
      [x - width / 2, 0, z + depth],
    ],
    b = [
      [x - width / 2, height, z],
      [x + width / 2, height, z],
      [x + width / 2, height, z + 0.45],
      [x - width / 2, height, z + 0.45],
    ];
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    face(o, [a[i], a[j], b[j], b[i]], 'brick', 'brick', [
      a[i][0] + a[j][0] - x * 2,
      0,
      a[i][2] + a[j][2] - z * 2 - depth,
    ]);
  }
  face(o, b, 'trim', 'limestone', [0, 1, 1]);
}
function entry(o, d) {
  const t = frame.controls.entry,
    q = local(o, ...t.center, t.angle),
    [w, depth] = t.plan,
    half = 1.9,
    spring = 3.2,
    peak = 5.1,
    ceiling = 6.2,
    steps = d >= 2 ? 8 : 4;
  rect(q, 0, ceiling, 0, w, t.wallTop - ceiling, depth);
  // A real vaulted portal: two face screens, underside returns and side walls, no solid plug.
  const profile = [
    [-w / 2, 0],
    [-half, 0],
  ];
  for (let i = 0; i <= steps; i++) {
    const u = -1 + (i * 2) / steps;
    profile.push([u * half, spring + Math.sqrt(Math.max(0, 1 - u * u)) * (peak - spring)]);
  }
  profile.push([half, 0], [w / 2, 0]);
  for (const s of [-1, 1])
    for (let i = 1; i < profile.length; i++) {
      const a = profile[i - 1],
        b = profile[i];
      if (a[0] === b[0]) continue;
      face(
        q,
        [
          [a[0], a[1], (s * depth) / 2],
          [b[0], b[1], (s * depth) / 2],
          [b[0], ceiling, (s * depth) / 2],
          [a[0], ceiling, (s * depth) / 2],
        ],
        'brick',
        'brick',
        [0, 0, s],
      );
    }
  for (let i = 3; i <= steps + 2; i++) {
    const a = profile[i - 1],
      b = profile[i];
    face(
      q,
      [
        [a[0], a[1], -depth / 2],
        [b[0], b[1], -depth / 2],
        [b[0], b[1], depth / 2],
        [a[0], a[1], depth / 2],
      ],
      'brick',
      'brick',
      [0, -1, 0],
    );
  }
  for (const s of [-1, 1]) {
    rect(q, s * (w / 2 - 0.5), 0, 0, 1, ceiling, depth);
    face(
      q,
      [
        [s * half, 0, -depth / 2],
        [s * half, 0, depth / 2],
        [s * half, spring, depth / 2],
        [s * half, spring, -depth / 2],
      ],
      'brick',
      'brick',
      [-s, 0, 0],
    );
    buttress(q, s * 5.25, depth / 2 - 0.5, 2.2, 4.2, 12.8);
  }
  crown(q, w, depth, t.wallTop, t.crownTop, d);
  if (d === 0) return;
  const front = depth / 2 + 0.06;
  // Filled medieval large/pedestrian arches remain masonry; the current round portal stays open.
  pane(q, -0.6, 5.2, front, 3.8, 5.1, d, 'trim', 'limestone', true);
  pane(q, 3.25, 5.5, front, 1.5, 3.8, d, 'trim', 'limestone', true);
  for (const y of [10.2, 15.2]) pane(q, 0, y, front + 0.04, 2.1, 2.8, d);
  for (const x of [-3, 0, 3]) pane(q, x, 20.9, front, 0.85, 1.65, d, 'glass', 'glass', true);
  for (let i = 1; i < 4; i++) {
    const side = local(q, 0, 0, (i * Math.PI) / 2),
      z = (i % 2 ? w : depth) / 2 + 0.05;
    for (const y of [9, 15.3, 20.6]) pane(side, 0, y, z, 0.85, 1.8, d, 'glass', 'glass', true);
  }
  if (d >= 2) {
    for (const y of [18.9, 24]) rect(q, 0, y, front + 0.08, w, 0.3, 0.45);
    for (const x of [-3.8, 3.8]) pane(q, x, 24.4, front, 0.55, 0.55, d, 'glass', 'glass', true);
    for (let i = 0; i < steps; i++) {
      const a = (i * Math.PI) / steps,
        b = ((i + 1) * Math.PI) / steps;
      face(
        q,
        [
          [half * Math.cos(a), spring + half * Math.sin(a), front + 0.12],
          [(half + 0.35) * Math.cos(a), spring + (half + 0.35) * Math.sin(a), front + 0.12],
          [(half + 0.35) * Math.cos(b), spring + (half + 0.35) * Math.sin(b), front + 0.12],
          [half * Math.cos(b), spring + half * Math.sin(b), front + 0.12],
        ],
        'trim',
        'limestone',
        [0, 0, 1],
      );
    }
  }
}
function tower(o, name, d) {
  const t = frame.controls[name],
    q = local(o, ...t.center, t.angle),
    [w, depth] = t.plan;
  rect(q, 0, 0, 0, w, t.wallTop, depth);
  if (name === 'bishop') hip(q, w + 1.8, depth + 1.8, t.wallTop, t.roofTop);
  else {
    cap(
      q,
      [
        [-w / 2, -depth / 2],
        [w / 2, -depth / 2],
        [w / 2, depth / 2],
        [-w / 2, depth / 2],
      ],
      t.wallTop + 0.02,
    );
    crown(q, w, depth, t.wallTop, t.crownTop, d);
    buttress(q, -w / 2 + 1.05, depth / 2 - 0.4, 2.1, 3.2, 9.2);
  }
  if (d === 0) return;
  for (let i = 0; i < 4; i++) {
    const f = local(q, 0, 0, (i * Math.PI) / 2),
      length = i % 2 ? depth : w,
      z = (i % 2 ? w : depth) / 2 + 0.05;
    const ys = name === 'bishop' ? [4.1, 10.3] : [3.2, 9.1, 15.3, 21.5];
    for (const y of ys)
      pane(f, 0, y, z, y > 10 ? 0.75 : 1, y > 10 ? 1.6 : 2, d, 'glass', 'glass', true);
    if (name === 'bishop') for (const x of [-3.2, 3.2]) pane(f, x, 10.4, z, 0.6, 1.8, d);
    if (d >= 2 && name === 'styr') {
      for (const y of [17.9, 23.2]) rect(f, 0, y, z, length, 0.32, 0.45);
      for (const x of [-3.2, 3.2]) pane(f, x, 23.6, z, 0.5, 0.55, d, 'glass', 'glass', true);
    }
  }
}
const outline = frame.geometry.outline.slice(0, -1);
function curtain(o, a, b, d, covered = false, low = false) {
  const { q, length } = edge(o, a, b),
    y = low ? 5.7 : covered ? 11.7 : 10.4;
  rect(q, 0, 0, -0.65, length + 0.12, y, 1.3);
  if (covered) {
    // Joined roof fields are emitted once in coveredRoof, avoiding corner overlap.
    if (d >= 1) {
      rect(q, 0, 8.2, -2.35, length, 0.3, 2.8, 'wood', 'wood');
      const n = Math.max(1, Math.floor(length / (d >= 2 ? 4 : 8)));
      for (let i = 0; i < n; i++)
        rect(q, ((i + 0.5) * length) / n - length / 2, 8.5, -3.55, 0.3, 3.1, 0.3, 'wood', 'wood');
    }
  } else {
    const n = Math.max(1, Math.floor(length / (d === 0 ? 8 : d === 1 ? 4 : 2.8)));
    for (let i = 0; i < n; i++)
      merlon(
        local(q, 0, -0.65),
        ((i + 0.5) * length) / n - length / 2,
        (length / n) * 0.5,
        y,
        y + 1.2,
        1.3,
        d,
      );
    if (d >= 2 && !low) rect(q, 0, 8.1, -2, length, 0.3, 1.6, 'wood', 'wood');
  }
  if (d >= 1 && length > 4) {
    const n = Math.max(1, Math.floor(length / (d === 1 ? 7 : 4)));
    for (let i = 0; i < n; i++) {
      const x = ((i + 0.5) * length) / n - length / 2;
      for (const h of covered ? [8.6, 10.4] : [y - 1.1])
        pane(q, x, h, 0.05, 0.48, 0.75, d, 'glass', 'glass', true);
    }
  }
}
function coveredRoof(o, path) {
  const normals = path.slice(1).map((p, i) => {
    const a = path[i],
      n = Math.hypot(p[0] - a[0], p[1] - a[1]);
    return [(p[1] - a[1]) / n, (a[0] - p[0]) / n];
  });
  const offsets = path.map((_p, i) => {
    if (i === 0) return normals[0];
    if (i === path.length - 1) return normals.at(-1);
    const a = normals[i - 1],
      b = normals[i],
      denom = 1 + a[0] * b[0] + a[1] * b[1];
    return [(a[0] + b[0]) / denom, (a[1] + b[1]) / denom];
  });
  const at = (i, offset, y) => [
    path[i][0] + offsets[i][0] * offset,
    y,
    path[i][1] + offsets[i][1] * offset,
  ];
  for (let i = 1; i < path.length; i++)
    for (const off of [0.3, -4.1])
      face(
        o,
        [at(i - 1, off, 11.7), at(i, off, 11.7), at(i, -1.9, 12.95), at(i - 1, -1.9, 12.95)],
        'roof',
        'shingle',
        [0, 1, 0],
      );
}
function annex(o, kind, d) {
  const t = frame.controls[kind];
  let q, w, depth;
  if (t.ends) {
    const [a, b] = t.ends;
    w = Math.hypot(b[0] - a[0], b[1] - a[1]);
    depth = t.depth;
    q = local(o, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, Math.atan2(a[1] - b[1], b[0] - a[0]));
  } else {
    q = local(o, ...t.center, t.angle);
    [w, depth] = t.plan;
  }
  rect(q, 0, 0, 0, w, t.wallTop, depth, kind === 'bookMuseum' ? 'ochre' : 'cream', 'plaster');
  hip(
    q,
    w + 0.8,
    depth + 0.8,
    t.wallTop,
    t.roofTop,
    kind === 'bookMuseum' ? 'orangeRoof' : 'roof',
    kind === 'bookMuseum' ? 'metal' : 'shingle',
  );
  if (kind === 'bookMuseum') {
    // Current broad four-column porch and pediment; no tiny capital carvings.
    for (const x of [-5.4, -1.8, 1.8, 5.4])
      rect(q, x, 0, depth / 2 + 2.1, 0.65, 4.6, 0.65, 'ochre', 'plaster');
    rect(q, 0, 4.6, depth / 2 + 1.2, 13.4, 0.5, 3.2, 'ochre', 'plaster');
    face(
      q,
      [
        [-6.7, 5.1, depth / 2 + 2.82],
        [6.7, 5.1, depth / 2 + 2.82],
        [0, 7.6, depth / 2 + 2.82],
      ],
      'ochre',
      'plaster',
      [0, 0, 1],
    );
  }
  if (d === 0) return;
  for (const s of [-1, 1]) {
    const f = local(q, 0, 0, s > 0 ? 0 : Math.PI),
      n = Math.max(3, Math.floor(w / 5.3));
    for (let i = 0; i < n; i++)
      pane(f, ((i + 0.5) * w) / n - w / 2, 1.3, depth / 2 + 0.06, 1.05, 2.1, d);
  }
}
function churchCover(o, d) {
  const t = frame.controls.churchCover,
    q = local(o, ...t.center, t.angle),
    [w, depth] = t.plan;
  // Existing excavation protection only, not a reconstructed ancient church.
  rect(q, 0, 0, 0, w, t.wallTop, depth, 'cream', 'plaster');
  hip(q, w + 0.6, depth + 0.6, t.wallTop, t.roofTop, 'blueRoof', 'metal');
  if (d >= 2) {
    for (const s of [-1, 1]) {
      const f = local(q, 0, 0, s > 0 ? 0 : Math.PI);
      for (const x of [-8, 0, 8]) pane(f, x, 0.5, depth / 2 + 0.06, 1.3, 1.15, d);
    }
  }
}
function castle(o, d) {
  cap(o, outline, 0);
  if (d >= 1) {
    cap(
      o,
      [
        [0, 5],
        [26, 10],
        [22, 23],
        [6, 30],
        [-5, 26],
      ],
      0.04,
      'grass',
      'foliage',
    );
    cap(
      o,
      [
        [-36, -24],
        [-22, -30],
        [-24, -5],
        [-38, -1],
      ],
      0.04,
      'grass',
      'foliage',
    );
  }
  for (let i = 8; i < 12; i++) curtain(o, outline[i], outline[i + 1], d, true);
  const entryJoin = [-40.6, -45.5];
  curtain(o, entryJoin, outline[8], d, true);
  coveredRoof(o, [entryJoin, ...outline.slice(8, 13)]);
  for (let i = 15; i < 20; i++) curtain(o, outline[i], outline[i + 1], d);
  for (let i = 23; i < 29; i++)
    curtain(o, outline[i], outline[(i + 1) % outline.length], d, false, true);
  curtain(o, outline[0], [-50.6, -37.1], d, false, true);
  entry(o, d);
  tower(o, 'bishop', d);
  tower(o, 'styr', d);
  annex(o, 'nobleHouse', d);
  annex(o, 'bookMuseum', d);
  churchCover(o, d);
}
export const buildLubartRuntime = (o, level = 'closeup') =>
  castle(o, { district: 1, street: 2, closeup: 3 }[level] ?? 3);
export const buildLubartSkyline = (o) =>
  castle(
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
    0,
  );
export const lubartStudy = {
  id: 'N0277',
  key: 'lubart_s_castle',
  title: "Lubart's Castle",
  category: 'castle',
  wikidataId: 'Q1866166',
  mapFrame: 'map-frame.json',
  fidelityTarget: 'medium-fi',
  build: (o) => buildLubartRuntime(o),
  brief:
    'Lutsk Upper Castle: irregular triangular brick enclosure, west entry tower with buttresses and open round portal, north pyramid-roofed Bishop tower and southeast open-crowned Styr tower; covered timber wall walk, cream noble house, ochre columned book museum and contemporary blue-grey church excavation cover in an open court.',
  appearance: {
    standard: 'docs-src/guide/medium-fi.md',
    paletteSrgb: lubartPalette,
    colorEncoding: 'sRGB decoded to linear COLOR_0',
    materialBudget: 8,
    materialBudgetReason:
      'Mixed fortification campus shares brick,limestone,plaster,shingle,painted-metal and wood graphs; untextured glass and lawn are two additional merged groups. No private textures.',
    identityFeatures: [
      'Three differently capped square brick towers in an open triangular compound',
      'Buttressed west entry with a real round portal and open Renaissance crown',
      'Long dark covered timber wall walk and lower cream noble-house range',
    ],
  },
  sourceFacts: {
    mapIdentity: 'way/633707797 compound exact Q1866166; way/564453419 is only church ruins',
    mappedCompoundPlanMeters: [115.949, 100.204],
    namedTowers: ['Entry', 'Bishop', 'Styr'],
    publishedEntryHeightMeters: [27, 28],
    publishedStyrHeightMeters: [27, 28],
    publishedBishopHeightMeters: 13.5,
    publishedCurtainHeightMeters: [10, 12],
    mappedChurchRuinHeightMeters: 1.52,
  },
  reconstruction: frame.reconstruction,
  scaleBasis:
    'Mapped115.949×100.204m compound outline fixes overall plan. Entry28m/Styr27m chosen within conflicting primary heights; Bishop13.5m is interpreted as body plus7m roof,extent/datum uncertain. Tower/annex dimensions,roof elevations and facades are inferred from operator exterior photos. FlatY0 is provisional,not surveyed terrain.',
  refs: references.references.map((r) => r.url),
  sourceDocuments: ['map-frame.json', 'reference-metadata.json'],
  sourceLicense:
    'Original geometry under repository license. OSM geometry © OpenStreetMap contributors,ODbL-1.0. Research photographs linked only,not redistributed.',
  dataAttribution:
    '© OpenStreetMap contributors,ODbL-1.0. State Historical and Cultural Reserve in Lutsk,Lutsk Tourism and Volyn Regional Council primary references.',
  nativeAxes: frame.nativeAxes,
  geographic: () => ({
    status: 'research-only',
    replaceFootprint: false,
    groundModelY: 0,
    notes:
      'Correct castle compound supersedes misleading church-ruin identity match. West entry,north Bishop and southeast Styr interpreted from current aerial; terrain and individual building fits pending.',
    reviewStatus: 'Corrected research compound frame only; geographic activation pending',
  }),
  geographicNote:
    'Whole compound mapped footprint,not a solid building or church footprint. Signed tower orientation based on operator aerial; actual terrain,heights,approaches and footprint replacement need in-world review before activation.',
  limitations: references.limitations,
  importReason:
    'Preserve open triangular court,three distinctive towers,entry arch/buttresses and dark covered wall walk across all levels.',
  mediumFiContext: { scale: '0.8', neighborStyle: 'molen.worldgen.catalog.english_terrace' },
  camera: { position: [-130, 95, -135], lookAt: [0, 8, 0], fov: 43 },
  qaCameras: [
    { name: 'buttressed-west-entry', position: [-89, 22, -82], lookAt: [-43, 13, -39] },
    { name: 'open-courtyard-three-towers', position: [1, 60, -10], lookAt: [0, 0, 0] },
    { name: 'styr-renaissance-crown', position: [-42, 32, 86], lookAt: [-5, 15, 44] },
    { name: 'bishop-pyramidal-roof', position: [94, 30, -62], lookAt: [49, 9, -40] },
    { name: 'covered-timber-walk', position: [-8, 13, -25], lookAt: [0, 10, -46] },
    { name: 'mapped-open-compound', position: [0, 182, 1], lookAt: [0, 0, 0] },
  ],
};
