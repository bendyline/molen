/** Viewer PMTiles footing derivative; detailed original Acrocorinth master remains preserved. */
import './install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import earcut from 'earcut';
import { normalFor } from './authored-structure-mesh.mjs';

const root = '../../../content/worldgen/source/places/sw/sw8/n0281_acrocorinth/';
const read = (name) => JSON.parse(readFileSync(new URL(root + name, import.meta.url)));
const frame = read('map-frame.json'),
  relief = read('relief-grid.json'),
  survey = read('survey-lines.json'),
  references = read('reference-metadata.json'),
  controls = frame.controls;
export const acrocorinthPalette = {
  wall: '#c8bea6',
  infill: '#cfb88f',
  rock: '#b7ae9a',
  grass: '#8ca164',
  paving: '#aaa59a',
  recess: '#4d6178',
};
const colors = Object.fromEntries(
  Object.entries(acrocorinthPalette).map(([key, hex]) => [
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
function face(o, p, color = 'wall', slot = 'limestone', target) {
  if (target && normalFor(...p.slice(0, 3)).reduce((n, v, i) => n + v * target[i], 0) < 0)
    p = [...p].reverse();
  for (let i = 1; i < p.length - 1; i++) {
    const t = [p[0], p[i], p[i + 1]],
      n = normalFor(...t);
    if (Math.hypot(...n) < 0.5) continue;
    o.addTriangle(
      slot,
      'palette:#ffffff',
      t,
      n,
      t.map((v) => [v[0], v[2]]),
      colors[color],
    );
  }
}
function local(o, x, y, z, angle = 0) {
  const c = Math.cos(angle),
    s = Math.sin(angle),
    rot = ([u, h, v]) => [c * u + s * v, h, -s * u + c * v];
  return Object.fromEntries(
    ['addQuad', 'addTriangle', 'addConvexPolygon'].map((k) => [
      k,
      (slot, ref, p, n, uv, col) =>
        o[k](
          slot,
          ref,
          p.map((v) => {
            const q = rot(v);
            return [q[0] + x, q[1] + y, q[2] + z];
          }),
          rot(n),
          uv,
          col,
        ),
    ]),
  );
}
function rect(o, x, y, z, w, h, dep, color = 'wall', slot = 'limestone') {
  const a = x - w / 2,
    b = x + w / 2,
    c = z - dep / 2,
    e = z + dep / 2,
    t = y + h;
  for (const [p, n] of [
    [
      [
        [a, y, e],
        [b, y, e],
        [b, t, e],
        [a, t, e],
      ],
      [0, 0, 1],
    ],
    [
      [
        [b, y, c],
        [a, y, c],
        [a, t, c],
        [b, t, c],
      ],
      [0, 0, -1],
    ],
    [
      [
        [a, y, c],
        [a, y, e],
        [a, t, e],
        [a, t, c],
      ],
      [-1, 0, 0],
    ],
    [
      [
        [b, y, e],
        [b, y, c],
        [b, t, c],
        [b, t, e],
      ],
      [1, 0, 0],
    ],
    [
      [
        [a, t, c],
        [b, t, c],
        [b, t, e],
        [a, t, e],
      ],
      [0, 1, 0],
    ],
  ])
    face(o, p, color, slot, n);
}
function simplify(p, eps) {
  if (p.length < 3) return p;
  const a = p[0],
    b = p.at(-1),
    dx = b[0] - a[0],
    dz = b[1] - a[1],
    len = dx * dx + dz * dz;
  let max = 0,
    index = -1;
  for (let i = 1; i < p.length - 1; i++) {
    const t = len
        ? Math.max(0, Math.min(1, ((p[i][0] - a[0]) * dx + (p[i][1] - a[1]) * dz) / len))
        : 0,
      d = Math.hypot(p[i][0] - a[0] - dx * t, p[i][1] - a[1] - dz * t);
    if (d > max) {
      max = d;
      index = i;
    }
  }
  return max > eps
    ? [...simplify(p.slice(0, index + 1), eps).slice(0, -1), ...simplify(p.slice(index), eps)]
    : [a, b];
}
function rawHeight(x, z) {
  const i = Math.max(0, Math.min(23, Math.floor((x + 480) / 40))),
    j = Math.max(0, Math.min(15, Math.floor((z + 320) / 40))),
    u = Math.max(0, Math.min(1, (x - relief.xs[i]) / 40)),
    v = Math.max(0, Math.min(1, (z - relief.zs[j]) / 40)),
    g = relief.elevationsMeters;
  return (
    (1 - u) * (1 - v) * g[j][i] +
    u * (1 - v) * g[j][i + 1] +
    (1 - u) * v * g[j + 1][i] +
    u * v * g[j + 1][i + 1] -
    controls.terrainDatumMeters
  );
}
function terrainAxes(d) {
  const step = [160, 80, 40, 40][d],
    knots = (lo, hi, special) =>
      [
        ...new Set([
          ...Array.from({ length: (hi - lo) / step + 1 }, (_, i) => lo + i * step),
          ...special,
        ]),
      ].sort((a, b) => a - b);
  // Common identity nodes keep all gate thresholds, keep footing and summit datum stable.
  return [
    knots(-480, 480, [-399, -321, -234, -160.6, 200]),
    knots(-320, 320, [-40, 74, 80, 199.7]),
  ];
}
function originalGroundHeight(x, z, d) {
  const [xs, zs] = terrainAxes(d),
    i = Math.max(
      0,
      xs.findIndex((_v, k) => k < xs.length - 1 && x <= xs[k + 1]),
    ),
    j = Math.max(
      0,
      zs.findIndex((_v, k) => k < zs.length - 1 && z <= zs[k + 1]),
    ),
    a = xs[i],
    b = xs[i + 1],
    c = zs[j],
    e = zs[j + 1],
    u = (x - a) / (b - a),
    v = (z - c) / (e - c),
    h00 = rawHeight(a, c),
    h10 = rawHeight(b, c),
    h01 = rawHeight(a, e),
    h11 = rawHeight(b, e);
  // Match the actual triangular terrain, rather than floating above a bilinear surface.
  return v <= u ? h00 + (h10 - h00) * u + (h11 - h10) * v : h00 + (h11 - h01) * u + (h01 - h00) * v;
}
function terrain(o, d) {
  const [xs, zs] = terrainAxes(d);
  for (let i = 0; i < xs.length - 1; i++)
    for (let j = 0; j < zs.length - 1; j++) {
      const p = [
        [xs[i], zs[j]],
        [xs[i + 1], zs[j]],
        [xs[i + 1], zs[j + 1]],
        [xs[i], zs[j + 1]],
      ].map(([x, z]) => [x, rawHeight(x, z), z]);
      for (const ids of [
        [0, 2, 1],
        [0, 3, 2],
      ]) {
        const t = ids.map((k) => p[k]),
          x = t.reduce((n, v) => n + v[0], 0) / 3,
          z = t.reduce((n, v) => n + v[2], 0) / 3,
          slope = Math.hypot(
            (rawHeight(x + 12, z) - rawHeight(x - 12, z)) / 24,
            (rawHeight(x, z + 12) - rawHeight(x, z - 12)) / 24,
          ),
          steep = slope > 0.55 || (z < -75 && x > -250 && x < 250 && slope > 0.3);
        face(o, t, steep ? 'rock' : 'grass', steep ? 'weathered' : 'foliage', [0, 1, 0]);
      }
    }
}
function wall(o, a, b, height, width, d, merlons = false) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    len = Math.hypot(dx, dz);
  if (len < 0.3) return;
  const parts = d === 0 ? 1 : Math.max(1, Math.ceil(len / [80, 50, 25, 15][d])),
    nx = ((dz / len) * width) / 2,
    nz = ((-dx / len) * width) / 2;
  for (let j = 0; j < parts; j++) {
    const u = j / parts,
      v = (j + 1) / parts,
      x = a[0] + dx * u,
      z = a[1] + dz * u,
      e = a[0] + dx * v,
      f = a[1] + dz * v,
      ya = groundHeight(x, z, d),
      yb = groundHeight(e, f, d);
    for (const s of [-1, 1])
      face(
        o,
        [
          [x + s * nx, ya, z + s * nz],
          [e + s * nx, yb, f + s * nz],
          [e + s * nx, yb + height, f + s * nz],
          [x + s * nx, ya + height, z + s * nz],
        ],
        'wall',
        'limestone',
        [s * nx, 0, s * nz],
      );
    face(
      o,
      [
        [x - nx, ya + height, z - nz],
        [e - nx, yb + height, f - nz],
        [e + nx, yb + height, f + nz],
        [x + nx, ya + height, z + nz],
      ],
      'wall',
      'limestone',
      [0, 1, 0],
    );
  }
  // Street-level battlement runs are broad and sparse; far levels keep a continuous parapet.
  if (d >= 2 && merlons) {
    const count = Math.floor(len / (d === 2 ? 14 : 6));
    for (let j = 0; j < count; j++) {
      const t = (j + 0.5) / count,
        x = a[0] + dx * t,
        z = a[1] + dz * t,
        q = local(o, x, groundHeight(x, z, d) + height, z, Math.atan2(-dz, dx));
      rect(q, 0, 0, 0, d === 2 ? 3.4 : 2.7, 1.7, width);
    }
  }
}
function course(o, c, d) {
  const p = d === 0 ? simplify(c.points, 9) : c.points;
  for (let i = 1; i < p.length; i++)
    wall(o, p[i - 1], p[i], c.height, d === 0 ? 3.5 : (c.width ?? 2.4), d, c.merlons);
}
function tower(o, x, z, w, dep, h, d) {
  const y = groundHeight(x, z, d),
    q = local(o, x, y, z);
  rect(q, 0, 0, 0, w, h, dep);
  if (d === 0) return;
  // A terrace with thick solid parapets, not a reconstructed pitched tower roof.
  for (const s of [-1, 1]) {
    rect(q, 0, h, s * (dep / 2 - 0.9), w, 1.6, 1.8);
    rect(q, s * (w / 2 - 0.9), h, 0, 1.8, 1.6, dep - 3.6);
  }
  if (d >= 2)
    for (const s of [-1, 1]) {
      const f = local(q, 0, 0, s === 1 ? 0 : Math.PI);
      face(
        f,
        [
          [-0.8, 5, dep / 2 + 0.04],
          [0.8, 5, dep / 2 + 0.04],
          [0.8, 7.2, dep / 2 + 0.04],
          [-0.8, 7.2, dep / 2 + 0.04],
        ],
        'recess',
        'recess',
        [0, 0, 1],
      );
    }
}
function gate(o, g, d) {
  const [x, z] = g.center,
    q = local(o, x, groundHeight(x, z, d), z, g.angle),
    w = g.width,
    dep = g.depth,
    h = g.height,
    half = g.openingWidth / 2,
    spring = g.openingHeight - (g.arch ? half : 0),
    n = g.arch ? (d === 0 ? 3 : 6) : 1;
  for (const s of [-1, 1]) {
    const p = (u, v) => [u, v, (s * dep) / 2];
    for (const [a, b] of [
      [-w / 2, -half],
      [half, w / 2],
    ])
      face(q, [p(a, 0), p(b, 0), p(b, h), p(a, h)], 'wall', 'limestone', [0, 0, s]);
    for (let i = 0; i < n; i++) {
      const a = Math.PI - (i * Math.PI) / n,
        b = Math.PI - ((i + 1) * Math.PI) / n,
        ua = g.arch ? half * Math.cos(a) : -half,
        ub = g.arch ? half * Math.cos(b) : half,
        ha = g.arch ? spring + half * Math.sin(a) : spring,
        hb = g.arch ? spring + half * Math.sin(b) : spring;
      face(q, [p(ua, ha), p(ub, hb), p(ub, h), p(ua, h)], 'wall', 'limestone', [0, 0, s]);
      if (s === 1)
        face(
          q,
          [
            [ua, ha, -dep / 2],
            [ua, ha, dep / 2],
            [ub, hb, dep / 2],
            [ub, hb, -dep / 2],
          ],
          'wall',
          'limestone',
          [0, -1, 0],
        );
    }
    if (d >= 1 && g.blindArch) {
      const p = [
        [-2.6, 6.2, s * (dep / 2 + 0.03)],
        [2.6, 6.2, s * (dep / 2 + 0.03)],
      ];
      for (let i = 0; i <= 6; i++) {
        const a = (i * Math.PI) / 6;
        p.push([2.6 * Math.cos(a), 10.1 + 2.6 * Math.sin(a), s * (dep / 2 + 0.03)]);
      }
      face(q, p, 'infill', 'limestone', [0, 0, s]);
    }
  }
  for (const s of [-1, 1]) {
    face(
      q,
      [
        [s * half, 0, -dep / 2],
        [s * half, 0, dep / 2],
        [s * half, spring, dep / 2],
        [s * half, spring, -dep / 2],
      ],
      'wall',
      'limestone',
      [-s, 0, 0],
    );
    face(
      q,
      [
        [(s * w) / 2, 0, -dep / 2],
        [(s * w) / 2, 0, dep / 2],
        [(s * w) / 2, h, dep / 2],
        [(s * w) / 2, h, -dep / 2],
      ],
      'wall',
      'limestone',
      [s, 0, 0],
    );
  }
  face(
    q,
    [
      [-w / 2, h, -dep / 2],
      [w / 2, h, -dep / 2],
      [w / 2, h, dep / 2],
      [-w / 2, h, dep / 2],
    ],
    'wall',
    'limestone',
    [0, 1, 0],
  );
  if (d >= 1) for (const s of [-1, 1]) rect(q, s * (w / 2 - 1), h, 0, 2, 1.5, dep);
}
function cap(o, p, height, color, slot) {
  const ids = earcut(p.flat(), null, 2);
  for (let i = 0; i < ids.length; i += 3)
    face(
      o,
      ids.slice(i, i + 3).map((j) => [p[j][0], height(...p[j]), p[j][1]]),
      color,
      slot,
      [0, 1, 0],
    );
}
function ruins(o, d) {
  if (d === 0) return;
  for (const r of controls.ruins) {
    const p = survey.features.find((f) => f.record === r.record).points,
      loop = simplify(p, 1.2);
    if (d === 1 && r.record !== 38 && r.record !== 123) continue;
    for (let i = 1; i < loop.length; i++) wall(o, loop[i - 1], loop[i], r.height, 1.7, d);
  }
  const [[a, c], [b, e]] = controls.cistern.bounds,
    p = [
      [a, c],
      [b, c],
      [b, e],
      [a, e],
    ];
  cap(o, p, (x, z) => groundHeight(x, z, d) + 0.08, 'grass', 'foliage');
  for (let i = 0; i < 4; i++) {
    wall(o, p[i], p[(i + 1) % 4], controls.cistern.height, 1.8, d);
  }
}
function paths(o, d) {
  if (d < 2) return;
  const p = controls.paths;
  for (let i = 1; i < p.length; i++) {
    const a = p[i - 1],
      b = p[i],
      dx = b[0] - a[0],
      dz = b[1] - a[1],
      len = Math.hypot(dx, dz),
      nx = (dz / len) * 2.2,
      nz = (-dx / len) * 2.2,
      n = Math.ceil(len / 15);
    for (let j = 0; j < n; j++) {
      const ring = [
        [j / n, -1],
        [(j + 1) / n, -1],
        [(j + 1) / n, 1],
        [j / n, 1],
      ].map(([t, s]) => {
        const x = a[0] + t * dx + s * nx,
          z = a[1] + t * dz + s * nz;
        return [x, groundHeight(x, z, d) + 0.12, z];
      });
      face(o, ring, 'paving', 'aggregate', [0, 1, 0]);
    }
  }
}
function ridge(o, d) {
  // Host terrain supplies the ridge; do not load a second embedded mountain.
  for (const c of controls.wallCourses) course(o, c, d);
  for (const c of controls.westernDefenses) course(o, { ...c, merlons: true }, d);
  for (const g of controls.gates) gate(o, g, d);
  const k = controls.keep;
  tower(o, ...k.center, k.width, k.depth, k.height, d);
  for (let i = 1; i < controls.citadel.length; i++)
    wall(o, controls.citadel[i - 1], controls.citadel[i], 4, 2.4, d);
  if (d >= 1) {
    for (const [x, z] of controls.innerTowers) tower(o, x, z, 8, 8, 9, d);
    tower(o, -317, 68, 12, 12, 11, d);
    tower(o, -331, 122, 10, 10, 8, d);
  }
  ruins(o, d);
  paths(o, d);
}

const grade = read('pmtiles-fit.json'),
  MEANS = {
    limestone: [0.753900431769648, 0.7102426360381505, 0.6162437456625109],
    aggregate: [0.6893546167686782, 0.6750929657086415, 0.6305210116163465],
  };
function groundHeight(x, z) {
  const g = grade.grid,
    u = Math.max(0, Math.min(g.width - 1.000001, (x - g.origin[0]) / g.stepMeters)),
    v = Math.max(0, Math.min(g.height - 1.000001, (z - g.origin[1]) / g.stepMeters)),
    i = Math.floor(u),
    j = Math.floor(v),
    fx = u - i,
    fz = v - j,
    at = (a, b) => g.heights[(j + b) * g.width + i + a] - grade.datumMeters;
  return (
    (at(0, 0) * (1 - fx) + at(1, 0) * fx) * (1 - fz) +
    (at(0, 1) * (1 - fx) + at(1, 1) * fx) * fz +
    0.7
  );
}
function reviewed(o, level) {
  const far = level === 'skyline';
  ridge(
    Object.fromEntries(
      ['addQuad', 'addTriangle', 'addConvexPolygon'].map((k) => [
        k,
        (s, r, p, n, uv, c) => {
          if (far && n[1] < -0.98) return;
          const col = far ? c.map((v, i) => v * (MEANS[s]?.[i] ?? 1)) : c;
          for (let i = 1; i < p.length - 1; i++) {
            const t = [p[0], p[i], p[i + 1]];
            o.addTriangle(
              s,
              r,
              t,
              normalFor(...t),
              [
                [0, 0],
                [1, 0],
                [0, 1],
              ],
              col,
            );
          }
        },
      ]),
    ),
    { skyline: 0, district: 1, street: 2, closeup: 3 }[level],
  );
}
export const buildAcrocorinthReviewedMaster = (o) => reviewed(o, 'closeup');
export const buildAcrocorinthReviewedSkyline = (o) => reviewed(o, 'skyline');
export const buildAcrocorinthReviewedDistrict = (o) => reviewed(o, 'district');
export const buildAcrocorinthReviewedStreet = (o) => reviewed(o, 'street');
export const buildAcrocorinthReviewedCloseup = (o) => reviewed(o, 'closeup');
