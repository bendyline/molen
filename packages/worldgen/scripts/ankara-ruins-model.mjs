/** Surviving Ankara cella, portal, rear remnants and open conservation steelwork. */
import { box, prism, rect } from './khmer-structure-geometry.mjs';

export const ankaraCandidateId = 'N0531';

function elevation(f, role, outline, holes, z, thickness) {
  prism(
    (role, ps, n) =>
      f(
        role,
        ps.map(([u, v, y]) => [u, y, z + v]),
        [n[0], n[2], n[1]],
      ),
    role,
    { outline, holes },
    -thickness / 2,
    thickness / 2,
  );
}
function arch(x, base, width, height, n) {
  const r = width / 2,
    spring = base + height - r;
  return [
    [x - r, base],
    [x + r, base],
    [x + r, spring],
    ...Array.from({ length: n }, (_, i) => {
      const a = ((i + 1) * Math.PI) / n;
      return [x + r * Math.cos(a), spring + r * Math.sin(a)];
    }),
  ];
}
function beam(f, a, b, width) {
  const delta = b.map((v, i) => v - a[i]),
    len = Math.hypot(...delta),
    d = delta.map((v) => v / len),
    cross = (a, b) => [
      a[1] * b[2] - a[2] * b[1],
      a[2] * b[0] - a[0] * b[2],
      a[0] * b[1] - a[1] * b[0],
    ],
    raw = cross(d, Math.abs(d[1]) > 0.95 ? [1, 0, 0] : [0, 1, 0]),
    u = raw.map((v) => v / Math.hypot(...raw)),
    v = cross(d, u),
    ring = (p) =>
      [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ].map(([x, y]) => p.map((p, i) => p + ((u[i] * x + v[i] * y) * width) / 2)),
    lo = ring(a),
    hi = ring(b);
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4,
      n = lo[i].map((v, k) => (v + lo[j][k]) / 2 - a[k]);
    f('steel', [lo[i], lo[j], hi[j], hi[i]], n);
  }
  f(
    'steel',
    lo,
    d.map((v) => -v),
  );
  f('steel', hi, d);
}
function drum(f, x, z, radius, height, Y, n) {
  const ring = (y, top) =>
      Array.from({ length: n }, (_, i) => {
        const a = (i * 2 * Math.PI) / n;
        return [
          x + radius * Math.cos(a),
          y + (top ? 0.08 * Math.sin(i * 2.3) : 0),
          z + radius * Math.sin(a),
        ];
      }),
    lo = ring(Y - 0.15, false),
    hi = ring(Y + height, true);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    f(
      'rubble',
      [lo[i], lo[j], hi[j], hi[i]],
      [Math.cos(((i + 0.5) * 2 * Math.PI) / n), 0, Math.sin(((i + 0.5) * 2 * Math.PI) / n)],
    );
  }
  f('rubble', lo, [0, -1, 0]);
  f('rubble', hi, [0, 1, 0]);
}

export function buildAnkaraRuins(face, detail, r, sampleTerrain) {
  const a = r.architecturalAngleRadians,
    c = Math.cos(a),
    s = Math.sin(a),
    grade = (u, v) => sampleTerrain(c * u - s * v, s * u + c * v),
    f = (role, ps, n) => {
      if (detail === 0 && n[1] < -0.5) return;
      face(
        role,
        ps.map(([u, y, v]) => [c * u - s * v, y, s * u + c * v]),
        [c * n[0] - s * n[2], n[1], s * n[0] + c * n[2]],
      );
    },
    p = r.cella,
    Y = p.portalFloor,
    groundBox = (role, x, z, w, d, h) => {
      const outline = rect(x, z, w, d);
      prism(
        (role, ps, n) =>
          f(
            role,
            ps.map(([u, y, v]) => [u, grade(u, v) + (y === 0 ? -0.55 : h), v]),
            n,
          ),
        role,
        outline,
        0,
        1,
      );
    };
  for (const side of [-1, 1]) {
    const z = side * p.halfWidth,
      crest = p.crest.map(([u, y], i) => [
        u,
        y + (side < 0 ? -0.35 : 0) + (detail >= 2 ? 0.08 * Math.sin(i * 2.1) : 0),
      ]),
      base = p.crest.map(([u]) => [u, grade(u, z) - 0.55]).toReversed(),
      windows =
        side > 0 ? p.windows.map((x) => arch(x, 6.2, 1.12, 2.25, [3, 6, 8, 10][detail])) : [];
    elevation(f, 'stone', [...crest, ...base], windows, z, p.thickness);
    groundBox('trim', 3, z, 31.4, 1.55, 0.38);
    if (detail >= 1) groundBox('trim', 3, z, 31.1, 1.42, 0.6);
    if (side > 0 && detail >= 1)
      for (const x of p.windows) {
        for (const u of [-0.19, 0.19])
          box(f, 'trim', x + u, 6.2, z, 0.07, 1.85, p.thickness + 0.08);
        box(f, 'trim', x, 7.2, z, 1.1, 0.07, p.thickness + 0.08);
      }
    const end =
      side > 0
        ? [
            [-20, 4.3],
            [-18, 5.5],
            [-16, 6.9],
            [-14, 8.8],
            [-12, 10.6],
          ]
        : [
            [-20, 7.6],
            [-17, 8.2],
            [-14, 8.8],
            [-12, 10.7],
          ];
    const brokenEnd = end.flatMap((point, i) =>
      i
        ? [
            [point[0] - 0.12, end[i - 1][1]],
            [point[0], point[1]],
          ]
        : [point],
    );
    elevation(
      f,
      'stone',
      [...brokenEnd, ...end.map(([u]) => [u, grade(u, z) - 0.55]).toReversed()],
      [],
      z,
      p.thickness,
    );
    groundBox('trim', -16, z, 8.2, 1.5, 0.4);
  }
  // The southwest portal is a true void. The cella and vestibule retain native ground.
  const pier = (2 * p.halfWidth - p.doorWidth) / 2;
  for (const side of [-1, 1]) {
    const v = (side * (p.doorWidth + pier)) / 2,
      lo = grade(p.start, v) - 0.55;
    box(f, 'stone', p.start, lo, v, p.thickness, 11.5 - lo, pier);
    if (detail >= 1)
      for (const [offset, depth] of [
        [0.13, 0.2],
        [0.34, 0.15],
      ])
        box(
          f,
          'trim',
          p.start - 0.72 - offset,
          Y,
          side * (p.doorWidth / 2 + 0.14 + offset / 2),
          depth,
          p.doorHeight + 0.3,
          0.18,
        );
  }
  box(f, 'stone', p.start, Y + p.doorHeight, 0, p.thickness, 11.5 - Y - p.doorHeight, p.doorWidth);
  if (detail >= 1) {
    box(f, 'trim', p.start - 0.76, Y + p.doorHeight, 0, 0.3, 0.55, p.doorWidth + 1.05);
    box(f, 'trim', p.start - 0.83, Y + p.doorHeight + 0.55, 0, 0.5, 0.22, p.doorWidth + 1.5);
  }
  if (detail >= 2)
    for (let i = 0; i < 9; i++)
      box(f, 'trim', p.start - 0.98, Y + p.doorHeight + 0.07, -2 + i * 0.5, 0.17, 0.18, 0.2);
  // Photo-led low rear stone/brick bands; no intact ancient end wall or apse restoration.
  for (const [x, z, w, d] of [
    [21, 6.8, 6, 1.3],
    [21, -6.8, 6, 1.3],
    [24, 0, 1.3, 14.8],
  ]) {
    if (detail === 0) groundBox('rubble', x, z, w, d, 2.9);
    else
      for (let k = 0; k < 8; k++) {
        const lo = k * 0.38,
          hi = lo + 0.38,
          role = k % 2 ? 'brick' : 'rubble';
        prism(
          (role, ps, n) =>
            f(
              role,
              ps.map(([u, y, v]) => [
                u,
                grade(u, v) +
                  (y === 0 ? lo - 0.04 : hi + (k === 7 ? 0.1 * Math.sin(u * 1.1 + v) : 0)),
                v,
              ]),
              n,
            ),
          role,
          rect(x, z, w, d),
          0,
          1,
        );
      }
  }
  const steel = r.steel,
    stations = detail === 0 ? [steel.stations[0], steel.stations.at(-1)] : steel.stations,
    levels = detail === 0 ? [6, 13.1] : steel.levels;
  for (const z of [-steel.halfWidth, steel.halfWidth]) {
    for (const x of stations)
      beam(f, [x, grade(x, z) - 0.25, z], [x, 13.1, z], detail === 0 ? 0.16 : 0.11);
    for (const y of levels) beam(f, [1, y, z], [18, y, z], 0.11);
    for (let i = 0; i < stations.length - 1; i++) {
      const x = stations[i],
        xx = stations[i + 1];
      beam(f, [x, 6, z], [xx, 13.1, z], 0.085);
      if (detail >= 2) beam(f, [x, 13.1, z], [xx, 6, z], 0.085);
    }
  }
  for (const x of stations) beam(f, [x, 13.1, -steel.halfWidth], [x, 13.1, steel.halfWidth], 0.11);
  if (detail >= 1)
    for (let i = 0; i < stations.length - 1; i++)
      beam(
        f,
        [stations[i], 13.1, -steel.halfWidth],
        [stations[i + 1], 13.1, steel.halfWidth],
        0.09,
      );
  // Low separate remnants follow grade rather than forming a new solid precinct slab.
  for (const z of [-10.3, 10.3])
    for (const [x, w, h] of [
      [-23, 6, 0.65],
      [-12, 12, 0.5],
      [3, 13, 0.45],
      [17, 10, 0.6],
    ])
      groundBox('rubble', x, z, w, 1.05, h);
  if (detail >= 1) for (const x of [-26, 26]) groundBox('rubble', x, 0, 1.05, 20.4, 0.5);
  for (const [x, z, radius, h] of r.drums.slice(0, detail === 0 ? 2 : undefined))
    drum(f, x, z, radius, h, grade(x, z), [6, 8, 12, 16][detail]);
  if (detail >= 1) for (const [x, z, w, h, d] of r.blocks) groundBox('rubble', x, z, w, d, h);
  if (detail >= 2) {
    // Sparse original shallow damage recess markers; no readable copied inscription.
    for (const [x, y] of [
      [-10, 3.4],
      [-6, 2.5],
      [-2, 3.1],
      [3, 2.8],
      [8, 3.4],
      [13, 2.6],
    ])
      box(f, 'rubble', x, y, 7.45, 0.24, 0.18, 0.045);
  }
}
