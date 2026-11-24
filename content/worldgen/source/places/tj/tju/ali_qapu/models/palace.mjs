import {
  beamPath,
  loft,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  fbox,
  opening,
  pointedArch,
  quad4,
  rgb,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import site from '../site-controls.json' with { type: 'json' };

export const surfaces = {
  brick: { slot: 'wall', graph: 'brick_longformat', roughness: 0.91 },
  stone: { slot: 'foundation', graph: 'stone_ashlar', roughness: 0.94 },
  tile: { slot: 'trim', graph: 'tile_mosaic', roughness: 0.76 },
  wood: { slot: 'trim', graph: 'wood_vertical', roughness: 0.88 },
  lime: { slot: 'roof', graph: 'plaster_lime', roughness: 0.93 },
};
const buff = rgb('baa383');
const ochre = rgb('b28d62');
const pale = rgb('d1ba92');
const blue = rgb('536c9d');
const cyan = rgb('68958e');
const roof = rgb('6f624a');
const dark = rgb('534337');
const timber = rgb('947253');
const paint = rgb('9a694b');
const facade = wallFace(...site.mainFront);
const depth = Math.hypot(
  site.outline[2][0] - site.outline[1][0],
  site.outline[2][1] - site.outline[1][1],
);
const width = facade.length;
const center = width / 2;
const P = facade.P;
const slab = (out, slot, a, b, y0, y1, back, front, color, bottom = false) =>
  fbox(out, slot, facade, a, b, y0, y1, back, front, color, { bottom });
const side = (a, b) => wallFace(a, b);
const xz = (u, d) => {
  const [x, , z] = P(u, 0, d);
  return [x, z];
};

function gate(out, detail) {
  const half = 2.72;
  const sill = site.frontGrade;
  const spring = 3.63;
  const arch = pointedArch(half, site.westGateRise - spring, [4, 7, 10, 14][detail]);
  // The two stone shoulders carry the palace above an axial passage at street level.
  slab(out, 'stone', 0, center - half, -4.3, sill, -depth, 0, pale);
  slab(out, 'stone', center + half, width, -4.3, sill, -depth, 0, pale);
  slab(out, 'stone', center - half, center + half, -4.3, sill, -depth, 0, buff);
  slab(out, 'brick', 0, center - half, sill, 12.15, -depth, 0, buff);
  slab(out, 'brick', center + half, width, sill, 12.15, -depth, 0, buff);
  slab(out, 'brick', center - half, center + half, site.westGateRise, 12.15, -depth, 0, buff);
  for (let i = 0; i < arch.length - 1; i++) {
    const [a, h] = arch[i],
      [b, k] = arch[i + 1];
    const x = center + a,
      q = center + b,
      y = spring + h,
      yy = spring + k;
    if (y < site.westGateRise - 1e-4 && yy < site.westGateRise - 1e-4) {
      quad4(
        out,
        'brick',
        P(x, y, 0),
        P(q, yy, 0),
        P(q, site.westGateRise, 0),
        P(x, site.westGateRise, 0),
        ochre,
      );
      quad4(
        out,
        'brick',
        P(q, yy, -depth),
        P(x, y, -depth),
        P(x, site.westGateRise, -depth),
        P(q, site.westGateRise, -depth),
        buff,
      );
    } else {
      const p = [P(x, y, 0), P(q, yy, 0), P(q, site.westGateRise, 0), P(x, site.westGateRise, 0)];
      const v = y < yy ? [p[0], p[1], p[3]] : [p[0], p[1], p[2]];
      tri(out, 'brick', ...v, ochre);
      tri(
        out,
        'brick',
        ...v
          .map(([x, y, z]) => [x - facade.normal[0] * depth, y, z - facade.normal[1] * depth])
          .reverse(),
        buff,
      );
    }
    quad4(out, 'brick', P(x, y, -depth), P(q, yy, -depth), P(q, yy, 0), P(x, y, 0), ochre);
    if (detail > 0) {
      const frontPoints = [
        P(x, y, 0.045),
        P(q, yy, 0.045),
        P(q + b * 0.17, yy + 0.32, 0.045),
        P(x + a * 0.17, y + 0.32, 0.045),
      ];
      quad4(out, 'tile', ...frontPoints, i % 2 === 0 ? blue : cyan);
      const rearPoints = [
        P(q, yy, -depth - 0.049),
        P(x, y, -depth - 0.049),
        P(x + a * 0.16, y + 0.27, -depth - 0.049),
        P(q + b * 0.16, yy + 0.27, -depth - 0.049),
      ];
      quad4(out, 'tile', ...rearPoints, i % 2 === 0 ? blue : cyan);
    }
  }
  if (detail > 0) {
    for (const s of [-1, 1])
      slab(
        out,
        'stone',
        center + s * half - 0.14,
        center + s * half + 0.14,
        sill,
        spring,
        -0.045,
        0.24,
        pale,
      );
    slab(out, 'tile', center - 3.43, center + 3.43, 7.03, 7.8, 0, 0.091, blue);
  }
}

function windowRow(out, f, y, height, detail, spots) {
  for (const [fraction, span] of spots) {
    const u = fraction * f.length;
    if (detail < 2) {
      const l = u - span / 2;
      const r = u + span / 2;
      const spring = y + height - span * 0.46;
      const p = (x, h) => f.P(x, h, 0.066);
      quad4(out, 'wood', p(l, y), p(r, y), p(r, spring), p(l, spring), dark);
      tri(out, 'wood', p(l, spring), p(r, spring), p(u, y + height), dark);
      continue;
    }
    if (detail > 0)
      fbox(
        out,
        'tile',
        f,
        u - span * 0.68,
        u + span * 0.68,
        y + height * 0.71,
        y + height + 0.3,
        0,
        0.061,
        blue,
      );
    opening(out, f, u, y, span, height, {
      head: 'pointed',
      rise: span * 0.46,
      glassSlot: 'wood',
      frameSlot: 'stone',
      glass: dark,
      frame: pale,
      frameWidth: detail < 2 ? 0.095 : 0.155,
      frameDepth: 0.125,
      d: 0.066,
      sill: detail > 0,
      mullions: detail > 1 ? 2 : 0,
      transoms: detail > 1 ? 1 : 0,
    });
  }
}

function timberPost(out, u, d, detail) {
  const [x, z] = xz(u, d);
  const n = [4, 7, 10, 12][detail];
  const ring = (y, r) => radialRing(y, r, r, n, [x, z]);
  const y = site.balconyGrade;
  if (detail < 2) {
    loft(out, 'wood', [ring(y, 0.245), ring(23.64, 0.21)], timber);
    return;
  }
  if (detail > 0)
    loft(out, 'stone', [ring(y, 0.42), ring(y + 0.23, 0.42), ring(y + 0.39, 0.27)], pale);
  loft(
    out,
    'wood',
    [
      ring(y + (detail > 0 ? 0.35 : 0), 0.245),
      ring(22.79, 0.188),
      ring(23.11, 0.26),
      ring(23.34, 0.42),
      ring(23.63, 0.5),
    ],
    timber,
  );
  if (detail > 1) {
    slab(out, 'wood', u - 0.61, u + 0.61, 23.49, 23.79, d - 0.41, d + 0.41, paint, true);
    for (const sign of [-1, 1])
      beamPath(
        out,
        'wood',
        [P(u + sign * 0.225, 22.96, d), P(u + sign * 0.58, 23.48, d)],
        0.17,
        0.15,
        timber,
      );
  }
}

function loggia(out, detail) {
  const y = site.balconyGrade;
  slab(out, 'stone', -0.21, width + 0.21, 12.1, y, -depth, 0.25, pale);
  slab(out, 'tile', -0.088, width + 0.088, 12.13, 12.48, -0.02, 0.29, cyan);
  if (detail > 0) {
    slab(out, 'wood', 0.29, width - 0.29, y + 0.83, y + 0.97, 0.215, 0.33, timber);
    slab(out, 'wood', 0.29, width - 0.29, y + 0.04, y + 0.17, 0.215, 0.33, timber);
    for (let i = 0; i <= (detail === 3 ? 52 : 26); i++) {
      const u = 0.38 + (i * (width - 0.76)) / (detail === 3 ? 52 : 26);
      slab(out, 'wood', u - 0.037, u + 0.037, y + 0.17, y + 0.84, 0.24, 0.306, timber);
    }
  }
  for (const d of [-0.41, -3.26, -6.06])
    for (let i = 0; i < 6; i++) timberPost(out, 1.06 + (i * (width - 2.12)) / 5, d, detail);
  slab(out, 'wood', -0.76, width + 0.76, 23.64, 24.22, -8.4, 1.02, timber, true);
  slab(out, 'wood', -0.98, width + 0.98, 24.14, 24.5, -8.4, 1.17, roof);
  slab(out, 'lime', -0.56, width + 0.56, 24.5, 24.69, -8.19, 0.76, roof);
  if (detail > 0) {
    const spans = detail > 2 ? 34 : 17;
    for (let i = 0; i <= spans; i++) {
      const u = -0.49 + ((width + 0.98) * i) / spans;
      slab(out, 'wood', u - 0.077, u + 0.077, 23.56, 23.75, -7.64, 0.9, pale, true);
    }
  }
  if (detail > 1)
    for (let i = 0; i < 6; i++) {
      const u = ((i + 0.5) * width) / 6;
      const points = [
        [u - 1.62, -3.59],
        [u, -5.09],
        [u + 1.62, -3.59],
        [u, -2.09],
      ].map(([x, d]) => P(x, 23.607, d));
      beamPath(out, 'wood', points, 0.09, 0.055, paint, true);
    }
}

function build(out, detail) {
  gate(out, detail);
  const setback = -7.1;
  const back = -depth;
  slab(out, 'brick', 0, width, 12.138, site.roofHeight - 0.46, back, setback, buff);
  slab(
    out,
    'tile',
    -0.04,
    width + 0.04,
    site.roofHeight - 0.48,
    site.roofHeight - 0.19,
    back - 0.07,
    setback + 0.07,
    cyan,
  );
  slab(
    out,
    'brick',
    -0.13,
    width + 0.13,
    site.roofHeight - 0.18,
    site.roofHeight,
    back - 0.15,
    setback + 0.16,
    pale,
  );
  loggia(out, detail);
  const front = side(xz(0, setback), xz(width, setback));
  const rear = side(xz(width, back), xz(0, back));
  const spots = [
    [0.135, 1.52],
    [0.3, 1.63],
    [0.5, 4.12],
    [0.7, 1.63],
    [0.865, 1.52],
  ];
  windowRow(
    out,
    facade,
    2.02,
    3.7,
    detail,
    spots.filter((_, i) => i !== 2),
  );
  windowRow(out, facade, 8.27, 2.85, detail, spots);
  windowRow(out, front, 13.3, 8.8, detail, [
    [0.17, 1.9],
    [0.32, 1.9],
    [0.5, 5.9],
    [0.68, 1.9],
    [0.83, 1.9],
  ]);
  windowRow(out, front, 26.5, 4.9, detail, spots);
  for (const [y, h] of [
    [7.65, 3.85],
    [13.32, 4.57],
    [19.28, 4.98],
    [25.6, 5.71],
  ])
    windowRow(out, rear, y, h, detail, spots);
  for (const f of [side(xz(0, back), xz(0, setback)), side(xz(width, setback), xz(width, back))]) {
    for (const y of [14.01, 20.04, 26.87])
      windowRow(out, f, y, 3.92, detail, [
        [0.21, 1.46],
        [0.5, 1.75],
        [0.79, 1.46],
      ]);
  }
  if (detail > 1) {
    for (const f of [front, rear]) {
      fbox(out, 'tile', f, 1.14, width - 1.14, 31.76, 32.14, 0.008, 0.108, blue);
      for (let i = 0; i < 28; i++) {
        const u = 1.31 + (i * (width - 2.62)) / 27;
        const points = [
          [u - 0.24, 31.96],
          [u, 32.16],
          [u + 0.24, 31.96],
          [u, 31.76],
        ].map(([a, y]) => f.P(a, y, 0.114));
        beamPath(out, 'stone', points, 0.048, 0.036, pale, true);
      }
    }
  }
}

export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = buildCloseup;
