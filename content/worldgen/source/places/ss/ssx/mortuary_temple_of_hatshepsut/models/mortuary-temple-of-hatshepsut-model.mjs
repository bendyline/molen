/** Whole three-terrace temple; actual native components and original bounded restoration geometry. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import fs from 'node:fs';
import { ShapeUtils, Vector2 } from 'three';
import {
  cross,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';

const p = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url))),
  frame = JSON.parse(fs.readFileSync(new URL('../map-frame.json', import.meta.url))),
  { floorY: F, axisU: U, axisV: V, architecturalSections: A } = p.parameters;
export const surfaces = {
  stone: { slot: 'wall', graph: 'stone_limestone', roughness: 0.94, metallic: 0 },
  cap: { slot: 'trim', graph: 'stone_limestone_weathered', roughness: 0.95, metallic: 0 },
  rough: { slot: 'foundation', graph: 'stone_sandstone_raw', roughness: 0.99, metallic: 0 },
  dark: { slot: 'window', localRef: 'palette:#ffffff', roughness: 1, metallic: 0 },
};
const C = { stone: rgb('e8d4b4'), cap: rgb('e2d7c3'), rough: rgb('cbb48f'), dark: rgb('554b39') },
  stones = ['e2cfae', 'e9d7b8', 'dec9a6', 'e6d2b2'].map(rgb),
  sub = (a, b) => a.map((v, i) => v - b[i]),
  dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0),
  mix = (a, b, t) => a + (b - a) * t,
  mean = (r) => [0, 1].map((k) => r.reduce((s, q) => s + q[k], 0) / r.length),
  area = (r) =>
    r.reduce((s, a, i) => {
      const b = r[(i + 1) % r.length];
      return s + a[0] * b[1] - b[0] * a[1];
    }, 0);
export const toWorld = (q) => [U[0] * q[0] + V[0] * q[2], F + q[1], U[1] * q[0] + V[1] * q[2]],
  direction = (q) => [U[0] * q[0] + V[0] * q[2], q[1], U[1] * q[0] + V[1] * q[2]],
  ring = (id) =>
    frame.features
      .find((f) => f.id === `way/${id}`)
      .outline.slice(0, -1)
      .map((q) => [q[0] * U[0] + q[1] * U[1], q[0] * V[0] + q[1] * V[1]]);
export const nativeEvidence = [],
  porticoEvidence = [],
  rampEvidence = [],
  statueEvidence = [],
  partEvidence = [];
function T(o, k, q, n, col = C[k]) {
  q = q.map((v) => toWorld(v).map(Math.fround));
  const cr = cross(sub(q[1], q[0]), sub(q[2], q[0]));
  if (Math.hypot(...cr) < 1e-8) return;
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
function cap(o, k, r, y, up = true, col = C[k], holes = []) {
  const pts = [...r, ...holes.flat()],
    faces = ShapeUtils.triangulateShape(
      r.map((q) => new Vector2(...q)),
      holes.map((r) => r.map((q) => new Vector2(...q))),
    );
  for (const ix of faces)
    T(
      o,
      k,
      ix.map((i) => [pts[i][0], typeof y === 'function' ? y(pts[i]) : y, pts[i][1]]),
      [0, up ? 1 : -1, 0],
      col,
    );
}
function solid(o, k, r, y, Y, col = C[k], bottom = true, top = true) {
  if (r.length < 3) return;
  const sign = area(r) > 0 ? 1 : -1;
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      h = (q) => (typeof y === 'function' ? y(q) : y),
      H = (q) => (typeof Y === 'function' ? Y(q) : Y);
    Q(
      o,
      k,
      [
        [a[0], h(a), a[1]],
        [b[0], h(b), b[1]],
        [b[0], H(b), b[1]],
        [a[0], H(a), a[1]],
      ],
      [sign * (b[1] - a[1]), 0, sign * (a[0] - b[0])],
      col,
    );
  }
  if (bottom) cap(o, k, r, y, false, col);
  if (top) cap(o, k, r, Y, true, col);
}
const rect = (x, X, z, Z) => [
    [x, z],
    [X, z],
    [X, Z],
    [x, Z],
  ],
  bounds = (r) => ({
    x: Math.min(...r.map((q) => q[0])),
    X: Math.max(...r.map((q) => q[0])),
    z: Math.min(...r.map((q) => q[1])),
    Z: Math.max(...r.map((q) => q[1])),
  });
function clip(r, axis, value, positive = true) {
  const out = [],
    s = positive ? 1 : -1;
  let a = r.at(-1),
    av = (a[axis] - value) * s;
  for (const b of r) {
    const bv = (b[axis] - value) * s;
    if (av >= 0 !== bv >= 0) {
      const t = av / (av - bv);
      out.push(a.map((v, i) => v + (b[i] - v) * t));
    }
    if (bv >= 0) out.push(b);
    a = b;
    av = bv;
  }
  return out;
}
function hull(rr) {
  const r = [...new Map(rr.map((q) => [q.map((v) => v.toFixed(7)).join(','), q])).values()].sort(
      (a, b) => a[0] - b[0] || a[1] - b[1],
    ),
    cr = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]),
    half = (a) => {
      const out = [];
      for (const q of a) {
        while (out.length >= 2 && cr(out.at(-2), out.at(-1), q) <= 0) out.pop();
        out.push(q);
      }
      return out;
    },
    a = half(r),
    b = half([...r].reverse());
  return [...a.slice(0, -1), ...b.slice(0, -1)];
}
function edgeWall(o, a, b, y, Y, width = 0.55, k = 'rough', col = C[k], economy = false) {
  const d = sub(b, a),
    L = Math.hypot(...d);
  if (L < 0.02) return;
  const n = [((-d[1] / L) * width) / 2, ((d[0] / L) * width) / 2],
    r = [
      a.map((v, i) => v + n[i]),
      b.map((v, i) => v + n[i]),
      b.map((v, i) => v - n[i]),
      a.map((v, i) => v - n[i]),
    ];
  if (!economy) {
    solid(o, k, r, y, Y, col);
    return;
  }
  for (const [i, j] of [
    [0, 1],
    [2, 3],
  ])
    Q(
      o,
      k,
      [
        [r[i][0], y, r[i][1]],
        [r[j][0], y, r[j][1]],
        [r[j][0], Y, r[j][1]],
        [r[i][0], Y, r[i][1]],
      ],
      null,
      col,
    );
  cap(o, k, r, Y, true, col);
}
function record(id, y) {
  nativeEvidence.push({ id, controls: ring(id).map((q) => toWorld([q[0], y, q[1]])) });
}
function decoratedPier(o, r, y, Y, lod, index) {
  const b = bounds(r);
  if (lod < 3) {
    solid(o, 'stone', r, y, Y, C.stone, false);
    return;
  }
  const n = 6;
  for (let j = 0; j < n; j++) {
    const low = mix(y, Y, j / n),
      high = mix(y, Y, (j + 1) / n) - 0.012;
    solid(o, 'stone', r, low, high, stones[(index + j) % stones.length], false);
    if (j < n - 1)
      solid(
        o,
        'stone',
        rect(b.x + 0.008, b.X - 0.008, b.z + 0.008, b.Z - 0.008),
        high,
        high + 0.012,
        stones[(index + j + 1) % stones.length],
        false,
      );
  }
  solid(
    o,
    'cap',
    rect(b.x - 0.07, b.X + 0.07, b.z - 0.07, b.Z + 0.07),
    Y - 0.14,
    Y + 0.12,
    C.cap,
    false,
  );
}
const middleIds = [
    255034087, 255034089, 255034093, 255174684, 255042397, 255188564, 255038430, 1148195911,
  ],
  upperIds = [255034091, 255183533, 255042404, 298119233],
  middleHull = hull(middleIds.flatMap(ring)),
  upperHull = hull(upperIds.flatMap(ring)),
  lowerFront = Math.min(bounds(ring(255034087)).x, bounds(ring(255034089)).x),
  lowerBack = Math.max(bounds(ring(255034087)).X, bounds(ring(255034089)).X),
  upperFront = bounds(ring(255034091)).x,
  middleBack = Math.max(bounds(ring(255034093)).X, bounds(ring(255174684)).X);
export const platformEvidence = {
  middleEnvelope: clip(middleHull, 0, lowerFront),
  upperEnvelope: clip(upperHull, 0, upperFront),
  basis:
    'Original bounded platform hulls from actual named retained walls/porticos/chapels. These are architecture envelopes, not surveyed floor polygons or the whole archaeological boundary.',
};
function platforms(o, lod) {
  const middle = platformEvidence.middleEnvelope,
    upper = platformEvidence.upperEnvelope;
  solid(o, 'rough', clip(middle, 0, lowerBack), A.foundationBottom, A.lowerRoof, C.rough, lod > 0);
  solid(o, 'cap', middle, A.lowerRoof, A.middleDeck, C.cap, lod > 0);
  solid(
    o,
    'rough',
    clip(upper, 0, middleBack + 0.1),
    A.middleDeck,
    A.middleRoof - 0.1,
    C.rough,
    lod > 0,
  );
  solid(o, 'cap', upper, A.middleRoof - 0.1, A.upperDeck, C.cap, lod > 0);
  for (const id of [255034087, 255034089])
    solid(o, 'cap', ring(id), A.foundationBottom, A.lowerDeck, C.cap, lod > 0);
  if (lod >= 2) {
    for (const r of [middle, upper]) {
      const b = bounds(r),
        y = r === middle ? A.middleDeck : A.upperDeck;
      for (let u = Math.ceil(b.x / 4) * 4; u < b.X; u += 4) {
        const band = clip(clip(r, 0, u), 0, u + 0.022, false);
        if (band.length >= 3) cap(o, 'cap', band, y + 0.006, true, rgb('ac9a7c'));
      }
    }
  }
}
function inferRows(o, id, y, Y, lod, upper = false) {
  const r = ring(id),
    b = bounds(r),
    rows = lod === 0 ? 1 : 2,
    depth = b.X - b.x,
    wingRanges = upper
      ? [
          [b.z, -1.9],
          [5.5, b.Z],
        ]
      : [[b.z, b.Z]],
    locations = [];
  for (const [z, Z] of wingRanges) {
    const N = upper ? A.frontUpperPierCountPerWing : A.frontMiddlePierCountPerWing;
    for (let j = 0; j < rows; j++) {
      const u = rows === 1 ? b.x + 0.65 : j === 0 ? b.x + 0.65 : b.X - 1.1;
      for (let i = 0; i < N; i++) {
        if (lod === 0 && i % 6 !== 0) continue;
        if (lod === 1 && j === 1 && i % 2 !== 0) continue;
        const v = mix(z + 0.7, Z - 0.7, i / (N - 1)),
          pp = rect(u - 0.5, u + 0.5, v - 0.5, v + 0.5);
        decoratedPier(o, pp, y, Y, lod, id + i + j);
        locations.push([u, v]);
      }
    }
  }
  return { depth, locations };
}
function portico(o, id, y, roof, lod, kind) {
  const r = ring(id),
    b = bounds(r);
  solid(o, 'cap', r, roof - A.roofThickness, roof, C.cap, lod > 0);
  const back = clip(r, 0, b.X - 0.42);
  solid(o, 'stone', back, y, roof - A.roofThickness, C.stone, lod > 0);
  const inferred =
    kind === 'middle' || kind === 'upper'
      ? inferRows(o, id, y, roof - A.roofThickness, lod, kind === 'upper')
      : null;
  porticoEvidence.push({
    id,
    kind,
    floor: y,
    roof,
    open: true,
    inferredRows: inferred?.locations.length ?? 0,
  });
  record(id, roof);
  if (lod >= 2) {
    const topBand = clip(r, 0, b.x + 0.18, false);
    solid(o, 'cap', topBand, roof - 0.12, roof + 0.14, C.cap, false);
    if (lod === 3) {
      const N = Math.ceil((b.Z - b.z) / 2.8);
      for (let j = 1; j < N; j++) {
        const v = mix(b.z, b.Z, j / N);
        solid(
          o,
          'stone',
          rect(b.x - 0.005, b.x + 0.015, v, v + 0.025),
          roof - 0.32,
          roof - 0.02,
          rgb('a99474'),
          false,
        );
      }
    }
  }
}
function nativePiers(o, lod) {
  for (let i = 0; i < p.columnIds.length; i++) {
    if (lod === 0 && i % 12 !== 0) continue;
    if (lod === 1 && i % 3 === 2) continue;
    const id = p.columnIds[i],
      r = ring(id),
      [u, v] = mean(r);
    if (lod === 0 && u >= 20) continue;
    let floor = A.upperDeck,
      top = A.upperCourtPiersTop;
    if (u < 20) {
      floor = A.lowerDeck;
      top = A.lowerRoof - A.roofThickness;
    } else if (u < 100 && v > 35) {
      floor = A.middleDeck;
      top = A.anubisRoof - A.roofThickness;
    } else if (v > 40 && u < 110) {
      floor = A.middleDeck;
      top = A.anubisRoof - A.roofThickness;
    }
    decoratedPier(o, r, floor, top, lod, i);
    record(id, top);
  }
}
function ramp(o, id, y, Y, lod, upper = false) {
  const r = ring(id),
    b = bounds(r),
    end = upper ? b.X : lowerFront,
    profile = (q) => mix(y, Y, Math.max(0, Math.min(1, (q[0] - b.x) / (end - b.x))));
  solid(o, 'cap', r, (q) => profile(q) - 0.35, profile, C.cap, lod > 0);
  record(id, Y);
  const longEdges = [];
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      c = r[(i + 1) % r.length];
    if (Math.abs(c[0] - a[0]) > Math.abs(c[1] - a[1]) * 3 && Math.abs(c[0] - a[0]) > 10)
      longEdges.push([a, c]);
  }
  for (const [a, b] of longEdges) {
    const D = sub(b, a),
      L = Math.hypot(...D),
      n = [(-D[1] / L) * 0.35, (D[0] / L) * 0.35],
      q = [
        a.map((v, k) => v + n[k]),
        b.map((v, k) => v + n[k]),
        b.map((v, k) => v - n[k]),
        a.map((v, k) => v - n[k]),
      ];
    solid(o, 'stone', q, profile, (q) => profile(q) + A.railHeight, C.stone, lod > 0);
  }
  if (lod >= 2) {
    const minV = (b.z + b.Z) / 2 - 1.35,
      maxV = minV + 2.7,
      N = lod === 3 ? Math.ceil((Y - y) / 0.15) : Math.ceil((Y - y) / 0.45);
    for (let j = 0; j < N; j++) {
      const u = mix(b.x, end, j / N),
        U = mix(b.x, end, (j + 1) / N),
        h = mix(y, Y, (j + 1) / N) + 0.02;
      solid(o, 'cap', rect(u, U, minV, maxV), (q) => profile(q) - 0.01, h, C.cap, false);
    }
  }
  if (upper) {
    solid(o, 'cap', rect(b.X, upperFront, b.z, b.Z), Y - 0.4, Y, C.cap, lod > 0);
    for (const v of [b.z, b.Z])
      edgeWall(o, [b.X, v], [upperFront, v], Y, Y + A.railHeight, 0.55, 'stone', C.stone);
  }
  rampEvidence.push({
    id,
    bottom: y,
    top: Y,
    profileStartU: b.x,
    profileEndU: end,
    nativeFootprint: r.length,
    rails: longEdges.length,
    openWalkableSurface: true,
  });
}
function wallComplex(o, id, y, Y, lod) {
  const r = ring(id);
  if (lod === 0) {
    const h = hull(r);
    for (let i = 0; i < h.length; i++) {
      const a = h[i],
        b = h[(i + 1) % h.length];
      if (id === 255183533 && a[0] < 112 && b[0] < 112) continue;
      edgeWall(o, a, b, y, Y, 0.75, 'stone', C.stone, true);
    }
    return;
  }
  solid(o, 'stone', r, y, Y, C.stone, lod > 1);
  record(id, Y);
  if (lod === 3) {
    const b = bounds(r);
    for (let h = y + 0.7; h < Y; h += 0.75) {
      const strip = clip(r, 0, b.x + 0.12, false);
      if (strip.length >= 3) solid(o, 'cap', strip, h, h + 0.018, rgb('b5a07f'), false);
    }
  }
}
function court(o, lod) {
  const r = ring(255034095);
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length];
    edgeWall(o, a, b, A.foundationBottom, 0.75, 0.55, 'rough', C.rough, lod === 0);
  }
  for (const id of [255169869]) {
    if (lod === 0) continue;
    solid(o, 'rough', ring(id), A.foundationBottom, 0.8, C.rough, lod > 1);
    record(id, 0.8);
  }
  const rampR = ring(255034092),
    b = bounds(rampR),
    courtB = bounds(r);
  solid(o, 'cap', rect(courtB.x, b.x, b.z + 0.65, b.Z - 0.65), -0.18, A.lowerDeck, C.cap, lod > 0);
  if (lod >= 2)
    for (let u = Math.ceil(courtB.x / 3) * 3; u < b.x; u += 3)
      solid(
        o,
        'stone',
        rect(u, u + 0.025, b.z + 0.65, b.Z - 0.65),
        A.lowerDeck,
        A.lowerDeck + 0.008,
        rgb('b6a181'),
        false,
      );
}
function horizontalRoofedChapel(o, id, floor, roof, lod) {
  const r = ring(id),
    b = bounds(r);
  solid(o, 'cap', r, floor - 0.3, floor, C.cap, lod > 0);
  solid(o, 'cap', r, roof - 0.35, roof, C.cap, lod > 0);
  solid(o, 'stone', clip(r, 0, b.X - 2.2), floor, roof - 0.35, C.stone, lod > 0);
  for (const v of [b.z + 0.35, b.Z - 0.35])
    solid(
      o,
      'stone',
      rect(b.x + 0.1, b.X - 0.4, v - 0.3, v + 0.3),
      floor,
      roof - 0.35,
      C.stone,
      lod > 0,
    );
  if (id === 255038430) {
    const N = lod === 0 ? 3 : lod === 1 ? 4 : 6;
    for (let j = 0; j < (lod === 0 ? 1 : 2); j++)
      for (let i = 0; i < N; i++) {
        const u = b.x + 0.85 + j * 3.25,
          v = mix(b.z + 1.5, b.Z - 1.5, i / (N - 1)),
          base = rect(u - 0.45, u + 0.45, v - 0.45, v + 0.45);
        decoratedPier(o, base, floor, roof - 0.35, lod, id + i);
        if (lod >= 2)
          solid(
            o,
            'cap',
            rect(u - 0.65, u + 0.65, v - 0.6, v + 0.6),
            roof - 1.05,
            roof - 0.35,
            C.cap,
            false,
          );
      }
  }
  record(id, roof);
}
function statue(o, u, v, lod) {
  if (lod < 2) return;
  const y = A.upperDeck,
    n = lod === 2 ? 6 : 12,
    ellipse = (Y, rx, rz, cx = 0) =>
      Array.from({ length: n }, (_, i) => {
        const a = (i / n) * Math.PI * 2;
        return [u + cx + Math.cos(a) * rx, Y, v + Math.sin(a) * rz];
      }),
    loft = (rings) => {
      for (let j = 1; j < rings.length; j++)
        for (let i = 0; i < n; i++) {
          const k = (i + 1) % n;
          Q(
            o,
            'stone',
            [rings[j - 1][i], rings[j - 1][k], rings[j][k], rings[j][i]],
            [
              (rings[j - 1][i][0] + rings[j - 1][k][0]) / 2 - u,
              0,
              (rings[j - 1][i][2] + rings[j - 1][k][2]) / 2 - v,
            ],
            C.stone,
          );
        }
      for (const ring of [rings[0], rings.at(-1)])
        for (let i = 1; i < ring.length - 1; i++)
          T(
            o,
            'stone',
            [ring[0], ring[i], ring[i + 1]],
            [0, ring === rings[0] ? -1 : 1, 0],
            C.stone,
          );
    };
  solid(o, 'cap', rect(u - 0.65, u + 0.65, v - 0.65, v + 0.65), y, y + 0.25, C.cap, false);
  loft([
    ellipse(y + 0.25, 0.42, 0.48),
    ellipse(y + 1.3, 0.47, 0.53),
    ellipse(y + 2.65, 0.58, 0.65),
    ellipse(y + 3.3, 0.44, 0.58),
  ]);
  loft([
    ellipse(y + 3.3, 0.28, 0.34, -0.05),
    ellipse(y + 3.85, 0.32, 0.37, -0.12),
    ellipse(y + 4.15, 0.22, 0.27, -0.1),
  ]);
  loft([
    ellipse(y + 4.12, 0.23, 0.27, -0.1),
    ellipse(y + 4.65, 0.18, 0.24, -0.1),
    ellipse(y + 4.95, 0.04, 0.06, -0.1),
  ]);
  statueEvidence.push({ u, v, bottom: y, top: y + 4.95, simplifiedOriginalMummiform: true });
}
export function buildMortuaryTempleOfHatshepsut(target, _frame, lod = 3) {
  for (const a of [nativeEvidence, porticoEvidence, rampEvidence, statueEvidence, partEvidence])
    a.length = 0;
  let count = 0;
  const o = {
      addTriangle(...a) {
        count++;
        target.addTriangle(...a);
      },
    },
    part = (name, fn) => {
      const start = count;
      fn();
      partEvidence.push({ name, triangles: count - start });
    };
  part('intrinsic-three-terraces-and-open-courts', () => {
    platforms(o, lod);
    court(o, lod);
  });
  part('three-open-colonnade-levels', () => {
    for (const id of [255034087, 255034089]) portico(o, id, A.lowerDeck, A.lowerRoof, lod, 'lower');
    for (const id of [255034093, 255174684])
      portico(o, id, A.middleDeck, A.middleRoof, lod, 'middle');
    portico(o, 255034091, A.upperDeck, A.upperRoof, lod, 'upper');
    nativePiers(o, lod);
  });
  part('two-central-rising-ramps-rails-and-stair-lanes', () => {
    ramp(o, 255034092, A.lowerDeck, A.middleDeck, lod);
    ramp(o, 255034090, A.middleDeck, A.upperDeck, lod, true);
  });
  part('attached-hathor-anubis-chapels-and-north-retaining-architecture', () => {
    horizontalRoofedChapel(o, 255038430, A.middleDeck, A.hathorRoof, lod);
    horizontalRoofedChapel(o, 1148195911, A.middleDeck, A.anubisRoof, lod);
    wallComplex(o, 255042397, A.middleDeck, A.northMiddleWallsTop, lod);
    wallComplex(o, 298149870, A.middleDeck, A.anubisRoof - 0.2, lod);
    const rr = ring(255188564);
    if (lod > 0) {
      const b = bounds(rr),
        profile = (q) =>
          mix(A.lowerDeck, A.middleDeck, Math.max(0, Math.min(1, (q[0] - b.x) / (b.X - b.x))));
      solid(o, 'rough', rr, profile, (q) => profile(q) + 1.1, C.rough);
      record(255188564, A.middleDeck + 1.1);
    }
  });
  part('upper-open-peristyle-cult-and-sanctuary-walls', () => {
    wallComplex(o, 255183533, A.upperDeck, A.upperCourtWallsTop, lod);
    if (lod > 0) wallComplex(o, 255042404, A.upperDeck, A.solarWallsTop, lod);
    if (lod > 0) wallComplex(o, 298119233, A.upperDeck, A.solarInnerWallsTop, lod);
    const r = ring(255034091),
      b = bounds(r);
    solid(
      o,
      'stone',
      rect(b.X - 0.6, b.X, b.z, b.Z),
      A.upperRoof,
      A.upperParapet,
      C.stone,
      lod > 0,
    );
    if (lod >= 2) for (const v of A.fullOsirianCentersV) statue(o, b.x - 0.2, v, lod);
  });
}
export const mortuaryTempleOfHatshepsutSkyline = (o) => buildMortuaryTempleOfHatshepsut(o, null, 0),
  mortuaryTempleOfHatshepsutDistrict = (o) => buildMortuaryTempleOfHatshepsut(o, null, 1),
  mortuaryTempleOfHatshepsutStreet = (o) => buildMortuaryTempleOfHatshepsut(o, null, 2),
  mortuaryTempleOfHatshepsutCloseup = (o) => buildMortuaryTempleOfHatshepsut(o, null, 3);
export const mortuaryTempleOfHatshepsutModel = {
  id: 'mortuary_temple_of_hatshepsut',
  key: 'mortuary_temple_of_hatshepsut',
  cell: 'ss/ssx',
  title: 'Mortuary Temple of Hatshepsut',
  wikidataId: 'Q660692',
  category: p.category,
  recipe: 'mortuary-temple-of-hatshepsut-model.mjs',
  progressLedger: 'qualla-002.PROGRESS.md',
  surfaces,
  build: buildMortuaryTempleOfHatshepsut,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  orientationPolicy: 'approximate-visualization',
  groundContactBasis: p.sectionBasis,
  brief:
    'Whole restored three-terrace Mortuary Temple of Hatshepsut: true open square-pier colonnades/upper Osirian pilasters, intrinsic courts/two rising central ramps/stone rails and stepped lanes, native165 pier footprints/seventeen architectural components, attached Hathor/Anubis chapels and upper open peristyle/solar-cult/sanctuary wall complexes. Five exact distinct creator PD-self/CC0 originals after Qualla-first assessment. Actual plan/whole native parts, bounded original vertical sections/hidden architecture/fine statue and unmapped column census, no cliff/neighboring temples/modern facilities/copied images.',
  camera: toWorld([-100, 70, -110]),
  lookAt: toWorld([75, 10, 0]),
  portableGroundY: F - 0.2,
  mediumFiContext: { scale: '1.3', groundY: F - 0.1, cameraYaw: 0.9 },
  embeddedCanonicalGraphs: ['stone_limestone', 'stone_limestone_weathered', 'stone_sandstone_raw'],
  groundCutout: {
    outline: platformEvidence.middleEnvelope.map((q) => [
      U[0] * q[0] + V[0] * q[1],
      U[1] * q[0] + V[1] * q[1],
    ]),
    additionalOutlines: [
      platformEvidence.upperEnvelope.map((q) => [
        U[0] * q[0] + V[0] * q[1],
        U[1] * q[0] + V[1] * q[1],
      ]),
    ],
    basis:
      'Intrinsic constructed terrace slabs bounded by original envelopes from actual portico/retaining-wall controls; not a changed source heightfield or the archaeological site boundary. Exact edge/contact remains approximate preview.',
  },
  qaCameras: [
    {
      name: 'whole-three-terraces-and-attached-chapels',
      position: toWorld([-175, 105, -150]),
      lookAt: toWorld([40, 8, 0]),
    },
    {
      name: 'whole-native-architecture-open-courts-and-ramps-plan',
      position: toWorld([10, 410, 0.2]),
      lookAt: toWorld([10, 0, 0]),
    },
    {
      name: 'lower-and-middle-open-pier-porticos-and-ramp',
      position: toWorld([-32, 13, 56]),
      lookAt: toWorld([36, 7, 0]),
    },
    {
      name: 'upper-osirian-portico-and-real-colonnade-depth',
      position: toWorld([67, 23, -38]),
      lookAt: toWorld([99, 17, 0]),
    },
    {
      name: 'upper-peristyle-solar-cult-and-sanctuary-complex',
      position: toWorld([149, 54, 73]),
      lookAt: toWorld([124, 17, 2]),
    },
  ],
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/mortuary-temple-of-hatshepsut-runtime-overlay.mjs',
    level: 'skyline',
    export: 'mortuaryTempleOfHatshepsutSkyline',
    errorMeters: 5,
    surfaces,
    authoredLevels: {
      district: { export: 'mortuaryTempleOfHatshepsutDistrict', errorMeters: 2, surfaces },
      street: { export: 'mortuaryTempleOfHatshepsutStreet', errorMeters: 0.5, surfaces },
      closeup: { export: 'mortuaryTempleOfHatshepsutCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: [
    p.geometryBasis,
    p.nativePlanInterpretation,
    p.sectionBasis,
    'Published Qualla corpus assessed first; two exact CC0 relief originals inspected but not used for architectural scope. Five distinct clear direct creator-own PD-self/CC0 exteriors actually used, exact native hashes/inventory passed. No questionable1946 plan, Flickr binding repair, media metadata changes, protected supplemental pixels or copied imagery. Standing2010/2016 shell/current native parts; later fine conservation condition not surveyed.',
    'Native lower44/Anubis12/peristyle piers retained in close levels; middle/frontupper pier rows, six simplified original mummiform pilasters/partial damaged census and horizontal platform envelope hulls are photo-bounded estimates. Hidden sanctuary/chapel/peristyle roof/wall profiles/ancient fine ornament simplified. Lower court remains open ground with intrinsic perimeter/path, not filled property building. Neighboring temples/natural cliff/scaffolds/people/modern shelters excluded.',
    'Original independent512m129field/two raw tiles/floor fixed before all vertical sections and geometry; no fitting, flattening, reacquire/reframe/late raising. Intrinsic terrace preview openings only; precise courtyard/retaining/cliff/entry/foundation contacts unverified. Portable flat ground and context houses are fixtures; replacementfalse.',
  ],
};
