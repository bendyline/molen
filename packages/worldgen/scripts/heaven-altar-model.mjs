/** Circular Mound terraces and hollow precincts, from retained standard map controls. */
import './install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';

const frame = JSON.parse(
  readFileSync(
    new URL(
      '../../../content/worldgen/source/places/wx/wx4/n0488_temple_of_heaven/map-frame.json',
      import.meta.url,
    ),
  ),
);
if (frame.candidateId !== 'N0488') throw new Error('Wrong Circular Mound source');
const rec = frame.reconstruction.altar;
const tau = Math.PI * 2;

function workspace(face, center, floor, axis = [1, 0]) {
  const normal = [-axis[1], axis[0]];
  const point = (u, y, v) => [
    center[0] + axis[0] * u + normal[0] * v,
    floor + y,
    center[1] + axis[1] * u + normal[1] * v,
  ];
  const quad = (role, coords, target) =>
    face(
      role,
      coords.map((p) => point(...p)),
      [
        axis[0] * target[0] + normal[0] * target[2],
        target[1],
        axis[1] * target[0] + normal[1] * target[2],
      ],
    );
  const box = (role, u0, u1, v0, v1, lo, hi, bottom = false, flat = false) => {
    quad(
      role,
      [
        [u0, lo, v1],
        [u1, lo, v1],
        [u1, hi, v1],
        [u0, hi, v1],
      ],
      [0, 0, 1],
    );
    quad(
      role,
      [
        [u0, lo, v0],
        [u1, lo, v0],
        [u1, hi, v0],
        [u0, hi, v0],
      ],
      [0, 0, -1],
    );
    if (!flat) {
      quad(
        role,
        [
          [u0, lo, v0],
          [u0, lo, v1],
          [u0, hi, v1],
          [u0, hi, v0],
        ],
        [-1, 0, 0],
      );
      quad(
        role,
        [
          [u1, lo, v0],
          [u1, lo, v1],
          [u1, hi, v1],
          [u1, hi, v0],
        ],
        [1, 0, 0],
      );
      quad(
        role,
        [
          [u0, hi, v0],
          [u1, hi, v0],
          [u1, hi, v1],
          [u0, hi, v1],
        ],
        [0, 1, 0],
      );
    }
    if (bottom)
      quad(
        role,
        [
          [u0, lo, v0],
          [u1, lo, v0],
          [u1, lo, v1],
          [u0, lo, v1],
        ],
        [0, -1, 0],
      );
  };
  return { point, quad, box };
}

/** Compact terrace allocation for the main hall at skyline/district distances only. */
export function buildHeavenCompactTerraces(face, d) {
  const r = frame.reconstruction;
  terraces(
    face,
    {
      center: [0, 0],
      floorY: r.floorY,
      axis: [1, 0],
      stairHalfAngle: r.stairHalfAngle,
      terraces: r.terraces.map((t) => ({ radius: t.outer, bottom: t.bottom, top: t.top })),
    },
    d,
    true,
  );
}

function terraces(face, a, d, principal = false) {
  const w = workspace(face, a.center, a.floorY, a.axis),
    n = [8, 12, 16, 48, 64][d],
    aw = a.stairHalfAngle;
  const rp = (angle, r, y) => w.point(Math.cos(angle) * r, y, Math.sin(angle) * r);
  const angles = [
    ...new Set(
      [
        ...Array.from({ length: n }, (_, i) => (i * tau) / n),
        ...(d === 0
          ? []
          : [0, 1, 2, 3].flatMap((i) => [(i * Math.PI) / 2 - aw, (i * Math.PI) / 2 + aw])),
      ].map((v) => (v + tau) % tau),
    ),
  ].toSorted((a, b) => a - b);
  const radialFace = (role, coords, target) =>
    face(
      role,
      coords.map(([q, r, y]) => rp(q, r, y)),
      target,
    );
  for (const [index, t] of a.terraces.entries()) {
    const nextRadius = a.terraces[index + 1]?.radius ?? 0;
    const inner = nextRadius || t.radius - 4.7;
    for (let i = 0; i < angles.length; i++) {
      const x = angles[i],
        y = angles[(i + 1) % angles.length] + (i === angles.length - 1 ? tau : 0),
        mid = (x + y) / 2;
      const gap = d > 0 && Math.abs(Math.atan2(Math.sin(mid * 4), Math.cos(mid * 4))) / 4 < aw;
      const out = [
        Math.cos(mid) * a.axis[0] - Math.sin(mid) * a.axis[1],
        0,
        Math.cos(mid) * a.axis[1] + Math.sin(mid) * a.axis[0],
      ];
      if (!gap) {
        radialFace(
          'stone',
          [
            [x, t.radius, t.bottom - (index === 0 && !principal ? 0.25 : 0)],
            [y, t.radius, t.bottom - (index === 0 && !principal ? 0.25 : 0)],
            [y, t.radius, t.top],
            [x, t.radius, t.top],
          ],
          out,
        );
        if (nextRadius > 0 || d > 0)
          radialFace(
            'stone',
            [
              [x, t.radius, t.top],
              [y, t.radius, t.top],
              [y, inner, t.top],
              [x, inner, t.top],
            ],
            [0, 1, 0],
          );
        else
          face(
            'stone',
            [w.point(0, t.top, 0), rp(x, t.radius, t.top), rp(y, t.radius, t.top)],
            [0, 1, 0],
          );
      }
      if (d >= 2 && !gap) {
        // A low solid panel and an upper rail leave the characteristic long open slot.
        for (const [lo, hi] of [
          [t.top + 0.08, t.top + 0.55],
          [t.top + 0.88, t.top + 1.0],
        ]) {
          const r = t.radius - 0.26,
            thick = 0.22;
          radialFace(
            'stone',
            [
              [x, r, lo],
              [y, r, lo],
              [y, r, hi],
              [x, r, hi],
            ],
            out,
          );
          radialFace(
            'stone',
            [
              [x, r - thick, lo],
              [y, r - thick, lo],
              [y, r - thick, hi],
              [x, r - thick, hi],
            ],
            out.map((v) => -v),
          );
          radialFace(
            'stone',
            [
              [x, r - thick, hi],
              [y, r - thick, hi],
              [y, r, hi],
              [x, r, hi],
            ],
            [0, 1, 0],
          );
          if (d >= 3)
            radialFace(
              'stone',
              [
                [x, r - thick, lo],
                [y, r - thick, lo],
                [y, r, lo],
                [x, r, lo],
              ],
              [0, -1, 0],
            );
        }
        if (i % (d === 2 ? 2 : 1) === 0) {
          const p = rp(x, t.radius - 0.38, 0),
            post = workspace(face, [p[0], p[2]], a.floorY);
          post.box('stone', -0.16, 0.16, -0.16, 0.16, t.top, t.top + 1.18);
          if (d >= 3) post.box('stone', -0.23, 0.23, -0.23, 0.23, t.top + 1.06, t.top + 1.2);
        }
      }
    }
    if (!nextRadius && d > 0)
      face(
        'stone',
        Array.from({ length: n }, (_, i) => rp((i * tau) / n, inner, t.top)),
        [0, 1, 0],
      );
    for (let side = 0; d > 0 && side < 4; side++) {
      const angle = (side * Math.PI) / 2,
        x = angle - aw,
        y = angle + aw,
        outer = t.radius + (index === 0 ? 2.7 : 0),
        run = outer - inner,
        steps = d < 2 ? 1 : d === 2 ? 5 : 9;
      for (let i = 0; i < steps; i++) {
        const r0 = outer - (run * i) / steps,
          r1 = outer - (run * (i + 1)) / steps,
          lo = t.bottom + ((t.top - t.bottom) * i) / steps,
          hi = t.bottom + ((t.top - t.bottom) * (i + 1)) / steps;
        if (d < 2)
          radialFace(
            'stone',
            [
              [x, r0, lo],
              [y, r0, lo],
              [y, r1, hi],
              [x, r1, hi],
            ],
            [0, 1, 0],
          );
        else {
          radialFace(
            'stone',
            [
              [x, r0, lo],
              [y, r0, lo],
              [y, r0, hi],
              [x, r0, hi],
            ],
            [Math.cos(angle), 0, Math.sin(angle)],
          );
          radialFace(
            'stone',
            [
              [x, r0, hi],
              [y, r0, hi],
              [y, r1, hi],
              [x, r1, hi],
            ],
            [0, 1, 0],
          );
        }
        for (const [q, sign] of [
          [x, -1],
          [y, 1],
        ])
          radialFace(
            'stone',
            [
              [q, r0, lo],
              [q, r1, hi],
              [q, r1, t.bottom],
              [q, r0, t.bottom],
            ],
            [sign * Math.sin(q), 0, -sign * Math.cos(q)],
          );
      }
      if (index === 0 && !principal)
        radialFace(
          'stone',
          [
            [x, outer, -0.25],
            [y, outer, -0.25],
            [y, outer, 0],
            [x, outer, 0],
          ],
          [Math.cos(angle), 0, Math.sin(angle)],
        );
      if (d >= 3 && !principal)
        for (const sign of [-1, 1]) {
          const q = angle + sign * (aw + 0.015),
            r0 = outer,
            r1 = inner || t.radius - 4.7;
          radialFace(
            'stone',
            [
              [q, r0, t.bottom + 0.15],
              [q, r1, t.top + 0.15],
              [q, r1, t.top + 1],
              [q, r0, t.bottom + 1],
            ],
            [sign * Math.sin(q), 0, -sign * Math.cos(q)],
          );
          radialFace(
            'stone',
            [
              [q, r0, t.bottom + 0.15],
              [q, r1, t.top + 0.15],
              [q, r1, t.top + 1],
              [q, r0, t.bottom + 1],
            ],
            [-sign * Math.sin(q), 0, sign * Math.cos(q)],
          );
        }
    }
  }
  if (!principal && d >= 2) {
    const y = a.terraces.at(-1).top + 0.025;
    face(
      'stone',
      Array.from({ length: 12 }, (_, i) => rp((i * tau) / 12, 0.9, y)),
      [0, 1, 0],
    );
  }
}

export function buildHeavenAltar(face, d) {
  if (d === 0) {
    buildHeavenAltarRemote(face);
    return;
  }
  terraces(face, rec, d);
  {
    const floor = workspace(face, rec.outer.center, rec.floorY, rec.axis);
    floor.quad(
      'brick',
      [
        [-rec.outer.halfWidth, -0.04, -rec.outer.halfDepth],
        [rec.outer.halfWidth, -0.04, -rec.outer.halfDepth],
        [rec.outer.halfWidth, -0.04, rec.outer.halfDepth],
        [-rec.outer.halfWidth, -0.04, rec.outer.halfDepth],
      ],
      [0, 1, 0],
    );
  }
  const wall = (a, b) => {
    const dx = b[0] - a[0],
      dz = b[1] - a[1],
      len = Math.hypot(dx, dz),
      w = workspace(face, a, rec.floorY, [dx / len, dz / len]);
    if (len < 0.01) return;
    w.box(
      'gate',
      0,
      len,
      -rec.wallThickness / 2,
      rec.wallThickness / 2,
      -0.2,
      rec.wallHeight,
      false,
      d < 2,
    );
    if (d > 0)
      w.box('roof', 0, len, -0.46, 0.46, rec.wallHeight, rec.wallHeight + 0.25, false, d === 1);
  };
  const ends = (g) =>
    [-1, 1].map((sign) => [
      g.center[0] + (sign * g.axis[0] * g.width) / 2,
      g.center[1] + (sign * g.axis[1] * g.width) / 2,
    ]);
  const circle = rec.gates
    .filter((g) => g.ring === 'inner')
    .map((g) => ({
      g,
      angle:
        (Math.atan2(g.center[1] - rec.round.center[1], g.center[0] - rec.round.center[0]) + tau) %
        tau,
    }))
    .toSorted((a, b) => a.angle - b.angle);
  for (let i = 0; i < 4; i++) {
    const a = circle[i],
      b = circle[(i + 1) % 4],
      end = b.angle + (i === 3 ? tau : 0),
      steps = d === 0 ? 2 : d === 1 ? 3 : d === 2 ? 5 : 10;
    const gapA = Math.asin(a.g.width / (2 * rec.round.radius)),
      gapB = Math.asin(b.g.width / (2 * rec.round.radius));
    const on = (angle) => [
      rec.round.center[0] + Math.cos(angle) * rec.round.radius,
      rec.round.center[1] + Math.sin(angle) * rec.round.radius,
    ];
    const start = on(a.angle + gapA),
      finish = on(end - gapB);
    const near = (g, p) =>
      ends(g).toSorted(
        (a, b) => Math.hypot(a[0] - p[0], a[1] - p[1]) - Math.hypot(b[0] - p[0], b[1] - p[1]),
      )[0];
    let previous = near(a.g, start);
    for (let j = 1; j < steps; j++) {
      const next = on(a.angle + gapA + ((end - gapB - a.angle - gapA) * j) / steps);
      wall(previous, next);
      previous = next;
    }
    wall(previous, near(b.g, finish));
  }
  const outer = rec.gates.filter((g) => g.ring === 'outer'),
    c = rec.outer.center;
  const world = (u, v) => [
    c[0] + u * rec.axis[0] + v * rec.normal[0],
    c[1] + u * rec.axis[1] + v * rec.normal[1],
  ];
  for (let i = 0; i < 4; i++) {
    const g = outer[i],
      next = outer[(i + 1) % 4],
      corner = world(
        i === 0 || i === 3 ? rec.outer.halfWidth : -rec.outer.halfWidth,
        i < 2 ? rec.outer.halfDepth : -rec.outer.halfDepth,
      );
    const pick = (g) =>
      ends(g).toSorted(
        (a, b) =>
          Math.hypot(a[0] - corner[0], a[1] - corner[1]) -
          Math.hypot(b[0] - corner[0], b[1] - corner[1]),
      )[0];
    wall(pick(g), corner);
    wall(corner, pick(next));
  }
  for (const g of rec.gates) {
    const w = workspace(face, g.center, rec.floorY, g.axis),
      scale = g.width / 18,
      centers = [-5.3 * scale, 0, 5.3 * scale],
      half = g.openingHalfWidth;
    if (d === 0) {
      // At whole-site distance, four shared planar piers and three lintels retain the portals.
      const boundaries = [-g.width / 2, centers[0] + half, centers[1] + half, centers[2] + half];
      const ends = [centers[0] - half, centers[1] - half, centers[2] - half, g.width / 2];
      for (let i = 0; i < 4; i++)
        w.box(
          'stone',
          boundaries[i],
          ends[i],
          -0.2,
          0.2,
          -0.15,
          i === 1 || i === 2 ? 5.4 : 4.0,
          false,
          true,
        );
      // Side lintels are subpixel at this level; retain the central tall lintel and four posts.
      w.box('stone', -half, half, -0.2, 0.2, 4.25, 5.4, false, true);
      w.box('wall', -half, half, -0.12, 0.12, 0, 4.25, false, true);
      continue;
    }
    for (let i = 0; i < 3; i++) {
      const u = centers[i],
        hi = i === 1 ? 5.4 : 4.0,
        opening = i === 1 ? 4.25 : 3.0,
        pier = 0.48;
      for (const sign of [-1, 1])
        w.box(
          'stone',
          u + sign * (half + pier) - pier,
          u + sign * (half + pier) + pier,
          -0.45,
          0.45,
          -0.15,
          hi + 0.45,
          false,
          d === 1,
        );
      w.box('stone', u - half, u + half, -0.45, 0.45, opening, hi, true, d === 1);
      if (d >= 3) {
        w.box('stone', u - half - 0.3, u + half + 0.3, -0.58, 0.58, hi - 0.1, hi + 0.12);
        for (const sign of [-1, 1])
          w.box(
            'stone',
            u + sign * (half + pier) - 0.19,
            u + sign * (half + pier) + 0.19,
            -0.19,
            0.19,
            hi + 0.45,
            hi + 0.85,
          );
      }
      if (i === 1) w.box('wall', u - half, u + half, -0.12, 0.12, 0, opening, false, d === 1);
    }
    // Close the short low links to the long wall while keeping both side passages unobstructed.
    const gaps = [
      [-g.width / 2, centers[0] - half - 0.96],
      [centers[0] + half + 0.96, -half - 0.96],
      [half + 0.96, centers[2] - half - 0.96],
      [centers[2] + half + 0.96, g.width / 2],
    ];
    for (const [x0, x1] of gaps)
      if (x1 > x0) {
        w.box('gate', x0, x1, -0.33, 0.33, -0.15, rec.wallHeight, false, d === 1);
        w.box('roof', x0, x1, -0.46, 0.46, rec.wallHeight, rec.wallHeight + 0.25, false, d === 1);
      }
  }
}

export function buildHeavenAltarRemote(face, n = 6, includeGates = true) {
  const point = (angle, r, y) => [
    rec.center[0] + Math.cos(angle) * r,
    rec.floorY + y,
    rec.center[1] + Math.sin(angle) * r,
  ];
  for (const [index, t] of rec.terraces.entries()) {
    const inner = rec.terraces[index + 1]?.radius ?? 0;
    for (let i = 0; i < n; i++) {
      const a = (i * Math.PI * 2) / n,
        b = ((i + 1) * Math.PI * 2) / n;
      face(
        'stone',
        [
          point(a, t.radius, t.bottom),
          point(b, t.radius, t.bottom),
          point(b, t.radius, t.top),
          point(a, t.radius, t.top),
        ],
        [Math.cos((a + b) / 2), 0, Math.sin((a + b) / 2)],
      );
      if (inner)
        face(
          'stone',
          [
            point(a, t.radius, t.top),
            point(b, t.radius, t.top),
            point(b, inner, t.top),
            point(a, inner, t.top),
          ],
          [0, 1, 0],
        );
    }
    if (!inner)
      face(
        'stone',
        Array.from({ length: n }, (_, i) => point((i * Math.PI * 2) / n, t.radius, t.top)),
        [0, 1, 0],
      );
  }
  const floor = workspace(face, rec.outer.center, rec.floorY, rec.axis);
  floor.quad(
    'brick',
    [
      [-rec.outer.halfWidth, -0.04, -rec.outer.halfDepth],
      [rec.outer.halfWidth, -0.04, -rec.outer.halfDepth],
      [rec.outer.halfWidth, -0.04, rec.outer.halfDepth],
      [-rec.outer.halfWidth, -0.04, rec.outer.halfDepth],
    ],
    [0, 1, 0],
  );
  const wall = (points) => {
    for (let i = 0; i < points.length; i++) {
      const a = points[i],
        b = points[(i + 1) % points.length],
        q = [
          [a[0], rec.floorY, a[1]],
          [b[0], rec.floorY, b[1]],
          [b[0], rec.floorY + rec.wallHeight, b[1]],
          [a[0], rec.floorY + rec.wallHeight, a[1]],
        ],
        out = [b[1] - a[1], 0, a[0] - b[0]];
      face('gate', q, out);
      face(
        'gate',
        q,
        out.map((v) => -v),
      );
    }
  };
  wall(
    Array.from({ length: 8 }, (_, i) => [
      rec.round.center[0] + Math.cos((i * Math.PI) / 4) * rec.round.radius,
      rec.round.center[1] + Math.sin((i * Math.PI) / 4) * rec.round.radius,
    ]),
  );
  wall(
    [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ].map(([x, z]) => [
      rec.outer.center[0] +
        rec.axis[0] * x * rec.outer.halfWidth +
        rec.normal[0] * z * rec.outer.halfDepth,
      rec.outer.center[1] +
        rec.axis[1] * x * rec.outer.halfWidth +
        rec.normal[1] * z * rec.outer.halfDepth,
    ]),
  );
  for (const g of includeGates ? rec.gates : []) {
    const w = workspace(face, g.center, rec.floorY, g.axis),
      half = g.openingHalfWidth;
    for (const sign of [-1, 1]) {
      w.quad(
        'stone',
        [
          [-half - 0.48, 0, sign * 0.05],
          [half + 0.48, 0, sign * 0.05],
          [half + 0.48, 5.4, sign * 0.05],
          [-half - 0.48, 5.4, sign * 0.05],
        ],
        [0, 0, sign],
      );
      w.quad(
        'wall',
        [
          [-half, 0, sign * 0.06],
          [half, 0, sign * 0.06],
          [half, 4.25, sign * 0.06],
          [-half, 4.25, sign * 0.06],
        ],
        [0, 0, sign],
      );
    }
  }
}
