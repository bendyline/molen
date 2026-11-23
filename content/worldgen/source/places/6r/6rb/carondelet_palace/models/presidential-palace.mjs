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
  gableRoof,
  opening,
  outwardRing,
  quad4,
  rgb,
  roundArch,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import { cap, clock } from '../../../../r1/r1f/adelaide_railway_station/models/classical.mjs';
import site from '../site-controls.json' with { type: 'json' };

export const surfaces = {
  plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.94 },
  ashlar: { slot: 'foundation', graph: 'stone_ashlar', roughness: 0.96 },
  granite: { slot: 'trim', graph: 'stone_granite', roughness: 0.91 },
  tile: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.92 },
  timber: { slot: 'door', graph: 'wood_vertical', roughness: 0.87 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.81 },
  glazing: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.56 },
};
const ivory = rgb('e5e2d8'),
  pale = rgb('d7d4ca'),
  gray = rgb('72706a');
const base = rgb('605c55'),
  stone = rgb('b6b0a4'),
  glaze = rgb('3e4441');
const clay = rgb('8a6759'),
  walnut = rgb('695348'),
  iron = rgb('44433c');

const front = facade(site.origin, site.along),
  f = facade([0, 0], [1, 0]);
const floor = site.loggia.floor,
  ceil = site.loggia.ceiling;
const wallTop = 16.64,
  parapet = 17.06;
const span = site.length,
  left = 11.48,
  right = span - 11.48;
const ground = site.foundationBottom;

function face(out, slot, F, u0, u1, y0, y1, d, color) {
  const p = F.P;
  quad4(out, slot, p(u0, y0, d), p(u1, y0, d), p(u1, y1, d), p(u0, y1, d), color);
}

function window(
  out,
  detail,
  F,
  u,
  y,
  w,
  h,
  { arched = false, surround = 'plaster', color = glaze, slot = 'glazing', depth = 0 } = {},
) {
  if (detail < 2 && !arched) {
    if (detail === 1)
      face(
        out,
        surround,
        F,
        u - w / 2 - 0.13,
        u + w / 2 + 0.13,
        y - 0.12,
        y + h + 0.13,
        depth + 0.021,
        pale,
      );
    face(out, slot, F, u - w / 2, u + w / 2, y, y + h, depth + 0.046, color);
    return;
  }
  const at = facade(
    F.P(0, 0, depth).filter((_, i) => i !== 1),
    F.along,
  );
  opening(out, at, u, y, w, h, {
    head: arched ? 'round' : 'flat',
    glassSlot: slot,
    frameSlot: surround,
    glass: color,
    frame: pale,
    frameWidth: detail === 0 ? 0 : 0.155,
    frameDepth: 0.18,
    d: 0.075,
    sill: detail > 0,
    mullions: detail > 1 ? 1 : 0,
    transoms: detail > 1 ? 2 : 0,
    mullionColor: walnut,
  });
}

function residentialRails(out, detail, a, b, y, d) {
  if (detail === 0) return;
  const length = b - a;
  for (const yy of [y, y + 0.78])
    fbox(out, 'metal', f, a, b, yy, yy + 0.071, d - 0.05, d + 0.05, iron);
  const n = Math.ceil(length / [1, 2.3, 0.6, 0.39][detail]);
  for (let k = 0; k <= n; k++) {
    const u = a + (k * length) / n;
    fbox(out, 'metal', f, u - 0.024, u + 0.024, y, y + 0.83, d - 0.028, d + 0.028, iron);
    if (detail > 2 && k < n) {
      const mid = u + (0.5 * length) / n,
        p = (a, b) => f.P(a, b, d);
      beam(out, 'metal', p(mid - 0.14, y + 0.2), p(mid + 0.12, y + 0.62), 0.029, 0.03, iron);
    }
  }
}

function arcade(out, detail, a, b) {
  const width = (b - a) / 4;
  const r = width / 2 - 0.3,
    archY = floor + 3.45;
  const depths = [0, -0.68];
  const points = roundArch(r, [4, 5, 8, 12][detail]);
  for (let i = 0; i < 4; i++) {
    const left = a + i * width,
      center = left + width / 2;
    fbox(out, 'plaster', f, left - 0.276, left + 0.315, floor, ceil, -0.68, 0.13, ivory);
    if (detail > 0) {
      fbox(out, 'plaster', f, left - 0.39, left + 0.42, archY - 0.28, archY, -0.69, 0.21, pale);
      fbox(
        out,
        'plaster',
        f,
        left - 0.33,
        left + 0.37,
        archY - 0.4,
        archY - 0.28,
        -0.7,
        0.18,
        pale,
      );
    }
    for (let k = 1; k < points.length; k++) {
      const [x, y] = points[k - 1],
        [z, h] = points[k];
      const P = (x, y, d) => f.P(center + x, archY + y, d);
      const p = depths.map((d) => [
        P(x, y, d),
        P(z, h, d),
        f.P(center + z, ceil, d),
        f.P(center + x, ceil, d),
      ]);
      quad4(out, 'plaster', ...p[0], ivory);
      if (detail === 0) continue;
      quad4(out, 'plaster', ...p[1].slice().reverse(), pale);
      quad4(out, 'plaster', p[1][0], p[1][1], p[0][1], p[0][0], pale);
    }
  }
  fbox(out, 'plaster', f, b - 0.32, b + 0.06, floor, ceil, -0.68, 0.12, ivory);
}

function colonnade(out, detail) {
  const n = site.loggia.columns;
  for (let i = 0; i < n; i++) {
    const u = left + ((right - left) * (i + 0.5)) / n;
    const z = -0.36;
    const radius = 0.36;
    const rings =
      detail < 2
        ? [
            [floor, 0.43],
            [ceil, 0.31],
          ]
        : [
            [floor, 0.52],
            [floor + 0.23, 0.52],
            [floor + 0.47, radius],
            [ceil - 0.39, 0.3],
            [ceil - 0.25, 0.53],
            [ceil, 0.54],
          ];
    loft(
      out,
      'granite',
      rings.map(([y, r]) => radialRing(y, r, r, [5, 7, 12, 17][detail], [u, z], 0.33)),
      stone,
      { cap: false },
    );
    if (detail > 0 && i % 2 === 1)
      window(out, detail, f, u, floor + 0.22, 1.16, 3.43, { depth: -site.loggia.depth });
  }
  const first = left + (right - left) / n;
  const step = (right - left) / n;
  for (let i = 0; i < n - 1; i++) {
    const u = first + i * step;
    residentialRails(out, detail, u - step * 0.31, u + step * 0.31, floor + 0.12, -0.47);
  }
}

function pediment(out, a, b, eave, ridge, s, d) {
  const mid = (a + b) / 2;
  tri(out, 'plaster', f.P(a, eave, d), f.P(b, eave, d), f.P(mid, ridge, d), ivory);
  beam(out, 'plaster', f.P(a, eave, d + 0.11), f.P(mid, ridge, d + 0.11), 0.29, 0.29, pale);
  beam(out, 'plaster', f.P(mid, ridge, d + 0.11), f.P(b, eave, d + 0.11), 0.29, 0.29, pale);
  fbox(out, 'plaster', f, a, b, eave - 0.18, eave + 0.06, d - 0.1, d + 0.26, pale);
  quad4(
    out,
    'tile',
    f.P(a, eave, d + 0.15),
    f.P(mid, ridge + 0.08, d + 0.15),
    f.P(mid, ridge + 0.08, s),
    f.P(a, eave, s),
    clay,
  );
  quad4(
    out,
    'tile',
    f.P(mid, ridge + 0.08, d + 0.15),
    f.P(b, eave, d + 0.15),
    f.P(b, eave, s),
    f.P(mid, ridge + 0.08, s),
    clay,
  );
}

function flag(out, detail, u) {
  const y = site.clock.peak;
  beam(out, 'metal', f.P(u, y, -2.06), f.P(u, y + 5.12, -2.06), 0.071, 0.071, gray);
  const colors = ['e7bd58', '465f8b', 'ad4d49'].map(rgb),
    widths = [0, 0.785, 1.18, 1.575];
  const n = detail > 1 ? 7 : 3;
  const p = (t, h) => f.P(u + 3.25 * t, y + 4.96 - h - t * 0.18, -2.06 + Math.sin(t * 8.4) * 0.27);
  for (let j = 0; j < 3; j++)
    for (let i = 0; i < n; i++) {
      const a = i / n,
        b = (i + 1) / n;
      const ring = [p(a, widths[j + 1]), p(b, widths[j + 1]), p(b, widths[j]), p(a, widths[j])];
      quad4(out, 'metal', ...ring, colors[j]);
      quad4(out, 'metal', ...ring.slice().reverse(), colors[j]);
    }
}

function plaza(out, detail) {
  const back = -site.loggia.depth;
  face(out, 'ashlar', f, 0, span, ground, floor - 0.18, 0, base);
  fbox(out, 'granite', f, -0.1, span + 0.1, floor - 0.22, floor, back, 0.27, gray);
  face(out, 'plaster', f, 0, span, floor, ceil, back, ivory);
  fbox(out, 'plaster', f, 0, span, ceil, ceil + 0.45, back, 0.33, pale);
  face(out, 'plaster', f, 0, span, ceil + 0.22, wallTop, -0.35, ivory);
  fbox(out, 'plaster', f, -0.12, span + 0.12, wallTop - 0.19, parapet, -0.54, 0.12, pale);
  arcade(out, detail, 0, left);
  arcade(out, detail, right, span);
  colonnade(out, detail);
  for (const u of [0, span - 11.53]) {
    fbox(out, 'plaster', f, u, u + 11.53, ceil + 0.26, 18.02, -7.57, 0.22, ivory);
    pediment(out, u - 0.16, u + 11.69, 18.04, 19.72, -7.79, 0.28);
    for (let i = 0; i < 4; i++) {
      window(out, detail, f, u + 1.43 + i * 2.89, 12.27, 1.08, 3.2, { depth: 0.24 });
    }
  }
  const center = span / 2;
  fbox(out, 'plaster', f, center - 5.46, center + 5.46, wallTop, 21.69, -8.26, 0.14, ivory);
  pediment(out, center - 5.54, center + 5.54, 21.71, site.clock.peak, -8.22, 0.34);
  for (const s of [-1, 1])
    window(out, detail, f, center + s * 3.03, 17.91, 1.34, 3.17, { arched: true, depth: 0.22 });
  clock(out, f, center, site.clock.y, 0.53, detail, 0.26);
  flag(out, detail, center);
  for (let i = 0; i < 14; i++) {
    const u = left + 2 + (i * (right - left - 4)) / 13;
    window(out, detail, f, u, 12.48, 1.02, 2.61, { depth: -0.33 });
  }
  for (let i = 0; i < 11; i++) {
    const u = 4.45 + (i * (span - 8.9)) / 10;
    const grade = -1.7 + u * 0.057;
    window(out, detail, f, u, grade, 1.34, Math.min(3.05, floor - grade - 0.22), {
      color: walnut,
      surround: 'ashlar',
      slot: 'timber',
    });
  }
  if (detail > 0) residentialRails(out, detail, left, right, 12.18, 0.36);
}

function wings(out, detail) {
  const ring = outwardRing(site.plan);
  for (const [i, a] of ring.entries()) {
    const b = ring[(i + 1) % ring.length];
    if (Math.abs(a[1]) < 0.021 && Math.abs(b[1]) < 0.021) continue;
    const F = wallFace(a, b);
    const length = F.length;
    if (length < 0.02) continue;
    const y = a[1] < -10 && b[1] < -10 ? 14.46 : wallTop;
    face(out, 'ashlar', F, 0, length, ground, 5.43, 0, base);
    face(out, 'plaster', F, 0, length, 5.4, y, 0, ivory);
    if (detail === 0) continue;
    fbox(out, 'plaster', F, 0, length, 10.7, 10.96, -0.12, 0.19, pale);
    const windows = Math.floor(length / 4.5);
    for (let k = 0; k < windows; k++) {
      const u = ((k + 0.5) * length) / windows;
      for (const h of [7.19, 11.79]) window(out, detail, F, u, h, 1.17, 1.92);
    }
  }
  cap(out, 'tile', ring, 14.46, clay);
  gableRoof(out, 'tile', [0, -8.1], [span, -8.1], 15.43, 14.48, 18.1, clay, { overhang: 0.18 });
  for (const [a, b, deep] of [
    [0, 16.81, -28.98],
    [35.35, 46.08, -28.97],
    [60.35, span, -30.32],
  ]) {
    gableRoof(
      out,
      'tile',
      [(a + b) / 2, deep],
      [(a + b) / 2, -10.4],
      b - a - 0.28,
      14.46,
      18.24,
      clay,
      { overhang: 0.13, endSlot: 'plaster', endColor: ivory },
    );
  }
}

function build(out, detail) {
  const local = deform(out, ([u, y, d]) => front.P(u, y, d));
  wings(local, detail);
  plaza(local, detail);
}

export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = buildCloseup;
