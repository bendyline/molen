import controls from '../plan-controls.json' with { type: 'json' };
import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  arch,
  block,
  closed,
  edge,
  face,
  opening,
  palette,
  pairs,
  panel,
  pavilion,
  rect,
  ring,
  shell,
  surface,
  up,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';

const surfaces = {
  brick: surface('wall', 'brick_flemish'),
  ashlar: surface('foundation', 'stone_granite'),
  iron: surface('trim', 'metal_painted', 0.72, 0.12),
  roof: surface('roof', 'metal_corrugated', 0.79, 0.1),
  glass: surface('window', 'window_punched', 0.58),
  wood: surface('door', 'wood_plain'),
};
const C = palette({
  brick: 'a1644f',
  darkBrick: '925c4b',
  border: 'b47f60',
  stone: 'a49f91',
  rail: 'c9c3a6',
  frame: 'dbd1b6',
  roof: 'a9aea8',
  roofShade: '909991',
  ridge: 'b4b9b0',
  glass: '65716c',
  dark: '665a4a',
  deck: 'ad9e84',
  shutters: '8e9887',
});
const story = [1.94, 6.3, 10.99];

function stoneBase(out, outline, grade) {
  shell(out, outline, (p) => Math.min(grade(p) - 0.32, story[0] - 0.22), story[0], {
    wall: 'ashlar',
    color: C.stone,
    roofColor: C.stone,
  });
}

function hood(out, wall, center, y, width, lod) {
  const lo = center - width / 2,
    hi = center + width / 2;
  face(
    out,
    'roof',
    [
      wall.p(lo, y + 0.45, 0.035),
      wall.p(hi, y + 0.45, 0.035),
      wall.p(hi, y, 0.63),
      wall.p(lo, y, 0.63),
    ],
    up,
    C.roofShade,
  );
  if (lod >= 2) {
    panel(out, 'iron', wall, lo, hi, y - 0.12, y + 0.014, 0.64, C.frame);
    for (const u of [lo + 0.11, hi - 0.11])
      beam(out, 'iron', wall.p(u, y - 0.48, 0.06), wall.p(u, y - 0.03, 0.62), 0.075, 0.076, C.rail);
  }
}

function frontWindow(out, wall, center, base, high, lod, small = false) {
  const radius = small ? 0.4 : 0.49;
  const width = radius * 2;
  const spring = high - 0.38;
  arch(
    out,
    wall,
    center,
    base,
    spring,
    radius,
    0.38,
    0.09,
    lod,
    { inner: C.glass, trim: C.border, width: 0.17 },
    { inner: 'glass', trim: 'brick' },
  );
  if (lod >= 1) {
    panel(
      out,
      'iron',
      wall,
      center - width * 0.08,
      center + width * 0.08,
      base + 0.05,
      spring + 0.27,
      0.124,
      C.frame,
    );
    panel(
      out,
      'iron',
      wall,
      center - width * 0.46,
      center + width * 0.46,
      (base + spring) * 0.5,
      (base + spring) * 0.5 + 0.07,
      0.15,
      C.frame,
    );
  }
  if (lod >= 2)
    panel(
      out,
      'ashlar',
      wall,
      center - width * 0.67,
      center + width * 0.67,
      base - 0.04,
      base + 0.068,
      0.15,
      C.stone,
    );
}

function brickWall(out, polygon, grade, lod, addWindows) {
  stoneBase(out, polygon, grade);
  shell(out, polygon, () => story[0], story[2], {
    wall: 'brick',
    color: C.brick,
    roof: 'roof',
    roofColor: C.roof,
  });
  if (lod === 0) return;
  for (const [a, b] of pairs(closed(polygon))) {
    const wall = edge(a, b);
    for (const level of [2.58, 6.2, 6.95, 10.72])
      panel(out, 'brick', wall, 0, wall.length, level, level + 0.16, 0.055, C.border);
    addWindows(wall, a, b);
  }
}

function mainMasonry(out, grade, lod) {
  const spine = rect(-8.78, -10.93, 8.48, 10.92);
  const projecting = rect(-12.06, -10.93, -8.68, -3.41);
  brickWall(out, spine, grade, lod, (wall, a, b) => {
    const n = wall.length < 12 ? 3 : Math.ceil(wall.length / 4.85);
    const riverSide = a[0] === -8.78 && b[0] === -8.78;
    for (const l of [0, 1])
      for (let i = 0; i < n; i++) {
        const u = ((i + 0.5) * wall.length) / n;
        if (riverSide && u > wall.length - 7.4) continue;
        const bottom = story[l] + 0.91;
        frontWindow(out, wall, u, bottom, bottom + 2.12, lod);
        if (lod >= 2 && !riverSide) hood(out, wall, u, bottom + 2.46, 1.36, lod);
      }
  });
  brickWall(out, projecting, grade, lod, (wall, a, b) => {
    if (a[0] !== -12.06 || b[0] !== -12.06) return;
    for (const l of [0, 1])
      for (const x of [-1.48, 0, 1.48])
        frontWindow(out, wall, wall.length / 2 + x, story[l] + 0.92, story[l] + 3.25, lod, true);
  });
  const entry = { normal: [-1, 0, 0], p: (u, y, d = 0) => [-8.83 - d, y, -0.93 + u] };
  for (const u of [-1.04, 1.04])
    opening(
      out,
      entry,
      u - 0.19,
      u + 0.19,
      story[0] + 0.31,
      4.75,
      'iron',
      C.glass,
      'glass',
      C.frame,
      lod,
      0.065,
    );
  arch(
    out,
    entry,
    0,
    story[0],
    4.68,
    0.79,
    0.45,
    0.09,
    lod,
    { inner: C.dark, trim: C.frame, width: 0.16 },
    { inner: 'wood', trim: 'iron' },
  );
}

function roof(out, lod) {
  const e = 11.12,
    high = 16.86,
    x0 = -9.24,
    x1 = 8.98,
    z0 = -11.25,
    z1 = 11.18;
  const summit = [-0.13, high, -11.25];
  const ridge = [-0.13, high, 6.08];
  const southPeak = [-0.13, 14.99, 9.41];
  const nw = [x0, e, z0],
    ne = [x1, e, z0],
    sw = [x0, e, z1],
    se = [x1, e, z1];
  for (const [slot, pts, color] of [
    ['roof', [nw, sw, southPeak, ridge, summit], C.roof],
    ['roof', [se, ne, summit, ridge, southPeak], C.roofShade],
    ['roof', [sw, se, southPeak], C.roof],
    ['brick', [ne, nw, summit], C.darkBrick],
  ])
    face(out, slot, pts, slot === 'roof' ? up : [0, 0, -1], color);
  const wx = -12.32,
    gz = -7.16,
    gablePeak = 16.32,
    gableBase = 11.12;
  const left = [wx, gableBase, -11.31],
    right = [wx, gableBase, -3.08],
    peak = [wx, gablePeak, gz];
  const upper = [-0.18, gablePeak, gz],
    backA = [-0.18, gableBase, -11.31],
    backB = [-0.18, gableBase, -3.08];
  face(out, 'roof', [left, backA, upper, peak], up, C.roofShade);
  face(out, 'roof', [backB, right, peak, upper], up, C.roof);
  face(out, 'brick', [right, left, peak], [-1, 0, 0], C.brick);
  if (lod > 0) {
    for (const [a, b] of [
      [left, peak],
      [right, peak],
      [left, backA],
      [right, backB],
      [peak, upper],
      [summit, ridge],
      [ridge, southPeak],
    ])
      beam(out, 'iron', a, b, 0.14, 0.12, C.ridge);
    const vent = { normal: [-1, 0, 0], p: (u, y, d = 0) => [wx - d, y, gz + u] };
    const loops = lod === 1 ? 9 : 16,
      r = 0.42;
    face(
      out,
      'glass',
      Array.from({ length: loops }, (_, i) =>
        vent.p(
          r * Math.cos((2 * Math.PI * i) / loops),
          13.14 + r * Math.sin((2 * Math.PI * i) / loops),
          0.051,
        ),
      ),
      vent.normal,
      C.dark,
    );
    if (lod >= 2) {
      const tieY = 14.09,
        span = 1.61;
      beam(
        out,
        'iron',
        [wx - 0.14, tieY, gz - span],
        [wx - 0.14, tieY, gz + span],
        0.087,
        0.106,
        C.rail,
      );
      beam(out, 'iron', [wx - 0.14, tieY, gz], [wx - 0.14, gablePeak, gz], 0.078, 0.098, C.rail);
      for (const side of [-1, 1])
        beam(
          out,
          'iron',
          [wx - 0.14, tieY, gz + side * 0.58],
          [wx - 0.14, tieY + 0.86, gz + side * 0.28],
          0.067,
          0.07,
          C.rail,
        );
      beam(
        out,
        'iron',
        [wx + 0.04, gablePeak - 0.01, gz],
        [wx + 0.04, gablePeak + 0.99, gz],
        0.081,
        0.081,
        C.dark,
      );
      beam(
        out,
        'iron',
        [wx + 0.04, gablePeak + 0.71, gz - 0.29],
        [wx + 0.04, gablePeak + 0.71, gz + 0.29],
        0.081,
        0.081,
        C.dark,
      );
    }
  }
}

function dormer(out, side, x, z, base, lod) {
  const w = 0.96,
    d = 1.45,
    top = base + 1.24,
    peak = base + 1.92;
  const orient =
    side === 'north'
      ? (u, y, inset) => [x + u, y, z + inset]
      : (u, y, inset) => [x + (side === 'east' ? -1 : 1) * inset, y, z + u];
  const front = [
    orient(-w / 2, base, 0),
    orient(w / 2, base, 0),
    orient(w / 2, top, 0),
    orient(-w / 2, top, 0),
  ];
  const backs = [
    orient(-w / 2, base, d),
    orient(w / 2, base, d),
    orient(w / 2, top - 0.24, d),
    orient(-w / 2, top - 0.24, d),
  ];
  const a = orient(0, peak, 0),
    b = orient(0, peak - 0.2, d);
  const n = side === 'north' ? [0, 0, -1] : [side === 'east' ? 1 : -1, 0, 0];
  face(out, 'brick', front, n, C.darkBrick);
  face(out, 'brick', [front[2], front[3], a], n, C.brick);
  for (const i of [0, 1])
    face(
      out,
      'brick',
      [front[i], backs[i], backs[3 - i], front[3 - i]],
      [-n[2], 0, n[0]].map((q) => q * (i ? 1 : -1)),
      C.brick,
    );
  face(out, 'roof', [front[3], backs[3], b, a], up, C.roofShade);
  face(out, 'roof', [front[2], backs[2], b, a], up, C.roof);
  if (lod > 0) {
    const window = { normal: n, p: (u, y, pad = 0) => orient(u, y, -pad) };
    opening(
      out,
      window,
      -0.26,
      0.26,
      base + 0.24,
      top - 0.18,
      'iron',
      C.glass,
      'glass',
      C.frame,
      lod,
      0.04,
    );
  }
}

function upperRoofDetails(out, lod) {
  for (const z of [-7.09, -2.91, 1.35, 5.57]) dormer(out, 'east', 5.57, z, 12.82, lod);
  for (const z of [0.51, 5.78]) dormer(out, 'west', -5.57, z, 12.91, lod);
  dormer(out, 'north', -6.3, -10.79, 12.72, lod);
}

function veranda(out, grade, lod, bays) {
  const x = -12.14,
    z0 = -3.41,
    z1 = 11.2,
    w = z1 - z0,
    pitch = w / bays;
  const low = story[0],
    hi = story[1],
    deckWidth = 3.42;
  const columns = lod === 0 ? 4 : bays;
  for (const [level, y] of [low, hi].entries()) {
    block(out, level === 0 ? 'ashlar' : 'wood', x, y - 0.135, z0, deckWidth, 0.14, w, C.deck);
    const top = level === 0 ? hi - 0.13 : 10.74;
    for (let i = 0; i <= columns; i++) {
      const u = z0 + (i * w) / columns;
      const post = lod <= 1 ? [0] : [-0.14, 0.14];
      for (const offset of post) {
        const z = u + offset;
        if (lod <= 1) {
          block(out, 'iron', x + 0.12, y, z - 0.052, 0.11, top - y, 0.105, C.frame);
        } else {
          ring(
            out,
            'iron',
            [x + 0.18, z],
            [
              [y, 0.091],
              [y + 0.18, 0.073],
              [top - 0.19, 0.052],
              [top - 0.05, 0.074],
            ],
            lod === 2 ? 6 : 8,
            C.frame,
          );
          for (const p of [y - 0.02, top - 0.12])
            block(out, 'iron', x + 0.09, p, z - 0.086, 0.18, 0.14, 0.172, C.frame);
        }
      }
      if (level === 0) {
        const g = grade([x + 0.23, u]) - 0.24;
        block(out, 'ashlar', x - 0.01, g, u - 0.27, 0.52, y - g, 0.54, C.stone);
      }
    }
    if (lod > 0) {
      const frontage = edge([x, z1], [x, z0]);
      const runs =
        level === 0
          ? [
              [0, 4.29],
              [6.85, w],
            ]
          : [[0, w]];
      for (const [a, b] of runs) {
        for (const dy of [0.115, 1.035])
          beam(
            out,
            'iron',
            frontage.p(a, y + dy, -0.12),
            frontage.p(b, y + dy, -0.12),
            0.073,
            0.05,
            C.rail,
          );
        if (lod >= 2)
          for (let u = a + 0.13; u < b - 0.11; u += lod === 2 ? 0.4 : 0.2)
            beam(
              out,
              'iron',
              frontage.p(u, y + 0.14, -0.13),
              frontage.p(u, y + 1.01, -0.13),
              0.033,
              0.035,
              C.rail,
            );
      }
      if (lod >= 2 && level === 1) {
        for (let i = 0; i < bays; i++) {
          const center = (i + 0.5) * pitch;
          const arc = Array.from({ length: lod === 2 ? 6 : 9 }, (_, k) => {
            const t = (Math.PI * k) / (lod === 2 ? 5 : 8);
            return frontage.p(
              center + 0.48 * pitch * Math.cos(t),
              top - 0.57 + 0.48 * Math.sin(t),
              -0.12,
            );
          });
          for (const [p, q] of pairs(arc)) beam(out, 'iron', p, q, 0.043, 0.045, C.rail);
        }
      }
    }
  }
  const ra = [x - 0.15, 10.72, z0 - 0.09],
    rb = [x - 0.15, 10.72, z1 + 0.17];
  face(
    out,
    'roof',
    [ra, rb, [-8.67, 11.88, z1 + 0.17], [-8.67, 11.88, z0 - 0.09]],
    up,
    C.roofShade,
  );
  if (lod > 0) beam(out, 'iron', ra, rb, 0.13, 0.085, C.frame);
  const steps = lod === 0 ? 4 : 8;
  const z = 5.62;
  const present = grade([x - 3.1, z]);
  for (let i = 0; i < steps; i++) {
    const sx = x - 3.2 + i * (3.27 / steps);
    const y = present + ((low - present) * (i + 1)) / steps;
    const g = Math.min(grade([sx, z]) - 0.2, y - 0.17);
    block(out, 'ashlar', sx, g, z - 1.25, 3.27 / steps + 0.014, y - g, 2.5, C.stone);
  }
}

function rear(out, grade, lod) {
  const outline = rect(8.44, -10.88, 12.2, 6.87);
  shell(out, outline, (p) => grade(p) - 0.35, 5.87, {
    wall: 'brick',
    color: C.darkBrick,
    roof: 'roof',
    roofColor: C.roofShade,
  });
  face(
    out,
    'roof',
    [
      [8.35, 6.65, -11.08],
      [12.22, 5.89, -11.08],
      [12.22, 5.89, 7.02],
      [8.35, 6.65, 7.02],
    ],
    up,
    C.roofShade,
  );
  if (lod >= 1) {
    const f = edge([12.2, -10.88], [12.2, 6.87]);
    for (let i = 0; i < 4; i++) {
      const u = ((i + 0.5) * f.length) / 4;
      opening(out, f, u - 0.64, u + 0.64, 3.12, 4.87, 'iron', C.glass, 'glass', C.frame, lod, 0.05);
    }
  }
}

function draw(out, lod, { frontVerandaBays }, grade) {
  mainMasonry(out, grade, lod);
  roof(out, lod);
  if (lod > 0) upperRoofDetails(out, lod);
  veranda(out, grade, lod, frontVerandaBays);
  rear(out, grade, lod);
}

const museum = pavilion(
  import.meta.url,
  {
    surfaces,
    camera: [-39, 25, -36],
    lookAt: [-0.5, 7.1, 0],
    yaw: -2.36,
    sun: [-440, 560, -470],
    brief:
      'Cooktown’s Victorian Gothic former convent with red brick, a steep iron roof and the five-bay double veranda.',
    views: [
      {
        name: 'helen-street-front-gable-and-veranda',
        position: [-26, 9.5, -4],
        lookAt: [-8, 8, 1],
      },
      {
        name: 'furneaux-street-side-and-dormers',
        position: [-11, 18, -32],
        lookAt: [0.1, 8.8, -5],
      },
      {
        name: 'front-stair-and-paired-iron-columns',
        position: [-22, 7.1, 12],
        lookAt: [-12, 5.3, 5.6],
      },
      { name: 'rear-wing-and-truncated-roof', position: [30, 26, 27], lookAt: [1, 8, 0] },
    ],
  },
  draw,
);
export const { skyline, district, street, closeup } = museum;
export const model = {
  ...museum.model,
  category: 'museum',
  recipeDependencies: [...museum.model.recipeDependencies, 'authored-structure-mesh.mjs'],
  buildingCutout: {
    outline: controls.dimensions.outline,
    minimumCoverage: 0.9,
    basis: 'Replace the generic four-sided convent outline with the verified museum shape.',
  },
  sourceLicense:
    'Independent geometry informed by the State Library of Queensland’s out-of-copyright negative, current roof outline and written Queensland Heritage Register.',
};
