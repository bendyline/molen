/** Palace of the Parliament. Map-shaped wings and courts with an independently authored neoclassical exterior. */
import { readFileSync } from 'node:fs';
import {
  loft,
  normalFor,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';

export const layout = JSON.parse(readFileSync(new URL('../layout.json', import.meta.url)));
export const surfaces = {
  wall: { slot: 'wall', graph: 'stone_limestone_raw', roughness: 0.92 },
  trim: { slot: 'trim', graph: 'stone_marble', roughness: 0.86 },
  glass: { slot: 'window', graph: 'window_grid', roughness: 0.52 },
  plinth: { slot: 'foundation', graph: 'stone_granite', roughness: 0.96 },
  roof: { slot: 'roof', graph: 'concrete_plain', roughness: 0.95 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.78, metallic: 0.12 },
};
const colors = {
  limestone: [0.83, 0.784, 0.691],
  corner: [0.77, 0.722, 0.638],
  court: [0.73, 0.698, 0.633],
  trim: [0.88, 0.836, 0.741],
  edge: [0.8, 0.75, 0.665],
  trimShade: [0.63, 0.581, 0.502],
  roof: [0.485, 0.467, 0.435],
  gravel: [0.568, 0.534, 0.478],
  steps: [0.62, 0.585, 0.509],
  granite: [0.496, 0.457, 0.399],
  pane: [0.145, 0.158, 0.159],
  warmPane: [0.196, 0.179, 0.154],
  recess: [0.232, 0.225, 0.194],
  metal: [0.232, 0.247, 0.232],
  lightMetal: [0.46, 0.48, 0.45],
};
const tiers = { skyline: 0, district: 1, street: 2, closeup: 3, master: 4 };
const ref = 'palette:#ffffff',
  up = [0, 1, 0];
const mix = (a, b, t) => a + (b - a) * t;
const area = (ring) =>
  ring.reduce((sum, [x, z], i) => {
    const [a, b] = ring[(i + 1) % ring.length];
    return sum + x * b - a * z;
  }, 0);
const rect = (x, z, w, d) => [
  [x - w / 2, z - d / 2],
  [x + w / 2, z - d / 2],
  [x + w / 2, z + d / 2],
  [x - w / 2, z + d / 2],
];
function face(out, slot, tone, points, normal) {
  points = points.map((point) => point.map(Math.fround));
  let n = normalFor(...points);
  if (Math.hypot(...n) < 0.1) return;
  if (normal && n.reduce((sum, v, i) => sum + v * normal[i], 0) < 0) {
    points = points.toReversed();
    n = normalFor(...points);
  }
  if (points.length === 3) out.addTriangle(slot, ref, points, n, undefined, colors[tone]);
  else out.addQuad(slot, ref, points, n, undefined, colors[tone]);
}
function slab(out, slot, tone, rings, y) {
  const vertices = rings.flat(),
    holes = [];
  let offset = rings[0].length;
  for (const r of rings.slice(1)) {
    holes.push(offset);
    offset += r.length;
  }
  const order = earcut(vertices.flat(), holes);
  for (let i = 0; i < order.length; i += 3) {
    face(
      out,
      slot,
      tone,
      order.slice(i, i + 3).map((j) => [vertices[j][0], y, vertices[j][1]]),
      up,
    );
  }
}
function frame(a, b, direction) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    len = Math.hypot(dx, dz);
  const n = [(direction * dz) / len, 0, (-direction * dx) / len];
  return {
    len,
    n,
    p: (u, y, d = 0) => [a[0] + (dx * u) / len + n[0] * d, y, a[1] + (dz * u) / len + n[2] * d],
  };
}
function panel(out, slot, tone, { p, n }, left, right, base, top, depth) {
  face(
    out,
    slot,
    tone,
    [p(left, base, depth), p(right, base, depth), p(right, top, depth), p(left, top, depth)],
    n,
  );
}
function molding(out, f, left, right, base, top, depth, tier, tone = 'trim') {
  const { p } = f;
  panel(out, 'trim', tone, f, left, right, base, top, depth);
  if (tier)
    face(
      out,
      'trim',
      'edge',
      [p(left, top, depth), p(right, top, depth), p(right, top, -0.01), p(left, top, -0.01)],
      up,
    );
  if (tier >= 2)
    face(
      out,
      'trim',
      'trimShade',
      [p(left, base, -0.01), p(right, base, -0.01), p(right, base, depth), p(left, base, depth)],
      [0, -1, 0],
    );
  if (tier >= 3) {
    face(
      out,
      'trim',
      'edge',
      [p(left, base, -0.01), p(left, base, depth), p(left, top, depth), p(left, top, -0.01)],
      undefined,
    );
    face(
      out,
      'trim',
      'edge',
      [p(right, base, depth), p(right, base, -0.01), p(right, top, -0.01), p(right, top, depth)],
      undefined,
    );
  }
}
function window(out, f, u, y, w, h, arch, tier, alternate, ornate = false) {
  const { p, n } = f,
    l = u - w / 2,
    r = u + w / 2,
    spring = arch ? y + h * 0.73 : y + h;
  const slot = tier > 1 ? 'glass' : 'metal',
    tone = alternate ? 'warmPane' : 'pane';
  if (tier >= 3 || (tier === 2 && ornate))
    panel(out, 'trim', 'edge', f, l - 0.15, r + 0.15, y - 0.18, spring + 0.1, 0.034);
  panel(out, slot, tone, f, l, r, y, spring, 0.063);
  if (arch) {
    const segments = tier < 2 || (tier === 2 && !ornate) ? 2 : ornate && tier >= 3 ? 6 : 4;
    for (let i = 0; i < segments; i++) {
      const edge = (j, inset = 0) => {
        const a = (Math.PI * j) / segments;
        return p(
          u - Math.cos(a) * (w / 2 + inset),
          spring + Math.sin(a) * (h * 0.27 + inset),
          inset ? 0.052 : 0.064,
        );
      };
      face(out, slot, tone, [p(u, spring, 0.064), edge(i), edge(i + 1)], n);
      if (tier >= 3 && ornate)
        face(out, 'trim', 'trim', [edge(i), edge(i + 1), edge(i + 1, 0.19), edge(i, 0.19)], n);
    }
  }
  if (tier >= 2 && (ornate || tier >= 3))
    molding(out, f, l - 0.23, r + 0.23, y - 0.19, y - 0.035, 0.23, ornate ? 1 : 0, 'edge');
  if (tier >= 3 && ornate) {
    panel(out, 'metal', 'metal', f, u - 0.045, u + 0.045, y, spring, 0.085);
    if (h > 2.6) panel(out, 'metal', 'metal', f, l, r, y + h * 0.53, y + h * 0.53 + 0.07, 0.086);
  }
}
function wall(out, f, lo, hi, tone) {
  const { p, n, len } = f;
  face(out, 'wall', tone, [p(0, lo[0]), p(len, lo[1]), p(len, hi), p(0, hi)], n);
}
function lowerRange(out, ring, bottoms, top, tier, court, tone) {
  const direction = Math.sign(area(ring)) * (court ? -1 : 1);
  for (let i = 0; i < ring.length; i++) {
    const j = (i + 1) % ring.length,
      f = frame(ring[i], ring[j], direction);
    const { len } = f,
      low = [bottoms[i], bottoms[j]];
    wall(out, f, low, top, tone);
    if (!tier || len < 0.32) continue;
    if (tier > 1 || !court)
      molding(out, f, 0, len, top - 0.69, top - 0.12, 0.62, tier === 2 ? 1 : tier);
    if (!court)
      for (const y of [10.7, 19.2, 30.42, 36.53]) {
        if (y < top - 1.2 && y > Math.max(...low) + 0.12 && (tier > 1 || y === 19.2 || y === 30.42))
          molding(
            out,
            f,
            0,
            len,
            y - 0.54,
            y,
            y === 19.2 || y === 30.42 ? 0.68 : 0.39,
            tier < 3 ? tier - 1 : 2,
            'edge',
          );
      }
    if (len < 2.1 || (tier === 1 && court)) continue;
    const count = Math.max(1, Math.round(len / (tier === 1 ? 6.7 : court ? 4.45 : 5.0)));
    for (const y of [-10, -4, 2, 8, 14, 20, 26, 32, 37]) {
      if (y + 3.1 > top - 0.84 || Math.max(...low) > y + 1.5) continue;
      if (tier === 1 && y !== 20 && y !== 32) continue;
      if (tier === 2 && (y === -10 || (court && y === 32))) continue;
      for (let k = 0; k < count; k++) {
        const u = (len * (k + 0.5)) / count,
          base = mix(...low, u / len);
        if (y < base + 0.55 || u < 0.95 || len - u < 0.95) continue;
        if (
          !court &&
          f.n[2] > 0.7 &&
          Math.abs(f.p(u, y)[0] - 0.8) < 11.7 &&
          y < 28 &&
          f.p(u, y)[2] > 83
        )
          continue;
        const ornate = !court && f.n[2] > 0.5 && f.p(u, y)[2] > 67;
        window(
          out,
          f,
          u,
          y,
          Math.min((len / count) * 0.56, y === 20 ? 2.65 : 1.92),
          y === 20 ? 3.7 : 2.8,
          tier > 1 && !court && (y === 20 || y === 32),
          tier,
          (i + k + y) % 7 === 0,
          ornate,
        );
        if (tier >= 2 && !court && y === 26 && k > 0 && (tier > 2 || ornate)) {
          const v = (len * k) / count;
          const width = ornate ? 0.41 : 0.26;
          molding(
            out,
            f,
            v - width,
            v + width,
            19.25,
            30.45,
            ornate ? 0.54 : 0.27,
            ornate || tier >= 3 ? 1 : 0,
            'edge',
          );
          if (ornate && tier >= 3) {
            molding(out, f, v - 0.65, v + 0.65, 29.82, 30.38, 0.75, 1);
            molding(out, f, v - 0.58, v + 0.58, 19.2, 19.64, 0.68, 1, 'edge');
          }
        }
      }
    }
    if (tier >= 2 && !court && len > 4.8)
      molding(out, f, 0, len, top - 1.82, top - 1.5, 0.31, 1, 'edge');
  }
}
function box(out, slot, tone, x, z, w, d, low, top) {
  const ring = rect(x, z, w, d);
  for (let i = 0; i < ring.length; i++)
    wallTone(out, slot, tone, frame(ring[i], ring[(i + 1) % ring.length], 1), low, top);
  slab(out, slot, tone, [ring], top);
}
function wallTone(out, slot, tone, f, low, top) {
  panel(out, slot, tone, f, 0, f.len, low, top, 0);
}
function upperRange(out, block, tier) {
  const { x, z, w, d, low, high, rhythm, order } = block,
    ring = rect(x, z, w, d);
  const grand = order === 'grand',
    crown = order === 'crown';
  for (let i = 0; i < ring.length; i++) {
    const f = frame(ring[i], ring[(i + 1) % ring.length], 1),
      { len } = f;
    wall(out, f, [low, low], high, 'limestone');
    molding(out, f, 0, len, high - 1.02, high - 0.3, crown ? 0.55 : 0.89, tier);
    if (!tier) continue;
    if (grand) molding(out, f, 0, len, low + 9.22, low + 9.75, 0.55, tier, 'edge');
    const count = Math.round(len / (tier === 1 ? rhythm * 1.45 : rhythm)),
      rows = grand
        ? [
            [low + 1.75, 4.0, true],
            [low + 10.3, 5.75, false],
          ]
        : [[low + (crown ? 1.85 : 1.25), Math.min(high - low - 2.75, crown ? 6.65 : 6.15), false]];
    for (let j = 0; j < count; j++) {
      const u = (len * (j + 0.5)) / count;
      for (const [y, h, arch] of tier === 1 ? rows.slice(-1) : rows)
        window(
          out,
          f,
          u,
          y,
          Math.min((len / count) * 0.55, grand ? 2.85 : 2.32),
          h,
          arch,
          tier,
          (i + j) % 9 === 0,
          grand,
        );
      if ((grand || crown) && j > 0) {
        const v = (len * j) / count,
          lo = low + (grand ? 9.97 : 1.15),
          hi = high - 1.38,
          width = grand ? 0.55 : 0.33;
        molding(
          out,
          f,
          v - width / 2,
          v + width / 2,
          lo,
          hi,
          tier >= 2 ? 0.52 : 0.2,
          tier >= 2 ? 1 : 0,
        );
        if (tier >= 3)
          molding(out, f, v - width * 0.77, v + width * 0.77, hi - 0.33, hi + 0.12, 0.69, 1);
      }
    }
  }
  slab(out, 'roof', crown ? 'gravel' : 'roof', [ring], high);
}
function column(out, x, z, base, top, radius, tier) {
  if (tier === 0) {
    const half = radius * 0.8;
    face(
      out,
      'trim',
      'trim',
      [
        [x - half, base, z],
        [x + half, base, z],
        [x + half, top, z],
        [x - half, top, z],
      ],
      [0, 0, z > 0 ? 1 : -1],
    );
    return;
  }
  if (tier < 2) {
    box(out, 'trim', 'trim', x, z, radius * 1.55, radius * 1.55, base, top);
    return;
  }
  const sides = tier === 2 ? 6 : tier === 3 ? 10 : 12;
  const shaft = (y, r) => radialRing(y, r, r, sides, [x, z]);
  const foot = radius * 1.4,
    head = radius * 1.32;
  box(out, 'trim', 'edge', x, z, foot * 2, foot * 2, base, base + 0.54);
  loft(
    out,
    'trim',
    (tier === 2
      ? [
          [base + 0.45, radius],
          [top - 0.52, radius * 0.85],
          [top, head],
        ]
      : [
          [base + 0.45, radius],
          [base + 0.79, radius * 0.93],
          [top - 1.02, radius * 0.76],
          [top - 0.52, radius * 0.9],
          [top - 0.22, head],
          [top, head],
        ]
    ).map(([y, r]) => shaft(y, r)),
    colors.trim,
  );
  if (tier === 4) box(out, 'trim', 'edge', x, z, head * 2, head * 2, top - 0.23, top);
}
function eastFront(out, tier) {
  const { stair } = layout,
    { x, width, head, toe, upper, lower } = stair;
  const count = [7, 13, 24, 36, 42][tier],
    ground = Math.min(...lower) - 2.4;
  for (let i = 0; i < count; i++) {
    const z = mix(toe, head, i / count),
      next = mix(toe, head, (i + 1) / count);
    const point = (j, step, at) => [
      x + ((j - 1) * width) / 2,
      step < 0 ? ground : mix(lower[j], upper, step / (count - 1)),
      at,
    ];
    for (let j = 0; j < 2; j++) {
      face(
        out,
        'plinth',
        'steps',
        [point(j, i, z), point(j + 1, i, z), point(j + 1, i, next), point(j, i, next)],
        up,
      );
      face(
        out,
        'plinth',
        'granite',
        [point(j, i - 1, z), point(j + 1, i - 1, z), point(j + 1, i, z), point(j, i, z)],
        [0, 0, 1],
      );
    }
    for (const j of [0, 2])
      face(
        out,
        'plinth',
        'granite',
        [point(j, -1, z), point(j, -1, next), point(j, i, next), point(j, i, z)],
        [j - 1, 0, 0],
      );
  }
  box(out, 'plinth', 'steps', x, 87.32, 32.5, 3.82, ground, upper);
  const z = 88.75,
    left = x - 14.3,
    right = x + 14.3,
    roofY = 29.7;
  box(out, 'trim', 'trim', x, 87.02, 29.2, 3.75, roofY - 1.65, roofY);
  box(out, 'plinth', 'granite', x, 87.0, 29.5, 3.84, roofY, roofY + 0.36);
  const front = frame([right, 86.55], [left, 86.55], 1);
  for (let i = -4; i <= 4; i++) {
    column(out, x + i * 3.2, z, upper, roofY - 1.45, i === -4 || i === 4 ? 0.7 : 0.54, tier);
    if (i < 4) {
      const u = front.len / 2 - (i + 0.5) * 3.2;
      panel(out, 'metal', 'recess', front, u - 0.88, u + 0.88, upper, upper + 6.25, 0.08);
      if (tier >= 2) window(out, front, u, upper + 0.14, 1.43, 5.62, true, tier, false, true);
    }
  }
  if (!tier) return;
  const balcony = frame([right, 88.88], [left, 88.88], 1);
  molding(out, balcony, 0, balcony.len, roofY + 0.35, roofY + 0.69, 0.15, tier);
  molding(out, balcony, 0, balcony.len, roofY + 1.55, roofY + 1.81, 0.13, tier);
  const railCount = tier >= 3 ? 38 : 18;
  for (let i = 0; i < railCount; i++) {
    const u = ((i + 0.5) * balcony.len) / railCount;
    molding(out, balcony, u - 0.12, u + 0.12, roofY + 0.56, roofY + 1.56, 0.08, 0, 'edge');
  }
}
function westFront(out, tier) {
  const x = 2.35,
    z = -111.95,
    y = -8.1,
    high = 17.2;
  box(out, 'plinth', 'steps', x, z, 56.6, 3.45, y - 9, y);
  box(out, 'trim', 'trim', x, z, 56.6, 3.6, high, high + 1.6);
  for (let i = -6; i <= 6; i++) column(out, x + i * 4.39, z - 0.95, y, high + 0.15, 0.62, tier);
}
function rooftop(out, tier) {
  if (tier < 2) return;
  for (const [x, z, w, d, y] of [
    [-28, 57, 11.8, 6.7, 84],
    [31, 60, 8.7, 9.4, 84],
    [-41, 73, 4.1, 8.8, 84],
    [84, -34, 14.7, 11.2, 46.3],
    [-91, -42, 11.6, 14.8, 46.3],
    [-15, -80, 9.1, 11.2, 55.1],
    [20, -86, 9.4, 8.6, 55.1],
  ]) {
    // The crown parapet is the height control. Its rooftop fittings stay below that crest.
    if (y >= 84) {
      if (tier >= 3) slab(out, 'metal', 'lightMetal', [rect(x, z, w, d)], 84.002);
    } else box(out, 'roof', 'gravel', x, z, w, d, y - 0.06, y + 1.4);
  }
}
export function buildParliamentLevel(out, level) {
  const tier = tiers[level],
    { base, courts, roof } = layout;
  if (tier === undefined) throw new Error(`Unknown Palace of the Parliament level: ${level}`);
  for (const [i, section] of base.entries()) {
    lowerRange(
      out,
      section.ring,
      section.grade,
      section.level,
      tier,
      false,
      i ? 'corner' : 'limestone',
    );
    slab(
      out,
      'roof',
      i ? 'gravel' : 'roof',
      i ? [section.ring] : [section.ring, ...courts.map((c) => c.ring)],
      section.level,
    );
  }
  for (const court of courts) {
    lowerRange(
      out,
      court.ring,
      court.ring.map(() => court.level),
      base[0].level,
      tier,
      true,
      'court',
    );
    slab(out, 'plinth', 'steps', [court.ring], court.level);
  }
  for (const block of roof) upperRange(out, block, tier);
  eastFront(out, tier);
  westFront(out, tier);
  rooftop(out, tier);
}
export const buildParliamentSkyline = (out) => buildParliamentLevel(out, 'skyline');
export const buildParliamentDistrict = (out) => buildParliamentLevel(out, 'district');
export const buildParliamentStreet = (out) => buildParliamentLevel(out, 'street');
export const buildParliamentCloseup = (out) => buildParliamentLevel(out, 'closeup');
