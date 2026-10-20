/** Budgeted remote site masses. Detailed masters remain in their component recipes. */
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
if (frame.candidateId !== 'N0488') throw new Error('Wrong remote Temple of Heaven source');
const rec = frame.reconstruction;
export function buildHeavenSkylineSite(face, n = 6) {
  const disk = (role, c, r, y) =>
    face(
      role,
      Array.from({ length: n }, (_, i) => [
        c[0] + Math.cos((i * Math.PI * 2) / n) * r,
        y,
        c[1] + Math.sin((i * Math.PI * 2) / n) * r,
      ]),
      [0, 1, 0],
    );
  const lathe = (role, c, profile, cap = false) => {
    for (let j = 1; j < profile.length; j++)
      for (let i = 0; i < n; i++) {
        const a = (i * Math.PI * 2) / n,
          b = ((i + 1) * Math.PI * 2) / n,
          p = (q, v) => [c[0] + Math.cos(q) * v[1], v[0], c[1] + Math.sin(q) * v[1]];
        face(
          typeof role === 'function' ? role((a + b) / 2) : role,
          [p(a, profile[j - 1]), p(b, profile[j - 1]), p(b, profile[j]), p(a, profile[j])],
          [Math.cos((a + b) / 2), 0, Math.sin((a + b) / 2)],
        );
      }
    if (cap) disk(role, c, profile.at(-1)[1], profile.at(-1)[0]);
  };
  const box = (role, c, w, depth, lo, hi, axis = [1, 0], normal = [0, 1], bottom = false) => {
    const p = (u, y, v) => [
        c[0] + axis[0] * u + normal[0] * v,
        y,
        c[1] + axis[1] * u + normal[1] * v,
      ],
      a = w / 2,
      b = depth / 2;
    if (n === 6 && role === 'brick') {
      for (const sign of [-1, 1])
        face(
          role,
          [p(-a, lo, 0), p(a, lo, 0), p(a, hi, 0), p(-a, hi, 0)],
          [normal[0] * sign, 0, normal[1] * sign],
        );
      return;
    }
    for (const sign of [-1, 1]) {
      face(
        role,
        [p(-a, lo, sign * b), p(a, lo, sign * b), p(a, hi, sign * b), p(-a, hi, sign * b)],
        [normal[0] * sign, 0, normal[1] * sign],
      );
      face(
        role,
        [p(sign * a, lo, -b), p(sign * a, lo, b), p(sign * a, hi, b), p(sign * a, hi, -b)],
        [axis[0] * sign, 0, axis[1] * sign],
      );
    }
    face(role, [p(-a, hi, -b), p(a, hi, -b), p(a, hi, b), p(-a, hi, b)], [0, 1, 0]);
    if (bottom) face(role, [p(-a, lo, -b), p(a, lo, -b), p(a, lo, b), p(-a, lo, b)], [0, -1, 0]);
  };
  const hip = (c, w, depth, lo, hi, axis = [1, 0], normal = [0, 1]) => {
    const p = (u, y, v) => [
        c[0] + axis[0] * u + normal[0] * v,
        y,
        c[1] + axis[1] * u + normal[1] * v,
      ],
      a = w / 2,
      b = depth / 2,
      r = Math.max(0.1, a - b * 0.7),
      q = [p(-a, lo, -b), p(a, lo, -b), p(a, lo, b), p(-a, lo, b)],
      left = p(-r, hi, 0),
      right = p(r, hi, 0);
    face('roof', [q[0], q[1], right, left], [normal[0] * -1, 0.5, normal[1] * -1]);
    face('roof', [q[3], q[2], right, left], [normal[0], 0.5, normal[1]]);
    face('roof', [q[0], q[3], left], [-axis[0], 0.5, -axis[1]]);
    face('roof', [q[1], q[2], right], [axis[0], 0.5, axis[1]]);
    face('band', q, [0, -1, 0]);
  };
  const terrace = (c, levels, floor) => {
    for (let j = 0; j < levels.length; j++) {
      const t = levels[j],
        inner = levels[j + 1]?.[0] ?? 0;
      lathe('stone', c, [
        [floor + t[1], t[0]],
        [floor + t[2], t[0]],
      ]);
      if (!inner) {
        disk('stone', c, t[0], floor + t[2]);
        continue;
      }
      for (let i = 0; i < n; i++) {
        const a = (i * Math.PI * 2) / n,
          b = ((i + 1) * Math.PI * 2) / n,
          p = (q, r) => [c[0] + Math.cos(q) * r, floor + t[2], c[1] + Math.sin(q) * r];
        face('stone', [p(a, t[0]), p(b, t[0]), p(b, inner), p(a, inner)], [0, 1, 0]);
      }
    }
  };
  const f = rec.floorY,
    c = [0, 0];
  terrace(
    c,
    rec.terraces.map((t) => [t.outer, t.bottom, t.top]),
    f,
  );
  for (const [lo, hi, r] of [
    [6, 13.3, rec.bodyRadius],
    [17.6, 21.2, 12.3],
    [24.7, 27, 9.9],
  ])
    lathe('wall', c, [
      [f + lo, r],
      [f + hi, r],
    ]);
  for (const [lo, hi, outer, inner] of [
    [13.3, 17.7, 18, 12.3],
    [21.1, 24.8, 15.2, 9.9],
    [26.9, 35.6, 11.9, 0.7],
  ]) {
    lathe(
      'roof',
      c,
      [
        [f + lo, outer],
        [f + hi, inner],
      ],
      n !== 6,
    );
    face(
      'band',
      Array.from({ length: n }, (_, i) => [
        Math.cos((i * Math.PI * 2) / n) * outer,
        f + lo,
        Math.sin((i * Math.PI * 2) / n) * outer,
      ]),
      [0, -1, 0],
    );
  }
  lathe('gold', c, [
    [f + 35.6, 0.7],
    [f + 38, 0],
  ]);
  const north = rec.north,
    nf = north.floorY,
    nc = north.hall.center;
  box('stone', nc, 40, 22, nf, nf + 1.8, north.axis, north.normal);
  box(
    'wall',
    nc,
    north.width,
    north.depth,
    nf + 1.8,
    nf + north.hallHeights.wallTop,
    north.axis,
    north.normal,
  );
  hip(
    nc,
    north.width + 3.6,
    north.depth + 3.6,
    nf + north.hallHeights.roofEave,
    nf + north.hallHeights.roofRidge,
    north.axis,
    north.normal,
  );
  const at = (u, v) => [
    nc[0] + north.axis[0] * u + north.normal[0] * v,
    nc[1] + north.axis[1] * u + north.normal[1] * v,
  ];
  face(
    'brick',
    [
      [-23.5, -20],
      [23.5, -20],
      [23.5, north.gateAt[1] + 2],
      [-23.5, north.gateAt[1] + 2],
    ].map(([u, v]) => {
      const p = at(u, v);
      return [p[0], nf + 0.01, p[1]];
    }),
    [0, 1, 0],
  );
  for (const g of n === 6 ? [] : north.gates) {
    const u = north.gateAt[0] + g.offset,
      v = north.gateAt[1];
    if (n === 6) {
      const q = (u0, u1, lo, hi) => {
        const p = (u, y) => {
            const x = at(u, v);
            return [x[0], y, x[1]];
          },
          points = [p(u0, lo), p(u1, lo), p(u1, hi), p(u0, hi)];
        face('gate', points, [north.normal[0], 0, north.normal[1]]);
        face('gate', points, [-north.normal[0], 0, -north.normal[1]]);
      };
      for (const sign of [-1, 1]) {
        const x = u + sign * (g.openingWidth / 2 + 0.425);
        q(x - 0.425, x + 0.425, nf, nf + g.openingHeight);
      }
      q(
        u - g.openingWidth / 2 - 0.85,
        u + g.openingWidth / 2 + 0.85,
        nf + g.openingHeight,
        nf + g.eave,
      );
    } else {
      for (const sign of [-1, 1])
        box(
          'gate',
          at(u + sign * (g.openingWidth / 2 + 0.425), v),
          0.85,
          2.2,
          nf,
          nf + g.openingHeight,
          north.axis,
          north.normal,
        );
      box(
        'gate',
        at(u, v),
        g.openingWidth + 1.7,
        2.2,
        nf + g.openingHeight,
        nf + g.eave,
        north.axis,
        north.normal,
        true,
      );
    }
    hip(at(u, v), g.openingWidth + 2.8, 3.5, nf + g.eave, nf + g.ridge, north.axis, north.normal);
  }
  const v = rec.vault,
    vf = v.floorY,
    vc = v.vault.center;
  lathe(
    'stone',
    vc,
    [
      [vf, v.platform.radius],
      [vf + 2.2, v.platform.radius],
    ],
    n !== 6,
  );
  lathe((q) => (Math.sin(q) > -0.05 ? 'wall' : 'brick'), vc, [
    [vf + 2.2, v.bodyRadius],
    [vf + 10.5, v.bodyRadius],
  ]);
  lathe(
    'roof',
    vc,
    [
      [vf + 10.5, v.roofRadius],
      [vf + 17.45, 0.45],
    ],
    n !== 6,
  );
  face(
    'band',
    Array.from({ length: n }, (_, i) => [
      vc[0] + Math.cos((i * Math.PI * 2) / n) * v.roofRadius,
      vf + 10.5,
      vc[1] + Math.sin((i * Math.PI * 2) / n) * v.roofRadius,
    ]),
    [0, -1, 0],
  );
  lathe('gold', vc, [
    [vf + 17.45, 0.45],
    [vf + 19.02, 0],
  ]);
  for (const a of [v.east, v.west]) {
    box('wall', a.center, a.size[0], a.size[1], vf + 1, vf + 5.9);
    hip(a.center, a.size[1] + 2.2, a.size[0] + 2.2, vf + 5.9, vf + 8.7, [0, 1], [-1, 0]);
  }
  disk('brick', v.center, v.echoWall.radius - 0.45, vf + 0.01);
  // Four thin enclosure arcs retain both faces and the mapped gate gap.
  const wall = v.echoWall,
    tau = Math.PI * 2,
    start = wall.gateAngle + wall.gapHalfAngle,
    end = wall.gateAngle + tau - wall.gapHalfAngle,
    count = n === 6 ? 6 : 12;
  for (let i = 0; i < count; i++) {
    const a = start + ((end - start) * i) / count,
      b = start + ((end - start) * (i + 1)) / count,
      p = (q, y) => [
        v.center[0] + Math.cos(q) * wall.radius,
        vf + y,
        v.center[1] + Math.sin(q) * wall.radius,
      ],
      points = [p(a, 0), p(b, 0), p(b, wall.height), p(a, wall.height)];
    face('brick', points, [Math.cos((a + b) / 2), 0, Math.sin((a + b) / 2)]);
    face('brick', points, [-Math.cos((a + b) / 2), 0, -Math.sin((a + b) / 2)]);
  }
  const gc = v.gate.center,
    open = [
      [-5.1, 1.25],
      [0, 1.55],
      [5.1, 1.25],
    ],
    half = v.gate.size[0] / 2;
  // Join the deliberately open arc to the gate's two outer jambs.
  for (const sign of [-1, 1]) {
    const angle = wall.gateAngle - sign * wall.gapHalfAngle,
      a = [
        v.center[0] + Math.cos(angle) * wall.radius,
        v.center[1] + Math.sin(angle) * wall.radius,
      ],
      b = [gc[0] + sign * half, gc[1]],
      points = [
        [a[0], vf, a[1]],
        [b[0], vf, b[1]],
        [b[0], vf + wall.height, b[1]],
        [a[0], vf + wall.height, a[1]],
      ],
      normal = [b[1] - a[1], 0, a[0] - b[0]];
    face('brick', points, normal);
    face(
      'brick',
      points,
      normal.map((x) => -x),
    );
  }
  let last = -half;
  for (const [u, r] of open) {
    box('brick', [gc[0] + (last + u - r) / 2, gc[1]], u - r - last, 1.6, vf, vf + 4.8);
    box('brick', [gc[0] + u, gc[1]], r * 2, 1.6, vf + 2.25 + r, vf + 4.8, [1, 0], [0, 1], true);
    last = u + r;
  }
  box('brick', [gc[0] + (last + half) / 2, gc[1]], half - last, 1.6, vf, vf + 4.8);
}
