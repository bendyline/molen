/** Eight independent mapped facade planes with clipped panel grids and exposed crown steel. */

import { readFileSync } from 'node:fs';
import { beam, normalFor, normalize } from './authored-structure-mesh.mjs';
import { quad } from './structure-mesh.mjs';
import { structureSourcePath } from './structure-source-paths.mjs';

const map = JSON.parse(readFileSync(structureSourcePath('n0141_the_shard', 'map-evidence.json')));
const ref = 'palette:#ffffff';
const glass = [0.37, 0.5, 0.55],
  steel = [0.66, 0.7, 0.71];
const partIds = Array.from({ length: 8 }, (_, i) => 666124825 + i);
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const local = ({ lon, lat }) => {
  const east =
    (lon - map.anchor[0]) * 111319.49079327358 * Math.cos((map.anchor[1] * Math.PI) / 180);
  const south = -(lat - map.anchor[1]) * 111319.49079327358;
  return [
    Math.cos(map.heading) * east - Math.sin(map.heading) * south,
    Math.sin(map.heading) * east + Math.cos(map.heading) * south,
  ];
};
const ring = (id) =>
  map.elements
    .find((e) => e.id === id)
    .geometry.slice(0, -1)
    .map(local);
const area = (p) =>
  p.reduce((s, a, i) => {
    const b = p[(i + 1) % p.length];
    return s + a[0] * b[1] - a[1] * b[0];
  }, 0) / 2;
function clip(p, axis, limit, sign) {
  const output = [];
  for (let i = 0; i < p.length; i++) {
    const a = p[i],
      b = p[(i + 1) % p.length],
      da = (a[axis] - limit) * sign,
      db = (b[axis] - limit) * sign;
    if (da >= -1e-8) output.push(a);
    if ((da > 1e-8 && db < -1e-8) || (da < -1e-8 && db > 1e-8))
      output.push(mix(a, b, da / (da - db)));
  }
  return output;
}
function triangulate(p) {
  const ids = p.map((_, i) => i),
    result = [],
    direction = Math.sign(area(p));
  const cross = (a, b, c) => (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
  let guard = p.length * p.length;
  while (ids.length > 3 && guard--) {
    let found = false;
    for (let j = 0; j < ids.length; j++) {
      const a = ids[(j + ids.length - 1) % ids.length],
        b = ids[j],
        c = ids[(j + 1) % ids.length];
      if (cross(p[a], p[b], p[c]) * direction < 1e-9) continue;
      if (
        ids.some(
          (k) =>
            k !== a &&
            k !== b &&
            k !== c &&
            cross(p[a], p[b], p[k]) * direction > 1e-8 &&
            cross(p[b], p[c], p[k]) * direction > 1e-8 &&
            cross(p[c], p[a], p[k]) * direction > 1e-8,
        )
      )
        continue;
      result.push([a, b, c]);
      ids.splice(j, 1);
      found = true;
      break;
    }
    if (!found) break;
  }
  if (ids.length === 3) result.push(ids);
  return result;
}
function surface(out, slot, p, toWorld, color) {
  if (p.length < 3 || Math.abs(area(p)) < 1e-7) return;
  for (const t of triangulate(p)) {
    let world = t.map((i) => toWorld(p[i]));
    if (normalFor(...world)[1] < 0) world = world.toReversed();
    out.addTriangle(
      slot,
      ref,
      world,
      normalFor(...world),
      [
        [0, 0],
        [1, 0],
        [0, 1],
      ],
      color,
    );
    if (slot === 'clear_glass') continue;
    const back = world.toReversed();
    out.addTriangle(
      slot,
      ref,
      back,
      normalFor(...back),
      [
        [0, 0],
        [1, 0],
        [0, 1],
      ],
      color,
    );
  }
}
function crossings(p, axis, value) {
  const values = [];
  for (let i = 0; i < p.length; i++) {
    const a = p[i],
      b = p[(i + 1) % p.length];
    if ((a[axis] <= value && b[axis] > value) || (b[axis] <= value && a[axis] > value))
      values.push(mix(a, b, (value - a[axis]) / (b[axis] - a[axis])));
  }
  return values.sort((a, b) => a[1 - axis] - b[1 - axis]);
}
function shardPlane(id) {
  const item = map.elements.find((e) => e.id === id),
    points = ring(id),
    tag = item.tags;
  const angle = (Number(tag['roof:direction']) * Math.PI) / 180;
  const d = [Math.sin(angle + map.heading), -Math.cos(angle + map.heading)],
    u = [-d[1], d[0]];
  const projection = points.map((p) => p[0] * d[0] + p[1] * d[1]);
  const min = Math.min(...projection),
    max = Math.max(...projection);
  const top = Number(tag.height) === 310 ? 309.6 : Number(tag.height),
    low = Number(tag.height) - Number(tag['roof:height']);
  const polygon = points.map((p, i) => [
    p[0] * u[0] + p[1] * u[1],
    top - ((projection[i] - min) / (max - min)) * (top - low),
  ]);
  const toWorld = ([v, y]) => {
    const t = min + ((top - y) / (top - low)) * (max - min);
    return [u[0] * v + d[0] * t, y, u[1] * v + d[1] * t];
  };
  return { id, polygon, toWorld, top, low };
}
export const shardReconstruction = {
  mappedFacadeParts: partIds,
  shardTipsMeters: [252, 309.6, 254, 309.6, 290, 235, 260, 309.6],
  podiumParts: [665171689, 665171690],
  podiumHeightsMeters: [74, 70],
  note: "Individual facade footprints, declining azimuths and roof heights are OSM reconstructions, not an as-built survey. The three 310 m map tips use the operator's 309.6 m height. Panel modules and crown member sections are exterior reconstructions; the eight facade planes stay independent.",
};
export function buildMappedShard(out) {
  const planes = partIds.map(shardPlane);
  // A recessed weather enclosure connects the facade returns below the open crown.
  const hull = (points) => {
    points.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const cross = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    const half = (points) => {
      const p = [];
      for (const v of points) {
        while (p.length > 1 && cross(p.at(-2), p.at(-1), v) <= 0) p.pop();
        p.push(v);
      }
      return p;
    };
    return [...half(points).slice(0, -1), ...half(points.toReversed()).slice(0, -1)].toReversed();
  };
  const enclosure = (y) => {
    const points = planes.flatMap((p) =>
      crossings(p.polygon, 1, Math.max(p.low + 0.001, Math.min(p.top - 0.001, y)))
        .map((q) => p.toWorld(q))
        .map((p) => [p[0], p[2]]),
    );
    const polygon = hull(points),
      center = polygon.reduce(
        (s, p) => [s[0] + p[0] / polygon.length, s[1] + p[1] / polygon.length],
        [0, 0],
      );
    const distances = polygon.map((a, i) =>
        Math.hypot(...polygon[(i + 1) % polygon.length].map((v, j) => v - a[j])),
      ),
      perimeter = distances.reduce((a, b) => a + b, 0);
    return Array.from({ length: 96 }, (_, i) => {
      let d = (i / 96) * perimeter,
        k = 0;
      while (d > distances[k] && k < distances.length - 1) d -= distances[k++];
      const p = mix(polygon[k], polygon[(k + 1) % polygon.length], d / distances[k]);
      return [center[0] + (p[0] - center[0]) * 0.95, y, center[1] + (p[1] - center[1]) * 0.95];
    });
  };
  const levels = [0, ...Array.from({ length: 72 }, (_, i) => (i + 1) * 3.45), 251.7];
  const rings = levels.map(enclosure);
  for (let j = 1; j < rings.length; j++)
    for (let i = 0; i < 96; i++) {
      const k = (i + 1) % 96;
      beam(out, 'metal', rings[j][i], rings[j][k], 0.08, 0.1, steel);
      const start = [...rings[j - 1][i]];
      start[1] = Math.max(0.1, start[1]);
      beam(out, 'metal', start, rings[j][i], 0.045, 0.07, steel);
    }
  for (let j = 1; j < rings.length; j++)
    for (let i = 0; i < 96; i++) {
      const k = (i + 1) % 96;
      for (const p of [
        [rings[j - 1][i], rings[j - 1][k], rings[j][k]],
        [rings[j - 1][i], rings[j][k], rings[j][i]],
      ])
        out.addTriangle(
          'glass',
          ref,
          p,
          normalFor(...p),
          [
            [0, 0],
            [1, 0],
            [1, 1],
          ],
          [0.28, 0.38, 0.42],
        );
    }
  const roof = rings.at(-1),
    center = roof.reduce((sum, p) => sum.map((n, i) => n + p[i] / roof.length), [0, 0, 0]);
  for (let i = 0; i < 96; i++) {
    const p = [center, roof[i], roof[(i + 1) % 96]];
    out.addTriangle(
      'metal',
      ref,
      p,
      normalFor(...p),
      [
        [0, 0],
        [1, 0],
        [1, 1],
      ],
      [0.42, 0.46, 0.46],
    );
  }
  for (const [index, id] of partIds.entries()) {
    const { polygon, toWorld, top, low } = shardPlane(id);
    const loU = Math.min(...polygon.map((p) => p[0])),
      hiU = Math.max(...polygon.map((p) => p[0]));
    // Each clipped cell is physical glass geometry. Slight gaps expose narrow seam shadows.
    const module = 1.5,
      step = 3.45;
    for (let y = low; y < top; y += step)
      for (let u = Math.floor(loU / module) * module; u < hiU; u += module) {
        let cell = clip(polygon, 0, u + 0.025, 1);
        cell = clip(cell, 0, u + module - 0.025, -1);
        cell = clip(cell, 1, y + 0.035, 1);
        cell = clip(cell, 1, Math.min(y + step - 0.045, top), -1);
        surface(
          out,
          y >= 251.7 ? 'clear_glass' : 'glass',
          cell,
          toWorld,
          glass.map((v) => v * (0.97 + index * 0.005)),
        );
      }
    const frame = (axis, value, width, depth) => {
      const cut = crossings(polygon, axis, value);
      for (let i = 1; i < cut.length; i += 2) {
        const a = toWorld(cut[i - 1]),
          b = toWorld(cut[i]);
        if (Math.hypot(...b.map((v, j) => v - a[j])) > 0.08)
          beam(out, 'metal', a, b, width, depth, steel);
      }
    };
    for (let y = low + 3.45; y < top - 0.2; y += 3.45) frame(1, y, 0.085, 0.11);
    for (let u = Math.ceil(loU / module) * module; u < hiU; u += module) frame(0, u, 0.055, 0.09);
    for (let i = 0; i < polygon.length; i++) {
      const a = toWorld(polygon[i]),
        b = toWorld(polygon[(i + 1) % polygon.length]);
      a[1] = Math.max(0.15, a[1]);
      b[1] = Math.max(0.15, b[1]);
      beam(out, 'metal', a, b, 0.12, 0.16, steel);
    }
    // Open steel spire is visible through separated shard edges above the occupied roof.
    for (let y = 255; y < top - 5; y += 8) {
      const a = crossings(polygon, 1, y),
        b = crossings(polygon, 1, Math.min(y + 8, top - 0.2));
      if (a.length === 2 && b.length === 2) {
        const inset = (p) => {
          const q = toWorld(p);
          return [q[0] * 0.98 - 0.2, q[1], q[2] * 0.98];
        };
        beam(out, 'metal', inset(a[0]), inset(b[1]), 0.12, 0.14, steel);
        beam(out, 'metal', inset(a[1]), inset(b[0]), 0.12, 0.14, steel);
      }
    }
  }
  for (const id of [665171689, 665171690]) {
    let p = ring(id);
    if (area(p) > 0) p = p.toReversed();
    const h = Number(map.elements.find((e) => e.id === id).tags.height);
    for (let i = 0; i < p.length; i++) {
      const a = p[i],
        b = p[(i + 1) % p.length],
        n = normalize([b[1] - a[1], 0, a[0] - b[0]]);
      const count = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 1.5);
      for (let y = 0; y < h; y += 3.9)
        for (let j = 0; j < count; j++) {
          const aa = mix(a, b, j / count),
            bb = mix(a, b, (j + 1) / count),
            y1 = Math.min(h, y + 3.9);
          const cell = [
            [aa[0], y, aa[1]],
            [bb[0], y, bb[1]],
            [bb[0], y1, bb[1]],
            [aa[0], y1, aa[1]],
          ];
          quad(out, 'glass', cell, normalFor(...cell), glass);
          beam(out, 'metal', cell[0], cell[3], 0.065, 0.08, steel);
          beam(out, 'metal', cell[3], cell[2], 0.09, 0.12, steel);
        }
      beam(
        out,
        'metal',
        [a[0] + n[0] * 0.12, h, a[1] + n[2] * 0.12],
        [b[0] + n[0] * 0.12, h, b[1] + n[2] * 0.12],
        0.22,
        0.3,
        steel,
      );
    }
    // Neutral roof finish; mapped grass colour is not used as a substitute for vegetation.
    out.addConvexPolygon(
      'metal',
      ref,
      p.map(([x, z]) => [x, h, z]),
      [0, 1, 0],
      (p) => [p[0], p[2]],
      [0.4, 0.45, 0.44],
    );
  }
}
