/** Dunnottar: individually mapped roofless ranges, tower house, cliff and entrance. */
import './install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import earcut from 'earcut';
import { cross, normalFor } from './authored-structure-mesh.mjs';
import { openingBuilder, openingReveals, prepareOpening } from './authored-wall-openings.mjs';

const source = new URL(
    '../../../content/worldgen/source/places/gf/gfn/dunnottar_castle/',
    import.meta.url,
  ),
  read = (name) => JSON.parse(readFileSync(new URL(name, source)));
const frame = read('map-frame.json'),
  fit = read('pmtiles-fit.json'),
  scope = read('review-scope.json'),
  means = read('surface-means.json'),
  floor = frame.reconstruction.plateauY;
const palette = {
  stone: '#c6bca8',
  trim: '#ded0b7',
  rock: '#b6aba0',
  paving: '#bdb5a1',
  grass: '#79a557',
  water: '#286d83',
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
const at = (p, y) => [p[0], typeof y === 'function' ? y(p) : y, p[1]],
  lerp = (a, b, t) => a.map((v, k) => v + (b[k] - v) * t),
  unit = (v) => {
    const n = Math.hypot(...v);
    return v.map((x) => x / n);
  };
const sign = (r) =>
  Math.sign(
    r.reduce((n, a, i) => {
      const b = r[(i + 1) % r.length];
      return n + a[0] * b[1] - b[0] * a[1];
    }, 0),
  );
export function dunnottarGround(x, z) {
  const c = Math.cos(frame.heading),
    s = Math.sin(frame.heading);
  [x, z] = [x * c + z * s, -x * s + z * c];
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw Error('Linlithgow footing outside retained DEM');
  const i = Math.floor(u),
    j = Math.floor(v),
    a = u - i,
    b = v - j,
    k = j * g.width + i,
    h = g.heights;
  return (
    (h[k] * (1 - a) + h[k + 1] * a) * (1 - b) +
    (h[k + g.width] * (1 - a) + h[k + g.width + 1] * a) * b -
    fit.datumMeters
  );
}
function writer(out, d) {
  return (slot, polygon, direction) => {
    let p = polygon.map((v) => v.map(Math.fround));
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
function simplify(r, tol) {
  if (!tol) return r;
  const p = [...r];
  for (let pass = 0; pass < 3; pass++)
    for (let i = 0; i < p.length && p.length > 4; i++) {
      const a = p[(i + p.length - 1) % p.length],
        b = p[i],
        q = p[(i + 1) % p.length],
        dx = q[0] - a[0],
        dz = q[1] - a[1],
        len = Math.hypot(dx, dz),
        along = len ? ((b[0] - a[0]) * dx + (b[1] - a[1]) * dz) / (len * len) : 0,
        dist = len ? Math.abs((b[0] - a[0]) * dz - (b[1] - a[1]) * dx) / len : 0;
      if (dist <= tol && along >= 0 && along <= 1) {
        p.splice(i, 1);
        i--;
      }
    }
  return p;
}
function cap(face, r, y, slot, holes = []) {
  const p = [...r, ...holes.flat()],
    starts = [];
  let offset = r.length;
  for (const h of holes) {
    starts.push(offset);
    offset += h.length;
  }
  const ids = earcut(p.flat(), starts, 2);
  for (let i = 0; i < ids.length; i += 3)
    face(
      slot,
      ids.slice(i, i + 3).map((k) => at(p[k], y)),
      [0, 1, 0],
    );
}
function sides(face, r, b, t, slot, inward = false) {
  const s = sign(r) * (inward ? -1 : 1);
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      q = r[(i + 1) % r.length];
    face(slot, [at(a, b), at(q, b), at(q, t), at(a, t)], [(q[1] - a[1]) * s, 0, (a[0] - q[0]) * s]);
  }
}
function solid(face, r, b, t, slot) {
  sides(face, r, b, t, slot);
  cap(face, r, t, slot);
}
function offsetRing(r, width, inward = true) {
  const s = sign(r) * (inward ? 1 : -1);
  return r.map((p, i) => {
    const a = unit(p.map((v, k) => v - r[(i + r.length - 1) % r.length][k])),
      b = unit(r[(i + 1) % r.length].map((v, k) => v - p[k])),
      n = [-a[1] * s, a[0] * s],
      m = [-b[1] * s, b[0] * s],
      den = Math.max(0.3, 1 + n[0] * m[0] + n[1] * m[1]);
    return p.map(
      (v, k) => v + Math.max(-2 * width, Math.min(2 * width, (width * (n[k] + m[k])) / den)),
    );
  });
}
function nearby(h, r) {
  const n = [-h.axis[1], h.axis[0]],
    ext = [0, 1].map(
      (k) => (Math.abs(h.axis[k]) * h.width) / 2 + (Math.abs(n[k]) * h.depth) / 2 + 0.15,
    );
  return [0, 1].every(
    (k) =>
      Math.min(...r.map((p) => p[k])) <= h.center[k] + ext[k] &&
      Math.max(...r.map((p) => p[k])) >= h.center[k] - ext[k],
  );
}
function masonry(out, d, r, b, t, holes = [], slot = 'stone', joined = false) {
  const hs = holes.filter((h) => nearby(h, r)).map((h) => prepareOpening(h, 0, d)),
    face = writer(openingBuilder(out, hs), d);
  if (joined) {
    // Closed wall loops share their short ends; do not upload coincident caps.
    const s = sign(r);
    for (const i of [0, 2]) {
      const a = r[i],
        q = r[i + 1];
      face(
        slot,
        [at(a, b), at(q, b), at(q, t), at(a, t)],
        [(q[1] - a[1]) * s, 0, (a[0] - q[0]) * s],
      );
    }
  } else sides(face, r, b, t, slot);
  cap(face, r, t, slot);
  openingReveals(
    {
      addTriangle(_slot, ref, p, n, uv, c) {
        out.addTriangle(slot, ref, p, n, uv, c);
      },
    },
    r,
    (p) => (typeof b === 'function' ? b(p) : b),
    (p) => (typeof t === 'function' ? t(p) : t),
    hs,
    d === 0 ? colors[slot].map((v, k) => v * means[slot][k]) : colors[slot],
  );
}
function wallLoop(out, d, r, width, inward, b, t, holes) {
  const inner = offsetRing(r, width, inward);
  if (!d && !holes.length) {
    const face = writer(out, d);
    sides(face, r, b, t, 'stone');
    sides(face, inner, b, t, 'stone', true);
    cap(face, r, t, 'stone', [inner]);
    return inner;
  }
  for (let i = 0; i < r.length; i++) {
    const j = (i + 1) % r.length;
    masonry(out, d, [r[i], r[j], inner[j], inner[i]], b, t, holes, 'stone', true);
  }
  return inner;
}
function band(face, a, b, w, y, slot, depth = 0) {
  const u = unit(b.map((v, k) => v - a[k])),
    n = [-u[1], u[0]],
    r = [
      a.map((v, k) => v - (n[k] * w) / 2),
      b.map((v, k) => v - (n[k] * w) / 2),
      b.map((v, k) => v + (n[k] * w) / 2),
      a.map((v, k) => v + (n[k] * w) / 2),
    ];
  if (depth) solid(face, r, (p) => (typeof y === 'function' ? y(p) : y) - depth, y, slot);
  else cap(face, r, y, slot);
}

const approach = frame.reconstruction.approach;
const length = (a, b) => Math.hypot(...b.map((v, k) => v - a[k]));
const totalApproach = approach.points
  .slice(1)
  .reduce((sum, p, i) => sum + length(approach.points[i], p), 0);
function inside(p, r) {
  let result = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++)
    if (
      r[i][1] > p[1] !== r[j][1] > p[1] &&
      p[0] < ((r[j][0] - r[i][0]) * (p[1] - r[i][1])) / (r[j][1] - r[i][1]) + r[i][0]
    )
      result = !result;
  return result;
}
function boundaryDistance(p, r) {
  return Math.min(
    ...r.map((a, i) => {
      const b = r[(i + 1) % r.length],
        v = b.map((v, k) => v - a[k]),
        t = Math.max(
          0,
          Math.min(1, ((p[0] - a[0]) * v[0] + (p[1] - a[1]) * v[1]) / (v[0] * v[0] + v[1] * v[1])),
        );
      return Math.hypot(...p.map((v, k) => v - a[k] - t * (b[k] - a[k])));
    }),
  );
}
export const dunnottarApertures = [];
export const dunnottarApproachHoles = [];
function remember(h, d) {
  if (d >= 3 && !dunnottarApertures.some((q) => q.name === h.name)) dunnottarApertures.push(h);
  return h;
}
function wallSegment(out, d, a, b, w, bottom, top, holes = []) {
  const u = unit(b.map((v, k) => v - a[k])),
    n = [-u[1], u[0]],
    r = [
      a.map((v, k) => v - (n[k] * w) / 2),
      b.map((v, k) => v - (n[k] * w) / 2),
      b.map((v, k) => v + (n[k] * w) / 2),
      a.map((v, k) => v + (n[k] * w) / 2),
    ];
  masonry(out, d, r, bottom, top, holes);
}
function approachVolumes(d) {
  let distance = 0;
  return approach.points.slice(1).map((b, i) => {
    const a = approach.points[i],
      len = length(a, b),
      y = approach.startY + ((approach.endY - approach.startY) * distance) / totalApproach;
    distance += len;
    const top = approach.startY + ((approach.endY - approach.startY) * distance) / totalApproach,
      u = unit(b.map((v, k) => v - a[k])),
      h = {
        name: `approach-flight-${i}`,
        center: a.map((v, k) => (v + b[k]) / 2),
        axis: [-u[1], u[0]],
        width: approach.width + 0.45,
        bottom: y - 0.03,
        height: 35 - y,
        depth: len + 0.18,
        shape: 'rectangle',
      };
    if (d >= 3 && !dunnottarApproachHoles.some((q) => q.name === h.name))
      dunnottarApproachHoles.push({ ...h, start: a, end: b, startY: y, endY: top });
    return prepareOpening(h, 0, d);
  });
}
function avoidVolumes(out, volumes) {
  return {
    addTriangle(slot, ref, points, ...attributes) {
      const hits = volumes.filter(
        (h) =>
          !h.planes.some((plane) =>
            points.every((p) => p.reduce((n, v, k) => n + v * plane[k], plane[3]) < -1e-7),
          ),
      );
      openingBuilder(out, hits).addTriangle(slot, ref, points, ...attributes);
    },
  };
}
function cliff(out, d, volumes) {
  const face = writer(avoidVolumes(out, volumes), d),
    r = simplify(frame.geometry.outline, d === 0 ? 6 : d === 1 ? 2.6 : d === 2 ? 1.3 : 0.7);
  cap(face, r, floor - 0.12, 'grass', [simplify(frame.reconstruction.basin.ring, d ? 0.12 : 1)]);
  const rim = r.map((p) =>
      p.map(
        (v, k) => v + (k === 0 ? Math.sin(p[1] * 0.09) : Math.cos(p[0] * 0.08)) * (d ? 1.1 : 0),
      ),
    ),
    shoulder = r.map((p) =>
      p.map((v, k) => v + (k === 0 ? Math.sin(p[1] * 0.14) : Math.cos(p[0] * 0.1)) * (d ? 2 : 0)),
    );
  for (let i = 0; i < r.length; i++) {
    const j = (i + 1) % r.length,
      a = r[i],
      b = r[j],
      middle = (p) => floor - 3.4 + (d ? Math.sin(p[0] * 0.1 + p[1] * 0.05) * 1.15 : 0),
      foot = (p) => Math.min(middle(p) - 0.8, dunnottarGround(...p) - 0.5);
    face(
      'rock',
      [at(a, floor - 0.14), at(b, floor - 0.14), at(rim[j], middle), at(rim[i], middle)],
      [(b[1] - a[1]) * sign(r), 0.3, (a[0] - b[0]) * sign(r)],
    );
    face(
      'rock',
      [at(rim[i], middle), at(rim[j], middle), at(shoulder[j], foot), at(shoulder[i], foot)],
      [(b[1] - a[1]) * sign(r), 0.3, (a[0] - b[0]) * sign(r)],
    );
  }
  if (d)
    openingReveals(
      {
        addTriangle(_slot, ...args) {
          out.addTriangle('rock', ...args);
        },
      },
      r,
      (p) => Math.min(floor - 1, dunnottarGround(...p) - 0.5),
      () => floor - 0.12,
      [prepareOpening(secondaryGate, 0, d)],
      colors.rock,
    );
}
const mainGateLine = [
  [-66.4, -44.25],
  [-64.04, -37.74],
];
const mainGate = {
  name: 'mapped-gate-barracks-tunnel',
  center: mainGateLine[0].map((v, k) => (v + mainGateLine[1][k]) / 2),
  axis: unit([-(mainGateLine[1][1] - mainGateLine[0][1]), mainGateLine[1][0] - mainGateLine[0][0]]),
  width: 3.0,
  bottom: 10,
  height: 4.4,
  spring: 3.1,
  depth: 15,
  shape: 'round',
};
const secondaryGate = {
  name: 'mapped-west-gate',
  center: [-77.0, -34.6],
  axis: unit([-4.58, 1.89]),
  width: 2.8,
  bottom: 14,
  height: 3.8,
  spring: 2.5,
  depth: 8,
  shape: 'round',
};
function shell(out, d, f, volumes, allHoles, collectOnly = false) {
  const face = writer(out, d),
    r = simplify(f.polygons[0].outline, d === 0 ? 0.55 : 0.035),
    keep = f.role === 'tower-house',
    palace = f.role.startsWith('palace'),
    width = keep ? 1.75 : palace ? 0.95 : 0.85,
    top = floor + f.height,
    base = f.role === 'gate-barracks' ? 10 : f.role === 'west-gate' ? 14 : floor,
    holes = [];
  if (f.role === 'gate-barracks') holes.push(remember(mainGate, d));
  if (f.role === 'west-gate') holes.push(remember(secondaryGate, d));
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      len = length(a, b),
      u = unit(b.map((v, k) => v - a[k]));
    if (d === 0 || len < 3.2) continue;
    const bays = Math.max(1, Math.floor(len / (d === 1 ? 18 : d === 2 ? 6.5 : 5.1))),
      rows = keep
        ? d === 1
          ? [12]
          : d === 2
            ? [4.5, 15.5]
            : [4.5, 10, 15.5]
        : d === 1
          ? [Math.min(4, f.height - 3)]
          : [2.2, Math.min(6.3, f.height - 2.4)];
    if (!keep && !palace && d === 1) continue;
    for (let j = 0; j < bays; j++)
      for (const y of [...new Set(rows)]) {
        if (y < 0.5 || y + 1.8 > f.height - 0.6) continue;
        const p = lerp(a, b, (j + 0.5) / bays),
          h = {
            name: `${f.role}-${f.id}-${i}-${j}-${y}`,
            center: p,
            axis: u,
            width: keep ? 0.8 : palace ? 1.15 : 0.75,
            bottom: floor + y,
            height: keep ? 1.6 : 1.9,
            spring: 1.35,
            depth: width + 1.3,
            shape: palace && y < 3 ? 'round' : 'rectangle',
          };
        // Give a shared facade one window rhythm. Separate overlapping map
        // parts must not punch competing holes into the same strip of masonry.
        if (
          frame.reconstruction.components.some(
            (other, index) =>
              other !== f &&
              (inside(p, other.polygons[0].outline) ||
                (index < frame.reconstruction.components.indexOf(f) &&
                  boundaryDistance(p, other.polygons[0].outline) < 1.4)),
          )
        )
          continue;
        if (holes.some((g) => Math.hypot(...p.map((v, k) => v - g.center[k])) < 3)) continue;
        holes.push(remember(h, d));
      }
  }
  if (collectOnly) return holes;
  const mass = avoidVolumes(out, volumes);
  // Neighboring ruin polygons meet at several facades. Their common aperture
  // set prevents a second shell from plugging an authored window or doorway.
  wallLoop(out, d, r, width, true, base - 0.08, top, allHoles ?? holes);
  if (d) cap(writer(mass, d), r, base - 0.04, 'paving');
  if (keep) {
    for (let i = 0; i < r.length; i++) {
      const a = r[i],
        b = r[(i + 1) % r.length];
      if (d >= 1) band(face, a, b, 0.75, top + 0.7, 'trim', 0.7);
      if (d >= 2) {
        const bays = Math.max(1, Math.floor(length(a, b) / 3.8));
        for (let j = 0; j < bays; j++)
          band(
            face,
            lerp(a, b, j / bays),
            lerp(a, b, (j + 0.46) / bays),
            0.8,
            top + 1.6,
            'stone',
            0.9,
          );
      }
    }
  } else if (palace && d >= 1) {
    for (let i = 0; i < r.length; i++) {
      const a = r[i],
        b = r[(i + 1) % r.length],
        len = length(a, b);
      if (len < 12) continue;
      const bays = Math.max(1, Math.floor(len / (d === 1 ? 17 : 7.2)));
      for (let j = 0; j < bays; j++) {
        const p = lerp(a, b, (j + 0.5) / bays),
          u = unit(b.map((v, k) => v - a[k])),
          n = [-u[1] * sign(r), u[0] * sign(r)],
          w = d === 1 ? 0.7 : 1.05,
          chimney = [
            p.map((v, k) => v - (u[k] * w) / 2 - n[k] * 0.4),
            p.map((v, k) => v + (u[k] * w) / 2 - n[k] * 0.4),
            p.map((v, k) => v + (u[k] * w) / 2 + n[k] * 0.4),
            p.map((v, k) => v - (u[k] * w) / 2 + n[k] * 0.4),
          ];
        solid(face, chimney, top - 0.2, top + 2.8 + (j % 2) * 1.1, 'stone');
      }
    }
  }
  if (!keep && (palace || f.role === 'chapel' || f.role === 'stables-range')) {
    const edges = r.map((a, i) => ({
        a,
        b: r[(i + 1) % r.length],
        len: length(a, r[(i + 1) % r.length]),
      })),
      long = edges.toSorted((a, b) => b.len - a.len)[0],
      u = unit(long.b.map((v, k) => v - long.a[k]));
    for (const { a, b, len } of edges
      .filter(
        (e) =>
          e.len > 3.5 &&
          e.len < 12 &&
          Math.abs(unit(e.b.map((v, k) => v - e.a[k])).reduce((n, v, k) => n + v * u[k], 0)) < 0.4,
      )
      .slice(0, d === 0 ? 2 : 4)) {
      const p = lerp(a, b, 0.5),
        rise = Math.min(2.7, len * 0.36),
        normal = unit([b[1] - a[1], a[0] - b[0]]).map((v) => v * sign(r));
      face('stone', [at(a, top), at(b, top), at(p, top + rise)], [normal[0], 0, normal[1]]);
      face('stone', [at(b, top), at(a, top), at(p, top + rise)], [-normal[0], 0, -normal[1]]);
    }
  }
}
function stairs(out, d) {
  if (!d) return;
  const face = writer(out, d),
    cutFace = writer(
      avoidVolumes(out, [prepareOpening(mainGate, 0, d), prepareOpening(secondaryGate, 0, d)]),
      d,
    );
  for (const h of dunnottarApproachHoles.length
    ? dunnottarApproachHoles
    : approach.points.slice(1).map((b, i) => {
        const a = approach.points[i],
          before = approach.points
            .slice(1, i + 1)
            .reduce((n, p, j) => n + length(approach.points[j], p), 0);
        return {
          start: a,
          end: b,
          startY: approach.startY + ((approach.endY - approach.startY) * before) / totalApproach,
          endY:
            approach.startY +
            ((approach.endY - approach.startY) * (before + length(a, b))) / totalApproach,
        };
      })) {
    const a = h.start,
      b = h.end,
      u = unit(b.map((v, k) => v - a[k])),
      n = [-u[1], u[0]];
    for (const side of [-1, 1]) {
      const aa = a.map((v, k) => v + (n[k] * side * (approach.width + 0.45)) / 2),
        bb = b.map((v, k) => v + (n[k] * side * (approach.width + 0.45)) / 2);
      // Neighboring flights clip these side reveals at turns; their shared
      // ends remain open so the connected staircase cannot gain a cross-wall.
      cutFace(
        'rock',
        [
          at(aa, h.startY - 0.05),
          at(bb, h.endY - 0.05),
          at(bb, Math.max(floor - 0.12, h.endY - 0.05)),
          at(aa, Math.max(floor - 0.12, h.startY - 0.05)),
        ],
        [-n[0] * side, 0, -n[1] * side],
      );
    }
  }
  let distance = 0;
  for (let i = 0; i < approach.points.length - 1; i++) {
    const a = approach.points[i],
      b = approach.points[i + 1],
      len = length(a, b),
      y0 = approach.startY + ((approach.endY - approach.startY) * distance) / totalApproach;
    distance += len;
    const y1 = approach.startY + ((approach.endY - approach.startY) * distance) / totalApproach,
      n = d === 1 ? 1 : Math.max(1, Math.ceil((y1 - y0) / 0.24));
    for (let j = 0; j < n; j++)
      band(
        face,
        lerp(a, b, j / n),
        lerp(a, b, (j + 1) / n),
        approach.width,
        y0 + ((y1 - y0) * (j + 1)) / n,
        'paving',
        0.3,
      );
  }
  const outside = [[-79.79, -66.42], [-74.34, -62.9], [-69.84, -56.95], approach.points[0]],
    outsideLength = outside.slice(1).reduce((n, p, i) => n + length(outside[i], p), 0),
    start = dunnottarGround(...outside[0]) + 0.08;
  distance = 0;
  for (let i = 0; i < outside.length - 1; i++) {
    const a = outside[i],
      b = outside[i + 1],
      len = length(a, b),
      y0 = start + ((approach.startY - start) * distance) / outsideLength;
    distance += len;
    const y1 = start + ((approach.startY - start) * distance) / outsideLength,
      count = d === 1 ? 1 : Math.max(1, Math.ceil((y1 - y0) / 0.24));
    for (let j = 0; j < count; j++) {
      const p = lerp(a, b, j / count),
        q = lerp(a, b, (j + 1) / count),
        top = y0 + ((y1 - y0) * (j + 1)) / count;
      band(face, p, q, approach.width, top, 'paving', 0.3);
      const u = unit(q.map((v, k) => v - p[k])),
        n = [-u[1], u[0]],
        r = [
          p.map((v, k) => v - (n[k] * approach.width) / 2),
          q.map((v, k) => v - (n[k] * approach.width) / 2),
          q.map((v, k) => v + (n[k] * approach.width) / 2),
          p.map((v, k) => v + (n[k] * approach.width) / 2),
        ];
      sides(face, r, (v) => Math.min(top - 0.35, dunnottarGround(...v) - 0.15), top - 0.3, 'rock');
    }
  }
}
function basin(face, d) {
  const f = frame.reconstruction.basin,
    r = simplify(f.ring, d === 0 ? 1 : 0.09),
    inner = offsetRing(r, 0.55, true);
  sides(face, r, floor - 0.65, floor + 0.6, 'stone');
  sides(face, inner, floor - 0.7, floor + 0.6, 'stone', true);
  cap(face, r, floor + 0.6, 'trim', [inner]);
  cap(face, inner, floor - 0.67, 'water');
}
function gardenWalls(out, d) {
  const segments = [
    [
      [0, 20],
      [18, 32],
    ],
    [
      [18, 32],
      [34, 33],
    ],
    [
      [0, 20],
      [-18, 16],
    ],
    [
      [-18, 16],
      [-40, 11],
    ],
    [
      [10, -33],
      [-2, -41],
    ],
  ];
  for (const [a, b] of segments) wallSegment(out, d, a, b, 0.6, floor - 0.1, floor + 1.2);
}
function courtPaths(face, d) {
  if (!d) return;
  for (const path of frame.reconstruction.courtPaths ?? [])
    for (const r of path.lines)
      for (let i = 0; i < r.length - 1; i++) {
        const a = r[i],
          b = r[i + 1];
        if (inside(lerp(a, b, 0.5), frame.geometry.outline))
          band(face, a, b, 1.7, floor + 0.025, 'paving', 0.1);
      }
}
function build(out, d) {
  const volumes = d ? approachVolumes(d) : [],
    face = writer(out, d);
  cliff(
    out,
    d,
    d ? [...volumes, prepareOpening(mainGate, 0, d), prepareOpening(secondaryGate, 0, d)] : [],
  );
  const allHoles = frame.reconstruction.components.flatMap((f) =>
    shell(out, d, f, volumes, undefined, true),
  );
  for (const f of frame.reconstruction.components) {
    if (d === 0 && ['ticket-bay', 'coastal-room', 'gate-room', 'palace-end-room'].includes(f.role))
      continue;
    shell(out, d, f, volumes, allHoles);
  }
  if (d) gardenWalls(out, d);
  courtPaths(face, d);
  stairs(out, d);
  basin(face, d);
}
export const buildDunnottarSkyline = (out) => build(out, 0);
export const buildDunnottarDistrict = (out) => build(out, 1);
export const buildDunnottarStreet = (out) => build(out, 2);
export const buildDunnottarCloseup = (out) => build(out, 3);
export const dunnottarStudy = {
  id: 'dunnottar_castle',
  key: 'dunnottar_castle',
  title: 'Dunnottar Castle',
  category: 'castle',
  wikidataId: 'Q746983',
  generationCommand: 'node packages/worldgen/scripts/generate-additional-landmarks.mjs',
  mapFrame: 'map-frame.json',
  fidelityTarget: 'medium-fi',
  build: (out) => build(out, 4),
  surfaceOverrides: scope.surfaceOverrides,
  brief:
    'Individual ruined headland compound: roofless eastern palace ranges around the mapped basin, western L-shaped tower house, chapel, stables, gate rooms, dividing lawn walls, faceted cliff platform and mapped zigzag stair approach. No restored complete castle roof or filled ruin boxes.',
  sourceFacts: {
    horizontalBasis:
      'Exact-QID184x145m site envelope plus fourteen current ruin polygons, mapped basin and entrance steps/tunnels.',
    architecturalHeights:
      'No component height tags. Wall/gable/keep levels and20m native platform are estimates from two inspected aerial pictures. Standard viewer DEM12.3751m anchor and slope samples are retained, but the smoothed headland is not a cliff-top or bare-earth survey.',
  },
  reconstruction: frame.reconstruction,
  scaleBasis:
    'Retained exact identity/site outline and individual PMTiles components establish approximate scale and signed western-entry/eastern-palace facing.',
  refs: read('reference-metadata.json').currentRoundInspection.pictures.map((p) => p.page),
  nativeAxes: frame.nativeAxes,
  sourceDocuments: scope.sourceDocuments,
  sourceLicense:
    'Original geometry under repository license; mapped controls © OpenStreetMap contributors, ODbL-1.0. Linked photographs are not redistributed.',
  dataAttribution: '© OpenStreetMap contributors; Protomaps; Mapzen/USGS terrain tiles.',
  sourceNotice:
    'Three existing256-square graphs supply weathered limestone, granite and gravel with linear tints/metric UVs. Grass and small basin water use vertex-colored palettes. No unique bitmap or embedded image.',
  importReason:
    'Preserve the ruined compound, western keep, eastern palace and headland silhouette in four independently authored browser levels.',
  previewGround: false,
  previewTerrain: scope.previewTerrain,
  mediumFiContext: scope.mediumFiContext,
  geographic: () => scope.geographic,
  geographicNote: scope.geographicNote,
  limitations: [
    'Fourteen ruin footprints and basin retain current map controls; room-role correspondence, all heights, gables, chimney damage, windows and partitions are exterior-picture estimates.',
    'The standard DEM12.3751m anchor is coarse and strongly smooths this headland. Native plateau20m, rock profiles, entrance10–20m stair levels, footing and joins are approximate; no bare-earth survey, terrain carving or certified walking collision.',
    'Skyline omits minor gate/coastal/end rooms and the detailed stair flights. District restores the selected compound and sparse openings; street/closeup add window rhythm, chimney remnants and stairs. Complete interiors, vaults, complete historical room plans and exact weathering are excluded.',
    'Modern toilet, ocean, offshore rocks, mainland paths, town, trees, crowds and visitor fixtures remain host content. Basin water level and lawn divisions are simplified interpretations.',
    'Physical laptop and phone performance measurements remain pending.',
  ],
  camera: scope.camera,
  qaCameras: [
    { name: 'western-keep-and-gates', position: [-133, 85, -82], lookAt: [-62, 27, -20], fov: 43 },
    { name: 'eastern-palace-and-basin', position: [124, 83, 84], lookAt: [43, 24, 0], fov: 43 },
    { name: 'roofless-compound-overhead', position: [0, 181, 9], lookAt: [0, 21, 0], fov: 43 },
    { name: 'mapped-stair-and-tunnel', position: [-83, 43, -77], lookAt: [-49, 18, -29], fov: 43 },
    { name: 'chapel-and-stables', position: [-51, 54, 79], lookAt: [-39, 25, 13], fov: 43 },
    { name: 'basin-and-palace-gables', position: [11, 39, 5], lookAt: [48, 24, 0], fov: 43 },
  ],
};
