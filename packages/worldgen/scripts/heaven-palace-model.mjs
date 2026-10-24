/** Palace of Abstinence: retained map controls, two ordinary exterior pictures, shared surfaces. */
import './install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import earcut from 'earcut';

const frame = JSON.parse(
  readFileSync(
    new URL(
      '../../../content/worldgen/source/places/wx/wx4/temple_of_heaven/map-frame.json',
      import.meta.url,
    ),
  ),
);
if (frame.candidateId !== 'temple_of_heaven') throw new Error('Wrong Palace of Abstinence source');
const rec = frame.reconstruction.palace;
const linear = (hex) =>
  hex
    .slice(1)
    .match(/../g)
    .map((n) => {
      const v = parseInt(n, 16) / 255;
      return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
const green = linear('#617465'),
  blue = linear('#537ca0'),
  gray = linear('#828981'),
  lawn = linear('#8aa065'),
  water = linear('#286d83'),
  yellow = linear('#c6ab72');

function workspace(face, center, axis = [1, 0], normal = [0, 1]) {
  const point = (u, y, v) => [
    center[0] + axis[0] * u + normal[0] * v,
    rec.floorY + y,
    center[1] + axis[1] * u + normal[1] * v,
  ];
  const quad = (role, p, target, tint) =>
    face(
      role,
      p.map((p) => point(...p)),
      [
        axis[0] * target[0] + normal[0] * target[2],
        target[1],
        axis[1] * target[0] + normal[1] * target[2],
      ],
      tint,
    );
  const box = (
    role,
    u0,
    u1,
    v0,
    v1,
    lo,
    hi,
    { front = true, bottom = false, top = true, tint } = {},
  ) => {
    if (front)
      quad(
        role,
        [
          [u0, lo, v1],
          [u1, lo, v1],
          [u1, hi, v1],
          [u0, hi, v1],
        ],
        [0, 0, 1],
        tint,
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
      tint,
    );
    quad(
      role,
      [
        [u0, lo, v0],
        [u0, lo, v1],
        [u0, hi, v1],
        [u0, hi, v0],
      ],
      [-1, 0, 0],
      tint,
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
      tint,
    );
    if (top)
      quad(
        role,
        [
          [u0, hi, v0],
          [u1, hi, v0],
          [u1, hi, v1],
          [u0, hi, v1],
        ],
        [0, 1, 0],
        tint,
      );
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
        tint,
      );
  };
  return { point, quad, box };
}
const buildingSpace = (face, b) => workspace(face, b.center, b.axis, b.normal);
function islandGround(face) {
  const points = [...rec.outerMoat.island, ...rec.innerMoat],
    indices = earcut(points.flat(), [rec.outerMoat.island.length], 2);
  for (let i = 0; i < indices.length; i += 3)
    face(
      'flat',
      indices.slice(i, i + 3).map((k) => [points[k][0], rec.floorY - 0.04, points[k][1]]),
      [0, 1, 0],
      lawn,
    );
}

function hip(w, width, depth, eave, ridge, d, tint = green) {
  const a = width / 2,
    b = depth / 2,
    r = Math.max(0.2, a - b * 0.7);
  const rows =
    d <= 1
      ? [
          [a, b, eave],
          [r, 0.08, ridge],
        ]
      : [
          [a, b, eave],
          [a - 0.65, b - 0.65, eave + 0.18],
          [a - 1.8, Math.max(0.5, b * 0.5), eave + (ridge - eave) * 0.58],
          [r, 0.08, ridge],
        ];
  for (let j = 1; j < rows.length; j++) {
    const x = rows[j - 1],
      y = rows[j],
      p = ([u, v], row) => [u * row[0], row[2], v * row[1]],
      corners = [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ];
    for (let i = 0; i < 4; i++) {
      const a = corners[i],
        b = corners[(i + 1) % 4];
      w.quad(
        'roof',
        [p(a, x), p(b, x), p(b, y), p(a, y)],
        [(a[0] + b[0]) / 2, 0.5, (a[1] + b[1]) / 2],
        tint,
      );
    }
  }
  const top = rows.at(-1);
  w.quad(
    'roof',
    [
      [-top[0], top[2], -top[1]],
      [top[0], top[2], -top[1]],
      [top[0], top[2], top[1]],
      [-top[0], top[2], top[1]],
    ],
    [0, 1, 0],
    tint,
  );
  w.quad(
    'band',
    [
      [-a, eave, -b],
      [a, eave, -b],
      [a, eave, b],
      [-a, eave, b],
    ],
    [0, -1, 0],
    blue,
  );
  if (d >= 3) {
    w.box('roof', -r - 0.3, r + 0.3, -0.18, 0.18, ridge, ridge + 0.35, { tint });
    for (const sign of [-1, 1])
      w.box('roof', sign * r - 0.22, sign * r + 0.22, -0.26, 0.26, ridge + 0.3, ridge + 1, {
        tint,
      });
  }
}
function stairs(w, u, width, near, far, lo, hi, d) {
  const count = d <= 1 ? 1 : d === 2 ? 5 : 8;
  for (let i = 0; i < count; i++) {
    const v0 = far - ((far - near) * i) / count,
      v1 = far - ((far - near) * (i + 1)) / count,
      y0 = lo + ((hi - lo) * i) / count,
      y1 = lo + ((hi - lo) * (i + 1)) / count;
    if (d <= 1)
      w.quad(
        'stone',
        [
          [u - width / 2, y0, v0],
          [u + width / 2, y0, v0],
          [u + width / 2, y1, v1],
          [u - width / 2, y1, v1],
        ],
        [0, 1, 0],
      );
    else {
      w.quad(
        'stone',
        [
          [u - width / 2, y0, v0],
          [u + width / 2, y0, v0],
          [u + width / 2, y1, v0],
          [u - width / 2, y1, v0],
        ],
        [0, 0, 1],
      );
      w.quad(
        'stone',
        [
          [u - width / 2, y1, v0],
          [u + width / 2, y1, v0],
          [u + width / 2, y1, v1],
          [u - width / 2, y1, v1],
        ],
        [0, 1, 0],
      );
    }
    for (const sign of [-1, 1])
      w.quad(
        'stone',
        [
          [u + (sign * width) / 2, lo, v0],
          [u + (sign * width) / 2, lo, v1],
          [u + (sign * width) / 2, y1, v1],
          [u + (sign * width) / 2, y1, v0],
        ],
        [sign, 0, 0],
      );
  }
}

function mainHall(face, b, d) {
  const w = buildingSpace(face, b),
    hx = b.width / 2,
    hz = b.depth / 2;
  w.box('stone', -hx - 1.5, hx + 1.5, -hz - 1.5, hz + 1.5, -0.15, 0.9);
  w.box('gate', -hx, hx, -hz, hz, 0.9, 7.4, { front: d === 0, top: false });
  if (d > 0) {
    const step = b.width / 5,
      half = step * 0.3;
    let end = -hx;
    for (let i = 0; i < 5; i++) {
      const u = -hx + step * (i + 0.5),
        lo = i === 2 ? 0.9 : 1.5,
        hi = 5.4;
      w.box('gate', end, u - half, hz - 0.55, hz, 0.9, 7.4, { top: false });
      w.box('gate', u - half, u + half, hz - 0.55, hz, hi, 7.4, { bottom: true, top: false });
      if (lo > 0.9) w.box('gate', u - half, u + half, hz - 0.55, hz, 0.9, lo);
      w.quad(
        'dark',
        [
          [u - half, lo, hz - 0.55],
          [u + half, lo, hz - 0.55],
          [u + half, hi, hz - 0.55],
          [u - half, hi, hz - 0.55],
        ],
        [0, 0, 1],
      );
      if (d >= 2 && i !== 2)
        for (const sign of [-1, 1])
          w.box(
            'gold',
            u + sign * half * 0.5 - 0.045,
            u + sign * half * 0.5 + 0.045,
            hz - 0.52,
            hz - 0.46,
            lo + 0.2,
            hi - 0.2,
          );
      end = u + half;
    }
    w.box('gate', end, hx, hz - 0.55, hz, 0.9, 7.4, { top: false });
    w.box('band', -hx - 0.1, hx + 0.1, -hz - 0.1, hz + 0.1, 6.15, 7.4, { tint: blue });
    if (d >= 2)
      for (let i = 0; i < 5; i++) {
        const u = -hx + (b.width * (i + 0.5)) / 5;
        w.box('gold', u - 1.55, u + 1.55, hz + 0.12, hz + 0.18, 6.5, 7.05);
        w.box('band', u - 1.35, u + 1.35, hz + 0.19, hz + 0.23, 6.6, 6.95, { tint: blue });
      }
    stairs(w, 0, 5.3, hz + 1.45, hz + 5.2, 0, 0.9, d);
    if (d >= 2)
      for (const sign of [-1, 1]) {
        w.box('stone', sign * 3 - 0.18, sign * 3 + 0.18, hz + 1.4, hz + 5.3, 0.4, 1.2);
        for (let i = 0; i < 5; i++)
          w.box(
            'stone',
            sign * 3 - 0.2,
            sign * 3 + 0.2,
            hz + 1.5 + i * 0.9 - 0.15,
            hz + 1.5 + i * 0.9 + 0.15,
            0.9,
            1.65,
          );
      }
  }
  hip(w, b.width + 3.2, b.depth + 3.2, 7.7, 12.5, d);
}

function archGate(face, b, d, inner = false) {
  const w = buildingSpace(face, b),
    half = b.width / 2,
    depth = Math.min(b.depth / 2, 3.3),
    top = inner ? 5.7 : 7,
    eave = top + 0.3,
    ridge = inner ? 8.5 : 11.8;
  const opening = b.width * 0.087,
    span = b.width * 0.29,
    centers = [-span, 0, span];
  let previous = -half;
  for (const u of centers) {
    const radius = opening * (u === 0 ? 1.2 : 1),
      spring = inner ? 2.2 : u === 0 ? 3.6 : 2.7;
    w.box('gate', previous, u - radius, -depth, depth, -0.15, top, { top: false });
    const count = d <= 1 ? 3 : d === 2 ? 6 : 10;
    for (let i = 0; i < count; i++) {
      const a = Math.PI - (Math.PI * i) / count,
        c = Math.PI - (Math.PI * (i + 1)) / count,
        x0 = u + Math.cos(a) * radius,
        x1 = u + Math.cos(c) * radius,
        y0 = spring + Math.sin(a) * radius,
        y1 = spring + Math.sin(c) * radius;
      for (const sign of [-1, 1])
        w.quad(
          'gate',
          [
            [x0, y0, sign * depth],
            [x1, y1, sign * depth],
            [x1, top, sign * depth],
            [x0, top, sign * depth],
          ],
          [0, 0, sign],
        );
      w.quad(
        'gate',
        [
          [x0, y0, -depth],
          [x1, y1, -depth],
          [x1, y1, depth],
          [x0, y0, depth],
        ],
        [u - (x0 + x1) / 2, -1, 0],
      );
      if (d >= 2)
        w.quad(
          'stone',
          [
            [x0, y0, depth + 0.02],
            [x1, y1, depth + 0.02],
            [
              u + Math.cos(c) * (radius + 0.18),
              spring + Math.sin(c) * (radius + 0.18),
              depth + 0.02,
            ],
            [
              u + Math.cos(a) * (radius + 0.18),
              spring + Math.sin(a) * (radius + 0.18),
              depth + 0.02,
            ],
          ],
          [0, 0, 1],
          yellow,
        );
    }
    for (const sign of [-1, 1])
      w.quad(
        'gate',
        [
          [u + sign * radius, 0, -depth],
          [u + sign * radius, 0, depth],
          [u + sign * radius, spring, depth],
          [u + sign * radius, spring, -depth],
        ],
        [-sign, 0, 0],
      );
    const door = [
      w.point(u - radius, 0, depth - 0.4),
      w.point(u + radius, 0, depth - 0.4),
      ...Array.from({ length: count + 1 }, (_, i) =>
        w.point(
          u + Math.cos((Math.PI * i) / count) * radius,
          spring + Math.sin((Math.PI * i) / count) * radius,
          depth - 0.4,
        ),
      ),
    ];
    face('wall', door, [b.normal[0], 0, b.normal[1]]);
    face('wall', door, [-b.normal[0], 0, -b.normal[1]]);
    if (d >= 3)
      for (const sign of [-1, 1])
        w.quad(
          'dark',
          [
            [u - 0.045, 0, sign * (depth - 0.38)],
            [u + 0.045, 0, sign * (depth - 0.38)],
            [u + 0.045, spring + radius - 0.08, sign * (depth - 0.38)],
            [u - 0.045, spring + radius - 0.08, sign * (depth - 0.38)],
          ],
          [0, 0, sign],
        );
    previous = u + radius;
  }
  w.box('gate', previous, half, -depth, depth, -0.15, top, { top: false });
  // Keep the painted frieze outside the masonry faces to avoid coplanar flicker.
  w.box('band', -half - 0.04, half + 0.04, -depth - 0.04, depth + 0.04, top - 0.9, top, {
    tint: blue,
  });
  hip(w, b.width + 2.6, depth * 2 + 2.6, eave, ridge, d);
}

function bridge(face, gate, d, inner = false) {
  const w = buildingSpace(face, gate),
    near = gate.depth / 2 - 0.15,
    far = near + (inner ? 12.8 : 19),
    count = d <= 1 ? 2 : d === 2 ? 5 : 8;
  for (const offset of [-gate.width * 0.29, 0, gate.width * 0.29]) {
    const half = Math.min(1.45, gate.width * 0.09),
      height = (t) => 0.02 + Math.sin(t * Math.PI) * 0.55;
    for (let i = 0; i < count; i++) {
      const a = i / count,
        b = (i + 1) / count,
        v0 = near + (far - near) * a,
        v1 = near + (far - near) * b,
        y0 = height(a),
        y1 = height(b);
      w.quad(
        'stone',
        [
          [offset - half, y0, v0],
          [offset + half, y0, v0],
          [offset + half, y1, v1],
          [offset - half, y1, v1],
        ],
        [0, 1, 0],
      );
      w.quad(
        'stone',
        [
          [offset - half, y0 - 0.35, v0],
          [offset + half, y0 - 0.35, v0],
          [offset + half, y1 - 0.35, v1],
          [offset - half, y1 - 0.35, v1],
        ],
        [0, -1, 0],
      );
      for (const sign of [-1, 1]) {
        w.quad(
          'stone',
          [
            [offset + sign * half, y0 - 0.35, v0],
            [offset + sign * half, y1 - 0.35, v1],
            [offset + sign * half, y1, v1],
            [offset + sign * half, y0, v0],
          ],
          [sign, 0, 0],
        );
        if (d >= 2)
          for (const [lo, hi] of d >= 3
            ? [
                [0.2, 0.55],
                [0.82, 0.95],
              ]
            : [[0.2, 0.8]]) {
            w.quad(
              'stone',
              [
                [offset + sign * half, y0 + lo, v0],
                [offset + sign * half, y1 + lo, v1],
                [offset + sign * half, y1 + hi, v1],
                [offset + sign * half, y0 + hi, v0],
              ],
              [sign, 0, 0],
            );
            w.quad(
              'stone',
              [
                [offset + sign * half, y0 + lo, v0],
                [offset + sign * half, y1 + lo, v1],
                [offset + sign * half, y1 + hi, v1],
                [offset + sign * half, y0 + hi, v0],
              ],
              [-sign, 0, 0],
            );
          }
      }
    }
    for (const v of [near, far])
      w.box('brick', offset - half, offset + half, v - 0.5, v + 0.5, -1.2, 0.04);
    if (d >= 3)
      for (const sign of [-1, 1])
        for (let i = 0; i <= 5; i++) {
          const t = i / 5,
            v = near + (far - near) * t,
            y = height(t);
          w.box(
            'stone',
            offset + sign * half - 0.16,
            offset + sign * half + 0.16,
            v - 0.16,
            v + 0.16,
            y,
            y + 1.15,
          );
        }
  }
  w.box('brick', -gate.width / 2 - 0.5, gate.width / 2 + 0.5, far - 0.7, far + 2, -1.2, 0);
  if (inner) return;
  w.quad(
    'brick',
    [
      [-gate.width / 2 - 0.5, 0, far + 2],
      [gate.width / 2 + 0.5, 0, far + 2],
      [gate.width / 2 + 0.5, -1.18, far + 6],
      [-gate.width / 2 - 0.5, -1.18, far + 6],
    ],
    [0, 1, 0],
  );
  for (const sign of [-1, 1])
    w.quad(
      'brick',
      [
        [sign * (gate.width / 2 + 0.5), -1.2, far + 2],
        [sign * (gate.width / 2 + 0.5), -1.2, far + 6],
        [sign * (gate.width / 2 + 0.5), -1.18, far + 6],
        [sign * (gate.width / 2 + 0.5), 0, far + 2],
      ],
      [sign, 0, 0],
    );
}

export function buildHeavenPalaceCompact(face) {
  islandGround(face);
  face(
    'brick',
    rec.courtControl.outline.map(([x, z]) => [x, rec.floorY + 0.01, z]),
    [0, 1, 0],
  );
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    face(
      'flat',
      [
        rec.outerMoat.outer[i],
        rec.outerMoat.outer[j],
        rec.outerMoat.island[j],
        rec.outerMoat.island[i],
      ].map(([x, z]) => [x, rec.floorY - 0.65, z]),
      [0, 1, 0],
      water,
    );
  }
  for (const indices of [
    [0, 1, 6, 7],
    [1, 2, 5, 6],
    [2, 3, 4, 5],
  ])
    face(
      'flat',
      indices.map((i) => [rec.innerMoat[i][0], rec.floorY - 0.65, rec.innerMoat[i][1]]),
      [0, 1, 0],
      water,
    );
  for (const b of rec.buildings) {
    // Whole-site skyline keeps the principal hall and east entrance; district restores annexes.
    if (![rec.mainId, rec.eastGateId].includes(b.id)) continue;
    const w = buildingSpace(face, b),
      main = b.id === rec.mainId,
      gate = b.id === rec.eastGateId,
      hi = main ? 7.4 : gate ? 7 : 4.5,
      ridge = main ? 12.5 : gate ? 11.8 : 6.6,
      hx = b.width / 2,
      hz = b.depth / 2;
    w.box('gate', -hx, hx, -hz, hz, -0.1, hi, { top: false });
    const a = hx + 1,
      bz = hz + 1,
      r = Math.max(0.1, a - bz * 0.7),
      p = (u, y, v) => [u, y, v];
    w.quad(
      'roof',
      [p(-a, hi + 0.2, -bz), p(a, hi + 0.2, -bz), p(r, ridge, 0), p(-r, ridge, 0)],
      [0, 0.5, -1],
      main || gate ? green : gray,
    );
    w.quad(
      'roof',
      [p(-a, hi + 0.2, bz), p(a, hi + 0.2, bz), p(r, ridge, 0), p(-r, ridge, 0)],
      [0, 0.5, 1],
      main || gate ? green : gray,
    );
    w.quad(
      'roof',
      [p(-a, hi + 0.2, -bz), p(-a, hi + 0.2, bz), p(-r, ridge, 0)],
      [-1, 0.5, 0],
      main || gate ? green : gray,
    );
    w.quad(
      'roof',
      [p(a, hi + 0.2, -bz), p(a, hi + 0.2, bz), p(r, ridge, 0)],
      [1, 0.5, 0],
      main || gate ? green : gray,
    );
  }
  const gates = rec.buildings.filter((b) =>
    [35184416013893, 35184416013912, rec.eastGateId].includes(b.id),
  );
  for (let i = 0; i < 4; i++) {
    const a = rec.outerMoat.island[i],
      b = rec.outerMoat.island[(i + 1) % 4],
      dx = b[0] - a[0],
      dz = b[1] - a[1],
      length = Math.hypot(dx, dz),
      cuts = [];
    for (const g of gates) {
      const u = ((g.center[0] - a[0]) * dx + (g.center[1] - a[1]) * dz) / length,
        v = (-(g.center[0] - a[0]) * dz + (g.center[1] - a[1]) * dx) / length;
      if (u > 0 && u < length && Math.abs(v) < g.depth / 2 + 2)
        cuts.push([u - g.width / 2, u + g.width / 2]);
    }
    let previous = 0;
    for (const cut of [...cuts.toSorted((a, b) => a[0] - b[0]), [length, length]]) {
      if (cut[0] > previous) {
        const p = (u) => [a[0] + (dx * u) / length, a[1] + (dz * u) / length],
          x = p(previous),
          z = p(cut[0]),
          q = [
            [x[0], rec.floorY, x[1]],
            [z[0], rec.floorY, z[1]],
            [z[0], rec.floorY + 2.8, z[1]],
            [x[0], rec.floorY + 2.8, x[1]],
          ];
        face('brick', q, [dz, 0, -dx]);
        face('brick', q, [-dz, 0, dx]);
      }
      previous = cut[1];
    }
  }
  for (const b of rec.buildings.filter((b) => [rec.eastGateId, rec.innerGateId].includes(b.id))) {
    const w = buildingSpace(face, b);
    w.quad(
      'stone',
      [
        [-b.width * 0.4, 0.08, b.depth / 2],
        [b.width * 0.4, 0.08, b.depth / 2],
        [b.width * 0.4, 0.08, b.depth / 2 + 19],
        [-b.width * 0.4, 0.08, b.depth / 2 + 19],
      ],
      [0, 1, 0],
    );
  }
}

export function buildHeavenPalace(face, d) {
  if (d === 0) {
    buildHeavenPalaceCompact(face);
    return;
  }
  islandGround(face);
  face(
    'brick',
    rec.courtControl.outline.map(([x, z]) => [x, rec.floorY + 0.01, z]),
    [0, 1, 0],
  );
  const bank = (p, q, sign) => {
    const dx = q[0] - p[0],
      dz = q[1] - p[1];
    face(
      'brick',
      [
        [p[0], rec.floorY - 1.2, p[1]],
        [q[0], rec.floorY - 1.2, q[1]],
        [q[0], rec.floorY - 0.04, q[1]],
        [p[0], rec.floorY - 0.04, p[1]],
      ],
      [sign * dz, 0, -sign * dx],
    );
  };
  for (let i = 0; i < 4; i++) {
    const next = (i + 1) % 4,
      p = rec.outerMoat.outer[i],
      q = rec.outerMoat.outer[next],
      a = rec.outerMoat.island[i],
      b = rec.outerMoat.island[next];
    face(
      'flat',
      [
        [p[0], rec.floorY - 0.65, p[1]],
        [q[0], rec.floorY - 0.65, q[1]],
        [b[0], rec.floorY - 0.65, b[1]],
        [a[0], rec.floorY - 0.65, a[1]],
      ],
      [0, 1, 0],
      water,
    );
    if (d > 0) {
      bank(p, q, -1);
      bank(a, b, 1);
    }
  }
  // The mapped C-shape is decomposed into three non-overlapping bands; no filled courtyard.
  for (const indices of [
    [0, 1, 6, 7],
    [1, 2, 5, 6],
    [2, 3, 4, 5],
  ])
    face(
      'flat',
      indices.map((i) => [rec.innerMoat[i][0], rec.floorY - 0.65, rec.innerMoat[i][1]]),
      [0, 1, 0],
      water,
    );
  if (d > 0)
    for (let i = 0; i < rec.innerMoat.length; i++)
      bank(rec.innerMoat[i], rec.innerMoat[(i + 1) % rec.innerMoat.length], -1);
  const gateIds = [35184416013893, 35184416013912, rec.eastGateId, rec.innerGateId];
  for (const b of rec.buildings) {
    if (b.id === rec.mainId) {
      mainHall(face, b, d);
      continue;
    }
    if (gateIds.includes(b.id)) {
      archGate(face, b, d, b.id !== rec.eastGateId);
      if (b.id === rec.eastGateId || b.id === rec.innerGateId)
        bridge(face, b, d, b.id === rec.innerGateId);
      continue;
    }
    const w = buildingSpace(face, b),
      base = b.id === 35184416013911 ? 0.55 : 0.35,
      height = b.id === 35184416013911 ? 5.7 : 4.5;
    w.box(
      'stone',
      -b.width / 2 - 0.6,
      b.width / 2 + 0.6,
      -b.depth / 2 - 0.6,
      b.depth / 2 + 0.6,
      -0.15,
      base,
    );
    w.box('gate', -b.width / 2, b.width / 2, -b.depth / 2, b.depth / 2, base, height, {
      top: false,
    });
    hip(
      w,
      b.width + 1.6,
      b.depth + 1.6,
      height + 0.2,
      height + Math.min(2.3, b.depth * 0.3),
      d,
      gray,
    );
    if (d >= 2) {
      const bays = Math.max(3, Math.min(5, Math.round(b.width / 4)));
      for (let i = 0; i < bays; i++) {
        const u = -b.width / 2 + (b.width * (i + 0.5)) / bays,
          half = (b.width / bays) * 0.3;
        w.quad(
          'dark',
          [
            [u - half, base + 0.5, b.depth / 2 + 0.02],
            [u + half, base + 0.5, b.depth / 2 + 0.02],
            [u + half, height - 1, b.depth / 2 + 0.02],
            [u - half, height - 1, b.depth / 2 + 0.02],
          ],
          [0, 0, 1],
        );
      }
      stairs(w, 0, 2.4, b.depth / 2 + 0.6, b.depth / 2 + 2.3, 0, base, d);
    }
  }
  // Outer enclosure follows the island bank; leave actual gaps at the mapped gate buildings.
  const gates = rec.buildings.filter((b) =>
    [35184416013893, 35184416013912, rec.eastGateId].includes(b.id),
  );
  for (let i = 0; i < 4; i++) {
    const a = rec.outerMoat.island[i],
      b = rec.outerMoat.island[(i + 1) % 4],
      dx = b[0] - a[0],
      dz = b[1] - a[1],
      len = Math.hypot(dx, dz),
      axis = [dx / len, dz / len],
      normal = [-axis[1], axis[0]],
      w = workspace(face, a, axis, normal),
      cuts = [];
    for (const g of gates) {
      const u = (g.center[0] - a[0]) * axis[0] + (g.center[1] - a[1]) * axis[1],
        v = (g.center[0] - a[0]) * normal[0] + (g.center[1] - a[1]) * normal[1];
      if (u > 0 && u < len && Math.abs(v) < g.depth / 2 + 2)
        cuts.push([u - g.width / 2 - 0.3, u + g.width / 2 + 0.3]);
    }
    let previous = 0;
    for (const cut of [...cuts.toSorted((a, b) => a[0] - b[0]), [len, len]]) {
      if (cut[0] > previous) {
        w.box('brick', previous, cut[0], -0.45, 0.45, -0.15, 2.8);
        if (d >= 2) w.box('roof', previous, cut[0], -0.6, 0.6, 2.8, 3.05, { tint: gray });
      }
      previous = cut[1];
    }
  }
}
