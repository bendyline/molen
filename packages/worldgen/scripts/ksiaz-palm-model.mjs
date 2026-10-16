/** Original medium-fi exterior of the mapped Lubiechów Palm House and connected glasshouses. */
import './install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import earcut from 'earcut';
import { normalFor } from './authored-structure-mesh.mjs';

export const ksiazPalmModels = [
  {
    id: 'KSI_L01',
    key: 'ksiaz_palm_house',
    title: 'Lubiechów Palm House',
    way: 3532583,
    component: 'palm-house',
    brief:
      'Tall brick-and-glass Palm House with green barrel roof, roof lantern and glazed polygonal porch; connected low glasshouse ranges enclose two true open courtyards.',
    primaryDescription:
      'Own named OSM relation3532583. Operator describes a15m metal/glass hall with surrounding single-storey orangeries and a roof viewing gallery. Current operator photographs support the central facade/roof; unseen glasshouse divisions and dimensions are interpretations.',
    references: ['https://www.ksiaz.walbrzych.pl/turystyka/palmiarnia'],
    cameras: [
      { name: 'main-hall-and-connected-glasshouses', position: [93, 61, 112], lookAt: [0, 4, 0] },
      { name: 'rear-range-and-open-courtyards', position: [-98, 65, -102], lookAt: [0, 3, 0] },
      { name: 'own-footprint-and-courtyard-holes', position: [2, 167, 0], lookAt: [0, 0, 0] },
      { name: 'barrel-roof-piers-and-entrance', position: [24, 15, 51], lookAt: [0, 8, 12] },
    ],
  },
];
export const ksiazPalmSurfaces = {
  brick: { slot: 'wall', graph: 'brick', roughness: 0.88, metallic: 0 },
  plaster: { slot: 'trim', graph: 'plaster_lime', roughness: 0.88, metallic: 0 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.6, metallic: 0.25 },
  glass: { slot: 'window', roughness: 0.58, metallic: 0.04 },
};
export const ksiazPalmPalette = {
  brick: '#bd866c',
  trim: '#eee4c9',
  metal: '#85a87c',
  glass: '#627e87',
  roofGlass: '#829797',
  door: '#b57167',
  base: '#c7bea5',
};
const colors = Object.fromEntries(
  Object.entries(ksiazPalmPalette).map(([k, h]) => [
    k,
    h
      .slice(1)
      .match(/../g)
      .map((v) => {
        const s = parseInt(v, 16) / 255;
        return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
      }),
  ]),
);
const dir = new URL(
    '../../../content/worldgen/source/places/u3/u35/ksiaz_palm_house/',
    import.meta.url,
  ),
  frame = JSON.parse(readFileSync(new URL('map-frame.json', dir))),
  means = JSON.parse(readFileSync(new URL('surface-means.json', dir))),
  h = frame.controls.mainHall;
function face(o, p, col = 'glass', slot = 'glass', target) {
  p = p.map((v) => v.map(Math.fround));
  for (let i = 1; i < p.length - 1; i++) {
    let t = [p[0], p[i], p[i + 1]],
      n = normalFor(...t);
    const a = t[1].map((v, j) => v - t[0][j]),
      b = t[2].map((v, j) => v - t[0][j]);
    if (
      Math.hypot(a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]) <
      1e-8
    )
      continue;
    if (target && n.reduce((s, v, j) => s + v * target[j], 0) < 0) {
      t = [t[0], t[2], t[1]];
      n = normalFor(...t);
    }
    o.addTriangle(
      slot,
      'palette:#ffffff',
      t,
      n,
      t.map((v) => [v[0], v[1]]),
      colors[col],
    );
  }
}
function box(o, x, y, z, w, height, depth, col = 'trim', slot = 'plaster') {
  const a = x - w / 2,
    b = x + w / 2,
    u = z - depth / 2,
    v = z + depth / 2,
    t = y + height;
  for (const [p, n] of [
    [
      [
        [a, y, v],
        [b, y, v],
        [b, t, v],
        [a, t, v],
      ],
      [0, 0, 1],
    ],
    [
      [
        [b, y, u],
        [a, y, u],
        [a, t, u],
        [b, t, u],
      ],
      [0, 0, -1],
    ],
    [
      [
        [a, y, u],
        [a, y, v],
        [a, t, v],
        [a, t, u],
      ],
      [-1, 0, 0],
    ],
    [
      [
        [b, y, v],
        [b, y, u],
        [b, t, u],
        [b, t, v],
      ],
      [1, 0, 0],
    ],
    [
      [
        [a, t, u],
        [b, t, u],
        [b, t, v],
        [a, t, v],
      ],
      [0, 1, 0],
    ],
  ])
    face(o, p, col, slot, n);
}
function cap(o, outline, holes, y, col = 'base', slot = 'plaster', target = [0, 1, 0]) {
  const rings = [outline, ...holes].map((r) => r.slice(0, -1)),
    all = rings.flat(),
    indices = [];
  let offset = rings[0].length;
  for (const r of rings.slice(1)) {
    indices.push(offset);
    offset += r.length;
  }
  const ix = earcut(all.flat(), indices);
  for (let i = 0; i < ix.length; i += 3)
    face(
      o,
      ix.slice(i, i + 3).map((k) => [all[k][0], y, all[k][1]]),
      col,
      slot,
      target,
    );
}
function perimeter(o, loop, top, base = 0, col = 'glass', slot = 'glass', inward = false) {
  let area = 0;
  for (let i = 1; i < loop.length; i++)
    area += loop[i - 1][0] * loop[i][1] - loop[i][0] * loop[i - 1][1];
  for (let i = 1; i < loop.length; i++) {
    const a = loop[i - 1],
      b = loop[i],
      dx = b[0] - a[0],
      dz = b[1] - a[1],
      sgn = Math.sign(area) * (inward ? -1 : 1);
    face(
      o,
      [
        [a[0], base, a[1]],
        [b[0], base, b[1]],
        [b[0], top, b[1]],
        [a[0], top, a[1]],
      ],
      col,
      slot,
      [sgn * dz, 0, -sgn * dx],
    );
  }
}
function clip(poly, axis, value, sign) {
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i],
      b = poly[(i + 1) % poly.length],
      da = sign * (a[axis] - value),
      db = sign * (b[axis] - value);
    if (da >= -1e-8) out.push(a);
    if ((da > 1e-8 && db < -1e-8) || (da < -1e-8 && db > 1e-8)) {
      const t = da / (da - db);
      out.push(a.map((v, j) => v + (b[j] - v) * t));
    }
  }
  return out;
}
/** Roof domains are clipped to the attributed polygon, preserving both open courtyards. */
function clippedRoof(o, d) {
  const rings = [frame.geometry.outline, ...frame.geometry.holes].map((r) => r.slice(0, -1)),
    all = rings.flat(),
    holes = [];
  let k = rings[0].length;
  for (const r of rings.slice(1)) {
    holes.push(k);
    k += r.length;
  }
  const ix = earcut(all.flat(), holes),
    strips = d === 0 ? 1 : 5,
    left = Array.from({ length: strips * 2 + 1 }, (_, i) => -54 + (i * 42) / strips / 2),
    right = Array.from({ length: strips * 2 + 1 }, (_, i) => 12 + (i * 42) / strips / 2),
    curve = Array.from(
      { length: d >= 2 ? 11 : d === 1 ? 7 : 5 },
      (_, i) => h.minZ + ((h.maxZ - h.minZ) * i) / (d >= 2 ? 10 : d === 1 ? 6 : 4),
    ),
    xs = (
      d === 0
        ? [-54, -3.8, 0, 3.7, h.minX, h.maxX, 54]
        : [
            ...new Set([
              -54,
              -50,
              -46.3,
              -34.6,
              -12.4,
              h.minX,
              -3.8,
              0,
              3.7,
              h.maxX,
              12.4,
              34,
              46.38,
              50,
              54,
              ...left,
              ...right,
            ]),
          ]
    ).sort((a, b) => a - b),
    zs = (
      d === 0
        ? [-32, ...curve, 22.1, 31.75]
        : [
            ...new Set([
              -32,
              -29,
              -26.6,
              -17,
              -14,
              -11.1,
              4.439,
              5.2,
              10.831,
              11.244,
              17.414,
              22.1,
              31.75,
              ...curve,
            ]),
          ]
    ).sort((a, b) => a - b),
    arch = (z) =>
      h.eave +
      (h.crown - h.eave) *
        Math.sqrt(
          Math.max(0, 1 - Math.pow((z - (h.minZ + h.maxZ) / 2) / ((h.maxZ - h.minZ) / 2), 2)),
        );
  function roof(x, z, cx, cz) {
    if (cx >= h.minX && cx <= h.maxX && cz >= h.minZ && cz <= h.maxZ) return arch(z);
    if (Math.abs(cx) < 3.4 && cz > 17.414) return 3.8;
    if (d === 0) return 2.9;
    let dist;
    if (cz < -26.6) dist = Math.abs(z + 29) / 2.6;
    else if (cz >= 4.439 && Math.abs(cx) >= 12) {
      const start = cx < 0 ? -54 : 12,
        pitch = 42 / strips,
        j = Math.floor((cx - start) / pitch),
        center = start + (j + 0.5) * pitch;
      dist = Math.abs(x - center) / (pitch / 2);
    } else if (Math.abs(cx) > 46.3) dist = Math.abs(Math.abs(x) - 50) / 3.7;
    else if (cz < -11.1 && cz >= -17 && Math.abs(cx) > 3.7) dist = Math.abs(z + 14) / 3;
    else if (Math.abs(cx) < 3.8) dist = Math.abs(x) / 3.8;
    else dist = 1;
    return 2.35 + (cz < -26.6 ? 1.55 : 2.15) * Math.max(0, 1 - dist);
  }
  for (let i = 0; i < ix.length; i += 3) {
    const tri = ix.slice(i, i + 3).map((j) => all[j]),
      minX = Math.min(...tri.map((p) => p[0])),
      maxX = Math.max(...tri.map((p) => p[0])),
      minZ = Math.min(...tri.map((p) => p[1])),
      maxZ = Math.max(...tri.map((p) => p[1]));
    for (let a = 1; a < xs.length; a++) {
      if (xs[a] <= minX || xs[a - 1] >= maxX) continue;
      const p = clip(clip(tri, 0, xs[a - 1], 1), 0, xs[a], -1);
      if (p.length < 3) continue;
      for (let b = 1; b < zs.length; b++) {
        if (zs[b] <= minZ || zs[b - 1] >= maxZ) continue;
        const q = clip(clip(p, 1, zs[b - 1], 1), 1, zs[b], -1);
        if (q.length < 3) continue;
        const cx = (xs[a] + xs[a - 1]) / 2,
          cz = (zs[b] + zs[b - 1]) / 2;
        face(
          o,
          q.map(([x, z]) => [x, roof(x, z, cx, cz), z]),
          'roofGlass',
          'glass',
          [0, 1, 0],
        );
      }
    }
  }
  if (d === 0) return;
  // Close the roof's boundary above the low wall, including greenhouse gable ends.
  for (const [loop, inward] of [
    [frame.geometry.outline, false],
    ...frame.geometry.holes.map((r) => [r, true]),
  ]) {
    let area = 0;
    for (let i = 1; i < loop.length; i++)
      area += loop[i - 1][0] * loop[i][1] - loop[i][0] * loop[i - 1][1];
    for (let i = 1; i < loop.length; i++) {
      const a = loop[i - 1],
        b = loop[i],
        dx = b[0] - a[0],
        dz = b[1] - a[1],
        length = Math.hypot(dx, dz);
      if (length < 1e-6) continue;
      const sg = Math.sign(area) * (inward ? -1 : 1),
        normal = [(sg * dz) / length, 0, (-sg * dx) / length],
        ts = [0, 1];
      for (const [axis, lines] of [
        [0, xs],
        [1, zs],
      ])
        if (Math.abs(b[axis] - a[axis]) > 1e-8)
          for (const value of lines) {
            const t = (value - a[axis]) / (b[axis] - a[axis]);
            if (t > 0 && t < 1) ts.push(t);
          }
      ts.sort((u, v) => u - v);
      for (let j = 1; j < ts.length; j++) {
        const p = a.map((v, k) => v + (b[k] - v) * ts[j - 1]),
          q = a.map((v, k) => v + (b[k] - v) * ts[j]),
          cx = (p[0] + q[0]) / 2 - normal[0] * 0.0001,
          cz = (p[1] + q[1]) / 2 - normal[2] * 0.0001;
        face(
          o,
          [
            [p[0], 2.35, p[1]],
            [q[0], 2.35, q[1]],
            [q[0], roof(q[0], q[1], cx, cz), q[1]],
            [p[0], roof(p[0], p[1], cx, cz), p[1]],
          ],
          'glass',
          'glass',
          normal,
        );
      }
    }
  }
}
function facade(o, side, d) {
  const front = side === 1,
    z = front ? h.maxZ : h.minZ,
    n = [0, 0, side],
    plane = z + side * 0.04,
    width = h.maxX - h.minX;
  face(
    o,
    [
      [h.minX, 0.6, plane],
      [h.maxX, 0.6, plane],
      [h.maxX, h.eave, plane],
      [h.minX, h.eave, plane],
    ],
    'glass',
    'glass',
    n,
  );
  for (const x of [h.minX + 0.45, -3.05, 2.8, h.maxX - 0.45])
    box(o, x, 0, plane, 0.9, h.eave, 0.34, 'brick', 'brick');
  box(o, (h.minX + h.maxX) / 2, 10.45, z, width + 0.15, 0.5, 0.47);
  box(o, (h.minX + h.maxX) / 2, 11.04, z, width + 0.3, 0.16, 0.6);
  if (d === 0) return;
  const pitch = d === 1 ? 2.6 : d === 2 ? 1.2 : 0.9;
  for (let x = h.minX + 1.4; x < h.maxX - 0.4; x += pitch) {
    face(
      o,
      [
        [x - 0.055, 0.65, plane + side * 0.03],
        [x + 0.055, 0.65, plane + side * 0.03],
        [x + 0.055, 10.45, plane + side * 0.03],
        [x - 0.055, 10.45, plane + side * 0.03],
      ],
      'metal',
      'metal',
      n,
    );
  }
  for (let y = 2.2; y < 10.4; y += d === 1 ? 3.6 : 1.45)
    face(
      o,
      [
        [h.minX, y - 0.05, plane + side * 0.04],
        [h.maxX, y - 0.05, plane + side * 0.04],
        [h.maxX, y + 0.05, plane + side * 0.04],
        [h.minX, y + 0.05, plane + side * 0.04],
      ],
      'metal',
      'metal',
      n,
    );
}
function mainHall(o, d) {
  const w = h.maxX - h.minX,
    depth = h.maxZ - h.minZ,
    x = (h.minX + h.maxX) / 2,
    z = (h.minZ + h.maxZ) / 2;
  box(o, x, 0, z, w, 0.65, depth, 'brick', 'brick');
  facade(o, 1, d);
  facade(o, -1, d);
  const segments = d >= 2 ? 10 : d === 1 ? 6 : 4,
    profile = Array.from({ length: segments + 1 }, (_, i) => {
      const q = i / segments,
        u = 2 * q - 1;
      return [h.minZ + depth * q, h.eave + (h.crown - h.eave) * Math.sqrt(Math.max(0, 1 - u * u))];
    });
  for (const [edge, sgn] of [
    [h.minX, -1],
    [h.maxX, 1],
  ]) {
    face(
      o,
      [
        [edge, 0.65, h.minZ],
        [edge, h.eave, h.minZ],
        [edge, h.eave, h.maxZ],
        [edge, 0.65, h.maxZ],
      ],
      'glass',
      'glass',
      [sgn, 0, 0],
    );
    for (let i = 1; i < profile.length; i++) {
      const a = profile[i - 1],
        b = profile[i];
      face(
        o,
        [
          [edge, h.eave, a[0]],
          [edge, h.eave, b[0]],
          [edge, b[1], b[0]],
          [edge, a[1], a[0]],
        ],
        'roofGlass',
        'glass',
        [sgn, 0, 0],
      );
    }
    box(o, edge, 0, z, 0.65, 10.5, 0.85, 'brick', 'brick');
    box(o, edge, 10.5, z, 0.45, 0.65, depth + 0.2);
    if (d >= 1)
      for (let v = h.minZ + 1; v < h.maxZ; v += d === 1 ? 3 : 1.1)
        face(
          o,
          [
            [edge + sgn * 0.04, 0.65, v - 0.05],
            [edge + sgn * 0.04, 0.65, v + 0.05],
            [edge + sgn * 0.04, 10.5, v + 0.05],
            [edge + sgn * 0.04, 10.5, v - 0.05],
          ],
          'metal',
          'metal',
          [sgn, 0, 0],
        );
  }
  // A short glazed roof lantern and broad viewing-gallery band carry the silhouette.
  box(o, x, 13.7, z, 8.4, 1.05, 3.0, 'glass', 'glass');
  box(o, x, 14.75, z, 8.75, 0.25, 3.4, 'metal', 'metal');
  box(o, x, 13.8, z, 9, 0.12, 3.65, 'metal', 'metal');
  if (d >= 1) {
    const pitch = d === 1 ? 3 : 1.15;
    for (let u = h.minX; u <= h.maxX + 0.001; u += pitch)
      for (let i = 1; i < profile.length; i++) {
        const a = profile[i - 1],
          b = profile[i];
        face(
          o,
          [
            [u - 0.055, a[1] + 0.035, a[0]],
            [u + 0.055, a[1] + 0.035, a[0]],
            [u + 0.055, b[1] + 0.035, b[0]],
            [u - 0.055, b[1] + 0.035, b[0]],
          ],
          'metal',
          'metal',
          [0, 1, 0],
        );
      }
    for (const [v, y] of profile)
      if (y > h.eave + 0.1)
        face(
          o,
          [
            [h.minX, y + 0.04, v - 0.045],
            [h.maxX, y + 0.04, v - 0.045],
            [h.maxX, y + 0.04, v + 0.045],
            [h.minX, y + 0.04, v + 0.045],
          ],
          'metal',
          'metal',
          [0, 1, 0],
        );
    for (const side of [-1, 1])
      for (let u = -4; u <= 4; u += d === 1 ? 2 : 1)
        box(o, x + u, 13.72, z + side * 1.54, 0.1, 1.04, 0.1, 'metal', 'metal');
  }
}
function porch(o, d) {
  const p = frame.controls.porch.outlineIndices.map((i) => frame.geometry.outline[i]),
    loop = [...p, p[0]],
    c = [-0.15, 19.4];
  perimeter(o, loop, 0.6, 0, 'brick', 'brick');
  perimeter(o, loop, 3.8, 0.6);
  for (let i = 0; i < p.length; i++) {
    const a = p[i],
      b = p[(i + 1) % p.length];
    face(
      o,
      [
        [a[0], 3.8, a[1]],
        [b[0], 3.8, b[1]],
        [c[0], 5.4, c[1]],
      ],
      'roofGlass',
      'glass',
      [0, 1, 0],
    );
    box(o, a[0], 0, a[1], 0.28, 3.8, 0.28, 'brick', 'brick');
    if (d >= 1) {
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]),
        n = Math.ceil(len / (d === 1 ? 1.8 : 0.9));
      for (let j = 1; j < n; j++)
        box(
          o,
          a[0] + ((b[0] - a[0]) * j) / n,
          0.6,
          a[1] + ((b[1] - a[1]) * j) / n,
          0.09,
          2.8,
          0.09,
          'metal',
          'metal',
        );
      face(
        o,
        [
          [a[0], 3.85, a[1]],
          [b[0], 3.85, b[1]],
          [b[0], 3.96, b[1]],
          [a[0], 3.96, a[1]],
        ],
        'trim',
        'plaster',
        [b[1] - a[1], 0, a[0] - b[0]],
      );
    }
  }
  const door = frame.controls.mainEntrance;
  box(o, door[0], 0.15, door[1] + 0.06, 1.32, 2.8, 0.1, 'door', 'metal');
  if (d >= 2)
    for (const x of [door[0] - 0.38, door[0] + 0.38])
      box(o, x, 0.65, door[1] + 0.125, 0.48, 1.82, 0.025, 'door', 'metal');
}
function greenhouseFrames(o, d) {
  if (d === 0) return;
  const pitch = d === 1 ? 6 : 2.4;
  for (const [ring, inside] of [
    [frame.geometry.outline, false],
    ...frame.geometry.holes.map((p) => [p, true]),
  ]) {
    let area = 0;
    for (let i = 1; i < ring.length; i++)
      area += ring[i - 1][0] * ring[i][1] - ring[i][0] * ring[i - 1][1];
    for (let i = 1; i < ring.length; i++) {
      const a = ring[i - 1],
        b = ring[i],
        len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (len < 0.6) continue;
      const sg = Math.sign(area) * (inside ? -1 : 1),
        normal = [(sg * (b[1] - a[1])) / len, 0, (-sg * (b[0] - a[0])) / len],
        steps = Math.ceil(len / pitch),
        off = 0.025;
      for (let j = 0; j <= steps; j++) {
        const x = a[0] + ((b[0] - a[0]) * j) / steps + normal[0] * off,
          z = a[1] + ((b[1] - a[1]) * j) / steps + normal[2] * off,
          ux = ((b[0] - a[0]) / len) * 0.05,
          uz = ((b[1] - a[1]) / len) * 0.05;
        face(
          o,
          [
            [x - ux, 0.6, z - uz],
            [x + ux, 0.6, z + uz],
            [x + ux, 2.35, z + uz],
            [x - ux, 2.35, z - uz],
          ],
          'metal',
          'metal',
          normal,
        );
      }
      for (const y of [0.65, 2.27])
        face(
          o,
          [
            [a[0] + normal[0] * off, y, a[1] + normal[2] * off],
            [b[0] + normal[0] * off, y, b[1] + normal[2] * off],
            [b[0] + normal[0] * off, y + 0.09, b[1] + normal[2] * off],
            [a[0] + normal[0] * off, y + 0.09, a[1] + normal[2] * off],
          ],
          'metal',
          'metal',
          normal,
        );
    }
  }
  if (d < 2) return;
  // Merged roof framing follows the low shed planes; no separate mesh per pane.
  for (const start of [-54, 12])
    for (let j = 0; j < 5; j++) {
      const a = start + j * 8.4,
        b = a + 8.4,
        mid = (a + b) / 2;
      for (let z = 5.25; z < 31.45; z += d === 2 ? 3.6 : 2.2) {
        for (const [u, v, yu, yv] of [
          [a, mid, 2.35, 4.5],
          [mid, b, 4.5, 2.35],
        ])
          face(
            o,
            [
              [u, yu + 0.04, z - 0.05],
              [v, yv + 0.04, z - 0.05],
              [v, yv + 0.04, z + 0.05],
              [u, yu + 0.04, z + 0.05],
            ],
            'metal',
            'metal',
            [0, 1, 0],
          );
      }
      for (const [x, y] of [
        [a + 0.04, 2.42],
        [mid, 4.54],
        [b - 0.04, 2.42],
      ])
        face(
          o,
          [
            [x - 0.045, y, 5.25],
            [x + 0.045, y, 5.25],
            [x + 0.045, y, 31.45],
            [x - 0.045, y, 31.45],
          ],
          'metal',
          'metal',
          [0, 1, 0],
        );
    }
}
export function buildKsiazPalm(o, key = 'ksiaz_palm_house', level = 'closeup') {
  if (key !== 'ksiaz_palm_house') throw Error(`Unknown Palm House ${key}`);
  const d = { skyline: 0, district: 1, street: 2, closeup: 3 }[level];
  if (d === undefined) throw Error(`Unknown level ${level}`);
  const { outline, holes } = frame.geometry;
  cap(o, outline, holes, 0, 'base', 'plaster', [0, -1, 0]);
  perimeter(o, outline, 0.6, 0, 'base', 'plaster');
  // Hole rings face inward into the courtyard, regardless of their map winding.
  for (const r of holes) perimeter(o, r, 0.6, 0, 'base', 'plaster', true);
  perimeter(o, outline, d === 0 ? 2.9 : 2.35, 0.6);
  for (const r of holes) perimeter(o, r, d === 0 ? 2.9 : 2.35, 0.6, 'glass', 'glass', true);
  clippedRoof(o, d);
  mainHall(o, d);
  porch(o, d);
  greenhouseFrames(o, d);
}
export function buildKsiazPalmSkyline(o, key) {
  buildKsiazPalm(
    {
      addTriangle: (s, r, p, n, uv, col) =>
        o.addTriangle(
          s,
          r,
          p,
          n,
          uv,
          col.map((v, i) => v * (means[s]?.[i] ?? 1)),
        ),
    },
    key,
    'skyline',
  );
}
