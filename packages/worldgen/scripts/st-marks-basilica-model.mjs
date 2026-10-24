/** St Marks: mapped five-dome cross, narthex arcade and individual west facade. */
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
  '../../../content/worldgen/source/places/u2/u20/st_marks_basilica/',
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
  white: '#e5dfd0',
  brick: '#bd865f',
  metal: '#a7b0b4',
  bronze: '#829486',
  pink: '#c39284',
  trim: '#eee7d6',
  foundation: '#c9bb9e',
  glass: '#4d6178',
  door: '#79624b',
  gold: '#d9b359',
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
const regular = (p, r, n = 8, offset = 0) =>
  Array.from({ length: n }, (_, i) => [
    p[0] + r * Math.cos(offset + (i * Math.PI * 2) / n),
    p[1] + r * Math.sin(offset + (i * Math.PI * 2) / n),
  ]);
const scaled = (r, f) => {
  const p = center(r);
  return r.map((q) => q.map((v, k) => p[k] + (v - p[k]) * f));
};
const _component = (id) => rec.components.find((b) => b.id === id);
const footing = (p) => Math.min(floor - 0.3, stMarksGround(...p) - 0.35);
export function stMarksGround(x, z) {
  const c = Math.cos(fit.heading),
    s = Math.sin(fit.heading);
  [x, z] = [x * c + z * s, -x * s + z * c];
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw Error('St Marks footing outside retained terrain');
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
  return (slot, p, direction) => {
    p = p.map((v) => v.map(Math.fround));
    if (direction && normalFor(...p.slice(0, 3)).reduce((n, v, k) => n + v * direction[k], 0) < 0)
      p = p.toReversed();
    const color = d === 0 ? colors[slot].map((v, k) => v * means[slot][k]) : colors[slot];
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
function beam(face, slot, a, b, w) {
  const u = unit(b.map((v, k) => v - a[k])),
    v = unit(cross(u, Math.abs(u[1]) > 0.95 ? [1, 0, 0] : [0, 1, 0])),
    n = cross(u, v),
    ring = (p) =>
      [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ].map(([x, z]) => p.map((q, k) => q + ((v[k] * x + n[k] * z) * w) / 2));
  const r = ring(a),
    s = ring(b);
  for (let i = 0; i < 4; i++) face(slot, [r[i], r[(i + 1) % 4], s[(i + 1) % 4], s[i]]);
  face(slot, r.toReversed());
  face(slot, s);
}
const box = (face, p, w, d, b, t, slot) => solid(face, rect(p, w, d), b, t, slot);
function faceFrame(r, i) {
  const a = r[i],
    b = r[(i + 1) % r.length],
    axis = unit(b.map((v, k) => v - a[k])),
    normal = [axis[1] * sign(r), -axis[0] * sign(r)];
  return { a, b, axis, normal, length: Math.hypot(b[0] - a[0], b[1] - a[1]) };
}
function panel(face, f, t, w, b, h, slot, offset = 0.055) {
  const p = lerp(f.a, f.b, t),
    q = (u, y) => [
      p[0] + f.axis[0] * u + f.normal[0] * offset,
      floor + y,
      p[1] + f.axis[1] * u + f.normal[1] * offset,
    ];
  face(
    slot,
    [q(-w / 2, b), q(w / 2, b), q(w / 2, b + h), q(-w / 2, b + h)],
    [f.normal[0], 0, f.normal[1]],
  );
}
function _surfaceFrame(face, f, t, w, b, h, d) {
  panel(face, f, t, w, b, h, 'trim');
  panel(face, f, t, w - 0.6, b + 0.3, h - 0.6, 'white', 0.08);
  if (d >= 3) panel(face, f, t, w - 1.35, b + 0.68, h - 1.35, 'pink', 0.1);
}
function ringBand(face, r, y, h, slot, factor = 1.005) {
  sides(face, scaled(r, factor), y, y + h, slot);
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
export const stMarksOpenings = [];
const remember = (h, d) => {
  if (d >= 3 && !stMarksOpenings.some((q) => q.name === h.name)) stMarksOpenings.push(h);
  return h;
};
function shell(out, d, r, b, t, holes = [], slot = 'white', inner = null) {
  const hs = holes.map((h) => prepareOpening(h, 0, d)),
    face = writer(openingBuilder(out, hs), d);
  sides(face, r, b, t, slot);
  if (inner) sides(face, inner, b, t, slot, true);
  if (inner) cap(face, r, t, slot, [inner]);
  for (const h of hs)
    openingReveals(
      {
        addTriangle(_s, ref, p, n, uv, col) {
          out.addTriangle(slot, ref, p, n, uv, col);
        },
      },
      r,
      (p) => (typeof b === 'function' ? b(p) : floor + b),
      () => floor + t,
      [h],
      d === 0 ? colors[slot].map((v, k) => v * means[slot][k]) : colors[slot],
    );
}
function simplify(r, tolerance) {
  let changed = true,
    p = [...r];
  while (changed && p.length > 4) {
    changed = false;
    for (let i = 0; i < p.length; i++) {
      const a = p[(i + p.length - 1) % p.length],
        b = p[i],
        c = p[(i + 1) % p.length],
        u = c.map((v, k) => v - a[k]),
        len = Math.hypot(...u),
        t = Math.max(
          0,
          Math.min(1, ((b[0] - a[0]) * u[0] + (b[1] - a[1]) * u[1]) / (len * len || 1)),
        ),
        q = lerp(a, c, t);
      if (Math.hypot(b[0] - q[0], b[1] - q[1]) < tolerance) {
        p.splice(i, 1);
        changed = true;
        break;
      }
    }
  }
  return p;
}
function circleRing(raw, d) {
  if (d >= 3) return raw;
  const p = center(raw),
    r = [0, 1].map(
      (k) => (Math.max(...raw.map((q) => q[k])) - Math.min(...raw.map((q) => q[k]))) / 2,
    ),
    n = d === 0 ? 8 : d === 1 ? 12 : 16;
  return Array.from({ length: n }, (_, i) => [
    p[0] + r[0] * Math.cos((i * 2 * Math.PI) / n),
    p[1] + r[1] * Math.sin((i * 2 * Math.PI) / n),
  ]);
}
function domeGroup(face, d, group) {
  const drum = circleRing(group.drum.polygons[0].outline, d),
    ring = circleRing(group.body.polygons[0].outline, d),
    p = center(ring),
    height = group.body.properties.height,
    top = group.crown.properties.height;
  // Roof masks remove caps, not the supporting volume below the mapped drum.
  sides(face, drum, 13, 27, 'white');
  solid(face, drum, 27, 30, 'brick');
  const levels =
    d === 0
      ? [
          [30, 1],
          [height - 6, 1.03],
          [height - 1.8, 0.56],
          [height, 0.13],
        ]
      : d === 1
        ? [
            [30, 1],
            [32.7, 1.06],
            [height - 5.4, 0.96],
            [height - 2.2, 0.6],
            [height, 0.13],
          ]
        : [
            [30, 1],
            [32, 1.05],
            [34, 1.07],
            [height - 4.8, 0.94],
            [height - 2.9, 0.7],
            [height - 1.25, 0.43],
            [height, 0.13],
          ];
  // Central dome needs an extra broad shoulder; keep monotonically increasing levels.
  const sorted = levels.filter((v, i, a) => i === 0 || v[0] > a[i - 1][0]);
  profile(face, ring, sorted, 'metal');
  if (d) {
    if (d >= 2) ringBand(face, drum, 29.5, 0.45, 'trim', 1.02);
    for (let i = 0; i < drum.length; i += d === 1 ? 2 : 1) {
      const f = faceFrame(drum, i);
      if (f.length < 1.2) continue;
      const h = {
        center: lerp(f.a, f.b, 0.5),
        axis: f.axis,
        normal: f.normal,
        width: d === 1 ? 1.35 : 0.9,
        bottom: floor + 27.5,
        height: 1.8,
        spring: 1.15,
        depth: 1,
        shape: 'round',
      };
      pane(face, h, d, 0.12);
      if (d >= 2) archBand(face, h, d, 0.17, 'trim', 0.14);
    }
  }
  const crown = circleRing(group.crown.polygons[0].outline, d),
    cp = center(crown),
    radius = crown.reduce((n, q) => n + Math.hypot(q[0] - cp[0], q[1] - cp[1]), 0) / crown.length;
  profile(
    face,
    regular(cp, radius, d <= 1 ? 6 : 8),
    d === 0
      ? [
          [height, 0.28],
          [top - 2.3, 0.85],
          [top, 0],
        ]
      : [
          [height, 0.28],
          [height + 1.0, 0.9],
          [top - 2.3, 0.65],
          [top - 1.55, 0.2],
        ],
    'gold',
  );
  if (d) box(face, cp, 0.2, 0.2, top - 1.6, top, 'gold');
  if (d) box(face, cp, 1.3, 0.2, top - 0.8, top - 0.61, 'gold');
  if (d >= 2) {
    for (let i = 0; i < ring.length; i += d === 2 ? 2 : 1) {
      const q = ring[i],
        n = unit(q.map((v, k) => v - p[k]));
      for (let j = 1; j < sorted.length; j++) {
        const [b, a] = sorted[j - 1],
          [t, c] = sorted[j],
          lo = scaled(ring, a)[i],
          hi = scaled(ring, c)[i],
          tan = [-n[1], n[0]],
          w = 0.04;
        face(
          'metal',
          [
            at(
              lo.map((v, k) => v + n[k] * 0.045 - tan[k] * w),
              b,
            ),
            at(
              lo.map((v, k) => v + n[k] * 0.045 + tan[k] * w),
              b,
            ),
            at(
              hi.map((v, k) => v + n[k] * 0.045 + tan[k] * w),
              t,
            ),
            at(
              hi.map((v, k) => v + n[k] * 0.045 - tan[k] * w),
              t,
            ),
          ],
          [n[0], 0.2, n[1]],
        );
      }
    }
  }
}
function _ringBand(face, r, y, h, slot, factor = 1.01) {
  sides(face, scaled(r, factor), y, y + h, slot);
}
const front = rec.facade,
  westAxis = [0, 1],
  westNormal = [-1, 0];
const frontPoint = (z) => [front.x, z];
function arcadeHoles(d) {
  return rec.facade.bays.map((b, i) =>
    remember(
      {
        name: `narthex-arch-${i}`,
        center: frontPoint(b.z),
        axis: westAxis,
        normal: westNormal,
        width: b.width,
        bottom: floor + 0.15,
        height: i === 2 ? 11.7 : 10.3,
        spring: i === 2 ? 7.3 : 6.5,
        depth: 10,
        shape: 'round',
      },
      d,
    ),
  );
}
function roofTop(b, p) {
  const r = b.polygons[0].outline,
    bounds = [0, 1].map((k) => [Math.min(...r.map((q) => q[k])), Math.max(...r.map((q) => q[k]))]),
    axis = bounds[0][1] - bounds[0][0] > bounds[1][1] - bounds[1][0] ? 1 : 0,
    c = (bounds[axis][0] + bounds[axis][1]) / 2,
    half = (bounds[axis][1] - bounds[axis][0]) / 2;
  return (
    floor +
    b.properties.height -
    Math.min(2.8, half * 0.35) * Math.min(1, Math.abs(p[axis] - c) / half)
  );
}
function roofMass(face, b, d) {
  const _full = b.polygons[0].outline,
    h = b.properties.height,
    bottom = h < 17 ? footing : 13;
  for (const p of b.exposedPolygons) {
    if (p.outline.length < 3) continue;
    const r = simplify(p.outline, d === 1 ? 0.2 : 0.025);
    sides(face, r, bottom, (q) => roofTop(b, q), 'white');
    roofCap(face, b, p);
  }
}
function roofCap(face, b, p) {
  const raw = b.polygons[0].outline,
    bounds = [0, 1].map((k) => [
      Math.min(...raw.map((q) => q[k])),
      Math.max(...raw.map((q) => q[k])),
    ]),
    axis = bounds[0][1] - bounds[0][0] > bounds[1][1] - bounds[1][0] ? 1 : 0,
    c = (bounds[axis][0] + bounds[axis][1]) / 2,
    points = [...p.outline, ...p.holes.flat()],
    starts = [];
  let offset = p.outline.length;
  for (const h of p.holes) {
    starts.push(offset);
    offset += h.length;
  }
  const ids = earcut(points.flat(), starts, 2);
  for (let i = 0; i < ids.length; i += 3) {
    const tri = ids.slice(i, i + 3).map((k) => points[k]);
    for (const s of [-1, 1]) {
      const poly = [];
      let a = tri.at(-1),
        av = (a[axis] - c) * s;
      for (const q of tri) {
        const v = (q[axis] - c) * s;
        if (av >= 0 !== v >= 0) poly.push(lerp(a, q, av / (av - v)));
        if (v >= 0) poly.push(q);
        a = q;
        av = v;
      }
      if (poly.length >= 3)
        face(
          'metal',
          poly.map((q) => at(q, (z) => roofTop(b, z))),
          [0, 1, 0],
        );
    }
  }
}
function edgeStrip(face, a, b, w) {
  const u = unit([b[2] - a[2], b[1] - a[1]]),
    n = [u[1], -u[0]],
    offset = (p, s) => [p[0] - 0.015, p[1] + (n[1] * w * s) / 2, p[2] + (n[0] * w * s) / 2];
  face('trim', [offset(a, -1), offset(b, -1), offset(b, 1), offset(a, 1)], [-1, 0, 0]);
}
function upperRanges(face, d) {
  if (!d) {
    const cross = [
      [-32, -14],
      [-6, -14],
      [-6, -30],
      [8, -30],
      [8, -14],
      [29, -14],
      [29, 12],
      [8, 12],
      [8, 32],
      [-6, 32],
      [-6, 12],
      [-32, 12],
    ];
    sides(face, cross, 13, 24, 'white');
    cap(face, cross, 24, 'metal');
    return;
  }
  for (const b of d === 1 ? rec.districtRoofParts : rec.roofParts) roofMass(face, b, d);
  for (const b of rec.roofParts.filter((b) => b.properties.height >= 14)) {
    const raw = b.polygons[0].outline;
    for (let i = 0; i < raw.length; i++) {
      const f = faceFrame(raw, i);
      if (f.length < 7) continue;
      if (d >= 2) {
        const q = lerp(f.a, f.b, 0.5);
        const h = {
          center: q,
          axis: f.axis,
          normal: f.normal,
          width: 1.4,
          bottom: floor + 15.2,
          height: 3.6,
          spring: 2.8,
          depth: 1,
          shape: 'round',
        };
        pane(face, h, d, 0.12);
        archBand(face, h, d, 0.2);
      }
    }
  }
}
function marbleColumns(face, d, holes) {
  if (d === 0) return;
  for (const h of holes) {
    const z = h.center[1],
      half = h.width / 2;
    for (const s of [-1, 1])
      for (let j = 0; j < (d >= 2 ? 2 : 1); j++) {
        const p = [-45.07 - j * 0.45, z + s * (half + 0.5 + j * 0.27)],
          r = regular(p, d >= 2 ? 0.3 : 0.43, d >= 2 ? 8 : 6);
        if (d === 1) {
          const f = {
            a: [p[0], p[1] - 0.5],
            b: [p[0], p[1] + 0.5],
            axis: westAxis,
            normal: westNormal,
          };
          panel(face, f, 0.5, 0.9, 0.15, 7, 'pink');
          panel(face, f, 0.5, 1.1, 0.15, 0.5, 'trim', 0.1);
          panel(face, f, 0.5, 1.1, 6.8, 0.45, 'trim', 0.1);
        } else {
          solid(face, r, 0.15, 7, 'pink');
          solid(face, scaled(r, 1.3), 0.15, 0.65, 'trim');
          solid(face, scaled(r, 1.4), 6.8, 7.25, 'trim');
        }
      }
    archBand(face, h, d, d === 0 ? 0.75 : 0.42, 'trim', 3.1);
    if (d >= 2)
      archBand(
        face,
        {
          ...h,
          width: h.width + 1.1,
          height: h.height + 0.5,
          spring: h.spring + 0.5,
          bottom: h.bottom - 0.5,
        },
        d,
        0.28,
        'pink',
        3.06,
      );
  }
}
function facade(out, d, holes) {
  const face = writer(out, d),
    bay = front.bays;
  for (const h of holes) {
    if (d === 0) pane(face, h, d, 3.11);
    else {
      const door = {
        ...h,
        width: h.name === 'narthex-arch-2' ? 3.8 : 2.4,
        bottom: floor + 0.1,
        height: 5.1,
        spring: 3.8,
      };
      pane(face, door, d, -3.55, 'door');
      if (d >= 2) archBand(face, door, d, 0.35, 'pink', -3.45);
      cap(face, rect([-42, h.center[1]], 7.4, h.width), 0, 'foundation');
    }
  }
  marbleColumns(face, d, holes);
  // Continuous balcony/cornice and its sparse balustrade connect all five facade bays.
  solid(face, rect([-41.0, 0.8], 8.5, 54.0), 13, 13.3, 'trim');
  if (d) {
    box(face, [-45.15, 0.8], 0.35, 51, 13.3, 13.9, 'trim');
    box(face, [-45.15, 0.8], 0.3, 51, 15.0, 15.2, 'trim');
    const count = d === 1 ? 25 : 45;
    for (let i = 0; i < count; i++)
      box(face, [-45.15, -24.2 + (i * 50) / count], 0.24, 0.24, 13.9, 15, 'trim');
  }
  for (let i = 0; i < bay.length; i++) {
    const b = bay[i],
      central = i === 2,
      h = {
        center: [-42.8, b.z],
        axis: westAxis,
        normal: westNormal,
        width: central ? 15.2 : 8.2,
        bottom: floor + 14.1,
        height: central ? 13.4 : 9.1,
        spring: central ? 5.8 : 4.1,
        depth: 2,
        shape: 'round',
      };
    if (d === 0) {
      const p = prepareOpening(h, 0, d);
      face(
        'white',
        openingShape(h, d).map((q) => p.point(...q, 0.15)),
        [-1, 0, 0],
      );
    } else {
      pane(face, h, d, 0.2, central ? 'glass' : 'white');
      archBand(face, h, d, 0.78, 'trim', 0.25);
      if (!central) {
        const mosaic = { ...h, bottom: floor + 18.8, height: 4.5, spring: 0.4, width: 7.0 };
        pane(face, mosaic, d, 0.25, 'gold');
        const f = {
          a: [-43.0, b.z - 1.7],
          b: [-43.0, b.z + 1.7],
          axis: westAxis,
          normal: westNormal,
        };
        panel(face, f, 0.5, 1.15, 19, 2.8, 'glass', 0.3);
        panel(face, f, 0.22, 0.85, 19.2, 1.6, 'pink', 0.31);
        if (d >= 3) {
          for (const t of [0.12, 0.48, 0.8]) panel(face, f, t, 0.24, 21.3, 0.45, 'white', 0.32);
        }
        const lowWindow = { ...h, width: 1.0, bottom: floor + 15.6, height: 2.6, spring: 1.7 };
        pane(face, lowWindow, d, 0.35);
        archBand(face, lowWindow, d, 0.22, 'trim', 0.37);
      }
    }
    ogee(face, h, d, central ? 29 : 25.0);
  }
  for (const [z, height] of [
    [-25.0, 29],
    [-15.3, 29],
    [-4.8, 31.1],
    [6.7, 31.1],
    [16.9, 29],
    [26.0, 29],
  ])
    pinnacle(face, d, [-42.9, z], height - 5, height);
  if (d >= 2) {
    const f = { a: [-43.2, -2], b: [-43.2, 4], axis: westAxis, normal: westNormal };
    panel(face, f, 0.5, 2.4, 25.5, 1.25, 'gold', 0.22);
    for (const z of [-3.6, -1.15, 1.3, 3.75]) horse(face, [-45.1, 13.3, z], d);
  }
}
function ogee(face, h, d, top) {
  if (d === 0) return;
  const p = prepareOpening(h, 0, d),
    r = openingShape(h, d),
    offset = 0.35;
  for (let i = 2; d >= 2 && i < r.length - 1; i++) {
    const a = r[i],
      b = r[i + 1],
      lo = p.point(...a, offset),
      hi = p.point(...b, offset);
    if (d === 1) edgeStrip(face, lo, hi, 0.38);
    else beam(face, 'trim', lo, hi, 0.38);
  }
  if (d >= 1) {
    const side = h.width / 2 + 1.1,
      base = floor + (h.name?.includes('central') ? 22 : 21.0),
      peak = floor + top;
    for (const s of [-1, 1]) {
      const a = [-43.3, base, h.center[1] + side * s],
        b = [-43.3, peak - 1.5, h.center[1] + 2.2 * s],
        c = [-43.3, peak, h.center[1]];
      if (d === 1) {
        edgeStrip(face, a, b, 0.45);
        edgeStrip(face, b, c, 0.45);
      } else {
        beam(face, 'trim', a, b, 0.45);
        beam(face, 'trim', b, c, 0.45);
      }
    }
    box(face, [-43.3, h.center[1]], 0.22, 0.22, top - 0.3, top + 0.65, 'gold');
  }
}
function pinnacle(face, d, p, base, top) {
  box(face, p, 0.85, 1.4, 13.3, base, 'trim');
  const r = regular(p, d <= 1 ? 0.7 : 0.65, d <= 1 ? 4 : 8);
  if (d === 0) {
    profile(
      face,
      r,
      [
        [base, 1],
        [top - 2, 1],
        [top, 0],
      ],
      'trim',
    );
    return;
  }
  if (d < 2) solid(face, r, base, top - 2, 'trim');
  else {
    solid(face, r, base, base + 0.4, 'trim');
    for (const [x, z] of [
      [-0.45, -0.45],
      [0.45, -0.45],
      [0.45, 0.45],
      [-0.45, 0.45],
    ])
      box(face, [p[0] + x, p[1] + z], 0.22, 0.22, base + 0.4, top - 2, 'trim');
    solid(face, r, top - 2.2, top - 1.8, 'trim');
  }
  profile(
    face,
    r,
    [
      [top - 1.8, 1.1],
      [top - 0.2, 0.05],
    ],
    'gold',
  );
  if (d >= 2) box(face, p, 0.16, 0.16, top - 0.2, top + 0.35, 'gold');
}
function ellipsoid(face, slot, p, r, segments = 8) {
  const levels = [
      [-1, 0],
      [-0.65, 0.76],
      [0, 1],
      [0.65, 0.76],
      [1, 0],
    ],
    rings = levels.map(([x, k]) =>
      Array.from({ length: segments }, (_, i) => [
        p[0] + x * r[0],
        p[1] + Math.cos((i * Math.PI * 2) / segments) * r[1] * k,
        p[2] + Math.sin((i * Math.PI * 2) / segments) * r[2] * k,
      ]),
    );
  for (let i = 1; i < rings.length; i++)
    for (let j = 0; j < segments; j++) {
      const k = (j + 1) % segments;
      face(slot, [rings[i - 1][j], rings[i - 1][k], rings[i][k], rings[i][j]]);
    }
}
function horse(face, p, d) {
  const [x, y, z] = p,
    to = (a, b, c) => [x + a, floor + y + b, z + c];
  ellipsoid(face, 'bronze', to(0.45, 1.42, 0), [0.95, 0.43, 0.36]);
  beam(face, 'bronze', to(-0.18, 1.4, 0), to(-0.56, 2.32, 0), 0.43);
  ellipsoid(face, 'bronze', to(-0.81, 2.37, 0), [0.49, 0.27, 0.22]);
  for (const [s, t] of [
    [-0.45, -0.23],
    [-0.45, 0.23],
    [1.0, -0.24],
    [1.0, 0.24],
  ]) {
    const bend = s < 0 ? -0.12 : 0.2;
    beam(face, 'bronze', to(s, 1.2, t), to(s + bend, 0.65, t), 0.19);
    beam(face, 'bronze', to(s + bend, 0.65, t), to(s - 0.08, 0.1, t), 0.15);
    ellipsoid(face, 'bronze', to(s - 0.14, 0.1, t), [0.15, 0.1, 0.12], 6);
  }
  beam(face, 'bronze', to(1.25, 1.4, 0), to(1.42, 0.55, 0), 0.12);
  for (const t of [-0.16, 0.16])
    face('bronze', [to(-0.57, 2.55, t), to(-0.68, 2.9, t), to(-0.82, 2.55, t)], [-1, 0, 0]);
  if (d >= 3) beam(face, 'gold', to(-0.04, 1.6, -0.38), to(-0.04, 1.6, 0.38), 0.05);
}
function build(out, d) {
  const face = writer(out, d),
    main = simplify(rec.main.polygons[0].outline, d === 0 ? 0.8 : d === 1 ? 0.3 : 0.03),
    holes = arcadeHoles(d);
  if (d === 0) {
    sides(face, main, footing, 13, 'white');
    cap(face, main, 13, 'metal');
  } else {
    shell(out, d, main, 0, 13, holes);
    if (d === 1) cap(face, main, 13, 'metal');
    else for (const p of rec.lowRoof) cap(face, p.outline, 13, 'metal', p.holes);
    sides(face, main, footing, 0, 'foundation');
    cap(face, main, 0, 'foundation');
  }
  upperRanges(face, d);
  for (const group of rec.domes) domeGroup(face, d, group);
  facade(out, d, holes);
}
export const buildStMarksSkyline = (out) => build(out, 0);
export const buildStMarksDistrict = (out) => build(out, 1);
export const buildStMarksStreet = (out) => build(out, 2);
export const buildStMarksCloseup = (out) => build(out, 3);
export const stMarksStudy = {
  id: 'st_marks_basilica',
  key: 'st_mark_s_basilica',
  title: "St Mark's Basilica",
  category: 'cathedral',
  wikidataId: 'Q172988',
  generationCommand: 'node packages/worldgen/scripts/generate-additional-landmarks.mjs',
  mapFrame: 'map-frame.json',
  fidelityTarget: 'medium-fi',
  build: (out) => build(out, 4),
  surfaceOverrides: scope.surfaceOverrides,
  brief:
    'Individual five-dome Byzantine basilica exterior: mapped domes/drums/crowns/roof ranges, lead-colored roofs, red brick drums, layered marble west facade with five actual narthex arches and closed rear doors, upper glazing/gold mosaic approximations, balcony/pinnacles and four simplified bronze horses.',
  sourceFacts: {
    horizontalBasis:
      'Retained exact-QID way138800932 envelope and41 current selected component controls preserve west facade, five-dome cross and adjoining ranges.',
    architecturalHeights: rec.heightBasis,
  },
  reconstruction: rec,
  scaleBasis:
    'Mapped main/component footprints and nominal heights, with two inspected aerial/front photographs guiding roof profiles, facade and selected detail.',
  refs: read('reference-metadata.json').currentRoundInspection.pictures.map((p) => p.page),
  nativeAxes: frame.nativeAxes,
  sourceDocuments: scope.sourceDocuments,
  sourceLicense:
    'Original geometry under repository license; mapped controls ©OpenStreetMap contributors,ODbL-1.0. Linked photographs not redistributed.',
  dataAttribution: '©OpenStreetMap contributors; Protomaps; Mapzen/USGS terrain tiles.',
  sourceNotice:
    'Four existing shared256-square graphs supply marble, brick, standing-seam metal and continuous limestone. Colors are linear; UVs metric. Glazing, doors, simplified mosaic artwork/gold and bronze horses use vertex colors, with no embedded photographs or unique facade bitmap.',
  importReason:
    'Preserve the five mapped domes/crowns, cross-shaped ranges and recognizable layered west facade in four independently authored browser levels.',
  previewGround: false,
  previewTerrain: scope.previewTerrain,
  mediumFiContext: scope.mediumFiContext,
  geographic: () => scope.geographic,
  geographicNote: scope.geographicNote,
  limitations: [
    'Mapped parent/component footprints and nominal heights control fit. Dome/crown profiles, roof subdivisions, drum window rhythm, facade arches/columns/pediments, balcony and pinnacles are picture-led approximations.',
    'NativeY0 follows standardDEM12.2467m at anchor. Estimated0.7m common floor, perimeter foundations and narthex/plaza joins are approximate against coarse elevation; no surveyed datum or certified walking/interior collision.',
    'Skyline preserves five domes/onion crowns, upper cross ranges and facade arcade/gabled crowns with simpler parts. District restores mapped ranges, shared surfaces and actual narthex cuts; street/closeup add paired columns, mosaic color panels, open pinnacles and four simplified bronze horses. Small drum/range windows are surface panes; rear entrance doors are closed.',
    'Four upper gold panels suggest mosaics using simple original color motifs; exact compositions, sculpture/reliefs, lettering, horses anatomy/patina, full interiors and structural roof reconstruction are excluded. Detached campanile, Doges Palace, surrounding city and vegetation remain separate host content. Physical laptop/phone measurements remain pending.',
  ],
  camera: scope.camera,
  qaCameras: [
    { name: 'west-five-arches-and-balcony', position: [-94, 23, 5], lookAt: [-42, 13, 1], fov: 43 },
    { name: 'central-and-cross-domes', position: [58, 76, 57], lookAt: [0, 32, 2], fov: 43 },
    { name: 'upper-gold-panels-and-horses', position: [-63, 21, 5], lookAt: [-43, 19, 1], fov: 43 },
    { name: 'south-roofs-and-annexes', position: [28, 38, 80], lookAt: [9, 18, 25], fov: 43 },
    { name: 'east-apse-and-dome', position: [96, 41, -23], lookAt: [25, 22, 1], fov: 43 },
    { name: 'north-ranges-and-lead-roof', position: [-6, 43, -92], lookAt: [-3, 23, -16], fov: 43 },
  ],
};
