/** 'timotesubani': specific Timotesubani church/porch and separately mapped brick gateway. */

import {
  openingBuilder,
  openingReveals,
  openingShape,
  prepareOpening,
} from './authored-wall-openings.mjs';
import { box, prism, rect } from './khmer-structure-geometry.mjs';

export function buildTimotesubaniChurch(emit, detail, reconstruction, ground) {
  const { church, gate } = reconstruction;
  const frame = (b) => {
    const c = Math.cos(b.angle),
      s = Math.sin(b.angle);
    const point = ([x, y, z]) => [
      b.center[0] + x * c - z * s,
      b.floorY + y,
      b.center[1] + x * s + z * c,
    ];
    const f = (role, ps, n) =>
      emit(role, ps.map(point), [n[0] * c - n[2] * s, n[1], n[0] * s + n[2] * c]);
    const grade = (x, z) => {
      const p = point([x, 0, z]);
      return ground(p[0], p[2]) - b.floorY;
    };
    return { f, grade };
  };
  const wall = (f, role, polygon, low, high, holes = []) => {
    const prepared = holes.map((h) => prepareOpening(h, 0, detail)),
      adapter = { addTriangle: (slot, _ref, p, n) => f(slot, p, n) },
      clipped = openingBuilder(adapter, prepared);
    prism(
      (slot, p, n) => {
        for (let i = 1; i < p.length - 1; i++)
          clipped.addTriangle(slot, 'palette:#ffffff', [p[0], p[i], p[i + 1]], n);
      },
      role,
      polygon,
      low,
      high,
    );
    // Reveal only the occupied wall strips, never bridge a hollow interior.
    const ring = polygon.outline,
      inner = polygon.holes?.[0];
    if (inner) {
      for (let i = 0; i < ring.length; i++) {
        const j = (i + 1) % ring.length;
        openingReveals(
          { addTriangle: (_slot, _ref, p, n) => f(role, p, n) },
          [ring[i], ring[j], inner[j], inner[i]],
          () => low,
          () => high,
          prepared,
          undefined,
        );
      }
    } else
      openingReveals(
        { addTriangle: (_slot, _ref, p, n) => f(role, p, n) },
        ring,
        () => low,
        () => high,
        prepared,
        undefined,
      );
  };
  const hollow = (x, z, w, d, t) => ({
    outline: rect(x, z, w, d).outline,
    holes: [rect(x, z, w - 2 * t, d - 2 * t).outline],
  });
  const gable = (f, role, x, z, length, width, eave, ridge, alongX = true) => {
    const p = (u, y, v) => (alongX ? [x + u, y, z + v] : [x + v, y, z + u]),
      a = [
        [-width / 2, eave],
        [0, ridge],
        [width / 2, eave],
        [width / 2, eave - 0.16],
        [-width / 2, eave - 0.16],
      ];
    for (let i = 0; i < a.length; i++) {
      const j = (i + 1) % a.length;
      f(
        role,
        [
          p(-length / 2, a[i][1], a[i][0]),
          p(length / 2, a[i][1], a[i][0]),
          p(length / 2, a[j][1], a[j][0]),
          p(-length / 2, a[j][1], a[j][0]),
        ],
        alongX
          ? [0, a[j][0] - a[i][0], a[i][1] - a[j][1]]
          : [a[i][1] - a[j][1], a[j][0] - a[i][0], 0],
      );
    }
    for (const hand of [-1, 1]) {
      const u = (hand * length) / 2;
      f(
        role,
        [p(u, eave, -width / 2), p(u, eave, width / 2), p(u, ridge, 0)],
        alongX ? [hand, 0, 0] : [0, 0, hand],
      );
    }
    if (detail >= 2) {
      const n = Math.ceil(length / 0.7);
      for (let i = 0; i <= n; i++) {
        const u = -length / 2 + (i * length) / n;
        for (const hand of [-1, 1]) {
          const ps = [
            p(u - 0.025, eave + 0.025, (hand * width) / 2),
            p(u + 0.025, eave + 0.025, (hand * width) / 2),
            p(u + 0.025, ridge + 0.025, 0),
            p(u - 0.025, ridge + 0.025, 0),
          ];
          f(role, ps, [0, 1, 0]);
        }
      }
    }
  };
  const gableWall = (f, x, z, width, eave, ridge, alongX) => {
    const t = 0.32,
      p = (u, y, v) => (alongX ? [x + v, y, z + u] : [x + u, y, z + v]);
    for (const hand of [-1, 1])
      f(
        'wall',
        [p(-width / 2, eave, hand * t), p(width / 2, eave, hand * t), p(0, ridge, hand * t)],
        alongX ? [hand, 0, 0] : [0, 0, hand],
      );
  };
  const archFrame = (f, role, h, width, thickness, offset = 0) => {
    const shape = openingShape(h, detail),
      n = [-h.axis[1], h.axis[0]],
      at = ([u, y], v) => [
        h.center[0] + u * h.axis[0] + v * n[0],
        y,
        h.center[1] + u * h.axis[1] + v * n[1],
      ],
      outer = shape.map(([u, y]) => [
        u + (u < 0 ? -width : width),
        y + (y > h.bottom + h.spring ? width : 0),
      ]);
    for (let i = 1; i < shape.length; i++) {
      const a = shape[i - 1],
        b = shape[i],
        A = outer[i - 1],
        B = outer[i];
      f(
        role,
        [
          at(a, offset + thickness),
          at(b, offset + thickness),
          at(B, offset + thickness),
          at(A, offset + thickness),
        ],
        [n[0], 0, n[1]],
      );
      f(
        role,
        [at(a, offset), at(b, offset), at(b, offset + thickness), at(a, offset + thickness)],
        [-(b[1] - a[1]) * h.axis[0], b[0] - a[0], -(b[1] - a[1]) * h.axis[1]],
      );
    }
  };
  const foundation = (f, grade, polygon, top) => {
    const p = polygon.outline;
    for (let i = 0; i < p.length; i++) {
      const a = p[i],
        b = p[(i + 1) % p.length],
        low = Math.min(grade(...a), grade(...b), top - 0.3) - 0.45;
      f(
        'base',
        [
          [...a.slice(0, 1), low, a[1]],
          [b[0], low, b[1]],
          [b[0], top, b[1]],
          [a[0], top, a[1]],
        ],
        [b[1] - a[1], 0, a[0] - b[0]],
      );
    }
    prism(f, 'stone', polygon, top - 0.12, top);
  };
  const stairs = (f, grade, x, z, width, run, axis) => {
    const n = detail === 0 ? 1 : 5,
      low =
        Math.min(
          ...Array.from({ length: 7 }, (_, i) =>
            grade(x + (axis[0] * run * i) / 6, z + (axis[1] * run * i) / 6),
          ),
        ) - 0.45;
    for (let i = 0; i < n; i++) {
      const u = (run / n) * (i + 0.5),
        h = -0.08 - ((i + 1) * Math.max(0.2, -grade(x + axis[0] * run, z + axis[1] * run))) / n;
      box(
        f,
        'stone',
        x + axis[0] * u,
        low,
        z + axis[1] * u,
        axis[0] ? run / n : width,
        Math.max(0.05, h - low),
        axis[0] ? width : run / n,
      );
    }
  };
  const { f, grade } = frame(church),
    W = church.width,
    D = church.depth,
    zc = -1.35,
    bodyDepth = D - 3.2,
    body = rect(0, zc, W, bodyDepth),
    back = zc - bodyDepth / 2,
    front = zc + bodyDepth / 2;
  foundation(f, grade, body, 0);
  const door = {
      center: [0, front],
      axis: [1, 0],
      width: 1.6,
      bottom: 0.08,
      spring: 2.42,
      height: 3.22,
      depth: 1.8,
      shape: 'round',
    },
    windows = [];
  if (detail >= 1)
    for (const x of [-7, 7])
      for (const z of [back, front])
        windows.push({
          center: [x, z],
          axis: [1, 0],
          width: 0.48,
          bottom: 2.8,
          spring: 1.6,
          height: 1.85,
          depth: 1.8,
          shape: 'round',
        });
  wall(f, 'wall', hollow(0, zc, W, bodyDepth, 0.65), 0, 6.4, [door, ...windows]);
  box(f, 'wood', 0, 0.08, front - 0.34, 1.55, 3.1, 0.12);
  for (const h of windows)
    box(
      f,
      'inset',
      h.center[0],
      h.bottom,
      h.center[1] + (h.center[1] === front ? -0.35 : 0.35),
      0.43,
      h.height - 0.05,
      0.07,
    );
  // Upper nave/transept massing is distinct from the low side roofs.
  const upper = (x, z, w, d, holes = []) =>
    detail === 0
      ? box(f, 'wall', x, 6.35, z, w, 2.3, d)
      : wall(f, 'wall', hollow(x, z, w, d, 0.5), 6.35, 8.65, holes);
  const endWindows = [-1, 1].map((hand) => ({
    center: [(hand * W) / 2, zc],
    axis: [0, 1],
    width: 0.42,
    bottom: 7.0,
    spring: 1.2,
    height: 1.55,
    depth: 1.3,
    shape: 'round',
  }));
  upper(0, zc, W, 6.2, endWindows);
  if (detail >= 1)
    for (const hand of [-1, 1]) box(f, 'inset', hand * (W / 2 - 0.3), 7.0, zc, 0.05, 1.5, 0.4);
  upper(church.domeCenter[0], zc, 6.8, bodyDepth);
  for (const hand of [-1, 1]) {
    gableWall(f, (hand * W) / 2, zc, 6.2, 8.65, 10.85, true);
    gableWall(f, church.domeCenter[0], zc + (hand * bodyDepth) / 2, 6.8, 8.65, 11.0, false);
    // Narrow dark, recessed gable windows; the panes close these church openings.
    if (detail >= 1) {
      box(
        f,
        'stone',
        church.domeCenter[0],
        7.2,
        zc + hand * (bodyDepth / 2 + 0.035),
        0.55,
        2.4,
        0.09,
      );
      box(
        f,
        'inset',
        church.domeCenter[0],
        7.35,
        zc + hand * (bodyDepth / 2 + 0.09),
        0.24,
        1.95,
        0.03,
      );
    }
  }
  gable(f, 'roof', 0, zc, W + 0.38, 6.65, 8.72, 10.95, true);
  gable(f, 'roof', church.domeCenter[0], zc, bodyDepth + 0.38, 7.15, 8.78, 11.1, false);
  for (const hand of [-1, 1]) {
    const inner = zc + hand * 3.15,
      outer = zc + hand * (bodyDepth / 2 + 0.18);
    f(
      'roof',
      [
        [-W / 2 - 0.18, 8.05, inner],
        [W / 2 + 0.18, 8.05, inner],
        [W / 2 + 0.18, 6.45, outer],
        [-W / 2 - 0.18, 6.45, outer],
      ],
      [0, 1, 0],
    );
    if (detail >= 2)
      for (let x = -W / 2; x < W / 2; x += 0.7)
        f(
          'roof',
          [
            [x - 0.02, 8.08, inner],
            [x + 0.02, 8.08, inner],
            [x + 0.02, 6.48, outer],
            [x - 0.02, 6.48, outer],
          ],
          [0, 1, 0],
        );
  }
  for (const end of [-1, 1])
    for (const hand of [-1, 1]) {
      const x = (end * W) / 2,
        zi = zc + hand * 3.15,
        zo = zc + (hand * bodyDepth) / 2;
      f(
        'wall',
        [
          [x, 6.4, zi],
          [x, 6.4, zo],
          [x, 6.45, zo],
          [x, 8.05, zi],
        ],
        [end, 0, 0],
      );
    }
  const [dx, dz] = church.domeCenter,
    N = detail === 0 ? 8 : detail === 1 ? 12 : 36,
    R = 3.0,
    inner = 2.55,
    at = (a, r, y) => [dx + Math.cos(a) * r, y, dz + Math.sin(a) * r],
    ring = (radius) =>
      Array.from({ length: N }, (_, i) => [
        dx + Math.cos((i * Math.PI * 2) / N) * radius,
        dz + Math.sin((i * Math.PI * 2) / N) * radius,
      ]);
  if (detail === 0) {
    prism(f, 'wall', { outline: ring(R) }, 10, 16.6);
  } else
    for (let i = 0; i < N; i++) {
      const a = (i * Math.PI * 2) / N,
        b = ((i + 1) * Math.PI * 2) / N,
        m = (a + b) / 2,
        h = {
          center: [dx + Math.cos(m) * R, dz + Math.sin(m) * R],
          axis: [-Math.sin(m), Math.cos(m)],
          width: 0.27,
          bottom: 11.05,
          spring: 3.5,
          height: 3.8,
          depth: 1.3,
          shape: 'round',
        },
        p = {
          outline: [at(a, R, 0), at(b, R, 0), at(b, inner, 0), at(a, inner, 0)].map((v) => [
            v[0],
            v[2],
          ]),
        };
      // Twelve slit apertures follow the mapped drum, independent of tessellation.
      const selected = i % (N / 12) === Math.floor(N / 24),
        holes = selected ? [h] : [];
      wall(f, 'wall', p, 10, 16.6, holes);
      if (selected) {
        const tangent = h.axis,
          n = [Math.cos(m), Math.sin(m)],
          c = [dx + n[0] * 2.65, dz + n[1] * 2.65];
        f(
          'inset',
          [
            [c[0] - tangent[0] * 0.14, 11.05, c[1] - tangent[1] * 0.14],
            [c[0] + tangent[0] * 0.14, 11.05, c[1] + tangent[1] * 0.14],
            [c[0] + tangent[0] * 0.14, 14.8, c[1] + tangent[1] * 0.14],
            [c[0] - tangent[0] * 0.14, 14.8, c[1] - tangent[1] * 0.14],
          ],
          [n[0], 0, n[1]],
        );
      }
    }
  if (detail >= 1)
    for (let i = 0; i < 12; i++) {
      const a = ((i + 0.5) * Math.PI) / 6,
        n = [Math.cos(a), Math.sin(a)],
        h = {
          center: [dx + n[0] * 3.015, dz + n[1] * 3.015],
          axis: [-n[1], n[0]],
          width: 1.18,
          bottom: 10.7,
          spring: 4.0,
          height: 4.62,
          shape: 'round',
        };
      archFrame(f, 'wall', h, 0.075, 0.07, 0);
      if (detail >= 2) {
        const u = [-n[1], n[0]],
          cx = dx + n[0] * 3.09,
          cz = dz + n[1] * 3.09;
        f(
          'accent',
          [
            [cx - u[0] * 0.13, 15.9, cz - u[1] * 0.13],
            [cx, 16.04, cz],
            [cx + u[0] * 0.13, 15.9, cz + u[1] * 0.13],
            [cx, 15.76, cz],
          ],
          [n[0], 0, n[1]],
        );
      }
    }
  prism(f, 'wall', { outline: ring(3.12) }, 16.42, 16.65);
  for (let i = 0; i < N; i++) {
    const a = (i * Math.PI * 2) / N,
      b = ((i + 1) * Math.PI * 2) / N;
    f(
      'roof',
      [at(a, 3.25, 16.65), at(b, 3.25, 16.65), [dx, 20.5, dz]],
      [Math.cos((a + b) / 2), 1, Math.sin((a + b) / 2)],
    );
  }
  if (detail >= 2)
    for (let i = 0; i < 24; i++) {
      const a = (i * Math.PI) / 12,
        e = 0.012;
      f(
        'roof',
        [at(a - e, 3.27, 16.68), at(a + e, 3.27, 16.68), [dx, 20.53, dz]],
        [Math.cos(a), 1, Math.sin(a)],
      );
    }
  box(f, 'metal', dx - 0.035, 20.4, dz, 0.07, 1.0, 0.07);
  box(f, 'metal', dx - 0.31, 21.0, dz, 0.62, 0.07, 0.07);
  // Porch: a real front arch and twin side arches, not opaque painted recesses.
  const pw = 6.4,
    pd = 3.2,
    pz = front + pd / 2,
    porch = rect(0, pz, pw, pd),
    arch = {
      center: [0, front + pd],
      axis: [1, 0],
      width: 2.7,
      bottom: 0.02,
      spring: 2.5,
      height: 3.88,
      depth: 1.4,
      shape: 'round',
    },
    side = [];
  for (const hand of [-1, 1])
    for (const offset of detail === 0 ? [0] : [-0.78, 0.78])
      side.push({
        center: [(hand * pw) / 2, pz + offset],
        axis: [0, 1],
        width: detail === 0 ? 2.4 : 1.05,
        bottom: 0.55,
        spring: 1.59,
        height: 2.17,
        depth: 1.2,
        shape: 'round',
      });
  foundation(f, grade, porch, 0);
  wall(f, 'stone', hollow(0, pz, pw, pd, 0.42), 0, 4.12, [
    arch,
    ...side,
    {
      center: [0, front],
      axis: [1, 0],
      width: pw - 0.84,
      bottom: -0.02,
      height: 4.3,
      depth: 1.0,
      shape: 'rectangle',
    },
  ]);
  for (const hand of [-1, 1])
    f(
      'stone',
      [
        [(hand * pw) / 2, 4.12, front + pd],
        [0, 6.0, front + pd],
        [0, 4.12, front + pd],
      ],
      [0, 0, 1],
    );
  gable(f, 'roof', 0, pz, pd + 0.3, pw + 0.3, 4.18, 6.1, false);
  if (detail >= 1) {
    archFrame(f, 'stone', arch, 0.15, 0.16, 0.07);
    for (const h of side) {
      const positive = h.center[0] < 0 ? 1 : -1;
      archFrame(f, 'stone', { ...h, axis: h.axis.map((v) => v * positive) }, 0.1, 0.11, 0.04);
    }
    box(f, 'stone', 0, 3.92, pz, pw + 0.12, 0.18, pd + 0.1);
  }
  if (detail >= 2) {
    for (const hand of [-1, 1]) {
      box(f, 'stone', hand * 3.23, 0.6, pz, 0.1, 1.5, 0.28);
      for (let i = 0; i < 4; i++)
        box(f, 'stone', hand * 3.28, 1.75 + i * 0.1, pz, 0.12, 0.05, 0.36 - i * 0.04);
    }
  }
  if (detail === 3)
    for (const hand of [-1, 1])
      for (let j = 0; j < 3; j++) {
        const x = hand * 3.3,
          y = 1.85 + j * 0.11;
        f(
          'stone',
          [
            [x, y, pz - 0.1],
            [x + hand * 0.035, y + 0.09, pz],
            [x, y, pz + 0.1],
            [x, y - 0.025, pz],
          ],
          [hand, 0, 0],
        );
      }
  stairs(f, grade, 0, front + pd, 2.9, 1.9, [0, 1]);
  // Separate SE-facing gate: flat-topped pointed brick front and low rear flanks.
  const { f: gf, grade: gg } = frame(gate),
    length = gate.width,
    width = gate.depth,
    x = length / 2 - 0.65;
  const gateArch = {
    center: [x, 0],
    axis: [0, -1],
    width: 2.8,
    bottom: 0.04,
    spring: 3.0,
    height: 4.5,
    depth: 2,
    shape: 'pointed',
  };
  foundation(gf, gg, rect(x, 0, 1.3, width), 0);
  wall(gf, 'wall', rect(x, 0, 1.3, width), 0, 5.7, [gateArch]);
  for (const hand of [-1, 1]) {
    const p = rect(-0.65, hand * (width / 2 - 0.23), length - 1.3, 0.46);
    foundation(gf, gg, p, 0);
    prism(gf, 'base', p.outline ? p : { outline: p }, 0, 2.15);
  }
  if (detail >= 1) {
    archFrame(gf, 'wall', gateArch, 0.23, 0.18, 0.68);
    archFrame(gf, 'wall', { ...gateArch, width: 3.4, height: 4.9, spring: 3.15 }, 0.15, 0.12, 0.69);
    box(gf, 'wall', x - 0.73, 5.7, 0, 1.46, 0.17, width + 0.16);
  }
  for (const hand of [-1, 1]) {
    const u = hand,
      ps = [
        [0.12 * u, 0.08],
        [1.32 * u, 0.08],
        [1.32 * u, 2.95],
        [0.12 * u, 4.31],
      ];
    gf(
      'wood',
      ps.map(([v, y]) => [x + 0.08, y, v]),
      [1, 0, 0],
    );
    gf(
      'wood',
      ps.toReversed().map(([v, y]) => [x - 0.03, y, v]),
      [-1, 0, 0],
    );
    if (detail >= 2)
      for (let k = 0; k < 3; k++)
        box(gf, 'metal', x + 0.09, 1 + k * 0.75, hand * 0.7, 0.05, 0.065, 1.02);
  }
  stairs(gf, gg, length / 2, 0, 3.2, 1.5, [1, 0]);
}
