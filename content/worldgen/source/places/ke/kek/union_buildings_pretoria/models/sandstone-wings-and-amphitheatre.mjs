import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  extrude,
  facade,
  fbox,
  lathe,
  outwardRing,
  quad4,
  rgb,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import { clock } from '../../../../r1/r1f/adelaide_railway_station/models/classical.mjs';
import site from '../site-controls.json' with { type: 'json' };

export const surfaces = {
  sandstone: { slot: 'wall', graph: 'stone_sandstone', roughness: 0.95 },
  foundation: { slot: 'foundation', graph: 'stone_ashlar', roughness: 0.97 },
  tile: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.93 },
  trim: { slot: 'trim', graph: 'stone_limestone', roughness: 0.91 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.85 },
  glazing: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.57 },
};
const sand = rgb('b7a891');
const chalk = rgb('d0c2a9');
const dark = rgb('968877');
const roof = rgb('ab7866');
const crown = rgb('a79880');
const glass = rgb('5d6263');
const lite = rgb('c1ae93');
const paving = rgb('b9ae9a');
const mix = (a, b, t) => a + (b - a) * t;
const line = (a, b, t) => a.map((v, i) => mix(v, b[i], t));
const xz = ([x, , z]) => [x, z];
const point = ([x, z], y) => [x, y, z];
const eave = 15.18;

function horizontalCap(out, slot, ring, holes, y, shade) {
  const b = new MeshBufferBuilder();
  if (
    !b.addCap(
      'roof',
      'palette:#ffffff',
      ring,
      holes,
      () => y,
      [0, 1, 0],
      (p) => p,
      shade,
    )
  )
    throw new Error('The mapped wing or terrace could not be triangulated');
  const { positions, indices } = b.finalize();
  for (let i = 0; i < indices.length; i += 3) {
    const [a, b, c] = Array.from(indices.subarray(i, i + 3), (j) =>
      positions.subarray(j * 3, j * 3 + 3),
    );
    tri(out, slot, a, b, c, shade);
  }
}

function panel(out, slot, f, u, U, y, Y, d, c) {
  quad4(out, slot, f.P(u, y, d), f.P(U, y, d), f.P(U, Y, d), f.P(u, Y, d), c);
}

function hip(out, f, [u, d, U, D], y, h) {
  const a = Math.min((U - u) / 4, 3.9),
    b = Math.min((D - d) / 4, 3.55);
  const l = [f.P(u, y, D), f.P(U, y, D), f.P(U, y, d), f.P(u, y, d)];
  const r = [
    f.P(u + a, h, D - b),
    f.P(U - a, h, D - b),
    f.P(U - a, h, d + b),
    f.P(u + a, h, d + b),
  ];
  for (let i = 0; i < 4; i++) quad4(out, 'tile', l[i], l[(i + 1) % 4], r[(i + 1) % 4], r[i], roof);
  quad4(out, 'tile', ...r, roof);
}

function facadeBays(out, f, detail, inner) {
  const n = Math.max(1, Math.round(f.length / (inner ? 3.82 : 4.49))),
    w = f.length / n;
  for (let i = 0; i < n; i++) {
    const u = (i + 0.5) * w,
      a = u - 0.66,
      b = u + 0.66;
    for (const [j, [y, h]] of [
      [2.9, 1.53],
      [5.86, 2.26],
      [9.41, 2.14],
      [12.71, 1.79],
    ].entries()) {
      if (detail === 1 && j === 0) continue;
      panel(out, 'glazing', f, a, b, y, y + h, 0.034, glass);
      if (detail > 1 && !inner) {
        if (detail === 3)
          fbox(out, 'trim', f, a - 0.16, b + 0.16, y - 0.129, y - 0.035, 0.037, 0.238, chalk);
        else panel(out, 'trim', f, a - 0.16, b + 0.16, y - 0.129, y - 0.035, 0.096, chalk);
        panel(out, 'trim', f, a - 0.13, b + 0.13, y + h + 0.022, y + h + 0.137, 0.094, lite);
        if (detail === 3) {
          for (const x of [a, u, b])
            panel(out, 'trim', f, x - 0.04, x + 0.042, y + 0.006, y + h, 0.1, chalk);
          panel(out, 'trim', f, a, b, y + h * 0.49, y + h * 0.49 + 0.054, 0.113, chalk);
        }
      }
    }
    if (detail > 1 && !inner && i > 0) {
      const x = i * w;
      fbox(out, 'sandstone', f, x - 0.214, x + 0.214, 4.63, 14.57, 0.011, 0.25, sand);
    }
  }
}

function wing(out, w, detail) {
  const { outline, courts, roofs } = w;
  const f = facade(w.frame.origin, w.frame.along);
  extrude(out, 'sandstone', outline, detail === 0 ? -13.6 : 2.48, eave, sand, {
    holes: courts,
    top: false,
  });
  if (detail > 0)
    extrude(out, 'foundation', outline, -13.6, 2.48, dark, { holes: courts, top: false });
  horizontalCap(out, 'tile', outline, courts, eave, roof);
  for (const [i, r] of roofs.entries()) hip(out, f, r, eave - 0.024, i > 1 ? 18.09 : 17.81);
  if (detail === 0) return;
  for (const [i, r] of [outline, ...courts].entries()) {
    if (detail === 1 && i > 0) continue;
    const walk = outwardRing(r);
    if (i > 0) walk.reverse();
    for (const [j, a] of walk.entries()) {
      const f = wallFace(a, walk[(j + 1) % walk.length]);
      if (f.length < 4.65) continue;
      facadeBays(out, f, detail, i > 0);
      if (i > 0) continue;
      for (const [y, h] of [
        [2.46, 0.35],
        [4.63, 0.22],
        [11.99, 0.29],
        [14.73, 0.46],
      ]) {
        if (detail === 1 && h < 0.4) continue;
        if (detail === 1) panel(out, 'trim', f, 0, f.length, y, y + h, 0.15, chalk);
        else fbox(out, 'trim', f, 0, f.length, y, y + h, 0.024, 0.24, chalk);
      }
    }
  }
}

function walk(path) {
  let length = 0;
  const segments = path.slice(1).map((end, i) => {
    const a = path[i],
      start = length;
    length += Math.hypot(end[0] - a[0], end[1] - a[1]);
    return { a, end, start, length };
  });
  return {
    length,
    at(t) {
      const u = t * length;
      const segment = segments.find((s) => s.length >= u) ?? segments.at(-1);
      return line(segment.a, segment.end, (u - segment.start) / (segment.length - segment.start));
    },
  };
}

function arcade(out, detail) {
  const n = [7, 15, 25, 30][detail],
    arc = walk(site.courtyard),
    outer = walk(site.outerArc);
  const near = Array.from({ length: n + 1 }, (_, i) => arc.at(i / n));
  const far = Array.from({ length: n + 1 }, (_, i) => outer.at(i / n));
  const wall = near.map((p, i) => line(p, far[i], 0.31));
  const roofRidge = near.map((p, i) => line(p, far[i], 0.58));
  const front = 15.24,
    top = 18.12;
  const service = [...far, ...wall.slice().reverse()];
  extrude(out, 'sandstone', service, detail === 0 ? -11.9 : 2.56, front + 0.04, sand, {
    top: false,
  });
  if (detail > 0) extrude(out, 'foundation', service, -11.9, 2.56, dark, { top: false });
  for (let i = 0; i < n; i++) {
    const a = near[i],
      b = near[i + 1],
      c = roofRidge[i + 1],
      d = roofRidge[i];
    quad4(out, 'tile', point(a, front), point(b, front), point(c, top), point(d, top), roof);
    quad4(
      out,
      'tile',
      point(d, top),
      point(c, top),
      point(far[i + 1], front),
      point(far[i], front),
      roof,
    );
    quad4(
      out,
      'sandstone',
      point(b, front),
      point(a, front),
      point(wall[i], front - 0.013),
      point(wall[i + 1], front - 0.013),
      dark,
    );
    const f = wallFace(a, b);
    quad4(
      out,
      'foundation',
      point(a, 2.49),
      point(b, 2.49),
      point(wall[i + 1], 2.49),
      point(wall[i], 2.49),
      paving,
    );
    const y = 2.49,
      shaftHeight = 12.98;
    const rail = wallFace(wall[i], wall[i + 1]);
    const u = rail.length / 2;
    if (detail > 0) {
      panel(out, 'glazing', rail, u - 0.71, u + 0.71, 4.33, 7.64, 0.052, glass);
      panel(out, 'glazing', rail, u - 0.71, u + 0.71, 9.04, 12.12, 0.052, glass);
    }
    const column = line(a, wall[i], 0.11);
    if (detail === 0) {
      const p = facade(column, f.along);
      fbox(out, 'trim', p, -0.47, 0.47, y, shaftHeight, -0.48, 0.48, chalk);
    } else {
      lathe(
        out,
        'trim',
        column,
        [
          [y, 0.62, 0.62],
          [y + 0.32, 0.59, 0.59],
          [y + 0.65, 0.48, 0.48],
          [shaftHeight - 0.57, 0.43, 0.43],
          [shaftHeight, 0.57, 0.57],
        ],
        detail > 1 ? 8 : 6,
        chalk,
        { capTop: false },
      );
      const p = facade(column, f.along);
      if (detail > 1)
        fbox(
          out,
          'trim',
          p,
          -0.64,
          0.64,
          shaftHeight - 0.065,
          shaftHeight + 0.38,
          -0.628,
          0.633,
          chalk,
        );
    }
    fbox(out, 'sandstone', f, 0, f.length, shaftHeight - 0.01, front, -0.53, 0.04, sand);
    fbox(out, 'foundation', f, 0, f.length, -1.83, y, -0.64, 0.104, dark);
    if (detail === 3)
      fbox(out, 'trim', f, 0.03, f.length - 0.03, front - 0.73, front - 0.42, 0.038, 0.225, lite);
  }
}

function tower(out, record, detail) {
  const { center, along, height } = record;
  const F = facade(center, along);
  fbox(out, 'sandstone', F, -4.99, 4.99, 7.8, 26, -4.99, 4.99, sand);
  for (const [x, z] of [
    [-4.26, -4.26],
    [-4.26, 4.26],
    [4.26, -4.26],
    [4.26, 4.26],
  ])
    fbox(out, 'sandstone', F, x - 0.65, x + 0.65, 25.78, 33.59, z - 0.65, z + 0.65, lite);
  fbox(out, 'trim', F, -5.13, 5.13, 33.19, 34.24, -5.13, 5.13, chalk);
  const n = [6, 10, 14, 20][detail];
  lathe(
    out,
    'trim',
    center,
    [
      [34.22, 4.49, 4.49],
      [35.48, 3.92, 3.92],
      [36.62, 3.13, 3.13],
      [37.57, 1.36, 1.36],
      [38.05, 0.66, 0.66],
      [height, 0.095, 0.095],
    ],
    n,
    crown,
  );
  if (detail === 0) return;
  const ring = [
    F.P(-4.97, 0, 4.98),
    F.P(4.97, 0, 4.98),
    F.P(4.97, 0, -4.98),
    F.P(-4.97, 0, -4.98),
  ].map(xz);
  for (const [i, a] of ring.entries()) {
    const f = wallFace(a, ring[(i + 1) % ring.length]);
    const c = f.length * 0.5;
    fbox(out, 'trim', f, 0, f.length, 25.54, 26.18, 0.009, 0.24, lite);
    fbox(out, 'trim', f, c - 0.377, c + 0.38, 26.11, 33.29, -0.57, 0.043, chalk);
    const angle = [0.87, 1.22];
    for (const x of [c - 2.57, c + 2.57]) {
      fbox(out, 'trim', f, x - 0.29, x + 0.3, 26.12, 33.31, -0.61, 0.113, chalk);
      if (detail > 1) fbox(out, 'trim', f, x - 0.48, x + 0.48, 32.76, 33.33, -0.62, 0.326, lite);
    }
    if (i === 0 || detail === 3) clock(out, f, c, 22.2, 1.16, detail);
    if (detail > 1)
      for (const x of [c - 3.18, c + 3.18])
        panel(out, 'glazing', f, x - 0.42, x + 0.42, 15.3, 18.13, 0.17, glass);
    if (detail === 3)
      beam(
        out,
        'metal',
        f.P(c - angle[0], 32.2, -0.35),
        f.P(c + angle[1], 32.2, -0.35),
        0.075,
        0.075,
        glass,
      );
  }
}

function terrace(out, detail) {
  const r = site.podium;
  extrude(out, 'foundation', r, -7.2, 0.61, dark, { top: false });
  horizontalCap(out, 'foundation', r, [], 0.61, paving);
  const f = facade(site.frame.origin, site.frame.along);
  const count = [2, 3, 6, 9][detail];
  for (let j = 0; j < count; j++) {
    const t = j / count;
    fbox(
      out,
      'foundation',
      f,
      -30.43,
      30.43,
      -4.8,
      mix(-0.59, 0.61, (j + 1) / count),
      10.72,
      15.59 - 4.6 * t,
      paving,
    );
  }
}
function build(out, detail) {
  terrace(out, detail);
  for (const w of site.wings) wing(out, w, detail);
  arcade(out, detail);
  for (const t of site.towers) tower(out, t, detail);
}
export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = buildCloseup;
