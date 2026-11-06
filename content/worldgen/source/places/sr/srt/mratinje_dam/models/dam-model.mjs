import {
  beam,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
export const controls = {
  anchor: [18.842596634, 43.27257545],
  heading: 1.978160431098793,
  datum: 651,
  crestElevation: 678,
  foundation: 458,
  normalPool: 675.25,
  crest: [
    [-100, 12],
    [-91.89217, 5.9998],
    [-72.5083, -5.99856],
    [-62.8478, -10.82745],
    [-46.93246, -16.98251],
    [-35.13507, -20.17899],
    [-23.39648, -22.69053],
    [-8.69112, -24.39545],
    [8.03765, -24.75373],
    [23.59199, -23.4878],
    [34.20672, -21.74882],
    [51.40845, -17.16754],
    [65.72543, -11.93684],
    [79.04025, -5.48116],
    [89.92833, 1.11124],
    [103.8337, 11.13657],
    [122.09068, 27.53832],
    [130.26214, 36.03656],
    [137, 43],
  ],
  // x-center, horizontal span scale, z shift, centerline half-thickness.
  sections: [
    [458, 25, 0.2, 36, 18],
    [510, 25, 0.29, 28, 14],
    [548, 24, 0.4, 21, 11],
    [580, 23, 0.53, 13, 8.2],
    [618, 21, 0.66, 6.2, 5.7],
    [654, 19, 0.84, 1.3, 3.6],
    [678, 18, 1, 0, 2.5],
  ],
  spillways: { centers: [-23, -4, 15], width: 13, height: 5, sill: 670.6 },
  outlets: [
    { elevation: 580, radius: 1.25, stations: [-23, -4, 15] },
    { elevation: 510, radius: 1, stations: [-23, 15] },
  ],
};
const materials = {
  pale: { slot: 'wall', graph: 'concrete_boardformed', rgb: [0.55, 0.559, 0.544] },
  shade: { slot: 'wall', graph: 'concrete_boardformed', rgb: [0.477, 0.484, 0.462] },
  damp: { slot: 'wall', graph: 'concrete_boardformed', rgb: [0.36, 0.374, 0.351] },
  slab: { slot: 'trim', graph: 'concrete_plain', rgb: [0.66, 0.661, 0.609] },
  asphalt: { slot: 'wall', graph: 'concrete_plain', rgb: [0.39, 0.4, 0.378] },
  door: { slot: 'trim', graph: 'metal_painted', rgb: [0.187, 0.227, 0.226] },
  rail: { slot: 'trim', graph: 'metal_painted', rgb: [0.109, 0.267, 0.47] },
  roof: { slot: 'roof', graph: 'metal_standing_seam', rgb: [0.46, 0.107, 0.096] },
  glass: { slot: 'window', graph: 'window_grid', rgb: [0.164, 0.218, 0.246] },
};
export const damSurfaces = Object.fromEntries(
  Object.entries(materials).map(([m, { slot, graph }]) => [m, { slot, graph }]),
);
const tiers = {
  skyline: { detail: 0 },
  district: { detail: 1 },
  street: { detail: 2 },
  closeup: { detail: 3 },
  master: { detail: 4 },
};
const { datum, crest, sections, spillways, outlets } = controls;
const first = crest[0][0],
  last = crest.at(-1)[0];
const lerp = (a, b, t) => a + (b - a) * t;
function at(rows, v) {
  let i = 1;
  while (i < rows.length - 1 && v > rows[i][0]) i++;
  const a = rows[i - 1],
    b = rows[i],
    t = (v - a[0]) / (b[0] - a[0]);
  return a.slice(1).map((x, j) => lerp(x, b[j + 1], t));
}
const y = (h) => h - datum;
export function archPoint(u, h, offset = 0, side = 0) {
  const [center, width, shift, half] = at(sections, h),
    [z] = at(crest, u);
  return [center + (u - 18) * width, y(h), z * width + shift + side * half + offset];
}
function q(out, m, a, b, c, d, n) {
  let pts = [a, b, c, d],
    normal = normalFor(...pts);
  if (normal.reduce((sum, v, i) => sum + v * n[i], 0) < 0) {
    pts = pts.toReversed();
    normal = normalFor(...pts);
  }
  out.addQuad(m, 'palette:#ffffff', pts, normal, undefined, materials[m].rgb);
}
const rod = (out, m, a, b, w, h) => beam(out, m, a, b, w, h, materials[m].rgb);
function strip(out, m, a, b, h, k, near, far) {
  const A = archPoint(a, h, near),
    B = archPoint(b, h, near),
    C = archPoint(b, h, far),
    D = archPoint(a, h, far),
    E = archPoint(a, k, near),
    F = archPoint(b, k, near),
    G = archPoint(b, k, far),
    H = archPoint(a, k, far);
  q(out, m, A, B, F, E, [0, 0, -1]);
  q(out, m, B, C, G, F, [1, 0, 0]);
  q(out, m, C, D, H, G, [0, 0, 1]);
  q(out, m, D, A, E, H, [-1, 0, 0]);
  q(out, m, E, F, G, H, [0, 1, 0]);
  q(out, m, D, C, B, A, [0, -1, 0]);
}
function shell(out, d, a, b, h, k, side) {
  const xs = [
      a,
      ...crest.filter(([u], i) => u > a && u < b && (d.detail > 0 || i % 2 === 0)).map(([u]) => u),
      b,
    ],
    hs = [h, ...sections.filter(([v]) => v > h && v < k).map(([v]) => v), k];
  for (let i = 1; i < xs.length; i++)
    for (let j = 1; j < hs.length; j++) {
      const u = xs[i - 1],
        v = xs[i],
        l = hs[j - 1],
        r = hs[j],
        m = r <= 548 ? 'damp' : i % 5 === 0 ? 'shade' : 'pale';
      q(
        out,
        m,
        archPoint(u, l, 0, side),
        archPoint(v, l, 0, side),
        archPoint(v, r, 0, side),
        archPoint(u, r, 0, side),
        [0, 0, side],
      );
    }
}
function recessRow(out, d, h, k, ports) {
  let u = first;
  for (const { a, b } of ports) {
    shell(out, d, u, a, h, k, 1);
    u = b;
  }
  shell(out, d, u, last, h, k, 1);
}
function roundPorts(out, d, row) {
  const h = row.elevation,
    r = row.radius,
    scale = at(sections, h)[1],
    margin = r * 1.36,
    ports = row.stations.map((u) => ({ u, a: u - margin / scale, b: u + margin / scale }));
  recessRow(out, d, h - margin, h + margin, ports);
  for (const { u } of ports) {
    const count = d.detail < 2 ? 8 : d.detail < 3 ? 16 : 24;
    for (let j = 0; j < count; j++) {
      const vector = (i) => {
        const a = (i * 2 * Math.PI) / count;
        return [Math.cos(a), Math.sin(a)];
      };
      const point = ([x, v], outer, depth) => {
        const radius = outer ? margin / Math.max(Math.abs(x), Math.abs(v)) : r;
        return archPoint(u + (x * radius) / scale, h + v * radius, depth, 1);
      };
      const a = vector(j),
        b = vector(j + 1),
        A = point(a, true, 0),
        B = point(b, true, 0),
        C = point(b, false, 0),
        D = point(a, false, 0);
      const E = point(a, false, -2.8),
        F = point(b, false, -2.8);
      q(out, 'pale', A, B, C, D, [0, 0, 1]);
      q(out, 'damp', D, C, F, E, [0, 0, 1]);
      const center = archPoint(u, h, -2.8, 1),
        n = normalFor(center, E, F);
      const pts = n[2] > 0 ? [center, E, F] : [center, F, E];
      out.addTriangle(
        'door',
        'palette:#ffffff',
        pts,
        normalFor(...pts),
        undefined,
        materials.door.rgb,
      );
    }
  }
}
function spillwayWorks(out, d) {
  const { centers, width, height, sill } = spillways,
    top = sill + height,
    ports = centers.map((u) => ({ u, a: u - width / 2, b: u + width / 2 }));
  recessRow(out, d, sill, top, ports);
  for (const { u, a, b } of ports) {
    const back = -2.6,
      lip = 2.3;
    const p = (x, h, z) => archPoint(x, h, z, 1);
    q(out, 'door', p(a, sill, back), p(b, sill, back), p(b, top, back), p(a, top, back), [0, 0, 1]);
    q(
      out,
      'damp',
      p(a, sill, back),
      p(b, sill, back),
      p(b, sill - 1.5, lip),
      p(a, sill - 1.5, lip),
      [0, 1, 1],
    );
    q(out, 'slab', p(a, top, back), p(b, top, back), p(b, top, lip), p(a, top, lip), [0, -1, 0]);
    for (const [x, n] of [
      [a, 1],
      [b, -1],
    ]) {
      q(out, 'pale', p(x, sill, back), p(x, sill - 1.5, lip), p(x, top, lip), p(x, top, back), [
        n,
        0,
        0,
      ]);
      const end = x - n * 2.2;
      q(
        out,
        'shade',
        p(x, 643, 2.1),
        p(end, 643, 2.1),
        p(end, 678, 4.2),
        p(x, 678, 4.2),
        [0, 0, 1],
      );
      q(out, 'pale', p(x, 643, 0), p(x, 643, 2.1), p(x, 678, 4.2), p(x, 678, 0), [n, 0, 0]);
    }
    if (d.detail > 0)
      rod(
        out,
        'door',
        p(a + 0.8, top - 1.1, lip - 0.3),
        p(b - 0.8, top - 1.1, lip - 0.3),
        0.48,
        0.52,
      );
    strip(out, 'slab', u - 3.6, u + 3.6, 678.15, 681.4, 5.8, 11.2);
  }
}
function crestRoad(out, d) {
  for (let i = 1; i < crest.length; i++) {
    const a = crest[i - 1][0],
      b = crest[i][0];
    q(
      out,
      'asphalt',
      archPoint(a, 678, -5),
      archPoint(b, 678, -5),
      archPoint(b, 678, 5.7),
      archPoint(a, 678, 5.7),
      [0, 1, 0],
    );
    for (const [s, z] of [
      [-1, -5],
      [1, 5.7],
    ]) {
      q(
        out,
        'slab',
        archPoint(a, 675.9, z - s * 0.9),
        archPoint(b, 675.9, z - s * 0.9),
        archPoint(b, 678, z),
        archPoint(a, 678, z),
        [0, 0, s],
      );
      if (d.detail === 0) continue;
      const rail = (u, h) => archPoint(u, h, z - s * 0.14);
      q(out, 'rail', rail(a, 678.24), rail(b, 678.24), rail(b, 679.05), rail(a, 679.05), [0, 0, s]);
      q(out, 'rail', rail(b, 678.24), rail(a, 678.24), rail(a, 679.05), rail(b, 679.05), [
        0,
        0,
        -s,
      ]);
      if (d.detail > 1)
        for (let x = a; x < b; x += 2.5)
          rod(out, 'rail', rail(x, 678.08), rail(x, 679.14), 0.085, 0.085);
    }
  }
}
function gable(out, m, a, b, h, z, Z) {
  const mid = (z + Z) / 2,
    k = h + 2.1,
    p = archPoint;
  q(out, m, p(a, h, z), p(b, h, z), p(b, k, mid), p(a, k, mid), [0, 1, -1]);
  q(out, m, p(a, k, mid), p(b, k, mid), p(b, h, Z), p(a, h, Z), [0, 1, 1]);
  for (const [x, s] of [
    [a, -1],
    [b, 1],
  ]) {
    const pts = [p(x, h, z), p(x, h, Z), p(x, k, mid)];
    if (normalFor(...pts)[0] * s < 0) pts.reverse();
    out.addTriangle(m, 'palette:#ffffff', pts, normalFor(...pts), undefined, materials[m].rgb);
  }
}
function crestDetails(out, d) {
  for (const [a, b, h] of [
    [34, 59, 682.8],
    [59, 82, 682.0],
  ]) {
    strip(out, 'slab', a, b, 678.05, h, 5.6, 12.2);
    gable(out, 'roof', a - 0.26, b + 0.26, h, 5.25, 12.5);
    if (d.detail > 1)
      for (let u = a + 3; u < b - 2; u += 4.1) {
        q(
          out,
          'glass',
          archPoint(u - 0.48, 679.1, 12.24),
          archPoint(u + 0.48, 679.1, 12.24),
          archPoint(u + 0.48, 680.05, 12.24),
          archPoint(u - 0.48, 680.05, 12.24),
          [0, 0, 1],
        );
      }
  }
  for (const [a, b] of [
    [17, 22],
    [24, 29],
  ])
    strip(out, 'slab', a, b, 678.1, 685.3, 6.1, 10.2);
  if (d.detail > 1) {
    rod(out, 'roof', archPoint(31, 679, 11), archPoint(31, 685, 11), 0.36, 0.36);
    rod(out, 'roof', archPoint(31, 685, 11), archPoint(36, 681, 13), 0.31, 0.31);
    rod(out, 'roof', archPoint(31, 682, 11), archPoint(35, 684, 12.7), 0.17, 0.17);
  }
}
function portal(out, d, center, radius, spring) {
  const profile = [
    [-radius, 678],
    [radius, 678],
    ...Array.from({ length: d.detail < 2 ? 7 : 13 }, (_, i) => {
      const angle = (i * Math.PI) / (d.detail < 2 ? 6 : 12);
      return [Math.cos(angle) * radius, spring + Math.sin(angle) * radius];
    }),
  ];
  const facing = [-0.67, 0, -0.74236];
  const p = ([x, h], z) => [
    center[0] + x * 0.74236 + z * facing[0],
    y(h),
    center[1] - x * 0.67 + z * facing[2],
  ];
  const rim = profile.map(([x, h]) => [
    x === 0 ? 0 : Math.sign(x) * (Math.abs(x) + 0.74),
    h === 678 ? h : h + 0.65,
  ]);
  for (let i = 1; i <= profile.length; i++) {
    const a = i - 1,
      b = i % profile.length;
    if (a === 0) continue;
    q(out, 'slab', p(rim[a], 0), p(rim[b], 0), p(profile[b], 0), p(profile[a], 0), facing);
    q(
      out,
      'shade',
      p(profile[a], 0),
      p(profile[b], 0),
      p(profile[b], -3.9),
      p(profile[a], -3.9),
      facing,
    );
    const points = [p([0, 679.2], -3.9), p(profile[a], -3.9), p(profile[b], -3.9)];
    if (normalFor(...points).reduce((v, x, i) => v + x * facing[i], 0) < 0) points.reverse();
    out.addTriangle(
      'door',
      'palette:#ffffff',
      points,
      normalFor(...points),
      undefined,
      materials.door.rgb,
    );
  }
}
function inspectionGallery(out, d) {
  const p = (u, h, z) => archPoint(u, h, z, 1);
  const xs = [-64, -53, -41, -29, -18, -6, 7, 21, 34, 46, 58];
  for (let i = 1; i < xs.length; i++) {
    const a = xs[i - 1],
      b = xs[i],
      l = 585 + Math.max(0, i - 4) * 0.45;
    q(out, 'slab', p(a, l, 0), p(b, l, 0), p(b, l, 4.8), p(a, l, 4.8), [0, 1, 0]);
    q(
      out,
      'shade',
      p(a, l - 2.15, 4.8),
      p(b, l - 2.15, 4.8),
      p(b, l, 4.8),
      p(a, l, 4.8),
      [0, 0, 1],
    );
    if (d.detail > 1) rod(out, 'rail', p(a, l + 0.85, 4.63), p(b, l + 0.85, 4.63), 0.09, 0.14);
  }
}
export function buildDamLevel(out, level) {
  const d = tiers[level];
  if (!d) throw Error('Unknown Mratinje Dam detail level: ' + level);
  shell(out, d, first, last, 458, 678, -1);
  shell(out, d, first, last, 458, 508.64, 1);
  roundPorts(out, d, outlets[1]);
  shell(out, d, first, last, 511.36, 578.3, 1);
  roundPorts(out, d, outlets[0]);
  shell(out, d, first, last, 581.7, spillways.sill, 1);
  spillwayWorks(out, d);
  shell(out, d, first, last, spillways.sill + spillways.height, 678, 1);
  for (const [u, s] of [
    [first, -1],
    [last, 1],
  ])
    for (let i = 1; i < sections.length; i++) {
      const a = sections[i - 1][0],
        b = sections[i][0],
        p = (h, n) => archPoint(u, h, 0, n);
      q(out, 'shade', p(a, -1), p(a, 1), p(b, 1), p(b, -1), [s, 0, 0]);
    }
  crestRoad(out, d);
  crestDetails(out, d);
  portal(out, d, [132.7, 39.6], 3.75, 680.4);
  portal(out, d, [142.1, 31.1], 2.7, 679.8);
  if (d.detail > 2) {
    for (const x of [9, 20, 34, 47, 59, 73, 87, 101, 113]) {
      const p = (h, z) => archPoint(x, h, z);
      rod(out, 'rail', p(678.2, -4.77), p(684.4, -4.77), 0.1, 0.1);
      rod(out, 'rail', p(684.4, -4.77), p(684.85, -3.1), 0.09, 0.09);
    }
  }
  if (d.detail > 3) {
    for (const x of [-23, -4, 15]) {
      const p = (h, z) => archPoint(x, h, z, 1);
      rod(out, 'door', p(624, 0.09), p(646, 0.09), 0.1, 0.12);
      rod(out, 'door', p(646, 0.09), p(649, 2.65), 0.1, 0.12);
    }
  }
  inspectionGallery(out, d);
}
export const buildDamSkyline = (out) => buildDamLevel(out, 'skyline');
export const buildDamDistrict = (out) => buildDamLevel(out, 'district');
export const buildDamStreet = (out) => buildDamLevel(out, 'street');
export const buildDamCloseup = (out) => buildDamLevel(out, 'closeup');
