/** Budgeted silhouettes of the retained Victory Bridge master; merged transverse vaults. */
import './install-deterministic-math.mjs';
import { normalFor, sphere } from './authored-structure-mesh.mjs';
import { box } from './structure-mesh.mjs';

const MEANS = {
  stone: [0.9129740140085889, 0.9129740140085889, 0.9129740140085889],
  concrete: [0.7108161524542215, 0.7108161524542215, 0.6819278525713045],
  paving: [0.7011092892788303, 0.7011092892788303, 0.7011092892788303],
  iron: [0.9088893864967214, 0.9088893864967214, 0.9088893864967214],
  road: [1, 1, 1],
  marking: [1, 1, 1],
};
const basalt = [0.16, 0.164, 0.153],
  smooth = [0.23, 0.235, 0.215],
  iron = [0.105, 0.13, 0.119];
function writer(destination, far) {
  function emit(slot, ref, p, hint, uv, color) {
    p = p.map((v) => v.map(Math.fround));
    for (let i = 1; i < p.length - 1; i++) {
      let t = [p[0], p[i], p[i + 1]],
        n = normalFor(...t);
      if (Math.hypot(...n) < 0.5) continue;
      if (hint && n.reduce((v, x, j) => v + x * hint[j], 0) < 0) {
        t = [t[0], t[2], t[1]];
        n = normalFor(...t);
      }
      destination.addTriangle(
        slot,
        ref,
        t,
        n,
        t.map((v) => [v[0], v[1]]),
        far ? color.map((v, j) => v * (MEANS[slot]?.[j] ?? 1)) : color,
      );
    }
  }
  return Object.fromEntries(['addTriangle', 'addQuad', 'addConvexPolygon'].map((k) => [k, emit]));
}
function prism(o, p, z0, z1, color) {
  const a = p.map(([x, y]) => [x, y, z0]),
    b = p.map(([x, y]) => [x, y, z1]);
  o.addConvexPolygon('stone', 'palette:#ffffff', a.toReversed(), [0, 0, -1], null, color);
  o.addConvexPolygon('stone', 'palette:#ffffff', b, [0, 0, 1], null, color);
  for (let i = 0; i < p.length; i++) {
    const j = (i + 1) % p.length,
      q = [a[i], a[j], b[j], b[i]];
    o.addQuad('stone', 'palette:#ffffff', q, normalFor(...q), null, color);
  }
}
function build(out, detail, near = false) {
  const o = writer(out, !detail),
    archY = (x) => 9 + 23.32 * Math.sqrt(Math.max(0, 1 - (x / 22.82) ** 2));
  for (const cx of [-48, 0, 48]) {
    const n = near === 'street' ? 18 : near ? 32 : detail ? 18 : 8;
    const units = near
      ? [
          [-14.62, -5.38],
          [-4.62, 4.62],
          [5.38, 14.62],
        ]
      : [[-14.62, 14.62]];
    for (let i = 0; i < n; i++) {
      const a = (Math.PI * i) / n,
        b = (Math.PI * (i + 1)) / n,
        p = (t, r) => [cx - (21.5 + r) * Math.cos(t), 9 + (22 + r) * Math.sin(t)];
      for (const [z0, z1] of units)
        prism(o, [p(a, 0), p(b, 0), p(b, 1.32), p(a, 1.32)], z0, z1, smooth);
    }
    const offsets = [-19, -14.8, -10.6, 10.6, 14.8, 19],
      cuts = [-22.82, 22.82];
    for (let i = 1; i < (detail ? 14 : 8); i++) cuts.push(-22.82 + (i * 45.64) / (detail ? 14 : 8));
    if (detail)
      for (const x of offsets)
        for (let i = 0; i <= 4; i++) cuts.push(x - 1.48 * Math.cos((Math.PI * i) / 4));
    const xs = [...new Set(cuts)].sort((a, b) => a - b),
      low = (x) => {
        let y = archY(x);
        if (detail)
          for (const a of offsets)
            if (Math.abs(x - a) < 1.48)
              y = Math.max(y, 30.5 + 1.48 * Math.sqrt(1 - ((x - a) / 1.48) ** 2));
        return y;
      };
    for (let i = 1; i < xs.length; i++) {
      const a = xs[i - 1],
        b = xs[i],
        ya = low(a),
        yb = low(b);
      for (const [z0, z1] of units)
        prism(
          o,
          [
            [cx + a, ya],
            [cx + b, yb],
            [cx + b, 33.4],
            [cx + a, 33.4],
          ],
          z0,
          z1,
          basalt,
        );
    }
  }
  for (const x of [-24, 24]) box(o, 'stone', [x - 2.5, 0, -14.62], [x + 2.5, 33.4, 14.62], basalt);
  if (!near)
    for (const x of [-84, 84]) box(o, 'stone', [x - 16, 0, -15], [x + 16, 33.4, 15], basalt);
  else
    for (const sign of [-1, 1]) {
      const portals = [
          [82.6, 7.8, 23.6, 4.8],
          [93.1, 4.1, 27.3, 2.05],
        ],
        cuts = [70.7, 100];
      for (const [cx, w] of portals)
        for (let i = 0; i <= 10; i++) cuts.push(cx - (w / 2) * Math.cos((Math.PI * i) / 10));
      const xs = [...new Set(cuts)].sort((a, b) => a - b),
        ceiling = (x) => {
          const p = portals.find(([cx, w]) => Math.abs(x - cx) < w / 2);
          return p ? p[2] + p[3] * Math.sqrt(Math.max(0, 1 - ((x - p[0]) / (p[1] / 2)) ** 2)) : 16;
        };
      for (let i = 1; i < xs.length; i++) {
        let p = [
          [sign * xs[i - 1], ceiling(xs[i - 1] + 1e-8)],
          [sign * xs[i], ceiling(xs[i] - 1e-8)],
          [sign * xs[i], 33.4],
          [sign * xs[i - 1], 33.4],
        ];
        if (sign < 0) p = p.toReversed();
        prism(o, p, -14.62, 14.62, basalt);
      }
    }
  box(o, 'concrete', [-100, 33.4, -15], [100, 33.83, 15], [0.52, 0.52, 0.5]);
  box(o, 'road', [-100, 33.83, -12.5], [100, 34, 12.5], [0.175, 0.183, 0.181]);
  for (const z of [-13.75, 13.75]) {
    box(o, 'paving', [-100, 33.85, z - 1.25], [100, 34.2, z + 1.25], [0.68, 0.68, 0.642]);
    box(
      o,
      'iron',
      [-100, 35.3, z + Math.sign(z) * 1 - 0.07],
      [100, 35.48, z + Math.sign(z) * 1 + 0.07],
      iron,
    );
  }
  if (detail)
    for (const x of [-96, -72, -48, -24, 0, 24, 48, 72, 96])
      for (const z of [-14.36, 14.36]) {
        box(o, 'iron', [x - 0.12, 34.2, z - 0.12], [x + 0.12, 40.8, z + 0.12], iron);
        if (!near)
          box(o, 'marking', [x - 0.5, 40.8, z - 0.5], [x + 0.5, 41.5, z + 0.5], [0.8, 0.8, 0.75]);
        else {
          box(o, 'iron', [x - 1.2, 40.5, z - 0.09], [x + 1.2, 40.68, z + 0.09], iron);
          for (const dx of [-1, 0, 1])
            sphere(
              o,
              'marking',
              [x + dx, 41.25 + (dx === 0 ? 0.45 : 0), z],
              [0.5, 0.5, 0.5],
              [0.78, 0.79, 0.73],
              8,
              4,
            );
        }
      }
  if (near) {
    for (const z of [-14.86, 14.86]) {
      for (let x = -100; x <= 100; x += 4)
        box(o, 'iron', [x - 0.08, 34.2, z - 0.1], [x + 0.08, 35.48, z + 0.1], iron);
      for (let x = -99.5; x < 100; x += near === 'street' ? 6 : 0.66)
        for (const y of [34.55, 35.1]) circle(o, x, y, z, 0.31, 0.025, near === 'street' ? 6 : 8);
      box(o, 'iron', [-100, 34.22, z - 0.05], [100, 34.3, z + 0.05], iron);
    }
    for (let x = -98; x < 98; x += 7)
      for (const z of [-9.375, -6.25, -3.125, 3.125, 6.25, 9.375])
        o.addQuad(
          'marking',
          'palette:#ffffff',
          [
            [x, 34.006, z - 0.06],
            [x, 34.006, z + 0.06],
            [x + 3, 34.006, z + 0.06],
            [x + 3, 34.006, z - 0.06],
          ],
          [0, 1, 0],
          null,
          [0.85, 0.85, 0.81],
        );
  }
}
function circle(o, x, y, z, r, w, n) {
  for (let i = 0; i < n; i++) {
    const a = (Math.PI * 2 * i) / n,
      b = (Math.PI * 2 * (i + 1)) / n,
      p = (t, k) => [x + k * Math.cos(t), y + k * Math.sin(t), z],
      q = [p(a, r - w), p(b, r - w), p(b, r + w), p(a, r + w)];
    o.addQuad('iron', 'palette:#ffffff', q, [0, 0, 1], null, iron);
    o.addQuad('iron', 'palette:#ffffff', q.toReversed(), [0, 0, -1], null, iron);
  }
}
export const buildHaghtanakSkyline = (out) => build(out, false);
export const buildHaghtanakDistrict = (out) => build(out, true);
export const buildHaghtanakMediumFi = (out) => build(out, true, true);
export const buildHaghtanakStreet = (out) => build(out, true, 'street');
