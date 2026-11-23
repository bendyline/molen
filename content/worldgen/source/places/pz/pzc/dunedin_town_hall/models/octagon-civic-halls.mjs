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
  stone: { slot: 'wall', graph: 'stone_limestone', roughness: 0.94 },
  base: { slot: 'foundation', graph: 'stone_basalt', roughness: 0.97 },
  carved: { slot: 'trim', graph: 'stone_sandstone', roughness: 0.94 },
  slate: { slot: 'roof', graph: 'slate', roughness: 0.91 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.82 },
  glazing: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.49 },
};
const stone = rgb('c6b596'),
  pale = rgb('d6c7ae'),
  ash = rgb('989084'),
  dark = rgb('7c7061');
const shadow = rgb('645e52'),
  roof = rgb('6c7276'),
  glass = rgb('616766'),
  iron = rgb('55564e');
const datum = site.foundationBottom,
  y0 = site.entranceHeight;
const frame = facade(site.frame.origin, site.frame.along),
  f = facade([0, 0], [1, 0]);
const width = 39.605144;
const part = (id) => site.parts.find((p) => p.id === id).outline;

function face(out, slot, F, a, b, lo, hi, d, color) {
  const p = F.P;
  quad4(out, slot, p(a, lo, d), p(b, lo, d), p(b, hi, d), p(a, hi, d), color);
}

function window(out, detail, F, u, y, w, h, arch) {
  if (detail < 2) {
    if (detail > 0)
      face(out, 'carved', F, u - w * 0.55, u + w * 0.55, y - 0.1, y + h + 0.1, 0.025, pale);
    face(out, 'glazing', F, u - w / 2, u + w / 2, y, y + h, 0.057, glass);
    return;
  }
  opening(out, F, u, y, w, h, {
    head: arch ? 'round' : 'flat',
    glassSlot: 'glazing',
    frameSlot: 'carved',
    glass,
    frame: pale,
    frameWidth: 0.103,
    frameDepth: 0.135,
    d: 0.056,
    mullions: detail > 2 ? 1 : 0,
    transoms: detail > 2 ? 2 : 0,
    mullionColor: ash,
  });
}

function boxAt(out, slot, u, d, r, s, lo, hi, color) {
  fbox(out, slot, f, u - r, u + r, lo, hi, d - s, d + s, color);
}

function building(out, detail, ring, h, chambers) {
  const r = outwardRing(ring),
    floor = chambers ? 2.44 : 1.98;
  for (const [i, a] of r.entries()) {
    const b = r[(i + 1) % r.length];
    if (chambers && Math.abs(a[1]) < 0.011 && Math.abs(b[1]) < 0.011) continue;
    const F = wallFace(a, b),
      L = F.length;
    if (L < 0.031) continue;
    face(out, 'base', F, 0, L, datum, floor, 0, ash);
    face(out, 'stone', F, 0, L, floor, h, 0, i % 3 === 1 ? pale : stone);
    if (detail === 0) continue;
    for (const [y, w] of [
      [floor - 0.19, 0.27],
      [7.13, 0.19],
      [h - 0.56, 0.25],
      [h - 0.2, 0.2],
    ])
      face(out, 'carved', F, 0, L, y, y + w, 0.023, pale);
    const n = Math.max(1, Math.round(L / [6, 6.92, 5.09, 4.23][detail]));
    if (L < 2.4) continue;
    for (let j = 0; j < n; j++) {
      const u = ((j + 0.5) * L) / n;
      window(out, detail, F, u, floor + 0.77, Math.min((L / n) * 0.57, 1.57), 2.85, !chambers);
      if (chambers || L > 21)
        window(out, detail, F, u, 7.92, Math.min((L / n) * 0.52, 1.51), 2.47, chambers);
    }
  }
  cap(out, 'slate', r, h, roof);
}

function corinthian(out, detail, u, d, y, h) {
  const n = [4, 5, 8, 11][detail];
  const steps =
    detail < 2
      ? [
          [y, 0.32],
          [h, 0.26],
        ]
      : [
          [y, 0.46],
          [y + 0.21, 0.46],
          [y + 0.34, 0.3],
          [h - 0.37, 0.25],
          [h - 0.21, 0.42],
          [h, 0.44],
        ];
  loft(
    out,
    'carved',
    steps.map(([y, r]) => radialRing(y, r, r, n, [u, d], 0.55)),
    pale,
    { cap: false },
  );
  if (detail > 1) boxAt(out, 'carved', u, d, 0.49, 0.47, h - 0.143, h + 0.087, stone);
}

function octagonSide(out, detail) {
  const p = f.P,
    [x] = site.towerCenter;
  const a = x - 1.68,
    b = x + 1.68;
  face(out, 'base', f, 0, width, datum, y0, 0, ash);
  face(out, 'stone', f, 0, a, y0, 6.08, 0, stone);
  face(out, 'stone', f, b, width, y0, 6.08, 0, stone);
  face(out, 'stone', f, 0, width, 6.08, 12, 0, stone);
  face(out, 'glazing', f, a, b, y0, 6.08, -0.94, shadow);
  quad4(out, 'carved', p(a, y0, -0.94), p(a, y0, 0), p(a, 6.08, 0), p(a, 6.08, -0.94), dark);
  quad4(out, 'carved', p(b, y0, 0), p(b, y0, -0.94), p(b, 6.08, -0.94), p(b, 6.08, 0), dark);
  quad4(out, 'carved', p(b, 6.08, -0.94), p(a, 6.08, -0.94), p(a, 6.08, 0), p(b, 6.08, 0), ash);
  for (const [y, h, d] of [
    [2.21, 0.18, 0.17],
    [6.13, 0.36, 0.35],
    [11.64, 0.36, 0.39],
    [12.0, 0.28, 0.26],
  ])
    fbox(out, 'carved', f, 0, width, y, y + h, -0.14, d, pale);
  for (const u of [1.03, 6.1, 11.16, 16.98, 20.48, 24.46, 29.61, 34.71, 38.65])
    corinthian(out, detail, u, 0.37, y0 + 0.16, 11.38);
  for (const u of [3.46, 8.63, 14.07, 18.61, 26.82, 31.99, 36.58]) {
    window(out, detail, f, u, y0 + 0.72, 1.96, 2.89, false);
    window(out, detail, f, u, 7.04, 2.12, 3.11, true);
    if (detail > 1) {
      tri(
        out,
        'carved',
        p(u - 1.225, 5.48, 0.15),
        p(u + 1.225, 5.48, 0.15),
        p(u, 5.96, 0.19),
        pale,
      );
      for (const x of [u - 1.14, u + 1.14])
        fbox(out, 'carved', f, x - 0.058, x + 0.058, y0 + 0.82, 5.53, -0.04, 0.12, pale);
    }
  }
  const n = [3, 6, 9, 12][detail],
    half = 4.66,
    depth = 4.14;
  for (let i = 0; i < n; i++) {
    const a = (depth * i) / n,
      b = (depth * (i + 1)) / n;
    fbox(
      out,
      'base',
      f,
      x - half,
      x + half,
      datum - 0.015,
      y0 - (i / n) * (y0 - 0.09),
      a,
      b,
      i % 2 === 0 ? ash : dark,
    );
  }
  for (const s of [-1, 1]) {
    const u = x + s * half;
    const p0 = p(u, 0.43, depth),
      p1 = p(u, y0 + 0.82, 0.12);
    beam(out, 'carved', p0, p1, 0.22, 0.25, pale);
    if (detail > 0)
      for (let i = 0; i <= 3; i++) {
        const t = i / 3,
          h = p0[1] + (p1[1] - p0[1]) * t,
          L = depth - (depth - 0.12) * t;
        fbox(out, 'carved', f, u - 0.14, u + 0.14, h - 0.91, h, L - 0.19, L + 0.12, pale);
      }
  }
}

function pavilion(out, detail, outline) {
  const outlineRing = outwardRing(outline);
  const eave = 15;
  const [u, d] = outlineRing.reduce(
    ([x, z], [a, b]) => [x + a / outlineRing.length, z + b / outlineRing.length],
    [0, 0],
  );
  const ring = (y, scale) =>
    outlineRing.map(([x, z]) => [u + (x - u) * scale, y, d + (z - d) * scale]);
  loft(out, 'stone', [ring(11.98, 1), ring(eave, 1)], stone, { cap: false });
  loft(out, 'carved', [ring(eave - 0.22, 1.027), ring(eave + 0.11, 1.027)], pale, {
    cap: false,
  });
  loft(out, 'slate', [ring(eave + 0.11, 1.017), ring(17.08, 0.57), ring(18, 0.077)], roof, {
    cap: false,
  });
  cap(out, 'slate', ring(18, 0.077).map(([x, , z]) => [x, z]), 18, roof);
  if (detail > 0) {
    for (const [i, a] of outlineRing.entries()) {
      const F = wallFace(a, outlineRing[(i + 1) % outlineRing.length]);
      if (F.length > 2.72 && F.normal[1] > 0.8)
        window(out, detail, F, F.length / 2, 12.92, 1.34, 1.59, true);
    }
  }
}

function clockTower(out, detail) {
  const [x, z] = site.towerCenter,
    lower = 13.0,
    bell = 25.72,
    capY = 31.32;
  const shape = outwardRing(part(427585182));
  const towerBase = outwardRing(part(427579588));
  loft(out, 'stone', [11.5, 21].map(y => towerBase.map(([x, z]) => [x, y, z])), stone, {
    cap: false,
  });
  for (const [i, a] of shape.entries()) {
    const F = wallFace(a, shape[(i + 1) % shape.length]),
      L = F.length,
      mid = L / 2;
    face(out, 'stone', F, 0, L, lower, bell, 0, stone);
    for (const [y, h] of [
      [13.18, 0.3],
      [17.24, 0.29],
      [21.09, 0.24],
      [25.35, 0.44],
      [30.57, 0.68],
    ]) {
      if (detail === 0) face(out, 'carved', F, 0, L, y, y + h, 0.11, pale);
      else fbox(out, 'carved', F, -0.21, L + 0.21, y, y + h, -0.19, 0.26, pale);
    }
    for (const u of [0.31, L - 0.31])
      fbox(out, 'carved', F, u - 0.31, u + 0.31, bell, capY - 0.21, -0.35, 0.26, pale);
    const r = 1.67,
      center = mid,
      p = F.P,
      spring = 28.03;
    face(out, 'stone', F, 0, mid - r, bell, capY, 0, stone);
    face(out, 'stone', F, mid + r, L, bell, capY, 0, stone);
    const arc = roundArch(r, [3, 5, 8, 11][detail]);
    for (let k = 1; k < arc.length; k++) {
      const [a, y] = arc[k - 1],
        [b, h] = arc[k];
      quad4(
        out,
        'stone',
        p(center + a, spring + y, 0),
        p(center + b, spring + h, 0),
        p(center + b, capY, 0),
        p(center + a, capY, 0),
        pale,
      );
      if (detail > 1)
        quad4(
          out,
          'carved',
          p(center + a, spring + y, -0.48),
          p(center + b, spring + h, -0.48),
          p(center + b, spring + h, 0),
          p(center + a, spring + y, 0),
          shadow,
        );
    }
    if (detail === 0)
      fan(
        out,
        'glazing',
        Array.from({ length: 8 }, (_, i) =>
          p(
            mid + 1.09 * Math.cos((i * Math.PI) / 4),
            22.6 + 1.09 * Math.sin((i * Math.PI) / 4),
            0.1,
          ),
        ),
        pale,
      );
    else clock(out, F, mid, 22.6, 1.03, detail, 0.12);
  }
  cap(out, 'carved', shape, capY, pale);
  const n = [8, 12, 17, 23][detail];
  const bands = [
    [capY, 2.54],
    [32.62, 2.45],
    [33.69, 1.92],
    [34.51, 1.24],
    [35.18, 0.56],
    [35.37, 0.39],
  ];
  loft(
    out,
    'slate',
    bands.map(([y, r]) => radialRing(y, r, r, n, [x, z])),
    roof,
  );
  boxAt(out, 'carved', x, z, 0.59, 0.59, 35.26, 35.94, stone);
  beam(out, 'metal', [x, 35.92, z], [x, site.clockTip, z], 0.078, 0.078, iron);
}

function build(out, detail) {
  const o = deform(out, ([u, y, d]) => frame.P(u, y, d));
  building(o, detail, site.chambers, site.chambersHeight, true);
  building(o, detail, site.concert, site.concertHeight - 3, false);
  gableRoof(o, 'slate', [20.42, -91.0], [20.42, -37.2], 37.89, 13, 16, roof, {
    overhang: 0.1,
    endSlot: 'stone',
    endColor: stone,
  });
  octagonSide(o, detail);
  for (const id of [427558497, 427558498, 427583634, 427583635]) pavilion(o, detail, part(id));
  if (detail > 0) {
    for (const id of site.frontPilasters) {
      const r = outwardRing(part(id));
      loft(o, 'carved', [y0, 11].map(y => r.map(([x, z]) => [x, y, z])), pale, {
        cap: false,
      });
    }
  }
  clockTower(o, detail);
}
export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = buildCloseup;
