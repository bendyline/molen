/** Entire restored historical hotel, two street wings, accommodation/hall wings and true courtyard. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import fs from 'node:fs';
import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import {
  beam,
  normalFor,
  sphere,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
export const P = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url))),
  H = P.building,
  F = P.facade;
export const surfaces = {
  wall: { slot: 'wall', graph: 'stucco', roughness: 0.92, metallic: 0 },
  foundation: {
    slot: 'foundation',
    graph: 'stone_limestone_weathered',
    roughness: 0.95,
    metallic: 0,
  },
  roof: { slot: 'roof', graph: 'metal_painted', roughness: 0.76, metallic: 0.22 },
  trim: { slot: 'trim', graph: 'plaster_lime', roughness: 0.91, metallic: 0 },
  window: { slot: 'window', graph: 'metal_painted', roughness: 0.53, metallic: 0.2 },
  door: { slot: 'door', graph: 'wood_plain', roughness: 0.85, metallic: 0 },
};
const colors = {
  wall: rgb('c58b84'),
  foundation: rgb('bdb2a0'),
  roof: rgb('687875'),
  trim: rgb('eee5cf'),
  window: rgb('3c555d'),
  door: rgb('514131'),
};
export const componentEvidence = [];
function face(o, k, p, n, tint = colors[k]) {
  let normal = normalFor(...p);
  if (n && normal.reduce((s, v, i) => s + v * n[i], 0) < 0) {
    p = [...p].reverse();
    normal = normalFor(...p);
  }
  o.addConvexPolygon(k, 'palette:#ffffff', p, normal, (q) => [q[0], q[1]], tint);
}
function cap(o, k, ring, y, up) {
  const b = new MeshBufferBuilder();
  if (
    !b.addCap(
      k,
      'palette:#ffffff',
      ring,
      [],
      () => y,
      [0, up, 0],
      (p) => p,
      colors[k],
    )
  )
    throw Error('Invalid whole house cap');
  const m = b.finalize();
  for (let i = 0; i < m.indices.length; i += 3)
    face(
      o,
      k,
      Array.from(m.indices.slice(i, i + 3)).map((j) =>
        Array.from(m.positions.slice(j * 3, j * 3 + 3)),
      ),
      [0, up, 0],
    );
}
function polygon(o, k, r, y0, y1) {
  const sign = Math.sign(
    r.reduce((s, p, i) => {
      const q = r[(i + 1) % r.length];
      return s + p[0] * q[1] - p[1] * q[0];
    }, 0),
  );
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length];
    face(
      o,
      k,
      [
        [a[0], y0, a[1]],
        [b[0], y0, b[1]],
        [b[0], y1, b[1]],
        [a[0], y1, a[1]],
      ],
      [(b[1] - a[1]) * sign, 0, -(b[0] - a[0]) * sign],
    );
  }
  cap(o, k, r, y0, -1);
  cap(o, k, r, y1, 1);
}
const lerp = (a, b, t) => a.map((v, i) => v + t * (b[i] - v)),
  point = (p, y) => [p[0], y, p[1]];
function roofLayer(o, a, b, y0, y1) {
  const area = a.reduce(
      (s, p, i) => s + p[0] * a[(i + 1) % a.length][1] - a[(i + 1) % a.length][0] * p[1],
      0,
    ),
    sign = Math.sign(area);
  for (let i = 0; i < a.length; i++) {
    const j = (i + 1) % a.length;
    face(
      o,
      'roof',
      [point(a[i], y0), point(a[j], y0), point(b[j], y1), point(b[i], y1)],
      [(a[j][1] - a[i][1]) * sign, 1, -(a[j][0] - a[i][0]) * sign],
    );
  }
}
function frameBar(o, a, b, w, lod, n) {
  if (lod > 2) beam(o, 'trim', a, b, w, 0.13, colors.trim);
  else {
    const d = b.map((v, i) => v - a[i]),
      l = Math.hypot(...d),
      u = [
        (((d[1] * n[2] - d[2] * n[1]) / l) * w) / 2,
        (((d[2] * n[0] - d[0] * n[2]) / l) * w) / 2,
        (((d[0] * n[1] - d[1] * n[0]) / l) * w) / 2,
      ];
    face(
      o,
      'trim',
      [
        a.map((v, i) => v + u[i]),
        b.map((v, i) => v + u[i]),
        b.map((v, i) => v - u[i]),
        a.map((v, i) => v - u[i]),
      ],
      n,
    );
  }
}
function opening(o, a, b, t, y, w, h, lod, ornate) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    L = Math.hypot(dx, dz),
    U = [dx / L, dz / L],
    N = [U[1], -U[0]],
    c = lerp(a, b, t),
    p = (u, Y, d = 0.035) => [c[0] + U[0] * u + N[0] * d, Y, c[1] + U[1] * u + N[1] * d],
    n = [N[0], 0, N[1]];
  face(o, 'window', [p(-w / 2, y), p(w / 2, y), p(w / 2, y + h), p(-w / 2, y + h)], n);
  if (!lod) return;
  for (const u of [-w / 2, w / 2]) frameBar(o, p(u, y, 0.11), p(u, y + h, 0.11), 0.12, lod, n);
  for (const Y of [y, y + h])
    frameBar(o, p(-w / 2 - 0.07, Y, 0.12), p(w / 2 + 0.07, Y, 0.12), 0.13, lod, n);
  if (lod > 1) {
    for (const [a, b] of [
      [p(0, y, 0.09), p(0, y + h, 0.09)],
      [p(-w / 2, y + h * 0.62, 0.09), p(w / 2, y + h * 0.62, 0.09)],
    ])
      beam(o, 'door', a, b, 0.045, 0.05, colors.door);
  }
  if (lod > 2 && ornate) {
    const top = y + h + 0.21;
    beam(o, 'trim', p(-w * 0.6, top, 0.18), p(w * 0.6, top, 0.18), 0.17, 0.3, colors.trim);
    for (const side of [-1, 1])
      beam(
        o,
        'trim',
        p(side * w * 0.6, top, 0.18),
        p(0, top + 0.25, 0.18),
        0.11,
        0.15,
        colors.trim,
      );
    sphere(o, 'trim', p(0, top + 0.1, 0.2), [0.12, 0.16, 0.08], colors.trim, 8, 4);
  }
}
function cylinder(o, x, z, y0, y1, r, lod) {
  const n = [4, 6, 10, 16][lod];
  for (const [a, b, R] of [
    [y0, y0 + 0.16, r * 1.4],
    [y0 + 0.16, y1 - 0.2, r],
    [y1 - 0.2, y1, r * 1.5],
  ])
    polygon(
      o,
      'trim',
      Array.from({ length: n }, (_, i) => [
        x + R * Math.cos((i * 2 * Math.PI) / n),
        z + R * Math.sin((i * 2 * Math.PI) / n),
      ]),
      a,
      b,
    );
}
function balcony(o, a, b, t, y, lod) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    L = Math.hypot(dx, dz),
    U = [dx / L, dz / L],
    N = [U[1], -U[0]],
    c = lerp(a, b, t),
    p = (u, Y, d) => [c[0] + U[0] * u + N[0] * d, Y, c[1] + U[1] * u + N[1] * d],
    r = [p(-1.2, y, 0.05), p(1.2, y, 0.05), p(1.2, y, 1.0), p(-1.2, y, 1.0)].map((p) => [
      p[0],
      p[2],
    ]);
  polygon(o, 'trim', r, y - 0.15, y);
  const n = [N[0], 0, N[1]];
  if (!lod) {
    face(
      o,
      'door',
      [p(-1.18, y, 1), p(1.18, y, 1), p(1.18, y + 0.85, 1), p(-1.18, y + 0.85, 1)],
      n,
    );
    return;
  }
  for (const d of [0.08, 1])
    beam(o, 'door', p(-1.18, y + 0.95, d), p(1.18, y + 0.95, d), 0.05, 0.055, colors.door);
  for (const u of [-1.18, 1.18])
    beam(o, 'door', p(u, y + 0.95, 0.08), p(u, y + 0.95, 1), 0.05, 0.055, colors.door);
  const bars = lod === 1 ? 4 : 8;
  for (let i = 0; i <= bars; i++) {
    const u = -1.15 + (2.3 * i) / bars;
    if (lod === 1) frameBar(o, p(u, y + 0.06, 1), p(u, y + 0.93, 1), 0.04, lod, n);
    else beam(o, 'door', p(u, y + 0.06, 1), p(u, y + 0.93, 1), 0.035, 0.035, colors.door);
  }
}
function figure(o, a, b, t, y, lod) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    L = Math.hypot(dx, dz),
    N = [dz / L, -dx / L],
    c = lerp(a, b, t),
    x = c[0] + N[0] * 0.32,
    z = c[1] + N[1] * 0.32,
    n = [4, 6, 8, 10][lod];
  if (!lod) {
    beam(o, 'trim', [x, y, z], [x, y + 1.6, z], 0.3, 0.35, colors.trim);
    return;
  }
  const ring = (_Y, r) =>
    Array.from({ length: n }, (_, i) => [
      x + Math.cos((i * 2 * Math.PI) / n) * r,
      z + Math.sin((i * 2 * Math.PI) / n) * r * 0.65,
    ]);
  polygon(o, 'trim', ring(y, 0.3), y, y + 0.17);
  const low = ring(y + 0.15, 0.27),
    high = ring(y + 1.15, 0.16);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    face(
      o,
      'trim',
      [
        point(low[i], y + 0.15),
        point(low[j], y + 0.15),
        point(high[j], y + 1.15),
        point(high[i], y + 1.15),
      ],
      [Math.cos(((i + 0.5) * 2 * Math.PI) / n), 0, Math.sin(((i + 0.5) * 2 * Math.PI) / n)],
    );
  }
  sphere(o, 'trim', [x, y + 1.35, z], [0.23, 0.36, 0.14], colors.trim, n, 4);
  sphere(o, 'trim', [x, y + 1.85, z], [0.14, 0.18, 0.13], colors.trim, n, 4);
  for (const side of [-1, 1])
    beam(
      o,
      'trim',
      [x + side * 0.17, y + 1.45, z],
      [x + side * 0.24, y + 1.9, z - 0.04],
      0.095,
      0.1,
      colors.trim,
    );
}
function mainFacade(o, band, lod) {
  const i = band.nativeEdge,
    a = band.ring[0],
    b = band.ring[1],
    count = lod ? F.outerBayCounts[i] : 3,
    dx = b[0] - a[0],
    dz = b[1] - a[1],
    L = Math.hypot(dx, dz),
    N = [dz / L, -dx / L],
    c = (t) => lerp(a, b, t),
    at = (t, y, d) => {
      const q = c(t);
      return [q[0] + N[0] * d, y, q[1] + N[1] * d];
    };
  for (let level = 0; level < 3; level++)
    for (let j = 0; j < count; j++) {
      if (i === 0 && level === 0 && Math.abs((j + 0.5) / count - 0.5) < 0.07) continue;
      opening(
        o,
        a,
        b,
        (j + 0.5) / count,
        P.floor + level * H.mainStoreyHeight + 1,
        F.mainWindowWidth,
        F.mainWindowHeight,
        lod,
        true,
      );
    }
  for (const Y of [P.floor + 0.22, P.floor + H.mainStoreyHeight, band.wallTop - 0.22]) {
    if (lod) beam(o, 'trim', at(0, Y, 0.16), at(1, Y, 0.16), 0.24, 0.35, colors.trim);
    else
      face(
        o,
        'trim',
        [at(0, Y - 0.08, 0.1), at(1, Y - 0.08, 0.1), at(1, Y + 0.08, 0.1), at(0, Y + 0.08, 0.1)],
        [N[0], 0, N[1]],
      );
  }
  if (lod) {
    const columns = lod === 1 ? 2 : Math.floor(count / 2);
    for (let j = 1; j <= columns; j++) {
      const t = j / (columns + 1),
        q = at(t, P.floor + 4.2, 0.23);
      cylinder(o, q[0], q[2], P.floor + 4.2, P.floor + 8.1, 0.17, lod);
    }
  }
  for (const t of [0.2, 0.5, 0.8]) {
    figure(o, a, b, t, P.floor + 8.4, lod);
    if (lod) balcony(o, a, b, t, P.floor + 4.2, lod);
  }
  if (lod > 2) {
    for (let j = 0; j < count * 2; j++) {
      const t = (j + 0.5) / (count * 2);
      beam(
        o,
        'trim',
        at(t, band.wallTop - 0.55, 0.1),
        at(t, band.wallTop - 0.18, 0.33),
        0.17,
        0.17,
        colors.trim,
      );
    }
    for (let j = 0; j < 7; j++) {
      const Y = P.floor + 0.4 + j * 0.48;
      beam(o, 'foundation', at(0, Y, 0.025), at(1, Y, 0.025), 0.018, 0.025, colors.foundation);
    }
  }
  const y0 = band.wallTop,
    y1 = H.mansardBreak,
    p0 = band.ring[0],
    p1 = band.ring[1],
    q0 = lerp(p0, band.ring[3], H.outerMansardInsetFraction),
    q1 = lerp(p1, band.ring[2], H.outerMansardInsetFraction),
    skyCount = lod ? Math.max(3, Math.floor(count * 0.65)) : 3;
  for (let j = 0; j < skyCount; j++) {
    const t = (j + 0.5) / skyCount,
      lo = lerp(lerp(p0, p1, t), lerp(q0, q1, t), 0.32),
      hi = lerp(lerp(p0, p1, t), lerp(q0, q1, t), 0.78),
      U = [dx / L, dz / L],
      w = 1.0,
      p = (v, y, s) => [v[0] + U[0] * s, y + 0.035, v[1] + U[1] * s],
      pts = [
        p(lo, y0 + (y1 - y0) * 0.32, -w / 2),
        p(lo, y0 + (y1 - y0) * 0.32, w / 2),
        p(hi, y0 + (y1 - y0) * 0.78, w / 2),
        p(hi, y0 + (y1 - y0) * 0.78, -w / 2),
      ];
    face(o, 'window', pts, [N[0], 1, N[1]]);
    if (lod > 1)
      for (let k = 0; k < 4; k++)
        beam(o, 'trim', pts[k], pts[(k + 1) % 4], 0.07, 0.08, colors.trim);
  }
}
function entrance(o, lod) {
  const a = P.nativeBuildingRing[0],
    b = P.nativeBuildingRing[1],
    c = lerp(a, b, 0.5),
    z = c[1] + 0.07,
    x = c[0],
    y = P.floor,
    spring = y + 2.6,
    r = 1.2,
    n = [6, 10, 16, 24][lod],
    q = [
      [x - r, y, z],
      [x + r, y, z],
      [x + r, spring, z],
    ];
  for (let j = 1; j <= n; j++) {
    const t = (j * Math.PI) / n;
    q.push([x + r * Math.cos(t), spring + r * Math.sin(t), z]);
  }
  face(o, 'door', q, [0, 0, 1]);
  for (const side of [-1, 1]) cylinder(o, x + side * 1.65, z + 0.35, y, y + 4.05, 0.22, lod);
  beam(
    o,
    'trim',
    [x - 2.1, y + 4.05, z + 0.35],
    [x + 2.1, y + 4.05, z + 0.35],
    0.25,
    0.4,
    colors.trim,
  );
  for (let j = 0; j < 3; j++) {
    const z0 = z + 0.35 + j * 0.3;
    polygon(
      o,
      'foundation',
      [
        [x - 2, z0],
        [x + 2, z0],
        [x + 2, z0 + 0.3],
        [x - 2, z0 + 0.3],
      ],
      0,
      (P.floor * (3 - j)) / 3,
    );
  }
}
export function buildHouse(o, _f, lod = 3) {
  componentEvidence.length = 0;
  for (const band of P.bands) {
    polygon(o, 'foundation', band.ring, H.basementBottom, P.floor);
    polygon(o, 'wall', band.ring, P.floor, band.wallTop);
    if (band.nativeEdge === 0 || band.nativeEdge === 3) {
      const r = band.ring,
        q = [
          lerp(r[0], r[3], H.outerMansardInsetFraction),
          lerp(r[1], r[2], H.outerMansardInsetFraction),
          lerp(r[2], r[1], H.innerMansardInsetFraction),
          lerp(r[3], r[0], H.innerMansardInsetFraction),
        ],
        u = [
          lerp(q[0], q[3], 0.18),
          lerp(q[1], q[2], 0.18),
          lerp(q[2], q[1], 0.18),
          lerp(q[3], q[0], 0.18),
        ];
      roofLayer(o, r, q, band.wallTop, H.mansardBreak);
      roofLayer(o, q, u, H.mansardBreak, band.roofTop);
      cap(o, 'roof', u, band.roofTop, 1);
      mainFacade(o, band, lod);
    } else {
      polygon(o, 'roof', band.ring, band.wallTop, band.roofTop);
      const count = lod ? F.outerBayCounts[band.nativeEdge] : 3;
      for (let level = 0; level < band.storeys; level++)
        for (let j = 0; j < count; j++)
          opening(
            o,
            band.ring[0],
            band.ring[1],
            (j + 0.5) / count,
            P.floor +
              level * (band.nativeEdge === 1 ? H.modernStoreyHeight : H.hallStoreyHeight) +
              0.85,
            1.45,
            1.8,
            lod,
            false,
          );
    }
    const ci = band.nativeEdge,
      a = band.ring[2],
      b = band.ring[3],
      count = lod ? F.courtyardBayCounts[ci] : 3,
      levels = ci === 0 || ci === 3 ? 3 : band.storeys,
      height = ci === 1 ? H.modernStoreyHeight : ci === 2 ? H.hallStoreyHeight : H.mainStoreyHeight;
    for (let level = 0; level < levels; level++)
      for (let j = 0; j < count; j++)
        opening(o, a, b, (j + 0.5) / count, P.floor + level * height + 0.85, 1.3, 1.8, lod, false);
  }
  componentEvidence.push(
    'entire-four-connected-hotel-wings-original-outer-outline-and-true-open-courtyard',
  );
  componentEvidence.push('both-complete-heritage-street-wing-mansard-roofs-fourth-floor-skylights');
  componentEvidence.push(
    'complete-five-level-courtyard-accommodation-and-two-level-hall-annex-roof-volumes',
  );
  componentEvidence.push(
    'both-street-facades-white-columns-original-abstract-statuary-balconies-cornices',
  );
  componentEvidence.push('all-courtyard-and-rear-facades-including-intrinsic-restoration-wings');
  entrance(o, lod);
  if (lod > 1) {
    for (const i of [0, 3]) {
      const a = P.nativeBuildingRing[i],
        b = P.nativeBuildingRing[(i + 1) % 4],
        dx = b[0] - a[0],
        dz = b[1] - a[1],
        L = Math.hypot(dx, dz),
        N = [dz / L, -dx / L];
      for (const t of [0.04, 0.96]) {
        const p = lerp(a, b, t),
          x = p[0] + N[0] * 0.16,
          z = p[1] + N[1] * 0.16;
        beam(o, 'roof', [x, 0.5, z], [x, H.mainWallTop, z], 0.08, 0.08, rgb('97745a'));
      }
    }
  }
  componentEvidence.push(
    'intrinsic-central-arched-columned-entrance-steps-and-estimated-copper-drainage',
  );
}
export const houseSkyline = (o, f) => buildHouse(o, f, 0),
  houseDistrict = (o, f) => buildHouse(o, f, 1),
  houseStreet = (o, f) => buildHouse(o, f, 2),
  houseCloseup = (o, f) => buildHouse(o, f, 3);
const root = 'content/worldgen/source/places/u8/u8m/bristol_hotel_odesa',
  camera = [78, 48, 78],
  look = [-6, 7, -18];
export const houseModel = {
  key: P.model,
  id: P.model,
  title: 'Bristol Hotel, Odesa — restored historical hotel',
  wikidataId: 'Q4096565',
  cell: 'u8/u8m',
  category: 'hotel',
  recipe: 'house-model.mjs',
  surfaces,
  build: buildHouse,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  progressLedger: 'qualla-002.PROGRESS.md',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  groundContactBasis: P.sectionBasis,
  brief: P.geometryBasis,
  appearance: {
    kind: 'historical',
    representedDate: P.representedDate,
    validFrom: P.validFrom,
    validUntil: P.validUntil,
    currentWorldEligible: false,
  },
  camera,
  lookAt: look,
  portableGroundY: -0.19,
  mediumFiContext: {
    scale: 1,
    groundY: 0,
    far: 5000,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: [
    'stucco',
    'stone_limestone_weathered',
    'metal_painted',
    'plaster_lime',
    'wood_plain',
  ],
  qaCameras: [
    {
      name: 'whole-restored-hotel-both-street-wings-and-all-roofs',
      position: camera,
      lookAt: look,
    },
    {
      name: 'baroque-street-front-columns-abstract-statuary-balconies-and-mansard',
      position: [29, 15, 42],
      lookAt: [-5, 8, 10],
    },
    {
      name: 'actual-open-courtyard-all-inner-facades-and-restoration-annexes',
      position: [-2, 54, -18],
      lookAt: [-6, 3, -20],
    },
    {
      name: 'whole-rear-accommodation-hall-annex-and-original-open-courtyard',
      position: [-65, 35, -76],
      lookAt: look,
    },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `whole-bristol-odesa-${reviewLod}`,
    position: camera,
    lookAt: look,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `${root}/models/house-model.mjs`,
    level: 'skyline',
    export: 'houseSkyline',
    errorMeters: 0.35,
    surfaces,
    authoredLevels: {
      district: { export: 'houseDistrict', errorMeters: 0.16, surfaces },
      street: { export: 'houseStreet', errorMeters: 0.07, surfaces },
      closeup: { export: 'houseCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: P.limitations,
  sourceLicense:
    'Original procedural complete2014restoredhotel/streetwings/courtyardaccommodation/hallannex/roofs andtruecourtyard underrepositorylicense. Primaryrestorerpublishedfirstperson andownerwrittenrestoration/attic/skylight/balconyfacts, ownQuallawrittenarchitecture/phase only. Exactoriginalnumericouter+hole/pairednamedBristolPOI/Q4096565, quantizedcurrentmapapproximatehistoricalregistration notnodesurvey. Exactwing-role/height/roof/ornament/finish/grade estimates explicit; newabstractfigures notcopiedstatues/artwork. Everyimage/figure/video/drawingunused. No unrelatedOperaDome/adjacentbuilding/campus/facadeproxy, photographic/survey orundamagedcurrentworldclaim.',
};
