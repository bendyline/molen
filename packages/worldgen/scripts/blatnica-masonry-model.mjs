/** N0628: hollow ridge castle with broken crowns and genuine masonry openings. */
import earcut from 'earcut';
import { box } from './khmer-structure-geometry.mjs';

export function buildBlatnicaMasonry(face, detail, r, sample) {
  const P = ([x, y, z]) => [x * r.xAxis[0] + z * r.zAxis[0], y, x * r.xAxis[1] + z * r.zAxis[1]],
    D = ([x, y, z]) => [x * r.xAxis[0] + z * r.zAxis[0], y, x * r.xAxis[1] + z * r.zAxis[1]],
    f = (role, ps, n) => face(role, ps.map(P), D(n)),
    ground = (x, z) => {
      const p = P([x, 0, z]);
      return sample(p[0], p[2]);
    },
    floor = (x) => {
      const i = Math.max(0, Math.min(r.floorKnots.length - 2, Math.floor((x + 27) / 3))),
        a = r.floorKnots[i],
        b = r.floorKnots[i + 1];
      return a[1] + ((b[1] - a[1]) * (x - a[0])) / (b[0] - a[0]);
    },
    polygon = (role, rings, map, n) => {
      const flat = rings.flat(),
        starts = [];
      let count = rings[0].length;
      for (const ring of rings.slice(1)) {
        starts.push(count);
        count += ring.length;
      }
      const ix = earcut(flat.flat(), starts);
      for (let i = 0; i < ix.length; i += 3)
        f(
          role,
          ix.slice(i, i + 3).map((k) => map(flat[k])),
          n,
        );
    },
    arch = (s, width, bottom, height) => {
      const radius = width / 2,
        spring = bottom + height - radius,
        ps = [
          [s - radius, bottom],
          [s + radius, bottom],
          [s + radius, spring],
        ],
        steps = detail === 0 ? 2 : detail === 1 ? 4 : 8;
      for (let i = 1; i <= steps; i++) {
        const a = (i * Math.PI) / steps;
        ps.push([s + radius * Math.cos(a), spring + radius * Math.sin(a)]);
      }
      return ps;
    };

  // The exposed rock is bounded to the mapped ridge, with buried native-grade feet.
  const rock = r.outer.flatMap((a, i) => {
      const b = r.outer[(i + 1) % r.outer.length],
        n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / (detail === 0 ? 6 : 3)));
      return Array.from({ length: n }, (_, j) => [
        (a[0] + ((b[0] - a[0]) * j) / n) * 1.015,
        (a[1] + ((b[1] - a[1]) * j) / n) * 1.1,
      ]);
    }),
    sign = Math.sign(
      rock.reduce(
        (s, p, i) =>
          s + p[0] * rock[(i + 1) % rock.length][1] - p[1] * rock[(i + 1) % rock.length][0],
        0,
      ),
    );
  polygon('stone', [rock], ([x, z]) => [x, floor(x), z], [0, 1, 0]);
  polygon('stone', [rock], ([x, z]) => [x, ground(x, z) - 0.35, z], [0, -1, 0]);
  for (let i = 0; i < rock.length; i++) {
    const a = rock[i],
      b = rock[(i + 1) % rock.length];
    f(
      'stone',
      [
        [a[0], ground(...a) - 0.35, a[1]],
        [b[0], ground(...b) - 0.35, b[1]],
        [b[0], floor(b[0]), b[1]],
        [a[0], floor(a[0]), a[1]],
      ],
      [(b[1] - a[1]) * sign, 0, (a[0] - b[0]) * sign],
    );
  }
  polygon('stone', [r.inner], ([x, z]) => [x, floor(x) + 0.025, z], [0, 1, 0]);

  function panel(a, b, A, B, profile, windows) {
    if (detail > 0) {
      const length = Math.hypot(b[0] - a[0], b[1] - a[1]),
        knots = [];
      for (let i = 0; i < profile.length - 1; i++) {
        const a = profile[i],
          b = profile[i + 1],
          steps = Math.max(1, Math.ceil(((b[0] - a[0]) * length) / (detail === 1 ? 2.2 : 1.1)));
        for (let j = 0; j < steps; j++) {
          const t = j / steps,
            h = a[1] + (b[1] - a[1]) * t;
          knots.push([
            a[0] + (b[0] - a[0]) * t,
            h + (j === 0 ? 0 : [-0.18, 0.12, -0.08, 0.22][(i + j) % 4]),
          ]);
        }
      }
      knots.push(profile.at(-1));
      profile = knots;
    }
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]),
      u = [(b[0] - a[0]) / L, (b[1] - a[1]) / L],
      n = [u[1] * sign, 0, -u[0] * sign],
      innerStart = (A[0] - a[0]) * u[0] + (A[1] - a[1]) * u[1],
      innerEnd = (B[0] - a[0]) * u[0] + (B[1] - a[1]) * u[1],
      thickness = -(A[0] - a[0]) * n[0] - (A[1] - a[1]) * n[2],
      innerContour = ([s, y]) => [innerStart + (s / L) * (innerEnd - innerStart), y],
      map = ([s, y], inside = false) => {
        // Openings retain their absolute facade position through the wall. Mitered
        // corner endpoints only change the inner contour, never shear a throat.
        const x = a[0] + u[0] * s - (inside ? n[0] * thickness : 0),
          z = a[1] + u[1] * s - (inside ? n[2] * thickness : 0);
        return [x, floor(x) + y, z];
      },
      subdivisions = Math.max(1, Math.ceil(L / (detail === 0 ? 6 : 3))),
      bottom = Array.from({ length: subdivisions + 1 }, (_, i) => [(L * i) / subdivisions, 0]),
      outer = [...bottom, ...profile.toReversed().map(([t, h]) => [t * L, h])],
      holes = windows
        .filter((w) => detail > 0 || w.kind === 'arch')
        .map((w) =>
          w.kind === 'arch'
            ? arch(w.s, w.width, w.bottom, w.height)
            : [
                [w.s - w.width / 2, w.bottom],
                [w.s + w.width / 2, w.bottom],
                [w.s + w.width / 2, w.bottom + w.height],
                [w.s - w.width / 2, w.bottom + w.height],
              ],
        );
    polygon('wall', [outer, ...holes], (p) => map(p), n);
    polygon(
      'wall',
      [outer.map(innerContour), ...holes],
      (p) => map(p, true),
      n.map((v) => -v),
    );
    for (const hole of holes) {
      const center = hole.reduce((a, p) => a.map((v, k) => v + p[k] / hole.length), [0, 0]);
      for (let i = 0; i < hole.length; i++) {
        const a = hole[i],
          b = hole[(i + 1) % hole.length],
          mid = a.map((v, k) => (v + b[k]) / 2);
        f(
          'wall',
          [map(a), map(b), map(b, true), map(a, true)],
          [u[0] * (center[0] - mid[0]), center[1] - mid[1], u[1] * (center[0] - mid[0])],
        );
      }
    }
    for (let i = 0; i < profile.length - 1; i++) {
      const a = [profile[i][0] * L, profile[i][1]],
        b = [profile[i + 1][0] * L, profile[i + 1][1]];
      f(
        'wall',
        [map(a), map(b), map(innerContour(b), true), map(innerContour(a), true)],
        [0, 1, 0],
      );
    }
    for (let i = 0; i < bottom.length - 1; i++)
      f(
        'wall',
        [
          map(bottom[i]),
          map(bottom[i + 1]),
          map(innerContour(bottom[i + 1]), true),
          map(innerContour(bottom[i]), true),
        ],
        [0, -1, 0],
      );
  }
  for (let i = 0; i < r.outer.length; i++)
    panel(
      r.outer[i],
      r.outer[(i + 1) % r.outer.length],
      r.inner[i],
      r.inner[(i + 1) % r.inner.length],
      r.profiles[i],
      r.windows[i],
    );

  if (detail > 0)
    for (const p of r.partitions) {
      const half = p.width / 2,
        a = [p.x - 0.45, -half],
        b = [p.x - 0.45, half],
        A = [p.x + 0.45, -half],
        B = [p.x + 0.45, half];
      panel(
        a,
        b,
        A,
        B,
        [
          [0, p.height],
          [0.28, p.height - 0.7],
          [0.48, p.height + 0.25],
          [0.65, p.height - 0.8],
          [1, p.height - 0.2],
        ],
        [{ s: half, width: 1.5, bottom: 0, height: 2.1, kind: 'arch' }],
      );
      f(
        'wall',
        [
          [a[0], floor(a[0]), a[1]],
          [A[0], floor(A[0]), A[1]],
          [A[0], floor(A[0]) + p.height, A[1]],
          [a[0], floor(a[0]) + p.height, a[1]],
        ],
        [0, 0, -1],
      );
      f(
        'wall',
        [
          [b[0], floor(b[0]), b[1]],
          [B[0], floor(B[0]), B[1]],
          [B[0], floor(B[0]) + p.height - 0.2, B[1]],
          [b[0], floor(b[0]) + p.height - 0.2, b[1]],
        ],
        [0, 0, 1],
      );
    }

  // Short graded access; no temporary construction deck or whole lower-bailey platform.
  for (let i = 0; i < 4; i++) {
    const z0 = -9 + i * 1.5,
      z1 = z0 + 1.5,
      x0 = -12 - 0.65,
      x1 = -12 + 0.65,
      height = (x, z) =>
        Math.max(
          ground(x, z) + 0.03,
          floor(x) + 0.04 + ((ground(x, -9) - floor(x)) * (-3 - z)) / 6,
        ),
      top = [
        [x0, height(x0, z0), z0],
        [x1, height(x1, z0), z0],
        [x1, height(x1, z1), z1],
        [x0, height(x0, z1), z1],
      ],
      bottom = top.map(([x, y, z]) => [x, y - 0.18, z]);
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
  if (detail >= 2)
    for (const [x, z, w, d, h] of [
      [-12, 1.9, 0.75, 0.5, 0.25],
      [-7, -2, 0.6, 0.8, 0.22],
      [-1, 1.4, 0.9, 0.4, 0.3],
      [5, -1.8, 0.7, 0.5, 0.24],
      [10, 0.4, 0.6, 0.6, 0.18],
    ])
      box(f, 'stone', x, floor(x) + 0.025, z, w, h, d);
}
