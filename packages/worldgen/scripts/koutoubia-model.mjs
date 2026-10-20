/** Koutoubia: mapped brown nave roofs,open courts and a tall square minaret with tile friezes and globe finial. */
import './install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import earcut from 'earcut';
import { cross, normalFor } from './authored-structure-mesh.mjs';
import {
  openingShape as baseOpeningShape,
  prepareOpening as basePrepareOpening,
  openingBuilder,
  openingReveals,
} from './authored-wall-openings.mjs';

const openingShape = (h, d) => {
  if (h.shape === 'horseshoe') {
    const r = h.width / 2,
      ry = (h.height - h.spring) / 1.5,
      n = d === 0 ? 4 : d === 1 ? 6 : d === 2 ? 10 : d === 3 ? 14 : 18,
      neck = Math.cos(Math.PI / 6) * r,
      cy = h.bottom + h.spring + ry * 0.5;
    return [
      [-neck, h.bottom],
      [neck, h.bottom],
      ...Array.from({ length: n + 1 }, (_, i) => {
        const a = -Math.PI / 6 + ((i / n) * Math.PI * 4) / 3;
        return [r * Math.cos(a), cy + ry * Math.sin(a)];
      }),
    ];
  }
  if (h.shape === 'pointed') {
    const w = h.width / 2,
      n = d <= 0 ? 1 : d === 1 ? 2 : d === 2 ? 3 : d === 3 ? 5 : 6,
      points = [
        [-w, h.bottom],
        [w, h.bottom],
        [w, h.bottom + h.spring],
      ];
    for (let i = 1; i <= n; i++) {
      const a = ((i / n) * Math.PI) / 3;
      points.push([
        -w + 2 * w * Math.cos(a),
        h.bottom + h.spring + ((h.height - h.spring) * Math.sin(a)) / Math.sin(Math.PI / 3),
      ]);
    }
    for (let i = 1; i <= n; i++) {
      const a = (Math.PI * 2) / 3 + ((i / n) * Math.PI) / 3;
      points.push([
        w + 2 * w * Math.cos(a),
        h.bottom + h.spring + ((h.height - h.spring) * Math.sin(a)) / Math.sin(Math.PI / 3),
      ]);
    }
    return points;
  }
  if (h.shape === 'circle')
    return Array.from({ length: d <= 1 ? 8 : 16 }, (_, i) => {
      const a = (i * Math.PI * 2) / (d <= 1 ? 8 : 16);
      return [(Math.cos(a) * h.width) / 2, h.bottom + h.height / 2 + (Math.sin(a) * h.height) / 2];
    });
  return baseOpeningShape(h, d);
};
function prepareOpening(h, b, d) {
  const v = basePrepareOpening(h, b, d);
  if (!['circle', 'pointed'].includes(h.shape)) return v;
  const ring = openingShape(h, d),
    axis = v.axis,
    normal = v.normal,
    centerN = h.center[0] * normal[0] + h.center[1] * normal[1],
    planes = [
      [normal[0], 0, normal[1], h.depth / 2 - centerN],
      [-normal[0], 0, -normal[1], h.depth / 2 + centerN],
    ];
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      q = ring[(i + 1) % ring.length],
      du = q[0] - a[0],
      dv = q[1] - a[1];
    planes.push([
      -dv * axis[0],
      du,
      -dv * axis[1],
      dv * (h.center[0] * axis[0] + h.center[1] * axis[1] + a[0]) - du * (b + a[1]),
    ]);
  }
  return { ...v, ring, planes };
}
const source = new URL(
  '../../../content/worldgen/source/places/ev/evd/n0443_koutoubia_mosque/',
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
  wall: '#d1ab85',
  trim: '#e5d7c4',
  court: '#e9e0cd',
  roof: '#827366',
  tile: '#7a9f94',
  door: '#9b7958',
  gold: '#c6a35b',
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
const footing = (p) => Math.min(-0.35, floor - 0.3, koutoubiaGround(...p) - 0.35);
export function koutoubiaGround(x, z) {
  const c = Math.cos(fit.heading),
    s = Math.sin(fit.heading);
  [x, z] = [x * c + z * s, -x * s + z * c];
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw Error('Great Mosque of Koutoubia footing outside retained terrain');
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
    const _normal = direction ?? normalFor(p[0], p[1], p[2]);
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
function _solid(face, r, b, t, slot) {
  sides(face, r, b, t, slot);
  cap(face, r, t, slot);
}
function _faceFrame(r, i) {
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
        height: h.height + w * 2,
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
function _shell(out, d, r, b, t, holes = [], slot = 'wall', inner = null) {
  const hs = holes.map((h) => prepareOpening(h, 0, d)),
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
const _band = (face, r, y, h = 0.25, slot = 'trim', factor = 1.02) =>
  sides(face, scaled(r, factor), y, y + h, slot);
const _coarse = (r) => {
  r = r.map((p) => [...p]);
  let changed = true;
  while (changed && r.length > 4) {
    changed = false;
    for (let i = 0; i < r.length; i++) {
      const a = r[(i + r.length - 1) % r.length],
        b = r[i],
        c = r[(i + 1) % r.length],
        dx = c[0] - a[0],
        dz = c[1] - a[1],
        t = ((b[0] - a[0]) * dx + (b[1] - a[1]) * dz) / (dx * dx + dz * dz);
      // Current tile quantization creates tiny overshooting spikes on the porch edge.
      if (t >= -0.05 && t <= 1.05 && Math.hypot(b[0] - a[0] - t * dx, b[1] - a[1] - t * dz) < 1.4) {
        r.splice(i, 1);
        changed = true;
        break;
      }
    }
  }
  return r;
};
function profile(face, ring, levels, slot, origin = center(ring)) {
  const scale = (f) => ring.map((p) => p.map((v, k) => origin[k] + (v - origin[k]) * f));
  let prev = scale(levels[0][1]);
  for (let i = 1; i < levels.length; i++) {
    const r = scale(levels[i][1]);
    for (let k = 0; k < r.length; k++) {
      const j = (k + 1) % r.length;
      face(
        slot,
        [
          at(prev[k], levels[i - 1][0]),
          at(prev[j], levels[i - 1][0]),
          at(r[j], levels[i][0]),
          at(r[k], levels[i][0]),
        ],
        [(prev[k][0] + prev[j][0]) / 2 - origin[0], 0, (prev[k][1] + prev[j][1]) / 2 - origin[1]],
      );
    }
    prev = r;
  }
  cap(face, prev, levels.at(-1)[0], slot);
}
const _rect = (x, z, w, h) => [
    [x - w / 2, z - h / 2],
    [x + w / 2, z - h / 2],
    [x + w / 2, z + h / 2],
    [x - w / 2, z + h / 2],
  ],
  circle = (p, r, n) =>
    Array.from({ length: n }, (_, i) => [
      p[0] + Math.cos((i * 2 * Math.PI) / n) * r,
      p[1] + Math.sin((i * 2 * Math.PI) / n) * r,
    ]);
const edges = (r) =>
  r.map((a, i) => {
    const b = r[(i + 1) % r.length],
      axis = unit(b.map((v, k) => v - a[k]));
    return {
      a,
      b,
      axis,
      normal: [axis[1] * sign(r), -axis[0] * sign(r)],
      center: lerp(a, b, 0.5),
      length: Math.hypot(...b.map((v, k) => v - a[k])),
    };
  });
const field = (name, center, axis, normal, width, bottom, height, spring, depth = 1) => ({
  name,
  center,
  axis,
  normal,
  width,
  bottom: floor + bottom,
  height,
  spring,
  shape: 'horseshoe',
  depth,
});
const point = (h, u, y, dep = 0) => [
  h.center[0] + h.axis[0] * u + h.normal[0] * dep,
  y,
  h.center[1] + h.axis[1] * u + h.normal[1] * dep,
];
function _down(face, r, y, slot, holes = []) {
  const p = [...r, ...holes.flat()],
    starts = [];
  let n = r.length;
  for (const h of holes) {
    starts.push(n);
    n += h.length;
  }
  const ids = earcut(p.flat(), starts, 2);
  for (let i = 0; i < ids.length; i += 3)
    face(
      slot,
      ids.slice(i, i + 3).map((k) => at(p[k], y)),
      [0, -1, 0],
    );
}
function _panel(face, h, d, width, bottom, top, slot, offset = 0) {
  const r = openingShape(h, d),
    p = [
      [-width / 2, floor + bottom],
      [width / 2, floor + bottom],
      [width / 2, floor + top],
      [-width / 2, floor + top],
      ...r,
    ],
    ids = earcut(p.flat(), [4], 2);
  for (let i = 0; i < ids.length; i += 3)
    face(
      slot,
      ids.slice(i, i + 3).map((k) => point(h, ...p[k], offset)),
      [h.normal[0], 0, h.normal[1]],
    );
}
function reveal(face, h, d, front, back, slot = 'wall') {
  const r = openingShape(h, d),
    sg = sign(r);
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      du = b[0] - a[0],
      dy = b[1] - a[1];
    face(
      slot,
      [point(h, ...a, front), point(h, ...b, front), point(h, ...b, back), point(h, ...a, back)],
      [-dy * h.axis[0] * sg, du * sg, -dy * h.axis[1] * sg],
    );
  }
}
const plans = rec.plans,
  tf = rec.towerFloorY,
  tc = center(plans.tower),
  shift = tf - floor;
function makeField(name, e, p, width, bottom, height, spring, back, body, kind, base = floor) {
  return {
    ...field(name, p, e.axis, e.normal, width, 0, height, spring, Math.abs(back) * 2 + 0.12),
    bottom: base + bottom,
    baseY: base,
    shape: 'round',
    back,
    body,
    kind,
  };
}
export function koutoubiaFields(d = 4) {
  const result = [];
  const court = _coarse(plans.whole.holes[0]);
  for (const [i, e] of edges(court).entries()) {
    const n = Math.max(1, Math.round(e.length / (d === 0 ? 15 : 6))),
      normal = e.normal.map((v) => -v);
    for (let k = 0; k < n; k++) {
      const p = lerp(e.a, e.b, (k + 0.5) / n);
      result.push(
        makeField(
          `court-${i}-${k}`,
          { ...e, normal },
          p,
          Math.min(4.4, (e.length / n) * 0.72),
          0.2,
          5.4,
          3.1,
          -2.6,
          'hall',
          'arcade',
        ),
      );
    }
  }
  const outer = _coarse(plans.whole.outline);
  for (const [i, e] of edges(outer).entries()) {
    if (e.length < 35 || e.center[1] < -25) continue;
    const n = d === 0 ? 1 : Math.max(1, Math.floor(e.length / 20));
    for (let k = 0; k < n; k++) {
      const p = lerp(e.a, e.b, (k + 0.5) / n);
      if (Math.hypot(p[0] - tc[0], p[1] - tc[1]) < 15) continue;
      result.push(
        makeField(`outer-door-${i}-${k}`, e, p, 2.8, 0.18, 4.7, 2.8, -0.65, 'hall', 'door'),
      );
    }
  }
  for (const [i, e] of edges(plans.tower).entries()) {
    const levels =
      d === 0
        ? [[51, 5.2, 4.3, 1]]
        : d === 1
          ? [
              [15, 3.2, 2.4, 1],
              [31, 5.6, 4.2, 1],
              [43, 3.4, 2.5, 1],
              [51, 5.2, 3.2, 3],
            ]
          : [
              [15 + (i % 2) * 2.5, 3.1, 1.7, 2],
              [31 - (i % 2) * 2, 5.5, 2.1, 2],
              [43, 3.4, 1.7, 2],
              [51, 5.3, 2.35, 3],
            ];
    for (const [y, height, width, n] of levels)
      for (let k = 0; k < n; k++) {
        const p = e.center.map((v, j) => v + e.axis[j] * (k - (n - 1) / 2) * (width + 0.5));
        result.push(
          makeField(
            `shaft-${i}-${y}-${k}`,
            e,
            p,
            width,
            y,
            height,
            height * 0.56,
            -0.48,
            'tower',
            'window',
            tf,
          ),
        );
      }
  }
  for (const [i, e] of edges(plans.lantern).entries())
    result.push(
      makeField(`lantern-${i}`, e, e.center, 2.2, 63.2, 3.8, 2.2, -0.4, 'lantern', 'window', tf),
    );
  return result;
}
function recess(_out, face, h, d) {
  if (d === 0) {
    pane(face, h, d, 0.018, h.kind === 'arcade' ? 'wall' : 'door');
    return;
  }
  reveal(face, h, d, 0, h.back, h.kind === 'arcade' ? 'court' : 'wall');
  pane(face, h, d, h.back, h.kind === 'arcade' ? 'wall' : 'door');
  if (d >= 2 && h.kind === 'arcade' && Number(h.name.split('-').at(-1)) % 2 === 0) {
    const door = { ...h, width: 1.5, height: 3, spring: 1.9, bottom: h.baseY + 0.25 };
    pane(face, door, d, h.back + 0.03, 'door');
    archBand(face, door, d, 0.18, 'trim', h.back + 0.05);
  }
  if (d >= 2 || h.kind === 'arcade')
    archBand(
      face,
      h,
      d,
      h.kind === 'arcade' ? 0.24 : 0.22,
      h.kind === 'arcade' ? 'court' : 'trim',
      0.035,
    );
}
function bodyShell(out, face, d) {
  const hs = koutoubiaFields(d).filter((h) => h.body === 'hall'),
    prepared = hs.map((h) => prepareOpening(h, 0, d)),
    mf = d === 0 ? face : writer(masked(out, prepared), d);
  for (const p of plans.mass) {
    sides(mf, p.outline, footing, 8.6, 'wall');
    for (const h of p.holes) sides(mf, h, footing, 8.6, 'court', true);
    cap(mf, p.outline, 8.6, 'roof', p.holes);
  }
  for (const h of hs) recess(out, face, h, d);
  sides(face, plans.annex.outline, footing, 8, 'wall');
  cap(face, plans.annex.outline, 8, 'roof');
}
function ridge(face, p) {
  const { left, right, ridge, ends } = p.roofChains;
  sides(face, p.ring, 8.6, p.eave, 'wall');
  for (const chain of [left, right]) {
    const points = [
        ...chain.map((q) => [...q, p.eave]),
        ...ridge.toReversed().map((q) => [...q, p.ridge]),
      ],
      ids = earcut(
        points.flatMap((q) => q.slice(0, 2)),
        undefined,
        2,
      );
    for (let i = 0; i < ids.length; i += 3)
      face(
        'roof',
        ids.slice(i, i + 3).map((k) => at(points[k].slice(0, 2), points[k][2])),
        [0, 1, 0],
      );
  }
  for (const [i, e] of ends.entries())
    face(
      'wall',
      [at(e[0], p.eave), at(ridge[i === 0 ? 0 : ridge.length - 1], p.ridge), at(e[1], p.eave)],
      [0, 0, i === 0 ? -1 : 1],
    );
}
function roofscape(face, d) {
  for (const p of [...plans.naves, ...plans.crossing]) ridge(face, p);
  for (const p of [...plans.south, ...plans.wings]) {
    sides(face, p.ring, 8.6, p.top, 'wall');
    cap(face, p.ring, p.top, 'roof');
    if (d >= 2) {
      const inner = scaled(p.ring, 0.85);
      sides(face, p.ring, p.top, p.top + 0.32, 'wall');
      sides(face, inner, p.top, p.top + 0.32, 'wall', true);
      cap(face, p.ring, p.top + 0.32, 'wall', [inner]);
    }
  }
}
function crest(face, ring, y, d) {
  const count = d === 0 ? 1 : d === 1 ? 3 : 5;
  for (const e of edges(ring))
    for (let i = 0; i < count; i++) {
      const q = lerp(e.a, e.b, (i + 0.5) / count),
        w = d === 0 ? 1.8 : 0.9,
        h = d === 0 ? 0.65 : 0.8,
        front = q.map((v, k) => v + e.normal[k] * 0.13),
        back = q.map((v, k) => v - e.normal[k] * 0.13),
        r = [
          front.map((v, k) => v - (e.axis[k] * w) / 2),
          front.map((v, k) => v + (e.axis[k] * w) / 2),
          back.map((v, k) => v + (e.axis[k] * w) / 2),
          back.map((v, k) => v - (e.axis[k] * w) / 2),
        ];
      profile(
        face,
        r,
        [
          [y, 1],
          [y + h * 0.55, 1],
          [y + h, 0.1],
        ],
        'wall',
        q,
      );
    }
}
function ornament(face, ring, b, _t, d) {
  if (d < 2) return;
  for (const e of edges(ring)) {
    const n = d === 2 ? 3 : 5;
    for (let i = 0; i < n; i++) {
      const u = (i - (n - 1) / 2) * 1.6;
      for (const y of [b + 1.1, b + 3.1]) {
        const p = { center: e.center, axis: e.axis, normal: e.normal };
        const windows = koutoubiaFields(d).filter(
          (h) =>
            h.kind === 'window' &&
            h.normal[0] * e.normal[0] + h.normal[1] * e.normal[1] > 0.99 &&
            Math.abs(
              (h.center[0] - e.center[0]) * e.normal[0] + (h.center[1] - e.center[1]) * e.normal[1],
            ) < 0.2,
        );
        if (
          windows.some((h) => {
            const hu =
              (h.center[0] - e.center[0]) * e.axis[0] + (h.center[1] - e.center[1]) * e.axis[1];
            return (
              Math.abs(hu - u) < h.width / 2 + 0.65 &&
              y + 0.85 > h.bottom &&
              y - 0.85 < h.bottom + h.height
            );
          })
        )
          continue;
        face(
          'wall',
          [
            point(p, u, y - 0.8, 0.035),
            point(p, u + 0.6, y, 0.035),
            point(p, u, y + 0.8, 0.035),
            point(p, u - 0.6, y, 0.035),
          ],
          [e.normal[0], 0, e.normal[1]],
          colors.trim,
        );
      }
    }
  }
}
function tower(out, face, d) {
  const hs = koutoubiaFields(d).filter((h) => h.body === 'tower'),
    ls = koutoubiaFields(d).filter((h) => h.body === 'lantern');
  const mf =
    d === 0
      ? face
      : writer(
          masked(
            out,
            hs.map((h) => prepareOpening(h, 0, d)),
          ),
          d,
        );
  sides(mf, plans.tower, footing, shift + 61.2, 'wall');
  cap(face, plans.tower, shift + 61.2, 'wall');
  sides(face, scaled(plans.tower, 1.015), shift + 58.6, shift + 60.4, 'tile');
  sides(face, scaled(plans.tower, 1.025), shift + 60.4, shift + 61.2, 'trim');
  crest(face, plans.tower, shift + 61.2, d);
  for (const h of hs) recess(out, face, h, d);
  const lf =
    d === 0
      ? face
      : writer(
          masked(
            out,
            ls.map((h) => prepareOpening(h, 0, d)),
          ),
          d,
        );
  sides(lf, plans.lantern, shift + 61.15, shift + 68.2, 'wall');
  cap(face, plans.lantern, shift + 68.2, 'wall');
  sides(face, scaled(plans.lantern, 1.01), shift + 67.3, shift + 68, 'tile');
  sides(face, scaled(plans.lantern, 1.02), shift + 68, shift + 68.2, 'trim');
  crest(face, plans.lantern, shift + 68.2, d);
  for (const h of ls) recess(out, face, h, d);
  ornament(face, plans.tower, tf + 45, tf + 50, d);
  ornament(face, plans.lantern, tf + 63, tf + 67, d);
  const q = center(plans.cap),
    r = d <= 1 ? plans.cap.filter((_, i) => i % 2 === 0) : plans.cap,
    fluted =
      d >= 2
        ? r.flatMap((a, i) => {
            const b = r[(i + 1) % r.length],
              m = lerp(a, b, 0.5);
            return [a, m.map((v, k) => q[k] + (v - q[k]) * 0.96)];
          })
        : r;
  profile(
    face,
    fluted,
    [
      [shift + 68.95, 1],
      [shift + 69.65, 0.85],
      [shift + 70.45, 0.5],
      [shift + 71, 0.015],
    ],
    'wall',
    q,
  );
  const n = d === 0 ? 4 : d === 1 ? 6 : 10;
  profile(
    face,
    circle(q, 0.1, n),
    [
      [shift + 70.95, 1],
      [shift + 76.5, 1],
    ],
    'gold',
    q,
  );
  for (const [y, radius] of [
    [72.1, 0.9],
    [74, 0.58],
    [75.25, 0.33],
  ]) {
    const rs = circle(q, radius, n);
    profile(
      face,
      rs,
      [
        [shift + y - radius, 0.03],
        [shift + y - radius * 0.6, 0.8],
        [shift + y, 1],
        [shift + y + radius * 0.6, 0.8],
        [shift + y + radius, 0.03],
      ],
      'gold',
      q,
    );
  }
}
function build(target, d) {
  const out = {
      addTriangle(...a) {
        const p = a[2].map((p) => p.map(Math.fround));
        if (
          Math.hypot(
            ...cross(
              p[1].map((v, k) => v - p[0][k]),
              p[2].map((v, k) => v - p[0][k]),
            ),
          ) < 1e-7
        )
          return;
        target.addTriangle(a[0], a[1], p, a[3], a[4], a[5]);
      },
    },
    face = writer(out, d);
  bodyShell(out, face, d);
  roofscape(face, d);
  tower(out, face, d);
}
export const buildKoutoubiaSkyline = (o) => build(o, 0),
  buildKoutoubiaDistrict = (o) => build(o, 1),
  buildKoutoubiaStreet = (o) => build(o, 2),
  buildKoutoubiaCloseup = (o) => build(o, 3);
const cam = (name, position, lookAt) => ({ name, position, lookAt, fov: 48 });
export const koutoubiaStudy = {
  id: 'N0443',
  key: 'koutoubia_mosque',
  title: 'Koutoubia Mosque',
  category: 'mosque',
  wikidataId: 'Q1137533',
  generationCommand: 'node packages/worldgen/scripts/generate-additional-landmarks.mjs',
  mapFrame: 'map-frame.json',
  fidelityTarget: 'medium-fi',
  build: (o) => build(o, 4),
  surfaceOverrides: scope.surfaceOverrides,
  brief: rec.scope,
  sourceFacts: { horizontalBasis: rec.identityBasis, architecturalHeights: rec.heightBasis },
  reconstruction: rec,
  scaleBasis: rec.heightBasis,
  refs: read('reference-metadata.json').currentRoundInspection.pictures.map((p) => p.page),
  nativeAxes: frame.nativeAxes,
  sourceDocuments: scope.sourceDocuments,
  sourceLicense:
    'Original geometry under repository license;map geometry ©OpenStreetMap contributors,ODbL-1.0. Reference pictures viewed only,not redistributed.',
  dataAttribution: '©OpenStreetMap contributors;Protomaps;Mapzen/USGS terrain tiles.',
  sourceNotice:
    'Seven existing shared256² sandstone,limestone,lime plaster,fired clay,mosaic tile,plain wood and cast bronze graphs;seven merged roles,metric UVs,linear tints. Brown roofs,ochre masonry,pale court arcade,muted green friezes and original sparse relief. No embedded images,unique atlas,baked lighting or copied carvings/calligraphy.',
  importReason: rec.scope,
  previewGround: false,
  previewTerrain: scope.previewTerrain,
  mediumFiContext: scope.mediumFiContext,
  geographic: () => scope.geographic,
  geographicNote: scope.geographicNote,
  limitations: [
    rec.identityBasis,
    rec.heightBasis,
    scope.geographicNote,
    'Medium-fi compound exterior. Court arcades use estimated2.6m-deep closed gallery recesses;outer doors and tower windows use closed wood proxies. Curved openings and original relief abstract the pictures;precise horseshoe/lobed profiles,lattice/inscriptions,ornament counts,roof junctions,finial measurements,current condition,interior rooms/stairs,archaeological foundations and threshold/terrain/walking joins remain unverified. Skyline uses flat arch proxies and coarse crest/globes. No navigable interior,ground slab or bespoke research. Physical-device performance remains unverified.',
  ],
  camera: scope.camera,
  qaCameras: [
    cam('square-minaret-and-green-frieze', [92, 56, -77], [41, 42, -25]),
    cam('lantern-ribbed-cap-and-globes', [68, 77, -51], [41, 68, -25]),
    cam('ochre-entrance', [87, 13, 4], [46, 7, 3]),
    cam('pale-court-arcade', [0, 9, -18], [0, 5.7, -3.5]),
    cam('parallel-brown-nave-roofs', [-84, 62, 77], [-5, 12, 12]),
    cam('two-court-compound-plan', [0, 230, 0.1], [0, 10, 0]),
  ],
};
