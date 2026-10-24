/** spire_of_dublin whole browser reconstruction: exact master retained, perforations use daylight marks in budgeted close-up. */
import { cross, loft, radialRing } from './authored-structure-mesh.mjs';
import { face, triangle } from './heritage-tower-detail-mesh.mjs';

const tau = 2 * Math.PI,
  silver = [0.92, 0.925, 0.93],
  radius = (y) => 1.5 - ((1.5 - 0.075) * y) / 120;
const means = {
  marble: [0.916083, 0.916083, 0.916083],
  stainless: [0.81896, 0.822889, 0.822889],
  beadblasted_stainless: [0.83078, 0.834775, 0.834775],
  polished_stainless: [0.879701, 0.879701, 0.879701],
};
function detail(destination, mode) {
  const selectCount = (close, street, district) =>
    mode === 'closeup' ? close : mode === 'street' ? street : district;
  const out = Object.fromEntries(
    ['addQuad', 'addTriangle', 'addConvexPolygon'].map((k) => [
      k,
      (s, r, p, n, u, c) => {
        const a = p.slice(0, 3).map((q) => q.map(Math.fround));
        if (
          Math.hypot(
            ...cross(
              a[1].map((v, i) => v - a[0][i]),
              a[2].map((v, i) => v - a[0][i]),
            ),
          ) < 1e-10
        )
          return;
        destination[k](
          s,
          r,
          p,
          n.map((v) => v / Math.hypot(...n)),
          u,
          mode === 'skyline' ? c.map((v, i) => v * (means[s]?.[i] ?? 1)) : c,
        );
      },
    ]),
  );
  const point = (a, y, offset = 0) => [
    (radius(y) + offset) * Math.cos(a),
    y,
    (radius(y) + offset) * Math.sin(a),
  ];
  const cone = (y0, y1, slot, color = silver, count = selectCount(256, 128, 32)) =>
    loft(
      out,
      slot,
      [
        radialRing(y0, radius(y0), radius(y0), count),
        radialRing(y1, radius(y1), radius(y1), count),
      ],
      color,
      { cap: false },
    );
  const stoneCount = mode === 'skyline' ? 12 : selectCount(96, 48, 24),
    shaftCount = mode === 'skyline' ? 16 : selectCount(256, 128, 32);
  loft(
    out,
    'marble',
    [radialRing(0, 4.05, 4.05, stoneCount), radialRing(0.035, 4.05, 4.05, stoneCount)],
    [0.1, 0.11, 0.115],
  );
  for (let i = 0; i < 8; i++) {
    const a = (i * tau) / 8,
      x = 3.9 * Math.cos(a),
      z = 3.9 * Math.sin(a),
      n = mode === 'skyline' ? 4 : selectCount(24, 12, 6);
    loft(
      out,
      'stainless',
      [
        [0.035, 0.105],
        [0.88, 0.105],
        [0.92, 0.092],
        [0.935, 0.03],
      ].map(([y, r]) => radialRing(y, r, r, n, [x, z])),
      silver,
    );
  }
  cone(0.045, 10, 'beadblasted_stainless', silver, shaftCount);
  cone(10, 108, 'beadblasted_stainless', silver, shaftCount);
  cone(108, 120, 'beadblasted_stainless', silver, shaftCount);
  loft(
    out,
    'beadblasted_stainless',
    [radialRing(119.98, 0.075, 0.075, shaftCount), radialRing(120, 0.075, 0.075, shaftCount)],
    silver,
  );
  if (mode !== 'skyline') {
    for (let ring = 0; ring < selectCount(57, 24, 8); ring++) {
      const r = 1.51 + (ring * (3.77 - 1.51)) / selectCount(57, 24, 8),
        count = selectCount(120, 64, 24);
      for (let j = 0; j < count; j++) {
        const a = (-tau * j) / count,
          b = (-tau * (j + 1)) / count,
          p = (r, a) => [r * Math.cos(a), 0.046, r * Math.sin(a)];
        face(
          out,
          'stainless',
          [p(r, a), p(r, b), p(r + 0.018, b), p(r + 0.018, a)].reverse(),
          silver,
        );
      }
    }
    pattern(out);
  }
  // Fifteen-millimetre perforations are below ordinary street pixel size. Keep all11884 positions
  // as inset-diffuser daylight color marks in close-up; the detailed master retains physical holes.
  if (mode === 'closeup') {
    const counts = Array.from({ length: 212 }, (_, j) =>
      Math.round((tau * radius(108 + ((j + 0.5) * 12) / 212)) / 0.0169),
    );
    let rest = 11884 - counts.reduce((a, b) => a + b, 0);
    for (let j = 0; rest !== 0; j = (j + 1) % 212) {
      counts[j] += Math.sign(rest);
      rest -= Math.sign(rest);
    }
    for (let row = 0; row < 212; row++)
      for (let i = 0; i < counts[row]; i++) {
        const y = 108 + ((row + 0.5) * 12) / 212,
          a = ((i + 0.5) * tau) / counts[row],
          half = 0.0075 / radius(y);
        face(
          out,
          'glass',
          [
            point(a - half, y - 0.0075, 0.001),
            point(a + half, y - 0.0075, 0.001),
            point(a + half, y + 0.0075, 0.001),
            point(a - half, y + 0.0075, 0.001),
          ],
          [0.48, 0.55, 0.59],
        );
      }
  }
  function pattern(out) {
    // Original vector islands following the photographed horizontal geological strata.
    // These are editable reconstruction marks, not a tracing of the architect's complete stencil.
    for (let row = 0; row < selectCount(43, 22, 10); row++)
      for (let item = 0; item < 10; item++) {
        const code = (row * 137 + item * 53) % 101;
        if (code < 26) continue;
        const y =
          0.14 + row * selectCount(0.227, 0.454, 0.976) + 0.075 * Math.sin(row * 1.4 + item);
        const a = tau * (item / 10 + 0.031 * Math.sin(row * 1.23 + item * 1.7));
        const width = 0.045 + 0.4 * (code / 100),
          rise = 0.012 + (0.07 * ((code * 17) % 31)) / 31;
        const center = [a, y];
        const rim = Array.from({ length: selectCount(12, 8, 4) }, (_, i) => {
          const t = (-tau * i) / selectCount(12, 8, 4),
            ripple = 1 + 0.2 * Math.sin(i * 2.2 + row) + 0.17 * Math.cos(i * 3.1 + item);
          return [a + (width * Math.cos(t) * ripple) / radius(y), y + rise * Math.sin(t) * ripple];
        });
        for (let i = 0; i < rim.length; i++) {
          const uv = [center, rim[i], rim[(i + 1) % rim.length]];
          const lo = Math.min(...uv.map((p) => p[0])),
            hi = Math.max(...uv.map((p) => p[0]));
          // Clip each convex fan triangle into narrow angular strips before bending it.
          // A single broad triangle would chord through the cone and erase its own pattern.
          const clip = (polygon, edge, sign) => {
            const result = [];
            for (let j = 0; j < polygon.length; j++) {
              const p = polygon[j],
                q = polygon[(j + 1) % polygon.length];
              if ((p[0] - edge) * sign >= 0) result.push(p);
              if ((p[0] - edge) * sign < 0 !== (q[0] - edge) * sign < 0) {
                const t = (edge - p[0]) / (q[0] - p[0]);
                result.push([edge, p[1] + t * (q[1] - p[1])]);
              }
            }
            return result;
          };
          const steps = Math.ceil((hi - lo) / selectCount(0.06, 0.12, 0.3));
          for (let j = 0; j < steps; j++) {
            const vertices = clip(
              clip(uv, lo + ((hi - lo) * j) / steps, 1),
              lo + ((hi - lo) * (j + 1)) / steps,
              -1,
            );
            const unique = vertices.filter(
              (p, k) =>
                k === 0 || Math.hypot(p[0] - vertices[k - 1][0], p[1] - vertices[k - 1][1]) > 1e-9,
            );
            if (
              unique.length > 2 &&
              Math.hypot(unique[0][0] - unique.at(-1)[0], unique[0][1] - unique.at(-1)[1]) < 1e-9
            )
              unique.pop();
            const ps = unique.map((p) => point(p[0], p[1], selectCount(0.001, 0.004, 0.03)));
            for (let k = 1; k < ps.length - 1; k++)
              triangle(out, 'polished_stainless', [ps[0], ps[k], ps[k + 1]], silver);
          }
        }
      }
  }
}
export function buildSpireSkyline(out) {
  detail(out, 'skyline');
}
export function buildSpireDistrict(out) {
  detail(out, 'district');
}
export function buildSpireStreet(out) {
  detail(out, 'street');
}
export function buildSpireCloseup(out) {
  detail(out, 'closeup');
}
