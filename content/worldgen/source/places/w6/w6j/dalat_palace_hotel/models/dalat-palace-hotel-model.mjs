/** Original mapped hotel main building; native plan and cleared creator-PD exterior references. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import fs from 'node:fs';
import {
  cross,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';

const p = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url))),
  f = JSON.parse(fs.readFileSync(new URL('../map-frame.json', import.meta.url))),
  A = p.parameters.architecturalSections;
const C = {
  wall: rgb('e3dfbb'),
  stone: rgb('a49f87'),
  roof: rgb('76574a'),
  metal: rgb('666260'),
  glass: rgb('303e3c'),
  shutter: rgb('34453f'),
};
export const surfaces = {
  wall: { slot: 'wall', graph: 'concrete_plain', roughness: 0.94, metallic: 0 },
  stone: { slot: 'foundation', graph: 'stone_limestone_raw', roughness: 0.95, metallic: 0 },
  roof: { slot: 'roof', graph: 'tile_flat', roughness: 0.91, metallic: 0 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.79, metallic: 0.15 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.47, metallic: 0.08 },
};
const sub = (a, b) => a.map((v, i) => v - b[i]),
  dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0),
  identity = (q) => q;
function T(o, k, q, n, col = C[k]) {
  q = q.map((v) => v.map(Math.fround));
  const c = cross(sub(q[1], q[0]), sub(q[2], q[0]));
  if (Math.hypot(...c) < 1e-8) return;
  if (n && dot(c, n) < 0) [q[1], q[2]] = [q[2], q[1]];
  const N = normalFor(...q);
  o.addTriangle(
    k,
    'palette:#ffffff',
    q,
    N,
    q.map((v) =>
      Math.abs(N[1]) > 0.65 ? [v[0], v[2]] : [Math.abs(N[0]) > 0.65 ? v[2] : v[0], v[1]],
    ),
    col,
  );
}
function Q(o, k, q, n, col) {
  T(o, k, q.slice(0, 3), n, col);
  T(o, k, [q[0], q[2], q[3]], n, col);
}
function box(o, k, lo, hi, P = identity, col) {
  const [x, y, z] = lo,
    [X, Y, Z] = hi;
  for (const q of [
    [
      [x, y, z],
      [x, y, Z],
      [X, y, Z],
      [X, y, z],
    ],
    [
      [x, Y, Z],
      [x, Y, z],
      [X, Y, z],
      [X, Y, Z],
    ],
    [
      [x, y, Z],
      [x, Y, Z],
      [X, Y, Z],
      [X, y, Z],
    ],
    [
      [X, y, z],
      [X, Y, z],
      [x, Y, z],
      [x, y, z],
    ],
    [
      [x, y, z],
      [x, Y, z],
      [x, Y, Z],
      [x, y, Z],
    ],
    [
      [X, y, Z],
      [X, Y, Z],
      [X, Y, z],
      [X, y, z],
    ],
  ])
    Q(o, k, q.map(P).reverse(), null, col);
}
/** Ear clipping keeps the swept, slightly concave wing boundary intact. */
function triangulate(ring) {
  const cross2 = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  const ids = ring.map((_, i) => i);
  const area = ring.reduce((s, a, i) => {
    const b = ring[(i + 1) % ring.length];
    return s + a[0] * b[1] - b[0] * a[1];
  }, 0);
  if (area < 0) ids.reverse();
  const triangles = [];
  while (ids.length > 3) {
    let found = false;
    for (let j = 0; j < ids.length; j++) {
      const a = ids[(j + ids.length - 1) % ids.length],
        b = ids[j],
        c = ids[(j + 1) % ids.length];
      if (cross2(ring[a], ring[b], ring[c]) < 1e-10) continue;
      if (
        ids.some(
          (k) =>
            k !== a &&
            k !== b &&
            k !== c &&
            cross2(ring[a], ring[b], ring[k]) >= -1e-10 &&
            cross2(ring[b], ring[c], ring[k]) >= -1e-10 &&
            cross2(ring[c], ring[a], ring[k]) >= -1e-10,
        )
      )
        continue;
      triangles.push([a, b, c]);
      ids.splice(j, 1);
      found = true;
      break;
    }
    if (!found) throw Error('Invalid swept wing profile');
  }
  triangles.push(ids);
  return triangles;
}
const nativeRing = f.geometry.outline.slice(0, -1),
  upperRing = nativeRing.flatMap((q, i) =>
    i === 2
      ? [
          [q[0], A.mainFrontSetbackZ],
          [-6.7, A.mainFrontSetbackZ],
          [-6.7, A.centralFrontZ],
          [6.7, A.centralFrontZ],
          [6.7, A.mainFrontSetbackZ],
        ]
      : i === 3
        ? [[q[0], A.mainFrontSetbackZ]]
        : [q],
  );
export const openingEvidence = [];
function planar(o, k, ring, y, up = true) {
  for (const ids of triangulate(ring))
    T(
      o,
      k,
      ids.map((i) => [ring[i][0], y, ring[i][1]]),
      [0, up ? 1 : -1, 0],
    );
}
function clipX(ring, edge, greater) {
  const r = [];
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length],
      inside = (q) => (greater ? q[0] >= edge : q[0] <= edge),
      ia = inside(a),
      ib = inside(b);
    if (ia) r.push(a);
    if (ia !== ib) {
      const t = (edge - a[0]) / (b[0] - a[0]);
      r.push([edge, a[1] + t * (b[1] - a[1])]);
    }
  }
  return r;
}
function sectionEdges(ring) {
  const edges = [];
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length],
      ts = [0, 1];
    for (const x of [-A.mainHalfWidth, A.mainHalfWidth]) {
      const t = (x - a[0]) / (b[0] - a[0]);
      if (t > 1e-6 && t < 1 - 1e-6) ts.push(t);
    }
    ts.sort((a, b) => a - b);
    for (let j = 1; j < ts.length; j++) {
      const P = (t) => a.map((v, k) => v + t * (b[k] - v)),
        v = P(ts[j - 1]),
        w = P(ts[j]),
        h = Math.abs((v[0] + w[0]) / 2) <= A.mainHalfWidth + 1e-6 ? A.mainEave : A.wingEave;
      edges.push({ a: v, b: w, height: h });
    }
  }
  return edges;
}
function wall(o, a, b, y0, y1, lod, { ground = false } = {}) {
  const L = Math.hypot(...sub(b, a));
  if (L < 0.08) return;
  const u = sub(b, a).map((v) => v / L),
    n = [u[1], 0, -u[0]],
    P = ([x, y, d]) => [a[0] + u[0] * x + n[0] * d, y, a[1] + u[1] * x + n[2] * d],
    rect = (k, x0, Y0, x1, Y1, z = 0, col) => {
      if (x1 - x0 < 0.001 || Y1 - Y0 < 0.001) return;
      Q(
        o,
        k,
        [
          [x0, Y0, z],
          [x1, Y0, z],
          [x1, Y1, z],
          [x0, Y1, z],
        ].map(P),
        n,
        col,
      );
    },
    count = Math.max(1, Math.floor(L / (ground ? (lod === 1 ? 3.2 : 2.65) : 3.0))),
    spacing = L / count,
    centers = Array.from({ length: count }, (_, i) => spacing * (i + 0.5)),
    rows = A.rows
      .filter(([lo, hi]) => lo >= y0 && hi < y1)
      .map((r) => (ground && a[1] < -17 && b[1] < -17 ? [0, 3.1] : r)),
    front = ground && a[1] < -17 && b[1] < -17;
  if (lod === 0) {
    rect('wall', 0, y0, L, y1);
    if (L > 2.4)
      for (const [lo, hi] of rows)
        for (const x of centers)
          rect(
            'glass',
            x - Math.min(0.6, spacing * 0.25),
            lo,
            x + Math.min(0.6, spacing * 0.25),
            hi,
            0.012,
          );
    return;
  }
  let y = y0;
  for (const [lo, hi] of rows) {
    rect('wall', 0, y, L, lo);
    let last = 0;
    for (const x of centers) {
      const worldX = a[0] + u[0] * x,
        isDoor = front && Math.abs(worldX) < spacing / 2,
        w = isDoor ? 2.3 : Math.min(1.45, spacing * 0.57),
        h0 = isDoor ? 0 : ground && front ? 0.65 : lo,
        h1 = isDoor ? 3.1 : ground && front ? 2.95 : hi,
        d = isDoor ? A.doorDepth : A.recessDepth;
      rect('wall', last, lo, x - w / 2, hi);
      if (h0 > lo) rect('wall', x - w / 2, lo, x + w / 2, h0);
      if (h1 < hi) rect('wall', x - w / 2, h1, x + w / 2, hi);
      const corners = [
        [x - w / 2, h0],
        [x + w / 2, h0],
        [x + w / 2, h1],
        [x - w / 2, h1],
      ];
      for (let k = 0; k < 4; k++) {
        const v = corners[k],
          q = corners[(k + 1) % 4];
        Q(
          o,
          'wall',
          [
            [...v, 0],
            [...q, 0],
            [...q, -d],
            [...v, -d],
          ].map(P),
        );
      }
      rect('glass', x - w / 2, h0, x + w / 2, h1, -d);
      openingEvidence.push({
        center: P([x, (h0 + h1) / 2, 0]),
        normal: n,
        depth: d,
        type: isDoor ? 'door' : 'window',
      });
      if (lod >= 2) {
        for (const side of [-1, 1]) {
          const sx = x + side * (w / 2 + 0.09);
          if (lod === 2) rect('wall', sx - 0.055, h0 - 0.06, sx + 0.055, h1 + 0.08, 0.035);
          else box(o, 'wall', [sx - 0.055, h0 - 0.06, -0.01], [sx + 0.055, h1 + 0.08, 0.07], P);
          if (!ground) {
            const sw = w * 0.32,
              shutterX = x + side * (w * 0.34),
              z = -d + 0.025;
            rect('metal', shutterX - sw / 2, h0, shutterX + sw / 2, h1, z, C.shutter);
            const slats = lod === 2 ? 6 : 12;
            for (let j = 0; j < slats; j++) {
              const yy = h0 + 0.13 + ((h1 - h0 - 0.24) * (j + 0.5)) / slats;
              Q(
                o,
                'metal',
                [
                  [shutterX - sw / 2 + 0.03, yy, z + 0.012],
                  [shutterX + sw / 2 - 0.03, yy, z + 0.012],
                  [shutterX + sw / 2 - 0.03, yy + 0.035, z + 0.035],
                  [shutterX - sw / 2 + 0.03, yy + 0.035, z + 0.035],
                ].map(P),
                n,
                rgb('49574d'),
              );
            }
          }
        }
        box(o, 'wall', [x - w / 2 - 0.1, h0 - 0.12, -0.01], [x + w / 2 + 0.1, h0 - 0.04, 0.14], P);
        if (!ground) rect('metal', x - 0.025, h0, x + 0.025, h1, -d + 0.035, C.shutter);
      }
      last = x + w / 2;
    }
    rect('wall', last, lo, L, hi);
    y = hi;
  }
  rect('wall', 0, y, L, y1);
}
function hip(o, x0, x1, z0, z1, y, rise) {
  const shrink = Math.min((x1 - x0) * 0.25, (z1 - z0) * 0.48),
    a = [x0, y, z0],
    b = [x1, y, z0],
    c = [x1, y, z1],
    d = [x0, y, z1],
    l = [x0 + shrink, y + rise, (z0 + z1) / 2],
    r = [x1 - shrink, y + rise, (z0 + z1) / 2];
  Q(o, 'roof', [a, b, r, l], [0, 1, -1]);
  Q(o, 'roof', [c, d, l, r], [0, 1, 1]);
  T(o, 'roof', [d, a, l], [-1, 1, 0]);
  T(o, 'roof', [b, c, r], [1, 1, 0]);
}
function bracket(o, x, z, y, lod) {
  const depth = 0.65,
    width = 0.16,
    profile =
      lod === 1
        ? [
            [0, 0],
            [depth, 0],
            [0.1, -1.15],
            [0, -1.15],
          ]
        : [
            [0, 0],
            [depth, 0],
            [depth * 0.9, -0.18],
            [depth * 0.68, -0.3],
            [depth * 0.45, -0.55],
            [depth * 0.3, -0.9],
            [0.16, -1.15],
            [0, -1.15],
          ];
  const P = ([d, Y, s]) => [x + s, y + Y, z - d];
  for (const side of [-1, 1])
    for (const ids of triangulate(profile))
      T(
        o,
        'wall',
        ids.map((i) => P([...profile[i], side * width])),
        [side, 0, 0],
      );
  for (let i = 0; i < profile.length; i++) {
    const a = profile[i],
      b = profile[(i + 1) % profile.length];
    Q(
      o,
      'wall',
      [
        [...a, -width],
        [...b, -width],
        [...b, width],
        [...a, width],
      ]
        .map(P)
        .reverse(),
    );
  }
}
function parapet(o, x0, x1, z, lod, y = A.mainEave) {
  box(o, 'wall', [x0, y - 0.12, z - 0.4], [x1, y + 0.08, z + 0.2]);
  if (lod === 0) {
    box(o, 'wall', [x0, y, z - 0.13], [x1, y + 0.7, z + 0.13]);
    return;
  }
  const N = Math.max(1, Math.floor((x1 - x0) / 3.4)),
    step = (x1 - x0) / N;
  for (let i = 0; i < N; i++) {
    const a = x0 + i * step,
      b = a + step;
    box(o, 'wall', [a, y, z - 0.13], [a + 0.48, y + 1, z + 0.13]);
    box(o, 'wall', [a + 0.48, y, z - 0.13], [b, y + 0.2, z + 0.13]);
    box(o, 'wall', [a + 0.48, y + 0.85, z - 0.13], [b, y + 1, z + 0.13]);
    const count = lod === 1 ? 1 : 5;
    for (let j = 0; j < count; j++) {
      const x = a + 0.65 + ((j + 0.5) * (step - 0.85)) / count;
      box(o, 'wall', [x - 0.04, y + 0.2, z - 0.055], [x + 0.04, y + 0.85, z + 0.055]);
    }
  }
  box(o, 'wall', [x0, y + 0.98, z - 0.2], [x1, y + 1.1, z + 0.2]);
}
function awning(o, x0, x1, z, y, lod, depth = 1.65) {
  const N = [2, 4, 6, 10][lod],
    profile = Array.from({ length: N + 1 }, (_, i) => {
      const a = ((i / N) * Math.PI) / 2;
      return [z - depth * Math.sin(a), y - 0.6 * (1 - Math.cos(a))];
    });
  for (let i = 1; i < profile.length; i++) {
    const [a, Y] = profile[i - 1],
      [b, Z] = profile[i];
    Q(
      o,
      'metal',
      [
        [x0, Y, a],
        [x1, Y, a],
        [x1, Z, b],
        [x0, Z, b],
      ],
      [0, 1, -1],
    );
  }
  Q(
    o,
    'metal',
    [
      [x0, y - 0.6, z - depth],
      [x1, y - 0.6, z - depth],
      [x1, y - 0.85, z - depth],
      [x0, y - 0.85, z - depth],
    ],
    [0, 0, -1],
  );
  if (lod >= 1)
    for (const x of [x0, x1])
      box(o, 'metal', [x - 0.035, 0, z - depth], [x + 0.035, y - 0.6, z - depth + 0.07]);
}
export function buildDalat(o, _frame = null, lod = 3) {
  openingEvidence.length = 0;
  for (let i = 0; i < nativeRing.length; i++)
    wall(o, nativeRing[i], nativeRing[(i + 1) % nativeRing.length], 0, A.groundCornice, lod, {
      ground: true,
    });
  planar(o, 'wall', nativeRing, 0, false);
  planar(o, 'wall', nativeRing, A.groundCornice);
  for (const e of sectionEdges(upperRing)) wall(o, e.a, e.b, A.groundCornice, e.height, lod);
  const highCore = clipX(clipX(upperRing, -A.mainHalfWidth, true), A.mainHalfWidth, false);
  for (let i = 0; i < highCore.length; i++) {
    const a = highCore[i],
      b = highCore[(i + 1) % highCore.length];
    if (Math.abs(a[0] - b[0]) < 1e-7 && Math.abs(Math.abs(a[0]) - A.mainHalfWidth) < 1e-7)
      wall(o, a, b, A.wingEave, A.mainEave, lod);
  }
  for (const [lo, hi, h] of [
    [-100, -A.mainHalfWidth, A.wingEave],
    [-A.mainHalfWidth, A.mainHalfWidth, A.mainEave],
    [A.mainHalfWidth, 100, A.wingEave],
  ]) {
    const r = clipX(clipX(upperRing, lo, true), hi, false);
    planar(o, 'wall', r, h);
  }
  hip(o, -48.8, -24.3, -9.3, 7.85, A.wingEave, 0.1 + A.hipRise);
  hip(o, 24.3, 49.05, -7.6, 8.95, A.wingEave, 0.1 + A.hipRise);
  hip(o, -23.6, 23.6, -12.9, 11.4, A.mainEave, 0.95);
  parapet(o, -24.6, -6.7, A.mainFrontSetbackZ, lod);
  parapet(o, 6.7, 24.6, A.mainFrontSetbackZ, lod);
  box(
    o,
    'wall',
    [-6.7, A.mainEave, A.centralFrontZ - 0.2],
    [6.7, A.mainEave + 0.32, A.centralFrontZ + 0.3],
  );
  box(o, 'wall', [-6.7, A.mainEave, A.centralFrontZ - 0.08], [6.7, 13.45, A.centralFrontZ + 0.22]);
  box(
    o,
    'wall',
    [-3.7, 13.4, A.centralFrontZ - 0.08],
    [3.7, A.centralCrown, A.centralFrontZ + 0.22],
  );
  // Rear and side parapet edges remain bounded interpretations, independent of lawns or terrain.
  if (lod >= 1) {
    for (const x of [-21, -18, -15, -12, -9, 9, 12, 15, 18, 21])
      bracket(o, x, A.mainFrontSetbackZ, A.mainEave, lod);
    for (const x of [-5.7, -4.8, 4.8, 5.7]) bracket(o, x, A.centralFrontZ, A.mainEave, lod);
    box(o, 'wall', [-3.2, 7.25, A.centralFrontZ - 1.0], [3.2, 7.55, A.centralFrontZ + 0.08]);
    box(o, 'wall', [-3.2, 7.55, A.centralFrontZ - 0.98], [3.2, 8.2, A.centralFrontZ - 0.8]);
    for (const x of [-2.7, 2.7]) bracket(o, x, A.centralFrontZ, 7.25, lod);
  }
  box(o, 'wall', [-24.8, 3.55, -18], [24.8, 4.05, -17.55]);
  awning(o, -24, -3, -17.8, 3.5, lod);
  awning(o, 3, 24, -17.8, 3.5, lod);
  awning(o, -2.2, 2.2, -17.8, 3.5, lod, 2.2);
  // Only the immediate entry flight and its masonry cheeks are intrinsic to this asset.
  const N = [4, 9, 13, 18][lod],
    z0 = A.entranceStairFrontZ,
    z1 = A.entranceStairBackZ;
  for (let i = 0; i < N; i++) {
    const t = (i + 1) / N;
    box(
      o,
      'stone',
      [-7.5, A.entranceStairBottom, z0 + (i * (z1 - z0)) / N],
      [7.5, A.entranceStairBottom * (1 - t), z1],
    );
  }
  for (const side of [-1, 1]) {
    const x = side * 7.8,
      Q0 = [
        [x - 0.18, A.entranceStairBottom, z0],
        [x + 0.18, A.entranceStairBottom, z0],
        [x + 0.18, 0.65, z1],
        [x - 0.18, 0.65, z1],
      ];
    Q(o, 'wall', Q0, [0, 1, 0]);
    T(
      o,
      'stone',
      [
        [x - 0.18, A.entranceStairBottom, z0],
        [x - 0.18, 0.65, z1],
        [x - 0.18, A.entranceStairBottom, z1],
      ],
      [-1, 0, 0],
    );
    T(
      o,
      'stone',
      [
        [x + 0.18, A.entranceStairBottom, z1],
        [x + 0.18, 0.65, z1],
        [x + 0.18, A.entranceStairBottom, z0],
      ],
      [1, 0, 0],
    );
  }
  if (lod >= 2)
    for (const x of [-25.4, 25.4]) {
      box(o, 'wall', [x - 0.12, 0, -13.5], [x + 0.12, 3.2, -13.26]);
      awning(o, x - 2.3, x + 2.3, -9, 3.2, lod, 3.8);
    }
}
export const dalatSkyline = (o) => buildDalat(o, null, 0),
  dalatDistrict = (o) => buildDalat(o, null, 1),
  dalatStreet = (o) => buildDalat(o, null, 2),
  dalatCloseup = (o) => buildDalat(o, null, 3);
export const dalatModel = {
  id: 'dalat_palace_hotel',
  key: 'dalat_palace_hotel',
  cell: 'w6/w6j',
  title: 'Dalat Palace Hotel',
  wikidataId: 'Q5210229',
  recipe: 'dalat-palace-hotel-model.mjs',
  progressLedger: 'qualla-002.PROGRESS.md',
  category: 'hotel',
  brief:
    'Whole original mapped main building with native16control plan/signed bearing: cream stepped Art Deco front/crown, dark green shuttered physical windowrecesses, lower hipped-roof endwings, original rear projections, long bracketed cornices/central balcony, real open baluster parapets, glazed ground veranda/curved dark canopies and immediate stone entrance flight. Detached modern hotel/conference blocks/property grounds and interiors excluded; hidden elevations/sections/census bounded.',
  surfaces,
  build: buildDalat,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis: p.sectionBasis,
  camera: [82, 42, -100],
  lookAt: [0, 5, 0],
  portableGroundY: -2.9,
  mediumFiContext: { scale: '1', groundY: -2.9 },
  qaCameras: [
    {
      name: 'whole-lake-facing-art-deco-facade-and-lower-endwings',
      position: [66, 32, -90],
      lookAt: [0, 5, 0],
    },
    {
      name: 'whole-native-rear-projections-and-roof-envelopes',
      position: [-75, 38, 92],
      lookAt: [0, 5, 0],
    },
    {
      name: 'stepped-crown-open-parapet-cornice-brackets-and-shutters',
      position: [17, 16, -33],
      lookAt: [0, 9, -12],
    },
    {
      name: 'veranda-curved-canopies-closed-entrance-and-immediate-steps',
      position: [15, 7, -43],
      lookAt: [0, 2, -17],
    },
    { name: 'whole-native-plan-and-hipped-end-roofs', position: [23, 115, -12], lookAt: [0, 2, 0] },
  ],
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/dalat-palace-runtime-overlay.mjs',
    level: 'skyline',
    export: 'dalatSkyline',
    errorMeters: 1.6,
    surfaces,
    authoredLevels: {
      district: { export: 'dalatDistrict', errorMeters: 0.5, surfaces },
      street: { export: 'dalatStreet', errorMeters: 0.25, surfaces },
      closeup: { export: 'dalatCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: [
    p.geometryBasis,
    p.sectionBasis,
    'Five exact already-published2011Own/PD-self exterior originals by Diane Selwyn only.016 lacks bound local publicdomain basis and is unselected/not used; protected photos/interiors/former1920s facade/modern additions unselected. No copied image pixels/generated bitmap/article/media/rightsmetadata repair. Hidden rear elevations/roof stations/window census/baluster profiles/slat positions/finish are original bounded estimates. No garden/road/site plate/long axial stairwalk/trees/car/people/interior/signage.',
    'Independent400m129x129 field/16641values/one raw tile frozen before floor0 and all architecture. Fixed1507.9154m SW provider datum unchanged. Construction-grade foundation/threshold contact unsurveyed, geographic preview/replaceFootprint=false; no terrain fit/flatten/reacquire.',
  ],
};
