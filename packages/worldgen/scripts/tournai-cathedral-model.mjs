/** Tournai: five mapped towers, rounded transepts and unequal Romanesque/Gothic ranges. */
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
  '../../../content/worldgen/source/places/u0/u0f/n0330_tournai_cathedral/',
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
  stone: '#c5c4b8',
  trim: '#d8d3c3',
  roof: '#858796',
  tile: '#ad805e',
  foundation: '#a8a698',
  glass: '#435971',
  door: '#79694e',
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
const footing = (p) => Math.min(floor - 0.3, tournaiGround(...p) - 0.35);
export function tournaiGround(x, z) {
  const c = Math.cos(fit.heading),
    s = Math.sin(fit.heading);
  [x, z] = [x * c + z * s, -x * s + z * c];
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw Error('Tournai footing outside retained terrain');
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
export const tournaiOpenings = [];
const remember = (h, d) => {
  if (d >= 3 && !tournaiOpenings.some((q) => q.name === h.name)) tournaiOpenings.push(h);
  return h;
};
function shell(out, d, r, b, t, holes = [], slot = 'stone', inner = null) {
  const hs = holes.map((h) => prepareOpening(h, 0, d)),
    face = writer(openingBuilder(out, hs), d);
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
const component = (id) => rec.components.find((b) => b.id === id);
const bounds = (r) =>
  [0, 1].map((k) => [Math.min(...r.map((p) => p[k])), Math.max(...r.map((p) => p[k]))]);
const band = (face, r, y, h = 0.3, slot = 'trim', f = 1.025) =>
  sides(face, scaled(r, f), y, y + h, slot);
function beam(face, a, b, w, slot = 'trim', thickness = w) {
  const axis = unit(b.map((v, k) => v - a[k])),
    u = unit(cross(axis, Math.abs(axis[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0])),
    v = unit(cross(axis, u));
  const corners = (p) =>
    [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ].map(([s, t]) => p.map((n, k) => n + (u[k] * s * w + v[k] * t * thickness) / 2));
  const lo = corners(a),
    hi = corners(b);
  face(
    slot,
    lo,
    axis.map((x) => -x),
  );
  face(slot, hi, axis);
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    face(slot, [lo[i], lo[j], hi[j], hi[i]]);
  }
}
function roofHeight(b, p) {
  const r = b.polygons[0].outline,
    box = bounds(r),
    round = b.kind === 'round' || b.id === 35185314457262;
  if (round) {
    const c = center(r),
      radius = r.reduce((n, q) => Math.max(n, Math.hypot(q[0] - c[0], q[1] - c[1])), 0);
    return (
      floor +
      b.eave +
      (b.top - b.eave) * Math.max(0, 1 - Math.hypot(p[0] - c[0], p[1] - c[1]) / radius)
    );
  }
  const short = box[0][1] - box[0][0] > box[1][1] - box[1][0] ? 1 : 0,
    c = (box[short][0] + box[short][1]) / 2,
    half = (box[short][1] - box[short][0]) / 2;
  return floor + b.eave + (b.top - b.eave) * Math.max(0, 1 - Math.abs(p[short] - c) / half);
}
function clip2(r, k, value, sign) {
  const p = [];
  let a = r.at(-1),
    av = (a[k] - value) * sign;
  for (const q of r) {
    const v = (q[k] - value) * sign;
    if (av >= 0 !== v >= 0) p.push(lerp(a, q, av / (av - v)));
    if (v >= 0) p.push(q);
    a = q;
    av = v;
  }
  return p;
}
function roof(face, b, d) {
  const raw = b.polygons[0].outline,
    box = bounds(raw),
    short = box[0][1] - box[0][0] > box[1][1] - box[1][0] ? 1 : 0,
    round = b.kind === 'round' || b.id === 35185314457262,
    axes = round ? [0, 1] : [short],
    slot = b.id === 35185314766987 ? 'tile' : 'roof';
  for (const p of b.roofPolygons) {
    const points = [...p.outline, ...p.holes.flat()],
      starts = [];
    let offset = p.outline.length;
    for (const h of p.holes) {
      starts.push(offset);
      offset += h.length;
    }
    const ids = earcut(points.flat(), starts, 2);
    for (let i = 0; i < ids.length; i += 3) {
      let polys = [ids.slice(i, i + 3).map((k) => points[k])];
      for (const k of axes) {
        const c = round ? center(raw)[k] : (box[k][0] + box[k][1]) / 2;
        polys = polys
          .flatMap((r) => [clip2(r, k, c, -1), clip2(r, k, c, 1)])
          .filter((r) => r.length >= 3);
      }
      for (const r of polys)
        face(
          slot,
          r.map((p) => at(p, (q) => roofHeight(b, q))),
          [0, 1, 0],
        );
    }
    for (const r of [p.outline, ...p.holes]) {
      const refined = r.flatMap((a, i) => {
        const q = r[(i + 1) % r.length],
          ts = [0];
        for (const k of axes) {
          const c = round ? center(raw)[k] : (box[k][0] + box[k][1]) / 2;
          if (Math.abs(q[k] - a[k]) > 1e-8) {
            const t = (c - a[k]) / (q[k] - a[k]);
            if (t > 1e-7 && t < 1 - 1e-7) ts.push(t);
          }
        }
        return ts.sort((a, b) => a - b).map((t) => lerp(a, q, t));
      });
      sides(face, refined, b.eave, (p) => roofHeight(b, p), 'stone', r !== p.outline);
    }
  }
  if (d >= 3 && b.id === 35185314457264) {
    const z = (box[1][0] + box[1][1]) / 2;
    beam(face, at([box[0][0], z], b.top + 0.12), at([box[0][1], z], b.top + 0.12), 0.22, 'trim');
  }
}
function surfaceWindows(face, r, bottom, h, d, name, spacing = 5, shape = 'round') {
  if (!d) return;
  for (let i = 0; i < r.length; i++) {
    const f = faceFrame(r, i);
    if (f.length < (d >= 2 ? 1.6 : 3)) continue;
    const count = Math.max(1, Math.floor(f.length / (spacing * (d === 1 ? 1.6 : 1))));
    for (let k = 0; k < count; k++) {
      const hole = {
        name: `${name}-${i}-${k}`,
        center: lerp(f.a, f.b, (k + 0.5) / count),
        axis: f.axis,
        normal: f.normal,
        width: Math.min(shape === 'pointed' ? 3.3 : 1.7, (f.length / count) * 0.55),
        bottom: floor + bottom,
        height: h,
        spring: h * (shape === 'pointed' ? 0.8 : 0.66),
        shape,
        depth: 1,
      };
      if (
        name === 'lower-nave' &&
        hole.center[0] < rec.front.x + 2 &&
        Math.abs(hole.center[1] - rec.front.z) < 3.5
      )
        continue;
      pane(face, hole, d, 0.12);
      if (d >= 3 || (d >= 2 && shape === 'pointed')) archBand(face, hole, d, 0.3, 'trim', 0.16);
      if (d >= 3 && shape === 'pointed') {
        const p = hole.center;
        beam(
          face,
          [p[0] + f.normal[0] * 0.18, floor + bottom, p[1] + f.normal[1] * 0.18],
          [p[0] + f.normal[0] * 0.18, floor + bottom + h * 0.79, p[1] + f.normal[1] * 0.18],
          0.19,
        );
      }
    }
  }
}
export const tournaiBelfryOpenings = [];
function tower(out, d, b) {
  const face = writer(out, d),
    r = b.polygons[0].outline,
    inner = scaled(r, 0.74),
    holes = [];
  if (d) {
    for (let i = 0; i < r.length; i++) {
      const f = faceFrame(r, i),
        count = d === 1 ? 1 : 3;
      for (let j = 0; j < count; j++) {
        const h = {
          name: `tower-${b.id}-${i}-${j}`,
          center: lerp(f.a, f.b, (j + 0.5) / count),
          axis: f.axis,
          normal: f.normal,
          width: d === 1 ? 2.45 : 1.35,
          bottom: floor + 54,
          height: 6.5,
          spring: 4.8,
          depth: 4,
          shape: 'round',
        };
        if (d !== 1 || i % 2 === 0) holes.push(h);
        else pane(face, h, d, 0.08);
        if (d >= 3 && !tournaiBelfryOpenings.some((q) => q.name === h.name))
          tournaiBelfryOpenings.push(h);
      }
    }
    sides(face, r, 0, 52, 'stone');
    cap(face, inner, 52, 'stone');
    const apertureDetail = d === 2 ? 1 : d;
    shell(out, apertureDetail, r, 52, 62, holes, 'stone', inner);
    if (d >= 2) for (const h of holes) archBand(face, h, apertureDetail, 0.38, 'trim', 0.08);
    for (const y of d === 1 ? [61.4] : [35, 51.2, 61.4]) band(face, r, y, 0.35);
    if (d >= 2) {
      for (let i = 0; i < r.length; i++) {
        const f = faceFrame(r, i);
        for (const [y, h] of [
          [21, 6],
          [37, 7],
        ])
          for (const t of [0.2, 0.5, 0.8]) {
            const q = {
              center: lerp(f.a, f.b, t),
              axis: f.axis,
              normal: f.normal,
              width: 1.28,
              bottom: floor + y,
              height: h,
              spring: h - 1.1,
              shape: 'round',
              depth: 1,
            };
            pane(face, q, d, 0.08);
            if (d >= 3) archBand(face, q, d, 0.25);
          }
        if (d >= 3)
          for (const t of [0.045, 0.955]) {
            const q = lerp(f.a, f.b, t);
            box(face, q, 0.35, 0.35, 12, 61.5, 'trim');
          }
      }
    } else surfaceWindows(face, r, 36, 7, d, 'tower-lower', 4.1);
  } else {
    sides(face, r, footing, 62, 'stone');
    surfaceWindowsFar(face, r);
  }
  profile(
    face,
    r,
    [
      [62, 1.07],
      [64, 1.0],
      [82.7, 0.025],
    ],
    'roof',
  );
  const p = center(r);
  box(face, p, 0.15, 0.15, 82.6, 83, 'trim');
  if (d >= 2) {
    for (let i = 0; i < r.length; i++) {
      const f = faceFrame(r, i),
        q = lerp(f.a, f.b, 0.5);
      const h = {
        center: q.map((v, k) => p[k] + (v - p[k]) * 0.8),
        axis: f.axis,
        normal: f.normal,
        width: 1.1,
        bottom: floor + 66.1,
        height: 1.9,
        spring: 1.0,
        shape: 'pointed',
        depth: 1,
      };
      pane(face, h, d, 0.05);
      if (d >= 3) archBand(face, h, d, 0.15, 'trim', 0.08);
    }
  }
}
function surfaceWindowsFar(face, r) {
  for (let i = 0; i < r.length; i++) {
    const f = faceFrame(r, i);
    panel(face, f, 0.5, 2.9, 54.5, 5.2, 'glass', 0.04);
  }
}
function lantern(out, d, b) {
  const face = writer(out, d),
    r = b.polygons[0].outline;
  sides(face, r, b.base, b.eave, 'stone');
  profile(
    face,
    r,
    [
      [b.eave, 1.05],
      [b.top, 0.02],
    ],
    'roof',
  );
  if (d) {
    if (d >= 2 || b.kind === 'lantern') band(face, r, b.eave - 0.5, 0.3);
    surfaceWindows(face, r, b.eave - 4.3, 3.2, d, 'central-lantern', 4);
  }
}
function portal(d) {
  return remember(
    {
      name: 'west-closed-portal',
      center: [rec.front.x, rec.front.z],
      axis: [0, 1],
      normal: [-1, 0],
      width: 3.4,
      bottom: floor + 0.05,
      height: 7.3,
      spring: 5.1,
      depth: 8,
      shape: 'round',
    },
    d,
  );
}
function ranges(out, d, hole) {
  const face = writer(out, d);
  for (const b of rec.components) {
    if (['tower', 'lantern', 'corner', 'buttress'].includes(b.kind)) continue;
    const r = simplify(b.polygons[0].outline, d === 0 ? 0.65 : 0.025);
    const farFlat = d === 0 && b.top <= 24;
    if (d && Math.min(...r.map((p) => p[0])) < rec.front.x + hole.depth / 2)
      shell(out, d, r, 0, b.eave, [hole]);
    else sides(face, r, 0, farFlat ? b.top : b.eave, 'stone');
    if (farFlat) {
      cap(face, r, b.top, b.id === 35185314766987 ? 'tile' : 'roof');
      continue;
    }
    if (d <= 1) {
      const copy = {
        ...b,
        roofPolygons: [{ outline: r, holes: [] }],
      };
      roof(face, copy, d);
    } else roof(face, b, d);
    if (d) {
      if (d >= 2 || b.top >= 28) band(face, r, b.eave - 0.3, 0.25);
      if (b.id === 35185314457264 || b.id === 35185314457262)
        surfaceWindows(face, r, 25.4, 15.7, d, 'gothic-choir', 5.5, 'pointed');
      else if (b.id === 35185314457263) surfaceWindows(face, r, 23, 2.8, d, 'nave-clerestory', 5.2);
      else if (b.id === 35185314457259) surfaceWindows(face, r, 9.1, 5.7, d, 'lower-nave', 5);
      else if (b.kind === 'round')
        surfaceWindows(
          face,
          r,
          b.eave === 35 ? 29 : Math.max(3, b.eave - 7),
          5.0,
          d,
          'transept',
          4,
        );
      else if (d >= 2 && b.top >= 16 && b.top < 25)
        surfaceWindows(face, r, 4.5, 5.5, d, 'low-chapel', 5.7, 'pointed');
    }
  }
  for (const id of rec.corners) lantern(out, d, component(id));
  const r = rec.main.polygons[0].outline;
  if (d) {
    sides(face, r, footing, 0, 'foundation');
    cap(face, r, 0, 'foundation');
  }
  const door = { ...hole, width: 2.85, height: 6.4, spring: 4.8 };
  pane(face, door, d, d ? -2.1 : 0.12, 'door');
  if (d) {
    archBand(face, hole, d, 0.65, 'trim', 0.17);
    if (d >= 2)
      archBand(
        face,
        { ...hole, width: 4.7, bottom: floor - 0.6, height: 8.5, spring: 5.7 },
        d,
        0.35,
        'trim',
        0.19,
      );
  }
  const f = {
    a: [rec.front.x, rec.front.z - 6.8],
    b: [rec.front.x, rec.front.z + 6.8],
    axis: [0, 1],
    normal: [-1, 0],
  };
  if (d) {
    for (const t of [0.16, 0.84]) {
      const q = {
        center: lerp(f.a, f.b, t),
        axis: f.axis,
        normal: f.normal,
        width: 1.5,
        bottom: floor + 10.2,
        height: 5.0,
        spring: 3.3,
        depth: 1,
        shape: 'round',
      };
      pane(face, q, d, 0.16);
      archBand(face, q, d, 0.3);
    }
    const upper = component(35185314457263).polygons[0].outline;
    const west = upper
      .map((_, i) => faceFrame(upper, i))
      .sort((a, b) => a.a[0] + a.b[0] - (b.a[0] + b.b[0]))[0];
    const origin = lerp(west.a, west.b, 0.5),
      count = d === 1 ? 8 : 16;
    const circle = (radius) =>
      Array.from({ length: count }, (_, i) => {
        const a = (i * 2 * Math.PI) / count,
          u = radius * Math.cos(a);
        return [
          origin[0] + west.axis[0] * u + west.normal[0] * 0.09,
          floor + 24 + radius * Math.sin(a),
          origin[1] + west.axis[1] * u + west.normal[1] * 0.09,
        ];
      });
    const rose = circle(1.5),
      outer = circle(1.8),
      normal = [west.normal[0], 0, west.normal[1]];
    face('glass', rose, normal);
    for (let i = 0; i < count; i++) {
      const j = (i + 1) % count;
      face('trim', [outer[i], outer[j], rose[j], rose[i]], normal);
    }
  }
  const steps = d === 0 ? 1 : d === 1 ? 3 : 7,
    front = rec.front,
    x0 = front.x - 5.4;
  for (let i = 0; i < steps; i++) {
    const x = x0 + ((front.x - x0) * i) / steps,
      top = floor - 0.06 - (steps - 1 - i) * 0.22;
    solid(
      face,
      rect([(x + front.x) / 2, front.z], front.x - x, 7.0),
      (p) => Math.min(top - 0.3, tournaiGround(...p) - 0.1),
      () => top,
      'foundation',
    );
  }
}
function flyingButtresses(out, d) {
  if (!d) return;
  const face = writer(out, d),
    choir = component(35185314457264);
  for (const b of rec.components.filter((b) => b.kind === 'buttress')) {
    const r = b.polygons[0].outline;
    solid(face, r, 0, 26, 'stone');
    profile(
      face,
      r,
      [
        [26, 1.0],
        [27, 0.1],
      ],
      'trim',
    );
    if (d >= 2) {
      const p = center(r),
        candidates = [];
      for (const mass of [choir, component(35185314457262)]) {
        const ring = mass.polygons[0].outline;
        for (let i = 0; i < ring.length; i++) {
          const a = ring[i],
            b = ring[(i + 1) % ring.length],
            u = b.map((v, k) => v - a[k]);
          const t = Math.max(
            0,
            Math.min(
              1,
              ((p[0] - a[0]) * u[0] + (p[1] - a[1]) * u[1]) / (u[0] * u[0] + u[1] * u[1]),
            ),
          );
          const q = lerp(a, b, t);
          candidates.push({ q, distance: Math.hypot(p[0] - q[0], p[1] - q[1]) });
        }
      }
      const q = candidates.sort((a, b) => a.distance - b.distance)[0].q;
      const point = (t) => [
        q[0] + (p[0] - q[0]) * t,
        floor + 39.5 - 14.5 * t - 2.1 * Math.sin(Math.PI * t),
        q[1] + (p[1] - q[1]) * t,
      ];
      const segments = d >= 3 ? 4 : 2;
      for (let i = 0; i < segments; i++)
        beam(face, point(i / segments), point((i + 1) / segments), 1.0, 'trim', 2.2);
    }
  }
}
function build(out, d) {
  const destination = out;
  out = {
    addTriangle(slot, ref, p, n, uv, col) {
      p = p.map((q) => q.map(Math.fround));
      if (
        Math.hypot(
          ...cross(
            p[1].map((v, k) => v - p[0][k]),
            p[2].map((v, k) => v - p[0][k]),
          ),
        ) < 1e-8
      )
        return;
      destination.addTriangle(slot, ref, p, n, uv, col);
    },
  };
  const h = portal(d);
  ranges(out, d, h);
  for (const id of rec.towers) tower(out, d, component(id));
  lantern(out, d, component(rec.central));
  flyingButtresses(out, d);
}
export const buildTournaiSkyline = (out) => build(out, 0);
export const buildTournaiDistrict = (out) => build(out, 1);
export const buildTournaiStreet = (out) => build(out, 2);
export const buildTournaiCloseup = (out) => build(out, 3);
export const tournaiStudy = {
  id: 'N0330',
  key: 'tournai_cathedral',
  title: 'Tournai Cathedral',
  category: 'cathedral',
  wikidataId: 'Q391229',
  generationCommand: 'node packages/worldgen/scripts/generate-additional-landmarks.mjs',
  mapFrame: 'map-frame.json',
  fidelityTarget: 'medium-fi',
  build: (out) => build(out, 4),
  surfaceOverrides: scope.surfaceOverrides,
  brief:
    'Individual Tournai cathedral exterior with four taller open-belfry towers and lower central lantern, pointed slate roofs, stepped rounded transepts, lower western Romanesque nave, taller Gothic choir/apse/flying buttresses, selected chapels/annexes and estimated closed west portal.',
  sourceFacts: {
    horizontalBasis:
      'Retained exact-QID outline and current main/55 part controls preserve west nave/east choir, five towers, rounded transepts and lower ancillary ranges.',
    architecturalHeights: rec.heightBasis,
  },
  reconstruction: rec,
  scaleBasis:
    'Mapped parent/component polygons and nominal heights; two inspected elevated exterior pictures guide untagged profiles, openings and selected detail.',
  refs: read('reference-metadata.json').currentRoundInspection.pictures.map((p) => p.page),
  nativeAxes: frame.nativeAxes,
  sourceDocuments: scope.sourceDocuments,
  sourceLicense:
    'Original geometry under repository license; map controls ©OpenStreetMap contributors,ODbL-1.0. Linked photographs not redistributed.',
  dataAttribution: '©OpenStreetMap contributors; Protomaps; Mapzen/USGS terrain tiles.',
  sourceNotice:
    'Five existing shared256-square graphs supply limestone walls/trim, slate, chapel tile, raw stone foundations and wood doors. Linear tints and metric UVs; glazing uses vertex colors, no unique embedded image.',
  importReason:
    'Four independently authored levels preserve the individual five-tower cluster, rounded transepts, lower nave and higher Gothic choir at their mapped location.',
  previewGround: false,
  previewTerrain: scope.previewTerrain,
  mediumFiContext: scope.mediumFiContext,
  geographic: () => scope.geographic,
  geographicNote: scope.geographicNote,
  limitations: [
    'Current main/55 component footprints and nominal heights are retained; eave/spire splits, semicircular roof profiles, flying buttresses, window rhythm, untagged ancillary12m heights and all ornament are picture-led estimates. Derived roof masks are rounded to0.01mm for clipping; source footprint controls remain unchanged.',
    'NativeY0 follows standardDEM27.636844m. Estimated1.5m common floor against perimeter−2.22..3.25m produces approximate foundation skirts and some terrain embedding. Precise plaza/doorstep levels, surveyed placement and walking/collision certification are unverified.',
    'Skyline preserves the five pointed towers, rounded transepts, lower nave and taller choir. District restores shared materials and principal belfry cuts; street/closeup add triple open belfry galleries, facade rhythms and flying buttresses. Surface windows and closed entrance doors do not reconstruct full interiors.',
    'Exact west-facade design, sculptural portals, tracery, statues, inscriptions, interior plans and separate city belfry are excluded. Neighbors are synthetic terraced context. Physical laptop/phone measurements remain pending.',
  ],
  camera: scope.camera,
  qaCameras: [
    { name: 'west-nave-and-closed-portal', position: [-117, 29, 7], lookAt: [-62, 17, 0], fov: 43 },
    { name: 'five-towers-and-open-belfries', position: [-45, 78, 95], lookAt: [0, 57, 0], fov: 43 },
    { name: 'south-rounded-transept', position: [13, 43, 82], lookAt: [4, 27, 24], fov: 43 },
    {
      name: 'gothic-choir-and-flying-buttresses',
      position: [47, 52, 93],
      lookAt: [37, 29, 8],
      fov: 43,
    },
    { name: 'eastern-apse-and-chapels', position: [126, 43, 5], lookAt: [51, 29, 0], fov: 43 },
    { name: 'north-nave-and-transept', position: [-36, 59, -114], lookAt: [-15, 29, -6], fov: 43 },
  ],
};
