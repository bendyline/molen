/** broch_of_gurness: present-day roofless broch and surviving settlement wall fragments. */
import earcut from 'earcut';
import { box, prism } from './khmer-structure-geometry.mjs';

export function buildGurnessMasonry(face, detail, r, sample) {
  const f = (role, ps, n) =>
      face(
        role,
        ps.map(([x, y, z]) => [x, y + r.floorY, z]),
        n,
      ),
    warp = ([x, z], y) => {
      const k = 1 - 0.012 * Math.max(0, y);
      return [r.center[0] + (x - r.center[0]) * k, y, r.center[1] + (z - r.center[1]) * k];
    },
    profile = ([x, z]) => {
      const a = Math.atan2(z - r.center[1], x - r.center[0]);
      return (
        3.25 +
        0.35 * Math.sin(3 * a) +
        0.2 * Math.cos(7 * a) -
        0.8 * Math.max(0, 1 - Math.abs(a - 1.1) / 0.6)
      );
    },
    volume = (polys, lo, hi) => {
      for (const p of polys) {
        const rings = [p.outline, ...p.holes],
          flat = rings.flat(),
          starts = [];
        let count = rings[0].length;
        for (const h of rings.slice(1)) {
          starts.push(count);
          count += h.length;
        }
        const ix = earcut(flat.flat(), starts),
          bottom = flat.map((p) => warp(p, lo)),
          top = flat.map((p) => warp(p, typeof hi === 'function' ? hi(p) : hi));
        for (let i = 0; i < ix.length; i += 3) {
          f(
            'wall',
            ix.slice(i, i + 3).map((k) => bottom[k]),
            [0, -1, 0],
          );
          f(
            'wall',
            ix.slice(i, i + 3).map((k) => top[k]),
            [0, 1, 0],
          );
        }
        let offset = 0;
        for (let k = 0; k < rings.length; k++) {
          const ring = rings[k],
            sign =
              Math.sign(
                ring.reduce(
                  (s, p, i) =>
                    s +
                    p[0] * ring[(i + 1) % ring.length][1] -
                    p[1] * ring[(i + 1) % ring.length][0],
                  0,
                ),
              ) * (k ? -1 : 1);
          for (let i = 0; i < ring.length; i++) {
            const j = (i + 1) % ring.length;
            f(
              'wall',
              [bottom[offset + i], bottom[offset + j], top[offset + j], top[offset + i]],
              [(ring[j][1] - ring[i][1]) * sign, 0, (ring[i][0] - ring[j][0]) * sign],
            );
          }
          offset += ring.length;
        }
      }
    };
  volume(r.layers.low, r.bottomY - r.floorY, r.lintelY);
  if (detail === 0) volume(r.layers.middle, r.lintelY, profile);
  else {
    volume(r.layers.middle, r.lintelY, r.galleryFloor);
    volume(r.layers.high, r.galleryFloor, profile);
  }
  // A bounded gravel courtyard covers only the known hole, without a terrain cutout.
  prism(f, 'gravel', { outline: r.inner }, -0.16, 0.025);
  // A supported, narrow approach meets the courtyard without hiding the passage in native ground.
  for (let i = 0; i < 6; i++) {
    const x0 = r.center[0] + 4.5 + i,
      x1 = x0 + 1,
      z0 = r.center[1] - 0.66,
      z1 = r.center[1] + 0.86,
      height = (x, z) =>
        Math.max(
          sample(x, z) - r.floorY + 0.025,
          0.025 + ((sample(r.center[0] + 10.5, z) - r.floorY) * (x - r.center[0] - 4.5)) / 6,
        ),
      top = [
        [x0, height(x0, z0), z0],
        [x1, height(x1, z0), z0],
        [x1, height(x1, z1), z1],
        [x0, height(x0, z1), z1],
      ],
      bottom = top.map(([x, y, z]) => [x, y - 0.15, z]);
    f('gravel', top, [0, 1, 0]);
    f('gravel', bottom, [0, -1, 0]);
    for (let j = 0; j < 4; j++) {
      const k = (j + 1) % 4;
      f(
        'gravel',
        [bottom[j], bottom[k], top[k], top[j]],
        [top[j][0] + top[k][0] - x0 - x1, 0, top[j][2] + top[k][2] - z0 - z1],
      );
    }
  }

  const segment = (a, b, width, height, role = 'wall', base) => {
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]),
      u = [(b[0] - a[0]) / length, (b[1] - a[1]) / length],
      n = [-u[1], u[0]],
      corners = [
        [a[0] + (n[0] * width) / 2, a[1] + (n[1] * width) / 2],
        [b[0] + (n[0] * width) / 2, b[1] + (n[1] * width) / 2],
        [b[0] - (n[0] * width) / 2, b[1] - (n[1] * width) / 2],
        [a[0] - (n[0] * width) / 2, a[1] - (n[1] * width) / 2],
      ],
      ground = corners.map((p) => base ?? sample(...p) - r.floorY),
      low = corners.map(([x, z], i) => [x, ground[i] - 0.18, z]),
      high = corners.map(([x, z], i) => [x, ground[i] + height, z]);
    f(role, low, [0, -1, 0]);
    f(role, high, [0, 1, 0]);
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      const cx = corners.reduce((s, p) => s + p[0] / 4, 0),
        cz = corners.reduce((s, p) => s + p[1] / 4, 0);
      f(
        role,
        [low[i], low[j], high[j], high[i]],
        [(corners[i][0] + corners[j][0]) / 2 - cx, 0, (corners[i][1] + corners[j][1]) / 2 - cz],
      );
    }
  };
  const selected =
    detail === 0
      ? r.villageWalls.filter((_, i) => [0, 2, 3, 7, 9, 11].includes(i))
      : r.villageWalls;
  for (const wall of selected) {
    const ps =
      detail === 0
        ? wall.points.filter((_, i) => i % 3 === 0 || i === wall.points.length - 1)
        : wall.points;
    for (let i = 0; i < ps.length - 1; i++) {
      const a = ps[i],
        b = ps[i + 1],
        length = Math.hypot(b[0] - a[0], b[1] - a[1]),
        count = Math.max(1, Math.ceil(length / (detail === 0 ? 4 : detail === 3 ? 1.8 : 3)));
      for (let j = 0; j < count; j++) {
        const A = a.map((v, k) => v + ((b[k] - v) * j) / count),
          B = a.map((v, k) => v + ((b[k] - v) * (j + 1)) / count);
        segment(A, B, wall.width, wall.height);
        if (detail >= 2) {
          const middle = A.map((v, k) => (v + B[k]) / 2),
            u = [
              (B[0] - A[0]) / Math.hypot(B[0] - A[0], B[1] - A[1]),
              (B[1] - A[1]) / Math.hypot(B[0] - A[0], B[1] - A[1]),
            ],
            size = Math.min(0.72, Math.hypot(B[0] - A[0], B[1] - A[1]) * 0.75);
          segment(
            middle.map((v, k) => v - (u[k] * size) / 2),
            middle.map((v, k) => v + (u[k] * size) / 2),
            wall.width * 0.9,
            0.12,
            'slab',
            sample(...middle) - r.floorY + wall.height - 0.04,
          );
        }
      }
    }
  }

  for (const slab of detail === 0 ? r.slabs.slice(0, 4) : r.slabs)
    segment(slab.a, slab.b, detail === 0 ? 0.27 : 0.18, slab.height, 'slab', 0.025);
  // Low shelves bridge pairs of upright stone flags, without inventing a furnished room.
  if (detail > 0) {
    for (const [x, z, y, w, d] of [
      [-3, -1.8, 1.1, 1.7, 0.75],
      [2.6, 2.4, 1.3, 1.35, 0.7],
    ]) {
      const X = r.center[0] + x,
        Z = r.center[1] + z;
      box(f, 'slab', X - w / 2 + 0.12, 0.025, Z, 0.24, y, 0.65);
      box(f, 'slab', X + w / 2 - 0.12, 0.025, Z, 0.24, y, 0.65);
      box(f, 'slab', X, y, Z, w, 0.18, d);
    }
    const x = r.center[0] - 0.9,
      z = r.center[1] + 0.7;
    for (const [dx, dz, w, d] of [
      [0, -0.55, 1.6, 0.18],
      [0, 0.55, 1.6, 0.18],
      [-0.72, 0, 0.18, 1.1],
      [0.72, 0, 0.18, 1.1],
    ])
      box(f, 'slab', x + dx, 0.025, z + dz, w, 0.16, d);
    const well = [r.center[0] + 0.9, r.center[1] + 0.8];
    box(f, 'metal', well[0], 0.025, well[1], 0.82, 0.08, 0.82);
    for (let i = 0; i < 5; i++) {
      box(f, 'metal', well[0] - 0.35 + i * 0.175, 0.105, well[1], 0.035, 0.035, 0.78);
      box(f, 'metal', well[0], 0.105, well[1] - 0.35 + i * 0.175, 0.78, 0.035, 0.035);
    }
  }
  if (detail >= 2) {
    // Sparse modeled cap slabs; shared masonry supplies the small courses below them.
    for (let i = 0; i < r.outer.length; i++) {
      const a = r.outer[i],
        b = r.outer[(i + 1) % r.outer.length],
        middle = a.map((v, k) => (v + b[k]) / 2),
        y = profile(middle),
        p = warp(middle, y);
      const inward = [r.center[0] - p[0], r.center[1] - p[2]],
        inwardLength = Math.hypot(...inward);
      p[0] += (0.34 * inward[0]) / inwardLength;
      p[2] += (0.34 * inward[1]) / inwardLength;
      const u = [b[0] - a[0], b[1] - a[1]],
        L = Math.hypot(...u),
        axis = u.map((v) => v / L),
        size = Math.min(0.95, L * 0.75);
      segment(
        [p[0] - (axis[0] * size) / 2, p[2] - (axis[1] * size) / 2],
        [p[0] + (axis[0] * size) / 2, p[2] + (axis[1] * size) / 2],
        0.65,
        0.08,
        'slab',
        y - 0.06,
      );
    }
  }
}
