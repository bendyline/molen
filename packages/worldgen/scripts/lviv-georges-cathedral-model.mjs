/** Lviv Saint George cathedral: bowed Baroque front, cross plan, dome and split stairs. */
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
  '../../../content/worldgen/source/places/u8/u8c/n0344_saint_george_s_cathedral/',
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
  wall: '#f1ce7b',
  trim: '#dedbc2',
  roof: '#4a4e48',
  gold: '#c5a154',
  foundation: '#aaa898',
  door: '#6c513b',
  glass: '#4d6178',
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
const scaled = (r, f) => {
  const p = center(r);
  return r.map((q) => q.map((v, k) => p[k] + (v - p[k]) * f));
};
const footing = (p) => Math.min(floor - 0.3, lvivGround(...p) - 0.35);
export function lvivGround(x, z) {
  const c = Math.cos(fit.heading),
    s = Math.sin(fit.heading);
  [x, z] = [x * c + z * s, -x * s + z * c];
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw Error('Lviv cathedral footing outside retained terrain');
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
  return (slot, p, direction, colorOverride) => {
    p = p.map((v) => v.map(Math.fround));
    if (direction) {
      for (let i = 1; i < p.length - 1; i++) {
        const n = normalFor(p[0], p[i], p[i + 1]);
        if (Math.hypot(...n) < 0.5) continue;
        if (n.reduce((sum, v, k) => sum + v * direction[k], 0) < 0) p = p.toReversed();
        break;
      }
    }
    const tint = colorOverride ?? colors[slot];
    const color = d === 0 ? tint.map((v, k) => v * means[slot][k]) : tint;
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
function faceFrame(r, i) {
  const a = r[i],
    b = r[(i + 1) % r.length],
    axis = unit(b.map((v, k) => v - a[k])),
    normal = [axis[1] * sign(r), -axis[0] * sign(r)];
  return { a, b, axis, normal, length: Math.hypot(b[0] - a[0], b[1] - a[1]) };
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
function masked(out, holes) {
  const boxes = holes.map((h) => {
    if (h.bounds) return h.bounds;
    const p = h.ring.flatMap((q) => [h.point(...q, -h.depth / 2), h.point(...q, h.depth / 2)]);
    return [0, 1, 2].map((k) => [Math.min(...p.map((p) => p[k])), Math.max(...p.map((p) => p[k]))]);
  });
  return {
    addTriangle(...args) {
      const p = args[2],
        box = [0, 1, 2].map((k) => [
          Math.min(...p.map((p) => p[k])),
          Math.max(...p.map((p) => p[k])),
        ]);
      const near = holes.filter((_, i) =>
        boxes[i].every((b, k) => b[0] <= box[k][1] + 1e-6 && b[1] >= box[k][0] - 1e-6),
      );
      if (near.length) openingBuilder(out, near).addTriangle(...args);
      else out.addTriangle(...args);
    },
  };
}
function shell(out, d, r, b, t, holes = [], slot = 'wall', inner = null) {
  const hs = holes.map((h) => prepareOpening(h, 0, d === 2 ? 1 : d)),
    face = writer(masked(out, hs), d);
  const apertureBounds = (h) => {
    const p = h.ring.flatMap((q) => [h.point(...q, -h.depth / 2), h.point(...q, h.depth / 2)]);
    return [0, 1, 2].map((k) => [Math.min(...p.map((q) => q[k])), Math.max(...p.map((q) => q[k]))]);
  };
  const overlaps = (a, b) => a.every((r, k) => r[0] <= b[k][1] + 1e-6 && r[1] >= b[k][0] - 1e-6);
  const apertureBoxes = hs.map(apertureBounds);
  sides(face, r, b, t, slot);
  if (inner) sides(face, inner, b, t, slot, true);
  if (inner) cap(face, r, t, slot, [inner]);
  const cavity = inner
    ? {
        planes: inner.map((a, i) => {
          const q = inner[(i + 1) % inner.length],
            dx = q[0] - a[0],
            dz = q[1] - a[1],
            s = sign(inner);
          return [-dz * s, 0, dx * s, (dz * a[0] - dx * a[1]) * s];
        }),
      }
    : undefined;
  for (const h of hs) {
    const reveals = openingBuilder(out, [
      ...hs.filter((q, i) => q !== h && overlaps(apertureBoxes[hs.indexOf(h)], apertureBoxes[i])),
      ...(cavity ? [cavity] : []),
    ]);
    openingReveals(
      {
        addTriangle(_s, ref, p, n, uv, col) {
          reveals.addTriangle(slot, ref, p, n, uv, col);
        },
      },
      r,
      (p) => (typeof b === 'function' ? b(p) : floor + b),
      () => floor + t,
      [h],
      d === 0 ? colors[slot].map((v, k) => v * means[slot][k]) : colors[slot],
    );
  }
}
function simplify(r, tolerance) {
  let changed = true,
    p = [...r];
  while (changed && p.length > 4) {
    changed = false;
    for (let i = 0; i < p.length; i++) {
      const a = p[(i + p.length - 1) % p.length],
        b = p[i],
        c = p[(i + 1) % p.length],
        u = c.map((v, k) => v - a[k]),
        len = Math.hypot(...u),
        t = Math.max(
          0,
          Math.min(1, ((b[0] - a[0]) * u[0] + (b[1] - a[1]) * u[1]) / (len * len || 1)),
        ),
        q = lerp(a, c, t);
      if (Math.hypot(b[0] - q[0], b[1] - q[1]) < tolerance) {
        p.splice(i, 1);
        changed = true;
        break;
      }
    }
  }
  return p;
}
const regular = (p, r, n = 8, offset = 0) =>
  Array.from({ length: n }, (_, i) => [
    p[0] + r * Math.cos(offset + (i * 2 * Math.PI) / n),
    p[1] + r * Math.sin(offset + (i * 2 * Math.PI) / n),
  ]);
const band = (face, r, y, h = 0.25, slot = 'trim', factor = 1.02) =>
  sides(face, scaled(r, factor), y, y + h, slot);
function beam(face, a, b, w, slot = 'trim') {
  const axis = unit(b.map((v, k) => v - a[k])),
    u = unit(cross(axis, Math.abs(axis[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0])),
    v = unit(cross(axis, u)),
    corners = (p) =>
      [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ].map(([s, t]) => p.map((n, k) => n + ((u[k] * s + v[k] * t) * w) / 2)),
    lo = corners(a),
    hi = corners(b);
  face(
    slot,
    lo,
    axis.map((v) => -v),
  );
  face(slot, hi, axis);
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    face(slot, [lo[i], lo[j], hi[j], hi[i]]);
  }
}
const R = rec.main.polygons[0].outline,
  H = rec.heights;
const hole = (
  name,
  p,
  axis,
  normal,
  width,
  bottom,
  height,
  spring = height,
  shape = 'rect',
  depth = 3,
) => ({
  name,
  center: p,
  axis,
  normal,
  width,
  bottom: floor + bottom,
  height,
  spring,
  shape,
  depth,
});
const front = -22.1;
export const lvivPortals = () => [
  hole('west-door', [front, 0], [0, 1], [-1, 0], 2.25, 0.05, 5.3, 4.0, 'round', 6),
];
export function lvivWindows() {
  return [
    hole('west-tall-window', [front, 0], [0, 1], [-1, 0], 2.4, 9.2, 6.4, 5.15, 'round', 6),
    ...[-1, 1].flatMap((s) =>
      [-6.8, 6].map((x) =>
        hole(`side-${s}-${x}`, [x, s * 11.93], [1, 0], [0, s], 2.4, 8.8, 6.2, 5.0, 'round', 3.2),
      ),
    ),
    hole('east-window', [20.85, 0], [0, 1], [1, 0], 2.2, 9.4, 5.2, 4.1, 'round', 3.2),
  ];
}
const drum = () => [
  [-6.6, -4.5],
  [-4.7, -6.4],
  [3.3, -6.4],
  [5.2, -4.5],
  [5.2, 4.5],
  [3.3, 6.4],
  [-4.7, 6.4],
  [-6.6, 4.5],
];
export const lvivDrumWindows = () =>
  drum().map((_, i) => {
    const f = faceFrame(drum(), i);
    return hole(
      `drum-${i}`,
      lerp(f.a, f.b, 0.5),
      f.axis,
      f.normal,
      f.length > 5 ? 1.7 : 0.9,
      24.1,
      4.7,
      3.85,
      'round',
      3.5,
    );
  });
export const lvivLanternWindows = () =>
  regular([-0.7, 0], 1.45, 8, Math.PI / 8).map((_, i) => {
    const f = faceFrame(regular([-0.7, 0], 1.45, 8, Math.PI / 8), i);
    return hole(
      `lantern-${i}`,
      lerp(f.a, f.b, 0.5),
      f.axis,
      f.normal,
      0.58,
      36.65,
      1.6,
      1.25,
      'round',
      1.7,
    );
  });
function window(face, h, d, recessed = false, slot = 'glass') {
  pane(face, h, d, recessed ? -0.85 : 0.035, slot);
  if (d) archBand(face, h, d, d >= 2 ? 0.23 : 0.3, 'trim', 0.09);
  if (d >= 2 && slot === 'glass') {
    const axis = h.axis,
      n = h.normal,
      p = h.center.map((v, k) => v - n[k] * 0.65),
      b = h.bottom + 0.2,
      t = h.bottom + h.spring - 0.15;
    beam(face, [p[0], b, p[1]], [p[0], t, p[1]], 0.12, 'trim');
    if (d >= 3)
      for (const y of [b + 1.2, b + 2.5, b + 3.8].filter((v) => v < t))
        beam(
          face,
          [p[0] - axis[0] * h.width * 0.43, y, p[1] - axis[1] * h.width * 0.43],
          [p[0] + axis[0] * h.width * 0.43, y, p[1] + axis[1] * h.width * 0.43],
          0.085,
          'trim',
        );
  }
}
function roof(face, r, axis, eave, top) {
  const f = sign(r),
    side = [-axis[1], axis[0]],
    v = r.map((p) => p[0] * side[0] + p[1] * side[1]),
    mid = (Math.min(...v) + Math.max(...v)) / 2,
    span = (Math.max(...v) - Math.min(...v)) / 2;
  const height = (p) =>
    eave + (top - eave) * (1 - Math.abs((p[0] * side[0] + p[1] * side[1] - mid) / span));
  for (const keep of [-1, 1]) {
    const q = [];
    let a = r.at(-1),
      av = (a[0] * side[0] + a[1] * side[1] - mid) * keep;
    for (const b of r) {
      const bv = (b[0] * side[0] + b[1] * side[1] - mid) * keep;
      if (av >= 0 !== bv >= 0) q.push(lerp(a, b, av / (av - bv)));
      if (bv >= 0) q.push(b);
      a = b;
      av = bv;
    }
    if (q.length >= 3) cap(face, q, (p) => floor + height(p), 'roof');
  }
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      va = a[0] * side[0] + a[1] * side[1] - mid,
      vb = b[0] * side[0] + b[1] * side[1] - mid,
      ps = [a, ...(va * vb < 0 ? [lerp(a, b, va / (va - vb))] : []), b];
    for (let j = 1; j < ps.length; j++) {
      const p = ps[j - 1],
        q = ps[j];
      face(
        'wall',
        [at(p, eave), at(q, eave), at(q, height(q)), at(p, height(p))],
        [(b[1] - a[1]) * f, 0, (a[0] - b[0]) * f],
      );
    }
  }
}
function pedestal(face, p, b, height, d, slot = 'trim') {
  const r = rect(p, 0.8, 0.8);
  solid(face, scaled(r, 1.18), b, b + 0.25, slot);
  solid(face, r, b + 0.25, b + height, slot);
  if (d) solid(face, scaled(r, 1.12), b + height - 0.16, b + height + 0.08, slot);
}
function figure(face, p, b, h, d) {
  const n = d >= 3 ? 8 : d ? 6 : 4,
    r = regular(p, h * 0.16, n);
  profile(
    face,
    r,
    [
      [b, 1],
      [b + h * 0.63, 0.55],
      [b + h * 0.73, 0.48],
    ],
    'trim',
  );
  profile(
    face,
    regular(p, h * 0.105, n),
    [
      [b + h * 0.74, 0.6],
      [b + h * 0.86, 1],
      [b + h, 0.18],
    ],
    'trim',
  );
  if (d >= 2) {
    beam(
      face,
      [p[0], floor + b + h * 0.63, p[1]],
      [p[0] - 0.3 * h, floor + b + h * 0.6, p[1] - 0.14 * h],
      h * 0.075,
    );
    beam(
      face,
      [p[0], floor + b + h * 0.65, p[1]],
      [p[0], floor + b + h * 0.79, p[1] + 0.25 * h],
      h * 0.075,
    );
  }
}
const facadePlan = () => [
  [-19.35, -6.65],
  [-20.7, -6.65],
  [-21.2, -5.5],
  [-20.9, -3.4],
  [-21.9, -2],
  [-22.1, 0],
  [-21.9, 2],
  [-20.9, 3.4],
  [-21.2, 5.5],
  [-20.7, 6.65],
  [-19.35, 6.65],
];
const gable = [
  [-6.65, 23],
  [-5.7, 23.3],
  [-4.7, 23.65],
  [-3.5, 24.25],
  [-2.5, 25.1],
  [-1.9, 26.2],
  [-1.85, 28.5],
  [1.85, 28.5],
  [1.9, 26.2],
  [2.5, 25.1],
  [3.5, 24.25],
  [4.7, 23.65],
  [5.7, 23.3],
  [6.65, 23],
];
function gableCrown(face, d) {
  const outline = [[-6.65, 21.9], ...gable, [6.65, 21.9]],
    a = -21,
    b = -19.8;
  for (const x of [a, b])
    face(
      'wall',
      outline.map(([z, y]) => [x, floor + y, z]),
      [x === a ? -1 : 1, 0, 0],
    );
  for (let i = 1; i < outline.length; i++) {
    const [z, y] = outline[i - 1],
      [v, t] = outline[i];
    face('trim', [
      [a, floor + y, z],
      [b, floor + y, z],
      [b, floor + t, v],
      [a, floor + t, v],
    ]);
  }
  if (d)
    for (let i = 1; i < gable.length; i++) {
      const [z, y] = gable[i - 1],
        [v, t] = gable[i];
      beam(face, [a - 0.12, floor + y, z], [a - 0.12, floor + t, v], d >= 2 ? 0.26 : 0.35);
      if (d >= 2)
        beam(face, [a - 0.16, floor + y - 0.43, z], [a - 0.16, floor + t - 0.43, v], 0.12);
    }
  if (d >= 2) {
    const crest = [
      [-1.2, 24],
      [-1.4, 25.6],
      [-0.8, 26.6],
      [0.8, 26.6],
      [1.4, 25.6],
      [1.2, 24],
      [0, 23.6],
    ];
    face(
      'foundation',
      crest.map(([z, y]) => [a - 0.14, floor + y, z]),
      [-1, 0, 0],
    );
  }
  pedestal(face, [-20.4, 0], 28.5, 0.6, d);
  if (!d) {
    solid(face, rect([-20.4, 0], 0.8, 1.8), 29.1, 31.0, 'trim');
    return;
  }
  // Selected horse/rider silhouette, deliberately faceted rather than literal sculptural detail.
  const horse = rect([-20.4, 0], 0.65, 2.0);
  profile(
    face,
    horse,
    [
      [29.1, 0.8],
      [29.8, 1],
      [30.2, 0.8],
    ],
    'trim',
  );
  for (const z of [-0.65, 0.65])
    for (const x of [-20.62, -20.18])
      beam(face, [x, floor + 29.1, z], [x, floor + 30, z * 0.85], 0.16);
  beam(face, [-20.4, floor + 30, 0.55], [-20.4, floor + 30.8, 1.05], 0.4);
  solid(face, rect([-20.4, 1.18], 0.4, 0.7), 30.65, 31.0, 'trim');
  figure(face, [-20.4, -0.2], 30.0, 1.8, d);
  if (d >= 2) beam(face, [-20.4, floor + 31.2, -0.1], [-20.4, floor + 32.5, 1.4], 0.1);
  else solid(face, rect([-20.4, -0.2], 0.1, 0.1), 31.8, 32.5, 'trim');
}
function frontFacade(out, face, d) {
  const r = facadePlan(),
    hs = [...lvivPortals(), lvivWindows()[0]];
  shell(out, d, r, 0, H.frontCornice, d ? hs : [], 'wall');
  cap(face, r, H.frontCornice, 'trim');
  for (const y of d ? [0.2, 0.8, 5.6, 19.7, 20.3, 21.5] : [0.3, 21.5])
    profile(
      face,
      r,
      [
        [y, 1.015],
        [y + 0.18, 1.04],
        [y + 0.38, 1.04],
      ],
      'trim',
    );
  for (const z of [-5.5, -2.55, 2.55, 5.5]) {
    const x = Math.abs(z) > 4 ? -21.2 : -21.7,
      p = [x, z],
      q = rect(p, 0.7, 0.65);
    solid(face, q, 0.5, 19.7, 'trim');
    if (d) {
      solid(face, scaled(q, 1.25), 0.6, 1.1, 'trim');
      profile(
        face,
        q,
        [
          [18.4, 1],
          [19.1, 1.55],
          [19.7, 1.3],
        ],
        'trim',
      );
    }
  }
  for (const h of hs)
    if (d) {
      window(face, h, d, true, h.name === 'west-door' ? 'door' : 'glass');
      archBand(face, h, d, 0.4, 'trim', 0.12);
    } else pane(face, h, d, 0.04, h.name === 'west-door' ? 'door' : 'glass');
  if (d) {
    // Small balcony below the tall window and selected standing façade figures.
    solid(face, rect([-22.25, 0], 1.0, 3.35), 8.35, 8.65, 'trim');
    beam(face, [-22.65, floor + 9.05, -1.65], [-22.65, floor + 9.05, 1.65], 0.17);
    for (let i = 0; i < (d >= 2 ? 9 : 5); i++) {
      const z = -1.45 + (i * 2.9) / ((d >= 2 ? 9 : 5) - 1);
      solid(face, rect([-22.65, z], 0.14, 0.14), 8.6, 9.05, 'trim');
    }
    for (const s of [-1, 1]) {
      pedestal(face, [-22.0, s * 2.6], 7.4, 0.6, d);
      figure(face, [-22.0, s * 2.6], 8, 2.5, d);
    }
  }
  gableCrown(face, d);
}
function body(out, face, d) {
  const r = simplify(R, 0.1),
    hs = [...lvivPortals(), ...lvivWindows()];
  sides(face, r, footing, 0, 'foundation');
  cap(face, r, 0, 'foundation');
  shell(out, d, r, 0, H.eave, d ? hs : [], 'wall');
  cap(face, r, H.eave, 'roof');
  const nave = rect([0.4, 0], 40.8, 13.3),
    crossPlan = rect([-0.35, 0], 24.1, 23.85);
  roof(face, nave, [1, 0], H.eave, H.ridge);
  roof(face, crossPlan, [0, 1], H.eave, H.ridge);
  if (d) {
    band(face, r, 19.1, 0.4, 'trim', 1.012);
    band(face, r, 0.15, 0.45, 'foundation', 1.01);
    for (const h of lvivWindows().slice(1)) {
      window(face, h, d, true);
      if (h.name.startsWith('side')) {
        const [x, z] = h.center,
          s = Math.sign(z);
        for (const dx of [-2.1, 2.1]) {
          solid(face, rect([x + dx, z], 0.5, 0.6), 0.6, 18.7, 'trim');
          if (d >= 2) solid(face, rect([x + dx, z], 0.75, 0.85), 17.9, 18.7, 'trim');
        }
        solid(face, rect([x, z + s * 0.2], 3.3, 0.9), 8.15, 8.45, 'trim');
        if (d >= 2) {
          beam(
            face,
            [x - 1.6, floor + 8.95, z + s * 0.6],
            [x + 1.6, floor + 8.95, z + s * 0.6],
            0.15,
          );
          for (let i = 0; i < 9; i++)
            solid(
              face,
              rect([x - 1.45 + (i * 2.9) / 8, z + s * 0.6], 0.14, 0.14),
              8.45,
              8.95,
              'trim',
            );
        }
      }
    }
    for (const s of [-1, 1])
      for (const x of [-11.8, 10.7]) {
        const p = [x, s * 11.92];
        solid(face, rect(p, 0.7, 0.75), 0.5, 19.1, 'trim');
        if (d >= 2) {
          solid(face, rect(p, 1.0, 0.95), 18.2, 19.2, 'trim');
          pedestal(face, p, 19.5, 0.7, d);
          figure(face, p, 20.2, 1.6, d);
        }
      }
    for (const x of [-18.7, 17.9])
      for (const z of [-6.5, 6.5]) solid(face, rect([x, z], 0.7, 0.65), 0.6, 19.5, 'trim');
  }
}
function dome(out, face, d) {
  const r = drum(),
    hs = lvivDrumWindows();
  solid(face, scaled(r, 1.04), H.drumBase - 0.6, H.drumBase + 0.2, 'trim');
  if (d >= 2) shell(out, d, r, H.drumBase, H.drumTop, hs, 'wall');
  else solid(face, r, H.drumBase, H.drumTop, 'wall');
  if (d) for (const h of hs) window(face, h, d, d >= 2);
  if (d) {
    for (const p of r) {
      solid(face, rect(p, 0.44, 0.44), 22.7, 30.2, 'trim');
      if (d >= 2) solid(face, rect(p, 0.75, 0.75), 29.6, 30.5, 'trim');
    }
    band(face, r, 30.5, 0.5, 'trim', 1.055);
  }
  const levels =
    d >= 2
      ? [
          [31, 1.06],
          [31.65, 1.02],
          [33.7, 0.78],
          [35.3, 0.43],
          [35.8, 0.24],
        ]
      : [
          [31, 1.06],
          [34.3, 0.67],
          [35.8, 0.24],
        ];
  profile(face, r, levels, 'roof');
  if (d >= 2)
    for (let i = 0; i < r.length; i++) {
      const p = r[i],
        p0 = [-0.7, 0];
      for (let j = 1; j < levels.length; j++) {
        const [a, f] = levels[j - 1],
          [b, g] = levels[j];
        beam(
          face,
          [p0[0] + (p[0] - p0[0]) * f, floor + a, p[1] * f],
          [p0[0] + (p[0] - p0[0]) * g, floor + b, p[1] * g],
          0.13,
          'trim',
        );
      }
    }
  if (d) {
    for (const p of r.filter((_, i) => i % 2 === 0)) {
      pedestal(face, p, 31, 0.45, d);
      figure(face, p, 31.45, 1.65, d);
    }
  }
  const lantern = regular([-0.7, 0], 1.45, d ? 8 : 4, Math.PI / 8);
  solid(face, scaled(lantern, 1.15), 35.6, 36.3, 'gold');
  if (d >= 2)
    shell(out, d, lantern, 36.3, 38.55, lvivLanternWindows(), 'trim', scaled(lantern, 0.52));
  else solid(face, lantern, 36.3, 38.55, 'trim');
  cap(face, lantern, 36.3, 'gold');
  profile(
    face,
    lantern,
    [
      [38.55, 1.12],
      [39.0, 0.75],
      [39.4, 0.12],
    ],
    'gold',
  );
  beam(face, [-0.7, floor + 39.35, 0], [-0.7, floor + 42, 0], d ? 0.14 : 0.23, 'gold');
  beam(face, [-0.7, floor + 41.25, -0.65], [-0.7, floor + 41.25, 0.65], d ? 0.14 : 0.23, 'gold');
  if (d >= 2) beam(face, [-0.7, floor + 40.1, -0.4], [-0.7, floor + 40.45, 0.4], 0.1, 'gold');
}
export const lvivGrotto = () =>
  hole('central-stair-grotto', [-28, 0], [0, 1], [-1, 0], 2.2, -2.65, 2.35, 1.35, 'round', 4.0);
function stairs(out, face, d) {
  const landing = [
      [-28, -2.7],
      [-23, -4.0],
      [-21, -6.2],
      [-20.4, -6.2],
      [-20.4, 6.2],
      [-21, 6.2],
      [-23, 4],
      [-28, 2.7],
    ],
    h = lvivGrotto();
  if (d) {
    shell(out, d, landing, footing, 0, [h], 'foundation');
    pane(face, h, d, -1.4, 'glass');
  } else solid(face, landing, footing, 0, 'foundation');
  cap(face, landing, 0, 'foundation');
  for (const s of [-1, 1]) {
    const a = [-28.0, s * 8.8],
      b = [-23.7, s * 3.7],
      n = d >= 2 ? 11 : d ? 7 : 3,
      axis = unit(b.map((v, k) => v - a[k])),
      normal = [-axis[1], axis[0]],
      w = 2.1;
    for (let i = 0; i < n; i++) {
      const p = lerp(a, b, i / n),
        q = lerp(a, b, (i + 1) / n),
        r = [
          p.map((v, k) => v + (normal[k] * w) / 2),
          q.map((v, k) => v + (normal[k] * w) / 2),
          q.map((v, k) => v - (normal[k] * w) / 2),
          p.map((v, k) => v - (normal[k] * w) / 2),
        ];
      solid(face, r, footing, -2.6 + ((i + 1) * 2.6) / n, 'foundation');
    }
    if (d)
      for (const off of [-1, 1]) {
        const p = a.map((v, k) => v + normal[k] * w * 0.5 * off),
          q = b.map((v, k) => v + normal[k] * w * 0.5 * off);
        beam(face, [p[0], floor - 1.9, p[1]], [q[0], floor + 0.75, q[1]], 0.2, 'trim');
        const count = d >= 2 ? 12 : 6;
        for (let i = 0; i < count; i++) {
          const t = i / (count - 1),
            p2 = lerp(p, q, t),
            y = -2.6 + t * 2.6;
          solid(face, rect(p2, 0.18, 0.18), y, y + 0.75, 'trim');
        }
      }
  }
  if (d) {
    beam(face, [-28.1, floor + 0.75, -2.7], [-28.1, floor + 0.75, 2.7], 0.2);
    const n = d >= 2 ? 17 : 9;
    for (let i = 0; i < n; i++)
      solid(face, rect([-28.1, -2.5 + (i * 5) / (n - 1)], 0.18, 0.18), 0, 0.75, 'trim');
  }
}
function build(out, d) {
  const stable = {
    addTriangle(slot, ref, points, _normal, uv, color) {
      const p = points.map((v) => v.map(Math.fround));
      if (
        Math.hypot(
          ...cross(
            p[1].map((v, k) => v - p[0][k]),
            p[2].map((v, k) => v - p[0][k]),
          ),
        ) < 1e-9
      )
        return;
      out.addTriangle(slot, ref, p, normalFor(...p), uv, color);
    },
  };
  const face = writer(stable, d);
  body(stable, face, d);
  frontFacade(stable, face, d);
  dome(stable, face, d);
  stairs(stable, face, d);
}
export const buildLvivSkyline = (o) => build(o, 0),
  buildLvivDistrict = (o) => build(o, 1),
  buildLvivStreet = (o) => build(o, 2),
  buildLvivCloseup = (o) => build(o, 3);
export const lvivStudy = {
  id: 'N0344',
  key: 'saint_george_s_cathedral',
  title: "Saint George's Cathedral",
  category: 'cathedral',
  wikidataId: 'Q1774485',
  generationCommand: 'node packages/worldgen/scripts/generate-additional-landmarks.mjs',
  mapFrame: 'map-frame.json',
  fidelityTarget: 'medium-fi',
  build: (o) => build(o, 4),
  surfaceOverrides: scope.surfaceOverrides,
  brief: rec.scope,
  sourceFacts: {
    horizontalBasis:
      'Retained exact-QID way165546187 and current approximately42x24m parent;west court resolves front at native-X,without rescaling.',
    architecturalHeights: rec.heightBasis,
  },
  reconstruction: rec,
  scaleBasis:
    'Approximately42x24m mapped cross plan. Current5m PMTiles height is rejected;all vertical dimensions,Baroque facade/dome and split stair proportions are picture-based estimates.',
  refs: read('reference-metadata.json').currentRoundInspection.pictures.map((p) => p.page),
  nativeAxes: frame.nativeAxes,
  sourceDocuments: scope.sourceDocuments,
  sourceLicense:
    'Original geometry under repository license;map geometry ©OpenStreetMap contributors,ODbL-1.0. Linked photographs not redistributed.',
  dataAttribution: '©OpenStreetMap contributors;Protomaps;Mapzen/USGS terrain tiles.',
  sourceNotice:
    'Five existing256-square graphs:lime plaster,raw/weathered limestone,standing-seam metal and wood. Dark roof/gold lantern share the metal graph with linear vertex tints. Metric UVs,flat architecture normals and flat glazing;no embedded images.',
  importReason:
    'Four authored browser levels preserve Lviv cathedral cross plan,bowed yellow west facade,central dark dome/gold lantern and geographic orientation.',
  previewGround: false,
  previewTerrain: scope.previewTerrain,
  mediumFiContext: scope.mediumFiContext,
  geographic: () => scope.geographic,
  geographicNote: scope.geographicNote,
  limitations: [
    rec.heightBasis,
    scope.geographicNote,
    'Individual exterior approximation from three inspected pictures and standard map/terrain. Exact coat-of-arms reliefs,equestrian/standing sculptures,side/rear decoration,full interiors,separate palace/courtyard wings,gates and belltower excluded. Split stairs/grotto are approximate;physical phone/laptop measurements pending.',
    'Skyline retains cross plan,bowed facade,curved gable,central drum/dark dome,gold lantern/cross and coarse split stair mass. District adds shared textures,recessed closed door/front and side glazing,selected facade figures and balcony. Street adds recessed drum glazing,open lantern,bands/ribs,pilasters and stair balustrades;closeup refines arch/figure/stair details. Detail transitions remain visible.',
  ],
  camera: scope.camera,
  qaCameras: [
    { name: 'bowed-front-and-curved-gable', position: [-59, 25, 8], lookAt: [-21, 15, 0], fov: 48 },
    { name: 'single-door-and-split-stairs', position: [-46, 11, 12], lookAt: [-25, 4, 0], fov: 48 },
    {
      name: 'arched-window-and-standing-figures',
      position: [-40, 19, 10],
      lookAt: [-22, 13, 0],
      fov: 43,
    },
    {
      name: 'central-drum-dark-dome-and-gold-lantern',
      position: [-29, 43, 35],
      lookAt: [-0.7, 31, 0],
      fov: 48,
    },
    {
      name: 'cross-plan-side-roofs-and-pilasters',
      position: [37, 30, 49],
      lookAt: [2, 15, 2],
      fov: 48,
    },
    {
      name: 'rear-sanctuary-and-roof-connections',
      position: [52, 30, -31],
      lookAt: [9, 17, 0],
      fov: 48,
    },
  ],
};
