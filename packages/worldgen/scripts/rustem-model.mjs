/** Rüstem Pasha: raised terrace,double porch,blue tile fields,domed hall and one minaret. */
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
  '../../../content/worldgen/source/places/sx/sxk/n0473_rustem_pasha_mosque/',
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
  wall: '#c9c5b9',
  trim: '#dfd8c8',
  roof: '#92999a',
  wood: '#8c7156',
  tile: '#80aeb7',
  gold: '#cfb86d',
  glass: '#526775',
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
const footing = (p) => Math.min(-0.35, floor - 0.3, rustemGround(...p) - 0.35);
export function rustemGround(x, z) {
  const c = Math.cos(fit.heading),
    s = Math.sin(fit.heading);
  [x, z] = [x * c + z * s, -x * s + z * c];
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw Error('Rustem footing outside retained terrain');
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
function _underside(face, r, y, slot, holes = []) {
  cap((s, p) => face(s, p, [0, -1, 0]), r, y, slot, holes);
}
function band(face, r, y, h, slot = 'trim', f = 1.015) {
  const outer = scaled(r, f);
  sides(face, outer, y, y + h, slot);
  cap(face, outer, y + h, slot, [r]);
  _underside(face, outer, y, slot, [r]);
}
function _openBand(face, a, b, y, h, slot = 'trim', width = 0.18) {
  const u = unit(b.map((v, k) => v - a[k])),
    n = [u[1] * width, -u[0] * width];
  solid(
    face,
    [
      a.map((v, k) => v + n[k]),
      b.map((v, k) => v + n[k]),
      b.map((v, k) => v - n[k]),
      a.map((v, k) => v - n[k]),
    ],
    y,
    y + h,
    slot,
  );
}
function _column(face, p, b, t, r, d, slot = 'trim') {
  const ring = circle(p, r, d <= 1 ? 4 : d === 2 ? 8 : 12);
  sides(face, ring, b, t, slot);
  cap(face, ring, t, slot);
  if (d >= 3 && t - b > 2) {
    profile(
      face,
      ring,
      [
        [b, 1.5],
        [b + 0.25, 1.5],
        [b + 0.45, 1],
      ],
      slot,
    );
    profile(
      face,
      ring,
      [
        [t - 0.5, 1],
        [t - 0.25, 1.65],
        [t, 1.65],
      ],
      slot,
    );
  }
}

const edges = (r) =>
  r.map((a, i) => {
    const b = r[(i + 1) % r.length],
      axis = unit(b.map((v, k) => v - a[k]));
    return {
      a,
      b,
      axis,
      normal: [axis[1] * sign(r), -axis[0] * sign(r)],
      length: Math.hypot(b[0] - a[0], b[1] - a[1]),
    };
  });
const subdivide = (r, max) =>
  r.flatMap((a, i) => {
    const b = r[(i + 1) % r.length],
      n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / max);
    return Array.from({ length: n }, (_, j) => a.map((v, k) => v + ((b[k] - v) * j) / n));
  });
export function rustemHallFields(d = 3) {
  if (d === 0) return [];
  const hs = [];
  for (const x of [-15.3, 12.4])
    for (const z of [-1.2, 7.0, 15.2])
      for (const y of d === 1 ? [6.2] : [5.6, 9.1])
        hs.push(
          hole(
            `hall-${x}-${z}-${y}`,
            [x, z],
            [0, 1],
            [Math.sign(x), 0],
            d === 1 ? 1.7 : 1.5,
            y,
            d === 1 ? 3.0 : 2.3,
            1.4,
            'pointed',
            1.5,
          ),
        );
  for (const x of [-10, -1.45, 7.1])
    for (const y of d === 1 ? [6.2] : [5.6, 9.1])
      hs.push(
        hole(
          `rear-${x}-${y}`,
          [x, 19.72],
          [1, 0],
          [0, 1],
          1.6,
          y,
          d === 1 ? 3 : 2.3,
          1.4,
          'pointed',
          1.5,
        ),
      );
  for (const [i, p] of plans.porchEdge.bays.entries())
    hs.push({
      ...hole(
        `porch-door-${i}`,
        [p[0], -7.2],
        [1, 0],
        [0, -1],
        i === 2 ? 2.5 : 1.8,
        i === 2 ? 4.6 : 5.7,
        i === 2 ? 4.0 : 2.8,
        1.8,
        'pointed',
        1.6,
      ),
      kind: i === 2 ? 'wood' : 'glass',
    });
  return hs;
}
export function rustemPorchArches(d = 3) {
  const hs = plans.porchEdge.bays.map((p, i) =>
    hole(`court-${i}`, [p[0], -10], [1, 0], [0, -1], 7.2, 4.4, 5.5, 3.7, 'pointed', 14),
  );
  if (d >= 1)
    for (const x of [-21.7, 18.8])
      hs.push(
        hole(
          `court-side-${x}`,
          [x, -10],
          [0, 1],
          [Math.sign(x), 0],
          4.4,
          4.4,
          5.5,
          3.7,
          'pointed',
          3,
        ),
      );
  return hs;
}
function dome(face, p, r, base, rise, d, small = false) {
  const n = small ? [6, 8, 12, 16, 20][d] : [8, 12, 20, 28, 32][d],
    steps = small ? [2, 2, 3, 4, 5][d] : [2, 3, 5, 7, 8][d];
  profile(
    face,
    circle(p, r, n),
    Array.from({ length: steps + 1 }, (_, i) => {
      const a = ((i / steps) * Math.PI) / 2;
      return [base + rise * Math.sin(a), i === steps ? 0 : Math.cos(a)];
    }),
    'roof',
  );
}
function finial(face, p, y, d, h = 0.8) {
  profile(
    face,
    circle(p, d === 0 ? 0.17 : 0.12, d === 0 ? 4 : 8),
    [
      [y, 1],
      [y + h * 0.4, 0.65],
      [y + h, 0.03],
    ],
    'gold',
  );
}
function closedFields(face, hs, d) {
  for (const h of hs) {
    pane(face, h, d, -0.22, h.kind ?? 'glass');
    if (d >= 1) archBand(face, h, d, 0.2, 'trim', 0.07);
  }
}
function platform(out, face, d) {
  const r = plans.whole.outline,
    hs = [];
  if (d >= 1)
    for (const x of [-18, -11, -4, 3, 10, 17])
      hs.push({
        ...hole(`shop-${x}`, [x, -19.724], [1, 0], [0, -1], 3.5, 0.1, 3.7, 2.4, 'pointed', 1.3),
        kind: 'wood',
      });
  shell(out, d, d === 0 ? r : subdivide(r, 2), footing, 4.5, hs, 'wall');
  cap(face, r, 4.5, 'trim');
  closedFields(face, hs, d);
  band(face, r, 4.2, 0.3, 'trim', 1.001);
}
function tileFields(out, d, hs) {
  const f = writer(
      masked(
        out,
        hs.map((h) => prepareOpening(h, 0, d)),
      ),
      d,
    ),
    z = -7.235;
  const tint = (h) =>
    h
      .slice(1)
      .match(/../g)
      .map((q) => {
        const v = parseInt(q, 16) / 255;
        return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
      });
  const blue = tint('#759faa'),
    cream = tint('#c5d2ca'),
    dark = tint('#6d929e');
  f(
    'tile',
    [
      [-21.7, floor + 4.65, z],
      [18.8, floor + 4.65, z],
      [18.8, floor + 9.65, z],
      [-21.7, floor + 9.65, z],
    ],
    [0, 0, -1],
    blue,
  );
  if (d >= 2)
    for (let x = -21.2; x < 18.4; x += 1.3)
      for (let y = 5.0; y < 9.6; y += 1.3) {
        const q = 0.27;
        f(
          'tile',
          [
            [x - q, floor + y, z - 0.015],
            [x, floor + y + q, z - 0.015],
            [x + q, floor + y, z - 0.015],
            [x, floor + y - q, z - 0.015],
          ],
          [0, 0, -1],
          cream,
        );
        if (d >= 3) {
          const w = 0.13;
          f(
            'tile',
            [
              [x - w, floor + y, z - 0.025],
              [x, floor + y + w, z - 0.025],
              [x + w, floor + y, z - 0.025],
              [x, floor + y - w, z - 0.025],
            ],
            [0, 0, -1],
            dark,
          );
        }
      }
  if (d >= 1)
    for (const y of [4.65, 9.65])
      f(
        'trim',
        [
          [-21.7, floor + y, z - 0.03],
          [18.8, floor + y, z - 0.03],
          [18.8, floor + y + 0.18, z - 0.03],
          [-21.7, floor + y + 0.18, z - 0.03],
        ],
        [0, 0, -1],
      );
}
function hall(out, face, d) {
  const r = plans.hall.outline,
    hs = rustemHallFields(d);
  shell(out, d, r, 4.5, 12.3, hs, 'wall');
  cap(face, r, 12.3, 'roof');
  tileFields(out, d, hs);
  closedFields(face, hs, d);
  band(face, r, 12.05, 0.25, 'trim', 1.01);
  if (d >= 2) {
    const f = writer(
      masked(
        out,
        hs.map((h) => prepareOpening(h, 0, d)),
      ),
      d,
    );
    band(f, r, 8.65, 0.18, 'trim', 1.002);
  }
  for (const wing of [plans.west, plans.east]) {
    const xMin = Math.min(...wing.outline.map((p) => p[0]));
    const xMax = Math.max(...wing.outline.map((p) => p[0]));
    shell(
      out,
      d,
      wing.outline,
      4.5,
      9.7,
      hs.filter((h) => h.name.startsWith('porch-door') && h.center[0] > xMin && h.center[0] < xMax),
      'wall',
    );
    cap(face, wing.outline, 9.7, 'roof');
    if (d >= 1) band(face, wing.outline, 9.48, 0.22, 'trim', 1.01);
  }
  for (const x of [-11.6, 8.7])
    for (const z of [-3.3, 15.8]) {
      dome(face, [x, z], 3.0, 12.3, 2.3, d, true);
      if (d >= 2) finial(face, [x, z], 14.6, d, 0.45);
    }
  for (const x of [-18.5, 15.6]) dome(face, [x, 2.4], 2.6, 9.7, 2.0, d, true);
}
function central(face, d) {
  const p = plans.dome.center,
    r = plans.dome.radius,
    n = [8, 12, 20, 28, 32][d],
    ring = circle(p, r, n);
  // The main roof is a closed exterior shell; clerestory panes sit just outside its drum.
  profile(
    face,
    ring,
    [
      [12.3, 1],
      [16.1, 1],
    ],
    'wall',
  );
  if (d >= 1) {
    band(face, ring, 12.5, 0.25, 'trim', 1.02);
    band(face, ring, 15.88, 0.24, 'trim', 1.025);
    const count = d === 1 ? 8 : d === 2 ? 12 : 16;
    for (let i = 0; i < count; i++) {
      const a = ((i + 0.5) * Math.PI * 2) / count,
        normal = [Math.cos(a), Math.sin(a)],
        axis = [-normal[1], normal[0]],
        q = [p[0] + normal[0] * r, p[1] + normal[1] * r],
        h = hole(`clerestory-${i}`, q, axis, normal, 0.8, 13.0, 2.45, 1.8, 'pointed', 0.4);
      pane(face, h, d, 0.1);
      archBand(face, h, d, 0.18, 'trim', 0.13);
    }
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4,
        q = [p[0] + Math.cos(a) * 8.2, p[1] + Math.sin(a) * 8.2];
      solid(face, rect(q[0] - 0.37, q[1] - 0.37, q[0] + 0.37, q[1] + 0.37), 12.3, 15.8, 'trim');
    }
  }
  dome(face, p, r, 16.1, 6.7, d);
  finial(face, p, 22.8, d, 0.9);
}
function porch(out, face, d) {
  const r = plans.porch.outline,
    hs = rustemPorchArches(d);
  shell(out, d, r, 8.1, 10.3, hs, 'wall');
  cap(face, r, 10.3, 'roof');
  _underside(face, r, 10.3, 'trim');
  if (d >= 1)
    for (const h of hs) {
      const front = {
        ...h,
        center: [h.center[0], h.name.startsWith('court-side') ? h.center[1] : -12.8],
      };
      archBand(face, front, d, 0.25, 'trim', 0.07);
    }
  for (let i = 0; i <= 5; i++)
    _column(face, [-21.7 + (40.5 * i) / 5, -12.8], 4.5, 8.1, d === 0 ? 0.42 : 0.32, d, 'trim');
  for (const p of plans.porchEdge.bays) {
    const q = [p[0], -10];
    dome(face, q, 2.72, 10.3, 2.5, d, true);
    if (d >= 1) finial(face, q, 12.8, d, 0.45);
  }
  band(face, r, 10.05, 0.25, 'trim', 1.005);
}
function canopy(face, d) {
  const r = plans.canopy.outline,
    a = [-19.7, 9.25, -16.2],
    b = [19.7, 9.25, -16.2],
    v = r.map((p) => at(p, 8.05)),
    aa = [a[0], floor + a[1], a[2]],
    bb = [b[0], floor + b[1], b[2]];
  face('roof', [v[0], v[1], bb, aa], [0, 1, -0.3]);
  face('roof', [v[1], v[2], bb], [1, 1, 0]);
  face('roof', [v[2], v[3], aa, bb], [0, 1, 0.3]);
  face('roof', [v[3], v[0], aa], [-1, 1, 0]);
  _underside(face, r, 8.04, 'wood');
  for (const z of [-19.3, -13.1])
    for (let i = 0; i <= 5; i++) {
      const x = -22.4 + (44.8 * i) / 5;
      _column(face, [x, z], 4.5, 8.05, d === 0 ? 0.3 : 0.22, Math.min(d, 2), 'wood');
    }
  if (d >= 1) for (const e of edges(r)) _openBand(face, e.a, e.b, 7.8, 0.25, 'wood', 0.17);
}
function minaret(face, d) {
  const p = plans.minaret.center,
    n = [6, 8, 12, 16, 20][d];
  solid(face, rect(p[0] - 1.5, p[1] - 1.5, p[0] + 1.5, p[1] + 1.5), 4.5, 10.0, 'wall');
  profile(
    face,
    circle(p, 1.12, n),
    [
      [10, 1.45],
      [12.2, 1],
      [24.4, 0.88],
    ],
    'trim',
  );
  profile(
    face,
    circle(p, 1.12, n),
    [
      [24.4, 0.88],
      [24.95, 1.55],
      [25.4, 1.55],
    ],
    'trim',
  );
  profile(
    face,
    circle(p, 0.96, n),
    [
      [25.2, 1],
      [30.0, 0.85],
    ],
    'trim',
  );
  if (d >= 1) {
    sides(face, circle(p, 1.82, n), 25.38, 26.15, 'trim');
    cap(face, circle(p, 1.82, n), 26.15, 'trim', [circle(p, 1.51, n)]);
    if (d >= 3)
      for (let i = 0; i < 12; i++) {
        const a = (i * Math.PI) / 6;
        _column(
          face,
          [p[0] + Math.cos(a) * 1.66, p[1] + Math.sin(a) * 1.66],
          25.4,
          26.15,
          0.1,
          0,
          'trim',
        );
      }
  }
  profile(
    face,
    circle(p, 1.08, n),
    [
      [30.0, 1],
      [35.3, 0],
    ],
    'roof',
  );
  finial(face, p, 35.3, d, 0.5);
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
  platform(out, face, d);
  hall(out, face, d);
  central(face, d);
  porch(out, face, d);
  canopy(face, d);
  minaret(face, d);
}
export const buildRustemSkyline = (o) => build(o, 0),
  buildRustemDistrict = (o) => build(o, 1),
  buildRustemStreet = (o) => build(o, 2),
  buildRustemCloseup = (o) => build(o, 3);
const cam = (name, position, lookAt) => ({ name, position, lookAt, fov: 48 });
export const rustemStudy = {
  id: 'N0473',
  key: 'rustem_pasha_mosque',
  title: 'Rüstem Pasha Mosque',
  category: 'mosque',
  wikidataId: 'Q1137511',
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
    'Six shared256² coursed/raw limestone,standing-seam metal,plain wood,ceramic tile and cast bronze graphs;seven merged roles including local opaque glazing. Metric UVs and linear tints,no embedded images,unique atlas,copied historic tile art/calligraphy or baked light.',
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
    'Two inspected2003/2009 pictures guide the exterior vocabulary. Historic tile motifs,lattice,inscriptions and current restoration state are not reproduced. The front canopy,porch,hall,side galleries and tower are approximate partitions inside the mapped envelope. Closed panes/doors are opaque exterior fields;the model has no furnished or navigable interior. Exact threshold/grade joins,engineering and physical-device/full-city timing remain unverified.',
  ],
  camera: scope.camera,
  qaLodCameras: scope.qaLodCameras,
  qaCameras: [
    cam('five-domed-porch-and-canopy', [-45, 19, -51], [0, 9, -11]),
    cam('windowed-central-drum-and-dome', [35, 32, 36], [-1.45, 18, 6.25]),
    cam('blue-tile-fields-and-pointed-arches', [-13, 9, -17], [-2, 7.3, -7]),
    cam('raised-shop-base', [-35, 8, -40], [0, 2, -18]),
    cam('single-minaret-and-balcony', [39, 29, -27], [16.6, 24, -5.4]),
    cam('mapped-envelope-plan', [0, 132, 0.1], [0, 5, 0]),
  ],
};
