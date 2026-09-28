/** Original Avicenna exterior, from official dimensions, published plan and exact site parts. */

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import earcut from 'earcut';
import { beam, loft, radialRing } from './authored-structure-mesh.mjs';
import { face, transform, triangle } from './heritage-tower-detail-mesh.mjs';
import { box } from './structure-mesh.mjs';
import { structureSourcePath } from './structure-source-paths.mjs';

const bytes = readFileSync(structureSourcePath('n0601_avicenna_mausoleum', 'map-frame.json'));
const map = JSON.parse(bytes),
  outline = map.geometry.parts.find((p) => p.id === 698835433).local;
const stone = [0.53, 0.515, 0.46],
  light = [0.68, 0.66, 0.58],
  cement = [0.62, 0.6, 0.52],
  shadow = [0.07, 0.073, 0.068];
const roof = 5.5,
  plinth = 7.5,
  coneBase = 25.1;
const tau = Math.PI * 2;
function rand(i) {
  let v = Math.imul(i + 137, 0x45d9f3b);
  v = Math.imul(v ^ (v >>> 16), 0x45d9f3b);
  return ((v ^ (v >>> 16)) >>> 0) / 4294967295;
}
function cap(out, poly, y, holes = [], color = light, slot = 'avicenna_granite') {
  const rings = [poly, ...holes],
    p = rings.flat(),
    offsets = [];
  let n = poly.length;
  for (const hole of holes) {
    offsets.push(n);
    n += hole.length;
  }
  const indices = earcut(p.flat(), offsets, 2);
  for (let i = 0; i < indices.length; i += 3) {
    let pts = indices.slice(i, i + 3).map((j) => [p[j][0], y, p[j][1]]);
    const a = pts[0],
      b = pts[1],
      c = pts[2];
    if ((b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]) < 0) pts = pts.reverse();
    triangle(out, slot, pts, color);
  }
}
function block(out, x0, x1, y0, y1, z, seed, color = stone) {
  if (x1 - x0 < 0.018 || y1 - y0 < 0.018) return;
  const bevel = Math.min(0.055, (x1 - x0) / 6, (y1 - y0) / 6),
    depth = 0.025 + rand(seed) * 0.045;
  const c = color.map(
    (v, k) => v + (rand(seed + 21) - 0.5) * 0.095 + (k === 0 ? (rand(seed + 51) - 0.5) * 0.025 : 0),
  );
  const front = [
      [x0 + bevel, y0 + bevel, z + depth],
      [x1 - bevel, y0 + bevel, z + depth],
      [x1 - bevel, y1 - bevel, z + depth],
      [x0 + bevel, y1 - bevel, z + depth],
    ],
    back = [
      [x0, y0, z],
      [x1, y0, z],
      [x1, y1, z],
      [x0, y1, z],
    ];
  face(out, 'avicenna_granite', front, c);
  for (let i = 0; i < 4; i++)
    face(out, 'avicenna_granite', [back[i], back[(i + 1) % 4], front[(i + 1) % 4], front[i]], c);
}
function wall(out, a, b, y0, y1, holes = [], seed = 0) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    len = Math.hypot(dx, dz),
    angle = -Math.atan2(dz, dx),
    o = transform(out, angle, [a[0], 0, a[1]]);
  let yy = y0,
    row = 0;
  while (yy < y1 - 0.001) {
    const yn = Math.min(y1, yy + 0.52 + rand(seed + row) * 0.11);
    let x = -((row % 2) * 0.7),
      col = 0;
    while (x < len) {
      const xn = Math.min(len, x + 1.05 + rand(seed + row * 29 + col) * 0.8),
        lo = Math.max(0, x),
        hi = xn;
      const cuts = [
          lo,
          hi,
          ...holes.flatMap((h) => [
            Math.max(lo, Math.min(hi, h.x0)),
            Math.max(lo, Math.min(hi, h.x1)),
          ]),
        ].sort((a, b) => a - b),
        ys = [
          yy,
          yn,
          ...holes.flatMap((h) => [
            Math.max(yy, Math.min(yn, h.y0)),
            Math.max(yy, Math.min(yn, h.y1)),
          ]),
        ].sort((a, b) => a - b);
      for (let k = 1; k < cuts.length; k++)
        for (let j = 1; j < ys.length; j++) {
          const xm = (cuts[k - 1] + cuts[k]) / 2,
            ym = (ys[j - 1] + ys[j]) / 2;
          if (!holes.some((h) => xm > h.x0 && xm < h.x1 && ym > h.y0 && ym < h.y1))
            block(
              o,
              cuts[k - 1] + 0.009,
              cuts[k] - 0.009,
              ys[j - 1] + 0.008,
              ys[j] - 0.008,
              0,
              seed + row * 397 + col * 31,
            );
        }
      x = xn;
      col++;
    }
    yy = yn;
    row++;
  }
  for (const h of holes) {
    const p = [
      [h.x0, h.y0, 0],
      [h.x1, h.y0, 0],
      [h.x1, h.y1, 0],
      [h.x0, h.y1, 0],
    ];
    for (let i = 0; i < 4; i++)
      face(
        o,
        'avicenna_granite',
        [
          p[(i + 1) % 4],
          p[i],
          p[i].map((n, j) => (j === 2 ? n - 0.35 : n)),
          p[(i + 1) % 4].map((n, j) => (j === 2 ? n - 0.35 : n)),
        ],
        light,
      );
    box(o, 'shadow', [h.x0, h.y0, -0.37], [h.x1, h.y1, -0.35], shadow);
  }
}
function stairs(out, a, b, width, y0, y1, count) {
  const angle = -Math.atan2(b[1] - a[1], b[0] - a[0]),
    length = Math.hypot(b[0] - a[0], b[1] - a[1]),
    o = transform(out, angle, [a[0], 0, a[1]]);
  for (let i = 0; i < count; i++)
    box(
      o,
      'avicenna_granite',
      [(length * i) / count, y0, -width / 2],
      [(length * (i + 1)) / count, y0 + ((y1 - y0) * (i + 1)) / count, width / 2],
      light,
    );
}
function ramp(out, a, b, width, y0, y1) {
  const angle = -Math.atan2(b[1] - a[1], b[0] - a[0]),
    l = Math.hypot(b[0] - a[0], b[1] - a[1]),
    o = transform(out, angle, [a[0], 0, a[1]]);
  face(
    o,
    'avicenna_granite',
    [
      [0, y0, width / 2],
      [l, y1, width / 2],
      [l, y1, -width / 2],
      [0, y0, -width / 2],
    ],
    light,
  );
  for (const s of [-1, 1]) {
    face(
      o,
      'avicenna_granite',
      [
        [0, 0, (s * width) / 2],
        [0, y0, (s * width) / 2],
        [l, y1, (s * width) / 2],
        [l, 0, (s * width) / 2],
      ][s > 0 ? 'reverse' : 'slice'](),
      stone,
    );
    beam(
      o,
      'avicenna_granite',
      [0, y0 + 0.2, (s * width) / 2],
      [l, y1 + 0.2, (s * width) / 2],
      0.24,
      0.32,
      light,
    );
  }
  face(
    o,
    'avicenna_granite',
    [
      [l, 0, -width / 2],
      [l, y1, -width / 2],
      [l, y1, width / 2],
      [l, 0, width / 2],
    ],
    stone,
  );
}
function base(out) {
  const passage = [
    [-25.4, -0.9],
    [-7.0, -0.9],
    [-7.0, 1.4],
    [-25.4, 1.4],
  ];
  cap(out, outline, roof, [passage]);
  cap(out, outline, 0.03, [], stone);
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i],
      b = outline[(i + 1) % outline.length];
    if (i === 8 || i === 9) continue;
    wall(out, b, a, 0, roof, [], i * 701);
  }
  // Ten tapered round granite columns face east under the projecting flat portico.
  const x0 = -11.3,
    x1 = 14.15,
    z = 20.12;
  box(out, 'avicenna_granite', [-12.17, 0.93, 16.9], [15.22, 1.08, 20.3], light);
  wall(
    out,
    [-12.2, 16.92],
    [15.25, 16.92],
    1.08,
    roof,
    [
      { x0: 11.35, x1: 15.85, y0: 1.08, y1: 4.58 },
      ...[-8.6, -3.7, 8.8, 12.5].map((x) => ({
        x0: x + 12.2 - 0.73,
        x1: x + 12.2 + 0.73,
        y0: 2.65,
        y1: 4.25,
      })),
    ],
    11203,
  );
  for (let i = 0; i < 10; i++) {
    const x = x0 + ((x1 - x0) * i) / 9;
    loft(
      out,
      'avicenna_granite',
      [
        [1.08, 0.475],
        [1.2, 0.475],
        [5.18, 0.375],
      ].map(([y, r]) => radialRing(y, r, r, 48, [x, z])),
      light,
    );
  }
  box(out, 'avicenna_granite', [-12.25, 5.18, 16.8], [15.3, 5.5, 20.4], light);
  box(out, 'metal', [-0.82, 1.08, 16.56], [3.67, 4.55, 16.61], [0.2, 0.19, 0.155]);
  for (const x of [-0.82, 1.42, 3.66])
    box(out, 'metal', [x - 0.035, 1.08, 16.615], [x + 0.035, 4.55, 16.67], [0.4, 0.35, 0.245]);
  for (const y of [1.65, 2.53, 3.42])
    for (const x of [0.28, 2.53])
      box(
        out,
        'avicenna_granite',
        [x - 0.8, y, 16.675],
        [x + 0.8, y + 0.55, 16.695],
        [0.62, 0.605, 0.55],
      );
  for (const x of [-8.6, -3.7, 8.8, 12.5])
    for (const d of [-0.24, 0.24]) {
      box(
        out,
        'avicenna_granite',
        [x + d - 0.055, 2.63, 16.69],
        [x + d + 0.055, 4.27, 16.77],
        light,
      );
      box(out, 'avicenna_granite', [x - 0.74, 3.18 + d, 16.69], [x + 0.74, 3.27 + d, 16.77], light);
    }
  stairs(out, [1.4, 21.65], [1.4, 20.3], 27.4, 0, 1.08, 6);
  stairs(out, [37.35, 16.45], [37.35, 4.68], 1.42, 0, roof, 33);
  stairs(out, [-12.25, 24.48], [-18.54, 24.48], 2.85, 0, roof, 30);
  stairs(out, [-25.4, 0.25], [-7, 0.25], 2.25, 0, plinth, 43);
  for (const z of [-1.03, 1.54])
    wall(out, [-25.4, z], [-7, z], 0, roof, [], 3031 + Math.round(z * 100));
  for (const sign of [-1, 1]) {
    ramp(out, [sign * 3.2, -12.15], [sign * 22, -12.15], 2.8, 0.08, roof);
    box(
      out,
      'avicenna_granite',
      [sign * 22 - 0.48, roof - 0.18, -13.55],
      [sign * 22 + 0.48, roof, -7.5],
      light,
    );
  }
  // Quiet roof gardens and low stone perimeters are part of the published composition.
  for (const [a, b, c, d] of [
    [10.2, 34, -7.8, 10.8],
    [-23.2, -10.0, 4.4, 20.2],
  ]) {
    box(out, 'turf', [a, roof + 0.025, c], [b, roof + 0.075, d], [0.25, 0.3, 0.19]);
    for (const z of [c - 0.14, d + 0.14])
      box(
        out,
        'avicenna_granite',
        [a - 0.28, roof, z - 0.14],
        [b + 0.28, roof + 0.28, z + 0.14],
        stone,
      );
    for (const x of [a - 0.14, b + 0.14])
      box(out, 'avicenna_granite', [x - 0.14, roof, c], [x + 0.14, roof + 0.28, d], stone);
  }
  for (const x of [-5.5, 5.5])
    for (const z of [-9.3, 11.5]) {
      box(
        out,
        'avicenna_granite',
        [x - 0.42, roof, z - 0.42],
        [x + 0.42, roof + 0.77, z + 0.42],
        stone,
      );
      box(
        out,
        'avicenna_granite',
        [x - 0.62, roof + 0.77, z - 0.62],
        [x + 0.62, roof + 0.95, z + 0.62],
        light,
      );
    }
}
function tower(out) {
  const w = 13.959,
    d = 13.545;
  for (let side = 0; side < 4; side++) {
    const width = side % 2 ? d : w,
      z = side % 2 ? w / 2 : d / 2,
      o = transform(out, (side * Math.PI) / 2);
    const windows = [-3.05, 0, 3.05].map((x) => ({
      x0: x - 1.08,
      x1: x + 1.08,
      y0: roof + 0.67,
      y1: plinth - 0.43,
    }));
    wall(
      o,
      [-width / 2, z],
      [width / 2, z],
      roof,
      plinth - 0.18,
      windows.map((h) => ({ ...h, x0: h.x0 + width / 2, x1: h.x1 + width / 2 })),
      18403 + side * 100,
    );
  }
  box(out, 'avicenna_granite', [-7.11, plinth - 0.18, -6.92], [7.11, plinth, 6.92], light);
  // Each blade has a flat outer face and a rounded inner nose, as shown in the national heritage plan.
  for (let i = 0; i < 12; i++) {
    const o = transform(out, (i * tau) / 12 + Math.PI / 12, [0.44, 0, -0.04]);
    const ring = (y, outer, inner, half) => {
      const p = [
        [outer, y, half],
        [outer, y, -half],
        [inner, y, -half],
      ];
      for (let j = 1; j <= 10; j++) {
        const a = -Math.PI / 2 - (j * Math.PI) / 10;
        p.push([inner + Math.cos(a) * half, y, Math.sin(a) * half]);
      }
      return p;
    };
    loft(
      o,
      'concrete',
      [
        ring(plinth, 3.85, 2.7, 0.19),
        ring(plinth + 0.35, 3.8, 2.71, 0.185),
        ring(23.85, 2.28, 1.6, 0.16),
        ring(coneBase, 2.2, 1.6, 0.16),
      ],
      cement,
    );
  }
  const center = [0.44, -0.04];
  loft(
    out,
    'concrete',
    [
      [23.73, 1.73],
      [23.92, 1.91],
      [24.05, 1.91],
      [24.92, 1.82],
      [25.1, 2.05],
    ].map(([y, r]) => radialRing(y, r, r, 96, center)),
    cement,
  );
  const rings = [];
  for (let j = 0; j <= 24; j++) {
    const t = j / 24,
      r = Math.max(0.016, 2.05 * (1 - t));
    rings.push(radialRing(coneBase + 3.4 * t, r, r, 96, center));
  }
  loft(out, 'concrete', rings, light);
  // Visible rooftop memorial marker; no invented script or interior tomb is added.
  box(out, 'avicenna_granite', [-0.74, plinth, -1.02], [1.5, plinth + 0.28, 0.94], light);
  box(out, 'metal', [-0.53, plinth + 0.28, -0.83], [1.27, plinth + 0.67, 0.75], [0.43, 0.35, 0.19]);
  box(out, 'metal', [-0.57, plinth + 0.67, -0.87], [1.31, plinth + 0.74, 0.79], [0.63, 0.53, 0.32]);
}
function build(out) {
  base(out);
  tower(out);
}
export const avicennaMausoleum = {
  id: 'n0601_avicenna_mausoleum',
  planId: 'N0601',
  title: 'Avicenna Mausoleum',
  wikidata: 'Q5952145',
  authoringFile: 'avicenna-mausoleum-model.mjs',
  build,
  size: [67, 28.5, 40],
  front: 'Native +Z east toward the ten-column entrance; +X approximately north',
  origin: 'Exact mapped raised central platform center; Y=0 exterior ground',
  brief:
    'Open twelve-rib tapered concrete memorial tower and cone above its granite plinth, ten-column eastern portico, asymmetrical stone museum platform, external stairs and paired rear ramps, roof gardens, clerestory apertures and rooftop memorial marker.',
  refs: [
    'https://visitiran.ir/fa/attraction/آرامگاه-ابوعلی-سینا',
    'https://visitiran.ir/attraction/avicenna-museum-ibn-sina-museum',
    'https://whc.unesco.org/uploads/nominations/1398.pdf',
    'https://www.memar.io/fr/magazine/articles/avicenna-mausoleum-hamedan-129',
    'https://artebox.org/seyhoun-03/',
    'https://etoood.com/NewsShow.aspx?nw=3252',
    'https://www.openstreetmap.org/way/698835434',
    'https://www.openstreetmap.org/way/698835433',
  ],
  facts: {
    architect: 'Hooshang Seyhoun',
    completeHeightMeters: 28.5,
    towerAboveMainRoofMeters: 23,
    coneRadiusMeters: 2.05,
    coneHeightMeters: 3.4,
    towerBlades: 12,
    entranceColumns: 10,
    entranceColumnHeightMeters: 4.1,
    entranceColumnBaseDiameterMeters: 0.95,
    entranceColumnTopDiameterMeters: 0.75,
    raisedPlinthHeightMeters: 2,
    mainRoofReconstructedMeters: 5.5,
    centralPlatformMappedMeters: [13.959, 13.545],
    siteFootprint:
      'Q5684744 museum way 698835433 includes connected stone platform; Q5952145 way 698835434 is central raised platform only',
  },
  scaleBasis:
    'Official Persian VisitIran provides the 23 m tower above roof, 2.05 m cone radius, 3.4 m cone height and 4.10 m ten-column entrance. The architect’s 28.5 m composition fixes the overall height. Heritage plan Figure 57 and current official/archive photographs establish the rounded inner faces of twelve tapering ribs. Mapped museum footprint establishes the extended asymmetric base; its 30/33 m tower tags conflict with primary dimensions and are discarded. Stone courses, ramp grades and fine openings are proportional exterior reconstructions.',
  geographicProposal: {
    anchor: map.anchor,
    heading: map.heading,
    source: map.source,
    mapGeometrySource: 'map-frame.json',
    mapGeometryHash: `sha256:${createHash('sha256').update(bytes).digest('hex')}`,
    evidence:
      'Exact Q5952145 central plinth and connected Q5684744 museum footprint; the official east-facing portico fixes the directed phase. The tower center is offset 0.44 m north within the mapped central plinth, consistent with the mapped lower rib envelope.',
    limitations:
      'Host terrain supplies ordinary ground contact. The garden beyond the stone building, separate Aref Qazvini grave and freestanding Avicenna statue are outside this model. Minor stair profiles and roof planting boundaries are reconstructed, not surveyed.',
  },
  limits: [
    'The broad exterior, rib count, cone and portico dimensions are published; stair and ramp grades, roof planting limits, small lightwell widths and individual granite stones are proportioned reconstructions.',
    'The architectural 28.5 m dimension fixes the tower composition; the broader connected museum platform follows the current mapped outline. Its full extent is inferred from the museum mapping rather than forced into a 28.5 m square.',
    'No interior museum displays, library contents, grave chamber, exact inscription glyphs or temporary site furniture are represented.',
  ],
  cameras: [
    { name: 'east-colonnade', position: [65, 33, 90], lookAt: [3, 10, 3] },
    { name: 'western-ramps', position: [-70, 33, -88], lookAt: [3, 10, 3] },
    { name: 'twelve-rib-tower', position: [27, 21, 33], lookAt: [0.44, 17, 0] },
    { name: 'roof-and-stair-plan', position: [6, 92, 12], lookAt: [6, 0, 7] },
    { name: 'column-portico-detail', position: [18, 8, 38], lookAt: [1.4, 3, 18] },
    { name: 'far-silhouette', position: [115, 55, 140], lookAt: [5, 10, 6] },
  ],
};
