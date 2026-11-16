/** 'guggenheim_museum_bilbao': Bilbao's mapped gallery masses, flared titanium shells and river atrium. */
import earcut from 'earcut';
import { prism } from './khmer-structure-geometry.mjs';

const simplify = (ring, tolerance) => {
  const p = ring.slice();
  let changed = true;
  while (changed && p.length > 4) {
    changed = false;
    for (let i = 0; i < p.length; i++) {
      const a = p[(i + p.length - 1) % p.length],
        b = p[i],
        c = p[(i + 1) % p.length],
        dx = c[0] - a[0],
        dz = c[1] - a[1],
        u = Math.max(
          0,
          Math.min(1, ((b[0] - a[0]) * dx + (b[1] - a[1]) * dz) / (dx * dx + dz * dz || 1)),
        );
      if (Math.hypot(b[0] - a[0] - dx * u, b[1] - a[1] - dz * u) < tolerance) {
        p.splice(i, 1);
        changed = true;
        break;
      }
    }
  }
  return p;
};

function addEntryStairs(face, beam, detail, site, baseY) {
  const mix = (a, b, t) => a + (b - a) * t;
  const sampleCurve = (curve, t) => {
    const s = t * (curve.length - 1),
      i = Math.floor(s);
    return curve[i].map((v, k) => mix(v, curve[i + 1]?.[k] ?? v, s - i));
  };
  for (const [index, stairs] of [site.main, site.westFlight].entries()) {
    const count = detail > 1 ? stairs.count : [index ? 5 : 8, index ? 14 : 16][detail];
    const strips = index ? 1 : [2, 3, 7, 10][detail];
    const level = (t) => mix(stairs.lo, stairs.hi, t);
    const at = (t, u, y) => {
      const left = sampleCurve(stairs.left, t),
        right = sampleCurve(stairs.right, t);
      const dx = right[0] - left[0],
        dz = right[1] - left[1],
        len = Math.hypot(dx, dz);
      const bow = mix(...stairs.sagitta, t) * 4 * u * (1 - u);
      return [
        mix(left[0], right[0], u) - (dz / len) * bow,
        y,
        mix(left[1], right[1], u) + (dx / len) * bow,
      ];
    };
    for (let step = 0; step < count; step++) {
      const a = step / count,
        b = (step + 1) / count,
        y = level(b);
      for (let j = 0; j < strips; j++) {
        const left = j / strips,
          right = (j + 1) / strips;
        const A = at(a, left, y),
          B = at(a, right, y),
          C = at(b, right, y),
          D = at(b, left, y);
        face('floor', [A, B, C, D], [0, 1, 0]);
        face('floor', [at(a, left, level(a)), at(a, right, level(a)), B, A], [0, 0, -1]);
      }
      for (const side of [0, 1]) {
        const out = at(a, side, y);
        const inside = at(a, 1 - side, y);
        face(
          'stone',
          [at(a, side, baseY), at(b, side, baseY), at(b, side, y), out],
          [out[0] - inside[0], 0, out[2] - inside[2]],
        );
      }
    }
    if (detail) {
      const parts = detail === 1 ? 4 : 14;
      for (const lane of index ? [0.08, 0.92] : [0.065, 0.54, 0.94]) {
        for (let i = 0; i < parts; i++) {
          const a = mix(0.022, 0.98, i / parts),
            b = mix(0.022, 0.98, (i + 1) / parts);
          beam(at(a, lane, level(a) + 1.04), at(b, lane, level(b) + 1.04), 0.061);
          if (detail > 1 || i % 2 === 0)
            beam(at(a, lane, level(a)), at(a, lane, level(a) + 1.04), 0.045);
        }
      }
    }
  }
}

function addBilbaoTerraces(face, beam, detail, site, floorY, baseY) {
  prism(face, 'floor', site.lowerCourt, baseY, floorY - 0.013, detail > 1);
  for (const polygon of site.samples) {
    const rings = [polygon.outline, ...polygon.holes],
      holes = [];
    const points = rings.flat();
    let index = rings[0].length;
    for (const hole of rings.slice(1)) {
      holes.push(index);
      index += hole.length;
    }
    const triangles = earcut(
      points.flatMap(([x, , z]) => [x, z]),
      holes,
    );
    for (let i = 0; i < triangles.length; i += 3) {
      face(
        'floor',
        triangles.slice(i, i + 3).map((k) => points[k]),
        [0, 1, 0],
      );
    }
    for (const [j, ring] of rings.entries()) {
      const area = ring.reduce((s, [x, , z], i) => {
        const [a, , b] = ring[(i + 1) % ring.length];
        return s + x * b - a * z;
      }, 0);
      for (let i = 0; i < ring.length; i++) {
        const a = ring[i],
          b = ring[(i + 1) % ring.length];
        const sign = Math.sign(area) * (j === 0 ? 1 : -1);
        face(
          'stone',
          [[a[0], baseY, a[2]], [b[0], baseY, b[2]], b, a],
          [(b[2] - a[2]) * sign, 0, (a[0] - b[0]) * sign],
        );
      }
    }
  }
  addEntryStairs(face, beam, detail, site, baseY);

  // The glazed lower entrance follows the angled edge of the court below the esplanade.
  const front = site.lowEdge;
  const heads = front.map(([x, z], i) => [
    x,
    floorY + 5.8 + 1.75 * Math.sin((Math.PI * i) / (front.length - 1)),
    z,
  ]);
  const feet = front.map(([x, z]) => [x, floorY, z]);
  const back = ([x, y, z]) => [x + 0.9, y + 0.65, z - 10];
  for (let i = 1; i < front.length; i++) {
    const a = feet[i - 1],
      b = feet[i],
      A = heads[i - 1],
      B = heads[i];
    face('glass', [a, b, B, A], [0, 0, 1]);
    face('metal', [A, B, back(B), back(A)], [0, 1, 0]);
    if (detail) {
      beam(a, A, 0.13);
      beam(A, B, 0.16);
      for (const sill of [2.64, 4.9])
        beam([a[0], floorY + sill, a[2] + 0.055], [b[0], floorY + sill, b[2] + 0.055], 0.079);
    }
  }
  for (const i of [0, front.length - 1]) {
    const a = feet[i],
      p = heads[i],
      q = back(p);
    face('stone', [a, p, q, [q[0], floorY, q[2]]], [i ? 1 : -1, 0, 0]);
  }
  if (detail) {
    beam(feet.at(-1), heads.at(-1), 0.16);
    for (const i of [1, 2, 3]) {
      const [x, , z] = feet[i];
      beam([x + 0.44, floorY, z + 0.15], [x + 0.44, floorY + 2.66, z + 0.15], 0.085);
      beam([x - 0.44, floorY, z + 0.4], [x - 0.44, floorY + 2.66, z + 0.4], 0.085);
    }
  }
}

export function buildBilbao(face, detail, r) {
  const Y = r.floorY,
    tolerance = [3.2, 0.65, 0.12, 0.02][detail],
    cap = (role, ring, up) => {
      const ix = earcut(ring.flatMap((p) => [p[0], p[2]]));
      for (let i = 0; i < ix.length; i += 3)
        face(
          role,
          ix.slice(i, i + 3).map((k) => ring[k]),
          [0, up, 0],
        );
    },
    beam = (a, b, width, role = 'frame') => {
      const axis = b.map((v, k) => v - a[k]),
        L = Math.hypot(...axis),
        n = Math.abs(axis[1]) < L * 0.95 ? [-axis[2], 0, axis[0]] : [1, 0, 0],
        N = Math.hypot(...n),
        u = n.map((v) => ((v / N) * width) / 2),
        v = [
          axis[1] * u[2] - axis[2] * u[1],
          axis[2] * u[0] - axis[0] * u[2],
          axis[0] * u[1] - axis[1] * u[0],
        ].map((v) => v / L),
        ring = (p) =>
          [
            [-1, -1],
            [1, -1],
            [1, 1],
            [-1, 1],
          ].map(([s, t]) => p.map((q, k) => q + s * u[k] + t * v[k])),
        A = ring(a),
        B = ring(b);
      for (let i = 0; i < 4; i++) {
        const j = (i + 1) % 4;
        face(
          role,
          [A[i], A[j], B[j], B[i]],
          A[i].map((q, k) => q - a[k]),
        );
      }
      face(
        role,
        A,
        axis.map((v) => -v),
      );
      face(role, B, axis);
    },
    loft = (poly, role, height, id, lo = Y, flare = true) => {
      const p = simplify(poly.outline, tolerance),
        center = p.reduce((s, q) => s.map((v, k) => v + q[k] / p.length), [0, 0]),
        span = [0, 1].map((k) => Math.max(...p.map((q) => q[k])) - Math.min(...p.map((q) => q[k]))),
        rings = [1, 3, 7, 12][detail],
        sign = id % 2 ? 1 : -1,
        top = ([x, z]) =>
          Y +
          height -
          (flare
            ? Math.max(
                0,
                2.6 +
                  (2.4 * (x - center[0])) / (span[0] || 1) +
                  (sign * 2.1 * (z - center[1])) / (span[1] || 1),
              )
            : 0),
        point = (q, t) => {
          const s = flare ? 0.9 + 0.1 * t + 0.1 * Math.sin(Math.PI * t) : 1;
          return [
            center[0] + (q[0] - center[0]) * s + (flare ? sign * 0.9 * Math.sin(Math.PI * t) : 0),
            lo + (top(q) - lo) * t,
            center[1] + (q[1] - center[1]) * s,
          ];
        },
        levels = Array.from({ length: rings + 1 }, (_, j) => p.map((q) => point(q, j / rings))),
        area = p.reduce((s, a, i) => {
          const b = p[(i + 1) % p.length];
          return s + a[0] * b[1] - a[1] * b[0];
        }, 0),
        sgn = Math.sign(area);
      for (let j = 1; j < levels.length; j++)
        for (let i = 0; i < p.length; i++) {
          const k = (i + 1) % p.length,
            n = [(p[k][1] - p[i][1]) * sgn, 0.001, (p[i][0] - p[k][0]) * sgn];
          face(role, [levels[j - 1][i], levels[j - 1][k], levels[j][k], levels[j][i]], n);
        }
      cap(role, levels.at(-1), 1);
      if (detail) cap(role, levels[0], -1);
      return { p, top, point };
    };
  for (const p of r.site.occupiedFloors)
    prism(
      face,
      'floor',
      {
        outline: simplify(p.outline, tolerance),
        holes: p.holes.map((h) => simplify(h, tolerance)),
      },
      r.foundationY,
      Y,
      detail > 0,
    );
  // The continuous low gallery follows the irregular parent, including its long east arm.
  for (const p of r.site.lowerBodies)
    prism(
      face,
      'metal',
      {
        outline: simplify(p.outline, tolerance),
        holes: p.holes.map((h) => simplify(h, tolerance)),
      },
      Y,
      Y + 11,
      detail > 0,
    );
  addBilbaoTerraces(face, beam, detail, r.site, Y, r.foundationY);
  const stoneIds = new Set([
    118500240, 118500243, 118500249, 118500252, 118500255, 118501682, 118501684, 118506777,
    118506963, 118507297, 118507299,
  ]);
  for (const part of r.parts) {
    const id = part.id - 35184372088832,
      stone = stoneIds.has(id) || part.polygons[0].outline.every((q) => q[1] > 20),
      role = id === 118506013 ? 'glass' : stone ? 'stone' : 'metal';
    for (const poly of part.polygons) {
      const shell = loft(poly, role, part.height, id, Y, !stone);
      if (stone && detail) {
        const p = shell.p;
        cap(
          'roof',
          p.map(([x, z]) => [x, Y + part.height + 0.035, z]),
          1,
        );
        for (let i = 0; i < p.length; i++) {
          const a = p[i],
            b = p[(i + 1) % p.length],
            L = Math.hypot(b[0] - a[0], b[1] - a[1]);
          if (L < 12 || i % 3) continue;
          const n = [(b[1] - a[1]) / L, -(b[0] - a[0]) / L],
            U = [(b[0] - a[0]) / L, (b[1] - a[1]) / L],
            x = (a[0] + b[0]) / 2 + n[0] * 0.05,
            z = (a[1] + b[1]) / 2 + n[1] * 0.05,
            w = Math.min(4, L * 0.2),
            h = detail === 1 ? 1.2 : 1.7;
          face(
            'glass',
            [
              [-w / 2, 0],
              [w / 2, 0],
              [w / 2, h],
              [-w / 2, h],
            ].map(([u, v]) => [x + U[0] * u, Y + part.height - 4 + v, z + U[1] * u]),
            [n[0], 0, n[1]],
          );
        }
      }
    }
  }
  // Two swept, pointed gallery fins are integral to the long eastern museum wing.
  for (const lane of [0, 1]) {
    const N = [4, 7, 15, 25][detail],
      lower = [],
      upper = [],
      back = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N,
        x = 3 + 111 * t,
        z = -19 + 31 * t + lane * 13;
      lower.push([x, Y + 11, z]);
      upper.push([x, Y + 18 + 4 * t + 2 * Math.sin(Math.PI * t), z - 3 * Math.sin(Math.PI * t)]);
      back.push([x, Y + 11, z + 8]);
    }
    for (let i = 0; i < N; i++) {
      face('metal', [lower[i], lower[i + 1], upper[i + 1], upper[i]], [0, 0, -1]);
      face('metal', [upper[i], upper[i + 1], back[i + 1], back[i]], [0, 1, 0.5]);
      face('metal', [back[i], back[i + 1], lower[i + 1], lower[i]], [0, -1, 0]);
    }
    face('metal', [lower[0], upper[0], back[0]], [-1, 0, 0]);
    face('metal', [lower.at(-1), upper.at(-1), back.at(-1)], [1, 0, 0]);
  }
  // Independently mapped raised canopy. Ground below the canopy is never removed.
  const canopy = simplify(r.roof.outline, tolerance),
    c = canopy.reduce((s, p) => s.map((v, k) => v + p[k] / canopy.length), [0, 0]),
    roofPoint = ([x, z], drop = 0) => [
      x,
      Y + 21.8 + 2.2 * Math.sin(((x + 33) / 29) * Math.PI) - drop,
      z,
    ];
  cap(
    'metal',
    canopy.map((q) => roofPoint(q)),
    1,
  );
  if (detail)
    cap(
      'frame',
      canopy.map((q) => roofPoint(q, 0.32)),
      -1,
    );
  for (let i = 0; i < canopy.length; i++) {
    const j = (i + 1) % canopy.length,
      a = canopy[i],
      b = canopy[j];
    face(
      'metal',
      [roofPoint(a), roofPoint(b), roofPoint(b, 0.32), roofPoint(a, 0.32)],
      [a[0] - c[0], 0, a[1] - c[1]],
    );
  }
  // Glazed river atrium and its sloping mullions; dark opaque glass avoids sorting cost.
  const A = [-32, -44],
    B = [-9, -35],
    N = detail ? [4, 7, 11][detail - 1] : 1;
  for (let i = 0; i < N; i++) {
    const u = i / N,
      v = (i + 1) / N,
      pt = (t, y) => [A[0] + (B[0] - A[0]) * t, y, A[1] + (B[1] - A[1]) * t],
      top = (t) => Y + 20.8 + 2.8 * Math.sin(Math.PI * t),
      a = pt(u, Y),
      b = pt(v, Y),
      a1 = pt(u, top(u)),
      b1 = pt(v, top(v));
    face('glass', [a, b, b1, a1], [0.3, 0, -1]);
    if (detail) beam(a, a1, detail === 1 ? 0.22 : 0.15);
  }
  if (detail) {
    for (const y of [5, 10, 15, 20])
      beam([A[0], Y + y, A[1] - 0.06], [B[0], Y + y, B[1] - 0.06], 0.14);
    beam([-11, Y, -42], [-14, Y + 21.7, -41], 0.65, 'stone');
    for (const side of [0, 1])
      beam(
        [A[0] + side * 23, Y, A[1] + side * 9],
        [A[0] + side * 23, Y + 21, A[1] + side * 9],
        0.3,
      );
    // The entry follows the parent's actual exposed gallery edge. No detached facade.
    const E = [-48.679829996, 56.827049899],
      F = [-45.201242118, 70.741532391],
      dx = F[0] - E[0],
      dz = F[1] - E[1],
      len = Math.hypot(dx, dz),
      nx = -dz / len,
      nz = dx / len,
      ep = (p, y) => [p[0] + nx * 0.09, y, p[1] + nz * 0.09];
    face('glass', [ep(E, Y), ep(F, Y), ep(F, Y + 15), ep(E, Y + 18)], [nx, 0, nz]);
    for (const [p, h] of [
      [E, 18],
      [F, 15],
    ])
      beam(ep(p, Y), ep(p, Y + h), 0.22);
    for (const y of [4, 8, 12]) beam(ep(E, Y + y), ep(F, Y + y), 0.13);
    // Small high lantern glazing differentiates the crown from the metallic lobes.
    const crown = r.parts.find((p) => p.height === 41);
    if (crown)
      for (const p of crown.polygons) {
        const q = p.outline;
        for (let i = 0; i < q.length; i++) {
          const a = q[i],
            b = q[(i + 1) % q.length],
            n = [b[1] - a[1], 0, a[0] - b[0]];
          face(
            'glass',
            [
              [a[0], Y + 37, a[1]],
              [b[0], Y + 37, b[1]],
              [b[0], Y + 40, b[1]],
              [a[0], Y + 40, a[1]],
            ],
            n,
          );
          beam([a[0], Y + 37, a[1]], [a[0], Y + 40, a[1]], 0.18);
        }
      }
  }
}
