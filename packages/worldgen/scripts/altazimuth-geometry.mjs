/** 'altazimuth_pavilion_royal_observatory_greenwich': round brick pavilion, distinct portals and a pale ribbed dome. */
import { box, prism } from './khmer-structure-geometry.mjs';

export function buildAltazimuth(face, detail, r) {
  const Y = r.floorY,
    P = ([x, y, z]) => [x * r.xAxis[0] + z * r.zAxis[0], y, x * r.xAxis[1] + z * r.zAxis[1]],
    f = (role, ps, n) => face(role, ps.map(P), P(n)),
    B = (role, x, y, z, w, h, d) => box(f, role, x, Y + y, z, w, h, d),
    count = detail === 0 ? 12 : detail === 1 ? 24 : detail === 2 ? 32 : 48,
    ring = (radius, n = count, phase = Math.PI / n) =>
      Array.from({ length: n }, (_, i) => [
        Math.cos(phase + (i / n) * Math.PI * 2) * radius,
        Math.sin(phase + (i / n) * Math.PI * 2) * radius,
      ]);
  const band = (role, inner, outer, lo, hi, n = count) =>
    prism(f, role, { outline: ring(outer, n), holes: [ring(inner, n)] }, Y + lo, Y + hi);
  for (const p of r.footing) prism(f, 'plinth', p, r.foundationY, Y);
  prism(f, 'wall', { outline: ring(3.75), holes: [] }, Y, Y + 4.3);
  if (detail > 0) {
    band('arch', 3.7, 3.8, 0.16, 0.34);
    band('arch', 3.7, 3.83, 3.65, 3.82);
  }
  band('stone', 3.7, 3.87, 4.18, 4.32);
  // Rectangular tunnel recesses are genuine voids in the two projecting portals.
  for (const sign of [-1, 1]) {
    const end = sign < 0 ? 6.1 : 6.4,
      back = 2.7,
      lo = sign < 0 ? -end : back,
      hi = sign < 0 ? -back : end,
      rect = (x1, z1, x2, z2) => ({
        outline: [
          [x1, z1],
          [x2, z1],
          [x2, z2],
          [x1, z2],
        ],
        holes: [],
      });
    for (const [x1, x2] of [
      [-1.775, -0.68],
      [0.68, 1.775],
    ])
      prism(f, 'wall', rect(x1, lo, x2, hi), Y, Y + 3.15);
    prism(f, 'wall', rect(-1.775, lo, 1.775, hi), Y + 3.15, Y + 5.6);
    B('roof', 0, 5.6, sign * ((end - 0.32 + back) / 2), 3.55, 0.08, end - 0.32 - back);
    B('dark', 0, 0, sign * (end - 1.35), 1.36, 3.15, 0.08);
    B('stone', 0, 3.03, sign * (end - 0.65), 1.36, 0.14, 1.3);
    for (const x of [-1.05, 1.05]) {
      B('arch', x, 0, sign * (end + 0.08), 0.66, 0.26, 0.55);
      if (detail > 0) B('stone', x, 0.26, sign * (end + 0.08), 0.5, 0.17, 0.46);
      const columnRing = ring(0.23, detail > 1 ? 12 : 6),
        column = {
          outline: columnRing.map(([u, v]) => [u + x, v + sign * (end + 0.07)]),
          holes: [],
        };
      prism(f, 'stone', column, Y + (detail === 0 ? 0.26 : 0.43), Y + 3.05);
      B('stone', x, 3.05, sign * (end + 0.08), 0.55, 0.22, 0.5);
      if (detail > 1)
        for (const dx of [-0.095, 0.095])
          B('arch', x + dx, 0.6, sign * (end + 0.295), 0.025, 2.25, 0.035);
    }
    for (const [y, h, w, d] of detail === 0
      ? [[3.27, 0.76, 3.2, 0.8]]
      : [
          [3.27, 0.45, 2.8, 0.5],
          [3.72, 0.14, 3.05, 0.65],
          [3.86, 0.17, 3.2, 0.8],
        ])
      B('stone', 0, y, sign * (end + 0.08), w, h, d);
    B('stone', 0, 3.05, sign * (end + 0.03), 1.6, 0.28, 0.3);
    B('arch', 0, 0, sign * (end + 0.04), 1.3, 0.09, 0.5);
    const steps = detail === 0 ? 2 : detail === 1 ? 4 : 8,
      top =
        sign > 0
          ? Array.from({ length: steps * 2 + 1 }, (_, i) => {
              const x = -1.775 + (i / (steps * 2)) * 3.55;
              return [
                x,
                Math.abs(x) < 0.48 ? 7 : 5.85 + 1.15 * Math.sqrt(Math.max(0, 1 - (x / 1.775) ** 2)),
              ];
            })
          : [
              ...Array.from({ length: steps + 1 }, (_, i) => {
                const t = i / steps;
                return [-1.775 + t * 0.825, 5.95 + 0.65 * t * t];
              }),
              [-0.95, 7.1],
              [0.95, 7.1],
              ...Array.from({ length: steps + 1 }, (_, i) => {
                const t = i / steps;
                return [0.95 + t * 0.825, 5.95 + 0.65 * (1 - t) ** 2];
              }),
            ];
    const profile = { outline: [[-1.775, 5.5], ...top, [1.775, 5.5]], holes: [] },
      vertical = (role, ps, n) =>
        f(
          role,
          ps.map(([x, y, z]) => [x, Y + z, sign * y]),
          [n[0], n[2], sign * n[1]],
        );
    prism(vertical, 'wall', profile, end - 0.32, end + 0.02);
    for (let i = 0; detail > 0 && i < top.length - 1; i++) {
      const a = top[i],
        b = top[i + 1];
      prism(
        vertical,
        'arch',
        {
          outline: [a, b, [b[0], b[1] + 0.12], [a[0], a[1] + 0.12]],
          holes: [],
        },
        end - 0.37,
        end + 0.09,
      );
    }
    if (detail > 0) {
      B('stone', 0, 5.48, sign * (end + 0.06), 3.68, 0.11, 0.18);
      if (sign < 0) B('stone', 0, 7.1, sign * (end + 0.02), 2.08, 0.13, 0.48);
      circularLight(0.28, [0, 6.12, sign * (end + 0.08)], [0, sign], 'stone');
    }
  }
  // Closed skirt and dome surfaces; near levels add ribs, never operating shutters.
  const profile = [
      [4.3, 4],
      [5.35, 3.45],
      [5.7, 3.4],
      [6.4, 3.05],
      [7.2, 2.5],
      [7.9, 1.55],
      [8.35, 0.5],
      [8.4, 0.22],
    ],
    rings = profile.map(([y, radius]) => ring(radius).map(([x, z]) => [x, Y + y, z]));
  for (let j = 0; j < rings.length - 1; j++)
    for (let i = 0; i < count; i++) {
      const k = (i + 1) % count,
        a = ((i + 0.5) / count) * Math.PI * 2 + Math.PI / count;
      f(
        'roof',
        [rings[j][i], rings[j][k], rings[j + 1][k], rings[j + 1][i]],
        [Math.cos(a), 0.5, Math.sin(a)],
      );
    }
  f('roof', rings.at(-1), [0, 1, 0]);
  if (detail > 0) {
    const ribs = detail === 1 ? 8 : 16;
    for (let i = 0; i < ribs; i++) {
      const a = (i / ribs) * Math.PI * 2,
        tangent = [-Math.sin(a) * 0.045, 0, Math.cos(a) * 0.045];
      for (let j = 1; j < profile.length - 1; j++) {
        const point = ([y, radius]) => [
            Math.cos(a) * (radius + 0.035),
            Y + y,
            Math.sin(a) * (radius + 0.035),
          ],
          p = point(profile[j]),
          q = point(profile[j + 1]);
        f(
          'frame',
          [
            p.map((v, k) => v + tangent[k]),
            p.map((v, k) => v - tangent[k]),
            q.map((v, k) => v - tangent[k]),
            q.map((v, k) => v + tangent[k]),
          ],
          [Math.cos(a), 0.5, Math.sin(a)],
        );
      }
    }
  }
  function circularLight(radius, center, normal, role) {
    const n = detail === 0 ? 8 : detail === 1 ? 12 : 20,
      points = ring(radius, n, 0),
      outer = ring(radius + 0.09, n, 0),
      transform = ([u, v, depth]) => [
        center[0] + normal[1] * u + normal[0] * depth,
        Y + center[1] + v,
        center[2] - normal[0] * u + normal[1] * depth,
      ],
      emit = (m, ps, n) =>
        f(
          m,
          ps.map(([u, depth, v]) => transform([u, v, depth])),
          [normal[1] * n[0] + normal[0] * n[1], n[2], -normal[0] * n[0] + normal[1] * n[1]],
        );
    prism(emit, role, { outline: outer, holes: [points] }, -0.28, 0.06);
    f(
      'glass',
      points.map(([u, v]) => transform([u, v, 0.065])),
      [normal[0], 0, normal[1]],
    );
  }
  const apothem = 3.75 * Math.cos(Math.PI / count);
  for (const degrees of [0, 30, 150, 180, 210, 330]) {
    const a = (degrees * Math.PI) / 180,
      normal = [Math.cos(a), Math.sin(a)],
      T = ([u, y, depth]) => [
        normal[0] * (apothem + depth) - normal[1] * u,
        Y + y,
        normal[1] * (apothem + depth) + normal[0] * u,
      ],
      panel = (role, u, y, w, h, depth = 0.04) =>
        f(
          role,
          [
            [u - w / 2, y, depth],
            [u + w / 2, y, depth],
            [u + w / 2, y + h, depth],
            [u - w / 2, y + h, depth],
          ].map(T),
          [normal[0], 0, normal[1]],
        );
    panel('glass', 0, 0.72, 0.7, 2.18);
    if (detail > 0) {
      for (const sign of [-1, 1]) panel('frame', sign * 0.405, 0.66, 0.11, 2.4, 0.065);
      panel('stone', 0, 0.61, 0.98, 0.12, 0.08);
      const archSteps = detail > 1 ? 8 : 4,
        head = (w, h, depth) =>
          [
            [-w, 2.89, depth],
            ...Array.from({ length: archSteps + 1 }, (_, i) => {
              const a = (i / archSteps) * Math.PI;
              return [-Math.cos(a) * w, 2.91 + Math.sin(a) * h, depth];
            }),
            [w, 2.89, depth],
          ].map(T);
      f('frame', head(0.46, 0.23, 0.065), [normal[0], 0, normal[1]]);
      f('glass', head(0.35, 0.13, 0.075), [normal[0], 0, normal[1]]);
      if (detail > 1) {
        panel('frame', 0, 0.72, 0.04, 2.18, 0.08);
        for (const y of [1.15, 1.6, 2.05, 2.48]) panel('frame', 0, y, 0.7, 0.045, 0.08);
      }
      circularLight(0.25, [normal[0] * 3.98, 4.94, normal[1] * 3.98], normal, 'frame');
    }
  }
  // Comet vane is a schematic original silhouette, with a connected support in every LOD.
  B('dark', 0, 8.4, 0, detail === 0 ? 0.2 : 0.07, 2.18, detail === 0 ? 0.2 : 0.07);
  if (detail > 0) {
    band('dark', 0.3, 0.36, 8.4, 8.48, 8);
    band('dark', 0.16, 0.23, 9, 9.06, 8);
    for (const [x, z] of [
      [-0.3, 0],
      [0.3, 0],
      [0, -0.3],
      [0, 0.3],
    ])
      B('dark', x, 8.47, z, 0.045, 0.55, 0.045);
  }
  f(
    'frame',
    [
      [-0.1, Y + 10.34, -0.025],
      [0.08, Y + 10.16, -0.025],
      [0.63, Y + 10.1, -0.025],
      [0.15, Y + 10.48, -0.025],
      [-0.1, Y + 10.51, -0.025],
    ],
    [0, 0, -1],
  );
  f(
    'frame',
    [
      [-0.1, Y + 10.34, 0.025],
      [0.08, Y + 10.16, 0.025],
      [0.63, Y + 10.1, 0.025],
      [0.15, Y + 10.48, 0.025],
      [-0.1, Y + 10.51, 0.025],
    ],
    [0, 0, 1],
  );
}
