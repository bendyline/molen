/** Whole temple assembly in the preserved native geographic frame. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import fs from 'node:fs';
import { ShapeUtils, Vector2 } from 'three';
import {
  beam,
  cross,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';

const p = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url))),
  frame = JSON.parse(fs.readFileSync(new URL('../map-frame.json', import.meta.url))),
  { floorY: F, axisU: U, axisV: V, architecturalSections: A } = p.parameters;
const C = {
  wall: rgb('d8ba8d'),
  trim: rgb('b97f65'),
  marble: rgb('e8e6db'),
  gold: rgb('dfb64b'),
  dark: rgb('484e45'),
};
export const surfaces = {
  wall: { slot: 'wall', graph: 'stone_sandstone_raw', roughness: 0.94, metallic: 0 },
  trim: { slot: 'trim', graph: 'stone_sandstone', roughness: 0.88, metallic: 0 },
  marble: { slot: 'trim', graph: 'stone_marble', roughness: 0.76, metallic: 0 },
  gold: { slot: 'roof', localRef: 'palette:#ffffff', roughness: 0.44, metallic: 0.68 },
  dark: { slot: 'trim', graph: 'wood_plain', roughness: 0.84, metallic: 0 },
};
const sub = (a, b) => a.map((v, i) => v - b[i]),
  dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0),
  area = (r) =>
    r.reduce((s, a, i) => {
      const b = r[(i + 1) % r.length];
      return s + a[0] * b[1] - b[0] * a[1];
    }, 0),
  triangulate = (r, h = []) =>
    ShapeUtils.triangulateShape(
      r.map((q) => new Vector2(...q)),
      h.map((r) => r.map((q) => new Vector2(...q))),
    );
export const toWorld = (q) => [U[0] * q[0] + V[0] * q[2], F + q[1], U[1] * q[0] + V[1] * q[2]],
  direction = (q) => [U[0] * q[0] + V[0] * q[2], q[1], U[1] * q[0] + V[1] * q[2]],
  eastern = frame.features[0].outline.slice(0, -1).map((q) => [dot(q, U), dot(q, V)]),
  partEvidence = [],
  openingEvidence = [],
  pavilionEvidence = [],
  archEvidence = [],
  nativeEvidence = [],
  stairEvidence = [];
function T(o, k, q, n, col = C[k]) {
  q = q.map((q) => toWorld(q).map(Math.fround));
  const cr = cross(sub(q[1], q[0]), sub(q[2], q[0]));
  if (Math.hypot(...cr) < 1e-9) return;
  if (n && dot(cr, direction(n)) < 0) [q[1], q[2]] = [q[2], q[1]];
  o.addTriangle(
    k,
    'palette:#ffffff',
    q,
    normalFor(...q),
    q.map((v) => [v[0] + v[2], v[1]]),
    col,
  );
}
function Q(o, k, q, n, col) {
  T(o, k, q.slice(0, 3), n, col);
  T(o, k, [q[0], q[2], q[3]], n, col);
}
function cap(o, k, r, y, up = true, col = C[k]) {
  for (const ix of triangulate(r))
    T(
      o,
      k,
      ix.map((i) => [r[i][0], y, r[i][1]]),
      [0, up ? 1 : -1, 0],
      col,
    );
}
function solid(o, k, r, y, Y, col = C[k], top = true) {
  const s = area(r) > 0 ? 1 : -1;
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length];
    Q(
      o,
      k,
      [
        [a[0], y, a[1]],
        [b[0], y, b[1]],
        [b[0], Y, b[1]],
        [a[0], Y, a[1]],
      ],
      [s * (b[1] - a[1]), 0, s * (a[0] - b[0])],
      col,
    );
  }
  if (top) cap(o, k, r, Y, true, col);
}
const rect = (x, X, z, Z) => [
    [x, z],
    [X, z],
    [X, Z],
    [x, Z],
  ],
  box = (o, k, x, y, z, w, h, d, col) =>
    solid(o, k, rect(x - w / 2, x + w / 2, z - d / 2, z + d / 2), y, y + h, col),
  B = (o, k, a, b, w, d, col = C[k]) => beam(o, k, toWorld(a), toWorld(b), w, d, col);
function panel(a, b, r) {
  const v = sub(b, a),
    L = Math.hypot(...v),
    u = v.map((v) => v / L),
    s = area(r) > 0 ? 1 : -1,
    n = [s * u[1], -s * u[0]];
  return {
    a,
    b,
    L,
    u,
    n,
    P: (t, y, v = 0) => [a[0] + u[0] * t + n[0] * v, y, a[1] + u[1] * t + n[1] * v],
  };
}
function plane(o, k, f, l, r, y, Y, v = 0, col = C[k]) {
  Q(o, k, [f.P(l, y, v), f.P(r, y, v), f.P(r, Y, v), f.P(l, Y, v)], [f.n[0], 0, f.n[1]], col);
}
function facades(o, k, r, y, Y, holes, lod, name) {
  for (let i = 0; i < r.length; i++) {
    const f = panel(r[i], r[(i + 1) % r.length], r),
      hs = holes(f, i);
    if (lod === 0) {
      plane(o, k, f, 0, f.L, y, Y);
      for (const h of hs.filter((_, j) => j === Math.floor(hs.length / 2)))
        plane(o, 'dark', f, h.x - h.w / 2, h.x + h.w / 2, h.y, h.Y, 0.015);
      continue;
    }
    const outer = [
        [0, y],
        [f.L, y],
        [f.L, Y],
        [0, Y],
      ],
      cuts = hs.map((h) => [
        [h.x - h.w / 2, h.y],
        [h.x - h.w / 2, h.Y],
        [h.x + h.w / 2, h.Y],
        [h.x + h.w / 2, h.y],
      ]),
      all = [...outer, ...cuts.flat()];
    for (const ix of triangulate(outer, cuts))
      T(
        o,
        k,
        ix.map((i) => f.P(...all[i])),
        [f.n[0], 0, f.n[1]],
      );
    for (const h of hs) {
      const l = h.x - h.w / 2,
        R = h.x + h.w / 2,
        D = -0.24;
      for (const [a, b, n] of [
        [[l, h.y], [l, h.Y], f.u],
        [[R, h.Y], [R, h.y], f.u.map((v) => -v)],
      ])
        Q(o, k, [f.P(...a), f.P(...b), f.P(...b, D), f.P(...a, D)], [n[0], 0, n[1]]);
      Q(o, k, [f.P(l, h.y), f.P(l, h.y, D), f.P(R, h.y, D), f.P(R, h.y)], [0, 1, 0]);
      Q(o, k, [f.P(l, h.Y), f.P(R, h.Y), f.P(R, h.Y, D), f.P(l, h.Y, D)], [0, -1, 0]);
      plane(o, 'dark', f, l, R, h.y, h.Y, D);
      openingEvidence.push({
        name,
        index: i,
        center: f.P(h.x, (h.y + h.Y) / 2),
        normal: [f.n[0], 0, f.n[1]],
        depth: 0.24,
      });
      if (lod >= 3) {
        for (const t of [l - 0.08, R + 0.08])
          B(
            o,
            name === 'eastern' ? 'marble' : 'trim',
            f.P(t, h.y - 0.1, 0.04),
            f.P(t, h.Y + 0.1, 0.04),
            0.14,
            0.14,
          );
        B(o, 'marble', f.P(l - 0.15, h.y - 0.12, 0.1), f.P(R + 0.15, h.y - 0.12, 0.1), 0.15, 0.22);
        const N = lod === 3 ? 5 : 2;
        for (let j = 1; j <= N; j++) {
          const t = l + (h.w * j) / (N + 1);
          B(o, 'marble', f.P(t, h.y, D + 0.025), f.P(t, h.Y, D + 0.025), 0.045, 0.045);
        }
        if (name === 'mainhall') {
          for (let j = 1; j <= N; j++) {
            const yy = h.y + ((h.Y - h.y) * j) / (N + 1);
            B(o, 'trim', f.P(l, yy, D + 0.03), f.P(R, yy, D + 0.03), 0.045, 0.05);
          }
          const rad = h.w / 2;
          for (let j = 0; j < (lod === 3 ? 8 : 4); j++) {
            const n = lod === 3 ? 8 : 4,
              a = (j * Math.PI) / n,
              b = ((j + 1) * Math.PI) / n;
            B(
              o,
              'trim',
              f.P(h.x + rad * Math.cos(a), h.Y + 0.18 * Math.sin(a), 0.08),
              f.P(h.x + rad * Math.cos(b), h.Y + 0.18 * Math.sin(b), 0.08),
              0.12,
              0.16,
            );
          }
        }
      }
    }
  }
}
function ring(o, k, r, y, Y, depth, col) {
  const s = area(r) > 0 ? 1 : -1;
  for (let i = 0; i < r.length; i++) {
    const f = panel(r[i], r[(i + 1) % r.length], r),
      a = f.P(0, 0, depth),
      b = f.P(f.L, 0, depth),
      c = f.P(f.L, 0, -0.02),
      d = f.P(0, 0, -0.02);
    solid(
      o,
      k,
      [
        [a[0], a[2]],
        [b[0], b[2]],
        [c[0], c[2]],
        [d[0], d[2]],
      ],
      y,
      Y,
      col,
    );
  }
  return s;
}
function archStock(o, k, f, y, Y, center, radius, spring, depth, lod, record = true) {
  const n = lod === 0 ? 3 : lod === 1 ? 5 : lod === 2 ? 9 : 16;
  // Arch is a notch cut through the wall bottom, with real intrados across its depth.
  const curve = [
    [center - radius, y],
    [center - radius, spring],
  ];
  for (let j = n - 1; j >= 0; j--) {
    const a = (j * Math.PI) / n;
    curve.push([center + radius * Math.cos(a), spring + radius * Math.sin(a)]);
  }
  curve.push([center + radius, y]);
  const boundary = [[0, y], ...curve, [f.L, y], [f.L, Y], [0, Y]];
  for (const side of [0, -depth])
    for (const ix of triangulate(boundary))
      T(
        o,
        k,
        ix.map((i) => f.P(...boundary[i], side)),
        [f.n[0] * (side === 0 ? 1 : -1), 0, f.n[1] * (side === 0 ? 1 : -1)],
      );
  for (let j = 0; j < curve.length - 1; j++) {
    const a = curve[j],
      b = curve[j + 1];
    Q(
      o,
      k,
      [f.P(...a), f.P(...a, -depth), f.P(...b, -depth), f.P(...b)],
      [f.u[0] * (b[1] - a[1]), a[0] - b[0], f.u[1] * (b[1] - a[1])],
    );
  }
  if (record)
    archEvidence.push({
      center: f.P(center, (y + spring) / 2),
      normal: [f.n[0], 0, f.n[1]],
      depth,
      kind: k,
    });
}
function lathe(o, k, x, z, y, rise, r, lod) {
  const n = [4, 8, 16, 28][lod],
    profile =
      lod <= 1
        ? [
            [0.88, 0],
            [1, 0.28],
            [0.8, 0.67],
            [0.12, 1],
          ]
        : [
            [0.84, 0],
            [0.94, 0.09],
            [1, 0.24],
            [0.97, 0.42],
            [0.83, 0.65],
            [0.55, 0.84],
            [0.18, 0.97],
            [0.06, 1],
          ];
  for (let j = 0; j < profile.length - 1; j++)
    for (let i = 0; i < n; i++) {
      const a = (i * 2 * Math.PI) / n,
        b = ((i + 1) * 2 * Math.PI) / n,
        [r0, h0] = profile[j],
        [r1, h1] = profile[j + 1];
      Q(
        o,
        k,
        [
          [x + r * r0 * Math.cos(a), y + rise * h0, z + r * r0 * Math.sin(a)],
          [x + r * r0 * Math.cos(b), y + rise * h0, z + r * r0 * Math.sin(b)],
          [x + r * r1 * Math.cos(b), y + rise * h1, z + r * r1 * Math.sin(b)],
          [x + r * r1 * Math.cos(a), y + rise * h1, z + r * r1 * Math.sin(a)],
        ],
        [Math.cos((a + b) / 2), 0.3, Math.sin((a + b) / 2)],
      );
    }
  const top = y + rise;
  cap(
    o,
    k,
    Array.from({ length: n }, (_, i) => [
      x + r * profile.at(-1)[0] * Math.cos((i * 2 * Math.PI) / n),
      z + r * profile.at(-1)[0] * Math.sin((i * 2 * Math.PI) / n),
    ]),
    top,
  );
  box(o, k, x, top, z, 0.09, rise * 0.34, 0.09);
  if (lod >= 2) {
    const seg = lod === 3 ? 16 : 8;
    for (let j = 0; j < seg; j++) {
      const a = (j * 2 * Math.PI) / seg;
      B(
        o,
        k,
        [x + 0.04 * Math.cos(a), top + rise * 0.15, z + 0.04 * Math.sin(a)],
        [x + 0.17 * Math.cos(a), top + rise * 0.12, z + 0.17 * Math.sin(a)],
        0.07,
        0.07,
      );
    }
  }
}
function pavilion(o, { x, z, r, y, Y, domeTop, domeR, k, name }, lod) {
  const n = lod <= 1 ? 4 : 8,
    ring = Array.from({ length: n }, (_, i) => [
      x + r * Math.cos(((i + 0.5) * Math.PI * 2) / n),
      z + r * Math.sin(((i + 0.5) * Math.PI * 2) / n),
    ]);
  if (lod === 0) {
    for (const q of ring) {
      const w = 0.14;
      Q(
        o,
        k,
        [
          [q[0] - w, y, q[1]],
          [q[0] + w, y, q[1]],
          [q[0] + w, Y, q[1]],
          [q[0] - w, Y, q[1]],
        ],
        [0, 0, 1],
      );
      Q(
        o,
        k,
        [
          [q[0], y, q[1] - w],
          [q[0], y, q[1] + w],
          [q[0], Y, q[1] + w],
          [q[0], Y, q[1] - w],
        ],
        [1, 0, 0],
      );
    }
  } else
    for (let i = 0; i < n; i++) {
      const f = panel(ring[i], ring[(i + 1) % n], ring);
      archStock(o, k, f, y, Y, f.L / 2, f.L * 0.34, Y - f.L * 0.38, 0.21, lod, false);
    }
  const roof = Array.from({ length: n }, (_, i) => [
    x + (r + 0.28) * Math.cos(((i + 0.5) * Math.PI * 2) / n),
    z + (r + 0.28) * Math.sin(((i + 0.5) * Math.PI * 2) / n),
  ]);
  solid(o, k, roof, Y, Y + 0.24);
  lathe(o, k === 'marble' ? 'marble' : 'gold', x, z, Y + 0.25, domeTop - Y - 0.25, domeR, lod);
  pavilionEvidence.push({
    name,
    x,
    z,
    y,
    Y,
    r,
    domeTop,
    probe: [x, y + (Y - y) * 0.42, z - r * 0.92],
    direction: [0, 0, 1],
  });
}
function hall(o, lod) {
  const r = p.derivedParts.mainHall.outline;
  solid(o, 'wall', r, A.foundationBottom, A.terrace);
  for (const [y, Y, upper] of [
    [A.terrace, A.hallUpperFloor, false],
    [A.hallUpperFloor, A.hallWallTop, true],
  ])
    facades(
      o,
      'wall',
      r,
      y,
      Y,
      (f, i) => {
        if (i === 1) return []; // Shared mainhall/eastern-wing wall has no exterior window census.
        const n = i % 2 === 0 ? 7 : 6;
        return Array.from({ length: n }, (_, j) => ({
          x: (f.L * (j + 0.5)) / n,
          w: upper ? 1.35 : 1.65,
          y: upper ? 10.2 : 2.4,
          Y: upper ? 13.15 : 6.3,
        }));
      },
      lod,
      'mainhall',
    );
  cap(o, 'wall', r, A.hallRoof);
  for (const y of lod === 0
    ? [A.hallUpperFloor, A.hallRoof]
    : [A.hallLowerCornice, A.hallUpperFloor, A.hallUpperCornice, A.hallRoof])
    ring(o, y === A.hallRoof ? 'wall' : 'trim', r, y, y + 0.25, lod === 0 ? 0.28 : 0.48);
  if (lod >= 2) {
    for (const y of [2.0, 7.35, 9.6, 14.45]) ring(o, 'trim', r, y, y + 0.1, 0.04);
    for (let i = 0; i < 4; i++) {
      const f = panel(r[i], r[(i + 1) % 4], r),
        n = Math.floor(f.L / 1.5);
      for (let j = 0; j < n; j++) {
        const q = f.P(((j + 0.5) * f.L) / n, A.hallRoof - 0.48, 0.17);
        box(o, 'wall', q[0], q[1], q[2], 0.22, 0.3, 0.45);
      }
    }
  }
  if (lod >= 2) {
    for (let i = 0; i < 4; i++) {
      const f = panel(r[i], r[(i + 1) % 4], r),
        n = Math.floor(f.L / 2.4);
      for (let j = 1; j < n; j++) {
        const t = (f.L * j) / n;
        B(o, 'wall', f.P(t, 1.5, 0.015), f.P(t, 14.5, 0.015), 0.035, 0.05);
      }
    }
  }
  for (const q of [
    [-35.3, -12.8],
    [-6.7, -12.8],
    [-35.3, 11.3],
    [-6.7, 11.3],
  ])
    pavilion(
      o,
      {
        x: q[0],
        z: q[1],
        r: 1.43,
        y: A.hallParapet,
        Y: A.cornerPavilionTop,
        domeTop: A.cornerDomeTop,
        domeR: 1.46,
        k: 'wall',
        name: 'gold-corner-chhatri',
      },
      lod,
    );
  pavilion(
    o,
    {
      x: -21,
      z: 0.2,
      r: 3.3,
      y: A.hallParapet,
      Y: A.centralPavilionTop,
      domeTop: A.centralDomeTop,
      domeR: 3.6,
      k: 'wall',
      name: 'central-gold-dome',
    },
    lod,
  );
}
function east(o, lod) {
  solid(o, 'marble', eastern, A.foundationBottom, A.terrace);
  for (let level = 0; level < 5; level++) {
    const y = A.terrace + (level * (A.easternRoof - A.terrace)) / 5,
      Y = A.terrace + ((level + 1) * (A.easternRoof - A.terrace)) / 5;
    const detailLod = lod >= 2 ? lod : 0;
    facades(
      o,
      'marble',
      eastern,
      y,
      Y,
      (f, i) => {
        if (i === 0) return []; // Intrinsic western shared wall.
        const n = i % 2 === 0 ? 6 : 8;
        return Array.from({ length: n }, (_, j) => ({
          x: (f.L * (j + 0.5)) / n,
          w: 1.12,
          y: y + 0.7,
          Y: Y - 0.6,
        }));
      },
      detailLod,
      'eastern',
    );
    if (lod >= 1) ring(o, 'marble', eastern, Y - 0.12, Y + 0.1, 0.18);
  }
  cap(o, 'marble', eastern, A.easternRoof);
  ring(o, 'marble', eastern, A.easternRoof, A.easternParapet, 0.1);
  for (const q of eastern) nativeEvidence.push(toWorld([q[0], 0, q[1]]));
}
function gateway(o, lod) {
  const r = p.derivedParts.gateway.outline;
  solid(o, 'marble', r, A.foundationBottom, A.terrace);
  for (let i = 0; i < 4; i++) {
    const f = panel(r[i], r[(i + 1) % 4], r);
    if (i % 2 === 0)
      archStock(o, 'marble', f, A.terrace, A.gatewayRoof, f.L / 2, 2.25, 4.25, 0.36, lod);
    else plane(o, 'marble', f, 0, f.L, A.terrace, A.gatewayRoof);
  }
  cap(o, 'marble', r, A.gatewayRoof);
  ring(o, 'marble', r, A.gatewayRoof - 0.1, A.gatewayRoof + 0.25, 0.45);
  ring(o, 'marble', r, A.gatewayRoof + 0.25, A.gatewayParapet, 0.1);
  for (const q of [
    [-17.5, -18.6],
    [-9.5, -18.6],
    [-13.5, -18.6],
  ])
    pavilion(
      o,
      {
        x: q[0],
        z: q[1],
        r: 1.12,
        y: A.gatewayParapet,
        Y: A.gatewayPavilionTop,
        domeTop: A.gatewayDomeTop,
        domeR: 1.13,
        k: 'marble',
        name: 'white-gateway-chhatri',
      },
      lod,
    );
  const tr = p.derivedParts.northTerrace.outline;
  solid(o, 'marble', tr, A.foundationBottom, A.terrace);
  if (lod >= 1) {
    for (const [x, X] of [
      [-38, -19],
      [-8, -4],
    ]) {
      box(o, 'marble', (x + X) / 2, A.terrace, -18.55, X - x, 0.16, 0.26);
      box(o, 'marble', (x + X) / 2, A.terrace + 1.05, -18.55, X - x, 0.15, 0.3);
      const n = Math.floor((X - x) / (lod === 1 ? 1.5 : 0.45));
      for (let j = 0; j <= n; j++)
        box(o, 'marble', x + ((X - x) * j) / n, A.terrace, -18.55, 0.09, 1.08, 0.12);
    }
  }
  for (let j = 0; j < 6; j++) {
    const top = (A.terrace * (j + 1)) / 6,
      z = -22.4 + j * 0.4;
    box(o, 'marble', -13.5, 0, z, 5.6, top, 0.4);
    stairEvidence.push({ center: [-13.5, z], top });
  }
}
export function buildGurdwaraSisGanjSahib(target, _frame, lod = 3) {
  for (const list of [
    partEvidence,
    openingEvidence,
    pavilionEvidence,
    archEvidence,
    nativeEvidence,
    stairEvidence,
  ])
    list.length = 0;
  let count = 0;
  const o = {
      addTriangle(...args) {
        count++;
        target.addTriangle(...args);
      },
      addQuad(...args) {
        count += 2;
        target.addQuad(...args);
      },
      addConvexPolygon(...a) {
        count += a[2].length - 2;
        target.addConvexPolygon(...a);
      },
    },
    part = (name, fn) => {
      const n = count;
      fn();
      partEvidence.push({ name, triangles: count - n });
    };
  part('photo-reconstructed-mainhall-five-open-gold-domed-pavilions', () => hall(o, lod));
  part('native-four-control-five-level-eastern-wing', () => east(o, lod));
  part('white-marble-open-arched-entry-three-chhatris-terrace-six-steps', () => gateway(o, lod));
}
export const gurdwaraSisGanjSahibSkyline = (o) => buildGurdwaraSisGanjSahib(o, null, 0),
  gurdwaraSisGanjSahibDistrict = (o) => buildGurdwaraSisGanjSahib(o, null, 1),
  gurdwaraSisGanjSahibStreet = (o) => buildGurdwaraSisGanjSahib(o, null, 2),
  gurdwaraSisGanjSahibCloseup = (o) => buildGurdwaraSisGanjSahib(o, null, 3),
  cam = (x, y, z) => toWorld([x, y, z]);
export const gurdwaraSisGanjSahibModel = {
  id: 'gurdwara_sis_ganj_sahib',
  key: 'gurdwara_sis_ganj_sahib',
  cell: 'tt/ttn',
  title: 'Gurdwara Sis Ganj Sahib',
  wikidataId: 'Q5620491',
  category: 'religious',
  recipe: 'gurdwara-sis-ganj-sahib-model.mjs',
  progressLedger: 'qualla-002.PROGRESS.md',
  surfaces,
  build: buildGurdwaraSisGanjSahib,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  orientationPolicy: 'approximate-visualization',
  groundContactBasis: p.sectionBasis,
  brief:
    'Whole Gurdwara Sis Ganj Sahib: photo-reconstructed warm sandstone mainhall, tiered cornices, recessed jali windows, central gold onion dome and four open gold-domed corner chhatris; white marble street gateway with genuine open arches and three visible roof chhatris, intrinsic terrace/six steps; actual native four-control five-level flat-roof eastern wing. Worship-area rectangle is identity context only, never extruded as the hall. Qualla-published Jais006 2011 own CC0 exterior; hidden plans, heights, rear facades and current changes bounded. Separate neighboring mosque excluded.',
  camera: cam(-87, 53, -105),
  lookAt: cam(-2, 9, 0),
  portableGroundY: F - 0.45,
  mediumFiContext: { cameraYaw: -2.5, groundY: F - 0.3 },
  embeddedCanonicalGraphs: ['stone_sandstone_raw', 'stone_sandstone', 'stone_marble', 'wood_plain'],
  qaCameras: [
    {
      name: 'whole-street-mainhall-gold-domes-marble-gateway-and-eastern-wing',
      position: cam(-73, 42, -92),
      lookAt: cam(-7, 9, 0),
    },
    {
      name: 'whole-assembly-native-eastern-wing-and-derived-western-hall-plan',
      position: cam(0, 115, 0.1),
      lookAt: cam(0, 8, 0),
    },
    {
      name: 'central-open-pavilion-and-gold-onion-dome',
      position: cam(-31, 23, -25),
      lookAt: cam(-21, 19, 0),
    },
    {
      name: 'marble-gateway-open-arch-three-chhatris-and-intrinsic-stairs',
      position: cam(-13.5, 7, -36),
      lookAt: cam(-13.5, 6, -17),
    },
    {
      name: 'whole-rear-and-five-level-native-eastern-wing',
      position: cam(83, 45, 76),
      lookAt: cam(0, 9, 0),
    },
  ],
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/gurdwara-sis-ganj-sahib-runtime-overlay.mjs',
    level: 'skyline',
    export: 'gurdwaraSisGanjSahibSkyline',
    errorMeters: 1,
    surfaces,
    authoredLevels: {
      district: { export: 'gurdwaraSisGanjSahibDistrict', errorMeters: 0.4, surfaces },
      street: { export: 'gurdwaraSisGanjSahibStreet', errorMeters: 0.12, surfaces },
      closeup: { export: 'gurdwaraSisGanjSahibCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: [
    p.geometryBasis,
    p.authoringDirection,
    p.sectionBasis,
    'Exact published 2011 Jais006 own CC0 photograph supplies the visible exterior. Photo-hidden mainhall/rear layouts, dome/pavilion census, dimensions, jali motifs, roof partitions, finishes and current repairs are bounded estimates, not measured survey or current photogrammetry. Native eastern four-control physical building and five levels retained at every LOD.',
    'Five gold-domed pavilions and three visible white gateway chhatris are explicit photographic reconstructions. All pavilions and gateway arches contain actual voids; skyline simplifies columns and dome profiles, district omits eastern window apertures, detailed levels add genuine facade recesses and lattice. No neighboring mosque, property pad, street fixtures, people, traffic, wires, inscriptions, interiors or photographic texture pixels.',
    'Original native frame/256m129field/floor/main sections frozen before geometry. No fitting, flattening, field replacement, reframing, reacquisition or raising. Exact ground contact unverified; geographic preview/replacement false. Flat review ground and synthetic context neighbors are fixtures.',
  ],
};
