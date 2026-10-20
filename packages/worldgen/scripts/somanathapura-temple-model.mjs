/** 'N0542': three mapped Somanathapura shrine lobes, carved jagati and open precinct. */
import { normalFor } from './authored-structure-mesh.mjs';
import { openingBuilder, prepareOpening } from './authored-wall-openings.mjs';
import {
  hoysalaAedicule,
  hoysalaAnimal,
  hoysalaFigure,
  hoysalaRound,
  hoysalaStar,
} from './hoysala-stone-geometry.mjs';
import { box, loft, prism, rect } from './khmer-structure-geometry.mjs';

export function buildSomanathapuraTemple(face, detail, r, sampleTerrain) {
  const angle = r.architecturalAngleRadians,
    c = Math.cos(angle),
    s = Math.sin(angle),
    F = r.floorY,
    grade = (x, z) => sampleTerrain(c * x - s * z, s * x + c * z),
    f = (role, ps, n) => {
      if (detail === 0 && n[1] < -0.5) return;
      face(
        role,
        ps.map(([x, y, z]) => [c * x - s * z, y, s * x + c * z]),
        [c * n[0] - s * n[2], n[1], s * n[0] + c * n[2]],
      );
    },
    scaled = (x, y, z, scale, normal) => {
      const length = Math.hypot(...normal),
        n = normal.map((v) => v / length),
        u = [n[1], -n[0]];
      return (role, ps, no) =>
        f(
          role,
          ps.map(([a, b, d]) => [
            x + (u[0] * a + n[0] * d) * scale,
            y + b * scale,
            z + (u[1] * a + n[1] * d) * scale,
          ]),
          [u[0] * no[0] + n[0] * no[2], no[1], u[1] * no[0] + n[1] * no[2]],
        );
    };
  const boundarySamples = (ring) =>
      ring.flatMap((a, i) => {
        const b = ring[(i + 1) % ring.length],
          n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 2);
        return Array.from({ length: n + 1 }, (_, k) => [
          a[0] + ((b[0] - a[0]) * k) / n,
          a[1] + ((b[1] - a[1]) * k) / n,
        ]);
      }),
    low = Math.min(...boundarySamples(r.base.outline).map((p) => grade(...p))) - 0.6;
  const base =
    detail <= 1 ? { outline: r.controls[0].localPolygons[0].outline, holes: [] } : r.base;
  prism(f, 'wall', base, low, F + 1.15);
  // Multiple projecting star-following plinth bands remain actual geometry.
  if (detail > 0) {
    const center = [-6, -4];
    for (const [y, w, h] of detail === 1
      ? [
          [0.1, 1.004, 0.16],
          [1.0, 1.018, 0.15],
        ]
      : [
          [0.1, 1.004, 0.16],
          [0.42, 1.012, 0.12],
          [0.7, 1.006, 0.14],
          [1.0, 1.018, 0.15],
        ])
      prism(
        f,
        'trim',
        {
          outline: base.outline.map((p) => p.map((v, k) => center[k] + (v - center[k]) * w)),
          holes: [],
        },
        F + y,
        F + y + h,
      );
  }
  // Three shrine stars continue through the wall mouldings and the layered roof silhouettes.
  for (const shrine of r.shrines) {
    const [x, z] = shrine.center,
      teeth = detail <= 1 ? 4 : detail === 2 ? 8 : 16;
    const footprint = (w) => hoysalaStar(0, 0, w / 2, teeth);
    loft(
      f,
      'wall',
      x,
      z,
      [
        [F + 1.15, shrine.radius * 2],
        [F + 6.2, shrine.radius * 2],
      ],
      false,
      footprint,
    );
    const profile =
      detail === 0
        ? [
            [6.2, 8.9],
            [8.3, 6.4],
            [10.3, 3.5],
          ]
        : detail === 1
          ? [
              [6.2, 8.9],
              [6.55, 8.9],
              [7.1, 7.4],
              [7.35, 7.8],
              [8.1, 6.4],
              [8.35, 6.8],
              [9.2, 5.2],
              [9.45, 5.6],
              [10.3, 3.5],
            ]
          : [
              [6.2, 8.9],
              [6.4, 9.0],
              [6.65, 8.2],
              [6.85, 8.2],
              [7.05, 7.4],
              [7.2, 7.9],
              [7.42, 7.9],
              [7.65, 7.1],
              [8.05, 6.4],
              [8.2, 6.9],
              [8.42, 6.9],
              [8.68, 6.1],
              [9.08, 5.3],
              [9.22, 5.8],
              [9.44, 5.8],
              [9.7, 4.8],
              [10.05, 4.1],
              [10.3, 3.5],
            ];
    loft(
      f,
      'wall',
      x,
      z,
      profile.map(([y, w]) => [F + y, w]),
      false,
      footprint,
    );
    hoysalaRound(
      f,
      'trim',
      x,
      z,
      detail === 0
        ? [
            [F + 10.3, 3.6],
            [F + 11.05, 1.3],
            [F + 11.5, 0.12],
          ]
        : [
            [F + 10.3, 3.6],
            [F + 10.5, 3.8],
            [F + 10.85, 2.7],
            [F + 11.05, 1.3],
            [F + 11.2, 0.45],
            [F + 11.5, 0.12],
          ],
      detail === 0 ? 4 : detail === 1 ? 6 : 12,
    );
    if (detail > 0) {
      for (const [y, w, h] of detail === 1
        ? [
            [1.4, 8.5, 0.16],
            [5.9, 8.8, 0.18],
          ]
        : [
            [1.4, 8.5, 0.16],
            [1.8, 8.4, 0.16],
            [2.2, 8.55, 0.16],
            [2.55, 8.35, 0.14],
            [4.5, 8.7, 0.2],
            [5.9, 8.8, 0.18],
          ])
        prism(f, 'trim', { outline: hoysalaStar(x, z, w / 2, teeth), holes: [] }, F + y, F + y + h);
    }
    if (detail >= 2) {
      const count = detail === 2 ? 8 : 16;
      for (let k = 0; k < count; k++) {
        const a = (k * Math.PI * 2) / count,
          n = [Math.cos(a), Math.sin(a)],
          p = [x + n[0] * 4.12, z + n[1] * 4.12];
        hoysalaFigure(scaled(p[0], F + 2.85, p[1], 0.92, n), detail);
        if (detail >= 3 || k % 2 === 0)
          hoysalaAedicule(scaled(p[0], F + 4.8, p[1], 0.88, n), detail);
      }
      // Original miniature shrine registers follow all faces of each receding tower.
      for (let tier = 0; tier < (detail === 2 ? 2 : 4); tier++) {
        const y = F + 6.65 + tier * 0.92,
          radius = [4.18, 3.62, 3.48, 2.94][tier],
          count = detail === 2 ? 2 : 8;
        for (let k = 0; k < count; k++) {
          const a = (k * Math.PI * 2) / count,
            n = [Math.cos(a), Math.sin(a)];
          hoysalaAedicule(
            scaled(x + n[0] * radius, y, z + n[1] * radius, 0.55 - tier * 0.055, n),
            detail,
          );
        }
      }
      // Two low, sparse animal/leaf rhythms convey the carved register without copying stories.
      for (const y of detail === 2 ? [] : [1.48, 2.27])
        for (let k = 0; k < (detail === 2 ? 8 : 24); k++) {
          const a = (k * Math.PI * 2) / (detail === 2 ? 8 : 24),
            n = [Math.cos(a), Math.sin(a)];
          hoysalaAnimal(scaled(x + n[0] * 4.2, F + y, z + n[1] * 4.2, 0.55, n));
        }
    }
  }
  box(f, 'wall', -10.2, F + 1.15, -4, 7.3, 4.25, 4.8);
  box(f, 'wall', -10.2, F + 5.4, -4, 7.7, 0.35, 5.2);
  // Hollow mandapa shell with a true eastern rectangular doorway and shallow dark interior.
  const m = r.mandapa,
    outer = rect(...m.center, m.width, m.depth),
    inner = rect(...m.center, m.width - 1.2, m.depth - 1.2),
    front = m.center[0] + m.width / 2,
    door = {
      center: [front, -4],
      axis: [0, -1],
      depth: 2,
      shape: 'rect',
      width: 2.25,
      bottom: F + 1.15,
      height: 3.15,
    },
    cut = openingBuilder({ addTriangle: (role, _ref, ps, n) => f(role, ps, n) }, [
      prepareOpening(door, 0, detail),
    ]),
    wall = (role, ps, n) => {
      for (let i = 1; i < ps.length - 1; i++) {
        const t = [ps[0], ps[i], ps[i + 1]];
        if (Math.hypot(...normalFor(...t)) > 0.5)
          cut.addTriangle(role, 'palette:#ffffff', t, n, [], []);
      }
    };
  prism(wall, 'wall', { outline: outer.outline, holes: [inner.outline] }, F + 1.15, F + 5.4);
  box(f, 'inset', front - 1.5, F + 1.17, -4, 0.08, 3.1, 2.2);
  for (const sign of [-1, 1])
    box(f, 'trim', front + 0.06, F + 1.15, -4 + sign * 1.23, 0.32, 3.45, 0.25);
  box(f, 'trim', front + 0.06, F + 4.4, -4, 0.4, 0.38, 2.8);
  loft(
    f,
    'wall',
    ...m.center,
    detail === 0
      ? [
          [F + 5.4, 17.4],
          [F + 5.8, 16.9],
          [F + 6.2, 15.8],
        ]
      : [
          [F + 5.4, 17.4],
          [F + 5.58, 18],
          [F + 5.8, 16.9],
          [F + 6.05, 16.4],
          [F + 6.2, 15.8],
        ],
    false,
    (w) => rect(0, 0, w, (w * m.depth) / m.width).outline,
  );
  if (detail >= 2) {
    for (const sign of [-1, 1])
      for (let k = 0; k < 6; k++) {
        const x = -6.5 + k * 2.7,
          n = [0, sign];
        hoysalaAedicule(scaled(x, F + 3.3, -4 + sign * 5.15, detail === 1 ? 0.55 : 0.8, n), detail);
      }
    for (const x of [0.2, 4.3, 7.3])
      hoysalaRound(
        f,
        'trim',
        x,
        -4,
        [
          [F + 6.2, 1.6],
          [F + 6.35, 1.9],
          [F + 6.75, 1.2],
          [F + 7.05, 0.2],
        ],
        detail === 1 ? 4 : 8,
      );
  }
  if (detail >= 2) {
    for (const sign of [-1, 1]) {
      for (const y of [1.5, 1.9, 2.3, 4.65, 5.1])
        box(f, 'trim', front + 0.07, F + y, -4 + sign * 3.22, 0.23, 0.11, 3.55);
      for (let k = 0; k < 2; k++) {
        const z = -4 + sign * (1.55 + k * 0.24);
        box(f, 'trim', front + 0.14, F + 1.16, z, 0.35, 3.15, 0.14);
        box(f, 'trim', front + 0.14, F + 4.4 + k * 0.14, -4, 0.35, 0.1, 3.2 + k * 0.4);
      }
      hoysalaFigure(scaled(front + 0.17, F + 2.8, -4 + sign * 2.75, 0.91, [1, 0]), detail);
      hoysalaAedicule(scaled(front + 0.14, F + 4.55, -4 + sign * 3.4, 0.62, [1, 0]), detail);
      if (detail >= 3) {
        for (const d of [2, 4.5])
          hoysalaAedicule(scaled(front + 0.14, F + 2.5, -4 + sign * d, 0.82, [1, 0]), detail);
        hoysalaFigure(scaled(front + 0.18, F + 2.8, -4 + sign * 4.4, 0.91, [1, 0]), detail);
      }
    }
  }
  // Main entrance steps and small cheek plinths remain local to the jagati.
  const steps = detail === 0 ? 3 : 6;
  for (let k = 0; k < steps; k++) {
    const x = 9.7 + k * 0.45,
      top = F + 1.15 - k * (1.15 / steps),
      bottom = Math.min(grade(x, -4) - 0.3, top - 0.15);
    box(f, 'trim', x, bottom, -4, 0.48, top - bottom, 4.5);
  }
  if (detail >= 2)
    for (const sign of [-1, 1]) {
      box(f, 'wall', 10.4, F, -4 + sign * 3, 0.95, 1.1, 1.15);
      hoysalaAnimal(scaled(10.4, F + 1.05, -4 + sign * 3, 1.2, [1, 0]));
    }
  // The unresolved enclosure is explicitly picture-led, with real open pillar bays.
  const e = r.enclosure,
    sections = [
      [
        [e.west, e.north],
        [e.east, e.north],
        [0, 1],
      ],
      [
        [e.west, e.south],
        [e.east, e.south],
        [0, -1],
      ],
      [
        [e.west, e.north],
        [e.west, e.south],
        [1, 0],
      ],
      [
        [e.east, e.north],
        [e.east, -7.5],
        [-1, 0],
      ],
      [
        [e.east, -0.5],
        [e.east, e.south],
        [-1, 0],
      ],
    ];
  for (const [A, B, n] of sections) {
    const length = Math.hypot(B[0] - A[0], B[1] - A[1]),
      axis = [(B[0] - A[0]) / length, (B[1] - A[1]) / length],
      bays = Math.max(
        1,
        Math.round(length / (detail === 0 ? 24 : detail === 1 ? 7 : detail === 2 ? 6 : 3.5)),
      ),
      at = (t, depth, y) => [
        A[0] + axis[0] * t + n[0] * depth,
        y,
        A[1] + axis[1] * t + n[1] * depth,
      ],
      long = (role, t0, t1, d0, d1, lo, hi) =>
        prism(
          f,
          role,
          {
            outline: [at(t0, d0, 0), at(t1, d0, 0), at(t1, d1, 0), at(t0, d1, 0)].map((p) => [
              p[0],
              p[2],
            ]),
            holes: [],
          },
          lo,
          hi,
        );
    for (let k = 0; k < bays; k++) {
      const t0 = (k * length) / bays,
        t1 = ((k + 1) * length) / bays,
        G = Math.max(
          grade(...at(t0, 0, 0).filter((_, k) => k !== 1)),
          grade(...at(t1, 0, 0).filter((_, k) => k !== 1)),
        );
      long('outer', t0, t1, 0, 0.5, G - 0.6, G + 3.35);
      long('wall', t0, t1, 0, e.depth, G + 3.35, G + 3.65);
      if (detail > 0) {
        long('trim', t0, t1, -0.12, e.depth + 0.2, G + 3.65, G + 3.85);
        long('trim', t0, t1, 0, e.depth, G - 0.35, G + 0.12);
      }
    }
    for (let k = 0; k <= bays; k++) {
      const p = at((k * length) / bays, e.depth - 0.35, 0),
        G = grade(p[0], p[2]);
      if (detail <= 1) box(f, 'wall', p[0], G - 0.35, p[2], 0.55, 3.75, 0.55);
      else {
        const sides = detail === 2 ? 6 : 10,
          profile =
            detail === 2
              ? [
                  [G - 0.3, 0.65],
                  [G + 0.5, 0.55],
                  [G + 2.8, 0.43],
                  [G + 3.4, 0.7],
                ]
              : [
                  [G - 0.3, 0.75],
                  [G + 0.5, 0.75],
                  [G + 0.6, 0.6],
                  [G + 0.78, 0.68],
                  [G + 0.95, 0.5],
                  [G + 1.12, 0.58],
                  [G + 1.3, 0.45],
                  [G + 2.3, 0.43],
                  [G + 2.5, 0.6],
                  [G + 2.68, 0.82],
                  [G + 2.9, 0.72],
                  [G + 3.35, 0.72],
                ];
        hoysalaRound(f, 'trim', p[0], p[2], profile, sides);
      }
    }
  }
  // East gate pavilion: paired turned pillars and actual unobstructed passage.
  const gate = r.gate,
    G = Math.max(
      ...[-1, 1].flatMap((i) =>
        [-1, 1].map((j) => grade(gate.x + (i * gate.depth) / 2, gate.z + (j * gate.width) / 2)),
      ),
    );
  for (const i of [-1, 1])
    for (const j of [-1, 1]) {
      const x = gate.x + (i * gate.depth) / 2,
        z = gate.z + (j * gate.width) / 2;
      if (detail <= 1)
        box(f, 'wall', x, grade(x, z) - 0.5, z, 0.75, G + gate.height - grade(x, z) + 0.5, 0.75);
      else
        hoysalaRound(
          f,
          'wall',
          x,
          z,
          [
            [grade(x, z) - 0.5, 0.95],
            [G + 0.5, 0.95],
            [G + 0.8, 0.7],
            [G + 1, 0.85],
            [G + 2.8, 0.56],
            [G + 3.1, 1.1],
            [G + 4.2, 1.0],
          ],
          detail === 2 ? 8 : 12,
        );
    }
  box(f, 'wall', gate.x, G + 4.2, gate.z, gate.depth + 1.3, 0.55, gate.width + 1.3);
  if (detail > 0) box(f, 'trim', gate.x, G + 4.75, gate.z, gate.depth + 1.6, 0.2, gate.width + 1.6);
  const pillar = r.pillar,
    PG = grade(pillar.x, pillar.z);
  box(f, 'outer', pillar.x, PG - 0.5, pillar.z, 1.9, 0.8, 1.9);
  box(f, 'trim', pillar.x, PG + 0.3, pillar.z, 0.8, pillar.height, 0.8);
}
