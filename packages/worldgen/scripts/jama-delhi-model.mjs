/** Delhi Jama Masjid: three striped domes, two minarets and three gateways. */
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
  '../../../content/worldgen/source/places/tt/ttn/n0422_jama_masjid_delhi/',
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
  wall: '#b46651',
  trim: '#dcccb6',
  roof: '#e0d7c4',
  door: '#705d4c',
  gold: '#bda46a',
  glass: '#52636b',
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
const footing = (p) => Math.min(-0.35, floor - 0.3, jamaDelhiGround(...p) - 0.35);
export function jamaDelhiGround(x, z) {
  const c = Math.cos(fit.heading),
    s = Math.sin(fit.heading);
  [x, z] = [x * c + z * s, -x * s + z * c];
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw Error('Jama Masjid, Delhi Mosque footing outside retained terrain');
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
const band = (face, r, y, h = 0.25, slot = 'trim', factor = 1.02) =>
  sides(face, scaled(r, factor), y, y + h, slot);
function beam(face, a, b, w, slot = 'trim', capped = true) {
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
  if (capped) {
    face(
      slot,
      lo,
      axis.map((v) => -v),
    );
    face(slot, hi, axis);
  }
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    face(slot, [lo[i], lo[j], hi[j], hi[i]]);
  }
}
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
  rect = (x0, z0, x1, z1) => [
    [x0, z0],
    [x1, z0],
    [x1, z1],
    [x0, z1],
  ],
  circle = (p, r, n) =>
    Array.from({ length: n }, (_, i) => {
      const a = (-i * Math.PI * 2) / n;
      return [p[0] + r * Math.cos(a), p[1] + r * Math.sin(a)];
    }),
  edges = (r) =>
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
const darkStripe = [0.105, 0.112, 0.118];
export function jamaDelhiHallFields(d = 3) {
  if (d === 0) return [];
  const out = [],
    center = -0.5;
  for (const side of [-1, 1])
    for (let i = 0; i < 5; i++) {
      if (d === 1 && i % 2) continue;
      out.push({
        ...hole(
          `hall-bay-${side}-${i}`,
          [-38.95, center + side * (10.2 + i * 5.45)],
          [0, 1],
          [1, 0],
          4.4,
          0.12,
          7.6,
          4.7,
        ),
        kind: 'door',
        inset: 0.65,
      });
    }
  out.push({
    ...hole('main-iwan', [-36.6, center], [0, 1], [1, 0], 12.4, 0.1, 18.5, 12.6, 'pointed', 6),
    kind: 'door',
    inset: 2.0,
  });
  if (d >= 2)
    for (let i = 0; i < 9; i++)
      out.push(hole(`rear-light-${i}`, [-61.5, -31 + i * 8], [0, 1], [-1, 0], 1.7, 5.5, 3.5, 2.3));
  return out;
}
export function jamaDelhiGateFields(d = 3) {
  if (d === 0) return [];
  const out = [];
  for (const g of plans.gates) {
    const es = edges(g.outline).filter(
      (e) => Math.abs(e.normal[0] * g.normal[0] + e.normal[1] * g.normal[1]) > 0.9,
    );
    for (const [k, e] of es.entries()) {
      const p = lerp(e.a, e.b, 0.5);
      out.push({
        ...hole(
          `gate-door-${g.name}-${k}`,
          p,
          e.axis,
          e.normal,
          g.name === 'east' ? 5.7 : 4.3,
          0.08,
          7.5,
          5.2,
          'pointed',
          3,
        ),
        kind: 'door',
        inset: 0.65,
      });
      for (const side of [-1, 1])
        for (const y of [3, 11]) {
          const q = p.map((v, k) => v + e.axis[k] * side * (g.name === 'east' ? 8.6 : 4.8));
          out.push(
            hole(`gate-light-${g.name}-${k}-${side}-${y}`, q, e.axis, e.normal, 1.65, y, 3.0, 1.9),
          );
        }
    }
  }
  return out;
}
export function jamaDelhiGateGallery(d = 3) {
  if (d === 0) return [];
  const out = [];
  for (const g of plans.gates)
    for (const [i, e] of edges(g.outline).entries()) {
      const count =
        d === 1 ? Math.max(2, Math.round(e.length / 5)) : Math.max(2, Math.round(e.length / 3.3));
      for (let j = 0; j < count; j++)
        out.push(
          hole(
            `gate-gallery-${g.name}-${i}-${j}`,
            lerp(e.a, e.b, (j + 0.5) / count),
            e.axis,
            e.normal,
            e.length / count - 0.65,
            g.height + 0.12,
            2.55,
            1.65,
            'round',
            2.2,
          ),
        );
    }
  return out;
}
export function jamaDelhiCourtArches(d = 3) {
  if (d === 0) return [];
  const out = [];
  for (const [i, e] of plans.arcadeLines.entries()) {
    const length = Math.hypot(e.b[0] - e.a[0], e.b[1] - e.a[1]),
      axis = unit(e.b.map((v, k) => v - e.a[k])),
      count = Math.max(1, Math.round(length / (d === 1 ? 15 : d === 2 ? 11 : 5.8)));
    for (let j = 0; j < count; j++)
      out.push(
        hole(
          `court-${i}-${j}`,
          lerp(e.a, e.b, (j + 0.5) / count),
          axis,
          e.normal,
          length / count - 0.75,
          0.08,
          4.9,
          3.0,
          'pointed',
          1.7,
        ),
      );
  }
  return out;
}
function trimArch(face, h, d, w = 0.3, slot = 'trim') {
  archBand(face, h, d === 2 ? 1 : d, w, slot, 0.065);
}
function finish(face, fields, d) {
  for (const h of fields) {
    pane(face, h, d, d === 1 ? 0.035 : -(h.inset ?? 0.5), h.kind === 'door' ? 'door' : 'glass');
    if (d >= 2) trimArch(face, h, d, h.name === 'main-iwan' ? 0.52 : 0.26);
  }
}
function finial(face, p, y, h, d) {
  if (d === 0) {
    profile(
      face,
      circle(p, 0.12, 4),
      [
        [y, 1],
        [y + h, 0],
      ],
      'gold',
    );
    return;
  }
  profile(
    face,
    circle(p, 0.24, d <= 2 ? 4 : 6),
    d === 1
      ? [
          [y, 0.5],
          [y + h * 0.3, 1],
          [y + h, 0],
        ]
      : [
          [y, 0.4],
          [y + h * 0.25, 1],
          [y + h * 0.5, 0.55],
          [y + h, 0],
        ],
    'gold',
  );
}
function onion(face, p, r, base, height, d, striped = false, small = false) {
  const raw = [
      [0, 0.66],
      [0.18, 0.92],
      [0.4, 1.04],
      [0.61, 0.94],
      [0.79, 0.68],
      [0.92, 0.35],
      [1, 0],
    ],
    levels =
      d === 0
        ? [raw[0], raw[2], raw[4], raw[6]]
        : d === 1
          ? [raw[0], raw[1], raw[2], raw[4], raw[6]]
          : raw,
    n = small && d === 1 ? 4 : [6, 8, 16, 24, 28][d];
  profile(
    face,
    circle(p, r, n),
    levels.map(([y, s]) => [base + y * height, s]),
    'roof',
  );
  if (!striped) return;
  const count = [2, 6, 12, 16, 20][d],
    half = d <= 1 ? 0.022 : 0.012,
    step = (Math.PI * 2) / n,
    P = ([y, s], a) => {
      const t = ((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2),
        middle = (Math.floor(t / step) + 0.5) * step,
        R = (r * s * Math.cos(Math.PI / n)) / Math.cos(t - middle) + 0.014;
      return [p[0] + Math.cos(a) * R, floor + base + y * height, p[1] + Math.sin(a) * R];
    };
  for (let j = 0; j < count; j++) {
    const a = (j * Math.PI * 2) / count;
    for (let i = 1; i < levels.length; i++)
      face(
        'roof',
        [
          P(levels[i - 1], a - half),
          P(levels[i - 1], a + half),
          P(levels[i], a + half),
          P(levels[i], a - half),
        ],
        [Math.cos(a), 0, Math.sin(a)],
        darkStripe,
      );
  }
}
function chhatri(face, p, r, base, top, d) {
  const ring = circle(p, r, d <= 1 ? 4 : 8),
    gallery = top - 3.2;
  if (d === 0) {
    profile(
      face,
      ring,
      [
        [base, 1],
        [gallery, 1],
        [top - 1, 1.1],
        [top, 0],
      ],
      'wall',
    );
    return;
  }
  solid(face, ring, base, gallery, 'wall');
  cap(face, scaled(ring, 1.15), gallery, 'trim');
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2,
      q = [p[0] + r * 0.82 * Math.cos(a), p[1] + r * 0.82 * Math.sin(a)];
    sides(
      face,
      rect(q[0] - 0.14, q[1] - 0.14, q[0] + 0.14, q[1] + 0.14),
      gallery,
      top - 1.1,
      'wall',
    );
  }
  cap(face, scaled(ring, 1.18), top - 1.1, 'trim');
  onion(face, p, r * 1.1, top - 1.1, 1.1, d, false, true);
  finial(face, p, top, 0.6, d);
}
function frameRect(face, x, z, y, width, height, w = 0.28) {
  const r = (a, b, c, e) =>
    face(
      'trim',
      [
        [x, floor + b, z + a],
        [x, floor + b, z + c],
        [x, floor + e, z + c],
        [x, floor + e, z + a],
      ],
      [1, 0, 0],
    );
  r(-width / 2, y, width / 2, y + w);
  r(-width / 2, y + height - w, width / 2, y + height);
  r(-width / 2, y, -width / 2 + w, y + height);
  r(width / 2 - w, y, width / 2, y + height);
}
function hall(out, face, d) {
  const fields = jamaDelhiHallFields(d);
  shell(
    out,
    d,
    plans.hall,
    footing,
    11.5,
    d >= 2 ? fields.filter((h) => h.name !== 'main-iwan') : [],
    'wall',
  );
  cap(face, plans.hall, 11.5, 'wall');
  shell(
    out,
    d,
    plans.portal,
    0,
    21.5,
    d >= 2 ? fields.filter((h) => h.name === 'main-iwan') : [],
    'wall',
  );
  cap(face, plans.portal, 21.5, 'wall');
  finish(face, fields, d);
  for (const p of plans.domes) {
    solid(face, circle(p.center, p.radius * 0.66, [6, 8, 16, 24, 28][d]), 11.5, p.base, 'wall');
    onion(face, p.center, p.radius, p.base, p.height, d, true);
    finial(face, p.center, p.base + p.height, 1.5, d);
  }
  for (const p of plans.portalTurrets) chhatri(face, p, 0.65, 11.5, 26, d);
  if (d >= 1) {
    band(face, plans.hall, 11, 0.5, 'trim', 1.005);
    band(face, plans.portal, 20.9, 0.6, 'trim', 1.012);
  }
  if (d >= 2) {
    for (const side of [-1, 1])
      for (let i = 0; i < 5; i++) {
        const z = -0.5 + side * (10.2 + i * 5.45);
        frameRect(face, -38.87, z, 0.1, 5.15, 11.2);
        frameRect(face, -38.86, z, 8.7, 3.9, 1.7, 0.2);
      }
    frameRect(face, -36.52, -0.5, 0.1, 15.7, 21.0, 0.43);
    frameRect(face, -36.51, -0.5, 19.1, 12.5, 1.5, 0.25);
  }
  if (d >= 3)
    for (const e of edges(plans.hall)) {
      const count = Math.round(e.length / 1.45);
      for (let i = 0; i < count; i++) {
        const p = lerp(e.a, e.b, (i + 0.5) / count);
        profile(
          face,
          circle(p, 0.3, 4),
          [
            [11.5, 1],
            [12.3, 0.85],
            [12.7, 0],
          ],
          'wall',
        );
      }
    }
}
function minaret(face, m, d) {
  const p = m.center,
    n = [4, 6, 10, 16, 20][d],
    r = circle(p, m.radius, n),
    levels = [
      [0.1, 1.1],
      [3, 1],
      [11.5, 0.95],
    ];
  if (d === 0) levels.splice(1, 2, [34.4, 0.86], [34.7, 1.18], [35, 0.8]);
  else {
    for (const y of [12, 24, 34]) levels.push([y - 0.4, 0.92], [y, 1.18], [y + 0.6, 0.86]);
    levels.push([35, 0.8]);
  }
  profile(face, r, levels, 'wall');
  if (d >= 1) {
    for (const y of [12, 24, 34])
      profile(
        face,
        r,
        [
          [y + 0.1, 1.17],
          [y + 0.6, 1.17],
        ],
        'trim',
      );
    const count = d === 1 ? 4 : d === 2 ? 8 : 16;
    for (const [a, b] of [
      [3, 11.3],
      [12.7, 23.3],
      [24.7, 33.3],
    ])
      for (let i = 0; i < count; i++) {
        const angle = (i * Math.PI * 2) / count,
          step = (Math.PI * 2) / n,
          point = (y, angle) => {
            let k = 1;
            while (k < levels.length - 1 && levels[k][0] < y) k++;
            const lo = levels[k - 1],
              hi = levels[k],
              radius = m.radius * (lo[1] + ((hi[1] - lo[1]) * (y - lo[0])) / (hi[0] - lo[0])),
              t = ((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2),
              mid = (Math.floor(t / step) + 0.5) * step,
              R = (radius * Math.cos(Math.PI / n)) / Math.cos(t - mid) + 0.014;
            return [p[0] + Math.cos(angle) * R, floor + y, p[1] + Math.sin(angle) * R];
          };
        face(
          'trim',
          [
            point(a, angle - 0.025),
            point(a, angle + 0.025),
            point(b, angle + 0.025),
            point(b, angle - 0.025),
          ],
          [Math.cos(angle), 0, Math.sin(angle)],
        );
      }
  }
  if (d === 0) {
    profile(
      face,
      r,
      [
        [35, 0.82],
        [38.2, 1],
        [39.2, 0],
      ],
      'roof',
    );
    finial(face, p, 39.2, 0.8, d);
    return;
  }
  const R = m.radius * 0.8,
    posts = d === 1 ? 4 : 8;
  cap(face, circle(p, R * 1.2, posts), 35, 'trim');
  for (let i = 0; i < posts; i++) {
    const a = (i * Math.PI * 2) / posts,
      q = [p[0] + R * 0.8 * Math.cos(a), p[1] + R * 0.8 * Math.sin(a)];
    sides(face, rect(q[0] - 0.14, q[1] - 0.14, q[0] + 0.14, q[1] + 0.14), 35, 38, 'trim');
  }
  cap(face, circle(p, R * 1.25, posts), 38, 'trim');
  onion(face, p, R * 1.1, 38, 1.2, d, false, true);
  finial(face, p, 39.2, 0.8, d);
}
function court(out, face, d) {
  const fields = [...jamaDelhiHallFields(d), ...jamaDelhiGateFields(d)],
    boundary =
      d >= 2
        ? writer(
            masked(
              out,
              fields.map((h) => prepareOpening(h, 0, d === 2 ? 1 : d)),
            ),
            d,
          )
        : face;
  sides(boundary, plans.outer, footing, 6.1, 'wall');
  cap(boundary, plans.outer, 6.1, 'wall', [plans.court]);
  cap(face, plans.outer, 0.035, 'wall');
  const arches = jamaDelhiCourtArches(d);
  for (const [i, e] of plans.arcadeLines.entries()) {
    const a = e.a,
      b = e.b,
      r = [a, b, b.map((v, k) => v - e.normal[k] * 0.8), a.map((v, k) => v - e.normal[k] * 0.8)],
      fs = arches.filter((h) => h.name.startsWith(`court-${i}-`));
    if (d === 0) {
      sides(face, r, 0, 6.1, 'wall');
      continue;
    }
    if (d === 1) {
      const count = fs.length;
      for (let j = 0; j <= count; j++) {
        const p = lerp(a, b, j / count);
        beam(face, at(p, 0), at(p, 6.1), 0.75, 'wall', false);
      }
      for (const h of fs) {
        const q = prepareOpening(h, 0, 1),
          ns = Math.sign(-q.axis[1] * h.normal[0] + q.axis[0] * h.normal[1]),
          arc = openingShape(h, 1).slice(2);
        for (let j = 0; j < arc.length - 1; j++)
          for (const z of [0, -0.7])
            face(
              'wall',
              [
                q.point(arc[j][0], arc[j][1], z * ns),
                q.point(arc[j + 1][0], arc[j + 1][1], z * ns),
                q.point(arc[j + 1][0], floor + 6.1, z * ns),
                q.point(arc[j][0], floor + 6.1, z * ns),
              ],
              [h.normal[0] * (z === 0 ? 1 : -1), 0, h.normal[1] * (z === 0 ? 1 : -1)],
            );
      }
    } else {
      shell(out, d, r, 0, 6.1, fs, 'wall');
      for (const h of fs) trimArch(face, h, d, 0.2, 'wall');
    }
  }
  for (const p of plans.cornerPavilions) chhatri(face, p, 2.8, 6.1, 12, d);
  if (d >= 3) {
    for (const e of edges(plans.outer)) {
      const count = Math.round(e.length / 1.7);
      for (let i = 0; i < count; i++) {
        const p = lerp(e.a, e.b, (i + 0.5) / count);
        profile(
          boundary,
          circle(p, 0.3, 4),
          [
            [6.1, 1],
            [6.7, 0.9],
            [7.2, 0],
          ],
          'wall',
        );
      }
    }
  }
}
function gates(out, face, d) {
  const fields = jamaDelhiGateFields(d),
    gallery = jamaDelhiGateGallery(d);
  for (const g of plans.gates) {
    const fs = fields.filter((h) => h.name.includes(`-${g.name}-`)),
      gs = gallery.filter((h) => h.name.startsWith(`gate-gallery-${g.name}-`));
    shell(out, d, g.outline, footing, g.height, d >= 2 ? fs : [], 'wall');
    cap(face, g.outline, g.height, 'wall');
    finish(face, fs, d);
    const inner = scaled(g.outline, 0.9);
    if (d === 0) {
      sides(face, g.outline, g.height, g.height + 3, 'wall');
      cap(face, g.outline, g.height + 3, 'wall');
    } else if (d === 1) {
      for (const [i, e] of edges(g.outline).entries()) {
        const hs = gs.filter((h) => h.name.startsWith(`gate-gallery-${g.name}-${i}-`));
        for (let j = 0; j <= hs.length; j++) {
          const p = lerp(e.a, e.b, j / hs.length);
          beam(face, at(p, g.height), at(p, g.height + 3), 0.38, 'wall', false);
        }
      }
      cap(face, g.outline, g.height + 3, 'wall', [inner]);
    } else shell(out, d, g.outline, g.height, g.height + 3, gs, 'wall', inner);
    for (const p of g.outline) {
      const ring = circle(p, d === 0 ? 0.15 : 0.3, d === 0 ? 3 : 6);
      profile(
        face,
        ring,
        d === 0
          ? [
              [g.height + 2.8, 1],
              [g.height + 6, 0],
            ]
          : [
              [g.height + 2.8, 1],
              [g.height + 5, 0.7],
              [g.height + 5.5, 0],
            ],
        'trim',
      );
      if (d > 0) finial(face, p, g.height + 5.5, 0.5, d);
    }
    if (d >= 2)
      for (const h of fs.filter((h) => h.kind === 'door')) {
        const big = {
          ...h,
          width: h.width * 2.0,
          bottom: floor + 0.15,
          height: g.height - 2,
          spring: g.height * 0.59,
        };
        trimArch(face, big, d, 0.25, 'wall');
        const p = h.center.map((v, k) => v + h.normal[k] * 0.55),
          r = rect(p[0] - 0.8, p[1] - 0.8, p[0] + 0.8, p[1] + 0.8);
        solid(face, r, 10.0, 10.35, 'trim');
      }
  }
}
function pool(face, d) {
  const inner = rec.pool.outline,
    outer = scaled(inner, 1.14);
  sides(face, outer, 0.05, 0.55, 'trim');
  if (d > 0) sides(face, inner, 0.1, 0.55, 'trim', true);
  cap(face, outer, 0.55, 'trim', [inner]);
  cap(face, inner, 0.1, 'glass');
  if (d >= 1) for (const p of outer) finial(face, p, 0.55, 1.8, d);
}
function stairs(face, d) {
  for (const s of rec.steps) {
    const run = Math.hypot(s.bottom[0] - s.top[0], s.bottom[1] - s.top[1]),
      axis = s.bottom.map((v, k) => (v - s.top[k]) / run),
      across = [-axis[1], axis[0]],
      gate = plans.gates.find(
        (g) => g.name === (s.top[0] > 40 ? 'east' : s.top[1] > 0 ? 'south' : 'north'),
      ),
      dot = (a, b) => a[0] * b[0] + a[1] * b[1],
      landing = Math.max(
        0,
        (Math.max(...gate.outline.map((p) => dot(p, gate.normal))) - dot(s.top, gate.normal)) /
          dot(axis, gate.normal),
      ),
      start = s.top.map((v, k) => v + axis[k] * landing),
      count =
        d === 0
          ? 2
          : d === 1
            ? 6
            : Math.min(
                d === 2 ? 36 : 64,
                Math.max(3, Math.ceil((floor - s.bottomY) / (d === 2 ? 0.42 : 0.18))),
              );
    for (let i = 0; i < count; i++) {
      const a = lerp(start, s.bottom, i / count),
        b = lerp(start, s.bottom, (i + 1) / count),
        r = [
          a.map((v, k) => v - (across[k] * s.width) / 2),
          a.map((v, k) => v + (across[k] * s.width) / 2),
          b.map((v, k) => v + (across[k] * s.width) / 2),
          b.map((v, k) => v - (across[k] * s.width) / 2),
        ],
        y = floor + ((s.bottomY - floor) * (i + 1)) / count;
      if (d === 0) {
        // A continuous far approach avoids detached tread fragments where coarse DEM rises.
        const remaining = Math.hypot(s.bottom[0] - start[0], s.bottom[1] - start[1]),
          top = (p) => {
            const t = Math.max(
              0,
              Math.min(1, ((p[0] - start[0]) * axis[0] + (p[1] - start[1]) * axis[1]) / remaining),
            );
            return Math.max(floor + (s.bottomY - floor) * t, jamaDelhiGround(...p) + 0.12);
          };
        solid(face, r, (p) => Math.min(jamaDelhiGround(...p) - 0.2, top(p) - 0.2), top, 'wall');
      } else
        solid(face, r, (p) => Math.min(jamaDelhiGround(...p) - 0.2, y - 0.2), y - floor, 'wall');
    }
  }
}
function build(target, d) {
  const out = {
      addTriangle(...a) {
        const p = a[2].map((q) => q.map(Math.fround));
        function emit(p, uv) {
          let longest = 0,
            k = 0;
          for (let i = 0; i < 3; i++) {
            const length = Math.hypot(p[i][0] - p[(i + 1) % 3][0], p[i][2] - p[(i + 1) % 3][2]);
            if (length > longest) {
              longest = length;
              k = i;
            }
          }
          if (longest > (d === 0 ? 40 : d === 1 ? 30 : 18)) {
            const j = (k + 1) % 3,
              c = (k + 2) % 3,
              m = lerp(p[k], p[j], 0.5).map(Math.fround),
              v = lerp(uv[k], uv[j], 0.5);
            emit([p[k], m, p[c]], [uv[k], v, uv[c]]);
            emit([m, p[j], p[c]], [v, uv[j], uv[c]]);
            return;
          }
          if (
            Math.hypot(
              ...cross(
                p[1].map((v, k) => v - p[0][k]),
                p[2].map((v, k) => v - p[0][k]),
              ),
            ) < 1e-7
          )
            return;
          target.addTriangle(a[0], a[1], p, a[3], uv, a[5]);
        }
        emit(p, a[4]);
      },
    },
    face = writer(out, d);
  hall(out, face, d);
  court(out, face, d);
  gates(out, face, d);
  pool(face, d);
  stairs(face, d);
  for (const m of plans.minarets) minaret(face, m, d);
}
export const buildJamaDelhiSkyline = (o) => build(o, 0),
  buildJamaDelhiDistrict = (o) => build(o, 1),
  buildJamaDelhiStreet = (o) => build(o, 2),
  buildJamaDelhiCloseup = (o) => build(o, 3);
const cam = (name, position, lookAt) => ({ name, position, lookAt, fov: 48 });
export const jamaDelhiStudy = {
  id: 'N0422',
  key: 'jama_masjid_delhi',
  title: 'Jama Masjid, Delhi',
  category: 'mosque',
  wikidataId: 'Q233678',
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
    'Original geometry under repository license;map geometry ©OpenStreetMap contributors,ODbL-1.0. Reference photographs viewed only,not redistributed.',
  dataAttribution: '©OpenStreetMap contributors;Protomaps;Mapzen/USGS terrain tiles.',
  sourceNotice:
    'Four existing shared256² sandstone,marble,plain wood and bronze graphs;six merged groups including local glazing/water. Pale trim and roofs reuse marble;dark dome stripes and pale minaret inlay are original geometry/linear tints over shared surfaces. Metric UVs;no embedded images,baked lighting,unique facade maps or copied lettering.',
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
    'Individual medium-fi exterior from four actually inspected2006/2007/2019 facade/court/gate pictures and standard viewer PMTiles/DEM. Three pale dark-striped domes,two pale-striped cylindrical minarets/open cupolas,central iwan/ten side bays,three gateways/open upper galleries,pinnacles,corner pavilions,mapped water basin and three vector-aligned stair approaches. Fine cusped/scalloped carving,inlay inscriptions,lattice,muqarnas,fixtures,actual interiors,engineering,current finish and exact site joins excluded or abstracted. Main hall/gateway fields terminate closed;court/cupola/gallery voids are exterior openings,no enclosed interior/free traversal claim. Stair widths,treads/rises and street landings are approximate;standard DEM is retained,not a surveyed plinth datum. Adjacent markets,streets,Red Fort,outer plazas/trees/city content excluded. Synthetic context and physical-device timing unverified.',
  ],
  camera: scope.camera,
  qaCameras: [
    cam('three-striped-domes-and-two-minarets', [127, 65, 108], [-28, 18, 0]),
    cam('central-iwan-and-ten-bays', [-6, 22, -0.5], [-39, 12, -0.5]),
    cam('open-red-court-arcade', [22, 10, 21], [25, 5, 52]),
    cam('east-gateway-and-steps', [123, 28, -15], [55, 14, -1]),
    cam('mapped-marble-rimmed-basin', [21, 18, 23], [-1, 2, 2]),
    cam('roof-and-signed-plan', [0, 275, 0.1], [0, 20, 0]),
  ],
};
