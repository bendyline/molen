import fs from 'node:fs';
import {
  cap,
  face,
  floorSampler,
  surface,
  up,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';
import {
  abox,
  facade,
  fan,
  quad4,
  rgb,
  roundArch,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';

const read = (name) => JSON.parse(fs.readFileSync(new URL('../' + name, import.meta.url)));
const plan = read('plan-controls.json');
const map = read('map-frame.json');
const terrain = floorSampler(read('terrain-grid.json'));
const parts = read('native-map/tarragona-native-arena-parts.json').mappedParts;
const light = rgb('b5a891');
const medium = rgb('a89a81');
const eroded = rgb('9d927b');
const pale = rgb('b7ad9b');
const rough = rgb('a39681');
const ochre = rgb('b6a080');
const sand = rgb('beb4a2');
const darkSand = rgb('a49a85');
const dark = rgb('716959');
const surfaces = {
  ruin: surface('wall', 'stone_limestone_weathered', 0.96),
  dressed: surface('trim', 'stone_ashlar', 0.94),
  step: surface('trim', 'stone_limestone_weathered', 0.94),
  earth: surface('foundation', 'gravel', 0.98),
  shadow: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.98 },
};
const ellipse = (angle, expand = 0) => [
  (31.25 + expand * 0.9) * Math.cos(angle),
  (19.25 + expand) * Math.sin(angle),
];
const point = ([x, z], y) => [x, y, z];
const scalar = (i, seed) => ((i * seed + 47) % 59) / 58;
const mix = (a, b, t) => a + (b - a) * t;
const midway = (a, b) => [mix(a[0], b[0], 0.5), mix(a[1], b[1], 0.5)];
const ring = (n, expand = 0) =>
  Array.from({ length: n }, (_, i) => ellipse((i * Math.PI * 2) / n, expand));

function wall(out, slot, a, b, low1, low2, top1, top2, normal, tint) {
  face(out, slot, [point(a, low1), point(b, low2), point(b, top2), point(a, top1)], normal, tint);
}

function solid(out, x0, x1, z0, z1, y0, y1, tint, slot = 'ruin') {
  abox(out, slot, [x0, y0, z0], [x1, y1, z1], tint, { bottom: false });
}

function sandAndTrenches(out, lod) {
  const edge = ring(lod === 0 ? 24 : 56, 0.09);
  const trenches = [
    [
      [-24.4, -1.1],
      [-24.4, 2.25],
      [0.1, 2.25],
      [0.1, -1.1],
    ],
    [
      [-4.1, -13.65],
      [-4.1, -1.34],
      [-0.85, -1.34],
      [-0.85, -13.65],
    ],
    [
      [-4.1, 2.52],
      [-4.1, 14.04],
      [-0.85, 14.04],
      [-0.85, 2.52],
    ],
  ];
  const floorY = 0.16;
  const coords = [...edge, ...trenches.flat()];
  const indices = earcut(
    coords.flat(),
    trenches.map((_, i) => edge.length + i * 4),
  );
  for (let i = 0; i < indices.length; i += 3) {
    face(
      out,
      'earth',
      indices.slice(i, i + 3).map((index) => point(coords[index], floorY)),
      up,
      i % 17 ? sand : light,
    );
  }
  for (const [k, trench] of trenches.entries()) {
    const bottom = k ? -1.91 : -2.46;
    cap(out, 'earth', trench, bottom, darkSand);
    const center = midway(trench[0], trench[2]);
    for (let i = 0; i < trench.length; i++) {
      const a = trench[i],
        b = trench[(i + 1) % trench.length];
      const m = midway(a, b);
      wall(
        out,
        'ruin',
        a,
        b,
        bottom,
        bottom,
        floorY,
        floorY,
        [center[0] - m[0], 0, center[1] - m[1]],
        eroded,
      );
    }
    if (lod >= 2 && !k) {
      solid(out, -13.81, -13.48, -1.02, 2.19, -2.48, -1.36, medium, 'dressed');
      solid(out, -21.1, -20.44, -1.02, 2.19, -2.48, -1.18, medium, 'dressed');
    }
  }
}

function podium(out, lod) {
  const extents = [
    [0.17, 0.84, 1.65],
    [0.92, 3.03, 2.54],
    [3.24, 4.61, 1.12],
    [4.92, 6.02, 1.4],
  ];
  for (const [start, finish, height] of extents) {
    const n = Math.ceil((finish - start) * (lod ? 12 : 6));
    for (let i = 0; i < n; i++) {
      const a = mix(start, finish, i / n),
        b = mix(start, finish, (i + 1) / n);
      const A = ellipse(a),
        B = ellipse(b),
        C = ellipse(b, 0.7),
        D = ellipse(a, 0.7);
      const center = midway(A, B);
      const h1 = height + 0.24 * Math.sin(a * 3.2) + (scalar(i, 11) - 0.5) * 0.24;
      const h2 = height + 0.24 * Math.sin(b * 3.2) + (scalar(i + 1, 11) - 0.5) * 0.24;
      wall(
        out,
        'dressed',
        A,
        B,
        -0.12,
        -0.12,
        h1,
        h2,
        [-center[0], 0, -center[1]],
        i % 5 ? medium : rough,
      );
      face(out, 'ruin', [point(A, h1), point(B, h2), point(C, h2), point(D, h1)], up, pale);
    }
  }
}

const seatEnds = [1.04, 4.12];
const seatSpread = 15.1;
const seatPoint = (a, r) => ellipse(a, 1.0 + r * seatSpread);
const remainingSeatWidth = (a) => 1 - Math.max(0, a - 3.73) * 0.48;
const approachOpening = [
  [-51.8, -2.49],
  [-31, -2.49],
  [-31, 1.5],
  [-51.8, 1.5],
];

function seatOpening() {
  const samples = Array.from({ length: 37 }, (_, index) => mix(...seatEnds, index / 36));
  return [
    ...samples.map((angle) => ellipse(angle, -0.12)),
    ...samples.reverse().map((angle) => seatPoint(angle, remainingSeatWidth(angle) - 0.008)),
  ];
}

function cavea(out, lod) {
  const n = [23, 43, 65, 87][lod],
    rows = [2, 5, 8, 12][lod];
  const crest = (angle) => {
    const upSlope = Math.max(0, -Math.sin(angle));
    return 7.25 + 3.7 * upSlope + 1.1 * Math.cos(angle - 2.55);
  };
  const y = (a, r) => 2.58 + (crest(a) - 2.58) * r;
  for (let i = 0; i < n; i++) {
    const a = mix(...seatEnds, i / n),
      b = mix(...seatEnds, (i + 1) / n),
      mid = (a + b) / 2;
    const far = remainingSeatWidth(mid);
    const outerWall = i % 11 === 7 ? rough : eroded;
    // The higher southern vault is open below a narrow strip of conserved seats.
    const vault = mid > 1.34 && mid < 1.54;
    for (let j = 0; j < rows; j++) {
      const r1 = (far * j) / rows,
        r2 = (far * (j + 1)) / rows;
      const q = seatPoint(a, r1),
        p = seatPoint(b, r1),
        s = seatPoint(b, r2),
        t = seatPoint(a, r2);
      const lowA = y(a, r1),
        lowB = y(b, r1),
        topA = y(a, r2),
        topB = y(b, r2);
      const tint = (i * 3 + j) % 21 < 3 ? rough : j % 4 === 2 ? light : pale;
      if (lod === 0) {
        face(
          out,
          'step',
          [point(q, lowA), point(p, lowB), point(s, topB), point(t, topA)],
          up,
          tint,
        );
      } else if (!vault || r2 < 0.3 || r1 > 0.71) {
        const m = midway(q, p);
        wall(
          out,
          'dressed',
          q,
          p,
          lowA,
          lowB,
          topA,
          topB,
          [-m[0], 0, -m[1]],
          j % 5 ? medium : eroded,
        );
        face(
          out,
          'step',
          [point(q, topA), point(p, topB), point(s, topB), point(t, topA)],
          up,
          tint,
        );
      }
    }
    const a1 = seatPoint(a, far),
      b1 = seatPoint(b, far),
      m = midway(a1, b1);
    const outMinA = Math.min(-0.12, terrain(a1) - 1.2);
    const outMinB = Math.min(-0.12, terrain(b1) - 1.2);
    if (m[0] >= -41 || Math.abs(m[1] + 0.72) >= 2.65) {
      wall(out, 'ruin', a1, b1, outMinA, outMinB, y(a, far), y(b, far), [m[0], 0, m[1]], outerWall);
    }
  }
  // Broken ends of the arc remain as vertical stone rather than tapering to an invented circular bowl.
  for (const [a, sgn, scale] of [
    [seatEnds[0], 1, 1],
    [seatEnds[1], -1, remainingSeatWidth(seatEnds[1])],
  ]) {
    for (let j = 0; j < rows; j++) {
      const t = j / rows,
        u = (j + 1) / rows;
      const p = seatPoint(a, t * scale),
        q = seatPoint(a, u * scale);
      const top = y(a, u * scale);
      wall(
        out,
        'ruin',
        p,
        q,
        Math.min(terrain(p) - 0.6, -0.18),
        Math.min(terrain(q) - 0.6, -0.18),
        top,
        top,
        [sgn * Math.sin(a), 0, -sgn * Math.cos(a)],
        eroded,
      );
    }
  }
}

function archPortal(out, f, w, h, base, crown, depth, lod, options = {}) {
  const { halfSpan = w / 2 + 1.5, surround = 0.27, backing = false, sideColor = medium } = options;
  const half = w / 2,
    spring = base + h - half;
  const segments = [4, 6, 8, 12][lod];
  const inside = roundArch(half, segments),
    outside = roundArch(half + surround, segments);
  const p = (a, d = 0) => f.P(a[0], spring + a[1], d);
  const panel = (l, r, y, h, d = 0) =>
    quad4(out, 'ruin', f.P(l, y, d), f.P(r, y, d), f.P(r, h, d), f.P(l, h, d), sideColor);
  panel(-halfSpan, -half - surround, base, crown);
  panel(half + surround, halfSpan, base, crown);
  panel(-half - surround, -half, base, spring);
  panel(half, half + surround, base, spring);
  for (let i = 0; i < inside.length - 1; i++) {
    const a = inside[i],
      b = inside[i + 1],
      c = outside[i],
      d = outside[i + 1];
    quad4(
      out,
      'dressed',
      p(a, 0.018),
      p(b, 0.018),
      p(d, 0.018),
      p(c, 0.018),
      i % 3 ? light : ochre,
    );
    quad4(out, 'ruin', p(c), p(d), f.P(d[0], crown), f.P(c[0], crown), sideColor);
    quad4(out, 'ruin', p(b), p(a), p(a, -depth), p(b, -depth), eroded);
  }
  quad4(
    out,
    'ruin',
    f.P(-half, spring),
    f.P(-half, base),
    f.P(-half, base, -depth),
    f.P(-half, spring, -depth),
    medium,
  );
  quad4(
    out,
    'ruin',
    f.P(half, base),
    f.P(half, spring),
    f.P(half, spring, -depth),
    f.P(half, base, -depth),
    medium,
  );
  if (backing) {
    fan(
      out,
      'shadow',
      [
        f.P(-half, base, -depth),
        f.P(half, base, -depth),
        ...inside
          .slice()
          .reverse()
          .map((a) => p(a, -depth)),
      ],
      dark,
    );
  }
}

function access(out, lod) {
  const pathStations = [
    [-52, 3.38],
    [-45.58, 2.13],
    [-37.2, 1.12],
    [-30.45, 0.15],
  ];
  for (let i = 0; i + 1 < pathStations.length; i++) {
    const [a, y] = pathStations[i],
      [b, yy] = pathStations[i + 1];
    face(
      out,
      'earth',
      [
        [a, y, -2.63],
        [b, yy, -2.63],
        [b, yy, 1.68],
        [a, y, 1.68],
      ],
      up,
      sand,
    );
    for (const z of [-2.55, 1.58]) {
      wall(
        out,
        'ruin',
        [a, z],
        [b, z],
        y,
        yy,
        Math.max(y + 0.3, terrain([a, z])),
        Math.max(yy + 0.3, terrain([b, z])),
        [0, 0, z < 0 ? 1 : -1],
        medium,
      );
    }
  }
  const west = facade([-45.58, -0.72], [0, 1]);
  archPortal(out, west, 3.4, 4.5, 2.15, 7.96, 3.4, lod, { halfSpan: 5.68 });
  for (const [z, y] of [
    [-5.34, 6.52],
    [3.42, 6.05],
  ]) {
    solid(out, -50.33, -43.5, z, z + 2.02, 0.82, y, rough);
    if (lod > 0) solid(out, -49.28, -46.78, z - 0.1, z + 2.12, y, y + 0.26, pale, 'dressed');
  }
  const east = facade([37.65, 1.15], [0, 1]);
  archPortal(out, east, 2.55, 3.28, 1.71, 6.41, 2.9, lod, {
    halfSpan: 4.52,
    sideColor: ochre,
    backing: true,
  });
  const vault = facade([5.82, 25.25], [-1, 0]);
  archPortal(out, vault, 2.72, 2.91, 3.56, 7.22, 2.67, lod, { halfSpan: 2.33, backing: true });
  solid(out, 4.28, 7.38, 26.7, 29.08, 6.87, 7.18, rough);
  solid(out, 2.61, 4.44, 25.72, 27.62, 3.25, 6.65, rough);
  solid(out, 7.26, 8.76, 25.82, 27.65, 3.29, 6.6, rough);
}

function ruinWall(out, a, b, y0, y1, width, lod, seed) {
  const f = wallFace(a, b);
  const n = Math.max(1, Math.ceil(f.length / (lod === 3 ? 1.2 : lod === 2 ? 2.36 : 5.1)));
  const f2 = wallFace(b, a);
  for (let i = 0; i < n; i++) {
    const u = (f.length * i) / n,
      v = (f.length * (i + 1)) / n;
    const h0 = y1 + (scalar(seed + i, 11) - 0.5) * 0.39;
    const h1 = y1 + (scalar(seed + i + 1, 11) - 0.5) * 0.39;
    const a = f.P(u, y0),
      b = f.P(v, y0),
      c = f.P(v, h1),
      d = f.P(u, h0);
    const dd = f.P(u, h0, -width),
      cc = f.P(v, h1, -width);
    quad4(out, 'ruin', a, b, c, d, i % 6 === 4 ? medium : ochre);
    quad4(out, 'ruin', f.P(v, y0, -width), f.P(u, y0, -width), dd, cc, rough);
    face(out, 'dressed', [d, c, cc, dd], up, i % 4 ? light : medium);
  }
  for (const f1 of [f, f2]) {
    if (f1 === f)
      quad4(out, 'ruin', f.P(0, y0, -width), f.P(0, y0), f.P(0, y1), f.P(0, y1, -width), rough);
    else
      quad4(
        out,
        'ruin',
        f.P(f.length, y0),
        f.P(f.length, y0, -width),
        f.P(f.length, y1, -width),
        f.P(f.length, y1),
        rough,
      );
  }
}

function church(out, lod) {
  const walls = parts.church.slice(0, -1);
  const heights = [
    0.69, 1.65, 1.76, 2.66, 1.94, 3.37, 3.54, 4.48, 2.96, 3.93, 4.28, 2.89, 3.66, 2.85, 2.44, 1.46,
  ];
  for (let i = 0; i < walls.length; i++) {
    const a = walls[i],
      b = walls[(i + 1) % walls.length];
    const low = 0.56 + 0.035 * Math.max(0, midway(a, b)[0] - 18);
    ruinWall(
      out,
      a,
      b,
      Math.min(0.12, terrain(a) - 0.18),
      low + heights[i],
      i > 5 && i < 14 ? 1.16 : 0.88,
      lod,
      i * 17,
    );
  }
  const chancel = facade([26.7, 3.53], [0, 1]);
  archPortal(out, chancel, 2.77, 3.06, 0.44, 4.23, 0.94, lod, { halfSpan: 2.7, sideColor: ochre });
  if (lod > 0) {
    for (const [x, z, y] of [
      [19.06, -0.52, 1.4],
      [19.21, 8.64, 1.52],
      [13.71, -0.56, 1.04],
      [13.91, 8.59, 1.17],
      [8.31, -0.77, 0.81],
    ]) {
      solid(out, x, x + 0.88, z, z + 0.82, 0.4, y, light, 'dressed');
    }
  }
  const piers = [
    [
      [32.6, 1.12],
      [32.6, 8.25],
    ],
    [
      [34.7, -3.9],
      [34.7, -0.9],
    ],
    [
      [27.89, 14.38],
      [34.59, 14.38],
    ],
    [
      [20.8, 3.13],
      [27.19, 3.13],
    ],
  ];
  if (lod >= 2)
    for (const [i, edge] of piers.entries())
      ruinWall(out, ...edge, 0.3, 1.16 + i * 0.43, 0.65, lod, 23 + i * 13);
}

function build(out, lod) {
  sandAndTrenches(out, lod);
  podium(out, lod);
  cavea(out, lod);
  access(out, lod);
  church(out, lod);
}
export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'tarragona-amphitheatre-model.mjs';
const camera = [-74, 32, -49],
  lookAt = [0, 2.75, 0];
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'landmark',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: map.terrainContact.basis,
  brief:
    'The surviving seaward-facing Roman amphitheatre of Tarraco with elliptical seating, vaulted approaches and medieval church ruins in the arena.',
  camera,
  lookAt,
  sunDirection: [-73, 72, -41],
  mediumFiContext: {
    scale: 1,
    groundY: -0.15,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: parts.outerRuins.slice(0, -1),
    minimumCoverage: 0.9,
    basis: 'The mapped masonry footprint inside the Roman archaeological site.',
  },
  groundCutout: {
    outline: ring(48, 0.12),
    additionalOutlines: [seatOpening(), approachOpening],
    minHeight: -2.96,
    basis:
      'Limited to the recessed elliptical arena, the inside face of the measured seating bank and the access passage. The surrounding terrain is unchanged.',
  },
  embeddedCanonicalGraphs: ['stone_limestone_weathered', 'stone_ashlar', 'gravel'],
  recipeDependencies: [
    'place-recipe-kit.mjs',
    'montreal-museum-pavilion-geometry.mjs',
    'polygon-triangulation.mjs',
  ],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'western-approach-and-seaward-stone-seating', position: camera, lookAt },
    {
      name: 'standing-medieval-church-and-arena-passages',
      position: [-13, 12, -21],
      lookAt: [20, 1.7, 4],
    },
    { name: 'restored-west-axial-vault', position: [-61, 23, -7.5], lookAt: [-43, 5.1, -0.72] },
    { name: 'mapped-seating-and-arena-from-above', position: [-28, 89, -22], lookAt: [4, 0, 1] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'tarragona-arena-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.86,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.42, surfaces },
      street: { export: 'street', errorMeters: 0.19, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.062, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original model from author-dedicated CC0 photography, ODbL OpenStreetMap archaeological geometry, and attributed Spanish national geographic elevation data.',
};
