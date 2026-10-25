/** Chinon's individually authored ridge fortress, mapped towers, lodging and two crossings. */
import './install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import earcut from 'earcut';
import { cross, normalFor } from './authored-structure-mesh.mjs';
import { openingBuilder, openingReveals, prepareOpening } from './authored-wall-openings.mjs';

const source = new URL(
  '../../../content/worldgen/source/places/u0/u02/chinon_castle/',
  import.meta.url,
);
const read = (name) => JSON.parse(readFileSync(new URL(name, source)));
const frame = read('map-frame.json'),
  fit = read('pmtiles-fit.json'),
  scope = read('review-scope.json'),
  means = read('surface-means.json');
const palette = {
  stone: '#d5cbb1',
  rubble: '#c8bda5',
  roof: '#646c78',
  wood: '#a7987c',
  metal: '#839194',
  lawn: '#8aa065',
  glass: '#4d6178',
};
const linear = (hex) =>
  hex
    .slice(1)
    .match(/../g)
    .map((s) => {
      const v = parseInt(s, 16) / 255;
      return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
const colors = Object.fromEntries(Object.entries(palette).map(([k, v]) => [k, linear(v)]));
const norm = (a) => {
  const m = Math.hypot(...a);
  return a.map((v) => v / m);
};
const at = (p, y) => [p[0], typeof y === 'function' ? y(p) : y, p[1]];
const rect = (x, z, w, d) => [
  [x - w / 2, z - d / 2],
  [x + w / 2, z - d / 2],
  [x + w / 2, z + d / 2],
  [x - w / 2, z + d / 2],
];
const circle = (x, z, r, n) =>
  Array.from({ length: n }, (_, i) => [
    x + Math.cos((i * Math.PI * 2) / n) * r,
    z + Math.sin((i * Math.PI * 2) / n) * r,
  ]);
const floor = (p) => frame.reconstruction.floorY + Math.min(0, p[0]) * 0.025;
const control = (id) => frame.reconstruction.buildings.find((f) => f.id === id).outline;
const center = (r) =>
  [0, 1].map((k) => (Math.min(...r.map((p) => p[k])) + Math.max(...r.map((p) => p[k]))) / 2);
export function chinonGround(x, z) {
  const c = Math.cos(frame.heading),
    s = Math.sin(frame.heading);
  [x, z] = [x * c + z * s, -x * s + z * c];
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw Error('Chinon footing outside retained DEM');
  const i = Math.floor(u),
    j = Math.floor(v),
    a = u - i,
    b = v - j,
    k = j * g.width + i,
    h = g.heights;
  return (
    (h[k] * (1 - a) + h[k + 1] * a) * (1 - b) +
    (h[k + g.width] * (1 - a) + h[k + g.width + 1] * a) * b -
    fit.datumMeters
  );
}

function faceWriter(out, detail) {
  return (s, poly, direction, tint = colors[s]) => {
    let p = poly.map((p) => p.map(Math.fround));
    if (direction && normalFor(...p.slice(0, 3)).reduce((v, n, i) => v + n * direction[i], 0) < 0)
      p = p.reverse();
    const color = detail === 0 ? tint.map((v, i) => v * means[s][i]) : tint;
    for (let i = 1; i < p.length - 1; i++) {
      const tri = [p[0], p[i], p[i + 1]],
        n = normalFor(...tri);
      if (
        Math.hypot(
          ...cross(
            tri[1].map((v, k) => v - tri[0][k]),
            tri[2].map((v, k) => v - tri[0][k]),
          ),
        ) < 1e-8
      )
        continue;
      out.addTriangle(
        s,
        'palette:#ffffff',
        tri,
        n,
        [
          [0, 0],
          [1, 0],
          [0, 1],
        ],
        color,
      );
    }
  };
}
function cap(face, r, y, s = 'stone') {
  const ids = earcut(r.flat(), null, 2);
  for (let i = 0; i < ids.length; i += 3)
    face(
      s,
      ids.slice(i, i + 3).map((k) => at(r[k], y)),
      [0, 1, 0],
    );
}
function solid(face, r, b, t, s = 'stone', topSurface = s) {
  const sign = Math.sign(
    r.reduce((n, a, i) => {
      const q = r[(i + 1) % r.length];
      return n + a[0] * q[1] - q[0] * a[1];
    }, 0),
  );
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      q = r[(i + 1) % r.length];
    face(
      s,
      [at(a, b), at(q, b), at(q, t), at(a, t)],
      [(q[1] - a[1]) * sign, 0, (a[0] - q[0]) * sign],
    );
  }
  cap(face, r, t, topSurface);
}
const box = (face, x, z, w, d, b, t, s = 'stone') => solid(face, rect(x, z, w, d), b, t, s);
function beam(face, a, b, w, d, s = 'stone') {
  const n = norm(b.map((v, i) => v - a[i])),
    u = norm(cross(n, Math.abs(n[1]) > 0.95 ? [1, 0, 0] : [0, 1, 0])),
    v = cross(n, u),
    r = (p) =>
      [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ].map(([x, z]) => p.map((q, i) => q + (u[i] * x * w + v[i] * z * d) / 2)),
    ra = r(a),
    rb = r(b);
  for (let i = 0; i < 4; i++)
    face(
      s,
      [ra[i], ra[(i + 1) % 4], rb[(i + 1) % 4], rb[i]],
      ra[i].map((q, j) => q - a[j]),
    );
  face(
    s,
    ra,
    n.map((v) => -v),
  );
  face(s, rb, n);
}
function wall(out, detail, a, b, thickness, bottom, top, s = 'stone', holes = []) {
  const u = norm(b.map((v, k) => v - a[k])),
    n = [-u[1], u[0]],
    r = [
      a.map((v, k) => v + (n[k] * thickness) / 2),
      b.map((v, k) => v + (n[k] * thickness) / 2),
      b.map((v, k) => v - (n[k] * thickness) / 2),
      a.map((v, k) => v - (n[k] * thickness) / 2),
    ];
  const prepared = holes.map((h) =>
    prepareOpening({ axis: u, depth: thickness + 1, shape: 'rectangle', ...h }, 0, detail),
  );
  const target = {
    addTriangle(s0, ref, p, n, uv, c) {
      out.addTriangle(s0 === 'rubble' ? s : s0, ref, p, n, uv, c);
    },
  };
  solid(faceWriter(openingBuilder(target, prepared), detail), r, bottom, top, s);
  openingReveals(
    target,
    r,
    (p) => (typeof bottom === 'function' ? bottom(p) : bottom),
    (p) => (typeof top === 'function' ? top(p) : top),
    prepared,
    colors[s],
  );
  if (detail >= 3)
    for (const h of prepared)
      for (let i = 1; i < h.ring.length; i++) {
        const a = h.ring[i],
          b = h.ring[(i + 1) % h.ring.length];
        for (const side of [-1, 1])
          beam(
            faceWriter(out, detail),
            h.point(...a, side * (thickness / 2 + 0.06)),
            h.point(...b, side * (thickness / 2 + 0.06)),
            0.28,
            0.3,
            s,
          );
      }
}

function roundTower(out, detail, id, height, open) {
  const original = control(id),
    [x, z] = center(original),
    radius = Math.max(...original.map((p) => Math.hypot(p[0] - x, p[1] - z))),
    n = [6, 8, 12, 24, 32][detail],
    r = circle(x, z, radius, n),
    inside = circle(x, z, radius - (open ? 1.05 : 1.15), n),
    face = faceWriter(out, detail),
    top = floor([x, z]) + height,
    base = (p) => Math.min(floor(p) - 0.2, chinonGround(...p) - 0.15);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n,
      a = r[i],
      b = r[j],
      m = a.map((v, k) => (v + b[k]) / 2),
      axis = norm(b.map((v, k) => v - a[k])),
      radial = norm(m.map((v, k) => v - [x, z][k])),
      holes = [];
    if (detail >= 2 && i % Math.round(n / 4) === 0)
      for (const y of detail === 2 ? [top - 5] : [top - 4, top - 9])
        holes.push(
          prepareOpening(
            {
              center: m,
              axis,
              depth: radius * 2,
              width: 0.8,
              height: 1.65,
              spring: 1.1,
              bottom: y,
              shape: 'round',
            },
            0,
            detail,
          ),
        );
    const target = {
        addTriangle(s, ref, p, n, uv, c) {
          out.addTriangle(s === 'rubble' ? 'stone' : s, ref, p, n, uv, c);
        },
      },
      cut = faceWriter(openingBuilder(target, holes), detail),
      t = (p) =>
        top + (open && detail >= 2 ? 0.3 * Math.sin(Math.atan2(p[1] - z, p[0] - x) * 5) : 0);
    cut('stone', [at(a, base), at(b, base), at(b, t), at(a, t)], [radial[0], 0, radial[1]]);
    if (open)
      cut(
        'stone',
        [at(inside[i], floor), at(inside[j], floor), at(inside[j], t), at(inside[i], t)],
        [-radial[0], 0, -radial[1]],
      );
    cut('stone', [at(a, t), at(b, t), at(inside[j], t), at(inside[i], t)], [0, 1, 0]);
    if (holes.length)
      openingReveals(target, [a, b, inside[j], inside[i]], base, t, holes, colors.stone);
    if (detail >= 3 && i % 3 === 0) box(face, m[0], m[1], 0.65, 0.65, top - 0.1, top + 0.5);
  }
  if (!open) cap(face, inside, top - 0.7, 'stone');
  if (detail >= 1 && !open)
    for (let i = 0; i < n; i++)
      wall(out, detail, inside[i], inside[(i + 1) % n], 0.35, top - 0.7, top + 0.6);
  if (detail >= 2)
    for (const y of [floor([x, z]) + 1, top - 1.5])
      for (let i = 0; i < n; i++) {
        const a = r[i],
          b = r[(i + 1) % n];
        beam(face, at(a, y), at(b, y), 0.26, 0.3);
      }
}
function polygonTower(out, detail) {
  const original = control(35184434569223),
    p =
      detail <= 1
        ? [
            original[2],
            original[4],
            original[5],
            original[7],
            original[8],
            original[11],
            original.at(-1),
          ]
        : original,
    [x, z] = center(original),
    h = floor([x, z]) + 18,
    face = faceWriter(out, detail);
  for (let i = 0; i < p.length; i++) {
    const a = p[i],
      b = p[(i + 1) % p.length],
      m = a.map((v, k) => (v + b[k]) / 2),
      len = Math.hypot(...b.map((v, k) => v - a[k])),
      holes = [];
    if (detail >= 2 && len > 3)
      for (const y of [h - 4.5, h - 10])
        holes.push({ center: m, width: 0.75, height: 1.9, bottom: y, shape: 'rectangle' });
    wall(
      out,
      detail,
      a,
      b,
      1.2,
      (q) => Math.min(floor(q) - 0.2, chinonGround(...q) - 0.15),
      h,
      'stone',
      holes,
    );
    if (detail >= 2) beam(face, at(a, h - 1), at(b, h - 1), 0.6, 0.7);
  }
  cap(face, p, h - 0.3, 'rubble');
  if (detail >= 1) {
    const inner = p.map((q) => [x + (q[0] - x) * 0.9, z + (q[1] - z) * 0.9]);
    for (let i = 0; i < p.length; i++)
      wall(out, detail, inner[i], inner[(i + 1) % p.length], 0.45, h - 0.3, h + 0.8);
  }
}

function grounds(out, detail) {
  const face = faceWriter(out, detail),
    r = frame.geometry.outline;
  const moat = rect(-60.5, 0, 15, 82),
    points = [...r, ...moat],
    indices = earcut(points.flat(), [r.length], 2);
  for (let i = 0; i < indices.length; i += 3)
    face(
      'lawn',
      indices.slice(i, i + 3).map((k) => at(points[k], (p) => floor(p) - 0.1)),
      [0, 1, 0],
    );
  cap(face, moat, (p) => floor(p) - 4.5, 'rubble');
  for (const x of [-68, -53])
    wall(out, detail, [x, -41], [x, 41], 0.8, (p) => floor(p) - 4.5, floor, 'rubble');
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      n = norm(b.map((v, k) => v - a[k])),
      outer = [n[1], -n[0]];
    const base = (p) => Math.min(chinonGround(...p) - 0.2, floor(p) - 0.4);
    const gateOpening =
      a[0] > 120 && b[0] > 120
        ? [
            {
              center: [128.8, 2.5],
              width: 3.8,
              height: 3.4,
              spring: 2.5,
              bottom: floor([128.8, 2.5]) + 0.05,
              shape: 'round',
            },
          ]
        : [];
    wall(
      out,
      detail,
      a,
      b,
      detail === 0 ? 1.3 : 1.5,
      base,
      (p) => floor(p) + (i < 6 ? 2.4 : i > 11 ? 3.5 : 2.5),
      'rubble',
      gateOpening,
    );
    if (detail >= 2 && i % 3 === 0) {
      const length = Math.hypot(...b.map((v, k) => v - a[k]));
      for (let j = 1; j < Math.ceil(length / 15); j++) {
        const q = j / Math.ceil(length / 15),
          p = a.map((v, k) => v + (b[k] - v) * q + outer[k] * 1.2);
        box(face, p[0], p[1], 1.6, 1.8, base(p), floor(p) + 2.2, 'rubble');
      }
    }
  }
  if (detail >= 1) {
    const edge = [
      [-68, -46],
      [-68, -41],
    ];
    for (let i = 0; i < edge.length - 1; i++)
      wall(out, detail, edge[i], edge[i + 1], 1.3, floor, (p) => floor(p) + 4, 'rubble');
    for (const [x, z, h] of [
      [-126, 20, 4],
      [-121, -6, 5],
      [-110, -20, 4.5],
      [-91, -32, 4.2],
    ]) {
      const r = circle(x, z, 3.1, detail === 1 ? 6 : 12);
      solid(
        face,
        r,
        (p) => Math.min(floor(p), chinonGround(...p) - 0.1),
        (p) => floor(p) + h,
        'rubble',
      );
    }
  }
  if (detail >= 2) {
    const remnants = [
      [
        [-64, -42],
        [-48, -42],
        [-48, -34],
        [-64, -34],
      ],
      [
        [48, -42],
        [62, -42],
        [62, -36],
        [48, -36],
      ],
      [
        [34, 15],
        [52, 15],
        [52, 24],
        [34, 24],
      ],
    ];
    for (const r of remnants)
      for (let i = 0; i < r.length; i++)
        wall(out, detail, r[i], r[(i + 1) % r.length], 0.8, floor, (p) => floor(p) + 1.3, 'rubble');
  }
}

function roof(face, r, eave, ridge, s = 'roof') {
  const [x, z] = center(r),
    xs = r.map((p) => p[0]),
    zs = r.map((p) => p[1]),
    lo = Math.min(...xs),
    hi = Math.max(...xs),
    north = Math.min(...zs),
    south = Math.max(...zs);
  face(
    s,
    [
      [lo, eave, north],
      [hi, eave, north],
      [hi, ridge, z],
      [lo, ridge, z],
    ],
    [0, 1, -1],
  );
  face(
    s,
    [
      [lo, ridge, z],
      [hi, ridge, z],
      [hi, eave, south],
      [lo, eave, south],
    ],
    [0, 1, 1],
  );
  for (const end of [lo, hi])
    face(
      'stone',
      [
        [end, eave, north],
        [end, eave, south],
        [end, ridge, z],
      ],
      [end < x ? -1 : 1, 0, 0],
    );
}
function lodgings(out, detail) {
  const face = faceWriter(out, detail),
    r = control(35184762186758),
    eave = 19.5,
    ridge = 28;
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      len = Math.hypot(...b.map((v, k) => v - a[k])),
      axis = norm(b.map((v, k) => v - a[k])),
      holes = [];
    if (detail >= 2 && len > 6) {
      const count = Math.floor(len / 5.8);
      for (let j = 1; j <= count; j++)
        for (const y of [10, 15]) {
          const p = a.map((v, k) => v + ((b[k] - v) * j) / (count + 1));
          holes.push({ center: p, width: 1.2, height: 2, bottom: y, shape: 'rectangle' });
          const normal = [-axis[1], axis[0]],
            pane = [
              at(
                p.map((v, k) => v - axis[k] * 0.54),
                y + 0.1,
              ),
              at(
                p.map((v, k) => v + axis[k] * 0.54),
                y + 0.1,
              ),
              at(
                p.map((v, k) => v + axis[k] * 0.54),
                y + 1.9,
              ),
              at(
                p.map((v, k) => v - axis[k] * 0.54),
                y + 1.9,
              ),
            ];
          face('glass', pane, [normal[0], 0, normal[1]]);
          face('glass', [...pane].reverse(), [-normal[0], 0, -normal[1]]);
          if (detail >= 3) {
            beam(face, [p[0], y + 0.05, p[1]], [p[0], y + 1.95, p[1]], 0.22, 0.25);
            beam(
              face,
              [p[0] - axis[0] * 0.6, y + 1, p[1] - axis[1] * 0.6],
              [p[0] + axis[0] * 0.6, y + 1, p[1] + axis[1] * 0.6],
              0.22,
              0.25,
            );
          }
        }
    }
    wall(
      out,
      detail,
      a,
      b,
      0.9,
      (p) => Math.min(floor(p) - 0.2, chinonGround(...p) - 0.1),
      eave,
      'stone',
      holes,
    );
  }
  roof(face, rect(-37, 34.4, 20.5, 12), eave, ridge);
  roof(face, rect(-15.9, 33.1, 24.5, 11.9), eave + 1, ridge + 1);
  if (detail >= 1) {
    for (const [x, z, w, d, h] of [
      [-25.4, 27.3, 4.2, 4.4, 25],
      [-20.2, 41.2, 3.2, 4.3, 23.5],
      [-5.7, 27.2, 2.7, 3.1, 23],
    ]) {
      const r = rect(x, z, w, d);
      solid(face, r, floor, h);
      const top = [x, h + 4, z];
      for (let i = 0; i < 4; i++)
        face('roof', [at(r[i], h), at(r[(i + 1) % 4], h), top], [r[i][0] - x, 1, r[i][1] - z]);
    }
  }
  if (detail >= 2) {
    for (const x of [-44, -35, -13, -7]) box(face, x, 34, 1.1, 1.2, ridge - 2, ridge + 1.8);
    for (const x of [-41, -30, -13]) {
      const r = rect(x, 29.1, 2.5, 2.6);
      solid(face, r, 23, 25.4);
      roof(face, r, 25.4, 27.2);
    }
  }
}

function gate(out, detail) {
  const r = control(35184434567262),
    [x, z] = center(r),
    face = faceWriter(out, detail),
    top = 34,
    bottom = floor([x, z]) - 0.15,
    hole = prepareOpening(
      {
        center: [118, 2.5],
        axis: [0, 1],
        depth: 16,
        width: 2.8,
        height: 4,
        spring: 2.7,
        bottom: floor([x, z]) + 0.05,
        shape: 'pointed',
      },
      0,
      detail,
    );
  const holes = [hole];
  if (detail >= 2)
    for (let i = 0; i < r.length; i++) {
      const a = r[i],
        b = r[(i + 1) % r.length];
      if (Math.hypot(...b.map((v, k) => v - a[k])) < 7) continue;
      holes.push(
        prepareOpening(
          {
            center: a.map((v, k) => (v + b[k]) / 2),
            axis: norm(b.map((v, k) => v - a[k])),
            depth: 20,
            width: 0.8,
            height: 2.4,
            bottom: top - 7,
            shape: 'pointed',
            spring: 1.7,
          },
          0,
          detail,
        ),
      );
    }
  const cut = faceWriter(openingBuilder(out, holes), detail);
  solid(cut, r, bottom, top);
  openingReveals(
    out,
    r,
    () => bottom,
    () => top,
    holes,
    colors.stone,
  );
  cap(face, r, top, 'rubble');
  for (let i = 0; i < r.length; i++)
    wall(out, detail, r[i], r[(i + 1) % r.length], 0.55, top, top + 1.2);
  if (detail >= 1)
    for (const p of [r[0], r[3], r[6]]) box(face, p[0], p[1], 0.9, 0.9, top, top + 2.1);
  if (detail >= 1) {
    const winding = Math.sign(
      r.reduce((v, a, i) => {
        const b = r[(i + 1) % r.length];
        return v + a[0] * b[1] - b[0] * a[1];
      }, 0),
    );
    for (let i = 0; i < r.length; i++) {
      const a = r[i],
        b = r[(i + 1) % r.length],
        length = Math.hypot(...b.map((v, k) => v - a[k]));
      if (length < 7) continue;
      const u = norm(b.map((v, k) => v - a[k])),
        n = [u[1] * winding, -u[0] * winding],
        mid = a.map((v, k) => (v + b[k]) / 2 + n[k] * 0.13),
        y = 31.2;
      const point = (horizontal, vertical) => [
        mid[0] + u[0] * horizontal,
        y + vertical,
        mid[1] + u[1] * horizontal,
      ];
      const count = detail === 1 ? 8 : 16;
      face(
        'lawn',
        Array.from({ length: count }, (_, j) =>
          point(
            Math.cos((j * Math.PI * 2) / count) * 1.15,
            Math.sin((j * Math.PI * 2) / count) * 1.15,
          ),
        ),
        [n[0], 0, n[1]],
        linear('#ded8bc'),
      );
      if (detail >= 2) {
        const hand = (p) => [p[0] + n[0] * 0.04, p[1], p[2] + n[1] * 0.04];
        beam(face, hand(point(0, 0)), hand(point(0, 0.75)), 0.17, 0.17, 'metal');
        beam(face, hand(point(0, 0)), hand(point(0.65, -0.2)), 0.17, 0.17, 'metal');
      }
    }
  }
}

function crossings(out, detail) {
  const face = faceWriter(out, detail);
  for (const bridge of frame.reconstruction.bridges) {
    const [a, b] = bridge.centerline,
      western = bridge.id === 35184503203240,
      y = (p) => {
        if (western) return floor(p) + 0.1;
        const q = (p[0] - a[0]) / (b[0] - a[0]);
        return floor(a) + 0.1 + (chinonGround(...b) + 0.4 - floor(a) - 0.1) * q;
      };
    if (western) {
      beam(face, at(a, y(a) - 0.2), at(b, y(b) - 0.2), 3.3, 0.45, detail === 0 ? 'stone' : 'wood');
      if (detail >= 1)
        for (const side of [-1, 1])
          beam(
            face,
            [a[0], y(a) + 1.1, a[1] + side * 1.55],
            [b[0], y(b) + 1.1, b[1] + side * 1.55],
            0.25,
            0.25,
            'metal',
          );
      if (detail >= 2)
        for (let j = 0; j <= 5; j++) {
          const p = a.map((v, k) => v + ((b[k] - v) * j) / 5);
          for (const side of [-1, 1])
            beam(
              face,
              [p[0], y(p), p[1] + side * 1.55],
              [p[0], y(p) + 1.2, p[1] + side * 1.55],
              0.2,
              0.2,
              'metal',
            );
        }
    } else {
      const u = norm(b.map((v, k) => v - a[k])),
        n = [-u[1], u[0]],
        mid = a.map((v, k) => (v + b[k]) / 2),
        holes =
          detail >= 2
            ? [
                {
                  center: mid,
                  width: Math.hypot(...b.map((v, k) => v - a[k])) - 12,
                  height: 4,
                  spring: 2.8,
                  bottom: -8,
                  shape: 'round',
                },
              ]
            : [];
      wall(
        out,
        detail,
        a,
        b,
        3.3,
        (p) => Math.min(chinonGround(...p) - 0.15, -8.2),
        (p) => y(p) - 0.2,
        'stone',
        holes,
      );
      for (const side of [-1, 1])
        wall(
          out,
          detail,
          a.map((v, k) => v + n[k] * 1.4 * side),
          b.map((v, k) => v + n[k] * 1.4 * side),
          0.4,
          y,
          (p) => y(p) + 1.1,
        );
      beam(face, [118, floor([118, 2.5]) + 0.1, 2.5], at(a, y(a)), 3.2, 0.4);
    }
  }
}
function build(out, detail) {
  grounds(out, detail);
  roundTower(out, detail, 35184762193010, 12.8, true);
  roundTower(out, detail, 35184431290304, 16.5, false);
  polygonTower(out, detail);
  lodgings(out, detail);
  gate(out, detail);
  crossings(out, detail);
  if (detail >= 1) {
    const r = control(35185230526304);
    const pavilionHeight = floor(center(r)) + 6;
    solid(faceWriter(out, detail), r, floor, pavilionHeight);
    roof(faceWriter(out, detail), r, pavilionHeight, pavilionHeight + 3);
    for (const id of [35184434558787, 35184434567708, 35184559114970]) {
      const r = control(id);
      const eave = floor(center(r)) + 5;
      solid(faceWriter(out, detail), r, floor, eave, 'rubble');
      roof(faceWriter(out, detail), r, eave, eave + 2.5);
    }
  }
}
export const buildChinonSkyline = (out) => build(out, 0);
export const buildChinonDistrict = (out) => build(out, 1);
export const buildChinonStreet = (out) => build(out, 2);
export const buildChinonCloseup = (out) => build(out, 3);
export const chinonStudy = {
  id: 'chinon_castle',
  key: 'chinon_castle',
  title: 'Chinon Castle',
  category: 'castle',
  wikidataId: 'Q912447',
  generationCommand: 'node packages/worldgen/scripts/generate-additional-landmarks.mjs',
  mapFrame: 'map-frame.json',
  fidelityTarget: 'medium-fi',
  build: (out) => build(out, 4),
  surfaceOverrides: scope.surfaceOverrides,
  brief:
    'Individual Chinon ridge fortress: irregular retaining enclosure and open grounds, roofless western round tower, flat-sided south tower, broad interior round keep, low western bastions, surviving royal lodging with steep slate roofs and stair projections, separate narrow clock gate and both mapped entrance crossings. Exterior openings, ruined partitions and clock faces appear in the appropriate browser levels.',
  sourceFacts: {
    horizontalBasis:
      'Exact-QID way131114399 plus current standard viewer PMTiles components and both bridge LineStrings.',
    architecturalHeights:
      'Exterior-picture estimates against mapped plan; terrace and coarse DEM contact are approximate.',
  },
  reconstruction: frame.reconstruction,
  scaleBasis:
    'Mapped main enclosure258x101m and independently mapped tower, royal lodging and clock gate footprints.',
  refs: read('reference-metadata.json').currentRoundInspection.pictures,
  nativeAxes: frame.nativeAxes,
  sourceDocuments: scope.sourceDocuments,
  sourceLicense:
    'Original geometry under repository license; map controls © OpenStreetMap contributors, ODbL-1.0. Linked photographs are not redistributed.',
  dataAttribution: '© OpenStreetMap contributors; Protomaps; Mapzen/USGS terrain tiles.',
  sourceNotice:
    'Five existing256-square graphs provide limestone, rubble, slate, wood and painted metal. Lawn and modest blue-grey glazing are plain linear vertex colors. Seven near draws keep the five reusable graphs and two plain surfaces distinct; no unique bitmap or embedded picture.',
  importReason:
    'Retain distinct round and flat-sided western towers, slate lodging ridge, eastern clock gate, open grounds and two mapped crossings as four independently authored browser levels.',
  appearance: {
    standard: 'docs-src/guide/medium-fi.md',
    paletteSrgb: palette,
    colorEncoding: 'sRGB converted to linear COLOR_0',
    identityFeatures: [
      'Unequal round and flat-sided western towers along an irregular ridge enclosure',
      'Steep slate royal lodging roofs and projecting stairs above open grounds',
      'Separate narrow eastern clock gate and mapped entry crossings',
    ],
  },
  previewGround: false,
  previewTerrain: scope.previewTerrain,
  mediumFiContext: scope.mediumFiContext,
  geographic: () => scope.geographic,
  geographicNote: scope.geographicNote,
  limitations: [
    'Heights, wall thicknesses, curtain tops, room remnants and terrace are picture-led approximations; buried archaeology and complete interiors are not reconstructed.',
    'The two reference photographs show differing lodging roof states. The roofed photograph guides the current slate treatment; no historical dating is inferred.',
    'Main enclosure and clock gate are modeled. Separate eastern visitor building and archaeological foundations beyond the entrance are excluded from this exterior scope.',
    'The coarse standard viewer DEM blends the ridge. Retaining skirt, authored plateau, bridge profiles and entrance joins are approximate; no runtime terrain carving, surveyed ground contact or certified walkable collision is claimed.',
    'Physical laptop and phone frame-rate measurements remain pending.',
  ],
  camera: scope.camera,
  qaCameras: [
    {
      name: 'western-towers-and-open-court',
      position: [-174, 62, 118],
      lookAt: [-87, 11, 20],
      fov: 44,
    },
    {
      name: 'royal-lodging-and-slate-ridges',
      position: [-70, 51, 98],
      lookAt: [-25, 13, 34],
      fov: 44,
    },
    {
      name: 'clock-gate-and-east-crossing',
      position: [184, 58, 77],
      lookAt: [130, 13, 2],
      fov: 44,
    },
    {
      name: 'north-curtain-and-round-keep',
      position: [-96, 74, -127],
      lookAt: [-50, 9, 0],
      fov: 43,
    },
    { name: 'hollow-west-tower', position: [-145, 33, 54], lookAt: [-118.5, 8, 35.5], fov: 44 },
    { name: 'mapped-plan-and-two-crossings', position: [5, 280, 0], lookAt: [5, 0, 0], fov: 52 },
  ],
};
