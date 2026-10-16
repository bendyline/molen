/** Königsberg Cathedral: mapped asymmetric westwork,long roof and open Kant tomb. */
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
  '../../../content/worldgen/source/places/u3/u3w/n0353_konigsberg_cathedral/',
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
  wall: '#b9745a',
  trim: '#dac69c',
  roof: '#596169',
  copper: '#70877e',
  door: '#69503e',
  glass: '#4d6178',
  stone: '#a98576',
  gold: '#bea469',
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
const _rect = (p, w, h) => [
  [p[0] - w / 2, p[1] - h / 2],
  [p[0] + w / 2, p[1] - h / 2],
  [p[0] + w / 2, p[1] + h / 2],
  [p[0] - w / 2, p[1] + h / 2],
];
const scaled = (r, f) => {
  const p = center(r);
  return r.map((q) => q.map((v, k) => p[k] + (v - p[k]) * f));
};
const footing = (p) => Math.min(floor - 0.3, konigsbergGround(...p) - 0.35);
export function konigsbergGround(x, z) {
  const c = Math.cos(fit.heading),
    s = Math.sin(fit.heading);
  [x, z] = [x * c + z * s, -x * s + z * c];
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw Error('Königsberg cathedral footing outside retained terrain');
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
const R = (x0, z0, x1, z1) => [
    [x0, z0],
    [x1, z0],
    [x1, z1],
    [x0, z1],
  ],
  role = (n) => rec.controls.find((b) => b.id === rec.roles[n]).polygons[0].outline;
const south = role('southTower'),
  north = role('northTower'),
  middle = role('westCenter'),
  octagon = role('octagon'),
  spireCenter = center(octagon),
  nave = role('nave'),
  choir = role('choir');
const hole = (name, p, a, n, w, b, h, s = h, shape = 'pointed', depth = 4) => ({
  name,
  center: p,
  axis: a,
  normal: n,
  width: w,
  bottom: floor + b,
  height: h,
  spring: s,
  shape,
  depth,
});
export function konigsbergWindows() {
  const hs = [];
  for (const [side, z] of [
    [-1, -23.25],
    [1, 5.3],
  ])
    for (const x of [-1.2, 6.8, 15, 23, 31.5]) {
      if (side < 0 && x === 15) continue;
      hs.push(hole(`nave-${side}-${x}`, [x, z], [1, 0], [0, side], 2.25, 1.7, 5.3, 3.8));
    }
  for (const [side, z] of [
    [-1, -16.65],
    [1, -2.35],
  ])
    for (const x of [49.5, 56.7, 63.9, 71])
      for (const [y, h] of [
        [1.6, 3.6],
        [6, 3.5],
      ]) {
        if ((side < 0 && x === 71) || (side > 0 && x === 56.7)) continue;
        hs.push(hole(`choir-${side}-${x}-${y}`, [x, z], [1, 0], [0, side], 2.5, y, h, h - 1));
      }
  hs.push(hole('choir-south-projection', [58.9, -0.65], [1, 0], [0, 1], 2.25, 1.5, 4.8, 3.4));
  for (const z of [-19.5, 1.8])
    hs.push(hole(`west-flank-${z}`, [-17.7, z], [0, 1], [-1, 0], 1.4, 0.8, 3.7, 2.6));
  return hs;
}
export const konigsbergDoor = () =>
  hole('west-main-door', [-17.72, -8.1], [0, 1], [-1, 0], 3.4, 0.1, 4.4, 2.7, 'pointed', 5);
export function konigsbergBlindPanels() {
  const hs = [];
  for (const z of [-22, -19.5, -17, -14.5, -11.9, -9.3, -6.7, -4.1, -1.5, 1.1, 3.7])
    for (const [b, h] of [
      [8.8, 5.5],
      [14.8, 4.8],
    ])
      hs.push(
        hole(`west-panel-${z}-${b}`, [-17.72, z], [0, 1], [-1, 0], 1.45, b, h, h - 1, 'pointed', 3),
      );
  for (const z of [-22, -18, -14, -9.5, -5, -0.5, 3.5])
    hs.push(hole(`west-lower-blind-${z}`, [-17.72, z], [0, 1], [-1, 0], 2.1, 4.65, 3.55, 2.6));
  return hs;
}
function panel(face, h, d, slot = 'glass', recess = false) {
  pane(face, h, d, recess ? -1.18 : 0.16, slot);
  if (d) archBand(face, h, d, 0.18, 'trim', 0.21);
  if (d >= 2 && slot === 'glass') {
    const p = h.center.map((v, k) => v + h.normal[k] * (recess ? -1.02 : 0.22));
    beam(
      face,
      [p[0], h.bottom + 0.1, p[1]],
      [p[0], h.bottom + h.spring - 0.1, p[1]],
      0.085,
      'trim',
    );
    if (d >= 3) {
      const y = h.bottom + h.spring * 0.5,
        a = h.axis.map((v) => v * h.width * 0.44);
      beam(face, [p[0] - a[0], y, p[1] - a[1]], [p[0] + a[0], y, p[1] + a[1]], 0.06, 'trim');
    }
  }
}
function gable(face, r, eave, top, slot = 'roof', axis = 0) {
  const k = 1 - axis,
    xs = r.map((p) => p[axis]),
    zs = r.map((p) => p[k]),
    lo = Math.min(...xs),
    hi = Math.max(...xs),
    z0 = Math.min(...zs),
    z1 = Math.max(...zs),
    mid = (z0 + z1) / 2,
    point = (x, z) => (axis === 0 ? [x, z] : [z, x]);
  for (const z of [z0, z1])
    face(
      slot,
      [
        at(point(lo, z), eave),
        at(point(hi, z), eave),
        at(point(hi, mid), top),
        at(point(lo, mid), top),
      ],
      [0, 1, 0],
    );
  for (const [x, n] of [
    [lo, -1],
    [hi, 1],
  ])
    face(
      'wall',
      [at(point(x, z0), eave), at(point(x, z1), eave), at(point(x, mid), top)],
      axis === 0 ? [n, 0, 0] : [0, 0, n],
    );
}
function frontGable(face, x, z0, z1, base, top, d) {
  face('wall', [at([x, z0], base), at([x, z1], base), at([x, (z0 + z1) / 2], top)], [-1, 0, 0]);
  if (d) {
    for (const z of [z0, z1])
      beam(face, at([x - 0.12, z], base), at([x - 0.12, (z0 + z1) / 2], top), 0.23, 'wall');
    for (const z of [z0 + 1.6, z1 - 1.6])
      panel(
        face,
        hole('gable-blind', [x - 0.03, z], [0, 1], [-1, 0], 0.85, base + 0.6, 2.3, 1.7),
        d,
        'trim',
      );
  }
}
function clock(face, p, n, d) {
  const a = [-n[1], n[0]],
    r = 1.35,
    segments = d >= 3 ? 32 : 16,
    pts = Array.from({ length: segments }, (_, i) => {
      const q = (i * 2 * Math.PI) / segments;
      return [p[0] + a[0] * r * Math.cos(q), p[1] + r * Math.sin(q), p[2] + a[1] * r * Math.cos(q)];
    });
  face('glass', pts, [n[0], 0, n[1]], colors.roof);
  const outer = pts.map((v) => [
    v[0] + (v[0] - p[0]) * 0.08,
    v[1] + (v[1] - p[1]) * 0.08,
    v[2] + (v[2] - p[2]) * 0.08,
  ]);
  for (let i = 0; i < segments; i++) {
    const j = (i + 1) % segments;
    face('gold', [outer[i], outer[j], pts[j], pts[i]], [n[0], 0, n[1]]);
  }
  const shift = (v) => [v[0] + n[0] * 0.05, v[1], v[2] + n[1] * 0.05],
    hand = (angle, length) =>
      beam(
        face,
        shift(p),
        shift([
          p[0] + a[0] * length * Math.sin(angle),
          p[1] + length * Math.cos(angle),
          p[2] + a[1] * length * Math.sin(angle),
        ]),
        0.09,
        'gold',
      );
  hand(0.25, 1);
  hand(2.1, 0.75);
  if (d >= 3)
    for (let i = 0; i < 12; i++) {
      const q = (i * 2 * Math.PI) / 12,
        pt = (r) =>
          shift([
            p[0] + a[0] * r * Math.sin(q),
            p[1] + r * Math.cos(q),
            p[2] + a[1] * r * Math.sin(q),
          ]);
      beam(face, pt(1.05), pt(1.22), 0.07, 'gold');
    }
}
function body(out, face, d) {
  if (d === 0) sides(face, rec.main.polygons[0].outline, footing, 0.12, 'stone');
  else solid(face, rec.main.polygons[0].outline, footing, 0.12, 'stone');
  const ws = konigsbergWindows(),
    door = konigsbergDoor();
  for (const [name, r, height] of [
    ['nave', nave, 8],
    ['choir', choir, 11],
    ['south', south, 20],
    ['middle', middle, 20],
    ['north', north, 20],
  ]) {
    const hs =
      name === 'nave'
        ? ws.filter((h) => h.name.startsWith('nave'))
        : name === 'choir'
          ? ws.filter((h) => h.name.startsWith('choir'))
          : name === 'middle'
            ? [door]
            : ws.filter(
                (h) =>
                  h.name.startsWith('west-flank') &&
                  (name === 'south'
                    ? h.center[1] > -8
                    : name === 'north'
                      ? h.center[1] < -12
                      : false),
              );
    if (d >= 2) shell(out, d, r, 0.12, height, hs);
    else sides(face, r, 0.12, height, 'wall');
    cap(face, r, height, 'wall');
    if (d) band(face, r, height - 0.18, 0.25, 'trim', 1.005);
  }
  gable(face, R(-6.9, -23.8, 38.8, 5.65), 8, 24);
  gable(face, R(38.65, -16.95, 79.2, -2.05), 11, 24);
  // Lower southern shoulder where the broad nave narrows to the choir.
  gable(face, R(38.65, -2.05, 46.4, 5.6), 8, 12, 'roof', 1);
  gable(face, R(-17.8, -24.05, -6.5, -12.1), 20, 26, 'wall');
  frontGable(face, -17.82, -24.05, -12.1, 20, 26, d);
  gable(face, R(-17.8, -12.4, -6.5, -3.2), 20, 25, 'wall');
  frontGable(face, -17.83, -12.4, -3.2, 20, 25, d);
  // Shallow hipped apron below the octagonal clock stage.
  profile(
    face,
    scaled(south, 1.025),
    [
      [20, 1],
      [21.5, 0.78],
    ],
    'roof',
  );
  if (d) {
    for (const h of ws) panel(face, h, d, 'glass', d >= 2);
    panel(face, door, d, 'door', d >= 2);
    for (const h of konigsbergBlindPanels()) {
      panel(face, h, d, 'trim');
      if (d >= 2 && Math.round((h.center[1] + 22) / 2.5) % 3 === 0)
        panel(
          face,
          {
            ...h,
            width: 0.62,
            bottom: h.bottom + 0.3,
            height: h.height - 0.55,
            spring: h.spring - 0.4,
          },
          d,
          'glass',
        );
    }
    // Long shallow pale arch cadence immediately below both roof eaves.
    for (const [z, lo, hi, y, n] of [
      [-23.84, -5, 37, 7.4, -1],
      [5.7, -5, 37, 7.4, 1],
      [-17, 40, 77, 10.4, -1],
      [-2, 47, 77, 10.4, 1],
    ])
      for (let x = lo; x < hi; x += 3.6)
        pane(
          face,
          hole('cornice', [x, z], [1, 0], [0, n], 1.6, y - 0.65, 0.65, 0.35),
          d,
          0.06,
          'trim',
        );
  }
  // Raw mapped buttress plans keep the real irregular ground silhouette.
  for (const b of rec.controls.filter(
    (b) => b.properties.kind === 'building_part' && !Object.values(rec.roles).includes(b.id),
  )) {
    const r = b.polygons[0].outline,
      ct = center(r),
      height = ct[0] > 42 ? 9 : ct[0] < -6 ? 7 : 7.2;
    if (b.id === 35185836282870) {
      const hs = ws.filter((h) => h.name === 'choir-south-projection');
      if (d >= 2) shell(out, d, r, 0.1, 7.4, hs);
      else sides(face, r, 0.1, 7.4, 'wall');
      gable(face, r, 7.4, 8.4, 'roof', 1);
      continue;
    }
    if (d === 0) {
      sides(face, r, 0.1, height * 0.8, 'wall');
      cap(face, r, height * 0.8, 'wall');
      continue;
    }
    solid(face, r, 0.1, height * 0.55, 'wall');
    const q = scaled(r, 0.65);
    for (let i = 0; i < r.length; i++) {
      const j = (i + 1) % r.length;
      face('stone', [
        at(r[i], height * 0.55),
        at(r[j], height * 0.55),
        at(q[j], height * 0.64),
        at(q[i], height * 0.64),
      ]);
    }
    solid(face, q, height * 0.64, height, 'wall');
    cap(face, q, height, 'stone');
  }
}
function towers(_out, face, d) {
  solid(face, octagon, 21.2, 30, 'wall');
  band(face, octagon, 29.7, 0.4, 'wall', 1.035);
  profile(
    face,
    octagon,
    [
      [30, 1.12],
      [31, 1.06],
      [33, 0.85],
      [39, 0.48],
      [46, 0.17],
      [49.7, 0.025],
    ],
    'copper',
  );
  beam(face, at(spireCenter, 49.65), at(spireCenter, 50.75), d >= 2 ? 0.08 : 0.12, 'gold');
  if (d) {
    const p = at(spireCenter, 50.25);
    beam(face, [p[0] - 0.35, p[1], p[2]], [p[0] + 0.8, p[1], p[2]], 0.07, 'gold');
  }
  if (d) {
    for (let i = 0; i < octagon.length; i++) {
      const f = faceFrame(octagon, i),
        p = lerp(f.a, f.b, 0.5);
      panel(
        face,
        hole(`drum-blind-${i}`, p, f.axis, f.normal, f.length * 0.5, 22.7, 4.7, 3.7),
        d,
        'trim',
      );
      if (d >= 2)
        panel(face, hole(`drum-slot-${i}`, p, f.axis, f.normal, 0.45, 21.7, 0.8, 0.5), d, 'glass');
      if (f.normal[0] < -0.6 || f.normal[1] > 0.6)
        clock(
          face,
          [p[0] + f.normal[0] * 0.22, floor + 28.4, p[1] + f.normal[1] * 0.22],
          f.normal,
          d,
        );
    }
    const r = regular(
      role('roofTurret').reduce(
        (a, p) => a.map((v, k) => v + p[k] / role('roofTurret').length),
        [0, 0],
      ),
      1.0,
      d >= 2 ? 8 : 6,
    );
    solid(face, r, 23.6, 24.7, 'copper');
    profile(
      face,
      scaled(r, 1.2),
      [
        [24.7, 1],
        [26, 0.02],
      ],
      'copper',
    );
    if (d >= 2)
      for (const x of [3, 17, 29, 54, 68]) {
        const z = x < 39 ? -0.5 : -4.8,
          y = x < 39 ? 18.4 : 18.9,
          r = R(x - 0.55, z - 0.55, x + 0.55, z + 0.55);
        solid(face, r, y, y + 0.6, 'roof');
        gable(face, r, y + 0.6, y + 1.2, 'roof');
      }
  } else {
    const r = role('roofTurret');
    profile(
      face,
      scaled(r, 0.6),
      [
        [23.7, 1],
        [26, 0.02],
      ],
      'copper',
    );
  }
  const er = role('eastTurret');
  solid(face, er, 10.7, 12.2, 'wall');
  profile(
    face,
    scaled(er, 1.08),
    [
      [12.2, 1],
      [14, 0.02],
    ],
    'roof',
  );
}
function tomb(face, d) {
  const r = role('tomb'),
    xs = r.map((p) => p[0]),
    zs = r.map((p) => p[1]),
    x0 = Math.min(...xs),
    x1 = Math.max(...xs),
    z0 = Math.min(...zs),
    z1 = Math.max(...zs),
    width = x1 - x0,
    depth = z1 - z0;
  solid(face, r, footing, 0.18, 'stone');
  solid(face, r, 9.7, 10.4, 'stone');
  for (const [x, _n] of [
    [x0, 0],
    [x1, 0],
  ])
    for (let i = 0; i < (d === 0 ? 3 : 4); i++) {
      const z = z0 + 0.45 + ((depth - 0.9) * i) / (d === 0 ? 2 : 3);
      solid(face, R(x + 0.13 - 0.48, z - 0.48, x + 0.13 + 0.48, z + 0.48), 0.18, 9.7, 'stone');
    }
  for (const x of [x0 + width / 3, x0 + (width * 2) / 3])
    solid(face, R(x - 0.45, z0 + 0.1, x + 0.45, z0 + 0.95), 0.18, 9.7, 'stone');
  // The monument is backed by a separate shallow screen; the side bays remain open.
  const screen = R(x0 + 1.7, z1 - 1.1, x1 - 1.5, z1 - 0.45);
  solid(face, screen, 0.2, 6.2, 'stone');
  const stone = R(x0 + 3.3, z1 - 4, x1 - 3.1, z1 - 1.5);
  solid(face, stone, 0.2, 0.55, 'trim');
  profile(
    face,
    scaled(stone, 0.85),
    [
      [0.55, 1],
      [1.2, 0.8],
    ],
    'trim',
  );
  if (d >= 2) {
    const f = faceFrame(screen, 0),
      p = lerp(f.a, f.b, 0.5);
    pane(
      face,
      hole('tomb-plain-plaque', p, f.axis, f.normal, 3, 4.1, 0.75, 0.75, 'rect'),
      d,
      0.08,
      'trim',
    );
  }
}
function build(out, d) {
  const base = writer(out, d),
    face = (slot, p, n, col) => {
      const max = d === 0 ? 48 : d === 1 ? 24 : 16;
      function split(t) {
        const edges = t.map((a, i) => Math.hypot(...a.map((v, k) => v - t[(i + 1) % 3][k]))),
          length = Math.max(...edges),
          i = edges.indexOf(length);
        if (length <= max) {
          base(slot, t, n, col);
          return;
        }
        const j = (i + 1) % 3,
          k = (i + 2) % 3,
          mid = lerp(t[i], t[j], 0.5);
        split([t[i], mid, t[k]]);
        split([mid, t[j], t[k]]);
      }
      for (let i = 1; i < p.length - 1; i++) split([p[0], p[i], p[i + 1]]);
    };
  body(out, face, d);
  towers(out, face, d);
  tomb(face, d);
}
export const buildKonigsbergSkyline = (o) => build(o, 0),
  buildKonigsbergDistrict = (o) => build(o, 1),
  buildKonigsbergStreet = (o) => build(o, 2),
  buildKonigsbergCloseup = (o) => build(o, 3);
const cam = (name, p, look) => ({
  name,
  position: [p[0], floor + p[1], p[2]],
  lookAt: [look[0], floor + look[1], look[2]],
  fov: 48,
});
export const konigsbergStudy = {
  id: 'N0353',
  key: 'konigsberg_cathedral',
  title: 'Königsberg Cathedral',
  category: 'cathedral',
  wikidataId: 'Q225459',
  generationCommand: 'node packages/worldgen/scripts/generate-additional-landmarks.mjs',
  mapFrame: 'map-frame.json',
  fidelityTarget: 'medium-fi',
  build: (o) => build(o, 4),
  surfaceOverrides: scope.surfaceOverrides,
  brief: rec.scope,
  sourceFacts: {
    horizontalBasis:
      'Unscaled current main,26 parts and northeast tomb map plans around named organ hall/Kant museum/tomb POIs. Signed western facade/eastern choir/southern tall spire resolved with pictures;exact-QID polygon identity remains unverified.',
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
    'Five existing 256-square brick,raw limestone,standing-seam metal,copper and plain wood graphs. Warm brick walls,cream blind panels,pink stone colonnade,dark gray metal roof and subdued green spire. Clock gold shares copper;glazing is flat blue-gray. Metric UVs,hard architectural normals,no embedded images.',
  importReason:
    'Four browser levels preserve asymmetric westwork,long steep nave/choir roof,green southern spire and open northeast tomb at their approximate reviewed geographic position.',
  previewGround: false,
  previewTerrain: scope.previewTerrain,
  mediumFiContext: scope.mediumFiContext,
  geographic: () => scope.geographic,
  geographicNote: scope.geographicNote,
  limitations: [
    rec.heightBasis,
    scope.geographicNote,
    'Exterior approximation from four useful pictures and standard PMTiles/DEM. Nave/choir height tags are interpreted as eaves;estimated ridge and gable/clock-drum subdivisions,paired lancets,west blind-panel cadence,tomb height/columns/screen and roof vents are picture-led. No exact historical tracery,lettering,clock numerals,sculpture,full interiors or certified walking. Absolute altitude/thresholds and physical device timings pending.',
    'Skyline preserves principal masses and open tomb bays with simplified buttresses/columns. District adds shared surfaces,flat pointed windows/closed door,blind panels/clocks and cornice rhythm. Street opens real facade recesses with mullions;closeup/master refine frames,clock marks and roof vents. Curvature,windows,ornament and tomb-column cadence change visibly. Synthetic cottage neighbors are diagnostic context,not local map buildings.',
  ],
  camera: scope.camera,
  qaCameras: [
    cam('asymmetric-westwork', [-53, 23, 9], [-17, 14, -10]),
    cam('octagonal-clock-and-green-spire', [-37, 35, 30], [-12, 31, 1]),
    cam('long-nave-roof', [23, 38, 35], [18, 15, -9]),
    cam('paired-choir-windows', [59, 13, 19], [59, 6, -2]),
    cam('open-northeast-tomb', [102, 16, -43], [77, 5, -20]),
    cam('northern-gable-and-nave', [-40, 25, -52], [-7, 15, -16]),
  ],
};
