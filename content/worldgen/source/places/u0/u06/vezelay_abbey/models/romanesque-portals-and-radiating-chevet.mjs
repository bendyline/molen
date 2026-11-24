import { beamPath } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { withFootprintCaps } from '../../../../../../../../packages/worldgen/scripts/place-footprint-caps.mjs';
import {
  extrude,
  facade,
  fan,
  fbox,
  gableRoof,
  lathe,
  opening,
  outwardRing,
  pointedArch,
  quad4,
  rgb,
  roundArch,
  spire,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import site from '../site-controls.json' with { type: 'json' };

export const surfaces = {
  masonry: { slot: 'wall', graph: 'stone_limestone', roughness: 0.96 },
  carved: { slot: 'trim', graph: 'stone_limestone_weathered', roughness: 0.92 },
  tiles: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.96 },
  dark: { slot: 'trim', graph: 'metal_painted', roughness: 0.77 },
  wood: { slot: 'door', graph: 'wood_vertical', roughness: 0.95 },
  paving: { slot: 'foundation', graph: 'stone_ashlar', roughness: 0.96 },
};

const F = facade(site.frame.origin, site.frame.along),
  P = F.P;
const xz = ([x, , z]) => [x, z];
const stone = rgb('afaa94'),
  weathered = rgb('aaa08c'),
  pale = rgb('c3b9a0'),
  light = rgb('c1b6a1');
const tile = rgb('9e6b56'),
  red = rgb('975f4e'),
  gray = rgb('747b73'),
  glass = rgb('575666'),
  wood = rgb('796653');
const box = (o, s, u, U, y, Y, d, D, c) => fbox(o, s, F, u, U, y, Y, d, D, c);
const faces = (ring) => outwardRing(ring).map((p, i, r) => wallFace(p, r[(i + 1) % r.length]));
const local = ([x, z]) => [
  (x - F.origin[0]) * F.along[0] + (z - F.origin[1]) * F.along[1],
  (x - F.origin[0]) * F.normal[0] + (z - F.origin[1]) * F.normal[1],
];
const palette = [stone, weathered, light];

function reduceRing(ring, stride) {
  let points = [];
  for (const p of ring) {
    if (!points.length || Math.hypot(p[0] - points.at(-1)[0], p[1] - points.at(-1)[1]) >= stride)
      points.push(p);
  }
  return points.length >= 3 ? points : ring;
}

function shell(out, parts, bottom, eave, detail, roof = tile) {
  for (const [ring, ...holes] of parts) {
    const r = detail === 0 ? reduceRing(ring, 3.1) : ring;
    extrude(out, 'masonry', r, bottom, eave, stone, { holes, topSlot: 'tiles', topColor: roof });
  }
}

function roof(out, u, a, b, width, y, top, color = tile) {
  gableRoof(out, 'tiles', xz(P(u, 0, a)), xz(P(u, 0, b)), width, y, top, color, {
    overhang: 0.18,
    endSlot: 'masonry',
    endColor: stone,
  });
}

function roofAisles(out, u, U, a, b, y, Y) {
  const panel = [P(u, y, a), P(u, y, b), P(U, Y, b), P(U, Y, a)];
  if ((U - u) * (b - a) < 0) panel.reverse();
  quad4(out, 'tiles', ...panel, red);
}

function aperture(out, f, u, y, w, h, d, detail, { isPointed = false } = {}) {
  if (detail > 1) {
    const face = facade(xz(f.P(0, 0, d)), f.along);
    opening(out, face, u, y, w, h, {
      head: isPointed ? 'pointed' : 'round',
      glassSlot: 'dark',
      frameSlot: 'carved',
      frame: pale,
      glass,
      frameWidth: 0.145,
      frameDepth: 0.13,
      mullions: detail > 2 ? 1 : 0,
      transoms: detail > 2 ? 2 : 0,
    });
    return;
  }
  const spring = y + h - w * 0.48;
  const polygon = [
    f.P(u - w * 0.5, y, d),
    f.P(u + w * 0.5, y, d),
    f.P(u + w * 0.5, spring, d),
    f.P(u, spring + w * 0.48, d),
    f.P(u - w * 0.5, spring, d),
  ];
  fan(out, 'dark', polygon, glass);
}

function approach(out, detail) {
  const num = [2, 4, 7, 9][detail];
  for (let i = 0; i < num; i++) {
    const a = (i + 1) / num;
    box(out, 'paving', -13.67, 13.89, -1.65, 1.19 * a, -1.5, 4.18 - (3.84 * i) / num, weathered);
  }
  box(out, 'paving', -13.69, 13.88, -1.42, 1.19, -2.24, 0.41, weathered);
}

function portal(out, x, half, spring, detail) {
  const top = 13.6,
    depth = -2.22;
  const center = Math.abs(x) < 1,
    front = 0.13;
  const head = roundArch(half, [5, 8, 12, 18][detail]);
  for (let i = 0; i < head.length - 1; i++) {
    const [u, h] = head[i],
      [U, H] = head[i + 1];
    const a = P(x + u, spring + h, front),
      b = P(x + U, spring + H, front);
    quad4(
      out,
      'masonry',
      a,
      b,
      P(x + U, top, front),
      P(x + u, top, front),
      palette[Math.floor(i / 4) % 3],
    );
    quad4(out, 'carved', P(x + u, spring + h, depth), P(x + U, spring + H, depth), b, a, weathered);
    if (detail > 0) {
      const rings = center ? [0.12, 0.28, 0.49] : [0.15, 0.35];
      for (const [j, r] of rings.entries()) {
        const ratio = 1 + (r + 0.09) / half;
        const A = P(x + u * ratio, spring + h * ratio, front + 0.15 - 0.036 * j);
        const B = P(x + U * ratio, spring + H * ratio, front + 0.15 - 0.036 * j);
        const q = (a, b) =>
          P(
            x + a * (ratio - 0.08 / half),
            spring + b * (ratio - 0.08 / half),
            front + 0.21 - 0.036 * j,
          );
        quad4(out, 'carved', q(u, h), q(U, H), B, A, j === 1 ? light : pale);
      }
    }
  }
  box(out, 'wood', x - half + 0.31, x + half - 0.31, 1.2, spring + 0.4, -2.29, -2.16, wood);
  if (detail > 0) {
    const panel = roundArch(half - 0.13, detail > 1 ? 12 : 7).map(([u, y]) =>
      P(x + u, spring + y - 0.06, depth + 0.13),
    );
    fan(out, 'carved', panel, pale);
    for (const s of [-1, 1]) {
      box(
        out,
        'carved',
        x + s * (half - 0.1) - 0.11,
        x + s * (half - 0.1) + 0.11,
        1.2,
        spring + 0.11,
        -1.46,
        0.04,
        light,
      );
      box(
        out,
        'carved',
        x + s * (half + 0.15) - 0.12,
        x + s * (half + 0.15) + 0.12,
        1.13,
        spring - 0.07,
        -1.28,
        0.25,
        pale,
      );
    }
    if (center) {
      box(out, 'carved', x - 0.21, x + 0.21, 1.19, spring + 0.17, -1.69, -1.39, light);
      if (detail > 1) {
        lathe(
          out,
          'carved',
          xz(P(x, 0, depth + 0.3)),
          [
            [spring + 0.14, 0.49, 0.18],
            [spring + 0.83, 0.36, 0.18],
            [spring + 1.49, 0.27, 0.16],
            [spring + 1.89, 0.16, 0.13],
          ],
          8,
          light,
        );
        for (const s of [-1, 1])
          for (let j = 0; j < 4; j++)
            box(
              out,
              'carved',
              x + s * (1.02 + j * 0.63) - 0.11,
              x + s * (1.02 + j * 0.63) + 0.11,
              spring + 0.07,
              spring + 1.02 - 0.15 * j,
              depth + 0.08,
              depth + 0.19,
              pale,
            );
      }
    }
  }
}

function westFront(out, detail) {
  const p = [
    [-9.53, 2.68, 4.88],
    [0.24, 4.51, 6.33],
    [9.38, 2.62, 5.1],
  ];
  const splits = [-13.64, ...p.flatMap(([u, r]) => [u - r, u + r]), 13.95];
  for (let i = 0; i < splits.length - 1; i += 2)
    box(out, 'masonry', splits[i], splits[i + 1], -0.85, 13.6, -2.32, 0.13, stone);
  for (const [u, r, y] of p) portal(out, u, r, y, detail);
  box(out, 'masonry', -13.56, 13.94, 13.54, 22.2, -9.24, 0.06, stone);
  box(out, 'masonry', -13.91, -7.48, 20.82, 25.3, -10.44, -0.17, stone);
  const north = xz(P(-10.66, 0, -5.28));
  spire(out, 'tiles', north, 4.66, 4, 25.29, 4.18, tile, {
    rotation: Math.atan2(F.along[1], F.along[0]) + Math.PI * 0.25,
  });
  const peak = pointedArch(5.07, 6.18, [4, 6, 10, 13][detail]);
  const gable = [
    P(-5.05, 14.02, 0.27),
    P(5.09, 14.02, 0.27),
    ...peak.toReversed().map(([u, h]) => P(u, 24.26 + h, 0.27)),
  ];
  fan(out, 'masonry', gable, weathered);
  const path = [
    P(-5.06, 14.02, 0.41),
    ...peak.map(([u, h]) => P(u, 24.26 + h, 0.41)),
    P(5.06, 14.02, 0.41),
  ];
  if (detail > 0) beamPath(out, 'carved', path, 0.24, 0.3, pale);
  for (const [u, y, w, h] of [
    [-3.76, 15.87, 1.1, 4.8],
    [-2.01, 15.87, 1.25, 7.93],
    [0, 15.85, 1.53, 8.96],
    [2.06, 15.87, 1.22, 7.93],
    [3.76, 15.84, 1.1, 4.8],
  ])
    aperture(out, F, u, y, w, h, 0.31, detail, { isPointed: true });
  if (detail > 0) {
    for (const u of [-12.26, -9.87, 8.51, 11.25])
      aperture(out, F, u, 15.75, 1.48, 3.16, 0.157, detail);
    for (const [y, u, U] of [
      [13.39, -14.03, 14.23],
      [21.59, -13.97, -6.78],
      [24.93, -13.94, -7.44],
    ])
      box(out, 'carved', u, U, y, y + 0.31, -0.37, 0.36, pale);
  }
  if (detail > 1) {
    for (const [u, Y] of [
      [-3.83, 24.23],
      [-2.08, 26.34],
      [0, 28.02],
      [2.03, 26.34],
      [3.86, 24.23],
    ]) {
      const q = xz(P(u, 0, 0.51)),
        y = Y - 1.76;
      lathe(
        out,
        'carved',
        q,
        [
          [y, 0.25, 0.19],
          [y + 0.74, 0.31, 0.24],
          [Y - 0.39, 0.2, 0.16],
          [Y, 0.13, 0.12],
        ],
        8,
        light,
      );
    }
    box(out, 'carved', -0.11, 0.11, 30.31, 32.15, -0.02, 0.24, pale);
    box(out, 'carved', -0.69, 0.69, 31.47, 31.68, -0.02, 0.24, pale);
  }
}

function tower(out, detail, t) {
  const west = t.role === 'Saint-Michel',
    high = t.role !== 'Saint-Barthélemy';
  const b = t.outline.map(local);
  const center = xz(
    P(
      b.reduce((s, q) => s + q[0] / b.length, 0),
      0,
      b.reduce((s, q) => s + q[1] / b.length, 0),
    ),
  );
  const top = t.height,
    shaft = west ? top - 0.65 : high ? top - 4.26 : top - 2.73;
  extrude(out, 'masonry', t.outline, -1.91, shaft, stone, {
    topSlot: west ? 'paving' : 'carved',
    topColor: weathered,
  });
  if (!west)
    spire(out, 'tiles', center, high ? 5.51 : 5.45, 4, shaft, top - shaft, red, {
      rotation: Math.atan2(F.along[1], F.along[0]) + Math.PI * 0.25,
    });
  for (const f of faces(t.outline)) {
    if (f.length < 4.2) continue;
    const low = high ? shaft - 7.6 : shaft - 3.88;
    for (const u of [f.length * 0.31, f.length * 0.69])
      aperture(out, f, u, low, 1.36, high ? 5.24 : 2.6, 0.075, detail);
    if (detail > 0 && high) {
      for (const u of [f.length * 0.31, f.length * 0.69]) {
        aperture(out, f, u, low - 6.08, 1.28, 3.59, 0.064, detail);
        if (detail > 1)
          for (let i = 0; i < 6; i++)
            fbox(
              out,
              'dark',
              f,
              u - 0.55,
              u + 0.55,
              low + 0.39 + i * 0.65,
              low + 0.52 + i * 0.65,
              0.12,
              0.17,
              gray,
            );
      }
    }
    fbox(out, 'carved', f, 0, f.length, shaft - 0.38, shaft + 0.08, -0.22, 0.34, pale);
    if (west) {
      fbox(out, 'carved', f, 0, f.length, top - 0.14, top, -0.16, 0.18, pale);
      if (detail > 0)
        for (let j = 0; j < 7; j++) {
          const i = (f.length * (j + 0.5)) / 7;
          fbox(out, 'carved', f, i - 0.11, i + 0.11, shaft - 0.08, top - 0.13, -0.16, 0.08, pale);
        }
    }
  }
}

function chevet(out, detail) {
  shell(out, site.mass.chevet, -2.7, 14.55, detail, red);
  const n = [8, 12, 18, 24][detail],
    r0 = 8.23,
    r1 = 8.48,
    u0 = 0.11,
    d0 = -109.92;
  const station = (a, r, s, y) => P(u0 + r * Math.cos(a), y, d0 - s * Math.sin(a));
  const ring = Array.from({ length: n + 1 }, (_, i) => xz(station((i / n) * Math.PI, r0, r1, 0)));
  ring.push(xz(P(-8.17, 0, -97.7)), xz(P(8.34, 0, -97.7)));
  extrude(out, 'masonry', ring, 14.46, 22.95, stone, { top: false });
  roof(out, 0.1, -97.88, -109.95, 16.4, 22.95, 31.04, tile);
  const apex = P(0.11, 31.04, -109.92);
  for (let i = n; i > 0; i--) {
    const a = ((i - 1) / n) * Math.PI,
      b = (i / n) * Math.PI;
    const q = station(a, r0 + 0.19, r1 + 0.24, 22.96),
      w = station(b, r0 + 0.19, r1 + 0.24, 22.96);
    tri(out, 'tiles', q, w, apex, i % 2 ? tile : red);
  }
  for (const f of faces(ring))
    if (f.length > 1.58 && f.length < 4.5 && detail)
      aperture(out, f, f.length * 0.5, 17.11, Math.min(1.26, f.length * 0.55), 4.93, 0.07, detail);
  const radials = [0.05, 0.19, 0.34, 0.5, 0.66, 0.81, 0.95];
  for (const t of radials) {
    const a = t * Math.PI,
      rim = xz(station(a, 13.45, 12.47, 0));
    const dir = [Math.cos(a), -Math.sin(a)];
    const f = facade(rim, [
      F.along[0] * dir[1] - F.normal[0] * dir[0],
      F.along[1] * dir[1] - F.normal[1] * dir[0],
    ]);
    if (detail > 0 && f.normal[0] * F.normal[0] + f.normal[1] * F.normal[1] < 0.94)
      aperture(out, f, 0, 8.21, 1.47, 4.4, 0.07, detail);
    if (detail === 0) continue;
    const path = [
      station(a, 14.1, 12.82, 14.01),
      station(a, 12.7, 12.02, 14.67),
      station(a, 10.7, 10.6, 16.34),
      station(a, 8.12, 8.37, 19.67),
    ];
    beamPath(out, 'carved', path, 0.69, 0.95, light);
    const rimFace = facade(xz(path[0]), f.along);
    fbox(out, 'masonry', rimFace, -0.52, 0.52, 8.71, 14.6, -0.68, 0.51, stone);
  }
}

function build(sink, detail) {
  const out = withFootprintCaps(sink);
  const { narthex, nave, crossing, sideWing } = site.mass;
  shell(out, narthex, -2.6, 19.86, detail);
  roof(out, -0.02, -9.45, -27.08, 17.9, 19.87, 27.15);
  shell(out, nave, -2.65, 13.84, detail, red);
  box(out, 'masonry', -8.6, 8.42, 13.53, 23.19, -77.42, -24.47, stone);
  roof(out, -0.09, -24.51, -77.47, 17.02, 23.19, 30.84);
  roofAisles(out, 13.76, 8.1, -72.92, -24.35, 13.76, 18.12);
  roofAisles(out, -13.68, -8.17, -24.38, -72.87, 13.76, 18.12);
  shell(out, crossing, -2.66, 21.18, detail);
  gableRoof(
    out,
    'tiles',
    xz(P(-18.51, 0, -85.35)),
    xz(P(19.43, 0, -86.04)),
    17.01,
    21.18,
    30.28,
    tile,
    { overhang: 0.14, endSlot: 'masonry', endColor: stone },
  );
  roof(out, -0.21, -77.32, -100.17, 19.24, 21.87, 30.18, tile);
  shell(out, sideWing, -2.6, 13.48, detail);
  shell(out, [[site.range.outline]], -2.6, site.range.eave, detail);
  gableRoof(
    out,
    'tiles',
    xz(P(21, 0, -87.11)),
    xz(P(43.03, 0, -87.86)),
    14.18,
    13.48,
    site.range.top,
    red,
    { overhang: 0.15, endSlot: 'masonry', endColor: stone },
  );
  chevet(out, detail);
  westFront(out, detail);
  approach(out, detail);
  for (const t of site.towers) tower(out, detail, t);
  const studs = [-27.25, -33.76, -40.25, -46.67, -53.1, -59.51, -65.69, -71.62];
  for (const s of [-1, 1]) {
    const facing = facade(
      xz(P(s * 13.57, 0, 0)),
      F.normal.map((v) => v * -s),
    );
    for (const [i, d] of studs.entries()) {
      if (detail === 0) {
        if (i % 2 === 0)
          box(
            out,
            'masonry',
            s * 13.44 - 0.51,
            s * 13.44 + 0.51,
            3.15,
            14.71,
            d - 0.32,
            d + 0.64,
            weathered,
          );
        continue;
      }
      box(
        out,
        'masonry',
        s * 13.41 - 0.52,
        s * 13.41 + 0.52,
        2.3,
        15.14,
        d - 0.61,
        d + 0.65,
        weathered,
      );
      beamPath(
        out,
        'carved',
        [
          P(s * 13.82, 14.26, d),
          P(s * 12.89, 15.41, d),
          P(s * 10.92, 17.01, d),
          P(s * 8.41, 20.87, d),
        ],
        0.76,
        1.14,
        light,
      );
      const x = -s * (d - 2.95);
      aperture(out, facing, x, 5.78, 1.59, 5.2, 0.013, detail);
      const upper = facade(
        xz(P(s * 8.5, 0, 0)),
        F.normal.map((v) => v * -s),
      );
      aperture(out, upper, x, 19.14, 1.46, 3.6, 0.11, detail);
    }
  }
}

export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = buildCloseup;
