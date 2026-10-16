/** Bratislava St. Martin: mapped Gothic hall church and crowned western copper spire. */
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
  '../../../content/worldgen/source/places/u2/u2s/n0350_st_martin_s_cathedral_bratislava/',
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
  wall: '#d5d2bd',
  trim: '#c7c4b0',
  tile: '#9f5b46',
  copper: '#6f9a8c',
  gold: '#c8aa54',
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
const footing = (p) => Math.min(floor - 0.3, bratislavaGround(...p) - 0.35);
export function bratislavaGround(x, z) {
  const c = Math.cos(fit.heading),
    s = Math.sin(fit.heading);
  [x, z] = [x * c + z * s, -x * s + z * c];
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw Error('Bratislava cathedral footing outside retained terrain');
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
  role = (n) => rec.controls.find((b) => b.id === rec.roles[n]).polygons[0].outline,
  towerPlan = role('tower'),
  towerCenter = center(towerPlan),
  nave = R(-36.9, -13.25, 8.15, 13.2),
  chancel = [
    [7.95, -6.65],
    [31.2, -6.65],
    [35.7, -4.5],
    [36.65, -1.2],
    [36.5, 3],
    [33.8, 6.5],
    [7.95, 6.5],
  ];
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
export function bratislavaWindows() {
  const hs = [];
  for (const [side, z] of [
    [-1, -13.25],
    [1, 13.2],
  ])
    for (const x of [-26.5, -19.5, -12.5, -5.5, 1.5])
      hs.push(
        hole(`nave-${side}-${x}`, [x, z], [1, 0], [0, side], 1.85, 7.1, 9.0, 6.7, 'pointed', 4),
      );
  for (const i of [0, 1, 2, 3, 4, 5]) {
    const f = faceFrame(chancel, i),
      n = i === 0 || i === 5 ? 3 : 1;
    for (let j = 0; j < n; j++) {
      // The northern chapel occupies the first chancel bay.
      if (i === 0 && j === 0) continue;
      hs.push(
        hole(
          `chancel-${i}-${j}`,
          lerp(f.a, f.b, (j + 0.5) / n),
          f.axis,
          f.normal,
          1.55,
          6.3,
          10.5,
          8.0,
          'pointed',
          4,
        ),
      );
    }
  }
  hs.push(
    hole('west-central-lancet', [-36.9, -0.23], [0, 1], [-1, 0], 2.6, 9.5, 7.6, 5.6, 'pointed', 5),
  );
  for (const z of [-9.1, 8.7])
    hs.push(hole(`west-flank-${z}`, [-36.9, z], [0, 1], [-1, 0], 1.2, 5, 4.9, 3.4, 'pointed', 4));
  return hs;
}
export function bratislavaPortals() {
  const south = role('vestibule'),
    north = role('northChapel'),
    choose = (r, n) =>
      r
        .map((_, i) => faceFrame(r, i))
        .filter((f) => f.normal[1] * n > 0.7)
        .sort((a, b) => b.length - a.length)[0];
  return [
    [south, 1, 'south-vestibule', -9.8, 2.0, 3.5, 2.45],
    [north, -1, 'north-chapel', -7.3, 1.6, 3.4, 2.4],
  ].map(([r, n, name, x, w, h, s]) => {
    const f = choose(r, n),
      t = Math.max(0.2, Math.min(0.8, (x - f.a[0]) / (f.b[0] - f.a[0])));
    return hole(name, lerp(f.a, f.b, t), f.axis, f.normal, w, 0.1, h, s, 'pointed', 4);
  });
}
export function bratislavaBelfries() {
  return towerPlan.map((_, i) => {
    const f = faceFrame(towerPlan, i);
    return hole(
      `tower-bell-${i}`,
      lerp(f.a, f.b, 0.5),
      f.axis,
      f.normal,
      2.8,
      36.5,
      9.0,
      6.6,
      'pointed',
      6,
    );
  });
}
export function bratislavaLanternOpenings() {
  const r = regular(towerCenter, 2.0, 8, Math.PI / 8);
  return r.map((_, i) => {
    const f = faceFrame(r, i);
    return hole(
      `lantern-${i}`,
      lerp(f.a, f.b, 0.5),
      f.axis,
      f.normal,
      f.length * 0.7,
      63.3,
      3.9,
      3.15,
      'round',
      2,
    );
  });
}
function panel(face, h, d, recess = false, slot = 'glass') {
  pane(face, h, d, recess ? -1.25 : 0.06, slot);
  if (d) archBand(face, h, d, 0.28, 'trim', 0.11);
  if (d >= 2 && slot === 'glass') {
    const p = h.center.map((v, k) => v + h.normal[k] * (recess ? -1.08 : 0.18));
    beam(face, [p[0], h.bottom + 0.2, p[1]], [p[0], h.bottom + h.spring - 0.15, p[1]], 0.1);
    if (d >= 3) {
      const y = h.bottom + h.spring * 0.53,
        a = h.axis.map((v) => v * h.width * 0.43);
      beam(face, [p[0] - a[0], y, p[1] - a[1]], [p[0] + a[0], y, p[1] + a[1]], 0.075);
    }
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
function naveRoof(face) {
  const r = R(-37.15, -13.55, 8.5, 13.5),
    x0 = -37.15,
    x1 = 8.5,
    mid = -0.025;
  for (const side of [-1, 1]) {
    const z = side < 0 ? -13.55 : 13.5;
    face(
      'tile',
      [at([x0, z], 18), at([x1, z], 18), at([x1, mid], 34), at([x0, mid], 34)],
      [0, 1, 0],
    );
  }
  // The west gable has a real central gap occupied by the tower, so it cannot
  // cover the tower's rose field. The east gable rises above the lower chancel.
  for (const [x, n] of [
    [x0, -1],
    [x1, 1],
  ])
    for (const side of [-1, 1]) {
      const edge = side < 0 ? -13.55 : 13.5,
        inner = x === x0 ? (side < 0 ? -6.2155 : 5.7582) : mid,
        y = 18 + 16 * (1 - Math.abs((inner - mid) / 13.525));
      face('wall', [at([x, edge], 18), at([x, inner], 18), at([x, inner], y)], [n, 0, 0]);
      if (x === x0)
        face(
          'trim',
          [
            at([x - 0.05, edge], 18),
            at([x - 0.05, inner], y),
            at([x - 0.05, inner], y + 0.22),
            at([x - 0.05, edge], 18.22),
          ],
          [-1, 0, 0],
        );
    }
  band(face, r, 17.7, 0.35);
}
function buttress(face, p, axis, width, projection, height, d) {
  const n = [-axis[1], axis[0]],
    r = [
      [-width / 2, 0],
      [width / 2, 0],
      [width / 2, projection],
      [-width / 2, projection],
    ].map(([u, v]) => [p[0] + axis[0] * u + n[0] * v, p[1] + axis[1] * u + n[1] * v]);
  if (d === 0) {
    solid(face, r, 0.2, height * 0.83, 'wall');
    return;
  }
  solid(face, r, 0.05, height * 0.56, 'wall');
  const q = r.map((p, i) => (i < 2 ? p : lerp(p, r[3 - i], 0.32)));
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    face('trim', [
      at(r[i], height * 0.56),
      at(r[j], height * 0.56),
      at(q[j], height * 0.61),
      at(q[i], height * 0.61),
    ]);
  }
  solid(face, q, height * 0.61, height * 0.88, 'wall');
  const v = q.map((p, i) => (i < 2 ? p : lerp(p, q[3 - i], 0.48)));
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    face('trim', [
      at(q[i], height * 0.88),
      at(q[j], height * 0.88),
      at(v[j], height),
      at(v[i], height),
    ]);
  }
  cap(face, v, height, 'trim');
  if (d >= 3) band(face, r, height * 0.26, 0.17, 'trim', 1.015);
}
function body(out, face, d) {
  const windows = bratislavaWindows(),
    naveH = windows.filter((h) => h.name.startsWith('nave') || h.name.startsWith('west')),
    chancelH = windows.filter((h) => h.name.startsWith('chancel'));
  solid(face, rec.main.polygons[0].outline, footing, 0.15, 'trim');
  if (d >= 2) {
    shell(out, d, nave, 0.1, 18, naveH);
    shell(out, d, chancel, 0.1, 18.5, chancelH);
  } else {
    solid(face, nave, 0.1, 18, 'wall');
    solid(face, chancel, 0.1, 18.5, 'wall');
  }
  naveRoof(face);
  hip(face, chancel, 18.5, 25.03);
  band(face, chancel, 18.1, 0.35);
  if (d) for (const h of windows) panel(face, h, d, d >= 2);
  const portals = bratislavaPortals();
  for (const [name, eave, top, axis] of [
    ['northChapel', 9.5, 13.5, 0],
    ['eastChapel', 11.5, 15.5, 1],
    ['vestibule', 5.3, 8, 1],
  ]) {
    const r = role(name),
      hs = portals.filter((h) =>
        name === 'vestibule'
          ? h.name === 'south-vestibule'
          : name === 'northChapel'
            ? h.name === 'north-chapel'
            : false,
      );
    if (d >= 2) shell(out, d, r, 0.05, eave, hs);
    else solid(face, r, 0.05, eave, 'wall');
    hip(face, r, eave, top, 'tile', axis);
    band(face, r, eave - 0.22, 0.22);
    if (d) for (const h of hs) panel(face, h, d, d >= 2, 'door');
  }
  for (const side of [-1, 1])
    for (const x of [-33.7, -23, -16, -9, -2, 5.4])
      buttress(face, [x, side < 0 ? -13.1 : 13.05], side < 0 ? [-1, 0] : [1, 0], 0.85, 2.35, 18, d);
  for (const side of [-1, 1])
    for (const x of [14.5, 21.5, 28.7])
      buttress(face, [x, side < 0 ? -6.5 : 6.35], side < 0 ? [-1, 0] : [1, 0], 0.72, 2.4, 18.5, d);
  for (const [p, n] of [
    [
      [31.2, -6.5],
      [0.55, -0.83],
    ],
    [
      [36.45, -0.6],
      [1, 0],
    ],
    [
      [33.6, 6.4],
      [0.65, 0.76],
    ],
  ])
    buttress(face, p, [n[1], -n[0]], 0.7, 2.1, 18.5, d);
  if (d) {
    for (const z of [-12.2, 11.9]) {
      const p = [-37.25, z];
      solid(face, rect(p, 0.6, 0.6), 17.8, 22.2, 'trim');
      profile(
        face,
        rect(p, 0.75, 0.75),
        [
          [22.2, 1],
          [24, 0.07],
        ],
        'trim',
      );
    }
    const r = role('pinnacle');
    solid(face, r, 17.8, 23.5, 'trim');
    profile(
      face,
      scaled(r, 1.5),
      [
        [23.5, 1],
        [25.5, 0.04],
      ],
      'trim',
    );
  }
}
function disc(face, h, y, r, slot, d, offset = 0.12) {
  const n = d >= 3 ? 24 : d >= 2 ? 16 : 8,
    p = h.center.map((v, k) => v + h.normal[k] * offset),
    ring = Array.from({ length: n }, (_, i) => {
      const a = (i * 2 * Math.PI) / n;
      return [
        p[0] + h.axis[0] * r * Math.cos(a),
        floor + y + r * Math.sin(a),
        p[1] + h.axis[1] * r * Math.cos(a),
      ];
    });
  face(slot, ring, [h.normal[0], 0, h.normal[1]]);
}
function tower(out, face, d) {
  const lower = bratislavaWindows().filter((h) => h.name === 'west-central-lancet'),
    bell = bratislavaBelfries();
  if (d >= 2) {
    shell(out, d, towerPlan, 0.1, 35.7, lower);
    shell(out, d, towerPlan, 35.7, 50, bell, 'wall', scaled(towerPlan, 0.7));
    cap(face, scaled(towerPlan, 0.7), 35.7, 'trim');
  } else solid(face, towerPlan, 0.1, 50, 'wall');
  if (d) {
    for (const h of bell) {
      if (d === 1) pane(face, h, d, 0.08);
      archBand(face, h, d, 0.36, 'trim', 0.13);
    }
    for (const y of [18.5, 34.8, 46.1, 49.55])
      band(face, towerPlan, y, y === 49.55 ? 0.45 : 0.26, 'trim', 1.025);
    for (const h of bell) {
      disc(face, h, 47.7, 1.38, 'trim', d, 0.15);
      disc(face, h, 47.7, 1.12, 'wall', d, 0.17);
      const pt = (u, v) => [
        h.center[0] + h.axis[0] * u + h.normal[0] * 0.21,
        floor + 47.7 + v,
        h.center[1] + h.axis[1] * u + h.normal[1] * 0.21,
      ];
      beam(face, pt(0, 0), pt(-0.48, 0.45), 0.1, 'glass');
      beam(face, pt(0, 0), pt(0.08, 0.78), 0.09, 'glass');
      if (d >= 3)
        for (let i = 0; i < 12; i++) {
          const a = (i * Math.PI) / 6;
          beam(
            face,
            pt(0.92 * Math.cos(a), 0.92 * Math.sin(a)),
            pt(1.04 * Math.cos(a), 1.04 * Math.sin(a)),
            0.05,
            'glass',
          );
        }
    }
    const west = bell.reduce((a, b) => (a.normal[0] < b.normal[0] ? a : b));
    disc(face, west, 32.3, 1.15, 'trim', d);
    disc(face, west, 32.3, 0.88, 'glass', d, 0.14);
    if (d >= 2)
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4,
          p = west.center.map((v, k) => v + west.normal[k] * 0.19);
        beam(
          face,
          [p[0], floor + 32.3, p[1]],
          [
            p[0] + west.axis[0] * 0.83 * Math.cos(a),
            floor + 32.3 + 0.83 * Math.sin(a),
            p[1] + west.axis[1] * 0.83 * Math.cos(a),
          ],
          0.09,
        );
      }
  }
  profile(
    face,
    towerPlan,
    [
      [50, 1.09],
      [50.7, 1.09],
      [53, 0.7],
    ],
    'copper',
  );
  const oct = regular(towerCenter, 4.1, d === 0 ? 8 : d === 1 ? 8 : 16, Math.PI / 8),
    stages =
      d >= 2
        ? [
            [53, 0.88],
            [54, 0.94],
            [56, 1.03],
            [58, 1],
            [60, 0.86],
            [62, 0.6],
            [63, 0.49],
          ]
        : [
            [53, 0.88],
            [57, 1.03],
            [60, 0.86],
            [63, 0.49],
          ];
  profile(face, oct, stages, 'copper');
  const lantern = regular(towerCenter, 2, 8, Math.PI / 8),
    lh = bratislavaLanternOpenings();
  if (d >= 2) {
    shell(out, d, lantern, 63, 68, lh, 'copper', scaled(lantern, 0.73));
    cap(face, scaled(lantern, 0.73), 63, 'copper');
  } else solid(face, lantern, 63, 68, 'copper');
  if (d === 1) for (const h of lh) pane(face, h, d, 0.04, 'glass');
  profile(
    face,
    lantern,
    [
      [68, 1.16],
      [68.5, 1.17],
      [69, 0.93],
    ],
    'copper',
  );
  profile(
    face,
    lantern,
    [
      [69, 0.93],
      [73, 0.65],
      [80, 0.26],
      [83.5, 0.025],
    ],
    'copper',
  );
  if (d >= 2) {
    const n = d >= 3 ? 8 : 4;
    for (let i = 0; i < n; i++) {
      const a = (i * 2 * Math.PI) / n + Math.PI / 8,
        levels = [
          ...stages.map(([y, f]) => [y, 4.1 * f + 0.05]),
          [68, 2.05],
          [69, 1.9],
          [73, 1.34],
          [80, 0.55],
          [83.5, 0.08],
        ];
      for (let j = 1; j < levels.length; j++) {
        // The lantern stays open; ribs resume on the upper spire.
        if (levels[j - 1][0] === 63) continue;
        const pt = ([y, r]) => [
          towerCenter[0] + r * Math.cos(a),
          floor + y,
          towerCenter[1] + r * Math.sin(a),
        ];
        beam(face, pt(levels[j - 1]), pt(levels[j]), 0.08, 'gold');
      }
    }
  }
  const crown = regular(towerCenter, 0.67, d >= 2 ? 12 : 6);
  solid(face, crown, 83.5, 83.75, 'gold');
  if (d)
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2,
        points = Array.from({ length: d >= 2 ? 7 : 4 }, (_, j) => {
          const t = j / ((d >= 2 ? 7 : 4) - 1),
            r = 0.64 * Math.cos((t * Math.PI) / 2);
          return [
            towerCenter[0] + r * Math.cos(a),
            floor + 83.75 + 0.8 * Math.sin((t * Math.PI) / 2),
            towerCenter[1] + r * Math.sin(a),
          ];
        });
      for (let j = 1; j < points.length; j++) beam(face, points[j - 1], points[j], 0.1, 'gold');
    }
  profile(
    face,
    regular(towerCenter, 0.18, 6),
    [
      [84.45, 0.5],
      [84.65, 1],
      [84.85, 0.5],
      [85, 0.01],
    ],
    'gold',
  );
}
function build(out, d) {
  // Split broad faces before the viewer's triangle-bound footprint rasterization.
  // Recompute normals after Float32 conversion, keeping independent GPU streams.
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
export const buildBratislavaSkyline = (o) => build(o, 0),
  buildBratislavaDistrict = (o) => build(o, 1),
  buildBratislavaStreet = (o) => build(o, 2),
  buildBratislavaCloseup = (o) => build(o, 3);
const cam = (name, p, look, fov = 48) => ({
  name,
  position: [p[0], floor + p[1], p[2]],
  lookAt: [look[0], floor + look[1], look[2]],
  fov,
});
export const bratislavaStudy = {
  id: 'N0350',
  key: 'st_martin_s_cathedral_bratislava',
  title: "St. Martin's Cathedral, Bratislava",
  category: 'cathedral',
  wikidataId: 'Q239560',
  generationCommand: 'node packages/worldgen/scripts/generate-additional-landmarks.mjs',
  mapFrame: 'map-frame.json',
  fidelityTarget: 'medium-fi',
  build: (o) => build(o, 4),
  surfaceOverrides: scope.surfaceOverrides,
  brief: rec.scope,
  sourceFacts: {
    horizontalBasis:
      'Exact-QID retained cathedral parent and seven current mapped part plans;western tower,eastern chancel,northern chapels,southern vestibule and small northwest pinnacle retained without overall rescaling.',
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
    'Five existing 256-square lime plaster,raw limestone,ceramic tile,copper and wood graphs. Green copper and restrained golden ribs/crown share the copper graph with separate linear tints. Flat blue-gray glazing,metric UVs,flat architectural normals,no embedded images.',
  importReason:
    'Four browser levels retain the single western crowned copper spire,steep red nave,lower polygonal chancel,northern chapels,southern vestibule and stepped buttresses at their mapped geographic position.',
  previewGround: false,
  previewTerrain: scope.previewTerrain,
  mediumFiContext: scope.mediumFiContext,
  geographic: () => scope.geographic,
  geographicNote: scope.geographicNote,
  limitations: [
    rec.heightBasis,
    scope.geographicNote,
    'Individual medium-fi exterior from two useful inspected pictures and standard PMTiles/DEM. Map tower/nave/chancel/east chapel/vestibule heights retained. Other eaves,wall core/roof subdivisions,buttresses,openings,clock/rose fields,copper bulb/lantern,spire and abstract crown are picture-led estimates. Exact crown insignia,sculpture,tracery,full interiors,adjacent city walls/buildings and certified walking excluded. Physical device timings pending.',
    'Skyline preserves principal masses,steep roof,single copper spire,crown and coarse buttresses. District adds shared graphs,selected flat lancets/closed doors/clocks/pinnacles. Street adds real recessed glazing/portals and open belfry/lantern with selected ribs. Closeup/master refine copper curve,clock marks and window mullions. Changes in curvature and small ornament remain visible.',
  ],
  camera: scope.camera,
  qaCameras: [
    cam('west-gable-and-embedded-tower', [-94, 42, 14], [-19, 25, 0]),
    cam('open-belfry-copper-lantern-and-crown', [-78, 69, 43], [-32, 59, 0]),
    cam('south-vestibule-closed-recessed-portal', [-45, 16, 40], [-10, 6, 17]),
    cam('nave-lancets-and-stepped-buttresses', [-7, 27, 51], [-8, 17, 11]),
    cam('lower-polygonal-eastern-chancel', [74, 29, 37], [24, 17, 0]),
    cam('northern-chapels-and-roof-stages', [-1, 25, -43], [1, 10, -11]),
  ],
};
