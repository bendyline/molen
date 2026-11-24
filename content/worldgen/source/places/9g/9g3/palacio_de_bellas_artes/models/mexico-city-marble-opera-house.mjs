import {
  beam,
  sphere,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  facade,
  fbox,
  lathe,
  outwardRing,
  quad4,
  rgb,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import { cap } from '../../../../r1/r1f/adelaide_railway_station/models/classical.mjs';
import site from '../site-controls.json' with { type: 'json' };

export const surfaces = {
  marble: { slot: 'wall', graph: 'stone_marble', roughness: 0.91 },
  ashlar: { slot: 'wall', graph: 'stone_limestone', roughness: 0.96 },
  bronze: { slot: 'trim', graph: 'metal_bronze_cast', roughness: 0.88 },
  copper: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.92 },
  roof: { slot: 'roof', graph: 'concrete_plain', roughness: 0.97 },
  base: { slot: 'foundation', graph: 'stone_granite', roughness: 0.97 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.63 },
};

const ivory = rgb('e2dacc'),
  pale = rgb('d5cfc0'),
  warm = rgb('c5b9a4'),
  dark = rgb('a59a86');
const roof = rgb('b9b5ae'),
  glass = rgb('555d5c'),
  stone = rgb('aaa498'),
  bronze = rgb('747167');
const copper = ['b87947', 'bc8350', 'c79962', 'c8a472', 'a97044'].map(rgb);
const F = facade(site.frame.origin, site.frame.along);
const edges = (outline) => outline.map((a, i) => wallFace(a, outline[(i + 1) % outline.length]));
const lowerBody = site.outline.filter(
  ([x, z]) => !site.portico.slice(1, -1).some(([a, b]) => Math.hypot(x - a, z - b) < 0.001),
);
function panel(out, slot, f, u, v, y, Y, d, color) {
  quad4(out, slot, f.P(u, y, d), f.P(v, y, d), f.P(v, Y, d), f.P(u, Y, d), color);
}

function wallRows(out, ring, low, high, detail, windows = false) {
  for (const f of edges(outwardRing(ring))) {
    const w = f.length;
    panel(out, 'ashlar', f, 0, w, low, high, 0, pale);
    if (!windows || detail === 0 || w < 2.1) continue;
    const n = Math.ceil(w / [1, 6.55, 4.35, 3.47][detail]);
    for (const fraction of [0.35, 0.73]) {
      const y = low + (high - low) * fraction,
        Y = y + (high - low) * 0.157;
      for (let j = 0; j < n; j++) {
        const u = (w * (j + 0.5)) / n,
          frame = Math.min(1.47, (w / n) * 0.31);
        panel(out, 'glass', f, u - frame, u + frame, y, Y, 0.013, glass);
        if (detail > 1) {
          panel(out, 'marble', f, u - frame - 0.11, u - frame, y, Y, 0.061, warm);
          panel(out, 'marble', f, u + frame, u + frame + 0.11, y, Y, 0.061, ivory);
          panel(out, 'marble', f, u - frame - 0.13, u + frame + 0.13, y - 0.14, y, 0.14, ivory);
        }
      }
    }
    if (w > 1 && detail > 0) panel(out, 'marble', f, 0, w, high - 0.41, high - 0.1, 0.09, ivory);
  }
}
function block(out, ring, y, Y, detail, windows = false) {
  wallRows(out, ring, y, Y, detail, windows);
  cap(out, 'roof', ring, Y, roof);
}
function arch(out, f, center, width, y, ry, thickness, depth, detail) {
  const n = [5, 8, 13, 18][detail];
  for (let j = 0; j < n; j++) {
    const a = Math.PI * (1 - j / n),
      b = Math.PI * (1 - (j + 1) / n);
    const p = (t, r) => f.P(center + (width + r) * Math.cos(t), y + (ry + r) * Math.sin(t), depth);
    quad4(out, 'marble', p(a, 0), p(b, 0), p(b, thickness), p(a, thickness), ivory);
    if (detail > 1) {
      const c = f.P(
        center + (width + thickness * 0.61) * Math.cos(a),
        y + (ry + thickness * 0.61) * Math.sin(a),
        depth + 0.075,
      );
      const d = f.P(
        center + (width + thickness * 0.61) * Math.cos(b),
        y + (ry + thickness * 0.61) * Math.sin(b),
        depth + 0.075,
      );
      beam(out, 'marble', c, d, 0.108, 0.093, warm);
    }
  }
}
function column(out, f, u, d, y, Y, r, detail) {
  const [x, , z] = f.P(u, 0, d),
    n = [5, 7, 10, 14][detail];
  const profile =
    detail === 0
      ? [
          [y, r, r],
          [Y, r * 0.84, r * 0.84],
        ]
      : [
          [y, r * 1.24, r * 1.24],
          [y + 0.22, r * 1.24, r * 1.24],
          [y + 0.43, r, r],
          [Y - 0.38, r * 0.87, r * 0.87],
          [Y - 0.2, r * 1.17, r * 1.17],
          [Y, r * 1.19, r * 1.19],
        ];
  lathe(out, 'marble', [x, z], profile, n, pale);
}
function front(out, detail) {
  const ring = outwardRing(site.portico);
  const [x, z] = site.frame.origin;
  const inward = ring.reduce(
    (min, p) => Math.min(min, (p[0] - x) * F.normal[0] + (p[1] - z) * F.normal[1]),
    0,
  );
  const canopyY = 10.62;
  cap(out, 'marble', ring, canopyY, ivory);
  cap(out, 'base', ring, 1.14, stone);
  for (const f of edges(ring)) {
    panel(out, 'marble', f, 0, f.length, canopyY - 0.69, canopyY, 0, warm);
    panel(out, 'base', f, 0, f.length, -1.58, 1.14, 0, warm);
  }
  for (const u of [-4.52, 0, 4.52])
    panel(out, 'glass', F, u - 1.43, u + 1.43, 1.16, 6.07, inward + 0.024, glass);
  for (const u of [-6.64, -4.52, -2.31, 2.31, 4.52, 6.64]) {
    const d = 2.02 - 0.061 * u * u;
    column(out, F, u, d, 1.14, canopyY - 0.68, 0.41, detail);
  }
  for (const u of [-21.5, 21.5]) {
    arch(out, F, u, 3.33, 6.22, 3.6, 0.61, -2.56, detail);
    if (detail > 0) bandPedestal(out, u, detail);
  }
  const y = 22.31;
  arch(out, F, 0, 8.85, y, 7.14, 0.86, inward + 0.49, detail);
  for (const u of [-9.44, 9.44]) {
    fbox(out, 'marble', F, u - 0.49, u + 0.49, 10.52, y, inward - 1.42, inward + 0.69, pale);
    column(out, F, u, inward + 0.42, 11.14, y, 0.55, detail);
  }
  for (const u of [-5.7, -3.4, -1.14, 1.14, 3.4, 5.7]) {
    panel(out, 'glass', F, u - 0.8, u + 0.8, 11.34, 19.87, inward + 0.321, glass);
    if (detail > 0)
      panel(out, 'marble', F, u - 0.068, u + 0.068, 11.31, 19.86, inward + 0.335, ivory);
  }
  if (detail > 1) {
    for (const u of [-6.95, 6.95]) {
      const p = F.P(u, 27.3, inward + 0.42);
      sphere(out, 'marble', p, [0.64, 0.92, 0.57], ivory, 9, 5);
    }
  }
  const steps = [4, 6, 8, 10][detail];
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    fbox(out, 'base', F, -25.8, 25.8, -0.74, -0.095 + t * 1.24, 2.05, 8.29 - t * 5.09, stone);
  }
}
function bandPedestal(out, u, detail) {
  for (const off of [-4.45, -2.5, 2.5, 4.45]) {
    column(out, F, u + off, -2.51, 13.21, 24.08, 0.41, detail);
  }
  panel(out, 'glass', F, u - 1.88, u + 1.88, 14.15, 22.14, -2.57, glass);
}
function dome(out, shape, detail) {
  const [x, z] = shape.center,
    [ax, az] = F.along,
    [nx, nz] = F.normal;
  const n = detail === 0 ? 12 : detail === 1 ? 16 : shape.segments;
  const rings = [3, 5, 7, 10][detail],
    point = (theta, t, extra = 0) => {
      const a = Math.PI * 0.5 * t,
        r = Math.max(0.017, Math.cos(a));
      const u = (shape.radius[0] * r + extra) * Math.cos(theta),
        d = (shape.radius[1] * r + extra) * Math.sin(theta);
      return [
        x + u * ax + d * nx,
        shape.base + (shape.top - shape.base) * Math.sin(a),
        z + u * az + d * nz,
      ];
    };
  for (let i = 0; i < n; i++) {
    const a = (2 * Math.PI * i) / n,
      b = (2 * Math.PI * (i + 1)) / n;
    for (let j = 0; j < rings; j++) {
      const t = j / rings,
        T = (j + 1) / rings;
      quad4(
        out,
        'copper',
        point(a, t),
        point(a, T),
        point(b, T),
        point(b, t),
        copper[(i + (j % 2)) % copper.length],
      );
      if (detail > 1 && i % (detail === 2 ? 2 : 1) === 0)
        beam(out, 'bronze', point(a, t, 0.026), point(a, T, 0.026), 0.108, 0.121, bronze);
    }
  }
  const top = point(0, 1),
    r = shape.radius[0] * 0.021;
  lathe(
    out,
    'bronze',
    [x, z],
    [
      [top[1] - 0.035, r, r],
      [top[1] + 0.12, r * 0.81, r * 0.81],
    ],
    Math.min(n, 12),
    bronze,
  );
}
function sculpture(out, detail) {
  const [x, z] = site.domes[0].center;
  lathe(
    out,
    'bronze',
    [x, z],
    [
      [46.99, 1.35, 1.35],
      [47.52, 1.48, 1.48],
      [47.79, 1.16, 1.16],
      [48.81, 1.28, 1.28],
      [49.34, 0.51, 0.51],
      [50.42, 0.41, 0.41],
      [51.77, 0.27, 0.27],
    ],
    detail === 0 ? 6 : 10,
    bronze,
  );
  const P = (u, y, d) => [
    x + u * F.along[0] + d * F.normal[0],
    y,
    z + u * F.along[1] + d * F.normal[1],
  ];
  for (const side of [-1, 1]) {
    const a = P(0, 51.16, 0),
      b = P(side * 1.21, 53, 0.02),
      c = P(side * 0.86, 51.67, 0.153);
    tri(out, 'bronze', a, b, c, bronze);
    tri(out, 'bronze', a, c, b, bronze);
  }
  if (detail > 1) {
    for (let i = 0; i < 5; i++) {
      const a = (2 * Math.PI * i) / 5,
        p = [x + 1.03 * Math.cos(a), 48.83, z + 1.03 * Math.sin(a)];
      sphere(out, 'bronze', p, [0.23, 0.82, 0.25], bronze, 8, 4);
    }
  }
}
function build(out, detail) {
  if (detail === 0) block(out, lowerBody, -2.4, site.eaves, detail);
  else {
    block(out, lowerBody, -2.4, 10.62, detail, true);
    block(out, site.outline, 10.62, site.baseHeight, detail);
    block(out, site.upper, site.baseHeight, site.eaves, detail, true);
  }
  block(out, site.crossing, site.eaves, 29.13, detail);
  block(out, site.tie, site.eaves, 32.93, detail);
  block(out, site.stage, site.eaves, 36.93, detail, true);
  block(out, site.annex, site.eaves, 29.95, detail);
  block(out, site.drum, 28.99, 36.93, detail, true);
  front(out, detail);
  for (const shape of site.domes) dome(out, shape, detail);
  sculpture(out, detail);
}
export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = buildCloseup;
