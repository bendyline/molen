/** Original Victory Bridge exterior from city inventory, map outline and dated photographs. */

import { readFileSync } from 'node:fs';
import { loft, normalFor, sphere } from './authored-structure-mesh.mjs';
import { box, quad, tube } from './structure-mesh.mjs';
import { structureSourcePath } from './structure-source-paths.mjs';

const frame = JSON.parse(
  readFileSync(structureSourcePath('n0014_haghtanak_bridge', 'map-frame.json')),
);
const basalt = [0.16, 0.164, 0.153],
  smooth = [0.23, 0.235, 0.215],
  iron = [0.105, 0.13, 0.119],
  pale = [0.68, 0.68, 0.642];
const road = 34;
const centers = [-48, 0, 48];
const half = 21.5,
  spring = 9,
  rise = 22,
  ring = 1.32;
const archY = (x, extra = 0) =>
  spring + (rise + extra) * Math.sqrt(Math.max(0, 1 - (x / (half + extra)) ** 2));

function prism(out, points, z0, z1, slot = 'stone', color = basalt, keepEdge = () => true) {
  const area = points.reduce(
    (s, p, i) =>
      s + p[0] * points[(i + 1) % points.length][1] - points[(i + 1) % points.length][0] * p[1],
    0,
  );
  if (Math.abs(area) < 1e-9) return;
  const p = area > 0 ? points : points.toReversed(),
    a = p.map(([x, y]) => [x, y, z0]),
    b = p.map(([x, y]) => [x, y, z1]);
  out.addConvexPolygon(
    slot,
    'palette:#ffffff',
    a.toReversed(),
    [0, 0, -1],
    (p) => [p[0], p[1]],
    color,
  );
  out.addConvexPolygon(slot, 'palette:#ffffff', b, [0, 0, 1], (p) => [p[0], p[1]], color);
  for (let i = 0; i < p.length; i++) {
    const j = (i + 1) % p.length;
    if (!keepEdge(p[i], p[j])) continue;
    const q = [a[i], a[j], b[j], b[i]];
    quad(out, slot, q, normalFor(...q), color);
  }
}
function archBand(out, cx, rx, ry, sy, thickness, z0, z1, count = 140, color = smooth) {
  for (let i = 0; i < count; i++) {
    const a = (Math.PI * i) / count,
      b = (Math.PI * (i + 1)) / count;
    const p = (t, r) => [cx - (rx + r) * Math.cos(t), sy + (ry + r) * Math.sin(t)];
    prism(out, [p(a, 0), p(b, 0), p(b, thickness), p(a, thickness)], z0, z1, 'stone', color);
  }
}
function smallCeiling(x, cx) {
  for (const offset of [-19, -14.8, -10.6, 10.6, 14.8, 19]) {
    const d = x - cx - offset;
    if (Math.abs(d) < 1.48) return 30.5 + 1.48 * Math.sqrt(1 - (d / 1.48) ** 2);
  }
  return undefined;
}
function spandrelCuts(cx, left, right) {
  const cuts = [left, right];
  for (let x = left + 0.14; x < right; x += 0.14) cuts.push(x);
  for (const offset of [-19, -14.8, -10.6, 10.6, 14.8, 19])
    for (let i = 0; i <= 48; i++) {
      const x = cx + offset - 1.48 * Math.cos((i * Math.PI) / 48);
      if (x > left && x < right) cuts.push(x);
    }
  return cuts.sort((a, b) => a - b).filter((x, i, all) => !i || x - all[i - 1] > 1e-7);
}
function cladding(out, left, right, low, high, z0, z1, lower, cuts) {
  // Real course gaps expose the recessed substrate; stone faces follow the openings.
  for (let row = 0, y = low; y < high; row++, y += 0.61) {
    for (let x = left - (row % 2) * 0.52; x < right; x += 1.04) {
      const a = Math.max(left, x + 0.017),
        b = Math.min(right, x + 1.023);
      if (b <= a) continue;
      const stations = [a, ...cuts.filter((v) => v > a && v < b), b];
      const top = Math.min(high, y + 0.584);
      const color = basalt.map((v) => v + 0.008 + 0.017 * Math.sin(x * 13.4 + row * 29.1));
      for (let i = 1; i < stations.length; i++) {
        const xa = stations[i - 1],
          xb = stations[i];
        const ya = Math.max(y + 0.014, lower(xa + 1e-8));
        const yb = Math.max(y + 0.014, lower(xb - 1e-8));
        if (Math.min(ya, yb) >= top) continue;
        let p = [
          [xa, ya],
          [xb, yb],
          [xb, top],
          [xa, top],
        ];
        if (ya >= top)
          p = [
            [xa + ((top - ya) / (yb - ya)) * (xb - xa), top],
            [xb, yb],
            [xb, top],
          ];
        else if (yb >= top)
          p = [
            [xa, ya],
            [xa + ((top - ya) / (yb - ya)) * (xb - xa), top],
            [xa, top],
          ];
        for (const side of [-1, 1]) {
          const z = side < 0 ? z0 - 0.027 : z1 + 0.027;
          prism(out, p, z - 0.028, z + 0.028, 'stone', color);
        }
      }
    }
  }
}
function mainSpan(out, cx, z0, z1) {
  archBand(out, cx, half, rise, spring, ring, z0, z1);
  // Columns between six open spandrel arches spring directly from the main extrados.
  const cuts = spandrelCuts(cx, cx - half - ring, cx + half + ring);
  for (let i = 1; i < cuts.length; i++) {
    const x = cuts[i - 1],
      b = cuts[i],
      lo0 = archY(x - cx, ring),
      lo1 = archY(b - cx, ring);
    const h0 = smallCeiling(x + 0.000001, cx),
      h1 = smallCeiling(b - 0.000001, cx);
    const a0 = Math.max(lo0, h0 ?? 0),
      a1 = Math.max(lo1, h1 ?? 0);
    if (a0 >= 33.4 || a1 >= 33.4) continue;
    prism(
      out,
      [
        [x, a0],
        [b, a1],
        [b, 33.4],
        [x, 33.4],
      ],
      z0,
      z1,
      'stone',
      basalt,
      // Adjacent sampling slices share a solid interior. Emitting their hidden
      // opposed caps creates thousands of subpixel faces under the road.
      (a, b) =>
        Math.abs(a[0] - b[0]) > 1e-7 ||
        Math.abs(a[0] - cuts[0]) < 1e-7 ||
        Math.abs(a[0] - cuts.at(-1)) < 1e-7,
    );
  }
  for (const offset of [-19, -14.8, -10.6, 10.6, 14.8, 19])
    for (const sign of [-1, 1]) {
      const x = cx + offset + sign * 1.48,
        low = archY(x - cx, ring);
      if (low >= 30.5) continue;
      const p = [
        [x, low, z0],
        [x, low, z1],
        [x, 30.5, z1],
        [x, 30.5, z0],
      ];
      if (sign < 0) p.reverse();
      quad(out, 'stone', p, normalFor(...p), basalt);
    }
  cladding(
    out,
    cx - half - ring,
    cx + half + ring,
    9,
    33.4,
    z0,
    z1,
    (x) => Math.max(archY(x - cx, ring), smallCeiling(x, cx) ?? 0),
    cuts,
  );
  for (const offset of [-19, -14.8, -10.6, 10.6, 14.8, 19]) {
    const x = cx + offset;
    for (const side of [-1, 1]) {
      const z = side < 0 ? z0 - 0.027 : z1 + 0.027;
      archBand(out, x, 1.48, 1.48, 30.5, 0.28, z - 0.055, z + 0.055, 38);
      for (const sign of [-1, 1]) {
        const xx = x + sign * 1.6,
          y0 = archY(xx - cx, ring);
        if (y0 < 30.35)
          box(out, 'stone', [xx - 0.12, y0, z - 0.075], [xx + 0.12, 30.5, z + 0.075], smooth);
        box(out, 'stone', [xx - 0.3, 30.26, z - 0.12], [xx + 0.3, 30.5, z + 0.12], pale);
      }
    }
  }
  // Individual dressed stones articulate the main basalt arch band at both outer faces.
  for (const z of [z0 - 0.02, z1 + 0.02])
    for (let i = 0; i < 114; i++) {
      const a = (Math.PI * (i + 0.017)) / 114,
        b = (Math.PI * (i + 0.983)) / 114;
      const p = (t, r) => [cx - (half + r) * Math.cos(t), spring + (rise + r) * Math.sin(t)];
      prism(
        out,
        [p(a, 0.02), p(b, 0.02), p(b, ring - 0.025), p(a, ring - 0.025)],
        z - 0.034,
        z + 0.034,
        'stone',
        smooth.map((v) => v + Math.sin(i * 19) * 0.028),
      );
    }
}
function pier(out, x, z0, z1) {
  box(
    out,
    'stone',
    [x - 2.55, 0, z0 - 0.3],
    [x + 2.55, 9, z1 + 0.3],
    basalt.map((v) => v - 0.035),
  );
  box(out, 'stone', [x - 2.25, 8.8, z0], [x + 2.25, 33.4, z1], basalt);
  for (let y = 0; y < 8.6; y += 0.64)
    for (let xx = x - 2.5; xx < x + 2.4; xx += 1.1)
      for (const side of [-1, 1]) {
        const z = side < 0 ? z0 - 0.325 : z1 + 0.325;
        box(
          out,
          'stone',
          [xx + 0.013, y + 0.016, z - 0.035],
          [Math.min(x + 2.5, xx + 1.08), Math.min(8.8, y + 0.61), z + 0.035],
          basalt.map((v) => v + Math.sin(xx * 31 + y * 17) * 0.035),
        );
      }
  for (const side of [-1, 1]) {
    const z = side < 0 ? z0 - 0.095 : z1 + 0.095;
    box(out, 'stone', [x - 2.4, 9, z - 0.18], [x + 2.4, 9.52, z + 0.18], smooth);
    box(
      out,
      'stone',
      [x - 2.08, 9.52, z - 0.07],
      [x + 2.08, 33.52, z + 0.07],
      basalt.map((v) => v + 0.06),
    );
    for (let y = 10; y < 33.3; y += 0.69) {
      box(
        out,
        'stone',
        [x - 2.08, y, z - 0.08],
        [x + 2.08, y + 0.025, z + 0.081],
        basalt.map((v) => v - 0.09),
      );
    }
    for (const edge of [-1, 1])
      box(
        out,
        'stone',
        [x + edge * 1.82 - 0.1, 9.52, z - 0.1],
        [x + edge * 1.82 + 0.1, 33.5, z + 0.1],
        smooth,
      );
  }
}
function abutment(out, sign) {
  const portals = [
    [82.6, 7.8, 23.6, 4.8, 17.2],
    [93.1, 4.1, 27.3, 2.05, 22.1],
  ];
  const cuts = [70.7, 100];
  for (let x = 70.88; x < 100; x += 0.18) cuts.push(x);
  for (const [cx, w] of portals)
    for (let i = 0; i <= 64; i++) cuts.push(cx - (w / 2) * Math.cos((i * Math.PI) / 64));
  cuts.sort((a, b) => a - b);
  const ceiling = (x) => {
    const p = portals.find(([cx, w]) => Math.abs(x - cx) < w / 2);
    return p ? p[2] + p[3] * Math.sqrt(Math.max(0, 1 - ((x - p[0]) / (p[1] / 2)) ** 2)) : 16;
  };
  for (let i = 1; i < cuts.length; i++) {
    const x = cuts[i - 1],
      b = cuts[i];
    if (b - x < 1e-7) continue;
    const pts = [
      [sign * x, ceiling(x + 1e-8)],
      [sign * b, ceiling(b - 1e-8)],
      [sign * b, 33.4],
      [sign * x, 33.4],
    ];
    prism(
      out,
      pts,
      -14.62,
      14.62,
      'stone',
      basalt,
      (a, b) =>
        Math.abs(a[0] - b[0]) > 1e-7 ||
        Math.abs(Math.abs(a[0]) - 70.7) < 1e-7 ||
        Math.abs(Math.abs(a[0]) - 100) < 1e-7,
    );
  }
  for (const [cx, w, sy] of portals)
    for (const end of [-1, 1]) {
      const x = sign * (cx + (end * w) / 2);
      const p = [
        [x, 16, -14.62],
        [x, 16, 14.62],
        [x, sy, 14.62],
        [x, sy, -14.62],
      ];
      if (sign * end < 0) p.reverse();
      quad(out, 'stone', p, normalFor(...p), basalt);
    }
  const ordered = cuts.map((x) => sign * x).sort((a, b) => a - b);
  cladding(
    out,
    ordered[0],
    ordered.at(-1),
    16,
    33.4,
    -14.62,
    14.62,
    (x) => ceiling(sign * x),
    ordered,
  );
  for (const [cx, w, sy, ry] of portals)
    for (const z of [-14.7, 14.7])
      archBand(out, sign * cx, w / 2, ry, sy, 0.43, z - 0.06, z + 0.06, 64);
  for (const z of [-14.78, 14.78]) {
    box(
      out,
      'stone',
      [sign * 70.8 - 0.36, 16, z - 0.15],
      [sign * 70.8 + 0.36, 33.6, z + 0.15],
      smooth,
    );
    for (let y = 17; y < 33; y += 0.72)
      box(
        out,
        'stone',
        [sign * 70.8 - 0.36, y, z - 0.16],
        [sign * 70.8 + 0.36, y + 0.025, z + 0.16],
        basalt,
      );
  }
}
function circle(out, x, y, z, rx, ry, r = 0.016, segments = 36, clip) {
  for (let i = 0; i < segments; i++) {
    const a = (2 * Math.PI * i) / segments,
      b = (2 * Math.PI * (i + 1)) / segments;
    const p = (t, offset, side) => [
      x + (rx + offset) * Math.cos(t),
      y + (ry + offset) * Math.sin(t),
      z + side * 0.026,
    ];
    const ia = p(a, -r, 1),
      ib = p(b, -r, 1),
      oa = p(a, r, 1),
      ob = p(b, r, 1),
      ja = p(a, -r, -1),
      jb = p(b, -r, -1),
      ka = p(a, r, -1),
      kb = p(b, r, -1);
    for (let q of [
      [ia, oa, ob, ib],
      [ja, jb, kb, ka],
      [ia, ib, jb, ja],
      [ob, oa, ka, kb],
    ]) {
      const normal = normalFor(...q);
      if (clip) {
        for (const [axis, limit, sign] of [
          [0, clip[0], 1],
          [0, clip[1], -1],
          [1, clip[2], 1],
          [1, clip[3], -1],
        ]) {
          const result = [];
          for (let j = 0; j < q.length; j++) {
            const a = q[j],
              b = q[(j + 1) % q.length];
            const da = (a[axis] - limit) * sign,
              db = (b[axis] - limit) * sign;
            if (da >= 0) result.push(a);
            if (da < 0 !== db < 0) result.push(a.map((v, k) => v + ((b[k] - v) * da) / (da - db)));
          }
          q = result;
        }
      }
      // Border tangencies can collapse after Float32 encoding; retain only their
      // positive-area fan triangles, rather than exporting zero-area slivers.
      for (let j = 1; j < q.length - 1; j++) {
        const t = [q[0], q[j], q[j + 1]].map((p) => p.map(Math.fround));
        const a = t[1].map((v, k) => v - t[0][k]),
          b = t[2].map((v, k) => v - t[0][k]);
        if (
          Math.hypot(
            a[1] * b[2] - a[2] * b[1],
            a[2] * b[0] - a[0] * b[2],
            a[0] * b[1] - a[1] * b[0],
          ) < 1e-10
        )
          continue;
        out.addTriangle('iron', 'palette:#ffffff', t, normal, [], iron);
      }
    }
  }
}
function perforation(out, x, y, z, width, height) {
  const radius = 0.044;
  const angles = [
    ...Array.from({ length: 16 }, (_, i) => (i * Math.PI) / 8),
    ...[-1, 1].flatMap((a) =>
      [-1, 1].map((b) => (Math.atan2(b * height, a * width) + 2 * Math.PI) % (2 * Math.PI)),
    ),
  ]
    .sort((a, b) => a - b)
    .filter((a, i, all) => !i || a - all[i - 1] > 1e-7);
  const point = (t, outer, side) => {
    const cx = Math.cos(t),
      cy = Math.sin(t),
      r = outer
        ? Math.min(
            width / 2 / Math.max(Math.abs(cx), 1e-9),
            height / 2 / Math.max(Math.abs(cy), 1e-9),
          )
        : radius;
    return [x + r * cx, y + r * cy, z + side * 0.045];
  };
  for (let i = 0; i < angles.length; i++) {
    const a = angles[i],
      b = angles[(i + 1) % angles.length];
    const ia = point(a, false, 1),
      ib = point(b, false, 1),
      oa = point(a, true, 1),
      ob = point(b, true, 1),
      ja = point(a, false, -1),
      jb = point(b, false, -1),
      ka = point(a, true, -1),
      kb = point(b, true, -1);
    for (const q of [
      [ia, oa, ob, ib],
      [ja, jb, kb, ka],
      [ia, ib, jb, ja],
      [ob, oa, ka, kb],
    ])
      quad(out, 'iron', q, normalFor(...q), iron);
  }
}
function rail(out, z) {
  const width = 3.05;
  for (let a = -99.5; a < 98; a += width) {
    const b = Math.min(a + width - 0.22, 99.5);
    const count = Math.ceil((b - a) / 0.15),
      cell = (b - a) / count;
    for (let i = 0; i < count; i++)
      for (const y of [road + 0.22, road + 1.66])
        perforation(out, a + cell * (i + 0.5), y, z, cell, 0.15);
    for (const x of [a + 0.075, b - 0.075])
      for (let i = 0; i < 9; i++)
        perforation(out, x, road + 0.295 + (i + 0.5) * (1.29 / 9), z, 0.15, 1.29 / 9);
    // The photo's four diagonal petals meet at each lattice vertex: circles sit
    // on the horizontal and vertical edge midpoints, not on the same square grid.
    const pitch = 0.6,
      radius = pitch / 2;
    for (let col = -1; col < 6; col++)
      for (let row = -1; row < 4; row++)
        for (const [dx, dy] of [
          [0.5, 0],
          [0, 0.5],
        ]) {
          const x = a + 0.15 + (col + dx) * pitch,
            y = road + 0.295 + (row + dy) * pitch;
          circle(out, x, y, z, radius, radius, 0.022, 48, [
            a + 0.15,
            b - 0.15,
            road + 0.295,
            road + 1.585,
          ]);
        }
    box(out, 'iron', [b + 0.015, road + 0.13, z - 0.085], [b + 0.17, road + 1.8, z + 0.085], iron);
  }
}
function lamp(out, x, z) {
  box(out, 'stone', [x - 0.7, road - 0.05, z - 0.74], [x + 0.7, road + 1.45, z + 0.74], basalt);
  box(out, 'stone', [x - 0.79, road + 1.4, z - 0.83], [x + 0.79, road + 1.64, z + 0.83], smooth);
  const shapes = [
    [1.65, 0.39],
    [1.85, 0.42],
    [2.03, 0.3],
    [6.35, 0.205],
    [6.55, 0.33],
    [6.74, 0.24],
    [6.96, 0.38],
  ];
  const rings = shapes.map(([y, r]) =>
    Array.from({ length: 40 }, (_, i) => [
      x + r * Math.cos((-i * Math.PI) / 20),
      road + y,
      z + r * Math.sin((-i * Math.PI) / 20),
    ]),
  );
  loft(out, 'iron', rings, iron);
  for (const direction of [-1, 1]) {
    let prev = [x, road + 6.69, z];
    for (let i = 1; i <= 20; i++) {
      const t = i / 20,
        p = [x + direction * (0.9 * t), road + 6.69 + 0.6 * Math.sin((t * Math.PI) / 2), z];
      tube(out, 'iron', prev, p, 0.038, iron, 10);
      prev = p;
    }
    circle(out, x + direction * 0.46, road + 6.7, z, 0.35, 0.24, 0.024, 32);
    sphere(
      out,
      'marking',
      [x + direction * 0.9, road + 7.49, z],
      [0.24, 0.27, 0.24],
      [0.91, 0.925, 0.885],
      32,
      20,
    );
    tube(
      out,
      'iron',
      [x + direction * 0.9, road + 7.17, z],
      [x + direction * 0.9, road + 7.29, z],
      0.12,
      iron,
      24,
    );
  }
  tube(out, 'iron', [x, road + 6.9, z], [x, road + 7.65, z], 0.07, iron, 20);
  sphere(out, 'marking', [x, road + 7.88, z], [0.25, 0.28, 0.25], [0.91, 0.925, 0.885], 32, 20);
}
export function buildHaghtanak(out) {
  for (const z of [-10, 0, 10]) {
    for (const c of centers) mainSpan(out, c, z - 4.62, z + 4.62);
    for (const x of [-24, 24]) pier(out, x, z - 4.2, z + 4.2);
    for (const x of [-72, 72])
      box(out, 'stone', [x - 2.25, 14, z - 4.5], [x + 2.25, 33.4, z + 4.5], basalt);
  }
  abutment(out, -1);
  abutment(out, 1);
  box(out, 'concrete', [-100, 33.4, -15], [100, 33.83, 15], [0.52, 0.52, 0.5]);
  roadSurface(out);
  for (const side of [-1, 1]) {
    const z = side * 13.75;
    box(out, 'paving', [-100, 33.85, z - 1.25], [100, 34.17, z + 1.25], pale);
    box(
      out,
      'stone',
      [-100, 33.08, side < 0 ? -15.21 : 14.7],
      [100, 33.38, side < 0 ? -14.7 : 15.21],
      smooth,
    );
    box(
      out,
      'stone',
      [-100, 33.64, side < 0 ? -15.27 : 14.8],
      [100, 33.91, side < 0 ? -14.8 : 15.27],
      smooth,
    );
    for (let x = -100; x < 100; x += 0.9) {
      for (let lane = 0; lane < 2; lane++)
        box(
          out,
          'paving',
          [x + 0.015, 34.171, side < 0 ? -14.9 + lane * 1.15 : 12.6 + lane * 1.15],
          [Math.min(100, x + 0.885), 34.2, side < 0 ? -13.77 + lane * 1.15 : 13.73 + lane * 1.15],
          pale.map((v) => v + Math.sin(x * 31 + lane) * 0.035),
        );
    }
    rail(out, side * 14.86);
    for (const x of [-96, -72, -48, -24, 0, 24, 48, 72, 96]) lamp(out, x, side * 14.36);
  }
}
function roadSurface(out) {
  // Paint and joints partition the asphalt itself, so distant views have no overlapping caps.
  const lanes = [-9.375, -6.25, -3.125, 3.125, 6.25, 9.375];
  const joints = [-72, -24, 24, 72];
  const dashes = [];
  for (let x = -99; x < 99; x += 7) dashes.push([x, Math.min(x + 3, 100)]);
  const xs = [
    ...new Set([-100, 100, ...dashes.flat(), ...joints.flatMap((x) => [x - 0.038, x + 0.038])]),
  ].sort((a, b) => a - b);
  const zs = [
    -12.5,
    12.5,
    ...lanes.flatMap((z) => [z - 0.06, z + 0.06]),
    ...[-0.13, 0.13].flatMap((z) => [z - 0.045, z + 0.045]),
  ].sort((a, b) => a - b);
  for (let i = 1; i < xs.length; i++)
    for (let j = 1; j < zs.length; j++) {
      const x = (xs[i - 1] + xs[i]) / 2,
        z = (zs[j - 1] + zs[j]) / 2;
      const isJoint = joints.some((a) => Math.abs(x - a) < 0.038);
      const isPaint =
        [-0.13, 0.13].some((a) => Math.abs(z - a) < 0.045) ||
        (lanes.some((a) => Math.abs(z - a) < 0.06) && dashes.some(([a, b]) => x > a && x < b));
      quad(
        out,
        isJoint ? 'iron' : isPaint ? 'marking' : 'road',
        [
          [xs[i - 1], 34, zs[j - 1]],
          [xs[i - 1], 34, zs[j]],
          [xs[i], 34, zs[j]],
          [xs[i], 34, zs[j - 1]],
        ],
        [0, 1, 0],
        isJoint ? iron : isPaint ? [0.85, 0.85, 0.81] : [0.175, 0.183, 0.181],
      );
    }
  for (const z of [-12.5, 12.5]) {
    const q = [
      [-100, 33.83, z],
      [100, 33.83, z],
      [100, 34, z],
      [-100, 34, z],
    ];
    if (z < 0) q.reverse();
    quad(out, 'road', q, normalFor(...q), [0.175, 0.183, 0.181]);
  }
}
export const haghtanakStudy = {
  id: 'N0014',
  key: 'haghtanak_bridge',
  title: 'Haghtanak (Victory) Bridge',
  wikidataId: 'Q2471370',
  build: buildHaghtanak,
  surfaceOverrides: { stone: 'basalt', roughstone: 'basalt' },
  mapFrameDocument: 'map-frame.json',
  brief:
    'Original detailed Victory Bridge exterior: three major basalt-faced reinforced-concrete arches, triple transverse structural units, six open spandrel windows per main span, four approach passages, individually coursed basalt faces, dressed piers, cast-iron four-petal circle lattice and perforated borders, three-globe lamps and the full mapped deck.',
  refs: [
    'https://www.visityerevan.am/places/details/820/en/',
    'https://commons.wikimedia.org/wiki/File:Segerbron_20260401.jpg',
    'https://commons.wikimedia.org/wiki/File:Haghtanak_bridge_01.jpg',
    'https://commons.wikimedia.org/wiki/File:Haghtanak_bridge_04.jpg',
    'https://commons.wikimedia.org/wiki/File:Haghtanak_bridge,_Yerevan_18.jpg',
    'https://www.openstreetmap.org/way/1164537616',
  ],
  sourceFacts: {
    publishedLengthMeters: 200,
    publishedWidthMeters: 25,
    publishedHeightMeters: 34,
    mappedElevatedLengthMeters: 189.83,
    mappedTotalWidthMeters: 30,
    construction:
      'Monolithic reinforced concrete, smooth basalt arch cladding, rough basalt piers and edges, cast-iron handrails; official city inventory.',
    openingDate: '1945-11-25',
  },
  reconstruction: {
    mainSpansMeters: [43, 43, 43],
    spandrelOpeningsPerSpan: 6,
    roadLevelMeters: 34,
    planBasis:
      'Mapped outline about 190 by 30 m; short approach tails extend overall length to 200 m. Three-part transverse piers and paired arch/spandrel forms are interpreted from primary photographs; no survey drawing is asserted.',
    widthBasis:
      'Published city width 25 m is retained as carriageway reconstruction; mapped full 30 m width includes sidewalks. Neither is silently substituted for the other.',
  },
  nativeAxes: {
    x: 'southeast along bridge toward Mashtots/Noy end',
    y: 'up from lowest pier foundations at gorge level',
    z: 'southwest across deck',
  },
  geographic: () => ({
    anchor: frame.anchor,
    heading: frame.heading,
    featureIds: ['way/1164537616', 'way/474678584', 'way/483000270'],
    source: 'https://www.openstreetmap.org/way/1164537616',
    elevationMode: 'terrain-contact',
    notes:
      'Named paired roadways, Armenian Wikipedia-linked bridge perimeter and city inventory establish identity and heading. Native lowest foundations use host gorge terrain; bank-contact heights require actual local terrain review.',
  }),
  limitations: [
    'Arch spans, spandrel dimensions, transverse division and pier elevations are photo-scaled reconstructions, not engineering plans.',
    'Street furnishings and decorative cast iron follow the original 2013/2019 photographs; latest whole-bridge 2026 photograph verifies continued overall appearance. Transient adverts, vehicles and wires are omitted.',
    'Bank retaining ends extend below expected terrain; real gorge and bank elevations must be inspected before geographic approval.',
  ],
  camera: { position: [140, 95, 190], lookAt: [0, 21, 0], fov: 43 },
  qaCameras: [
    { name: 'main-arches', position: [0, 28, 125], lookAt: [0, 20, 0], fov: 48 },
    { name: 'open-spandrels', position: [-25, 30, 46], lookAt: [-25, 27, 12], fov: 45 },
    { name: 'gorge-pier', position: [34, 12, 36], lookAt: [24, 15, 8], fov: 48 },
    { name: 'soffit', position: [-6, 8, 21], lookAt: [0, 26, -9], fov: 55 },
    { name: 'iron-railing', position: [8, 36, 21], lookAt: [4, 35, 14.8], fov: 44 },
    { name: 'three-globe-lamp', position: [30, 39, 23], lookAt: [24, 39, 14.36], fov: 43 },
    { name: 'approach-passages', position: [118, 25, 42], lookAt: [85, 26, 0], fov: 46 },
    { name: 'road-deck', position: [72, 47, 6], lookAt: [0, 34, 0], fov: 53 },
  ],
};
