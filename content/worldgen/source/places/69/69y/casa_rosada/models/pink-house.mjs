import {
  beam,
  loft,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { deform } from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import {
  facade,
  fan,
  fbox,
  opening,
  outwardRing,
  quad4,
  rgb,
  roundArch,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import { cap } from '../../../../r1/r1f/adelaide_railway_station/models/classical.mjs';
import site from '../site-controls.json' with { type: 'json' };

export const surfaces = {
  plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.94 },
  base: { slot: 'foundation', graph: 'stone_ashlar', roughness: 0.96 },
  roof: { slot: 'roof', graph: 'metal_copper', roughness: 0.84 },
  trim: { slot: 'trim', graph: 'stone_sandstone', roughness: 0.89 },
  iron: { slot: 'trim', graph: 'metal_painted', roughness: 0.83 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.49 },
};
const rose = rgb('c99182'),
  blush = rgb('ddac9c'),
  shaded = rgb('a66e61');
const gray = rgb('a58a7f'),
  dark = rgb('6d5048'),
  glass = rgb('54636c');
const copper = rgb('8c9c90'),
  ridge = rgb('717e75'),
  iron = rgb('684b41');
const f = facade([0, 0], [1, 0]),
  front = facade(site.origin, site.along);
const length = site.length,
  wall = site.wallHeight,
  plaza = site.plazaDatum;
const balcony = 7.05,
  entablature = 16.47;
const central = { center: 55.15, left: 42.4, right: 67.9 };
const domePositions = [26.1, 85.7];

function face(out, slot, F, u0, u1, y0, y1, d, color) {
  const p = F.P;
  quad4(out, slot, p(u0, y0, d), p(u1, y0, d), p(u1, y1, d), p(u0, y1, d), color);
}
const box = (out, slot, a, b, y0, y1, d0, d1, color) =>
  fbox(out, slot, f, a, b, y0, y1, d0, d1, color);

function window(out, detail, F, u, y, w, h, { d = 0, arch = false } = {}) {
  if (detail < 3 && !arch) {
    if (detail > 0)
      face(
        out,
        'trim',
        F,
        u - w / 2 - 0.16,
        u + w / 2 + 0.16,
        y - 0.12,
        y + h + 0.14,
        d + 0.03,
        blush,
      );
    face(out, 'glass', F, u - w / 2, u + w / 2, y, y + h, d + 0.061, glass);
    return;
  }
  const fp = facade(
    F.P(0, 0, d).filter((_, i) => i !== 1),
    F.along,
  );
  opening(out, fp, u, y, w, h, {
    head: arch ? 'round' : 'flat',
    glassSlot: 'glass',
    frameSlot: 'trim',
    glass,
    frame: blush,
    frameWidth: detail < 2 ? 0 : 0.14,
    frameDepth: 0.135,
    d: 0.034,
    sill: detail > 1,
    mullions: detail > 1 ? 1 : 0,
    transoms: detail > 1 ? 2 : 0,
    mullionColor: dark,
  });
}

function archBand(out, detail, a, b, bottom, spring, top, d, thickness) {
  const r = (b - a) / 2 - 0.24,
    u = (a + b) / 2;
  const profile = roundArch(r, [4, 6, 9, 13][detail]).map(([x, y]) => [x + u, y + spring]);
  if (detail === 0) {
    face(out, 'plaster', f, a, a + 0.24, bottom, top, d, rose);
    face(out, 'plaster', f, b - 0.24, b, bottom, top, d, rose);
  } else {
    box(out, 'plaster', a, a + 0.24, bottom, top, d - thickness, d, rose);
    box(out, 'plaster', b - 0.24, b, bottom, top, d - thickness, d, rose);
  }
  const p = (x, y, z) => f.P(x, y, z);
  for (let i = 1; i < profile.length; i++) {
    const [a, y] = profile[i - 1],
      [b, h] = profile[i];
    quad4(out, 'plaster', p(a, y, d), p(b, h, d), p(b, top, d), p(a, top, d), rose);
    if (detail > 0)
      quad4(
        out,
        'plaster',
        p(a, y, d - thickness),
        p(b, h, d - thickness),
        p(b, h, d),
        p(a, y, d),
        shaded,
      );
    if (detail > 1) {
      const xx = a - u,
        zz = b - u;
      const scale = (r + 0.18) / r;
      quad4(
        out,
        'trim',
        p(a, y, d + 0.018),
        p(b, h, d + 0.018),
        p(u + zz * scale, spring + (h - spring) * scale, d + 0.018),
        p(u + xx * scale, spring + (y - spring) * scale, d + 0.018),
        blush,
      );
    }
  }
}

function pier(out, u, y, h, w, d, detail) {
  box(out, 'plaster', u - w * 0.5, u + w * 0.5, y, y + h, -0.18, d, rose);
  box(out, 'trim', u - w * 0.69, u + w * 0.69, y + h - 0.28, y + h, -0.12, d + 0.16, blush);
  if (detail > 1) {
    box(out, 'trim', u - w * 0.66, u + w * 0.66, y, y + 0.22, -0.18, d + 0.13, blush);
    box(out, 'trim', u - w * 0.58, u + w * 0.58, y + 0.22, y + 0.47, -0.11, d + 0.06, shaded);
  }
}

function rail(out, detail, a, b, y, d) {
  if (detail === 0) return;
  for (const h of [y, y + 0.68]) box(out, 'iron', a, b, h, h + 0.09, d - 0.039, d + 0.032, iron);
  const n = Math.ceil((b - a) / [1, 1.42, 0.77, 0.34][detail]);
  for (let i = 0; i <= n; i++) {
    const u = a + ((b - a) * i) / n;
    box(out, 'iron', u - 0.026, u + 0.026, y, y + 0.763, d - 0.028, d + 0.025, iron);
  }
}

function mansard(out, detail, a, b) {
  const p = f.P;
  const bands = [
    [wall, -0.26],
    [20.76, -2.45],
    [22.1, -6.01],
    [21.37, -12.76],
    [wall, -14.43],
  ];
  for (let i = 1; i < bands.length; i++) {
    const [y, d] = bands[i - 1],
      [h, s] = bands[i];
    quad4(out, 'roof', p(a, y, d), p(b, y, d), p(b, h, s), p(a, h, s), i === 3 ? ridge : copper);
  }
  const n = Math.round((b - a) / [8, 4.8, 3.4, 2.92][detail]);
  for (let i = 0; i < n; i++) {
    if (detail === 0 && i % 2 === 1) continue;
    const u = a + ((b - a) * (i + 0.5)) / n;
    if (domePositions.some((x) => Math.abs(u - x) < 5.7)) continue;
    const dormer = facade([u, -1.04], [1, 0]);
    fbox(out, 'roof', dormer, -0.62, 0.62, 18.77, 19.78, -1.03, 0.091, copper);
    window(out, detail, dormer, 0, 18.89, 0.7, 0.71, { arch: detail > 1 });
  }
}

function cupola(out, detail, u) {
  const cy = 19.18,
    radius = 4.7,
    depth = -4.81;
  const heights = [0, 0.92, 2.31, 3.59, 4.56, 5.12];
  const widths = [4.7, 4.64, 4.08, 3.2, 1.91, 0.64];
  const sections = detail < 2 ? [0, 2, 4, 5] : [0, 1, 2, 3, 4, 5];
  box(out, 'plaster', u - 5.67, u + 5.67, entablature, cy, -9.54, 0.1, rose);
  box(out, 'trim', u - 5.8, u + 5.8, cy - 0.41, cy - 0.07, -9.89, 0.36, blush);
  loft(
    out,
    'roof',
    sections.map((i) =>
      radialRing(
        cy + heights[i],
        widths[i],
        widths[i] * 0.9,
        [9, 15, 26, 38][detail],
        [u, depth],
        0.09,
      ),
    ),
    copper,
  );
  loft(
    out,
    'roof',
    [
      [24.28, 0.74],
      [24.59, 0.74],
      [24.73, 0.53],
    ].map(([h, r]) => radialRing(h, r, r, detail < 2 ? 7 : 12, [u, depth])),
    ridge,
  );
  const face = facade([u, 0.24], [1, 0]);
  const disc = (y, r, d, col, slot) =>
    fan(
      out,
      slot,
      Array.from({ length: detail < 2 ? 10 : 22 }, (_, i) => {
        const a = (i * Math.PI * 2) / (detail < 2 ? 10 : 22);
        return face.P(r * Math.cos(a), y + r * Math.sin(a), d);
      }),
      col,
    );
  disc(18.68, 0.75, 0.17, blush, 'trim');
  disc(18.68, 0.46, 0.191, glass, 'glass');
  if (detail > 1) {
    for (let j = 0; j < [0, 0, 8, 12][detail]; j++) {
      const angle = (j * Math.PI * 2) / [0, 0, 8, 12][detail];
      const point = (i) => [
        u + (widths[i] + 0.036) * Math.cos(angle),
        cy + heights[i],
        depth + (widths[i] * 0.9 + 0.036) * Math.sin(angle),
      ];
      for (let i = 1; i < heights.length; i++)
        beam(out, 'roof', point(i - 1), point(i), 0.068, 0.068, ridge);
    }
  }
}

function centralPavilion(out, detail) {
  const { left, right, center } = central;
  const r = 3.65,
    spring = 7.37,
    a = center - r - 0.24,
    b = center + r + 0.24;
  const D = 0.22;
  face(out, 'plaster', f, left, a, plaza, 12.32, D, rose);
  face(out, 'plaster', f, b, right, plaza, 12.32, D, rose);
  archBand(out, detail, a, b, plaza, spring, 12.32, D, 1.28);
  face(out, 'base', f, a, b, plaza, 12.1, -6.54, shaded);
  window(out, detail, f, center, plaza + 0.09, 4.15, 6.49, { arch: true, d: -6.48 });
  box(out, 'base', a, b, plaza - 0.2, plaza, -6.54, 0.2, gray);
  for (const s of [-1, 1]) {
    for (const x of [4.26, 10.35, 12.2])
      pier(out, center + s * x, plaza + 0.12, 12.16, 0.58, 0.53, detail);
    for (const x of [6.56, 8.74])
      window(out, detail, f, center + s * x, 1.23, 1.4, 5.15, { d: D, arch: detail > 1 });
  }
  box(out, 'trim', left - 0.43, right + 0.43, 12.13, 12.63, -1.94, 0.91, blush);
  face(out, 'plaster', f, left, right, 12.59, 20.56, -1.84, rose);
  const n = 10;
  for (let i = 0; i < n; i++) {
    const x = left + (i * (right - left)) / n,
      y = left + ((i + 1) * (right - left)) / n;
    const accent = i === 0 || i === n - 1 || i === 4 || i === 5;
    archBand(out, detail, x, y, 12.62, accent ? 17.44 : 16.94, 20.32, 0.07, 0.47);
    if (detail > 0)
      window(out, detail, f, (x + y) / 2, 13.15, 1.09, 3.9, { arch: detail > 1, d: -1.8 });
  }
  rail(out, detail, left, right, 12.62, 0.54);
  box(out, 'trim', left - 0.38, right + 0.38, 20.26, 20.85, -2.45, 0.4, blush);
  box(out, 'plaster', left + 0.03, right - 0.03, 20.81, 21.82, -2.22, 0.14, rose);
  const P = f.P;
  const ped = [
    [
      [center - 4.5, 21.61],
      [center + 4.5, 21.61],
      [center + 2.92, 23.72],
      [center + 0.77, 25],
      [center - 0.77, 25],
      [center - 2.92, 23.72],
    ],
  ];
  fan(
    out,
    'plaster',
    ped[0].map(([u, y]) => P(u, y, 0.17)),
    rose,
  );
  const top = ped[0].slice(1).map(([u, y]) => P(u, y, 0.26));
  if (detail > 0)
    for (let i = 1; i < top.length; i++) beam(out, 'trim', top[i - 1], top[i], 0.22, 0.21, blush);
  if (detail > 0) {
    window(out, detail, f, center, 22.02, 1.87, 1.82, { arch: true, d: 0.18 });
    for (const u of [left + 2.75, right - 2.75])
      box(out, 'trim', u - 0.34, u + 0.34, 21.82, 22.26, -1.1, -0.44, blush);
  }
}

function frontage(out, detail) {
  face(out, 'base', f, 0, length, site.foundationBottom, plaza, 0, gray);
  const sideRuns = [
    [0, central.left],
    [central.right, length],
  ];
  for (const [a, b] of sideRuns) {
    face(out, 'plaster', f, a, b, plaza, balcony, 0, rose);
    face(out, 'plaster', f, a, b, balcony, entablature, -2.14, shaded);
    box(out, 'trim', a, b, balcony - 0.24, balcony + 0.13, -2.14, 0.3, blush);
    box(out, 'trim', a, b, entablature - 0.28, wall, -1.24, 0.32, blush);
    const count = Math.ceil((b - a) / 3.95);
    const pitch = (b - a) / count;
    for (let j = 0; j < count; j++) {
      const u = a + (j + 0.5) * pitch,
        bud = domePositions.some((x) => Math.abs(x - u) < 5.3);
      window(out, detail, f, u, plaza + 0.98, 1.48, 4.37, { arch: detail > 2 });
      if (bud || j === 0 || j === count - 1) {
        face(out, 'plaster', f, u - pitch / 2, u + pitch / 2, balcony + 0.13, entablature, 0, rose);
        window(out, detail, f, u, balcony + 1.29, 1.52, 4.56, { arch: detail > 2 });
      } else {
        archBand(
          out,
          detail,
          u - pitch / 2,
          u + pitch / 2,
          balcony + 0.1,
          12.79,
          entablature,
          0.03,
          0.54,
        );
        window(out, detail, f, u, balcony + 0.71, 1.28, 4.1, { d: -2.11 });
      }
      if (detail > 0)
        pier(out, u - pitch / 2, plaza + 0.29, balcony - plaza - 0.53, 0.49, 0.19, detail);
    }
    rail(out, detail, a, b, balcony + 0.17, 0.12);
    mansard(out, detail, a, b);
  }
  for (const u of domePositions) cupola(out, detail, u);
  centralPavilion(out, detail);
}

function building(out, detail) {
  const outline = outwardRing(site.plan);
  for (const [i, a] of outline.entries()) {
    const b = outline[(i + 1) % outline.length];
    if (Math.abs(a[1]) < 0.018 && Math.abs(b[1]) < 0.018) continue;
    const F = wallFace(a, b);
    if (F.length < 0.05) continue;
    const east = a[1] < -79 && b[1] < -79;
    face(out, 'plaster', F, 0, F.length, site.foundationBottom, wall, rose);
    const n = Math.floor(F.length / (east ? 5.8 : 6.75));
    if (detail === 0) continue;
    for (const h of [1.02, 7.4, 15.92])
      fbox(out, 'trim', F, 0, F.length, h, h + 0.18, -0.05, 0.16, blush);
    for (let k = 0; k < n; k++) {
      const u = ((k + 0.5) * F.length) / n;
      for (const y of east ? [-2.87, 1.86, 8.8] : [1.86, 8.8])
        window(out, detail, F, u, y, 1.55, east ? 3.29 : 4.2);
    }
  }
  for (const outline of site.courts) {
    const inner = outwardRing(outline).reverse();
    for (const [i, a] of inner.entries()) {
      const F = wallFace(a, inner[(i + 1) % inner.length]);
      face(out, 'plaster', F, 0, F.length, site.foundationBottom, wall, shaded);
      if (detail < 2) continue;
      const n = Math.floor(F.length / 4.95);
      for (let j = 0; j < n; j++)
        for (const y of [3.73, 9.21])
          window(out, detail, F, ((j + 0.5) * F.length) / n, y, 1.37, 3.14);
    }
  }
  for (const polygon of site.capParts) cap(out, 'roof', polygon, wall, ridge);
  const penthouse = outwardRing(site.roofPart);
  for (const [i, a] of penthouse.entries()) {
    const F = wallFace(a, penthouse[(i + 1) % penthouse.length]);
    face(out, 'plaster', F, 0, F.length, wall, 24.67, shaded);
  }
  cap(out, 'roof', penthouse, 24.67, gray);
}

function build(out, detail) {
  const local = deform(out, ([u, y, d]) => front.P(u, y, d));
  building(local, detail);
  frontage(local, detail);
}

export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = buildCloseup;
