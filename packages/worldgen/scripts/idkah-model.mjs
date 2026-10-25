/** Id Kah Mosque: mapped courtyard ring,yellow gateway,banded twin lantern towers and green timber veranda. */
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
  '../../../content/worldgen/source/places/tx/txn/id_kah_mosque/',
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
  wall: '#f5cc69',
  trim: '#ede4cf',
  roof: '#e9e5dc',
  wood: '#508667',
  tile: '#456e8b',
  paving: '#b7b6a6',
  gold: '#c3ab6b',
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
const at = (p, y) => [p[0], typeof y === 'function' ? y(p) : floor + y, p[1]];
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
const footing = (p) => Math.min(-0.35, floor - 0.3, idkahGround(...p) - 0.35);
export function idkahGround(x, z) {
  const c = Math.cos(fit.heading),
    s = Math.sin(fit.heading);
  [x, z] = [x * c + z * s, -x * s + z * c];
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw Error('Id Kah footing outside retained terrain');
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
    if (h.name.startsWith('court-') && (i === 0 || i === 1 || i === inner.length - 1)) continue;
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
    // The veranda's explicit plaster ceiling supplies this reveal surface.
    if (h.name === 'west-veranda') continue;
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
const plans = rec.plans,
  ring = plans.whole,
  rect = (x0, z0, x1, z1) => [
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
const hole = (
  name,
  center,
  axis,
  normal,
  width,
  bottom,
  height,
  spring,
  shape = 'pointed',
  depth = 2,
) => ({ name, center, axis, normal, width, bottom: floor + bottom, height, spring, shape, depth });
function underside(face, r, y, slot, holes = []) {
  cap((s, p) => face(s, p, [0, -1, 0]), r, y, slot, holes);
}
function box(face, x0, z0, x1, z1, b, t, slot) {
  const r = rect(x0, z0, x1, z1);
  sides(face, r, b, t, slot);
  cap(face, r, t, slot);
  underside(face, r, b, slot);
}
const subdivide = (r, max) =>
  r.flatMap((a, i) => {
    const b = r[(i + 1) % r.length],
      n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / max);
    return Array.from({ length: n }, (_, j) => a.map((v, k) => v + ((b[k] - v) * j) / n));
  });
function edgeX(z) {
  const points = ring.outline.flatMap((a, i) => {
    const b = ring.outline[(i + 1) % ring.outline.length];
    if (Math.abs(b[1] - a[1]) < 1e-8) return [];
    const t = (z - a[1]) / (b[1] - a[1]);
    return t >= 0 && t <= 1 ? [a[0] + t * (b[0] - a[0])] : [];
  });
  return Math.max(...points);
}
export function idkahOpenings(d = 3) {
  return [
    hole('gate-through', [58, plans.gateZ], [0, 1], [1, 0], 4.2, 0.35, 6.7, 6.7, 'rect', 28),
    hole(
      'gateway-pointed-recess',
      [plans.gateX, plans.gateZ],
      [0, 1],
      [1, 0],
      8.1,
      0.35,
      11.55,
      6.8,
      'pointed',
      4.5,
    ),
    hole('west-veranda', [-37.4, 2.5], [0, 1], [1, 0], 125, 0.35, 3.45, 3.45, 'rect', 18),
    ...(d === 0
      ? []
      : [-9.4, 9.2].map((z, i) => {
          z += plans.gateZ;
          return hole(
            `blind-wing-${i}`,
            [edgeX(z), z],
            [0, 1],
            [1, 0],
            3.4,
            0.65,
            5.4,
            3.5,
            'pointed',
            1.1,
          );
        })),
  ];
}
export const idkahColumns = (d = 3) =>
  plans.columns.filter((_p, i) => (d === 0 ? i % 4 === 0 : d === 1 ? i % 2 === 0 : true));
function column(face, p, d) {
  const n = d <= 1 ? 4 : 8,
    r = circle(p, 0.23, n);
  if (d <= 1) {
    sides(face, r, 0.35, 3.8, 'wood');
    return;
  }
  profile(
    face,
    r,
    [
      [0.35, 1.5],
      [0.7, 1.5],
      [0.9, 1],
      [2.9, 1],
      [3.2, 1.2],
      [3.45, 1.2],
      [3.65, 0.9],
    ],
    'wood',
  );
  if (d >= 3) {
    const z = p[1];
    box(face, p[0] - 0.95, z - 0.22, p[0] + 0.95, z + 0.22, 3.45, 3.7, 'roof');
    for (const sg of [-1, 1]) {
      const a = [p[0], floor + 3.1, z],
        b = [p[0] + sg * 0.85, floor + 3.5, z];
      face(
        'roof',
        [
          [a[0], a[1], z - 0.16],
          [b[0], b[1], z - 0.16],
          [b[0], b[1] + 0.15, z - 0.16],
          [a[0], a[1] + 0.3, z - 0.16],
        ],
        [0, 0, -1],
      );
      face(
        'roof',
        [
          [a[0], a[1], z + 0.16],
          [b[0], b[1], z + 0.16],
          [b[0], b[1] + 0.15, z + 0.16],
          [a[0], a[1] + 0.3, z + 0.16],
        ],
        [0, 0, 1],
      );
    }
  }
}
function finial(face, p, b, t, d) {
  const r = circle(p, 0.15, d <= 1 ? 4 : 8);
  profile(
    face,
    r,
    [
      [b, 1],
      [b + (t - b) * 0.3, 1.5],
      [t, 0],
    ],
    'gold',
  );
}
function tower(face, p, d) {
  const n = [4, 8, 12, 16, 20][d],
    r = circle(p.center, p.radius, n);
  profile(
    face,
    r,
    [
      [0.35, 1.15],
      [1, 1.15],
      [2, 1],
      [16.5, 0.75],
      [17, 0.8],
    ],
    'wall',
  );
  for (const y of [d === 0 ? [11] : [7.5, 11, 14]][0]) {
    const scale = 1 - ((y - 2) * 0.25) / 14.5;
    const rr = circle(p.center, p.radius * scale * 1.012, n);
    sides(face, rr, y, y + 0.65, 'tile');
    if (d >= 2)
      for (let i = 0; i < n; i++) {
        const a = (-(i + 0.5) * Math.PI * 2) / n,
          u = [Math.cos(a), Math.sin(a)],
          q = p.center.map((v, k) => v + u[k] * p.radius * scale * Math.cos(Math.PI / n) * 1.018),
          axis = [-u[1], u[0]],
          P = (x, h) => [q[0] + axis[0] * x, floor + h, q[1] + axis[1] * x];
        face(
          'trim',
          [P(-0.22, y + 0.32), P(0, y + 0.54), P(0.22, y + 0.32), P(0, y + 0.1)],
          [u[0], 0, u[1]],
        );
      }
  }
  if (d >= 1) {
    const rr = circle(p.center, p.radius * 0.85, n);
    sides(face, rr, 16.7, 17.2, 'trim');
    cap(face, rr, 17.2, 'trim');
  }
  const posts = d <= 1 ? 4 : 8,
    rr = p.radius * 0.68;
  for (let i = 0; i < posts; i++) {
    const a = (-i * Math.PI * 2) / posts,
      q = [p.center[0] + Math.cos(a) * rr, p.center[1] + Math.sin(a) * rr];
    sides(face, circle(q, d <= 1 ? 0.17 : 0.13, 4), 17.2, 20.15, 'wall');
    if (d >= 3) box(face, q[0] - 0.22, q[1] - 0.22, q[0] + 0.22, q[1] + 0.22, 19.95, 20.2, 'trim');
  }
  const roof = circle(p.center, p.radius * 0.94, n);
  profile(
    face,
    roof,
    [
      [20.15, 1],
      [20.4, 1],
      [21.25, 0.45],
      [21.4, 0],
    ],
    'trim',
  );
  finial(face, p.center, 21.4, 22.6, d);
}
function portalTrim(face, d) {
  const x = plans.gateX,
    z = plans.gateZ,
    r = plans.portal;
  const n = d === 0 ? 3 : d === 1 ? 5 : 7;
  if (d >= 1) {
    for (let i = 0; i < n; i++) {
      const zz = z - 4.5 + ((i + 0.5) * 9) / n,
        h = hole(
          `upper-blind-${i}`,
          [x + 0.025, zz],
          [0, 1],
          [1, 0],
          (9 / n) * 0.72,
          12.35,
          1.0,
          0.62,
          'pointed',
          0.3,
        );
      pane(face, h, d, 0.03, 'wall');
      archBand(face, h, d, 0.08, 'trim', 0.06);
    }
    for (const sg of [-1, 1]) {
      const zz = z + sg * 4.75;
      for (let j = 0; j < 5; j++) {
        const h = hole(
          `side-blind-${sg}-${j}`,
          [x + 0.025, zz],
          [0, 1],
          [1, 0],
          0.62,
          0.7 + j * 2.1,
          1.6,
          1.15,
          'pointed',
          0.3,
        );
        archBand(face, h, d, 0.09, 'trim', 0.06);
      }
    }
  }
  box(face, x - 0.5, r[0][1] - 0.25, x + 0.35, r[2][1] + 0.25, 13.5, 13.8, 'roof');
  if (d >= 2)
    for (let i = 0; i < 16; i++) {
      const zz = r[0][1] + ((i + 0.5) * (r[2][1] - r[0][1])) / 16;
      box(face, x - 0.06, zz - 0.12, x + 0.2, zz + 0.12, 13.1, 13.5, 'trim');
    }
  if (d >= 1) {
    const h = hole(
      'inner-door-frame',
      [x - 2.2, z],
      [0, 1],
      [1, 0],
      4.2,
      0.35,
      6.7,
      6.7,
      'rect',
      1,
    );
    archBand(face, h, d, 0.3, 'trim', 0.01);
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
    face = writer(out, d),
    hs = idkahOpenings(d),
    prepared = hs.map((h) => prepareOpening(h, 0, d)),
    walls = masked(out, prepared),
    wf = writer(walls, d);
  const bottom =
    d === 0
      ? () => Math.min(rec.terrainFloorControl.min - 0.35, ...ring.outline.map(footing))
      : footing;
  for (const r of [ring.outline, ...ring.holes])
    sides(face, d === 0 ? r : subdivide(r, 3), bottom, 0.35, 'paving', r !== ring.outline);
  cap(face, ring.outline, 0.35, 'paving', ring.holes);
  shell(out, d, ring.outline, 0.35, 4, hs, 'wall', ring.holes[0]);
  const lowRoof = writer(masked(out, [prepared[0]]), d);
  if (d >= 1) underside(lowRoof, ring.outline, 3.8, 'roof', ring.holes);
  cap(lowRoof, ring.outline, 4, 'roof', ring.holes);
  for (const p of plans.wings) {
    sides(wf, p.outline, 4, 7.2, 'wall');
    for (const h of p.holes) sides(wf, h, 4, 7.2, 'wall', true);
    cap(face, p.outline, 7.2, 'roof', p.holes);
  }
  shell(
    out,
    d,
    plans.portal,
    0.35,
    13.8,
    hs.filter((h) => h.name.startsWith('gate')),
    'wall',
  );
  cap(face, plans.portal, 13.8, 'roof');
  const backing = writer(masked(out, [prepared[0]]), d),
    x = plans.gateX - 2.25,
    z = plans.gateZ;
  backing(
    'wall',
    [
      [x, floor + 0.35, z - 4.5],
      [x, floor + 0.35, z + 4.5],
      [x, floor + 12, z + 4.5],
      [x, floor + 12, z - 4.5],
    ],
    [1, 0, 0],
  );
  for (const h of hs.filter((h) => h.name.startsWith('blind'))) {
    pane(face, h, d, -0.28, 'wall');
    archBand(face, h, d, 0.18, 'trim', 0.08);
  }
  if (d >= 1) archBand(face, hs[1], d, 0.22, 'trim', 0.08);
  portalTrim(face, d);
  for (const p of plans.towers) tower(face, p, d);
  for (const p of idkahColumns(d)) column(face, p, d);
  // The sheltered veranda has real open space, a closed backing and a shared plaster ceiling.
  box(face, -46.6, -60, -46.25, 65, 0.35, 3.8, 'roof');
  if (d >= 1) for (const x0 of [-40.8, -44.8]) box(face, x0, -59, x0 + 0.6, 65, 3.5, 3.8, 'roof');
  if (d >= 2)
    for (let z = -58; z < 65; z += 3)
      box(face, -46.2, z - 0.12, -38.5, z + 0.12, 3.55, 3.8, 'roof');
  if (d >= 3)
    for (let z = -53; z < 64; z += 12) {
      const h = hole(
        `hall-panel-${z}`,
        [-46.23, z],
        [0, 1],
        [1, 0],
        3.0,
        0.7,
        2.5,
        2.5,
        'rect',
        0.3,
      );
      pane(face, h, d, 0.02, 'wood');
      archBand(face, h, d, 0.13, 'trim', 0.06);
    }
}
export const buildIdkahSkyline = (o) => build(o, 0),
  buildIdkahDistrict = (o) => build(o, 1),
  buildIdkahStreet = (o) => build(o, 2),
  buildIdkahCloseup = (o) => build(o, 3);
const cam = (name, position, lookAt) => ({ name, position, lookAt, fov: 48 });
export const idkahStudy = {
  id: 'id_kah_mosque',
  key: 'id_kah_mosque',
  title: 'Id Kah Mosque',
  category: 'mosque',
  wikidataId: 'Q1325825',
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
  dataAttribution: '©OpenStreetMap contributors;Protomaps;Mapzen/USGS terrain.',
  sourceNotice:
    'Seven existing shared256² graphs for yellow glazed brick,pale raw/coursed limestone,lime plaster,green timber,blue ceramic bands and cast bronze. Metric UVs,linear tints,no embedded images or unique atlas. No historic artwork,calligraphy or photo pixels are reproduced.',
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
    'Gateway and hall pictures establish vocabulary only. Exact current condition,internal layout,front facade measurements,garden,interiors,engineering and physical-device/full-city performance remain unverified.',
  ],
  camera: scope.camera,
  qaLodCameras: scope.qaLodCameras,
  qaCameras: [
    cam('yellow-gateway-and-open-passage', [110, 18, plans.gateZ + 35], [59, 7, plans.gateZ]),
    cam('white-blind-niche-and-tile-bands', [94, 14, plans.gateZ - 24], [60, 9, plans.gateZ - 10]),
    cam('open-minaret-lanterns', [80, 23, plans.gateZ + 42], [58, 18, plans.gateZ + 12]),
    cam('green-veranda-columns', [-16, 4, 55], [-40, 2.5, 35]),
    cam('white-beams-and-brackets', [-32, 3.2, 35], [-43, 3.5, 18]),
    cam('irregular-ring-and-open-courtyard', [5, 240, 0.1], [5, 0, 0]),
  ],
};
