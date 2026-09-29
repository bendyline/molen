/** Exterior construction details for individually researched tower models. All lengths are metres. */
import { beam, loft, normalFor, radialRing, sphere } from './authored-structure-mesh.mjs';
import { box, quad } from './structure-mesh.mjs';

export const stone = [0.8, 0.76, 0.65];
export const white = [0.88, 0.87, 0.8];
export const dark = [0.075, 0.085, 0.085];
export const tau = Math.PI * 2;
const ref = 'palette:#ffffff';
export const face = (out, slot, points, color) =>
  quad(out, slot, points, normalFor(...points), color);
export function deform(out, point) {
  return {
    addQuad(slot, _ref, p, _n, _uv, color) {
      face(out, slot, p.map(point), color);
    },
    addTriangle(slot, _ref, p, _n, _uv, color) {
      triangle(out, slot, p.map(point), color);
    },
    addConvexPolygon(slot, _ref, p, _n, _uv, color) {
      const points = p.map(point);
      out.addConvexPolygon(slot, ref, points, normalFor(...points), (p) => [p[0], p[2]], color);
    },
  };
}
export function triangle(out, slot, p, color) {
  out.addTriangle(
    slot,
    ref,
    p,
    normalFor(...p),
    [
      [0, 0],
      [1, 0],
      [0, 1],
    ],
    color,
  );
}
export function transform(out, angle = 0, offset = [0, 0, 0], lean = [0, 0]) {
  const c = Math.cos(angle),
    s = Math.sin(angle);
  const point = ([x, y, z]) => [
    x * c + z * s + offset[0] + y * lean[0],
    y + offset[1],
    -x * s + z * c + offset[2] + y * lean[1],
  ];
  return {
    addQuad(slot, _ref, p, _n, _uv, color) {
      face(out, slot, p.map(point), color);
    },
    addTriangle(slot, _ref, p, _n, _uv, color) {
      triangle(out, slot, p.map(point), color);
    },
    addConvexPolygon(slot, _ref, p, _n, _uv, color) {
      const points = p.map(point);
      out.addConvexPolygon(slot, ref, points, normalFor(...points), (p) => [p[0], p[2]], color);
    },
  };
}
export function column(out, slot, x, z, y0, y1, radius, color = stone, sides = 16) {
  const radii = [
    [y0, radius * 1.4],
    [y0 + 0.13, radius * 1.4],
    [y0 + 0.2, radius],
    [y1 - 0.27, radius * 0.85],
    [y1 - 0.2, radius * 1.3],
    [y1, radius * 1.3],
  ];
  loft(
    out,
    slot,
    radii.map(([y, r]) => radialRing(y, r, r, sides, [x, z])),
    color,
  );
}
export function cornice(out, slot, width, depth, y, rise = 0.55, color = stone) {
  box(out, slot, [-width / 2, y, -depth / 2], [width / 2, y + rise * 0.35, depth / 2], color);
  box(
    out,
    slot,
    [-width / 2 - 0.13, y + rise * 0.35, -depth / 2 - 0.13],
    [width / 2 + 0.13, y + rise * 0.73, depth / 2 + 0.13],
    color,
  );
  box(
    out,
    slot,
    [-width / 2 - 0.27, y + rise * 0.73, -depth / 2 - 0.27],
    [width / 2 + 0.27, y + rise, depth / 2 + 0.27],
    color,
  );
}
export function balcony(out, radius, y, sides = 64, slot = 'limestone', color = stone) {
  loft(
    out,
    slot,
    [radialRing(y, radius, radius, sides), radialRing(y + 0.3, radius, radius, sides)],
    color,
  );
  const posts = Math.max(24, Math.round(radius * 10));
  for (let i = 0; i < posts; i++) {
    const a = (i / posts) * tau;
    column(
      out,
      slot,
      Math.cos(a) * (radius - 0.14),
      Math.sin(a) * (radius - 0.14),
      y + 0.3,
      y + 1.15,
      0.045,
      color,
      8,
    );
  }
  annulus(out, slot, radius - 0.28, radius + 0.04, y + 1.12, y + 1.26, color, sides);
}
export function annulus(out, slot, inside, outside, y0, y1, color, sides = 64) {
  const p = (r, y, a) => [Math.cos(a) * r, y, Math.sin(a) * r];
  for (let i = 0; i < sides; i++) {
    const a = (-i / sides) * tau,
      b = (-(i + 1) / sides) * tau;
    face(
      out,
      slot,
      [p(outside, y0, a), p(outside, y0, b), p(outside, y1, b), p(outside, y1, a)],
      color,
    );
    face(
      out,
      slot,
      [p(inside, y0, b), p(inside, y0, a), p(inside, y1, a), p(inside, y1, b)],
      color,
    );
    face(
      out,
      slot,
      [p(inside, y1, a), p(outside, y1, a), p(outside, y1, b), p(inside, y1, b)],
      color,
    );
    face(
      out,
      slot,
      [p(inside, y0, b), p(outside, y0, b), p(outside, y0, a), p(inside, y0, a)],
      color,
    );
  }
}
const archY = (x, radius, rise, pointed) =>
  rise *
  (pointed
    ? Math.sqrt(Math.max(0, 4 - (Math.abs(x) / radius + 1) ** 2)) / Math.sqrt(3)
    : Math.sqrt(Math.max(0, 1 - (x / radius) ** 2)));
/** A true arch opening cut out of a rectangular wall, with jamb/soffit reveals. */
export function archBay(
  out,
  slot,
  x,
  width,
  y0,
  spring,
  rise,
  top,
  z,
  thickness,
  color = stone,
  { pointed = false, back = true, trim = 0.12 } = {},
) {
  const r = width / 2,
    n = 32;
  if (back)
    box(
      out,
      'shadow',
      [x - r, y0, z - thickness - 0.1],
      [x + r, spring + rise, z - thickness],
      dark,
    );
  for (let i = 0; i < n; i++) {
    const a = -r + (width * i) / n,
      b = -r + (width * (i + 1)) / n;
    const ya = spring + archY(a, r, rise, pointed),
      yb = spring + archY(b, r, rise, pointed);
    if (top > Math.max(ya, yb))
      face(
        out,
        slot,
        [
          [x + a, ya, z],
          [x + b, yb, z],
          [x + b, top, z],
          [x + a, top, z],
        ],
        color,
      );
    face(
      out,
      slot,
      [
        [x + a, ya, z - thickness],
        [x + b, yb, z - thickness],
        [x + b, yb, z],
        [x + a, ya, z],
      ],
      color,
    );
    if (trim) beam(out, slot, [x + a, ya, z + 0.025], [x + b, yb, z + 0.025], trim, trim, color);
  }
  if (spring > y0) {
    face(
      out,
      slot,
      [
        [x - r, y0, z],
        [x - r, y0, z - thickness],
        [x - r, spring, z - thickness],
        [x - r, spring, z],
      ],
      color,
    );
    face(
      out,
      slot,
      [
        [x + r, y0, z - thickness],
        [x + r, y0, z],
        [x + r, spring, z],
        [x + r, spring, z - thickness],
      ],
      color,
    );
    if (trim)
      for (const sign of [-1, 1])
        box(
          out,
          slot,
          [x + sign * r - trim / 2, y0, z],
          [x + sign * r + trim / 2, spring, z + trim],
          color,
        );
  }
}
export function facade(out, slot, width, y0, y1, z, windows, color = stone) {
  const xs = [
    ...new Set([-width / 2, width / 2, ...windows.flatMap((w) => [w.x - w.w / 2, w.x + w.w / 2])]),
  ].sort((a, b) => a - b);
  const ys = [...new Set([y0, y1, ...windows.flatMap((w) => [w.y, w.top])])].sort((a, b) => a - b);
  for (let j = 0; j < ys.length - 1; j++)
    for (let i = 0; i < xs.length - 1; i++) {
      const x = (xs[i] + xs[i + 1]) / 2,
        y = (ys[j] + ys[j + 1]) / 2;
      if (windows.some((w) => x > w.x - w.w / 2 && x < w.x + w.w / 2 && y > w.y && y < w.top))
        continue;
      face(
        out,
        slot,
        [
          [xs[i], ys[j], z],
          [xs[i + 1], ys[j], z],
          [xs[i + 1], ys[j + 1], z],
          [xs[i], ys[j + 1], z],
        ],
        color,
      );
    }
  for (const w of windows)
    archBay(out, slot, w.x, w.w, w.y, w.spring, w.rise, w.top, z, w.depth ?? 0.45, color, w);
}
export function frame(out, slot, x, y, w, h, z, border, color) {
  box(out, slot, [x - w / 2 - border, y - border, z], [x + w / 2 + border, y, z + 0.05], color);
  box(
    out,
    slot,
    [x - w / 2 - border, y + h, z],
    [x + w / 2 + border, y + h + border, z + 0.05],
    color,
  );
  for (const s of [-1, 1])
    box(
      out,
      slot,
      [x + (s * w) / 2 - border / 2, y, z],
      [x + (s * w) / 2 + border / 2, y + h, z + 0.05],
      color,
    );
}
export function finial(out, x, y, z, height, color = stone) {
  loft(
    out,
    'limestone',
    [
      [y, 0.18],
      [y + height * 0.35, 0.22],
      [y + height * 0.92, 0.055],
    ].map(([yy, r]) => radialRing(yy, r, r, 8, [x, z])),
    color,
  );
  sphere(out, 'limestone', [x, y + height * 0.95, z], [0.08, height * 0.05, 0.08], color, 8, 4);
}
export function pediment(out, width, y, z, rise, color = stone) {
  triangle(
    out,
    'limestone',
    [
      [-width / 2, y, z],
      [width / 2, y, z],
      [0, y + rise, z],
    ],
    color,
  );
  for (const s of [-1, 1])
    beam(
      out,
      'limestone',
      [(s * width) / 2, y, z + 0.08],
      [0, y + rise, z + 0.08],
      0.3,
      0.35,
      color,
    );
  box(out, 'limestone', [-width / 2, y - 0.25, z - 0.1], [width / 2, y + 0.05, z + 0.3], color);
}
