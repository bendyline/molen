/** Component-resampled Azadi derivatives; detailed source recipe remains separate. */
import {
  beam,
  loft,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { transform } from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const marble = [0.9, 0.9, 0.82],
  blue = [0.23, 0.58, 0.56];
const stations = [
  [0, 32, 19, 8.5, 7.5, 3, 4.5, 5],
  [5, 25.8, 15.8, 8.25, 7.05, 2.8, 4.9, 5.1],
  [10, 20.2, 12.9, 7.7, 6.6, 2.5, 5.5, 5.5],
  [15, 15.1, 10.35, 6.9, 6.05, 2.2, 6.1, 6.05],
  [20, 11.5, 8.25, 5.25, 5.6, 1.8, 7, 5.6],
  [24, 9.05, 6.9, 3.1, 5.4, 1, 6.9, 5.4],
  [27, 7.5, 5.7, 0, 5.7, 0, 5.7, 5.7],
].map((s) => [s[0] * 1.2, ...s.slice(1)]);
export function sampleAzadiProfile(y) {
  const k = Math.min(
      stations.length - 1,
      Math.max(
        1,
        stations.findIndex((s) => s[0] >= y),
      ),
    ),
    a = stations[k - 1],
    b = stations[k],
    t = (y - a[0]) / (b[0] - a[0]),
    before = stations[Math.max(0, k - 2)],
    after = stations[Math.min(stations.length - 1, k + 1)];
  return a.map((v, i) =>
    i === 0
      ? y
      : (2 * Math.pow(t, 3) - 3 * t * t + 1) * v +
        (((Math.pow(t, 3) - 2 * t * t + t) * (b[i] - before[i])) / (b[0] - before[0])) *
          (b[0] - a[0]) +
        (-2 * Math.pow(t, 3) + 3 * t * t) * b[i] +
        (((Math.pow(t, 3) - t * t) * (after[i] - v)) / (after[0] - a[0])) * (b[0] - a[0]),
  );
}
const vault = (x, z) => [x, 24.5 + 7.9 * Math.pow(Math.abs(z) / 5.7, 1.5) - 0.15 * x * x, z];
// Twisted surface quads need the normal of each rendered triangle. Reusing one
// normal across both triangles produces alternating self-shadow bias patches.
function face(out, slot, points, color) {
  for (const indices of [
    [0, 1, 2],
    [0, 2, 3],
  ]) {
    const p = indices.map((i) => points[i]);
    out.addTriangle(
      slot,
      'metric:uv',
      p,
      normalFor(...p),
      p.map((v) => [v[0], v[1]]),
      color,
    );
  }
}
function crown(out, cfg) {
  const rows = [
    [32.4, 7.5, 5.7],
    [35, 7.15, 5.2],
    [38, 7.05, 4.7],
    [41, 7.15, 4.42],
    [44.4, 7.55, 4.6],
  ];
  loft(
    out,
    'limestone',
    rows.map(([y, rx, rz]) => [
      [-rx, y, -rz],
      [-rx, y, rz],
      [rx, y, rz],
      [rx, y, -rz],
    ]),
    marble,
  );
  for (let side = 0; side < 4; side++) {
    const wall = transform(out, (side * Math.PI) / 2),
      w = side % 2 ? 8.85 : 14.4,
      z = side % 2 ? 7.65 : 4.55,
      count = side % 2 ? 5 : 9;
    if (cfg.vents)
      for (let i = 0; i < count; i++) {
        const x = (i - (count - 1) / 2) * 0.78,
          p = [
            [x - 0.225, 42.5, z + 0.13],
            [x + 0.225, 42.5, z + 0.13],
            [x + 0.225, 43.32, z + 0.13],
            [x, 43.62, z + 0.13],
            [x - 0.225, 43.32, z + 0.13],
          ];
        wall.addConvexPolygon('metal', 'metric:uv', p, [0, 0, 1], (p) => [p[0], p[1]], blue);
        for (let j = 0; j < p.length; j++) {
          const a = p[j],
            b = p[(j + 1) % p.length],
            ps = [a, b, [b[0], b[1], z + 0.23], [a[0], a[1], z + 0.23]];
          wall.addQuad(
            'limestone',
            'metric:uv',
            ps,
            normalFor(...ps.slice(0, 3)),
            [
              [a[0], a[1]],
              [b[0], b[1]],
              [b[0], b[1]],
              [a[0], a[1]],
            ],
            marble,
          );
        }
      }
    else box(wall, 'metal', [-w * 0.3, 42.55, z + 0.08], [w * 0.3, 43.3, z + 0.1], blue);
    for (const sign of [-1, 1])
      beam(
        wall,
        'limestone',
        [sign * (w / 2 - 0.25), 33, z + 0.24],
        [sign * (w / 2 + 0.25), 45, z + 0.3],
        0.5,
        0.45,
        marble,
      );
    if (cfg.slots)
      for (let i = 0; i < 5; i++)
        box(
          wall,
          'shadow',
          [(i - 2) * 0.4, 40.7, z + 0.035],
          [(i - 2) * 0.4 + 0.08, 42.2, z + 0.055],
          [0.39, 0.48, 0.43],
        );
  }
  box(out, 'limestone', [-7.1, 44.35, -4.4], [7.1, 44.52, 4.4], marble);
}
function build(out, cfg) {
  const rows = Array.from({ length: cfg.curve + 1 }, (_, i) =>
    sampleAzadiProfile((i * 32.4) / cfg.curve),
  );
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) {
      const rings = rows.map(([y, rx, rz, ix, iz, tx, thickness, inside]) => {
        const p = [
          [ix, y, iz],
          [rx, y, rz],
          [rx, y, rz - thickness],
          [ix + tx, y, iz - inside],
        ].map(([x, y, z]) => [sx * x, y, sz * z]);
        return sx * sz < 0 ? p.reverse() : p;
      });
      // Divide each ruled face at its blue joint paths. A wide twisted quad otherwise
      // cuts through intermediate ribs and produces alternating self-shadow patches.
      const front = Math.max(1, cfg.ribs - 1),
        back = Math.max(1, cfg.returns + 1);
      const spans = sx * sz < 0 ? [back, 1, front, 1] : [front, 1, back, 1];
      const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
      for (let row = 1; row < rings.length; row++)
        for (let side = 0; side < 4; side++)
          for (let span = 0; span < spans[side]; span++) {
            const next = (side + 1) % 4,
              a = span / spans[side],
              b = (span + 1) / spans[side];
            face(
              out,
              'limestone',
              [
                mix(rings[row - 1][side], rings[row - 1][next], a),
                mix(rings[row - 1][side], rings[row - 1][next], b),
                mix(rings[row][side], rings[row][next], b),
                mix(rings[row][side], rings[row][next], a),
              ],
              marble,
            );
          }
      for (const [ring, reverse] of [
        [rings[0], true],
        [rings.at(-1), false],
      ]) {
        const p = reverse ? [...ring].reverse() : ring;
        out.addConvexPolygon(
          'limestone',
          'metric:uv',
          p,
          normalFor(...p.slice(0, 3)),
          (p) => [p[0], p[2]],
          marble,
        );
      }
      const raisedPath = (points, widths, sign) =>
        points.map((p, i) => {
          const previous = points[Math.max(0, i - 1)],
            next = points[Math.min(points.length - 1, i + 1)];
          const n = normalFor(
            p,
            p.map((v, axis) => v + widths[i][axis]),
            p.map((v, axis) => v + next[axis] - previous[axis]),
          );
          return p.map((v, axis) => v + (i === 0 && axis === 1 ? 0 : n[axis] * sign * 0.006));
        });
      // Blue marble joints are flush inlays, not projecting structural ribs.
      // Narrow ribbons avoid exaggerated, aliased shadows from tiny box beams.
      const inlay = (path, widths, sign, width) => {
        const edges = path.map((p, i) => {
          const length = Math.hypot(...widths[i]);
          return [-1, 1].map((side) =>
            p.map((v, axis) => v + (side * widths[i][axis] * width) / (2 * length)),
          );
        });
        for (let i = 1; i < path.length; i++) {
          const p = [edges[i - 1][0], edges[i - 1][1], edges[i][1], edges[i][0]];
          face(out, 'metal', sign < 0 ? p.reverse() : p, blue);
        }
      };
      for (let strip = 0; strip < cfg.ribs; strip++) {
        const t = strip / (cfg.ribs - 1);
        const p = ([y, rx, rz, ix, iz]) => [
          sx * (ix + (rx - ix) * t),
          y,
          sz * (iz + (rz - iz) * t),
        ];
        const widths = rows.map(([, rx, rz, ix, iz]) => [sx * (rx - ix), 0, sz * (rz - iz)]);
        inlay(raisedPath(rows.map(p), widths, sx * sz), widths, sx * sz, 0.065);
      }
      for (let strip = 1; strip <= cfg.returns; strip++) {
        const t = strip / (cfg.returns + 1),
          p = ([y, rx, rz, ix, iz, tx, thickness, inside]) => [
            sx * (ix + tx + (rx - ix - tx) * t),
            y,
            sz * (iz - inside + (rz - thickness - iz + inside) * t),
          ];
        const widths = rows.map(([, rx, rz, ix, iz, tx, thickness, inside]) => [
          sx * (rx - ix - tx),
          0,
          sz * (rz - thickness - iz + inside),
        ]);
        inlay(raisedPath(rows.map(p), widths, -sx * sz), widths, -sx * sz, 0.055);
      }
    }
  crown(out, cfg);
  for (let i = 0; i < cfg.vaultX; i++)
    for (let j = 0; j < cfg.vaultZ; j++) {
      const x = -7.5 + (i * 15) / cfg.vaultX,
        z = -5.7 + (j * 11.4) / cfg.vaultZ;
      face(
        out,
        'limestone',
        [
          vault(x, z),
          vault(x + 15 / cfg.vaultX, z),
          vault(x + 15 / cfg.vaultX, z + 11.4 / cfg.vaultZ),
          vault(x, z + 11.4 / cfg.vaultZ),
        ],
        marble,
      );
    }
  for (let diagonal = -cfg.diagonals; diagonal <= cfg.diagonals; diagonal++)
    for (const sign of [-1, 1]) {
      if (!cfg.diagonals) continue;
      let prev;
      for (let i = 0; i <= cfg.lattice; i++) {
        const x = -7.4 + (i * 14.8) / cfg.lattice,
          z = sign * x * 0.7 + diagonal * 0.95;
        if (Math.abs(z) > 5.69) {
          prev = undefined;
          continue;
        }
        const p = vault(x, z);
        p[1] -= 0.06;
        if (prev) beam(out, 'metal', prev, p, 0.13, 0.08, blue);
        prev = p;
      }
    }
}
export function azadiSkyline(out) {
  build(out, {
    curve: 12,
    ribs: 0,
    returns: 0,
    vaultX: 6,
    vaultZ: 4,
    diagonals: 0,
    lattice: 0,
    vents: false,
    slots: false,
  });
}
export function azadiDistrict(out) {
  build(out, {
    curve: 18,
    ribs: 2,
    returns: 0,
    vaultX: 8,
    vaultZ: 6,
    diagonals: 0,
    lattice: 0,
    vents: true,
    slots: false,
  });
}
export function azadiStreet(out) {
  build(out, {
    curve: 32,
    ribs: 4,
    returns: 1,
    vaultX: 16,
    vaultZ: 12,
    diagonals: 4,
    lattice: 24,
    vents: true,
    slots: true,
  });
}
export function azadiCloseup(out) {
  build(out, {
    curve: 56,
    ribs: 10,
    returns: 5,
    vaultX: 24,
    vaultZ: 20,
    diagonals: 9,
    lattice: 48,
    vents: true,
    slots: true,
  });
}
