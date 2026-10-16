/** Florence: mapped cathedral/campanile, ribbed octagonal dome and polychrome marble. */
import './install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import earcut from 'earcut';
import { cross, normalFor } from './authored-structure-mesh.mjs';
import {
  openingBuilder,
  openingReveals,
  openingShape,
  prepareOpening,
} from './authored-wall-openings.mjs';

const source = new URL(
  '../../../content/worldgen/source/places/sr/srb/n0327_florence_cathedral/',
  import.meta.url,
);
const read = (name) => JSON.parse(readFileSync(new URL(name, source)));
const frame = read('map-frame.json'),
  fit = read('pmtiles-fit.json'),
  scope = read('review-scope.json'),
  means = read('surface-means.json');
const rec = frame.reconstruction,
  floor = rec.floorY;
const palette = {
  white: '#e5dfd0',
  green: '#577367',
  pink: '#c39284',
  trim: '#eee7d6',
  tile: '#a66648',
  foundation: '#c9bb9e',
  glass: '#4d6178',
  door: '#79624b',
  gold: '#d8b45b',
};
const colors = Object.fromEntries(
  Object.entries(palette).map(([k, h]) => [
    k,
    h
      .slice(1)
      .match(/../g)
      .map((n) => {
        const v = parseInt(n, 16) / 255;
        return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
      }),
  ]),
);
const unit = (v) => {
  const n = Math.hypot(...v) || 1;
  return v.map((x) => x / n);
};
const at = (p, y) => [p[0], typeof y === 'function' ? y(p) : floor + y, p[1]];
const lerp = (a, b, t) => a.map((v, k) => v + (b[k] - v) * t);
const center = (r) => [0, 1].map((k) => r.reduce((n, p) => n + p[k], 0) / r.length);
const sign = (r) =>
  Math.sign(
    r.reduce((s, p, i) => {
      const q = r[(i + 1) % r.length];
      return s + p[0] * q[1] - q[0] * p[1];
    }, 0),
  );
const rect = (p, w, h) => [
  [p[0] - w / 2, p[1] - h / 2],
  [p[0] + w / 2, p[1] - h / 2],
  [p[0] + w / 2, p[1] + h / 2],
  [p[0] - w / 2, p[1] + h / 2],
];
const regular = (p, r, n = 8, offset = 0) =>
  Array.from({ length: n }, (_, i) => [
    p[0] + r * Math.cos(offset + (i * Math.PI * 2) / n),
    p[1] + r * Math.sin(offset + (i * Math.PI * 2) / n),
  ]);
const scaled = (r, f) => {
  const p = center(r);
  return r.map((q) => q.map((v, k) => p[k] + (v - p[k]) * f));
};
const component = (id) => rec.components.find((b) => b.id === id);
const footing = (p) => Math.min(floor - 0.3, florenceGround(...p) - 0.35);
export function florenceGround(x, z) {
  const c = Math.cos(fit.heading),
    s = Math.sin(fit.heading);
  [x, z] = [x * c + z * s, -x * s + z * c];
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw Error('Florence footing outside retained terrain');
  const i = Math.floor(u),
    j = Math.floor(v),
    a = u - i,
    b = v - j,
    k = j * g.width + i,
    H = g.heights;
  return (
    (H[k] * (1 - a) + H[k + 1] * a) * (1 - b) +
    (H[k + g.width] * (1 - a) + H[k + g.width + 1] * a) * b -
    fit.datumMeters
  );
}
function writer(out, d) {
  return (slot, p, direction) => {
    p = p.map((v) => v.map(Math.fround));
    if (direction && normalFor(...p.slice(0, 3)).reduce((n, v, k) => n + v * direction[k], 0) < 0)
      p = p.toReversed();
    const color = d === 0 ? colors[slot].map((v, k) => v * means[slot][k]) : colors[slot];
    for (let i = 1; i < p.length - 1; i++) {
      const t = [p[0], p[i], p[i + 1]];
      if (
        Math.hypot(
          ...cross(
            t[1].map((v, k) => v - t[0][k]),
            t[2].map((v, k) => v - t[0][k]),
          ),
        ) < 1e-7
      )
        continue;
      out.addTriangle(
        slot,
        'palette:#ffffff',
        t,
        normalFor(...t),
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
function cap(face, r, y, slot, holes = []) {
  const points = [...r, ...holes.flat()],
    starts = [];
  let offset = r.length;
  for (const h of holes) {
    starts.push(offset);
    offset += h.length;
  }
  const ids = earcut(points.flat(), starts, 2);
  for (let i = 0; i < ids.length; i += 3)
    face(
      slot,
      ids.slice(i, i + 3).map((k) => at(points[k], y)),
      [0, 1, 0],
    );
}
function sides(face, r, b, t, slot, inward = false) {
  const s = sign(r) * (inward ? -1 : 1);
  for (let i = 0; i < r.length; i++) {
    const p = r[i],
      q = r[(i + 1) % r.length];
    face(slot, [at(p, b), at(q, b), at(q, t), at(p, t)], [(q[1] - p[1]) * s, 0, (p[0] - q[0]) * s]);
  }
}
function solid(face, r, b, t, slot) {
  sides(face, r, b, t, slot);
  cap(face, r, t, slot);
}
function profile(face, r, levels, slot) {
  for (let i = 1; i < levels.length; i++) {
    const [b, a] = levels[i - 1],
      [t, c] = levels[i],
      lo = scaled(r, a),
      hi = scaled(r, c),
      s = sign(r);
    for (let j = 0; j < r.length; j++) {
      const k = (j + 1) % r.length;
      face(
        slot,
        [at(lo[j], b), at(lo[k], b), at(hi[k], t), at(hi[j], t)],
        [(r[k][1] - r[j][1]) * s, 0.1, (r[j][0] - r[k][0]) * s],
      );
    }
  }
  const [t, f] = levels.at(-1);
  if (f > 0) cap(face, scaled(r, f), t, slot);
}
function beam(face, slot, a, b, w) {
  const u = unit(b.map((v, k) => v - a[k])),
    v = unit(cross(u, Math.abs(u[1]) > 0.95 ? [1, 0, 0] : [0, 1, 0])),
    n = cross(u, v),
    ring = (p) =>
      [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ].map(([x, z]) => p.map((q, k) => q + ((v[k] * x + n[k] * z) * w) / 2));
  const r = ring(a),
    s = ring(b);
  for (let i = 0; i < 4; i++) face(slot, [r[i], r[(i + 1) % 4], s[(i + 1) % 4], s[i]]);
  face(slot, r.toReversed());
  face(slot, s);
}
const box = (face, p, w, d, b, t, slot) => solid(face, rect(p, w, d), b, t, slot);
function faceFrame(r, i) {
  const a = r[i],
    b = r[(i + 1) % r.length],
    axis = unit(b.map((v, k) => v - a[k])),
    normal = [axis[1] * sign(r), -axis[0] * sign(r)];
  return { a, b, axis, normal, length: Math.hypot(b[0] - a[0], b[1] - a[1]) };
}
function panel(face, f, t, w, b, h, slot, offset = 0.055) {
  const p = lerp(f.a, f.b, t),
    q = (u, y) => [
      p[0] + f.axis[0] * u + f.normal[0] * offset,
      floor + y,
      p[1] + f.axis[1] * u + f.normal[1] * offset,
    ];
  face(
    slot,
    [q(-w / 2, b), q(w / 2, b), q(w / 2, b + h), q(-w / 2, b + h)],
    [f.normal[0], 0, f.normal[1]],
  );
}
function surfaceFrame(face, f, t, w, b, h, d) {
  panel(face, f, t, w, b, h, 'green');
  panel(face, f, t, w - 0.6, b + 0.3, h - 0.6, 'white', 0.08);
  if (d >= 3) panel(face, f, t, w - 1.35, b + 0.68, h - 1.35, 'pink', 0.1);
}
function ringBand(face, r, y, h, slot, factor = 1.005) {
  sides(face, scaled(r, factor), y, y + h, slot);
}
function pane(face, h, d, offset = -0.18, slot = 'glass') {
  const p = prepareOpening(h, 0, d),
    normal = [-p.axis[1], p.axis[0]];
  offset *= Math.sign(normal[0] * h.normal[0] + normal[1] * h.normal[1]);
  face(
    slot,
    openingShape(h, d).map((q) => p.point(...q, offset)),
    [h.normal[0], 0, h.normal[1]],
  );
}
function archBand(face, h, d, w = 0.45, slot = 'trim', offset = 0.08) {
  const outer = openingShape(
      {
        ...h,
        width: h.width + w * 2,
        height: h.height + w,
        bottom: h.bottom - w,
        spring: h.spring + w,
      },
      d,
    ),
    inner = openingShape(h, d),
    p = prepareOpening(h, 0, d);
  offset *= Math.sign(-p.axis[1] * h.normal[0] + p.axis[0] * h.normal[1]);
  if (outer.length !== inner.length) return;
  for (let i = 0; i < inner.length; i++) {
    const j = (i + 1) % inner.length;
    face(
      slot,
      [
        p.point(...outer[i], offset),
        p.point(...outer[j], offset),
        p.point(...inner[j], offset),
        p.point(...inner[i], offset),
      ],
      [h.normal[0], 0, h.normal[1]],
    );
  }
}
function circular(face, f, p, y, r, d, slot = 'glass') {
  const n = d < 2 ? 8 : 16,
    c = [p[0] + f.normal[0] * 0.18, floor + y, p[1] + f.normal[1] * 0.18],
    ring = Array.from({ length: n }, (_, i) => {
      const a = (i * 2 * Math.PI) / n;
      return [
        c[0] + f.axis[0] * Math.cos(a) * r,
        c[1] + Math.sin(a) * r,
        c[2] + f.axis[1] * Math.cos(a) * r,
      ];
    });
  face(slot, ring, [f.normal[0], 0, f.normal[1]]);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n,
      big = (v) => v.map((x, k) => c[k] + (x - c[k]) * 1.14);
    face('trim', [big(ring[i]), big(ring[j]), ring[j], ring[i]], [f.normal[0], 0, f.normal[1]]);
  }
  if (d >= 2) {
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4,
        edge = [
          c[0] + f.axis[0] * Math.cos(a) * r * 0.86,
          c[1] + Math.sin(a) * r * 0.86,
          c[2] + f.axis[1] * Math.cos(a) * r * 0.86,
        ];
      beam(face, 'trim', c, edge, 0.14);
    }
  }
}
export const florenceOpenings = [];
const remember = (h, d) => {
  if (d >= 3 && !florenceOpenings.some((q) => q.name === h.name)) florenceOpenings.push(h);
  return h;
};
function shell(out, d, r, b, t, holes = [], slot = 'white', inner = null) {
  const hs = holes.map((h) => prepareOpening(h, 0, d)),
    face = writer(openingBuilder(out, hs), d);
  sides(face, r, b, t, slot);
  if (inner) sides(face, inner, b, t, slot, true);
  cap(face, r, t, slot, inner ? [inner] : []);
  for (const h of hs)
    openingReveals(
      {
        addTriangle(_s, ref, p, n, uv, col) {
          out.addTriangle(slot, ref, p, n, uv, col);
        },
      },
      r,
      (p) => (typeof b === 'function' ? b(p) : floor + b),
      () => floor + t,
      [h],
      d === 0 ? colors[slot].map((v, k) => v * means[slot][k]) : colors[slot],
    );
}
function facadeHoles(d) {
  if (d < 2) return [];
  const f = { a: [-77.9, -22], b: [-77.9, 20.8], axis: [0, 1], normal: [-1, 0] };
  return [
    [-0.0, 'central', 6.2, 11, 8],
    [-15, 'north', 4.0, 8.0, 5.8],
    [13.9, 'south', 4.0, 8, 5.8],
  ].map(([z, name, width, height, spring]) =>
    remember(
      {
        name: `${name}-closed-portal`,
        center: [-77.82, z],
        axis: f.axis,
        normal: f.normal,
        width,
        bottom: floor + 0.25,
        height,
        spring,
        depth: 4,
        shape: 'pointed',
      },
      d,
    ),
  );
}
function nave(out, d) {
  const frontHoles = facadeHoles(d),
    main = rec.main.polygons[0].outline;
  shell(out, d, main, d === 0 ? footing : 0, 25, frontHoles);
  const face = writer(out, d);
  for (const p of rec.lowRoof) cap(face, p.outline, 25, 'tile', p.holes);
  const r = rec.nave;
  solid(face, r, 25, 40, 'white');
  const ridge = center(r)[1];
  for (let i = 0; i < r.length; i++) {
    const p = r[i],
      q = r[(i + 1) % r.length],
      a = [p[0], ridge],
      b = [q[0], ridge];
    face('tile', [at(p, 40), at(q, 40), at(b, 45), at(a, 45)], [0, 1, 0]);
  }
  // Side aisles lean up to the high nave. Their eaves stay on the mapped25m parent mass.
  for (const s of [-1, 1]) {
    const z = s > 0 ? 21.0 : -23.1,
      zInner = s > 0 ? 10.2 : -12.2;
    face(
      'tile',
      [
        [-77.7, floor + 25, z],
        [2.4, floor + 25, z],
        [2.4, floor + 35, zInner],
        [-77.7, floor + 35, zInner],
      ],
      [0, 1, 0],
    );
    face(
      'white',
      [
        [-77.7, floor + 25, z],
        [-77.7, floor + 35, zInner],
        [-77.7, floor + 25, zInner],
      ],
      [-1, 0, 0],
    );
  }
  if (d) {
    for (const s of [-1, 1]) {
      const f = {
        a: [-75, s > 0 ? 21.1 : -23.25],
        b: [0, s > 0 ? 21.1 : -23.25],
        axis: [1, 0],
        normal: [0, s],
      };
      for (let i = 0; i < 6; i++) {
        surfaceFrame(face, f, (i + 0.5) / 6, 10, 1.6, 20, d);
        const h = {
          center: lerp(f.a, f.b, (i + 0.5) / 6),
          axis: f.axis,
          normal: f.normal,
          width: 2.7,
          bottom: floor + 9,
          height: 9,
          spring: 7,
          shape: 'pointed',
          depth: 2,
        };
        pane(face, h, d, 0.12);
        archBand(face, h, d, 0.5);
        if (d >= 2) panel(face, f, (i + 1) / 6, 0.75, 0, 25, 'trim', 0.3);
      }
      for (const y of [1.4, 23.2]) panel(face, f, 0.5, 75, y, 0.7, 'green');
    }
  }
  if (d >= 1) {
    const f = { a: [-75, 10.3], b: [0, 11.1], axis: [1, 0], normal: [0, 1] },
      north = { ...f, a: [-75, -12.3], b: [0, -11.6], normal: [0, -1] };
    for (const wall of [f, north])
      for (let i = 0; i < 5; i++) {
        surfaceFrame(face, wall, (i + 0.5) / 5, 11, 35.5, 3.4, d);
        circular(face, wall, lerp(wall.a, wall.b, (i + 0.5) / 5), 37, 1.25, d);
      }
  }
  if (d)
    for (let i = 0; i < main.length; i++) {
      const f = faceFrame(main, i);
      if (f.length < 9 || (f.a[0] < 3 && f.b[0] < 3)) continue;
      surfaceFrame(face, f, 0.5, Math.min(12, f.length - 1.2), 2, 20.5, d);
      if (d >= 2) {
        const h = {
          center: lerp(f.a, f.b, 0.5),
          axis: f.axis,
          normal: f.normal,
          width: 2.4,
          bottom: floor + 9,
          height: 8.5,
          spring: 6.5,
          depth: 2,
          shape: 'pointed',
        };
        pane(face, h, d, 0.18);
        archBand(face, h, d, 0.4);
      }
    }
  westFacade(face, d, frontHoles);
}
function westFacade(face, d, holes) {
  const x = -78.0,
    f = { a: [x, -22], b: [x, 20.8], axis: [0, 1], normal: [-1, 0] },
    zc = -0.6;
  // The three gables are architectural crowns, not a single generic pitched front.
  for (const [z, w, base, top] of [
    [zc, 23, 39.2, 47.5],
    [-16.6, 10.8, 25, 34.3],
    [15.8, 10, 25, 34.3],
  ]) {
    face(
      'white',
      [
        [x, floor + base, z - w / 2],
        [x, floor + base, z + w / 2],
        [x, floor + top, z],
      ],
      [-1, 0, 0],
    );
    if (d) {
      beam(face, 'trim', [x - 0.08, floor + base, z - w / 2], [x - 0.08, floor + top, z], 0.65);
      beam(face, 'trim', [x - 0.08, floor + top, z], [x - 0.08, floor + base, z + w / 2], 0.65);
    }
  }
  if (!d) return;
  panel(face, f, 0.5, 21.5, 24, 15.2, 'white', 0.02);
  for (const y of [1.2, 14.1, 23.4]) panel(face, f, 0.5, 42.8, y, 0.65, 'green', 0.1);
  for (const z of [-21.6, -11.1, 10.7, 20.4]) {
    panel(
      face,
      { ...f, a: [x, z - 1], b: [x, z + 1] },
      0.5,
      1.4,
      0,
      z === -11.1 || z === 10.7 ? 40 : 26,
      'green',
      0.1,
    );
    if (d >= 2) box(face, [x - 0.2, z], 0.8, 1.1, 25, z === -11.1 || z === 10.7 ? 43 : 29, 'trim');
  }
  for (const [z, w, h] of [
    [0, 6.2, 11],
    [-15, 4, 8],
    [13.9, 4, 8],
  ]) {
    const hole = holes.find((q) => Math.abs(q.center[1] - z) < 0.1) ?? {
      center: [-77.82, z],
      axis: f.axis,
      normal: f.normal,
      width: w,
      bottom: floor + 0.25,
      height: h,
      spring: h - 2.5,
      depth: 4,
      shape: 'pointed',
    };
    pane(face, hole, d, d < 2 ? 0.23 : -0.3, 'door');
    archBand(face, hole, d, 0.75, 'green', 0.28);
    archBand(
      face,
      {
        ...hole,
        width: w + 1.5,
        height: h + 0.75,
        spring: hole.spring + 0.75,
        bottom: hole.bottom - 0.75,
      },
      d,
      0.5,
      'trim',
      0.3,
    );
    if (d >= 2) {
      const zTop = z === 0 ? 20.8 : 15.7;
      face(
        'pink',
        [
          [x - 0.32, floor + h + 1, z - w / 2 - 1],
          [x - 0.32, floor + h + 1, z + w / 2 + 1],
          [x - 0.32, floor + zTop, z],
        ],
        [-1, 0, 0],
      );
      beam(
        face,
        'trim',
        [x - 0.37, floor + h + 1, z - w / 2 - 1],
        [x - 0.37, floor + zTop, z],
        0.45,
      );
      beam(
        face,
        'trim',
        [x - 0.37, floor + zTop, z],
        [x - 0.37, floor + h + 1, z + w / 2 + 1],
        0.45,
      );
    }
  }
  circular(face, f, [x, zc], 32.2, 4.25, d);
  for (const z of [-16.5, 15.7]) circular(face, f, [x, z], 22, 1.9, d);
  if (d >= 2) {
    for (let i = 0; i < 11; i++) {
      const z = -19 + i * 3.8;
      const h = {
        center: [x, z],
        axis: f.axis,
        normal: f.normal,
        width: 1.9,
        bottom: floor + 17.0,
        height: 4.6,
        spring: 3.0,
        shape: 'pointed',
        depth: 2,
      };
      pane(face, h, d, 0.18);
      archBand(face, h, d, 0.25, 'trim', 0.2);
    }
    for (const [z, y] of [
      [-21.7, 29],
      [-11.1, 43],
      [10.7, 43],
      [20.4, 29],
    ]) {
      profile(
        face,
        regular([x - 0.4, z], 0.58, 6),
        [
          [y, 1],
          [y + 3, 0],
        ],
        'trim',
      );
    }
  }
}
function tribunes(out, d) {
  const face = writer(out, d);
  for (const n of [25, 26, 27]) {
    const r = component(35184770099500 + n).polygons[0].outline;
    solid(face, r, 25, 36, 'white');
    profile(
      face,
      r,
      [
        [36, 1.02],
        [40, 0.84],
        [43, 0.46],
        [45, 0.05],
      ],
      'tile',
    );
    if (d) {
      ringBand(face, r, 34.8, 0.8, 'trim', 1.02);
      for (let i = 0; i < r.length; i++) {
        const f = faceFrame(r, i);
        if (f.length < 7) continue;
        surfaceFrame(face, f, 0.5, Math.min(7, f.length - 1.3), 25.5, 8.6, d);
        const h = {
          center: lerp(f.a, f.b, 0.5),
          axis: f.axis,
          normal: f.normal,
          width: 2.3,
          bottom: floor + 27,
          height: 6.1,
          spring: 4.7,
          shape: 'pointed',
          depth: 2,
        };
        pane(face, h, d, 0.12);
        archBand(face, h, d, 0.3);
      }
    }
  }
  for (const n of [28, 29, 30, 31]) {
    const raw = component(35184770099500 + n).polygons[0].outline,
      r = d === 0 ? raw.filter((_p, i) => i === 0 || i === 3 || i === 6 || i === 9) : raw,
      p = center(r);
    solid(face, r, 25, 37.5, 'white');
    profile(
      face,
      r,
      d <= 1
        ? [
            [37.5, 1.015],
            [45, 0.72],
          ]
        : [
            [37.5, 1.015],
            [40, 1],
            [43, 0.96],
            [45, 0.72],
          ],
      'white',
    );
    cap(face, scaled(r, 0.72), 45, 'tile');
    if (d) {
      for (const y of d === 1 ? [36] : [28, 36, 38.5, 42]) ringBand(face, r, y, 0.6, 'green', 1.01);
      if (d >= 2) {
        for (let i = 0; i < r.length; i++) {
          const f = faceFrame(r, i);
          if (f.length > 4 && Math.hypot(...lerp(f.a, f.b, 0.5).map((v, k) => v - p[k])) > 4)
            surfaceFrame(face, f, 0.5, Math.min(3, f.length - 0.8), 29, 5.6, d);
        }
      }
    }
  }
}
function dome(out, d) {
  const face = writer(out, d),
    r = rec.domeRing,
    p = center(r);
  solid(face, r, 25, 55, 'white');
  if (d) {
    ringBand(face, r, 45, 0.8, 'trim', 1.01);
    ringBand(face, r, 54, 0.9, 'trim', 1.035);
    for (let i = 0; i < r.length; i++) {
      const f = faceFrame(r, i);
      surfaceFrame(face, f, 0.5, f.length - 2, 46.3, 6.4, d);
      circular(face, f, lerp(f.a, f.b, 0.5), 49.7, 2.9, d);
    }
  }
  const levels =
    d === 0
      ? [
          [55, 1],
          [76, 0.78],
          [92, 0.3],
          [96, 0.14],
        ]
      : d === 1
        ? [
            [55, 1],
            [67, 0.93],
            [80, 0.7],
            [91, 0.37],
            [96, 0.14],
          ]
        : [
            [55, 1],
            [62, 0.98],
            [70, 0.88],
            [78, 0.73],
            [85, 0.55],
            [91, 0.35],
            [96, 0.14],
          ];
  profile(face, r, levels, 'tile');
  for (let i = 0; i < r.length; i++)
    for (let j = 1; j < levels.length; j++) {
      const [b, a] = levels[j - 1],
        [t, c] = levels[j];
      const lo = scaled(r, a)[i],
        hi = scaled(r, c)[i];
      if (d <= 1) {
        const normal = unit([lo[0] - p[0], lo[1] - p[1]]),
          tangent = [-normal[1], normal[0]],
          width = 0.9;
        face(
          'trim',
          [
            at(
              lo.map((v, k) => v + normal[k] * 0.07 - tangent[k] * width),
              b,
            ),
            at(
              lo.map((v, k) => v + normal[k] * 0.07 + tangent[k] * width),
              b,
            ),
            at(
              hi.map((v, k) => v + normal[k] * 0.07 + tangent[k] * width),
              t,
            ),
            at(
              hi.map((v, k) => v + normal[k] * 0.07 - tangent[k] * width),
              t,
            ),
          ],
          [normal[0], 0.2, normal[1]],
        );
      } else beam(face, 'trim', at(lo, b), at(hi, t), 1.05);
    }
  const lan = regular(p, 3.7, 8, Math.PI / 8);
  solid(face, lan, 96, 97.5, 'trim');
  if (d < 2) {
    solid(face, lan, 97.5, 107, 'trim');
    if (d)
      for (let i = 0; i < 8; i++) {
        const f = faceFrame(lan, i);
        const h = {
          center: lerp(f.a, f.b, 0.5),
          axis: f.axis,
          normal: f.normal,
          width: 1.35,
          bottom: floor + 98.2,
          height: 7.2,
          spring: 5.8,
          shape: 'pointed',
          depth: 2,
        };
        pane(face, h, d, 0.07);
      }
  } else {
    const holes = [];
    for (let i = 0; i < 8; i++) {
      const f = faceFrame(lan, i);
      holes.push(
        remember(
          {
            name: `lantern-opening-${i}`,
            center: lerp(f.a, f.b, 0.5),
            axis: f.axis,
            normal: f.normal,
            width: 1.6,
            bottom: floor + 98,
            height: 8.0,
            spring: 6.7,
            depth: 2.2,
            shape: 'pointed',
          },
          d,
        ),
      );
    }
    shell(out, d, lan, 97.5, 107, holes, 'trim', scaled(lan, 0.78));
    for (const h of holes) archBand(face, h, d, 0.3, 'trim', 0.1);
  }
  profile(
    face,
    lan,
    [
      [107, 1.07],
      [108, 1.02],
      [110, 0.5],
      [111.8, 0.08],
    ],
    'trim',
  );
  const goldRing = regular(p, 0.65, d >= 2 ? 12 : 6);
  profile(
    face,
    goldRing,
    [
      [111.7, 0.3],
      [112.1, 1],
      [112.7, 0.6],
      [112.85, 0.05],
    ],
    'gold',
  );
  box(face, p, 0.24, 0.24, 112.5, 114.5, 'gold');
  box(face, p, 1.35, 0.24, 113.6, 113.85, 'gold');
  if (d >= 2) {
    for (let i = 0; i < 8; i++) {
      const q = lan[i],
        foot = q.map((v, k) => p[k] + (v - p[k]) * 1.23);
      beam(face, 'trim', at(foot, 96.6), at(q, 107), 0.55);
    }
  }
}
function tower(out, d) {
  const face = writer(out, d),
    r = rec.tower.polygons[0].outline,
    crown = component(35184623739470).polygons[0].outline,
    p = center(crown),
    holes = [];
  if (d >= 1) {
    for (let i = 0; i < crown.length; i++) {
      const f = faceFrame(crown, i);
      for (const [t, k] of d === 1
        ? [[0.5, 1]]
        : [
            [0.23, 0],
            [0.5, 1],
            [0.77, 2],
          ])
        holes.push(
          remember(
            {
              name: `campanile-upper-${i}-${k}`,
              center: lerp(f.a, f.b, t),
              axis: f.axis,
              normal: f.normal,
              width: d === 1 ? 8.6 : 2.4,
              bottom: floor + 65.5,
              height: 12.8,
              spring: 10.0,
              depth: 4.8,
              shape: 'pointed',
            },
            d,
          ),
        );
    }
  }
  solid(face, r, d === 0 ? footing : 0, 65, 'white');
  if (d === 0) solid(face, crown, 65, 80, 'white');
  else shell(out, d, crown, 65, 80, holes, 'white', scaled(crown, 0.72));
  solid(face, scaled(crown, 1.12), 80, 80.6, 'trim');
  if (d === 0) sides(face, scaled(crown, 1.1), 80.6, 85, 'white');
  else {
    const o = scaled(crown, 1.1),
      inner = scaled(crown, 0.88);
    sides(face, o, 80.6, 81.8, 'white');
    sides(face, inner, 80.6, 81.8, 'white', true);
    for (let i = 0; i < o.length; i++) {
      const f = faceFrame(o, i),
        count = d === 1 ? 6 : 10;
      for (let k = 0; k < count; k++) {
        const q = lerp(f.a, f.b, (k + 0.5) / count);
        box(face, q, 0.4, 0.4, 81.8, 84.0, 'trim');
      }
      beam(face, 'trim', at(f.a, 84.75), at(f.b, 84.75), 0.35);
    }
    ringBand(face, o, 84.6, 0.4, 'trim');
  }
  if (!d) return;
  if (d === 1)
    for (let i = 0; i < crown.length; i++) {
      const f = faceFrame(crown, i);
      for (const t of [0.36, 0.64]) {
        const q = lerp(f.a, f.b, t);
        beam(face, 'trim', at(q, 65.5), at(q, 76.5), 0.65);
      }
    }
  for (const y of [2, 22.5, 36, 51.5, 64]) ringBand(face, r, y, 0.8, 'trim', 1.025);
  const lowerFaces = r.map((_p, i) => faceFrame(r, i)).filter((f) => f.length > 8);
  for (let i = 0; i < crown.length; i++) {
    const upper = faceFrame(crown, i),
      f = lowerFaces.reduce((a, b) =>
        a.normal[0] * upper.normal[0] + a.normal[1] * upper.normal[1] >
        b.normal[0] * upper.normal[0] + b.normal[1] * upper.normal[1]
          ? a
          : b,
      );
    for (const y of [4.2, 12, 25, 38.5, 54]) {
      const height = y === 54 ? 8.5 : y === 38.5 ? 10 : 6;
      surfaceFrame(face, f, 0.5, f.length - 1.6, y, height, d);
      if (y >= 25)
        for (const t of [0.34, 0.66]) {
          const h = {
            center: lerp(f.a, f.b, t),
            axis: f.axis,
            normal: f.normal,
            width: 2.15,
            bottom: floor + y + 0.6,
            height: height - 1.2,
            spring: height - 3,
            depth: 2,
            shape: 'pointed',
          };
          pane(face, h, d, 0.18);
          archBand(face, h, d, 0.35);
        }
    }
    for (const h of holes.filter((h) => h.name.startsWith(`campanile-upper-${i}-`)))
      archBand(face, h, d, 0.4, 'green');
    for (const t of [0.06, 0.94]) panel(face, f, t, 0.5, 2, 62, 'green', 0.13);
    if (d >= 2) {
      for (const y of [5.2, 13.0])
        for (const t of [0.25, 0.5, 0.75]) {
          const q = lerp(f.a, f.b, t);
          const diamond = {
            ...f,
            a: [q[0] - f.axis[0], q[1] - f.axis[1]],
            b: [q[0] + f.axis[0], q[1] + f.axis[1]],
          };
          panel(face, diamond, 0.5, 1.8, y, 2.3, 'pink', 0.13);
        }
    }
  }
  // Thin antenna is intentionally omitted; mapped85m is retained at the parapet crown.
  box(face, p, 0.2, 0.2, 84.75, 85, 'trim');
}
function build(out, d) {
  nave(out, d);
  tribunes(out, d);
  dome(out, d);
  tower(out, d);
  const face = writer(out, d),
    main = rec.main.polygons[0].outline;
  if (d) {
    sides(face, main, footing, 0, 'foundation');
    sides(face, rec.tower.polygons[0].outline, footing, 0, 'foundation');
  }
}
export const buildFlorenceSkyline = (out) => build(out, 0);
export const buildFlorenceDistrict = (out) => build(out, 1);
export const buildFlorenceStreet = (out) => build(out, 2);
export const buildFlorenceCloseup = (out) => build(out, 3);
export const florenceStudy = {
  id: 'N0327',
  key: 'florence_cathedral',
  title: 'Florence Cathedral',
  category: 'cathedral',
  wikidataId: 'Q191739',
  generationCommand: 'node packages/worldgen/scripts/generate-additional-landmarks.mjs',
  mapFrame: 'map-frame.json',
  fidelityTarget: 'medium-fi',
  build: (out) => build(out, 4),
  surfaceOverrides: scope.surfaceOverrides,
  brief:
    'Individual Florence cathedral exterior with mapped nave/tribunes/buttress bodies, ribbed octagonal red dome and open lantern/gold crown, polychrome west facade with three closed pointed portals and rose windows, and adjacent square Giotto campanile with open triple belfry.',
  sourceFacts: {
    horizontalBasis:
      'Retained exact-QID outline, current parent/campanile and eleven component controls preserve nave axis, east dome/tribunes and south tower spacing.',
    architecturalHeights: rec.heightBasis,
  },
  reconstruction: rec,
  scaleBasis:
    'Mapped main/component outlines and nominal heights; two inspected aerial photographs guide intermediate roof/dome/tower profiles and polychrome ornament.',
  refs: read('reference-metadata.json').currentRoundInspection.pictures.map((p) => p.page),
  nativeAxes: frame.nativeAxes,
  sourceDocuments: scope.sourceDocuments,
  sourceLicense:
    'Original geometry under repository license; map controls ©OpenStreetMap contributors,ODbL-1.0. Linked photographs not redistributed.',
  dataAttribution: '©OpenStreetMap contributors; Protomaps; Mapzen/USGS terrain tiles.',
  sourceNotice:
    'Three existing shared256-square graphs supply marble, terracotta tile and continuous foundation limestone. Cream/green/pink are linear vertex tints with metric UVs; glass/doors/gold use simple colors, no unique embedded image.',
  importReason:
    'Four independently authored levels preserve ribbed red dome/lantern, stepped marble front and separate campanile at their mapped locations.',
  previewGround: false,
  previewTerrain: scope.previewTerrain,
  mediumFiContext: scope.mediumFiContext,
  geographic: () => scope.geographic,
  geographicNote: scope.geographicNote,
  limitations: [
    'Mapped main/component outlines and nominal25/45/85/114.5m heights control exterior fit; drum/shell/lantern split, portal/rose proportions, campanile intermediate levels and all ornament are approximate picture-led geometry. Contradictory min_height114.5/height17 part is excluded from height inference.',
    'NativeY0 follows standardDEM73.4272m. Estimated−5m common floor follows typical perimeter samples rather than the raised anchor. Coarse DEM varies about−10.4m westfront,−6.65m tower and−5.18m eastapse; residual skirts/embedding and exact plaza/doorstep joins remain approximate. No surveyed datum or navigable interior/collision certification.',
    'Skyline retains red ribbed octagonal dome/lantern, stepped westfront, nave/three tribunes/four buttress bodies and separate square campanile. District adds polychrome panel rhythm/roses and open tower belfry; street/closeup add recessed closed portals, open lantern, cornices and sparse pinnacles. No exact statues, lettering, reliefs, structural shell thickness or full interiors.',
    'Separate baptistery, museum, surrounding city and vegetation remain outside this asset. Physical laptop/phone measurements remain pending.',
  ],
  camera: scope.camera,
  qaCameras: [
    {
      name: 'west-marble-front-and-portals',
      position: [-142, 28, 3],
      lookAt: [-78, 23, 0],
      fov: 43,
    },
    { name: 'ribbed-dome-and-lantern', position: [105, 129, 95], lookAt: [30, 80, 0], fov: 43 },
    { name: 'campanile-open-belfry', position: [-114, 81, 93], lookAt: [-70, 62, 32], fov: 43 },
    { name: 'south-nave-and-tribune', position: [-10, 54, 112], lookAt: [-5, 29, 20], fov: 43 },
    { name: 'east-three-tribunes', position: [141, 66, -72], lookAt: [48, 34, -8], fov: 43 },
    {
      name: 'north-nave-and-buttresses',
      position: [-5, 70, -137],
      lookAt: [-15, 31, -14],
      fov: 43,
    },
  ],
};
