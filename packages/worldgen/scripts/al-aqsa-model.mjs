/** Southern Al-Qibli prayer hall: seven open porch arches, green doors and a silver dome. */
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
  '../../../content/worldgen/source/places/sv/sv9/al_aqsa_mosque/',
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
  wall: '#d8ceb8',
  trim: '#e5decb',
  roof: '#7d848a',
  door: '#4f8974',
  glass: '#526779',
  gold: '#c5b177',
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
const footing = (p) => Math.min(-0.35, floor - 0.3, alAqsaGround(...p) - 0.35);
export function alAqsaGround(x, z) {
  const c = Math.cos(fit.heading),
    s = Math.sin(fit.heading);
  [x, z] = [x * c + z * s, -x * s + z * c];
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw Error('Al-Qibli prayer hall footing outside retained terrain');
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
const coarse = (r) => {
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
  core = plans.core,
  frontWidth = Math.hypot(core[1][0] - core[0][0], core[1][1] - core[0][1]),
  depth = Math.hypot(core[3][0] - core[0][0], core[3][1] - core[0][1]),
  pv = plans.porchDepth / depth;
const P = (u, v) => lerp(lerp(core[0], core[1], u), lerp(core[3], core[2], u), v);
const Q = (a, b, x, z) => [P(a, b), P(x, b), P(x, z), P(a, z)];
const circle = (p, r, n, offset = 0) =>
  Array.from({ length: n }, (_, i) => {
    const a = offset - (i * Math.PI * 2) / n;
    return [p[0] + Math.cos(a) * r, p[1] + Math.sin(a) * r];
  });
const frontAxis = unit(core[1].map((v, k) => v - core[0][k])),
  frontNormal = [frontAxis[1], -frontAxis[0]],
  sideAxis = unit(core[3].map((v, k) => v - core[0][k]));
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
export function alAqsaPorchOpenings(_d = 3) {
  return Array.from({ length: 7 }, (_, i) =>
    hole(
      `porch-arch-${i}`,
      P((i + 0.5) / 7, 0.6 / depth),
      frontAxis,
      frontNormal,
      i === 3 ? 7.0 : 5.9,
      0.04,
      i === 3 ? 10.8 : 9.9,
      5.7,
      'pointed',
      3,
    ),
  );
}
export function alAqsaDoorFields(d = 3) {
  const out = [];
  if (d === 0) return out;
  for (let i = 0; i < 7; i++) {
    const p = P((i + 0.5) / 7, pv);
    out.push({
      ...hole(`green-door-${i}`, p, frontAxis, frontNormal, 2.7, 0.12, 4.3, 4.3, 'rect', 2),
      kind: 'door',
    });
    if (d >= 2)
      out.push({
        ...hole(
          `door-fanlight-${i}`,
          p,
          frontAxis,
          frontNormal,
          3.2,
          4.65,
          2.7,
          0.25,
          'pointed',
          2,
        ),
        kind: 'glass',
      });
  }
  return out;
}
export function alAqsaWallFields(d = 3) {
  const out = [];
  if (d === 0) return out;
  for (const side of [0, 1])
    for (let i = 0; i < 7; i++) {
      if (d === 1 && i % 2) continue;
      const v = 0.14 + i * 0.12,
        p = P(side, v),
        normal = side === 0 ? [-sideAxis[1], sideAxis[0]] : [sideAxis[1], -sideAxis[0]];
      if (side === 1 || v < 0.72) {
        out.push(
          hole(
            `side-pointed-${side}-${i}`,
            p,
            sideAxis,
            normal,
            3.35,
            5.4,
            6.2,
            3.4,
            'pointed',
            2.3,
          ),
        );
        if (d >= 2)
          out.push(
            hole(`side-low-${side}-${i}`, p, sideAxis, normal, 1.4, 1.2, 2.2, 2.2, 'rect', 2.3),
          );
      } else
        out.push(
          hole(`west-annex-upper-${i}`, p, sideAxis, normal, 2.6, 9.2, 3.3, 1.9, 'pointed', 2.3),
        );
    }
  for (let i = 0; i < 7; i++) {
    if (d === 1 && i % 2) continue;
    const p = P((i + 0.5) / 7, 1),
      normal = frontNormal.map((v) => -v);
    out.push(hole(`south-lancet-${i}`, p, frontAxis, normal, 2.2, 5.1, 5.0, 2.9, 'pointed', 2.1));
    if (d >= 2)
      out.push(
        hole(`south-oculus-${i}`, p, frontAxis, normal, 1.35, 11.2, 1.35, 0.675, 'circle', 2.1),
      );
  }
  return out;
}
export function alAqsaNaveFields(d = 3) {
  const out = [];
  if (d === 0) return out;
  const u0 = 0.5 - plans.naveWidth / frontWidth / 2,
    u1 = 1 - u0;
  for (const side of [u0, u1])
    for (let i = 0; i < 7; i++) {
      if (d === 1 && i % 2) continue;
      const p = P(side, 0.13 + i * 0.12),
        normal = side === u0 ? [-sideAxis[1], sideAxis[0]] : [sideAxis[1], -sideAxis[0]];
      out.push(
        hole(`clerestory-${side}-${i}`, p, sideAxis, normal, 1.2, 17.0, 1.5, 0.8, 'pointed', 2),
      );
    }
  for (const u of [0.465, 0.535])
    out.push(
      hole(
        `north-nave-light-${u}`,
        P(u, 0),
        frontAxis,
        frontNormal,
        2.5,
        14.5,
        3.4,
        1.9,
        'pointed',
        2,
      ),
    );
  return out;
}
export function alAqsaDrumFields(d = 3) {
  if (d < 2) return [];
  const p = plans.dome.center,
    r = plans.dome.radius,
    n = d === 2 ? 8 : d === 3 ? 12 : 16;
  return Array.from({ length: n }, (_, i) => {
    const a = (i * Math.PI * 2) / n,
      normal = [Math.cos(a), Math.sin(a)];
    return hole(
      `drum-light-${i}`,
      [p[0] + r * normal[0], p[1] + r * normal[1]],
      [-normal[1], normal[0]],
      normal,
      0.72,
      20.75,
      1.4,
      0.8,
      'pointed',
      1.8,
    );
  });
}
export function alAqsaAnnexFields(d = 3) {
  if (d === 0) return [];
  const fields = [];
  for (const [index, p] of plans.annexes.entries())
    for (let i = 0; i < p.outline.length; i++) {
      if (i === (index === 0 ? 2 : p.outline.length - 1)) continue;
      const f = _faceFrame(p.outline, i);
      if (f.length < 8) continue;
      const count = Math.max(1, Math.floor(f.length / (d === 1 ? 18 : 9)));
      for (let j = 0; j < count; j++)
        fields.push(
          hole(
            `annex-${index}-${i}-${j}`,
            lerp(f.a, f.b, (j + 0.5) / count),
            f.axis,
            f.normal,
            1.5,
            2,
            2.6,
            2.6,
            'rect',
            2,
          ),
        );
    }
  return fields;
}
function finish(face, fields, d) {
  for (const h of fields) {
    pane(face, h, d, -0.27, h.kind === 'door' ? 'door' : 'glass');
    if (d >= 2) archBand(face, h, d, h.name.startsWith('side-pointed') ? 0.32 : 0.2, 'trim', 0.06);
    if (d >= 3 && h.kind === 'door') {
      const p = prepareOpening(h, 0, d),
        normal = [-p.axis[1], p.axis[0]],
        s = Math.sign(normal[0] * h.normal[0] + normal[1] * h.normal[1]);
      for (const u of [-0.55, 0.55])
        for (const y of [1.1, 2.0, 3.0]) {
          const q = p.point(u, floor + y, -0.2 * s);
          beam(
            face,
            [q[0], q[1], q[2]],
            [q[0] + h.normal[0] * 0.08, q[1], q[2] + h.normal[1] * 0.08],
            0.13,
            'gold',
          );
        }
      const a = p.point(0, floor + 0.25, -0.21 * s),
        b = p.point(0, floor + 4.2, -0.21 * s);
      beam(face, a, b, 0.1, 'door');
    }
    if (d >= 3 && h.name.startsWith('door-fanlight')) {
      const p = prepareOpening(h, 0, d),
        normal = [-p.axis[1], p.axis[0]],
        s = Math.sign(normal[0] * h.normal[0] + normal[1] * h.normal[1]);
      for (const u of [-0.6, 0, 0.6])
        beam(
          face,
          p.point(u, h.bottom + 0.1, -0.2 * s),
          p.point(u, h.bottom + 1.3, -0.2 * s),
          0.08,
          'trim',
        );
    }
  }
}
function roof(face, d) {
  const u0 = 0.5 - plans.naveWidth / frontWidth / 2,
    u1 = 1 - u0;
  for (const [a, b, ha, hb] of [
    [0, u0, 14.4, 16.8],
    [u1, 1, 16.8, 14.4],
  ]) {
    face('roof', [at(P(a, pv), ha), at(P(b, pv), hb), at(P(b, 1), hb), at(P(a, 1), ha)], [0, 1, 0]);
    for (const v of [pv, 1])
      face(
        'wall',
        [at(P(a, v), 14), at(P(b, v), 14), at(P(b, v), hb), at(P(a, v), ha)],
        [frontNormal[0] * (v === pv ? 1 : -1), 0, frontNormal[1] * (v === pv ? 1 : -1)],
      );
  }
  for (const [a, b, ha, hb] of [
    [u0, 0.5, 18.8, 20],
    [0.5, u1, 20, 18.8],
  ])
    face('roof', [at(P(a, 0), ha), at(P(b, 0), hb), at(P(b, 1), hb), at(P(a, 1), ha)], [0, 1, 0]);
  for (const v of [0, 1])
    face(
      'wall',
      [at(P(u0, v), 18.8), at(P(u1, v), 18.8), at(P(0.5, v), 20)],
      [frontNormal[0] * (v === 0 ? 1 : -1), 0, frontNormal[1] * (v === 0 ? 1 : -1)],
    );
  if (d >= 2) {
    for (const side of [0, 1]) {
      const i = side === 0 ? u0 : u1;
      beam(face, at(P(side, pv), 14.45), at(P(side, 1), 14.45), 0.25, 'roof');
      if (d >= 3)
        for (let j = 1; j < 8; j++) {
          const v = pv + ((1 - pv) * j) / 8;
          beam(face, at(P(side, v), 14.45), at(P(i, v), 16.85), 0.1, 'roof');
        }
    }
  }
}
function porch(out, face, d) {
  const openings = alAqsaPorchOpenings(d),
    r = Q(0, 0, 1, 1.3 / depth);
  shell(out, d, r, footing, 12.4, openings, 'wall');
  cap(face, r, 12.4, 'trim');
  const deck = Q(0, 0, 1, pv);
  cap(face, deck, 0.08, 'trim');
  cap(face, deck, 11.6, 'roof');
  for (const side of [0, 1]) {
    const r = side === 0 ? Q(0, 0, 0.025, pv) : Q(0.975, 0, 1, pv);
    solid(face, r, footing, 11.6, 'wall');
  }
  if (d >= 1) {
    for (const h of openings)
      archBand(face, h, d, h.name === 'porch-arch-3' ? 0.45 : 0.3, 'trim', 0.08);
    band(face, Q(0, 0, 1, pv), 11.5, 0.45, 'trim', 1.004);
  }
  if (d >= 2) {
    for (let i = 0; i < 19; i++) {
      const u = (i + 0.5) / 19,
        w = 0.3 / frontWidth;
      solid(face, Q(u - w, 0.04 / depth, u + w, 1.0 / depth), 12.4, 13.05, 'trim');
    }
    const central = Q(3 / 7, 0.01, 4 / 7, 1.25 / depth);
    solid(face, central, 11.6, 14.1, 'wall');
    for (const u of [0.46, 0.5, 0.54]) {
      const h = hole(
        `portal-upper-niche-${u}`,
        P(u, 0),
        frontAxis,
        frontNormal,
        0.9,
        12,
        1.3,
        0.7,
        'pointed',
        1,
      );
      pane(face, h, d, 0.06, 'trim');
    }
    beam(face, at(P(3 / 7, 0), 11.55), at(P(4 / 7, 0), 11.55), 0.45, 'trim');
  }
  // Approach treads follow the declared raised floor; their exact ground joins are approximate.
  if (d >= 1)
    for (let j = 0; j < 3; j++) {
      const v = (-(j + 1) * 0.75) / depth,
        y = -0.18 * j;
      solid(
        face,
        Q(0, v, 1, v + 0.75 / depth),
        (p) => Math.min(floor + y - 0.25, alAqsaGround(...p) - 0.2),
        y,
        'trim',
      );
    }
}
function church(out, face, d) {
  const body = Q(0, pv, 1, 1),
    fields = [...alAqsaWallFields(d), ...alAqsaDoorFields(d)];
  shell(out, d, body, footing, 14, fields, 'wall');
  finish(face, fields, d);
  const u0 = 0.5 - plans.naveWidth / frontWidth / 2,
    u1 = 1 - u0,
    nave = Q(u0, 0, u1, 1),
    nh = alAqsaNaveFields(d);
  const naveOpenings = [...nh, ...alAqsaWallFields(d).filter((h) => h.name === 'south-oculus-3')];
  shell(out, d, nave, 11.6, 18.8, naveOpenings, 'wall');
  finish(face, nh, d);
  roof(face, d);
  porch(out, face, d);
  for (const [i, p] of plans.annexes.entries()) {
    const r = d === 0 ? coarse(p.outline) : p.outline;
    const fields = alAqsaAnnexFields(d).filter((h) => h.name.startsWith(`annex-${i}-`));
    shell(out, d, r, footing, i === 0 ? 8.5 : 10, fields, 'wall');
    finish(face, fields, d);
    cap(face, r, i === 0 ? 8.5 : 10, 'roof');
    if (d >= 2) band(face, r, (i === 0 ? 8.5 : 10) - 0.3, 0.5, 'trim', 1.004);
  }
  if (d >= 1) {
    for (const side of [0, 1])
      for (let i = 0; i < 8; i++) {
        if (d === 1 && i % 2) continue;
        const v = 0.1 + i * 0.12,
          du = 1.4 / frontWidth,
          offset = 0.85 / frontWidth;
        const r =
          side === 0
            ? Q(-offset, v - 0.008, du, v + 0.008)
            : Q(1 - du, v - 0.008, 1 + offset, v + 0.008);
        solid(face, r, footing, 13.6, 'trim');
        profile(
          face,
          r,
          [
            [13.6, 1],
            [14.6, 0.65],
          ],
          'trim',
        );
      }
    for (let i = 0; i < 8; i++) {
      const u = i / 7,
        du = 0.6 / frontWidth;
      solid(face, Q(u - du, 0.985, u + du, 1.018), footing, 14.0, 'trim');
    }
  }
}
function domeAndFinial(out, face, d) {
  const p = plans.dome.center,
    r = plans.dome.radius,
    n = [8, 12, 20, 32, 40][d],
    dr = circle(p, r, n),
    fields = alAqsaDrumFields(d);
  shell(out, d, dr, 18.5, 23, fields, 'wall');
  finish(face, fields, d);
  if (d >= 1) band(face, dr, 22.6, 0.4, 'trim', 1.035);
  const bands = [2, 3, 5, 8, 10][d],
    levels = Array.from({ length: bands + 1 }, (_, i) => {
      const a = ((i / bands) * Math.PI) / 2;
      return [23 + 12 * Math.sin(a), i === bands ? 0 : Math.cos(a)];
    });
  profile(face, dr, levels, 'roof');
  if (d >= 3) {
    const count = d === 3 ? 16 : 24;
    for (let i = 0; i < count; i++) {
      const a = (i * Math.PI * 2) / count;
      for (let j = 0; j < 5; j++) {
        const u = ((j / 5) * Math.PI) / 2,
          v = (((j + 1) / 5) * Math.PI) / 2;
        beam(
          face,
          [
            p[0] + (r + 0.03) * Math.cos(u) * Math.cos(a),
            floor + 23 + 12 * Math.sin(u),
            p[1] + (r + 0.03) * Math.cos(u) * Math.sin(a),
          ],
          [
            p[0] + (r + 0.03) * Math.cos(v) * Math.cos(a),
            floor + 23 + 12 * Math.sin(v),
            p[1] + (r + 0.03) * Math.cos(v) * Math.sin(a),
          ],
          0.075,
          'roof',
        );
      }
    }
  }
  if (d < 2) beam(face, at(p, 34.8), at(p, 37), 0.15, 'gold');
  else {
    profile(
      face,
      circle(p, 0.25, 8),
      [
        [35, 1],
        [35.6, 0.7],
      ],
      'gold',
    );
    beam(face, at(p, 35.5), at(p, 36.3), 0.12, 'gold');
    const count = d === 2 ? 8 : 16;
    for (let i = 0; i < count; i++) {
      const a = (i * Math.PI * 2) / count,
        b = ((i + 1) * Math.PI * 2) / count;
      face(
        'gold',
        [
          [p[0] + 0.45 * Math.cos(a), floor + 36.55 + 0.45 * Math.sin(a), p[1] - 0.045],
          [p[0] + 0.45 * Math.cos(b), floor + 36.55 + 0.45 * Math.sin(b), p[1] - 0.045],
          [p[0] + 0.29 * Math.cos(b), floor + 36.55 + 0.29 * Math.sin(b), p[1] - 0.045],
          [p[0] + 0.29 * Math.cos(a), floor + 36.55 + 0.29 * Math.sin(a), p[1] - 0.045],
        ],
        [0, 0, -1],
      );
      face(
        'gold',
        [
          [p[0] + 0.45 * Math.cos(a), floor + 36.55 + 0.45 * Math.sin(a), p[1] + 0.045],
          [p[0] + 0.45 * Math.cos(b), floor + 36.55 + 0.45 * Math.sin(b), p[1] + 0.045],
          [p[0] + 0.29 * Math.cos(b), floor + 36.55 + 0.29 * Math.sin(b), p[1] + 0.045],
          [p[0] + 0.29 * Math.cos(a), floor + 36.55 + 0.29 * Math.sin(a), p[1] + 0.045],
        ],
        [0, 0, 1],
      );
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
          if (longest > 20) {
            const j = (k + 1) % 3,
              c = (k + 2) % 3,
              mid = lerp(p[k], p[j], 0.5).map(Math.fround),
              v = lerp(uv[k], uv[j], 0.5);
            emit([p[k], mid, p[c]], [uv[k], v, uv[c]]);
            emit([mid, p[j], p[c]], [v, uv[j], uv[c]]);
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
  church(out, face, d);
  domeAndFinial(out, face, d);
}
export const buildAlAqsaSkyline = (o) => build(o, 0),
  buildAlAqsaDistrict = (o) => build(o, 1),
  buildAlAqsaStreet = (o) => build(o, 2),
  buildAlAqsaCloseup = (o) => build(o, 3);
const cam = (name, position, lookAt) => ({ name, position, lookAt, fov: 48 });
export const alAqsaStudy = {
  id: 'al_aqsa_mosque',
  key: 'al_aqsa_mosque',
  title: 'Al-Aqsa Mosque — Al-Qibli prayer hall',
  category: 'mosque',
  wikidataId: 'Q12192963',
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
    'Five existing shared256² limestone,raw limestone,standing-seam metal,plain wood and bronze graphs,six merged groups including local blue-grey glazing. Plain wood abstracts the green panel doors;metal graph abstracts lead cladding. Linear tints,metric UVs and flat architectural normals;no embedded images,bespoke facade bitmaps,baked lighting or invented lettering.',
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
    'Individual medium-fi southern prayer hall from three inspected2013 pictures and standard viewer PMTiles/DEM. Whole/dome heights are nominal;roof/drum/finial/annex/portal/window/buttress/parapet profiles and shallow door/fanlight detail are estimates or abstractions. Seven front arches open into a shallow modeled porch terminated by closed door/window fields;no prayer-hall interior or free traversal claim. Fine carving,masonry chronology,inscriptions,leaded artwork,lighting/furniture,engineering/current restoration finish and hidden site joins are excluded or unverified. Other compound monuments,minarets,pavilions,forecourt fixtures,trees and city walls remain host content. The south-facing below-floor mass is a conservative terrain footing,not a faithful reconstruction of the archaeological retaining walls. Synthetic neighbors and physical-device performance remain unverified.',
  ],
  camera: scope.camera,
  qaCameras: [
    cam('north-seven-arch-porch', [12, 20, -113], [7, 10, -34]),
    cam('green-door-and-fanlight', [9, 8, -55], [8, 7, -34]),
    cam('east-buttresses-and-clerestory', [115, 32, -28], [27, 13, 0]),
    cam('south-silver-dome-and-oculi', [60, 52, 126], [8, 19, 28]),
    cam('west-attached-wing-and-roofs', [-128, 56, 34], [-13, 14, 8]),
    cam('roof-and-signed-plan', [0, 217, 0.1], [0, 13, 0]),
  ],
};
