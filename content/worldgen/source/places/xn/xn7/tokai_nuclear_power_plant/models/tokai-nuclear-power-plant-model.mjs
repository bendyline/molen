import { readFileSync } from 'node:fs';
import {
  areaSign,
  cap,
  closed,
  edge,
  face,
  mix,
  pairs,
  palette,
  panel,
  pavilion,
  rect,
  ring,
  shell,
  surface,
  trimBlock,
  up,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';

const C = palette({
  mass: 'b5b6ad',
  tall: 'cdd0c7',
  wing: 'b8bcb5',
  band: '858e8d',
  trim: 'cbd1c9',
  glass: '526569',
  frosted: '778886',
  roof: 'a8aea4',
  wall: 'a9aca4',
  cap: 'c0c5be',
  shade: '707c7c',
  chimneyRed: 'a74d3d',
  chimneyPale: 'dedace',
  rim: '6e6e64',
  crown: '6a625b',
});
const surfaces = {
  concrete: surface('wall', 'concrete_panel', 0.86),
  beam: surface('trim', 'concrete_plain', 0.88),
  roof: surface('roof', 'concrete_boardformed', 0.87),
  slab: surface('foundation', 'concrete_plain', 0.91),
  hall: surface('wall', 'metal_corrugated', 0.77, 0.16),
  glass: surface('window', 'storefront', 0.54, 0.04),
  stack: surface('trim', 'metal_painted', 0.68, 0.16),
};
const structure = (color, wall = 'concrete') => ({ wall, color, roof: 'roof', roofColor: C.roof });

function trimBands(out, wall, y, h, heights, lod) {
  for (const [level, thickness] of heights)
    trimBlock(
      out,
      'beam',
      wall,
      0,
      wall.length,
      y + h * level,
      y + h * level + thickness,
      0.009,
      0.31,
      C.trim,
    );
  if (lod < 2 || wall.length < 9) return;
  const n = Math.floor(wall.length / 4.75);
  for (let i = 1; i < n; i++) {
    const u = (i * wall.length) / n;
    panel(out, 'beam', wall, u - 0.032, u + 0.032, y + 0.56, y + h - 0.41, 0.026, C.band);
  }
}

function mainHull(out, d, ground, lod) {
  const { outline, floor, mainHeight, upperHeight } = d;
  const rear = outline.map(([x, z]) => [x * 0.68 + 2.4, z * 0.86 - 1.3]);
  shell(
    out,
    outline,
    (p) => Math.min(ground(p) - 0.28, floor - 0.34),
    floor + mainHeight,
    structure(C.mass),
  );
  shell(out, rear, () => floor + mainHeight - 0.14, floor + upperHeight, structure(C.tall));
  const upperEdge = rear.map(([x, z]) => [x * 1.015, z * 1.021]);
  shell(
    out,
    upperEdge,
    () => floor + upperHeight - 0.57,
    floor + upperHeight + 0.74,
    structure(C.cap),
  );
  const axis = areaSign(outline);
  for (const [index, [a, b]] of pairs(closed(outline)).entries()) {
    const w = edge(a, b, axis);
    trimBands(
      out,
      w,
      floor,
      mainHeight,
      [
        [0.02, 0.43],
        [0.25, 0.47],
        [0.69, 0.31],
        [0.98, 0.37],
      ],
      lod,
    );
    if (lod > 0) {
      const n = Math.max(3, Math.floor(w.length / 9.4));
      for (let i = 0; i < n; i++) {
        const u = ((i + 0.5) * w.length) / n,
          shade = i % 3 === 0 ? C.frosted : C.glass;
        panel(
          out,
          'glass',
          w,
          u - 1.3,
          u + 1.3,
          floor + mainHeight * 0.69 + 0.77,
          floor + mainHeight * 0.69 + 2.18,
          0.041,
          shade,
        );
        if (lod > 1 && (index === 0 || index === 2)) {
          trimBlock(
            out,
            'beam',
            w,
            u - 1.41,
            u + 1.41,
            floor + mainHeight * 0.69 + 0.66,
            floor + mainHeight * 0.69 + 0.76,
            0.012,
            0.14,
            C.trim,
          );
          panel(out, 'slab', w, u - 0.34, u + 0.34, floor + 2.7, floor + 4.26, 0.035, C.band);
        }
      }
    }
  }
  for (const [a, b] of pairs(closed(rear))) {
    const w = edge(a, b, areaSign(rear));
    if (lod === 0) continue;
    const deck = floor + upperHeight - 1.83;
    panel(out, 'glass', w, 0.31, w.length - 0.31, deck, deck + 0.98, 0.036, C.shade);
    if (lod > 1)
      for (let u = 1.3; u < w.length - 0.3; u += lod === 3 ? 1.42 : 2.48)
        panel(out, 'beam', w, u - 0.035, u + 0.035, deck, deck + 0.99, 0.069, C.trim);
  }
}

function hallRoof(out, bounds, y, rise) {
  const [l, a, r, b] = bounds;
  const middle = (l + r) / 2;
  const p = [l - 0.34, y, a - 0.32],
    q = [l - 0.34, y, b + 0.32],
    s = [r + 0.34, y, a - 0.32],
    t = [r + 0.34, y, b + 0.32];
  const head = [middle, y + rise, a - 0.32],
    tail = [middle, y + rise, b + 0.32];
  face(out, 'roof', [p, q, tail, head], up, C.roof);
  face(out, 'roof', [head, tail, t, s], up, C.cap);
  face(out, 'hall', [p, head, s], [0, 0, -1], C.wing);
  face(out, 'hall', [t, tail, q], [0, 0, 1], C.wing);
}

function longHall(out, d, ground, lod) {
  const { longHall: bounds, longHallHeight: height, floor: y } = d;
  const p = rect(...bounds),
    top = y + height;
  shell(out, p, (v) => Math.min(ground(v) - 0.31, y - 0.29), top, structure(C.wing, 'hall'));
  hallRoof(out, bounds, top + 0.045, 1.24);
  for (const [index, [a, b]] of pairs(closed(p)).entries()) {
    const wall = edge(a, b);
    panel(out, 'glass', wall, 0, wall.length, top - 3.55, top - 1.24, 0.039, C.glass);
    if (lod > 0) {
      const spacing = lod === 3 ? 3.12 : 4.24;
      const n = Math.ceil(wall.length / spacing);
      for (let i = 0; i < n; i++) {
        const u = (i * wall.length) / n;
        const band = index % 2 === 0 ? 0.15 : 0.19;
        trimBlock(
          out,
          'beam',
          wall,
          Math.max(0, u - band),
          u + band,
          y + 0.38,
          top - 0.42,
          0.02,
          0.28,
          C.cap,
        );
      }
      trimBlock(out, 'beam', wall, 0, wall.length, y - 0.02, y + 0.71, 0.011, 0.24, C.wall);
    }
    if (lod > 1) {
      trimBlock(out, 'beam', wall, 0, wall.length, top - 3.75, top - 3.54, 0.017, 0.22, C.trim);
      trimBlock(out, 'beam', wall, 0, wall.length, top - 0.89, top - 0.64, 0.021, 0.21, C.trim);
      if (index === 1 || index === 3)
        for (let u = 2.15; u < wall.length - 0.8; u += 5.4)
          panel(out, 'glass', wall, u - 0.64, u + 0.64, y + 3.07, y + 5.96, 0.04, C.frosted);
    }
  }
}

function chimney(out, d, ground, lod) {
  const c = d.chimney;
  const y = Math.max(ground(c), d.floor - 0.21);
  const h = d.chimneyHeight;
  const upperRadius = 1.19,
    lowerRadius = 2.82;
  const n = [12, 18, 24, 30][lod];
  const radius = (offset) => mix(lowerRadius, upperRadius, offset / h);
  const cuts = [0, 36, 43, 51, 59, 67, 75, 83, 89];
  for (const [i, [lo, hi]] of pairs(cuts).entries()) {
    const color = i % 2 === 0 ? C.chimneyPale : C.chimneyRed;
    ring(
      out,
      'stack',
      c,
      [
        [y + lo, radius(lo)],
        [y + hi, radius(hi)],
      ],
      n,
      color,
    );
  }
  if (lod > 0)
    ring(
      out,
      'stack',
      c,
      [
        [y + h - 0.46, upperRadius + 0.065],
        [y + h + 0.048, upperRadius + 0.065],
        [y + h + 0.13, upperRadius - 0.02],
      ],
      n,
      C.chimneyRed,
    );
  const top = Array.from({ length: n }, (_, i) => [
    c[0] + upperRadius * Math.cos((i * Math.PI * 2) / n),
    c[1] + upperRadius * Math.sin((i * Math.PI * 2) / n),
  ]);
  cap(out, 'stack', top, y + h - 0.029, C.crown);
}

function exteriorWings(out, d, ground, lod) {
  const y = d.floor;
  for (const [bounds, h] of [
    [[-24.5, -22.37, 11.7, -15.12], 12.6],
    [[-16.5, 14.24, 23.75, 22.75], 11.9],
    [[19.3, -18.1, 40.8, 12.6], 14.3],
  ]) {
    const corners = rect(...bounds);
    shell(out, corners, (p) => Math.min(y - 0.24, ground(p) - 0.22), y + h, structure(C.mass));
    const w = edge(corners[2], corners[3]);
    if (lod > 0) {
      const n = Math.floor(w.length / 5.08);
      for (let i = 0; i < n; i++) {
        const u = ((i + 0.5) * w.length) / n;
        panel(out, 'glass', w, u - 1.12, u + 1.12, y + 2.15, y + 5.7, 0.033, C.shade);
      }
    }
    if (lod > 1)
      trimBlock(out, 'beam', w, 0, w.length, y + h - 0.41, y + h - 0.09, 0.013, 0.2, C.cap);
  }
}

function draw(out, lod, d, ground) {
  mainHull(out, d, ground, lod);
  longHall(out, d, ground, lod);
  chimney(out, d, ground, lod);
  exteriorWings(out, d, ground, lod);
}

const station = pavilion(
  import.meta.url,
  {
    surfaces,
    camera: [-134, 109, 158],
    lookAt: [-11, 32, 0],
    yaw: -0.87,
    sun: [-430, 650, 430],
    brief:
      'The original Tōkai Power Station silhouette around 1967, with its banded chimney, concrete main hall and long pale industrial hall.',
    views: [
      { name: 'early-station-and-striped-stack', position: [-113, 78, 128], lookAt: [-10, 32, 0] },
      { name: 'long-hall-and-clerestory', position: [-93, 24, 40], lookAt: [-31, 13, 8] },
      { name: 'stack-and-original-concrete-massing', position: [77, 59, 45], lookAt: [6, 44, -3] },
      {
        name: 'site-on-original-japanese-elevation',
        position: [-84, 15, 92],
        lookAt: [-13, 22, 9],
      },
    ],
  },
  draw,
);
export const { skyline, district, street, closeup } = station;
const plan = JSON.parse(readFileSync(new URL('../plan-controls.json', import.meta.url)));
export const model = {
  ...station.model,
  category: 'industrial',
  geographicStatus: 'historical-proposal',
  appearance: {
    kind: 'historical',
    representedDate: plan.representedDate,
    validFrom: plan.validFrom,
    validUntil: plan.validUntil,
    currentWorldEligible: false,
  },
  recipeDependencies: [...station.model.recipeDependencies, 'authored-structure-mesh.mjs'],
  sourceLicense:
    'Independent exterior architecture from the early public-domain U.S. Department of Energy photograph, named historical block mapping, and original Japanese elevation.',
  buildingCutout: {
    outline: plan.dimensions.outline,
    minimumCoverage: 0.91,
    basis:
      'Suppresses coincident generated geometry only at the mapped original main block during the historical date range.',
  },
};
