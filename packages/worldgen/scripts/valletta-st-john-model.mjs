/** Valletta St. John: pyramid towers, three clocks, balcony and nave buttresses. */
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
  '../../../content/worldgen/source/places/sq/sq6/st_johns_co_cathedral/',
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
  wall: '#cdb783',
  trim: '#dfcfa1',
  roof: '#b8bfb5',
  pyramid: '#efecdc',
  bell: '#41776a',
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
const footing = (p) => Math.min(floor - 0.3, vallettaGround(...p) - 0.35);
export function vallettaGround(x, z) {
  const c = Math.cos(fit.heading),
    s = Math.sin(fit.heading);
  [x, z] = [x * c + z * s, -x * s + z * c];
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw Error('Valletta cathedral footing outside retained terrain');
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
const H = rec.heights,
  rawRole = (name) => rec.controls.find((b) => b.id === rec.roles[name]),
  rawRing = (name) => rawRole(name).polygons[0].outline,
  ring = (r, d) => simplify(r, d >= 2 ? 0.03 : d ? 0.15 : 0.4),
  role = (name, d) => ring(rawRing(name), d);
const A = rawRing('northPart')[1],
  B = rawRing('southTower')[0],
  axis = unit(B.map((v, k) => v - A[k])),
  normal = [-axis[1], axis[0]],
  F = { center: lerp(A, B, 0.5), axis, normal };
export const vallettaFrontPoint = (u, y, v) => [
  F.center[0] + normal[0] * u + axis[0] * v,
  floor + y,
  F.center[1] + normal[1] * u + axis[1] * v,
];
const frontXZ = (u, v) => {
  const p = vallettaFrontPoint(u, 0, v);
  return [p[0], p[2]];
};
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
export const vallettaPortal = () =>
  hole('main-portal', F.center, axis, normal, 4.0, 0.15, 10.6, 8.3, 'round', 10);
export const vallettaUpperWindow = () =>
  hole('balcony-upper-window', F.center, axis, normal, 4.0, 15.1, 6.2, 4.2, 'round', 10);
export const vallettaNiches = () =>
  [-8.5, 8.5].map((v) =>
    hole(`blind-front-niche-${v}`, frontXZ(0, v), axis, normal, 2.7, 3.0, 7.0, 5.65, 'round', 7),
  );
function towerPlans() {
  const nr = rawRing('northPart'),
    f = faceFrame(nr, 0),
    a = f.axis,
    n = f.normal,
    p = lerp(f.a, f.b, 0.5),
    w = rec.northUpper.width,
    depth = rec.northUpper.depth,
    point = (u, v) => [p[0] + n[0] * u + a[0] * v, p[1] + n[1] * u + a[1] * v];
  return [
    {
      name: 'north',
      r: [point(0, -w / 2), point(-depth, -w / 2), point(-depth, w / 2), point(0, w / 2)],
    },
    { name: 'south', r: rawRing('southTower') },
  ];
}
export const vallettaTowerPlans = () => towerPlans();
export const vallettaBelfries = () =>
  towerPlans().flatMap(({ name, r }) =>
    r.map((_, i) => {
      const f = faceFrame(r, i);
      return hole(
        `${name}-belfry-${i}`,
        lerp(f.a, f.b, 0.5),
        f.axis,
        f.normal,
        2.8,
        28.6,
        6.5,
        4.9,
        'round',
        7,
      );
    }),
  );
function onEnvelope(p, n) {
  const r = rec.main.polygons[0].outline,
    hits = [],
    cross2 = (a, b) => a[0] * b[1] - a[1] * b[0];
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      edge = b.map((v, k) => v - a[k]),
      v = a.map((v, k) => v - p[k]),
      den = cross2(n, edge);
    if (Math.abs(den) < 1e-8) continue;
    const t = cross2(v, edge) / den,
      u = cross2(v, n) / den;
    if (u >= 0 && u <= 1) hits.push(t);
  }
  if (!hits.length) throw Error('No mapped facade for selected window');
  const t = hits.sort((a, b) => Math.abs(a) - Math.abs(b))[0];
  return p.map((v, k) => v + n[k] * t);
}
function clip(r, a, value, greater) {
  const q = [],
    dot = (p) => p[0] * a[0] + p[1] * a[1];
  let p = r.at(-1),
    pv = dot(p) - value;
  for (const n of r) {
    const nv = dot(n) - value;
    if (pv >= 0 !== nv >= 0) q.push(lerp(p, n, pv / (pv - nv)));
    if (greater ? nv >= 0 : nv <= 0) q.push(n);
    p = n;
    pv = nv;
  }
  return q;
}
function roof(face, r, eave, top) {
  const zs = r.map((p) => p[1]),
    mid = (Math.min(...zs) + Math.max(...zs)) / 2,
    span = (Math.max(...zs) - Math.min(...zs)) / 2,
    y = (p) => eave + (top - eave) * (1 - Math.abs((p[1] - mid) / span));
  for (const gt of [false, true]) {
    const q = clip(r, [0, 1], mid, gt);
    cap(face, q, (p) => floor + y(p), 'roof');
  }
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
function window(face, h, d, recess = false, slot = 'glass') {
  pane(face, h, d, recess ? -1.35 : 0.08, slot);
  if (d) archBand(face, h, d, 0.23, 'trim', 0.13);
  if (d >= 2 && slot === 'glass') {
    const p = h.center.map((v, k) => v + h.normal[k] * (recess ? -1.15 : 0.17));
    beam(face, [p[0], h.bottom + 0.2, p[1]], [p[0], h.bottom + h.spring - 0.2, p[1]], 0.12);
    if (d >= 3)
      for (const t of [0.35, 0.7]) {
        const y = h.bottom + h.spring * t;
        beam(
          face,
          [p[0] - h.axis[0] * h.width * 0.42, y, p[1] - h.axis[1] * h.width * 0.42],
          [p[0] + h.axis[0] * h.width * 0.42, y, p[1] + h.axis[1] * h.width * 0.42],
          0.1,
        );
      }
  }
}
function facade(out, face, d) {
  const r = [frontXZ(0.05, -12.6), frontXZ(-4.9, -12.6), frontXZ(-4.9, 12.6), frontXZ(0.05, 12.6)],
    hs = [vallettaPortal(), vallettaUpperWindow(), ...(d >= 2 ? vallettaNiches() : [])];
  shell(out, d, r, 0, H.front, d ? hs : [], 'wall');
  cap(face, r, H.front, 'wall');
  if (d) {
    for (const y of [0.3, 13.3, 14.1, 23.5]) {
      sides(face, scaled(r, 1.02), y, y + 0.32, 'trim');
      cap(face, scaled(r, 1.02), y + 0.32, 'trim');
    }
    window(face, vallettaPortal(), d, true, 'door');
    window(face, vallettaUpperWindow(), d, true);
    archBand(face, vallettaPortal(), d, 0.45, 'trim', 0.24);
    archBand(face, vallettaUpperWindow(), d, 0.5, 'trim', 0.16);
    for (const h of vallettaNiches()) window(face, h, d, d >= 2, 'wall');
    for (const v of [-12, -10.9, 10.9, 12])
      solid(
        face,
        [
          frontXZ(0.18, v - 0.22),
          frontXZ(-0.4, v - 0.22),
          frontXZ(-0.4, v + 0.22),
          frontXZ(0.18, v + 0.22),
        ],
        0.5,
        23.5,
        'trim',
      );
  } else
    for (const h of [vallettaPortal(), vallettaUpperWindow()])
      pane(face, h, d, 0.08, h.name === 'main-portal' ? 'door' : 'glass');
  // Column-supported projecting balcony, with an actual open recess around the closed door.
  for (const v of [-3.6, -2.5, 2.5, 3.6]) {
    const p = frontXZ(1.3, v),
      n = d >= 3 ? 16 : d >= 2 ? 12 : d ? 8 : 4;
    profile(
      face,
      regular(p, 0.42, n),
      d
        ? [
            [0, 0.95],
            [0.4, 1.1],
            [0.75, 1],
            [11.3, 0.8],
            [11.7, 1.2],
            [12, 1.2],
          ]
        : [
            [0, 1],
            [12, 0.82],
          ],
      'trim',
    );
  }
  const balcony = [
    frontXZ(2.15, -4.5),
    frontXZ(-0.2, -4.5),
    frontXZ(-0.2, 4.5),
    frontXZ(2.15, 4.5),
  ];
  solid(face, balcony, 12, 13.2, 'trim');
  if (d) {
    const n = d >= 2 ? 19 : 9;
    beam(face, vallettaFrontPoint(2.1, 14.15, -4.5), vallettaFrontPoint(2.1, 14.15, 4.5), 0.2);
    for (let i = 0; i < n; i++) {
      const p = frontXZ(2.1, -4.25 + (i * 8.5) / (n - 1));
      solid(face, rect(p, 0.16, 0.16), 13.2, 14.15, 'trim');
    }
    for (const v of [-4.4, 4.4])
      beam(face, vallettaFrontPoint(-0.1, 14.15, v), vallettaFrontPoint(2.1, 14.15, v), 0.2);
  }
  const gable = [
      [-12.7, 24],
      [0, 27],
      [12.7, 24],
    ],
    front = 0.05,
    back = -3.0;
  for (const u of [front, back])
    face(
      'wall',
      gable.map(([v, y]) => vallettaFrontPoint(u, y, v)),
      [normal[0] * (u === front ? 1 : -1), 0, normal[1] * (u === front ? 1 : -1)],
    );
  for (let i = 1; i < gable.length; i++) {
    const [a, y] = gable[i - 1],
      [b, t] = gable[i];
    face('trim', [
      vallettaFrontPoint(front, y, a),
      vallettaFrontPoint(back, y, a),
      vallettaFrontPoint(back, t, b),
      vallettaFrontPoint(front, t, b),
    ]);
    if (d) beam(face, vallettaFrontPoint(0.12, y, a), vallettaFrontPoint(0.12, t, b), 0.25);
  }
  if (d) {
    face(
      'bell',
      [
        vallettaFrontPoint(0.13, 24.3, -1.3),
        vallettaFrontPoint(0.13, 24.3, 1.3),
        vallettaFrontPoint(0.13, 25.6, 0.4),
        vallettaFrontPoint(0.13, 25.3, -0.8),
      ],
      [normal[0], 0, normal[1]],
    );
    beam(face, vallettaFrontPoint(0, 26.8, 0), vallettaFrontPoint(0, 28.1, 0), 0.1);
  }
}
function body(_out, face, d) {
  const full = ring(rec.main.polygons[0].outline, d),
    lower = clip(full, [1, 0], -22, true),
    nave = rect([3.5, 2.45], 58, 20.4);
  sides(face, full, footing, 0, 'wall');
  cap(face, full, 0, 'wall');
  solid(face, lower, 0, H.aisle, 'wall');
  cap(face, lower, H.aisleRoof, 'wall');
  sides(face, lower, H.aisle, H.aisleRoof, 'trim');
  // Preserve the broad mapped north-front lower masonry independently of the smaller upper tower.
  solid(face, role('northPart', d), 0, 17, 'wall');
  sides(face, nave, 0, H.naveEave, 'wall');
  roof(face, nave, H.naveEave, H.naveRoof);
  if (d) {
    band(face, lower, 14.8, 0.35, 'trim', 1.005);
    for (const side of [-1, 1]) {
      const z = side > 0 ? 22.13 : -19.7;
      for (const x of [-16, -7, 2, 11, 20, 29])
        window(
          face,
          hole(
            'side-arch',
            onEnvelope([x, z], [0, side]),
            [1, 0],
            [0, side],
            2.15,
            5.5,
            6.3,
            5.1,
            'round',
          ),
          d,
        );
      for (const x of [-16, -7, 2, 11, 20, 29])
        window(
          face,
          hole(
            'clerestory',
            [x, side > 0 ? 12.65 : -7.75],
            [1, 0],
            [0, side],
            1.55,
            18.5,
            2.8,
            2.1,
            'round',
          ),
          d,
        );
    }
    for (const z of [-12, -2, 8, 18])
      window(
        face,
        hole(
          'rear-window',
          onEnvelope([32.75, z], [1, 0]),
          [0, 1],
          [1, 0],
          1.7,
          5.0,
          5.7,
          4.6,
          'round',
        ),
        d,
      );
  }
  for (const side of [-1, 1])
    for (const x of d ? [-16, -7, 2, 11, 20, 29] : [-14, 4, 24]) {
      const inner = side > 0 ? 12.6 : -7.7,
        outer = side > 0 ? 20.8 : -18.6;
      solid(face, rect([x, outer], 1.1, 1.05), 14.8, 18.0, 'wall');
      beam(face, [x, floor + 22.2, inner], [x, floor + 17.8, outer], d ? 1.05 : 1.3, 'wall');
    }
}
function bell(face, p, b, h, d) {
  const n = d >= 3 ? 12 : d >= 2 ? 8 : d ? 6 : 4;
  profile(
    face,
    regular(p, h * 0.3, n),
    d
      ? [
          [b, 1.2],
          [b + 0.15 * h, 1.15],
          [b + 0.5 * h, 0.62],
          [b + 0.85 * h, 0.5],
          [b + h, 0.18],
        ]
      : [
          [b, 1.05],
          [b + h, 0.25],
        ],
    'bell',
  );
  if (d >= 2)
    beam(face, [p[0], floor + b + h, p[1]], [p[0], floor + b + h + 0.6, p[1]], 0.13, 'bell');
}
function flatBell(face, h) {
  const p = h.center,
    a = h.axis,
    n = h.normal,
    pt = (u, y) => [p[0] + a[0] * u + n[0] * 0.14, floor + y, p[1] + a[1] * u + n[1] * 0.14];
  face('bell', [pt(-0.7, 31.8), pt(0.7, 31.8), pt(0.4, 33.3), pt(-0.4, 33.3)], [n[0], 0, n[1]]);
}
function clock(face, p, a, n, y, r, d) {
  const count = d >= 3 ? 24 : d >= 2 ? 16 : 10,
    point = (u, v, off = 0.05) => [
      p[0] + a[0] * u + n[0] * off,
      floor + y + v,
      p[1] + a[1] * u + n[1] * off,
    ];
  face(
    'pyramid',
    Array.from({ length: count }, (_, i) => {
      const t = (i * 2 * Math.PI) / count;
      return point(r * Math.cos(t), r * Math.sin(t));
    }),
    [n[0], 0, n[1]],
  );
  const dark = [0.035, 0.045, 0.04];
  face(
    'glass',
    [
      point(-0.07, -0.1, 0.1),
      point(0.07, -0.1, 0.1),
      point(0.07, r * 0.75, 0.1),
      point(-0.07, r * 0.75, 0.1),
    ],
    [n[0], 0, n[1]],
    dark,
  );
  beam(face, point(0, 0, 0.1), point(-r * 0.65, r * 0.15, 0.1), 0.1, 'glass');
  if (d >= 2)
    for (let i = 0; i < 12; i++) {
      const t = (i * 2 * Math.PI) / 12;
      beam(
        face,
        point(r * 0.8 * Math.cos(t), r * 0.8 * Math.sin(t), 0.1),
        point(r * 0.92 * Math.cos(t), r * 0.92 * Math.sin(t), 0.1),
        r > 0.99 ? 0.075 : 0.045,
        'glass',
      );
    }
}
function towers(out, face, d) {
  for (const { name, r } of towerPlans()) {
    const p = center(r),
      hs = vallettaBelfries().filter((h) => h.name.startsWith(name));
    solid(face, r, 0, H.bellBase, 'wall');
    cap(face, r, H.bellBase, 'wall');
    if (d >= 2) shell(out, d, r, H.bellBase, H.bellTop, hs, 'wall', scaled(r, 0.56));
    else {
      solid(face, r, H.bellBase, H.bellTop, 'wall');
      if (d)
        for (const h of hs) {
          pane(face, h, d, 0.05);
          flatBell(face, h);
        }
    }
    solid(face, scaled(r, 1.055), 36.7, 37.2, 'trim');
    for (const y of d ? [0.3, 1.2, 13.3, 14.1, 26.6, 27.3] : [13.5, 27.1])
      profile(
        face,
        r,
        [
          [y, 1.0],
          [y + 0.18, 1.045],
          [y + 0.38, 1.045],
        ],
        'trim',
      );
    if (d) {
      for (const h of hs) archBand(face, h, d, 0.25, 'trim', 0.14);
      for (const q of r) solid(face, rect(q, 0.48, 0.48), 0.6, 36.5, 'trim');
      for (let i = 0; i < r.length; i++) {
        const f = faceFrame(r, i);
        if (name === 'north' && f.normal[0] < -0.7)
          window(
            face,
            hole(
              'north-upper-small-window',
              lerp(f.a, f.b, 0.5),
              f.axis,
              f.normal,
              1.3,
              19.6,
              3.8,
              3.0,
              'round',
            ),
            d,
          );
      }
    }
    if (d >= 2)
      for (const h of hs) {
        const bp = h.center.map((v, k) => v - h.normal[k] * 1.6);
        bell(face, bp, 32.0, 1.8, d);
        beam(
          face,
          [bp[0] - h.axis[0] * 1.7, floor + 34.5, bp[1] - h.axis[1] * 1.7],
          [bp[0] + h.axis[0] * 1.7, floor + 34.5, bp[1] + h.axis[1] * 1.7],
          0.22,
          'trim',
        );
      }
    if (d) {
      for (let i = 0; i < r.length; i++) {
        const f = faceFrame(r, i),
          n = d >= 3 ? 12 : d >= 2 ? 9 : 4;
        beam(face, at(f.a, 37.9), at(f.b, 37.9), 0.2);
        for (let j = 0; j < n; j++) {
          const q = lerp(f.a, f.b, (j + 0.5) / n);
          solid(face, rect(q, 0.14, 0.14), 37.2, 37.9, 'trim');
        }
      }
    }
    const fr = r.map((_, i) => faceFrame(r, i)).sort((a, b) => a.normal[0] - b.normal[0])[0];
    if (name === 'south' && d) {
      const cp = lerp(fr.a, fr.b, 0.5);
      clock(face, cp, fr.axis, fr.normal, 21.0, 2.1, d);
      for (const v of [-1.95, 1.95])
        clock(
          face,
          cp.map((n, k) => n + fr.axis[k] * v),
          fr.axis,
          fr.normal,
          18.3,
          0.9,
          d,
        );
      window(
        face,
        hole('clock-low-window', cp, fr.axis, fr.normal, 1.1, 15.2, 1.8, 1.3, 'round'),
        d,
      );
    }
    // The southern pyramid sits behind the exposed upper bell frame.
    const pyrCenter = p.map((v, k) => v + (name === 'south' ? 1.0 : 0) * -fr.normal[k]),
      pyr = rect(pyrCenter, name === 'south' ? 5.4 : 7.4, name === 'south' ? 5.4 : 7.4);
    profile(
      face,
      pyr,
      [
        [37.5, 1],
        [45.3, 0],
      ],
      'pyramid',
    );
    solid(face, regular(pyrCenter, 0.22, d ? 8 : 4), 45.25, 45.55, 'bell');
    beam(
      face,
      [pyrCenter[0], floor + 45.5, pyrCenter[1]],
      [pyrCenter[0], floor + 46.2, pyrCenter[1]],
      d ? 0.09 : 0.15,
      'trim',
    );
    if (name === 'south') {
      const u = fr.normal,
        p0 = p.map((v, k) => v + u[k] * 2.6),
        a = fr.axis;
      for (const s of [-1, 1]) {
        const q = p0.map((v, k) => v + a[k] * s * 1.35);
        solid(face, rect(q, 0.6, 0.65), 37.4, 44.1, 'trim');
      }
      beam(
        face,
        [p0[0] - a[0] * 1.7, floor + 44.1, p0[1] - a[1] * 1.7],
        [p0[0] + a[0] * 1.7, floor + 44.1, p0[1] + a[1] * 1.7],
        0.35,
      );
      bell(face, p0, 41.4, 1.9, d);
      for (const s of [-1, 1])
        bell(
          face,
          p0.map((v, k) => v + a[k] * s * 0.8),
          38.3,
          1.25,
          d,
        );
    }
  }
}
function build(out, d) {
  const stable = {
      addTriangle(slot, ref, points, _n, uv, color) {
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
        // The viewer stamps triangle bounds for replacement coverage. Bound large faces so a
        // rotated cathedral does not mask a wide area of the square beyond its masonry.
        const emit = (q, tex, depth = 0) => {
          const span = Math.max(
            ...[0, 2].map((k) => Math.max(...q.map((p) => p[k])) - Math.min(...q.map((p) => p[k]))),
          );
          if (span > 16 && depth < 12) {
            const [i, j] = [
                [0, 1],
                [1, 2],
                [2, 0],
              ].sort(
                (a, b) =>
                  Math.hypot(q[b[0]][0] - q[b[1]][0], q[b[0]][2] - q[b[1]][2]) -
                  Math.hypot(q[a[0]][0] - q[a[1]][0], q[a[0]][2] - q[a[1]][2]),
              )[0],
              k = 3 - i - j;
            const mid = lerp(q[i], q[j], 0.5).map(Math.fround),
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
        emit(p, uv);
      },
    },
    face = writer(stable, d);
  body(stable, face, d);
  facade(stable, face, d);
  towers(stable, face, d);
  solid(
    face,
    [frontXZ(-0.25, -12.9), frontXZ(2.65, -12.9), frontXZ(2.65, 12.9), frontXZ(-0.25, 12.9)],
    footing,
    0,
    'wall',
  );
  if (d)
    for (let i = 0; i < 5; i++) {
      const r = [
        frontXZ(2.6 + i * 0.4, -12.9),
        frontXZ(3.1 + i * 0.4, -12.9),
        frontXZ(3.1 + i * 0.4, 12.9),
        frontXZ(2.6 + i * 0.4, 12.9),
      ];
      solid(face, r, footing, -i * 0.12, 'wall');
    }
}
export const buildVallettaSkyline = (o) => build(o, 0),
  buildVallettaDistrict = (o) => build(o, 1),
  buildVallettaStreet = (o) => build(o, 2),
  buildVallettaCloseup = (o) => build(o, 3);
export const vallettaStudy = {
  id: 'st_johns_co_cathedral',
  key: 'st_john_s_co_cathedral',
  title: "St. John's Co-Cathedral",
  category: 'cathedral',
  wikidataId: 'Q613619',
  generationCommand: 'node packages/worldgen/scripts/generate-additional-landmarks.mjs',
  mapFrame: 'map-frame.json',
  fidelityTarget: 'medium-fi',
  build: (o) => build(o, 4),
  surfaceOverrides: scope.surfaceOverrides,
  brief: rec.scope,
  sourceFacts: {
    horizontalBasis:
      'Retained exact-QID way23352829/current parent and two tower parts. The broad northern lower mass contains a smaller reconstructed upper belfry. Signed twin-tower facade retained without overall rescaling.',
    architecturalHeights: rec.heightBasis,
  },
  reconstruction: rec,
  scaleBasis:
    'Approximately 66x44m mapped cathedral envelope. Three map controls have no tower height values;17m generic parent is not used as overall height. All roof/tower/opening stages and north upper plan are declared picture-led estimates.',
  refs: read('reference-metadata.json').currentRoundInspection.pictures.map((p) => p.page),
  nativeAxes: frame.nativeAxes,
  sourceDocuments: scope.sourceDocuments,
  sourceLicense:
    'Original geometry under repository license;map geometry ©OpenStreetMap contributors,ODbL-1.0. Linked photographs not redistributed.',
  dataAttribution: '©OpenStreetMap contributors;Protomaps;Mapzen/USGS terrain tiles.',
  sourceNotice:
    'Five existing 256-square raw/weathered limestone, standing-seam metal, lime plaster and wood graphs. Pale pyramids and clocks reuse plaster; green bells share metal. Metric UVs, linear tints, flat architecture normals/glazing, no embedded images.',
  importReason:
    'Four browser levels retain St. Johns individual pyramid-tower/three-clock/balcony facade and repeated nave buttresses at its signed Valletta location.',
  previewGround: false,
  previewTerrain: scope.previewTerrain,
  mediumFiContext: scope.mediumFiContext,
  geographic: () => scope.geographic,
  geographicNote: scope.geographicNote,
  limitations: [
    rec.heightBasis,
    scope.geographicNote,
    'Individual medium-fi exterior from two inspected useful pictures and standard PMTiles/DEM. Bell profiles,roof balustrades,clock/calendar fields,balcony/niches,gable relief and side/rear details are selected approximations. North upper belfry plan is inferred within the larger mapped base. Exact inscriptions/sculpture,full interiors,adjacent museum/city blocks,background dome and certified walking excluded. Physical phone/laptop timings pending.',
    'Skyline preserves twin pale pyramid towers,upper-right exposed bell frame,central balcony/door/upper arch,gable,nave roof and coarse buttress rhythm. District adds shared graphs,recessed closed portal/upper glass,selected columns/rails,three clock fields and flat belfry/bell marks. Street opens actual belfries with suspended green bells and recesses blind niches;closeup refines arches,bells,rails and clock ticks. Detail changes remain visible.',
  ],
  camera: scope.camera,
  qaCameras: [
    {
      name: 'twin-pyramids-balcony-and-three-clock-front',
      position: [-90, 36, 6],
      lookAt: [-28, 22, 2],
      fov: 48,
    },
    {
      name: 'column-supported-balcony-and-recessed-door',
      position: [-52, 12, 5],
      lookAt: [-30, 8, 2],
      fov: 48,
    },
    {
      name: 'three-clock-fields-and-open-right-belfry',
      position: [-53, 34, 42],
      lookAt: [-25, 26, 18],
      fov: 48,
    },
    {
      name: 'pale-pyramids-and-exposed-upper-bell-frame',
      position: [-45, 56, 43],
      lookAt: [-26, 39, 17],
      fov: 48,
    },
    {
      name: 'pale-nave-roof-and-repeated-side-buttresses',
      position: [8, 37, 64],
      lookAt: [6, 19, 13],
      fov: 48,
    },
    {
      name: 'rear-masses-and-other-buttress-line',
      position: [73, 33, -39],
      lookAt: [12, 17, -5],
      fov: 48,
    },
  ],
};
