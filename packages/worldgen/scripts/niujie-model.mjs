/** Niujie Mosque: mapped Chinese compound with grey tile roofs,red timber and tiered tower. */
import './install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import earcut from 'earcut';
import { cross, normalFor } from './authored-structure-mesh.mjs';

const source = new URL(
  '../../../content/worldgen/source/places/wx/wx4/n0470_niujie_mosque/',
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
  wall: '#a8aaa2',
  plaster: '#d4d0bd',
  trim: '#c5c3b6',
  wood: '#c27461',
  roof: '#858d87',
  green: '#6c947d',
  glass: '#526975',
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
const footing = (p) => Math.min(-0.35, floor - 0.3, niujieGround(...p) - 0.35);
export function niujieGround(x, z) {
  const c = Math.cos(fit.heading),
    s = Math.sin(fit.heading);
  [x, z] = [x * c + z * s, -x * s + z * c];
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw Error('Niujie Mosque footing outside retained terrain');
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
function solid(face, r, b, t, slot) {
  sides(face, r, b, t, slot);
  cap(face, r, t, slot);
}
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
function profile(face, ring, levels, slot) {
  const origin = center(ring);
  let prev = scaled(ring, levels[0][1]);
  for (let i = 1; i < levels.length; i++) {
    const r = scaled(ring, levels[i][1]);
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
const plans = rec.plans;
const rect = (x0, z0, x1, z1) => [
    [x0, z0],
    [x1, z0],
    [x1, z1],
    [x0, z1],
  ],
  circle = (p, r, n) =>
    Array.from({ length: n }, (_, i) => {
      const a = (-i * Math.PI * 2) / n;
      return [p[0] + Math.cos(a) * r, p[1] + Math.sin(a) * r];
    });
const edges = (ring) =>
  ring.map((a, i) => {
    const b = ring[(i + 1) % ring.length],
      axis = unit(b.map((v, k) => v - a[k]));
    return {
      a,
      b,
      axis,
      normal: [axis[1] * sign(ring), -axis[0] * sign(ring)],
      length: Math.hypot(b[0] - a[0], b[1] - a[1]),
    };
  });
const box = (r) =>
  [0, 1].map((k) => [Math.min(...r.map((p) => p[k])), Math.max(...r.map((p) => p[k]))]);
function underside(face, r, y, slot = 'wood') {
  const ids = earcut(r.flat(), [], 2);
  for (let i = 0; i < ids.length; i += 3)
    face(
      slot,
      ids.slice(i, i + 3).map((k) => at(r[k], y)),
      [0, -1, 0],
    );
}
function post(face, p, b, t, r, d, slot = 'wood') {
  const ring = circle(p, r, d === 0 ? 4 : d === 1 ? 4 : d === 2 ? 6 : 8);
  sides(face, ring, b, t, slot);
  if (slot === 'trim') cap(face, ring, t, slot);
  if (d >= 3) {
    profile(
      face,
      ring,
      [
        [b, 1.45],
        [b + 0.3, 1.45],
        [b + 0.5, 1],
      ],
      'trim',
    );
    profile(
      face,
      ring,
      [
        [t - 0.5, 1],
        [t - 0.2, 1.7],
        [t, 1.7],
      ],
      slot,
    );
  }
}
// Surface rings describe curved eaves;edge midpoints dip while the corners turn upward.
function curvedRoof(face, r, base, rise, d, slot = 'roof', ridgeAxis = null, overhang = 0.5) {
  const p = center(r),
    bounds = box(r),
    eave = (q) =>
      q.map(
        (v, k) =>
          p[k] + (v - p[k]) * (1 + Math.min(0.2, overhang / ((bounds[k][1] - bounds[k][0]) / 2))),
      ),
    parts = d === 0 ? 1 : d === 1 ? 2 : d === 2 ? 3 : 4;
  const rings = [0, 1, 2].slice(0, d === 0 ? 1 : d === 1 ? 2 : 3).map((level) =>
    r.flatMap((a, i) => {
      const b = r[(i + 1) % r.length];
      return Array.from({ length: parts }, (_, j) => {
        const t = j / parts,
          q = lerp(a, b, t),
          scale = [1.2, 1.0, 0.72][level],
          corner = Math.pow(Math.abs(2 * t - 1), 2),
          y =
            base +
            [0.35, 0.9, Math.max(1.05, rise * 0.45)][level] +
            (level === 0 ? corner * 0.45 : 0);
        const v =
          level === 0 ? eave(q) : [p[0] + (q[0] - p[0]) * scale, p[1] + (q[1] - p[1]) * scale];
        return [v[0], y, v[1]];
      });
    }),
  );
  const B = box(r),
    last = rings.at(-1),
    top =
      ridgeAxis === 'z'
        ? r.flatMap((a, i) =>
            Array.from({ length: parts }, (_, j) => {
              const q = lerp(a, r[(i + 1) % r.length], j / parts);
              return [p[0] + (q[0] - p[0]) * 0.015, base + rise, p[1] + (q[1] - p[1]) * 0.5];
            }),
          )
        : ridgeAxis === 'x'
          ? r.flatMap((a, i) =>
              Array.from({ length: parts }, (_, j) => {
                const q = lerp(a, r[(i + 1) % r.length], j / parts);
                return [p[0] + (q[0] - p[0]) * 0.5, base + rise, p[1] + (q[1] - p[1]) * 0.015];
              }),
            )
          : last.map(() => [p[0], base + rise, p[1]]);
  rings.push(top);
  for (let j = 1; j < rings.length; j++)
    for (let i = 0; i < last.length; i++) {
      const k = (i + 1) % last.length;
      face(
        slot,
        [rings[j - 1][i], rings[j - 1][k], rings[j][k], rings[j][i]].map((q) => [
          q[0],
          floor + q[1],
          q[2],
        ]),
        [0, 1, 0],
      );
    }
  if (ridgeAxis) {
    face(
      slot,
      top.map((q) => [q[0], floor + q[1], q[2]]),
      [0, 1, 0],
    );
    const a =
        ridgeAxis === 'z'
          ? [p[0], B[1][0] + (B[1][1] - B[1][0]) * 0.25]
          : [B[0][0] + (B[0][1] - B[0][0]) * 0.25, p[1]],
      b =
        ridgeAxis === 'z'
          ? [p[0], B[1][1] - (B[1][1] - B[1][0]) * 0.25]
          : [B[0][1] - (B[0][1] - B[0][0]) * 0.25, p[1]];
    if (d >= 2) beam(face, at(a, base + rise + 0.1), at(b, base + rise + 0.1), 0.2, slot);
  }
  // Close the raised upturned eave to its flat soffit; avoid an open floating rim.
  const perimeter = rings[0],
    winding = sign(r);
  for (let i = 0; i < perimeter.length; i++) {
    const a = perimeter[i],
      b = perimeter[(i + 1) % perimeter.length];
    face(
      'wood',
      [
        [a[0], floor + base + 0.02, a[2]],
        [b[0], floor + base + 0.02, b[2]],
        [b[0], floor + b[1], b[2]],
        [a[0], floor + a[1], a[2]],
      ],
      [(b[2] - a[2]) * winding, 0, (a[0] - b[0]) * winding],
    );
  }
  underside(face, r.map(eave), base + 0.02, 'wood');
}
const openBand = (face, a, b, y, h, slot = 'wood') => {
  const q = unit(b.map((v, k) => v - a[k])),
    n = [q[1], -q[0]],
    w = 0.16,
    r = [
      a.map((v, k) => v + n[k] * w),
      b.map((v, k) => v + n[k] * w),
      b.map((v, k) => v - n[k] * w),
      a.map((v, k) => v - n[k] * w),
    ];
  solid(face, r, y, y + h, slot);
};
function postFrame(_out, face, r, b, t, d, columns = 1, slot = 'wood') {
  const es = edges(r);
  for (const e of es) {
    const n = columns === 1 ? 1 : Math.max(1, Math.round(e.length / columns));
    for (let i = 0; i < n; i++)
      post(face, lerp(e.a, e.b, i / n), b, t, d === 0 ? 0.22 : 0.2, d, slot);
    if (d >= 1) openBand(face, e.a, e.b, t - 0.5, 0.35, slot);
  }
  if (d >= 2)
    for (const e of es) {
      const n = Math.max(1, Math.round(e.length / 2));
      for (let i = 0; i < n; i++) {
        const p = lerp(e.a, e.b, (i + 0.5) / n);
        solid(
          face,
          rect(p[0] - 0.3, p[1] - 0.24, p[0] + 0.3, p[1] + 0.24),
          t - 0.25,
          t + 0.22,
          slot,
        );
      }
    }
}
// All heights and the assignment of pictured forms to mapped plans are approximate.
const subdivisions = (ring, max) =>
  ring.flatMap((a, i) => {
    const b = ring[(i + 1) % ring.length],
      n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / max);
    return Array.from({ length: n }, (_, j) => lerp(a, b, j / n));
  });
const blue = '#739899'
  .slice(1)
  .match(/../g)
  .map((h) => {
    const v = parseInt(h, 16) / 255;
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
const painted = (face) => (slot, p, n) => face(slot, p, n, blue);
const boundsRect = (r) => {
  const b = box(r);
  return rect(b[0][0], b[1][0], b[0][1], b[1][1]);
};
function foundation(face, r, d) {
  const ring = d === 0 ? r : subdivisions(r, 2.5);
  sides(face, ring, footing, 0.15, 'trim');
  cap(face, r, 0.15, 'trim');
}
function panel(face, e, p, y, w, h, d) {
  const a = p.map((v, k) => v - (e.axis[k] * w) / 2 + e.normal[k] * 0.06),
    b = p.map((v, k) => v + (e.axis[k] * w) / 2 + e.normal[k] * 0.06);
  const ring = [
    a,
    b,
    b.map((v, k) => v + e.normal[k] * 0.17),
    a.map((v, k) => v + e.normal[k] * 0.17),
  ];
  solid(face, ring, y, y + h, 'wood');
  if (d >= 2) {
    const q = a.map((v, k) => v + e.axis[k] * 0.2 + e.normal[k] * 0.19),
      s = b.map((v, k) => v - e.axis[k] * 0.2 + e.normal[k] * 0.19);
    face(
      'glass',
      [at(q, y + h * 0.5), at(s, y + h * 0.5), at(s, y + h - 0.24), at(q, y + h - 0.24)],
      [e.normal[0], 0, e.normal[1]],
    );
    const n = Math.max(1, Math.round(w / 0.8));
    for (let i = 1; i < n; i++) {
      const t = lerp(q, s, i / n);
      beam(face, at(t, y + h * 0.5), at(t, y + h - 0.24), 0.18, 'wood');
    }
    if (d >= 3)
      for (let i = 0; i < n; i++) {
        const v = lerp(q, s, i / n),
          u = lerp(q, s, (i + 1) / n),
          lo = y + h * 0.55,
          hi = y + h - 0.3;
        beam(face, at(v, lo), at(u, hi), 0.16, 'wood');
        beam(face, at(v, hi), at(u, lo), 0.16, 'wood');
      }
  }
}
function rangeScreens(face, plan, d) {
  if (d === 0) return;
  for (const e of edges(plan.outline)) {
    if (e.length < 6) continue;
    const count = Math.max(1, Math.round(e.length / (d === 1 ? 6 : 4.2))),
      w = Math.min(2.2, (e.length / (count + 1)) * 0.65);
    for (let i = 0; i < count; i++)
      panel(face, e, lerp(e.a, e.b, (i + 0.5) / count), 1.25, w, 2.3, d);
  }
}
function roofRidge(face, r, base, rise, d, axis) {
  curvedRoof(face, r, base, rise, d, 'roof', axis, 0.55);
  if (d === 0) return;
  const b = box(r),
    p = center(r),
    a =
      axis === 'x'
        ? [b[0][0] + (b[0][1] - b[0][0]) * 0.25, p[1]]
        : [p[0], b[1][0] + (b[1][1] - b[1][0]) * 0.25],
    q =
      axis === 'x'
        ? [b[0][1] - (b[0][1] - b[0][0]) * 0.25, p[1]]
        : [p[0], b[1][1] - (b[1][1] - b[1][0]) * 0.25];
  beam(face, at(a, base + rise + 0.12), at(q, base + rise + 0.12), 0.28, 'green');
  if (d >= 2) for (const e of edges(r)) openBand(painted(face), e.a, e.b, base - 0.45, 0.3, 'wood');
}
function prayerHall(face, plan, d) {
  sides(face, plan.outline, 0.15, plan.wallTop, 'wall');
  cap(face, plan.outline, plan.wallTop, 'plaster');
  const b = box(plan.outline),
    west = rect(b[0][0], b[1][0], 1.25, b[1][1]),
    east = rect(1.25, -3.32, b[0][1], 11.57);
  roofRidge(face, west, 6.6, 4.1, d, 'z');
  roofRidge(face, east, 6.6, 3.2, d, 'x');
  if (d === 0) return;
  const e = edges(plan.outline).find((e) => e.normal[0] > 0.99 && e.length > 10),
    count = d === 1 ? 3 : 5;
  for (let i = 0; i < count; i++)
    panel(
      face,
      e,
      lerp(e.a, e.b, (i + 0.5) / count),
      0.55,
      Math.min(2.4, e.length / count - 0.3),
      5,
      d,
    );
  for (let i = 0; i <= count; i++) {
    const q = lerp(e.a, e.b, i / count).map((v, k) => v + e.normal[k] * 0.35);
    post(face, q, 0.15, 6.5, d === 1 ? 0.25 : 0.23, d, 'wood');
  }
  openBand(painted(face), e.a, e.b, 5.7, 0.45, 'wood');
  // The remaining walls are exterior shells; no walkable hall interior is claimed.
  for (const edge of edges(plan.outline).filter(
    (q) => Math.abs(q.normal[1]) > 0.98 && q.length > 10,
  )) {
    const n = d === 1 ? 2 : 4;
    for (let i = 0; i < n; i++)
      panel(face, edge, lerp(edge.a, edge.b, (i + 0.5) / n), 1.5, 1.8, 3, d);
  }
}
function finial(face, p, d) {
  const ring = circle(p, 0.27, d === 0 ? 4 : d === 1 ? 6 : 8);
  profile(
    face,
    ring,
    [
      [11.9, 0.48],
      [12.1, 1.3],
      [12.45, 1],
      [12.75, 1.5],
      [13.05, 0.8],
      [13.5, 0.05],
    ],
    'wood',
  );
}
function tower(face, plan, d) {
  const r = boundsRect(plan.outline),
    p = center(r),
    upper = rect(p[0] - 2.7, p[1] - 3.1, p[0] + 2.7, p[1] + 3.1);
  solid(face, plan.outline, 0.15, 4.3, 'wall');
  roofRidge(face, r, 4.3, 2.1, d, 'z');
  solid(face, upper, 5.8, 9.5, 'wood');
  if (d >= 1) {
    for (const e of edges(upper)) {
      panel(face, e, lerp(e.a, e.b, 0.5), 6.35, Math.min(3.4, e.length - 1), 2.55, d);
    }
    postFrame(null, face, upper, 6.1, 9.5, d, d === 1 ? 1 : 3, 'wood');
    for (const e of edges(upper)) openBand(painted(face), e.a, e.b, 9.0, 0.4, 'wood');
  }
  roofRidge(face, upper, 9.5, 2.4, d, 'z');
  finial(face, p, d);
}
function squarePavilion(face, plan, d) {
  const r = boundsRect(plan.outline),
    b = box(r),
    p = center(r);
  if (d === 0) solid(face, r, 0.15, 3.7, 'wood');
  else {
    postFrame(null, face, scaled(r, 0.84), 0.15, 3.7, d, d === 1 ? 1 : 3, 'wood');
    // A small solid central screen supplies the photographed red-timber mass.
    solid(face, rect(p[0] - 0.8, p[1] - 2, p[0] + 0.8, p[1] + 2), 0.15, 3.3, 'wood');
  }
  roofRidge(face, r, 3.7, 2.1, d, b[0][1] - b[0][0] > b[1][1] - b[1][0] ? 'x' : 'z');
}
function build(target, d) {
  // Split only large terrain-crossing faces; UVs are assigned in meters by the normal pipeline.
  const out = {
      addTriangle(...a) {
        const emit = (p) => {
          let longest = 0,
            k = 0;
          for (let i = 0; i < 3; i++) {
            const q = p[(i + 1) % 3],
              length = Math.hypot(p[i][0] - q[0], p[i][2] - q[2]);
            if (length > longest) {
              longest = length;
              k = i;
            }
          }
          if (longest > (d === 0 ? 65 : d === 1 ? 40 : 24)) {
            const j = (k + 1) % 3,
              c = (k + 2) % 3,
              m = lerp(p[k], p[j], 0.5).map(Math.fround);
            emit([p[k], m, p[c]]);
            emit([m, p[j], p[c]]);
            return;
          }
          target.addTriangle(a[0], a[1], p, a[3], a[4], a[5]);
        };
        emit(a[2].map((p) => p.map(Math.fround)));
      },
    },
    face = writer(out, d);
  for (const plan of plans) foundation(face, plan.outline, d);
  for (const path of rec.paths) {
    sides(face, d === 0 ? path : subdivisions(path, 2.5), footing, 0.08, 'trim');
    cap(face, path, 0.08, 'trim');
  }
  for (const plan of plans) {
    if (plan.role === 'main-hall') prayerHall(face, plan, d);
    else if (plan.role === 'tiered-tower') tower(face, plan, d);
    else if (plan.role === 'small-square-pavilion') squarePavilion(face, plan, d);
    else {
      solid(
        face,
        plan.outline,
        0.15,
        plan.wallTop,
        plan.role.includes('pavilion') ? 'plaster' : 'wall',
      );
      const b = box(plan.outline),
        axis = b[0][1] - b[0][0] > b[1][1] - b[1][0] ? 'x' : 'z';
      roofRidge(face, boundsRect(plan.outline), plan.wallTop, plan.roofRise, d, axis);
      rangeScreens(face, plan, d);
    }
  }
}
export const buildNiujieSkyline = (o) => build(o, 0),
  buildNiujieDistrict = (o) => build(o, 1),
  buildNiujieStreet = (o) => build(o, 2),
  buildNiujieCloseup = (o) => build(o, 3);
const cam = (name, position, lookAt) => ({ name, position, lookAt, fov: 48 });
export const niujieStudy = {
  id: 'N0470',
  key: 'niujie_mosque',
  title: 'Niujie Mosque',
  category: 'mosque',
  wikidataId: 'Q603256',
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
    'Original geometry under repository license;map plans ©OpenStreetMap contributors,ODbL-1.0. Reference pictures viewed only,not redistributed.',
  dataAttribution: '©OpenStreetMap contributors;Protomaps;Mapzen/USGS terrain.',
  sourceNotice:
    'Six existing shared256² brick,lime plaster,raw limestone,plain wood,ceramic tile and glazed tile graphs;seven merged roles including opaque glazing. Red and blue-green painted timber uses shared wood and linear vertex tints. Metric UVs;no embedded images,unique atlas,copied inscriptions or baked illumination.',
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
    'Two inspected pictures guide tiered eaves and timber finish. Nine current plans keep compound spacing,notches and proportions. Exact modern appearance,internal plan,roof framing,small dougong,sculpture,calligraphy,precise lattice pattern,ground thresholds,engineering and physical-device timing are unverified. Window/door fields are opaque exterior panels;the small pavilion has open bays and a central screen. Host annex,apartment,north park and other town buildings are excluded.',
  ],
  camera: scope.camera,
  qaLodCameras: scope.qaLodCameras,
  qaCameras: [
    cam('whole-nine-plan-compound', [132, 77, 112], [38, 5, 12]),
    cam('prayer-hall-red-entry', [45, 16, 23], [18, 5, 5]),
    cam('stacked-tower-and-gourd', [76, 23, 27], [54.3, 7, 3.8]),
    cam('open-square-pavilion', [46, 12, -15], [34.6, 3, 2.8]),
    cam('paired-ranges-and-east-boundary', [103, 31, 60], [70, 4, 14]),
    cam('north-up-plan', [38, 195, 12.1], [38, 2, 12]),
  ],
};
