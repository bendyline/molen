/** Beijing National Stadium: final as-built roof topology, open steel skin and red concrete bowl. */
import { beam, cross, loft, normalize } from './authored-structure-mesh.mjs';
import { birdsNestPlan } from './birds-nest-plan.mjs';
import { transformed } from './lighthouse-models.mjs';
import { chair, curve, face, soccerPitch } from './stadium-models.mjs';
import { box } from './structure-mesh.mjs';

const TAU = Math.PI * 2;
const steel = [0.69, 0.71, 0.68],
  red = [0.51, 0.028, 0.022],
  concrete = [0.53, 0.55, 0.51];
const white = [0.86, 0.88, 0.85],
  dark = [0.055, 0.066, 0.067];
const E = (rx, rz, a, y = 0) => [rx * Math.sin(a), y, rz * Math.cos(a)];
const rx = 149,
  rz = 166.5,
  ix = 62,
  iz = 91;
const roofY = (x, z) => 55 + 13 * (x / rx) ** 2 - 14 * (z / rz) ** 2;
const roofNormal = (p) => normalize([(-26 * p[0]) / rx ** 2, 1, (28 * p[2]) / rz ** 2]);
function facade(a, t, depth = 0) {
  const s = 0.9 + 0.1 * Math.sin((t * Math.PI) / 2) + 0.035 * Math.sin(t * Math.PI);
  return [
    (rx * s - depth) * Math.sin(a),
    roofY(rx * Math.sin(a), rz * Math.cos(a)) * t,
    (rz * s - depth) * Math.cos(a),
  ];
}
const facadeNormal = (p) => normalize([p[0] / rx ** 2, -0.1 / rz, p[2] / rz ** 2]);

/** Continuous square-section sweep; frame follows the skin so bends do not become overlapping boxes. */
function ribbon(out, points, width = 1.2, depth = 1.2, normal = roofNormal, color = steel) {
  const rings = points.map((p, i) => {
    const prev = points[Math.max(0, i - 1)],
      next = points[Math.min(points.length - 1, i + 1)];
    const axis = normalize(next.map((v, k) => v - prev[k]));
    const across = normalize(cross(axis, normal(p))),
      other = cross(axis, across);
    return [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ].map(([u, v]) =>
      p.map((x, k) => x + (across[k] * u * width) / 2 + (other[k] * v * depth) / 2),
    );
  });
  loft(out, 'metal', rings, color);
}
function annulus(out, inner, outer, y, color = concrete, slot = 'concrete', n = 360) {
  for (let i = 0; i < n; i++) {
    const a = (i * TAU) / n,
      b = ((i + 1) * TAU) / n;
    face(out, slot, [inner(a, y), inner(b, y), outer(b, y), outer(a, y)], color, [0, 1, 0]);
  }
}
function rail(out, fn, y = 0, color = steel) {
  const pts = Array.from({ length: 361 }, (_, i) => {
    const p = fn((i * TAU) / 360);
    return [p[0], p[1] + y + 1.05, p[2]];
  });
  curve(out, pts, 0.038, color);
  for (let i = 0; i < 144; i++) {
    const p = fn((i * TAU) / 144);
    beam(out, 'metal', [p[0], p[1] + y, p[2]], [p[0], p[1] + y + 1.08, p[2]], 0.036, 0.036, color);
  }
}
function wall(out, fn, y0, y1, color = concrete, inside = false, n = 360) {
  for (let i = 0; i < n; i++) {
    const a = (i * TAU) / n,
      b = ((i + 1) * TAU) / n,
      p = fn(a),
      q = fn(b),
      dir = inside ? -1 : 1;
    face(
      out,
      'concrete',
      [
        [p[0], y0, p[2]],
        [q[0], y0, q[2]],
        [q[0], y1, q[2]],
        [p[0], y1, p[2]],
      ],
      color,
      [dir * Math.sin(a), 0, dir * Math.cos(a)],
    );
  }
}
function floor(out, fn, y, color, slot = 'concrete') {
  for (let i = 0; i < 360; i++)
    out.addTriangle(
      slot,
      'palette:#ffffff',
      [[0, y, 0], fn((i * TAU) / 360, y), fn(((i + 1) * TAU) / 360, y)],
      [0, 1, 0],
      [
        [0, 0],
        [1, 0],
        [0, 1],
      ],
      color,
    );
}
function roofSkin(out) {
  for (let i = 0; i < 360; i++)
    for (let j = 0; j < 12; j++) {
      const point = (a, t, under = false) => {
        const x = (ix + (rx - ix) * t) * Math.sin(a),
          z = (iz + (rz - iz) * t) * Math.cos(a);
        return [x, roofY(x, z) - (under ? 12.3 : 0.25), z];
      };
      const a = (i * TAU) / 360,
        b = ((i + 1) * TAU) / 360,
        t = j / 12,
        u = (j + 1) / 12;
      // Upper ETFE and lower acoustic PTFE are separate surfaces with the full truss depth between.
      face(
        out,
        'etfeClear',
        [point(a, t), point(b, t), point(b, u), point(a, u)],
        white,
        [0, 1, 0],
      );
      face(
        out,
        'membrane',
        [point(a, t, true), point(b, t, true), point(b, u, true), point(a, u, true)],
        white,
        [0, -1, 0],
      );
      // The opaque lower acoustic skin must also be visible through the clear upper ETFE.
      face(
        out,
        'membrane',
        [point(a, t, true), point(b, t, true), point(b, u, true), point(a, u, true)],
        white,
        [0, 1, 0],
      );
    }
  // A fine cable ring supports the acoustic membrane at the final enlarged opening.
  curve(
    out,
    Array.from({ length: 361 }, (_, i) => {
      const p = E(ix, iz, (i * TAU) / 360);
      return [p[0], roofY(p[0], p[2]) - 12.2, p[2]];
    }),
    0.095,
    steel,
  );
}
function roofTrusses(out) {
  // The final roof uses fixed crossed tangent trusses around its enlarged 182x124m opening.
  // Each construction line follows the measured saddle; this is the published topology, not the discarded retractable roof.
  for (let i = 0; i < 24; i++) {
    const a = (i * TAU) / 24,
      p = E(rx, rz, a);
    const angle =
      Math.atan2(p[0] / ix, p[2] / iz) + Math.acos(1 / Math.hypot(p[0] / ix, p[2] / iz));
    const q = E(ix, iz, angle),
      d = [q[0] - p[0], q[2] - p[2]];
    const length =
      (-2 * ((p[0] * d[0]) / rx ** 2 + (p[2] * d[1]) / rz ** 2)) /
      (d[0] ** 2 / rx ** 2 + d[1] ** 2 / rz ** 2);
    const end = [p[0] + d[0] * length, p[2] + d[1] * length];
    const top = Array.from({ length: 61 }, (_, k) => {
      const t = k / 60,
        x = p[0] + (end[0] - p[0]) * t,
        z = p[2] + (end[1] - p[2]) * t;
      return [x, roofY(x, z) + 0.38, z];
    });
    const lower = top.map((v) => [v[0], v[1] - 12, v[2]]);
    ribbon(out, top, 1.2, 1.2);
    ribbon(out, lower, 1.2, 1.2);
    for (let k = 0; k < 12; k++) {
      const j = k * 5;
      beam(out, 'metal', top[j], lower[j + 5], 0.62, 0.62, steel);
      if (k % 2 === 0) beam(out, 'metal', lower[j], top[j + 5], 0.62, 0.62, steel);
    }
  }
  // Secondary surface intersection lines, rotated in three prescribed families as in the engineer's envelope method.
  for (const angle of [0.31, 1.17, 2.34])
    for (let offset = -144; offset <= 144; offset += 18) {
      const dx = Math.cos(angle),
        dz = Math.sin(angle),
        nx = -dz,
        nz = dx;
      let segment = [];
      const flush = () => {
        if (segment.length > 1) ribbon(out, segment, 1.2, 1.2);
        segment = [];
      };
      for (let t = -235; t <= 235; t += 2) {
        const x = nx * offset + dx * t,
          z = nz * offset + dz * t;
        const valid = (x / rx) ** 2 + (z / rz) ** 2 < 0.985 && (x / ix) ** 2 + (z / iz) ** 2 > 1.02;
        if (valid) segment.push([x, roofY(x, z) + 0.26, z]);
        else flush();
      }
      flush();
    }
  for (let i = 0; i < 72; i++) {
    const a = (i * TAU) / 72,
      p = E(ix + 0.8, iz + 0.8, a),
      y = roofY(p[0], p[2]) - 12.75,
      o = transformed(out, a, [p[0], y, p[2]]);
    box(o, 'metal', [-0.42, -0.34, -0.45], [0.42, 0.34, 0.15], steel);
    box(o, 'plastic', [-0.35, -0.28, -0.47], [0.35, 0.28, -0.45], [0.92, 0.94, 0.83]);
  }
}
function externalSkin(out) {
  // Twenty-four diamond/leaf column trusses are the primary supports.
  for (let i = 0; i < 24; i++) {
    const a = (i * TAU) / 24;
    for (const side of [-1, 1]) {
      const points = Array.from({ length: 49 }, (_, k) => {
        const t = k / 48;
        return facade(a + side * 0.063 * Math.sin(Math.PI * t), t);
      });
      ribbon(out, points, 1.2, 1.2, facadeNormal);
    }
    const back = Array.from({ length: 33 }, (_, k) => facade(a, k / 32, 10));
    ribbon(out, back, 1.2, 1.2, facadeNormal);
    for (let k = 0; k < 6; k++) {
      const t = k / 6,
        u = (k + 1) / 6;
      for (const side of [-1, 1]) {
        const p = facade(a + side * 0.063 * Math.sin(Math.PI * t), t),
          q = facade(a - side * 0.063 * Math.sin(Math.PI * u), u);
        beam(out, 'metal', p, q, 1.2, 1.2, steel);
        beam(out, 'metal', p, facade(a, u, 10), 1.2, 1.2, steel);
      }
    }
  }
  // Continuous secondary strips rise obliquely across more than one bay; no opaque facade skin.
  for (let i = 0; i < 40; i++)
    for (const sign of [-1, 1]) {
      const a = (i * TAU) / 40;
      const points = Array.from({ length: 65 }, (_, k) => {
        const t = k / 64,
          az = a + sign * (0.16 * t + 0.38 * Math.sin((t * Math.PI) / 2));
        return facade(az, t, -0.1);
      });
      ribbon(out, points, 1.2, 1.2, facadeNormal);
    }
  // Circumferential pieces follow the changing surface instead of flat horizontal hoops.
  for (let row = 0; row < 4; row++)
    for (let i = 0; i < 12; i++) {
      const points = Array.from({ length: 33 }, (_, j) => {
        const a = ((i + j / 32) * TAU) / 12,
          t = 0.16 + row * 0.2 + 0.075 * Math.sin(a * 3 + row * 1.4);
        return facade(a, t, -0.14);
      });
      ribbon(out, points, 1.2, 1.2, facadeNormal);
    }
}
function publicStairs(out) {
  for (let i = 0; i < 24; i++) {
    const start = (i * TAU) / 24 + 0.04;
    for (let flight = 0; flight < 4; flight++) {
      const y0 = flight * 7.25,
        y1 = y0 + 7.25;
      const a0 = start + (flight % 2 === 0 ? -0.073 : 0.073),
        a1 = start + (flight % 2 === 0 ? 0.073 : -0.073);
      const point = (t) => {
        const a = a0 + (a1 - a0) * t,
          y = y0 + (y1 - y0) * t,
          p = facade(a, y / (41 + 27 * Math.sin(a) ** 2), 6.2);
        return [p[0], y, p[2]];
      };
      const path = Array.from({ length: 45 }, (_, j) => point(j / 44));
      for (let j = 0; j < 44; j++) {
        const p = path[j],
          q = path[j + 1],
          a = Math.atan2(p[0], p[2]),
          o = transformed(out, a, p);
        box(o, 'concrete', [-0.43, 0, -1.7], [0.43, 0.17, 1.7], concrete);
        if (j % 3 === 0)
          for (const side of [-1, 1]) {
            const s = 1.72 * side,
              dx = Math.sin(a) * s,
              dz = Math.cos(a) * s;
            beam(
              out,
              'metal',
              [p[0] + dx, p[1] + 0.15, p[2] + dz],
              [p[0] + dx, p[1] + 1.22, p[2] + dz],
              0.04,
              0.04,
              steel,
            );
          }
        for (const side of [-1, 1]) {
          const shift = (r) => {
            const ar = Math.atan2(r[0], r[2]);
            return [
              r[0] + Math.sin(ar) * 1.72 * side,
              r[1] + 1.22,
              r[2] + Math.cos(ar) * 1.72 * side,
            ];
          };
          curve(out, [shift(p), shift(q)], 0.044, steel);
        }
      }
      for (const side of [-1, 1])
        ribbon(
          out,
          path.map((p) => {
            const a = Math.atan2(p[0], p[2]);
            return [p[0] + Math.sin(a) * 1.72 * side, p[1] - 0.6, p[2] + Math.cos(a) * 1.72 * side];
          }),
          1.2,
          1.2,
          facadeNormal,
        );
      const p = point(1),
        a = Math.atan2(p[0], p[2]),
        o = transformed(out, a, p);
      box(o, 'concrete', [-3.1, -0.3, -2.7], [3.1, 0.05, 2.7], concrete);
    }
  }
}
function bowl(out) {
  // The external concrete bowl is the distinctive deep red inner element behind the unglazed steel lattice.
  for (let i = 0; i < 360; i++) {
    const a = (i * TAU) / 360,
      b = ((i + 1) * TAU) / 360,
      ya = 31 + 15 * Math.sin(a) ** 2,
      yb = 31 + 15 * Math.sin(b) ** 2;
    face(
      out,
      'concrete',
      [E(113, 147, a, 0), E(113, 147, b, 0), E(125, 153, b, yb), E(125, 153, a, ya)],
      red,
      [Math.sin(a), 0, Math.cos(a)],
    );
  }
  for (const y of [0, 7.25, 14.5, 21.75, 29]) {
    const s = 0.94 + y * 0.0012;
    // Solid promenade slabs have real openings for the alternating stair flights.
    const inner = (a, h) => E(113, 147, a, h),
      outer = (a, h) => E(rx * s, rz * s, a, h),
      stairEdge = (depth) => (a, h) => {
        const p = facade(a, y / (41 + 27 * Math.sin(a) ** 2), depth),
          lo = inner(a, h),
          hi = outer(a, h),
          delta = [hi[0] - lo[0], hi[2] - lo[2]],
          t = Math.max(
            0.02,
            Math.min(
              0.98,
              ((p[0] - lo[0]) * delta[0] + (p[2] - lo[2]) * delta[1]) /
                (delta[0] ** 2 + delta[1] ** 2),
            ),
          );
        return [lo[0] + t * delta[0], h, lo[2] + t * delta[1]];
      };
    for (let i = 0; i < 720; i++) {
      const a = (i * TAU) / 720,
        b = ((i + 1) * TAU) / 720,
        middle = (a + b) / 2,
        offset = ((middle - 0.04 + TAU + TAU / 48) % (TAU / 24)) - TAU / 48;
      const ranges =
        y && Math.abs(offset) < 0.098
          ? [
              [inner, stairEdge(8.6)],
              [stairEdge(3.8), outer],
            ]
          : [[inner, outer]];
      for (const [inside, outside] of ranges) {
        const top = [inside(a, y), inside(b, y), outside(b, y), outside(a, y)],
          bottom = top.map((p) => [p[0], y - 0.3, p[2]]);
        face(out, 'concrete', top, concrete, [0, 1, 0]);
        face(out, 'concrete', bottom, concrete, [0, -1, 0]);
        for (const k of [0, 2]) {
          const next = (k + 1) % 4,
            dx = top[next][0] - top[k][0],
            dz = top[next][2] - top[k][2];
          face(out, 'concrete', [bottom[k], bottom[next], top[next], top[k]], concrete, [
            dz,
            0,
            -dx,
          ]);
        }
      }
    }
    rail(out, (a) => E(rx * s, rz * s, a, y), 0, steel);
    for (let i = 0; i < 72; i++) {
      const a = (i * TAU) / 72;
      const wallPoint = (angle, height) => {
        const t = height / (31 + 15 * Math.sin(angle) ** 2);
        return E(113 + 12 * t + 0.065, 147 + 6 * t + 0.065, angle, height);
      };
      const da = 1.5 / 130;
      face(
        out,
        'glass',
        [
          wallPoint(a - da, y + 0.2),
          wallPoint(a + da, y + 0.2),
          wallPoint(a + da, y + 3.6),
          wallPoint(a - da, y + 3.6),
        ],
        dark,
        [Math.sin(a), 0, Math.cos(a)],
      );
    }
  }
  const tiers = [
    { x: 53, z: 100, y: -4.25, rows: 28, run: 0.8, rise: 0.35 },
    { x: 76, z: 120, y: 8.2, rows: 25, run: 0.81, rise: 0.49 },
    { x: 96, z: 136, y: 22.8, rows: 36, run: 0.75, rise: 0.59 },
  ];
  for (let tier = 0; tier < tiers.length; tier++) {
    const t = tiers[tier];
    for (let row = 0; row < t.rows; row++) {
      const x = t.x + row * t.run,
        z = t.z + row * t.run * 0.68,
        y = t.y + row * t.rise;
      const allowed = (a) => tier !== 2 || row < 13 + 23 * Math.sin(a) ** 2;
      for (let i = 0; i < 480; i++) {
        const a = (i * TAU) / 480,
          b = ((i + 1) * TAU) / 480;
        if (!allowed((a + b) / 2)) continue;
        face(
          out,
          'concrete',
          [
            E(x, z, a, y),
            E(x, z, b, y),
            E(x + t.run, z + t.run * 0.68, b, y),
            E(x + t.run, z + t.run * 0.68, a, y),
          ],
          concrete,
          [0, 1, 0],
        );
        face(
          out,
          'concrete',
          [E(x, z, a, y - t.rise), E(x, z, b, y - t.rise), E(x, z, b, y), E(x, z, a, y)],
          concrete,
          [-Math.sin(a), 0, -Math.cos(a)],
        );
      }
      const count = Math.round((TAU * Math.sqrt((x * x + z * z) / 2)) / 0.55);
      for (let j = 0; j < count; j++) {
        const a = (j * TAU) / count;
        if (!allowed(a) || Math.abs((a / TAU) * 48 - Math.round((a / TAU) * 48)) < 0.06) continue;
        const blend = Math.min(1, Math.max(0, (y + 5) / 48)),
          patch = (Math.sin(j * 9.23 + row * 13.7 + tier * 3.1) + 1) / 2;
        const color = patch < blend * 0.84 ? white : [0.72, 0.032, 0.024];
        chair(out, Math.atan2(x * Math.sin(a), z * Math.cos(a)), E(x + 0.3, z + 0.22, a, y), color);
      }
    }
    rail(out, (a) => E(t.x, t.z, a, t.y));
    for (let i = 0; i < 36; i++) {
      const a = ((i + 0.5) * TAU) / 36,
        row = tier === 2 ? 8 + 10 * Math.sin(a) ** 2 : t.rows * 0.58,
        y = t.y + row * t.rise;
      const p = E(t.x + row * t.run, t.z + row * t.run * 0.68, a, y),
        o = transformed(out, a, p);
      box(o, 'glass', [-1.5, 0.05, -0.25], [1.5, 1.85, 0.2], dark);
      box(o, 'concrete', [-1.62, 1.85, -0.35], [1.62, 2.05, 0.3], red);
    }
    // Red band and enclosed suite fascia close the exposed underside between tiers.
    if (tier) {
      const prev = tiers[tier - 1],
        px = prev.x + prev.rows * prev.run,
        pz = prev.z + prev.rows * prev.run * 0.68,
        py = prev.y + prev.rows * prev.rise;
      for (let i = 0; i < 360; i++) {
        const a = (i * TAU) / 360,
          b = ((i + 1) * TAU) / 360;
        face(
          out,
          'concrete',
          [E(px, pz, a, py), E(px, pz, b, py), E(t.x, t.z, b, t.y), E(t.x, t.z, a, t.y)],
          red,
          [-Math.sin(a), 0, -Math.cos(a)],
        );
      }
    }
  }
  wall(out, (a) => E(53, 100, a), -5.04, -4.25, concrete, true);
  floor(out, (a, y) => E(53, 100, a, y), -5.04, [0.4, 0.16, 0.115], 'plastic');
  soccerPitch(transformed(out, 0, [0, -5, 0]));
  const track = (a, r, y) => [
    r * Math.sin(a),
    y,
    Math.sign(Math.cos(a)) * 42.195 + r * Math.cos(a),
  ];
  annulus(
    out,
    (a, y) => track(a, 36.8, y),
    (a, y) => track(a, 46.56, y),
    -4.965,
    [0.42, 0.13, 0.09],
    'plastic',
    720,
  );
  // Eight 1.22m lanes surrounding a 400m reference oval.
  for (let lane = 0; lane < 9; lane++) {
    const r = 36.8 + lane * 1.22;
    curve(
      out,
      Array.from({ length: 721 }, (_, i) => track((i * TAU) / 720, r, -4.93)),
      0.025,
      white,
      'plastic',
      4,
    );
  }
  for (const side of [-1, 1]) {
    const o = transformed(out, side < 0 ? 0 : Math.PI, [0, 0, side * 147]);
    box(o, 'metal', [-12, 25, -0.65], [12, 34.8, 0.25], steel);
    box(o, 'glass', [-11.6, 25.4, 0.26], [11.6, 34.4, 0.32], [0.018, 0.024, 0.026]);
  }
}
export function buildBirdsNest(out) {
  // The footprint ring protects terrain-cut boundaries; the enclosed bowl floor remains below it.
  annulus(
    out,
    (a, y) => E(rx * 0.87, rz * 0.87, a, y),
    (a, y) => E(rx * 0.926, rz * 0.926, a, y),
    0,
    concrete,
  );
  bowl(out);
  publicStairs(out);
  externalSkin(out);
  roofSkin(out);
  roofTrusses(out);
}
export const birdsNestStudy = {
  id: 'N0686',
  key: 'beijing_national_stadium',
  title: 'Beijing National Stadium',
  wikidataId: 'Q133525',
  build: buildBirdsNest,
  metricTriangleUv: true,
  smoothNormalSlots: [],
  previewGroundless: true,
  previewCamera: { position: [225, 137, 271], lookAt: [0, 24, 0] },
  visualBrief:
    'Bird’s Nest as built: 24 diamond column trusses, continuous pale-gray square steel bands wrapping an unglazed saddle surface, enlarged fixed oval roof with ETFE above and acoustic PTFE below, red concrete bowl and public stairs visible through the lattice, three tiers of red-to-pale seating, running track, sunken field and opposing screens.',
  size: [303, 75, 337],
  nativeAxes: {
    up: '+Y',
    front: '+Z',
    origin:
      'Exact mapped pitch polygon area centroid; native +Z is the southward playing axis. Native Y0 is the structural plaza; field Y-5 is a section-scaled relative grade.',
  },
  sourceFacts: {
    basis:
      'The Beijing construction chronicle records final333x298m envelope,68m east/west crests,41m north/south valleys,182x124m aperture and24truss columns. The Arup Journal1/2009 documents1.2m square facade members,12m truss depth,24support nodes, continuous surface-plane secondary geometry, staircase integration, red concrete bowl and ETFE/PTFE layers. Its page21 final revision explicitly removes the earlier retractable roof. Current exact-QID OSM footprint is approximately303x331m; map pitch geometry supplies anchor/axis while published structural dimensions supply the envelope. Ground-to-field offset is reconstructed from the engineer section; underground7.1m floor height is not misrepresented as pitch depth.',
  },
  referencePages: [
    'https://www.arup.com/globalassets/downloads/arup-journal/the-arup-journal-2009-issue-1.pdf',
    'https://www.arup.com/en-us/projects/chinese-national-stadium/',
    'https://zjw.beijing.gov.cn/bjjs/gcjs/sznj/zjcg/sz/10934391/2021020215501747435.pdf',
    'https://www.herzogdemeuron.com/projects/226-national-stadium/',
    'https://www.openstreetmap.org/way/152301551',
    'https://www.openstreetmap.org/relation/3511226',
  ],
  referenceRights:
    'Original deterministic mesh informed by primary architect/engineer references; no photograph pixels or third-party model embedded. OpenStreetMap projected outline and pitch are attributed to contributors under ODbL1.0.',
  portableReviewBasis:
    'Ground-free asset review preserves the below-plaza field. Geographic fixture must cut terrain and verify restoration.',
  geographicProposal: {
    status: 'preview-proposal',
    elevationMode: 'terrain-contact',
    anchor: birdsNestPlan.anchor,
    heading: birdsNestPlan.heading,
    groundModelY: 0,
    groundContactReviewed: true,
    groundContactBasis:
      'Native Y0 represents column feet and structural plaza; fieldY-5 is proportioned from the published engineer section. This is a local architectural contact datum, not an absolute surveyed height.',
    source: 'https://www.openstreetmap.org/way/152301551',
    featureIds: ['way/152301551', 'relation/563404', 'relation/3511226'],
    groundCutout: {
      outline: Array.from({ length: 120 }, (_, i) => {
        const p = E(rx * 0.912, rz * 0.912, (i * TAU) / 120);
        return [p[0], p[2]];
      }),
      basis:
        'Remove terrain inside the structural plaza perimeter so the athletics floor remains below grade. The modeled perimeter slab conceals the cut edge.',
    },
    notes:
      'Pitch area centroid avoids the bias from uneven OSM vertex subdivision. Heading follows the long mapped pitch edge with +Z south. Published as-built dimensions govern the envelope; the hand-mapped footprint differs by roughly2.5m per east/west side. North/south axis ambiguity is resolved with mapped goal direction and architect plan.',
  },
  limitations: [
    'This is an architectural reconstruction of the final fixed-roof exterior, not a shop-drawing inventory of every welded junction. Secondary steel plane families, connection phase and stair flights preserve the designer’s construction logic but are reconstructed from the published drawings/photos. Individual seat counts, temporary event overlays and inaccessible service interiors are excluded. Native field grade is scaled from the engineer section; the7.1m basement story is a separate published dimension. The open red concrete bowl, gray1.2m bands,24leaf supports and saddle envelope are explicit mesh geometry.',
  ],
  importOptions: { optimize: false },
  qaCameras: [
    { name: 'near-open-steel-skin', position: [191, 21, 31], lookAt: [130, 28, 8] },
    { name: 'near-leaf-support', position: [157, 9, 70], lookAt: [130, 22, 54] },
    { name: 'near-public-stairs', position: [157, 8, 24], lookAt: [132, 11, 3] },
    { name: 'near-tangent-roof', position: [118, 96, 94], lookAt: [80, 47, 60] },
    { name: 'near-three-tier-bowl', position: [0, 5, 20], lookAt: [104, 20, 0] },
    { name: 'near-oval-track', position: [24, 57, 61], lookAt: [0, -4, 23] },
    { name: 'far-saddle', position: [-230, 190, 262], lookAt: [0, 25, 0] },
  ],
};
