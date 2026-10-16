/** Dover's current multi-period exterior: keep, hill defenses, church and Roman pharos. */
import './install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import earcut from 'earcut';
import { normalFor } from './authored-structure-mesh.mjs';

const root = '../../../content/worldgen/source/places/u1/u10/n0284_dover_castle/';
const read = (name) => JSON.parse(readFileSync(new URL(root + name, import.meta.url)));
const frame = read('map-frame.json'),
  relief = read('relief-grid.json'),
  refs = read('reference-metadata.json'),
  c = frame.controls;
export const doverPalette = {
  stone: '#b4b6a6',
  trim: '#d5ceb8',
  flint: '#9fa99c',
  slate: '#626b70',
  brick: '#b58b72',
  grass: '#8aa065',
  paving: '#b4afa3',
  chalk: '#d2cbbb',
  recess: '#4d6178',
};
const colors = Object.fromEntries(
  Object.entries(doverPalette).map(([k, hex]) => [
    k,
    hex
      .slice(1)
      .match(/../g)
      .map((v) => {
        const s = parseInt(v, 16) / 255;
        return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
      }),
  ]),
);
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
function rect(o, x, y, z, w, h, depth, col = 'stone', slot = 'limestone') {
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
const rotate = ([x, z], a) => [
  Math.cos(a) * x + Math.sin(a) * z,
  -Math.sin(a) * x + Math.cos(a) * z,
];
const point = (p, center, a) => {
  const v = rotate(p, a);
  return [v[0] + center[0], v[1] + center[1]];
};
function local(o, center, y = 0, a = 0) {
  const rot = ([x, h, z]) => {
    const v = rotate([x, z], a);
    return [v[0], h, v[1]];
  };
  return Object.fromEntries(
    ['addQuad', 'addTriangle', 'addConvexPolygon'].map((k) => [
      k,
      (slot, ref, p, n, uv, col) =>
        o[k](
          slot,
          ref,
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
function rawHeight(x, z) {
  const i = Math.max(0, Math.min(relief.xs.length - 2, Math.floor((x - relief.xs[0]) / 40))),
    j = Math.max(0, Math.min(relief.zs.length - 2, Math.floor((z - relief.zs[0]) / 40)));
  const u = Math.max(0, Math.min(1, (x - relief.xs[i]) / 40)),
    v = Math.max(0, Math.min(1, (z - relief.zs[j]) / 40)),
    g = relief.elevationsMeters;
  return (
    (1 - u) * (1 - v) * g[j][i] +
    u * (1 - v) * g[j][i + 1] +
    (1 - u) * v * g[j + 1][i] +
    u * v * g[j + 1][i + 1]
  );
}
const datum = Math.min(...frame.geometry.outline.map((p) => rawHeight(...p)));
// Shared terrain topology keeps the surface fixed through every detail upgrade.
const outline = frame.geometry.outline;
const knots = (axis, special) =>
  [
    ...new Set([
      Math.min(...outline.map((p) => p[axis])),
      Math.max(...outline.map((p) => p[axis])),
      ...special,
    ]),
  ].sort((a, b) => a - b);
const xs = knots(0, [-200, -160, -40, 10, 30, 94, 120]),
  zs = knots(1, [-240, -125, -80, 50, 64, 128, 240]);
function nodeHeight(x, z) {
  let h = rawHeight(x, z);
  // Qualified authoring terraces are declared explicitly; no radial triangulation spikes.
  for (const [lo, hi, elev] of [
    [[-160, -125], [10, 50], c.keep.padElevationMeters],
    [[30, 64], [94, 128], c.church.padElevationMeters],
  ]) {
    const distance = Math.max(lo[0] - x, x - hi[0], lo[1] - z, z - hi[1], 0),
      blend = Math.max(0, 1 - distance / 30);
    h = h * (1 - blend) + elev * blend;
  }
  return Math.max(0, h - datum);
}
function surfaceHeight(x, z) {
  const i = Math.max(
      0,
      Math.min(
        xs.length - 2,
        xs.findIndex((_v, k) => k < xs.length - 1 && x <= xs[k + 1]),
      ),
    ),
    j = Math.max(
      0,
      Math.min(
        zs.length - 2,
        zs.findIndex((_v, k) => k < zs.length - 1 && z <= zs[k + 1]),
      ),
    );
  const u = (x - xs[i]) / (xs[i + 1] - xs[i]),
    v = (z - zs[j]) / (zs[j + 1] - zs[j]),
    h00 = nodeHeight(xs[i], zs[j]),
    h10 = nodeHeight(xs[i + 1], zs[j]),
    h01 = nodeHeight(xs[i], zs[j + 1]),
    h11 = nodeHeight(xs[i + 1], zs[j + 1]);
  return v <= u ? h00 + (h10 - h00) * u + (h11 - h10) * v : h00 + (h11 - h01) * u + (h01 - h00) * v;
}
function clip(loop, triangle) {
  let p = loop;
  for (let i = 0; i < 3; i++) {
    const a = triangle[i],
      b = triangle[(i + 1) % 3],
      side = (v) => (b[0] - a[0]) * (v[1] - a[1]) - (b[1] - a[1]) * (v[0] - a[0]),
      out = [];
    for (let j = 0; j < p.length; j++) {
      const u = p[j],
        v = p[(j + 1) % p.length],
        s = side(u),
        e = side(v);
      if (s >= -1e-7) out.push(u);
      if (s >= -1e-7 !== e >= -1e-7) {
        const f = s / (s - e);
        out.push([u[0] + (v[0] - u[0]) * f, u[1] + (v[1] - u[1]) * f]);
      }
    }
    p = out;
    if (p.length < 3) return [];
  }
  return p.filter(
    (v, i) =>
      Math.hypot(v[0] - p[(i + 1) % p.length][0], v[1] - p[(i + 1) % p.length][1]) > 0.00001,
  );
}
function edgeCuts(a, b) {
  const cuts = [0, 1],
    dx = b[0] - a[0],
    dz = b[1] - a[1];
  const add = (t) => {
    if (t > 1e-8 && t < 1 - 1e-8) cuts.push(t);
  };
  if (Math.abs(dx) > 1e-8) for (const x of xs) add((x - a[0]) / dx);
  if (Math.abs(dz) > 1e-8) for (const z of zs) add((z - a[1]) / dz);
  for (let i = 0; i < xs.length - 1; i++)
    for (let j = 0; j < zs.length - 1; j++) {
      const w = xs[i + 1] - xs[i],
        h = zs[j + 1] - zs[j],
        den = dx * h - dz * w;
      if (Math.abs(den) < 1e-8) continue;
      const t = ((xs[i] - a[0]) * h - (zs[j] - a[1]) * w) / den;
      const x = a[0] + dx * t,
        z = a[1] + dz * t;
      if (x >= xs[i] - 1e-7 && x <= xs[i + 1] + 1e-7 && z >= zs[j] - 1e-7 && z <= zs[j + 1] + 1e-7)
        add(t);
    }
  return cuts.sort((a, b) => a - b).filter((v, i, a) => i === 0 || v - a[i - 1] > 1e-7);
}
function ground(o) {
  for (let i = 0; i < xs.length - 1; i++)
    for (let j = 0; j < zs.length - 1; j++) {
      const a = [xs[i], zs[j]],
        b = [xs[i + 1], zs[j]],
        cc = [xs[i + 1], zs[j + 1]],
        e = [xs[i], zs[j + 1]];
      for (const triangle of [
        [a, b, cc],
        [a, cc, e],
      ]) {
        const p = clip(outline, triangle),
          ids = earcut(p.flat(), [], 2);
        for (let k = 0; k < ids.length; k += 3)
          face(
            o,
            ids.slice(k, k + 3).map((n) => [p[n][0], surfaceHeight(...p[n]), p[n][1]]),
            'grass',
            'foliage',
            [0, 1, 0],
          );
      }
    }
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i],
      b = outline[(i + 1) % outline.length],
      cuts = edgeCuts(a, b);
    const top = cuts.map((t) => {
      const x = a[0] + (b[0] - a[0]) * t,
        z = a[1] + (b[1] - a[1]) * t;
      return [t, surfaceHeight(x, z)];
    });
    const profile = [...top, [1, 0], [0, 0]],
      ids = earcut(profile.flat(), [], 2);
    for (let j = 0; j < ids.length; j += 3) {
      face(
        o,
        ids.slice(j, j + 3).map((k) => {
          const [t, y] = profile[k];
          return [a[0] + (b[0] - a[0]) * t, y, a[1] + (b[1] - a[1]) * t];
        }),
        'chalk',
        'foliage',
        [b[1] - a[1], 0, a[0] - b[0]],
      );
    }
  }
}
function ring(o, loop, base, top, width = 1.4, col = 'stone', slot = 'limestone') {
  const center = loop.reduce(
    (s, p) => [s[0] + p[0] / loop.length, s[1] + p[1] / loop.length],
    [0, 0],
  );
  const inner = loop.map((p) => {
    const r = Math.hypot(p[0] - center[0], p[1] - center[1]);
    return [p[0] + ((center[0] - p[0]) * width) / r, p[1] + ((center[1] - p[1]) * width) / r];
  });
  for (let i = 0; i < loop.length; i++) {
    const j = (i + 1) % loop.length,
      a = loop[i],
      b = loop[j],
      u = inner[i],
      v = inner[j];
    face(
      o,
      [
        [a[0], base, a[1]],
        [b[0], base, b[1]],
        [b[0], top, b[1]],
        [a[0], top, a[1]],
      ],
      col,
      slot,
      [b[1] - a[1], 0, a[0] - b[0]],
    );
    face(
      o,
      [
        [v[0], base, v[1]],
        [u[0], base, u[1]],
        [u[0], top, u[1]],
        [v[0], top, v[1]],
      ],
      col,
      slot,
      [u[1] - v[1], 0, v[0] - u[0]],
    );
    face(
      o,
      [
        [a[0], top, a[1]],
        [b[0], top, b[1]],
        [v[0], top, v[1]],
        [u[0], top, u[1]],
      ],
      col,
      slot,
      [0, 1, 0],
    );
  }
}
function slopeWall(o, a, b, height, thick = 2.4, detail = 0, crown = false, segment = false) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  if (!segment && len > 25) {
    const n = Math.ceil(len / (detail === 0 ? 80 : 25));
    for (let i = 0; i < n; i++) {
      const u = i / n,
        v = (i + 1) / n;
      slopeWall(
        o,
        [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u],
        [a[0] + (b[0] - a[0]) * v, a[1] + (b[1] - a[1]) * v],
        height,
        thick,
        detail,
        crown,
        true,
      );
    }
    return;
  }
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]),
    nx = (((b[1] - a[1]) / length) * thick) / 2,
    nz = (((a[0] - b[0]) / length) * thick) / 2,
    ha = surfaceHeight(...a),
    hb = surfaceHeight(...b);
  const middle = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  if (
    length > 12 &&
    Math.abs(surfaceHeight(...middle) - (ha + hb) / 2) > (detail === 0 ? 1.5 : 0.35)
  ) {
    slopeWall(o, a, middle, height, thick, detail, crown, true);
    slopeWall(o, middle, b, height, thick, detail, crown, true);
    return;
  }
  for (const sign of [-1, 1])
    face(
      o,
      [
        [a[0] + sign * nx, ha, a[1] + sign * nz],
        [b[0] + sign * nx, hb, b[1] + sign * nz],
        [b[0] + sign * nx, hb + height, b[1] + sign * nz],
        [a[0] + sign * nx, ha + height, a[1] + sign * nz],
      ],
      'stone',
      'limestone',
      [sign * nx, 0, sign * nz],
    );
  if (detail > 0)
    face(
      o,
      [
        [a[0] - nx, ha + height, a[1] - nz],
        [b[0] - nx, hb + height, b[1] - nz],
        [b[0] + nx, hb + height, b[1] + nz],
        [a[0] + nx, ha + height, a[1] + nz],
      ],
      'trim',
      'limestone',
      [0, 1, 0],
    );
  if (detail >= 2 && crown) {
    const n = Math.max(1, Math.floor(length / 12));
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n,
        x = a[0] + (b[0] - a[0]) * t,
        z = a[1] + (b[1] - a[1]) * t;
      const q = local(
        o,
        [x, z],
        ha * (1 - t) + hb * t + height,
        Math.atan2(a[1] - b[1], b[0] - a[0]),
      );
      rect(q, 0, 0, 0, 2.1, 0.9, thick, 'trim');
    }
  }
}
function roof(o, x, y, z, w, depth, rise, col = 'slate', slot = 'slate') {
  const a = x - w / 2,
    b = x + w / 2,
    u = z - depth / 2,
    v = z + depth / 2;
  face(
    o,
    [
      [a, y, u],
      [b, y, u],
      [b, y + rise, z],
      [a, y + rise, z],
    ],
    col,
    slot,
    [0, 1, -1],
  );
  face(
    o,
    [
      [a, y + rise, z],
      [b, y + rise, z],
      [b, y, v],
      [a, y, v],
    ],
    col,
    slot,
    [0, 1, 1],
  );
  face(
    o,
    [
      [a, y, u],
      [a, y + rise, z],
      [a, y, v],
    ],
    'stone',
    'limestone',
    [-1, 0, 0],
  );
  face(
    o,
    [
      [b, y, v],
      [b, y + rise, z],
      [b, y, u],
    ],
    'stone',
    'limestone',
    [1, 0, 0],
  );
}
function windowWall(o, width, base, top, z, holes, d, col = 'flint', slot = 'stone') {
  const outer = [
      [-width / 2, base],
      [width / 2, base],
      [width / 2, top],
      [-width / 2, top],
    ],
    rings = [outer],
    offsets = [];
  for (const h of holes) {
    offsets.push(rings.flat().length);
    rings.push([
      [h.x - h.w / 2, h.y],
      [h.x - h.w / 2, h.y + h.h],
      [h.x + h.w / 2, h.y + h.h],
      [h.x + h.w / 2, h.y],
    ]);
  }
  const vertices = rings.flat(),
    ids = earcut(vertices.flat(), offsets, 2);
  for (let i = 0; i < ids.length; i += 3)
    face(
      o,
      ids.slice(i, i + 3).map((j) => [...vertices[j], z]),
      col,
      slot,
      [0, 0, 1],
    );
  for (const h of holes) {
    const a = h.x - h.w / 2,
      b = h.x + h.w / 2,
      t = h.y + h.h;
    face(
      o,
      [
        [a, h.y, z - 0.8],
        [b, h.y, z - 0.8],
        [b, t, z - 0.8],
        [a, t, z - 0.8],
      ],
      'recess',
      'recess',
      [0, 0, 1],
    );
    if (d >= 2)
      for (const p of [
        [
          [a, h.y, z],
          [a, t, z],
          [a, t, z - 0.8],
          [a, h.y, z - 0.8],
        ],
        [
          [b, t, z],
          [b, h.y, z],
          [b, h.y, z - 0.8],
          [b, t, z - 0.8],
        ],
        [
          [a, t, z],
          [b, t, z],
          [b, t, z - 0.8],
          [a, t, z - 0.8],
        ],
        [
          [b, h.y, z],
          [a, h.y, z],
          [a, h.y, z - 0.8],
          [b, h.y, z - 0.8],
        ],
      ])
        face(o, p, 'trim', 'limestone');
  }
}
function keep(o, d) {
  const k = c.keep,
    y = k.padElevationMeters - datum,
    q = local(o, k.center, y, k.angle),
    w = k.width,
    dep = k.depth;
  if (d === 0) rect(q, 0, 0, 0, w, 22.6, dep, 'flint', 'stone');
  else
    for (const a of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
      const f = local(q, [0, 0], 0, a),
        width = a === 0 || a === Math.PI ? w : dep,
        depth = a === 0 || a === Math.PI ? dep : w;
      const holes = [7.2, 15].flatMap((h, j) =>
        [-6, 6].map((x) => ({ x, y: h, w: 2.3, h: j ? 3 : 2.6 })),
      );
      windowWall(f, width, 0, 22.6, depth / 2, holes, d);
      // Bold pale courses and clasping pilasters carry the real flint/stone identity.
      for (const h of [6.2, 13.7, 21.6]) rect(f, 0, h, depth / 2 + 0.035, width, 0.5, 0.14, 'trim');
      if (d >= 2)
        for (const x of [-width / 2 + 1.8, 0, width / 2 - 1.8])
          rect(f, x, 0, depth / 2 + 0.1, 1.25, 22.6, 0.3, 'trim');
    }
  for (const x of [-w / 2 + 2.7, w / 2 - 2.7])
    for (const z of [-dep / 2 + 2.7, dep / 2 - 2.7]) {
      if (d === 0) rect(q, x, 0, z, 5.4, 25.3, 5.4, 'trim');
      else {
        rect(q, x, 0, z, 5.4, 23.8, 5.4, 'flint', 'stone');
        rect(q, x, 23.8, z, 5.4, 1.5, 5.4, 'trim');
      }
    }
  face(
    q,
    [
      [-w / 2, 22.3, -dep / 2],
      [w / 2, 22.3, -dep / 2],
      [w / 2, 22.3, dep / 2],
      [-w / 2, 22.3, dep / 2],
    ],
    'paving',
    'foliage',
    [0, 1, 0],
  );
  if (d > 0)
    ring(
      q,
      [
        [-w / 2, -dep / 2],
        [w / 2, -dep / 2],
        [w / 2, dep / 2],
        [-w / 2, dep / 2],
      ],
      22.3,
      23.6,
      1.1,
      'trim',
    );
  // Lower forebuilding on the east flank, with descending covered entrance stages.
  for (const [z, h, length] of [
    [-7, 18, 14],
    [5, 11.5, 10],
    [13, 5.5, 8],
  ])
    rect(q, w / 2 + 4.3, 0, z, 8.6, h, length, 'stone');
  if (d >= 1) {
    roof(q, w / 2 + 4.3, 18, -7, 8.8, 14.3, 1.4);
    rect(q, w / 2 + 8.65, 0.05, 13, 0.15, 4.1, 2.5, 'recess', 'recess');
  }
  if (d >= 2) {
    for (let i = 0; i < 5; i++)
      rect(q, w / 2 + 11 + i * 1.3, 0, 13, 1.3, Math.max(0.4, 2.5 - i * 0.45), 3.2, 'trim');
  }
}
function roundTower(o, p, height, d, col = 'stone', slot = 'limestone', radius = 5) {
  const y = surfaceHeight(...p),
    n = [6, 8, 12, 16][d],
    loop = Array.from({ length: n }, (_, i) => [
      p[0] + radius * Math.cos((2 * Math.PI * i) / n),
      p[1] + radius * Math.sin((2 * Math.PI * i) / n),
    ]);
  if (d === 0) {
    for (let i = 0; i < n; i++) {
      const a = loop[i],
        b = loop[(i + 1) % n];
      face(
        o,
        [
          [a[0], y, a[1]],
          [b[0], y, b[1]],
          [b[0], y + height, b[1]],
          [a[0], y + height, a[1]],
        ],
        col,
        slot,
        [b[1] - a[1], 0, a[0] - b[0]],
      );
    }
    for (let i = 1; i < n - 1; i++)
      face(
        o,
        [loop[0], loop[i], loop[i + 1]].map((p) => [p[0], y + height, p[1]]),
        col,
        slot,
        [0, 1, 0],
      );
  } else ring(o, loop, y, y + height, 1.7, col, slot);
}
function gate(o, p, a, d, height = 14) {
  const y = surfaceHeight(...p),
    q = local(o, p, y, a);
  for (const x of [-5.5, 5.5]) rect(q, x, 0, 0, 6, height, 9);
  // Open passage, with a simple polygonal arch rather than a painted closed door.
  rect(q, 0, 5.5, 0, 5, Math.max(0.5, height - 5.5), 8, 'trim');
  if (d >= 1) {
    face(
      q,
      [
        [-2.5, 3.3, 4],
        [0, 5.5, 4],
        [-2.5, 5.5, 4],
      ],
      'stone',
    );
    face(
      q,
      [
        [0, 5.5, 4],
        [2.5, 3.3, 4],
        [2.5, 5.5, 4],
      ],
      'stone',
    );
  }
}
function innerWard(o, d) {
  const w = c.innerWard,
    pts = w.loop.map((p) => point(p, w.center, w.angle));
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i],
      b = pts[(i + 1) % pts.length];
    if (i === 0 || i === 4) {
      const u = [a[0] * 0.55 + b[0] * 0.45, a[1] * 0.55 + b[1] * 0.45],
        v = [a[0] * 0.45 + b[0] * 0.55, a[1] * 0.45 + b[1] * 0.55];
      slopeWall(o, a, u, 10.5, 3, d, d >= 2);
      slopeWall(o, v, b, 10.5, 3, d, d >= 2);
      gate(
        o,
        [(u[0] + v[0]) / 2, (u[1] + v[1]) / 2],
        Math.atan2(a[1] - b[1], b[0] - a[0]),
        d,
        11.7,
      );
    } else slopeWall(o, a, b, 10.5, 3, d, d >= 2);
  }
  for (const p of [...w.loop, ...(d === 0 ? [] : w.secondaryTowers)]) {
    const v = point(p, w.center, w.angle),
      y = surfaceHeight(...v),
      q = local(o, v, y, w.angle);
    if (d === 0) rect(q, 0, 0, 0, 6.6, 11.5, 6.6);
    else
      ring(
        q,
        [
          [-3.3, -3.3],
          [3.3, -3.3],
          [3.3, 3.3],
          [-3.3, 3.3],
        ],
        0,
        11.5,
        1.3,
      );
  }
  // Arthur's Hall and the later barrack conversions occupy the eastern and southern ward.
  for (const [x, z, width, dep, h] of [
    [46, 0, 13, 52, 8],
    [7, 43, 49, 12, 7.5],
  ]) {
    const center = point([x, z], w.center, w.angle),
      q = local(o, center, c.keep.padElevationMeters - datum, w.angle);
    rect(q, 0, 0, 0, width, h, dep);
    roof(q, 0, h, 0, width + 0.7, dep + 0.7, 2.4);
    if (d >= 2)
      for (const xx of [-width * 0.3, 0, width * 0.3])
        rect(q, xx, 3, dep / 2 + 0.05, 1.4, 2.4, 0.12, 'recess', 'recess');
  }
  if (d >= 1) {
    const p = point([-51, -64], w.center, w.angle);
    gate(o, p, w.angle, d, 8.5);
    for (const sign of [-1, 1])
      slopeWall(
        o,
        point([sign * 9 - 51, -64], w.center, w.angle),
        point([sign * 9 - 51, -49], w.center, w.angle),
        7.2,
        2,
        d,
      );
  }
}
function church(o, d) {
  const k = c.church,
    q = local(o, k.center, k.padElevationMeters - datum, k.angle);
  for (const [x, z, w, dep, h, rise] of [
    [-6, 0, 30, 10, 8.5, 5],
    [12, 0, 15, 9, 8, 4.5],
    [4, -9, 10, 8, 8.5, 4],
    [4, 9, 10, 8, 8.5, 4],
  ]) {
    rect(q, x, 0, z, w, h, dep, 'flint', 'stone');
    roof(q, x, h, z, w + 0.5, dep + 0.5, rise);
  }
  rect(q, 4, 0, 0, 9.5, d === 0 ? 21.5 : 20, 10, 'flint', 'stone');
  if (d > 0)
    ring(
      q,
      [
        [-0.75, -5],
        [8.75, -5],
        [8.75, 5],
        [-0.75, 5],
      ],
      20,
      21.5,
      1.1,
      'trim',
    );
  if (d >= 1) {
    for (const side of [-1, 1])
      for (const x of [-15, -8]) rect(q, x, 3.8, side * 5.1, 1.8, 3, 0.2, 'recess', 'recess');
    for (const side of [-1, 1]) rect(q, 4, 15, side * 5.1, 2, 3.8, 0.2, 'recess', 'recess');
  }
  const p = point(k.pharosOffset, k.center, k.angle),
    ph = local(o, p, k.padElevationMeters - datum);
  // Octagonal surviving tower, not the lost24m original height. Open top remains visible.
  for (const [base, top, r] of [
    [0, 7, 3.8],
    [7, 14, 3.5],
    [14, 19, 3.1],
  ]) {
    const loop = Array.from({ length: 8 }, (_, i) => [
      r * Math.cos((2 * Math.PI * i) / 8),
      r * Math.sin((2 * Math.PI * i) / 8),
    ]);
    if (d === 0) {
      for (let i = 0; i < 8; i++) {
        const a = loop[i],
          b = loop[(i + 1) % 8];
        face(
          ph,
          [
            [a[0], base, a[1]],
            [b[0], base, b[1]],
            [b[0], top, b[1]],
            [a[0], top, a[1]],
          ],
          'flint',
          'stone',
          [b[1] - a[1], 0, a[0] - b[0]],
        );
      }
    } else ring(ph, loop, base, top, 1.1, 'flint', 'stone');
    if (d >= 2)
      for (let i = 0; i < 8; i++) {
        const a = loop[i],
          b = loop[(i + 1) % 8];
        face(
          ph,
          [
            [a[0], top - 0.6, a[1]],
            [b[0], top - 0.6, b[1]],
            [b[0], top - 0.25, b[1]],
            [a[0], top - 0.25, a[1]],
          ],
          'brick',
          'brick',
        );
      }
  }
  if (d >= 2) rect(ph, 0, 1, 3.8, 1.6, 3, 0.13, 'recess', 'recess');
}
function outerDefenses(o, d) {
  const pts = c.outerCurtain;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i],
      b = pts[(i + 1) % pts.length];
    if (i === 11) {
      slopeWall(o, a, [-189, 13], 8, 2.8, d);
      slopeWall(o, [-191, -3], b, 8, 2.8, d);
      gate(o, c.constableGate.center, c.constableGate.angle, d, 16);
    } else slopeWall(o, a, b, i >= 2 && i <= 6 ? 4.5 : 8, 2.8, d, d >= 2 && i >= 8);
  }
  const selected = d === 0 ? [0, 9] : [0, 1, 2, 3, 7, 8, 9, 10, 12];
  for (const i of selected) roundTower(o, pts[i], i < 4 ? 8 : 10, d);
  for (let i = 0; i < c.spur.length; i++)
    slopeWall(o, c.spur[i], c.spur[(i + 1) % c.spur.length], 4, 3, d);
  if (d >= 1) {
    rect(
      local(o, [-182, -182], surfaceHeight(-182, -182), 0.46),
      0,
      0,
      0,
      20,
      7,
      8,
      'brick',
      'brick',
    );
    roundTower(o, [-195, -193], 8, d, 'stone', 'limestone', 3.3);
  }
  for (const [i, b] of c.barracks.entries()) {
    if (d === 0 && i > 0) continue;
    const y = surfaceHeight(...b.center),
      q = local(o, b.center, y, b.angle);
    // Deep footing reaches the sampled slope; floor and roof retain a straight datum.
    const corners = [
      [-b.width / 2, -b.depth / 2],
      [b.width / 2, -b.depth / 2],
      [b.width / 2, b.depth / 2],
      [-b.width / 2, b.depth / 2],
    ].map((p) => point(p, b.center, b.angle));
    const samples = corners.flatMap((a, i) => {
      const b = corners[(i + 1) % 4];
      return Array.from({ length: 9 }, (_, j) => [
        a[0] + ((b[0] - a[0]) * j) / 8,
        a[1] + ((b[1] - a[1]) * j) / 8,
      ]);
    });
    const bottom = Math.min(...samples.map((p) => surfaceHeight(...p))) - y,
      top = Math.max(...corners.map((p) => surfaceHeight(...p))) - y + b.height;
    rect(q, 0, bottom, 0, b.width, top - bottom, b.depth);
    roof(q, 0, top, 0, b.width + 0.8, b.depth + 0.8, 3);
    if (d >= 2)
      for (let x = -b.width / 2 + 4; x < b.width / 2 - 2; x += 7)
        for (const side of [-1, 1])
          rect(q, x, top - 4, side * (b.depth / 2 + 0.05), 1.8, 2.5, 0.15, 'recess', 'recess');
  }
  if (d >= 1) {
    const p = [197, 281],
      q = local(o, p, surfaceHeight(...p), 0.46);
    rect(q, 0, 0, 0, 17, 7, 12, 'trim');
    rect(q, 0, 7, 0, 21, 1, 16, 'trim');
    if (d >= 2) rect(q, 0, 4, 6.1, 13, 2, 0.15, 'recess', 'recess');
  }
}
function build(o, d) {
  ground(o, d);
  keep(o, d);
  innerWard(o, d);
  church(o, d);
  outerDefenses(o, d);
}
export const buildDoverRuntime = (o, level = 'closeup') =>
  build(o, { skyline: 0, district: 1, street: 2, closeup: 3 }[level] ?? 3);
export const buildDoverSkyline = (o) =>
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
            col.map((v) => v * (s === 'foliage' || s === 'recess' ? 1 : 0.65)),
          ),
      ]),
    ),
    0,
  );
export const doverStudy = {
  id: 'N0284',
  key: 'dover_castle',
  title: 'Dover Castle',
  category: 'castle',
  wikidataId: 'Q950970',
  mapFrame: 'map-frame.json',
  fidelityTarget: 'medium-fi',
  build: (o) => buildDoverRuntime(o),
  brief:
    'Current multi-period hilltop fortress:square flint-and-pale-stone Great Tower with east forebuilding,14inner mural towers,lowered outer defenses,northern spur,Constable gate,church/octagonal Roman pharos and selected later barracks.',
  appearance: {
    standard: 'docs-src/guide/medium-fi.md',
    paletteSrgb: doverPalette,
    colorEncoding: 'sRGB decoded to linear COLOR_0',
    materialBudget: 6,
    identityFeatures: [
      'Square Great Tower with four clasping corner turrets and lower forebuilding',
      'Layered fortified hill with concentric inner ward and reduced outer defenses',
      'Separate cruciform St Mary church and surviving octagonal Roman pharos',
    ],
  },
  sourceFacts: {
    mapIdentity: 'way/26658038 exactQ950970',
    mappedSitePlanMeters: [691.468, 387.968],
    keepHeightMeters: 25.3,
    keepWidthMeters: 29.7,
    keepWidthStatus: 'Approximate near30m plan',
    pharosSurvivingHeightMeters: 19,
    innerMuralTowers: 14,
    terrainDatumMeters: datum,
    keepPadElevationMeters: 111.82,
    churchPadElevationMeters: 113,
  },
  reconstruction: frame.reconstruction,
  scaleBasis:
    'Exact cached compound boundary,primary keep/pharos heights and original estimated internal massing with cached40m mixed-source terrain samples.',
  refs: refs.references.map((r) => r.url),
  sourceDocuments: ['map-frame.json', 'relief-grid.json', 'reference-metadata.json'],
  nativeAxes: frame.nativeAxes,
  sourceLicense:
    'Original geometry under repository license. Cached OSM boundary © OpenStreetMap contributors,ODbL-1.0. Mapzen mixed-source terrain attribution in relief-grid.json. Copyright architectural references linked only;no diagrams,photos or traced vectors redistributed.',
  dataAttribution:
    '© OpenStreetMap contributors;Mapzen Terrain Tiles/contributing agencies;English Heritage and Historic England factual architectural references.',
  geographic: () => ({
    status: 'research-only',
    replaceFootprint: false,
    groundModelY: 0,
    notes:
      'Native true east/south,heading0. Approximate internal geometry and relative DEM patch need host-terrain datum and signed whole-site fit review.',
    reviewStatus: 'Inactive geographic draft;review pending',
  }),
  geographicNote:
    'Compound study with qualified DEM and estimated internal plan;inactive pending real-site/terrain review.',
  limitations: refs.limitations,
  importReason:
    'Keep the Great Tower,layered hill defenses and Roman/Saxon church group readable in compact shared-material levels.',
  mediumFiContext: { scale: '4', neighborStyle: 'molen.worldgen.catalog.english_terrace' },
  camera: { position: [-520, 380, 620], lookAt: [-20, 65, 60], fov: 43 },
  qaCameras: [
    {
      name: 'great-tower-and-concentric-ward',
      position: [-260, 210 - datum, 110],
      lookAt: [-78, 125 - datum, -35],
    },
    {
      name: 'flint-keep-and-forebuilding',
      position: [-6, 125 - datum, -18],
      lookAt: [-78, 125 - datum, -35],
    },
    {
      name: 'roman-pharos-and-saxon-church',
      position: [0, 145 - datum, 166],
      lookAt: [62, 125 - datum, 96],
    },
    {
      name: 'western-curtain-and-constable-gate',
      position: [-310, 118 - datum, 50],
      lookAt: [-183, 90 - datum, 5],
    },
    {
      name: 'northern-spur-and-reduced-defenses',
      position: [-350, 160 - datum, -310],
      lookAt: [-165, 95 - datum, -177],
    },
    {
      name: 'later-barracks-and-chalk-hill',
      position: [310, 200 - datum, 440],
      lookAt: [75, 85 - datum, 215],
    },
  ],
};
