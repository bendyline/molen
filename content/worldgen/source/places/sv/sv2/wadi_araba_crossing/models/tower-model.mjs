/** Photo-based exterior of the Eilat–Aqaba passenger terminals and their signed gates. */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import {
  beam,
  loft,
  normalFor,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const { default: earcut } = createRequire(
  new URL('../../../../../../../../packages/worldgen/package.json', import.meta.url),
)('earcut');

export const layout = JSON.parse(readFileSync(new URL('../layout.json', import.meta.url)));
export const surfaces = {
  wall: { slot: 'wall', graph: 'plaster_lime', roughness: 0.91 },
  supports: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.9 },
  roof: { slot: 'roof', graph: 'metal_corrugated', roughness: 0.76 },
  trim: { slot: 'trim', graph: 'metal_painted', roughness: 0.76 },
  fence: { slot: 'trim', graph: 'metal_expanded_diamond', roughness: 0.83 },
  glass: { slot: 'window', localRef: 'palette:#2e3b43', name: 'Terminal glass', roughness: 0.43 },
  pavement: { slot: 'foundation', graph: 'concrete_panel', roughness: 0.94 },
};
const tint = {
  cream: [0.88, 0.817, 0.697],
  light: [0.92, 0.902, 0.829],
  pink: [0.76, 0.45, 0.351],
  shade: [0.65, 0.619, 0.544],
  red: [0.71, 0.19, 0.163],
  blue: [0.135, 0.337, 0.55],
  roof: [0.71, 0.736, 0.719],
  glass: [0.16, 0.245, 0.275],
  metal: [0.61, 0.657, 0.635],
  fence: [0.43, 0.504, 0.446],
  gold: [0.77, 0.546, 0.242],
  road: [0.31, 0.296, 0.263],
  line: [0.83, 0.8, 0.695],
  black: [0.15, 0.167, 0.175],
  white: [0.92, 0.932, 0.873],
};
const detail = { skyline: 0, district: 1, street: 2, closeup: 3, master: 4 };
const add = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
function face(out, slot, points, color, normal) {
  let n = normalFor(...points);
  if (normal && n.reduce((s, v, i) => s + v * normal[i], 0) < 0) {
    points = points.toReversed();
    n = n.map((v) => -v);
  }
  if (points.length === 3) out.addTriangle(slot, '', points, n, undefined, tint[color]);
  else out.addQuad(slot, '', points, n, undefined, tint[color]);
}
const area = (ring) =>
  ring.reduce((sum, p, i) => {
    const q = ring[(i + 1) % ring.length];
    return sum + p[0] * q[1] - p[1] * q[0];
  }, 0);
const closedProfile = (ring) => (area(ring) < 0 ? ring : ring.toReversed());
function prism(out, slot, ring, bottom, top, color) {
  const p = closedProfile(ring);
  loft(
    out,
    slot,
    [bottom, top].map((y) => p.map(([x, z]) => [x, y, z])),
    tint[color],
    { cap: false },
  );
  const ix = earcut(p.flat());
  for (let i = 0; i < ix.length; i += 3)
    face(
      out,
      slot,
      ix.slice(i, i + 3).map((j) => [p[j][0], top, p[j][1]]),
      color,
      [0, 1, 0],
    );
}
function polygonRoof(out, p, y, slant, color) {
  const xs = p.map((v) => v[0]),
    zs = p.map((v) => v[1]),
    u = [Math.min(...xs), Math.max(...xs)],
    v = [Math.min(...zs), Math.max(...zs)];
  const alongX = u[1] - u[0] > v[1] - v[0];
  const [a, b] = alongX ? v : u,
    delta = Math.max(0.15, (b - a) / 2);
  const ridge = (a + b) / 2;
  const adjusted = (q) => y + slant * Math.max(0, 1 - Math.abs(q[alongX ? 1 : 0] - ridge) / delta);
  const ix = earcut(p.flat());
  for (let i = 0; i < ix.length; i += 3) {
    const tri = ix.slice(i, i + 3).map((j) => p[j]);
    // Split triangles at the ridge so the shallow roof has a genuine crest.
    const axis = alongX ? 1 : 0;
    for (const sign of [-1, 1]) {
      const clip = [];
      for (let k = 0; k < 3; k++) {
        const l = tri[k],
          r = tri[(k + 1) % 3],
          s = sign * (l[axis] - ridge),
          t = sign * (r[axis] - ridge);
        if (s >= 0) clip.push(l);
        if (s * t < 0) clip.push(add(l, r, s / (s - t)));
      }
      for (let k = 1; k + 1 < clip.length; k++)
        face(
          out,
          'roof',
          [clip[0], clip[k], clip[k + 1]].map((q) => [q[0], adjusted(q), q[1]]),
          color,
          [0, 1, 0],
        );
    }
  }
  for (let i = 0; i < p.length; i++) {
    const q = p[i],
      r = p[(i + 1) % p.length];
    const n = [q[1] - r[1], 0, r[0] - q[0]];
    face(
      out,
      'roof',
      [
        [q[0], y - 0.25, q[1]],
        [q[0], adjusted(q), q[1]],
        [r[0], adjusted(r), r[1]],
        [r[0], y - 0.25, r[1]],
      ],
      color,
      n,
    );
  }
}
function building(out, b, d) {
  const { ring, center, grade, bottom, height, canopy, main, side } = b,
    top = grade + height;
  const p = closedProfile(ring);
  const roof = p.map((q) => add(center, q, main ? 1.02 : 1.012));
  const west = side === 'west';
  if (canopy) {
    if (d === 0) prism(out, 'roof', roof, top - 0.28, top, west ? 'roof' : 'blue');
    else polygonRoof(out, roof, top, 0.55, west ? 'roof' : 'blue');
    const long = roof.toSorted((a, b) => a[0] - b[0]),
      a = long[0],
      z = long.at(-1);
    const count =
      d === 0 ? 2 : d === 1 ? 4 : Math.max(4, Math.ceil(Math.hypot(a[0] - z[0], a[1] - z[1]) / 6));
    for (let i = 0; i < count; i++) {
      const [x, q] = add(a, z, (i + 0.18) / (count - 0.64));
      box(
        out,
        'trim',
        [x - 0.12, bottom, q - 0.12],
        [x + 0.12, top, q + 0.12],
        tint[west ? 'red' : 'light'],
      );
    }
    return;
  }
  prism(out, 'wall', p, bottom, top, west ? 'cream' : 'light');
  const raised = main ? 0.64 : b.height > 3 ? 0.25 : 0.05;
  if (d === 0 && main && west)
    prism(out, 'roof', roof, top - 0.13, top + 0.08, west ? 'roof' : 'blue');
  else if (d !== 0) polygonRoof(out, roof, top, raised, west ? 'roof' : 'blue');
  if (d === 0 && !main) return;
  for (let i = 0; i < p.length; i++) {
    const a = p[i],
      z = p[(i + 1) % p.length],
      dx = z[0] - a[0],
      dz = z[1] - a[1],
      length = Math.hypot(dx, dz);
    if (length < 2.7) continue;
    const n = [-dz / length, dx / length];
    const front = (t, y, s = 0) => [a[0] + dx * t + n[0] * s, y, a[1] + dz * t + n[1] * s];
    const strip = (slot, l, r, lo, hi, s, color) =>
      face(out, slot, [front(l, lo, s), front(r, lo, s), front(r, hi, s), front(l, hi, s)], color, [
        n[0],
        0,
        n[1],
      ]);
    if (d === 0 || (d === 1 && !main)) {
      strip('glass', 0.14, 0.84, grade + 1.14, grade + 2.18, 0.03, 'glass');
      continue;
    }
    const bays = Math.max(1, Math.min(20, Math.round(length / (main ? 4.5 : 3.05))));
    for (let j = 0; j < bays; j++) {
      const f = (j + 0.5) / bays,
        step = 1 / bays,
        w = (main ? 0.33 : 0.25) * step;
      const entrance = main && j === Math.floor(bays * 0.57),
        lo = grade + (entrance ? 0.04 : 1.12),
        hi = grade + (main ? 3.1 : 2.24);
      strip(
        'trim',
        f - w - 0.012 * step,
        f + w + 0.012 * step,
        lo - 0.07,
        hi + 0.1,
        0.036,
        'shade',
      );
      strip('glass', f - w, f + w, lo, hi, 0.054, 'glass');
      if (d >= 3) {
        strip('trim', f - 0.025 * step, f + 0.025 * step, lo, hi, 0.079, 'light');
        strip('trim', f - w, f + w, hi - 0.58, hi - 0.51, 0.078, 'light');
        const setback = entrance ? 0.82 : 0.27;
        beam(
          out,
          'supports',
          front(f - w, hi + 0.16, setback),
          front(f + w, hi + 0.16, setback),
          0.14,
          0.23,
          tint.shade,
        );
      }
    }
  }
}
function gateFrame(g) {
  const [x, z] = g.center;
  return (u, y, forward = 0) => [x + g.facing * forward, g.base + y, z + u];
}
const glyph = {
  A: ['01110', '10001', '11111', '10001', '10001'],
  B: ['11110', '10001', '11110', '10001', '11110'],
  C: ['01111', '10000', '10000', '10000', '01111'],
  D: ['11110', '10001', '10001', '10001', '11110'],
  E: ['11111', '10000', '11110', '10000', '11111'],
  H: ['10001', '10001', '11111', '10001', '10001'],
  I: ['111', '010', '010', '010', '111'],
  J: ['00111', '00010', '00010', '10010', '01100'],
  K: ['10001', '10010', '11100', '10010', '10001'],
  L: ['10000', '10000', '10000', '10000', '11111'],
  M: ['10001', '11011', '10101', '10001', '10001'],
  N: ['10001', '11001', '10101', '10011', '10001'],
  O: ['01110', '10001', '10001', '10001', '01110'],
  R: ['11110', '10001', '11110', '10010', '10001'],
  T: ['11111', '00100', '00100', '00100', '00100'],
  W: ['10001', '10001', '10101', '10101', '01010'],
  Y: ['10001', '01010', '00100', '00100', '00100'],
  Z: ['11111', '00010', '00100', '01000', '11111'],
};
function label(out, text, at, left, y, forward, width, height) {
  const step = width / (6 * text.length),
    h = height / 5;
  for (const [i, letter] of [...text].entries()) {
    const cells = glyph[letter] ?? [];
    for (const [j, row] of cells.entries()) {
      for (let k = 0; k < row.length; k++) {
        if (row[k] !== '1') continue;
        let t = k + 1;
        while (row[t] === '1') t++;
        const a = left + (i * 6 + k) * step,
          b = left + (i * 6 + t) * step,
          top = y - j * h;
        face(
          out,
          'trim',
          [
            at(a, top - h, forward),
            at(b, top - h, forward),
            at(b, top, forward),
            at(a, top, forward),
          ],
          'blue',
          [-1, 0, 0],
        );
        k = t - 1;
      }
    }
  }
}
function rabin(out, g, d) {
  const p = gateFrame(g),
    half = g.span / 2,
    [x, z] = g.center,
    ground = g.base;
  const signDepth = g.depth / 2;
  for (const u of [-half, -0.4, half]) {
    const atGround = ground + Math.min(0, g.contacts[u < 0 ? 0 : 1] - ground) - 0.29;
    for (const f of d === 0 ? [0] : [-signDepth + 0.19, signDepth - 0.21])
      box(
        out,
        'trim',
        [x + f - 0.145, atGround, z + u - 0.14],
        [x + f + 0.145, ground + 6.06, z + u + 0.14],
        tint.red,
      );
  }
  box(
    out,
    'roof',
    [x - signDepth, ground + 6.06, z - half - 1.05],
    [x + signDepth, ground + 6.78, z + half + 1.05],
    tint.roof,
  );
  box(
    out,
    'trim',
    [x - signDepth - 0.07, ground + 6.13, z - half - 1.03],
    [x - signDepth - 0.01, ground + 6.71, z + half + 1.03],
    tint.white,
  );
  if (d >= 2)
    label(out, 'YITZHAK RABIN BORDER TERMINAL', p, -9.75, 6.62, signDepth + 0.079, 19.5, 0.393);
  for (const u of [-half - 0.26, -0.17, half + 0.23]) {
    const f = u === -0.17 ? 1 : 1.45;
    box(
      out,
      'supports',
      [x + 2.2, ground - 0.31, z + u - 0.67 * f],
      [x + 5.05, ground + 2.76, z + u + 0.7 * f],
      tint.light,
    );
    if (d >= 2)
      box(
        out,
        'glass',
        [x + 2.16, ground + 1.22, z + u - 0.49 * f],
        [x + 2.22, ground + 2.13, z + u + 0.49 * f],
        tint.glass,
      );
  }
  if (d >= 1) {
    const roofWidth = 28;
    polygonRoof(
      out,
      closedProfile([
        [x + 9, z - roofWidth / 2],
        [x + 31, z - roofWidth / 2],
        [x + 31, z + roofWidth / 2],
        [x + 9, z + roofWidth / 2],
      ]),
      ground + 4.55,
      0.94,
      'roof',
    );
    for (const dx of [9.35, 30.6])
      for (const u of [-13.6, -0.25, 13.6])
        box(
          out,
          'trim',
          [x + dx - 0.14, ground - 0.34, z + u - 0.14],
          [x + dx + 0.14, ground + 4.62, z + u + 0.14],
          tint.red,
        );
  }
}
function jordan(out, g, d) {
  const p = gateFrame(g),
    half = g.span / 2,
    steps = d === 0 ? 3 : d === 1 ? 6 : 12,
    f = g.depth / 2,
    base = 2.75;
  const [x, z] = g.center;
  for (const side of [-1, 1]) {
    const at = (i, y, depth) => p(side * ((i * half) / steps), y, depth);
    const top = (i) => 6.4 + 1.92 * Math.pow(Math.max(0, 1 - (i / steps) * 2.45), 2);
    const bottom = (i) => 4.98 - 1.02 * Math.pow(Math.max(0, 1 - (i / steps) * 3.8), 2);
    for (let i = 1; i <= steps; i++) {
      for (const sign of [-1, 1])
        face(
          out,
          'wall',
          [
            at(i - 1, bottom(i - 1), f * sign),
            at(i, bottom(i), f * sign),
            at(i, top(i), f * sign),
            at(i - 1, top(i - 1), f * sign),
          ],
          'light',
          [-sign, 0, 0],
        );
      face(
        out,
        'wall',
        [at(i - 1, top(i - 1), f), at(i, top(i), f), at(i, top(i), -f), at(i - 1, top(i - 1), -f)],
        'light',
        [0, 1, 0],
      );
      face(
        out,
        'wall',
        [
          at(i - 1, bottom(i - 1), -f),
          at(i, bottom(i), -f),
          at(i, bottom(i), f),
          at(i - 1, bottom(i - 1), f),
        ],
        'shade',
        [0, -1, 0],
      );
    }
    face(
      out,
      'wall',
      [
        at(steps, bottom(steps), f),
        at(steps, bottom(steps), -f),
        at(steps, top(steps), -f),
        at(steps, top(steps), f),
      ],
      'light',
      [0, 0, side],
    );
    const pier = z + side * (half - 0.32),
      ground = g.contacts[side < 0 ? 0 : 1];
    box(
      out,
      'wall',
      [x - f - 0.02, ground - 0.36, pier - 0.32],
      [x + f + 0.02, g.base + 4.99, pier + 0.32],
      tint.light,
    );
    box(
      out,
      'wall',
      [x - f - 0.045, ground - 0.37, pier - 0.35],
      [x + f + 0.045, ground + base, pier + 0.35],
      tint.pink,
    );
  }
  box(
    out,
    'wall',
    [x - f - 0.08, g.base - 0.38, z - 1.3],
    [x + f + 0.63, g.base + 4.91, z + 1.3],
    tint.pink,
  );
  box(
    out,
    'wall',
    [x - f - 0.09, g.base + 3.12, z - 1.34],
    [x + f + 0.64, g.base + 4.92, z + 1.34],
    tint.light,
  );
  if (d >= 1) {
    box(
      out,
      'glass',
      [x - f - 0.104, g.base + 1.65, z - 0.79],
      [x - f - 0.093, g.base + 2.68, z + 0.79],
      tint.glass,
    );
    box(
      out,
      'trim',
      [x - f - 0.12, g.base + 5.22, z - 8.92],
      [x - f - 0.098, g.base + 5.81, z - 1.16],
      tint.white,
    );
    box(
      out,
      'trim',
      [x - f - 0.12, g.base + 5.22, z + 1.16],
      [x - f - 0.098, g.base + 5.81, z + 8.92],
      tint.white,
    );
  }
  if (d >= 2) label(out, 'WELCOME TO JORDAN', p, -8.82, 5.72, f + 0.126, 7.5, 0.36);
  const rings = [
    [8.15, 0.55, 0.29],
    [8.24, 0.69, 0.34],
    [8.39, 0.69, 0.35],
    [8.52, 0.6, 0.29],
  ];
  loft(
    out,
    'trim',
    rings.map(([y, a, b]) => radialRing(g.base + y, b, a, d === 0 ? 6 : 12, [x, z])),
    tint.gold,
  );
  if (d >= 1)
    for (const u of [-0.5, -0.26, 0, 0.26, 0.5]) {
      const top = 9.07 - Math.abs(u) * 0.27;
      beam(out, 'trim', p(u, 8.42), p(u * 1.23, top), 0.11, 0.085, tint.gold);
      beam(out, 'trim', p(u * 1.23, top), p(u * 0.65, top + 0.13), 0.13, 0.1, tint.gold);
    }
}
function connector(out, d) {
  // Keep both carriageways native. The model adds the raised entrance islands and exterior fences.
  for (const g of layout.gates) {
    const [x, z] = g.center;
    const inset = g.kind === 'rabin' ? 1.25 : 1.45;
    const length = g.kind === 'rabin' ? 4.2 : 3.14;
    const ring = [
      [x - length, z - inset * 0.61],
      [x - length + 0.63, z - inset],
      [x + length - 0.5, z - inset],
      [x + length, z - inset * 0.68],
      [x + length, z + inset * 0.68],
      [x + length - 0.5, z + inset],
      [x - length + 0.63, z + inset],
      [x - length, z + inset * 0.61],
    ];
    prism(out, 'pavement', ring, g.base - 0.58, g.base + 0.16, 'shade');
  }
  const rowAt = (x) => layout.road.find((row) => row[0] > x);
  const [x0, z0, y0] = rowAt(48),
    [x1, z1, y1] = rowAt(186);
  const sides = [
    [-12.6, -10.2],
    [8.2, 10.9],
  ];
  for (const [a, b] of sides) {
    const left = [x0, y0, z0 + a],
      right = [x1, y1, z1 + b];
    const count =
      d === 0
        ? 2
        : d === 1
          ? 7
          : Math.round(Math.hypot(right[0] - left[0], right[2] - left[2]) / 4.5);
    const at = (t, y) => {
      const p = add(left, right, t);
      const ground = layout.road.find((row) => row[0] >= p[0]);
      p[1] = (ground?.[2] ?? p[1]) + y;
      return p;
    };
    for (let j = 0; j < count; j++) {
      const p0 = j / count,
        p1 = (j + 1) / count;
      beam(out, 'trim', at(p0, -0.41), at(p0, 2.17), 0.105, 0.137, tint.fence);
      face(out, 'fence', [at(p0, 0.26), at(p1, 0.26), at(p1, 2.06), at(p0, 2.06)], 'fence');
      face(out, 'fence', [at(p0, 2.06), at(p1, 2.06), at(p1, 0.26), at(p0, 0.26)], 'fence');
      if (d >= 2) beam(out, 'trim', at(p0, 2.11), at(p1, 2.11), 0.07, 0.07, tint.fence);
      if (d === 4) beam(out, 'trim', at(p0, 0.22), at(p1, 0.22), 0.041, 0.051, tint.fence);
    }
  }
}
export function buildTowerLevel(out, level) {
  const d = detail[level];
  for (const part of layout.buildings) building(out, part, d);
  for (const gate of layout.gates) (gate.kind === 'rabin' ? rabin : jordan)(out, gate, d);
  connector(out, d);
}
export const buildSkyline = (out) => buildTowerLevel(out, 'skyline');
export const buildDistrict = (out) => buildTowerLevel(out, 'district');
export const buildStreet = (out) => buildTowerLevel(out, 'street');
export const buildCloseup = (out) => buildTowerLevel(out, 'closeup');
export const buildMaster = (out) => buildTowerLevel(out, 'master');
