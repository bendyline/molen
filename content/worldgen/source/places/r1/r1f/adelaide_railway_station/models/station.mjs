import { column } from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import {
  fan,
  fbox,
  opening,
  quad4,
  rgb,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import site from '../site-controls.json' with { type: 'json' };
import {
  black,
  cap,
  surfaces as classicalSurfaces,
  clock,
  cornice,
  edges,
  glass,
  mortar,
  sandstone,
  trim,
  weatheredRoof,
} from './classical.mjs';

export const surfaces = {
  ...classicalSurfaces,
  sandstone: { ...classicalSurfaces.sandstone, graph: 'stone_sandstone_raw' },
};
const eave = 15.37;
const chamfer = wallFace(site.outline[6], site.outline[5]);
const south = wallFace(site.outline[9], site.outline[6]);
const east = wallFace(site.outline[5], site.outline[4]);
const isCorner = (f) => f.origin === site.outline[6] && f.along[0] > 0.3;
const awning = rgb('5f625e');

function letters(out, face, str, center, y, size) {
  const glyph = {
    R: ['1110', '1001', '1110', '1010', '1001'],
    A: ['0110', '1001', '1111', '1001', '1001'],
    I: ['1111', '0110', '0110', '0110', '1111'],
    L: ['1000', '1000', '1000', '1000', '1111'],
    W: ['1001', '1001', '1001', '1111', '1001'],
    Y: ['1001', '1001', '0110', '0110', '0110'],
    S: ['0111', '1000', '0110', '0001', '1110'],
    T: ['1111', '0110', '0110', '0110', '0110'],
    O: ['0110', '1001', '1001', '1001', '0110'],
    N: ['1001', '1101', '1101', '1011', '1001'],
  };
  const p = (u, h) => face.P(u, h, 0.262),
    start = center - str.length * size * 2.5;
  for (let i = 0; i < str.length; i++) {
    const code = glyph[str[i]];
    if (!code) continue;
    for (let r = 0; r < 5; r++)
      for (let j = 0; j < 4; j++)
        if (code[r][j] === '1') {
          const u = start + (i * 5 + j) * size,
            h = y + (4 - r) * size;
          quad4(
            out,
            'metal',
            p(u, h),
            p(u + size, h),
            p(u + size, h + size),
            p(u, h + size),
            black,
          );
        }
  }
}

function mainEntrance(out, detail) {
  const w = chamfer.length,
    mid = w / 2;
  for (const [a, b] of [
    [-1.05, 1.88],
    [w - 1.88, w + 1.05],
  ]) {
    fbox(out, 'sandstone', chamfer, a, b, -1, 4.03, -2.2, 0.41, sandstone);
  }
  fbox(out, 'metal', chamfer, 1.86, w - 1.86, -0.22, 3.96, -4.55, -4.44, awning);
  fbox(out, 'ashlar', chamfer, -0.35, w + 0.35, -0.54, 0.1, -4.6, 0.85, mortar);
  fbox(out, 'sandstone', chamfer, -1.0, w + 1.0, 3.89, 5.12, -1.3, 1.45, trim);
  fbox(out, 'sandstone', chamfer, -0.43, w + 0.43, eave - 0.12, 18.26, -5.2, 0.17, sandstone);
  cornice(out, chamfer, -0.47, w + 0.47, 18.21, 0.25, 0.29, detail);
  if (detail === 0) return;
  for (const t of [0.12, 0.375, 0.625, 0.88]) {
    const [x, , z] = chamfer.P(w * t, 0, 0.51);
    column(out, 'sandstone', x, z, 5.19, 14.84, 0.37, trim, [0, 6, 10, 14][detail]);
  }
  for (const t of [0.25, 0.5, 0.75])
    opening(out, chamfer, w * t, 5.41, w * 0.215, 8.83, {
      glassSlot: 'glazing',
      frameSlot: 'sandstone',
      glass,
      frame: trim,
      frameWidth: 0.12,
      frameDepth: 0.14,
      transoms: detail > 1 ? 2 : 0,
    });
  clock(out, chamfer, mid, 16.69, 0.52, detail, 0.26);
  if (detail >= 2) {
    letters(out, chamfer, 'RAILWAY', mid - 2.78, 16.42, 0.115);
    letters(out, chamfer, 'STATION', mid + 2.78, 16.42, 0.115);
  }
}

function streetPavilion(out, face, center, detail) {
  const width = 13.45,
    left = center - width * 0.5,
    right = center + width * 0.5;
  fbox(out, 'sandstone', face, left, right, eave - 0.07, 17.22, -4.17, 0.09, sandstone);
  cornice(out, face, left - 0.16, right + 0.16, 17.19, 0.29, 0.29, detail);
  if (detail === 0) return;
  fbox(out, 'ashlar', face, left - 0.16, right + 0.16, 5.02, 5.5, -0.08, 0.89, mortar);
  for (let i = 0; i < 5; i++) {
    const u = left + 0.71 + ((width - 1.42) * i) / 4;
    const [x, , z] = face.P(u, 0, 0.54);
    column(out, 'sandstone', x, z, 5.48, 14.76, 0.34, trim, [0, 6, 10, 14][detail]);
  }
  for (const u of [center - 4.49, center - 1.47, center + 1.47, center + 4.49])
    opening(out, face, u, 5.54, 2.16, 7.93, {
      glassSlot: 'glazing',
      frameSlot: 'sandstone',
      glass,
      frame: trim,
      frameWidth: detail === 3 ? 0.1 : 0,
      sill: detail === 3,
      frameDepth: 0.13,
    });
  if (detail >= 2)
    for (const u of [center - 3.5, center, center + 3.5])
      opening(out, face, u, 15.77, 1.08, 0.91, {
        glassSlot: 'glazing',
        frameSlot: 'sandstone',
        glass,
        frame: trim,
        d: 0.104,
        frameWidth: 0.1,
        frameDepth: 0.16,
      });
}

function facade(out, face, detail, pavilion) {
  fbox(out, 'sandstone', face, 0, face.length, -6.6, eave, -0.272, 0, sandstone);
  cornice(out, face, -0.06, face.length + 0.06, eave - 0.47, 0.42, 0.4, detail);
  if (detail === 0) return;
  for (const y of [3.24, 4.89, 8.95, 12.65, 14.4])
    cornice(out, face, 0, face.length, y, 0.15, 0.18, detail);
  const n = Math.max(1, Math.round(face.length / 3.6)),
    space = face.length / n;
  for (let i = 0; i < n; i++) {
    const u = (i + 0.5) * space;
    const window = {
      glassSlot: 'glazing',
      frameSlot: 'sandstone',
      glass,
      frame: trim,
      frameWidth: detail === 3 ? 0.11 : 0,
      frameDepth: 0.12,
      sill: detail === 3,
      transoms: detail === 3 ? 1 : 0,
    };
    if (pavilion === undefined || Math.abs(u - pavilion) > 6.77) {
      opening(out, face, u, 5.68, Math.min(1.15, space * 0.52), 2.72, window);
      opening(out, face, u, 9.71, Math.min(1.12, space * 0.5), 2.41, window);
    }
    if (detail >= 2)
      opening(out, face, u, 0.29, Math.min(1.68, space * 0.68), 2.54, {
        ...window,
        head: 'round',
        rise: 0.38,
        frameWidth: detail === 3 ? 0.105 : 0,
      });
  }
  if (detail === 3)
    for (let i = 0; i < face.length / 0.7; i++) {
      const x = i * 0.7 + 0.1;
      if (x + 0.18 <= face.length)
        fbox(out, 'sandstone', face, x, x + 0.18, 14.57, 14.9, 0.07, 0.24, trim);
    }
}

function build(out, detail) {
  for (const face of edges(site.outline)) {
    if (isCorner(face)) continue;
    const southOffset =
      (face.origin[0] - south.origin[0]) * south.along[0] +
      (face.origin[1] - south.origin[1]) * south.along[1];
    const pavilion =
      face.origin === east.origin
        ? east.length * 0.4
        : face.normal[1] > 0.98
          ? 9.41 - southOffset
          : undefined;
    facade(out, face, detail, pavilion);
  }
  fbox(out, 'sandstone', chamfer, 0, chamfer.length, 4.25, eave, -0.22, 0, sandstone);
  cornice(out, chamfer, -0.11, chamfer.length + 0.11, eave - 0.47, 0.42, 0.4, detail);
  cap(out, 'roof', site.outline, eave, weatheredRoof);
  mainEntrance(out, detail);
  streetPavilion(out, east, east.length * 0.4, detail);
  streetPavilion(out, south, 9.41, detail);
}

export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = buildCloseup;
