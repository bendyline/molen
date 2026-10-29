/** Whole old Johannesburg Market in2018: main steel-arched hall and intrinsic theatre annex. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import fs from 'node:fs';
import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import {
  beam,
  loft,
  normalFor,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';

const P = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url))),
  F = P.baseFloorY,
  H = P.mainHall,
  A = P.annex,
  T = P.facade,
  ref = 'palette:#ffffff';
export const surfaces = {
  brick: { slot: 'wall', graph: 'brick', roughness: 0.94, metallic: 0 },
  stone: { slot: 'trim', graph: 'plaster_lime', roughness: 0.94, metallic: 0 },
  roof: { slot: 'roof', graph: 'metal_corrugated', roughness: 0.84, metallic: 0.1 },
  iron: { slot: 'trim', graph: 'metal_painted', roughness: 0.78, metallic: 0.25 },
  awning: { slot: 'trim', localRef: ref, roughness: 0.96, metallic: 0 },
  glass: { slot: 'window', localRef: ref, roughness: 0.28, metallic: 0.1 },
};
const C = {
    brick: rgb('b48b72'),
    stone: rgb('e8dcc7'),
    roof: rgb('8a8d83'),
    iron: rgb('5c6560'),
    awning: rgb('6d1024'),
    glass: rgb('344b52'),
  },
  U = P.workingFrame.alongFront,
  V = P.workingFrame.alongDepth;
export const toWorld = ([x, y, z]) => [U[0] * x + V[0] * z, y, U[1] * x + V[1] * z],
  rotate = ([x, y, z]) => [U[0] * x + V[0] * z, y, U[1] * x + V[1] * z];
export const partEvidence = [],
  roofEvidence = [],
  windowEvidence = [],
  edgeEvidence = [],
  awningEvidence = [];
let _activeLod = 3;
function face(o, k, ps, n, col = C[k]) {
  o.addConvexPolygon(k, ref, ps, n ?? normalFor(...ps), (p) => [p[0], p[1]], col);
}
function cap(o, k, ring, y, n) {
  const b = new MeshBufferBuilder();
  if (
    !b.addCap(
      k,
      ref,
      ring,
      [],
      () => y,
      n,
      (p) => p,
      C[k],
    )
  )
    throw Error('Oldmarket cap triangulation failed');
  const m = b.finalize();
  for (let i = 0; i < m.indices.length; i += 3) {
    const ps = Array.from(m.indices.slice(i, i + 3), (j) =>
      Array.from(m.positions.slice(j * 3, j * 3 + 3)),
    );
    o.addTriangle(
      k,
      ref,
      ps,
      n,
      ps.map((p) => [p[0], p[2]]),
      C[k],
    );
  }
}
function edge(a, b) {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]),
    u = [(b[0] - a[0]) / L, 0, (b[1] - a[1]) / L],
    n = [u[2], 0, -u[0]],
    at = (t, y, d = 0) => [a[0] + u[0] * t + n[0] * d, y, a[1] + u[2] * t + n[2] * d];
  return { L, u, n, at };
}
function rect(o, k, E, x0, x1, y0, y1, d = 0, col = C[k]) {
  if (x1 - x0 < 0.0001 || y1 - y0 < 0.0001) return;
  face(o, k, [E.at(x0, y0, d), E.at(x1, y0, d), E.at(x1, y1, d), E.at(x0, y1, d)], E.n, col);
}
function ebox(o, k, E, c, y0, y1, w, d0, d1, col = C[k]) {
  const a = c - w / 2,
    b = c + w / 2;
  for (const [ps, n] of [
    [[E.at(a, y0, d1), E.at(b, y0, d1), E.at(b, y1, d1), E.at(a, y1, d1)], E.n],
    [[E.at(b, y0, d0), E.at(a, y0, d0), E.at(a, y1, d0), E.at(b, y1, d0)], E.n.map((v) => -v)],
    [[E.at(a, y0, d0), E.at(a, y0, d1), E.at(a, y1, d1), E.at(a, y1, d0)], E.u.map((v) => -v)],
    [[E.at(b, y0, d1), E.at(b, y0, d0), E.at(b, y1, d0), E.at(b, y1, d1)], E.u],
    [
      [E.at(a, y1, d1), E.at(b, y1, d1), E.at(b, y1, d0), E.at(a, y1, d0)],
      [0, 1, 0],
    ],
    [
      [E.at(a, y0, d0), E.at(b, y0, d0), E.at(b, y0, d1), E.at(a, y0, d1)],
      [0, -1, 0],
    ],
  ])
    face(o, k, ps, n, col);
}
function roundProfile(c, w, bottom, spring, rise, n) {
  return [
    [c - w / 2, bottom],
    [c + w / 2, bottom],
    ...Array.from({ length: n + 1 }, (_, i) => {
      const t = (i * Math.PI) / n;
      return [c + (w / 2) * Math.cos(t), spring + rise * Math.sin(t)];
    }),
  ];
}
function archedWindow(o, E, c, cell0, cell1, lod, id) {
  const w = T.upperWidth,
    y0 = F + 3.65,
    y1 = F + P.wallTop,
    bottom = F + T.upperBottom,
    spring = F + T.upperSpring,
    rise = T.upperRise,
    N = lod === 3 ? 10 : 5,
    qs = Array.from({ length: N + 1 }, (_, i) => {
      const t = Math.PI - (i * Math.PI) / N;
      return [c + (w / 2) * Math.cos(t), spring + rise * Math.sin(t)];
    });
  rect(o, 'brick', E, cell0, c - w / 2, y0, y1);
  rect(o, 'brick', E, c + w / 2, cell1, y0, y1);
  rect(o, 'brick', E, c - w / 2, c + w / 2, y0, bottom);
  for (let i = 1; i < qs.length; i++) {
    const a = qs[i - 1],
      b = qs[i];
    face(o, 'brick', [E.at(a[0], a[1]), E.at(b[0], b[1]), E.at(b[0], y1), E.at(a[0], y1)], E.n);
    const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2],
      n = E.u.map((v, j) => v * (c - mid[0]) + (j === 1 ? spring - mid[1] : 0));
    face(
      o,
      'stone',
      [
        E.at(a[0], a[1]),
        E.at(a[0], a[1], -T.glazingDepth),
        E.at(b[0], b[1], -T.glazingDepth),
        E.at(b[0], b[1]),
      ],
      n,
    );
    if (lod === 3) {
      const t0 = Math.PI - ((i - 1) * Math.PI) / N,
        t1 = Math.PI - (i * Math.PI) / N,
        outer = [c + (w / 2 + 0.16) * Math.cos(t0), spring + (rise + 0.16) * Math.sin(t0)],
        other = [c + (w / 2 + 0.16) * Math.cos(t1), spring + (rise + 0.16) * Math.sin(t1)];
      face(
        o,
        'stone',
        [
          E.at(a[0], a[1], 0.055),
          E.at(b[0], b[1], 0.055),
          E.at(other[0], other[1], 0.055),
          E.at(outer[0], outer[1], 0.055),
        ],
        E.n,
      );
    }
  }
  for (const s of [-1, 1]) {
    const x = c + (s * w) / 2;
    face(
      o,
      'stone',
      [
        E.at(x, bottom),
        E.at(x, spring),
        E.at(x, spring, -T.glazingDepth),
        E.at(x, bottom, -T.glazingDepth),
      ],
      E.u.map((v) => v * -s),
    );
    if (lod === 3) ebox(o, 'stone', E, x + s * 0.08, bottom, spring, 0.16, -0.015, 0.11);
  }
  face(
    o,
    'stone',
    [
      E.at(c - w / 2, bottom),
      E.at(c + w / 2, bottom),
      E.at(c + w / 2, bottom, -T.glazingDepth),
      E.at(c - w / 2, bottom, -T.glazingDepth),
    ],
    [0, 1, 0],
  );
  face(
    o,
    'glass',
    roundProfile(c, w, bottom, spring, rise, N).map(([x, y]) => E.at(x, y, -T.glazingDepth)),
    E.n,
  );
  const mullions = lod === 3 ? [-0.75, 0, 0.75] : [0];
  for (const x of mullions) {
    const h = spring + rise * Math.sqrt(Math.max(0, 1 - (x / (w / 2)) ** 2));
    beam(
      o,
      'iron',
      E.at(c + x, bottom, -T.glazingDepth + 0.035),
      E.at(c + x, h, -T.glazingDepth + 0.035),
      0.045,
      0.05,
      C.iron,
    );
  }
  for (const y of lod === 3 ? [bottom + 0.7, bottom + 1.4, bottom + 2.1, spring] : [bottom + 1.5])
    beam(
      o,
      'iron',
      E.at(c - w / 2, y, -T.glazingDepth + 0.035),
      E.at(c + w / 2, y, -T.glazingDepth + 0.035),
      0.045,
      0.05,
      C.iron,
    );
  windowEvidence.push({
    id,
    point: E.at(c + 0.32, bottom + 0.38),
    normal: E.n,
    depth: T.glazingDepth,
    curved: true,
  });
}
function groundWindow(o, E, c, a, b, lod, id) {
  const w = T.groundWidth,
    bot = F + T.groundBottom,
    top = F + T.groundTop,
    d = T.glazingDepth;
  rect(o, 'stone', E, a, c - w / 2, F, F + 3.25);
  rect(o, 'stone', E, c + w / 2, b, F, F + 3.25);
  rect(o, 'stone', E, c - w / 2, c + w / 2, F, bot);
  rect(o, 'stone', E, c - w / 2, c + w / 2, top, F + 3.25);
  rect(o, 'glass', E, c - w / 2, c + w / 2, bot, top, -d, rgb('3c4c45'));
  for (const s of [-1, 1])
    face(
      o,
      'stone',
      [
        E.at(c + (s * w) / 2, bot),
        E.at(c + (s * w) / 2, top),
        E.at(c + (s * w) / 2, top, -d),
        E.at(c + (s * w) / 2, bot, -d),
      ],
      E.u.map((v) => v * -s),
    );
  face(
    o,
    'stone',
    [
      E.at(c - w / 2, top),
      E.at(c + w / 2, top),
      E.at(c + w / 2, top, -d),
      E.at(c - w / 2, top, -d),
    ],
    [0, -1, 0],
  );
  if (lod === 3) {
    for (const x of [-w / 2, 0, w / 2])
      beam(
        o,
        'iron',
        E.at(c + x, bot, -d + 0.045),
        E.at(c + x, top, -d + 0.045),
        0.065,
        0.065,
        rgb('41564c'),
      );
    beam(
      o,
      'iron',
      E.at(c - w / 2, top - 0.65, -d + 0.045),
      E.at(c + w / 2, top - 0.65, -d + 0.045),
      0.06,
      0.06,
      C.iron,
    );
  }
  windowEvidence.push({
    id,
    point: E.at(c + 0.34, F + 1.25),
    normal: E.n,
    depth: d,
    curved: false,
  });
}
function walls(o, lod) {
  for (let i = 0; i < P.outline.length; i++) {
    const E = edge(P.outline[i], P.outline[(i + 1) % P.outline.length]),
      N = Math.max(1, Math.floor(E.L / T.bayPitch)),
      full = E.L > 4.2,
      entry = i === T.mainEntryEdge[0],
      step = E.L / N;
    rect(o, 'brick', E, 0, E.L, P.foundationBase, F);
    if (lod < 2 || !full) {
      rect(o, 'stone', E, 0, E.L, F, F + 3.65);
      rect(o, 'brick', E, 0, E.L, F + 3.65, F + P.wallTop);
      if (lod === 1 && full) {
        const n = Math.max(1, Math.floor(N / 2));
        for (let j = 0; j < n; j++) {
          const c = ((j + 0.5) * E.L) / n;
          rect(o, 'glass', E, c - 1.1, c + 1.1, F + 4.3, F + 8.1, 0.015);
          rect(o, 'glass', E, c - 0.85, c + 0.85, F + 0.6, F + 2.9, 0.015);
        }
      }
    } else {
      for (let j = 0; j < N; j++) {
        const c = (j + 0.5) * step,
          a = j * step,
          b = (j + 1) * step;
        archedWindow(o, E, c, a, b, lod, `edge-${i}-upper-${j}`);
        groundWindow(o, E, c, a, b, lod, `edge-${i}-lower-${j}`);
        if (lod === 3) {
          ebox(o, 'stone', E, a, F + 3.65, F + 8.9, 0.23, -0.02, 0.13);
          const t0 = c - 0.42;
          for (let k = 0; k < 3; k++)
            rect(o, 'brick', E, t0 + k * 0.28, t0 + k * 0.28 + 0.09, F + 3.32, F + 3.61, 0.05);
        }
      }
      rect(o, 'stone', E, 0, E.L, F + 3.25, F + 3.65);
    }
    for (const y of lod === 0 ? [3.45, 10.2] : lod === 1 ? [3.45, 9.65, 10.2] : T.stoneBands) {
      if (lod < 2) rect(o, 'stone', E, 0, E.L, F + y - 0.09, F + y + 0.09, 0.025);
      else ebox(o, 'stone', E, E.L / 2, F + y - 0.09, F + y + 0.09, E.L, -0.02, 0.18);
    }
    if (lod >= 2) {
      for (const c of [0.2, E.L - 0.2]) ebox(o, 'stone', E, c, F, F + 10.3, 0.4, -0.02, 0.16);
      if (entry)
        for (const c of [0.42, E.L - 0.42])
          for (let y = 0.12; y < 10.1; y += 0.62)
            ebox(o, 'stone', E, c, F + y, F + Math.min(y + 0.55, 10.3), 0.82, -0.015, 0.25);
    }
    edgeEvidence.push({
      id: `native-outer-edge-${i}`,
      a: P.outline[i],
      b: P.outline[(i + 1) % P.outline.length],
      bays: full ? N : 0,
    });
  }
  cap(o, 'stone', P.outline, P.foundationBase, [0, -1, 0]);
  cap(o, 'roof', P.outline, F + P.wallTop, [0, 1, 0]);
  partEvidence.push({ id: 'whole-native29-edge-building-shell-and-roof-closure', edges: 29 });
}
export const hallRoofY = (z) =>
  F +
  H.coreEave +
  (H.ridge - H.coreEave) * Math.sin((Math.PI * (z - H.coreNorth)) / (H.coreSouth - H.coreNorth));
function roofFace(o, ps, id) {
  let n = normalFor(...ps);
  if (n[1] < 0) n = n.map((v) => -v);
  face(o, 'roof', ps, n);
  const p = ps.slice(0, 3).reduce((s, p) => s.map((v, i) => v + p[i] / 3), [0, 0, 0]);
  roofEvidence.push({ id, point: p, normal: n });
  face(
    o,
    'roof',
    ps.map((p) => [p[0], p[1] - H.roofThickness, p[2]]),
    n.map((v) => -v),
  );
}
function hallRoof(o, lod) {
  const nz = [6, 10, 18, 28][lod],
    nx = [1, 2, 4, 8][lod],
    zs = Array.from(
      { length: nz + 1 },
      (_, i) => H.coreNorth + ((H.coreSouth - H.coreNorth) * i) / nz,
    ),
    xs = Array.from({ length: nx + 1 }, (_, i) => H.x0 + ((H.x1 - H.x0) * i) / nx);
  for (let j = 1; j < xs.length; j++)
    for (let i = 1; i < zs.length; i++) {
      const a = xs[j - 1],
        b = xs[j],
        z = zs[i - 1],
        Z = zs[i];
      roofFace(
        o,
        [
          [a, hallRoofY(z), z],
          [b, hallRoofY(z), z],
          [b, hallRoofY(Z), Z],
          [a, hallRoofY(Z), Z],
        ],
        'main-arched-hall-roof',
      );
    }
  for (const x of [H.x0, H.x1])
    for (let i = 1; i < zs.length; i++) {
      const z = zs[i - 1],
        Z = zs[i],
        n = x === H.x0 ? [-1, 0, 0] : [1, 0, 0];
      face(
        o,
        'brick',
        [
          [x, F + P.wallTop, z],
          [x, F + P.wallTop, Z],
          [x, hallRoofY(Z), Z],
          [x, hallRoofY(z), z],
        ],
        n,
      );
    }
  for (const [outer, inner] of [
    [H.outerNorth, H.coreNorth],
    [H.outerSouth, H.coreSouth],
  ])
    roofFace(
      o,
      [
        [H.x0, F + H.outerEave, outer],
        [H.x1, F + H.outerEave, outer],
        [H.x1, F + H.coreEave, inner],
        [H.x0, F + H.coreEave, inner],
      ],
      'whole-intrinsic-lean-side-roof',
    );
  const z = (H.coreNorth + H.coreSouth) / 2,
    y = F + H.ridge,
    x0 = H.clerestoryX[0],
    x1 = H.clerestoryX[1],
    w = H.clerestoryHalfWidth;
  for (const side of [-1, 1]) {
    face(
      o,
      'glass',
      [
        [x0, y - 0.2, z + side * w],
        [x1, y - 0.2, z + side * w],
        [x1, y + 0.65, z + side * w],
        [x0, y + 0.65, z + side * w],
      ],
      [0, 0, side],
    );
    roofFace(
      o,
      [
        [x0, y + 0.65, z + side * w],
        [x1, y + 0.65, z + side * w],
        [x1, y + H.clerestoryRise, z],
        [x0, y + H.clerestoryRise, z],
      ],
      'long-roof-ridge-ventilator',
    );
    if (lod >= 2)
      for (let x = x0; x <= x1; x += 8)
        beam(
          o,
          'iron',
          [x, y - 0.2, z + side * w],
          [x, y + 0.65, z + side * w],
          0.07,
          0.07,
          C.iron,
        );
  }
  for (const x of [x0, x1])
    face(
      o,
      'roof',
      [
        [x, y - 0.2, z - w],
        [x, y - 0.2, z + w],
        [x, y + 0.65, z + w],
        [x, y + H.clerestoryRise, z],
        [x, y + 0.65, z - w],
      ],
      x === x0 ? [-1, 0, 0] : [1, 0, 0],
    );
  partEvidence.push({ id: 'whole-steel-arched-mainhall-lean-roofs-and-ridge-ventilator' });
}
function annexRoof(o, lod) {
  const scales = lod === 0 ? [1, 0.43, 0.12] : A.ringScales,
    hs = lod === 0 ? [A.ringHeights[0], A.ringHeights[2], A.ringHeights[3]] : A.ringHeights,
    rings = scales.map((s, j) =>
      A.outline.map(([x, z]) => [
        A.center[0] + (x - A.center[0]) * s,
        F + hs[j],
        A.center[1] + (z - A.center[1]) * s,
      ]),
    );
  for (let j = 1; j < rings.length; j++)
    for (let i = 0; i < A.outline.length; i++) {
      const k = (i + 1) % A.outline.length;
      roofFace(
        o,
        [rings[j - 1][i], rings[j - 1][k], rings[j][k], rings[j][i]],
        'intrinsic-theatre-annex-curved-hip-dome',
      );
    }
  cap(
    o,
    'roof',
    rings.at(-1).map((p) => [p[0], p[2]]),
    F + A.ringHeights.at(-1),
    [0, 1, 0],
  );
  const y = F + A.ringHeights.at(-1),
    ring = (r, Y) => radialRing(Y, r, r, lod === 0 ? 4 : 8, A.center, Math.PI / 8);
  loft(o, 'iron', [ring(A.cupolaRadius, y), ring(A.cupolaRadius, y + 0.8)], C.iron);
  loft(o, 'roof', [ring(A.cupolaRadius * 1.15, y + 0.8), ring(0.18, F + A.cupolaTop)], C.roof);
  if (lod === 3)
    for (let i = 0; i < A.outline.length; i += 2)
      for (let j = 1; j < rings.length; j++)
        beam(
          o,
          'roof',
          rings[j - 1][i].map((v, k) => v + (k === 1 ? 0.03 : 0)),
          rings[j][i].map((v, k) => v + (k === 1 ? 0.03 : 0)),
          0.075,
          0.075,
          C.roof,
        );
  partEvidence.push({
    id: 'whole-intrinsic-eastern-theatre-annex-estimated-curved-roof-and-cupola',
  });
}
function canopy(o, E, c, w, projection, rise, lod, id) {
  const n = [4, 6, 10, 16][lod],
    ys = F + P.awnings.baseHeight,
    qs = Array.from({ length: n + 1 }, (_, i) => {
      const t = Math.PI - (i * Math.PI) / n;
      return [c + (w / 2) * Math.cos(t), ys + rise * Math.sin(t)];
    });
  for (let i = 1; i < qs.length; i++) {
    const a = qs[i - 1],
      b = qs[i];
    const p = [
        E.at(a[0], a[1], 0.08),
        E.at(b[0], b[1], 0.08),
        E.at(b[0], b[1], projection),
        E.at(a[0], a[1], projection),
      ],
      normal = normalFor(...p);
    face(o, 'awning', p, normal[1] < 0 ? normal.map((v) => -v) : normal);
    if (lod > 0)
      face(
        o,
        'awning',
        p.map((v) => [v[0], v[1] - 0.045, v[2]]),
        normal[1] > 0 ? normal.map((v) => -v) : normal,
      );
    const front = [E.at(a[0], ys, projection), E.at(b[0], ys, projection)];
    if (i !== qs.length - 1) front.push(E.at(b[0], b[1], projection));
    if (i !== 1) front.push(E.at(a[0], a[1], projection));
    face(o, 'awning', front, E.n);
  }
  if (lod >= 2)
    for (const t of [c - w / 2 + 0.12, c + w / 2 - 0.12]) {
      const p = E.at(t, F, projection - 0.16);
      loft(
        o,
        'iron',
        [
          radialRing(F, 0.085, 0.085, 8, [p[0], p[2]]),
          radialRing(ys, 0.085, 0.085, 8, [p[0], p[2]]),
        ],
        rgb('7e3e32'),
      );
      loft(
        o,
        'stone',
        [
          radialRing(ys - 0.18, 0.17, 0.17, 8, [p[0], p[2]]),
          radialRing(ys, 0.17, 0.17, 8, [p[0], p[2]]),
        ],
        C.stone,
      );
    }
  awningEvidence.push({
    id,
    point: E.at(c, ys + rise, projection / 2),
    normal: E.n,
    projection,
    width: w,
  });
}
function entrance(o, lod) {
  const E = edge(P.outline[T.mainEntryEdge[0]], P.outline[T.mainEntryEdge[1]]),
    c = E.L / 2;
  canopy(
    o,
    E,
    c,
    P.awnings.mainWidth,
    P.awnings.mainProjection,
    P.awnings.mainRise,
    lod,
    'main-burgundy-barrel-canopy',
  );
  if (lod > 0)
    for (const x of [-8.5, 8.5])
      canopy(
        o,
        E,
        c + x,
        P.awnings.smallWidth,
        P.awnings.smallProjection,
        P.awnings.smallRise,
        lod,
        'side-burgundy-barrel-canopy',
      );
  if (lod >= 2)
    for (let i = 0; i < 3; i++)
      ebox(
        o,
        'stone',
        E,
        c,
        F * (i / 3),
        (F * (i + 1)) / 3,
        5.4,
        P.awnings.mainProjection + 0.15 - i * 0.26,
        P.awnings.mainProjection + 0.42 - i * 0.26,
      );
  partEvidence.push({ id: 'photo-guided-main-entrance-burgundy-awnings-round-columns-and-steps' });
}
export function buildHouse(out, _frame, lod = 3) {
  _activeLod = lod;
  for (const a of [partEvidence, roofEvidence, windowEvidence, edgeEvidence, awningEvidence])
    a.length = 0;
  const o = {
    addConvexPolygon: (k, r, p, n, _uv, col) =>
      out.addConvexPolygon(k, r, p.map(toWorld), rotate(n), (p) => [p[0], p[1]], col),
    addTriangle: (k, r, p, n, uv, col) => out.addTriangle(k, r, p.map(toWorld), rotate(n), uv, col),
    addQuad: (k, r, p, n, uv, col) => out.addQuad(k, r, p.map(toWorld), rotate(n), uv, col),
  };
  walls(o, lod);
  hallRoof(o, lod);
  annexRoof(o, lod);
  entrance(o, lod);
}
export const houseSkyline = (o, f) => buildHouse(o, f, 0),
  houseDistrict = (o, f) => buildHouse(o, f, 1),
  houseStreet = (o, f) => buildHouse(o, f, 2),
  houseCloseup = (o, f) => buildHouse(o, f, 3);
const root = 'content/worldgen/source/places/ke/ke7/market_theatre_johannesburg',
  cam = toWorld,
  camera = cam([142, 115, -185]),
  look = cam([-20, 7, 4]),
  E = edge(P.outline[T.mainEntryEdge[0]], P.outline[T.mainEntryEdge[1]]),
  entryCam = E.at(E.L / 2, 6, 25),
  entryLook = E.at(E.L / 2, 5.5, 0);
export const houseModel = {
  key: P.model,
  id: P.model,
  title: 'Old Johannesburg Market — Market Theatre (2018)',
  cell: 'ke/ke7',
  wikidataId: 'Q1900656',
  category: 'performance-sport',
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
  portableGroundY: -4.5,
  mediumFiContext: {
    scale: 1,
    groundY: -4.5,
    far: 4000,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: ['brick', 'plaster_lime', 'metal_corrugated', 'metal_painted'],
  qaCameras: [
    {
      name: 'whole-oldmarket-main-arched-hall-and-intrinsic-theatre-annex',
      position: camera,
      lookAt: look,
    },
    {
      name: 'photo-guided-theatre-entrance-arched-windows-cream-quoins-and-burgundy-awnings',
      position: cam(entryCam),
      lookAt: cam(entryLook),
    },
    {
      name: 'whole-south-museum-hall-and-west-return',
      position: cam([-135, 58, 155]),
      lookAt: cam([-20, 7, 12]),
    },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `whole-oldmarket-${reviewLod}`,
    position: camera,
    lookAt: look,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `${root}/models/house-model.mjs`,
    level: 'skyline',
    export: 'houseSkyline',
    errorMeters: 1.8,
    surfaces,
    authoredLevels: {
      district: { export: 'houseDistrict', errorMeters: 0.65, surfaces },
      street: { export: 'houseStreet', errorMeters: 0.18, surfaces },
      closeup: { export: 'houseCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: P.limitations,
  sourceLicense:
    'Original authoredgeometry/repositorylicense. Exact alreadycleared published officialUSembassySouthAfrica2018PD-USGov-DOS original6000x4000/17,288,244bytes/SHA153961ebbcb0265b71c6400bb4551c7b21ceb2e8e/nativegovernmentrelease+reviewedUnitedStatesGovernmentWork bound withoutmetadatarepair. Primary1976RestoricapreservationTEXT andownerhistory establishwholeoldmarket/steelthree-pinarchhall/easternCornExchange/annex. NativeOSMODbL29vertexwholeoldmarketway846541435 withtheatreQ1900656 andMuseumAfricaQ704439 POIsinside; modernneighbor604604639 excluded/allreservedworkclear. Roofsubdivision/curvature/clerestory/annexhip-dome/cupola/heights/sections/baycensus/rear/registration/grade estimated. No protectedwebsiteimages/copiedlettering/eventbranding/flags/people/trees/vehicles/interiors/phototextures/generatedbitmap.',
};
