/** Present Concepcion Cathedral: rounded pylons, monumental glazed arch and crossing lantern. */
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
  '../../../content/worldgen/source/places/63/63k/cathedral_of_the_most_holy_conception/',
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
  wall: '#bfc2b9',
  trim: '#ccd0c5',
  roof: '#858e8b',
  foundation: '#aaa995',
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
const footing = (p) => Math.min(floor - 0.3, concepcionGround(...toNative2(p)) - 0.35);
export function concepcionGround(x, z) {
  const c = Math.cos(fit.heading),
    s = Math.sin(fit.heading);
  [x, z] = [x * c + z * s, -x * s + z * c];
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw Error('Concepcion Cathedral footing outside retained terrain');
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
const ac = Math.cos(rec.design.heading),
  as = Math.sin(rec.design.heading),
  toNative2 = ([u, v]) => [u * ac - v * as, u * as + v * ac + rec.design.origin[1]],
  rotate = ([u, v]) => [u * ac - v * as, u * as + v * ac],
  ring = (r, d) => simplify(r, d ? 0.05 : 0.28),
  dot2 = (p, a) => p[0] * a[0] + p[1] * a[1],
  R = rec.design.outline,
  H = rec.heights;
export const concepcionPoint = (u, y, v) => {
  const p = toNative2([u, v]);
  return [p[0], floor + y, p[1]];
};
function clip(r, axis, value, greater) {
  const result = [];
  let a = r.at(-1),
    av = dot2(a, axis) - value;
  for (const b of r) {
    const bv = dot2(b, axis) - value;
    if (av >= 0 !== bv >= 0) {
      const t = av / (av - bv);
      result.push(lerp(a, b, t));
    }
    if (greater ? bv >= 0 : bv <= 0) result.push(b);
    a = b;
    av = bv;
  }
  return result;
}
function roof(face, r, axis, eave, top, lean) {
  const cross = [-axis[1], axis[0]],
    vs = r.map((p) => dot2(p, cross)),
    lo = Math.min(...vs),
    hi = Math.max(...vs),
    mid = lean === 'high' ? hi : lean === 'low' ? lo : (lo + hi) / 2,
    y = (p) =>
      eave + (top - eave) * (1 - Math.abs((dot2(p, cross) - mid) / ((hi - lo) / (lean ? 1 : 2))));
  for (const greater of lean ? [true] : [false, true]) {
    const q = lean ? r : clip(r, cross, mid, greater);
    if (q.length >= 3) cap(face, q, (p) => floor + y(p), 'roof');
  }
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      pts = [
        a,
        ...((dot2(a, cross) - mid) * (dot2(b, cross) - mid) < 0
          ? [lerp(a, b, (mid - dot2(a, cross)) / (dot2(b, cross) - dot2(a, cross)))]
          : []),
        b,
      ];
    for (let j = 1; j < pts.length; j++) {
      const p = pts[j - 1],
        q = pts[j];
      face(
        'wall',
        [at(p, eave), at(q, eave), at(q, y(q)), at(p, y(p))],
        [(b[1] - a[1]) * sign(r), 0, (a[0] - b[0]) * sign(r)],
      );
    }
  }
}
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
    depth = 7,
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
  }),
  front = 33.4;
const portals = () =>
  [-8.15, 0, 8.15].map((v, i) =>
    hole(
      `front-portal-${i}`,
      [front, v],
      [0, 1],
      [1, 0],
      i === 1 ? 3.55 : 2.5,
      0.1,
      i === 1 ? 7.4 : 6.3,
      i === 1 ? 5.5 : 4.95,
      'round',
    ),
  );
const glazing = () => [
  hole('central-glazed-arch', [front, 0], [0, 1], [1, 0], 6.8, 9.2, 19.4, 14.9, 'round'),
  ...[-8.15, 8.15].map((v) =>
    hole(`side-glazed-arch-${v}`, [front, v], [0, 1], [1, 0], 2.65, 8.0, 13.55, 12.15, 'round'),
  ),
];
const slots = (d) =>
  Array.from({ length: d >= 3 ? 9 : d >= 2 ? 7 : 5 }, (_, i) => {
    const n = d >= 3 ? 9 : d >= 2 ? 7 : 5;
    return hole(
      `crown-slot-${i}`,
      [front, ((i - (n - 1) / 2) * 6.4) / n],
      [0, 1],
      [1, 0],
      d >= 3 ? 0.32 : 0.43,
      29.65,
      1.7,
    );
  });
const nativeOpening = (h) => ({
  ...h,
  center: toNative2(h.center),
  axis: rotate(h.axis),
  normal: rotate(h.normal),
});
export const concepcionPortals = () => portals().map(nativeOpening),
  concepcionGlazing = () => glazing().map(nativeOpening),
  concepcionCrownSlots = (d = 3) => slots(d).map(nativeOpening);
const oct = () => {
  const p = [-8.4, 0],
    a = 7,
    b = 5.4;
  return [
    [p[0] - b, -a],
    [p[0] + b, -a],
    [p[0] + a, -b],
    [p[0] + a, b],
    [p[0] + b, a],
    [p[0] - b, a],
    [p[0] - a, b],
    [p[0] - a, -b],
  ];
};
function lanternOpenings() {
  const a = [],
    r = oct();
  for (let i = 0; i < 8; i++) {
    const f = faceFrame(r, i),
      n = f.length > 5 ? 3 : 1,
      w = f.length > 5 ? 1.5 : 0.85;
    for (let j = 0; j < n; j++)
      a.push(
        hole(
          `lantern-${i}-${j}`,
          lerp(f.a, f.b, 0.5).map((v, k) => v + f.axis[k] * (j - (n - 1) / 2) * (w + 0.5)),
          f.axis,
          f.normal,
          w,
          27.8,
          2.2,
          1.55,
          'round',
          4.6,
        ),
      );
  }
  return a;
}
export const concepcionLantern = () => lanternOpenings().map(nativeOpening);
function window(face, h, d, actual = false, slot = 'glass') {
  pane(face, h, d, actual ? -0.85 : 0.04, slot);
  if (d >= 2) archBand(face, h, d, 0.16, 'trim', 0.1);
}
const linear = (h) =>
    h.match(/../g).map((n) => {
      const x = parseInt(n, 16) / 255;
      return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
    }),
  gold = linear('b18c60'),
  flute = linear('8d938f');
function crown(face) {
  const points = [
    [-4.4, 31.1],
    [-2.8, 31.65],
    [0, 32.4],
    [2.8, 31.65],
    [4.4, 31.1],
  ];
  for (const u of [30.0, front])
    face(
      'wall',
      [
        [u, floor + 30.9, -4.4],
        ...points.map(([v, y]) => [u, floor + y, v]),
        [u, floor + 30.9, 4.4],
      ],
      [u > 32 ? 1 : -1, 0, 0],
    );
  for (let i = 1; i < points.length; i++) {
    const [a, y] = points[i - 1],
      [b, t] = points[i];
    face(
      'trim',
      [
        [30, floor + y, a],
        [front, floor + y, a],
        [front, floor + t, b],
        [30, floor + t, b],
      ],
      [0, 1, 0],
    );
  }
}
function pylon(face, v, d) {
  const n = d >= 3 ? 12 : d >= 2 ? 8 : d ? 6 : 4,
    r = 1.15,
    q = [
      [32.2, v - r],
      ...Array.from({ length: n + 1 }, (_, i) => {
        const a = -Math.PI / 2 + (i * Math.PI) / n;
        return [33 + r * Math.cos(a), v + r * Math.sin(a)];
      }),
      [32.2, v + r],
    ];
  solid(face, q, 0, H.pylon, 'wall');
  for (const y of d ? [5.5, 11.1, 16.7, 22.3, 27.6, 31.3] : [11.1, 22.3, 31.3])
    profile(
      face,
      q,
      [
        [y, 1],
        [y + 0.13, 1.045],
        [y + 0.26, 1.045],
      ],
      'trim',
    );
  if (d >= 2)
    for (const dv of [-0.45, 0, 0.45]) {
      const u = 33 + Math.sqrt(r * r - dv * dv) + 0.035;
      face(
        'glass',
        [
          [u, floor + 29.5, v + dv - 0.07],
          [u, floor + 30.65, v + dv - 0.07],
          [u, floor + 30.65, v + dv + 0.07],
          [u, floor + 29.5, v + dv + 0.07],
        ],
        [1, 0, 0],
      );
      if (d >= 3)
        for (const y of [1, 6, 11.7, 17.3, 22.9])
          face(
            'trim',
            [
              [u, floor + y, v + dv - 0.045],
              [u, floor + y + 4.1, v + dv - 0.045],
              [u, floor + y + 4.1, v + dv + 0.045],
              [u, floor + y, v + dv + 0.045],
            ],
            [1, 0, 0],
            flute,
          );
    }
}
function facade(out, face, d) {
  const hs = [...portals(), ...glazing(), ...(d >= 2 ? slots(d) : [])],
    cut = d
      ? masked(
          out,
          hs.map((h) => prepareOpening(h, 0, d === 2 ? 1 : d)),
        )
      : out,
    f = writer(cut, d);
  const lower = rect([31.7, 0], 3.4, 22.2),
    upper = rect([31.7, 0], 3.4, 8.8);
  shell(out, d, lower, 0, H.frontSide, d ? hs : [], 'wall');
  cap(f, lower, H.frontSide, 'wall');
  shell(out, d, upper, H.frontSide, 30.95, d ? hs : [], 'wall');
  cap(f, upper, 30.95, 'wall');
  crown(f);
  for (const v of [-4.65, 4.65]) pylon(f, v, d);
  if (!d) {
    for (const h of glazing()) pane(face, h, d, 0.04);
    return;
  }
  for (const h of portals()) {
    pane(face, h, d, -1.5, 'door');
    archBand(face, h, d, 0.5, 'trim', 0.18);
    const u = front - 1.44,
      r = h.width / 2;
    face(
      'trim',
      Array.from({ length: d >= 2 ? 9 : 5 }, (_, i) => {
        const a = (i * Math.PI) / (d >= 2 ? 8 : 4);
        return [
          u,
          floor + (h.name.endsWith('1') ? 5.5 : 4.95) + Math.sin(a) * (h.height - h.spring),
          h.center[1] + Math.cos(a) * r,
        ];
      }),
      [1, 0, 0],
      gold,
    );
  }
  for (const h of glazing()) {
    window(face, h, d, true);
    archBand(face, h, d, 0.5, 'trim', 0.05);
    if (d >= 2) archBand(face, h, d, 0.25, 'trim', -0.25);
  }
  if (d === 1) for (const h of slots(d)) pane(face, h, d, 0.05);
  const u = front - 0.65,
    rr = d >= 3 ? 24 : 16,
    cy = 25.1,
    r = 2.42;
  for (let i = 0; i < rr; i++) {
    const a = (i * 2 * Math.PI) / rr,
      b = ((i + 1) * 2 * Math.PI) / rr;
    face(
      'trim',
      [
        [u, floor + cy + r * Math.sin(a), r * Math.cos(a)],
        [u, floor + cy + r * Math.sin(b), r * Math.cos(b)],
        [u, floor + cy + (r + 0.16) * Math.sin(b), (r + 0.16) * Math.cos(b)],
        [u, floor + cy + (r + 0.16) * Math.sin(a), (r + 0.16) * Math.cos(a)],
      ],
      [1, 0, 0],
    );
  }
  const count = d >= 3 ? 16 : d >= 2 ? 12 : 8;
  for (let i = 0; i < count; i++) {
    const a = (i * 2 * Math.PI) / count;
    beam(
      face,
      [u, floor + cy + 0.3 * Math.sin(a), 0.3 * Math.cos(a)],
      [u, floor + cy + (r - 0.08) * Math.sin(a), (r - 0.08) * Math.cos(a)],
      0.14,
      'trim',
    );
  }
  for (const v of d >= 2 ? [-2.4, -1.2, 0, 1.2, 2.4] : [-1.8, 0, 1.8])
    beam(face, [u, floor + 9.55, v], [u, floor + 22.35, v], d >= 2 ? 0.16 : 0.24, 'trim');
  for (const y of d >= 2 ? [13.8, 18.2, 22.3] : [18.2, 22.3])
    beam(face, [u, floor + y, -2.9], [u, floor + y, 2.9], 0.17, 'trim');
  for (const v of [-8.15, 8.15]) beam(face, [u, floor + 8.3, v], [u, floor + 20, v], 0.16, 'trim');
  for (const v of [-11.0, 11.0]) solid(face, rect([32.95, v], 0.65, 0.55), 0, H.frontSide, 'trim');
}
function backAndRoofs(out, face, d) {
  const r = ring(R, d),
    lower = clip(clip(r, [1, 0], -23, true), [1, 0], 30, false);
  sides(face, r, footing, 0, 'foundation');
  cap(face, r, 0, 'foundation');
  shell(out, d, lower, 0, H.lower, [], 'wall');
  const core = rect([4, 0], 54, 8.8);
  shell(out, d, core, H.lower, H.naveEave, [], 'wall');
  roof(face, core, [1, 0], H.naveEave, H.naveRoof);
  for (const side of [-1, 1]) {
    let q = clip(
      clip(clip(r, [1, 0], -23, true), [1, 0], 31.2, false),
      [0, 1],
      side * 4.4,
      side > 0,
    );
    q = clip(q, [0, 1], side * 11.35, side < 0);
    sides(face, q, 0, H.aisleEave, 'wall');
    roof(face, q, [1, 0], H.aisleEave, H.aisleRoof, side > 0 ? 'low' : 'high');
    let a = clip(clip(r, [1, 0], -17, true), [1, 0], 0.5, false);
    a = clip(a, [0, 1], side * 10.8, side > 0);
    if (a.length >= 3) {
      sides(face, a, 0, 21.4, 'wall');
      roof(face, a, [0, 1], 21.4, 25);
    }
  }
  const apse = clip(r, [1, 0], -23, false);
  sides(face, apse, 0, H.apseEave, 'wall');
  for (let i = 0; i < apse.length; i++) {
    const a = apse[i],
      b = apse[(i + 1) % apse.length];
    if (a[0] > -23.02 && b[0] > -23.02) continue;
    face('roof', [at(a, H.apseEave), at(b, H.apseEave), at([-23, 0], H.apseRoof)], [0, 1, 0]);
  }
  if (d) band(face, apse, H.apseEave - 0.25, 0.22, 'trim', 1.01);
  if (d) {
    for (let i = 0; i < r.length; i++) {
      const g = faceFrame(r, i);
      if (Math.abs(g.normal[1]) < 0.9 || g.length < 20) continue;
      const n = Math.floor(g.length / 6);
      for (let j = 0; j < n; j++)
        window(
          face,
          hole(
            'side-window',
            lerp(g.a, g.b, (j + 0.5) / n),
            g.axis,
            g.normal,
            1.45,
            6.3,
            4.1,
            3.25,
            'round',
          ),
          d,
        );
    }
    for (const side of [-1, 1])
      for (const u of [-17, -7, 3, 13, 23])
        window(
          face,
          hole('clerestory', [u, side * 4.4], [1, 0], [0, side], 1.15, 20, 3.0, 2.4, 'round'),
          d,
        );
    for (let i = 0; i < apse.length; i++) {
      const g = faceFrame(apse, i);
      if (g.normal[0] > -0.2 || g.length < 1.5) continue;
      window(
        face,
        hole('apse-window', lerp(g.a, g.b, 0.5), g.axis, g.normal, 1.1, 8.0, 5.0, 4.4, 'round'),
        d,
      );
    }
  }
}
function lantern(out, face, d) {
  const r = oct(),
    holes = lanternOpenings();
  solid(face, scaled(r, 1.025), 26.4, 27.4, 'trim');
  if (d >= 2) shell(out, d, r, 27.4, H.lanternEave, holes, 'wall', scaled(r, 0.7));
  else {
    solid(face, r, 27.4, H.lanternEave, 'wall');
    if (d) for (const h of holes) window(face, h, d);
  }
  cap(face, r, 27.4, 'wall');
  profile(
    face,
    r,
    [
      [H.lanternEave, 1.045],
      [H.lanternRoof, 0.03],
    ],
    'roof',
  );
  if (d) band(face, r, H.lanternEave - 0.1, 0.24, 'trim', 1.035);
}
function figure(face, d) {
  const p = [32.4, 0];
  solid(face, rect(p, 1.05, 1.05), 32.25, 32.85, 'trim');
  if (!d) {
    solid(face, rect(p, 0.45, 0.45), 32.85, 35, 'trim');
    return;
  }
  profile(
    face,
    regular(p, 0.52, d >= 3 ? 8 : 6),
    [
      [32.85, 1],
      [34.25, 0.52],
    ],
    'trim',
  );
  solid(face, regular(p, 0.24, d >= 3 ? 8 : 6), 34.25, 34.5, 'trim');
  const n = d >= 3 ? 8 : 6,
    r = regular(p, 0.25, n);
  profile(
    face,
    r,
    [
      [34.5, 0.7],
      [34.75, 1],
      [35, 0],
    ],
    'trim',
  );
  if (d >= 2) {
    beam(face, [32.4, floor + 34.05, -0.18], [32.4, floor + 33.72, -0.82], 0.2, 'trim');
    beam(face, [32.4, floor + 34.05, 0.18], [32.4, floor + 34.3, 0.65], 0.2, 'trim');
  }
}
function build(out, d) {
  const stable = {
      addTriangle(slot, ref, points, _n, uv, color) {
        const p = points.map((v) => {
          const q = toNative2([v[0], v[2]]);
          return [q[0], v[1], q[1]].map(Math.fround);
        });
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
    },
    face = writer(stable, d);
  backAndRoofs(stable, face, d);
  facade(stable, face, d);
  lantern(stable, face, d);
  figure(face, d);
  if (d) {
    solid(face, rect([33.95, 0], 1.6, 22.8), footing, 0, 'foundation');
    for (let i = 0; i < 5; i++)
      solid(face, rect([34.5 + i * 0.6, 0], 0.62, 22.8), footing, -0.12 * i, 'foundation');
  }
}
export const buildConcepcionSkyline = (o) => build(o, 0),
  buildConcepcionDistrict = (o) => build(o, 1),
  buildConcepcionStreet = (o) => build(o, 2),
  buildConcepcionCloseup = (o) => build(o, 3);
export const concepcionStudy = {
  id: 'cathedral_of_the_most_holy_conception',
  key: 'cathedral_of_the_most_holy_conception',
  title: 'Cathedral of the Most Holy Conception',
  category: 'cathedral',
  wikidataId: 'Q210869',
  generationCommand: 'node packages/worldgen/scripts/generate-additional-landmarks.mjs',
  mapFrame: 'map-frame.json',
  fidelityTarget: 'medium-fi',
  build: (o) => build(o, 4),
  surfaceOverrides: scope.surfaceOverrides,
  brief:
    'Present Concepcion Cathedral:rounded banded front pylons,recessed monumental glazed arch/rose over vertical glazing,three closed doors/warm lunettes,tall side arches,upper crown slots,grey metal nave/aisles,low faceted crossing lantern,rounded rear apse/transverse arms and selected roofline figure.',
  sourceFacts: {
    horizontalBasis:
      'Retained exact-QID way124858478 and current35m parent;rounded rear apse versus plaza-facing front pylons,without rescaling.',
    architecturalHeights: rec.heightBasis,
  },
  reconstruction: rec,
  scaleBasis:
    'Approximately69x38m mapped cathedral with35m overall height. Internal long body retains2.47degree skew in the source frame;all roof/opening/figure subdivisions are picture-led approximations.',
  refs: read('reference-metadata.json').currentRoundInspection.pictures.map((p) => p.page),
  nativeAxes: frame.nativeAxes,
  sourceDocuments: scope.sourceDocuments,
  sourceLicense:
    'Original geometry under repository license;map geometry ©OpenStreetMap contributors,ODbL-1.0. Linked photographs not redistributed.',
  dataAttribution: '©OpenStreetMap contributors;Protomaps;Mapzen/USGS terrain tiles.',
  sourceNotice:
    'Four existing256-square concrete,standing-seam metal,weathered limestone and wood graphs;grey concrete/trim share one graph. Warm lunette fields and fluting are vertex tints,not unique images. Metric UVs,linear colors,flat glazing,no embedded images.',
  importReason:
    'Four authored browser levels preserve present rounded-pylon/arched-glazing silhouette,rounded rear and crossing lantern at signed Concepcion placement.',
  previewGround: false,
  previewTerrain: scope.previewTerrain,
  mediumFiContext: scope.mediumFiContext,
  geographic: () => scope.geographic,
  geographicNote: scope.geographicNote,
  limitations: [
    rec.heightBasis,
    scope.geographicNote,
    'Crossing lantern,rear/side openings,roof divisions,front steps,warm lunette fields and faceted roofline figure are exterior approximations. Exact statue/mosaic figures,full interiors,adjacent civic/office wings,plaza and certified walking excluded. Physical phone/laptop timings pending.',
    'Skyline retains rounded pylons,central glazed arch,stepped facade/aisles,rounded apse,crossing lantern and simple roof finial with mean roof tints. District adds shared graphs,closed recessed doors/glazing and selected rose/mullions. Street adds actual crown/lantern slots,selected bands and coarse figure arms;closeup refines arch/pylon facets,rose spokes and fluting. Detail changes remain visible.',
  ],
  camera: scope.camera,
  qaCameras: [
    {
      name: 'rounded-pylons-and-monumental-front',
      position: [91, 29, 8],
      lookAt: [32, 17, 3],
      fov: 43,
    },
    {
      name: 'three-portals-and-warm-lunettes',
      position: [52, 9, 6],
      lookAt: [34, 5.5, 3],
      fov: 55,
    },
    {
      name: 'central-rose-and-vertical-glazing',
      position: [53, 23, 6],
      lookAt: [34, 20, 3],
      fov: 43,
    },
    {
      name: 'crown-slots-and-rounded-pylon-bands',
      position: [53, 35, 19],
      lookAt: [33, 28, 4],
      fov: 48,
    },
    {
      name: 'faceted-crossing-lantern-and-transverse-arms',
      position: [-41, 44, 37],
      lookAt: [-8, 27, 2],
      fov: 48,
    },
    {
      name: 'rounded-rear-apse-and-side-roofs',
      position: [-69, 28, -26],
      lookAt: [-19, 13, 1],
      fov: 48,
    },
  ],
};
