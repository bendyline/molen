/** Original current Haapsalu exterior; mapped controls and section estimates stay distinct. */
import './install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import earcut from 'earcut';
import { cross, normalFor } from './authored-structure-mesh.mjs';
import { openingBuilder, openingReveals, prepareOpening } from './authored-wall-openings.mjs';

const root = new URL(
  '../../../content/worldgen/source/places/ud/ud2/n0309_haapsalu_castle/',
  import.meta.url,
);
const read = (name) => JSON.parse(readFileSync(new URL(name, root)));
const frame = read('map-frame.json'),
  refs = read('reference-metadata.json'),
  means = read('surface-means.json');
const k = frame.controls;
export const haapsaluPalette = {
  stone: '#e4d9c0',
  roof: '#575c62',
  metal: '#41484d',
  plaster: '#e7ded0',
  glass: '#4d6178',
  wood: '#856650',
  paving: '#c4c0b6',
};
export const haapsaluSurfaces = {
  stone: { slot: 'wall', graph: 'stone_limestone_weathered', roughness: 0.95, metallic: 0 },
  roof: { slot: 'roof', graph: 'metal_painted', roughness: 0.78, metallic: 0.1 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.78, metallic: 0.1 },
  plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.91, metallic: 0 },
  wood: { slot: 'trim', graph: 'wood_plain', roughness: 0.87, metallic: 0 },
  paving: { slot: 'foundation', graph: 'gravel', roughness: 0.98, metallic: 0 },
  glass: { slot: 'window', roughness: 0.34, metallic: 0.08 },
};
const linear = (hex) =>
  hex
    .slice(1)
    .match(/../g)
    .map((s) => {
      const v = parseInt(s, 16) / 255;
      return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
const colors = Object.fromEntries(
  Object.entries(haapsaluPalette).map(([key, hex]) => [key, linear(hex)]),
);
const value = (y, p) => (typeof y === 'function' ? y(p) : y);
const area = (p) =>
  p.reduce((s, a, i) => {
    const b = p[(i + 1) % p.length];
    return s + a[0] * b[1] - a[1] * b[0];
  }, 0);
const ccw = (p) => (area(p) < 0 ? [...p].reverse() : p);
export function haapsaluRing(id) {
  const p = frame.geometry.rawFeatures.find((w) => w.id === id).points;
  return Math.hypot(p[0][0] - p.at(-1)[0], p[0][1] - p.at(-1)[1]) < 0.001 ? p.slice(0, -1) : p;
}
export const haapsaluChurchPoint = (u, v) =>
  k.church.origin.map((p, i) => p + k.church.u[i] * u + k.church.v[i] * v);
const rectangle = (u0, u1, v0, v1) =>
  [
    [u0, v0],
    [u1, v0],
    [u1, v1],
    [u0, v1],
  ].map((p) => haapsaluChurchPoint(...p));
function safe(out) {
  return {
    addTriangle(slot, ref, p, _n, uv, color) {
      p = p.map((v) => v.map(Math.fround));
      const n = cross(
        p[1].map((v, i) => v - p[0][i]),
        p[2].map((v, i) => v - p[0][i]),
      );
      if (Math.hypot(...n) >= 1e-9) out.addTriangle(slot, ref, p, normalFor(...p), uv, color);
    },
  };
}
function face(out, polygon, slot, d, target, tint = colors[slot]) {
  let p = polygon.map((q) => q.map(Math.fround));
  for (let i = 1; i < p.length - 1; i++) {
    const n = normalFor(p[0], p[i], p[i + 1]);
    if (Math.hypot(...n) < 0.5) continue;
    if (target && n.reduce((s, x, j) => s + x * target[j], 0) < 0) p = [...p].reverse();
    break;
  }
  const color = d === 0 && means[slot] ? tint.map((v, i) => v * means[slot][i]) : tint;
  for (let i = 1; i < p.length - 1; i++) {
    const t = [p[0], p[i], p[i + 1]],
      n = normalFor(...t);
    if (Math.hypot(...n) < 0.5) continue;
    out.addTriangle(
      slot,
      'palette:#ffffff',
      t,
      n,
      t.map((q) => [q[0], q[2]]),
      color,
    );
  }
}
function cap(out, ring, y, slot, d) {
  const ix = earcut(ring.flat(), null, 2);
  for (let i = 0; i < ix.length; i += 3)
    face(
      out,
      ix.slice(i, i + 3).map((j) => [ring[j][0], value(y, ring[j]), ring[j][1]]),
      slot,
      d,
      [0, 1, 0],
    );
}
function prism(out, ring, lo, hi, slot, d, top = true) {
  ring = ccw(ring);
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length];
    face(
      out,
      [
        [a[0], value(lo, a), a[1]],
        [b[0], value(lo, b), b[1]],
        [b[0], value(hi, b), b[1]],
        [a[0], value(hi, a), a[1]],
      ],
      slot,
      d,
      [b[1] - a[1], 0, a[0] - b[0]],
    );
  }
  if (top) cap(out, ring, hi, slot, d);
}
function strip(a, b, width) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]),
    n = [((-(b[1] - a[1]) / len) * width) / 2, (((b[0] - a[0]) / len) * width) / 2];
  return [
    a.map((v, i) => v + n[i]),
    b.map((v, i) => v + n[i]),
    b.map((v, i) => v - n[i]),
    a.map((v, i) => v - n[i]),
  ];
}
const beam = (out, a, b, lo, hi, width, slot, d) => prism(out, strip(a, b, width), lo, hi, slot, d);
function cut(out, holes) {
  return {
    addTriangle(slot, ref, p, n, uv, c) {
      const overlap = holes.filter(
        (h) =>
          !h.planes.some((pl) =>
            p.every((v) => v.reduce((s, x, i) => s + x * pl[i], pl[3]) <= 1e-7),
          ),
      );
      (overlap.length ? openingBuilder(out, overlap) : out).addTriangle(slot, ref, p, n, uv, c);
    },
  };
}
function blocked(out, ring, lo, hi, d, holes, top = false) {
  prism(cut(out, holes), ring, lo, hi, 'stone', d, top);
  if (d > 0)
    openingReveals(
      {
        addTriangle(_slot, ref, p, n, uv, c) {
          out.addTriangle('stone', ref, p, n, uv, c);
        },
      },
      ring,
      (p) => value(lo, p),
      (p) => value(hi, p),
      holes,
      colors.stone,
    );
}
function pane(out, h, d, slot = 'glass') {
  const p = h.ring.map(([u, v]) => h.point(u, v, 0));
  face(out, p, slot, d, [h.normal[0], 0, h.normal[1]]);
  face(out, [...p].reverse(), slot, d, [-h.normal[0], 0, -h.normal[1]]);
}
export function haapsaluChurchOpenings(d = 3) {
  const holes = [],
    c = k.church;
  const add = (id, u, v, axis, width, bottom, height, depth = 4, paneSlot = 'glass') =>
    holes.push(
      prepareOpening(
        {
          id,
          center: haapsaluChurchPoint(u, v),
          axis,
          width,
          bottom,
          height,
          depth,
          spring: height * 0.72,
          shape: d === 0 ? 'rectangle' : 'pointed',
          paneSlot,
        },
        0,
        d,
      ),
    );
  if (d > 0) {
    for (const u of d === 1 ? [8, 22, 34] : [6, 15, 25, 35]) {
      add(`nave-north-${u}`, u, 0, c.u, 2.3, 7.2, 8.0);
      if (u < 17 || u > 29) add(`nave-south-${u}`, u, c.naveWidth, c.u, 2.3, 7.2, 8.0);
    }
    add('east-gable', c.naveLength, 8.75, c.v, 3.4, 5.3, 11.0);
    add('west-door', 0, 8.75, c.v, 2.5, 0, 4.7, 4, 'wood');
    if (d >= 2) for (const u of [31, 38]) add(`low-vestry-${u}`, u, -6.5, c.u, 1.6, 1.4, 3.2);
  }
  return holes;
}
function gable(out, { u0, u1, v0, v1, eavesY, rise }, d, swapped = false) {
  const convert = (u, v) => haapsaluChurchPoint(...(swapped ? [v, u] : [u, v]));
  const mid = (v0 + v1) / 2,
    pt = (u, v, y) => {
      const p = convert(u, v);
      return [p[0], y, p[1]];
    };
  for (const side of [v0, v1])
    face(
      out,
      [
        pt(u0, side, eavesY),
        pt(u1, side, eavesY),
        pt(u1, mid, eavesY + rise),
        pt(u0, mid, eavesY + rise),
      ],
      'roof',
      d,
      [0, 1, 0],
    );
  for (const u of [u0, u1]) {
    const p = convert(u0, 0),
      q = convert(u1, 0),
      n = [q[0] - p[0], 0, q[1] - p[1]].map((v) => v * (u === u0 ? -1 : 1));
    face(out, [pt(u, v0, eavesY), pt(u, v1, eavesY), pt(u, mid, eavesY + rise)], 'stone', d, n);
  }
}
const circle = (center, r, n) =>
  Array.from({ length: n }, (_, i) => [
    center[0] + r * Math.cos((2 * Math.PI * i) / n),
    center[1] + r * Math.sin((2 * Math.PI * i) / n),
  ]);
function radialRoof(out, center, profile, n, slot, d) {
  for (let j = 1; j < profile.length; j++)
    for (let i = 0; i < n; i++) {
      const a = (2 * Math.PI * i) / n,
        b = (2 * Math.PI * (i + 1)) / n;
      const pt = (level, angle) => [
        center[0] + level[1] * Math.cos(angle),
        level[0],
        center[1] + level[1] * Math.sin(angle),
      ];
      face(
        out,
        [pt(profile[j - 1], a), pt(profile[j - 1], b), pt(profile[j], b), pt(profile[j], a)],
        slot,
        d,
        [Math.cos((a + b) / 2), 0.1, Math.sin((a + b) / 2)],
      );
    }
}
function church(out, d) {
  const c = k.church,
    holes = haapsaluChurchOpenings(d),
    body = rectangle(0, c.naveLength, 0, c.naveWidth);
  blocked(out, body, c.baseY, c.eavesY, d, holes);
  gable(
    out,
    {
      u0: -0.2,
      u1: c.naveLength + 0.2,
      v0: -0.2,
      v1: c.naveWidth + 0.2,
      eavesY: c.eavesY,
      rise: c.ridgeY - c.eavesY,
    },
    d,
  );
  for (const wing of c.vestries) {
    blocked(out, rectangle(wing.u0, wing.u1, wing.v0, wing.v1), 0, wing.eavesY, d, holes);
    const swapped = wing.v1 - wing.v0 > wing.u1 - wing.u0;
    gable(
      out,
      swapped
        ? {
            u0: wing.v0,
            u1: wing.v1,
            v0: wing.u0,
            v1: wing.u1,
            eavesY: wing.eavesY,
            rise: wing.rise,
          }
        : wing,
      d,
      swapped,
    );
  }
  for (const h of holes) pane(out, h, d, h.paneSlot);
  const chapel = c.baptistry,
    n = d === 0 ? 8 : d === 1 ? 12 : 24;
  // The chapel projects from the nave; the shared wall conceals the overlapping attachment.
  prism(out, circle(chapel.center, chapel.radius, n), 0, chapel.eavesY, 'stone', d, false);
  radialRoof(
    out,
    chapel.center,
    [
      [chapel.eavesY, chapel.radius + 0.2],
      [chapel.peakY, 0],
    ],
    n,
    'roof',
    d,
  );
  if (d >= 1)
    for (const angle of [0.25, 1.05, 1.8]) {
      const p = chapel.center.map(
        (v, i) => v + chapel.radius * [Math.cos(angle), Math.sin(angle)][i],
      );
      const h = prepareOpening(
        {
          center: p,
          axis: [-Math.sin(angle), Math.cos(angle)],
          depth: 0.2,
          width: 1.7,
          bottom: 3.1,
          height: 5.8,
          spring: 4.3,
          shape: 'pointed',
        },
        0,
        d,
      );
      const panel = { ...h, point: (u, v, z) => h.point(u, v, z + 0.12) };
      pane(out, panel, d);
    }
}

export function haapsaluMuseumOpenings(d = 3) {
  if (d === 0) return [];
  const m = k.museum,
    holes = [];
  for (let i = 0; i < m.outerPath.length - 1; i++) {
    if (i === 1 || i === 3) continue;
    const a = m.outerPath[i],
      b = m.outerPath[i + 1],
      length = Math.hypot(b[0] - a[0], b[1] - a[1]),
      axis = b.map((v, j) => (v - a[j]) / length);
    const fractions = d === 1 ? [0.5] : length > 20 ? [0.24, 0.5, 0.76] : [0.4, 0.72];
    for (const t of fractions)
      for (const bottom of d === 1 ? [7] : [6.6, 12.4]) {
        if (bottom + 3.2 > Math.min(m.outerTop[i], m.outerTop[i + 1]) - 0.7) continue;
        holes.push(
          prepareOpening(
            {
              id: `museum-${i}-${t}-${bottom}`,
              center: a.map((v, j) => v + (b[j] - v) * t),
              axis,
              depth: 3.7,
              width: 1.5,
              bottom,
              height: 3.2,
              spring: 2.4,
              shape: 'round',
            },
            0,
            d,
          ),
        );
      }
  }
  const a = m.outerPath[2],
    b = m.outerPath[3],
    length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  holes.push(
    prepareOpening(
      {
        id: 'great-west-arch',
        center: a.map((v, i) => v + (b[i] - v) * 0.48),
        axis: b.map((v, i) => (v - a[i]) / length),
        depth: 4,
        width: 4.6,
        bottom: 3.4,
        height: 8.4,
        spring: 5.7,
        shape: d === 1 ? 'rectangle' : 'pointed',
      },
      0,
      d,
    ),
  );
  return holes;
}
function wallPath(out, path, heights, width, lo, d, holes = []) {
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1],
      b = path[i],
      lengthSquared = (b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2;
    const height = (p) =>
      heights[i - 1] +
      ((heights[i] - heights[i - 1]) *
        ((p[0] - a[0]) * (b[0] - a[0]) + (p[1] - a[1]) * (b[1] - a[1]))) /
        lengthSquared;
    blocked(out, strip(a, b, width), lo, height, d, holes, true);
  }
}
function museum(out, d) {
  const m = k.museum,
    holes = haapsaluMuseumOpenings(d),
    ring = haapsaluRing(m.way);
  blocked(out, ring, 0, m.lowTerraceY, d, holes);
  cap(cut(out, holes), ring, m.lowTerraceY, 'paving', d);
  wallPath(out, m.outerPath, m.outerTop, m.outerWidth, m.lowTerraceY, d, holes);
  wallPath(out, m.innerPath, m.innerTop, m.innerWidth, m.lowTerraceY, d, holes);
  // Separate exposed room partitions, not a solid upper U-shaped block.
  if (d >= 1)
    for (const z of m.partitionRows) {
      const a = [-6 + 0.2 * (-z - 27), z],
        b = [2 + 0.2 * (-z - 27), z + 1.7];
      beam(out, a, b, m.lowTerraceY, m.lowTerraceY + 3.8, 1.0, 'stone', d);
    }
  // Original slender surviving chimney behind the clock tower.
  prism(out, rectangle(11, 12.4, -39.5, -37.9), 0, 26.4, 'stone', d);
  cap(out, k.courtRing, k.courtY, 'paving', d);
  if (d >= 2) {
    const p = [29, -41],
      q = [26.9, -31.5];
    beam(out, p, q, 0, 8.6, 1.4, 'plaster', d);
  }
}
function disc(out, center, normal, r, y, slot, d) {
  const axis = [-normal[1], normal[0]],
    points = [];
  const n = d === 1 ? 8 : 12;
  for (let i = 0; i < n; i++) {
    const a = (i * 2 * Math.PI) / n;
    points.push([
      center[0] + axis[0] * r * Math.cos(a),
      y + r * Math.sin(a),
      center[1] + axis[1] * r * Math.cos(a),
    ]);
  }
  face(out, points, slot, d, [normal[0], 0, normal[1]]);
}
function clockTower(out, d) {
  const t = k.clockTower,
    n = d === 0 ? 8 : d === 1 ? 16 : 24;
  prism(out, circle(t.center, t.radius, n), 0, t.bodyY, 'stone', d, false);
  radialRoof(out, t.center, t.roofProfile, n, 'roof', d);
  if (d >= 1)
    for (const a of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
      const normal = [Math.cos(a), Math.sin(a)],
        p = t.center.map((v, i) => v + normal[i] * (t.radius + 0.03));
      const h = prepareOpening(
        {
          center: p,
          axis: [-normal[1], normal[0]],
          depth: 0.2,
          width: 1.25,
          bottom: 22.8,
          height: 2.7,
          spring: 2.1,
          shape: 'round',
        },
        0,
        d,
      );
      pane(out, { ...h, point: (u, v, z) => h.point(u, v, z + 0.03) }, d, 'wood');
    }
  if (d >= 2) {
    const normal = [0.98, 0.199],
      point = t.center.map((v, i) => v + normal[i] * (t.radius + 0.1));
    disc(out, point, normal, 0.78, 19.8, 'plaster', d);
    disc(
      out,
      point.map((v, i) => v + normal[i] * 0.012),
      normal,
      0.63,
      19.8,
      'glass',
      d,
    );
    const axis = [-normal[1], normal[0]],
      pt = (u, y) => [
        point[0] + axis[0] * u + normal[0] * 0.025,
        y,
        point[1] + axis[1] * u + normal[1] * 0.025,
      ];
    face(
      out,
      [pt(-0.075, 19.73), pt(0.48, 19.73), pt(0.48, 19.88), pt(-0.075, 19.88)],
      'plaster',
      d,
      [normal[0], 0, normal[1]],
    );
    face(
      out,
      [pt(-0.075, 19.75), pt(0.075, 19.75), pt(0.075, 20.29), pt(-0.075, 20.29)],
      'plaster',
      d,
      [normal[0], 0, normal[1]],
    );
  }
}
function simplify(p, tolerance) {
  if (p.length < 3) return p;
  const a = p[0],
    b = p.at(-1),
    dx = b[0] - a[0],
    dz = b[1] - a[1],
    l = dx * dx + dz * dz;
  let largest = -1,
    index = -1;
  for (let i = 1; i < p.length - 1; i++) {
    const t = l ? Math.max(0, Math.min(1, ((p[i][0] - a[0]) * dx + (p[i][1] - a[1]) * dz) / l)) : 0;
    const distance = Math.hypot(p[i][0] - a[0] - t * dx, p[i][1] - a[1] - t * dz);
    if (distance > largest) {
      largest = distance;
      index = i;
    }
  }
  return largest > tolerance
    ? [
        ...simplify(p.slice(0, index + 1), tolerance).slice(0, -1),
        ...simplify(p.slice(index), tolerance),
      ]
    : [a, b];
}
function hollow(out, ring, lo, hi, d) {
  ring = ccw(ring);
  const center = ring.reduce((s, p) => s.map((v, i) => v + p[i] / ring.length), [0, 0]);
  const inside = ring.map((p) => p.map((v, i) => center[i] + 0.68 * (v - center[i])));
  for (let i = 0; i < ring.length; i++) {
    const j = (i + 1) % ring.length,
      a = ring[i],
      b = ring[j],
      c = inside[i],
      e = inside[j];
    face(
      out,
      [
        [a[0], lo, a[1]],
        [b[0], lo, b[1]],
        [b[0], hi, b[1]],
        [a[0], hi, a[1]],
      ],
      'stone',
      d,
      [b[1] - a[1], 0, a[0] - b[0]],
    );
    face(
      out,
      [
        [c[0], lo, c[1]],
        [e[0], lo, e[1]],
        [e[0], hi, e[1]],
        [c[0], hi, c[1]],
      ],
      'stone',
      d,
      [c[1] - e[1], 0, e[0] - c[0]],
    );
    face(
      out,
      [
        [a[0], hi, a[1]],
        [b[0], hi, b[1]],
        [e[0], hi, e[1]],
        [c[0], hi, c[1]],
      ],
      'stone',
      d,
      [0, 1, 0],
    );
  }
}
function curtain(out, d) {
  for (const id of k.curtain.ways) {
    const raw = frame.geometry.rawFeatures.find((w) => w.id === id).points,
      path = d === 0 ? simplify(raw, 1.4) : raw;
    const heights = path.map((p) => (p[1] < -40 ? 8.4 : p[0] < -90 ? 7.3 : 6.8));
    wallPath(out, path, heights, k.curtain.width, 0, d);
  }
  const t = k.defensiveTowers;
  let round = haapsaluRing(t.roundWay);
  if (d === 0) round = round.filter((_, i) => i % 3 === 0);
  prism(out, round, 0, 4.5, 'stone', d);
  hollow(out, round, 4.5, t.roundTopY, d);
  const square = haapsaluRing(t.squareWay);
  prism(out, square, 0, 3, 'stone', d);
  hollow(out, square, 3, t.squareTopY, d);
}
function flights(out, d) {
  for (const path of k.walks)
    for (let i = 1; i < path.length; i++) {
      const [ax, az, ay] = path[i - 1],
        [bx, bz, by] = path[i],
        a = [ax, az],
        b = [bx, bz];
      const length = Math.hypot(bx - ax, bz - az),
        axis = [(bx - ax) / length, (bz - az) / length],
        normal = [-axis[1], axis[0]];
      const y = (p) => ay + ((by - ay) * ((p[0] - ax) * axis[0] + (p[1] - az) * axis[1])) / length;
      prism(
        out,
        strip(a, b, 1.8),
        (p) => y(p) - 0.25,
        y,
        'metal',
        d,
        d < 2 || Math.abs(by - ay) < 0.1,
      );
      if (d >= 2 && Math.abs(by - ay) > 0.1) {
        const steps = Math.ceil(Math.abs(by - ay) / 0.2);
        for (let j = 0; j < steps; j++) {
          const p = a.map((v, c) => v + ((b[c] - v) * j) / steps),
            q = a.map((v, c) => v + ((b[c] - v) * (j + 1)) / steps),
            height = ay + ((by - ay) * (j + 1)) / steps;
          cap(out, strip(p, q, 1.8), height, 'metal', d);
          const left = p.map((v, c) => v + normal[c] * 0.9),
            right = p.map((v, c) => v - normal[c] * 0.9);
          face(
            out,
            [
              [left[0], height, left[1]],
              [right[0], height, right[1]],
              [right[0], ay + ((by - ay) * j) / steps, right[1]],
              [left[0], ay + ((by - ay) * j) / steps, left[1]],
            ],
            'metal',
            d,
            [-axis[0], 0, -axis[1]],
          );
        }
      }
      if (d >= 1)
        for (const side of [-1, 1]) {
          const p = a.map((v, c) => v + normal[c] * side * 0.89),
            q = b.map((v, c) => v + normal[c] * side * 0.89);
          prism(out, strip(p, q, 0.14), y, (p) => y(p) + 1.05, 'metal', d);
        }
    }
}
function pavilion(out, d) {
  const p = k.pavilion;
  prism(out, p.ring, p.baseY, p.roofY, 'metal', d);
  if (d >= 1) {
    const a = p.ring[0],
      b = p.ring[1],
      dx = b[0] - a[0],
      dz = b[1] - a[1],
      length = Math.hypot(dx, dz),
      n = [dz / length, -dx / length];
    const points = [a, b].map((q) => q.map((v, i) => v + n[i] * 0.03));
    face(
      out,
      [
        [points[0][0], 0.3, points[0][1]],
        [points[1][0], 0.3, points[1][1]],
        [points[1][0], 3.7, points[1][1]],
        [points[0][0], 3.7, points[0][1]],
      ],
      'glass',
      d,
      [n[0], 0, n[1]],
    );
  }
}
export const haapsaluParts = { church, museum, clockTower, curtain, flights, pavilion };
export function buildHaapsaluRuntime(out, level = 'closeup') {
  const d = { skyline: 0, district: 1, street: 2, closeup: 3 }[level] ?? 3,
    o = safe(out);
  for (const part of Object.values(haapsaluParts)) part(o, d);
}
export const buildHaapsaluSkyline = (out) => buildHaapsaluRuntime(out, 'skyline');
export const haapsaluStudy = {
  id: 'N0309',
  key: 'haapsalu_castle',
  title: 'Haapsalu Castle',
  category: 'castle',
  wikidataId: 'Q866154',
  mapFrame: 'map-frame.json',
  fidelityTarget: 'medium-fi',
  build: (out) => buildHaapsaluRuntime(out),
  surfaceOverrides: haapsaluSurfaces,
  brief:
    'Current Haapsalu: roofed cathedral, circular baptismal chapel and lower side roofs, tall round clock tower with curved cone, roofless U-shaped main-castle upper rooms, black modern pavilion/folded stairs and mapped curtain/tower remains.',
  appearance: {
    standard: 'docs-src/guide/medium-fi.md',
    paletteSrgb: haapsaluPalette,
    colorEncoding: 'sRGB decoded to linear COLOR_0',
    flatSurfaceMeansLinear: means,
    materialBudget: 7,
    identityFeatures: [
      'Roofed nave with round projecting baptismal chapel',
      'Tall round clock tower and curved pointed roof beside roofless upper castle',
      'Open mapped ring-wall enclosure and black folded contemporary stairways',
    ],
  },
  sourceFacts: {
    exactIdentityNode: 687056785,
    cathedralWay: 106803938,
    cathedralWikidata: 'Q16412871',
    museumWay: 112303709,
    publishedDimensions: refs.publishedDimensions,
    heightScope:
      'Mapped38m belongs to the museum envelope containing the tower; surviving wing profiles are independent original section estimates.',
  },
  reconstruction: frame.reconstruction,
  scaleBasis: k.basis,
  refs: refs.references.map((r) => r.url),
  sourceDocuments: ['map-frame.json', 'reference-metadata.json', 'surface-means.json'],
  nativeAxes: frame.nativeAxes,
  sourceLicense:
    'Original exterior geometry under repository license; map-derived numeric controls © OpenStreetMap contributors, ODbL-1.0. Primary publications and private photo/drawing references attributed, not redistributed.',
  sourceNotice:
    'Five existing shared256-square weathered limestone, painted metal, lime plaster, timber and gravel graphs; metric repeats and linear tint. Glass stays flat. No unique or embedded texture or borrowed mesh.',
  dataAttribution:
    '© OpenStreetMap contributors; Foundation of Haapsalu and Läänemaa Museums; LUMIA/KAOS and credited photographers Tõnu Tunnel and Vendo Jugapuu.',
  geographic: () => ({
    status: 'draft',
    replaceFootprint: false,
    groundModelY: 0,
    reviewStatus:
      'Inactive current-exterior proposal; matching map footprints retained. Actual city ground/terrace contacts, ruin profiles and complete facade fit pending.',
  }),
  geographicNote:
    'Native+X east,+Z south, heading0. Exact castle identity node and separate named physical footprints; no exact-QID area or certified ground datum claimed.',
  limitations: refs.limitations,
  importReason:
    'Preserve current cathedral/tower/open upper ruin and modern stair identity through four authored browser levels without extruding the38m mapper envelope.',
  mediumFiContext: { scale: '1', neighborStyle: 'molen.worldgen.catalog.swedish_cottage' },
  camera: { position: [-235, 189, 240], lookAt: [10, 11, 4], fov: 42 },
  qaCameras: [
    { name: 'clock-and-west-wing', position: [-81, 47, -59], lookAt: [-2, 18, -27] },
    { name: 'cathedral-and-baptistry', position: [71, 41, 48], lookAt: [7, 13, 8] },
    { name: 'open-court-and-folded-stairs', position: [43, 34, -8], lookAt: [8, 11, -30] },
    { name: 'outer-enclosure-and-towers', position: [177, 94, 173], lookAt: [14, 9, 20] },
    { name: 'clock-tower-detail', position: [-43, 33, -42], lookAt: [-13, 23, -32] },
    { name: 'northwest-wall-gap', position: [-65, 18, -119], lookAt: [-54, 5, -73] },
    { name: 'east-ruin-and-entrance', position: [72, 25, -37], lookAt: [26, 12, -36] },
  ],
};
