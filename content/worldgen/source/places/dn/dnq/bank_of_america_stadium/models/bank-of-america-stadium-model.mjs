/** Complete open stadium; native regional plan, original bounded architectural geometry. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import fs from 'node:fs';
import { ShapeUtils, Vector2 } from 'three';
import {
  beam,
  cross,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  openingBuilder,
  openingReveals,
  prepareOpening,
} from '../../../../../../../../packages/worldgen/scripts/authored-wall-openings.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';

const p = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url))),
  frame = JSON.parse(fs.readFileSync(new URL('../map-frame.json', import.meta.url))),
  { floorY: F, axisU: U, axisV: V, fieldCenter: FC, architecturalSections: A } = p.parameters;
export const surfaces = {
  wall: { slot: 'wall', graph: 'stone_granite', roughness: 0.91, metallic: 0 },
  concrete: { slot: 'wall', graph: 'concrete_plain', roughness: 0.94, metallic: 0 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.72, metallic: 0.1 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.28, metallic: 0.18 },
  field: { slot: 'roof', localRef: 'palette:#feffff', roughness: 0.98, metallic: 0 },
  video: { slot: 'window', localRef: 'palette:#fefefe', roughness: 0.67, metallic: 0 },
};
const C = {
  wall: rgb('353b3b'),
  concrete: rgb('a4aaa9'),
  metal: rgb('b8c0bf'),
  glass: rgb('3d5965'),
  field: rgb('486c45'),
  video: rgb('202d31'),
  blue: rgb('3d86ad'),
  line: rgb('d1d1c2'),
  darkblue: rgb('39647b'),
};
export const nativeEvidence = [],
  portalEvidence = [],
  bowlEvidence = [],
  towerEvidence = [],
  partEvidence = [];
const sub = (a, b) => a.map((v, i) => v - b[i]),
  dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0),
  mix = (a, b, t) => a + (b - a) * t,
  area = (r) =>
    r.reduce((s, a, i) => {
      const b = r[(i + 1) % r.length];
      return s + a[0] * b[1] - b[0] * a[1];
    }, 0),
  mean = (r) => [0, 1].map((k) => r.reduce((s, q) => s + q[k], 0) / r.length);
export const ring = (id) => frame.features.find((f) => f.id === `way/${id}`).outline.slice(0, -1),
  toWorld = (q) => [q[0], F + q[1], q[2]],
  fieldPoint = (u, y, v) => [
    U[0] * (FC[0] + u) + V[0] * (FC[1] + v),
    y,
    U[1] * (FC[0] + u) + V[1] * (FC[1] + v),
  ];
function T(o, k, q, n, col = C[k]) {
  q = q.map((v) => toWorld(v).map(Math.fround));
  const cr = cross(sub(q[1], q[0]), sub(q[2], q[0]));
  if (Math.hypot(...cr) < 1e-8) return;
  if (n && dot(cr, n) < 0) [q[1], q[2]] = [q[2], q[1]];
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
function B(o, k, a, b, w, d, col = C[k]) {
  if (Math.hypot(...sub(a, b)) < 1e-6) return;
  const emit = (slot, ref, pts, _n, _uv, color) => {
      const q = pts.map((p) => p.map(Math.fround));
      if (Math.hypot(...cross(sub(q[1], q[0]), sub(q[2], q[0]))) < 1e-8) return;
      o.addTriangle(
        slot,
        ref,
        q,
        normalFor(...q),
        q.map((p) => [p[0], p[2]]),
        color,
      );
    },
    shim = {
      addQuad(slot, ref, q, n, _uv, c) {
        emit(slot, ref, q.slice(0, 3), n, null, c);
        emit(slot, ref, [q[0], q[2], q[3]], n, null, c);
      },
      addConvexPolygon(slot, ref, q, n, _uv, c) {
        for (let i = 1; i < q.length - 1; i++) emit(slot, ref, [q[0], q[i], q[i + 1]], n, null, c);
      },
    };
  beam(shim, k, toWorld(a), toWorld(b), w, d, col);
}
function cap(o, k, out, holes, y, Y = y, up = true, col = C[k]) {
  const pts = [...out, ...holes.flat()],
    ids = ShapeUtils.triangulateShape(
      out.map((q) => new Vector2(...q)),
      holes.map((r) => r.map((q) => new Vector2(...q))),
    );
  for (const ix of ids)
    T(
      o,
      k,
      ix.map((i) => [pts[i][0], i < out.length ? y : Y, pts[i][1]]),
      [0, up ? 1 : -1, 0],
      col,
    );
}
function wall(o, k, r, y, Y, col = C[k], inward = false) {
  const s = (area(r) > 0 ? 1 : -1) * (inward ? -1 : 1);
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
}
function solid(o, k, r, y, Y, col = C[k], holes = [], bottom = true) {
  wall(o, k, r, y, Y, col);
  for (const h of holes) wall(o, k, h, y, Y, col, true);
  cap(o, k, r, holes, Y, Y, true, col);
  if (bottom) cap(o, k, r, holes, y, y, false, col);
}
const _rect = (x, X, z, Z) => [
    [x, z],
    [X, z],
    [X, Z],
    [x, Z],
  ],
  circle = (c, r, n) =>
    Array.from({ length: n }, (_, i) => {
      const a = (i / n) * Math.PI * 2;
      return [c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)];
    });
function record(id, y) {
  nativeEvidence.push({ id, controls: ring(id).map((q) => toWorld([q[0], y, q[1]])) });
}
const towerPairs = [
    [1306253438, 1306253445, 1306253446],
    [1306253455, 1306253456, 1306253461],
    [1306253457, 1306253458, 1306253462],
  ],
  towerOuter = new Map([
    [1306253438, 1306253443],
    [1306253445, 1306253444],
    [1306253458, 1306253454],
    [1306253455, 1306253460],
    [1306253456, 1306253459],
    [1306253457, 1306253453],
  ]);
function portalHoles(lod) {
  return towerPairs.map(([a, b, id]) => {
    const ca = mean(ring(a)),
      cb = mean(ring(b)),
      d = sub(cb, ca),
      L = Math.hypot(...d),
      center = mean(ring(id)),
      normal = [-d[1] / L, d[0] / L],
      depth =
        2 * ring(id).reduce((m, q) => Math.max(m, Math.abs(dot(sub(q, center), normal))), 0) + 4,
      h = prepareOpening(
        {
          center,
          axis: d,
          width: L - 16,
          bottom: F + A.portalBottom,
          height: A.portalTop - A.portalBottom,
          spring: A.portalSpring - A.portalBottom,
          shape: 'round',
          depth,
        },
        0,
        lod > 1 ? 3 : 1,
      );
    portalEvidence.push({
      nativeConnector: id,
      center,
      width: h.width,
      bottom: F + A.portalBottom,
      top: F + A.portalTop,
      axis: h.axis,
      normal: h.normal,
      depth: h.depth,
    });
    return h;
  });
}
function radius(r, a) {
  const d = [Math.cos(a), Math.sin(a)];
  let best = 0;
  for (let i = 0; i < r.length; i++) {
    const q = r[i],
      b = r[(i + 1) % r.length],
      v = sub(b, q),
      den = d[0] * v[1] - d[1] * v[0];
    if (Math.abs(den) < 1e-9) continue;
    const t = (q[0] * v[1] - q[1] * v[0]) / den,
      u = (q[0] * d[1] - q[1] * d[0]) / den;
    if (t > 0 && u >= -1e-7 && u <= 1 + 1e-7) best = Math.max(best, t);
  }
  if (!best) throw Error('Unbounded stadium radial contour');
  return best;
}
function rows(o, inner, outer, y, Y, n, N, lod) {
  for (let j = 0; j < n; j++)
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2,
        b = ((i + 1) / N) * Math.PI * 2,
        rad = (t) => [
          mix(radius(inner, a), radius(outer, a), t),
          mix(radius(inner, b), radius(outer, b), t),
        ],
        r = rad(j / n),
        s = rad((j + 1) / n),
        low = mix(y, Y, j / n) + 0.06,
        high = mix(y, Y, (j + 1) / n) + 0.06,
        pp = (t, R, H) => [Math.cos(t) * R, H, Math.sin(t) * R],
        aisle = i % 8 === 0,
        k = aisle ? 'concrete' : 'metal',
        col = aisle ? C.concrete : j % 5 === 0 ? C.darkblue : C.blue;
      Q(
        o,
        k,
        [pp(a, r[0], high), pp(b, r[1], high), pp(b, s[1], high), pp(a, s[0], high)],
        [0, 1, 0],
        col,
      );
      Q(
        o,
        k,
        [pp(a, r[0], low), pp(b, r[1], low), pp(b, r[1], high), pp(a, r[0], high)],
        [-Math.cos(a), 0, -Math.sin(a)],
        col,
      );
      if (lod === 3 && !aisle) {
        const depth = 0.12,
          h = 0.32,
          R = [s[0] - 0.15, s[1] - 0.15];
        Q(
          o,
          'metal',
          [pp(a, R[0], high), pp(b, R[1], high), pp(b, R[1], high + h), pp(a, R[0], high + h)],
          [-Math.cos(a), 0, -Math.sin(a)],
          col,
        );
        Q(
          o,
          'metal',
          [
            pp(a, R[0] + depth, high),
            pp(b, R[1] + depth, high),
            pp(b, R[1] + depth, high + h),
            pp(a, R[0] + depth, high + h),
          ],
          [Math.cos(a), 0, Math.sin(a)],
          col,
        );
        Q(
          o,
          'metal',
          [
            pp(a, R[0], high + h),
            pp(b, R[1], high + h),
            pp(b, R[1] + depth, high + h),
            pp(a, R[0] + depth, high + h),
          ],
          [0, 1, 0],
          col,
        );
      }
    }
}
function field(o, lod) {
  cap(o, 'field', ring(1245929758), [], A.fieldY);
  record(1245929758, A.fieldY);
  const l = A.fieldLength / 2,
    w = A.fieldWidth / 2;
  Q(
    o,
    'field',
    [
      fieldPoint(-l, A.fieldY + 0.02, -w),
      fieldPoint(l, A.fieldY + 0.02, -w),
      fieldPoint(l, A.fieldY + 0.02, w),
      fieldPoint(-l, A.fieldY + 0.02, w),
    ],
    [0, 1, 0],
    rgb('4b7549'),
  );
  if (lod > 0) {
    const line = (u, v, U, V, width = 0.16) => {
      const a = fieldPoint(u, A.fieldY + 0.04, v),
        b = fieldPoint(U, A.fieldY + 0.04, V),
        d = sub(b, a),
        L = Math.hypot(d[0], d[2]),
        n = [((-d[2] / L) * width) / 2, 0, ((d[0] / L) * width) / 2];
      Q(
        o,
        'metal',
        [
          a.map((v, i) => v + n[i]),
          b.map((v, i) => v + n[i]),
          b.map((v, i) => v - n[i]),
          a.map((v, i) => v - n[i]),
        ],
        [0, 1, 0],
        C.line,
      );
    };
    for (const v of [-w, w]) line(-l, v, l, v);
    for (let i = 0; i <= 12; i++) line(-l + i * 9.144, -w, -l + i * 9.144, w);
    if (lod >= 2)
      for (let i = 1; i < 100; i++)
        for (const v of [-9.144, 9.144])
          line(-45.72 + i * 0.9144 - 0.12, v, -45.72 + i * 0.9144 + 0.12, v, 0.12);
    if (lod >= 2)
      for (const u of [-l, l]) {
        B(
          o,
          'metal',
          fieldPoint(u, A.fieldY, 0),
          fieldPoint(u, A.fieldY + 3.05, 0),
          0.15,
          0.15,
          rgb('c5b065'),
        );
        B(
          o,
          'metal',
          fieldPoint(u, A.fieldY + 3.05, -2.82),
          fieldPoint(u, A.fieldY + 3.05, 2.82),
          0.12,
          0.12,
          rgb('c5b065'),
        );
        for (const v of [-2.82, 2.82])
          B(
            o,
            'metal',
            fieldPoint(u, A.fieldY + 3.05, v),
            fieldPoint(u, A.fieldY + 8.5, v),
            0.1,
            0.1,
            rgb('c5b065'),
          );
      }
  }
}
function fairSlope(o, inner, outer, y, Y, N, col) {
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2,
      b = ((i + 1) / N) * Math.PI * 2,
      P = (t, r, h) => [Math.cos(t) * r, h, Math.sin(t) * r];
    Q(
      o,
      'metal',
      [
        P(a, radius(inner, a), y),
        P(b, radius(inner, b), y),
        P(b, radius(outer, b), Y),
        P(a, radius(outer, a), Y),
      ],
      [0, 1, 0],
      col,
    );
  }
}
function tiers(o, lod) {
  const inner = ring(1245929758),
    low = ring(1245929759),
    club = ring(1306253433),
    upper = ring(1306253434);
  if (lod === 0) {
    const c = mean(club),
      simple = circle(c, 1, 16).map((_q, i) => {
        const a = (i / 16) * Math.PI * 2,
          R = radius(upper, a);
        return [Math.cos(a) * R, Math.sin(a) * R];
      });
    fairSlope(o, inner, simple, A.frontRow, A.upperRim, 24, C.blue);
    wall(o, 'concrete', ring(180768146), 0.5, A.upperRim);
    return;
  }
  for (const [id, r, y, Y, col] of [
    [1245929759, low, A.frontRow, A.lowerTop, C.darkblue],
    [1306253433, club, A.lowerTop + 0.4, A.clubTop, C.blue],
    [1306253434, upper, A.upperStart, A.upperRim, C.blue],
  ]) {
    const inside = id === 1245929759 ? inner : id === 1306253433 ? low : club;
    wall(o, 'concrete', r, Y - 0.16, Y, C.concrete);
    if (lod === 1) fairSlope(o, inside, r, y, Y, 24, col);
    record(id, Y);
    bowlEvidence.push({ id, inside: y, outside: Y, open: true });
    if (lod >= 2) {
      const n =
        lod === 3
          ? id === 1245929759
            ? 24
            : id === 1306253433
              ? 8
              : 34
          : id === 1245929759
            ? 6
            : id === 1306253433
              ? 2
              : 8;
      rows(o, inside, r, y, Y, n, lod === 3 ? 64 : 32, lod);
    }
  }
  wall(o, 'glass', club, A.suiteLowerBottom, A.upperStart, C.glass, true);
  for (const h of lod === 1 ? [] : [A.suiteLowerBottom, A.suiteUpperBottom, A.upperStart])
    wall(o, 'metal', club, h, h + 0.25, C.metal, true);
  if (lod >= 2) {
    const N = lod === 3 ? 120 : 48;
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2,
        R = radius(club, a) - 0.12;
      B(
        o,
        'metal',
        [Math.cos(a) * R, A.suiteLowerBottom, Math.sin(a) * R],
        [Math.cos(a) * R, A.upperStart, Math.sin(a) * R],
        0.12,
        0.12,
        C.metal,
      );
    }
  }
}
function gallery(o, lod) {
  const r = ring(1306253434);
  if (lod < 2) {
    return;
  }
  const sign = area(r) > 0 ? 1 : -1;
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      d = sub(b, a),
      L = Math.hypot(...d);
    if (L < 0.4) continue;
    const edges = new Map(),
      n = [(sign * d[1]) / L, (-sign * d[0]) / L],
      P = (x, y, t = 0) => [a[0] + (d[0] / L) * x - n[0] * t, y, a[1] + (d[1] / L) * x - n[1] * t],
      piece = (q) => {
        for (const t of [0, 1.1]) {
          const rr = q.map(([x, y]) => P(x, y, t));
          for (let j = 1; j < rr.length - 1; j++)
            T(
              o,
              'concrete',
              [rr[0], rr[j], rr[j + 1]],
              [n[0] * (t === 0 ? 1 : -1), 0, n[1] * (t === 0 ? 1 : -1)],
              C.concrete,
            );
        }
        for (let j = 0; j < q.length; j++) {
          const A = q[j],
            B = q[(j + 1) % q.length];
          const key = [A, B]
            .map((q) => q.map((x) => x.toFixed(7)).join(','))
            .sort()
            .join('|');
          if (edges.has(key)) edges.delete(key);
          else edges.set(key, [A, B]);
        }
      };
    const count = Math.max(1, Math.ceil(L / (lod === 2 ? 24 : 12)));
    for (let j = 0; j < count; j++) {
      const x = (j / count) * L,
        X = ((j + 1) / count) * L,
        w = X - x;
      if (w < 3) {
        piece([
          [x, 24],
          [X, 24],
          [X, 43],
          [x, 43],
        ]);
        continue;
      }
      const pier = Math.min(1, w * 0.16),
        left = x + pier,
        right = X - pier,
        spring = 31,
        top = 39,
        steps = lod === 3 ? 6 : 2;
      piece([
        [x, 24],
        [left, 24],
        [left, 43],
        [x, 43],
      ]);
      piece([
        [right, 24],
        [X, 24],
        [X, 43],
        [right, 43],
      ]);
      piece([
        [left, 24],
        [right, 24],
        [right, 27],
        [left, 27],
      ]);
      let prev = [left, spring];
      for (let k = 1; k <= steps; k++) {
        const t = Math.PI - (k / steps) * Math.PI,
          q = [
            (left + right) / 2 + (Math.cos(t) * (right - left)) / 2,
            spring + Math.sin(t) * (top - spring),
          ];
        piece([prev, q, [q[0], 43], [prev[0], 43]]);
        prev = q;
      }
    }
    for (const [A, B] of edges.values())
      Q(o, 'concrete', [P(...A), P(...B), P(...B, 1.1), P(...A, 1.1)], null, C.concrete);
  }
}
function towers(o, lod) {
  for (const [id, oid] of towerOuter) {
    const native = ring(id),
      c = mean(native),
      radiusValue = native.reduce((s, q) => s + Math.hypot(...sub(q, c)), 0) / native.length,
      r = lod === 0 ? circle(c, radiusValue, 8) : native,
      outer = ring(oid);
    if (lod > 0) {
      solid(o, 'wall', outer, 0.5, A.towerShoulder, C.wall, lod <= 2 ? [] : [native]);
      record(oid, A.towerShoulder);
    }
    wall(
      o,
      lod === 0 ? 'metal' : 'glass',
      r,
      lod <= 2 ? A.towerShoulder : 0.5,
      A.towerDrumTop,
      lod === 0 ? C.blue : C.glass,
    );
    let prev = r;
    const stages = lod < 2 ? 1 : 4;
    for (let j = 1; j <= stages; j++) {
      const t = ((j / stages) * Math.PI) / 2,
        scale = j === stages ? 0.015 : Math.cos(t),
        Y = A.towerDrumTop + 2 * Math.sin(t),
        rr = r.map((q) => c.map((v, k) => v + (q[k] - v) * scale));
      for (let i = 0; i < r.length; i++) {
        const k = (i + 1) % r.length;
        Q(
          o,
          'metal',
          [
            [
              prev[i][0],
              A.towerDrumTop + 2 * Math.sin((((j - 1) / stages) * Math.PI) / 2),
              prev[i][1],
            ],
            [
              prev[k][0],
              A.towerDrumTop + 2 * Math.sin((((j - 1) / stages) * Math.PI) / 2),
              prev[k][1],
            ],
            [rr[k][0], Y, rr[k][1]],
            [rr[i][0], Y, rr[i][1]],
          ],
          null,
          C.metal,
        );
      }
      prev = rr;
    }
    cap(o, 'metal', prev, [], 38, 38, true, C.metal);
    if (lod > 0) {
      record(id, A.towerDrumTop);
      for (const h of lod === 1 ? [] : lod === 2 ? [33, 36] : [7, 15, 24, 33, 36])
        wall(o, 'metal', r, h, h + 0.22, C.metal);
      if (lod >= 2)
        for (let i = 0; i < r.length; i += lod === 2 ? 2 : 1) {
          const q = r[i];
          B(o, 'metal', [q[0], 0.5, q[1]], [q[0], 36, q[1]], 0.16, 0.16, C.metal);
        }
    }
    towerEvidence.push({ id, center: c, domeTop: 38 });
  }
}
function facade(o, lod, holes, revealOutput) {
  if (lod === 0) return;
  wall(o, 'wall', ring(1245929760), 0.5, A.facadeCornices[2]);
  record(1245929760, A.facadeCornices[2]);
  const towerIds = new Set([...towerOuter.keys(), ...towerOuter.values()]),
    skip = new Set([
      180768146,
      1245929758,
      1245929759,
      1306253433,
      1306253434,
      1245929760,
      1306253435,
      1306253441,
      ...towerIds,
    ]);
  for (const f of frame.features) {
    const id = Number(f.id.split('/')[1]);
    if (skip.has(id) || !f.properties['building:part']) continue;
    const rr = ring(id),
      height = Number(f.properties.height);
    solid(o, 'wall', rr, 0.5, height, C.wall, [], lod !== 1);
    record(id, height);
    if (towerPairs.some((x) => x[2] === id)) {
      openingReveals(
        {
          addTriangle(...a) {
            a[0] = 'wall';
            revealOutput.addTriangle(...a);
          },
        },
        rr,
        () => F + 0.5,
        () => F + height,
        holes,
        C.wall,
      );
    }
    if (lod >= 2) {
      const c = mean(rr),
        small = rr.map((q) => c.map((v, k) => v + (q[k] - v) * 0.99));
      wall(o, 'metal', small, height - 0.45, height, C.metal);
      for (const y of lod === 2 ? [] : [7, 15, 24])
        if (y < height) wall(o, 'metal', rr, y, y + 0.22, C.metal);
    }
  }
}
function portalFrames(o, lod) {
  if (lod < 2) return;
  for (const h of portalEvidence) {
    const c = h.center,
      axis = h.axis,
      n = h.normal,
      span = h.width / 2,
      P = (x, y, z = 0) => [c[0] + axis[0] * x + n[0] * z, y, c[1] + axis[1] * x + n[1] * z];
    for (const z of [-8, 8]) {
      for (const s of [-1, 1])
        B(
          o,
          'metal',
          P(s * span, A.portalBottom, z),
          P(s * span, A.portalSpring, z),
          0.5,
          0.5,
          C.metal,
        );
      let prev = P(span, A.portalSpring, z);
      const N = lod === 1 ? 4 : lod === 2 ? 8 : 16;
      for (let i = 1; i <= N; i++) {
        const a = (i / N) * Math.PI,
          q = P(
            Math.cos(a) * span,
            A.portalSpring + Math.sin(a) * (A.portalTop - A.portalSpring),
            z,
          );
        B(o, 'metal', prev, q, 0.55, 0.55, C.metal);
        prev = q;
      }
    }
  }
}
function boardsAndLights(o, lod) {
  for (const id of [1306253435, 1306253441]) {
    const r = ring(id),
      c = mean(r);
    solid(o, 'video', r, A.videoBoardBottom, A.videoBoardTop);
    record(id, A.videoBoardTop);
    const sign = dot(c, U) > 0 ? 1 : -1,
      VV = V,
      center = fieldPoint(sign * 105, (A.videoBoardBottom + A.videoBoardTop) / 2, 0),
      n = [-sign * U[0], 0, -sign * U[1]];
    if (lod > 0) {
      for (const v of [-22, 0, 22])
        B(
          o,
          'concrete',
          fieldPoint(sign * 108, 31, v),
          fieldPoint(sign * 108, A.videoBoardBottom, v),
          1.3,
          1.3,
          C.concrete,
        );
      const rr = [
        [-29, -7.8],
        [29, -7.8],
        [29, 7.8],
        [-29, 7.8],
      ].map(([x, y]) => [
        center[0] + VV[0] * x + n[0] * 0.2,
        center[1] + y,
        center[2] + VV[1] * x + n[2] * 0.2,
      ]);
      Q(o, 'video', rr, n, rgb('253b40'));
    }
  }
  for (const u of [-40, 40])
    for (const v of [-95, 95]) {
      const a = fieldPoint(u - 15, 54, v),
        b = fieldPoint(u + 15, 54, v);
      B(o, 'metal', a, b, 0.8, 0.8, C.metal);
      if (lod > 0) {
        for (const x of [-12, 12]) {
          B(
            o,
            'metal',
            fieldPoint(u + x, 38, v + (v > 0 ? 6 : -6)),
            fieldPoint(u + x, 54, v),
            0.55,
            0.55,
            C.metal,
          );
          if (lod >= 2)
            B(
              o,
              'metal',
              fieldPoint(u + x, 44, v + (v > 0 ? 6 : -6)),
              fieldPoint(u - x, 54, v),
              0.25,
              0.25,
              C.metal,
            );
        }
        const N = lod === 1 ? 4 : lod === 2 ? 10 : 20;
        for (let i = 0; i < N; i++) {
          const q = fieldPoint(u - 14 + (i / (N - 1)) * 28, 54.3, v),
            n = [-V[0] * Math.sign(v), 0.3, -V[1] * Math.sign(v)],
            along = [U[0] * 0.5, 0, U[1] * 0.5],
            up = [0, 0.5, 0];
          Q(
            o,
            'metal',
            [
              q.map((v, k) => v - along[k] - up[k]),
              q.map((v, k) => v + along[k] - up[k]),
              q.map((v, k) => v + along[k] + up[k]),
              q.map((v, k) => v - along[k] + up[k]),
            ],
            n,
            rgb('d1d8d6'),
          );
        }
      }
    }
}
export function buildBankOfAmericaStadium(target, _frame, lod = 3) {
  for (const a of [nativeEvidence, portalEvidence, bowlEvidence, towerEvidence, partEvidence])
    a.length = 0;
  let count = 0;
  const counted = {
    addTriangle(...a) {
      const q = a[2].map((p) => p.map(Math.fround));
      if (Math.hypot(...cross(sub(q[1], q[0]), sub(q[2], q[0]))) < 1e-8) return;
      a[2] = q;
      a[3] = normalFor(...q);
      count++;
      target.addTriangle(...a);
    },
  };
  const holes = lod === 0 ? [] : portalHoles(lod),
    o = {
      addTriangle(...a) {
        const active = holes.filter(
          (h) =>
            !h.planes.some((plane) =>
              a[2].every((q) => dot(q, plane.slice(0, 3)) + plane[3] < -1e-6),
            ),
        );
        if (active.length) openingBuilder(counted, active).addTriangle(...a);
        else counted.addTriangle(...a);
      },
    },
    part = (name, run) => {
      const start = count;
      run();
      partEvidence.push({ name, triangles: count - start });
    };
  part('whole-native-envelope-and-open-field', () => {
    wall(o, 'concrete', ring(180768146), A.foundationBottom, 0.5);
    record(180768146, 0.5);
    field(o, lod);
  });
  part('complete-open-tiered-bowl-and-suite-bands', () => tiers(o, lod));
  part('upper-open-arched-support-gallery', () => gallery(o, lod));
  part('six-native-domed-entry-towers', () => towers(counted, lod));
  part('actual-native-surrounding-facade-components', () => facade(o, lod, holes, counted));
  part('three-open-monumental-entrance-arches', () => portalFrames(counted, lod));
  part('two-video-structures-and-four-floodlight-banks', () => boardsAndLights(o, lod));
}
export const bankOfAmericaStadiumSkyline = (o) => buildBankOfAmericaStadium(o, null, 0),
  bankOfAmericaStadiumDistrict = (o) => buildBankOfAmericaStadium(o, null, 1),
  bankOfAmericaStadiumStreet = (o) => buildBankOfAmericaStadium(o, null, 2),
  bankOfAmericaStadiumCloseup = (o) => buildBankOfAmericaStadium(o, null, 3);
export const bankOfAmericaStadiumModel = {
  id: 'bank_of_america_stadium',
  key: 'bank_of_america_stadium',
  cell: 'dn/dnq',
  title: 'Bank of America Stadium',
  wikidataId: 'Q806673',
  category: 'stadium',
  recipe: 'bank-of-america-stadium-model.mjs',
  recipeDependencies: ['authored-wall-openings.mjs'],
  progressLedger: 'qualla-002.PROGRESS.md',
  surfaces,
  build: buildBankOfAmericaStadium,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  orientationPolicy: 'approximate-visualization',
  groundContactBasis: p.sectionBasis,
  brief:
    'Complete open-air Bank of America Stadium: native whole98/open-field40/control component rings, six domed towers, three actual open monumental arches, tiered blue seating/gray aisles and twin dark suitebands, end video structures and angled white floodlight banks. Exact cleared published USGS2002 public-domain aerial and Gardner2021 CC0 bowl photo first/only. Native heights plus operator architectural facts; fine sections/rows/census/hidden structure/contact bounded estimates. No future renovation, ads/sculptures/interiors/practice facilities/parking/landscape.',
  camera: [340, F + 240, 340],
  lookAt: [0, F + 17, 0],
  portableGroundY: F + A.fieldY - 0.3,
  mediumFiContext: { scale: '1.2', groundY: F - 0.15, cameraYaw: Math.PI / 4 },
  embeddedCanonicalGraphs: ['stone_granite', 'concrete_plain', 'metal_painted'],
  groundCutout: {
    outline: ring(1306253434),
    basis:
      'Intrinsic open bowl below exterior plaza; opening bounded by actual native upper-bowl masonry contour, original independent DEM unchanged.',
  },
  qaCameras: [
    {
      name: 'whole-stadium-open-bowl-six-towers',
      position: [-330, F + 210, -330],
      lookAt: [0, F + 17, 0],
    },
    {
      name: 'whole-native-plan-open-field-and-complete-tiers',
      position: [0.1, F + 590, 0.2],
      lookAt: [0, F + 10, 0],
    },
    {
      name: 'southwest-twin-domed-towers-and-true-open-arch',
      position: [-220, F + 42, 190],
      lookAt: [-80, F + 18, 65],
    },
    {
      name: 'bowl-blue-tiered-seating-suitebands-and-end-board',
      position: toWorld(fieldPoint(-35, 32, 30)),
      lookAt: toWorld(fieldPoint(70, 22, -35)),
    },
    {
      name: 'upper-open-arched-gallery-and-floodlight-trusses',
      position: [180, F + 58, -60],
      lookAt: [100, F + 33, -45],
    },
  ],
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/bank-of-america-stadium-runtime-overlay.mjs',
    level: 'skyline',
    export: 'bankOfAmericaStadiumSkyline',
    errorMeters: 6,
    surfaces,
    authoredLevels: {
      district: { export: 'bankOfAmericaStadiumDistrict', errorMeters: 2.5, surfaces },
      street: { export: 'bankOfAmericaStadiumStreet', errorMeters: 0.8, surfaces },
      closeup: { export: 'bankOfAmericaStadiumCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: [
    p.geometryBasis,
    p.nativePlanInterpretation,
    p.sectionBasis,
    'Two exact published public-domain/CC0 originals first/only; no questionable sources or metadata repair. Native plan and enduring shell represented, no speculative future renovation. Row counts/individual seats/aisles/hidden support and rear details are original simplified estimates. Blank screens/field omit protected branding/ads/art, no surrounding city/practice facilities/parking/sculptures copied.',
    'Original independent512mfield/two raw tiles preserved. Below-grade field offset inferred from native fixture height/primary field-to-scoreboard dimension, not survey. Intrinsic native bowl ground opening for preview; portable low ground/context neighbors are fixtures; exact plaza/foundation/field contacts unverified, replacementfalse.',
  ],
};
