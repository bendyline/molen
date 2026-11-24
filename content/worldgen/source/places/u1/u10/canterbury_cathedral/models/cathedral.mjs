import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import {
  beam,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import site from '../site-controls.json' with { type: 'json' };

export const surfaces = {
  wall: { slot: 'wall', graph: 'stone_limestone', roughness: 0.96 },
  trim: { slot: 'trim', graph: 'stone_sandstone_raw', roughness: 0.94 },
  base: { slot: 'foundation', graph: 'stone_ashlar', roughness: 0.98 },
  roof: { slot: 'roof', graph: 'slate', roughness: 0.87 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.78 },
  door: { slot: 'door', graph: 'wood_vertical', roughness: 0.97 },
};
const buff = rgb('ae9f83'),
  pale = rgb('b4a68c'),
  old = rgb('9a8a71');
const lead = rgb('748890'),
  glass = rgb('525957'),
  wood = rgb('53473b');
const angle = (site.planAngleDegrees * Math.PI) / 180,
  c = Math.cos(angle),
  s = Math.sin(angle);
const world = ([x, y, z]) => [x * c - z * s, y, x * s + z * c];
const box = (x, X, z, Z) => [
  [x, z],
  [x, Z],
  [X, Z],
  [X, z],
];
const point = ([x, z], y) => [x, y, z];
const area = (ring) =>
  ring.reduce((sum, [x, z], i) => {
    const [u, v] = ring[(i + 1) % ring.length];
    return sum + x * v - z * u;
  }, 0);
const flat = (y) => () => y;
const limits = (ring) =>
  [0, 1].flatMap((i) => [Math.min(...ring.map((p) => p[i])), Math.max(...ring.map((p) => p[i]))]);
const yFloor = -0.71;

function face(out, slot, data, color, toward) {
  let points = data.map((q) => world(q).map(Math.fround));
  const n = normalFor(...points);
  if (toward && n.reduce((sum, v, i) => sum + v * world(toward)[i], 0) < 0)
    points = points.toReversed();
  for (let i = 1; i < points.length - 1; i++) {
    const tri = [points[0], points[i], points[i + 1]],
      normal = normalFor(...tri);
    if (Math.hypot(...normal) > 0.9) out.addTriangle(slot, '', tri, normal, [], color);
  }
}

function cap(out, slot, ring, height, color, toward = [0, 1, 0]) {
  const scratch = new MeshBufferBuilder();
  if (!scratch.addCap('wall', 'palette:#ffffff', ring, [], height, [0, 1, 0], (p) => p, color))
    throw Error('Invalid Canterbury roof ring');
  const { positions, indices } = scratch.finalize();
  for (let i = 0; i < indices.length; i += 3) {
    const tri = [0, 1, 2].map((k) => positions.slice(3 * indices[i + k], 3 * indices[i + k] + 3));
    face(out, slot, tri, color, toward);
  }
}

function walls(out, slot, outline, y0, y1, color) {
  const ring = area(outline) < 0 ? outline : outline.toReversed();
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length];
    face(out, slot, [point(a, y0(a)), point(b, y0(b)), point(b, y1(b)), point(a, y1(a))], color);
  }
}

function course(out, slot, ring, y0, y1, color) {
  walls(out, slot, ring, flat(y0), flat(y1), color);
  cap(out, slot, ring, flat(y1), color);
}

function byDistance(ring) {
  const vertices = [...ring];
  for (let i = vertices.length - 1; i >= 0 && vertices.length > 4; i--) {
    const a = vertices[(i + vertices.length - 1) % vertices.length],
      b = vertices[(i + 1) % vertices.length];
    const [x, z] = vertices[i],
      u = b[0] - a[0],
      v = b[1] - a[1],
      t = ((x - a[0]) * u + (z - a[1]) * v) / (u * u + v * v);
    if (t >= 0 && t <= 1 && Math.hypot(x - a[0] - t * u, z - a[1] - t * v) < 0.45)
      vertices.splice(i, 1);
  }
  return vertices;
}

function replaceRidgeVertices(ring, axis, mid) {
  return ring.flatMap((p, i) => {
    const q = ring[(i + 1) % ring.length];
    if ((p[axis] - mid) * (q[axis] - mid) >= 0) return [p];
    const t = (mid - p[axis]) / (q[axis] - p[axis]);
    return [p, p.map((v, j) => v + (q[j] - v) * t)];
  });
}

function body(out, part, detail) {
  const { height, base, roof, roofAxis, roofs, id } = part;
  const ring = detail ? part.ring : byDistance(part.ring);
  const [x, X, z, Z] = limits(ring);
  const low = base ? base : yFloor;
  if (roof === 'gabled') {
    const a = roofAxis ? z : x,
      b = roofAxis ? Z : X,
      mid = (a + b) / 2;
    const rise = Math.min(6.61, (b - a) * 0.41);
    const grade = (p) => height - rise * Math.abs((p[roofAxis] - mid) / (b - mid));
    walls(out, 'wall', replaceRidgeVertices(ring, roofAxis, mid), flat(low), grade, buff);
    for (const polygon of roofs)
      cap(out, 'roof', detail ? polygon : byDistance(polygon), grade, lead);
    return;
  }
  if (roof === 'pyramidal' || roof === 'hipped') {
    const span = Math.min(X - x, Z - z);
    const peak = id >= 928165443 && id <= 928165456 ? height : height + 0.01;
    const rise = Math.min(
      peak - low - 0.6,
      id >= 928165443 && id <= 928165456 ? span * 1.65 : span * 0.56,
    );
    const tip = [(x + X) / 2, peak, (z + Z) / 2];
    const pinnacle = id >= 928165443 && id <= 928165456;
    course(out, 'wall', ring, low, peak - rise, pinnacle ? pale : buff);
    for (let i = 0; i < ring.length; i++)
      face(
        out,
        pinnacle ? 'trim' : 'roof',
        [point(ring[i], peak - rise), point(ring[(i + 1) % ring.length], peak - rise), tip],
        pinnacle ? pale : lead,
        [0, 1, 0],
      );
    return;
  }
  course(out, id === 928165457 ? 'base' : 'wall', ring, low, height, buff);
}

function along(a, b, offset = 0) {
  const [x, z] = a,
    [u, v] = b;
  const len = Math.hypot(u - x, v - z),
    out = [-(v - z) / len, 0, (u - x) / len];
  return {
    length: len,
    normal: out,
    at: (t, h, d = 0) => [
      x + (u - x) * t + out[0] * (offset + d),
      h,
      z + (v - z) * t + out[2] * (offset + d),
    ],
  };
}

function frame(out, edge, center, low, width, height, detail, door = false) {
  const half = width / (2 * edge.length);
  const bottom = low,
    spring = low + height * 0.6;
  const at = (t, y, d = 0) => edge.at(center + t * half, y, d);
  const n = [0, 4, 6, 10][detail];
  const ring = Array.from({ length: n + 1 }, (_, i) => {
    const t = (2 * i) / n - 1;
    return [t, spring + (height + low - spring) * (1 - Math.pow(Math.abs(t), 1.43))];
  });
  const fill = door ? 'door' : 'glass';
  const fillColor = door ? wood : glass;
  const faceOn = (slot, points, tint) => face(out, slot, points, tint, edge.normal);
  faceOn(fill, [at(-1, bottom), at(1, bottom), at(1, spring), at(-1, spring)], fillColor);
  for (let i = 0; i < n; i++) {
    const [a, y] = ring[i],
      [b, h] = ring[i + 1];
    faceOn(fill, [at(a, spring), at(b, spring), at(b, h), at(a, y)], fillColor);
  }
  if (detail === 1) return;
  const border = width > 2.5 ? 0.092 : 0.06;
  for (const t of [-1, 1]) {
    const outer = t * (1 + (2 * border) / width);
    faceOn(
      'trim',
      [
        at(t, bottom, 0.055),
        at(outer, bottom, 0.055),
        at(outer, spring, 0.055),
        at(t, spring, 0.055),
      ],
      pale,
    );
  }
  for (let i = 0; i < n; i++) {
    const [a, y] = ring[i],
      [b, h] = ring[i + 1],
      scale = 1 + (2 * border) / width;
    faceOn(
      'trim',
      [
        at(a, y, 0.058),
        at(b, h, 0.058),
        at(b * scale, h + border, 0.058),
        at(a * scale, y + border, 0.058),
      ],
      pale,
    );
  }
  if (door) return;
  const bars = width >= 5 ? 5 : width >= 2.1 ? 3 : 1;
  for (let i = 1; i <= bars; i++) {
    const t = (2 * i) / (bars + 1) - 1;
    const top = spring + (height + low - spring) * (1 - Math.pow(Math.abs(t), 1.43));
    const halfBar = 0.078 / width;
    faceOn(
      'trim',
      [
        at(t - halfBar, bottom, 0.061),
        at(t + halfBar, bottom, 0.061),
        at(t + halfBar, top - 0.041, 0.061),
        at(t - halfBar, top - 0.041, 0.061),
      ],
      pale,
    );
  }
  if (width >= 2) {
    const transom = bottom + height * 0.46;
    faceOn(
      'trim',
      [
        at(-1, transom, 0.063),
        at(1, transom, 0.063),
        at(1, transom + 0.101, 0.063),
        at(-1, transom + 0.101, 0.063),
      ],
      pale,
    );
  }
}

function elevations(out, part, detail) {
  const { id, ring, height } = part;
  const tower = [927857354, 927857355, 927857361].includes(id);
  const p = area(ring) < 0 ? ring : ring.toReversed();
  for (let i = 0; i < p.length; i++) {
    const a = p[i],
      b = p[(i + 1) % p.length],
      edge = along(a, b, 0.048);
    if (edge.length < 3.7) continue;
    const count = tower ? 2 : Math.max(1, Math.round(edge.length / (height > 18 ? 6.1 : 4.35)));
    const hood = height > 20 ? height - 2.4 : height - 1.34;
    for (let j = 0; j < count; j++) {
      const at = (j + 0.5) / count;
      if (tower) {
        frame(
          out,
          edge,
          at,
          height * 0.61,
          Math.min(2.94, edge.length * 0.31),
          height * 0.255,
          detail,
        );
        if (detail >= 2)
          frame(
            out,
            edge,
            at,
            height * 0.35,
            Math.min(2.55, edge.length * 0.3),
            height * 0.187,
            detail,
          );
      } else {
        const h = height > 30 ? 6.4 : Math.min(height * 0.58, 7.36);
        const low = hood - h - (part.roof === 'gabled' ? 5.8 : 0);
        if (low > 1.5)
          frame(out, edge, at, low, Math.min((edge.length / count) * 0.64, 3.11), h, detail);
        if (detail >= 2 && edge.length > 8 && j < count - 1 && height >= 14) {
          const t = (j + 1) / count;
          const a = edge.at(t, 0.4, 0.95),
            b = edge.at(t, hood - 4.7, 0.51);
          beam(out, 'wall', world(a), world(b), 0.94, 1.22, buff);
        }
      }
    }
  }
}

function battlements(out, part, detail) {
  const [x, X, z, Z] = limits(part.ring);
  const level = part.height;
  const bounds = box(x - 0.19, X + 0.19, z - 0.19, Z + 0.19);
  course(out, 'trim', bounds, level - 0.58, level + 0.06, pale);
  if (detail) {
    const sx = (X - x) * 0.08;
    const sz = (Z - z) * 0.08;
    for (const u of [x + sx, X - sx])
      for (const v of [z + sz, Z - sz]) {
        course(
          out,
          'wall',
          box(u - 0.73, u + 0.73, v - 0.73, v + 0.73),
          yFloor,
          level - 0.72,
          pale,
        );
        course(
          out,
          'trim',
          box(u - 0.91, u + 0.91, v - 0.91, v + 0.91),
          level * 0.55 - 0.29,
          level * 0.55 + 0.15,
          pale,
        );
      }
    course(
      out,
      'trim',
      box(x - 0.096, X + 0.096, z - 0.096, Z + 0.096),
      level * 0.576 - 0.146,
      level * 0.576,
      pale,
    );
  }
  if (detail < 2) return;
  cap(out, 'trim', bounds, flat(level - 0.584), old, [0, -1, 0]);
  const shape = area(bounds) < 0 ? bounds : bounds.toReversed();
  for (let i = 0; i < shape.length; i++) {
    const edge = along(shape[i], shape[(i + 1) % 4]);
    const n = Math.round(edge.length / 1.3);
    for (let k = 0; k < n; k++) {
      const a = (k + 0.13) / n,
        b = (k + 0.74) / n,
        top = level + 0.79;
      const polygon = [
        edge.at(a, 0),
        edge.at(b, 0),
        edge.at(b, 0, -0.41),
        edge.at(a, 0, -0.41),
      ].map(([x, , z]) => [x, z]);
      course(out, 'trim', polygon, level - 0.01, top, pale);
    }
  }
}

function portals(out, detail) {
  const west = along([-63.574, -4.08], [-63.574, 4.3], 0.044).at;
  const edge = { at: west, length: 8.38, normal: [-1, 0, 0] };
  frame(out, edge, 0.5, 11.28, 7.16, 15.42, detail);
  const portal = { ...edge, at: (t, y, d = 0) => [-66.23 - d, y, -4.08 + t * 8.38] };
  frame(out, portal, 0.5, 0.49, 5.5, 5.5, detail, true);
  for (const z of [-5.11, -3.66, 3.78, 5.09])
    course(out, 'trim', box(-66.47, -66.02, z - 0.19, z + 0.19), 0, 6.44, pale);
  const chapter = along([-5.555, -24.65], [-4.94, -36.56], -0.084);
  const inside = { ...chapter, at: (t, y, d = 0) => chapter.at(t, y, -d), normal: [-1, 0, 0] };
  frame(out, inside, 0.52, 5.32, 8.53, 11.37, detail);
}

function cloister(out, detail, part) {
  cap(out, 'roof', part.ring, flat(5.5), lead);
  if (!detail) {
    walls(out, 'wall', part.ring, flat(yFloor), flat(5.5), buff);
    return;
  }
  const outer = area(part.ring) < 0 ? part.ring : part.ring.toReversed();
  for (let i = 0; i < outer.length; i++) {
    const a = outer[i],
      b = outer[(i + 1) % outer.length];
    const mid = a.map((v, j) => (v + b[j]) / 2);
    const [x, X, z, Z] = limits(site.cloister);
    if (mid[0] >= x - 0.49 && mid[0] <= X + 0.49 && mid[1] >= z - 0.49 && mid[1] <= Z + 0.7)
      continue;
    const n = along(a, b).normal;
    face(out, 'wall', [point(a, yFloor), point(b, yFloor), point(b, 5.5), point(a, 5.5)], buff, n);
  }
  const court = area(site.cloister) < 0 ? site.cloister : site.cloister.toReversed();
  for (let i = 0; i < court.length; i++) {
    const a = court[i],
      b = court[(i + 1) % court.length];
    const edge = along(b, a);
    const n = Math.round(edge.length / 3.08);
    const roof = 5.5;
    for (let j = 0; j < n; j++) {
      const l = j / n,
        m = (j + 0.126) / n,
        p = (j + 0.874) / n,
        r = (j + 1) / n;
      const at = edge.at;
      const strip = (a, b, y, h, tint) =>
        face(out, 'wall', [at(a, y), at(b, y), at(b, h), at(a, h)], tint, edge.normal);
      strip(l, r, 0.04, 0.66, buff);
      strip(l, m, 0.655, roof, buff);
      strip(p, r, 0.655, roof, buff);
      const k = detail === 1 ? 4 : 8;
      for (let v = 0; v < k; v++) {
        const start = v / k,
          end = (v + 1) / k;
        const h = (t) => 2.88 + 1.45 * (1 - Math.pow(Math.abs(2 * t - 1), 1.53));
        const q = m + (p - m) * start,
          w = m + (p - m) * end;
        face(
          out,
          'wall',
          [at(q, h(start)), at(w, h(end)), at(w, roof), at(q, roof)],
          buff,
          edge.normal,
        );
        if (detail >= 2)
          face(
            out,
            'trim',
            [
              at(q, h(start), 0.08),
              at(w, h(end), 0.08),
              at(w, h(end) + 0.19, 0.08),
              at(q, h(start) + 0.19, 0.08),
            ],
            pale,
            edge.normal,
          );
      }
      if (detail >= 2) {
        const center = (j + 0.5) / n;
        beam(
          out,
          'trim',
          world(at(center, 0.65, 0.073)),
          world(at(center, 3.27, 0.073)),
          0.115,
          0.104,
          pale,
        );
      }
    }
  }
}

function cathedral(out, detail) {
  const parts = site.parts;
  const part = (id) => parts.find((p) => p.id === id);
  const extra = [927936713, 927936714, 927936715, 927936716, 928108910, 928108912];
  const patterned = new Set([
    150766536, 927857354, 927857355, 927857359, 927857361, 927857362, 927857363, 927857364,
    927857365, 927936720, 927936721, 927936722, 927936730, 927936731, 927936732, 927936733,
  ]);
  for (const p of parts) {
    if (!detail && extra.includes(p.id)) continue;
    if (p.id === 927936729) cloister(out, detail, p);
    else body(out, p, detail);
    if (detail && patterned.has(p.id)) elevations(out, p, detail);
  }
  for (const id of [927857354, 927857355, 927857361]) battlements(out, part(id), detail);
  if (!detail) return;
  portals(out, detail);
}

export const buildSkyline = (out) => cathedral(out, 0);
export const buildDistrict = (out) => cathedral(out, 1);
export const buildStreet = (out) => cathedral(out, 2);
export const buildCloseup = (out) => cathedral(out, 3);
export const buildMaster = buildCloseup;
