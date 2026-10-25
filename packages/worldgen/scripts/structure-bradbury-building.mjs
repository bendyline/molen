/** Bradbury exterior: native concave plan, five floors, round upper lights and terracotta cornice. */
import './install-deterministic-math.mjs';
import earcut from 'earcut';
import nativeFrame from '../../../content/worldgen/source/places/9q/9q5/bradbury_building/map-frame.json' with {
  type: 'json',
};
import { beam, normalFor } from './authored-structure-mesh.mjs';
import { B, rgb } from './landmark-model-helpers.mjs';
import { quad } from './structure-mesh.mjs';

const ref = 'palette:#ffffff',
  brick = rgb('bc876c'),
  terra = rgb('ac7456'),
  light = rgb('c2947b'),
  base = rgb('a28378'),
  glass = rgb('536367'),
  iron = rgb('444a46'),
  roof = rgb('8c8c80'),
  wood = rgb('675040');
function facing(o, a, x = 0, z = 0) {
  const c = Math.cos(a),
    s = Math.sin(a),
    v = (p) => [c * p[0] + s * p[2], p[1], -s * p[0] + c * p[2]],
    p = (q) => {
      const r = v(q);
      return [r[0] + x, r[1], r[2] + z];
    };
  return {
    addTriangle: (s, r, q, n, u, col) => o.addTriangle(s, r, q.map(p), v(n), u, col),
    addQuad: (s, r, q, n, u, col) => o.addQuad(s, r, q.map(p), v(n), u, col),
    addConvexPolygon: (s, r, q, n, u, col) => {
      const pp = q.map(p),
        uv = q.map(u);
      return o.addConvexPolygon(s, r, pp, v(n), (p) => uv[pp.indexOf(p)], col);
    },
  };
}
function face(o, s, x, y, z, w, h, col) {
  quad(
    o,
    s,
    [
      [x - w / 2, y, z],
      [x + w / 2, y, z],
      [x + w / 2, y + h, z],
      [x - w / 2, y + h, z],
    ],
    [0, 0, 1],
    col,
  );
}
function cap(o, s, ring, y, col, up = true) {
  const idx = earcut(ring.flat());
  for (let i = 0; i < idx.length; i += 3) {
    const q = [idx[i], idx[i + 1], idx[i + 2]].map((k) => [ring[k][0], y, ring[k][1]]);
    if (up) q.reverse();
    o.addTriangle(
      s,
      ref,
      q,
      [0, up ? 1 : -1, 0],
      q.map((p) => [p[0], p[2]]),
      col,
    );
  }
}
function edge(o, a, b) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    w = Math.hypot(dx, dz);
  return { out: facing(o, Math.atan2(dz, -dx), (a[0] + b[0]) / 2, (a[1] + b[1]) / 2), w };
}
function strip(o, s, w, y, h, depth, col, d) {
  if (d > 1) B(o, s, 0, y, depth / 2, w, h, depth, col);
  else face(o, s, 0, y, depth, w, h, col);
}
function disk(o, s, x, y, z, r, col, n, semi = false) {
  const total = semi ? Math.PI : Math.PI * 2;
  for (let i = 0; i < n; i++) {
    const a = (i * total) / n,
      b = ((i + 1) * total) / n;
    o.addTriangle(
      s,
      ref,
      [
        [x, y, z],
        [x + r * Math.cos(a), y + r * Math.sin(a), z],
        [x + r * Math.cos(b), y + r * Math.sin(b), z],
      ],
      [0, 0, 1],
      [
        [0, 0],
        [1, 0],
        [1, 1],
      ],
      col,
    );
  }
}
function archBand(o, x, spring, z, r, width, col, n, slot = 'terra') {
  for (let i = 0; i < n; i++) {
    const a = (i * Math.PI) / n,
      b = ((i + 1) * Math.PI) / n,
      pt = (t, rr) => [x + rr * Math.cos(t), spring + rr * Math.sin(t), z];
    quad(o, slot, [pt(a, r), pt(a, r + width), pt(b, r + width), pt(b, r)], [0, 0, 1], col);
  }
}
function window(o, x, y, w, h, d, arched = false) {
  const z = 0.025,
    r = w / 2,
    spring = y + h - r,
    n = [3, 5, 8, 12][d];
  face(o, 'glass', x, y, z, w, arched ? h - r : h, glass);
  if (arched) disk(o, 'glass', x, spring, z, r, glass, n, true);
  if (!d) return;
  if (d === 1) {
    for (const xx of [-w / 2, w / 2])
      face(o, 'metal', x + xx, y, 0.11, 0.07, arched ? h - r : h, iron);
    face(o, 'metal', x, y + h * 0.45, 0.13, w, 0.055, iron);
    face(o, 'terra', x, y - 0.12, 0.2, w + 0.24, 0.12, terra);
    if (arched) archBand(o, x, spring, 0.2, r + 0.1, 0.15, terra, n);
    else face(o, 'terra', x, y + h, 0.2, w + 0.28, 0.2, terra);
    return;
  }
  const frame = 0.07;
  for (const xx of [-w / 2, w / 2]) {
    face(o, 'metal', x + xx, y, 0.11, frame, arched ? h - r : h, iron);
    quad(
      o,
      'terra',
      [
        [x + xx, y, 0.02],
        [x + xx, y, 0.22],
        [x + xx, arched ? spring : y + h, 0.22],
        [x + xx, arched ? spring : y + h, 0.02],
      ],
      [xx < 0 ? 1 : -1, 0, 0],
      light,
    );
  }
  face(o, 'metal', x, y, 0.12, w, 0.07, iron);
  if (arched) {
    archBand(o, x, spring, 0.12, r, 0.07, iron, n, 'metal');
    archBand(o, x, spring, 0.205, r + 0.1, 0.15, terra, n);
    if (d >= 2) {
      for (let i = 0; i < n; i++) {
        const a = (i * Math.PI) / n,
          b = ((i + 1) * Math.PI) / n,
          pt = (t, z) => [x + r * Math.cos(t), spring + r * Math.sin(t), z],
          q = [pt(a, 0.03), pt(a, 0.2), pt(b, 0.2), pt(b, 0.03)];
        quad(o, 'terra', q, normalFor(...q.slice(0, 3)), light);
      }
    }
    face(o, 'metal', x, spring, 0.13, w, 0.06, iron);
  } else {
    face(o, 'metal', x, y + h - 0.05, 0.12, w, 0.07, iron);
    if (d >= 3) B(o, 'terra', x, y + h, 0.12, w + 0.28, 0.22, 0.26, terra);
    else face(o, 'terra', x, y + h, 0.2, w + 0.28, 0.2, terra);
  }
  face(o, 'metal', x, y + h * 0.45, 0.13, w, 0.055, iron);
  if (d >= 2) {
    face(o, 'metal', x, y, 0.135, 0.045, h, iron);
    if (d === 3) B(o, 'terra', x, y - 0.12, 0.11, w + 0.28, 0.12, 0.34, terra);
    else face(o, 'terra', x, y - 0.12, 0.2, w + 0.24, 0.12, terra);
  } else face(o, 'terra', x, y - 0.12, 0.2, w + 0.24, 0.12, terra);
}
function portal(o, x, y, d) {
  const q = facing(o, 0, x, 0),
    r = 1.8,
    spring = y + 2.4,
    n = [4, 8, 16, 24][d];
  face(q, 'glass', 0, y, 0.045, 3.6, 2.4, glass);
  disk(q, 'glass', 0, spring, 0.045, r, glass, n, true);
  for (const sign of [-1, 1]) {
    if (d) B(q, 'terra', sign * 2.08, y, 0.14, 0.55, 4.75, 0.45, base);
    else face(q, 'terra', sign * 2.08, y, 0.2, 0.55, 4.75, base);
    face(q, 'wood', sign * 0.88, y, 0.12, 1.65, 2.45, wood);
    face(q, 'glass', sign * 0.88, y + 0.62, 0.14, 1.24, 1.48, glass);
    if (d >= 2) {
      B(q, 'terra', sign * 2.08, y - 0.08, 0.3, 0.75, 0.2, 0.7, base);
      B(q, 'terra', sign * 2.08, spring - 0.05, 0.3, 0.72, 0.28, 0.6, terra);
      face(q, 'terra', sign * 2.08, y + 0.4, 0.39, 0.34, 1.8, light);
    }
  }
  archBand(q, 0, spring, 0.35, r, 0.38, base, n);
  if (d) {
    archBand(q, 0, spring, 0.4, r + 0.1, 0.07, light, n);
    face(q, 'wood', 0, y + 2.42, 0.14, 3.6, 0.16, wood);
    face(q, 'wood', 0, y, 0.15, 0.13, 4.2, wood);
    B(q, 'terra', 0, y + 4.25, 0.15, 0.35, 0.45, 0.45, terra);
    face(q, 'terra', 0, y + 4.5, 0.4, 4.8, 0.5, base);
    if (d >= 2) {
      for (let i = 0; i < 15; i++)
        B(q, 'terra', -2.2 + i * 0.315, y + 4.68, 0.45, 0.11, 0.17, 0.07, light);
      for (const sign of [-1, 1])
        for (let j = 0; j < 4; j++)
          B(q, 'terra', sign * 2.08 + (j - 1.5) * 0.11, y + 3.75, 0.41, 0.07, 0.16, 0.08, terra);
    }
  }
  // Original photographic entrance has a shallow raised threshold; no terrain-fitting plinth.
  B(q, 'stone', 0, 0.05, 0.45, 3.72, 0.2, 0.65, light);
  B(q, 'stone', 0, 0.25, 0.15, 3.7, 0.2, 0.5, light);
}
function cornice(o, w, d, plain = false) {
  if (plain) {
    face(o, 'terra', 0, 25.35, 0.15, w, 0.12, terra);
    face(o, 'terra', 0, 25.62, 0.25, w, 0.18, terra);
    if (d >= 2)
      for (let i = 0; i < Math.floor(w / 0.8); i++)
        face(o, 'terra', -w / 2 + (i + 0.5) * 0.8, 25.1, 0.16, 0.12, 0.13, terra);
    return;
  }
  face(o, 'terra', 0, 24.38, 0.12, w, 0.38, light);
  for (const [y, h, depth] of [
    [5.3, 0.26, 0.24],
    [5.65, 0.12, 0.32],
    [18.7, 0.17, 0.17],
    [24.3, 0.18, 0.22],
    [25.35, 0.16, 0.52],
    [25.62, 0.18, 0.75],
  ])
    strip(o, 'terra', w, y, h, depth, terra, d);
  if (!d) return;
  const step = plain ? 1.1 : 0.75,
    n = Math.floor(w / step);
  for (let i = 0; i < n; i++) {
    const x = (i - (n - 1) / 2) * step;
    if (d === 1) face(o, 'terra', x, 24.82, 0.34, 0.16, 0.45, light);
    else {
      B(o, 'terra', x, 24.85, 0.24, 0.18, 0.47, 0.5, terra);
      B(o, 'terra', x, 25.25, 0.34, 0.28, 0.1, 0.65, light);
      if (d === 3 && !plain) {
        B(o, 'terra', x, 24.7, 0.17, 0.4, 0.1, 0.22, light);
        face(o, 'terra', x, 24.44, 0.23, 0.34, 0.15, terra);
      }
    }
  }
}
function fireEscape(o, x, d) {
  const q = facing(o, 0, x, 0);
  for (let f = 1; f <= 4; f++) {
    const y = 5.45 + (f - 1) * 4.5;
    if (!d) {
      face(q, 'metal', 0, y, 0.9, 2.8, 0.12, iron);
      continue;
    }
    if (d === 1) face(q, 'metal', 0, y, 1.57, 2.75, 0.1, iron);
    else B(q, 'metal', 0, y, 0.85, 2.75, 0.1, 1.5, iron);
    for (const yy of [0.12, 1.1]) {
      if (d === 1) face(q, 'metal', 0, y + yy, 1.57, 2.75, 0.07, iron);
      else B(q, 'metal', 0, y + yy, 1.57, 2.75, 0.07, 0.07, iron);
      if (d >= 2)
        for (const xx of [-1.34, 1.34])
          beam(q, 'metal', [xx, y + yy, 0.13], [xx, y + yy, 1.57], 0.05, 0.05, iron);
    }
    const count = d === 1 ? 5 : 11;
    for (let i = 0; i <= count; i++)
      face(q, 'metal', -1.33 + (i * 2.66) / count, y + 0.1, 1.6, 0.035, 1.06, iron);
    if (f < 4) {
      const a = [-1.1, y + 0.12, 1.05],
        b = [1.1, y + 4.5, 1.05];
      beam(q, 'metal', a, b, 0.13, 0.7, iron);
      if (d >= 2) {
        for (let i = 0; i < 15; i++) {
          const t = i / 14;
          B(q, 'metal', -1.1 + 2.2 * t, y + 0.18 + 4.3 * t, 1.08, 0.55, 0.055, 0.65, iron);
        }
        beam(q, 'metal', [-1.1, y + 1.18, 1.4], [1.1, y + 5.55, 1.4], 0.05, 0.05, iron);
      }
    }
  }
  if (d >= 2) {
    for (const xx of [-0.36, 0.36]) B(q, 'metal', xx, 23.3, 0.45, 0.055, 3.45, 0.055, iron);
    for (let i = 0; i < 12; i++) B(q, 'metal', 0, 23.35 + i * 0.28, 0.45, 0.77, 0.04, 0.06, iron);
  }
}
function smallPortal(o, x, d) {
  const q = facing(o, 0, x, 0),
    r = 0.94,
    spring = 2.65,
    n = [3, 5, 10, 16][d];
  face(q, 'glass', 0, 0.45, 0.03, r * 2, 2.2, glass);
  disk(q, 'glass', 0, spring, 0.03, r, glass, n, true);
  archBand(q, 0, spring, 0.2, r, 0.18, base, n);
  if (d) {
    for (const sign of [-1, 1]) face(q, 'terra', sign * 1.04, 0.45, 0.21, 0.17, 2.2, base);
    face(q, 'wood', 0, 0.45, 0.12, 0.08, 3.1, wood);
    face(q, 'wood', 0, 2.5, 0.12, 1.88, 0.08, wood);
  }
}
function facade(out, a, b, d, kind) {
  const { out: o, w } = edge(out, a, b),
    broadway = kind === 'broadway',
    chamfer = kind === 'chamfer',
    third = kind === 'third',
    street = broadway || third || chamfer,
    counts = broadway ? [3, 2, 2, 2, 3, 2] : chamfer ? [1] : [1, 1, 1, 2, 2, 2, 2, 2, 2, 1],
    groups = counts.length,
    middle = counts.map((_, i) => -w / 2 + ((i + 0.5) * w) / groups),
    perBay = counts.map((n, i) =>
      Array.from({ length: n }, (_, j) => middle[i] + (j - (n - 1) / 2) * (n === 3 ? 1.45 : 1.85)),
    ),
    windows = perBay.flat(),
    topWindows = third
      ? Array.from({ length: 21 }, (_, i) => -w / 2 + 2 + (i * (w - 4)) / 20)
      : windows;
  face(o, 'brick', 0, -0.65, 0, w, 26.45, brick);
  if (street) {
    face(o, 'terra', 0, -0.65, 0.012, w, 6, base);
    cornice(o, w, d);
    for (const y of [5.9, 10.35, 14.85, 19.35, 23.95]) face(o, 'brick', 0, y, 0.2, w, 0.7, brick);
    for (let i = 0; i < groups; i++) {
      const x = middle[i];
      if (!chamfer)
        for (const sign of [-1, 1])
          face(o, 'brick', x + sign * (w / groups / 2 - 0.16), 5.9, 0.2, 0.32, 13.5, brick);
      for (let f = 0; f < 3; f++)
        for (const xx of perBay[i])
          window(o, xx, 6 + f * 4.5, chamfer ? 1.48 : 1.25, 3.6, d, false);
    }
    for (const x of topWindows) window(o, x, 20, chamfer ? 1.5 : 1.4, 3.7, d, true);
    for (let i = 0; i < groups; i++) {
      const x = middle[i],
        sw = chamfer ? w - 0.8 : w / groups - 0.55;
      if (broadway && i === 2) {
        portal(o, x, 0.45, d);
        continue;
      }
      if (third && i === 2) {
        smallPortal(o, x, d);
        continue;
      }
      face(o, 'glass', x, 0.45, 0.025, sw, 4.5, glass);
      if (d) {
        face(o, 'terra', x, 4.5, 0.15, sw, 0.62, light);
        face(o, 'metal', x, 1.8, 0.12, sw, 0.08, iron);
        face(o, 'metal', x, 0.45, 0.13, 0.09, 4.1, iron);
        if (d >= 2)
          for (const sign of [-1, 1])
            B(
              o,
              'terra',
              x + (sign * (w / groups - 0.25)) / 2,
              -0.65,
              0.16,
              0.38,
              5.98,
              0.32,
              base,
            );
      }
    }
    if (d >= 2 && !chamfer) {
      for (let i = 0; i < Math.floor(w / 0.5); i++)
        face(
          o,
          'terra',
          -w / 2 + ((i + 0.5) * w) / Math.floor(w / 0.5),
          5.8,
          0.31,
          0.2,
          0.24,
          terra,
        );
      if (d === 3)
        for (const x of middle)
          for (let j = -2; j <= 2; j++)
            B(o, 'terra', x + j * 0.6, 18, 0.24, 0.16, 0.45, 0.35, terra);
    }
    if (third) for (const x of [-w * 0.22, w * 0.22]) fireEscape(o, x, d);
  } else {
    cornice(o, w, d, true);
    if (w > 5) {
      const n = Math.max(2, Math.floor(w / 3.2)),
        xs = Array.from({ length: n }, (_, i) => -w / 2 + ((i + 0.5) * w) / n);
      for (let f = 0; f < 4; f++)
        for (const x of xs) {
          if (!d && f % 2 === 0) continue;
          window(o, x, 6 + f * 4.5, 1.18, 3.35, d === 3 ? 2 : 0, f === 3);
        }
      if (kind === 'rear' && w > 30) fireEscape(o, 0, d);
    }
  }
}
function rooflight(o, d) {
  const x = -0.5,
    z = -1,
    w = 10.6,
    l = 30,
    y = 25.15,
    top = 28.1;
  const A = [x - w / 2, y, z - l / 2],
    B1 = [x, y + top - y, z - l / 2],
    C = [x + w / 2, y, z - l / 2],
    D = [x - w / 2, y, z + l / 2],
    E = [x, top, z + l / 2],
    F = [x + w / 2, y, z + l / 2];
  for (const q of [
    [A, D, E, B1],
    [B1, E, F, C],
  ])
    quad(o, 'glass', q, normalFor(...q.slice(0, 3)), rgb('a9b5b1'));
  for (const q of [
    [A, B1, C],
    [F, E, D],
  ])
    o.addTriangle(
      'glass',
      ref,
      q,
      normalFor(...q),
      [
        [0, 0],
        [0.5, 1],
        [1, 0],
      ],
      glass,
    );
  if (!d) return;
  for (const [a, b] of [
    [A, B1],
    [B1, C],
    [D, E],
    [E, F],
    [B1, E],
    [A, D],
    [C, F],
  ])
    beam(o, 'metal', a, b, 0.09, 0.09, iron);
  const count = d === 1 ? 5 : d === 2 ? 14 : 28;
  for (let i = 1; i < count; i++) {
    const zz = z - l / 2 + (i * l) / count;
    beam(o, 'metal', [x - w / 2, y + 0.015, zz], [x, top + 0.015, zz], 0.045, 0.045, iron);
    beam(o, 'metal', [x, top + 0.015, zz], [x + w / 2, y + 0.015, zz], 0.045, 0.045, iron);
  }
  if (d >= 2)
    for (const sign of [-1, 1])
      for (let i = 1; i <= 3; i++) {
        const t = i / 4;
        beam(
          o,
          'metal',
          [x + ((sign * w) / 2) * t, top + (y - top) * t + 0.02, z - l / 2],
          [x + ((sign * w) / 2) * t, top + (y - top) * t + 0.02, z + l / 2],
          0.035,
          0.035,
          iron,
        );
      }
}
export function bradburyBuilding(out, frame = nativeFrame, d = 3) {
  const ring = frame.geometry.outline.slice(0, -1);
  cap(out, 'stone', ring, -0.65, base, false);
  cap(out, 'roof', ring, 25.25, roof);
  for (let i = 0; i < ring.length; i++)
    facade(
      out,
      ring[i],
      ring[(i + 1) % ring.length],
      d,
      i === 9 ? 'broadway' : i === 10 ? 'chamfer' : i === 11 ? 'third' : i === 8 ? 'rear' : 'back',
    );
  rooflight(out, d);
  B(out, 'brick', -13.8, 25.25, -22, 1.6, 2.55, 1.5, brick);
  if (d) B(out, 'terra', -13.8, 27.8, -22, 1.86, 0.18, 1.76, light);
}
export const bradburyBuildingSkyline = (o) => bradburyBuilding(o, nativeFrame, 0);
export const bradburyBuildingDistrict = (o) => bradburyBuilding(o, nativeFrame, 1);
export const bradburyBuildingStreet = (o) => bradburyBuilding(o, nativeFrame, 2);
const surfaces = {
  brick: { slot: 'wall', graph: 'brick_longformat', roughness: 0.94, metallic: 0 },
  terra: { slot: 'trim', graph: 'concrete_plain', roughness: 0.9, metallic: 0 },
  stone: { slot: 'wall', graph: 'stone_granite', roughness: 0.94, metallic: 0 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.76, metallic: 0.1 },
  glass: { slot: 'window', localRef: ref, roughness: 0.4, metallic: 0.04 },
  wood: { slot: 'trim', graph: 'wood_plain', roughness: 0.88, metallic: 0 },
  roof: { slot: 'roof', graph: 'concrete_plain', roughness: 0.94, metallic: 0 },
};
export const bradburyBuildingModel = {
  id: 'bradbury_building',
  key: 'bradbury_building',
  recipe: 'structure-bradbury-building.mjs',
  cell: '9q/9q5',
  title: 'Bradbury Building',
  build: bradburyBuilding,
  surfaces,
  brief:
    'Five-storey brick and terracotta exterior on native concave Broadway/Third Street plan, chamfered corner, paired rectangular middle windows and round upper windows, broad retail ground floor with arched Broadway portal, bracketed cornice, metal fire escapes, flat roof with opaque glazed ridge skylight and chimney. Exclude neighboring buildings, temporary retail signs, street scenery and navigable atrium.',
  camera: [74, 48, -84],
  lookAt: [0, 12, 0],
  portableGroundY: -0.3,
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  quality: 'medium-fi-exterior',
  reviewStatus: 'medium-fi-exterior-source-preview-reviewed-in-qa',
  geographicStatus: 'bounded-preview',
  groundContactBasis:
    'Native concave plan and dry Broadway entrance datum fixed before USGS CA_LosAngeles_B23 locked raster127960 was frozen and independently reproduced. Datum86.3604m; approximately1m export source. Photographic raised threshold.45m and wall base-.65m; no terrain flattening or fitting. Source-relative preview, not survey or another host DEM acceptance.',
  qaCameras: [
    { name: 'broadway-portal', position: [2.8, 3, -39], lookAt: [2.8, 2.5, -29] },
    { name: 'broadway-front', position: [-30, 16, -65], lookAt: [0, 12, -28] },
    { name: 'street-corner', position: [49, 14, -62], lookAt: [14, 13, -22] },
    { name: 'third-street', position: [61, 15, 18], lookAt: [19, 12, 0] },
    { name: 'upper-arches-cornice', position: [33, 28, -40], lookAt: [16, 23, -24] },
    { name: 'rear-return', position: [-58, 25, 39], lookAt: [-12, 14, 13] },
    { name: 'rooflight', position: [-32, 57, 36], lookAt: [0, 26, 0] },
  ],
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-bradbury-building.mjs',
    level: 'skyline',
    export: 'bradburyBuildingSkyline',
    errorMeters: 2,
    surfaces,
    authoredLevels: {
      district: { export: 'bradburyBuildingDistrict', errorMeters: 1.1, surfaces },
      street: { export: 'bradburyBuildingStreet', errorMeters: 0.4, surfaces },
    },
  },
  limitations: [
    'Photographic medium-fi exterior; native quantized2105.96m²plan and25.8mmapheight are controls rather than survey dimensions.',
    'Exact bay spacing, relief artwork, fire-escape details, unseen rear levels and ridge skylight position are estimates. Opaque glazing excludes interior reconstruction.',
    'USGS source field retained unchanged. One-metre source/export is not surveyed sidewalk/foundation accuracy or default Earth terrain certification.',
    'Photo pixels are reference-only; ordinary shared catalog graphs provide materials. No generic footprint replacement or full-site terrain pad.',
  ],
};
