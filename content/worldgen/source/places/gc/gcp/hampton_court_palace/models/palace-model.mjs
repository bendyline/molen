/** Hampton Court Palace's Tudor courts and gatehouses, Great Hall and Baroque garden front. */
import { readFileSync } from 'node:fs';
import {
  beam,
  loft,
  normalFor,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';

export const layout = JSON.parse(readFileSync(new URL('../layout.json', import.meta.url)));
export const surfaces = {
  brick: { slot: 'wall', graph: 'brick_flemish', roughness: 0.93 },
  stone: { slot: 'trim', graph: 'stone_limestone_raw', roughness: 0.91 },
  paving: { slot: 'foundation', graph: 'stone_granite', roughness: 0.97 },
  slate: { slot: 'roof', graph: 'slate', roughness: 0.89 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.77, metallic: 0.12 },
  glass: { slot: 'window', graph: 'window_grid', roughness: 0.52 },
  grass: {
    slot: 'foundation',
    localRef: 'palette:#718c4b',
    name: 'Fountain Court lawn',
    roughness: 0.95,
    baseColorFactor: [0.142, 0.242, 0.073, 1],
  },
  water: {
    slot: 'roof',
    localRef: 'palette:#426f74',
    name: 'Fountain Court water',
    roughness: 0.57,
    baseColorFactor: [0.069, 0.221, 0.238, 1],
  },
};
const colors = {
  brick: [0.441, 0.175, 0.111],
  red: [0.496, 0.18, 0.113],
  warm: [0.42, 0.165, 0.106],
  darkBrick: [0.294, 0.117, 0.078],
  stone: [0.68, 0.586, 0.436],
  pale: [0.85, 0.763, 0.611],
  base: [0.48, 0.428, 0.333],
  mortar: [0.608, 0.521, 0.403],
  slate: [0.269, 0.319, 0.341],
  lead: [0.395, 0.424, 0.419],
  wood: [0.213, 0.18, 0.136],
  window: [0.12, 0.161, 0.187],
  pane: [0.36, 0.49, 0.535],
  gray: [0.42, 0.421, 0.386],
  gravel: [0.7, 0.642, 0.51],
  path: [0.631, 0.567, 0.465],
  jet: [0.65, 0.8, 0.84],
  white: [1, 1, 1],
  dial: [0.104, 0.191, 0.296],
  gold: [0.831, 0.575, 0.237],
  dark: [0.103, 0.102, 0.086],
};
const levels = { skyline: 0, district: 1, street: 2, closeup: 3, master: 4 };
const ref = 'palette:#ffffff',
  up = [0, 1, 0],
  down = [0, -1, 0],
  mix = (a, b, t) => a + (b - a) * t;
const rod = (out, slot, tone, a, b, w, d = w) => beam(out, slot, a, b, w, d, colors[tone]);
function face(out, slot, tone, points, expected) {
  points = points
    .map((p) => p.map(Math.fround))
    .filter((p, i, rows) => !rows.slice(0, i).some((q) => q.every((v, j) => v === p[j])));
  if (points.length < 3) return;
  let n = normalFor(...points);
  if (expected && n.reduce((s, v, i) => s + v * expected[i], 0) < 0) {
    points = points.toReversed();
    n = normalFor(...points);
  }
  if (Math.hypot(...n) < 0.5) return;
  if (points.length === 3) out.addTriangle(slot, ref, points, n, undefined, colors[tone]);
  else out.addQuad(slot, ref, points, n, undefined, colors[tone]);
}
function roofTriangles(out, slot, tone, rings, levels, normal = up) {
  const all = rings.flat(),
    holes = [];
  let i = rings[0].length;
  for (const h of rings.slice(1)) {
    holes.push(i);
    i += h.length;
  }
  const y = levels.flat(),
    tri = earcut(all.flat(), holes);
  for (let j = 0; j < tri.length; j += 3)
    face(
      out,
      slot,
      tone,
      tri.slice(j, j + 3).map((i) => [all[i][0], y[i], all[i][1]]),
      normal,
    );
}
function flat(out, slot, tone, r, y) {
  roofTriangles(out, slot, tone, [r], [r.map(() => y)]);
}
function rect(x, z, w, d) {
  return [
    [x - w / 2, z - d / 2],
    [x - w / 2, z + d / 2],
    [x + w / 2, z + d / 2],
    [x + w / 2, z - d / 2],
  ];
}
function box(out, slot, tone, x, z, w, d, y0, y1) {
  const r = rect(x, z, w, d);
  loft(out, slot, [r.map(([x, z]) => [x, y0, z]), r.map(([x, z]) => [x, y1, z])], colors[tone]);
}
function frame(f) {
  const [x, z] = f.a,
    [a, b] = f.b,
    len = Math.hypot(x - a, z - b),
    n = [f.n[0], 0, f.n[1]];
  return { len, n, p: (u, y, d = 0) => [mix(x, a, u) + n[0] * d, y, mix(z, b, u) + n[2] * d] };
}
function horizontal(out, slot, tone, s, u, v, y, h, d = 0.075) {
  const { p, n } = s;
  face(out, slot, tone, [p(u, y, d), p(v, y, d), p(v, y + h, d), p(u, y + h, d)], n);
}
function vertical(out, slot, tone, s, u, y, h, w, d = 0.085) {
  horizontal(out, slot, tone, s, u - w / (2 * s.len), u + w / (2 * s.len), y, h, d);
}
function archHeight(t, spring, rise, pointed) {
  return (
    spring + rise * (pointed ? Math.pow(1 - Math.abs(t * 2 - 1), 0.68) : Math.sin(t * Math.PI))
  );
}
function window(out, s, u, w, y, h, tier, arched = false, mullions = 1) {
  const { p, n, len } = s,
    a = u - w / 2,
    b = u + w / 2,
    lip = 0.13 / len;
  const inset = arched ? h * 0.69 : h;
  const slot = tier >= 2 ? 'glass' : 'metal',
    tone = tier >= 2 ? 'pane' : 'window';
  if (tier >= 2)
    horizontal(out, 'stone', 'stone', s, a - lip, b + lip, y - 0.12, inset + 0.2, 0.085);
  horizontal(out, slot, tone, s, a, b, y, inset, 0.118);
  if (arched) {
    const divisions = tier === 1 ? 2 : tier === 2 ? 4 : 7;
    const top = Array.from({ length: divisions + 1 }, (_, i) => {
      const f = i / divisions;
      return p(mix(a, b, f), archHeight(f, y + inset, h - inset, true), 0.125);
    });
    for (let i = 1; i < top.length - 1; i++) face(out, slot, tone, [top[0], top[i], top[i + 1]], n);
    if (tier >= 3)
      for (let i = 1; i < top.length; i++) {
        const shift = (pt) => [pt[0] + n[0] * 0.015, pt[1] + 0.17, pt[2] + n[2] * 0.015];
        face(out, 'stone', 'pale', [top[i - 1], top[i], shift(top[i]), shift(top[i - 1])], n);
      }
  }
  if (tier >= 3) {
    horizontal(out, 'stone', 'pale', s, a - lip * 1.4, b + lip * 1.4, y - 0.14, 0.14, 0.155);
    for (let i = 1; i <= mullions; i++)
      vertical(
        out,
        'stone',
        'pale',
        s,
        mix(a, b, i / (mullions + 1)),
        y + 0.035,
        inset - 0.06,
        0.105,
        0.157,
      );
    horizontal(out, 'stone', 'pale', s, a, b, y + inset * 0.58, 0.087, 0.157);
  }
}
function portalFace(out, f, s, gate, tier, tone) {
  const { p, n, len } = s;
  const [x, z] = f.a,
    [a, b] = f.b;
  const u0 = (gate.z - gate.width / 2 - z) / (b - z),
    u1 = (gate.z + gate.width / 2 - z) / (b - z),
    lo = Math.max(0, Math.min(u0, u1)),
    hi = Math.min(1, Math.max(u0, u1));
  if (hi <= lo) return false;
  const portalX = mix(x, a, (lo + hi) / 2);
  if (portalX < gate.x0 - 0.65 || portalX > gate.x1 + 0.58) return false;
  const foot = (t) => mix(f.base[0], f.base[1], t),
    top = (t) => mix(f.top[0], f.top[1], t);
  const wall = (u, v) => {
    if (v - u > 0.00002)
      face(out, 'brick', tone, [p(u, foot(u)), p(v, foot(v)), p(v, top(v)), p(u, top(u))], n);
  };
  wall(0, lo);
  wall(hi, 1);
  const spring = gate.floor + gate.spring,
    y = (t) =>
      archHeight(
        Math.min(1, Math.max(0, (p(t, 0)[2] - gate.z) / gate.width + 0.5)),
        spring,
        gate.rise,
        true,
      );
  const steps = tier === 0 ? 3 : tier === 1 ? 5 : tier === 2 ? 7 : 12;
  for (let j = 0; j < steps; j++) {
    const u = mix(lo, hi, j / steps),
      v = mix(lo, hi, (j + 1) / steps);
    const a0 = y(u),
      b0 = y(v);
    face(out, 'brick', tone, [p(u, a0), p(v, b0), p(v, top(v)), p(u, top(u))], n);
    if (f.visible && tier >= 1) {
      const d = 0.13,
        thick = tier === 1 ? 0.31 : 0.38;
      face(
        out,
        'stone',
        'pale',
        [p(u, a0, d), p(v, b0, d), p(v, b0 + thick, d), p(u, a0 + thick, d)],
        n,
      );
    }
  }
  if (f.visible && tier >= 1)
    for (const u of [lo, hi]) {
      if ((u === 0 || u === 1) && Math.abs(p(u, 0)[2] - gate.z) < gate.width * 0.49) continue;
      vertical(out, 'stone', 'pale', s, u, gate.floor, spring - gate.floor + 0.2, 0.34, 0.145);
    }
  if (f.visible && tier >= 2 && len > 3.9 && lo > 0.04 && hi < 0.96) {
    horizontal(
      out,
      'stone',
      'stone',
      s,
      Math.max(0, lo - 0.04),
      Math.min(1, hi + 0.04),
      spring + gate.rise + 0.68,
      0.24,
      0.17,
    );
  }
  return true;
}
function arcade(out, f, s, tier) {
  const { p, n, len } = s;
  const count = Math.max(1, Math.round(len / (tier === 0 ? 13 : tier === 1 ? 7.1 : 4.65))),
    floor = layout.courts[1].level,
    spring = floor + 3.05,
    head = spring + 1.14;
  const top = (t) => mix(f.top[0], f.top[1], t),
    arch = (t) => archHeight(t, spring, 1.14, false);
  const back = -1.88;
  if (tier === 0) {
    for (let i = 0; i <= count; i++)
      vertical(out, 'stone', 'pale', s, i / count, floor, head + 0.26 - floor, 0.79, 0.01);
    face(
      out,
      'brick',
      'brick',
      [p(0, head - 0.25), p(1, head - 0.25), p(1, top(1)), p(0, top(0))],
      n,
    );
    return;
  }
  for (let i = 0; i < count; i++) {
    const u = i / count,
      v = (i + 1) / count,
      a = mix(u, v, 0.138),
      b = mix(u, v, 0.862);
    face(out, 'stone', 'stone', [p(u, floor), p(a, floor), p(a, head), p(u, head)], n);
    face(out, 'stone', 'stone', [p(b, floor), p(v, floor), p(v, head), p(b, head)], n);
    if (tier >= 1)
      face(
        out,
        'brick',
        'darkBrick',
        [p(a, floor, back), p(b, floor, back), p(b, head, back), p(a, head, back)],
        n,
      );
    const steps = tier < 2 ? 3 : tier === 2 ? 5 : 8;
    for (let k = 0; k < steps; k++) {
      const f = k / steps,
        t = (k + 1) / steps,
        l = mix(a, b, f),
        r = mix(a, b, t),
        y = arch(f),
        h = arch(t);
      face(out, 'stone', 'pale', [p(l, y), p(r, h), p(r, head + 0.24), p(l, head + 0.24)], n);
      if (tier >= 1)
        face(out, 'stone', 'stone', [p(l, y), p(r, h), p(r, h, back), p(l, y, back)], down);
    }
    if (tier >= 2) {
      for (const t of [a, b]) {
        vertical(out, 'stone', 'pale', s, t, floor, 0.41, 0.36, 0.14);
        vertical(out, 'stone', 'pale', s, t, spring - 0.18, 0.22, 0.29, 0.17);
      }
    }
  }
  face(
    out,
    'brick',
    'brick',
    [p(0, head + 0.22), p(1, head + 0.22), p(1, top(1)), p(0, top(0))],
    n,
  );
  if (tier >= 1) {
    horizontal(out, 'stone', 'pale', s, 0, 1, head + 0.2, 0.32, 0.134);
    horizontal(out, 'stone', 'pale', s, 0, 1, f.eave - 0.57, 0.27, 0.13);
    for (let i = 0; i < count; i++) {
      const u = (i + 0.5) / count;
      window(out, s, u, 0.48 / count, head + 1.26, 4.32, tier);
      if (tier >= 2) window(out, s, u, 0.42 / count, head + 6.59, 2.42, tier);
    }
  }
}
function gardenCenter(out, s, style, tier) {
  if (style !== 'baroque' || s.len < 8 || s.n[0] < 0.92 || s.p(0.5, 0)[0] < 108) return;
  const z0 = s.p(0, 0)[2],
    z1 = s.p(1, 0)[2],
    l = Math.min(z0, z1),
    r = Math.max(z0, z1);
  if (l >= 67 || r <= 45) return;
  const lo = Math.max(45, l),
    hi = Math.min(67, r),
    u = Math.min((lo - z0) / (z1 - z0), (hi - z0) / (z1 - z0)),
    v = Math.max((lo - z0) / (z1 - z0), (hi - z0) / (z1 - z0));
  horizontal(out, 'stone', 'pale', s, u, v, 0.17, 16.9, 0.18);
  horizontal(out, 'stone', 'stone', s, u, v, 4.78, 0.36, 0.28);
  horizontal(out, 'stone', 'pale', s, u, v, 15.82, 0.71, 0.29);
  const bays = Math.max(1, Math.round((hi - lo) / 3.45));
  for (let i = 0; i < bays; i++) {
    const center = mix(u, v, (i + 0.5) / bays),
      w = ((v - u) * 0.52) / bays;
    vertical(out, 'stone', 'pale', s, mix(u, v, i / bays), 4.99, 10.9, 0.4, 0.36);
    if (tier) {
      window(out, { ...s, p: (u, y, d = 0) => s.p(u, y, d + 0.2) }, center, w, 5.81, 4.87, tier);
      if (tier >= 2)
        window(
          out,
          { ...s, p: (u, y, d = 0) => s.p(u, y, d + 0.2) },
          center,
          w * 0.84,
          11.68,
          2.61,
          tier,
        );
    }
  }
  vertical(out, 'stone', 'pale', s, v, 4.99, 10.9, 0.4, 0.36);
}
function facade(out, wing, f, tier) {
  const s = frame(f),
    { p, n, len } = s,
    style = wing.style,
    tone =
      style === 'baroque'
        ? 'brick'
        : style === 'gate'
          ? 'red'
          : style === 'hall'
            ? 'warm'
            : 'brick';
  if (tier <= 1 && !f.visible && len < (tier === 0 ? 21 : 9.9)) return;
  const gate =
    Math.abs(n[0]) > 0.38 &&
    layout.gates.find((g) => {
      const minX = Math.min(f.a[0], f.b[0]),
        maxX = Math.max(f.a[0], f.b[0]);
      return (
        maxX >= g.x0 - 0.65 &&
        minX <= g.x1 + 0.58 &&
        Math.max(f.a[1], f.b[1]) > g.z - g.width / 2 &&
        Math.min(f.a[1], f.b[1]) < g.z + g.width / 2
      );
    });
  if (gate && portalFace(out, f, s, gate, tier, tone)) return;
  if (f.court === 'Fountain Court' && len > 3.9) {
    arcade(out, f, s, tier);
    return;
  }
  const exterior = tier <= 1 && !f.visible ? Math.min(f.top[0], f.top[1]) - 3.1 : null;
  face(
    out,
    'brick',
    tone,
    [p(0, exterior ?? f.base[0]), p(1, exterior ?? f.base[1]), p(1, f.top[1]), p(0, f.top[0])],
    n,
  );
  if (!f.visible || len < 2.6) return;
  if (!tier) {
    if (style === 'baroque') gardenCenter(out, s, style, tier);
    return;
  }
  const baroque = style === 'baroque',
    hall = style === 'hall',
    height = f.eave;
  if (tier >= 2 || baroque) horizontal(out, 'stone', 'base', s, 0, 1, 0.21, 0.41, 0.092);
  if (baroque) {
    horizontal(out, 'stone', 'pale', s, 0, 1, 5.03, 0.26, 0.132);
    horizontal(out, 'stone', 'pale', s, 0, 1, height - 0.57, 0.35, 0.142);
  } else {
    horizontal(out, 'stone', 'stone', s, 0, 1, 3.84, 0.17, 0.078);
    horizontal(out, 'stone', 'stone', s, 0, 1, height - 0.42, 0.2, 0.076);
  }
  const bays = Math.max(
    1,
    Math.round(len / (tier === 1 ? 7.4 : baroque ? 4.36 : hall ? 4.87 : 4.05)),
  );
  for (let i = 0; i < bays; i++) {
    const u = (i + 0.5) / bays,
      insideGarden =
        baroque && n[0] > 0.92 && p(u, 0)[0] > 108 && p(u, 0)[2] > 44.7 && p(u, 0)[2] < 67.3;
    if (insideGarden) continue;
    const w = (baroque ? 0.43 : hall ? 0.52 : 0.47) / bays;
    if (hall) {
      window(out, s, u, w, 3.98, 7.46, tier, true, tier >= 3 ? 3 : 1);
      if (tier >= 2) vertical(out, 'stone', 'stone', s, (i + 0.1) / bays, 0.45, 11.3, 0.27, 0.135);
    } else {
      window(out, s, u, w, 1.14, 2.55, tier);
      window(out, s, u, w * 0.91, baroque ? 6.5 : 4.66, baroque ? 4.2 : 2.82, tier);
      if ((baroque || height > 13.1) && tier >= 2)
        window(out, s, u, w * 0.85, baroque ? 12.55 : 9.15, baroque ? 2.72 : 2.6, tier);
      if (tier >= 3 && !baroque && i % 2 === 0) {
        const a = p(u - w * 0.53, 1.04, 0.09),
          b = p(u + w * 0.53, 1.04, 0.09),
          c = p(u, 0.73, 0.09);
        face(out, 'brick', 'darkBrick', [a, b, c], n);
      }
    }
  }
  if (baroque) gardenCenter(out, s, style, tier);
  if (tier >= 2 && baroque && len > 11) {
    horizontal(out, 'stone', 'pale', s, 0, 1, height + 0.18, 0.28, 0.155);
    const pillars = Math.max(2, Math.ceil(len / (tier === 2 ? 2.72 : 1.45)));
    for (let i = 0; i <= pillars; i++)
      vertical(out, 'stone', 'pale', s, i / pillars, height - 0.09, 0.41, 0.21, 0.182);
  }
}
function chimney(out, c, tier, index) {
  const {
      p: [x, z],
      y,
      axis,
    } = c,
    brick = index % 3 === 0 ? 'red' : 'darkBrick';
  if (tier <= 1) {
    box(out, 'brick', brick, x, z, 1.14, 1.45, y - 0.2, y + 2.65);
    return;
  }
  const flues = tier === 2 ? 1 : index % 3 === 1 ? 3 : 2,
    sides = tier === 2 ? 4 : tier === 3 ? 6 : 8;
  const dx = axis === 'x' ? 1 : 0,
    dz = 1 - dx,
    highest = 2.74 + (index % 3) * 0.38;
  box(
    out,
    'brick',
    'brick',
    x,
    z,
    axis === 'x' ? flues * 0.73 + 0.36 : 1.22,
    axis === 'z' ? flues * 0.73 + 0.36 : 1.22,
    y - 0.26,
    y + 0.42,
  );
  for (let i = 0; i < flues; i++) {
    const a = x + dx * 0.73 * (i - (flues - 1) / 2),
      b = z + dz * 0.73 * (i - (flues - 1) / 2),
      top = y + highest + (i % 2) * 0.19;
    const rings = [
      [y + 0.21, 0.35],
      [y + 0.77, 0.28],
      [top - 0.22, 0.26],
      [top - 0.1, 0.36],
      [top, 0.35],
    ];
    loft(
      out,
      'brick',
      rings.map(([h, r]) => radialRing(h, r, r, sides, [a, b])),
      colors[brick],
      { cap: false },
    );
    const rim = radialRing(top - 0.025, 0.243, 0.243, sides, [a, b]);
    flat(
      out,
      'metal',
      'dark',
      rim.map(([x, , z]) => [x, z]),
      top - 0.025,
    );
  }
}
function roofs(out, wing, tier) {
  const tone = wing.style === 'baroque' ? 'lead' : 'slate';
  for (const patch of wing.roofs) roofTriangles(out, 'slate', tone, patch.rings, patch.heights);
  if (tier === 0) return;
  for (const [i, c] of wing.chimneys.entries()) {
    if ((tier === 1 && i % 3 !== 0) || (tier === 2 && i % 2 !== 0)) continue;
    chimney(out, c, tier, i);
  }
}
function bridge(out, tier) {
  const { rows, z, width } = layout.bridge,
    w = width / 2;
  for (let i = 1; i < rows.length; i++) {
    const a = rows[i - 1],
      b = rows[i],
      left = [a.x, a.y, z - w],
      right = [b.x, b.y, z - w];
    face(out, 'paving', 'path', [left, right, [b.x, b.y, z + w], [a.x, a.y, z + w]], up);
    if (b.x > layout.gates[0].x0 + 0.05) continue;
    for (const side of [-1, 1]) {
      const edge = z + side * w,
        n = [0, 0, side],
        top = 0.76;
      face(
        out,
        'stone',
        'stone',
        [
          [a.x, a.y - 0.32, edge],
          [b.x, b.y - 0.32, edge],
          [b.x, b.y + top, edge],
          [a.x, a.y + top, edge],
        ],
        n,
      );
      if (tier >= 1) {
        face(
          out,
          'stone',
          'stone',
          [
            [b.x, b.y - 0.18, edge - side * 0.41],
            [a.x, a.y - 0.18, edge - side * 0.41],
            [a.x, a.y + top, edge - side * 0.41],
            [b.x, b.y + top, edge - side * 0.41],
          ],
          [0, 0, -side],
        );
        face(
          out,
          'stone',
          'pale',
          [
            [a.x, a.y + top, edge + side * 0.09],
            [b.x, b.y + top, edge + side * 0.09],
            [b.x, b.y + top, edge - side * 0.53],
            [a.x, a.y + top, edge - side * 0.53],
          ],
          up,
        );
      }
      if (tier >= 2 && i % 2 === 1) {
        const x = a.x,
          y = a.y,
          base = a.base;
        box(out, 'stone', 'base', x, edge - side * 0.43, 1.06, 1.15, base, y + 0.78);
        box(out, 'stone', 'pale', x, edge - side * 0.43, 0.86, 0.92, y + 0.78, y + 1.17);
      }
    }
  }
  if (tier >= 1)
    for (let i = 1; i < rows.length - 1; i++) {
      const a = rows[i - 1],
        b = rows[i],
        span = b.x - a.x;
      if (Math.min(a.y - a.base, b.y - b.base) < 1.5) continue;
      const steps = tier === 1 ? 3 : 7;
      for (const side of [-1, 1]) {
        const n = [0, 0, side],
          edge = z + side * (w - 0.21);
        for (let j = 0; j < steps; j++) {
          const t = j / steps,
            u = (j + 1) / steps,
            low = (f) => mix(a.base, b.base, f) + Math.sin(Math.PI * f) * 0.92;
          face(
            out,
            'stone',
            'base',
            [
              [a.x + t * span, low(t), edge],
              [a.x + u * span, low(u), edge],
              [a.x + u * span, mix(a.y, b.y, u) - 0.29, edge],
              [a.x + t * span, mix(a.y, b.y, t) - 0.29, edge],
            ],
            n,
          );
        }
      }
    }
}
function passage(out, g, tier) {
  const { x0, x1, z, width, floor, spring, rise } = g,
    w = width / 2;
  face(
    out,
    'paving',
    'path',
    [
      [x0, floor, z - w],
      [x1, floor, z - w],
      [x1, floor, z + w],
      [x0, floor, z + w],
    ],
    up,
  );
  if (!tier) return;
  for (const side of [-1, 1]) {
    const a = z + side * w;
    face(
      out,
      'stone',
      'stone',
      [
        [x0, floor, a],
        [x1, floor, a],
        [x1, floor + spring, a],
        [x0, floor + spring, a],
      ],
      [0, 0, -side],
    );
  }
  const count = tier === 1 ? 5 : tier === 2 ? 7 : 12;
  for (let i = 0; i < count; i++) {
    const t = i / count,
      u = (i + 1) / count,
      a = z - w + width * t,
      b = z - w + width * u,
      ya = floor + archHeight(t, spring, rise, true),
      yb = floor + archHeight(u, spring, rise, true);
    face(
      out,
      'stone',
      'stone',
      [
        [x0, ya, a],
        [x1, ya, a],
        [x1, yb, b],
        [x0, yb, b],
      ],
      down,
    );
  }
}
function tower(out, t, tier) {
  const { x, z, r, height, base, lantern } = t,
    n = tier === 0 ? 4 : tier === 1 ? 6 : 8;
  const rings =
    tier <= 1
      ? [
          [base, r],
          [height + 0.05, r * 0.94],
        ]
      : [
          [base, r],
          [height - 0.75, r * 0.93],
          [height - 0.48, r * 1.05],
          [height - 0.23, r * 1.05],
        ];
  loft(
    out,
    'brick',
    rings.map(([y, s]) => radialRing(y, s, s, n, [x, z])),
    colors.red,
  );
  if (tier === 0) return;
  const count = tier === 1 ? 5 : 8;
  for (let i = 0; i < count; i++) {
    const a = (2 * Math.PI * (i + 0.5)) / count,
      dx = Math.cos(a) * r * 0.87,
      dz = Math.sin(a) * r * 0.87;
    if (tier === 1) {
      const n = [Math.cos(a), 0, Math.sin(a)],
        w = r * 0.17,
        center = [x + dx * 1.085, z + dz * 1.085];
      const p = (u, y) => [center[0] + n[2] * u, y, center[1] - n[0] * u];
      face(
        out,
        'brick',
        'red',
        [p(-w, height - 0.09), p(w, height - 0.09), p(w, height + 0.64), p(-w, height + 0.64)],
        n,
      );
    } else
      box(
        out,
        'brick',
        'red',
        x + dx,
        z + dz,
        r * 0.36,
        r * 0.36,
        height - 0.46,
        height + (lantern ? 0.72 : 0.51),
      );
  }
  if (tier === 1) return;
  const stoneRings = [
    [height - 0.8, r * 0.96],
    [height - 0.61, r * 1.08],
  ];
  loft(
    out,
    'stone',
    stoneRings.map(([y, s]) => radialRing(y, s, s, n, [x, z])),
    colors.stone,
    { cap: false },
  );
  if (lantern && tier >= 2) {
    loft(
      out,
      'stone',
      [
        [height + 0.39, r * 0.35],
        [height + 1.3, 0.13],
        [height + 1.63, 0.046],
      ].map(([y, s]) => radialRing(y, s, s, 6, [x, z])),
      colors.pale,
    );
  }
}
function clockCupola(out, tier) {
  const x = -20.75,
    z = 43.49,
    y = 16.39;
  if (tier === 0) {
    loft(
      out,
      'slate',
      [
        [y, 1.19],
        [y + 3.95, 1.19],
        [y + 5.04, 0.1],
      ].map(([h, r]) => radialRing(h, r, r, 4, [x, z])),
      colors.lead,
    );
    return;
  }
  const n = tier === 1 ? 6 : 10;
  loft(
    out,
    'stone',
    [
      [y, 1.39],
      [y + 0.34, 1.39],
      [y + 0.51, 1.25],
    ].map(([h, r]) => radialRing(h, r, r, n, [x, z])),
    colors.pale,
  );
  for (let i = 0; i < n; i++) {
    const a = (i * 2 * Math.PI) / n,
      X = x + 1.07 * Math.cos(a),
      Z = z + 1.07 * Math.sin(a);
    rod(out, 'stone', 'pale', [X, y + 0.46, Z], [X, y + 2.56, Z], 0.21, 0.22);
  }
  loft(
    out,
    'slate',
    [
      [y + 2.52, 1.4],
      [y + 2.82, 1.47],
      [y + 3.6, 1.14],
      [y + 4.17, 0.56],
      [y + 4.45, 0.065],
    ].map(([h, r]) => radialRing(h, r, r, n, [x, z])),
    colors.lead,
  );
  if (tier >= 2) rod(out, 'metal', 'gold', [x, y + 4.38, z], [x, y + 4.83, z], 0.098);
}
function gateOrnament(out, tier) {
  clockCupola(out, tier);
  if (!tier) return;
  const g = layout.gates[0],
    u = g.z,
    x = -79.48;
  const s = { len: 5.4, n: [-1, 0, 0], p: (t, y, d = 0) => [x - d, y, u + mix(-2.7, 2.7, t)] };
  horizontal(out, 'stone', 'pale', s, 0.14, 0.86, 7.22, 0.39, 0.55);
  horizontal(out, 'stone', 'pale', s, 0.18, 0.82, 7.61, 4.75, 0.48);
  window(
    out,
    { ...s, p: (u, y, d = 0) => s.p(u, y, d + 0.51) },
    0.5,
    0.49,
    8.31,
    3.52,
    tier,
    true,
    3,
  );
  horizontal(out, 'stone', 'pale', s, 0.13, 0.87, 12.36, 0.53, 0.57);
  horizontal(out, 'stone', 'pale', s, 0.07, 0.93, 14.96, 0.39, 0.33);
  if (tier >= 2) {
    const z0 = s.p(0.12, 0)[2],
      z1 = s.p(0.88, 0)[2];
    for (let i = 0; i < 7; i++)
      box(out, 'stone', 'pale', x - 0.05, mix(z0, z1, i / 6), 0.53, 0.31, 15.31, 16.12);
  }
  if (tier >= 2)
    for (const v of [0.19, 0.81]) vertical(out, 'stone', 'pale', s, v, 7.63, 5.9, 0.29, 0.58);
  const c = layout.gates[1],
    x2 = -16.16,
    y = 13.23,
    z = c.z,
    n = [1, 0, 0],
    count = tier === 1 ? 12 : tier === 2 ? 18 : 36;
  const p = (a, r, d) => [x2 + d, y + Math.sin(a) * r, z + Math.cos(a) * r],
    radius = 1.63;
  face(
    out,
    'stone',
    'stone',
    [
      [x2 + 0.029, y - 2.17, z - 2.18],
      [x2 + 0.029, y - 2.17, z + 2.18],
      [x2 + 0.029, y + 2.17, z + 2.18],
      [x2 + 0.029, y + 2.17, z - 2.18],
    ],
    n,
  );
  for (let i = 0; i < count; i++) {
    const a = (2 * Math.PI * i) / count,
      b = (2 * Math.PI * (i + 1)) / count;
    face(out, 'metal', 'dial', [[x2 + 0.065, y, z], p(a, radius, 0.065), p(b, radius, 0.065)], n);
    face(
      out,
      'metal',
      'gold',
      [
        p(a, radius * 0.92, 0.078),
        p(b, radius * 0.92, 0.078),
        p(b, radius + 0.12, 0.078),
        p(a, radius + 0.12, 0.078),
      ],
      n,
    );
  }
  if (tier >= 2) {
    const towerSide = {
      len: 4.8,
      n,
      p: (u, y, d = 0) => [x2 + 0.05 + d, y, z + mix(-2.4, 2.4, u)],
    };
    window(out, towerSide, 0.5, 0.56, 7.02, 2.54, tier, true, 3);
    window(out, towerSide, 0.5, 0.49, 10.04, 0.83, tier, false, 2);
    for (const a of [0.86, 2.2])
      rod(out, 'metal', 'gold', [x2 + 0.13, y, z], p(a, 1.18, 0.13), 0.085);
    for (let i = 0; i < 12; i++) {
      const a = (2 * Math.PI * i) / 12;
      rod(out, 'metal', 'gold', p(a, 0.79, 0.096), p(a, 0.96, 0.096), 0.056);
    }
  }
}
function courts(out, tier) {
  for (const c of layout.courts) flat(out, 'paving', 'gravel', c.ring, c.level);
  const {
      probe: [cx, cz],
      level: y,
    } = layout.courts[1],
    {
      center: [x, z],
      ring,
    } = layout.fountain;
  flat(out, 'grass', 'white', rect(cx, cz, 23.3, 19.8), y + 0.043);
  const profile =
    tier === 0
      ? [
          [y + 0.065, 1.04],
          [y + 0.48, 1.04],
        ]
      : [
          [y + 0.065, 1.035],
          [y + 0.4, 1.055],
          [y + 0.49, 1.048],
          [y + 0.49, 0.976],
          [y + 0.3, 0.976],
        ];
  const rings = profile.map(([h, scale]) =>
    ring.toReversed().map(([a, b]) => [mix(x, a, scale), h, mix(z, b, scale)]),
  );
  loft(out, 'stone', rings, colors.pale, { cap: false });
  const water = rings.at(-1).map(([x, , z]) => [x, z]);
  flat(out, 'water', 'white', water, y + 0.294);
  if (tier >= 2) {
    loft(
      out,
      'stone',
      [
        [y + 0.24, 0.55],
        [y + 0.62, 0.41],
        [y + 0.89, 0.33],
        [y + 1.02, 0.47],
      ].map(([h, r]) => radialRing(h, r, r, 12, [x, z])),
      colors.stone,
    );
    loft(
      out,
      'water',
      [
        [y + 0.99, 0.064],
        [y + 2.12, 0.047],
        [y + 2.52, 0.018],
      ].map(([h, r]) => radialRing(h, r, r, 8, [x, z])),
      colors.jet,
      { cap: false },
    );
  }
  if (tier < 3) return;
  const c = layout.courts[0],
    y0 = c.level + 0.022;
  for (const slope of [-1, 1])
    for (let j = 0; j < 8; j++) {
      const a = -69 + 5 * j,
        b = Math.min(-31, a + 17),
        z0 = slope > 0 ? 24.5 : 63.7,
        z1 = z0 + slope * (b - a);
      face(
        out,
        'brick',
        'warm',
        [
          [a, y0, z0],
          [b, y0, z1],
          [b, y0, z1 + 0.13],
          [a, y0, z0 + 0.13],
        ],
        up,
      );
    }
}
export function buildHamptonLevel(out, level) {
  const tier = levels[level];
  if (tier === undefined) throw Error(`Unknown Hampton Court level ${level}`);
  for (const w of tier <= 1 ? layout.coarseWings : layout.wings) {
    roofs(out, w, tier);
    for (const f of w.faces) facade(out, w, f, tier);
  }
  for (const t of layout.towers) tower(out, t, tier);
  for (const g of layout.gates) passage(out, g, tier);
  bridge(out, tier);
  courts(out, tier);
  gateOrnament(out, tier);
}
export const buildHamptonSkyline = (out) => buildHamptonLevel(out, 'skyline');
export const buildHamptonDistrict = (out) => buildHamptonLevel(out, 'district');
export const buildHamptonStreet = (out) => buildHamptonLevel(out, 'street');
export const buildHamptonCloseup = (out) => buildHamptonLevel(out, 'closeup');
