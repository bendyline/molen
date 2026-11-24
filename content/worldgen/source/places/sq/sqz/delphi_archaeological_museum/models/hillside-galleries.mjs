import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { deform } from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import {
  facade,
  fbox,
  outwardRing,
  quad4,
  rgb,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import { cap } from '../../../../r1/r1f/adelaide_railway_station/models/classical.mjs';
import site from '../site-controls.json' with { type: 'json' };

export const surfaces = {
  wall: { slot: 'wall', graph: 'stone_limestone', roughness: 0.95 },
  footing: { slot: 'foundation', graph: 'stone_ashlar', roughness: 0.98 },
  roof: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.9 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.83 },
  glazing: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.44 },
};
const limestone = rgb('c9bdab'),
  warm = rgb('c1b49f'),
  gray = rgb('a7a399'),
  roof = rgb('a2a096');
const shadow = rgb('6a6960'),
  glass = rgb('50676b'),
  steel = rgb('4c5351'),
  stone = rgb('a5a296');
const front = facade(site.origin, site.along),
  f = facade([0, 0], [1, 0]);
const base = site.foundationBottom,
  floor = site.entrySill;

function face(out, slot, F, a, b, y0, y1, d, color) {
  const p = F.P;
  quad4(out, slot, p(a, y0, d), p(b, y0, d), p(b, y1, d), p(a, y1, d), color);
}

function block(out, detail, { outline, height }) {
  const r = outwardRing(outline);
  for (const [i, a] of r.entries()) {
    const b = r[(i + 1) % r.length];
    if (
      Math.abs(a[1]) < 0.002 &&
      Math.abs(b[1]) < 0.002 &&
      Math.min(a[0], b[0]) >= -0.002 &&
      Math.max(a[0], b[0]) <= site.length + 0.002
    )
      continue;
    const F = wallFace(a, b),
      n = F.length;
    if (n < 0.025) continue;
    face(out, 'footing', F, 0, n, base, Math.min(height - 0.2, 4.22), 0, gray);
    face(
      out,
      'wall',
      F,
      0,
      n,
      Math.min(height - 0.2, 4.22),
      height,
      0,
      i % 3 === 0 ? warm : limestone,
    );
    if (detail > 0 && n > 2.21) {
      face(out, 'metal', F, 0, n, height - 0.095, height, 0.02, gray);
      if (detail > 1 && n > 6.4 && F.normal[0] < -0.35) {
        const count = Math.max(1, Math.round(n / 6.7));
        for (let j = 0; j < count; j++) {
          const u = ((j + 0.5) * n) / count;
          fbox(
            out,
            'metal',
            F,
            u - 0.67,
            u + 0.67,
            height - 3.27,
            height - 1.65,
            -0.11,
            0.055,
            steel,
          );
          face(out, 'glazing', F, u - 0.59, u + 0.59, height - 3.18, height - 1.74, 0.06, glass);
        }
      }
    }
  }
  cap(out, 'footing', r, height, roof);
}

function reveal(out, u, w, y) {
  const a = u - w / 2,
    b = u + w / 2,
    p = f.P;
  face(out, 'glazing', f, a, b, floor, y, -1.145, shadow);
  quad4(out, 'wall', p(a, floor, -1.15), p(a, floor, 0), p(a, y, 0), p(a, y, -1.15), warm);
  quad4(out, 'wall', p(b, floor, 0), p(b, floor, -1.15), p(b, y, -1.15), p(b, y, 0), warm);
  quad4(out, 'wall', p(b, y, -1.15), p(a, y, -1.15), p(a, y, 0), p(b, y, 0), stone);
}

function glazedBay(out, detail, u, y, w, h) {
  const d = 0.94,
    l = u - w / 2,
    r = u + w / 2;
  fbox(out, 'metal', f, l - 0.11, r + 0.11, y - 0.15, y + h + 0.15, -0.08, d, steel);
  face(out, 'glazing', f, l + 0.03, r - 0.03, y + 0.04, y + h - 0.045, d + 0.016, glass);
  if (detail > 0) {
    face(out, 'metal', f, u - 0.028, u + 0.028, y, y + h, d + 0.034, steel);
    for (const a of [l + 0.28, r - 0.28])
      fbox(out, 'wall', f, a - 0.22, a + 0.22, y - 0.49, y - 0.14, -0.12, d - 0.09, limestone);
    if (detail > 1) {
      const p = f.P;
      quad4(
        out,
        'glazing',
        p(l, y, d - 0.16),
        p(l, y, 0.076),
        p(l, y + h, 0.076),
        p(l, y + h, d - 0.16),
        glass,
      );
      quad4(
        out,
        'glazing',
        p(r, y, 0.076),
        p(r, y, d - 0.16),
        p(r, y + h, d - 0.16),
        p(r, y + h, 0.076),
        glass,
      );
    }
  }
}

function facadeAndSteps(out, detail) {
  face(out, 'wall', f, 0, 15.75, base, 6.07, 0, limestone);
  face(out, 'wall', f, 42.1, site.length, base, 12.13, 0, limestone);
  const start = 15.75,
    end = 42.1,
    doorTop = 4.48;
  face(out, 'wall', f, start, end, base, floor, 0, warm);
  face(out, 'wall', f, start, end, doorTop, 9.74, 0, limestone);
  let left = start;
  for (const { u, width } of site.portals) {
    face(out, 'wall', f, left, u - width / 2, floor, doorTop, 0, limestone);
    reveal(out, u, width, doorTop);
    left = u + width / 2;
    glazedBay(out, detail, u + 0.5, 4.81, 2.48, 2.96);
  }
  face(out, 'wall', f, left, end, floor, doorTop, 0, limestone);
  if (detail === 3) {
    for (let row = 0; row < 4; row++) {
      const h = 4.55 + 1.26 * row;
      face(out, 'footing', f, start, end, h, h + 0.013, 0.009, gray);
      for (let u = start + 1.18 + (row % 2) * 1.2; u < end - 0.52; u += 2.4) {
        face(out, 'footing', f, u - 0.007, u + 0.007, h, h + 1.26, 0.009, gray);
      }
    }
  }
  if (detail > 0) {
    for (const [a, b, h] of [
      [0, start, 6.07],
      [start, end, 9.74],
      [end, site.length, 12.13],
    ])
      fbox(out, 'footing', f, a, b, h - 0.14, h, -0.28, 0.18, limestone);
    for (const u of [3.45, 10.48, 19.5, 24.74])
      fbox(out, 'wall', f, u - 0.23, u + 0.19, -1, 5.14, -0.01, 0.3, warm);
    glazedBay(out, detail, 22.37, 5.07, 2.02, 2.72);
  }
  const n = detail === 0 ? 2 : 5;
  for (let i = 0; i < n; i++) {
    const m = (i + 1) / n;
    fbox(
      out,
      'footing',
      f,
      25.56,
      39.64,
      -0.72,
      -0.21 + (floor + 0.21) * m,
      3.48 - 3.48 * m,
      3.48 - (3.48 * i) / n,
      i % 2 === 1 ? stone : gray,
    );
  }
  fbox(out, 'footing', f, 25.56, 39.64, -1.2, floor, -0.31, 0.18, stone);
  if (detail > 0) {
    for (const u of [26.14, 39.08]) {
      const a = f.P(u, 0.19, 3.42),
        b = f.P(u, floor + 0.84, 0.59);
      beam(out, 'metal', a, b, 0.044, 0.048, steel);
      for (const [p, h] of [
        [a, -0.47],
        [b, floor + 0.03],
      ])
        beam(out, 'metal', [p[0], h, p[2]], p, 0.046, 0.046, steel);
    }
  }
}

function upperTerraces(out, detail) {
  fbox(out, 'roof', f, 45.04, 60.41, 12.16, 12.51, -4.61, 0.89, steel);
  for (const u of [45.23, 53.57, 60.11])
    fbox(out, 'metal', f, u - 0.112, u + 0.112, 8.43, 12.18, -0.3, -0.09, steel);
  for (const [a, b, h, w] of [
    [39.62, 48.36, 2.47, 2.05],
    [47.13, 56.65, 4.39, 2.32],
    [55.3, 64.67, 6.06, 1.82],
  ]) {
    fbox(out, 'wall', f, a, b, -2.87, h, -0.068, w, warm);
    if (detail > 0)
      fbox(
        out,
        'footing',
        f,
        a - 0.044,
        b + 0.044,
        h - 0.12,
        h + 0.047,
        -0.098,
        w + 0.092,
        limestone,
      );
  }
  if (detail > 1)
    for (const u of [46.42, 50.1]) {
      fbox(out, 'metal', f, u - 0.078, u + 0.078, 4.31, 7.11, 0.31, 0.47, steel);
      fbox(out, 'metal', f, u - 0.078, u + 0.078, 6.99, 7.17, 0.42, 1.98, steel);
    }
}

function build(out, detail) {
  const local = deform(out, ([u, y, d]) => front.P(u, y, d));
  for (const p of site.sections) block(local, detail, p);
  facadeAndSteps(local, detail);
  upperTerraces(local, detail);
}
export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = buildCloseup;
