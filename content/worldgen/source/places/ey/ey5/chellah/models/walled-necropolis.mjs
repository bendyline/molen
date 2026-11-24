import {
  beam,
  loft,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  facade,
  fbox,
  opening,
  outwardRing,
  quad4,
  rgb,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import { cap } from '../../../../r1/r1f/adelaide_railway_station/models/classical.mjs';
import site from '../site-controls.json' with { type: 'json' };

export const surfaces = {
  wall: { slot: 'wall', graph: 'stone_ashlar', roughness: 0.97 },
  earth: { slot: 'wall', graph: 'plaster_lime', roughness: 0.96 },
  relief: { slot: 'trim', graph: 'stone_sandstone', roughness: 0.92 },
  greenTile: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.86 },
  wood: { slot: 'door', graph: 'wood_vertical', roughness: 0.88 },
  water: { slot: 'foundation', localRef: 'palette:#ffffff', roughness: 0.39 },
};

const warm = rgb('b29173'),
  light = rgb('bea082'),
  pale = rgb('c6a88a'),
  shadow = rgb('8f7660');
const earth = rgb('b69174'),
  dark = rgb('765e4c'),
  moss = rgb('807d60'),
  stone = rgb('948675');
const green = rgb('728279'),
  turquoise = rgb('83a397'),
  water = rgb('6d8175');
const gate = facade(site.gate.mid, site.gate.along);

function face(out, slot, f, a, b, y0, y1, d, col) {
  const p = f.P;
  quad4(out, slot, p(a, y0, d), p(b, y0, d), p(b, y1, d), p(a, y1, d), col);
}

function solid(out, ring, lo, hi, slot, color) {
  const boundary = outwardRing(ring);
  for (const [i, a] of boundary.entries()) {
    const f = wallFace(a, boundary[(i + 1) % boundary.length]);
    if (f.length > 0.035) face(out, slot, f, 0, f.length, lo, hi, 0, color);
  }
  cap(out, slot, boundary, hi, color);
}

function pyramid(out, f, u, y, w, d, s, color) {
  const p = f.P;
  const ring = [
    p(u - w / 2, y, d - s / 2),
    p(u - w / 2, y, d + s / 2),
    p(u + w / 2, y, d + s / 2),
    p(u + w / 2, y, d - s / 2),
  ];
  for (const [i, a] of ring.entries())
    tri(out, 'relief', a, ring[(i + 1) % ring.length], p(u, y + w * 0.62, d), color);
}

function merlon(out, f, u, y, w, d, big = false) {
  const s = big ? 0.85 : 0.57,
    h = big ? 1.12 : 0.64;
  fbox(out, 'earth', f, u - w / 2, u + w / 2, y, y + h, d - s / 2, d + s / 2, warm);
  pyramid(out, f, u, y + h, w, d, s, light);
}

function reduceWall(nodes, error) {
  if (nodes.length < 3) return nodes;
  const from = nodes[0],
    to = nodes.at(-1),
    d = to.map((v, i) => v - from[i]);
  const mag = d.reduce((acc, v) => acc + v * v, 0);
  let split = 0,
    largest = error;
  for (let i = 1; i < nodes.length - 1; i++) {
    const relative = nodes[i].map((v, k) => v - from[k]);
    const ratio = Math.max(0, Math.min(1, relative.reduce((s, v, k) => s + v * d[k], 0) / mag));
    const offset = Math.hypot(...relative.map((v, k) => v - ratio * d[k]));
    if (offset > largest) {
      largest = offset;
      split = i;
    }
  }
  return split === 0
    ? [from, to]
    : [
        ...reduceWall(nodes.slice(0, split + 1), error).slice(0, -1),
        ...reduceWall(nodes.slice(split), error),
      ];
}

function curtain(out, detail) {
  const path = site.outline.map(([x, z], i) => [x, z, site.perimeterGrade[i]]);
  const skip = site.gate.missingWallEdges;
  const chain = [...path.slice(skip.at(-1) + 1), ...path.slice(0, skip[0] + 1)];
  const wall = reduceWall(chain, [5.62, 1.27, 0.35, 0.13][detail]);
  for (let i = 1; i < wall.length; i++) {
    const [x, z, y] = wall[i - 1],
      [a, b, c] = wall[i];
    const f = wallFace([x, z], [a, b]),
      l = f.length;
    if (l < 0.045) continue;
    const height = 6.16 - (i % 5 === 1 ? 0.46 : 0),
      h0 = y + height,
      h1 = c + height;
    const p = f.P,
      w = 0.9;
    quad4(out, 'earth', p(0, y - 1.9, w), p(l, c - 1.9, w), p(l, h1, w), p(0, h0, w), earth);
    quad4(out, 'earth', p(l, c - 1.9, -w), p(0, y - 1.9, -w), p(0, h0, -w), p(l, h1, -w), warm);
    quad4(out, 'relief', p(0, h0, w), p(l, h1, w), p(l, h1, -w), p(0, h0, -w), light);
    if (detail === 0) continue;
    const count = Math.floor(l / [1, 11, 4.2, 2.85][detail]);
    for (let k = 0; k < count; k++) {
      const t = (k + 0.5) / count;
      merlon(out, f, l * t, h0 + (h1 - h0) * t - 0.27, 1.26, 0.13);
    }
    if (detail > 1 && l > 8) {
      const n = Math.floor(l / 4.9);
      for (let j = 0; j < n; j++) {
        const t = (j + 0.5) / n,
          u = l * t,
          h0 = y + (c - y) * t + height;
        face(out, 'relief', f, u - 0.075, u + 0.075, h0 - 2.23, h0 - 1.92, w + 0.009, shadow);
      }
    }
  }
}

function gateway(out, detail) {
  const side = 5.6,
    lo = -1.7,
    top = 11.87;
  const front = 0.15,
    back = -10.7;
  const pairs = [
    [1.76, -0.16],
    [1.76, 3.43],
    [2.21, 3.74],
    [2.35, 4.5],
    [2.18, 5.56],
    [1.64, 6.57],
    [0.82, 7.46],
    [0, 8.02],
  ];
  const arch = [...pairs.map(([u, y]) => [-u, y]), ...pairs.slice(0, -1).reverse()];
  for (const d of [front, back]) {
    const reverse = d === back;
    const wall = (a, b, y0, y1) => {
      if (!reverse) face(out, 'wall', gate, a, b, y0, y1, d, warm);
      else {
        const p = gate.P;
        quad4(out, 'wall', p(b, y0, d), p(a, y0, d), p(a, y1, d), p(b, y1, d), warm);
      }
    };
    for (const s of [-1, 1]) wall(s < 0 ? -side : 2.35, s < 0 ? -2.35 : side, lo, top);
    wall(-2.35, -1.76, lo, 3.43);
    wall(1.76, 2.35, lo, 3.43);
    for (let i = 1; i < arch.length; i++) {
      const [a, y] = arch[i - 1],
        [b, h] = arch[i];
      if (Math.abs(a - b) < 0.001) continue;
      const p = gate.P;
      const points = [p(a, y, d), p(b, h, d), p(b, top, d), p(a, top, d)];
      quad4(out, 'wall', ...(reverse ? points.reverse() : points), warm);
    }
  }
  const P = gate.P;
  for (let i = 1; i < arch.length; i++) {
    const [a, y] = arch[i - 1],
      [b, h] = arch[i];
    quad4(out, 'relief', P(a, y, back), P(b, h, back), P(b, h, front), P(a, y, front), shadow);
    if (detail > 0) {
      for (const scale of [1.095, 1.27]) {
        const offset = scale === 1.095 ? 0.12 : 0.21;
        beam(
          out,
          'relief',
          P(a * scale, 3.68 + (y - 3.68) * scale, front + offset),
          P(b * scale, 3.68 + (h - 3.68) * scale, front + offset),
          0.19,
          0.15,
          light,
        );
      }
    }
  }
  fbox(out, 'wall', gate, -side, side, top - 0.56, top, back, front + 0.08, warm);
  for (const s of [-1, 1]) {
    const ax = s * 1.76;
    quad4(
      out,
      'wood',
      P(ax, 0, back - 0.08),
      P(ax * 0.73, 0, back + 3.15),
      P(ax * 0.73, 5.11, back + 3.15),
      P(ax, 5.11, back - 0.08),
      dark,
    );
  }
  for (const ring of site.gate.towers) {
    const r = outwardRing(ring),
      min = -1.68,
      ledge = 14.3;
    solid(out, r, min, ledge, 'wall', warm);
    for (const [i, a] of r.entries()) {
      const f = wallFace(a, r[(i + 1) % r.length]);
      if (f.length < 0.15) continue;
      if (detail > 0 || i % 2 === 0) merlon(out, f, 0.22, ledge - 0.03, 0.66, -0.29, true);
      if (detail === 0) continue;
      fbox(out, 'relief', f, -0.035, f.length + 0.035, ledge - 0.44, ledge, -0.34, 0.29, light);
      fbox(out, 'relief', f, -0.02, f.length + 0.02, 9.34, 9.57, -0.34, 0.14, light);
      if (f.length > 2.4 && detail > 1)
        opening(out, f, f.length * 0.5, 10.35, 1.14, 2.82, {
          head: 'pointed',
          rise: 1.21,
          glassSlot: 'wood',
          frameSlot: 'relief',
          glass: shadow,
          frame: pale,
          frameWidth: 0.13,
          frameDepth: 0.085,
          d: 0.055,
          sill: false,
        });
    }
  }
  if (detail > 0) face(out, 'relief', gate, -side + 0.18, side - 0.18, 9.63, 9.78, 0.26, light);
}

function precinct(out, detail) {
  for (const [i, { outline }] of site.ruins.entries()) {
    const grades = site.ruinGrades[i],
      tall = i === 2 ? 2.95 : i === 12 ? 4.76 : i === 13 ? 3.48 : 1.08 + (i % 5) * 0.27;
    const path = outline.map(([x, z], n) => [x, z, grades[n]]);
    for (const [j, [x, z, y]] of path.entries()) {
      const [u, d, h] = path[(j + 1) % path.length],
        f = wallFace([x, z], [u, d]);
      const L = f.length;
      if (L < 0.06) continue;
      const w = tall > 3 ? 0.58 : 0.4;
      const p = f.P;
      const A = y + tall + (j % 3) * 0.21,
        B = h + tall + (j % 3) * 0.21;
      const a = j === 2 && i % 3 === 1 ? 0.83 : 0;
      quad4(
        out,
        'wall',
        p(a, y - 0.85, w),
        p(L, h - 0.85, w),
        p(L, B, w),
        p(a, A, w),
        j % 2 === 0 ? stone : warm,
      );
      quad4(out, 'wall', p(L, h - 0.85, -w), p(a, y - 0.85, -w), p(a, A, -w), p(L, B, -w), stone);
      quad4(out, 'relief', p(a, A, w), p(L, B, w), p(L, B, -w), p(a, A, -w), pale);
      if (detail > 1 && L > 5) {
        const n = Math.floor(L / 3.7);
        for (let k = 0; k < n; k++) {
          const t = (k + 0.43) / n,
            u = L * t;
          const level = A + (B - A) * t;
          fbox(
            out,
            'wall',
            f,
            u - 0.42,
            u + 0.46,
            level - 0.08,
            level + 0.23 + (k % 3) * 0.13,
            -w + 0.07,
            w - 0.04,
            k % 2 ? stone : shadow,
          );
        }
      }
    }
  }
  for (const [i, { outline }] of site.tombs.entries()) {
    const h = site.tombGrades[i],
      y = h + 1.35 + ((i + 1) % 3) * 0.38;
    solid(out, outline, h - 1.13, y, 'wall', i % 2 ? light : stone);
    const center = outline.reduce(
      ([a, b], [x, z]) => [a + x / outline.length, b + z / outline.length],
      [0, 0],
    );
    const ring = outwardRing(outline).map(([x, z]) => [
      center[0] + 0.64 * (x - center[0]),
      center[1] + 0.64 * (z - center[1]),
    ]);
    if (detail > 0) solid(out, ring, y - 0.026, y + 0.38, 'relief', moss);
  }
  const shore = outwardRing(site.pond);
  cap(out, 'water', shore, site.pondGrade - 0.18, water);
  if (detail > 0)
    for (const [i, a] of shore.entries()) {
      const f = wallFace(a, shore[(i + 1) % shore.length]);
      fbox(
        out,
        'wall',
        f,
        0,
        f.length,
        site.pondGrade - 0.8,
        site.pondGrade + 0.23,
        -0.15,
        0.36,
        stone,
      );
    }
}

function minaret(out, detail) {
  const center = site.minaret.center;
  const az = wallFace(site.ruins[2].outline[0], site.ruins[2].outline[1]).along;
  const point = facade(center, az).P;
  const ring = (r, y) =>
    [
      [-r, -r],
      [-r, r],
      [r, r],
      [r, -r],
    ].map(([a, b]) => point(a, y, b));
  const g = site.minaretGrade;
  loft(
    out,
    'wall',
    [
      [g - 1.6, 2.66],
      [g + 15.98, 2.66],
      [g + 16.28, 2.77],
    ].map(([y, r]) => ring(r, y)),
    stone,
  );
  loft(
    out,
    'greenTile',
    [
      [g + 16.26, 1.03],
      [g + 21.93, 1.0],
      [g + 22.11, 1.122],
    ].map(([y, r]) => ring(r, y)),
    green,
  );
  loft(
    out,
    'relief',
    [
      [g + 22.1, 0.91],
      [g + 22.54, 1.03],
      [g + 23.02, 0.86],
      [g + site.minaret.height, 0.45],
    ].map(([y, r]) => ring(r, y)),
    dark,
  );
  const base = ring(2.664, g).map(([x, , z]) => [x, z]);
  for (const [i, a] of base.entries()) {
    const f = wallFace(a, base[(i + 1) % base.length]);
    for (const u of [1.52, 3.81])
      opening(out, f, u, g + 7.43, 1.13, 3.22, {
        head: 'pointed',
        rise: 0.75,
        glassSlot: 'wood',
        frameSlot: 'relief',
        glass: shadow,
        frame: light,
        sill: false,
        d: 0.036,
        frameWidth: detail > 0 ? 0.17 : 0,
        frameDepth: 0.049,
      });
    if (detail === 0) continue;
    fbox(out, 'relief', f, 0.3, 5.02, g + 11.27, g + 11.44, -0.04, 0.16, light);
    fbox(out, 'relief', f, 0.29, 5.04, g + 15.6, g + 15.82, -0.04, 0.16, light);
    const n = [0, 1, 4, 5][detail];
    const p = f.P;
    for (let u = 0; u < n; u++)
      for (let y = 0; y < n; y++) {
        const w = 4.41 / n,
          h = 3.85 / n,
          x = 0.46 + (u + 0.5) * w,
          b = g + 11.47 + (y + 0.5) * h;
        const rhombus = [
          p(x - w * 0.5, b, 0.09),
          p(x, b + h * 0.5, 0.09),
          p(x + w * 0.5, b, 0.09),
          p(x, b - h * 0.5, 0.09),
        ];
        for (const [i, a] of rhombus.entries())
          beam(out, 'relief', a, rhombus[(i + 1) % 4], 0.083, 0.075, light);
      }
  }
  if (detail > 1) {
    const stem = ring(1.044, g).map(([x, , z]) => [x, z]);
    for (const [i, a] of stem.entries()) {
      const f = wallFace(a, stem[(i + 1) % stem.length]);
      for (const y of [g + 17.21, g + 20.82, g + 21.2])
        face(out, 'greenTile', f, 0.12, 1.97, y, y + 0.18, 0.018, turquoise);
    }
  }
}

function build(out, detail) {
  curtain(out, detail);
  gateway(out, detail);
  precinct(out, detail);
  minaret(out, detail);
}

export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = buildCloseup;
