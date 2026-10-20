/** Divine Music Administration and ritual service halls; retained PMTiles and two exterior pictures. */
import './install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import earcut from 'earcut';

const frame = JSON.parse(
  readFileSync(
    new URL(
      '../../../content/worldgen/source/places/wx/wx4/n0488_temple_of_heaven/map-frame.json',
      import.meta.url,
    ),
  ),
);
if (frame.candidateId !== 'N0488') throw new Error('Wrong Temple service source');
const rec = frame.reconstruction.services;
const linear = (hex) =>
  hex
    .slice(1)
    .match(/../g)
    .map((n) => {
      const v = parseInt(n, 16) / 255;
      return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
const red = linear('#b65b49'),
  dark = linear('#704349'),
  gray = linear('#82817b'),
  green = linear('#617465'),
  blue = linear('#537c95'),
  gold = linear('#c6ab72');

function space(face, b, floor) {
  const axis = b.axis ?? [1, 0],
    normal = b.normal ?? [0, 1];
  const point = (u, y, v) => [
    b.center[0] + axis[0] * u + normal[0] * v,
    floor + y,
    b.center[1] + axis[1] * u + normal[1] * v,
  ];
  const quad = (role, points, target, tint) =>
    face(
      role,
      points.map((p) => point(...p)),
      [
        axis[0] * target[0] + normal[0] * target[2],
        target[1],
        axis[1] * target[0] + normal[1] * target[2],
      ],
      tint,
    );
  const box = (role, u0, u1, v0, v1, lo, hi, tint, top = true) => {
    for (const sign of [-1, 1]) {
      const u = sign < 0 ? u0 : u1,
        v = sign < 0 ? v0 : v1;
      quad(
        role,
        [
          [u0, lo, v],
          [u1, lo, v],
          [u1, hi, v],
          [u0, hi, v],
        ],
        [0, 0, sign],
        tint,
      );
      quad(
        role,
        [
          [u, lo, v0],
          [u, lo, v1],
          [u, hi, v1],
          [u, hi, v0],
        ],
        [sign, 0, 0],
        tint,
      );
    }
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
  };
  return { point, quad, box };
}
function polygon(face, role, outline, y, tint) {
  const indices = earcut(outline.flat());
  for (let i = 0; i < indices.length; i += 3)
    face(
      role,
      indices.slice(i, i + 3).map((k) => [outline[k][0], y, outline[k][1]]),
      [0, 1, 0],
      tint,
    );
}
function walls(face, outline, lo, hi, role, tint) {
  let area = 0;
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i],
      b = outline[(i + 1) % outline.length];
    area += a[0] * b[1] - b[0] * a[1];
  }
  const sign = area > 0 ? 1 : -1;
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i],
      b = outline[(i + 1) % outline.length];
    face(
      role,
      [
        [a[0], lo, a[1]],
        [b[0], lo, b[1]],
        [b[0], hi, b[1]],
        [a[0], hi, a[1]],
      ],
      [(b[1] - a[1]) * sign, 0, (a[0] - b[0]) * sign],
      tint,
    );
  }
}
function roof(w, width, depth, eave, ridge, d, tint, gabled = false) {
  const a = width / 2 + (d < 2 ? 0.8 : 1.1),
    b = depth / 2 + (d < 2 ? 0.8 : 1.1),
    r = Math.max(0.1, a - b * 0.5);
  if (gabled && d >= 2) {
    const v = b * 0.43,
      mid = eave + (ridge - eave) * 0.43;
    const outer = [
        [-a, eave, -b],
        [a, eave, -b],
        [a, eave, b],
        [-a, eave, b],
      ],
      inner = [
        [-r, mid, -v],
        [r, mid, -v],
        [r, mid, v],
        [-r, mid, v],
      ];
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      w.quad(
        'roof',
        [outer[i], outer[j], inner[j], inner[i]],
        i % 2 ? [i === 1 ? 1 : -1, 0.5, 0] : [0, 0.5, i === 0 ? -1 : 1],
        tint,
      );
    }
    for (const sign of [-1, 1]) {
      w.quad(
        'roof',
        [
          [-r, mid, sign * v],
          [r, mid, sign * v],
          [r, ridge, 0],
          [-r, ridge, 0],
        ],
        [0, 0.6, sign],
        tint,
      );
      w.quad(
        'wall',
        [
          [sign * r, mid, -v],
          [sign * r, mid, v],
          [sign * r, ridge, 0],
        ],
        [sign, 0, 0],
        red,
      );
    }
  } else {
    for (const sign of [-1, 1]) {
      w.quad(
        'roof',
        [
          [-a, eave, sign * b],
          [a, eave, sign * b],
          [r, ridge, 0],
          [-r, ridge, 0],
        ],
        [0, 0.6, sign],
        tint,
      );
      w.quad(
        'roof',
        [
          [sign * a, eave, -b],
          [sign * a, eave, b],
          [sign * r, ridge, 0],
        ],
        [sign, 0.6, 0],
        tint,
      );
    }
  }
  if (d > 0)
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
    w.box('roof', -r - 0.2, r + 0.2, -0.12, 0.12, ridge, ridge + 0.28, gabled ? gold : tint);
    for (const sign of [-1, 1])
      w.box(
        'roof',
        sign * (r + 0.08) - 0.12,
        sign * (r + 0.08) + 0.12,
        -0.17,
        0.17,
        ridge + 0.1,
        ridge + 0.65,
        gabled ? gold : tint,
      );
  }
}
function hall(face, b, g, d, { music = false, gate = false, range = false } = {}) {
  const main = g.mainId === b.id,
    rear = g.rearId === b.id,
    principal = g.principalIds.includes(b.id);
  const wall = range ? 3.8 : main || rear ? 5.8 : gate ? 4.7 : principal ? 4.9 : 3.5;
  const ridge = range ? 6 : main ? 10.4 : rear ? 9.6 : gate ? 8 : principal ? 8 : 5.8;
  const w = space(face, b, g.floorY),
    hx = b.width / 2,
    hz = b.depth / 2,
    base = range ? 0.3 : main || rear ? 0.7 : 0.45,
    tint = music ? gray : green;
  if (d >= 2) {
    const outline = b.polygons[0].outline;
    walls(face, outline, g.floorY - 0.25, g.floorY + base, 'brick');
    walls(face, outline, g.floorY + base, g.floorY + wall, 'wall', red);
  } else w.box('wall', -hx, hx, -hz, hz, 0, wall, red, false);
  roof(w, b.width, b.depth, wall + 0.2, ridge, d, tint, music && !range && !gate);
  if (d === 0) return;
  // Small offsets keep front panels and friezes clear of the structural wall.
  w.quad(
    'band',
    [
      [-hx, wall - 0.7, hz + 0.04],
      [hx, wall - 0.7, hz + 0.04],
      [hx, wall + 0.05, hz + 0.04],
      [-hx, wall + 0.05, hz + 0.04],
    ],
    [0, 0, 1],
    blue,
  );
  if (d === 1) {
    const half = Math.min(2.5, b.width * 0.22);
    w.quad(
      'dark',
      [
        [-half, base, hz + 0.05],
        [half, base, hz + 0.05],
        [half, wall - 1, hz + 0.05],
        [-half, wall - 1, hz + 0.05],
      ],
      [0, 0, 1],
      dark,
    );
    return;
  }
  const bays = range
    ? Math.max(2, Math.round(b.width / 6))
    : main || rear
      ? 7
      : gate
        ? 3
        : principal
          ? 5
          : Math.max(2, Math.min(5, Math.round(b.width / 4.3)));
  const step = b.width / bays,
    half = step * 0.32;
  for (let i = 0; i < bays; i++) {
    const u = -hx + step * (i + 0.5),
      middle = i === Math.floor(bays / 2),
      lo = middle ? base : base + 0.8,
      hi = wall - 1;
    w.quad(
      'dark',
      [
        [u - half, lo, hz + 0.05],
        [u + half, lo, hz + 0.05],
        [u + half, hi, hz + 0.05],
        [u - half, hi, hz + 0.05],
      ],
      [0, 0, 1],
      dark,
    );
    w.quad(
      'wall',
      [
        [u - step * 0.48, base, hz + 0.09],
        [u - step * 0.44, base, hz + 0.09],
        [u - step * 0.44, wall, hz + 0.09],
        [u - step * 0.48, wall, hz + 0.09],
      ],
      [0, 0, 1],
      red,
    );
    if (d >= 3) {
      const stroke = 0.045;
      for (const du of [-half, 0, half])
        w.quad(
          'wall',
          [
            [u + du - stroke, lo, hz + 0.1],
            [u + du + stroke, lo, hz + 0.1],
            [u + du + stroke, hi, hz + 0.1],
            [u + du - stroke, hi, hz + 0.1],
          ],
          [0, 0, 1],
          red,
        );
      if (!middle)
        w.quad(
          'wall',
          [
            [u - half, (lo + hi) * 0.5 - 0.045, hz + 0.11],
            [u + half, (lo + hi) * 0.5 - 0.045, hz + 0.11],
            [u + half, (lo + hi) * 0.5 + 0.045, hz + 0.11],
            [u - half, (lo + hi) * 0.5 + 0.045, hz + 0.11],
          ],
          [0, 0, 1],
          red,
        );
    }
  }
  if (!range) {
    const count = d >= 3 ? 5 : 2,
      run = 2.3,
      half = Math.min(3.3, b.width * 0.22);
    for (let i = 0; i < count; i++) {
      const v = hz + 0.05 + (run * i) / count,
        y = base * (1 - i / count);
      w.quad(
        'stone',
        [
          [-half, y, v],
          [half, y, v],
          [half, y, v + run / count],
          [-half, y, v + run / count],
        ],
        [0, 1, 0],
      );
      w.quad(
        'stone',
        [
          [-half, y - base / count, v + run / count],
          [half, y - base / count, v + run / count],
          [half, y, v + run / count],
          [-half, y, v + run / count],
        ],
        [0, 0, 1],
      );
    }
    if (d >= 3 && music)
      for (const sign of [-1, 1])
        w.box(
          'stone',
          sign * (half + 0.18) - 0.14,
          sign * (half + 0.18) + 0.14,
          hz,
          hz + run + 0.05,
          0,
          base + 0.35,
        );
  }
}
function pavilion(face, b, g, d) {
  const w = space(face, b, g.floorY),
    ring = b.polygons[0].outline;
  polygon(face, 'stone', ring, g.floorY + 0.35);
  if (d === 0) {
    walls(face, ring, g.floorY, g.floorY + 4.2, 'wall', red);
    for (let i = 0; i < ring.length; i++)
      face(
        'roof',
        [
          [ring[i][0], g.floorY + 4.2, ring[i][1]],
          [ring[(i + 1) % ring.length][0], g.floorY + 4.2, ring[(i + 1) % ring.length][1]],
          [b.center[0], g.floorY + 7.2, b.center[1]],
        ],
        [0, 1, 0],
        green,
      );
    return;
  }
  for (const p of ring) {
    const dx = p[0] - b.center[0],
      dz = p[1] - b.center[1],
      u = dx * b.axis[0] + dz * b.axis[1],
      v = dx * b.normal[0] + dz * b.normal[1],
      s = d >= 2 ? 0.22 : 0.3;
    w.box('wall', u - s, u + s, v - s, v + s, 0.35, 4.2, red, d >= 3);
  }
  for (let i = 0; i < ring.length; i++) {
    const j = (i + 1) % ring.length,
      a = ring[i],
      b1 = ring[j],
      outer = (p) => [
        b.center[0] + (p[0] - b.center[0]) * 1.15,
        g.floorY + 4.3,
        b.center[1] + (p[1] - b.center[1]) * 1.15,
      ];
    face(
      'roof',
      [outer(a), outer(b1), [b.center[0], g.floorY + 7.2, b.center[1]]],
      [0, 1, 0],
      green,
    );
    face(
      'band',
      [
        [a[0], g.floorY + 3.7, a[1]],
        [b1[0], g.floorY + 3.7, b1[1]],
        [b1[0], g.floorY + 4.2, b1[1]],
        [a[0], g.floorY + 4.2, a[1]],
      ],
      [a[0] + b1[0] - 2 * b.center[0], 0, a[1] + b1[1] - 2 * b.center[1]],
      blue,
    );
  }
  polygon(face, 'band', ring, g.floorY + 4.25, blue);
  // Reverse the ceiling, whose only exposed face is below the roof.
  const indices = earcut(ring.flat());
  for (let i = 0; i < indices.length; i += 3)
    face(
      'band',
      indices.slice(i, i + 3).map((k) => [ring[k][0], g.floorY + 4.25, ring[k][1]]),
      [0, -1, 0],
      blue,
    );
}
function rangeControl(outline, target) {
  const center = [0, 1].map((k) => outline.reduce((s, p) => s + p[k], 0) / outline.length);
  let longest = 0;
  for (let i = 1; i < outline.length; i++)
    if (
      Math.hypot(...outline[(i + 1) % outline.length].map((v, k) => v - outline[i][k])) >
      Math.hypot(...outline[(longest + 1) % outline.length].map((v, k) => v - outline[longest][k]))
    )
      longest = i;
  let axis = outline[(longest + 1) % outline.length].map((v, k) => v - outline[longest][k]);
  const length = Math.hypot(...axis);
  axis = axis.map((v) => v / length);
  let normal = [axis[1], -axis[0]];
  if (normal.reduce((s, v, k) => s + v * (target[k] - center[k]), 0) < 0)
    normal = normal.map((v) => -v);
  const uv = outline.map((p) => [
    axis.reduce((s, v, k) => s + v * (p[k] - center[k]), 0),
    normal.reduce((s, v, k) => s + v * (p[k] - center[k]), 0),
  ]);
  return {
    center,
    axis,
    normal,
    width: Math.max(...uv.map((p) => p[0])) - Math.min(...uv.map((p) => p[0])),
    depth: Math.max(...uv.map((p) => p[1])) - Math.min(...uv.map((p) => p[1])),
    polygons: [{ outline, holes: [] }],
  };
}
export function serviceRanges(g) {
  const o = g.enclosure.polygons[0].outline,
    h = g.enclosure.polygons[0].holes[0],
    gate = g.buildings.find((b) => b.id === g.gateId),
    lerp = (a, b, t) => a.map((v, k) => v + (b[k] - v) * t);
  const lo = (gate.center[1] - gate.width / 2 - o[3][1]) / (o[2][1] - o[3][1]),
    hi = (gate.center[1] + gate.width / 2 - o[3][1]) / (o[2][1] - o[3][1]);
  return [
    [o[0], o[3], h[1], h[0]],
    [o[2], o[1], h[3], h[2]],
    [o[1], o[0], h[0], h[3]],
    [o[3], lerp(o[3], o[2], lo), lerp(h[1], h[2], lo), h[1]],
    [lerp(o[3], o[2], hi), o[2], h[2], lerp(h[1], h[2], hi)],
  ].map((p) => rangeControl(p, g.center));
}
export function buildHeavenServices(face, d) {
  for (const g of rec.groups) {
    const outline = g.enclosure?.polygons[0].outline ?? [
      [g.bounds[0][0], g.bounds[1][0]],
      [g.bounds[0][1], g.bounds[1][0]],
      [g.bounds[0][1], g.bounds[1][1]],
      [g.bounds[0][0], g.bounds[1][1]],
    ];
    polygon(face, 'brick', outline, g.floorY - 0.01);
    if (d >= 2) walls(face, outline, g.floorY - 0.3, g.floorY - 0.01, 'brick');
    for (const b of g.buildings) {
      // Whole-site silhouette keeps the music halls and one principal hall per kitchen group.
      if (d === 0 && !(g.enclosure ? g.farIds : [g.principalIds[0]]).includes(b.id)) continue;
      if (g.pavilionIds.includes(b.id)) pavilion(face, b, g, d);
      else hall(face, b, g, d, { music: !!g.enclosure, gate: b.id === g.gateId });
    }
    if (g.enclosure)
      for (const b of d === 0 ? serviceRanges(g).slice(0, 2) : serviceRanges(g))
        hall(face, b, g, d, { music: true, range: true });
  }
}
