/** Šibenik Cathedral: ribbed stone vaults, curved western roses and octagonal pointed dome. */
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
  '../../../content/worldgen/source/places/sr/srg/sibenik_cathedral/',
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
  stone: '#ded7c7',
  trim: '#eee6d5',
  roofstone: '#bcc0ba',
  foundation: '#bbb39e',
  glass: '#495d6b',
  door: '#635344',
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
const footing = (p) => Math.min(floor - 0.3, sibenikGround(...p) - 0.35);
export function sibenikGround(x, z) {
  const c = Math.cos(fit.heading),
    s = Math.sin(fit.heading);
  [x, z] = [x * c + z * s, -x * s + z * c];
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw Error('Šibenik footing outside retained terrain');
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
const box = (face, p, w, d, b, t, slot) => solid(face, rect(p, w, d), b, t, slot);
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
function shell(out, d, r, b, t, holes = [], slot = 'stone', inner = null) {
  const hs = holes.map((h) => prepareOpening(h, 0, d === 2 ? 1 : d)),
    face = writer(openingBuilder(out, hs), d);
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
const ring = (r, d) => simplify(r, d ? 0.035 : 0.22),
  project = (p, a) => p[0] * a[0] + p[1] * a[1];
const frontAxis = unit(rec.front.b.map((v, k) => v - rec.front.a[k])),
  frontNormal = [-frontAxis[1], frontAxis[0]];
export const sibenikFront = (z) => [
  rec.front.a[0] +
    ((rec.front.b[0] - rec.front.a[0]) * (z - rec.front.a[1])) / (rec.front.b[1] - rec.front.a[1]),
  z,
];
export function sibenikPortals() {
  return [
    {
      name: 'west-main-portal',
      center: sibenikFront(0),
      axis: frontAxis,
      normal: frontNormal,
      width: 3.8,
      bottom: floor + 0.1,
      height: 7.1,
      spring: 4.9,
      shape: 'pointed',
      depth: 3.4,
    },
    {
      name: 'north-lion-portal',
      center: [-6.5, -8.71],
      axis: [-1, 0],
      normal: [0, -1],
      width: 2.8,
      bottom: floor + 0.1,
      height: 5.6,
      spring: 4.0,
      shape: 'pointed',
      depth: 3.0,
    },
  ];
}
function circle(z, y, r, d, position = null, alongAxis = frontAxis, faceNormal = frontNormal) {
  const p = position ?? sibenikFront(z),
    axis = alongAxis,
    normal = faceNormal,
    n = d >= 3 ? 24 : d >= 2 ? 16 : 12,
    cy = floor + y,
    point = (u, v, off) => [
      p[0] + axis[0] * u + normal[0] * off,
      cy + v,
      p[1] + axis[1] * u + normal[1] * off,
    ],
    ring = Array.from({ length: n }, (_, i) => [
      r * Math.cos((i * 2 * Math.PI) / n),
      r * Math.sin((i * 2 * Math.PI) / n),
    ]);
  const planes = [
    [normal[0], 0, normal[1], 1.7 - normal[0] * p[0] - normal[1] * p[1]],
    [-normal[0], 0, -normal[1], 1.7 + normal[0] * p[0] + normal[1] * p[1]],
  ];
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length],
      du = b[0] - a[0],
      dv = b[1] - a[1],
      A = -dv * axis[0],
      C = -dv * axis[1];
    planes.push([A, du, C, dv * a[0] - du * a[1] - A * p[0] - du * cy - C * p[1]]);
  }
  return {
    p,
    cy,
    r,
    axis,
    normal,
    ring,
    point,
    planes,
    bounds: [
      [
        Math.min(...ring.map((q) => point(...q, -1.7)[0]), ...ring.map((q) => point(...q, 1.7)[0])),
        Math.max(...ring.map((q) => point(...q, -1.7)[0]), ...ring.map((q) => point(...q, 1.7)[0])),
      ],
      [cy - r, cy + r],
      [z - r - 1.7, z + r + 1.7],
    ],
  };
}
function masked(out, holes) {
  return {
    addTriangle(...args) {
      const p = args[2],
        bounds = [0, 1, 2].map((k) => [
          Math.min(...p.map((p) => p[k])),
          Math.max(...p.map((p) => p[k])),
        ]),
        near = holes.filter((h) =>
          h.bounds.every((b, k) => b[0] <= bounds[k][1] + 1e-6 && b[1] >= bounds[k][0] - 1e-6),
        );
      if (near.length) openingBuilder(out, near).addTriangle(...args);
      else out.addTriangle(...args);
    },
  };
}
function rosette(face, h, d) {
  const off = d ? -0.9 : 0.11,
    n = h.ring.length;
  face(
    'glass',
    h.ring.map((q) => h.point(...q, off)),
    [...h.normal.slice(0, 1), 0, h.normal[1]],
  );
  if (!d) return;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n,
      a = h.ring[i],
      b = h.ring[j],
      outer = (q) => q.map((v) => (v * (h.r + 0.27)) / h.r);
    face(
      'trim',
      [
        h.point(...a, 0.15),
        h.point(...b, 0.15),
        h.point(...outer(b), 0.15),
        h.point(...outer(a), 0.15),
      ],
      [h.normal[0], 0, h.normal[1]],
    );
    face('trim', [
      h.point(...a, 0.15),
      h.point(...b, 0.15),
      h.point(...b, -0.85),
      h.point(...a, -0.85),
    ]);
  }
  const spokes = h.r > 2 ? (d >= 3 ? 20 : 12) : d >= 2 ? 8 : 4;
  for (let i = 0; i < spokes; i++) {
    const a = (i * 2 * Math.PI) / spokes;
    beam(
      face,
      h.point(0.25 * Math.cos(a), 0.25 * Math.sin(a), 0.18),
      h.point((h.r - 0.05) * Math.cos(a), (h.r - 0.05) * Math.sin(a), 0.18),
      h.r > 2 ? 0.12 : 0.09,
      'trim',
    );
  }
}
function roofY(t, p) {
  const q = project(p, t.cross),
    [lo, hi] = t.shortRange;
  const u =
    t.kind === 'quarter'
      ? Math.max(
          0,
          Math.min(1, (Math.abs(q) - 4.45) / (Math.max(Math.abs(lo), Math.abs(hi)) - 4.45)),
        )
      : Math.min(1, Math.abs((q - (lo + hi) / 2) / ((hi - lo) / 2)));
  return floor + t.base + (t.top - t.base) * Math.sqrt(Math.max(0, 1 - u * u));
}
function vault(face, t, d) {
  const n = [4, 6, 10, 16, 20][d];
  for (const p of t.roofLevels[d]) {
    const [a, b] = p.span,
      y = (q) => roofY(t, q),
      pa = t.cross.map((v) => v * a),
      pb = t.cross.map((v) => v * b),
      ya = y(pa),
      yb = y(pb),
      linear = (p) => ya + ((yb - ya) * (project(p, t.cross) - a)) / (b - a);
    cap(face, p.outline, linear, 'roofstone', p.holes);
  }
  const [lo, hi] = t.shortRange,
    cuts = Array.from({ length: n + 1 }, (_, i) => lo + ((hi - lo) * i) / n);
  if (t.kind === 'quarter') cuts.push(-4.45, 4.45);
  const outline = t.outline.flatMap((a, i) => {
    const b = t.outline[(i + 1) % t.outline.length],
      av = project(a, t.cross),
      bv = project(b, t.cross),
      ts = [0];
    if (Math.abs(bv - av) > 1e-8)
      for (const q of cuts) {
        const u = (q - av) / (bv - av);
        if (u > 1e-7 && u < 1 - 1e-7) ts.push(u);
      }
    return ts.sort((a, b) => a - b).map((t) => lerp(a, b, t));
  });
  sides(face, outline, t.base, (p) => roofY(t, p), 'stone');
  if (d >= 2) {
    const along = t.axis[0] ? [-18, -12, -6, 0, 15] : [-7, -4, 4, 7];
    for (const u of along) {
      for (let i = 0; i < n; i++) {
        const a = lo + ((hi - lo) * i) / n,
          b = lo + ((hi - lo) * (i + 1)) / n;
        const point = (q, w) => {
          const p = [t.axis[0] * (u + w) + t.cross[0] * q, t.axis[1] * (u + w) + t.cross[1] * q];
          return [p[0], roofY(t, p) + 0.09, p[1]];
        };
        // Only visible vault strips receive ribs; crossing masks remain open for the drum.
        const test = [
          t.axis[0] * u + (t.cross[0] * (a + b)) / 2,
          t.axis[1] * u + (t.cross[1] * (a + b)) / 2,
        ];
        if (
          !t.roofLevels[d].some(
            (p) => inside(test, p.outline) && !p.holes.some((h) => inside(test, h)),
          )
        )
          continue;
        face('trim', [point(a, -0.13), point(a, 0.13), point(b, 0.13), point(b, -0.13)], [0, 1, 0]);
      }
    }
  }
}
function inside(p, r) {
  let c = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const a = r[i],
      b = r[j];
    if (
      a[1] > p[1] !== b[1] > p[1] &&
      p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]
    )
      c = !c;
  }
  return c;
}
function surfaceFrame(h, d) {
  const p = prepareOpening(h, 0, d),
    s = Math.sign(-p.axis[1] * h.normal[0] + p.axis[0] * h.normal[1]);
  return { ...p, point: (x, y, z) => p.point(x, y, z * s) };
}
function framedWindow(face, h, d, slot = 'glass') {
  pane(face, h, d, 0.1, slot);
  if (d >= 2) {
    archBand(face, h, d, 0.18, 'trim', 0.17);
    if (d >= 3 && slot === 'glass') {
      const p = surfaceFrame(h, d);
      beam(face, p.point(0, h.bottom, 0.24), p.point(0, h.bottom + h.spring, 0.24), 0.1, 'trim');
    }
  }
}
function wallZ(outline, x, side) {
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i],
      b = outline[(i + 1) % outline.length];
    if (Math.abs(b[0] - a[0]) > 25 && (a[1] + b[1]) * side > 0)
      return a[1] + ((b[1] - a[1]) * (x - a[0])) / (b[0] - a[0]);
  }
  throw Error('Missing mapped longitudinal wall');
}
function facades(face, d) {
  if (!d) return;
  for (const side of [-1, 1]) {
    for (const x of [-16, -11, -6, -1, 15]) {
      const z = wallZ(rec.main.polygons[0].outline, x, side),
        axis = [-side, 0],
        normal = [0, side];
      if (!(side === -1 && Math.abs(x + 6.5) < 2))
        framedWindow(
          face,
          {
            center: [x, z],
            axis,
            normal,
            width: 1.45,
            bottom: floor + 3.6,
            height: 4.3,
            spring: 3.1,
            shape: 'round',
            depth: 1,
          },
          d,
          'stone',
        );
      const upperZ = wallZ(rec.nave.outline, x, side);
      framedWindow(
        face,
        {
          center: [x, upperZ],
          axis,
          normal,
          width: 1.15,
          bottom: floor + 12.5,
          height: 2.75,
          spring: 1.95,
          shape: 'round',
          depth: 1,
        },
        d,
      );
    }
    if (d >= 2)
      for (const x of [-19.5, -13.5, -8.5, -3.5, 3.8, 13.4])
        box(face, [x, side * 8.73], 0.43, 0.42, 0.5, 9.1, 'trim');
  }
  for (const z of [-8.4, -4.4, 4.4, 8.5]) {
    const p = sibenikFront(z).map((v, k) => v + frontNormal[k] * 0.14);
    box(face, p, 0.55, 0.58, 0.4, Math.abs(z) < 5 ? 15.8 : 9.4, 'trim');
  }
  if (d >= 2) {
    band(face, ring(rec.main.polygons[0].outline, d), 8.75, 0.3, 'trim', 1.012);
    band(face, ring(rec.nave.outline, d), 15.55, 0.3, 'trim', 1.025);
  }
}
function dome(out, face, d) {
  const t = rec.dome,
    p = t.center,
    r = regular(p, t.radius, 8, Math.PI / 8);
  solid(face, t.outline, 16.1, t.drumBase, 'stone');
  const hs = [];
  for (let i = 0; i < r.length; i++) {
    const f = faceFrame(r, i),
      m = lerp(f.a, f.b, 0.5);
    for (const u of [-0.92, 0.92])
      hs.push({
        center: m.map((v, k) => v + f.axis[k] * u),
        axis: f.axis,
        normal: f.normal,
        width: 0.86,
        bottom: floor + 21.75,
        height: 3.15,
        spring: 2.52,
        shape: 'round',
        depth: 2.4,
      });
  }
  if (d >= 2) shell(out, d, r, t.drumBase, t.drumTop, hs, 'stone', scaled(r, 0.78));
  else sides(face, r, t.drumBase, t.drumTop, 'stone');
  if (d)
    for (const h of hs) {
      pane(face, h, d, d >= 2 ? -0.85 : 0.1, 'glass');
      if (d >= 3) archBand(face, h, d, 0.14, 'trim', 0.15);
    }
  solid(face, scaled(r, 1.045), t.drumTop, t.roofBase, 'trim');
  const levels =
    d >= 2
      ? [
          [t.roofBase, 1],
          [27.3, 0.89],
          [29.0, 0.67],
          [30.5, 0.35],
          [t.roofTop, 0.025],
        ]
      : [
          [t.roofBase, 1],
          [29.0, 0.67],
          [t.roofTop, 0.025],
        ];
  profile(face, r, levels, 'roofstone');
  if (d >= 2)
    for (const q of r) {
      for (let i = 1; i < levels.length; i++) {
        const [a, f] = levels[i - 1],
          [b, g] = levels[i];
        beam(
          face,
          [p[0] + (q[0] - p[0]) * f, floor + a, p[1] + (q[1] - p[1]) * f],
          [p[0] + (q[0] - p[0]) * g, floor + b, p[1] + (q[1] - p[1]) * g],
          0.16,
          'trim',
        );
      }
    }
  const goldFace = (_s, p, n) => face('trim', p, n, [0.57, 0.37, 0.1]);
  box(goldFace, p, 0.12, 0.12, t.roofTop, t.top, 'trim');
  box(goldFace, p, 0.65, 0.12, t.top - 0.3, t.top - 0.18, 'trim');
}
function build(out, d) {
  const face = writer(out, d),
    portals = sibenikPortals(),
    roses = [
      circle(0, 12.9, 2.35, d),
      circle(0, 18.1, 0.83, d),
      circle(-6.55, 10.7, 0.6, d),
      circle(6.55, 10.7, 0.6, d),
      circle(-8.84, 18.1, 0.65, d, [8.6, -8.84], [1, 0], [0, -1]),
      circle(8.78, 18.1, 0.65, d, [8.6, 8.78], [-1, 0], [0, 1]),
    ],
    bores = d >= 2 ? roses : d ? [roses[0]] : [],
    cutOut = masked(out, bores),
    cutFace = writer(cutOut, d),
    r = ring(rec.main.polygons[0].outline, d);
  sides(face, r, footing, 0, 'foundation');
  shell(cutOut, d, r, 0, 9, d ? portals : [], 'stone');
  shell(cutOut, d, ring(rec.nave.outline, d), 0, 15.8, d ? [portals[0]] : [], 'stone');
  sides(face, ring(rec.transept.outline, d), 0, 16.1, 'stone');
  for (const t of rec.roofs) vault(cutFace, t, d);
  for (const a of rec.apses) {
    sides(face, ring(a.outline, d), 0, a.base, 'stone');
    const p = center(a.outline);
    for (let i = 0; i < a.outline.length; i++) {
      const q = a.outline[i],
        r = a.outline[(i + 1) % a.outline.length];
      face('roofstone', [at(q, a.base), at(r, a.base), at(p, a.top)], [0, 1, 0]);
    }
    if (d >= 2) {
      band(face, a.outline, a.base - 0.3, 0.25, 'trim', 1.02);
      for (let i = 0; i < a.outline.length; i++) {
        const f = faceFrame(a.outline, i);
        if (f.normal[0] > 0.3)
          framedWindow(
            face,
            {
              center: lerp(f.a, f.b, 0.5),
              axis: f.axis,
              normal: f.normal,
              width: 1,
              bottom: floor + 3,
              height: 3.5,
              spring: 2.5,
              shape: 'round',
              depth: 1,
            },
            d,
          );
      }
    }
  }
  dome(out, face, d);
  facades(face, d);
  for (const [i, h] of portals.entries()) {
    pane(face, h, d, d ? -1.25 : 0.12, 'door');
    if (d) {
      archBand(face, h, d, 0.55, 'trim', 0.12);
      if (d >= 2) archBand(face, h, d, 0.28, 'trim', 0.3);
    }
    if (i === 1 && d >= 2)
      for (const x of [-8.6, -4.4]) {
        box(face, [x, -9.1], 0.55, 0.6, 0.2, 4.5, 'trim');
        box(face, [x, -9.1], 0.9, 0.9, 4.5, 4.9, 'trim');
      }
  }
  for (const h of roses) rosette(face, h, d);
  // Small exterior landing only; plaza, lion/statue figures and walking collision are excluded.
  for (let i = 0; i < (d ? 3 : 1); i++) {
    const n = d ? 3 : 1,
      z = 0,
      x = d ? -21.1 + i * 0.45 : -20.6,
      y = -(n - 1 - i) * 0.14;
    solid(face, rect([x, z], d ? 0.47 : 1.4, 5.8), footing, y, 'foundation');
  }
}
export const buildSibenikSkyline = (o) => build(o, 0),
  buildSibenikDistrict = (o) => build(o, 1),
  buildSibenikStreet = (o) => build(o, 2),
  buildSibenikCloseup = (o) => build(o, 3);
export const sibenikStudy = {
  id: 'sibenik_cathedral',
  key: 'sibenik_cathedral',
  title: 'Šibenik Cathedral',
  category: 'cathedral',
  wikidataId: 'Q391973',
  generationCommand: 'node packages/worldgen/scripts/generate-additional-landmarks.mjs',
  mapFrame: 'map-frame.json',
  fidelityTarget: 'medium-fi',
  build: (o) => build(o, 4),
  surfaceOverrides: scope.surfaceOverrides,
  brief:
    'Šibenik Cathedral: pale ribbed stone barrel nave/aisle/transept vaults, curved western crown/large and small roses, recessed west/north portals, octagonal windowed drum/pointed stone dome, selected side bays/pilasters and three mapped eastern apses.',
  sourceFacts: {
    horizontalBasis:
      'Exact-QID outline and nine current PMTiles parent/part controls with signed west/apse distinction.',
    architecturalHeights: rec.heightBasis,
  },
  reconstruction: rec,
  scaleBasis:
    'Approximately41x18m mapped whole envelope and eight individual parts; current map height values constrain roof/dome stages, with picture-led eaves/drum/profile interpretation.',
  refs: read('reference-metadata.json').currentRoundInspection.pictures.map((p) => p.page),
  nativeAxes: frame.nativeAxes,
  sourceDocuments: scope.sourceDocuments,
  sourceLicense:
    'Original geometry under repository license; map controls ©OpenStreetMap contributors,ODbL-1.0. Linked pictures not redistributed.',
  dataAttribution: '©OpenStreetMap contributors; Protomaps; Mapzen/USGS terrain tiles.',
  sourceNotice:
    'Four existing256-square sandstone,raw/weathered limestone and wood graphs; shared wall/roof/trim bindings, metric UVs,linear vertex tints,flat glass and small gold-tinted trim cross. No embedded images.',
  importReason:
    'Four authored browser levels preserve the individual stone-vault/dome/rose silhouette and signed triple-apse location.',
  previewGround: false,
  previewTerrain: scope.previewTerrain,
  mediumFiContext: scope.mediumFiContext,
  geographic: () => scope.geographic,
  geographicNote: scope.geographicNote,
  limitations: [
    rec.heightBasis,
    scope.geographicNote,
    'Current PMTiles controls are approximate and do not certify measured real heights. Selected rosette spokes,portal hoods,side bays,ribs,apse profiles and landing are approximations. Exact sculpture/lion figures,head frieze,full tracery,full interiors,neighboring palace/town/plaza and certified walking surfaces excluded. Physical phone/laptop timings pending.',
    'Skyline uses closed portals,coarse curved roofs/dome and mean tints. District adds shared textures,main rose aperture/recessed closed portals and selected windows. Street adds actual drum openings,small round facade cuts,roof ribs,pilasters and portal trim; closeup refines vault facets,dome ribs/windows and rosette spokes. Detail/profile changes remain visible.',
  ],
  camera: scope.camera,
  qaCameras: [
    { name: 'curved-west-facade-and-rose', position: [-64, 27, -5], lookAt: [-19, 12, 0], fov: 43 },
    { name: 'west-recessed-main-portal', position: [-36, 8, -1], lookAt: [-19, 4, 0], fov: 43 },
    {
      name: 'northern-portal-and-stone-vaults',
      position: [-10, 27, -58],
      lookAt: [-1, 12, -2],
      fov: 43,
    },
    {
      name: 'octagonal-windowed-drum-and-pointed-dome',
      position: [-15, 40, -26],
      lookAt: [8.5, 26, 0],
      fov: 39,
    },
    {
      name: 'triple-eastern-apse-and-curved-transept',
      position: [60, 26, -31],
      lookAt: [14, 11, 0],
      fov: 43,
    },
    {
      name: 'seaward-aisle-and-ribbed-stone-roofs',
      position: [-17, 32, 58],
      lookAt: [0, 12, 0],
      fov: 43,
    },
  ],
};
