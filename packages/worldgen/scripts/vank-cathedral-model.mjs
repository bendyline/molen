/** Vank Cathedral: picture/PMTiles courtyard complex with three individual towers and pointed dome. */
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
  '../../../content/worldgen/source/places/tj/tju/vank_cathedral/',
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
  wall: '#c6a278',
  trim: '#d2c1a0',
  roof: '#b8ac92',
  blue: '#3e6d86',
  metal: '#778693',
  door: '#725741',
  glass: '#4d6178',
  court: '#b8af99',
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
const footing = (p) => Math.min(floor - 0.3, vankGround(...p) - 0.35);
export function vankGround(x, z) {
  const c = Math.cos(fit.heading),
    s = Math.sin(fit.heading);
  [x, z] = [x * c + z * s, -x * s + z * c];
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw Error('Vank cathedral footing outside retained terrain');
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
function faceFrame(r, i) {
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
const regular = (p, r, n = 8, offset = 0) =>
  Array.from({ length: n }, (_, i) => [
    p[0] + r * Math.cos(offset + (i * 2 * Math.PI) / n),
    p[1] + r * Math.sin(offset + (i * 2 * Math.PI) / n),
  ]);
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
const role = (n) => rec.controls.find((b) => b.id === rec.roles[n]).polygons[0].outline,
  church = role('church'),
  gate = role('gate'),
  belfry = role('belfry'),
  dome = rec.domeCenter,
  roofBell = rec.roofBelfryCenter,
  gateCenter = center(gate),
  bellCenter = center(belfry);
const R = (p, w, h = w) => rect(p, w, h),
  hole = (name, p, a, n, width, bottom, height, spring = height, shape = 'rect', depth = 4) => ({
    name,
    center: p,
    axis: a,
    normal: n,
    width,
    bottom: floor + bottom,
    height,
    spring,
    shape,
    depth,
  });
function crossMark(face, p, b, t, w = 0.8) {
  beam(face, at(p, b), at(p, t), 0.14, 'metal');
  beam(
    face,
    [p[0] - w / 2, floor + t - 0.35, p[1]],
    [p[0] + w / 2, floor + t - 0.35, p[1]],
    0.13,
    'metal',
  );
}
function panel(face, h, d, recess = false, slot = 'glass') {
  pane(face, h, d, recess ? -1.15 : 0.06, slot);
  if (d) archBand(face, h, d, 0.18, 'trim', 0.12);
  if (d >= 3 && slot === 'glass') {
    const p = h.center.map((v, k) => v + h.normal[k] * (recess ? -0.97 : 0.2));
    beam(
      face,
      [p[0], h.bottom + 0.15, p[1]],
      [p[0], h.bottom + h.spring - 0.1, p[1]],
      0.16,
      'trim',
    );
  }
}
export function vankBlindNiches() {
  return church.flatMap((_, i) => {
    const f = faceFrame(church, i),
      count = 5;
    return Array.from({ length: count }, (_, j) => ({
      ...hole(
        `church-niche-${i}-${j}`,
        lerp(f.a, f.b, (j + 0.5) / count),
        f.axis,
        f.normal,
        (f.length / count) * 0.77,
        0.6,
        8.8,
        6.0,
        'pointed',
        3,
      ),
      wall: i,
      bay: j,
    }));
  });
}
export function vankChurchWindows() {
  return vankBlindNiches()
    .filter((h) => h.wall !== 0 && h.wall !== 1 && h.bay % 2 === 1)
    .map((h) =>
      hole(`window-${h.name}`, h.center, h.axis, h.normal, 0.7, 2.6, 3.7, 3.1, 'pointed', 4),
    );
}
export function vankChurchDoor() {
  const n = vankBlindNiches().find((h) => h.wall === 0 && h.bay === 2);
  return hole(
    'closed-church-west-door',
    n.center,
    n.axis,
    n.normal,
    1.85,
    0.12,
    4.6,
    3.0,
    'pointed',
    4,
  );
}
export function vankGatePassage() {
  const f = gate
    .map((_, i) => faceFrame(gate, i))
    .filter((f) => f.normal[0] < -0.8)
    .sort((a, b) => b.length - a.length)[0];
  return hole(
    'open-west-gateway',
    lerp(f.a, f.b, 0.5),
    f.axis,
    f.normal,
    3.9,
    0.1,
    5.9,
    4.3,
    'round',
    22,
  );
}
export function vankArcadeStages(d = 3) {
  return [
    {
      name: 'ground-belfry-lower',
      r: belfry,
      base: 0.35,
      top: 8.5,
      spring: 5.3,
      tip: 7.8,
      pier: 0.62,
      slot: 'wall',
    },
    {
      name: 'church-roof-belfry',
      r: R(roofBell, 5.2),
      base: 11.2,
      top: 16.1,
      spring: 14.1,
      tip: 15.5,
      pier: 0.57,
      slot: 'wall',
    },
    {
      name: 'clock-upper-belfry',
      r: R(gateCenter, 3.8),
      base: 21.5,
      top: 23.4,
      spring: 22.5,
      tip: 23.0,
      pier: 0.48,
      slot: 'wall',
    },
    {
      name: 'ground-belfry-upper',
      r: regular(bellCenter, 1.95, d ? 8 : 4, Math.PI / 4),
      base: 10.0,
      top: 14.8,
      spring: 13.3,
      tip: 14.3,
      pier: 0.32,
      slot: 'trim',
    },
    {
      name: 'roof-belfry-upper',
      r: regular(roofBell, 1.22, d ? 8 : 4, Math.PI / 4),
      base: 16.3,
      top: 19.0,
      spring: 18.0,
      tip: 18.6,
      pier: 0.23,
      slot: 'trim',
    },
  ];
}
function arcade(face, r, d) {
  if (d === 0 && (r.name.endsWith('-upper') || r.name === 'clock-upper-belfry')) {
    for (const p of scaled(r.r, 0.86)) solid(face, R(p, r.pier * 1.15), r.base, r.top, r.slot);
    sides(face, r.r, r.top - 0.3, r.top, r.slot);
    cap(face, r.r, r.top, 'roof');
    return;
  }
  const fCount = r.r.length,
    m = d >= 3 ? 8 : d >= 2 ? 6 : d ? 4 : 2,
    c = center(r.r);
  for (let i = 0; i < fCount; i++) {
    const f = faceFrame(r.r, i),
      start = r.pier,
      end = f.length - r.pier,
      width = end - start,
      pt = (u, y, v = 0) => [
        f.a[0] + f.axis[0] * u + f.normal[0] * v,
        floor + y,
        f.a[1] + f.axis[1] * u + f.normal[1] * v,
      ],
      points = Array.from({ length: m + 1 }, (_, j) => {
        const t = j / m;
        return [
          start + width * t,
          r.spring + (r.tip - r.spring) * (1 - Math.pow(Math.abs(1 - 2 * t), 0.7)),
        ];
      });
    for (let j = 1; j < points.length; j++) {
      const [a, y] = points[j - 1],
        [b, z] = points[j];
      for (const v of [0, -r.pier])
        face(
          r.slot,
          [pt(a, y, v), pt(b, z, v), pt(b, r.top, v), pt(a, r.top, v)],
          [f.normal[0] * (v === 0 ? 1 : -1), 0, f.normal[1] * (v === 0 ? 1 : -1)],
        );
      face(r.slot, [pt(a, y, 0), pt(a, y, -r.pier), pt(b, z, -r.pier), pt(b, z, 0)]);
      if (d && r.slot === 'wall')
        face(
          'blue',
          [pt(a, y, 0.045), pt(b, z, 0.045), pt(b, z + 0.16, 0.045), pt(a, y + 0.16, 0.045)],
          [f.normal[0], 0, f.normal[1]],
        );
    }
  }
  // Inset corner posts support both neighboring arches without sealing the bays.
  for (const p of scaled(
    r.r,
    1 - r.pier / Math.max(1, Math.hypot(r.r[0][0] - c[0], r.r[0][1] - c[1])),
  ))
    solid(face, R(p, r.pier * 1.15), r.base, r.top, r.slot);
  cap(face, r.r, r.top, 'roof');
  if (d) band(face, r.r, r.top - 0.12, 0.2, 'trim', 1.03);
}
function flatRange(out, face, d, r, height, windows = [], doors = []) {
  const hs = [...windows, ...doors];
  if (d >= 2) shell(out, d, r, 0.12, height, hs);
  else solid(face, r, 0.12, height, 'wall');
  cap(face, r, height, 'roof');
  if (d) band(face, r, height - 0.12, 0.4, 'trim', 1.01);
  if (d) for (const h of hs) panel(face, h, d, d >= 2, h.name.includes('door') ? 'door' : 'glass');
}
function churchBody(out, face, d) {
  const niches = vankBlindNiches(),
    openings = [...vankChurchWindows(), vankChurchDoor()];
  if (d >= 2) {
    shell(out, d, church, 0.12, 11.2, [...niches, vankChurchDoor()]);
    const maskedFace = writer(
      masked(
        out,
        openings.map((h) => prepareOpening(h, 0, d)),
      ),
      d,
    );
    for (const h of niches) pane(maskedFace, h, d, -0.55, 'wall');
  } else solid(face, church, 0.12, 11.2, 'wall');
  if (d) {
    for (const h of niches) archBand(face, h, d, 0.12, 'wall', 0.06);
    for (const h of openings) panel(face, h, d, d >= 2, h.name.includes('door') ? 'door' : 'glass');
  }
  cap(face, church, 11.2, 'roof');
  if (d) band(face, church, 11.1, 0.7, 'wall', 1.01);
  const count = d >= 4 ? 32 : d >= 3 ? 24 : d >= 2 ? 16 : d ? 12 : 8,
    r = regular(dome, 7.5, count);
  solid(face, r, 11.2, 13.3, 'wall');
  const levels =
    d >= 3
      ? [
          [13.3, 1],
          [14.2, 1.02],
          [15.7, 1.04],
          [17.3, 1.0],
          [19.1, 0.91],
          [21.4, 0.73],
          [23.5, 0.48],
          [25.1, 0.23],
          [26.3, 0.008],
        ]
      : d >= 2
        ? [
            [13.3, 1],
            [15.7, 1.04],
            [19.1, 0.91],
            [21.4, 0.73],
            [23.5, 0.48],
            [26.3, 0.008],
          ]
        : [
            [13.3, 1],
            [16, 1.04],
            [21, 0.76],
            [24, 0.4],
            [26.3, 0.008],
          ];
  profile(face, r, levels, 'wall');
  crossMark(face, dome, 26.3, 27.8, 0.8);
  if (d)
    for (const i of [
      0,
      Math.floor(count / 4),
      Math.floor(count / 2),
      Math.floor((count * 3) / 4),
    ]) {
      const f = faceFrame(r, i),
        h = hole(
          'dome-drum-mark',
          lerp(f.a, f.b, 0.5),
          f.axis,
          f.normal,
          0.7,
          11.8,
          1.1,
          0.6,
          'pointed',
        );
      pane(face, h, d, 0.04, 'glass');
    }
  for (const stage of vankArcadeStages(d).filter(
    (r) => r.name.startsWith('church-') || r.name.startsWith('roof-belfry'),
  )) {
    arcade(face, stage, d);
  }
  solid(face, R(roofBell, 5.35), 16.1, 16.3, 'roof');
  profile(
    face,
    regular(roofBell, 1.53, d ? 8 : 4, Math.PI / 8),
    [
      [19, 1],
      [22.2, 0.015],
    ],
    'wall',
  );
  crossMark(face, roofBell, 22.2, 23.2, 0.65);
}
function groundBell(face, d) {
  solid(face, belfry, 0.08, 0.35, 'trim');
  for (const r of vankArcadeStages(d).filter((r) => r.name.startsWith('ground-')))
    arcade(face, r, d);
  profile(
    face,
    belfry,
    [
      [8.5, 1],
      [10, 0.72],
    ],
    'wall',
  );
  cap(face, regular(bellCenter, 2.2, d ? 8 : 4), 10, 'roof');
  profile(
    face,
    regular(bellCenter, 2.18, d >= 2 ? 12 : d ? 8 : 4, Math.PI / 8),
    [
      [14.8, 1],
      [20.5, 0.01],
    ],
    'wall',
  );
  crossMark(face, bellCenter, 20.5, 21.5, 0.8);
  if (d >= 2) {
    // Sparse pale rails retain the tower's balustrade without individual tiny beads.
    for (const [i] of belfry.entries()) {
      const f = faceFrame(belfry, i),
        pt = (t, y) => [
          f.a[0] + (f.b[0] - f.a[0]) * t - f.normal[0] * 0.18,
          floor + y,
          f.a[1] + (f.b[1] - f.a[1]) * t - f.normal[1] * 0.18,
        ];
      beam(face, pt(0.12, 1.45), pt(0.88, 1.45), 0.17, 'trim');
      const n = d >= 3 ? 9 : 5;
      for (let j = 0; j < n; j++)
        beam(
          face,
          pt(0.15 + (0.7 * j) / (n - 1), 0.6),
          pt(0.15 + (0.7 * j) / (n - 1), 1.45),
          0.15,
          'trim',
        );
    }
  }
}
function disk(face, h, y, r, slot, d, off = 0.1) {
  const p = h.center.map((v, k) => v + h.normal[k] * off),
    n = d >= 3 ? 24 : d >= 2 ? 16 : 8;
  face(
    slot,
    Array.from({ length: n }, (_, i) => {
      const a = (i * 2 * Math.PI) / n;
      return [
        p[0] + h.axis[0] * r * Math.cos(a),
        floor + y + r * Math.sin(a),
        p[1] + h.axis[1] * r * Math.cos(a),
      ];
    }),
    [h.normal[0], 0, h.normal[1]],
  );
}
function gateway(out, face, d) {
  const h = vankGatePassage();
  shell(out, d, gate, 0.12, 7.4, [h]);
  cap(face, gate, 7.4, 'roof');
  if (d) {
    archBand(face, h, d, 0.28, 'trim', 0.1);
    const plaque = {
      ...h,
      name: 'blue-abstract-gate-lunette',
      bottom: floor + 6.2,
      width: 3.7,
      height: 1.7,
      spring: 0.25,
      shape: 'round',
    };
    pane(face, plaque, d, 0.08, 'blue');
    archBand(face, plaque, d, 0.2, 'trim', 0.12);
  }
  const r = R(gateCenter, 4.2);
  solid(face, r, 7.4, 21.5, 'wall');
  if (d) {
    for (const y of [7.5, 13.8, 21.1]) band(face, r, y, 0.3, 'trim', 1.03);
    for (let i = 0; i < r.length; i++) {
      const f = faceFrame(r, i),
        p = lerp(f.a, f.b, 0.5),
        blind = hole(
          'clock-upper-blind-panel',
          p,
          f.axis,
          f.normal,
          3.25,
          14.4,
          6.3,
          4.9,
          'pointed',
        );
      archBand(face, blind, d, 0.16, 'trim', 0.06);
      const lower = { ...blind, bottom: floor + 8.0, height: 5.1, spring: 3.9 };
      archBand(face, lower, d, 0.14, 'wall', 0.055);
      disk(face, blind, 18.4, 0.92, 'trim', d, 0.1);
      disk(face, blind, 18.4, 0.76, 'roof', d, 0.12);
      const pt = (u, y) => [
        p[0] + f.axis[0] * u + f.normal[0] * 0.17,
        floor + 18.4 + y,
        p[1] + f.axis[1] * u + f.normal[1] * 0.17,
      ];
      beam(face, pt(0, 0), pt(0.07, 0.58), 0.09, 'glass');
      beam(face, pt(0, 0), pt(-0.43, -0.17), 0.09, 'glass');
      if (d >= 2)
        for (let j = 0; j < 12; j++) {
          const a = (j * Math.PI) / 6;
          beam(
            face,
            pt(0.6 * Math.cos(a), 0.6 * Math.sin(a)),
            pt(0.7 * Math.cos(a), 0.7 * Math.sin(a)),
            0.07,
            'glass',
          );
        }
    }
  }
  arcade(
    face,
    vankArcadeStages(d).find((r) => r.name === 'clock-upper-belfry'),
    d,
  );
  const roof = R(gateCenter, 4.25);
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    face(
      i % 2 === 0 ? 'metal' : 'roof',
      [at(roof[i], 23.4), at(roof[j], 23.4), at(gateCenter, 27)],
      [0, 1, 0],
    );
  }
  crossMark(face, gateCenter, 27, 28.2, 0.45);
  if (d >= 2) {
    const f = gate
      .map((_, i) => faceFrame(gate, i))
      .filter((f) => f.normal[0] < -0.8)
      .sort((a, b) => b.length - a.length)[0];
    for (const t of [0.12, 0.88]) {
      const p = lerp(f.a, f.b, t).map((v, k) => v + f.normal[k] * 0.15);
      solid(face, regular(p, 0.23, 8), 0.2, 7.0, 'trim');
      band(face, regular(p, 0.34, 8), 6.5, 0.5);
    }
  }
}
export function vankPavilionOpenings() {
  const r = role('northwestPavilion'),
    f = r
      .map((_, i) => faceFrame(r, i))
      .filter((f) => f.normal[1] > 0.9)
      .sort((a, b) => b.length - a.length)[0],
    p = lerp(f.a, f.b, 0.5);
  return [
    hole('closed-pavilion-door', p, f.axis, f.normal, 2.0, 0.15, 4.4, 3.25, 'round'),
    ...[-2.7, 2.7].map((u) =>
      hole(
        `pavilion-window-${u}`,
        p.map((v, k) => v + f.axis[k] * u),
        f.axis,
        f.normal,
        1.7,
        1.7,
        3.3,
        2.35,
        'round',
      ),
    ),
  ];
}
function pavilion(out, face, d) {
  const r = role('northwestPavilion'),
    hs = vankPavilionOpenings();
  flatRange(
    out,
    face,
    d,
    r,
    8.5,
    hs.filter((h) => h.name.includes('window')),
    hs.filter((h) => h.name.includes('door')),
  );
  const h = hs[0],
    f = r.map((_, i) => faceFrame(r, i)).find((f) => f.normal[1] > 0.9),
    p = lerp(f.a, f.b, 0.5),
    pt = (u, y, v = 0.08) => [
      p[0] + h.axis[0] * u + h.normal[0] * v,
      floor + y,
      p[1] + h.axis[1] * u + h.normal[1] * v,
    ];
  face(
    'wall',
    [pt(-f.length / 2, 8.5), pt(f.length / 2, 8.5), pt(0, 11.2)],
    [h.normal[0], 0, h.normal[1]],
  );
  if (d) {
    beam(face, pt(-f.length / 2, 8.65), pt(0, 11.35), 0.25, 'trim');
    beam(face, pt(0, 11.35), pt(f.length / 2, 8.65), 0.25, 'trim');
    const sign = hole('abstract-blue-band', p, h.axis, h.normal, 6.3, 8.1, 0.5, 0.5, 'rect');
    pane(face, sign, d, 0.1, 'blue');
    for (const u of [-2.7, 0, 2.7]) {
      const q = p.map((v, k) => v + h.axis[k] * u),
        rosette = hole('pavilion-rosette', q, h.axis, h.normal, 1.0, 5.65, 1.0, 1.0, 'rect');
      disk(face, rosette, 6.2, 0.57, 'glass', d, 0.12);
    }
    crossMark(face, [p[0], p[1] + 0.2], 9.15, 10.1, 0.7);
    if (d >= 2)
      for (const u of [-f.length * 0.47, f.length * 0.47]) {
        const q = p.map((v, k) => v + h.axis[k] * u + h.normal[k] * 0.18);
        solid(face, regular(q, 0.31, 8), 0.2, 8.5, 'trim');
        band(face, regular(q, 0.46, 8), 8.0, 0.5);
      }
  }
}
export function vankRangeWindows() {
  const hs = [];
  for (const name of ['southRange', 'eastRange', 'museum', 'northwestRange']) {
    const r = role(name),
      top = name === 'museum' ? 10 : 7.5;
    for (let i = 0; i < r.length; i++) {
      const f = faceFrame(r, i);
      if (f.length < 8) continue;
      const inward =
        name === 'southRange'
          ? f.normal[1] < -0.6
          : name === 'eastRange'
            ? f.normal[0] < -0.6
            : f.normal[1] > 0.6;
      if (!inward) continue;
      const n = Math.floor(f.length / 5.4);
      for (let j = 0; j < n; j++)
        hs.push({
          ...hole(
            `${name}-window-${i}-${j}`,
            lerp(f.a, f.b, (j + 0.5) / n),
            f.axis,
            f.normal,
            1.35,
            top === 10 ? 4.8 : 2.1,
            top === 10 ? 3.0 : 2.7,
            top === 10 ? 2.2 : 2.0,
            'round',
          ),
          range: name,
        });
    }
  }
  const inside = (p, r) => {
    let c = false;
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      const a = r[i],
        b = r[j];
      if (
        a[1] > p[1] !== b[1] > p[1] &&
        p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]
      )
        c = !c;
    }
    return c;
  };
  // Shared boundaries are supporting walls, not exposed window facades.
  return hs.filter(
    (h) =>
      !rec.controls.some(
        (b) =>
          b.id !== rec.roles[h.range] &&
          [-0.45, 0, 0.45].some((t) =>
            inside(
              h.center.map((v, k) => v + h.normal[k] * 0.5 + h.axis[k] * h.width * t),
              b.polygons[0].outline,
            ),
          ),
      ),
  );
}
function southVaults(face, d) {
  const r = role('southRange'),
    lo = Math.min(...r.map((p) => p[0])),
    hi = Math.max(...r.map((p) => p[0])),
    width = 7.5,
    n = d >= 4 ? 12 : d >= 3 ? 8 : d >= 2 ? 6 : 2,
    height = (p) => 5.5 + 1.2 * Math.sin(Math.PI * (((p[0] - lo) / width) % 1)),
    cuts = Array.from({ length: Math.ceil(((hi - lo) / width) * n) + 1 }, (_, i) =>
      Math.min(hi, lo + (i * width) / n),
    ),
    clip = (ring, x, gt) => {
      const q = [];
      let a = ring.at(-1),
        va = a[0] - x;
      for (const b of ring) {
        const vb = b[0] - x;
        if (va >= 0 !== vb >= 0) q.push(lerp(a, b, va / (va - vb)));
        if (gt ? vb >= 0 : vb <= 0) q.push(b);
        a = b;
        va = vb;
      }
      return q;
    };
  for (let i = 1; i < cuts.length; i++) {
    const q = clip(clip(r, cuts[i - 1], true), cuts[i], false);
    if (q.length >= 3) cap(face, q, (p) => floor + height(p), 'roof');
  }
  for (let i = 0; i < r.length; i++) {
    const f = faceFrame(r, i),
      ts = [
        0,
        ...cuts
          .filter((x) => x > Math.min(f.a[0], f.b[0]) + 1e-6 && x < Math.max(f.a[0], f.b[0]) - 1e-6)
          .map((x) => (x - f.a[0]) / (f.b[0] - f.a[0])),
        1,
      ].sort((a, b) => a - b);
    for (let j = 1; j < ts.length; j++) {
      const a = lerp(f.a, f.b, ts[j - 1]),
        b = lerp(f.a, f.b, ts[j]);
      face(
        'wall',
        [at(a, 5.5), at(b, 5.5), at(b, (p) => floor + height(p)), at(a, (p) => floor + height(p))],
        [f.normal[0], 0, f.normal[1]],
      );
    }
  }
}
function ranges(out, face, d) {
  const hs = vankRangeWindows();
  for (const n of ['southRange', 'eastRange', 'museum', 'northwestRange'])
    flatRange(
      out,
      face,
      d,
      role(n),
      n === 'museum' ? 10 : n === 'southRange' ? 5.5 : 7.5,
      hs.filter((h) => h.range === n),
    );
  if (d) southVaults(face, d);
  if (d)
    for (const [n, a, b] of [
      ['western-boundary-gap', [-32.7, -13.4], [-31.5, -4.4]],
      ['northwest-boundary', [-32.7, -27.6], [-6.6, -52.4]],
    ]) {
      const axis = unit(b.map((v, k) => v - a[k])),
        normal = [-axis[1], axis[0]],
        r = [a, b, b.map((v, k) => v + normal[k] * 0.4), a.map((v, k) => v + normal[k] * 0.4)];
      solid(face, r, 0.1, 6.5, 'wall');
      if (d >= 2) {
        const count = Math.floor(Math.hypot(b[0] - a[0], b[1] - a[1]) / 4.5);
        for (let i = 0; i < count; i++) {
          const h = hole(
            `${n}-blind`,
            lerp(a, b, (i + 0.5) / count),
            axis,
            normal,
            2.5,
            1.2,
            4.0,
            2.9,
            'pointed',
          );
          archBand(face, h, d, 0.1, 'trim', 0.08);
        }
      }
    }
}
function build(out, d) {
  const stable = {
      addTriangle(slot, ref, points, _n, uv, color) {
        const emit = (q, tex, depth = 0) => {
          q = q.map((p) => p.map(Math.fround));
          const spans = [0, 2].map(
            (k) => Math.max(...q.map((p) => p[k])) - Math.min(...q.map((p) => p[k])),
          );
          if (Math.max(...spans) > (d === 0 ? 48 : d === 1 ? 24 : 16) && depth < 12) {
            const { i, j, k } = [
                [0, 1, 2],
                [1, 2, 0],
                [2, 0, 1],
              ]
                .map(([i, j, k]) => ({
                  i,
                  j,
                  k,
                  len: Math.hypot(q[i][0] - q[j][0], q[i][2] - q[j][2]),
                }))
                .sort((a, b) => b.len - a.len)[0],
              mid = lerp(q[i], q[j], 0.5).map(Math.fround),
              tuv = lerp(tex[i], tex[j], 0.5);
            emit([q[i], mid, q[k]], [tex[i], tuv, tex[k]], depth + 1);
            emit([mid, q[j], q[k]], [tuv, tex[j], tex[k]], depth + 1);
            return;
          }
          if (
            Math.hypot(
              ...cross(
                q[1].map((v, k) => v - q[0][k]),
                q[2].map((v, k) => v - q[0][k]),
              ),
            ) < 1e-9
          )
            return;
          out.addTriangle(slot, ref, q, normalFor(...q), tex, color);
        };
        emit(points, uv);
      },
    },
    face = writer(stable, d);
  for (const b of rec.controls) {
    if (d === 0 && b.id !== rec.roles.belfry && b.id !== rec.roles.gate)
      sides(face, b.polygons[0].outline, footing, 0.12, 'court');
    else solid(face, b.polygons[0].outline, footing, 0.12, 'court');
  }
  for (const p of d === 0
    ? [{ outline: rec.siteOutline, holes: [rec.garden.outline] }]
    : rec.court) {
    sides(face, p.outline, footing, 0.02, 'court');
    cap(face, p.outline, 0.02, 'court', p.holes);
  }
  churchBody(stable, face, d);
  groundBell(face, d);
  gateway(stable, face, d);
  pavilion(stable, face, d);
  ranges(stable, face, d);
}
export const buildVankSkyline = (o) => build(o, 0),
  buildVankDistrict = (o) => build(o, 1),
  buildVankStreet = (o) => build(o, 2),
  buildVankCloseup = (o) => build(o, 3);
const cam = (name, p, look, fov = 48) => ({
  name,
  position: [p[0], floor + p[1], p[2]],
  lookAt: [look[0], floor + look[1], look[2]],
  fov,
});
export const vankStudy = {
  id: 'vank_cathedral',
  key: 'vank_cathedral',
  title: 'Vank Cathedral',
  category: 'cathedral',
  wikidataId: 'Q1398856',
  generationCommand: 'node packages/worldgen/scripts/generate-additional-landmarks.mjs',
  mapFrame: 'map-frame.json',
  fidelityTarget: 'medium-fi',
  build: (o) => build(o, 4),
  surfaceOverrides: scope.surfaceOverrides,
  brief: rec.scope,
  sourceFacts: {
    horizontalBasis:
      'Eight current map building plans around named Vank Cathedral/museum POIs and retained reference coordinate. Signed church-axis fit checked against southwest church/west-gate pictures;exact-QID polygon matching and peripheral building functions remain approximate.',
    architecturalHeights: rec.heightBasis,
  },
  reconstruction: rec,
  scaleBasis: rec.heightBasis,
  refs: read('reference-metadata.json').currentRoundInspection.pictures.map((p) => p.page),
  nativeAxes: frame.nativeAxes,
  sourceDocuments: scope.sourceDocuments,
  sourceLicense:
    'Original geometry under repository license;map geometry ©OpenStreetMap contributors,ODbL-1.0. Linked photographs not redistributed.',
  dataAttribution: '©OpenStreetMap contributors;Protomaps;Mapzen/USGS terrain tiles.',
  sourceNotice:
    'Five existing 256-square running brick,raw limestone,ceramic tile,copper and plain wood graphs. Warm brick church/dome/cones share one graph;stone trim/roofs/paving share limestone. Blue tile and alternating pale/blue metal clock roof supply restrained accents. Flat blue-gray glazing,metric UVs,hard architectural normals,no embedded images.',
  importReason:
    'Four browser levels retain pointed dome,both open belfries,western clock gateway and mapped surrounding ranges/open courtyard at their approximate reviewed position.',
  previewGround: false,
  previewTerrain: scope.previewTerrain,
  mediumFiContext: scope.mediumFiContext,
  geographic: () => scope.geographic,
  geographicNote: scope.geographicNote,
  limitations: [
    rec.heightBasis,
    scope.geographicNote,
    'Individual medium-fi exterior from three useful church/gateway/pavilion pictures and standard PMTiles/DEM. All heights,main dome/drum/roof-belfry positions,blind niches,openings,clock/gate/upper columns,pale rails,peripheral roof/room subdivisions and courtyard/boundary are picture-led estimates. Northwest pavilion uses a library-like facade;its exact map correspondence/function and the other range facades are unverified. Exact Armenian lettering,tile designs/sculpture,full interiors,forecourt statue/fountain and certified walking excluded. Physical device measurements pending.',
    'Skyline preserves principal masses,dome and open belfry/gateway voids with coarse piers/four-column upper stages. District adds shared graphs,flat window/closed-door fields,blue tile borders,clock/pavilion rhythms and eight-column upper stages. Street adds actual church/door/pavilion/range recesses and sparse belfry rails. Closeup/master refine dome/cone facets,clock ticks,mullions and railing cadence. Changes in curved profiles,openings and ornament remain visible.',
  ],
  camera: scope.camera,
  qaCameras: [
    cam('pointed-dome-and-niched-church', [35, 24, 33], [4, 14, -2]),
    cam('open-freestanding-double-belfry', [-36, 16, 29], [-15, 9, 3]),
    cam('open-tiled-roof-belfry', [-27, 25, 12], [-4, 16, -3]),
    cam('western-clock-gateway', [-62, 22, 19], [-28, 14, 3]),
    cam('northwest-pavilion', [-30, 14, 4], [-28, 6, -16]),
    cam('open-courtyard-and-museum', [5, 30, -14], [14, 7, -38]),
  ],
};
