/** Monreale: unequal towers, three decorated apses, galleries and an open cloister complex. */
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
  '../../../content/worldgen/source/places/sq/sqc/n0349_cattedrale_di_monreale/',
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
  wall: '#c0a780',
  trim: '#d8ceba',
  tile: '#9e684e',
  green: '#64887c',
  door: '#725438',
  dark: '#72634f',
  court: '#a7a08b',
  garden: '#71884a',
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
const footing = (p) => Math.min(floor - 0.3, monrealeGround(...p) - 0.35);
export function monrealeGround(x, z) {
  const c = Math.cos(fit.heading),
    s = Math.sin(fit.heading);
  [x, z] = [x * c + z * s, -x * s + z * c];
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw Error('Monreale cathedral footing outside retained terrain');
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
const O = rec.cathedralCenter,
  P = ([x, z]) => [x + O[0], z + O[1]],
  R = (x0, z0, x1, z1) =>
    [
      [x0, z0],
      [x1, z0],
      [x1, z1],
      [x0, z1],
    ].map(P),
  rawRole = (n) => rec.controls.find((b) => b.id === rec.roles[n]).polygons[0];
const hole = (
  name,
  p,
  a,
  n,
  width,
  bottom,
  height,
  spring = height,
  shape = 'rect',
  depth = 5,
) => ({
  name,
  center: p,
  axis: a,
  normal: n,
  width,
  bottom: floor + bottom,
  height,
  spring,
  shape,
  depth,
});
export const monrealePortal = () =>
  hole('closed-main-portal', P([-42, -2]), [0, 1], [-1, 0], 4.7, 0.1, 8.5, 6.2, 'round', 8);
export const monrealeFrontWindow = () =>
  hole('front-upper-window', P([-42, -2]), [0, 1], [-1, 0], 4.6, 15.2, 8.0, 5.4, 'pointed', 8);
export function monrealeWindows() {
  const hs = [];
  for (const [side, z] of [
    [-1, -11],
    [1, 7],
  ])
    for (const x of [-34, -28, -22, -16, -10, -4, 2])
      hs.push(
        hole(`nave-${side}-${x}`, P([x, z]), [1, 0], [0, side], 1.35, 18, 4.0, 2.8, 'pointed', 4),
      );
  for (const [side, z] of [
    [-1, -11],
    [1, 7],
  ])
    for (const x of [14, 20, 26, 32])
      hs.push(
        hole(
          `sanctuary-${side}-${x}`,
          P([x, z]),
          [1, 0],
          [0, side],
          1.6,
          26.0,
          5.0,
          3.6,
          'pointed',
          4,
        ),
      );
  return hs;
}
const southTower = () => R(-48, 10, -39.3, 21.5),
  northTower = () => R(-48, -22, -39.6, -12.2);
export function monrealeBelfries() {
  const r = southTower();
  return r.flatMap((_, i) => {
    const f = faceFrame(r, i),
      p = lerp(f.a, f.b, 0.5);
    return [
      hole(`south-lower-bell-${i}`, p, f.axis, f.normal, 3.1, 27.1, 5.1, 3.6, 'round', 7),
      ...[-1, 1].map((v) =>
        hole(
          `south-upper-paired-bell-${i}-${v}`,
          p.map((p, k) => p + f.axis[k] * v * 1.35),
          f.axis,
          f.normal,
          1.7,
          33.6,
          4.7,
          3.2,
          'pointed',
          7,
        ),
      ),
    ];
  });
}
function panel(face, h, d, recess = false, slot = 'glass') {
  pane(face, h, d, recess ? -1.35 : 0.08, slot);
  if (d) archBand(face, h, d, 0.27, 'trim', 0.15);
  if (d >= 2 && slot === 'glass') {
    const p = h.center.map((v, k) => v + h.normal[k] * (recess ? -1.15 : 0.2));
    beam(face, [p[0], h.bottom + 0.15, p[1]], [p[0], h.bottom + h.spring - 0.15, p[1]], 0.1);
  }
}
function hip(face, r, eave, top, slot = 'tile', axis = 0) {
  const k = 1 - axis,
    vs = r.map((p) => p[k]),
    xs = r.map((p) => p[axis]),
    mid = (Math.min(...vs) + Math.max(...vs)) / 2,
    rad = (Math.max(...vs) - Math.min(...vs)) / 2,
    lo = Math.min(...xs) + rad,
    hi = Math.max(...xs) - rad,
    point = (p) => {
      const q = [...p];
      q[k] = mid;
      q[axis] = lo <= hi ? Math.max(lo, Math.min(hi, p[axis])) : (lo + hi) / 2;
      return q;
    };
  for (let i = 0; i < r.length; i++) {
    const j = (i + 1) % r.length;
    face(
      slot,
      [at(r[i], eave), at(r[j], eave), at(point(r[j]), top), at(point(r[i]), top)],
      [0, 1, 0],
    );
  }
}
function gable(face, r, eave, top, slot = 'tile') {
  const zs = r.map((p) => p[1]),
    mid = (Math.min(...zs) + Math.max(...zs)) / 2,
    half = (Math.max(...zs) - Math.min(...zs)) / 2,
    y = (p) => eave + (top - eave) * (1 - Math.abs((p[1] - mid) / half));
  const clip = (r, gt) => {
    const q = [];
    let a = r.at(-1),
      va = a[1] - mid;
    for (const b of r) {
      const vb = b[1] - mid;
      if (va >= 0 !== vb >= 0) q.push(lerp(a, b, va / (va - vb)));
      if (gt ? vb >= 0 : vb <= 0) q.push(b);
      a = b;
      va = vb;
    }
    return q;
  };
  for (const gt of [false, true]) cap(face, clip(r, gt), (p) => floor + y(p), slot);
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      ps = [
        a,
        ...((a[1] - mid) * (b[1] - mid) < 0 ? [lerp(a, b, (mid - a[1]) / (b[1] - a[1]))] : []),
        b,
      ];
    for (let j = 1; j < ps.length; j++)
      face(
        'wall',
        [at(ps[j - 1], eave), at(ps[j], eave), at(ps[j], y(ps[j])), at(ps[j - 1], y(ps[j - 1]))],
        [(b[1] - a[1]) * sign(r), 0, (a[0] - b[0]) * sign(r)],
      );
  }
}
function row(
  name,
  a,
  b,
  n,
  height,
  top,
  widthFraction = 0.88,
  pair = false,
  slot = 'trim',
  normal = null,
) {
  a = P(a);
  b = P(b);
  const axis = unit(b.map((v, k) => v - a[k])),
    N = normal ?? [axis[1], -axis[0]];
  return { name, a, b, n, height, top, widthFraction, pair, slot, axis, normal: N };
}
export function monrealeArcadeRows(d = 3) {
  const rows = [
    row('west-portico', [-48, -12.5], [-48, 10.5], 3, 8.5, 9.9, 0.86, false, 'trim', [-1, 0]),
    row('north-gallery', [-39, -22.1], [7, -22.1], 11, 7.4, 8.5, 0.88, false, 'trim', [0, -1]),
  ];
  if (d) {
    const r = rawRole('cloisterRoof').holes[0],
      count = d >= 4 ? 26 : d >= 3 ? 22 : d >= 2 ? 16 : 4;
    for (let i = 0; i < r.length; i++) {
      const a = r[i],
        b = r[(i + 1) % r.length],
        axis = unit(b.map((v, k) => v - a[k]));
      rows.push({
        name: `cloister-${i}`,
        a,
        b,
        n: count,
        height: 4.5,
        top: 6.2,
        widthFraction: 0.86,
        pair: d >= 2,
        slot: 'trim',
        axis,
        normal: [-axis[1], axis[0]],
      });
    }
  }
  return rows;
}
function arcade(face, r, d) {
  const len = Math.hypot(r.b[0] - r.a[0], r.b[1] - r.a[1]),
    span = len / r.n,
    width = span * r.widthFraction,
    spring = r.height - width * 0.42,
    segments = d >= 3 ? 12 : d >= 2 ? 6 : d ? 4 : 2,
    thick = r.pair ? 0.65 : 0.85,
    pt = (u, y, v = 0) => [
      r.a[0] + r.axis[0] * u + r.normal[0] * v,
      floor + y,
      r.a[1] + r.axis[1] * u + r.normal[1] * v,
    ];
  for (let j = 0; j < r.n; j++) {
    const cx = (j + 0.5) * span,
      arch = Array.from({ length: segments + 1 }, (_, i) => {
        const a = Math.PI - (i * Math.PI) / segments;
        return [cx + (Math.cos(a) * width) / 2, spring + Math.sin(a) * (r.height - spring)];
      });
    for (let i = 1; i < arch.length; i++) {
      const [a, y] = arch[i - 1],
        [b, z] = arch[i];
      for (const v of [-thick / 2, thick / 2])
        face(
          r.slot,
          [pt(a, y, v), pt(b, z, v), pt(b, r.top, v), pt(a, r.top, v)],
          [r.normal[0] * Math.sign(v), 0, r.normal[1] * Math.sign(v)],
        );
      face(r.slot, [
        pt(a, y, -thick / 2),
        pt(a, y, thick / 2),
        pt(b, z, thick / 2),
        pt(b, z, -thick / 2),
      ]);
    }
    const left = cx - width / 2,
      right = cx + width / 2;
    for (const [u, v] of [
      [j * span, left],
      [right, (j + 1) * span],
    ])
      for (const off of [-thick / 2, thick / 2])
        face(
          r.slot,
          [pt(u, spring, off), pt(v, spring, off), pt(v, r.top, off), pt(u, r.top, off)],
          [r.normal[0] * Math.sign(off), 0, r.normal[1] * Math.sign(off)],
        );
  }
  for (let j = 0; j <= r.n; j++) {
    const u = j * span,
      rad = r.name.startsWith('cloister')
        ? d >= 2
          ? 0.12
          : 0.23
        : r.name === 'west-portico'
          ? 0.48
          : 0.3;
    for (const off of r.pair ? [-0.2, 0.2] : [0]) {
      const p = [
          r.a[0] + r.axis[0] * u + r.normal[0] * off,
          r.a[1] + r.axis[1] * u + r.normal[1] * off,
        ],
        n = d >= 3 ? 8 : d >= 2 ? 4 : d ? 4 : 4;
      profile(
        face,
        regular(p, rad, n),
        d >= 3
          ? [
              [0, 1.35],
              [0.25, 1.3],
              [0.4, 1],
              [spring - 0.35, 0.9],
              [spring - 0.15, 1.35],
              [spring, 1.35],
            ]
          : [
              [0, 1],
              [spring, 1],
            ],
        r.slot,
      );
    }
  }
}
function rail(face, r, y, d) {
  if (!d) return;
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length];
    if (d >= 2) beam(face, at(a, y + 1.1), at(b, y + 1.1), 0.18);
    else sides(face, [a, b], y + 1, y + 1.15, 'trim');
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]),
      n = d >= 3 ? Math.ceil(len / 0.65) : d >= 2 ? Math.ceil(len / 1.3) : Math.ceil(len / 6);
    for (let j = 0; j < n; j++)
      solid(face, rect(lerp(a, b, (j + 0.5) / n), 0.13, 0.13), y, y + 1.05, 'trim');
  }
}
function medallion(face, p, normal, axis, y, r, d, slot = 'dark') {
  const n = d >= 3 ? 20 : d >= 2 ? 12 : 8;
  face(
    slot,
    Array.from({ length: n }, (_, i) => {
      const a = (i * 2 * Math.PI) / n;
      return [
        p[0] + axis[0] * r * Math.cos(a) + normal[0] * 0.12,
        floor + y + r * Math.sin(a),
        p[1] + axis[1] * r * Math.cos(a) + normal[1] * 0.12,
      ];
    }),
    [normal[0], 0, normal[1]],
  );
}
function front(out, face, d) {
  const r = R(-42, -12.2, -38.7, 10.2),
    holes = [monrealePortal(), monrealeFrontWindow()];
  if (d >= 2) shell(out, d, r, 0, 24.2, holes, 'wall');
  else solid(face, r, 0, 24.2, 'wall');
  for (const h of holes) panel(face, h, d, d >= 2, h.name.startsWith('closed') ? 'door' : 'glass');
  const roof = [
    [-12.2, 24.2],
    [-2, 29],
    [10.2, 24.2],
  ];
  for (const x of [-42, -38.7])
    face(
      'wall',
      roof.map(([z, y]) => at(P([x, z]), y)),
      [x === -42 ? -1 : 1, 0, 0],
    );
  for (let i = 1; i < roof.length; i++)
    face(
      'tile',
      [
        at(P([-42, roof[i - 1][0]]), roof[i - 1][1]),
        at(P([-38.7, roof[i - 1][0]]), roof[i - 1][1]),
        at(P([-38.7, roof[i][0]]), roof[i][1]),
        at(P([-42, roof[i][0]]), roof[i][1]),
      ],
      [0, 1, 0],
    );
  if (d) {
    for (const z of [-10, -6, 2, 6]) {
      const h = hole(
        'blind-front-band',
        P([-42, z]),
        [0, 1],
        [-1, 0],
        4.1,
        14.2,
        9.8,
        5.7,
        'pointed',
      );
      archBand(face, h, d, 0.18, 'dark', 0.12);
    }
    for (const z of [-6.8, 2.8]) medallion(face, P([-42, z]), [-1, 0], [0, 1], 25.1, 0.65, d);
  }
  const porch = R(-48, -12.5, -41.8, 10.5);
  solid(face, porch, footing, 0, 'court');
  solid(face, porch, 9.9, 10.5, 'trim');
  rail(face, porch, 10.5, d);
  if (d) arcade(face, monrealeArcadeRows(d)[0], d);
  else
    for (const z of [-12.5, -4.83, 2.83, 10.5])
      solid(face, rect(P([-48, z]), 0.7, 0.7), 0, 9.9, 'trim');
}
function body(out, face, d) {
  const r = rec.main.polygons[0].outline,
    windows = monrealeWindows();
  sides(face, r, footing, 0, 'wall');
  if (d) cap(face, r, 0, 'court');
  const nave = R(-40, -11, 10, 7),
    sanctuary = R(10, -11, 35.5, 7);
  for (const [plan, b, t, hs] of [
    [nave, 0, 24, windows.filter((h) => h.name.startsWith('nave'))],
    [sanctuary, 0, 33, windows.filter((h) => h.name.startsWith('sanctuary'))],
  ]) {
    if (d >= 2) shell(out, d, plan, b, t, hs, 'wall');
    else solid(face, plan, b, t, 'wall');
  }
  gable(face, nave, 24, 29);
  gable(face, sanctuary, 33, 37);
  for (const [plan, eave, top, slot] of [
    [R(-40, -16, 10, -11), 13.5, 15, 'tile'],
    [R(-40, 7, 9, 20), 13.5, 16, 'tile'],
    [R(9, -21.7, 35.5, -11), 21, 26, 'green'],
    [R(9, 7, 38.5, 22), 21, 26, 'green'],
  ]) {
    solid(face, plan, 0, eave, 'wall');
    hip(face, plan, eave, top, slot, 0);
  }
  const gallery = R(-39, -22.1, 7, -16);
  const y = (p) => floor + 8.7 + ((p[1] - (O[1] - 22.1)) / 6.1) * 5.0;
  cap(face, gallery, y, 'green');
  solid(face, R(-39, -22.3, 7, -21.9), 8.45, 8.75, 'trim');
  if (d) arcade(face, monrealeArcadeRows(d)[1], d);
  else for (const x of [-39, 7]) solid(face, rect(P([x, -22.1]), 0.6, 0.6), 0, 8.5, 'trim');
  if (d) {
    for (const h of windows) panel(face, h, d, d >= 2);
    for (const y of [15.8, 23.5]) band(face, nave, y, 0.25, 'trim', 1.01);
    for (const y of [26.1, 32.3]) band(face, sanctuary, y, 0.3, 'trim', 1.01);
    for (const f of sanctuary.map((_, i) => faceFrame(sanctuary, i))) {
      const n = d >= 3 ? 7 : d >= 2 ? 4 : 2;
      for (let i = 0; i < n; i++) {
        const p = lerp(f.a, f.b, (i + 0.5) / n);
        profile(
          face,
          regular(p, d >= 2 ? 0.24 : 0.35, d >= 3 ? 8 : 4),
          [
            [33, 1.2],
            [33.6, 1],
            [35.0, 0.1],
          ],
          'trim',
        );
      }
    }
  }
}
function towers(out, face, d) {
  const north = northTower(),
    south = southTower();
  solid(face, north, 0, 25, 'wall');
  solid(face, south, 0, 26.5, 'wall');
  if (d >= 2) {
    const hs = monrealeBelfries();
    shell(out, d, south, 26.5, 38.5, hs, 'wall', scaled(south, 0.55));
    cap(face, south, 26.5, 'wall');
    cap(face, south, 33.0, 'wall');
    for (const h of hs) archBand(face, h, d, 0.25, 'trim', 0.14);
  } else {
    solid(face, south, 26.5, 38.5, 'wall');
    if (d) for (const h of monrealeBelfries()) pane(face, h, d, 0.08);
  }
  solid(face, scaled(south, 1.025), 38.5, 39, 'trim');
  for (const [r, top] of [
    [north, 25],
    [south, 39],
  ]) {
    if (d) {
      for (const y of [0.3, 8.5, 15.0, top - 0.8]) band(face, r, y, 0.3, 'trim', 1.025);
    }
    const n = d >= 2 ? 4 : 2;
    for (let i = 0; i < r.length; i++) {
      const f = faceFrame(r, i);
      if (!d && i) continue;
      for (let j = 0; j < (d ? n : 1); j++) {
        const p = lerp(f.a, f.b, (j + 0.5) / (d ? n : 1));
        solid(face, rect(p, 0.55, 0.55), top, top + 0.5, 'wall');
      }
    }
  }
  if (d) {
    const p = P([-48, -17.2]);
    medallion(face, p, [-1, 0], [0, 1], 20.7, 1.4, d, 'trim');
    beam(face, [p[0] - 0.2, floor + 20.7, p[1]], [p[0] - 0.2, floor + 21.7, p[1]], 0.1, 'dark');
    beam(
      face,
      [p[0] - 0.2, floor + 20.7, p[1]],
      [p[0] - 0.2, floor + 20.4, p[1] - 0.8],
      0.1,
      'dark',
    );
    for (const y of [8.5, 15.7])
      panel(
        face,
        hole('north-tower-slit', P([-48, -17.2]), [0, 1], [-1, 0], 0.85, y, 2.6, 1.7, 'round'),
        d,
      );
  }
}
const apses = [
  { name: 'central', p: [40.8, -3.7], r: 7.25, h: 29 },
  { name: 'north', p: [31, -16], r: 4.7, h: 20.5 },
  { name: 'south', p: [34.3, 13.5], r: 4.7, h: 20.5 },
];
export const monrealeApsePlans = () => apses.map((a) => ({ ...a, p: P(a.p) }));
function apseDecoration(face, a, d) {
  const p = P(a.p),
    point = (angle, u, y, off = 0.06) => {
      const t = angle + u / a.r;
      return [p[0] + (a.r + off) * Math.cos(t), floor + y, p[1] + (a.r + off) * Math.sin(t)];
    };
  const count =
      d >= 3 ? (a.name === 'central' ? 7 : 5) : d >= 2 ? (a.name === 'central' ? 5 : 4) : 2,
    tiers =
      a.name === 'central' && d >= 2
        ? [
            [3, 18.6],
            [19.5, 27.8],
          ]
        : [[3, a.h - 1.2]];
  for (const [b, t] of tiers)
    for (let j = 0; j < count; j++) {
      const theta = -Math.PI / 2 + ((j + 0.5) * Math.PI) / count,
        direction = [Math.cos(theta), 0, Math.sin(theta)],
        width = ((a.r * Math.PI) / count) * 0.9,
        spring = b + (t - b) * 0.6,
        n = d >= 3 ? 12 : d >= 2 ? 8 : 4,
        arch = Array.from({ length: n + 1 }, (_, i) => {
          const x = -width / 2 + (i * width) / n,
            v = 1 - Math.abs((2 * i) / n - 1);
          return [x, spring + (t - spring) * v];
        });
      for (let i = 1; i < arch.length; i++) {
        const [u, y] = arch[i - 1],
          [v, z] = arch[i];
        face(
          'dark',
          [
            point(theta, u, y),
            point(theta, v, z),
            point(theta, v, z + 0.2),
            point(theta, u, y + 0.2),
          ],
          direction,
        );
      }
      for (const u of [-width / 2, width / 2])
        face(
          'trim',
          [
            point(theta, u - 0.12, b),
            point(theta, u + 0.12, b),
            point(theta, u + 0.12, spring),
            point(theta, u - 0.12, spring),
          ],
          direction,
        );
      for (const yy of [b + (spring - b) * 0.35, b + (spring - b) * 0.72]) {
        const n = d >= 3 ? 16 : 8,
          rad = Math.min(width * 0.22, 0.8);
        face(
          'dark',
          Array.from({ length: n }, (_, i) => {
            const q = (i * 2 * Math.PI) / n;
            return point(theta, rad * Math.cos(q), yy + rad * Math.sin(q), 0.09);
          }),
          direction,
        );
        if (d >= 3)
          face(
            'trim',
            Array.from({ length: 8 }, (_, i) => {
              const q = (i * Math.PI) / 4;
              return point(theta, rad * 0.5 * Math.cos(q), yy + rad * 0.5 * Math.sin(q), 0.11);
            }),
            direction,
          );
      }
    }
}
function east(face, d) {
  for (const a of apses) {
    const p = P(a.p),
      n = d >= 3 ? 32 : d >= 2 ? 24 : d ? 12 : 6,
      r = regular(p, a.r, n),
      h = a.h;
    solid(face, r, 0, h, 'wall');
    profile(
      face,
      r,
      [
        [h, 1],
        [h + 0.5, 1.02],
        [h + 2.5, 0],
      ],
      'tile',
    );
    if (d) {
      for (const y of d >= 2 ? [2.0, h * 0.64, h - 0.3] : [h - 0.3])
        band(face, r, y, 0.2, 'trim', 1.008);
      apseDecoration(face, a, d);
    }
  }
}
function cloister(out, face, d) {
  const q = rawRole('cloisterRoof'),
    outer = q.outline,
    inner = q.holes[0],
    ins = new Set(inner);
  cap(face, outer, (p) => floor + (ins.has(p) ? 6.2 : 8.4), 'tile', [inner]);
  const wallInner = scaled(outer, 0.975);
  shell(out, d, outer, footing, 8.4, [], 'wall', wallInner);
  cap(face, outer, 0, 'court', [inner]);
  const court = rawRole('court').outline;
  cap(face, court, 0.0, 'court');
  const xs = court.map((p) => p[0]),
    zs = court.map((p) => p[1]),
    cx = (Math.min(...xs) + Math.max(...xs)) / 2,
    cz = (Math.min(...zs) + Math.max(...zs)) / 2;
  if (d)
    for (const [x0, x1] of [
      [Math.min(...xs) + 1, cx - 1],
      [cx + 1, Math.max(...xs) - 1],
    ])
      for (const [z0, z1] of [
        [Math.min(...zs) + 1, cz - 1],
        [cz + 1, Math.max(...zs) - 1],
      ])
        cap(face, rect([(x0 + x1) / 2, (z0 + z1) / 2], x1 - x0, z1 - z0), 0.025, 'garden');
  if (d) for (const row of monrealeArcadeRows(d).slice(2)) arcade(face, row, d);
  else for (const p of inner) solid(face, rect(p, 1, 1), 0, 6.2, 'trim');
}
function secondary(face, d) {
  for (const court of rawRole('monastery').holes)
    cap(face, court, () => rec.otherCourtFloorY, 'court');
  for (const p of rec.secondaryRanges) {
    sides(face, p.outline, footing, 10, 'wall');
    for (const h of p.holes) sides(face, h, footing, 10, 'wall', true);
    cap(face, p.outline, 10, 'tile', p.holes);
    if (d >= 2) {
      for (const y of [0.25, 4.0, 9.4]) band(face, p.outline, y, 0.25, 'trim', 1.002);
    }
  }
  for (const p of rec.secondaryRoofCells) {
    if (!p.holes.length) {
      const xs = p.outline.map((p) => p[0]),
        zs = p.outline.map((p) => p[1]),
        axis = Math.max(...xs) - Math.min(...xs) >= Math.max(...zs) - Math.min(...zs) ? 0 : 1;
      hip(face, p.outline, 10, 14, 'tile', axis);
    }
  }
  if (d)
    for (const p of rec.secondaryRanges)
      for (let i = 0; i < p.outline.length; i++) {
        const f = faceFrame(p.outline, i);
        if (f.length < 8) continue;
        const n = Math.floor(f.length / (d >= 2 ? 6 : 10));
        for (let j = 0; j < n; j++) {
          const h = hole(
            'secondary-window',
            lerp(f.a, f.b, (j + 0.5) / n),
            f.axis,
            f.normal,
            1.2,
            5.1,
            2.6,
            2.6,
            'rect',
          );
          pane(face, h, d, 0.08);
        }
      }
}
function build(out, d) {
  const stable = {
      addTriangle(slot, ref, points, _n, uv, color) {
        const emit = (q, tex, depth = 0) => {
          q = q.map((p) => p.map(Math.fround));
          const spans = [0, 2].map(
            (k) => Math.max(...q.map((p) => p[k])) - Math.min(...q.map((p) => p[k])),
          );
          if (Math.max(...spans) > (d === 0 ? 48 : d === 1 ? 32 : 24) && depth < 12) {
            const { i, j, k } = [
                [0, 1, 2],
                [1, 2, 0],
                [2, 0, 1],
              ]
                .map(([i, j, k]) => ({
                  i,
                  j,
                  k,
                  len: Math.hypot(q[i][0] - q[j][0], q[i][2] - q[j][2]),
                }))
                .sort((a, b) => b.len - a.len)[0],
              mid = lerp(q[i], q[j], 0.5).map(Math.fround),
              tuv = lerp(tex[i], tex[j], 0.5);
            emit([q[i], mid, q[k]], [tex[i], tuv, tex[k]], depth + 1);
            emit([mid, q[j], q[k]], [tuv, tex[j], tex[k]], depth + 1);
            return;
          }
          if (
            Math.hypot(
              ...cross(
                q[1].map((v, k) => v - q[0][k]),
                q[2].map((v, k) => v - q[0][k]),
              ),
            ) < 1e-9
          )
            return;
          out.addTriangle(slot, ref, q, normalFor(...q), tex, color);
        };
        emit(points, uv);
      },
    },
    face = writer(stable, d);
  body(stable, face, d);
  front(stable, face, d);
  towers(stable, face, d);
  east(face, d);
  cloister(stable, face, d);
  secondary(face, d);
}
export const buildMonrealeSkyline = (o) => build(o, 0),
  buildMonrealeDistrict = (o) => build(o, 1),
  buildMonrealeStreet = (o) => build(o, 2),
  buildMonrealeCloseup = (o) => build(o, 3);
const cam = (name, p, look, fov = 48) => ({
  name,
  position: [p[0] + O[0], p[1], p[2] + O[1]],
  lookAt: [look[0] + O[0], look[1], look[2] + O[1]],
  fov,
});
export const monrealeStudy = {
  id: 'N0349',
  key: 'cattedrale_di_monreale',
  title: 'Cattedrale di Monreale',
  category: 'cathedral',
  wikidataId: 'Q1303856',
  generationCommand: 'node packages/worldgen/scripts/generate-additional-landmarks.mjs',
  mapFrame: 'map-frame.json',
  fidelityTarget: 'medium-fi',
  build: (o) => build(o, 4),
  surfaceOverrides: scope.surfaceOverrides,
  brief: rec.scope,
  sourceFacts: {
    horizontalBasis:
      'Exact-QID cathedral parent plus cloister roof/court and two surrounding monastery parent plans. Secondary massing is the union of monastery parents minus cathedral/cloister footprints. Full complex is centered while retaining geographic positions;original cathedral identity is70.16m from the new anchor.',
    architecturalHeights: rec.heightBasis,
  },
  reconstruction: rec,
  scaleBasis: rec.heightBasis,
  refs: read('reference-metadata.json').currentRoundInspection.pictures.map((p) => p.page),
  nativeAxes: frame.nativeAxes,
  sourceDocuments: scope.sourceDocuments,
  sourceLicense:
    'Original geometry under repository license;map geometry ©OpenStreetMap contributors,ODbL-1.0. Linked photographs not redistributed.',
  dataAttribution: '©OpenStreetMap contributors;Protomaps;Mapzen/USGS terrain tiles.',
  sourceNotice:
    'Four existing 256-square raw sandstone, raw limestone, ceramic tile and wood graphs. Red/green roofs share the tile graph; warm/dark stone and pale carved/column/paving fields use linear tints of shared stone. Metric UVs, flat architecture normals/glass/garden, no embedded images.',
  importReason:
    'Four browser levels retain unequal towers,three apses,nave/presbytery,front/north galleries and open cloister with mapped surrounding monastery ranges at their geographic position.',
  previewGround: false,
  previewTerrain: scope.previewTerrain,
  mediumFiContext: scope.mediumFiContext,
  geographic: () => scope.geographic,
  geographicNote: scope.geographicNote,
  limitations: [
    rec.heightBasis,
    scope.geographicNote,
    'Individual medium-fi cathedral/cloister exterior from two useful inspected pictures and standard PMTiles/DEM. Current plans have no height values. Interior subdivisions,three apses/roof stages,tower openings,arches/clocks/column capitals and selected inlay motifs are picture-led. Surrounding monastery ranges use approximate mapped massing/tiled roofs/selected windows to replace overlapping generic parents. Full interiors,exact bronze panels/carvings/inlay/individual monastery rooms and certified walking excluded. Physical device timings pending.',
    'Skyline keeps cathedral/monastery masses, unequal towers, three apses, major roofs and roofless courts with coarse supporting piers. District adds shared graphs, selected windows/inlay fields, three front/11 north arches and four cloister bays per side. Street adds actual cathedral apertures and 16 paired-column cloister bays per side; closeup has 22 bays/profile refinements. The detailed master preserves 26 bays per side. Detail/curvature changes remain visible.',
  ],
  camera: scope.camera,
  qaCameras: [
    cam('unequal-towers-and-three-arch-portico', [-89, 31, 25], [-39, 19, -1]),
    cam('open-pale-portico-and-closed-door', [-65, 10, 9], [-43, 5, -1]),
    cam('south-paired-open-belfry', [-69, 38, 43], [-43, 32, 16]),
    cam('three-decorated-eastern-apses', [100, 31, -16], [35, 17, -3]),
    cam('north-arcade-and-nave-roof', [-8, 25, -54], [-10, 13, -13]),
    cam('open-cloister-and-paired-arcade', [-18, 20, 62], [-19, 3, 35]),
  ],
};
