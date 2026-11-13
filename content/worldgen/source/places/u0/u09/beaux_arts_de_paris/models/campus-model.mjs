/** Original model of the Beaux-Arts de Paris campus, fitted to the mapped building parts. */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import {
  beam,
  normalFor,
  sphere,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';

const earcut = createRequire(
  new URL('../../../../../../../../packages/worldgen/package.json', import.meta.url),
)('earcut').default;
export const layout = JSON.parse(readFileSync(new URL('../layout.json', import.meta.url)));
export const surfaces = {
  stone: { slot: 'wall', graph: 'stone_limestone_weathered' },
  brick: { slot: 'wall', graph: 'brick_flemish' },
  slate: { slot: 'roof', graph: 'slate' },
  zinc: { slot: 'roof', graph: 'metal_standing_seam' },
  granite: { slot: 'foundation', graph: 'stone_granite' },
  iron: { slot: 'trim', graph: 'metal_painted' },
  glass: { slot: 'window', graph: 'window_grid' },
  clear: {
    slot: 'window',
    localRef: 'palette:#c0d9df',
    baseColorFactor: [1, 1, 1, 0.43],
    alphaMode: 'BLEND',
    doubleSided: true,
    roughness: 0.32,
  },
};
const hex = {
  limestone: 'c9b99a',
  ashlar: 'b9aa92',
  detail: 'd7c5a4',
  shade: 'a49176',
  rust: 'a26850',
  slate: '536376',
  darkRoof: '444f59',
  zinc: '909ba0',
  paving: 'b1a696',
  hallFloor: 'b9a087',
  iron: '304942',
  gold: 'b59a4b',
  blue: '497380',
  wine: '793a32',
  glass: '4d6469',
  clear: '9ab7c1',
  clay: 'ad8a71',
  water: '527b7d',
  statue: 'bdbab0',
  verdigris: '668b77',
  garden: '778762',
};
const colors = Object.fromEntries(
  Object.entries(hex).map(([k, value]) => [
    k,
    value.match(/../g).map((part) => {
      const v = parseInt(part, 16) / 255;
      return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    }),
  ]),
);
const [up, down, east, west, south, north] = [
  [0, 1, 0],
  [0, -1, 0],
  [1, 0, 0],
  [-1, 0, 0],
  [0, 0, 1],
  [0, 0, -1],
];
const rank = { skyline: 0, district: 1, street: 2, closeup: 3, master: 4 },
  clamp = (v, a, b) => Math.max(a, Math.min(v, b));
const mix = (a, b, t) => a + (b - a) * t,
  at = ([x, z], y) => [x, y, z];
function emit(out, material, tint, points, side) {
  for (let i = 1; i < points.length - 1; i++) {
    let tri = [points[0], points[i], points[i + 1]],
      normal = normalFor(...tri);
    const [a, b, c] = tri;
    if (
      Math.hypot(...normal) < 0.9 ||
      Math.min(
        Math.hypot(...a.map((p, j) => p - b[j])),
        Math.hypot(...b.map((p, j) => p - c[j])),
        Math.hypot(...c.map((p, j) => p - a[j])),
      ) < 0.00015
    )
      continue;
    if (normal.reduce((s, p, j) => s + p * side[j], 0) < 0) {
      tri = tri.toReversed();
      normal = normal.map((n) => -n);
    }
    const uv = tri.map(([x, y, z]) =>
      Math.abs(normal[1]) > 0.5 ? [x, z] : Math.abs(normal[2]) > 0.5 ? [x, y] : [z, y],
    );
    out.addTriangle(material, 'metric:uv', tri, normal, uv, colors[tint]);
  }
}
function face(out, material, tint, points, side) {
  emit(out, material, tint, points, side);
}
function cap(out, material, tint, p, height) {
  const rings = [p.outline, ...(p.holes ?? [])],
    points = rings.flat(),
    holes = [];
  let start = rings[0].length;
  for (const h of rings.slice(1)) {
    holes.push(start);
    start += h.length;
  }
  const index = earcut(points.flat(), holes);
  for (let i = 0; i < index.length; i += 3)
    face(
      out,
      material,
      tint,
      index
        .slice(i, i + 3)
        .map((j) => at(points[j], typeof height === 'number' ? height : height(points[j]))),
      up,
    );
}
function box(out, material, tint, x0, y0, z0, x1, y1, z1) {
  const A = [
      [x0, y0, z0],
      [x1, y0, z0],
      [x1, y0, z1],
      [x0, y0, z1],
    ],
    B = A.map(([x, , z]) => [x, y1, z]);
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    face(out, material, tint, [A[i], A[j], B[j], B[i]], [north, east, south, west][i]);
  }
  face(out, material, tint, B, up);
  face(out, material, tint, A, down);
}
function outlineEdges(ring, inner = false) {
  const winding =
    Math.sign(
      ring.reduce((sum, [x, z], i) => {
        const [u, v] = ring[(i + 1) % ring.length];
        return sum + x * v - z * u;
      }, 0),
    ) * (inner ? -1 : 1);
  return ring.flatMap((a, i) => {
    const b = ring[(i + 1) % ring.length],
      x = b[0] - a[0],
      z = b[1] - a[1],
      length = Math.hypot(x, z);
    if (length < 0.055) return [];
    const n = [(winding * z) / length, 0, (-winding * x) / length];
    return [
      {
        a,
        b,
        n,
        length,
        point: (s, y, d = 0) => [
          a[0] + (s * x) / length + n[0] * d,
          y,
          a[1] + (s * z) / length + n[2] * d,
        ],
      },
    ];
  });
}
function panel(out, e, material, tint, a, b, y, h, depth = 0) {
  if (b - a > 0.015 && h - y > 0.015)
    face(
      out,
      material,
      tint,
      [e.point(a, y, depth), e.point(b, y, depth), e.point(b, h, depth), e.point(a, h, depth)],
      e.n,
    );
}
function ledge(out, e, material, tint, a, b, y, h, depth) {
  panel(out, e, material, tint, a, b, y, h, depth);
  face(
    out,
    material,
    tint,
    [e.point(a, h), e.point(b, h), e.point(b, h, depth), e.point(a, h, depth)],
    up,
  );
  face(
    out,
    material,
    tint,
    [e.point(a, y), e.point(b, y), e.point(b, y, depth), e.point(a, y, depth)],
    down,
  );
}
function simplify(ring, tolerance) {
  const result = ring.slice();
  while (result.length > 3) {
    const distances = result.map(([x, z], i) => {
      const [a, b] = result[(i + result.length - 1) % result.length],
        [c, d] = result[(i + 1) % result.length],
        dx = c - a,
        dz = d - b,
        L = dx * dx + dz * dz;
      const s = L ? clamp(((x - a) * dx + (z - b) * dz) / L, 0, 1) : 0;
      return Math.hypot(x - a - s * dx, z - b - s * dz);
    });
    const min = Math.min(...distances);
    if (min > tolerance) break;
    result.splice(distances.indexOf(min), 1);
  }
  return result;
}
function archPoints(e, a, b, y, rise, n, d) {
  return Array.from({ length: n + 1 }, (_, i) => {
    const t = Math.PI * (1 - i / n);
    return e.point((a + b) / 2 + ((b - a) / 2) * Math.cos(t), y + rise * Math.sin(t), d);
  });
}
function archRing(out, e, a, b, y, rise, thick, n, tint, depth) {
  const inner = archPoints(e, a, b, y, rise, n, depth),
    outer = archPoints(e, a - thick, b + thick, y, rise + thick, n, depth);
  for (let i = 0; i < n; i++)
    face(out, 'stone', tint, [inner[i], inner[i + 1], outer[i + 1], outer[i]], e.n);
}
function window(out, e, center, width, base, top, arched, detail, tint = 'detail', door = false) {
  const a = center - width / 2,
    b = center + width / 2,
    shoulder = arched ? top - width * 0.38 : top;
  const pane = door ? 'iron' : 'glass',
    color = door ? 'wine' : 'glass';
  panel(out, e, pane, color, a, b, base, shoulder, 0.024);
  if (arched) {
    const n = detail > 3 ? 13 : detail > 2 ? 9 : 5,
      rise = top - shoulder;
    face(out, pane, color, archPoints(e, a, b, shoulder, rise, n, 0.024), e.n);
    archRing(out, e, a, b, shoulder, rise, 0.14, n, tint, 0.063);
  } else panel(out, e, 'stone', tint, a - 0.13, b + 0.13, top, top + 0.18, 0.061);
  if (detail < 3) return;
  panel(out, e, 'stone', tint, a - 0.13, a, base - 0.07, shoulder, 0.07);
  panel(out, e, 'stone', tint, b, b + 0.13, base - 0.07, shoulder, 0.07);
  ledge(out, e, 'stone', tint, a - 0.23, b + 0.23, base - 0.16, base - 0.045, 0.17);
  panel(out, e, 'iron', 'wine', center - 0.036, center + 0.036, base, top - 0.05, 0.06);
  panel(out, e, 'iron', 'wine', a, b, mix(base, top, 0.56), mix(base, top, 0.56) + 0.063, 0.06);
}
function styleOf(block) {
  return block.style === 'murier'
    ? ['brick', 'rust', 'clay']
    : block.style === 'perret'
      ? ['stone', 'ashlar', 'zinc']
      : ['stone', block.style === 'chapel' ? 'ashlar' : 'limestone', 'slate'];
}
function windows(out, e, b, detail, inner) {
  if (e.length < 3.65 || b.height < 4.5 || b.style === 'glass-ring') return;
  const [mat, tint] = styleOf(b),
    bottom = b.base,
    top = bottom + b.height;
  const palace = b.style === 'palais' || b.style === 'palais-wing',
    formal = palace && e.n[0] > 0.76 && e.length > 9;
  const high = e.length > 12 && b.height > 8;
  if (detail === 1 && !formal && (e.length < 10 || inner)) return;
  const n = Math.max(1, Math.round(e.length / (formal ? 4.38 : detail === 1 ? 10 : 4.3)));
  const cell = e.length / n;
  const inscription = formal && b.style === 'palais' && e.length > 35;
  if (detail > 1) {
    ledge(out, e, 'stone', 'ashlar', 0, e.length, bottom + 0.37, bottom + 0.62, 0.095);
    ledge(out, e, 'stone', 'detail', 0, e.length, top - 0.66, top - 0.27, 0.29);
    if (high)
      ledge(
        out,
        e,
        'stone',
        'detail',
        0,
        e.length,
        bottom + b.height * 0.68,
        bottom + b.height * 0.68 + 0.23,
        0.2,
      );
  }
  for (let i = 0; i < n; i++) {
    const x = (i + 0.5) * cell,
      w = Math.min(cell * 0.53, formal ? 2.25 : 1.68),
      arch = detail > 1 && (formal || b.style === 'chapel' || inner);
    if (formal) {
      const doorway = b.style === 'palais' && i === Math.floor(n / 2);
      window(
        out,
        e,
        x,
        doorway ? w * 1.25 : w,
        bottom + (doorway ? 0.04 : 1.03),
        bottom + 4.92,
        arch,
        detail,
        'detail',
        doorway,
      );
      window(out, e, x, w * 1.02, bottom + 6.66, bottom + 11.15, arch, detail);
      if (!inscription || Math.abs(i - Math.floor(n / 2)) > 1)
        window(out, e, x, w * 0.75, bottom + 13.33, bottom + 15.71, false, detail);
      if (detail > 1) {
        const p = cell * i + 0.32;
        const pilaster = detail > 2 ? ledge : panel;
        pilaster(out, e, mat, 'detail', p, p + 0.31, bottom + 5.93, bottom + 11.58, 0.29);
        panel(out, e, 'stone', 'shade', p - 0.1, p + 0.39, bottom + 5.82, bottom + 6.03, 0.19);
        panel(out, e, 'stone', 'detail', p - 0.12, p + 0.48, bottom + 11.49, bottom + 11.85, 0.37);
      }
    } else {
      const y = b.style === 'murier' && inner ? b.base + 5.85 : bottom + 1.6;
      window(
        out,
        e,
        x,
        w,
        y,
        Math.min(top - 0.45, y + (high ? 2.55 : 1.79)),
        arch,
        detail,
        detail === 1 ? 'ashlar' : 'detail',
      );
      if (high && detail > 1 && !(b.style === 'murier' && inner))
        window(
          out,
          e,
          x,
          w * 0.91,
          bottom + b.height * 0.59,
          bottom + b.height * 0.59 + 2.01,
          false,
          detail,
        );
      if (detail >= 3 && high && b.style === 'chimay')
        panel(
          out,
          e,
          'stone',
          tint,
          x - w * 0.7,
          x + w * 0.7,
          bottom + b.height * 0.5,
          bottom + b.height * 0.5 + 0.16,
          0.08,
        );
    }
  }
  if (inscription) {
    const mid = e.length / 2;
    ledge(out, e, 'stone', 'shade', mid - 5.0, mid + 5.0, bottom + 13.47, bottom + 15.64, 0.12);
    panel(out, e, 'stone', 'detail', mid - 4.7, mid + 4.7, bottom + 13.68, bottom + 15.42, 0.15);
    if (detail > 1)
      for (const height of [14.06, 14.56])
        for (let k = -11; k < 11; k++) {
          const x = mid + k * 0.31 + (k % 3) * 0.034;
          panel(
            out,
            e,
            'iron',
            'gold',
            x,
            x + 0.19,
            bottom + height,
            bottom + height + 0.12,
            0.166,
          );
        }
  }
}
function arcade(out, e, b, detail) {
  const n = Math.max(2, Math.round(e.length / 3.55)),
    spacing = e.length / n,
    base = b.base + 0.08,
    shoulder = base + 2.48,
    rise = 1.12,
    roof = base + 4.12;
  const steps = detail > 2 ? 9 : 4;
  for (let i = 0; i < n; i++) {
    const start = i * spacing,
      end = (i + 1) * spacing,
      a = start + spacing * 0.155,
      z = end - spacing * 0.155;
    panel(out, e, 'stone', 'ashlar', start, a, base, roof);
    panel(out, e, 'stone', 'ashlar', z, end, base, roof);
    const pts = archPoints(e, a, z, shoulder, rise, steps, 0);
    const soffit = archPoints(e, a, z, shoulder, rise, steps, -0.45);
    for (let j = 1; j <= steps; j++) {
      const p = pts[j - 1],
        q = pts[j];
      face(out, 'stone', 'limestone', [p, q, [q[0], roof, q[2]], [p[0], roof, p[2]]], e.n);
      face(out, 'stone', 'ashlar', [p, q, soffit[j], soffit[j - 1]], down);
    }
    if (detail > 1) archRing(out, e, a, z, shoulder, rise, 0.125, steps, 'detail', 0.035);
  }
  panel(out, e, 'stone', 'shade', 0, e.length, base, roof, -2.15);
  face(
    out,
    'stone',
    'ashlar',
    [
      e.point(0, roof),
      e.point(e.length, roof),
      e.point(e.length, roof, -2.15),
      e.point(0, roof, -2.15),
    ],
    down,
  );
}
function block(out, b, p, detail) {
  const [material, tint, roofTint] = styleOf(b);
  const stone = b.style === 'murier' ? 'rust' : tint;
  const top = b.base + b.height,
    roofMat = roofTint === 'zinc' ? 'zinc' : 'slate',
    roofColor = roofTint === 'clay' ? 'clay' : roofTint;
  const y = (pt) => {
    const { axis, lo, hi, ridge } = p.roof;
    return top + b.roof * Math.max(0, 1 - Math.abs(pt[axis] - ridge) / ((hi - lo) / 2 || 1));
  };
  const ring = detail === 0 ? simplify(p.outline, 0.64) : p.outline,
    holes = detail === 0 ? p.holes.map((h) => simplify(h, 0.55)) : p.holes;
  for (const [inside, r] of [[false, ring], ...holes.map((h) => [true, h])])
    for (const e of outlineEdges(r, inside)) {
      const useArcade = inside && b.style === 'murier' && detail > 0;
      panel(out, e, material, stone, 0, e.length, useArcade ? b.base + 4.2 : b.base - 2.8, top);
      if (useArcade) arcade(out, e, b, detail);
      if (detail > 0) {
        const { axis, ridge } = p.roof;
        const first = e.a[axis],
          last = e.b[axis],
          across = (ridge - first) / (last - first);
        const breaks = across > 0.001 && across < 0.999 ? [0, across, 1] : [0, 1];
        for (let i = 1; i < breaks.length; i++) {
          const point = (t) => [mix(e.a[0], e.b[0], t), mix(e.a[1], e.b[1], t)];
          const a = point(breaks[i - 1]),
            c = point(breaks[i]);
          face(out, roofMat, roofColor, [at(a, top), at(c, top), at(c, y(c)), at(a, y(a))], e.n);
        }
        windows(out, e, b, detail, inside);
      }
    }
  if (detail > 0 && b.style !== 'glass-ring')
    for (const panel of p.roof.panels) cap(out, roofMat, roofColor, panel, y);
  else cap(out, roofMat, roofColor, { outline: ring, holes }, top);
}
const [groundX, groundZ, xEnd, zEnd] = layout.gradeBounds,
  step = layout.groundStep,
  groundColumns = 1 + (zEnd - groundZ) / step,
  groundRows = 1 + (xEnd - groundX) / step;
function ground(x, z) {
  const u = clamp((x - groundX) / step, 0, groundRows - 1.0001),
    v = clamp((z - groundZ) / step, 0, groundColumns - 1.0001);
  const i = Math.floor(u),
    j = Math.floor(v),
    a = u - i,
    b = v - j,
    n = groundColumns,
    r = layout.groundCells;
  const q = (x, z) => r[x * n + z][2];
  return mix(mix(q(i, j), q(i + 1, j), a), mix(q(i, j + 1), q(i + 1, j + 1), a), b);
}
function cylinder(out, material, tint, cx, y0, cz, r0, r1, height, n = 10) {
  const ring = (y, r) =>
    Array.from({ length: n }, (_, i) => [
      cx + r * Math.cos((i * 2 * Math.PI) / n),
      y,
      cz + r * Math.sin((i * 2 * Math.PI) / n),
    ]);
  const A = ring(y0, r0),
    B = ring(y0 + height, r1);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    face(out, material, tint, [A[i], A[j], B[j], B[i]], [A[i][0] - cx, 0, A[i][2] - cz]);
  }
  face(out, material, tint, B, up);
}
function terrace(out, detail) {
  const t = layout.terrace;
  box(out, 'stone', 'ashlar', t.x0, -1.1, t.z0, t.x1, t.y, t.z1);
  if (detail < 1) return;
  const zc = 47.9;
  for (let i = 0; i < 8; i++) {
    const x = t.x1 + i * 0.37;
    box(out, 'stone', 'detail', x, t.y - 0.94, zc - 3.9, x + 0.39, t.y - i * 0.096, zc + 3.9);
  }
  for (const sign of [-1, 1]) {
    const a = zc + sign * 4.5,
      b = sign > 0 ? t.z1 : t.z0;
    const lo = Math.min(a, b),
      hi = Math.max(a, b);
    box(out, 'stone', 'ashlar', t.x1 - 0.28, t.y, lo, t.x1 + 0.16, t.y + 0.21, hi);
    box(out, 'stone', 'detail', t.x1 - 0.33, t.y + 0.87, lo, t.x1 + 0.21, t.y + 1.03, hi);
    if (detail > 1)
      for (let z = lo + 0.3; z < hi - 0.14; z += 1.17)
        box(
          out,
          'stone',
          'detail',
          t.x1 - 0.2,
          t.y + 0.18,
          z - 0.12,
          t.x1 + 0.08,
          t.y + 0.89,
          z + 0.12,
        );
  }
  if (detail > 1) {
    for (const z of [26, 69]) {
      cylinder(out, 'stone', 'detail', 2.6, t.y, z, 0.71, 0.68, 0.28);
      cylinder(
        out,
        'stone',
        'limestone',
        2.6,
        t.y + 0.25,
        z,
        0.43,
        0.36,
        6.52,
        detail > 2 ? 12 : 7,
      );
      cylinder(out, 'stone', 'detail', 2.6, t.y + 6.75, z, 0.52, 0.56, 0.33);
      sphere(out, 'iron', [2.6, t.y + 7.55, z], [0.34, 0.57, 0.28], colors.verdigris, 8, 6);
    }
  }
}
function gate(out, detail) {
  const { x, z, width, y, ends } = layout.gates,
    a = z - width / 2,
    b = z + width / 2;
  for (const p of [a - 0.48, b + 0.48]) {
    box(out, 'stone', 'detail', x - 0.53, y - 1, p - 0.51, x + 0.51, y + 4.32, p + 0.51);
    if (detail > 0) {
      box(out, 'stone', 'limestone', x - 0.61, y + 4.26, p - 0.6, x + 0.59, y + 4.52, p + 0.6);
      box(out, 'stone', 'statue', x - 0.25, y + 4.51, p - 0.36, x + 0.32, y + 4.84, p + 0.36);
      sphere(
        out,
        'stone',
        [x + 0.02, y + 5.16, p],
        [0.29, 0.47, 0.29],
        colors.statue,
        detail > 2 ? 12 : 7,
        detail > 2 ? 8 : 5,
      );
    }
  }
  for (const [p, q] of [
    [ends[0], [x, a - 0.88]],
    [[x, b + 0.88], ends[1]],
  ]) {
    const edge = outlineEdges([p, q, [q[0] + 0.26, q[1] + 0.005], [p[0] + 0.26, p[1] + 0.005]])[0];
    const floor = (ground(...p) + ground(...q)) * 0.5;
    ledge(out, edge, 'stone', 'ashlar', 0, edge.length, floor - 0.52, floor + 1.43, 0.34);
    if (detail > 0)
      for (let s = 0.24; s < edge.length; s += detail === 1 ? 1.4 : 0.64)
        beam(
          out,
          'iron',
          edge.point(s, floor + 1.4, 0.17),
          edge.point(s, floor + 2.73, 0.17),
          0.066,
          0.066,
          colors.iron,
        );
  }
  if (detail === 0) return;
  for (const h of [y + 0.28, y + 1.62, y + 3.65, y + 3.97])
    beam(out, 'iron', [x, h, a], [x, h, b], 0.092, 0.093, colors.iron);
  const bars = detail === 1 ? 8 : 16;
  for (let i = 0; i <= bars; i++) {
    const p = mix(a, b, i / bars);
    beam(
      out,
      'iron',
      [x, y + 0.23, p],
      [x, y + 3.97, p],
      i === bars / 2 ? 0.112 : 0.065,
      0.062,
      colors.iron,
    );
  }
  if (detail < 2) return;
  for (const height of [y + 2.1, y + 2.72, y + 3.32])
    for (let j = 0; j < 8; j++) {
      const z0 = mix(a, b, (j + 0.5) / 8),
        r = 0.235,
        n = detail > 2 ? 8 : 5;
      const ring = Array.from({ length: n }, (_, i) => [
        x + 0.037,
        height + r * Math.sin((i * 2 * Math.PI) / n),
        z0 + r * Math.cos((i * 2 * Math.PI) / n),
      ]);
      for (let i = 0; i < n; i++)
        beam(out, 'iron', ring[i], ring[(i + 1) % n], 0.045, 0.043, colors.iron);
      if (detail > 2)
        cylinder(out, 'iron', 'gold', x + 0.053, height - 0.036, z0, 0.079, 0.079, 0.075, 7);
    }
}
function hall(out, detail) {
  const hull = layout.hall,
    xs = hull.map((p) => p[0]),
    zs = hull.map((p) => p[1]),
    x0 = Math.min(...xs),
    x1 = Math.max(...xs),
    z0 = Math.min(...zs),
    z1 = Math.max(...zs),
    mid = (x0 + x1) / 2;
  const eave = 14.18,
    peak = 16.44,
    y = layout.hallBase;
  const half = (x) => [
    [x, z0 + 0.2],
    [mid, z0 + 0.2],
    [mid, z1 - 0.2],
    [x, z1 - 0.2],
  ];
  for (const x of [x0 + 0.08, x1 - 0.08])
    cap(
      out,
      detail >= 2 ? 'clear' : 'glass',
      detail >= 2 ? 'clear' : 'glass',
      { outline: half(x) },
      (p) => (p[0] === mid ? peak : eave),
    );
  if (detail === 0) return;
  for (const z of [z0 + 0.18, z1 - 0.18])
    face(
      out,
      'glass',
      'glass',
      [
        [x0, eave, z],
        [mid, peak, z],
        [x1, eave, z],
      ],
      z < (z0 + z1) / 2 ? north : south,
    );
  cap(out, 'granite', 'hallFloor', { outline: hull }, y);
  const rafters = detail === 1 ? 6 : 10;
  for (let i = 0; i <= rafters; i++) {
    const z = mix(z0 + 0.27, z1 - 0.27, i / rafters);
    for (const x of [x0 + 0.08, x1 - 0.08])
      beam(out, 'iron', [x, eave + 0.02, z], [mid, peak + 0.04, z], 0.096, 0.095, colors.blue);
  }
  for (const x of [x0 + 0.1, mix(x0, mid, 0.45), mid, mix(mid, x1, 0.55), x1 - 0.1]) {
    const h = eave + (peak - eave) * (1 - Math.abs(x - mid) / ((x1 - x0) / 2));
    beam(out, 'iron', [x, h + 0.04, z0 + 0.13], [x, h + 0.04, z1 - 0.13], 0.11, 0.094, colors.blue);
  }
  if (detail < 2) return;
  for (const e of outlineEdges(hull, true)) {
    if (e.length < 8) continue;
    panel(out, e, 'stone', 'detail', 0, e.length, y, eave, 0.02);
    ledge(out, e, 'stone', 'clay', 0, e.length, y + 4.0, y + 4.32, 0.075);
    ledge(out, e, 'stone', 'detail', 0, e.length, eave - 0.62, eave - 0.32, 0.1);
    const count = Math.max(2, Math.round(e.length / 5.65));
    const bay = e.length / count;
    for (let i = 0; i < count; i++) {
      const mid = (i + 0.5) * bay;
      panel(
        out,
        e,
        'stone',
        'clay',
        mid - bay * 0.4,
        mid + bay * 0.4,
        y + 5.05,
        eave - 0.68,
        0.043,
      );
      const interiorEdge = { ...e, point: (x, y, depth = 0) => e.point(x, y, depth + 0.062) };
      window(
        out,
        interiorEdge,
        mid,
        Math.min(2.32, bay * 0.46),
        y + 5.48,
        eave - 2.0,
        true,
        detail,
      );
      window(out, interiorEdge, mid, Math.min(2.5, bay * 0.47), y + 0.41, y + 3.72, true, detail);
      if (detail < 3) continue;
      for (const offset of [-0.31, 0.31]) {
        const medallion = Array.from({ length: 10 }, (_, j) => {
          const angle = (j * 2 * Math.PI) / 10;
          return e.point(
            mid + bay * offset + Math.cos(angle) * 0.38,
            eave - 1.65 + Math.sin(angle) * 0.38,
            0.092,
          );
        });
        face(out, 'iron', 'gold', medallion, e.n);
      }
    }
  }
  for (const x of [x0 + 0.42, x1 - 0.42])
    for (let i = 0; i < 8; i++) {
      const z = mix(z0 + 2.1, z1 - 2.1, i / 7),
        sign = x < mid ? 1 : -1;
      cylinder(out, 'stone', 'limestone', x, y, z, 0.26, 0.22, 0.43, detail > 2 ? 9 : 6);
      cylinder(out, 'iron', 'blue', x, y + 0.39, z, 0.12, 0.105, 11.72, detail > 2 ? 9 : 6);
      cylinder(out, 'iron', 'gold', x, y + 12.06, z, 0.23, 0.26, 0.27, 8);
      box(
        out,
        'stone',
        'clay',
        x + Math.min(0, sign * 0.42),
        y + 0.34,
        z - 1.78,
        x + Math.max(0, sign * 0.42),
        y + 2.2,
        z + 1.78,
      );
      if (detail > 2 && i % 2 === 0) {
        box(
          out,
          'stone',
          'detail',
          x + sign * 1.8 - 0.36,
          y,
          z - 0.32,
          x + sign * 1.8 + 0.36,
          y + 0.96,
          z + 0.32,
        );
        sphere(
          out,
          'stone',
          [x + sign * 1.8, y + 1.49, z],
          [0.23, 0.56, 0.25],
          colors.statue,
          7,
          5,
        );
      }
    }
}
function courtyardDetails(out, detail) {
  if (detail === 0) return;
  for (const c of layout.courtyards) {
    const patches = detail === 1 ? [{ outline: c.outline }] : c.patches;
    for (const p of patches)
      cap(
        out,
        'granite',
        'paving',
        p,
        ([x, z]) => ground(x, z) + c.lift + (detail === 1 ? 0.12 : 0),
      );
  }
  const cx = 33.9,
    cz = 5.25,
    y = ground(cx, cz) + 0.21;
  cylinder(out, 'stone', 'limestone', cx, y, cz, 2.65, 2.58, 0.31, 12);
  cylinder(out, 'iron', 'water', cx, y + 0.315, cz, 2.39, 2.39, 0.018, 12);
  cylinder(out, 'stone', 'ashlar', cx, y + 0.32, cz, 0.45, 0.29, 1.38, 10);
  cylinder(out, 'stone', 'detail', cx, y + 1.63, cz, 0.57, 0.75, 0.28, 12);
  if (detail > 2) cylinder(out, 'iron', 'water', cx, y + 1.91, cz, 0.62, 0.62, 0.016, 12);
}
export function buildCampus(out, level = 'master') {
  const detail = rank[level];
  if (detail === undefined) throw Error('Unknown Beaux-Arts de Paris level');
  for (const b of layout.blocks)
    for (const p of b.polygons) {
      if (detail === 0 && ['studio', 'wall'].includes(b.style)) continue;
      block(out, b, p, detail);
    }
  hall(out, detail);
  terrace(out, detail);
  gate(out, detail);
  courtyardDetails(out, detail);
}
export const buildCampusSkyline = (out) => buildCampus(out, 'skyline');
export const buildCampusDistrict = (out) => buildCampus(out, 'district');
export const buildCampusStreet = (out) => buildCampus(out, 'street');
export const buildCampusCloseup = (out) => buildCampus(out, 'closeup');
