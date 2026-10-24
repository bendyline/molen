/** 'de_la_fratta': Cesta's polygonal keep, arched corbels and mapped stone enclosure. */
import {
  openingBuilder,
  openingReveals,
  openingShape,
  prepareOpening,
} from './authored-wall-openings.mjs';
import { box, loft, prism, rect } from './khmer-structure-geometry.mjs';

export function buildCestaFortress(face, detail, r, sample) {
  const F = r.floorY,
    c = Math.cos(r.architecturalAngleRadians),
    s = Math.sin(r.architecturalAngleRadians),
    point = ([x, y, z]) => [x * c - z * s, F + y, x * s + z * c],
    f = (role, ps, n) =>
      face(role, ps.map(point), [n[0] * c - n[2] * s, n[1], n[0] * s + n[2] * c]),
    grade = (x, z) => sample(x * c - z * s, x * s + z * c) - F;
  const center = r.keepCenter,
    scale = (ps, k, C = [0, 0]) =>
      ps.map(([x, z]) => [C[0] + (x - C[0]) * k, C[1] + (z - C[1]) * k]);
  const beam = (role, a, b, width, bottom, top) => {
    const dx = b[0] - a[0],
      dz = b[1] - a[1],
      L = Math.hypot(dx, dz),
      nx = ((-dz / L) * width) / 2,
      nz = ((dx / L) * width) / 2;
    prism(
      f,
      role,
      {
        outline: [
          [a[0] + nx, a[1] + nz],
          [b[0] + nx, b[1] + nz],
          [b[0] - nx, b[1] - nz],
          [a[0] - nx, a[1] - nz],
        ],
      },
      bottom,
      top,
    );
  };
  // Local exposed rock seats the occupied castle while preserving the original DEM.
  for (let i = 0; i < r.rock.length; i++) {
    const a = r.rock[i],
      b = r.rock[(i + 1) % r.rock.length],
      L = Math.hypot(b[0] - a[0], b[1] - a[1]),
      n = detail < 2 ? 1 : Math.ceil(L / 3);
    for (let j = 0; j < n; j++) {
      const at = (t) => a.map((v, k) => v + (b[k] - v) * t),
        p = at(j / n),
        q = at((j + 1) / n),
        m = at((j + 0.5) / n),
        lo = Math.min(grade(...p), grade(...q), grade(...m)) - 0.6;
      const p0 = [p[0], lo, p[1]],
        q0 = [q[0], lo, q[1]],
        p1 = [p[0] * 0.985, -0.15, p[1] * 0.985],
        q1 = [q[0] * 0.985, -0.15, q[1] * 0.985],
        normal = [b[1] - a[1], 0, a[0] - b[0]];
      if (detail < 2) f('rock', [p0, q0, q1, p1], normal);
      else {
        const M = [m[0] * 1.025, Math.min(-0.2, (lo - 0.15) * 0.52), m[1] * 1.025];
        for (const ps of [
          [p0, q0, M],
          [q0, q1, M],
          [q1, p1, M],
          [p1, p0, M],
        ])
          f('rock', ps, normal);
      }
    }
  }
  prism(f, 'rock', { outline: scale(r.rock, 0.985) }, -0.18, -0.13, false);
  prism(f, 'trim', { outline: r.outer }, -0.14, 0, false);
  const walls = r.curtainWalls;
  const windows = [];
  for (let i = 0; i < r.outer.length; i++) {
    const a = r.outer[i],
      b = r.outer[(i + 1) % r.outer.length],
      dx = b[0] - a[0],
      dz = b[1] - a[1],
      L = Math.hypot(dx, dz);
    if (L < 4.5) continue;
    const count = detail === 0 ? 0 : Math.max(1, Math.floor(L / 5));
    for (let j = 0; j < count; j++) {
      const t = (j + 0.5) / count,
        x = a[0] + dx * t,
        z = a[1] + dz * t;
      if (Math.hypot(x - r.gate[0], z - r.gate[1]) < 2.1) continue;
      windows.push(
        prepareOpening(
          {
            center: [x, z],
            axis: [dx / L, dz / L],
            width: 0.72,
            bottom: 2.8,
            height: 1.25,
            shape: 'rectangle',
            depth: 2.3,
          },
          0,
          detail,
        ),
      );
    }
  }
  const gate = prepareOpening(
      {
        center: r.gate,
        axis: [-1, 0.15],
        width: 1.85,
        bottom: 0.02,
        height: 2.95,
        spring: 2.05,
        shape: 'round',
        depth: 2.7,
      },
      0,
      detail,
    ),
    holes = [...windows, gate],
    adapter = { addTriangle: (role, _ref, ps, n) => f(role, ps, n) },
    cut = openingBuilder(adapter, holes),
    cutFace = (role, ps, n) => {
      for (let i = 1; i < ps.length - 1; i++)
        cut.addTriangle(role, 'palette:#ffffff', [ps[0], ps[i], ps[i + 1]], n);
    };
  for (const p of walls) prism(detail >= 1 ? cutFace : f, 'wall', p, -0.12, 8.0, false);
  if (detail >= 1)
    for (const p of walls)
      for (const ring of [p.outline, ...p.holes])
        openingReveals(
          { addTriangle: (_role, _ref, ps, n) => f('trim', ps, n) },
          ring,
          () => -0.12,
          () => 8,
          holes,
          undefined,
          detail,
        );
  const panel = (hole, role, depth) => {
    const [u, v] = hole.axis,
      L = Math.hypot(u, v),
      tx = u / L,
      tz = v / L,
      nx = tz,
      nz = -tx,
      P = ([x, y], d = depth) => [
        hole.center[0] + tx * x + nx * d,
        y,
        hole.center[1] + tz * x + nz * d,
      ];
    f(
      role,
      openingShape(hole, detail).map((p) => P(p)),
      [nx, 0, nz],
    );
    if (detail >= 2 && role === 'metal') {
      for (const x of [-0.24, 0, 0.24]) {
        const a = P([x, hole.bottom], depth + 0.025),
          b = P([x, hole.bottom + hole.height], depth + 0.025);
        box(f, 'metal', a[0], a[1], a[2], 0.035, b[1] - a[1], 0.035);
      }
      for (const y of [hole.bottom + 0.4, hole.bottom + 0.85])
        beam(
          'metal',
          [...P([-0.36, y], depth + 0.035)].filter((_, i) => i !== 1),
          [...P([0.36, y], depth + 0.035)].filter((_, i) => i !== 1),
          0.035,
          y,
          y + 0.035,
        );
    }
  };
  if (detail >= 1) {
    for (const h of windows) panel(h, 'metal', -0.55);
    panel(gate, 'wood', -0.8);
  }
  for (let i = 0; i < r.outer.length; i++) {
    const a = r.outer[i],
      b = r.outer[(i + 1) % r.outer.length],
      dx = b[0] - a[0],
      dz = b[1] - a[1],
      L = Math.hypot(dx, dz),
      count = Math.max(1, Math.round(L / (detail === 0 ? 4.5 : 2.75)));
    beam('trim', a, b, 1.25, 7.85, 8.15);
    for (let j = 0; j < count; j++) {
      if (a[0] < -7.5 && b[0] < -7.5) continue;
      const mid = (j + 0.5) / count,
        half = Math.min(0.65 / L, 0.3 / count),
        A = [a[0] + dx * (mid - half), a[1] + dz * (mid - half)],
        B = [a[0] + dx * (mid + half), a[1] + dz * (mid + half)];
      beam('wall', A, B, 1.05, 8.1, 9.15);
      if (detail >= 3 && j % 2 === 0) {
        const mx = (A[0] + B[0]) / 2,
          mz = (A[1] + B[1]) / 2,
          nx = dz / L,
          nz = -dx / L;
        f(
          'metal',
          [
            [mx - (0.04 * dx) / L + nx * 0.53, 8.45, mz - (0.04 * dz) / L + nz * 0.53],
            [mx + (0.04 * dx) / L + nx * 0.53, 8.45, mz + (0.04 * dz) / L + nz * 0.53],
            [mx + (0.04 * dx) / L + nx * 0.53, 8.83, mz + (0.04 * dz) / L + nz * 0.53],
            [mx - (0.04 * dx) / L + nx * 0.53, 8.83, mz - (0.04 * dz) / L + nz * 0.53],
          ],
          [nx, 0, nz],
        );
      }
    }
  }
  // Two low mapped rooms remain beneath the curtain silhouette.
  for (const p of r.rooms) {
    prism(f, 'wall', p, 0, p.height);
    const C = p.outline.reduce((a, q) => a.map((v, k) => v + q[k] / p.outline.length), [0, 0]);
    loft(
      f,
      'roof',
      C[0],
      C[1],
      [
        [p.height, 1.035],
        [p.roofHeight, 0.2],
      ],
      false,
      (k) => p.outline.map((q) => [(q[0] - C[0]) * k, (q[1] - C[1]) * k]),
    );
  }
  // Tall five-sided keep; body continues behind the shallow machicolation recesses.
  prism(f, 'wall', { outline: r.keep }, 0, 18.3);
  const projected = scale(r.keep, 1.13, center),
    innerKeep = scale(r.keep, 0.92, center),
    mouths = [];
  for (let i = 0; i < projected.length; i++) {
    const a = projected[i],
      b = projected[(i + 1) % projected.length],
      dx = b[0] - a[0],
      dz = b[1] - a[1],
      L = Math.hypot(dx, dz),
      count = Math.max(2, Math.floor(L / (detail < 2 ? 1.4 : 0.95)));
    for (let j = 0; j < count; j++) {
      const t = (j + 0.5) / count;
      mouths.push(
        prepareOpening(
          {
            center: [a[0] + dx * t, a[1] + dz * t],
            axis: [dx / L, dz / L],
            width: Math.min(0.67, (L / count) * 0.67),
            bottom: 16.9,
            height: 1.2,
            spring: 0.72,
            shape: 'round',
            depth: 1.7,
          },
          0,
          detail,
        ),
      );
    }
    const countTop = Math.max(2, Math.round(L / 2.4));
    for (let j = 0; j < countTop; j++) {
      const t = (j + 0.5) / countTop,
        h = 0.52 / L;
      beam(
        'wall',
        [a[0] + dx * (t - h), a[1] + dz * (t - h)],
        [a[0] + dx * (t + h), a[1] + dz * (t + h)],
        0.64,
        19.55,
        20.65,
      );
    }
  }
  const band = { outline: projected, holes: [r.keep] },
    opening = openingBuilder(adapter, mouths),
    bandFace = (role, ps, n) => {
      for (let i = 1; i < ps.length - 1; i++)
        opening.addTriangle(role, 'palette:#ffffff', [ps[0], ps[i], ps[i + 1]], n);
    };
  prism(detail >= 2 ? bandFace : f, 'trim', band, 16.85, 18.3, false);
  if (detail >= 2)
    openingReveals(
      { addTriangle: (_role, _ref, ps, n) => f('wall', ps, n) },
      projected,
      () => 16.85,
      () => 18.3,
      mouths,
      undefined,
      detail,
    );
  else if (detail === 1) for (const h of mouths) panel(h, 'metal', 0.012);
  prism(f, 'wall', { outline: projected, holes: [innerKeep] }, 18.3, 19.55, false);
  const [kx, kz] = center;
  box(f, 'wall', kx, 18.3, kz, 5.2, 2.9, 4.15);
  loft(
    f,
    'roof',
    kx,
    kz,
    [
      [21.2, 1],
      [22.4, 0.16],
    ],
    false,
    (w) => rect(0, 0, 5.8 * w, 4.75 * w).outline,
  );
  if (detail >= 1) {
    for (const hand of [-1, 1]) box(f, 'metal', kx + hand * 1.5, 19.5, kz + 2.08, 0.38, 0.7, 0.025);
    box(f, 'trim', 7.5, 8.1, -4, 1.2, 2.3, 0.95);
    box(f, 'roof', 7.5, 10.4, -4, 1.5, 0.2, 1.2);
    if (detail >= 2) {
      for (const hand of [-1, 1]) box(f, 'metal', 7.5 + hand * 0.25, 9.6, -3.52, 0.18, 0.55, 0.025);
      box(f, 'metal', kx - 1.3, 12.6, kz + 2.65, 0.18, 0.6, 0.025);
    }
  }
  // Short supported stair follows the pictured gate side toward the native mapped path.
  const A = r.gate,
    B = r.approach,
    dx = B[0] - A[0],
    dz = B[1] - A[1],
    L = Math.hypot(dx, dz),
    count = detail === 0 ? 2 : Math.max(4, Math.ceil(L / (detail === 1 ? 0.8 : 0.4))),
    end = grade(...B) + 0.12;
  for (let i = 0; i < count; i++) {
    const t0 = i / count,
      t1 = (i + 1) / count,
      p = [A[0] + dx * t0, A[1] + dz * t0],
      q = [A[0] + dx * t1, A[1] + dz * t1],
      y = end * t0,
      lo = Math.min(grade(...p), grade(...q), y) - 0.35;
    beam('trim', p, q, 2.2, lo, y + 0.05);
  }
}
