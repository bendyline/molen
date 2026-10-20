/** Selimiye: broad central dome, octagonal support and four three-balcony minarets. */
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
  '../../../content/worldgen/source/places/sx/sx6/n0420_selimiye_mosque/',
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
  wall: '#c6bdad',
  trim: '#e2d9c8',
  roof: '#899095',
  door: '#987351',
  gold: '#bca56b',
  glass: '#566b7d',
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
const footing = (p) => Math.min(-0.35, floor - 0.3, selimiyeGround(...p) - 0.35);
export function selimiyeGround(x, z) {
  const c = Math.cos(fit.heading),
    s = Math.sin(fit.heading);
  [x, z] = [x * c + z * s, -x * s + z * c];
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw Error('Selimiye Mosque footing outside retained terrain');
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
const plans = rec.plans;
const rect = (x0, z0, x1, z1) => [
    [x0, z0],
    [x1, z0],
    [x1, z1],
    [x0, z1],
  ],
  circle = (p, r, n, phase = 0) =>
    Array.from({ length: n }, (_, i) => {
      const a = phase - (i * Math.PI * 2) / n;
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
const capDome = (face, p, r, base, height, d, small = false) => {
  const n = small ? [4, 6, 10, 14, 16][d] : [8, 12, 20, 28, 32][d],
    steps = small ? [1, 2, 3, 4, 5][d] : [2, 3, 5, 7, 8][d];
  profile(
    face,
    circle(p, r, n),
    Array.from({ length: steps + 1 }, (_, i) => {
      const a = ((i / steps) * Math.PI) / 2;
      return [base + height * Math.sin(a), i === steps ? 0 : Math.cos(a)];
    }),
    'roof',
  );
};
function finial(face, p, y, d, h = 1.5) {
  if (d === 0) {
    profile(
      face,
      circle(p, 0.14, 4),
      [
        [y, 1],
        [y + h, 0],
      ],
      'gold',
    );
    return;
  }
  beam(face, at(p, y), at(p, y + h), d === 0 ? 0.14 : 0.1, 'gold');
  if (d >= 3)
    profile(
      face,
      circle(p, 0.2, 6),
      [
        [y + h * 0.15, 0.65],
        [y + h * 0.4, 1],
        [y + h * 0.7, 0.5],
      ],
      'gold',
    );
}
const trimBand = (face, h, d, w = 0.24) => archBand(face, h, d, w, 'trim', 0.055);
function stripedArch(face, h, d, w = 0.3) {
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
    p = prepareOpening(h, 0, d),
    ns = Math.sign(-p.axis[1] * h.normal[0] + p.axis[0] * h.normal[1]);
  for (let i = 0; i < inner.length; i++) {
    const j = (i + 1) % inner.length;
    face(
      'trim',
      [
        p.point(...outer[i], 0.06 * ns),
        p.point(...outer[j], 0.06 * ns),
        p.point(...inner[j], 0.06 * ns),
        p.point(...inner[i], 0.06 * ns),
      ],
      [h.normal[0], 0, h.normal[1]],
      i > 1 && i % 2 ? [0.33, 0.19, 0.14] : colors.trim,
    );
  }
}
export function selimiyeHallFields(d = 3) {
  if (d === 0) return [];
  const fields = [];
  for (const x of [-5.5, 46])
    for (const z of [-18, -10, 8, 17]) {
      const axis = [0, 1],
        normal = [x < 0 ? -1 : 1, 0];
      fields.push(hole(`hall-upper-${x}-${z}`, [x, z], axis, normal, 2.3, 10.2, 4.2, 2.3));
      if (d >= 2)
        fields.push(hole(`hall-lower-${x}-${z}`, [x, z], axis, normal, 2.1, 1.5, 4.2, 4.2, 'rect'));
    }
  return fields;
}
const coreRing = () => circle(plans.dome.center, 20.0, 8, Math.PI / 8);
export function selimiyeCoreFields(d = 3) {
  if (d === 0) return [];
  const fields = [];
  for (const [i, e] of edges(coreRing()).entries()) {
    const n = d === 1 ? 1 : 3;
    for (let j = 0; j < n; j++) {
      const p = lerp(e.a, e.b, 0.5 + (j - (n - 1) / 2) * 0.19);
      fields.push(hole(`octagon-${i}-${j}`, p, e.axis, e.normal, 1.4, 20.4, 4.5, 2.7));
    }
  }
  return fields;
}
export function selimiyeDrumFields(d = 3) {
  if (d < 2) return [];
  const fields = [],
    r = circle(plans.dome.center, 17.15, [8, 12, 20, 28, 32][d]);
  for (const [i, e] of edges(r).entries())
    fields.push(
      hole(
        `drum-${i}`,
        lerp(e.a, e.b, 0.5),
        e.axis,
        e.normal,
        d === 2 ? 1.35 : 1.1,
        27.2,
        2.35,
        1.3,
        'round',
        1.4,
      ),
    );
  return fields;
}
export function selimiyePortalFields(d = 3) {
  if (d === 0) return [];
  return [
    {
      ...hole('hall-portal', [-8.5, -0.95], [0, 1], [-1, 0], 4.3, 0.1, 6.6, 4.4, 'pointed', 2),
      kind: 'door',
    },
    hole('hall-portal-upper', [-8.5, -0.95], [0, 1], [-1, 0], 4.8, 8.4, 1.7, 1.7, 'rect', 2),
    {
      ...hole('northwest-entry', [-46.3, -1], [0, 1], [-1, 0], 3.5, 0.1, 5.7, 4.0, 'pointed', 3),
      kind: 'door',
    },
  ];
}
export function selimiyeSideFields(d = 3) {
  if (d === 0) return [];
  const fields = [];
  for (const side of plans.sideGalleries) {
    const normal = [0, Math.sign(side.z)],
      axis = [1, 0],
      n = d === 1 ? 3 : 9;
    for (let i = 0; i < n; i++) {
      const x = ((i + 0.5) * 39.8) / n;
      fields.push(
        hole(
          `gallery-lower-${side.z}-${i}`,
          [x, side.z],
          axis,
          normal,
          39.8 / n - 0.7,
          0.06,
          6.0,
          4.0,
          'round',
          1.6,
        ),
      );
      fields.push(
        hole(
          `gallery-upper-${side.z}-${i}`,
          [x, side.z],
          axis,
          normal,
          1.65,
          8.5,
          3.0,
          3.0,
          'rect',
          1.6,
        ),
      );
      if (d >= 2)
        fields.push(
          hole(
            `gallery-lunette-${side.z}-${i}`,
            [x, side.z],
            axis,
            normal,
            2.4,
            12.3,
            2.5,
            1.2,
            'round',
            1.6,
          ),
        );
    }
  }
  return fields;
}
export function selimiyeCourtArches(d = 3) {
  if (d === 0) return [];
  const fields = [];
  for (const [i, e] of edges(plans.court).entries()) {
    const n = Math.round(e.length / (d === 1 ? 9 : 6.7));
    for (let j = 0; j < n; j++)
      fields.push(
        hole(
          `court-${i}-${j}`,
          lerp(e.a, e.b, (j + 0.5) / n),
          e.axis,
          e.normal.map((v) => -v),
          e.length / n - 0.9,
          0.05,
          6.5,
          4.2,
          'pointed',
          1.7,
        ),
      );
  }
  return fields;
}
function finish(face, fields, d) {
  for (const h of fields) {
    pane(face, h, d, d === 1 ? 0.035 : -0.24, h.kind === 'door' ? 'door' : 'glass');
    if (d >= 2) trimBand(face, h, d);
  }
}
function archFront(out, face, r, fields, d, top) {
  if (d >= 2) {
    shell(out, d, r, 0, top, fields, 'wall');
    cap(face, r, top, 'roof');
    for (const h of fields) stripedArch(face, h, d === 2 ? 1 : d, 0.26);
    return;
  }
  const _e = edges(r)[0],
    n = fields.length;
  for (let i = 0; i <= n; i++) {
    const pitch =
      n > 1
        ? Math.hypot(...fields[1].center.map((v, k) => v - fields[0].center[k]))
        : fields[0].width + 0.8;
    const p = fields[0].center.map((v, k) => v + fields[0].axis[k] * (i - 0.5) * pitch);
    beam(face, at(p, 0), at(p, top), 0.8, 'wall');
  }
  for (const h of fields) {
    const p = prepareOpening(h, 0, 1),
      ns = Math.sign(-p.axis[1] * h.normal[0] + p.axis[0] * h.normal[1]),
      arc = openingShape(h, 1).slice(2),
      A = (q, o) => p.point(q[0], q[1], o * ns);
    for (let i = 0; i < arc.length - 1; i++) {
      const a = arc[i],
        b = arc[i + 1];
      for (const o of [0, -0.7])
        face(
          'wall',
          [A(a, o), A(b, o), A([b[0], floor + top], o), A([a[0], floor + top], o)],
          [h.normal[0] * (o === 0 ? 1 : -1), 0, h.normal[1] * (o === 0 ? 1 : -1)],
        );
      face('trim', [A(a, 0), A(b, 0), A(b, -0.7), A(a, -0.7)], [0, -1, 0]);
    }
  }
}
function hall(out, face, d) {
  const fields = selimiyeHallFields(d),
    portal = selimiyePortalFields(d).filter((h) => h.name.startsWith('hall-'));
  shell(out, d, plans.hall, footing, 18.5, d >= 2 ? fields : [], 'wall');
  cap(face, plans.hall, 18.5, 'roof');
  finish(face, fields, d);
  const core = coreRing(),
    upper = selimiyeCoreFields(d);
  shell(out, d, core, 18.5, 26.8, d >= 2 ? upper : [], 'wall');
  cap(face, core, 26.8, 'roof');
  finish(face, upper, d);
  if (d >= 1) {
    band(face, plans.hall, 18.0, 0.5, 'trim', 1.005);
    band(face, core, 26.25, 0.55, 'trim', 1.009);
    for (const [i, e] of edges(core).entries()) {
      if (i % 2 === 0) {
        const h = hole(
          `large-tympanum-${i}`,
          lerp(e.a, e.b, 0.5),
          e.axis,
          e.normal,
          12,
          18.8,
          7.1,
          2.7,
          'round',
          1,
        );
        trimBand(face, h, d, 0.34);
      }
    }
  }
  shell(out, d, plans.portal, 0, 11.0, d >= 2 ? portal : [], 'wall');
  cap(face, plans.portal, 11, 'trim');
  finish(face, portal, d);
  capDome(face, [-5.8, -0.95], 3.5, 11.05, 2.5, d, true);
  if (d >= 2) {
    stripedArch(face, portal[0], d, 0.45);
    band(face, plans.portal, 10.6, 0.4, 'trim', 1.025);
    for (const z of [-3.8, 2.0])
      solid(face, rect(-8.55, z - 0.65, -8.35, z + 0.65), 8.25, 9.8, 'trim');
  }
}
function domes(out, face, d) {
  const p = plans.dome.center,
    fields = selimiyeDrumFields(d),
    r = circle(p, 17.15, [8, 12, 20, 28, 32][d]);
  shell(out, d, r, 26.8, 30, fields, 'wall');
  finish(face, fields, d);
  capDome(face, p, 17.15, 30, 10, d);
  finial(face, p, 40, d);
  // Four corner exedra caps reinforce the octagonal support without longitudinal semi-domes.
  for (const x of [-1, 1])
    for (const z of [-1, 1])
      capDome(face, [p[0] + x * 14.3, p[1] + z * 14.0], 6.8, 18.6, 5.4, d, true);
  for (let i = 0; i < 8; i++) {
    const a = Math.PI / 8 + (i * Math.PI) / 4,
      q = [p[0] + 19.4 * Math.cos(a), p[1] + 19.4 * Math.sin(a)],
      r = circle(q, 1.9, d === 0 ? 4 : 8);
    solid(face, r, 18.6, 25.8, 'wall');
    profile(
      face,
      r,
      [[25.8, 1.02], ...(d === 0 ? [] : [[26.5, 0.86]]), [30.3, 0.86], [32.2, 0]],
      'roof',
    );
    if (d >= 2) {
      const h = hole(
        `turret-light-${i}`,
        [q[0] + (q[0] < p[0] ? -1.3 : 1.3), q[1]],
        [0, 1],
        [q[0] < p[0] ? -1 : 1, 0],
        0.6,
        27.1,
        1.7,
        0.8,
      );
      pane(face, h, d, 0.04);
    }
  }
  if (d >= 2) band(face, r, 29.55, 0.45, 'trim', 1.01);
}
function minaret(face, m, d) {
  const n = [4, 6, 10, 16, 20][d],
    r = circle(m.center, m.radius, n),
    p = m.center,
    base = rect(p[0] - 2.1, p[1] - 2.1, p[0] + 2.1, p[1] + 2.1);
  solid(face, base, footing, 5.8, 'wall');
  const levels =
    d === 0
      ? [[5.8, 1]]
      : [
          [5.8, 1.06],
          [7.0, 1],
        ];
  for (const y of [28, 42, 55]) {
    if (d === 0) levels.push([y - 0.15, 0.95], [y + 0.65, 1.48], [y + 0.85, 0.9]);
    else levels.push([y - 1, 0.95], [y - 0.15, 1.48], [y + 0.65, 1.48], [y + 0.85, 0.9]);
  }
  levels.push([60, 0.8]);
  profile(face, r, levels, 'wall');
  profile(
    face,
    r,
    [
      [60, 0.87],
      [70.5, 0.04],
      [71, 0],
    ],
    'roof',
  );
  if (d >= 2)
    for (const y of [28, 42, 55]) {
      profile(
        face,
        r,
        [
          [y + 0.2, 1.45],
          [y + 0.75, 1.45],
        ],
        'trim',
      );
      if (d >= 3)
        for (let i = 0; i < n; i += 2) {
          const a = (i * Math.PI * 2) / n,
            q = [p[0] + m.radius * 1.43 * Math.cos(a), p[1] + m.radius * 1.43 * Math.sin(a)];
          beam(face, at(q, y), at(q, y + 0.8), 0.13, 'trim');
        }
    }
}
function court(out, face, d) {
  const inner = plans.court,
    outer = plans.courtOuter,
    arches = selimiyeCourtArches(d),
    entry = selimiyePortalFields(d).filter((h) => h.name === 'northwest-entry'),
    perimeter =
      d >= 2
        ? writer(
            masked(
              out,
              entry.map((h) => prepareOpening(h, 0, d)),
            ),
            d,
          )
        : face;
  cap(face, inner, 0.035, 'trim');
  sides(perimeter, outer, footing, 7.2, 'wall');
  const back = scaled(outer, 0.98);
  for (const [i, e] of edges(back).entries()) {
    if (i === 1) continue;
    face(
      'wall',
      [at(e.a, footing), at(e.b, footing), at(e.b, 7.2), at(e.a, 7.2)],
      [-e.normal[0], 0, -e.normal[1]],
    );
  }
  cap(face, outer, 7.2, 'roof', [inner]);
  for (const [i, e] of edges(inner).entries()) {
    const n = e.normal,
      backA = e.a.map((v, k) => v + n[k] * 0.8),
      backB = e.b.map((v, k) => v + n[k] * 0.8),
      r = [e.a, e.b, backB, backA],
      fs = arches.filter((h) => h.name.startsWith(`court-${i}-`));
    if (d === 0) {
      sides(face, r, 0, 7.2, 'wall');
    } else archFront(out, face, r, fs, d, 7.2);
    const count = Math.round(e.length / (d === 0 ? 12 : 6.7));
    for (let j = 0; j < count; j++) {
      const p = lerp(e.a, e.b, (j + 0.5) / count).map((v, k) => v + n[k] * 3.4);
      capDome(face, p, 3.0, 7.2, 2.2, d === 0 ? 0 : Math.max(0, d - 1), true);
    }
  }
  shell(out, d, plans.gate, 7.2, 11.0, [], 'wall');
  cap(face, plans.gate, 11.0, 'roof');
  capDome(face, [-41.9, -1], 3.4, 11, 1.5, d, true);
  finish(face, entry, d);
  if (d >= 2) stripedArch(face, entry[0], d, 0.38);
}
function galleries(out, face, d) {
  const fields = selimiyeSideFields(d);
  for (const s of plans.sideGalleries) {
    const sign = Math.sign(s.z),
      r = rect(-1, Math.min(s.z, s.inside), 43, Math.max(s.z, s.inside)),
      thin = rect(-1, Math.min(s.z, s.z - sign * 0.75), 43, Math.max(s.z, s.z - sign * 0.75)),
      fs = fields.filter((h) => h.center[1] === s.z),
      lower = fs.filter((h) => h.name.startsWith('gallery-lower')),
      upper = fs.filter((h) => !h.name.startsWith('gallery-lower'));
    cap(face, r, 0.03, 'trim');
    cap(face, r, 6.7, 'trim');
    cap(face, r, 16.5, 'roof');
    if (d === 0) {
      sides(face, thin, 0, 16.5, 'wall');
    } else if (d === 1) {
      const front = sign < 0 ? [thin[0], thin[1]] : [thin[2], thin[3]],
        back = front.map((p) => p.map((v, k) => v + (k === 1 ? -sign * 0.7 : 0)));
      archFront(out, face, [...front, ...back.toReversed()], lower, d, 6.7);
      for (const [a, b] of [
        [-1, 0],
        [39.8, 43],
      ])
        solid(
          face,
          rect(a, Math.min(s.z, s.z - sign * 0.75), b, Math.max(s.z, s.z - sign * 0.75)),
          0,
          6.7,
          'wall',
        );
      solid(face, thin, 6.7, 16.5, 'wall');
      finish(face, upper, d);
    } else {
      shell(out, d, thin, 0, 16.5, fs, 'wall');
      finish(face, upper, d);
      for (const h of lower) stripedArch(face, h, d === 2 ? 1 : d, 0.24);
    }
    if (d >= 1) {
      band(face, r, 16.1, 0.4, 'trim', 1.004);
      for (const x of [0, 39.8 / 3, (39.8 * 2) / 3, 39.8]) {
        solid(face, rect(x - 0.6, s.z - 0.7, x + 0.6, s.z + 0.7), footing, 19.8, 'trim');
        capDome(face, [x, s.z], 0.9, 19.8, 1.2, d, true);
      }
    }
    if (d >= 3) {
      for (let i = 0; i < 24; i++) {
        const x = -1 + (i * 44) / 23;
        beam(face, at([x, s.z - sign * 0.8], 6.7), at([x, s.z - sign * 0.8], 7.4), 0.13, 'trim');
      }
      beam(face, at([-1, s.z - sign * 0.8], 7.4), at([43, s.z - sign * 0.8], 7.4), 0.13, 'trim');
    }
  }
}
function build(target, d) {
  const out = {
      addTriangle(...args) {
        const p = args[2].map((q) => q.map(Math.fround));
        function emit(p, uv) {
          let longest = 0,
            k = 0;
          for (let i = 0; i < 3; i++) {
            const len = Math.hypot(p[i][0] - p[(i + 1) % 3][0], p[i][2] - p[(i + 1) % 3][2]);
            if (len > longest) {
              longest = len;
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
          target.addTriangle(args[0], args[1], p, args[3], uv, args[5]);
        }
        emit(p, args[4]);
      },
    },
    face = writer(out, d);
  solid(face, plans.outer, footing, 0.015, 'trim');
  hall(out, face, d);
  domes(out, face, d);
  court(out, face, d);
  galleries(out, face, d);
  for (const m of plans.minarets) minaret(face, m, d);
}
export const buildSelimiyeSkyline = (o) => build(o, 0),
  buildSelimiyeDistrict = (o) => build(o, 1),
  buildSelimiyeStreet = (o) => build(o, 2),
  buildSelimiyeCloseup = (o) => build(o, 3);
const cam = (name, position, lookAt) => ({ name, position, lookAt, fov: 48 });
export const selimiyeStudy = {
  id: 'N0420',
  key: 'selimiye_mosque',
  title: 'Selimiye Mosque',
  category: 'mosque',
  wikidataId: 'Q184534',
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
    'Five existing shared256² limestone,raw limestone,standing-seam metal,wood and bronze graphs;six groups including local glazing. Lead roofing abstracted with shared standing seam. Metric UVs,linear tints,faceted architecture;zero embedded images,unique facade bitmaps,baked lighting or invented inscriptions.',
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
    'Individual medium-fi exterior from four actually inspected2006/2017/2018 overall/courtyard/side photographs plus standard viewer PMTiles/DEM. Single broad dome/window drum,octagonal supports/eight capped buttress turrets,four three-balcony minarets,open lower side galleries/domed courtyard and entrance portals. Fine muqarnas,calligraphy,carved parapet screens,fluting,glazing lattice,fixtures,interior,engineering,current finish and exact site joins excluded or simplified. Court ablution fixture not reconstructed because selected pictures do not resolve it. Hall/gallery window and portal fields terminate closed;court/lower gallery openings are exterior voids,no prayer-hall interior/free traversal claim. Unseen rear facade uses simplified repeats. Separate madrasas,arasta,outer garden/walls,roads and city content excluded. Synthetic context and physical-device timing unverified.',
  ],
  camera: scope.camera,
  qaCameras: [
    cam('northwest-court-and-single-dome', [-118, 58, 97], [-5, 20, 0]),
    cam('open-pointed-court-arcade', [-24, 12, 7], [-33, 5, -15]),
    cam('raised-hall-entrance', [-29, 16, -0.9], [-5.5, 8, -0.9]),
    cam('northeast-side-gallery', [19, 17, -65], [20, 10, -28]),
    cam('three-balcony-minaret', [-32, 48, -66], [-2.7, 44, -27.1]),
    cam('roof-and-signed-plan', [0, 225, 0.1], [0, 24, 0]),
  ],
};
