/** Shared helpers for individually authored geographic structures. Photographic estimates, not surveys. */
import './install-deterministic-math.mjs';
import { beam, normalFor } from './authored-structure-mesh.mjs';
import { box, quad } from './structure-mesh.mjs';
export const landmarkSurfaces = {
  brick: { slot: 'wall', graph: 'brick', roughness: 0.9, metallic: 0 },
  stone: { slot: 'trim', graph: 'stone_sandstone', roughness: 0.88, metallic: 0 },
  concrete: { slot: 'wall', graph: 'concrete_plain', roughness: 0.82, metallic: 0 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.6, metallic: 0.35 },
  roof: { slot: 'roof', graph: 'slate', roughness: 0.9, metallic: 0 },
  glass: { slot: 'window', roughness: 0.3, metallic: 0.12 },
};
export const rgb = (hex) =>
  hex.match(/../g).map((v) => {
    const c = parseInt(v, 16) / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
export const c = {
  cream: rgb('ded9c9'),
  white: rgb('eae8df'),
  brick: rgb('88574b'),
  redbrick: rgb('9f5f4d'),
  sand: rgb('cfc1a2'),
  dark: rgb('333938'),
  glass: rgb('5c7078'),
  curtain: rgb('c6c2b5'),
  mint: rgb('5faaa0'),
  roof: rgb('636763'),
  tile: rgb('a35e46'),
  bronze: rgb('516c60'),
  yellow: rgb('e8c526'),
  red: rgb('a83843'),
};
export const B = (o, s, x, y, z, w, h, d, col) =>
  box(o, s, [x - w / 2, y, z - d / 2], [x + w / 2, y + h, z + d / 2], c[col] ?? col);
export function cleanRing(ring) {
  const r = ring.map((p) => p.slice());
  let changed = true;
  while (changed && r.length > 3) {
    changed = false;
    for (let i = 0; i < r.length; i++) {
      const a = r[(i + r.length - 1) % r.length],
        b = r[i],
        c = r[(i + 1) % r.length],
        dx = c[0] - a[0],
        dz = c[1] - a[1],
        len = Math.hypot(dx, dz),
        dist = len ? Math.abs((b[0] - a[0]) * dz - (b[1] - a[1]) * dx) / len : 0;
      if (Math.hypot(a[0] - b[0], a[1] - b[1]) < 0.08 || dist < 0.03) {
        r.splice(i, 1);
        changed = true;
        break;
      }
    }
  }
  return r;
}
export function poly(o, s, ring, y0, y1, color) {
  const r = cleanRing(ring);
  if (
    r.reduce(
      (a, p, i) => a + p[0] * r[(i + 1) % r.length][1] - r[(i + 1) % r.length][0] * p[1],
      0,
    ) < 0
  )
    r.reverse();
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      dx = b[0] - a[0],
      dz = b[1] - a[1];
    if (Math.hypot(dx, dz) < 1e-5) continue;
    quad(
      o,
      s,
      [
        [a[0], y0, a[1]],
        [b[0], y0, b[1]],
        [b[0], y1, b[1]],
        [a[0], y1, a[1]],
      ],
      [dz, 0, -dx],
      c[color] ?? color,
    );
  }
  for (const [y, n] of [
    [y0, [0, -1, 0]],
    [y1, [0, 1, 0]],
  ])
    if (
      !o.addCap(
        s,
        'palette:#ffffff',
        r,
        [],
        () => y,
        n,
        (p) => p,
        c[color] ?? color,
      )
    )
      throw Error('Footprint triangulation failed');
}
export function window(
  o,
  x,
  y,
  z,
  w,
  h,
  trim = 'cream',
  glass = 'glass',
  mullion = true,
  facing = 1,
) {
  B(o, 'stone', x, y - 0.1, z, w + 0.22, h + 0.2, 0.14, trim);
  B(o, 'glass', x, y, z + facing * 0.085, w, h, 0.04, glass);
  if (mullion) {
    B(o, 'metal', x, y, z + facing * 0.12, 0.065, h, 0.05, 'dark');
    B(o, 'metal', x, y + h * 0.5, z + facing * 0.12, w, 0.065, 0.05, 'dark');
  }
}
export function arched(o, x, y, z, w, h, col = 'glass', surround = 'cream', arcRatio = 1) {
  const radius = w / 2,
    shoulder = y + h - radius * arcRatio;
  const pts = [
    [x - radius, y, z],
    [x + radius, y, z],
    [x + radius, shoulder, z],
  ];
  for (let i = 1; i <= 12; i++) {
    const a = (i / 12) * Math.PI;
    pts.push([x + Math.cos(a) * radius, shoulder + Math.sin(a) * radius * arcRatio, z]);
  }
  o.addConvexPolygon('glass', 'palette:#ffffff', pts, [0, 0, 1], (p) => [p[0], p[1]], c[col]);
  for (const sign of [-1, 1])
    B(o, 'stone', x + sign * (radius + 0.085), y, z, 0.17, h - radius * arcRatio, 0.18, surround);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI,
      b = ((i + 1) / 12) * Math.PI;
    beam(
      o,
      'stone',
      [x + Math.cos(a) * (radius + 0.08), shoulder + Math.sin(a) * (radius * arcRatio + 0.08), z],
      [x + Math.cos(b) * (radius + 0.08), shoulder + Math.sin(b) * (radius * arcRatio + 0.08), z],
      0.18,
      0.2,
      c[surround],
    );
  }
  B(o, 'stone', x, y - 0.12, z, w + 0.5, 0.18, 0.3, surround);
}
export function roof(o, x, z, w, d, y, rise, color = 'roof') {
  for (const sign of [-1, 1]) {
    const p = [
      [x + (sign * w) / 2, y, z - d / 2],
      [x + (sign * w) / 2, y, z + d / 2],
      [x, y + rise, z + d / 2],
      [x, y + rise, z - d / 2],
    ];
    if (sign > 0) p.reverse();
    quad(o, 'roof', p, normalFor(...p), c[color]);
  }
  for (const sign of [-1, 1])
    o.addConvexPolygon(
      'brick',
      'palette:#ffffff',
      [
        [x - w / 2, y, z + (sign * d) / 2],
        [x + w / 2, y, z + (sign * d) / 2],
        [x, y + rise, z + (sign * d) / 2],
      ],
      [0, 0, sign],
      (p) => [p[0], p[1]],
      c.brick,
    );
}
const glyphs = {
  M: [
    [0, 0, 0, 1],
    [0, 1, 0.5, 0.4],
    [0.5, 0.4, 1, 1],
    [1, 1, 1, 0],
  ],
  O: [
    [0, 0, 0, 1],
    [0, 1, 1, 1],
    [1, 1, 1, 0],
    [1, 0, 0, 0],
  ],
  T: [
    [0, 1, 1, 1],
    [0.5, 1, 0.5, 0],
  ],
  E: [
    [0, 0, 0, 1],
    [0, 1, 1, 1],
    [0, 0.5, 0.8, 0.5],
    [0, 0, 1, 0],
  ],
  L: [
    [0, 1, 0, 0],
    [0, 0, 1, 0],
  ],
  R: [
    [0, 0, 0, 1],
    [0, 1, 1, 1],
    [1, 1, 1, 0.55],
    [1, 0.55, 0, 0.55],
    [0.4, 0.55, 1, 0],
  ],
  A: [
    [0, 0, 0.5, 1],
    [0.5, 1, 1, 0],
    [0.2, 0.4, 0.8, 0.4],
  ],
  I: [[0.5, 0, 0.5, 1]],
  N: [
    [0, 0, 0, 1],
    [0, 1, 1, 0],
    [1, 0, 1, 1],
  ],
};
export function lettering(o, word, x, y, z, w, h, color) {
  const cw = w / word.length;
  for (let i = 0; i < word.length; i++)
    for (const [a, b, d, e] of glyphs[word[i]] ?? [])
      beam(
        o,
        'metal',
        [x + i * cw + a * cw * 0.7, y + b * h, z],
        [x + i * cw + d * cw * 0.7, y + e * h, z],
        0.055,
        0.045,
        c[color],
      );
}
