/** Gare Montparnasse. The terminal, the raised garden and the covered rail fan. */
import { readFileSync } from 'node:fs';
import earcut from 'earcut';
import { beam, normalFor, sphere, torus } from './authored-structure-mesh.mjs';
import { prism, rect } from './khmer-structure-geometry.mjs';
import { lettering } from './stadium-lettering.mjs';

export const layout = JSON.parse(
  readFileSync(
    new URL(
      '../../../content/worldgen/source/places/u0/u09/gare_montparnasse/layout.json',
      import.meta.url,
    ),
  ),
);
const concrete = { slot: 'wall', graph: 'concrete_plain', roughness: 0.92 };
const curtain = { slot: 'wall', graph: 'glass_frit_triangular', roughness: 0.43, metallic: 0.12 };
const painted = { slot: 'trim', graph: 'metal_painted', roughness: 0.73, metallic: 0.14 };
const granite = { slot: 'foundation', graph: 'stone_granite', roughness: 0.93 };
const foliage = { slot: 'wall', localRef: 'palette:#ffffff', roughness: 0.98 };
export const surfaces = {
  concrete,
  lower: concrete,
  slab: concrete,
  concretePanel: { slot: 'wall', graph: 'concrete_panel', roughness: 0.88 },
  glass: curtain,
  darkGlass: curtain,
  lightGlass: curtain,
  roofGlass: curtain,
  metal: painted,
  rail: painted,
  post: painted,
  white: painted,
  teal: painted,
  red: painted,
  walk: granite,
  ballast: granite,
  sleeper: granite,
  soil: granite,
  zinc: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.83, metallic: 0.1 },
  clear: {
    slot: 'window',
    localRef: 'palette:#dbf4fa',
    roughness: 0.25,
    metallic: 0.05,
    alphaMode: 'BLEND',
    baseColorFactor: [1, 1, 1, 0.49],
    doubleSided: true,
  },
  foliage,
  lawn: foliage,
  leafDark: foliage,
  leafLight: foliage,
  court: foliage,
  flower: foliage,
};
const swatches = {
  concrete: [0.73, 0.73, 0.68],
  lower: [0.5, 0.53, 0.52],
  slab: [0.6, 0.61, 0.57],
  concretePanel: [0.68, 0.7, 0.68],
  glass: [0.32, 0.42, 0.44],
  darkGlass: [0.26, 0.35, 0.37],
  lightGlass: [0.25, 0.37, 0.4],
  roofGlass: [0.36, 0.54, 0.59],
  metal: [0.72, 0.75, 0.73],
  rail: [0.33, 0.38, 0.41],
  post: [0.26, 0.29, 0.29],
  white: [0.87, 0.9, 0.88],
  teal: [0.27, 0.47, 0.47],
  red: [0.6, 0.022, 0.19],
  walk: [0.7, 0.66, 0.57],
  ballast: [0.29, 0.27, 0.25],
  sleeper: [0.51, 0.48, 0.42],
  soil: [0.36, 0.31, 0.24],
  zinc: [0.41, 0.44, 0.44],
  clear: [0.66, 0.81, 0.81],
  foliage: [0.25, 0.42, 0.2],
  lawn: [0.49, 0.61, 0.35],
  leafDark: [0.13, 0.28, 0.15],
  leafLight: [0.37, 0.52, 0.24],
  court: [0.13, 0.39, 0.53],
  flower: [0.64, 0.22, 0.3],
};
const linear = (v) => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
const colors = Object.fromEntries(
  Object.entries(swatches).map(([name, color]) => [name, color.map(linear)]),
);
const up = [0, 1, 0],
  north = [0, 0, -1],
  ref = 'palette:#ffffff';
const lerp = (a, b, t) => a + (b - a) * t;
const scaled = (p, k) => p.map((v) => Math.min(1, v * k));
const steps = (n, f) => Array.from({ length: n }, (_, i) => f(i));
const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
const tint = (i, j = 0) =>
  0.94 + (((Math.imul(i + 40, 38119) ^ Math.imul(j + 105, 66413)) >>> 7) % 141) / 1250;

function writer(out) {
  return (role, points, dir, tone = 1) => {
    for (let i = 1; i < points.length - 1; i++) {
      const p = [points[0], points[i], points[i + 1]].map((v) => v.map(Math.fround));
      let n = normalFor(...p);
      if (Math.hypot(...n) < 0.5) continue;
      if (dot(n, dir) < 0) {
        p.reverse();
        n = n.map((v) => -v);
      }
      out.addTriangle(role, ref, p, n, undefined, scaled(colors[role], tone));
    }
  };
}
function cap(f, role, polygon, y, dir = up, tone = 1) {
  const starts = [],
    rings = [polygon.outline, ...(polygon.holes ?? [])];
  let count = rings[0].length;
  for (const h of rings.slice(1)) {
    starts.push(count);
    count += h.length;
  }
  const v = rings.flat(),
    tris = earcut(v.flat(), starts);
  for (let i = 0; i < tris.length; i += 3)
    f(
      role,
      tris.slice(i, i + 3).map((k) => [v[k][0], y, v[k][1]]),
      dir,
      tone,
    );
}
const block = (f, r, x, z, w, d, lo, hi) => prism(f, r, rect(x, z, w, d), lo, hi, false);
function signed(r) {
  return r.reduce((s, a, i) => {
    const b = r[(i + 1) % r.length];
    return s + a[0] * b[1] - a[1] * b[0];
  }, 0);
}
function edges(polygon) {
  return [polygon.outline, ...(polygon.holes ?? [])]
    .flatMap((ring, j) => {
      const s = Math.sign(signed(ring)) * (j ? -1 : 1);
      return ring.map((a, i) => {
        const b = ring[(i + 1) % ring.length],
          dx = b[0] - a[0],
          dz = b[1] - a[1],
          w = Math.hypot(dx, dz);
        const n = [(s * dz) / w, 0, (-s * dx) / w];
        return {
          a,
          b,
          w,
          n,
          point: (u, y, d = 0) => [
            a[0] + (dx * u) / w + n[0] * d,
            y,
            a[1] + (dz * u) / w + n[2] * d,
          ],
        };
      });
    })
    .filter((e) => e.w > 0.035);
}
function face(f, role, e, lo, hi, a = 0, b = e.w, offset = 0, tone = 1) {
  if (hi - lo < 0.001 || b - a < 0.001) return;
  f(
    role,
    [
      e.point(a, lo, offset),
      e.point(b, lo, offset),
      e.point(b, hi, offset),
      e.point(a, hi, offset),
    ],
    e.n,
    tone,
  );
}
function line(f, role, a, b, width, tone = 1) {
  const dx = b[0] - a[0],
    dz = b[2] - a[2],
    n = Math.hypot(dx, dz);
  if (n < 0.001) return;
  const x = ((-dz / n) * width) / 2,
    z = ((dx / n) * width) / 2;
  f(
    role,
    [
      [a[0] + x, a[1], a[2] + z],
      [b[0] + x, b[1], b[2] + z],
      [b[0] - x, b[1], b[2] - z],
      [a[0] - x, a[1], a[2] - z],
    ],
    up,
    tone,
  );
}
function frame(f, e, lo, hi, floors, tier, style) {
  if (tier === 0 || e.w < 2.2) return;
  const num = Math.max(1, Math.round(e.w / (tier === 1 ? 16 : style === 'front' ? 2.64 : 3.48)));
  const margin = tier === 1 ? 0.28 : 0.14;
  for (let i = 0; i <= num; i++) {
    const x = (e.w * i) / num;
    face(
      f,
      'metal',
      e,
      lo + 0.1,
      hi - 0.04,
      Math.max(0, x - margin),
      Math.min(e.w, x + margin),
      0.062,
      tint(i),
    );
    if (tier >= 3 && style === 'front' && i < num) {
      const u = x + (e.w / num) * 0.54;
      face(f, 'white', e, lo + 0.21, hi - 0.22, u - 0.043, u + 0.043, 0.055, 0.84);
    }
  }
  const n = tier === 1 ? Math.ceil(floors / 3) : floors;
  for (let j = 1; j < n; j++) {
    const y = lerp(lo, hi, j / n),
      depth = tier === 1 ? 0.28 : 0.18;
    face(f, 'concretePanel', e, y - depth, y + depth, 0, e.w, 0.034, tint(j));
    if (tier >= 3) face(f, 'darkGlass', e, y + 0.18, y + 0.63, 0, e.w, 0.015, 0.94);
  }
}
function office(f, B, tier) {
  for (const p of layout.outlines[B.id]) {
    const ridge = B.top - 0.62;
    const base = B.base + 2.8;
    for (const e of edges(p)) {
      face(f, 'concretePanel', e, B.base, base);
      face(f, B.style === 'front' ? 'darkGlass' : 'glass', e, base, ridge);
      frame(f, e, base, ridge, B.floors, tier, B.style);
      if (tier >= 2 && B.style === 'east' && e.w > 100) {
        const bays = Math.round(e.w / 30),
          middle = (base + ridge) / 2;
        for (let i = 0; i < bays; i++)
          for (const [lo, hi] of [
            [base + 1, middle],
            [middle, ridge - 0.6],
          ]) {
            const a = (i * e.w) / bays,
              b = ((i + 1) * e.w) / bays,
              w = 0.3,
              reverse = i % 2;
            const y0 = reverse ? hi : lo,
              y1 = reverse ? lo : hi;
            f(
              'white',
              [
                e.point(a, y0 - w, 0.135),
                e.point(b, y1 - w, 0.135),
                e.point(b, y1 + w, 0.135),
                e.point(a, y0 + w, 0.135),
              ],
              e.n,
              0.92,
            );
          }
      }
      face(f, 'white', e, ridge, B.top);
      if (tier >= 2) face(f, 'concretePanel', e, base + 0.47, base + 0.66, 0, e.w, 0.07);
    }
    cap(f, 'zinc', p, B.top);
    if (tier >= 2 && B.style === 'front')
      for (let i = 0; i < 14; i += tier === 2 ? 2 : 1) {
        const x = -77 + 11.2 * i;
        block(f, 'lower', x, -233.6, 3.85, 3.36, B.top, B.top + 0.72 + (i % 3) * 0.34);
        if (tier >= 3)
          for (let j = 0; j < 3; j++)
            block(
              f,
              'zinc',
              x,
              -234.7 + j * 0.65,
              3.3,
              0.22,
              B.top + 0.73 + (i % 3) * 0.34,
              B.top + 0.82 + (i % 3) * 0.34,
            );
      }
  }
}
function terminal(f, out, tier) {
  const { front: F } = layout;
  const roof = F.retailRoof;
  for (const p of layout.outlines[layout.podiumId]) {
    cap(f, 'zinc', p, roof);
    cap(f, 'lower', p, roof - 0.52, [0, -1, 0]);
    for (const e of edges(p)) {
      const gate =
        e.a[1] < -284 &&
        e.b[1] < -284 &&
        Math.min(e.a[0], e.b[0]) > -52 &&
        Math.max(e.a[0], e.b[0]) < 36;
      const side = e.a[1] > -205 && e.b[1] > -205;
      face(f, 'concretePanel', e, gate ? -13.7 : side ? -9 : -24.5, roof);
      if (tier > 0 && e.w > 3)
        for (const y of [-19.6, -14.2, -9.4])
          if (!gate || y > -14) face(f, 'darkGlass', e, y, y + 1.33, 0, e.w, 0.055, 0.81);
      if (tier >= 2 && e.w > 4) {
        for (let u = 1; u < e.w; u += tier === 2 ? 2.7 : 1.32)
          face(
            f,
            'white',
            e,
            gate ? -13.58 : -19.4,
            roof - 0.63,
            u - 0.08,
            Math.min(e.w, u + 0.08),
            0.072,
            tint(Math.round(u)),
          );
      }
    }
  }
  const m = F.center,
    half = (F.x1 - F.x0) / 2,
    n = [4, 8, 14, 22, 26][tier];
  const height = (x) => -10.3 + 5.55 * (1 - Math.pow(Math.abs(x - m) / half, 2));
  const frontZ = (x) => F.z - 2.65 * (1 - Math.pow(Math.abs(x - m) / half, 2));
  const bottom = F.portalLintel;
  for (let i = 0; i < n; i++) {
    const a = lerp(F.x0, F.x1, i / n),
      b = lerp(F.x0, F.x1, (i + 1) / n);
    f(
      'clear',
      [
        [a, bottom, frontZ(a)],
        [b, bottom, frontZ(b)],
        [b, height(b), frontZ(b)],
        [a, height(a), frontZ(a)],
      ],
      north,
      tint(i),
    );
    f(
      'roofGlass',
      [
        [a, height(a), frontZ(a)],
        [b, height(b), frontZ(b)],
        [b, height(b) - 0.58, -280],
        [a, height(a) - 0.58, -280],
      ],
      up,
      0.88,
    );
    if (tier) {
      beam(
        out,
        'teal',
        [a, bottom, frontZ(a) - 0.08],
        [a, height(a), frontZ(a) - 0.08],
        0.135,
        0.22,
        colors.teal,
      );
      beam(
        out,
        'white',
        [a, height(a), frontZ(a) - 0.08],
        [b, height(b), frontZ(b) - 0.08],
        0.21,
        0.2,
        colors.white,
      );
      if (tier >= 2)
        beam(
          out,
          'teal',
          [a, -13.55, frontZ(a) - 0.12],
          [b, -13.55, frontZ(b) - 0.12],
          0.13,
          0.19,
          colors.teal,
        );
    }
  }
  for (const { x, z } of F.towers) {
    block(f, 'concretePanel', x, z, 8.6, 5.05, F.grade - 0.6, -1.52);
    block(f, 'white', x, z, 9.05, 5.25, -1.52, -1.18);
    if (tier) {
      block(f, 'darkGlass', x, z - 2.6, 0.78, 0.11, -18.6, -3.8);
      for (let i = 0; i < (tier === 1 ? 3 : 6); i++) {
        const y = -19.2 + i * (tier === 1 ? 5.1 : 2.57);
        block(f, 'white', x, z - 2.62, 7, 0.09, y, y + 0.12);
      }
    }
  }
  block(f, 'metal', m, -290.5, 67.2, 0.45, bottom - 0.42, bottom + 0.15);
  block(f, 'walk', m, -287.6, 67, 14, F.grade - 1.35, F.grade);
  for (const S of F.steps) {
    const count = tier === 0 ? 1 : tier === 1 ? 3 : 9,
      bottom = Math.min(S.lo, S.hi - 0.16);
    for (let i = 0; i < count; i++) {
      const len = S.d * (1 - i / count);
      block(
        f,
        'walk',
        S.x,
        S.z + (S.d - len) / 2,
        S.w,
        len,
        bottom - 0.26,
        lerp(bottom, S.hi, (i + 1) / count),
      );
    }
  }
  if (tier >= 1) {
    const glyphFace = (role, _ref, points, normal) => {
      if (normal[2] < -0.6)
        f(
          role,
          points.map(([x, y, z]) => [m - x, y, z]),
          [-normal[0], normal[1], normal[2]],
        );
    };
    const glyphWriter = { addConvexPolygon: glyphFace, addQuad: glyphFace };
    if (tier >= 2)
      lettering(glyphWriter, 'GARE MONTPARNASSE', {
        width: 56,
        height: 0.88,
        y: bottom + 0.41,
        z: -292.09,
        slot: 'white',
        stroke: 0.097,
      });
    for (const sign of [
      [-68, -283.8],
      [49, -283.2],
    ]) {
      block(f, 'red', sign[0], sign[1], 8.2, 0.38, -16.7, -13.9);
    }
  }
  // Stairs behind the glazed front. The lower entry remains open under the sign.
  for (const sign of [-1, 1]) {
    const a = [m + sign * 29, F.grade, -287.8],
      b = [m + sign * 7, -13.5, -275.8];
    const count = [2, 4, 12, 28, 32][tier];
    for (let i = 0; i < count; i++) {
      const t = (i + 0.5) / count,
        x = lerp(a[0], b[0], t),
        z = lerp(a[2], b[2], t),
        y = lerp(a[1], b[1], (i + 1) / count);
      block(f, 'lower', x, z, Math.abs(a[0] - b[0]) / count + 0.17, 3.08, y - 0.55, y);
    }
    if (tier)
      for (const z of [-1.48, 1.48])
        beam(
          out,
          'teal',
          [a[0], a[1] + 1.05, a[2] + z],
          [b[0], b[1] + 1.05, b[2] + z],
          0.13,
          0.15,
          colors.teal,
        );
  }
  block(f, 'walk', m, -270.3, 18.6, 10, -14, -13.5);
  block(f, 'lower', m, -228.1, 124, 71, -13.81, -13.5);
  block(f, 'walk', m, -202, 135, 16, -5.07, -4.59);
  for (let i = 0; i < 13; i++) {
    const x = -68 + i * 11.2,
      w = tier === 0 ? 1.9 : 2.62,
      z0 = -278.4,
      z1 = -247.8;
    f(
      'roofGlass',
      [
        [x - w / 2, roof + 0.08, z0],
        [x + w / 2, roof + 0.63, z0],
        [x + w / 2, roof + 0.63, z1],
        [x - w / 2, roof + 0.08, z1],
      ],
      up,
      0.92,
    );
    if (tier >= 1) {
      f(
        'zinc',
        [
          [x + w / 2, roof + 0.63, z0],
          [x + w / 2 + 0.83, roof + 0.1, z0],
          [x + w / 2 + 0.83, roof + 0.1, z1],
          [x + w / 2, roof + 0.63, z1],
        ],
        up,
      );
      if (tier >= 2)
        for (let z = z0 + 2; z < z1; z += 4.8)
          line(f, 'metal', [x - w / 2, roof + 0.11, z], [x + w / 2, roof + 0.66, z], 0.13);
    }
  }
}
function crossAt(knots, z) {
  const i = knots.findIndex((p) => p[1] >= z),
    b = knots[i < 0 ? knots.length - 1 : i],
    a = knots[Math.max(0, i < 0 ? knots.length - 2 : i - 1)];
  return b[1] === a[1] ? b[0] : lerp(a[0], b[0], (z - a[1]) / (b[1] - a[1]));
}
const railY = (z) =>
  crossAt(
    layout.railFloor.map(([z, y]) => [y, z]),
    z,
  );
function platform(f, i, I, tier) {
  const [a, b] = I.between
    ? I.between.map((j) => layout.tracks[j])
    : I.side < 0
      ? [layout.tracks[0].map(([x, z]) => [x - 6, z]), layout.tracks[0]]
      : [layout.tracks.at(-1), layout.tracks.at(-1).map(([x, z]) => [x + 6, z])];
  const zs = (tier < 2 ? [I.z0, -25, I.z1] : [I.z0, -140, -80, -25, 20, 62, I.z1]).filter(
    (z, j, v) => !j || z > v[j - 1],
  );
  const width = (z) => Math.max(1.28, (crossAt(b, z) - crossAt(a, z)) / 2 - 1.76);
  const center = (z) => (crossAt(b, z) + crossAt(a, z)) / 2;
  const P = (z, s, lo) => [center(z) + s * width(z), railY(z) + (lo ? 0 : 1.03), z];
  for (let j = 1; j < zs.length; j++) {
    const u = zs[j - 1],
      v = zs[j];
    f('walk', [P(u, -1), P(u, 1), P(v, 1), P(v, -1)], up, tint(i));
    for (const sign of [-1, 1]) {
      f('lower', [P(u, sign), P(v, sign), P(v, sign, true), P(u, sign, true)], [sign, 0, 0]);
      if (tier)
        line(
          f,
          'white',
          [center(u) + sign * (width(u) - 0.1), railY(u) + 1.037, u],
          [center(v) + sign * (width(v) - 0.1), railY(v) + 1.037, v],
          0.17,
          0.94,
        );
    }
  }
  for (let z = -158; z < 95; z += tier >= 3 ? 13.5 : tier === 2 ? 36 : 103.5)
    if (z > I.z0 && z < I.z1 - 2) {
      const x = center(z),
        y = railY(z) + 1.03;
      block(f, 'concretePanel', x, z, 0.83, 0.74, y, layout.garden.deck - 0.83);
      if (tier >= 3 && z < -36) {
        block(f, 'white', x, z, 0.86, 0.87, layout.garden.deck - 1.01, layout.garden.deck - 0.78);
        block(f, 'teal', x, z + 1.37, 1.52, 0.75, y, y + 0.46);
        block(f, 'zinc', x, z + 1.32, 1.22, 0.14, y + 0.39, y + 0.91);
      }
    }
}
function railway(f, tier) {
  const K = layout.parkAndRail;
  const low = layout.railFloor.map(([z, y]) => [z, y - 0.11]);
  for (let i = 1; i < low.length; i++) {
    const [a, lo] = low[i - 1],
      [b, hi] = low[i],
      widthA = a < 20 ? 83 : lerp(83, 67, (a - 20) / 107),
      widthB = b < 20 ? 83 : lerp(83, 67, (b - 20) / 107);
    f(
      'ballast',
      [
        [-widthA, lo, a],
        [widthA, lo, a],
        [widthB + 8, hi, b],
        [-widthB, hi, b],
      ],
      up,
      0.83,
    );
  }
  if (tier)
    for (const [i, I] of [
      ...layout.islands,
      { side: -1, z0: -191, z1: 74 },
      { side: 1, z0: -160, z1: 74 },
    ].entries())
      platform(f, i, I, tier);
  else
    for (const x of [-71, -42, -13, 24, 55, 69])
      block(f, 'concrete', x, -1, 0.9, 1, -3.9, layout.garden.deck - 0.83);
  for (const [i, track] of layout.tracks.entries()) {
    if (!tier) continue;
    const path =
      tier === 1 ? track.filter((_, j) => j === 0 || j === 3 || j === track.length - 1) : track;
    const g = 0.7175;
    for (let j = 1; j < path.length; j++) {
      const [x, z] = path[j - 1],
        [u, v] = path[j],
        a = railY(z),
        b = railY(v);
      for (const sign of [-1, 1]) {
        const X = x + sign * g,
          U = u + sign * g;
        line(f, 'rail', [X, a + 0.18, z], [U, b + 0.18, v], tier >= 2 ? 0.1 : 0.17, 1.09);
        if (tier >= 2)
          f(
            'post',
            [
              [X - 0.051, a + 0.18, z],
              [U - 0.051, b + 0.18, v],
              [U - 0.051, b + 0.06, v],
              [X - 0.051, a + 0.06, z],
            ],
            [-1, 0, 0],
          );
      }
    }
    if (tier >= 2) {
      for (
        let z = path[0][1] + 0.8;
        z < path.at(-1)[1];
        z += tier === 2 ? 15 : tier === 3 ? 3.0 : 2.35
      ) {
        const x = crossAt(path, z),
          y = railY(z) + 0.04;
        line(f, 'sleeper', [x - 1.25, y, z], [x + 1.25, y, z], 0.22, tint(i, Math.round(z)));
      }
      const [x, z] = path[0],
        y = railY(z);
      block(f, 'post', x, z, 1.83, 0.43, y - 0.02, y + 0.92);
      if (tier >= 3) block(f, 'red', x, z + 0.21, 1.47, 0.11, y + 0.63, y + 0.81);
    }
  }
  for (const [a, b] of [
    [K[0], K.at(-1)],
    [K.at(-1), K.at(-2)],
    [K[1], K[2]],
    [K[2], K[3]],
    [K[3], K[4]],
    [K[4], K[5]],
  ]) {
    const n = [b[1] - a[1], 0, a[0] - b[0]],
      mid = [(a[0] + b[0]) / 2, 0, (a[1] + b[1]) / 2];
    if (dot(n, mid) < 0) for (let i = 0; i < 3; i++) n[i] = -n[i];
    f(
      'concrete',
      [
        [a[0], railY(a[1]) - 0.22, a[1]],
        [b[0], railY(b[1]) - 0.22, b[1]],
        [b[0], layout.garden.deck - 0.4, b[1]],
        [a[0], layout.garden.deck - 0.4, a[1]],
      ],
      n,
    );
  }
  if (tier === 0) {
    block(f, 'slab', 0, 0, 171, 47.1, 3.38, layout.garden.deck);
    cap(f, 'lower', rect(0, 0, 171, 47.1), 3.38, [0, -1, 0]);
  } else
    for (const P of layout.outlines[layout.bridgeId]) {
      prism(f, 'slab', P, 3.38, layout.garden.deck);
      cap(f, 'lower', P, 3.38, [0, -1, 0]);
    }
}
function glazedBuilding(f, P, lo, hi, floors, tier, bias = 1) {
  const glassBottom = lo + 0.58;
  cap(f, 'zinc', P, hi);
  for (const e of edges(P)) {
    if (tier === 0) face(f, 'glass', e, lo, hi, 0, e.w, 0, bias);
    else {
      face(f, 'slab', e, lo, glassBottom, 0, e.w, 0, bias);
      face(f, 'glass', e, glassBottom, hi - 0.37, 0, e.w, 0, bias);
      face(f, 'metal', e, hi - 0.37, hi, 0, e.w, 0, bias);
    }
    if (tier >= 2) frame(f, e, glassBottom, hi - 0.37, floors, tier, 'curved');
  }
}
function overbuild(f, tier) {
  const { atrium, pavilions, garden } = layout;
  block(f, 'slab', -0.55, -186.5, 167.3, 26, garden.deck - 0.63, garden.deck);
  cap(f, 'lower', rect(-0.55, -186.5, 167.3, 26), garden.deck - 0.63, [0, -1, 0]);
  for (const p of atrium.rings) {
    const near = tier >= 2;
    const ring = near
      ? p
      : {
          outline: p.outline.filter((_, i) => i % (tier === 0 ? 4 : 2) === 0),
          holes: p.holes.map((h) => h.filter((_, i) => i % 2 === 0)),
        };
    glazedBuilding(f, ring, atrium.base, atrium.top, 6, tier);
    if (tier) {
      cap(f, 'slab', ring, atrium.base - 0.62, [0, -1, 0]);
      for (const edge of edges(ring))
        face(f, 'concretePanel', edge, atrium.base - 0.62, atrium.base);
    }
  }
  const trans = layout.outlines[pavilions[0]][0];
  if (tier < 2)
    glazedBuilding(
      f,
      { outline: trans.outline.filter((_, i) => i % (tier === 0 ? 8 : 4) === 0), holes: [] },
      garden.deck,
      11.1,
      1,
      tier,
    );
  else
    for (const id of pavilions.slice(1))
      for (const p of layout.outlines[id]) glazedBuilding(f, p, garden.deck, 11.1, 2, tier, 0.92);
  for (const id of layout.upperStation.filter((_, i) => tier >= 2 || i === 0))
    for (const p of layout.outlines[id])
      glazedBuilding(
        f,
        p,
        id === layout.upperStation[0] ? -9.15 : 3.9,
        id === layout.upperStation[0] ? 3.4 : 15.6,
        3,
        tier,
        0.84,
      );
}
function tree(f, out, x, z, y, h, i, tier) {
  const radius = (1.43 + (i % 5) * 0.25) * (h / 5.25);
  if (tier) block(f, 'soil', x, z, 0.28, 0.28, y, y + h * 0.43);
  if (tier < 2) {
    const top = [x, y + h, z],
      p = steps(5, (j) => {
        const a = (j * Math.PI * 2) / 5;
        return [x + radius * Math.cos(a), y + h * 0.41, z + radius * Math.sin(a)];
      });
    for (let j = 0; j < p.length; j++)
      f('foliage', [p[j], p[(j + 1) % p.length], top], [p[j][0] - x, 0.4, p[j][2] - z], tint(i, j));
  } else {
    sphere(
      out,
      'foliage',
      [x, y + h * 0.65, z],
      [radius, h * 0.35, radius * 0.95],
      scaled(colors.foliage, tint(i)),
      tier === 2 ? 5 : 8,
      3,
    );
    if (tier >= 3)
      sphere(
        out,
        i % 3 ? 'leafDark' : 'leafLight',
        [x + radius * 0.61, y + h * 0.69, z - radius * 0.24],
        [radius * 0.66, h * 0.26, radius * 0.7],
        colors[i % 3 ? 'leafDark' : 'leafLight'],
        6,
        3,
      );
  }
}
function garden(f, out, tier) {
  const G = layout.garden,
    [a, b, c, d] = G.bounds,
    m = (a + c) / 2,
    y = G.walk;
  block(f, 'slab', m, (b + d) / 2, c - a, d - b, G.deck - 1.2, G.deck);
  cap(f, 'lower', rect(m, (b + d) / 2, c - a, d - b), G.deck - 1.2, [0, -1, 0]);
  block(f, 'lawn', m, (b + d) / 2, c - a - 0.6, d - b - 0.68, G.deck, y - 0.12);
  for (const [x, z, w, h] of [
    [-2, -96, 6.4, 145],
    [-2, -131, 119, 3.7],
    [-2, -67, 119, 3.8],
    [60, -97, 3.8, 132],
    [-75, -97, 3.1, 132],
    [-2, -35, 146, 3.7],
    [-2, -161, 137, 3.5],
  ])
    cap(f, 'walk', rect(x, z, w, h), y);
  const n = tier >= 3 ? 9 : 2;
  for (const [i, P] of layout.courts.entries()) {
    cap(f, 'court', P, y + 0.016, up, tint(i));
    if (!tier) continue;
    const u = P.outline.map((p) => p[0]),
      v = P.outline.map((p) => p[1]),
      x0 = Math.min(...u) + 2.2,
      x1 = Math.max(...u) - 2.2,
      z0 = Math.min(...v) + 2.4,
      z1 = Math.max(...v) - 2.4;
    if (x1 - x0 < 7 || z1 - z0 < 7) continue;
    const x = (x0 + x1) / 2,
      z = (z0 + z1) / 2;
    const vertical = z1 - z0 > x1 - x0;
    const lines = [
      [x0, z0, x1, z0],
      [x1, z0, x1, z1],
      [x1, z1, x0, z1],
      [x0, z1, x0, z0],
      [x0, z, x1, z],
      [x, z0, x, z1],
    ];
    for (const [u, v, s, t] of lines) line(f, 'white', [u, y + 0.024, v], [s, y + 0.024, t], 0.096);
    if (tier >= 2) {
      const [s, t, u, v] = vertical ? [x0, z, x1, z] : [x, z0, x, z1];
      beam(out, 'post', [s, y + 0.82, t], [u, y + 0.82, v], 0.066, 0.067, colors.post);
      for (const [x, z] of [
        [s, t],
        [u, v],
      ])
        block(f, 'post', x, z, 0.105, 0.105, y, y + 0.89);
      for (const e of edges(P))
        if (e.w > 4) {
          face(f, 'teal', e, y + 2.17, y + 2.21);
          for (let j = 0; j < n; j++) {
            const [x, , z] = e.point((e.w * j) / n, y);
            block(f, 'teal', x, z, 0.065, 0.065, y, y + 2.21);
          }
        }
    }
  }
  const trees = [
    ...steps(12, (i) => [-14 - (i % 3) * 0.67, -157 + 10.0 * i, 5.2 + (i % 4) * 0.65]),
    ...steps(12, (i) => [15 + (i % 4) * 0.65, -159 + 10.2 * i, 5.9 + (i % 3) * 0.61]),
    ...steps(11, (i) => [72 - 2.8 * (i % 3), -156 + 10.5 * i, 5.2 + (i % 4) * 0.6]),
    ...steps(7, (i) => [-77 + 2 * (i % 3), -149 + 16.5 * i, 5.8 + (i % 2) * 0.58]),
    ...steps(7, (i) => [24 + i * 7.15, -36 - (i % 2) * 4.5, 4.8 + (i % 3) * 0.71]),
  ];
  for (const [i, [x, z, h]] of trees.entries()) {
    if ((tier === 0 && i % 5 !== 0) || (tier === 1 && i % 2) || (tier === 2 && i % 5 === 0))
      continue;
    tree(f, out, x, z, y, h, i, tier);
  }
  if (tier >= 1) {
    block(f, 'walk', -2, -99, 15.8, 15.3, y, y + 0.29);
    block(f, 'concretePanel', -2, -99, 3.6, 3.25, y + 0.29, y + 1.28);
    if (tier >= 2) {
      sphere(out, 'metal', [-2, y + 3.85, -99], [1.26, 1.26, 1.26], colors.metal, 10, 5);
      beam(out, 'metal', [-2, y + 1.15, -99], [-2, y + 3.22, -99], 0.28, 0.29, colors.metal);
      if (tier >= 3) torus(out, 'white', [-2, y + 3.86, -99], 1.8, 0.074, colors.white, 18, 5);
      for (const s of [-1, 1])
        for (let i = 0; i < 12; i++) {
          const z = -161 + i * 10.4,
            x = -2 + s * 4.62;
          const p = [x, y + 4.27, z],
            tip = [x + s * 1.31, y + 4.47, z - 0.31];
          beam(out, 'white', [x, y, z], p, 0.09, 0.09, colors.white);
          beam(out, 'white', p, tip, 0.1, 0.115, colors.white);
          if (tier >= 3)
            block(f, 'lightGlass', tip[0], tip[2], 0.49, 0.27, tip[1] - 0.17, tip[1] - 0.085);
        }
    }
  }
  if (tier >= 2)
    for (let i = 0; i < 18; i++) {
      const z = -161 + (i % 9) * 15.3,
        x = i < 9 ? 44 : 30;
      const p = rect(x, z, 7.5 + (i % 3) * 1.7, 5.7 + (i % 2) * 0.67);
      prism(f, 'soil', p, y - 0.08, y + 0.29, false);
      prism(f, i % 3 ? 'leafLight' : 'flower', rect(x, z, 6.85, 5.24), y + 0.29, y + 0.62, false);
    }
}
const tiers = { skyline: 0, district: 1, street: 2, closeup: 3, master: 4 };
export function buildMontparnasseLevel(out, level) {
  const tier = tiers[level],
    f = writer(out);
  for (const B of layout.officeRows) office(f, B, tier);
  terminal(f, out, tier);
  overbuild(f, tier);
  railway(f, tier);
  garden(f, out, tier);
}
export const buildMontparnasseSkyline = (out) => buildMontparnasseLevel(out, 'skyline');
export const buildMontparnasseDistrict = (out) => buildMontparnasseLevel(out, 'district');
export const buildMontparnasseStreet = (out) => buildMontparnasseLevel(out, 'street');
export const buildMontparnasseCloseup = (out) => buildMontparnasseLevel(out, 'closeup');
