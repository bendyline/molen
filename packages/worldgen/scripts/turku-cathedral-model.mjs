/** Turku Cathedral: individual mapped brick clock tower,clerestory,aisles and eastern choir. */
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
  '../../../content/worldgen/source/places/u6/u6x/n0351_turku_cathedral/',
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
  wall: '#b77860',
  trim: '#d6cfb4',
  base: '#9f9b91',
  copper: '#65867b',
  belfry: '#53665e',
  gold: '#c5ac65',
  door: '#6b523a',
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
const scaled = (r, f) => {
  const p = center(r);
  return r.map((q) => q.map((v, k) => p[k] + (v - p[k]) * f));
};
const footing = (p) => Math.min(floor - 0.3, turkuCathedralGround(...p) - 0.35);
export function turkuCathedralGround(x, z) {
  const c = Math.cos(fit.heading),
    s = Math.sin(fit.heading);
  [x, z] = [x * c + z * s, -x * s + z * c];
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw Error('Turku cathedral footing outside retained terrain');
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
const role = (n) => rec.controls.find((b) => b.id === rec.roles[n]).polygons[0].outline,
  byId = (id) => rec.controls.find((b) => b.id === id).polygons[0].outline,
  nave = rec.navePlans[0].outline,
  north = rec.northPlans[0].outline,
  towerPlan = role('tower'),
  belfryPlan = role('belfry'),
  spirePlan = role('spireApron'),
  choirPlan = role('choirRoof'),
  towerCenter = center(spirePlan);
const clamp = (v) => Math.max(0, Math.min(1, v));
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
  depth = 4,
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
const ridgeZ = (x) =>
  4.035056033534014 + ((x + 30.26797692842637) * 0.932453191046487) / 44.73372100287848;
const naveHeight = (p) =>
  35 +
  7 *
    Math.min(
      clamp(1 - Math.abs(p[1] - ridgeZ(p[0])) / 6.2),
      p[0] <= 14.465744074452111 ? 1 : clamp((20.773079282817683 - p[0]) / 6.307335208365572),
    );
const northHeight = (p) => 16 + 14 * clamp((p[1] - (-15.78 + (p[0] + 31.95) * 0.0316)) / 13.62),
  northChapelHeight = (p) =>
    16 +
    14 *
      clamp(1 - Math.abs(p[0] - (2.04381474478118 + (p[1] + 25.17007218756104) * 0.00496)) / 8.85),
  southHeight = (p) =>
    16 +
    14 *
      clamp((24.9 - p[1]) / (24.9 - (10.234258618129463 + (p[0] + 30.36956912813152) * 0.02084)));
function panel(face, h, d, recess = false, slot = 'glass') {
  pane(face, h, d, recess ? -1.15 : 0.07, slot);
  if (d) archBand(face, h, d, 0.23, 'trim', 0.12);
  if (d >= 3 && slot === 'glass') {
    const p = h.center.map((v, k) => v + h.normal[k] * (recess ? -0.96 : 0.2));
    beam(face, [p[0], h.bottom + 0.12, p[1]], [p[0], h.bottom + h.spring - 0.12, p[1]], 0.13);
  }
}
function hip(face, r, eave, top, slot = 'copper', axis = 0) {
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
function fieldRoof(face, r, eave, height) {
  cap(face, r, (p) => floor + height(p), 'copper');
  sides(face, r, eave, (p) => floor + height(p), 'wall');
}
function windowsOn(r, name, predicate, bottom, height, width, spacing, spring) {
  return r.flatMap((_, i) => {
    const f = faceFrame(r, i),
      p = lerp(f.a, f.b, 0.5);
    if (!predicate(f, p)) return [];
    const n = Math.max(1, Math.floor((f.length - 0.8) / spacing));
    return Array.from({ length: n }, (_, j) =>
      hole(
        `${name}-${i}-${j}`,
        lerp(f.a, f.b, (j + 0.5) / n),
        f.axis,
        f.normal,
        Math.min(width, f.length * 0.5),
        bottom,
        height,
        spring,
        'round',
      ),
    );
  });
}
export function turkuCathedralPortals() {
  const west = towerPlan
      .map((_, i) => faceFrame(towerPlan, i))
      .filter((f) => f.normal[0] < -0.9)
      .sort((a, b) => b.length - a.length)[0],
    south = role('southAisle')
      .map((_, i) => faceFrame(role('southAisle'), i))
      .filter((f) => f.normal[1] > 0.9 && f.length > 15)
      .sort((a, b) => b.length - a.length)[0];
  return [
    hole(
      'west-closed-portal',
      lerp(west.a, west.b, 0.5),
      west.axis,
      west.normal,
      3.8,
      0.1,
      7.5,
      5.7,
      'pointed',
      5,
    ),
    hole(
      'south-closed-portal',
      lerp(south.a, south.b, 0.5),
      south.axis,
      south.normal,
      2.25,
      0.1,
      4.3,
      3.1,
      'round',
      4,
    ),
  ];
}
export function turkuCathedralWindows() {
  const portals = turkuCathedralPortals(),
    hs = [
      ...windowsOn(
        nave,
        'clerestory',
        (f) => f.length > 25 && Math.abs(f.normal[1]) > 0.9,
        30.65,
        3.65,
        1.45,
        5.4,
        2.6,
      ),
      ...windowsOn(
        role('southAisle'),
        'south-aisle',
        (f) => f.length > 6 && f.normal[1] > 0.85,
        6.2,
        4.5,
        2.1,
        5.9,
        3.5,
      ),
      ...windowsOn(
        north,
        'north-aisle',
        (f, p) => f.length > 6 && f.normal[1] < -0.85 && p[0] > -32,
        6.5,
        4.4,
        1.9,
        5.7,
        3.3,
      ),
      ...windowsOn(
        choirPlan,
        'choir',
        (f, p) => p[0] > 31 && f.length > 3.3,
        7.0,
        12,
        2.1,
        5,
        10.2,
      ),
      ...windowsOn(
        role('northeastChapel'),
        'northeast-chapel',
        (f, p) => p[1] < -9 && f.normal[1] < -0.35 && f.length > 2,
        8,
        8.4,
        1.0,
        5,
        6.8,
      ),
      ...windowsOn(
        role('southwestChapel'),
        'southwest-chapel',
        (f) => f.normal[0] < -0.8 && f.length > 5,
        7.2,
        4.6,
        1.6,
        5.5,
        3.5,
      ),
      ...windowsOn(
        role('southeastChapel'),
        'southeast-chapel',
        (f) => f.normal[1] > 0.8 && f.length > 4,
        5.2,
        5.3,
        1.6,
        5.4,
        4,
      ),
      ...windowsOn(
        role('eastAnnex'),
        'east-annex',
        (f) => f.normal[1] > 0.3 && f.normal[0] > 0.2 && f.length > 3.2,
        5.5,
        6.5,
        1.7,
        5.5,
        5,
      ),
    ].filter(
      (h) =>
        !portals.some(
          (p) => Math.hypot(h.center[0] - p.center[0], h.center[1] - p.center[1]) < 2.7,
        ),
    );
  // Small selected tower windows sit on the west and south faces, above doors
  // and clear of the lower church roofs; opposite elevations are approximate.
  for (const [i, point] of towerPlan.entries()) {
    const f = faceFrame(towerPlan, i);
    if (f.length < 10 || !(f.normal[0] < -0.85 || f.normal[1] > 0.85)) continue;
    // The lower southern windows would be hidden by the attached chapel roof.
    for (const y of [17, 24, 31, 38])
      if (!(f.normal[1] > 0.85 && y < 30))
        for (const off of [-0.22, 0.22])
          hs.push(
            hole(
              `tower-${i}-${y}-${off}`,
              lerp(point, f.b, 0.5 + off),
              f.axis,
              f.normal,
              1.0,
              y,
              2.5,
              1.9,
              'round',
              4,
            ),
          );
  }
  return hs;
}
export function turkuCathedralBelfryFields() {
  return belfryPlan.flatMap((_, i) => {
    const f = faceFrame(belfryPlan, i);
    return f.length > 5
      ? [
          hole(
            `closed-belfry-${i}`,
            lerp(f.a, f.b, 0.5),
            f.axis,
            f.normal,
            Math.min(4.6, f.length * 0.75),
            56.8,
            6.3,
            4.7,
            'pointed',
            3,
          ),
        ]
      : [];
  });
}
function mass(out, face, d, r, b, t, hs = [], slot = 'wall') {
  if (d >= 2) shell(out, d, r, b, t, hs, slot);
  else solid(face, r, b, t, slot);
  if (d)
    for (const h of hs)
      panel(face, h, d, d >= 2, h.name.includes('closed-portal') ? 'door' : 'glass');
}
function decoration(face, r, hs, d) {
  if (!d) return;
  for (const h of hs) {
    if (h.name.startsWith('clerestory')) {
      const p = h.center.map((v, k) => v + h.axis[k] * 2.0),
        blind = hole('pale-clerestory-niche', p, h.axis, h.normal, 0.8, 31.3, 1.9, 1.45, 'round');
      pane(face, blind, d, 0.06, 'trim');
      if (d >= 3)
        for (const off of [-0.67, 0.67])
          pane(
            face,
            {
              ...blind,
              center: p.map((v, k) => v + h.axis[k] * off),
              width: 0.45,
              height: 1.25,
              spring: 0.9,
            },
            d,
            0.06,
            'trim',
          );
    }
  }
  for (let i = 0; i < r.length; i++) {
    const f = faceFrame(r, i);
    if (f.length < 8 || Math.abs(f.normal[1]) < 0.8) continue;
    const count = Math.floor(f.length / (d >= 3 ? 4.5 : 8));
    for (let j = 0; j < count; j++) {
      const p = lerp(f.a, f.b, (j + 0.5) / count),
        h = hole('small-pale-stone-patch', p, f.axis, f.normal, 0.6, 12.6, 0.5, 0.5, 'rect');
      pane(face, h, d, 0.06, 'trim');
    }
  }
}
function body(out, face, d) {
  const hs = turkuCathedralWindows(),
    portals = turkuCathedralPortals(),
    select = (p) => hs.filter((h) => h.name.startsWith(p));
  solid(face, rec.main.polygons[0].outline, footing, 0.2, 'base');
  mass(out, face, d, nave, 0.15, 35, select('clerestory'));
  // Every mapped upper roof plane is retained; the five planes meet on the
  // recorded ridge and splayed eastern hip instead of becoming a flat block.
  for (const id of rec.naveRoofIds) cap(face, byId(id), (p) => floor + naveHeight(p), 'copper');
  sides(face, nave, 35, (p) => floor + naveHeight(p), 'wall');
  band(face, nave, 34.7, 0.3);
  mass(out, face, d, north, 0.1, 16, select('north-aisle'));
  for (const [n, height] of [
    ['northAisleRoof', northHeight],
    ['northChapelLeftRoof', northChapelHeight],
    ['northChapelRightRoof', northChapelHeight],
  ])
    fieldRoof(face, role(n), 16, height);
  mass(out, face, d, role('southAisle'), 0.1, 16, [...select('south-aisle'), portals[1]]);
  fieldRoof(face, role('southAisleRoof'), 16, southHeight);
  for (const [n, roof, eave, top, axis, prefix] of [
    ['southwestChapel', 'southwestChapelRoof', 18.3, 28.6, 0, 'southwest-chapel'],
    ['southeastChapel', 'southeastChapelRoof', 16.1, 29.7, 0, 'southeast-chapel'],
    ['eastAnnex', 'eastAnnexRoof', 17, 29.36, 0, 'east-annex'],
  ]) {
    mass(out, face, d, role(n), 0.1, eave, select(prefix));
    hip(face, role(roof), eave, top, 'copper', axis);
    band(face, role(n), eave - 0.25, 0.25);
  }
  mass(out, face, d, role('northeastChapel'), 0.1, 24.4, select('northeast-chapel'));
  const np = role('northeastChapel'),
    nc = center(np);
  for (let i = 0; i < np.length; i++)
    face('copper', [at(np[i], 24.4), at(np[(i + 1) % np.length], 24.4), at(nc, 34.61)], [0, 1, 0]);
  mass(out, face, d, choirPlan, 0.1, 30, select('choir'));
  const cp = [34.7, 5.5];
  for (let i = 0; i < choirPlan.length; i++)
    face(
      'copper',
      [at(choirPlan[i], 30), at(choirPlan[(i + 1) % choirPlan.length], 30), at(cp, 40)],
      [0, 1, 0],
    );
  band(face, choirPlan, 29.7, 0.3);
  // Mapped low connecting pieces remain supporting volumes under the roofs.
  for (const [id, top] of [
    [35185365544520, 30],
    [35185365544522, 30],
    [35185551870924, 30],
    [35185365544523, 30],
    [rec.roles.smallLowPart, 5],
  ])
    solid(face, byId(id), 0.15, top, 'wall');
  solid(face, role('smallVestibule'), 0.1, 24.4, 'wall');
  hip(face, role('smallVestibuleRoof'), 24.4, 30);
  // Selected narrow choir buttresses follow the mapped little toe projections.
  if (d)
    for (const p of [
      [31.7, -3.3],
      [38.5, -2.6],
      [43.4, 3.5],
      [43.5, 8.0],
      [38.4, 13.1],
      [31.8, 13.5],
    ]) {
      const n = unit([p[0] - cp[0], p[1] - cp[1]]),
        a = [n[1], -n[0]],
        r = [
          [-0.35, -0.6],
          [0.35, -0.6],
          [0.35, 0.55],
          [-0.35, 0.55],
        ].map(([u, v]) => [p[0] + a[0] * u + n[0] * v, p[1] + a[1] * u + n[1] * v]);
      solid(face, r, 0.2, 27.5, 'wall');
      profile(
        face,
        r,
        [
          [27.5, 1],
          [29.6, 0.6],
        ],
        'trim',
      );
    }
  if (d >= 2) {
    profile(
      face,
      regular(cp, 0.4, 8),
      [
        [40, 0.8],
        [40.5, 0.9],
        [41.1, 0.35],
        [41.8, 0.05],
      ],
      'copper',
    );
    // Main-parent roof/height controls do not specify the small choir finial;
    // its 1.8m extension is a picture-led estimate,below the overall85m spire.
  }
  if (d) {
    decoration(face, nave, select('clerestory'), d);
    decoration(face, role('southAisle'), select('south-aisle'), d);
  }
}
function disk(face, h, y, r, slot, d, offset = 0.12) {
  const p = h.center.map((v, k) => v + h.normal[k] * offset),
    n = d >= 3 ? 20 : d >= 2 ? 12 : 8;
  face(
    slot,
    Array.from({ length: n }, (_, i) => {
      const a = (i * 2 * Math.PI) / n;
      return [
        p[0] + h.axis[0] * r * Math.cos(a),
        floor + y + r * Math.sin(a),
        p[1] + h.axis[1] * r * Math.cos(a),
      ];
    }),
    [h.normal[0], 0, h.normal[1]],
  );
}
function tower(out, face, d) {
  const h = turkuCathedralPortals()[0],
    hs = turkuCathedralWindows().filter((h) => h.name.startsWith('tower-')),
    fields = turkuCathedralBelfryFields();
  mass(out, face, d, towerPlan, 0.1, 55, [h, ...hs]);
  if (d) {
    for (const y of [16.1, 29.8, 44.8, 54.2]) band(face, towerPlan, y, 0.36, 'trim', 1.025);
    for (const [i] of towerPlan.entries()) {
      const f = faceFrame(towerPlan, i);
      if (f.length < 10) continue;
      const p = lerp(f.a, f.b, 0.5),
        clock = hole('clock-field', p, f.axis, f.normal, 4.6, 47, 5, 5, 'rect');
      pane(face, clock, d, 0.1, 'belfry');
      disk(face, clock, 49.7, 2.02, 'gold', d, 0.14);
      disk(face, clock, 49.7, 1.8, 'belfry', d, 0.16);
      const pt = (u, v) => [
        p[0] + f.axis[0] * u + f.normal[0] * 0.2,
        floor + 49.7 + v,
        p[1] + f.axis[1] * u + f.normal[1] * 0.2,
      ];
      beam(face, pt(0, 0), pt(0.2, 1.35), 0.15, 'gold');
      beam(face, pt(0, 0), pt(-1, 0.33), 0.16, 'gold');
      if (d >= 2)
        for (let j = 0; j < 12; j++) {
          const a = (j * Math.PI) / 6;
          beam(
            face,
            pt(1.56 * Math.cos(a), 1.56 * Math.sin(a)),
            pt(1.75 * Math.cos(a), 1.75 * Math.sin(a)),
            0.09,
            'gold',
          );
        }
      for (const y of [21, 27, 35, 42])
        for (const off of [-0.34, 0, 0.34]) {
          if ((f.normal[0] > 0.8 && y < 42) || (Math.abs(f.normal[1]) > 0.8 && y < 32)) continue;
          const q = lerp(f.a, f.b, 0.5 + off),
            blind = hole('tower-pale-blind-niche', q, f.axis, f.normal, 0.9, y, 1.8, 1.2, 'round');
          pane(face, blind, d, 0.07, 'trim');
        }
      for (const off of [-0.35, -0.12, 0.12, 0.35]) {
        const q = lerp(f.a, f.b, 0.5 + off),
          patch = hole(
            'tower-round-pale-patch',
            q,
            f.axis,
            f.normal,
            0.55,
            45.5,
            0.55,
            0.55,
            'round',
          );
        pane(face, patch, d, 0.06, 'trim');
      }
    }
    band(face, towerPlan, 55, 2, 'wall', 1.01);
    for (const [i] of towerPlan.entries()) {
      const f = faceFrame(towerPlan, i);
      if (f.length < 10) continue;
      const n = d >= 2 ? 9 : 4;
      for (let j = 0; j < n; j++) {
        const p = lerp(f.a, f.b, (j + 0.5) / n),
          h = hole('parapet-blind-recess', p, f.axis, f.normal, 0.55, 55.25, 1.25, 0.9, 'round');
        pane(face, h, d, 0.1, 'trim');
      }
    }
  }
  if (d >= 2) shell(out, d, belfryPlan, 55, 64, fields, 'belfry');
  else solid(face, belfryPlan, 55, 64, 'belfry');
  if (d)
    for (const h of fields) {
      pane(face, h, d, d >= 2 ? -0.75 : 0.08, 'belfry');
      archBand(face, h, d, 0.19, 'copper', 0.1);
      if (d >= 3) {
        const p = h.center.map((v, k) => v + h.normal[k] * -0.57);
        for (let j = 1; j < 6; j++) {
          const y = h.bottom + j * 0.85;
          beam(
            face,
            [p[0] - h.axis[0] * h.width * 0.44, y, p[1] - h.axis[1] * h.width * 0.44],
            [p[0] + h.axis[0] * h.width * 0.44, y, p[1] + h.axis[1] * h.width * 0.44],
            0.11,
            'belfry',
          );
        }
      }
    }
  profile(
    face,
    role('cornice'),
    [
      [64, 1.03],
      [65, 1.06],
      [67, 1],
    ],
    'copper',
  );
  const levels =
    d >= 2
      ? [
          [67, 1],
          [68.4, 0.86],
          [70.2, 0.74],
          [73, 0.58],
          [80, 0.29],
          [82.7, 0.05],
        ]
      : [
          [67, 1],
          [73, 0.58],
          [82.7, 0.05],
        ];
  profile(face, spirePlan, levels, 'copper');
  if (d) {
    // Narrow roof lights follow the taper. These are closed dark marks;the
    // large upper belfry also has closed shutters,as in the inspected views.
    for (let i = 0; i < spirePlan.length; i++) {
      const f = faceFrame(spirePlan, i);
      if (f.length < 5) continue;
      const p = lerp(f.a, f.b, 0.5),
        shape = openingShape(
          hole('roof-light', p, f.axis, f.normal, 0.7, 70.1, 2.5, 1.9, 'round'),
          d,
        ),
        point = ([u, y]) => {
          const t = 1 - (y - floor - 67) * (0.42 / 6),
            q = p.map(
              (v, k) =>
                towerCenter[k] + (v - towerCenter[k]) * t + f.axis[k] * u + f.normal[k] * 0.04,
            );
          return [q[0], y, q[1]];
        };
      face('belfry', shape.map(point), [f.normal[0], 0, f.normal[1]]);
    }
  }
  const orb = regular(towerCenter, 0.45, d >= 2 ? 12 : 6);
  profile(
    face,
    orb,
    [
      [82.7, 0.15],
      [83, 0.84],
      [83.3, 1],
      [83.6, 0.55],
      [83.7, 0.1],
    ],
    'gold',
  );
  beam(
    face,
    [towerCenter[0], floor + 83.5, towerCenter[1]],
    [towerCenter[0], floor + 85, towerCenter[1]],
    d ? 0.14 : 0.2,
    'gold',
  );
  if (d)
    beam(
      face,
      [towerCenter[0], floor + 84.55, towerCenter[1] - 0.49],
      [towerCenter[0], floor + 84.55, towerCenter[1] + 0.49],
      0.13,
      'gold',
    );
}
function build(out, d) {
  const stable = {
      addTriangle(slot, ref, points, _n, uv, color) {
        const emit = (q, tex, depth = 0) => {
          q = q.map((p) => p.map(Math.fround));
          const spans = [0, 2].map(
            (k) => Math.max(...q.map((p) => p[k])) - Math.min(...q.map((p) => p[k])),
          );
          if (Math.max(...spans) > (d === 0 ? 48 : d === 1 ? 24 : 16) && depth < 12) {
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
  tower(stable, face, d);
}
export const buildTurkuCathedralSkyline = (o) => build(o, 0),
  buildTurkuCathedralDistrict = (o) => build(o, 1),
  buildTurkuCathedralStreet = (o) => build(o, 2),
  buildTurkuCathedralCloseup = (o) => build(o, 3);
const cam = (name, p, look, fov = 48) => ({
  name,
  position: [p[0], floor + p[1], p[2]],
  lookAt: [look[0], floor + look[1], look[2]],
  fov,
});
export const turkuCathedralStudy = {
  id: 'N0351',
  key: 'turku_cathedral',
  title: 'Turku Cathedral',
  category: 'cathedral',
  wikidataId: 'Q1187606',
  generationCommand: 'node packages/worldgen/scripts/generate-additional-landmarks.mjs',
  mapFrame: 'map-frame.json',
  fidelityTarget: 'medium-fi',
  build: (o) => build(o, 4),
  surfaceOverrides: scope.surfaceOverrides,
  brief: rec.scope,
  sourceFacts: {
    horizontalBasis:
      'Exact-QID way437169589 and36 current cathedral/part controls. Native-X tower,native+X polygonal choir,native-Z projecting chapel,native+Z long aisle. Raw polygons and nave/north unions retain position/scale.',
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
    'Five existing 256-square Flemish brick,raw limestone,granite,copper and plain wood graphs. Roof/dark belfry/gold trim share copper with separate linear tints;stone patches/blind niches share limestone. Flat blue-gray glazing,metric UVs,hard architectural normals,no embedded images.',
  importReason:
    'Four browser levels retain the western brick/clock/dark belfry/copper spire,long clerestory and broad aisle roofs,north chapel and polygonal east choir at their mapped geographic position.',
  previewGround: false,
  previewTerrain: scope.previewTerrain,
  mediumFiContext: scope.mediumFiContext,
  geographic: () => scope.geographic,
  geographicNote: scope.geographicNote,
  limitations: [
    rec.heightBasis,
    scope.geographicNote,
    'Individual medium-fi exterior from two useful tower/whole-south pictures and standard viewer PMTiles/DEM. Main eave35m and northeast eave24.4m,sloping roof fields,wall/roof subdivisions,selected windows/closed doors,pale blind niches/clock marks,upper shutter fields,spire profile/closed roof-light marks and small1.8m choir finial are estimated. Exact plaster/brick weathering,sculpture,full interiors,adjacent city/plaza and certified walking excluded. Large belfry fields and small roof lights are closed;no bell interior claimed. Physical phone/laptop timings pending.',
    'Skyline preserves the complete stepped roof/tower/choir silhouette and estimated supporting volumes. District adds shared graphs,selected glazing/doors,pale patch/niche rhythms and clocks. Street opens real glazing/closed-door and upper-shutter recesses. Closeup/master refine clock ticks,selected window bars and shutter slats. Curvature,aperture and ornament changes remain visible.',
  ],
  camera: scope.camera,
  qaCameras: [
    cam('brick-west-tower-and-entry', [-91, 29, 24], [-34, 22, 4]),
    cam('clock-dark-belfry-and-copper-spire', [-86, 73, 46], [-37, 65, 4]),
    cam('long-south-clerestory-and-aisle', [-3, 39, 71], [-4, 26, 16]),
    cam('polygonal-eastern-choir', [84, 35, 45], [32, 25, 6]),
    cam('projecting-north-chapel-and-rounded-apse', [12, 37, -61], [9, 23, -10]),
    cam('closed-south-portal-and-pale-niches', [-1, 13, 44], [-4, 7, 24]),
  ],
};
