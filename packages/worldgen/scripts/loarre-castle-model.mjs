/** Loarre's individual chapel, unequal towers, roofless compound and downhill curtain. */
import './install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import earcut from 'earcut';
import { cross, normalFor } from './authored-structure-mesh.mjs';
import { openingBuilder, openingReveals, prepareOpening } from './authored-wall-openings.mjs';

const source = new URL(
  '../../../content/worldgen/source/places/ez/ezx/n0318_loarre_castle/',
  import.meta.url,
);
const read = (name) => JSON.parse(readFileSync(new URL(name, source)));
const frame = read('map-frame.json'),
  fit = read('pmtiles-fit.json'),
  scope = read('review-scope.json'),
  means = read('surface-means.json');
const palette = {
  stone: '#cbb68c',
  rock: '#c1b197',
  roof: '#9e9378',
  paving: '#c0b49a',
  metal: '#89948c',
};
const colors = Object.fromEntries(
  Object.entries(palette).map(([k, h]) => [
    k,
    h
      .slice(1)
      .match(/../g)
      .map((s) => {
        const v = parseInt(s, 16) / 255;
        return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
      }),
  ]),
);
const norm = (v) => {
  const n = Math.hypot(...v);
  return v.map((x) => x / n);
};
const at = (p, y) => [p[0], typeof y === 'function' ? y(p) : y, p[1]];
const center = (r) =>
  [0, 1].map((k) => (Math.min(...r.map((p) => p[k])) + Math.max(...r.map((p) => p[k]))) / 2);
const control = (id) => frame.reconstruction.buildings.find((f) => f.id === id).outline;
const raw = ([x, z]) => {
  x += 55;
  z -= 8;
  const c = Math.cos(frame.heading),
    s = Math.sin(frame.heading);
  return [x * c - z * s, x * s + z * c];
};
const floor = frame.reconstruction.floorY;
export function loarreGround(x, z) {
  const c = Math.cos(frame.heading),
    s = Math.sin(frame.heading);
  [x, z] = [x * c + z * s, -x * s + z * c];
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw Error('Loarre footing outside retained DEM');
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
function writer(out, detail) {
  return (s, polygon, direction) => {
    let p = polygon.map((p) => p.map(Math.fround));
    if (direction && normalFor(...p.slice(0, 3)).reduce((v, n, i) => v + n * direction[i], 0) < 0)
      p = p.reverse();
    const color = detail === 0 ? colors[s].map((v, i) => v * means[s][i]) : colors[s];
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
function solid(face, r, b, t, s = 'stone') {
  const sign = Math.sign(
    r.reduce((sum, a, i) => {
      const q = r[(i + 1) % r.length];
      return sum + a[0] * q[1] - q[0] * a[1];
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
  cap(face, r, t, s);
}
function wall(out, detail, a, b, w, bottom, top, s = 'stone', holes = []) {
  const u = norm(b.map((v, k) => v - a[k])),
    n = [-u[1], u[0]],
    r = [
      a.map((v, k) => v + (n[k] * w) / 2),
      b.map((v, k) => v + (n[k] * w) / 2),
      b.map((v, k) => v - (n[k] * w) / 2),
      a.map((v, k) => v - (n[k] * w) / 2),
    ];
  const hs = holes.map((h) =>
    prepareOpening({ axis: u, depth: w + 1, shape: 'rectangle', ...h }, 0, detail),
  );
  const target = {
    addTriangle(slot, ref, p, n, uv, c) {
      out.addTriangle(slot === 'rubble' ? s : slot, ref, p, n, uv, c);
    },
  };
  solid(writer(openingBuilder(target, hs), detail), r, bottom, top, s);
  openingReveals(
    target,
    r,
    (p) => (typeof bottom === 'function' ? bottom(p) : bottom),
    (p) => (typeof top === 'function' ? top(p) : top),
    hs,
    colors[s],
  );
}
function parapets(out, detail, r, top, w = 0.7) {
  if (detail === 0) return;
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length];
    wall(out, detail, a, b, w, top, top + 0.8);
    if (detail >= 2) {
      const length = Math.hypot(...b.map((v, k) => v - a[k])),
        count = Math.max(2, Math.round(length / 1.5));
      for (let j = 0; j < count; j++) {
        const p = a.map((v, k) => v + ((b[k] - v) * j) / count),
          q = a.map((v, k) => v + ((b[k] - v) * (j + 0.48)) / count);
        wall(out, detail, p, q, w, top + 0.8, top + 1.6);
      }
    }
  }
}
function tower(out, detail, id, height, { hollow = false, base = floor } = {}) {
  const r = control(id),
    face = writer(out, detail),
    top = base + height;
  if (detail === 0) {
    solid(face, r, (p) => Math.min(base, loarreGround(...p) - 0.15), top);
    return;
  }
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      m = a.map((v, k) => (v + b[k]) / 2),
      holes = [];
    if (detail >= 2 && Math.hypot(...b.map((v, k) => v - a[k])) > 3) {
      for (const y of [base + height * 0.45, base + height * 0.73])
        holes.push({ center: m, width: 0.55, height: 1.2, bottom: y, shape: 'rectangle' });
    }
    wall(
      out,
      detail,
      a,
      b,
      hollow ? 1 : 1.3,
      (p) => Math.min(base, loarreGround(...p) - 0.15),
      top,
      'stone',
      holes,
    );
  }
  if (!hollow) cap(face, r, top - 0.1);
  else cap(face, r, base + 0.12, 'paving');
  parapets(out, detail, r, top);
}
function crag(out, detail) {
  const face = writer(out, detail),
    r = frame.reconstruction.upperCurtain;
  cap(face, r, floor - 0.1, 'paving');
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      c0 = center(r),
      outer = (p) => p.map((v, k) => c0[k] + (v - c0[k]) * 1.09),
      oa = outer(a),
      ob = outer(b);
    face(
      'rock',
      [
        at(a, floor - 0.1),
        at(b, floor - 0.1),
        at(ob, (p) => loarreGround(...p) + 0.3),
        at(oa, (p) => loarreGround(...p) + 0.3),
      ],
      [a[0] - c0[0], 0, a[1] - c0[1]],
    );
  }
  const groups =
    detail === 0
      ? [
          [-83, -17, 9],
          [-73, -27, 11],
        ]
      : [
          [-87, -16, 10],
          [-77, -23, 12],
          [-63, -28, 9],
          [-87, 2, 6],
        ];
  for (const [x, z, height] of groups) {
    const p = raw([x, z]),
      n = detail === 0 ? 4 : detail >= 3 ? 10 : 6,
      r = Array.from({ length: n }, (_, i) => {
        const a = (i * 2 * Math.PI) / n;
        return [
          p[0] + Math.cos(a) * (5.7 + (i % 2) * 1.1),
          p[1] + Math.sin(a) * (4.2 + (i % 3) * 0.6),
        ];
      }),
      topRing = r.map((q, i) => [
        p[0] + (q[0] - p[0]) * 0.48 + 0.7,
        Math.max(floor, loarreGround(...p)) + height - (i % 3) * 1.4,
        p[1] + (q[1] - p[1]) * 0.64 - 0.6,
      ]);
    for (let i = 0; i < n; i++) {
      const a = r[i],
        b = r[(i + 1) % n];
      face(
        'rock',
        [
          at(a, (q) => loarreGround(...q) - 0.1),
          at(b, (q) => loarreGround(...q) - 0.1),
          topRing[(i + 1) % n],
          topRing[i],
        ],
        [a[0] - p[0], 0, a[1] - p[1]],
      );
    }
    const indices = earcut(topRing.map((p) => [p[0], p[2]]).flat(), null, 2);
    for (let i = 0; i < indices.length; i += 3)
      face(
        'rock',
        indices.slice(i, i + 3).map((k) => topRing[k]),
        [0, 1, 0],
      );
  }
}
function upper(out, detail) {
  const r = frame.reconstruction.upperCurtain;
  for (let i = 0; i < r.length; i++) {
    // The chapel's mapped outside walls complete the southeast perimeter.
    if (i >= 6 && i <= 9) continue;
    const a = r[i],
      b = r[(i + 1) % r.length],
      height = i < 5 ? 10 : i > 9 ? 8.5 : 11,
      m = a.map((v, k) => (v + b[k]) / 2);
    wall(
      out,
      detail,
      a,
      b,
      1.4,
      (p) => Math.min(floor, loarreGround(...p) - 0.2),
      floor + height,
      'stone',
      detail >= 2 && i % 2 === 0
        ? [{ center: m, width: 0.65, height: 1.4, bottom: floor + height - 3.7 }]
        : [],
    );
  }
  // Northwest roofless range and its broken triangular end, visually distinct from the keep.
  const r0 = control(35185729008358),
    top = floor + 11;
  for (let i = 0; detail >= 1 && i < r0.length; i++)
    wall(out, detail, r0[i], r0[(i + 1) % r0.length], 0.8, floor, top);
  if (detail >= 1) {
    const a = r0[0],
      b = r0[1],
      m = a.map((v, k) => (v + b[k]) / 2);
    writer(out, detail)(
      'stone',
      [at(a, top), at(b, top), at(m, top + 3)],
      [b[1] - a[1], 0, a[0] - b[0]],
    );
  }
  // Northern angular ranges connect the square keep to the chapel side.
  if (detail >= 1) {
    const range = control(35185729008354);
    for (let i = 4; i < range.length; i++)
      wall(
        out,
        detail,
        range[i],
        range[(i + 1) % range.length],
        0.75,
        floor,
        floor + (i % 3 === 0 ? 7 : 5),
      );
    const low = [
      [-75, -3],
      [-65, -3],
      [-65, 8],
      [-75, 8],
    ].map(raw);
    for (let i = 0; i < 4; i++)
      wall(out, detail, low[i], low[(i + 1) % 4], 0.7, floor, floor + 1.2);
    const partitions = [
      [
        [-81, 14],
        [-66, 11],
      ],
      [
        [-72, 12],
        [-73, 20],
      ],
      [
        [-60, 7],
        [-49, 7],
      ],
      [
        [-61, -7],
        [-46, -8],
      ],
    ];
    for (const [a, b] of partitions) wall(out, detail, raw(a), raw(b), 0.8, floor, floor + 2.3);
  }
}
function chapel(out, detail) {
  const r = control(35185729008345),
    face = writer(out, detail),
    top = floor + 12.5;
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      m = a.map((v, k) => (v + b[k]) / 2),
      len = Math.hypot(...b.map((v, k) => v - a[k])),
      holes = [];
    if (detail >= 2) {
      if (i === 0 || i === 8)
        for (const t of [0.25, 0.55, 0.82])
          holes.push({
            center: a.map((v, k) => v + (b[k] - v) * t),
            width: 0.8,
            height: 2.2,
            spring: 1.6,
            bottom: floor + 7.3,
            shape: 'round',
          });
      else if (i > 1 && i < 8 && len > 2.2)
        holes.push({
          center: m,
          width: 0.6,
          height: 1.9,
          spring: 1.4,
          bottom: floor + 7.6,
          shape: 'round',
        });
    }
    wall(
      out,
      detail,
      a,
      b,
      1.3,
      (p) => Math.min(floor, loarreGround(...p) - 0.1),
      top,
      'stone',
      holes,
    );
  }
  // Low western entrance/stair range has a genuine arch through the southern wall.
  const entrance = control(35185729008346),
    eave = floor + 6.2;
  for (let i = 0; i < entrance.length; i++) {
    const a = entrance[i],
      b = entrance[(i + 1) % entrance.length],
      m = a.map((v, k) => (v + b[k]) / 2);
    wall(
      out,
      detail,
      a,
      b,
      1.2,
      (p) => Math.min(floor, loarreGround(...p) - 0.1),
      eave,
      'stone',
      i === 3
        ? [{ center: m, width: 2.4, height: 3.3, spring: 2.1, bottom: floor + 0.1, shape: 'round' }]
        : [],
    );
  }
  cap(face, entrance, eave, 'roof');
  // The eastern rounded apse has a flat circular terrace; the nave carries a tall polygonal roof.
  const nave = [
      [-49, 11.4],
      [-35.7, 10.7],
      [-35.7, 22.6],
      [-49.1, 23.2],
    ].map(raw),
    mid = center(nave),
    small = nave.map((p) => p.map((v, k) => mid[k] + (v - mid[k]) * 0.06)),
    ridge = floor + 19;
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    face(
      'roof',
      [at(nave[i], top), at(nave[j], top), at(small[j], ridge), at(small[i], ridge)],
      [0, 1, 0],
    );
  }
  cap(face, small, ridge, 'roof');
  const apse = r.slice(1, 9);
  cap(face, apse, top, 'paving');
  if (detail >= 1)
    for (let i = 0; i < apse.length - 1; i++)
      wall(out, detail, apse[i], apse[i + 1], 0.5, top, top + 0.65);
  const doorway = entrance[3].map((v, k) => (v + entrance[4][k]) / 2),
    stairEnd = doorway.map((v, k) => v + [0, 10][k]),
    stairBottom = loarreGround(...stairEnd) + 0.2;
  const stairHeight = (p) => floor + 0.1 + ((stairBottom - floor - 0.1) * (p[1] - doorway[1])) / 10;
  if (detail >= 2) {
    const p = doorway,
      a = stairEnd,
      n = 20;
    for (let i = 0; i < n; i++) {
      const t = i / n,
        b = (i + 1) / n;
      wall(
        out,
        detail,
        p.map((v, k) => v + (a[k] - v) * t),
        p.map((v, k) => v + (a[k] - v) * b),
        3.7,
        stairBottom - 0.1,
        floor + 0.1 + (stairBottom - floor - 0.1) * t,
        'paving',
      );
    }
  }
  if (detail >= 3) {
    for (const i of [2, 4, 6, 8]) {
      const a = r[i],
        b = r[(i + 1) % r.length],
        u = norm(b.map((v, k) => v - a[k])),
        m = a.map((v, k) => (v + b[k]) / 2),
        n = [u[1], -u[0]];
      wall(
        out,
        detail,
        m.map((v, k) => v + n[k] * 0.6),
        m.map((v, k) => v + n[k] * 1.3),
        0.7,
        floor,
        top - 2,
      );
    }
    for (const side of [-1, 1])
      wall(
        out,
        detail,
        doorway.map((v, k) => v + (k === 0 ? side * 1.8 : 0)),
        stairEnd.map((v, k) => v + (k === 0 ? side * 1.8 : 0)),
        0.16,
        (p) => stairHeight(p) + 1,
        (p) => stairHeight(p) + 1.16,
        'metal',
      );
  }
}
function halfTower(out, detail, a, b, height = 6.2) {
  const face = writer(out, detail),
    u = norm(b.map((v, k) => v - a[k])),
    m = a.map((v, k) => (v + b[k]) / 2),
    n = [-u[1], u[0]],
    count = [2, 5, 8, 12, 16][detail],
    radius = 3.35,
    width = 0.8,
    ring = (r) =>
      Array.from({ length: count + 1 }, (_, i) => {
        const t = (i * Math.PI) / count;
        return m.map((v, k) => v + u[k] * Math.cos(t) * r + n[k] * Math.sin(t) * r);
      }),
    outer = ring(radius),
    inner = ring(radius - width),
    ground = loarreGround(...m) + 0.05,
    top = ground + height;
  for (let i = 0; i < count; i++) {
    const a = outer[i],
      b = outer[i + 1],
      p = inner[i],
      q = inner[i + 1];
    face(
      'stone',
      [at(a, ground), at(b, ground), at(b, top), at(a, top)],
      [a[0] - m[0], 0, a[1] - m[1]],
    );
    face(
      'stone',
      [at(p, ground), at(q, ground), at(q, top), at(p, top)],
      [m[0] - p[0], 0, m[1] - p[1]],
    );
    face('stone', [at(a, top), at(b, top), at(q, top), at(p, top)], [0, 1, 0]);
  }
  for (const i of [0, count])
    face(
      'stone',
      [at(outer[i], ground), at(inner[i], ground), at(inner[i], top), at(outer[i], top)],
      u.map((v) => (i === 0 ? v : -v)),
    );
  // Roofless and open-backed: no diameter wall or top cap fills the tower well.
  if (detail >= 2)
    for (let i = 0; i < count; i += 2)
      wall(out, detail, outer[i], outer[i + 1], width, top, top + 0.65);
}
function lower(out, detail) {
  const r = frame.reconstruction.lowerCurtain,
    gateIndex = 7;
  for (let i = 0; i < r.length - 1; i++) {
    const a = r[i],
      b = r[i + 1],
      m = a.map((v, k) => (v + b[k]) / 2),
      base = loarreGround(...m) + 0.15;
    const axis = norm(b.map((v, k) => v - a[k]));
    if (i !== gateIndex) {
      const left = m.map((v, k) => v - axis[k] * 3.35),
        right = m.map((v, k) => v + axis[k] * 3.35);
      for (const [p, q] of [
        [a, left],
        [right, b],
      ])
        wall(
          out,
          detail,
          p,
          q,
          1.1,
          (p) => loarreGround(...p) - 0.2,
          (p) => loarreGround(...p) + 5,
        );
    } else
      wall(
        out,
        detail,
        a,
        b,
        1.1,
        (p) => loarreGround(...p) - 0.2,
        (p) => loarreGround(...p) + 5,
        'stone',
        i === gateIndex
          ? [{ center: m, width: 2.6, height: 3.5, spring: 2.2, bottom: base, shape: 'round' }]
          : [],
      );
    if (i !== gateIndex) halfTower(out, detail, a, b, i % 3 === 0 ? 6.3 : 5.6);
    else {
      const u = norm(b.map((v, k) => v - a[k])),
        n = [-u[1], u[0]],
        p = m.map((v, k) => v + n[k] * 1.1),
        r = [
          p.map((v, k) => v - u[k] * 3.4 - n[k] * 2),
          p.map((v, k) => v + u[k] * 3.4 - n[k] * 2),
          p.map((v, k) => v + u[k] * 3.4 + n[k] * 2),
          p.map((v, k) => v - u[k] * 3.4 + n[k] * 2),
        ];
      for (let j = 0; j < 4; j++)
        wall(
          out,
          detail,
          r[j],
          r[(j + 1) % 4],
          0.8,
          base,
          base + 9,
          'stone',
          j % 2 === 0
            ? [
                {
                  center: r[j].map((v, k) => (v + r[(j + 1) % 4][k]) / 2),
                  axis: u,
                  width: 2.6,
                  height: 3.5,
                  spring: 2.2,
                  bottom: base,
                  shape: 'round',
                },
              ]
            : [],
        );
    }
  }
}
function build(out, detail) {
  crag(out, detail);
  upper(out, detail);
  chapel(out, detail);
  tower(out, detail, 35185729015436, 24);
  tower(out, detail, 35185729008357, 18);
  const detached = center(control(35184749108140));
  tower(out, detail, 35184749108140, 11, {
    hollow: detail >= 1,
    base: loarreGround(...detached) + 0.1,
  });
  lower(out, detail);
}
export const buildLoarreSkyline = (out) => build(out, 0);
export const buildLoarreDistrict = (out) => build(out, 1);
export const buildLoarreStreet = (out) => build(out, 2);
export const buildLoarreCloseup = (out) => build(out, 3);
export const loarreStudy = {
  id: 'N0318',
  key: 'loarre_castle',
  title: 'Loarre Castle',
  category: 'castle',
  wikidataId: 'Q1049259',
  generationCommand: 'node packages/worldgen/scripts/generate-additional-landmarks.mjs',
  mapFrame: 'map-frame.json',
  fidelityTarget: 'medium-fi',
  build: (out) => build(out, 4),
  surfaceOverrides: scope.surfaceOverrides,
  brief:
    'Individual Loarre rocky fortress: unequal square keeps, roofless western and northern ranges, open court and crag, mapped chapel with tall polygonal stone roof and rounded eastern terrace, lower entrance/stairs, detached slim tower, and sloping lower curtain with hollow open-backed semicircular towers and an arched gate.',
  sourceFacts: {
    horizontalBasis:
      'Seven PMTiles component polygons plus named castle/chapel POIs; lower curtain and upper perimeter are photo-led approximate plans.',
    architecturalHeights: 'Photo estimates against mapped component sizes, not survey dimensions.',
  },
  reconstruction: frame.reconstruction,
  scaleBasis:
    'Mapped chapel28x13m and seven independently positioned component plans; overall curtain extent is estimated against them.',
  refs: read('reference-metadata.json').currentRoundInspection.pictures,
  nativeAxes: frame.nativeAxes,
  sourceDocuments: scope.sourceDocuments,
  sourceLicense:
    'Original geometry under repository license; map controls © OpenStreetMap contributors, ODbL-1.0. Linked photographs are not redistributed.',
  dataAttribution: '© OpenStreetMap contributors; Protomaps; Mapzen/USGS terrain tiles.',
  sourceNotice:
    'Five existing256-square graphs supply coursed limestone, continuous limestone crag, stone-colored roof, courtyard paving and painted metal; geometry uses metric UVs and linear tints. No unique bitmap or embedded photograph.',
  importReason:
    'Preserve individual towers, chapel roof/apse, open courts and hillside curtain in four independently authored browser levels.',
  previewGround: false,
  previewTerrain: scope.previewTerrain,
  mediumFiContext: scope.mediumFiContext,
  geographic: () => scope.geographic,
  geographicNote: scope.geographicNote,
  limitations: [
    'Mapped components fix approximate plan and signed facing; neither exact-QID outer enclosure nor surveyed orientation is claimed.',
    'Lower curtain, gate position, upper curtain, rock forms, wall thicknesses, stair profiles and tower heights are estimates from two exterior pictures and coarse viewer DEM.',
    'Full interiors, archaeological chronology, site vegetation and certified walkable collision are excluded.',
    'Upper crag cap and foundation contacts approximate the terrain blended by coarse DEM; no terrain carving or survey accuracy is claimed.',
    'Physical laptop and phone frame-rate measurements remain pending.',
  ],
  camera: scope.camera,
  qaCameras: [
    { name: 'chapel-roof-and-rounded-apse', position: [62, 54, 72], lookAt: [15, 14, 9], fov: 43 },
    { name: 'unequal-square-towers', position: [58, 66, -62], lookAt: [16, 17, -13], fov: 42 },
    {
      name: 'roofless-ranges-and-open-court',
      position: [-77, 72, 8],
      lookAt: [-9, 11, -4],
      fov: 43,
    },
    { name: 'hollow-lower-curtain-towers', position: [-2, 25, 125], lookAt: [-1, -1, 61], fov: 44 },
    { name: 'detached-tower-and-gate', position: [113, 40, 36], lookAt: [57, -1, 19], fov: 43 },
    { name: 'mapped-compound-plan', position: [8, 220, 17], lookAt: [8, 0, 17], fov: 50 },
  ],
};
