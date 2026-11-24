import { sphere } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
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
  wall: { slot: 'wall', graph: 'stone_ashlar', roughness: 0.96 },
  trim: { slot: 'trim', graph: 'plaster_lime', roughness: 0.92 },
  roof: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.92 },
  stair: { slot: 'foundation', graph: 'stone_granite', roughness: 0.95 },
  shutter: { slot: 'trim', graph: 'metal_painted', roughness: 0.89 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.62 },
};
const stone = rgb('d9d2c4'),
  cream = rgb('e0d8c7'),
  brass = rgb('8b765e'),
  white = rgb('e4dfd0');
const roof = rgb('a59b87'),
  seam = rgb('8f9188'),
  bronze = rgb('6e5948'),
  slate = rgb('72716b');
const shutter = rgb('668991'),
  shade = rgb('485857'),
  tint = rgb('8b988e');
const main = facade(site.facade.origin, site.facade.along),
  { eave, floor, foundation } = site;

function panel(out, slot, f, a, b, y, Y, d, color) {
  quad4(out, slot, f.P(a, y, d), f.P(b, y, d), f.P(b, Y, d), f.P(a, Y, d), color);
}
function courses(out, f, width, detail) {
  for (const [y, Y, d] of [
    [floor - 0.19, floor + 0.22, 0.12],
    [6.15, 6.43, 0.135],
    [11.64, 11.83, 0.19],
    [11.88, 12.13, 0.32],
  ]) {
    if (detail === 0 && Y < 11.8) continue;
    fbox(out, 'trim', f, 0, width, y, Y, -0.07, d, cream);
  }
}
function windowRow(out, f, a, b, low, high, n, detail) {
  for (let i = 0; i < n; i++) {
    const width = (b - a) / n,
      center = a + (i + 0.5) * width;
    const u = center - width * 0.263,
      v = center + width * 0.263;
    panel(out, 'wall', f, a + i * width, u, low, high, 0, stone);
    panel(out, 'wall', f, v, a + (i + 1) * width, low, high, 0, stone);
    panel(out, 'glass', f, u, v, low, high, -0.064, tint);
    panel(out, 'shutter', f, u, v, low + (high - low) * 0.26, high, -0.028, shutter);
    if (detail > 1) {
      fbox(out, 'trim', f, u - 0.074, v + 0.074, low - 0.11, low, -0.09, 0.12, cream);
      fbox(out, 'trim', f, u - 0.125, v + 0.125, high, high + 0.115, -0.09, 0.135, cream);
    }
    if (detail > 1) {
      fbox(
        out,
        'shutter',
        f,
        center - 0.025,
        center + 0.025,
        low,
        low + (high - low) * 0.26,
        -0.065,
        0.02,
        shade,
      );
      fbox(out, 'shutter', f, u - 0.035, v + 0.035, low + 0.09, low + 0.168, 0.048, 0.118, shade);
    }
  }
}
function bays(out, f, a, b, detail, doors = false) {
  const n = doors ? 3 : Math.max(1, Math.round((b - a) / 2.99));
  const rows = doors
    ? [
        [floor + 0.08, 5.35],
        [7.4, 10.19],
      ]
    : [
        [floor + 0.42, 5.11],
        [7.65, 10.14],
      ];
  let from = foundation;
  for (const [lo, hi] of rows) {
    panel(out, 'wall', f, a, b, from, lo, 0, stone);
    if (doors && lo < 4) {
      const width = (b - a) / 3;
      for (let i = 0; i < 3; i++) {
        const u = a + (i + 0.5) * width,
          w = width * 0.29;
        panel(out, 'wall', f, a + i * width, u - w, lo, hi, 0, stone);
        panel(out, 'wall', f, u + w, a + (i + 1) * width, lo, hi, 0, stone);
        panel(out, 'shutter', f, u - w, u + w, lo, hi, -0.052, bronze);
        if (detail > 1)
          for (let j = 1; j < 5; j++)
            fbox(
              out,
              'shutter',
              f,
              u - w,
              u + w,
              lo + j * 0.79,
              lo + j * 0.79 + 0.032,
              -0.05,
              0.024,
              brass,
            );
      }
    } else if (detail > 0 || doors) {
      windowRow(out, f, a, b, lo, hi, n, detail);
    } else panel(out, 'wall', f, a, b, lo, hi, 0, stone);
    from = hi;
  }
  panel(out, 'wall', f, a, b, from, eave, 0, stone);
}
function walls(out, detail) {
  const ring = outwardRing(site.outline);
  for (const [i, a] of ring.entries()) {
    const f = wallFace(a, ring[(i + 1) % ring.length]);
    if (f.length > 130) {
      let start = 0;
      for (const portico of site.porticoes) {
        const lo = portico.center - portico.width * 0.5,
          hi = portico.center + portico.width * 0.5;
        bays(out, main, start, lo, detail);
        bays(out, main, lo, hi, detail, true);
        start = hi;
      }
      bays(out, main, start, f.length, detail);
      courses(out, main, f.length, detail);
    } else if (f.length > 7 && detail > 1) {
      bays(out, f, 0, f.length, 1);
      courses(out, f, f.length, detail);
    } else {
      panel(out, 'wall', f, 0, f.length, foundation, eave, 0, stone);
    }
  }
}
function hip(out, a, b, d, D, y, Y) {
  const h = Math.min((b - a) * 0.295, (D - d) * 0.39),
    ridge = (D + d) * 0.5;
  const p = main.P;
  quad4(out, 'roof', p(a, y, D), p(b, y, D), p(b - h, Y, ridge), p(a + h, Y, ridge), roof);
  quad4(out, 'roof', p(b, y, d), p(a, y, d), p(a + h, Y, ridge), p(b - h, Y, ridge), roof);
  tri(out, 'roof', p(a, y, d), p(a, y, D), p(a + h, Y, ridge), roof);
  tri(out, 'roof', p(b, y, D), p(b, y, d), p(b - h, Y, ridge), roof);
}
function roofline(out, detail) {
  hip(out, -0.37, site.facade.length + 0.37, -18.8, 0.37, eave, 15.92);
  hip(out, 79.2, 112.4, -32.15, -12.5, eave, 15.35);
  hip(out, 112.65, site.facade.length + 0.14, -43.28, -16.65, eave, 16.76);
  if (detail > 0) {
    fbox(out, 'roof', main, 79.8, 96.82, 14.16, 16.88, -12.6, -6.65, seam);
    const n = detail === 1 ? 4 : 10;
    for (let i = 0; i < n; i++) {
      const a = 80.14 + (i * 16.32) / n,
        b = 80.14 + ((i + 1) * 16.32) / n;
      panel(out, 'glass', main, a + 0.085, b - 0.085, 15.08, 16.29, -6.64, tint);
    }
  }
}
function column(out, u, d, y, Y, r, detail) {
  const [x, , z] = main.P(u, 0, d),
    n = [8, 10, 14, 18][detail];
  if (detail === 0) {
    lathe(
      out,
      'trim',
      [x, z],
      [
        [y, r, r],
        [Y, r * 0.86, r * 0.86],
      ],
      6,
      white,
      { capTop: true },
    );
    return;
  }
  lathe(
    out,
    'trim',
    [x, z],
    [
      [y, r * 1.26, r * 1.26],
      [y + 0.18, r * 1.26, r * 1.26],
      [y + 0.38, r, r],
      [Y - 0.46, r * 0.86, r * 0.86],
      [Y - 0.26, r * 1.07, r * 1.07],
      [Y, r * 1.11, r * 1.11],
    ],
    n,
    white,
    { capTop: true },
  );
}
function lionPair(out, center, d, y, detail) {
  const n = detail === 3 ? 10 : 8,
    bands = detail === 3 ? 6 : 4;
  for (const side of [-1, 1]) {
    sphere(
      out,
      'trim',
      main.P(center + side * 2.63, y + 0.48, d),
      [0.39, 0.53, 1.32],
      cream,
      n,
      bands,
    );
    sphere(
      out,
      'trim',
      main.P(center + side * 1.58, y + 0.66, d + 0.12),
      [0.48, 0.65, 0.52],
      white,
      n,
      bands,
    );
    sphere(
      out,
      'trim',
      main.P(center + side * 1.18, y + 0.73, d + 0.23),
      [0.26, 0.28, 0.24],
      cream,
      n,
      bands,
    );
  }
  fbox(out, 'trim', main, center - 0.64, center + 0.64, y, y + 1.11, d - 0.19, d + 0.18, white);
}
function entrance(out, { center, width, projection, grade, kind }, detail) {
  const a = center - width * 0.5,
    b = center + width * 0.5;
  const stepCount = Math.max(1, Math.ceil((floor - grade) / 0.25));
  const stairs = detail === 0 ? 3 : stepCount;
  for (let i = 0; i < stairs; i++) {
    const t = (i + 1) / stairs;
    fbox(
      out,
      'stair',
      main,
      a - 0.32,
      b + 0.32,
      grade - 0.97,
      grade + (floor - grade) * t,
      -0.12,
      projection + 1.43 - 1.29 * t,
      kind === 'lions' ? bronze : slate,
    );
  }
  for (const offset of [-0.405, -0.133, 0.133, 0.405])
    column(out, center + offset * width, projection - 0.21, floor, eave - 0.54, 0.465, detail);
  fbox(
    out,
    'trim',
    main,
    a - 0.08,
    b + 0.08,
    eave - 0.6,
    eave + 0.13,
    -0.06,
    projection + 0.32,
    white,
    { bottom: true },
  );
  hip(out, a - 0.12, b + 0.12, -0.25, projection + 0.35, eave + 0.13, eave + 2.86);
  if (detail > 0) lionPair(out, center, projection + 0.08, eave + 0.14, detail);
}
function bowedPorch(out, detail) {
  const { center, width, projection, grade } = site.curved,
    n = [6, 9, 12, 16][detail],
    y = 7.29;
  const plan = Array.from({ length: n + 1 }, (_, i) => {
    const t = (Math.PI * i) / n,
      [x, , z] = main.P(center - width * 0.5 * Math.cos(t), 0, projection * Math.sin(t));
    return [x, z];
  });
  const ring = outwardRing(plan);
  for (const [i, a] of ring.entries()) {
    const f = wallFace(a, ring[(i + 1) % ring.length]);
    panel(out, 'trim', f, 0, f.length, y, y + 0.44, 0, white);
    panel(out, 'stair', f, 0, f.length, foundation, grade + 0.58, 0, slate);
  }
  cap(out, 'trim', ring, y + 0.44, cream);
  cap(out, 'stair', ring, grade + 0.58, slate);
  for (const t of [0.16, 0.39, 0.61, 0.84]) {
    const u = center - width * 0.5 * Math.cos(t * Math.PI);
    column(out, u, projection * Math.sin(t * Math.PI) - 0.24, grade + 0.58, y, 0.21, detail);
  }
}
function build(out, detail) {
  walls(out, detail);
  roofline(out, detail);
  for (const porch of site.porticoes) entrance(out, porch, detail);
  bowedPorch(out, detail);
}

export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = buildCloseup;
