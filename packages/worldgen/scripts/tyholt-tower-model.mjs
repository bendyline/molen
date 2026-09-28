/** Original Tyholttårnet exterior reconstructed from the owner's photographs. */

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { beam, loft, radialRing, sphere, torus } from './authored-structure-mesh.mjs';
import { face, transform } from './heritage-tower-detail-mesh.mjs';
import { box } from './structure-mesh.mjs';
import { structureSourcePath } from './structure-source-paths.mjs';

const mapBytes = readFileSync(structureSourcePath('n0606_tyholttarnet', 'map-frame.json'));
const map = JSON.parse(mapBytes);
const tau = Math.PI * 2;
const concrete = [0.66, 0.65, 0.6],
  light = [0.76, 0.78, 0.76],
  dark = [0.19, 0.23, 0.245];
const glass = [0.095, 0.145, 0.165],
  white = [0.79, 0.8, 0.75];
const platforms = [29, 37.3, 45.6, 53.9, 62.2];
function cylinder(out, slot, y0, y1, r, color, sides = 72, center = [0, 0]) {
  loft(
    out,
    slot,
    [radialRing(y0, r, r, sides, center), radialRing(y1, r, r, sides, center)],
    color,
  );
}
function radialBeam(out, a, y0, r0, y1, r1, size, color = dark) {
  beam(
    out,
    'metal',
    [Math.cos(a) * r0, y0, Math.sin(a) * r0],
    [Math.cos(a) * r1, y1, Math.sin(a) * r1],
    size,
    size,
    color,
  );
}
function ringRail(out, y, r, count = 48, color = light) {
  for (let i = 0; i < count; i++)
    radialBeam(out, (i * tau) / count, y, r, y + 1.05, r, 0.035, color);
  for (const yy of [y + 0.16, y + 0.54, y + 1.02])
    torus(out, 'metal', [0, yy, 0], r, 0.022, color, 96, 6);
}
function base(out) {
  const outline = map.geometry.outline;
  const ring = (y, scale = 1) => [...outline].reverse().map(([x, z]) => [x * scale, y, z * scale]);
  loft(out, 'concrete', [ring(0), ring(6.5)], [0.45, 0.44, 0.4]);
  loft(out, 'metal', [ring(6.5, 1.025), ring(10.7, 0.48)], [0.69, 0.71, 0.69]);
  // The square roof is independent of the adjacent H-shaped office building.
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i],
      b = outline[(i + 1) % outline.length];
    for (let j = 0; j <= 18; j++) {
      const t = j / 18,
        x = a[0] + (b[0] - a[0]) * t,
        z = a[1] + (b[1] - a[1]) * t;
      beam(
        out,
        'metal',
        [x * 1.026, 6.52, z * 1.026],
        [x * 0.48, 10.72, z * 0.48],
        0.035,
        0.035,
        [0.45, 0.48, 0.47],
      );
    }
  }
  // Shallow sloping glazed roof strip visible in the owner's aerial views.
  face(
    out,
    'glass',
    [
      [-4.1, 7.25, 7.4],
      [3.9, 7.25, 7.4],
      [2.7, 9.2, 5.32],
      [-2.9, 9.2, 5.32],
    ],
    glass,
  );
  for (let i = 0; i <= 8; i++)
    beam(out, 'metal', [-4.1 + i, 7.27, 7.42], [-2.9 + i * 0.7, 9.22, 5.34], 0.055, 0.055, dark);
}
function shaft(out) {
  cylinder(out, 'concrete', 7.5, 80.4, 3.6, concrete, 120);
  // Cast-in-place horizontal lift lines and discrete formwork points.
  for (let y = 11.6; y < 68; y += 1.5)
    torus(out, 'concrete', [0, y, 0], 3.603, 0.014, [0.53, 0.53, 0.49], 120, 4);
  for (let y = 12; y < 66; y += 2.8) {
    for (let i = 0; i < 16; i++) {
      const a = (i * tau) / 16;
      sphere(
        out,
        'concrete',
        [3.6 * Math.cos(a), y, 3.6 * Math.sin(a)],
        [0.027, 0.035, 0.027],
        [0.43, 0.45, 0.43],
        6,
        4,
      );
    }
  }
  // Representative radial maintenance doors, cable ladders and compact panels.
  for (let i = 0; i < 8; i++) {
    const o = transform(out, (i * tau) / 8);
    for (const y of platforms) {
      box(
        o,
        'metal',
        [-0.34, y + 0.31, 3.59],
        [0.34, y + 2.24, 3.66],
        i % 3 ? [0.39, 0.4, 0.36] : [0.4, 0.21, 0.2],
      );
      box(o, 'metal', [0.22, y + 1.17, 3.66], [0.25, y + 1.33, 3.73], light);
    }
    if (i % 2 === 0) {
      for (const x of [-0.2, 0.2])
        beam(o, 'metal', [x, 28, 3.76], [x, 66.8, 3.76], 0.045, 0.045, dark);
      for (let y = 28; y < 66.8; y += 0.36)
        beam(o, 'metal', [-0.2, y, 3.76], [0.2, y, 3.76], 0.025, 0.025, light);
    }
  }
}
function dish(out, angle, y, radius) {
  const o = transform(out, angle);
  const z0 = 4.75,
    depth = radius * 0.2;
  // Shallow concave front and convex protective back, with an independent feed strut.
  const ring = (r, z) =>
    Array.from({ length: 40 }, (_, i) => [
      Math.cos((-i * tau) / 40) * r,
      y + Math.sin((-i * tau) / 40) * r,
      z,
    ]);
  loft(
    o,
    'metal',
    [
      ring(0.025, z0 - depth),
      ring(radius * 0.4, z0 - depth * 0.84),
      ring(radius * 0.75, z0 - depth * 0.43),
      ring(radius, z0),
    ],
    white,
    { cap: false },
  );
  loft(
    o,
    'metal',
    [
      ring(radius, z0 - 0.045),
      ring(radius * 0.4, z0 - depth - 0.12),
      ring(0.025, z0 - depth - 0.17),
    ],
    [0.63, 0.65, 0.62],
  );
  for (let i = 0; i < 40; i++) {
    const a = (i * tau) / 40,
      b = ((i + 1) * tau) / 40;
    beam(
      o,
      'metal',
      [Math.cos(a) * radius, y + Math.sin(a) * radius, z0],
      [Math.cos(b) * radius, y + Math.sin(b) * radius, z0],
      0.025,
      0.025,
      light,
    );
  }
  beam(o, 'metal', [0, y - radius, 4.1], [0, y - radius, z0 + 0.4], 0.055, 0.055, dark);
  beam(o, 'metal', [0, y - radius, z0 + 0.4], [0, y, z0 + 0.48], 0.035, 0.035, light);
  sphere(o, 'metal', [0, y, z0 + 0.47], [0.09, 0.09, 0.16], dark, 12, 6);
  beam(o, 'metal', [0, y - 0.5, 3.65], [0, y - 0.5, 4.55], 0.09, 0.09, dark);
}
function servicePlatforms(out) {
  for (let level = 0; level < platforms.length; level++) {
    const y = platforms[level];
    cylinder(out, 'concrete', y, y + 0.23, 5.65, [0.52, 0.54, 0.52], 96);
    cylinder(out, 'metal', y - 0.1, y, 5.72, dark, 96);
    ringRail(out, y + 0.24, 5.5);
    for (let i = 0; i < 20; i++)
      radialBeam(out, (i * tau) / 20, y - 0.88, 3.6, y - 0.08, 5.45, 0.075, dark);
    const angles = level === 3 ? [0.2, 1.5, 2.8, 3.6, 4.9, 5.5] : [0.45, 1.7, 3.2, 4.5, 5.4];
    angles.forEach((a, i) => {
      dish(out, a + level * 0.15, y + 2.0 + (i % 3) * 0.68, 0.32 + ((level + i) % 4) * 0.29);
    });
    for (let i = 0; i < 10; i++) {
      const o = transform(out, (i * tau) / 10 + level * 0.09);
      beam(o, 'metal', [0, y + 0.24, 4.04], [0, y + 5.6, 4.04], 0.05, 0.05, light);
      if (i % 2 === 0)
        box(o, 'metal', [-0.13, y + 3.2, 4.02], [0.13, y + 4.7, 4.2], [0.68, 0.7, 0.66]);
    }
  }
}
function restaurant(out) {
  cylinder(out, 'concrete', 66.7, 67.55, 5.76, [0.61, 0.61, 0.56], 96);
  const n = 12,
    offset = Math.PI / 12,
    y0 = 68.1,
    y1 = 77.2,
    r0 = 5.7,
    r1 = 8.7;
  loft(
    out,
    'metal',
    [radialRing(67.3, 5.76, 5.76, n, [0, 0], offset), radialRing(y0, r0, r0, n, [0, 0], offset)],
    dark,
  );
  loft(
    out,
    'glass',
    [radialRing(y0, r0, r0, n, [0, 0], offset), radialRing(y1, r1, r1, n, [0, 0], offset)],
    glass,
  );
  const point = (side, t, y, extra = 0) => {
    const a = offset - (side * tau) / n,
      b = offset - ((side + 1) * tau) / n,
      r = r0 + ((r1 - r0) * (y - y0)) / (y1 - y0) + extra;
    return [
      (Math.cos(a) * (1 - t) + Math.cos(b) * t) * r,
      y,
      (Math.sin(a) * (1 - t) + Math.sin(b) * t) * r,
    ];
  };
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= 3; j++)
      beam(
        out,
        'metal',
        point(i, j / 3, y0, 0.035),
        point(i, j / 3, y1, 0.035),
        j === 0 ? 0.13 : 0.055,
        j === 0 ? 0.13 : 0.055,
        light,
      );
    for (let j = 0; j <= 5; j++) {
      const y = y0 + ((y1 - y0) * j) / 5;
      beam(
        out,
        'metal',
        point(i, 0, y, 0.04),
        point(i, 1, y, 0.04),
        j === 0 || j === 5 ? 0.12 : 0.05,
        j === 0 || j === 5 ? 0.12 : 0.05,
        light,
      );
    }
    radialBeam(out, offset - (i * tau) / n, 66.9, 3.63, 68.08, r0, 0.14, [0.41, 0.45, 0.44]);
  }
  loft(
    out,
    'metal',
    [
      radialRing(77.2, 8.78, 8.78, n, [0, 0], offset),
      radialRing(77.42, 8.78, 8.78, n, [0, 0], offset),
      radialRing(79.55, 5.2, 5.2, n, [0, 0], offset),
    ],
    white,
  );
  cylinder(out, 'metal', 79.55, 80.05, 5.18, white, 96);
  cylinder(out, 'concrete', 80.05, 82.0, 2.9, [0.64, 0.64, 0.57], 64);
  cylinder(out, 'metal', 82.0, 82.24, 3.05, light, 64);
  ringRail(out, 79.68, 4.7, 36, dark);
  // Roof seams and shallow rectangular roof lights.
  for (let i = 0; i < n; i++)
    radialBeam(out, offset - (i * tau) / n, 77.43, 8.75, 79.57, 5.2, 0.045, [0.46, 0.49, 0.48]);
  for (let i = 0; i < 6; i++) {
    const o = transform(out, (i * tau) / 6);
    face(
      o,
      'glass',
      [
        [-0.45, 78.41, 7.12],
        [0.45, 78.41, 7.12],
        [0.39, 78.96, 6.17],
        [-0.39, 78.96, 6.17],
      ],
      glass,
    );
  }
}
function mast(out) {
  const levelHeights = [82.15, 85, 88, 91, 94, 97, 100, 103, 106, 109, 112, 115, 118, 121];
  const r = (y) => (y < 94 ? 1.08 : y < 112 ? 1.08 - (y - 94) * 0.03 : 0.54 - (y - 112) * 0.04);
  for (let k = 1; k < levelHeights.length; k++) {
    const a = levelHeights[k - 1],
      b = levelHeights[k],
      r0 = r(a),
      r1 = r(b);
    for (let i = 0; i < 4; i++) {
      const angle = Math.PI / 4 + (i * tau) / 4,
        other = angle + tau / 4;
      const p = (ang, y, rr) => [Math.cos(ang) * rr, y, Math.sin(ang) * rr];
      beam(out, 'metal', p(angle, a, r0), p(angle, b, r1), 0.1, 0.1, dark);
      beam(out, 'metal', p(angle, a, r0), p(other, b, r1), 0.04, 0.04, [0.37, 0.4, 0.4]);
      beam(out, 'metal', p(other, a, r0), p(angle, b, r1), 0.04, 0.04, [0.37, 0.4, 0.4]);
      beam(out, 'metal', p(angle, b, r1), p(other, b, r1), 0.055, 0.055, light);
    }
  }
  for (let y = 83; y < 121; y += 0.35)
    beam(out, 'metal', [-0.18, y, 0.72], [0.18, y, 0.72], 0.024, 0.024, light);
  for (const x of [-0.18, 0.18])
    beam(out, 'metal', [x, 82.2, 0.72], [x, 121, 0.72], 0.035, 0.035, dark);
  for (const [y, rr] of [
    [87, 1.55],
    [95.5, 1.4],
    [105, 1.1],
  ]) {
    cylinder(out, 'metal', y, y + 0.08, rr, dark, 32);
    ringRail(out, y + 0.09, rr * 0.9, 16);
    for (let i = 0; i < 3; i++) {
      const o = transform(out, (i * tau) / 3 + 0.1);
      beam(o, 'metal', [0, y, rr], [0, y + 4.7, rr], 0.055, 0.055, dark);
      box(o, 'metal', [-0.15, y + 1, rr], [0.15, y + 3.7, rr + 0.12], [0.51, 0.55, 0.55]);
    }
  }
  cylinder(out, 'metal', 120.8, 123.8, 0.1, light, 16);
  sphere(out, 'metal', [0, 123.85, 0], [0.14, 0.15, 0.14], [0.6, 0.1, 0.07], 16, 8);
}
function build(out) {
  base(out);
  shaft(out);
  servicePlatforms(out);
  restaurant(out);
  mast(out);
}
export const tyholtTower = {
  id: 'n0606_tyholttarnet',
  planId: 'N0606',
  title: 'Tyholttårnet',
  wikidata: 'Q1935277',
  authoringFile: 'tyholt-tower-model.mjs',
  build,
  front:
    'Native +X follows the northeast edge of the mapped square base; +Z is southeast. The circular shaft and pod have no unique front',
  origin: 'Center of the co-centered mapped tower parts, Y=0 at exterior ground',
  brief:
    'Trondheim’s 124 m communications tower: narrow cast-concrete shaft, five circular service platforms with rails, dish antennas and cable ladders, twelve-faceted flared restaurant glass, white stepped roof and a tapering steel lattice mast above a square hipped base.',
  refs: [
    'https://trym.no/prosjekt/tyholttarnet/',
    'https://trym.no/wp-content/uploads/2019/12/tarnet.jpg',
    'https://trym.no/wp-content/uploads/2019/12/tyholt-768x701.jpg',
    'https://www.strindahistorielag.no/wiki/index.php/Tyholtt%C3%A5rnet',
    'https://egon.no/historiskebygg',
    'https://www.openstreetmap.org/way/42645747',
    'https://www.openstreetmap.org/way/474904230',
    'https://www.openstreetmap.org/way/474904229',
  ],
  facts: {
    heightMeters: 124,
    opened: 1985,
    shaftDiameterMeters: 7.2,
    projectedPodDiameterMeters: 17.4,
    restaurantFloorMeters: '74 m restaurant history / 75 m owner summary',
    primaryArchitect: 'Nils Christian Ottesen',
    servicePlatforms: 5,
  },
  scaleBasis:
    'The owner establishes 124 m height and 1985 construction, and supplies current full-tower, close-pod and aerial photographs. Strinda historical society gives 7.2 m concrete shaft diameter. The larger co-centered map ring establishes the 17.4 m projected pod diameter and the square base establishes orientation. The mapped restaurant/shaft classifications are reversed relative to the photographs; raw tags are preserved in map-frame.json and not used literally. Platform ordinates, mast truss members, intermediate pod heights and minor fittings are proportionally reconstructed from the owner’s photographs, not surveyed dimensions.',
  geographicProposal: {
    anchor: map.anchor,
    heading: map.heading,
    source: map.source,
    mapGeometrySource: 'map-frame.json',
    mapGeometryHash: `sha256:${createHash('sha256').update(mapBytes).digest('hex')}`,
    evidence: map.basis,
    limitations:
      'Ground contact for the tower base; the separately mapped attached office wings are excluded. The rotational tower silhouette has no unique directed phase, while the actual square base supplies the planar axes. Antenna equipment phases are representative.',
  },
  limits: [
    'Current owner photographs determine permanent form. Intermediate platforms, roof and base heights are proportional reconstructions; the 74/75 m restaurant-floor descriptions are compatible approximate public values rather than exact floor survey datums.',
    'Antennas, cable ladders and service fittings form a representative arrangement; telecommunications equipment changes over time. Nighttime projection lighting and restaurant interiors are outside this exterior asset scope.',
    'The low attached H-shaped office building remains a separate mapped building and is not duplicated. Raw map part material/class labels conflict and are explicitly overridden using the photographed narrow shaft and broad flared pod.',
  ],
  cameras: [
    { name: 'southeast-whole', position: [83, 80, 195], lookAt: [0, 60, 0] },
    { name: 'northwest-whole', position: [-130, 78, -177], lookAt: [0, 60, 0] },
    { name: 'restaurant-and-platforms', position: [28, 74, 47], lookAt: [0, 67, 0] },
    { name: 'mast-detail', position: [18, 101, 35], lookAt: [0, 102, 0] },
    { name: 'square-base', position: [28, 20, 31], lookAt: [0, 7, 0] },
    { name: 'roof-plan', position: [8, 160, 13], lookAt: [0, 68, 0] },
    { name: 'far-silhouette', position: [145, 89, 198], lookAt: [0, 58, 0] },
  ],
};
