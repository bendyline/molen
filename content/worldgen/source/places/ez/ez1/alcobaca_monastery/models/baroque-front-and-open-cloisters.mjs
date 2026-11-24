import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
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
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import site from '../site-controls.json' with { type: 'json' };

export const surfaces = {
  stone: { slot: 'wall', graph: 'stone_limestone', roughness: 0.95 },
  trim: { slot: 'trim', graph: 'stone_limestone_raw', roughness: 0.89 },
  stucco: { slot: 'wall', graph: 'plaster_lime', roughness: 0.92 },
  tile: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.94 },
  glass: { slot: 'trim', graph: 'metal_painted', roughness: 0.57 },
  wood: { slot: 'trim', graph: 'wood_vertical', roughness: 0.93 },
  paving: { slot: 'foundation', graph: 'stone_ashlar', roughness: 0.96 },
};

const F = facade(site.frame.origin, site.frame.along);
const P = F.P;
const xz = ([x, , z]) => [x, z];
const stone = rgb('aca89a'),
  pale = rgb('c5bcab'),
  shadow = rgb('a79b89');
const white = rgb('dedbd1'),
  slate = rgb('78817e'),
  terracotta = rgb('976855'),
  red = rgb('9d6a55');
const glass = rgb('485052'),
  bronze = rgb('665f54'),
  wood = rgb('655448'),
  paving = rgb('a19d8c');
const box = (out, slot, u, U, y, Y, d, D, c) => fbox(out, slot, F, u, U, y, Y, d, D, c);
const faces = (outline) =>
  outwardRing(outline).map((a, i, r) => wallFace(a, r[(i + 1) % r.length]));
const uv = ([x, z]) => [
  (x - F.origin[0]) * F.along[0] + (z - F.origin[1]) * F.along[1],
  (x - F.origin[0]) * F.normal[0] + (z - F.origin[1]) * F.normal[1],
];

function archBays(
  out,
  f,
  u,
  w,
  y,
  spring,
  Y,
  front,
  back,
  detail,
  { pointed = false, trim = false } = {},
) {
  const a = pointed
    ? pointedArch(w / 2, Math.min(w * 0.62, Y - spring - 0.18), detail > 1 ? 7 : 4)
    : roundArch(w / 2, detail > 1 ? 10 : detail ? 6 : 3);
  for (let i = 0; i < a.length - 1; i++) {
    const [x, h] = a[i],
      [z, j] = a[i + 1];
    const A = f.P(u + x, spring + h, front),
      B = f.P(u + z, spring + j, front);
    const C = f.P(u + z, spring + j, back),
      D = f.P(u + x, spring + h, back);
    quad4(out, 'stone', A, B, f.P(u + z, Y, front), f.P(u + x, Y, front), pale);
    quad4(out, 'trim', D, C, B, A, shadow);
    if (trim) {
      const pull = (v) => v + Math.sign(v) * 0.23;
      quad4(
        out,
        'trim',
        f.P(u + x, spring + h, front + 0.1),
        f.P(u + z, spring + j, front + 0.1),
        f.P(u + pull(z), spring + j + 0.24, front + 0.1),
        f.P(u + pull(x), spring + h + 0.24, front + 0.1),
        pale,
      );
    }
  }
  fbox(out, 'trim', f, u - w / 2 - 0.27, u - w / 2, y, spring + 0.006, back, front + 0.13, shadow);
  fbox(out, 'trim', f, u + w / 2, u + w / 2 + 0.27, y, spring + 0.006, back, front + 0.13, shadow);
}

function windowAtLevel(out, detail, f, u, y, width, height, options) {
  if (detail === 3) {
    opening(out, f, u, y, width, height, options);
    return;
  }
  const half = width / 2;
  const head = options.head;
  const h = head === 'flat' ? 0 : Math.min(half * (head === 'pointed' ? 1.55 : 1), height * 0.6);
  const upper =
    head === 'flat'
      ? [
          [half, 0],
          [-half, 0],
        ]
      : [
          [half, 0],
          [half * 0.66, h * 0.72],
          [0, h],
          [-half * 0.66, h * 0.72],
          [-half, 0],
        ];
  const outline = [[-half, 0], [half, 0], ...upper.map(([x, v]) => [x, height - h + v])];
  const surround = detail > 1 ? 0.11 : 0.076;
  if (detail > 1)
    fan(
      out,
      'trim',
      outline.map(([x, v]) =>
        f.P(u + x * (1 + surround / half), y - surround + v * (1 + (2 * surround) / height), 0.075),
      ),
      options.frame,
    );
  fan(
    out,
    'glass',
    outline.map(([x, v]) => f.P(u + x, y + v, 0.094)),
    options.glass,
  );
}

function portal(out, detail) {
  box(out, 'stone', -13.46, -4.4, 1.28, 11.47, -3.35, 0.02, stone);
  box(out, 'stone', 4.4, 13.46, 1.28, 11.47, -3.35, 0.02, stone);
  archBays(out, F, 0, 8.8, 1.37, 5.71, 11.47, 0.02, -3.3, detail, {
    pointed: true,
    trim: detail > 0,
  });
  box(out, 'wood', -3.72, 3.72, 1.38, 9.23, -3.13, -3.05, wood);
  box(out, 'trim', -13.54, 13.54, 11.17, 11.95, -3.42, 0.3, pale);
  box(out, 'stone', -13.45, 13.45, 11.89, 22.1, -6.51, -0.02, stone);
  for (const level of detail ? [12.08, 21.44, 22.13] : [22.13]) {
    box(out, 'trim', -13.69, 13.7, level, level + 0.36, -6.62, 0.51, pale);
  }
  for (const u of detail ? [-11.17, -5.25, 5.24, 11.16] : []) {
    box(out, 'trim', u - 0.3, u + 0.3, 2.3, 21.39, -0.04, 0.48, pale);
    for (const [y, h, w] of [
      [2.05, 0.69, 0.59],
      [10.55, 0.61, 0.74],
      [20.98, 0.46, 0.77],
    ]) {
      box(out, 'trim', u - w, u + w, y, y + h, -0.05, 0.62, shadow);
    }
  }
  const n = [12, 18, 24, 36][detail],
    cy = 16.95;
  const rose = (r, i, d) =>
    P(r * Math.cos((i * 2 * Math.PI) / n), cy + r * Math.sin((i * 2 * Math.PI) / n), d);
  fan(
    out,
    'glass',
    Array.from({ length: n }, (_, i) => rose(2.13, i, 0.09)),
    glass,
  );
  for (let i = 0; detail && i < n; i++) {
    quad4(
      out,
      'trim',
      rose(2.08, i, 0.12),
      rose(2.8, i, 0.19),
      rose(2.8, i + 1, 0.19),
      rose(2.08, i + 1, 0.12),
      pale,
    );
    if (detail > 0 && i % 2 === 0) {
      const t = ((i + 0.5) * 2 * Math.PI) / n;
      const a = P(0.39 * Math.cos(t), cy + 0.39 * Math.sin(t), 0.148);
      beam(out, 'trim', a, rose(2.11, i, 0.148), 0.123, 0.08, shadow);
      beam(out, 'trim', a, rose(2.11, i + 1, 0.148), 0.123, 0.08, shadow);
    }
  }
  if (detail > 0) {
    for (const u of [-8.14, 8.14]) {
      opening(out, F, u, 13.64, 1.96, 5.19, {
        head: 'round',
        glassSlot: 'glass',
        glass,
        frame: pale,
        frameWidth: 0.28,
        frameDepth: 0.24,
        mullions: detail > 2 ? 1 : 0,
      });
    }
    for (const u of [-8.76, 8.76]) {
      opening(out, F, u, 3.78, 1.75, 3.98, {
        head: 'round',
        glassSlot: 'trim',
        glass: shadow,
        frame: pale,
        frameWidth: 0.22,
        mullions: 1,
      });
      box(out, 'trim', u - 0.4, u + 0.38, 3.62, 4.02, 0.02, 0.58, pale);
      lathe(
        out,
        'trim',
        xz(P(u, 0, 0.28)),
        [
          [4.0, 0.28, 0.25],
          [4.75, 0.37, 0.29],
          [5.63, 0.26, 0.21],
          [6.07, 0.19, 0.17],
          [6.28, 0.1, 0.1],
        ],
        detail > 1 ? 10 : 7,
        pale,
      );
    }
  }
}

function towers(out, detail) {
  for (const u of [-8.75, 8.75]) {
    const w = 4.39,
      openingWidth = 3.57,
      s = openingWidth / 2;
    box(out, 'stone', u - w, u - s, 22.1, 30.7, -6.38, 0.02, stone);
    box(out, 'stone', u + s, u + w, 22.1, 30.7, -6.38, 0.02, stone);
    box(out, 'stone', u - s, u + s, 22.1, 23.35, -6.38, 0.04, stone);
    box(out, 'stone', u - s, u + s, 23.31, 30.65, -6.47, -5.32, shadow);
    archBays(out, F, u, openingWidth, 23.35, 27.54, 30.7, 0.03, -4.5, detail, { trim: detail > 0 });
    box(out, 'trim', u - w - 0.2, u + w + 0.21, 30.44, 31.12, -6.64, 0.37, pale);
    if (detail > 0) box(out, 'trim', u - w + 0.22, u + w - 0.23, 31.08, 31.77, -6.29, 0.11, pale);
    const bell = xz(P(u, 0, -2.9));
    if (detail > 1) {
      lathe(
        out,
        'glass',
        bell,
        [
          [24.12, 1.17, 1.07],
          [24.36, 1.15, 1.06],
          [24.62, 0.89, 0.81],
          [26.48, 0.63, 0.57],
          [26.8, 0.24, 0.23],
        ],
        detail > 1 ? 18 : 10,
        bronze,
        { capBottom: true },
      );
      for (const v of [u - 3.23, u + 3.23]) {
        box(out, 'trim', v - 0.25, v + 0.25, 22.62, 30.46, -0.02, 0.37, pale);
        box(out, 'trim', v - 0.44, v + 0.44, 22.38, 23.22, -0.04, 0.54, pale);
        box(out, 'trim', v - 0.48, v + 0.48, 29.81, 30.38, -0.06, 0.52, pale);
      }
    }
    lathe(
      out,
      'trim',
      bell,
      detail
        ? [
            [31.66, 3.3, 2.92],
            [32.46, 3.15, 2.75],
            [33.16, 2.58, 2.21],
            [34.31, 1.94, 1.63],
            [35.1, 1.15, 1.05],
            [35.54, 0.63, 0.58],
            [36.02, 0.72, 0.63],
            [36.58, 0.37, 0.33],
          ]
        : [
            [31.66, 3.3, 2.92],
            [33.16, 2.58, 2.21],
            [35.1, 1.15, 1.05],
            [36.58, 0.37, 0.33],
          ],
      detail > 1 ? 16 : detail ? 8 : 6,
      pale,
      { rotation: Math.PI / 8 },
    );
    spire(out, 'trim', bell, 0.39, 8, 36.52, 1.65, pale);
    if (detail > 1) {
      for (const v of [u - 3.55, u + 3.55])
        for (const d of [-0.11, -5.92])
          lathe(
            out,
            'trim',
            xz(P(v, 0, d)),
            [
              [31.54, 0.44, 0.4],
              [32.31, 0.42, 0.38],
              [32.93, 0.24, 0.22],
              [33.3, 0.08, 0.08],
            ],
            8,
            pale,
          );
    }
  }
  box(out, 'stone', -3.09, 3.09, 22.15, 27.96, -4.6, -0.05, stone);
  box(out, 'trim', -3.28, 3.28, 27.83, 28.44, -4.8, 0.24, pale);
  box(out, 'trim', -0.15, 0.15, 28.3, 31.18, -1.76, -1.54, pale);
  box(out, 'trim', -0.87, 0.87, 30.15, 30.39, -1.76, -1.54, pale);
  if (detail > 1) {
    for (const s of [-1, 1]) {
      const path = Array.from({ length: 15 }, (_, i) => {
        const t = i / 14,
          a = t * Math.PI * 3,
          r = 0.97 * (1 - 0.77 * t);
        return P(s * (3.0 + Math.cos(a) * r), 24.28 + Math.sin(a) * r, 0.26);
      });
      for (let i = 0; i < path.length - 1; i++)
        beam(out, 'trim', path[i], path[i + 1], 0.23, 0.23, pale);
    }
  }
}

function core(out, detail) {
  for (const [ring, ...holes] of site.nave) {
    extrude(out, 'stone', ring, -1.4, 17.9, stone, {
      holes,
      topSlot: 'tile',
      topColor: terracotta,
    });
    if (!detail) continue;
    for (const f of faces(ring)) {
      if (f.length < 7 || f.normal[0] < -0.8) continue;
      const N = Math.max(1, Math.round(f.length / 7.05));
      for (let i = 0; i < N; i++) {
        const x = ((i + 0.5) * f.length) / N;
        windowAtLevel(out, detail, f, x, 8.25, 1.68, 7.48, {
          head: 'pointed',
          frame: pale,
          frameWidth: 0.21,
          glassSlot: 'glass',
          glass,
          mullions: detail > 1 ? 2 : 0,
        });
        if (detail === 1) continue;
        fbox(out, 'stone', f, x - 2.69, x - 1.84, 1.55, 17.37, -0.18, 1.03, stone);
        fbox(out, 'trim', f, x - 2.8, x - 1.73, 16.98, 17.59, -0.2, 1.16, shadow);
      }
    }
  }
  gableRoof(
    out,
    'tile',
    xz(P(0, 0, -6.35)),
    xz(P(-0.34, 0, -79.7)),
    23.55,
    17.9,
    26.7,
    terracotta,
    { overhang: 0.22, endSlot: 'stone', endColor: stone },
  );
  gableRoof(
    out,
    'tile',
    xz(P(-25.6, 0, -66.12)),
    xz(P(31.15, 0, -68.45)),
    21.1,
    17.82,
    24.87,
    red,
    { overhang: 0.16, endSlot: 'stone', endColor: stone },
  );
  gableRoof(
    out,
    'tile',
    xz(P(0.37, 0, -79.6)),
    xz(P(0.7, 0, -100.5)),
    17.05,
    17.89,
    23.17,
    terracotta,
    { overhang: 0.18, endSlot: 'stone', endColor: stone },
  );
}

function wingRoof(out, ring, y, rise, color) {
  const points = ring.map(uv),
    u = points.map((p) => p[0]),
    d = points.map((p) => p[1]);
  const u0 = Math.min(...u),
    u1 = Math.max(...u),
    d0 = Math.min(...d),
    d1 = Math.max(...d);
  const U = (u0 + u1) / 2,
    D = (d0 + d1) / 2;
  const h = Math.min(u1 - u0, d1 - d0);
  const ridge =
    u1 - u0 > d1 - d0
      ? [P(u0 + 0.35, 0, D), P(u1 - 0.35, 0, D)]
      : [P(U, 0, d0 + 0.35), P(U, 0, d1 - 0.35)];
  gableRoof(out, 'tile', ...ridge.map(xz), h - 0.55, y, y + rise, color, {
    overhang: 0.12,
    endSlot: 'stucco',
    endColor: white,
  });
}

function plazaRoof(out, wing) {
  for (const f of faces(wing.outline)) {
    if (f.length < 13 || Math.abs(f.normal[0]) < 0.9) continue;
    const maxWidth = f.length >= 34 ? 9.6 : 5.1;
    const openings = wing.holes
      .map((ring) => {
        const local = ring.map(([x, z]) => {
          const dx = x - f.origin[0],
            dz = z - f.origin[1];
          return [dx * f.along[0] + dz * f.along[1], -(dx * f.normal[0] + dz * f.normal[1])];
        });
        const [a, b] = [Math.min(...local.map((p) => p[0])), Math.max(...local.map((p) => p[0]))];
        const width = Math.min(...local.map((p) => p[1])) - 0.23;
        return { lo: Math.max(0.22, a - 0.27), hi: Math.min(f.length - 0.22, b + 0.27), width };
      })
      .filter(({ lo, hi, width }) => hi > lo && width >= 0 && width < maxWidth);
    const spans = [0.22, ...openings.flatMap((a) => [a.lo, a.hi]), f.length - 0.22].sort(
      (a, b) => a - b,
    );
    for (let i = 0; i < spans.length - 1; i++) {
      const lo = spans[i],
        hi = spans[i + 1],
        mid = (lo + hi) / 2;
      const width = Math.min(
        maxWidth,
        ...openings.filter((a) => mid >= a.lo && mid <= a.hi).map((a) => a.width),
      );
      if (width < 0.6 || hi - lo < 0.26) continue;
      const from = xz(f.P(lo, 0, -width / 2)),
        to = xz(f.P(hi, 0, -width / 2));
      gableRoof(
        out,
        'tile',
        from,
        to,
        width,
        wing.eave,
        wing.eave + wing.rise * Math.min(width / 5.1, 1),
        red,
        { overhang: 0.035, endSlot: 'stucco', endColor: white },
      );
    }
  }
}

function rangeWalls(out, detail) {
  for (const wing of site.ranges) {
    const slot = wing.use === 'annex' ? 'stone' : 'stucco',
      base = wing.use === 'annex' ? stone : white;
    extrude(out, slot, wing.outline, -1.44, wing.eave, base, {
      holes: wing.holes ?? [],
      topSlot: 'tile',
      topColor: red,
    });
    if (!detail && wing.use !== 'plaza wing') continue;
    if (wing.holes.length) {
      if (detail) plazaRoof(out, wing);
    } else if (wing.outline.length < 7 || wing.id === 1120306743) {
      if (wing.id === 1120306743)
        gableRoof(
          out,
          'tile',
          xz(P(14.7, 0, -6.2)),
          xz(P(98.9, 0, -6.2)),
          12,
          wing.eave,
          wing.eave + wing.rise,
          red,
          { overhang: 0.15, endSlot: 'stucco', endColor: white },
        );
      else wingRoof(out, wing.outline, wing.eave, wing.rise, wing.use === 'annex' ? slate : red);
    } else {
      for (const f of faces(wing.outline).filter((f) => f.length > 16)) {
        const d = f.length > 26 ? 6.9 : 4.4;
        wingRoof(
          out,
          [
            f.P(0.38, 0, -0.4),
            f.P(f.length - 0.37, 0, -0.4),
            f.P(f.length - 0.37, 0, -d),
            f.P(0.38, 0, -d),
          ].map(xz),
          wing.eave,
          wing.rise,
          red,
        );
      }
    }
    if (!detail) continue;
    for (const f of faces(wing.outline)) {
      if (f.length < 8.4 || (detail === 1 && (wing.use !== 'plaza wing' || f.normal[0] > -0.8)))
        continue;
      const n = Math.max(2, Math.round(f.length / (wing.use === 'plaza wing' ? 4.8 : 5.55)));
      for (let j = 0; j < n; j++) {
        const x = ((j + 0.5) * f.length) / n;
        for (const y of [2.45, wing.eave - 3.14]) {
          windowAtLevel(out, detail, f, x, y, wing.use === 'plaza wing' ? 1.29 : 1.13, 2.06, {
            head: wing.use === 'annex' ? 'pointed' : 'flat',
            frame: shadow,
            glassSlot: 'glass',
            glass,
            frameWidth: 0.19,
            frameDepth: 0.13,
            mullions: detail > 1 ? 1 : 0,
            transoms: detail > 2 ? 1 : 0,
          });
        }
      }
    }
  }
}

function cloisters(out, detail) {
  for (const range of site.arcades) {
    for (const [outside, ...holes] of range.geometry)
      extrude(out, 'stucco', outside, -1.2, range.eave, white, {
        holes,
        topSlot: 'tile',
        topColor: red,
      });
    for (const ring of range.innerCourts) {
      for (const [i, a] of outwardRing(ring).reverse().entries()) {
        const r = outwardRing(ring).reverse(),
          f = wallFace(a, r[(i + 1) % r.length]);
        if (f.length < 13) continue;
        const depth = range.entrance ? 4.43 : 7.4;
        const roof = [
          f.P(0.025, 0, 0.21),
          f.P(f.length - 0.025, 0, 0.21),
          f.P(f.length - 0.025, 0, -depth),
          f.P(0.025, 0, -depth),
        ].map(xz);
        if (!detail) continue;
        wingRoof(out, roof, range.eave, range.rise, red);
        const n = Math.max(2, Math.round(f.length / (range.entrance ? 5.0 : 5.35))),
          spacing = f.length / n;
        for (let j = 0; j < n; j++) {
          const x = (j + 0.5) * spacing,
            w = spacing * (range.entrance ? 0.62 : 0.71);
          for (const y of detail === 1 && !range.entrance ? [1.99] : [1.99, range.eave - 4.05]) {
            windowAtLevel(out, detail, f, x, y, w, 3.1, {
              head: 'round',
              frame: pale,
              glassSlot: 'glass',
              glass,
              frameWidth: 0.21,
              frameDepth: 0.15,
              mullions: range.entrance && detail > 1 ? 2 : 0,
            });
          }
          if (detail > 1)
            fbox(
              out,
              'trim',
              f,
              x - spacing / 2 - 0.035,
              x - spacing / 2 + 0.29,
              1.42,
              range.eave - 0.12,
              -0.11,
              0.24,
              pale,
            );
        }
      }
    }
  }
  for (const [i, c] of site.courts.entries()) {
    const g = i < 3 ? rgb('87836a') : paving;
    const y = i === 0 ? 0.93 : 0.38;
    extrude(out, 'paving', c.outline, Math.min(-2, y - 0.12), y, g);
  }
}

function steps(out, detail) {
  const n = [3, 6, 12, 16][detail];
  for (let i = 0; i < n; i++) {
    const y = (1.57 * (i + 1)) / n;
    box(out, 'paving', -13.94, 13.94, -1.23, y, -0.21, 11.79 - (11.29 * i) / n, paving);
  }
  for (const x of detail ? [-11.71, 11.71] : []) {
    box(out, 'trim', x - 1.79, x + 1.79, -0.31, 1.15, 1.39, 9.78, shadow);
    box(out, 'trim', x - 1.86, x + 1.86, 1.04, 1.33, 1.35, 9.84, pale);
    if (detail > 1)
      for (const d of [1.78, 4.19, 8.99])
        spire(out, 'trim', xz(P(x, 0, d)), 0.44, 8, 1.31, 1.12, pale);
  }
}

function build(sink, detail) {
  const out = withFootprintCaps(sink);
  core(out, detail);
  rangeWalls(out, detail);
  cloisters(out, detail);
  portal(out, detail);
  towers(out, detail);
  steps(out, detail);
}

export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = buildCloseup;
