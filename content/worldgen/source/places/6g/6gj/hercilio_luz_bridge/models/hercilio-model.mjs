/** Original Hercílio Luz reconstruction. All tiers share the mapped curved road and integrated chain/truss controls. */
import {
  beam,
  cross,
  loft,
  normalFor,
  normalize,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';
import lines from './bridge-lines.json' with { type: 'json' };
import footingControls from './footing-controls.json' with { type: 'json' };

const route = lines.find((f) => f.id === 35185059777736).native,
  stations = [0];
for (let i = 1; i < route.length; i++)
  stations.push(
    stations.at(-1) + Math.hypot(route[i][0] - route[i - 1][0], route[i][1] - route[i - 1][1]),
  );
export const hercilioControls = {
  route,
  stations,
  length: stations.at(-1),
  towers: [225, 564],
  mainSpan: 339,
  towerTop: 75,
  deckMain: 32.0,
  deckEnds: [19.55, 20.1],
  halfRoad: 3.0,
  trussZ: 3.25,
  halfWidth: 5.75,
  anchorStations: [115, 674],
  groundDatum: 'approximate sea-level meters; current acceptance recorded in qa.json',
};
export const hercilioSurfaces = {
  far: { slot: 'foundation', localRef: 'palette:#ffffff', roughness: 0.9 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.64, metallic: 0.3 },
  concrete: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.95 },
  grate: { slot: 'roof', graph: 'metal_perforated_square', roughness: 0.62, metallic: 0.55 },
  wood: { slot: 'roof', graph: 'wood_plain', roughness: 0.9 },
  mark: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.86 },
};
const C = hercilioControls,
  linear = (h) =>
    h.match(/../g).map((v) => {
      const s = parseInt(v, 16) / 255;
      return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    }),
  colors = {
    steel: linear('9aa8b2'),
    dark: linear('6a757d'),
    road: linear('9da6a9'),
    walk: linear('b0aea6'),
    foundation: linear('c0bcb1'),
    yellow: linear('e8bd57'),
    white: linear('eee9d4'),
  };
const tiers = {
  skyline: {
    main: 4,
    approach: 1,
    chain: 6,
    deck: 2,
    built: false,
    diagonals: true,
    hangers: 0,
    posts: 0,
    bars: 0,
    lamps: 0,
    lacing: 0,
  },
  district: {
    main: 8,
    approach: 2,
    chain: 8,
    deck: 8,
    built: false,
    diagonals: true,
    hangers: 4,
    posts: 0,
    bars: 0,
    lamps: 0,
    lacing: 0,
  },
  street: {
    main: 16,
    approach: 8,
    chain: 32,
    deck: 24,
    built: false,
    diagonals: true,
    hangers: 20,
    posts: 9,
    bars: 0,
    lamps: 8,
    lacing: 0,
  },
  closeup: {
    main: 40,
    approach: 15,
    chain: 64,
    deck: 48,
    built: false,
    diagonals: true,
    hangers: 40,
    posts: 5.6,
    bars: 0.84,
    lamps: 24,
    lacing: 0,
  },
  master: {
    main: 40,
    approach: 15,
    chain: 96,
    deck: 80,
    built: true,
    diagonals: true,
    hangers: 40,
    posts: 2.8,
    bars: 0.22,
    lamps: 32,
    lacing: 1.8,
  },
};
export function hercilioFrame(station) {
  const s = Math.max(0, Math.min(C.length, station));
  let i = 1;
  while (i < stations.length - 1 && s > stations[i]) i++;
  const a = route[i - 1],
    b = route[i],
    u = (s - stations[i - 1]) / (stations[i] - stations[i - 1]),
    t = normalize([b[0] - a[0], 0, b[1] - a[1]]);
  return {
    point: [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u],
    tangent: t,
    normal: [-t[2], 0, t[0]],
  };
}
export function hercilioPoint(s, y, z = 0) {
  const f = hercilioFrame(s);
  return [f.point[0] + f.normal[0] * z, y, f.point[1] + f.normal[2] * z];
}
export function hercilioDeckY(s) {
  const [a, b] = C.towers;
  if (s < a) return C.deckEnds[0] + ((C.deckMain - C.deckEnds[0]) * s) / a;
  if (s > b) return C.deckMain + ((C.deckEnds[1] - C.deckMain) * (s - b)) / (C.length - b);
  return C.deckMain + 0.6 * Math.sin((Math.PI * (s - a)) / (b - a));
}
export function hercilioChainY(s) {
  const [a, b] = C.towers;
  if (s < a) {
    const lo = C.anchorStations[0],
      u = (s - lo) / (a - lo);
    return (
      hercilioDeckY(lo) + 1 + (C.towerTop - hercilioDeckY(lo) - 1) * u - 2 * Math.sin(Math.PI * u)
    );
  }
  if (s > b) {
    const hi = C.anchorStations[1],
      u = (s - b) / (hi - b);
    return C.towerTop + (hercilioDeckY(hi) + 1 - C.towerTop) * u - 2 * Math.sin(Math.PI * u);
  }
  const u = (s - a) / (b - a);
  return C.towerTop - 33 * 4 * u * (1 - u);
}
export function hercilioTrussTop(s) {
  const [a, b] = C.towers,
    u = (s - a) / (b - a);
  return Math.min(
    hercilioChainY(s),
    hercilioDeckY(s) + 0.9 + 17.1 * Math.sin(Math.PI * Math.max(0, Math.min(1, u))),
  );
}
function writer(target, far) {
  return Object.fromEntries(
    ['addQuad', 'addTriangle', 'addConvexPolygon'].map((name) => [
      name,
      (slot, ref, points, hint, _uv, color) => {
        for (let i = 1; i < points.length - 1; i++) {
          let p = [points[0], points[i], points[i + 1]],
            n = normalFor(...p);
          if (hint && n.reduce((s, v, j) => s + v * hint[j], 0) < 0) {
            p = [p[0], p[2], p[1]];
            n = normalFor(...p);
          }
          if (Math.hypot(...n) < 0.9) continue;
          target.addTriangle(
            far ? 'far' : slot,
            ref,
            p,
            n,
            p.map((q) => [q[0], q[1]]),
            color,
          );
        }
      },
    ]),
  );
}
function rib(o, a, b, width, depth, color, far) {
  if (!far) return beam(o, 'metal', a, b, width, depth, color);
  const axis = normalize(b.map((v, i) => v - a[i])),
    u = normalize(cross(axis, Math.abs(axis[1]) < 0.95 ? [0, 1, 0] : [1, 0, 0])),
    v = cross(axis, u),
    ring = (p) =>
      Array.from({ length: 3 }, (_, i) =>
        p.map(
          (n, j) =>
            n +
            (u[j] * width * Math.cos((i * 2 * Math.PI) / 3) +
              v[j] * depth * Math.sin((i * 2 * Math.PI) / 3)) *
              0.6,
        ),
      );
  loft(o, 'metal', [ring(a), ring(b)], color);
}
function member(o, s0, y0, z0, s1, y1, z1, w, d, color, far) {
  rib(o, hercilioPoint(s0, y0, z0), hercilioPoint(s1, y1, z1), w, d, color, far);
}
function segmentCuts(a, b, n) {
  return [
    ...new Set([
      a,
      b,
      ...stations.filter((s) => s > a && s < b),
      ...C.towers.filter((s) => s > a && s < b),
      ...Array.from({ length: n - 1 }, (_, i) => a + ((b - a) * (i + 1)) / n),
    ]),
  ].sort((a, b) => a - b);
}
function slab(o, slot, z0, z1, a, b, n, top, thickness, color) {
  loft(
    o,
    slot,
    segmentCuts(a, b, n).map((s) => [
      hercilioPoint(s, top(s) - thickness, z0),
      hercilioPoint(s, top(s), z0),
      hercilioPoint(s, top(s), z1),
      hercilioPoint(s, top(s) - thickness, z1),
    ]),
    color,
  );
}
function chain(o, S, far) {
  for (const side of [-1, 1])
    for (const [a, b] of [
      [C.anchorStations[0], C.towers[0]],
      [...C.towers],
      [C.towers[1], C.anchorStations[1]],
    ]) {
      const cuts = segmentCuts(a, b, Math.ceil((S.chain * (b - a)) / C.mainSpan)),
        zs = far ? [side * C.trussZ] : [side * C.trussZ - 0.16, side * C.trussZ + 0.16];
      for (const z of zs)
        for (let i = 1; i < cuts.length; i++)
          member(
            o,
            cuts[i - 1],
            hercilioChainY(cuts[i - 1]),
            z,
            cuts[i],
            hercilioChainY(cuts[i]),
            z,
            far ? 0.55 : 0.16,
            far ? 0.65 : 0.43,
            colors.steel,
            far,
          );
      if (S.built)
        for (let s = a + 4.2; s < b; s += 8.475) {
          const y = hercilioChainY(s);
          for (const z of zs)
            member(o, s - 0.32, y, z, s + 0.32, y, z, 0.32, 0.7, colors.dark, false);
        }
    }
  if (S.hangers)
    for (const side of [-1, 1])
      for (let i = 1; i < S.hangers; i++) {
        const s = C.towers[0] + (C.mainSpan * i) / S.hangers,
          top = hercilioChainY(s),
          bottom = hercilioTrussTop(s);
        if (top - bottom < 0.5) continue;
        for (const z of [side * C.trussZ - 0.17, side * C.trussZ + 0.17])
          member(o, s, bottom, z, s, top, z, 0.065, 0.065, colors.steel, far);
      }
}
function mainTruss(o, S, far) {
  const [a, b] = C.towers;
  for (const side of [-1, 1]) {
    const z = side * C.trussZ;
    for (let i = 0; i < S.main; i++) {
      const s0 = a + (C.mainSpan * i) / S.main,
        s1 = a + (C.mainSpan * (i + 1)) / S.main,
        y0 = hercilioDeckY(s0) - 0.55,
        y1 = hercilioDeckY(s1) - 0.55,
        t0 = hercilioTrussTop(s0),
        t1 = hercilioTrussTop(s1);
      member(o, s0, y0, z, s1, y1, z, 0.48, 0.6, colors.steel, far);
      member(o, s0, t0, z, s1, t1, z, 0.43, 0.48, colors.steel, far);
      member(o, s0, y0, z, s0, t0, z, 0.28, 0.25, colors.steel, far);
      member(o, s0, y0, z, s1, t1, z, 0.22, 0.22, colors.steel, far);
      if (!far) member(o, s0, t0, z, s1, y1, z, 0.18, 0.18, colors.steel, far);
      if (S.built) {
        for (const x of [s0, s1]) {
          const ya = hercilioDeckY(x),
            yb = hercilioTrussTop(x);
          for (let y = ya + 0.3; y < yb - 0.3; y += S.lacing)
            member(
              o,
              x - 0.17,
              y,
              z - 0.14,
              x + 0.17,
              Math.min(yb - 0.2, y + S.lacing),
              z + 0.14,
              0.045,
              0.045,
              colors.steel,
              false,
            );
        }
      }
    }
    member(
      o,
      b,
      hercilioDeckY(b) - 0.55,
      z,
      b,
      hercilioTrussTop(b),
      z,
      0.28,
      0.25,
      colors.steel,
      far,
    );
  }
  if (!far)
    for (let i = 1; i < S.main; i++) {
      const s = a + (C.mainSpan * i) / S.main,
        y = hercilioDeckY(s) - 0.38;
      member(o, s, y, -C.halfWidth, s, y, C.halfWidth, 0.28, 0.38, colors.steel, false);
      if (S.built || S.main >= 40) {
        const roof = Math.max(y + 5, hercilioTrussTop(s));
        if (roof > y + 5.1) {
          member(o, s, roof, -C.trussZ, s, roof, C.trussZ, 0.18, 0.22, colors.steel, false);
          member(
            o,
            s,
            roof,
            -C.trussZ,
            s + C.mainSpan / S.main,
            hercilioTrussTop(s + C.mainSpan / S.main),
            C.trussZ,
            0.12,
            0.12,
            colors.steel,
            false,
          );
        }
      }
    }
}
function tower(o, s, S, far) {
  const legs = [-1, 1];
  for (const side of legs) {
    const lower = side * 4.3,
      upper = side * 3.5;
    const P = (y) => hercilioPoint(s, y, lower + ((upper - lower) * (y - 1)) / (C.towerTop - 1));
    const foot = hercilioPoint(s, 0, lower);
    loft(
      o,
      'concrete',
      [
        radialRing(-1.4, 2.3, 2.1, far ? 4 : 12, [foot[0], foot[2]]),
        radialRing(1.5, 2.3, 2.1, far ? 4 : 12, [foot[0], foot[2]]),
      ],
      colors.foundation,
    );
    rib(o, P(1.4), P(C.towerTop), far ? 1.3 : 1.12, far ? 1.1 : 1.0, colors.steel, far);
    if (S.built)
      for (const fore of [-0.63, 0.63]) {
        member(
          o,
          s + fore,
          1.5,
          lower - 0.42,
          s + fore,
          C.towerTop,
          upper - 0.42,
          0.15,
          0.15,
          colors.steel,
          false,
        );
        member(
          o,
          s + fore,
          1.5,
          lower + 0.42,
          s + fore,
          C.towerTop,
          upper + 0.42,
          0.15,
          0.15,
          colors.steel,
          false,
        );
      }
    if (S.lacing)
      for (let y = 2; y < C.towerTop - 2; y += S.lacing) {
        const ya = y,
          yb = Math.min(C.towerTop - 1, y + S.lacing),
          za = lower + ((upper - lower) * ya) / 75,
          zb = lower + ((upper - lower) * yb) / 75;
        for (const fore of [-0.65, 0.65])
          member(
            o,
            s + fore,
            ya,
            za - 0.38,
            s + fore,
            yb,
            zb + 0.38,
            0.07,
            0.07,
            colors.steel,
            false,
          );
      }
  }
  for (const [ya, yb] of far
    ? [
        [2, hercilioDeckY(s) - 1],
        [hercilioDeckY(s) + 9, 60],
        [60, 74],
      ]
    : [
        [2, 15],
        [15, hercilioDeckY(s) - 1],
        [hercilioDeckY(s) + 9, 55],
        [55, 68],
        [68, 74],
      ]) {
    const wa = 4.3 - (0.8 * ya) / 75,
      wb = 4.3 - (0.8 * yb) / 75;
    member(o, s, ya, -wa, s, yb, wb, far ? 0.45 : 0.23, 0.25, colors.steel, far);
    member(o, s, ya, wa, s, yb, -wb, far ? 0.45 : 0.23, 0.25, colors.steel, far);
    if (!far) member(o, s, yb, -wb, s, yb, wb, 0.25, 0.32, colors.steel, false);
  }
  member(o, s, C.towerTop, -3.8, s, C.towerTop, 3.8, 0.65, 0.5, colors.steel, far);
  if (!far) {
    member(
      o,
      s - 0.65,
      C.towerTop - 0.5,
      -3.8,
      s - 0.65,
      C.towerTop - 0.5,
      3.8,
      0.5,
      0.3,
      colors.steel,
      false,
    );
    member(
      o,
      s + 0.65,
      C.towerTop - 0.5,
      -3.8,
      s + 0.65,
      C.towerTop - 0.5,
      3.8,
      0.5,
      0.3,
      colors.steel,
      false,
    );
  }
}
function approaches(o, S, far) {
  for (const [a, b] of [
    [0, C.towers[0]],
    [C.towers[1], C.length],
  ]) {
    for (const side of [-1, 1])
      for (let i = 0; i < S.approach; i++) {
        const s0 = a + ((b - a) * i) / S.approach,
          s1 = a + ((b - a) * (i + 1)) / S.approach,
          z = side * C.trussZ,
          y0 = hercilioDeckY(s0) - 5.6,
          y1 = hercilioDeckY(s1) - 5.6;
        member(o, s0, y0, z, s1, y1, z, 0.42, 0.52, colors.steel, far);
        member(o, s0, y0, z, s1, hercilioDeckY(s1) - 0.4, z, 0.2, 0.2, colors.steel, far);
        if (!far)
          member(o, s0, hercilioDeckY(s0) - 0.4, z, s1, y1, z, 0.2, 0.2, colors.steel, false);
      }
    const count = far ? 2 : S.posts ? 5 : 3;
    for (let i = 1; i < count; i++) {
      const s = a + ((b - a) * i) / count,
        top = hercilioDeckY(s) - 5.6,
        row = footingControls.rows.find((r) => Math.abs(r.station - s) < 0.001),
        bottom = (side) => Math.min(top - 1.5, row.values.find((v) => v.side === side).footY);
      for (const side of [-1, 1]) {
        const y = bottom(side),
          p = hercilioPoint(s, y, side * 4.1),
          sides = far || !S.posts ? 3 : S.bars ? 12 : 8;
        loft(
          o,
          'concrete',
          [
            radialRing(y, 1.35, 1.2, sides, [p[0], p[2]]),
            radialRing(y + 0.65, 1.35, 1.2, sides, [p[0], p[2]]),
          ],
          colors.foundation,
        );
        member(
          o,
          s,
          y + 0.65,
          side * 4.1,
          s,
          top,
          side * 3.25,
          far ? 0.9 : 0.65,
          far ? 1 : 0.55,
          colors.steel,
          far,
        );
      }
      member(o, s, bottom(-1) + 0.65, -4.1, s, top, 3.25, 0.22, 0.22, colors.steel, far);
      if (!far) member(o, s, bottom(1) + 0.65, 4.1, s, top, -3.25, 0.22, 0.22, colors.steel, false);
    }
  }
  for (const s of C.anchorStations) {
    const p = hercilioPoint(s, hercilioDeckY(s) + 0.7, 0);
    for (const side of [-1, 1]) {
      if (far) {
        loft(
          o,
          'concrete',
          [
            radialRing(p[1] - 0.8, 2.2, 1, 3, [p[0], p[2] + side * C.trussZ]),
            radialRing(p[1] + 0.8, 2.2, 1, 3, [p[0], p[2] + side * C.trussZ]),
          ],
          colors.foundation,
        );
      } else
        box(
          o,
          'concrete',
          [p[0] - 2.2, p[1] - 0.8, p[2] + side * C.trussZ - 1],
          [p[0] + 2.2, p[1] + 0.8, p[2] + side * C.trussZ + 1],
          colors.foundation,
        );
    }
  }
}
function guards(o, S, far) {
  if (far) return;
  const count = S.built ? 40 : S.bars ? 8 : S.posts ? 4 : 2,
    cuts = [
      ...new Set([
        ...stations,
        ...C.towers,
        ...Array.from(
          { length: count - 1 },
          (_, i) => C.towers[0] + (C.mainSpan * (i + 1)) / count,
        ),
      ]),
    ].sort((a, b) => a - b);
  for (const z of [-C.halfWidth, -C.trussZ - 0.25, C.trussZ + 0.25, C.halfWidth]) {
    for (const lift of S.posts ? [0.4, 0.8, 1.2] : [1.1])
      for (let i = 1; i < cuts.length; i++)
        member(
          o,
          cuts[i - 1],
          hercilioDeckY(cuts[i - 1]) + lift,
          z,
          cuts[i],
          hercilioDeckY(cuts[i]) + lift,
          z,
          0.055,
          0.06,
          colors.steel,
          false,
        );
    if (S.posts)
      for (let s = 0; s < C.length; s += S.posts)
        member(
          o,
          s,
          hercilioDeckY(s),
          z,
          s,
          hercilioDeckY(s) + 1.2,
          z,
          0.075,
          0.075,
          colors.steel,
          false,
        );
    if (S.bars)
      for (let s = 0.11; s < C.length; s += S.bars)
        member(
          o,
          s,
          hercilioDeckY(s) + 0.08,
          z,
          s,
          hercilioDeckY(s) + 1.14,
          z,
          0.026,
          0.026,
          colors.steel,
          !S.built,
        );
  }
  // Current road photograph: paired horizontal crash rails inside the side platforms.
  if (S.posts)
    for (const z of [-C.halfRoad - 0.04, C.halfRoad + 0.04])
      for (const lift of [0.32, 0.68, 0.95])
        for (let i = 1; i < cuts.length; i++)
          member(
            o,
            cuts[i - 1],
            hercilioDeckY(cuts[i - 1]) + lift,
            z,
            cuts[i],
            hercilioDeckY(cuts[i]) + lift,
            z,
            0.16,
            0.1,
            colors.dark,
            false,
          );
}
function lamps(o, S) {
  if (!S.lamps) return;
  for (let i = 0; i < S.lamps; i++) {
    const s = (C.length * (i + 0.5)) / S.lamps,
      base = hercilioDeckY(s);
    for (const side of [-1, 1]) {
      const z = side * 4.1;
      member(o, s, base, z, s, base + 9.5, z, 0.11, 0.11, colors.steel, false);
      member(o, s, base + 9.5, z, s, base + 9.5, z - side * 1.5, 0.1, 0.12, colors.steel, false);
      member(
        o,
        s - 0.32,
        base + 9.43,
        z - side * 1.5,
        s + 0.32,
        base + 9.43,
        z - side * 1.5,
        0.28,
        0.12,
        colors.dark,
        false,
      );
    }
  }
}
function landingPrism(o, slot, points, color, far) {
  const emit = (p, hint) => o.addQuad(slot, 'palette:#ffffff', p, hint, [], color);
  emit(points, [0, 1, 0]);
  if (far) return;
  const center = [0, 1, 2].map((axis) => points.reduce((sum, p) => sum + p[axis], 0) / 4);
  const bottom = points.map((p) => [p[0], p[1] - 0.2, p[2]]);
  emit(bottom, [0, -1, 0]);
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4,
      a = points[i],
      b = points[j];
    emit(
      [a, b, bottom[j], bottom[i]],
      [(a[0] + b[0]) / 2 - center[0], 0, (a[2] + b[2]) / 2 - center[2]],
    );
  }
}
/** Short reconstruction transitions outside the mapped bridge; the long north mouth follows its own path endpoint. */
export function buildHercilioLandings(o, far) {
  for (const [s, direction] of [
    [0, -1],
    [C.length, 1],
  ]) {
    const f = hercilioFrame(s),
      y = hercilioDeckY(s);
    const outside = (z) => {
      const p = hercilioPoint(s, y + 0.002, z);
      return p.map((v, axis) => v + direction * f.tangent[axis]);
    };
    const bands = far
      ? [['far', -C.halfWidth, C.halfWidth, colors.road, 0]]
      : [
          ['grate', -C.halfRoad, C.halfRoad, colors.road, 0],
          ['wood', -C.halfWidth, -C.halfRoad, colors.walk, 0.08],
          ['wood', C.halfRoad, C.halfWidth, colors.walk, 0.08],
        ];
    for (const [slot, a, b, color, rise] of bands)
      landingPrism(
        o,
        slot,
        [hercilioPoint(s, y + rise, a), hercilioPoint(s, y + rise, b), outside(b), outside(a)],
        color,
        far,
      );
  }
  const cycle = lines.find((f) => f.id === 35185131690790).native;
  const end = cycle.at(-1),
    before = cycle.at(-2);
  const tangent = normalize([end[0] - before[0], 0, end[1] - before[1]]),
    normal = [-tangent[2], 0, tangent[0]];
  const center = [end[0] + tangent[0] * 0.25, C.deckEnds[0] + 0.002, end[1] + tangent[2] * 0.25];
  const endPoint = (side) => center.map((v, axis) => v + normal[axis] * 1.25 * side);
  landingPrism(
    o,
    far ? 'far' : 'wood',
    [
      hercilioPoint(0, C.deckEnds[0] + 0.08, -C.halfWidth),
      hercilioPoint(0, C.deckEnds[0] + 0.08, -C.halfRoad),
      endPoint(-1),
      endPoint(1),
    ],
    colors.walk,
    far,
  );
}
export function buildHercilioLevel(target, level = 'master') {
  const S = tiers[level];
  if (!S) throw Error(`Unknown Hercilio tier ${level}`);
  const far = level === 'skyline',
    o = writer(target, far);
  slab(o, 'grate', -C.halfRoad, C.halfRoad, 0, C.length, S.deck, hercilioDeckY, 0.32, colors.road);
  for (const side of [-1, 1])
    slab(
      o,
      'wood',
      Math.min(side * C.halfWidth, side * C.halfRoad),
      Math.max(side * C.halfWidth, side * C.halfRoad),
      0,
      C.length,
      S.deck,
      (s) => hercilioDeckY(s) + 0.08,
      0.22,
      colors.walk,
    );
  mainTruss(o, S, far);
  chain(o, S, far);
  for (const s of C.towers) tower(o, s, S, far);
  approaches(o, S, far);
  guards(o, S, far);
  lamps(o, S);
  if (S.posts)
    slab(
      o,
      'mark',
      -4.48,
      -4.435,
      0,
      C.length,
      S.deck,
      (s) => hercilioDeckY(s) + 0.083,
      0.002,
      colors.white,
    );
  if (S.bars) {
    for (let s = 0; s < C.length; s += 3.2) {
      const p = hercilioPoint(s, hercilioDeckY(s) + 0.012, 0);
      box(
        o,
        'mark',
        [p[0] - 0.16, p[1], p[2] - 0.05],
        [p[0] + 0.16, p[1] + 0.035, p[2] + 0.05],
        colors.yellow,
      );
    }
  }
  buildHercilioLandings(o, far);
}
export const buildHercilioSkyline = (o) => buildHercilioLevel(o, 'skyline');
export const buildHercilioDistrict = (o) => buildHercilioLevel(o, 'district');
export const buildHercilioStreet = (o) => buildHercilioLevel(o, 'street');
export const buildHercilioCloseup = (o) => buildHercilioLevel(o, 'closeup');
