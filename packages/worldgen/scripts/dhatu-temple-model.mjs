/** 'N0560': round gilded Dhatu Jadi shrine, eight stupas and mapped upper approach. */
import { openingBuilder, openingReveals, prepareOpening } from './authored-wall-openings.mjs';
import { box, loft, prism, rect } from './khmer-structure-geometry.mjs';

export function buildDhatuTemple(face, detail, r, sample) {
  const c = Math.cos(r.architecturalAngleRadians),
    s = Math.sin(r.architecturalAngleRadians),
    F = r.floorY,
    point = ([x, y, z]) => [x * c - z * s, F + y, x * s + z * c],
    f = (role, ps, n) =>
      face(role, ps.map(point), [n[0] * c - n[2] * s, n[1], n[0] * s + n[2] * c]),
    grade = (x, z) => {
      const p = point([x, 0, z]);
      return sample(p[0], p[2]) - F;
    },
    circle = (n) => (w) =>
      Array.from({ length: n }, (_, i) => [
        (Math.cos((i * Math.PI * 2) / n) * w) / 2,
        (Math.sin((i * Math.PI * 2) / n) * w) / 2,
      ]),
    radial =
      (a, x = 0, z = 0) =>
      (role, ps, n) => {
        const co = Math.cos(a),
          si = Math.sin(a);
        f(
          role,
          ps.map(([u, y, v]) => [x + u * co - v * si, y, z + u * si + v * co]),
          [n[0] * co - n[2] * si, n[1], n[0] * si + n[2] * co],
        );
      },
    band = (role, x, z, y, width, thickness, n) =>
      loft(
        f,
        role,
        x,
        z,
        [
          [y, width],
          [y + thickness, width],
        ],
        false,
        circle(n),
      );
  const arcCount = [9, 10, 40, 64][detail],
    terrace = [
      [41, -5],
      [41, 5],
      ...Array.from({ length: arcCount + 1 }, (_, i) => {
        const a = ((65 + (i * 230) / arcCount) * Math.PI) / 180;
        return [Math.cos(a) * r.radius, Math.sin(a) * r.radius];
      }),
    ];
  const coarseLow =
    Math.min(
      ...terrace.flatMap((a, i) => {
        const b = terrace[(i + 1) % terrace.length],
          n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 2);
        return Array.from({ length: n + 1 }, (_, j) =>
          grade(a[0] + ((b[0] - a[0]) * j) / n, a[1] + ((b[1] - a[1]) * j) / n),
        );
      }),
    ) - 0.6;
  for (let i = 0; i < terrace.length; i++) {
    const start = terrace[i],
      end = terrace[(i + 1) % terrace.length],
      n = detail < 2 ? 1 : Math.ceil(Math.hypot(end[0] - start[0], end[1] - start[1]) / 4);
    for (let j = 0; j < n; j++) {
      const at = (t) => start.map((v, k) => v + (end[k] - v) * t),
        a = at(j / n),
        b = at((j + 1) / n),
        m = at((j + 0.5) / n),
        low = detail < 2 ? coarseLow : Math.min(grade(...a), grade(...b), grade(...m), -0.2) - 0.6;
      f(
        'stone',
        [
          [a[0], low, a[1]],
          [b[0], low, b[1]],
          [b[0], -0.15, b[1]],
          [a[0], -0.15, a[1]],
        ],
        [b[1] - a[1], 0, a[0] - b[0]],
      );
    }
  }
  prism(f, 'paving', { outline: terrace }, -0.15, 0, false);
  // Original restrained meanders/radial bands; no traced image or bespoke texture atlas.
  if (detail >= 2)
    for (let i = 0; i < 24; i++) {
      const a = (i * Math.PI) / 12,
        co = Math.cos(a),
        si = Math.sin(a),
        P = (u, v) => [co * u - si * v, 0.015, si * u + co * v],
        line = (u0, v0, u1, v1, w = 0.09) => {
          const dx = u1 - u0,
            dz = v1 - v0,
            L = Math.hypot(dx, dz),
            nx = ((-dz / L) * w) / 2,
            nz = ((dx / L) * w) / 2;
          f(
            'pattern',
            [P(u0 + nx, v0 + nz), P(u1 + nx, v1 + nz), P(u1 - nx, v1 - nz), P(u0 - nx, v0 - nz)],
            [0, 1, 0],
          );
        };
      line(13.4, -0.9, 17.5, -0.9);
      line(17.5, -0.9, 17.5, 0.9);
      line(17.5, 0.9, 14.4, 0.9);
      line(14.4, 0.9, 14.4, -0.1);
      line(14.4, -0.1, 16.3, -0.1);
      line(16.3, -0.1, 16.3, 0.4);
    }
  if (detail === 0)
    prism(
      f,
      'pale',
      { outline: terrace, holes: [terrace.map((p) => p.map((v) => v * 0.985))] },
      0.6,
      0.76,
      false,
    );
  else
    for (let i = 0; i < terrace.length; i++) {
      const a = terrace[i],
        b = terrace[(i + 1) % terrace.length],
        dx = b[0] - a[0],
        dz = b[1] - a[1],
        L = Math.hypot(dx, dz),
        n = Math.max(1, Math.ceil(L / (detail === 1 ? 9 : 3.6))),
        nx = (-dz / L) * 0.085,
        nz = (dx / L) * 0.085;
      prism(
        f,
        'pale',
        {
          outline: [
            [a[0] + nx, a[1] + nz],
            [b[0] + nx, b[1] + nz],
            [b[0] - nx, b[1] - nz],
            [a[0] - nx, a[1] - nz],
          ],
        },
        0.64,
        0.76,
        false,
      );
      for (let k = 0; k < n; k++) {
        const t = k / n,
          x = a[0] + t * dx,
          z = a[1] + t * dz;
        box(f, 'blue', x, 0, z, 0.23, 0.8, 0.23);
        if (detail >= 2) box(f, 'gold', x, 0.8, z, 0.3, 0.08, 0.3);
      }
    }

  const n = [12, 24, 32, 64][detail],
    outer = circle(n)(20),
    inner = circle(n)(18.9),
    holes = [
      {
        center: [9.7, 0],
        axis: [0, 1],
        width: 2.7,
        bottom: 0,
        height: 3.6,
        depth: 2,
        shape: 'rectangle',
      },
    ];
  if (detail >= 2)
    for (let i = 1; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      holes.push({
        center: [Math.cos(a) * 9.7, Math.sin(a) * 9.7],
        axis: [-Math.sin(a), Math.cos(a)],
        width: 1.6,
        bottom: 0.75,
        height: 2.5,
        spring: 1.6,
        depth: 2,
        shape: 'round',
      });
    }
  const prepared = holes.map((h) => prepareOpening(h, 0, detail)),
    adapter = { addTriangle: (_role, _ref, ps, n) => f('yellow', ps, n) },
    clipped = openingBuilder(adapter, prepared),
    cut = (role, ps, n) => {
      for (let i = 1; i < ps.length - 1; i++)
        clipped.addTriangle(role, 'palette:#ffffff', [ps[0], ps[i], ps[i + 1]], n);
    };
  if (detail === 0) prism(f, 'yellow', { outline: outer }, 0, 4.85, false);
  else {
    prism(cut, 'yellow', { outline: outer, holes: [inner] }, 0, 4.85, false);
    openingReveals(
      adapter,
      outer,
      () => 0,
      () => 4.85,
      prepared,
      undefined,
    );
  }
  for (let i = 0; i < holes.length; i++) {
    const a = (i * Math.PI) / 4,
      rf = radial(a);
    box(
      rf,
      'inset',
      9.43,
      i === 0 ? 0.03 : 0.8,
      0,
      0.07,
      i === 0 ? 3.5 : 2.4,
      i === 0 ? 2.65 : 1.55,
    );
    if (detail >= 2)
      for (let k = 0; k < (detail === 3 ? (i === 0 ? 9 : 5) : i === 0 ? 7 : 3); k++)
        box(
          rf,
          'gold',
          9.49,
          i === 0 ? 0.06 : 0.85,
          (k - (detail === 3 ? (i === 0 ? 4 : 2) : i === 0 ? 3 : 1)) * (detail === 3 ? 0.28 : 0.42),
          0.035,
          i === 0 ? 3.45 : 2.3,
          0.025,
        );
  }
  const count = detail === 0 ? 8 : 16;
  for (let i = 0; i < count; i++) {
    const a = (i * Math.PI * 2) / count,
      rf = radial(a),
      columnFace = (role, ps, n) => {
        if (i !== 0) rf(role, ps, n);
      },
      x = 11.15;
    if (detail === 0) box(columnFace, 'maroon', x, 0, 0, 0.55, 4.85, 0.55);
    else {
      const cn = detail === 1 ? 4 : 8;
      loft(
        columnFace,
        'maroon',
        x,
        0,
        detail === 1
          ? [
              [0, 0.8],
              [0.35, 0.54],
              [4.4, 0.54],
              [4.85, 0.95],
            ]
          : [
              [0, 0.8],
              [0.18, 0.8],
              [0.35, 0.54],
              [4.25, 0.54],
              [4.5, 0.82],
              [4.85, 0.95],
            ],
        false,
        circle(cn),
      );
      bandRadial(columnFace, 'gold', x, 0, 0.25, 0.75, 0.14, cn);
      bandRadial(columnFace, 'gold', x, 0, 4.35, 0.9, 0.23, cn);
      if (detail >= 2)
        for (const y of [1.0, 3.5]) bandRadial(columnFace, 'gold', x, 0, y, 0.59, 0.09, cn);
      const mid = a + Math.PI / count,
        m = radial(mid),
        w = 2 * 11.15 * Math.sin(Math.PI / count),
        bottom =
          detail === 1
            ? [
                [-w / 2, 3.5],
                [0, 4.4],
                [w / 2, 3.5],
              ]
            : [
                [-w / 2, 3.4],
                [-w * 0.4, 3.55],
                [-w * 0.25, 4.12],
                [0, 4.4],
                [w * 0.25, 4.12],
                [w * 0.4, 3.55],
                [w / 2, 3.4],
              ],
        ps = [...bottom, [w / 2, 4.85], [-w / 2, 4.85]].map(([u, y]) => [
          11.15 * Math.cos(Math.PI / count),
          y,
          u,
        ]);
      m('gold', ps, [1, 0, 0]);
      m('gold', ps.toReversed(), [-1, 0, 0]);
      if (detail >= 2)
        for (let k = -1; k <= 1; k++) {
          const z = k * w * 0.23;
          m(
            'maroon',
            [
              [11.16, 4.75, z - 0.17],
              [11.16, 4.52, z],
              [11.16, 4.75, z + 0.17],
            ],
            [1, 0, 0],
          );
        }
    }
  }
  function bandRadial(rf, role, x, z, y, w, h, n) {
    loft(
      rf,
      role,
      x,
      z,
      [
        [y, w],
        [y + h, w],
      ],
      false,
      circle(n),
    );
  }
  loft(
    f,
    'gold',
    0,
    0,
    [
      [4.85, 24],
      [5.03, 24.7],
      [5.28, 24.2],
    ],
    false,
    circle(n),
  );
  prism(f, 'stone', { outline: circle(n)(23.7) }, 5.28, 5.4, false);
  prism(f, 'maroon', { outline: circle(n)(24.2), holes: [circle(n)(23.8)] }, 5.4, 5.92, false);
  if (detail >= 2)
    for (let i = 0; i < 48; i++) {
      const a = (i * Math.PI) / 24,
        rf = radial(a);
      rf(
        'maroon',
        [
          [12.1, 5.85, -0.31],
          [12.1, 6.17, -0.18],
          [12.1, 6.3, 0],
          [12.1, 6.17, 0.18],
          [12.1, 5.85, 0.31],
        ],
        [1, 0, 0],
      );
    }

  const profile = [
    [0, 2],
    [0.04, 2],
    [0.08, 1.86],
    [0.13, 1.8],
    [0.22, 1.5],
    [0.29, 1.12],
    [0.33, 0.83],
    [0.4, 0.72],
    [0.5, 0.5],
    [0.56, 0.48],
    [0.61, 0.35],
    [0.68, 0.34],
    [0.73, 0.27],
    [0.77, 0.23],
    [0.82, 0.19],
    [0.88, 0.07],
    [1, 0.03],
  ];
  const stupa = (x, z, base, radius, height, main) => {
    const sn = main ? [8, 12, 24, 48][detail] : [4, 6, 10, 20][detail],
      points =
        detail === 0
          ? [profile[0], profile[4], profile[9], profile.at(-1)]
          : detail === 1
            ? [
                profile[0],
                profile[2],
                profile[4],
                profile[6],
                profile[9],
                profile[12],
                profile.at(-1),
              ]
            : detail === 2 && !main
              ? [0, 2, 4, 6, 8, 10, 12, 14, 16].map((i) => profile[i])
              : profile;
    loft(
      f,
      'gold',
      x,
      z,
      points.map(([y, w]) => [base + y * height, w * radius]),
      false,
      circle(sn),
    );
    if (detail >= 2 && main)
      for (let i = 0; i < (detail === 3 ? 12 : 4); i++) {
        const t = 0.33 + i * 0.019,
          y = base + t * height,
          k = profile.findIndex((p) => p[0] >= t),
          lo = profile[k - 1],
          hi = profile[k],
          w = (lo[1] + ((hi[1] - lo[1]) * (t - lo[0])) / (hi[0] - lo[0])) * radius;
        loft(
          f,
          'gold',
          x,
          z,
          [
            [y, w + 0.1],
            [y + 0.065, w + 0.15],
            [y + 0.12, w],
          ],
          false,
          circle(sn),
        );
      }
    if (main) {
      const top = base + height;
      if (detail < 2)
        loft(
          f,
          'gold',
          x,
          z,
          [
            [top, 0.65],
            [top + 2.35, 0.04],
          ],
          false,
          circle(4),
        );
      else {
        band('gold', x, z, top, 0.08, 2.35, 6);
        for (const [y, w] of [
          [top + 0.25, 0.85],
          [top + 0.65, 1.05],
          [top + 1.05, 0.8],
        ]) {
          prism(
            f,
            'gold',
            { outline: circle(12)(w), holes: [circle(12)(w - 0.12)] },
            y,
            y + 0.055,
            false,
          );
        }
        for (let i = 0; i < 8; i++) {
          const a = (i * Math.PI) / 4;
          band('gold', x + Math.cos(a) * 0.39, z + Math.sin(a) * 0.39, top + 0.17, 0.025, 1.12, 4);
        }
        loft(
          f,
          'gold',
          x,
          z,
          [
            [top + 1.3, 0.5],
            [top + 1.7, 0.15],
            [top + 2.35, 0.02],
          ],
          false,
          circle(8),
        );
      }
    }
  };
  stupa(0, 0, 5.4, 6.4, 10.55, true);
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    stupa(Math.cos(a) * 8.7, Math.sin(a) * 8.7, 5.4, 1.5, 6.0, false);
  }

  // Original framed entry geometry; the dark grille is recessed at the cylindrical shrine.
  for (const hand of [-1, 1]) {
    box(f, 'gold', 12.7, 0, hand * 1.8, 0.65, 4.6, 0.55);
    if (detail >= 2)
      for (const y of [0.2, 1, 3.8, 4.35])
        box(f, 'maroon', 13.04, y, hand * 1.8, 0.055, 0.09, 0.42);
  }
  box(f, 'gold', 11.2, 4.55, 0, 4.6, 0.3, 4.5);
  const front = radial(0),
    crest = [
      [-2.45, 4.85],
      [-2.0, 5.0],
      [-1.5, 5.4],
      [0, 6.15],
      [1.5, 5.4],
      [2, 5.0],
      [2.45, 4.85],
    ];
  front(
    'gold',
    crest.map(([z, y]) => [13.48, y, z]),
    [1, 0, 0],
  );
  if (detail >= 2) {
    front(
      'maroon',
      [
        [-2.1, 4.91],
        [0, 5.9],
        [2.1, 4.91],
      ].map(([z, y]) => [13.49, y, z]),
      [1, 0, 0],
    );
    for (let k = -4; k <= 4; k++) {
      const z = k * 0.45;
      front(
        'gold',
        [
          [13.51, 4.94, z - 0.09],
          [13.51, 5.12, z],
          [13.51, 4.94, z + 0.09],
        ],
        [1, 0, 0],
      );
    }
  }

  // The distant pointed-end canopy is a separate dark/gold tiered structure.
  for (const x of [33.6, 38.4])
    for (const z of [-2.4, 2.4]) box(f, 'gold', x, 0, z, 0.33, 3.2, 0.33);
  if (detail === 0)
    loft(
      f,
      'inset',
      36,
      0,
      [
        [3.2, 6.3],
        [4.8, 3.7],
        [6.2, 0.15],
      ],
      false,
    );
  else
    for (let i = 0; i < 4; i++) {
      const y = 3.2 + i * 0.7,
        w = 6.6 - i * 1.35;
      loft(
        f,
        'inset',
        36,
        0,
        [
          [y, w],
          [y + 0.62, w - 1.2],
        ],
        false,
      );
      const p = rect(36, 0, w, w);
      prism(
        f,
        'gold',
        { outline: p.outline, holes: [rect(36, 0, w - 0.16, w - 0.16).outline] },
        y,
        y + 0.06,
        false,
      );
    }
  box(f, 'gold', 36, 5.87, 0, 0.06, 0.88, 0.06);

  if (detail >= 1)
    for (let i = 0; i < 8; i++) {
      const a = ((i + 0.5) * Math.PI) / 4,
        x = Math.cos(a) * 13,
        z = Math.sin(a) * 13;
      box(f, 'blue', x, 0, z, 0.9, 0.27, 0.9);
      if (detail === 1) {
        loft(
          f,
          'gold',
          x,
          z,
          [
            [0.27, 0.8],
            [0.8, 0.45],
            [1.1, 0.15],
          ],
          false,
          circle(4),
        );
        continue;
      }
      const fn = detail === 2 ? 6 : 10;
      loft(
        f,
        'gold',
        x,
        z,
        [
          [0.27, 0.9],
          [0.4, 1.15],
          [0.55, 0.85],
          [0.66, 0.48],
          [1.08, 0.43],
          [1.17, 0.27],
        ],
        false,
        circle(fn),
      );
      loft(
        f,
        'gold',
        x,
        z,
        [
          [1.12, 0.13],
          [1.2, 0.3],
          [1.4, 0.3],
          [1.5, 0.13],
          [1.57, 0.07],
        ],
        false,
        circle(fn),
      );
      const rf = radial(a, x, z);
      box(rf, 'gold', 0.11, 0.65, 0, 0.22, 0.13, 0.48);
      band('gold', x, z, 1.55, 0.035, 0.75, 4);
      loft(
        f,
        'pale',
        x,
        z,
        [
          [2.02, 1.0],
          [2.22, 0.6],
          [2.3, 0.04],
        ],
        false,
        circle(detail === 2 ? 8 : 12),
      );
    }

  // Pinned three-point upper stair route; preserve the original host paths underneath.
  for (let j = 0; j < r.path.length - 1; j++) {
    const a = r.path[j],
      b = r.path[j + 1],
      dx = b.x - a.x,
      dz = b.z - a.z,
      L = Math.hypot(dx, dz),
      ux = dx / L,
      uz = dz / L,
      n = Math.ceil(L / [12, 4, 0.9, 0.55][detail]),
      side = [-uz, ux];
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n,
        x = a.x + dx * t,
        z = a.z + dz * t,
        ends = [-1, 1].flatMap((u) =>
          [-1, 1].map((v) => [
            x + ((ux * L) / n / 2) * u + side[0] * 1.5 * v,
            z + ((uz * L) / n / 2) * u + side[1] * 1.5 * v,
          ]),
        ),
        top = Math.max(a.y + ((b.y - a.y) * i) / n, ...ends.map((p) => grade(...p) + 0.1)),
        low = Math.min(...ends.map((p) => grade(...p))) - 0.3;
      const p = { outline: [ends[0], ends[2], ends[3], ends[1]] };
      prism(f, 'pale', p, low, top, false);
      if (detail >= 1)
        for (const hand of [-1, 1]) {
          const at = (u, y) => [
              a.x + dx * u + side[0] * hand * 1.55,
              y,
              a.z + dz * u + side[1] * hand * 1.55,
            ],
            y0 = top + 0.88,
            y1 = Math.max(b.y, a.y + ((b.y - a.y) * (i + 1)) / n) + 0.88,
            ps = [
              at(i / n, y0),
              at((i + 1) / n, y1),
              at((i + 1) / n, y1 + 0.08),
              at(i / n, y0 + 0.08),
            ],
            normal = [side[0] * hand, 0, side[1] * hand];
          f('pale', ps, normal);
          f(
            'pale',
            ps.toReversed(),
            normal.map((v) => -v),
          );
          if (i % Math.max(1, Math.ceil(3.5 / (L / n))) === 0) {
            const p = at(i / n, top);
            box(f, 'blue', p[0], top, p[2], 0.12, 0.96, 0.12);
          }
        }
    }
  }
  const a = r.path[0],
    b = r.path[1],
    gateAngle = Math.atan2(b.z - a.z, b.x - a.x),
    gate = radial(gateAngle, a.x, a.z);
  for (const hand of [-1, 1]) box(gate, 'gold', 0, 0, hand * 1.8, 0.42, 3.8, 0.42);
  box(gate, 'gold', 0, 3.55, 0, 0.55, 0.3, 4.3);
  const gateCrest = [
    [-2.35, 3.8],
    [-2.05, 4.25],
    [-1.6, 4.05],
    [0, 4.65],
    [1.6, 4.05],
    [2.05, 4.25],
    [2.35, 3.8],
  ].map(([z, y]) => [0.3, y, z]);
  gate('gold', gateCrest, [1, 0, 0]);
  gate('gold', gateCrest.toReversed(), [-1, 0, 0]);
}
