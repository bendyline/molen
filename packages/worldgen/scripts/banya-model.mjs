/** Banya Bashi: retained mosque plan,three-domed portico and single-balcony brick minaret. */
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
  '../../../content/worldgen/source/places/sx/sx8/n0471_banya_bashi_mosque/',
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
  wall: '#bf9d87',
  masonry: '#b7aea0',
  trim: '#d2cbbb',
  roof: '#8d949a',
  door: '#55796b',
  gold: '#cbb47d',
  glass: '#53646c',
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
const _lerp = (a, b, t) => a.map((v, k) => v + (b[k] - v) * t);
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
const footing = (p) => Math.min(-0.35, floor - 0.3, banyaGround(...p) - 0.35);
export function banyaGround(x, z) {
  const c = Math.cos(fit.heading),
    s = Math.sin(fit.heading);
  [x, z] = [x * c + z * s, -x * s + z * c];
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw Error('Banya Bashi footing outside retained terrain');
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
  solid(face, scaled(r, f), y, y + h, slot);
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
export function banyaHallFields(d = 3) {
  const hs = [];
  if (d === 0) return hs;
  for (const x of [-8.12, 13.96])
    for (const z of [-7.5, -0.5])
      for (const y of d === 1 ? [2] : [1.6, 5.4])
        hs.push(
          hole(
            `side-${x}-${z}-${y}`,
            [x, z],
            [0, 1],
            [Math.sign(x), 0],
            1.5,
            y,
            2.3,
            1.5,
            'pointed',
            1.5,
          ),
        );
  for (const x of [-3.8, 3.2, 10.2])
    hs.push(hole(`back-${x}`, [x, -12.2], [1, 0], [0, -1], 1.5, 2, 2.7, 1.8, 'pointed', 1.5));
  for (const [i, p] of plans.porchEdge.bays.entries())
    hs.push({
      ...hole(
        `porch-back-${i}`,
        [p[0], 6.75],
        [1, 0],
        [0, 1],
        i === 1 ? 2.3 : 1.5,
        i === 1 ? 0.15 : 1.5,
        i === 1 ? 3.5 : 2.4,
        2,
        'pointed',
        1.5,
      ),
      kind: i === 1 ? 'door' : 'glass',
    });
  return hs;
}
export function banyaPorticoArches(d = 3) {
  const p = plans.porchEdge,
    hs = p.bays.map((q, i) =>
      hole(`front-${i}`, q, p.axis, p.normal, 6.2, -0.1, 4.6, 2.8, 'pointed', 12),
    );
  if (d >= 1)
    hs.push(hole('west-side', [-13.6, -4.5], [0, 1], [-1, 0], 5.1, -0.1, 4.6, 2.8, 'pointed', 10));
  return hs;
}
function closedFields(face, hs, d) {
  for (const h of hs) {
    pane(face, h, d, -0.24, h.kind ?? 'glass');
    if (d >= 1) archBand(face, h, d, 0.2, 'trim', 0.055);
  }
}
function hall(out, face, d) {
  const hs = banyaHallFields(d),
    r = plans.hall.outline;
  shell(out, d, r, 0.15, 8.5, hs, 'masonry');
  cap(face, r, 8.5, 'roof');
  closedFields(face, hs, d);
  if (d >= 1) {
    const facade = writer(
      masked(
        out,
        hs.map((h) => prepareOpening(h, 0, d)),
      ),
      d,
    );
    band(facade, r, 2.9, 0.24, 'wall', 1.002);
    band(facade, r, 5.7, 0.24, 'wall', 1.002);
    band(face, r, 8.15, 0.3, 'trim', 1.015);
  }
}
function dome(face, p, ring, base, height, d, small = false) {
  const n = small ? [6, 8, 10, 14, 16][d] : [8, 12, 20, 28, 32][d],
    steps = small ? [2, 3, 3, 4, 5][d] : [2, 3, 5, 7, 8][d];
  const r = ring ?? circle(p, 2.55, n);
  profile(
    face,
    r,
    Array.from({ length: steps + 1 }, (_, i) => {
      const a = ((i / steps) * Math.PI) / 2;
      return [base + height * Math.sin(a), i === steps ? 0 : Math.cos(a)];
    }),
    'roof',
  );
}
function shortFinial(face, p, y, d, h = 0.8) {
  profile(
    face,
    circle(p, d === 0 ? 0.16 : 0.12, d === 0 ? 4 : 8),
    [
      [y, 1],
      [y + h * 0.4, 0.6],
      [y + h, 0.05],
    ],
    'gold',
  );
}
function central(face, d) {
  const p = plans.dome.center,
    mapped = plans.dome.outline,
    ring =
      d === 0
        ? circle(p, 8.2, 8)
        : d === 1
          ? mapped.filter((_, i) => i % 2 === 0)
          : d === 2
            ? mapped
            : subdivide(mapped, 1.65);
  profile(
    face,
    ring,
    [
      [8.5, 1.02],
      [10.6, 1.02],
    ],
    'wall',
  );
  if (d >= 1) {
    band(face, ring, 8.7, 0.18, 'trim', 1.045);
    band(face, ring, 10.45, 0.22, 'trim', 1.045);
    for (const [i, e] of edges(scaled(mapped, 1.02)).entries()) {
      if (i % (d === 1 ? 4 : 2)) continue;
      const q = e.a.map((v, k) => (v + e.b[k]) / 2);
      const h = hole(`drum-field-${i}`, q, e.axis, e.normal, 0.85, 9.05, 1.15, 0.7, 'pointed', 0.5);
      // Opaque exterior grille fields sit outside the solid drum; no interior opening is claimed.
      pane(face, h, d, 0.07);
      archBand(face, h, d, 0.16, 'trim', 0.1);
    }
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4,
        q = [p[0] + Math.cos(a) * 8.15, p[1] + Math.sin(a) * 8.15],
        r = rect(q[0] - 0.4, q[1] - 0.4, q[0] + 0.4, q[1] + 0.4);
      solid(face, r, 8.6, 10.85, 'wall');
      cap(face, scaled(r, 1.1), 10.85, 'trim');
    }
  }
  dome(face, p, ring, 10.6, 3.4, d);
  shortFinial(face, p, 14, d);
}
function portico(out, face, d) {
  const r = plans.low.outline,
    hs = banyaPorticoArches(d),
    inner = [2, 3, 4].map((i) => [r[i], r[(i + 1) % r.length]]);
  const arcade = {
    addTriangle(...a) {
      if (
        inner.some(([p, q]) =>
          a[2].every(
            (v) => Math.abs((q[0] - p[0]) * (v[2] - p[1]) - (q[1] - p[1]) * (v[0] - p[0])) < 1e-3,
          ),
        )
      )
        return;
      out.addTriangle(...a);
    },
  };
  shell(arcade, d, r, 0.15, 2.8, hs, 'trim');
  shell(arcade, d, r, 2.8, 5, hs, 'wall');
  cap(face, r, 5, 'roof');
  _underside(face, r, 5, 'trim');
  for (const h of hs) if (d >= 1) archBand(face, h, d, 0.28, 'trim', 0.1);
  for (let i = 0; i <= 3; i++) {
    const p = [-7.2 + (21.14 * i) / 3, 12.1];
    _column(face, p, 0.15, 2.8, d === 0 ? 0.35 : 0.28, d, 'trim');
  }
  // The rear hall wall closes the porch; these are exterior passage bays only.
  for (const p of plans.porchEdge.bays) {
    const q = [p[0], 9.42];
    dome(face, q, null, 5.12, 2.1, d, true);
    shortFinial(face, q, 7.22, d, 0.5);
  }
  if (d >= 1)
    for (const e of edges(r).filter((_, i) => ![2, 3, 4].includes(i)))
      _openBand(face, e.a, e.b, 4.75, 0.26, 'trim', 0.17);
}
function minaret(face, d) {
  const p = plans.minaret.center,
    n = [6, 8, 12, 16, 20][d];
  solid(face, plans.minaret.outline, 0.15, 4.8, 'wall');
  profile(
    face,
    circle(p, 1.18, n),
    [
      [4.8, 1.45],
      [6.5, 1],
      [18.2, 0.88],
    ],
    'wall',
  );
  profile(
    face,
    circle(p, 1.18, n),
    [
      [18.2, 0.88],
      [18.65, 1.55],
      [19.1, 1.55],
    ],
    'trim',
  );
  profile(
    face,
    circle(p, 0.96, n),
    [
      [19, 1],
      [23.2, 0.86],
    ],
    'wall',
  );
  if (d >= 1) {
    sides(face, circle(p, 1.83, n), 19.08, 19.8, 'trim');
    cap(face, circle(p, 1.83, n), 19.8, 'trim', [circle(p, 1.55, n)]);
    if (d >= 3)
      for (let i = 0; i < 12; i++) {
        const a = (i * Math.PI) / 6,
          q = [p[0] + Math.cos(a) * 1.7, p[1] + Math.sin(a) * 1.7];
        _column(face, q, 19.1, 19.8, 0.09, 0, 'trim');
      }
  }
  profile(
    face,
    circle(p, 1.07, n),
    [
      [23.2, 1],
      [26, 0],
    ],
    'roof',
  );
  shortFinial(face, p, 26, d, 0.5);
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
  sides(
    face,
    d === 0 ? plans.whole.outline : subdivide(plans.whole.outline, 2),
    footing,
    0.15,
    'trim',
  );
  cap(face, plans.whole.outline, 0.15, 'trim');
  hall(out, face, d);
  central(face, d);
  portico(out, face, d);
  minaret(face, d);
}
export const buildBanyaSkyline = (o) => build(o, 0),
  buildBanyaDistrict = (o) => build(o, 1),
  buildBanyaStreet = (o) => build(o, 2),
  buildBanyaCloseup = (o) => build(o, 3);
const cam = (name, position, lookAt) => ({ name, position, lookAt, fov: 48 });
export const banyaStudy = {
  id: 'N0471',
  key: 'banya_bashi_mosque',
  title: 'Banya Bashi Mosque',
  category: 'mosque',
  wikidataId: 'Q790052',
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
    'Original geometry under repository license;map geometry ©OpenStreetMap contributors,ODbL-1.0. Reference picture viewed only,not redistributed.',
  dataAttribution: '©OpenStreetMap contributors;Protomaps;Mapzen/USGS terrain.',
  sourceNotice:
    'Six shared256² longformat brick,dry stone,raw limestone,standing-seam metal,plain wood and cast bronze graphs;seven merged roles including opaque palette glazing. Metric UVs,linear tints,no embedded images,unique facade atlas,copied lattice/inscriptions or baked illumination.',
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
    'One inspected2012 picture guides the metal dome,buttressed brick drum,three-front-arch portico and single pale-balcony minaret. Current mapped roof,tower and low L-shaped part guide massing;their roles and the front assignment remain estimates. The retained whole outline is the ground mask. Opaque door/window fields close the exterior hall;portico passages are shallow and unfurnished. Exact current finish,lattice motifs,roof construction,engineering,steps/street joins and physical-device timing are unverified. Neighboring park,streets and buildings remain host content.',
  ],
  camera: scope.camera,
  qaLodCameras: scope.qaLodCameras,
  qaCameras: [
    cam('three-domed-front-portico', [-34, 15, 47], [1, 4, 9]),
    cam('main-metal-dome-and-drum', [32, 24, -27], [3, 11, -2]),
    cam('mixed-masonry-and-windows', [38, 15, 10], [11, 5, -3]),
    cam('single-balcony-minaret', [-31, 22, 26], [-12, 15, 9]),
    cam('west-side-open-gallery', [-43, 12, -9], [-11, 3, -4.5]),
    cam('retained-outline-plan', [0, 115, 0.1], [0, 5, 0]),
  ],
};
