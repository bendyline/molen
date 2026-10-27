/** Whole covered Cholula pyramid: original relief, native extents and exposed structural excavations. */
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
  f = JSON.parse(fs.readFileSync(new URL('../map-frame.json', import.meta.url))),
  g = JSON.parse(fs.readFileSync(new URL('../terrain-grid.json', import.meta.url))),
  A = p.parameters.architecturalSections,
  F = p.parameters.floorY;
const C = {
  turf: rgb('7d8557'),
  earth: rgb('a09a85'),
  stone: rgb('8c8372'),
  stucco: rgb('d8ceba'),
};
export const surfaces = {
  turf: { slot: 'wall', localRef: 'palette:#ffffff', roughness: 0.99, metallic: 0 },
  earth: { slot: 'trim', graph: 'gravel', roughness: 0.99, metallic: 0 },
  stone: { slot: 'wall', graph: 'stone_basalt', roughness: 0.98, metallic: 0 },
  stucco: { slot: 'wall', graph: 'plaster_lime', roughness: 0.96, metallic: 0 },
};
const sub = (a, b) => a.map((v, i) => v - b[i]),
  dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0),
  area = (r) =>
    r.reduce((s, a, i) => {
      const b = r[(i + 1) % r.length];
      return s + a[0] * b[1] - a[1] * b[0];
    }, 0),
  triangulate = (r) =>
    ShapeUtils.triangulateShape(
      r.map((q) => new Vector2(...q)),
      [],
    ),
  K = (q) => q.map((v) => Math.round(v * 1e6)).join('/');
export const main = p.coveredMassBoundary.outline,
  whole = p.wholeBoundary.outline,
  west = p.additionalNativeFeatures[0].outline.slice(0, -1),
  south = f.features[1].outline.slice(0, -1),
  altar = p.additionalNativeFeatures[1].outline.slice(0, -1),
  partEvidence = [],
  surfaceEvidence = [],
  wallEvidence = [],
  stairEvidence = [],
  altarEvidence = [],
  seedEvidence = [];
export function sample(x, z) {
  const a = (x - g.origin[0]) / g.stepMeters,
    b = (z - g.origin[1]) / g.stepMeters,
    i = Math.floor(a),
    j = Math.floor(b),
    u = a - i,
    v = b - j;
  return (
    (g.heightsMeters[j][i] * (1 - u) + g.heightsMeters[j][i + 1] * u) * (1 - v) +
    (g.heightsMeters[j + 1][i] * (1 - u) + g.heightsMeters[j + 1][i + 1] * u) * v -
    g.modelDatumElevationMeters
  );
}
export function inRing(q, r) {
  let v = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const a = r[i],
      b = r[j];
    if (
      a[1] > q[1] !== b[1] > q[1] &&
      q[0] < ((b[0] - a[0]) * (q[1] - a[1])) / (b[1] - a[1]) + a[0]
    )
      v = !v;
  }
  return v;
}
function T(o, k, q, n, col = C[k]) {
  q = q.map((v) => v.map(Math.fround));
  const c = cross(sub(q[1], q[0]), sub(q[2], q[0]));
  if (Math.hypot(...c) < 1e-7) return;
  if (n && dot(c, n) < 0) [q[1], q[2]] = [q[2], q[1]];
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
function cap(o, k, r, y, up = true) {
  for (const t of triangulate(r))
    T(
      o,
      k,
      t.map((i) => [r[i][0], y, r[i][1]]),
      [0, up ? 1 : -1, 0],
    );
}
function solid(o, k, r, y, Y) {
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
    );
  }
  cap(o, k, r, Y);
  cap(o, k, r, y, false);
}
const rect = (x, X, z, Z) => [
    [x, z],
    [X, z],
    [X, Z],
    [x, Z],
  ],
  box = (o, k, x, y, z, w, h, d) =>
    solid(o, k, rect(x - w / 2, x + w / 2, z - d / 2, z + d / 2), y, y + h);
function clip(r, a, b, c) {
  const out = [],
    inside = (q) => a * q[0] + b * q[1] <= c + 1e-8;
  for (let i = 0; i < r.length; i++) {
    const q = r[i],
      s = r[(i + 1) % r.length],
      I = inside(q),
      J = inside(s);
    if (I) out.push(q);
    if (I !== J) {
      const t = (c - a * q[0] - b * q[1]) / (a * (s[0] - q[0]) + b * (s[1] - q[1]));
      out.push(q.map((v, k) => v + (s[k] - v) * t));
    }
  }
  return out.filter((q, i, r) => !i || Math.hypot(...sub(q, r[i - 1])) > 1e-7);
}
function gridTriangles(r, step) {
  const out = [];
  for (const ix of triangulate(r)) {
    const tri = ix.map((i) => r[i]),
      min = [0, 1].map((k) => Math.floor(Math.min(...tri.map((q) => q[k])) / step) * step),
      max = [0, 1].map((k) => Math.max(...tri.map((q) => q[k])));
    for (let x = min[0]; x < max[0] + 1e-8; x += step)
      for (let z = min[1]; z < max[1] + 1e-8; z += step) {
        let q = tri;
        for (const [a, b, c] of [
          [-1, 0, -x],
          [1, 0, x + step],
          [0, -1, -z],
          [0, 1, z + step],
        ])
          q = clip(q, a, b, c);
        if (q.length < 3 || Math.abs(area(q)) < 1e-6) continue;
        for (let j = 1; j < q.length - 1; j++) {
          const t = [q[0], q[j], q[j + 1]];
          if (Math.abs(area(t)) > 1e-6) out.push(t);
        }
      }
  }
  return out;
}
const center = p.crownInterpretation.independentChurchCenter;
export const reliefControls = [
  center,
  ...[A.crownCap, A.crownCap * 0.5].flatMap((target) =>
    Array.from({ length: 16 }, (_, i) => {
      const a = (i * 2 * Math.PI) / 16,
        D = [Math.cos(a), Math.sin(a)];
      let lo = 0,
        hi = 190;
      for (let j = 0; j < 28; j++) {
        const r = (lo + hi) / 2,
          q = center.map((v, k) => v + D[k] * r);
        if (sample(...q) > target) lo = r;
        else hi = r;
      }
      return center.map((v, k) => v + (D[k] * (lo + hi)) / 2);
    }),
  ),
].filter((q) => inRing(q, main));
function refine(tris, seeds) {
  for (const q of seeds) {
    if (tris.some((t) => t.some((v) => Math.hypot(...sub(v, q)) < 1e-6))) continue;
    let found = false;
    const next = [];
    for (const t of tris) {
      const [a, b, c] = t,
        den = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]);
      if (Math.abs(den) < 1e-8) {
        next.push(t);
        continue;
      }
      const u = ((b[1] - c[1]) * (q[0] - c[0]) + (c[0] - b[0]) * (q[1] - c[1])) / den,
        v = ((c[1] - a[1]) * (q[0] - c[0]) + (a[0] - c[0]) * (q[1] - c[1])) / den;
      if (u >= -1e-8 && v >= -1e-8 && u + v <= 1 + 1e-8) {
        found = true;
        for (const s of [
          [a, b, q],
          [b, c, q],
          [c, a, q],
        ])
          if (Math.abs(area(s)) > 1e-6) next.push(s);
      } else next.push(t);
    }
    tris = next;
    if (found) seedEvidence.push(q);
  }
  return tris;
}
export function surfaceHeight(q, kind) {
  const h = sample(...q);
  return kind === 'mound'
    ? Math.min(h, A.crownCap)
    : h - (kind === 'south' ? A.southernExcavationDepth : A.westernExcavationDepth);
}
function refineRelief(tris, kind, step) {
  const target = step === 80 ? 8.5 : step === 32 ? 3.7 : step === 16 ? 1.35 : 0;
  if (!target) return tris;
  for (let pass = 0; pass < 64; pass++) {
    let error = target,
      worst;
    for (const [a, b, c] of tris) {
      const den = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]);
      if (Math.abs(den) < 1e-8) continue;
      const H = [a, b, c].map((q) => surfaceHeight(q, kind)),
        lo = [0, 1].map((k) => Math.ceil(Math.min(a[k], b[k], c[k]) / 8) * 8),
        hi = [0, 1].map((k) => Math.max(a[k], b[k], c[k]));
      for (let x = lo[0]; x <= hi[0] + 1e-8; x += 8)
        for (let z = lo[1]; z <= hi[1] + 1e-8; z += 8) {
          const u = ((b[1] - c[1]) * (x - c[0]) + (c[0] - b[0]) * (z - c[1])) / den,
            v = ((c[1] - a[1]) * (x - c[0]) + (a[0] - c[0]) * (z - c[1])) / den;
          if (u < -1e-8 || v < -1e-8 || u + v > 1 + 1e-8) continue;
          const delta = Math.abs(
            H[0] * u + H[1] * v + H[2] * (1 - u - v) - surfaceHeight([x, z], kind),
          );
          if (delta > error) {
            error = delta;
            worst = [x, z];
          }
        }
    }
    if (!worst) return tris;
    tris = refine(tris, [worst]);
  }
  throw Error('Relief refinement did not converge within the source-local geometry budget');
}
function skin(o, r, step, kind) {
  let tris = gridTriangles(r, step);
  if (kind === 'mound') tris = refine(tris, reliefControls);
  tris = refineRelief(tris, kind, step);
  for (const tri of tris) {
    const q = tri.map((v) => [v[0], surfaceHeight(v, kind), v[1]]),
      mid = [0, 1, 2].map((k) => q.reduce((s, v) => s + v[k], 0) / 3),
      k = kind === 'mound' ? 'turf' : 'earth',
      shade = kind === 'mound' ? 1 + 0.025 * Math.sin(mid[0] * 0.047 + mid[2] * 0.065) : 1;
    T(
      o,
      k,
      q,
      [0, 1, 0],
      C[k].map((v) => Math.max(0, Math.min(1, v * shade))),
    );
  }
  surfaceEvidence.push({ kind, nativeControls: r.length, step, triangles: tris.length });
}
function splitEdge(a, b, step) {
  const ts = [0, 1],
    v = sub(b, a);
  for (let k = 0; k < 2; k++)
    if (Math.abs(v[k]) > 1e-8) {
      const lo = Math.ceil(Math.min(a[k], b[k]) / step),
        hi = Math.floor(Math.max(a[k], b[k]) / step);
      for (let j = lo; j <= hi; j++) {
        const t = (j * step - a[k]) / v[k];
        if (t > 1e-7 && t < 1 - 1e-7) ts.push(t);
      }
    }
  ts.sort((a, b) => a - b);
  return ts.filter((v, i) => !i || v - ts[i - 1] > 1e-7).map((t) => a.map((x, k) => x + t * v[k]));
}
const nativeEdgeSet = (r) =>
    new Set(r.map((a, i) => [K(a), K(r[(i + 1) % r.length])].sort().join('|'))),
  westEdges = nativeEdgeSet(west),
  southEdges = nativeEdgeSet(south);
function base(o, step) {
  const s = area(whole) > 0 ? 1 : -1;
  for (let i = 0; i < whole.length; i++) {
    const a = whole[i],
      b = whole[(i + 1) % whole.length],
      key = [K(a), K(b)].sort().join('|'),
      kind = westEdges.has(key) ? 'west' : southEdges.has(key) ? 'south' : 'mound',
      pieces = splitEdge(a, b, step),
      n = [s * (b[1] - a[1]), 0, s * (a[0] - b[0])];
    for (let j = 1; j < pieces.length; j++) {
      const x = pieces[j - 1],
        y = pieces[j];
      Q(
        o,
        kind === 'mound' ? 'turf' : 'stone',
        [
          [x[0], F, x[1]],
          [y[0], F, y[1]],
          [y[0], surfaceHeight(y, kind), y[1]],
          [x[0], surfaceHeight(x, kind), x[1]],
        ],
        n,
      );
    }
  }
  cap(o, 'stone', whole, F, false);
}
function retaining(o, r, depth, lod, step, name) {
  const s = area(r) > 0 ? 1 : -1;
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      v = sub(b, a),
      L = Math.hypot(...v),
      N = [(s * v[1]) / L, (-s * v[0]) / L],
      P = (q, y, offset = 0) => [q[0] - N[0] * offset, y, q[1] - N[1] * offset],
      parts = splitEdge(a, b, step);
    for (let j = 1; j < parts.length; j++) {
      const x = parts[j - 1],
        y = parts[j],
        hx = sample(...x),
        hy = sample(...y);
      Q(
        o,
        'stone',
        [P(x, hx - depth, 0.45), P(y, hy - depth, 0.45), P(y, hy), P(x, hx)],
        [-N[0], 0, -N[1]],
      );
      if (lod >= 1)
        for (let k = 1; k <= A.terraceBands; k++) {
          const t = k / A.terraceBands,
            w = 0.45 * t,
            Yx = hx - depth * t,
            Yy = hy - depth * t;
          Q(
            o,
            'stone',
            [P(x, Yx, w), P(y, Yy, w), P(y, Yy, w + 0.3), P(x, Yx, w + 0.3)],
            [0, 1, 0],
          );
          if (lod >= 2)
            Q(
              o,
              'stone',
              [
                P(x, Yx - 0.12, w + 0.3),
                P(y, Yy - 0.12, w + 0.3),
                P(y, Yy, w + 0.3),
                P(x, Yx, w + 0.3),
              ],
              [-N[0], 0, -N[1]],
            );
        }
    }
    wallEvidence.push({ name, index: i, a, b, depth });
  }
}
const courtFloorMeshes = new Map();
function courtFloorAt(q, lod) {
  if (!courtFloorMeshes.has(lod))
    courtFloorMeshes.set(lod, gridTriangles(south, A.coarseSurfaceSteps[lod]));
  for (const [a, b, c] of courtFloorMeshes.get(lod)) {
    const den = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]);
    if (Math.abs(den) < 1e-8) continue;
    const u = ((b[1] - c[1]) * (q[0] - c[0]) + (c[0] - b[0]) * (q[1] - c[1])) / den,
      v = ((c[1] - a[1]) * (q[0] - c[0]) + (a[0] - c[0]) * (q[1] - c[1])) / den;
    if (u >= -1e-7 && v >= -1e-7 && u + v <= 1 + 1e-7)
      return (
        surfaceHeight(a, 'south') * u +
        surfaceHeight(b, 'south') * v +
        surfaceHeight(c, 'south') * (1 - u - v)
      );
  }
  throw Error('Stair foot must lie on the already-authored native court floor');
}
function stair(o, r, index, _depth, lod) {
  const a = r[index],
    b = r[(index + 1) % r.length],
    D = sub(b, a),
    L = Math.hypot(...D),
    u = D.map((v) => v / L),
    s = area(r) > 0 ? 1 : -1,
    N = [-s * u[1], s * u[0]],
    c = a.map((v, k) => (v + b[k]) / 2),
    top = sample(...c),
    bottom = courtFloorAt(
      c.map((v, k) => v + N[k] * A.stairRun),
      lod,
    ),
    rise = top - bottom,
    steps = lod === 0 ? 5 : A.stepsPerFlight,
    run = A.stairRun,
    width = A.stairWidth,
    P = (t, y, side = 0) => [c[0] + N[0] * t + u[0] * side, y, c[1] + N[1] * t + u[1] * side],
    profile = [
      [0, bottom - 0.15],
      [run, bottom - 0.15],
      [run, bottom],
    ];
  for (let j = 0; j < steps; j++) {
    const t = run * (1 - j / steps),
      T = run * (1 - (j + 1) / steps),
      y = bottom + (rise * (j + 1)) / steps;
    profile.push([t, y], [T, y]);
    stairEvidence.push({
      flight: index,
      tread: j,
      center: P((t + T) / 2, y),
      width,
      rise: rise / steps,
      footFollowsExistingFloor: true,
      floorUnchanged: true,
    });
  }
  for (let i = 0; i < profile.length; i++) {
    const a = profile[i],
      b = profile[(i + 1) % profile.length];
    Q(o, 'stone', [
      P(...a, -width / 2),
      P(...b, -width / 2),
      P(...b, width / 2),
      P(...a, width / 2),
    ]);
  }
  for (const side of [-1, 1])
    for (const ix of triangulate(profile))
      T(
        o,
        'stone',
        ix.map((i) => P(...profile[i], (side * width) / 2)),
        [side * u[0], 0, side * u[1]],
      );
}
function altarBlock(o, lod) {
  const center = [0, 1].map((k) => altar.reduce((s, q) => s + q[k], 0) / altar.length),
    h = sample(...center),
    bottom = Math.min(...altar.map((q) => sample(...q))) - 0.1,
    top = h + A.altarPlatformRise;
  solid(o, 'stone', altar, bottom, top);
  box(o, 'stone', center[0], top, center[1], 3.35, 0.25, 1.75);
  box(
    o,
    'stucco',
    center[0],
    top + 0.25,
    center[1],
    A.altarBodyWidth,
    A.altarBodyHeight,
    A.altarBodyDepth,
  );
  if (lod >= 1) {
    box(
      o,
      'stone',
      center[0],
      top + 0.27,
      center[1] - A.altarBodyDepth / 2 - 0.005,
      2.85,
      0.06,
      0.025,
    );
    const segments = lod === 1 ? 6 : 16,
      y = top + 0.65,
      z = center[1] - A.altarBodyDepth / 2 - 0.018;
    for (const side of [-1, 1])
      for (let j = 1; j <= segments; j++) {
        const curve = (t) => [
            center[0] + side * (0.18 + 1.08 * t),
            y + 0.12 * Math.sin(2 * Math.PI * t),
            z,
          ],
          a = curve((j - 1) / segments),
          b = curve(j / segments);
        beam(o, 'stone', a, b, 0.033, 0.035, C.stone);
      }
  }
  altarEvidence.push({
    nativeControls: 4,
    center,
    platformBottom: bottom,
    platformTop: top,
    bodyHeight: A.altarBodyHeight,
    friezeInterpretation:
      'Low broad weathered stucco altar/frieze with original abstract paired scroll relief; exact fine glyph/placement not asserted.',
  });
}
export function buildGreatPyramidOfCholula(target, _frame, lod = 3) {
  for (const a of [
    partEvidence,
    surfaceEvidence,
    wallEvidence,
    stairEvidence,
    altarEvidence,
    seedEvidence,
  ])
    a.length = 0;
  let count = 0;
  const o = {
      addTriangle(...a) {
        count++;
        target.addTriangle(...a);
      },
      addQuad(...a) {
        count += 2;
        target.addQuad(...a);
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
    },
    step = A.coarseSurfaceSteps[lod];
  part('complete-original-relief-covered-mound-and-capped-independent-church-contamination', () =>
    skin(o, main, step, 'mound'),
  );
  part('whole-native-western-and-southern-exposed-excavation-floors', () => {
    skin(o, west, step, 'west');
    skin(o, south, step, 'south');
  });
  part('whole-native-union-closed-foundation', () => base(o, step));
  part('native-fiftyfive-exposed-masonry-wall-edges-and-talud-courses', () => {
    retaining(o, west, A.westernExcavationDepth, lod, step, 'western-ruin');
    retaining(o, south, A.southernExcavationDepth, lod, step, 'southern-ruin');
  });
  part('three-intrinsic-excavation-stair-flights', () => {
    for (const index of [1, 11, 19]) stair(o, south, index, A.southernExcavationDepth, lod);
  });
  part('native-four-control-court-platform-and-low-stucco-altar', () => altarBlock(o, lod));
}
export const greatPyramidOfCholulaSkyline = (o) => buildGreatPyramidOfCholula(o, null, 0),
  greatPyramidOfCholulaDistrict = (o) => buildGreatPyramidOfCholula(o, null, 1),
  greatPyramidOfCholulaStreet = (o) => buildGreatPyramidOfCholula(o, null, 2),
  greatPyramidOfCholulaCloseup = (o) => buildGreatPyramidOfCholula(o, null, 3);
const ac = [0, 1].map((k) => altar.reduce((s, q) => s + q[k], 0) / altar.length),
  ah = sample(...ac);
export const greatPyramidOfCholulaModel = {
  id: 'great_pyramid_of_cholula',
  key: 'great_pyramid_of_cholula',
  cell: '9g/9g6',
  title: 'Great Pyramid of Cholula',
  wikidataId: 'Q1417475',
  category: 'archaeological-earthwork',
  recipe: 'great-pyramid-of-cholula-model.mjs',
  progressLedger: 'qualla-002.PROGRESS.md',
  surfaces,
  build: buildGreatPyramidOfCholula,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  orientationPolicy: 'approximate-visualization',
  groundContactBasis: p.sectionBasis,
  brief:
    'Complete surviving earth-covered Cholula pyramid from original independent relief/native30control mound and connected45control southern excavation, native10control western exposed ruin and four-control court platform/low stucco altar. Three real stair flights/exposed masonry wall courses; actual full asymmetric covered volume, no generic cone/fully uncovered speculative pyramid or broad archaeological-parcel extrusion. Exact cleared published2004AltevirVechiaPD terrace/altar images; whole macro shape from frozen source elevations with explicit pregeometry summit/excavation interpretations. Independent church/museum/RedBuilding excluded.',
  camera: [350, 180, 380],
  lookAt: [0, 20, 0],
  portableGroundY: F - 0.3,
  mediumFiContext: {
    scale: 4.0,
    groundY: F - 0.3,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
    far: 5000,
  },
  embeddedCanonicalGraphs: ['gravel', 'stone_basalt', 'plaster_lime'],
  groundCutout: {
    outline: whole,
    additionalOutlines: [altar],
    basis:
      'Actual native physical covered pyramid/connected archaeological excavation union and intrinsic court platform, not the broad archaeological-zone parcel. Original field values remain unchanged; only terrain triangles inside owned structural volume/excavation are hidden. Summit DEM includes separate church; original source preserved, model cap is an explicitly estimated covered-mound section.',
  },
  qaCameras: [
    {
      name: 'whole-asymmetric-covered-mound-and-southern-excavations',
      position: [450, 220, 500],
      lookAt: [0, 20, 0],
    },
    {
      name: 'whole-native-pyramid-west-south-ruins-plan',
      position: [0.1, 680, 0.2],
      lookAt: [0, 0, 0],
    },
    {
      name: 'western-exposed-ruin-and-whole-mound',
      position: [-390, 115, 130],
      lookAt: [-65, 18, -10],
    },
    {
      name: 'southern-terraces-and-physical-stair-flights',
      position: [-260, 70, 340],
      lookAt: [-100, 5, 120],
    },
    {
      name: 'low-stucco-altar-and-native-court-platform',
      position: [ac[0] + 8, ah + 5, ac[1] - 12],
      lookAt: [ac[0], ah + 0.7, ac[1]],
    },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `whole-pyramid-${reviewLod}`,
    position: [450, 220, 500],
    lookAt: [0, 20, 0],
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/great-pyramid-of-cholula-runtime-overlay.mjs',
    level: 'skyline',
    export: 'greatPyramidOfCholulaSkyline',
    errorMeters: 9,
    surfaces,
    authoredLevels: {
      district: { export: 'greatPyramidOfCholulaDistrict', errorMeters: 4, surfaces },
      street: { export: 'greatPyramidOfCholulaStreet', errorMeters: 1.5, surfaces },
      closeup: { export: 'greatPyramidOfCholulaCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: [
    p.geometryBasis,
    p.authoringDirection,
    p.sectionBasis,
    'Covered mass follows original composite-relief flank samples/native structure boundaries; unclassified source includes vegetation/built contributions. Crown plateau from fixed40m source-ring median is a bounded pregeometry interpretation excluding independently identified church height. Nominal66m historical monument height is not asserted as a surveyed present bare-mound dimension. No source grid/heightmap/rawtile/frame/floor/mainsection fitting or late raising.',
    'Thirty-mound/45southern/10western/four-platform native control occurrences retained, including shared controls. Exposed excavation depths, stair placement/counts/talud courses, altar/frieze dimensions/fine glyph and restoration colors are original bounded estimates from two exact published2004PD detail photographs and primary technical facts. No unverified whole-view image/historical drawing, image pixels/volcano/trees/museum/RedBuilding or independent church geometry.',
    'Buried artificial/natural core and edge skirts are exposed by isolated flat fixtures. Native footprint-owned excavation/volume opening preserves all original source elevations. Exact classified terrain/archaeological section/threshold/foundation contact and current fine repairs unverified; geographic preview/replacement false.',
  ],
};
