/** Historic Al-Sarafiya deck, two high steel trusses and the low central span. */
import { readFileSync } from 'node:fs';
import {
  beam,
  loft,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
export const layout = JSON.parse(readFileSync(new URL('../layout.json', import.meta.url)));
export const surfaces = {
  concrete: { slot: 'wall', graph: 'concrete_boardformed', roughness: 0.93 },
  paving: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.96 },
  steel: { slot: 'trim', graph: 'metal_painted', roughness: 0.79, metallic: 0.15 },
};
const colors = {
  body: [0.57, 0.552, 0.5],
  foot: [0.433, 0.412, 0.36],
  soffit: [0.347, 0.344, 0.323],
  fascia: [0.64, 0.602, 0.526],
  asphalt: [0.193, 0.18, 0.159],
  walk: [0.492, 0.445, 0.361],
  fill: [0.491, 0.379, 0.248],
  paint: [0.56, 0.587, 0.568],
  joint: [0.35, 0.399, 0.399],
  shadow: [0.242, 0.285, 0.293],
  bolt: [0.431, 0.484, 0.479],
  line: [0.792, 0.76, 0.66],
  red: [0.61, 0.117, 0.053],
  lamp: [0.494, 0.515, 0.481],
  yellow: [0.83, 0.667, 0.302],
};
const up = [0, 1, 0],
  ref = 'palette:#ffffff',
  mix = (a, b, t) => a + (b - a) * t,
  range = (n) => Array.from({ length: n }, (_, i) => i);
const { deck, plan, piers, spans, body, outer, halfWidth: w, bankSkews } = layout;
function station(rows, x) {
  const i = rows.findIndex((r) => r[0] >= x);
  if (i <= 0) return rows.at(i).slice(1);
  const a = rows[i - 1],
    b = rows[i],
    t = (x - a[0]) / (b[0] - a[0]);
  return a.slice(1).map((v, k) => mix(v, b[k + 1], t));
}
function at(x, offset, lift = 0) {
  const [y, z] = station(deck, x);
  const a = Math.max(outer[0], x - 1.5),
    b = Math.min(outer[1], x + 1.5);
  let skew = -(station(plan, b)[0] - station(plan, a)[0]) / (b - a);
  if (x < outer[0] + 12) skew = mix(bankSkews[0], skew, (x - outer[0]) / 12);
  if (x > outer[1] - 12) skew = mix(bankSkews[1], skew, (outer[1] - x) / 12);
  const v = offset / Math.hypot(1, skew);
  return [x + skew * v, y + lift, z + v];
}
function tri(o, slot, tone, p, wanted) {
  let n = normalFor(...p);
  if (n.reduce((a, v, i) => a + v * wanted[i], 0) < 0) {
    p = p.toReversed();
    n = n.map((v) => -v);
  }
  if (Math.hypot(...n) > 0.5) o.addTriangle(slot, ref, p, n, undefined, colors[tone]);
}
function quad(o, slot, tone, a, b, c, d, n) {
  tri(o, slot, tone, [a, b, c], n);
  tri(o, slot, tone, [a, c, d], n);
}
function strip(o, slot, tone, a, b, u, v, y = 0) {
  quad(o, slot, tone, at(a, u, y), at(a, v, y), at(b, v, y), at(b, u, y), up);
}
const rod = (o, slot, tone, a, b, width, depth = width) =>
  beam(o, slot, a, b, width, depth, colors[tone]);
function ring(x, y, z, dx, dz, s = 0, chamfer = false) {
  const a = dx / 2,
    b = dz / 2;
  const outline = chamfer
    ? [
        [-a, -b * 0.71],
        [-a * 0.62, -b],
        [a * 0.62, -b],
        [a, -b * 0.71],
        [a, b * 0.71],
        [a * 0.62, b],
        [-a * 0.62, b],
        [-a, b * 0.71],
      ].reverse()
    : [
        [-a, -b],
        [-a, b],
        [a, b],
        [a, -b],
      ];
  return outline.map(([u, v]) => [x + u + s * v, y, z + v]);
}
function block(o, slot, tone, x, z, lo, hi, dx, dz, s = 0) {
  loft(o, slot, [ring(x, lo, z, dx, dz, s), ring(x, hi, z, dx, dz, s)], colors[tone]);
}
function deckRows(tier) {
  if (tier >= 2) return deck.map((p) => p[0]);
  const n = tier === 0 ? 5 : 2;
  return [
    ...new Set([
      ...outer,
      ...body,
      ...plan.map((p) => p[0]),
      ...deck.filter((p, i) => i % n === 0).map((p) => p[0]),
    ]),
  ].sort((a, b) => a - b);
}
function pavement(o, tier) {
  const rows = deckRows(tier),
    lane = 4.2;
  const curb = (x) => 0.17 * Math.min(1, (x - outer[0]) / 8, (outer[1] - x) / 8);
  for (let i = 1; i < rows.length; i++) {
    const a = rows[i - 1],
      b = rows[i],
      m = (a + b) * 0.5,
      onViaduct = m >= body[0] && m <= body[1],
      depth = onViaduct ? 1.79 : 0.26;
    strip(o, 'paving', 'asphalt', a, b, tier === 0 ? -w : -lane, tier === 0 ? w : lane);
    if (tier > 0)
      for (const s of [-1, 1]) {
        const u = s * lane,
          v = s * w;
        quad(
          o,
          'paving',
          'walk',
          at(a, u, curb(a)),
          at(a, v, curb(a)),
          at(b, v, curb(b)),
          at(b, u, curb(b)),
          up,
        );
        quad(o, 'concrete', 'fascia', at(a, u), at(a, u, curb(a)), at(b, u, curb(b)), at(b, u), [
          0,
          0,
          -s,
        ]);
      }
    const a0 = at(a, -w, -0.035),
      a1 = at(a, w, -0.035),
      b0 = at(b, -w, -0.035),
      b1 = at(b, w, -0.035);
    const a2 = at(a, -w * 0.79, -depth),
      a3 = at(a, w * 0.79, -depth),
      b2 = at(b, -w * 0.79, -depth),
      b3 = at(b, w * 0.79, -depth);
    quad(o, 'concrete', 'soffit', a2, b2, b3, a3, [0, -1, 0]);
    quad(o, 'concrete', 'body', a0, b0, b2, a2, [0, -0.47, -1]);
    quad(o, 'concrete', 'body', a1, b1, b3, a3, [0, -0.47, 1]);
    if (tier >= 2) {
      for (const s of [-1, 1])
        strip(o, 'steel', 'line', a, b, s * 3.9 - 0.043, s * 3.9 + 0.043, 0.014);
      if (onViaduct && i % 3 === 1)
        rod(o, 'steel', 'shadow', at(a, -4.62, -1.6), at(a, 4.62, -1.6), 0.21, 0.26);
    }
  }
  if (tier >= 2) {
    for (let x = outer[0] + 7; x < outer[1] - 8; x += 11)
      strip(o, 'steel', 'line', x, x + 3.75, -0.064, 0.064, 0.016);
    for (const { x } of piers)
      strip(o, 'steel', 'shadow', x - 0.093, x + 0.093, -lane, lane, 0.024);
  }
  for (const fills of layout.approachFills)
    for (let i = 1; i < fills.length; i++)
      for (const s of [-1, 1]) {
        const a = fills[i - 1],
          b = fills[i],
          top = (p) => at(p.x, p.top[2] * s, -0.092),
          toe = (p) => [p.x, p.toe[s === -1 ? 0 : 1], p.top[1] + s * p.skirt];
        quad(o, 'paving', 'fill', top(a), toe(a), toe(b), top(b), [0, 1, s]);
      }
}
function supports(o, tier) {
  for (const p of piers) {
    const { x, z, base, top, w, d, bank, river, skew } = p;
    if (tier === 0) {
      block(o, 'concrete', 'body', x, z, base, top + 0.12, w, d, skew);
      continue;
    }
    const chamfer = river,
      lower = Math.min(base + 1.9, top - 1.55);
    loft(
      o,
      'concrete',
      [
        ring(x, base, z, w * 1.2, d * 1.09, skew, chamfer),
        ring(x, lower, z, w * 1.15, d * 1.07, skew, chamfer),
        ring(x, top - 0.7, z, w * 0.91, d * 0.94, skew, chamfer),
        ring(x, top + 0.1, z, w * 1.13, d * (bank ? 1.01 : 1.09), skew, chamfer),
      ],
      colors.body,
    );
    if (tier >= 2)
      for (const off of [-d * 0.35, d * 0.35]) {
        block(
          o,
          'steel',
          'shadow',
          x + skew * off,
          z + off,
          top + 0.09,
          top + 0.3,
          0.73,
          1.32,
          skew,
        );
      }
  }
}
/** Low LODs preserve the truss voids with two-sided ribbon members. */
function ribbon(o, tone, a, b, width) {
  const dx = b[0] - a[0],
    dy = b[1] - a[1],
    mag = Math.hypot(dx, dy),
    w = width * 0.5;
  const x = mag ? (dy / mag) * w : w,
    y = mag ? (-dx / mag) * w : 0;
  for (const s of [-1, 1])
    quad(
      o,
      'steel',
      tone,
      [a[0] - x, a[1] - y, a[2]],
      [b[0] - x, b[1] - y, b[2]],
      [b[0] + x, b[1] + y, b[2]],
      [a[0] + x, a[1] + y, a[2]],
      [0, 0, s],
    );
}
function topHeight(span, t) {
  const end = span.style === 'high' ? 0.68 : 0.9;
  return span.height * mix(end, 1, Math.min(1, t / 0.195, (1 - t) / 0.195));
}
function portal(o, x, z, y, tier) {
  const west = at(x, -z, y),
    east = at(x, z, y),
    drop = 0.63;
  rod(o, 'steel', 'paint', west, east, 0.255, 0.25);
  if (tier <= 2) return;
  const A = at(x, -z, y - drop),
    B = at(x, z, y - drop);
  rod(o, 'steel', 'joint', A, B, 0.188, 0.16);
  const n = tier === 2 ? 6 : 9;
  for (let i = 0; i < n; i++) {
    const a = mix(-z, z, i / n),
      b = mix(-z, z, (i + 1) / n);
    rod(
      o,
      'steel',
      'paint',
      at(x, a, y - (i % 2 ? drop : 0)),
      at(x, b, y - (i % 2 ? 0 : drop)),
      0.108,
    );
  }
  for (const s of [-1, 1])
    rod(o, 'steel', 'paint', at(x, s * z, y - 1.65), at(x, s * (z - 1.03), y - 0.38), 0.183);
}
function gusset(o, x, z, y, s, tier) {
  const d = s * 0.038;
  const a = at(x - 0.51, z + d, y - 0.3),
    b = at(x + 0.51, z + d, y - 0.3),
    c = at(x + 0.35, z + d, y + 0.24),
    v = at(x - 0.36, z + d, y + 0.24);
  quad(o, 'steel', 'joint', a, b, c, v, [0, 0, s]);
  if (tier >= 3) {
    const n = tier === 4 ? 3 : 2;
    for (let i = 0; i < n; i++)
      for (const h of [-0.18, 0.14]) {
        const X = x - 0.24 + i * 0.24,
          U = z + d + s * 0.033;
        rod(o, 'steel', 'bolt', at(X, U, y + h), at(X, U + s * 0.036, y + h), 0.051);
      }
  }
}
function truss(o, span, tier) {
  const { a, b, style, bays } = span,
    through = style !== 'pony',
    high = style === 'high';
  const n =
    tier === 0
      ? high
        ? 4
        : style === 'low'
          ? 3
          : 2
      : tier === 1
        ? Math.ceil(bays * 0.48)
        : tier === 2
          ? Math.ceil(bays * 0.78)
          : bays;
  const x = (i) => mix(a, b, i / n),
    top = (i) => topHeight(span, i / n),
    upper = through ? 3.82 : 4.59,
    lower = through ? 4.42 : 4.64;
  for (const s of [-1, 1]) {
    const low = (i) => at(x(i), s * lower, 0.41),
      hi = (i) => at(x(i), s * upper, top(i));
    for (let i = 0; i < n; i++) {
      const A = low(i),
        B = low(i + 1),
        C = hi(i),
        D = hi(i + 1);
      if (tier === 0) {
        ribbon(o, 'shadow', A, B, 0.36);
        ribbon(o, 'paint', C, D, 0.43);
        ribbon(o, 'joint', i % 2 ? A : C, i % 2 ? D : B, 0.26);
      } else {
        rod(o, 'steel', 'shadow', A, B, 0.26, 0.34);
        rod(o, 'steel', 'paint', C, D, through ? 0.33 : 0.23, 0.29);
        const start = i % 2 ? A : C,
          end = i % 2 ? D : B;
        if (tier === 1) ribbon(o, 'paint', start, end, 0.22);
        else rod(o, 'steel', 'paint', start, end, through ? 0.245 : 0.172, 0.175);
        if (tier >= 2) {
          rod(o, 'steel', 'joint', A, C, through ? 0.24 : 0.157, 0.186);
          if (i === n - 1) rod(o, 'steel', 'joint', B, D, through ? 0.24 : 0.157, 0.186);
          if (tier >= 3) {
            gusset(o, x(i), s * (upper + 0.156), top(i), s, tier);
            gusset(o, x(i), s * (lower + 0.162), 0.44, s, tier);
            if (high) {
              const offset = 0.098;
              rod(
                o,
                'steel',
                'paint',
                at(x(i), s * lower + offset, 0.67),
                at(x(i), s * upper + offset, top(i) - 0.25),
                0.061,
              );
              for (let j = 0; j < 4; j++) {
                const f = j / 4,
                  g = (j + 1) / 4;
                const u = A.map((v, k) => mix(v, C[k], f)),
                  v = A.map((v, k) => mix(v, C[k], g));
                rod(o, 'steel', 'joint', [u[0] + 0.1, u[1], u[2]], [v[0] - 0.1, v[1], v[2]], 0.062);
              }
            }
          }
        }
      }
    }
    if (tier === 0) {
      ribbon(o, 'paint', low(0), hi(0), 0.39);
      ribbon(o, 'paint', low(n), hi(n), 0.39);
    }
  }
  if (through && tier > 0) {
    for (let i = 0; i <= n; i++) {
      if (tier === 1 && i % 2 && i !== n) continue;
      portal(o, x(i), upper, top(i), tier);
      if (tier >= 2 && i < n)
        for (const s of [-1, 1]) {
          rod(
            o,
            'steel',
            'joint',
            at(x(i), s * upper, top(i) - 0.14),
            at(x(i + 1), -s * upper, top(i + 1) - 0.14),
            0.13,
            0.11,
          );
        }
    }
  }
}
function details(o, tier) {
  if (tier === 0) return;
  const rows = deckRows(tier);
  for (const s of [-1, 1]) {
    const z = s * (w - 0.14);
    for (let i = 1; i < rows.length; i++) {
      const a = rows[i - 1],
        b = rows[i];
      if (tier <= 2) ribbon(o, 'joint', at(a, z, 1.02), at(b, z, 1.02), tier === 1 ? 0.22 : 0.126);
      else {
        rod(o, 'steel', 'shadow', at(a, z, 1.03), at(b, z, 1.03), 0.082);
        rod(o, 'steel', 'joint', at(a, z, 0.37), at(b, z, 0.37), 0.056);
      }
    }
    const pitch = [0, 15.4, 7.2, 3.47, 2.93][tier];
    for (let x = outer[0] + 4; x < outer[1] - 4; x += pitch) {
      if (tier <= 2) ribbon(o, 'joint', at(x, z, 0.13), at(x, z, 1.03), 0.071);
      else rod(o, 'steel', 'paint', at(x, z, 0.13), at(x, z, 1.03), 0.064);
      if (tier >= 3) {
        const end = Math.min(outer[1], x + pitch);
        rod(o, 'steel', 'joint', at(x, z, 0.37), at(end, z, 1.0), 0.038);
      }
    }
  }
  if (tier >= 2) {
    const lo = spans[1].a + 1.1,
      hi = spans.at(-2).b;
    const pitch = tier === 2 ? 9.3 : tier === 3 ? 2.44 : 1.84;
    for (let x = lo; x < hi; x += pitch) {
      rod(o, 'steel', 'red', at(x, 0, 0.04), at(x, 0, 0.91), 0.102);
      if (tier >= 3) rod(o, 'steel', 'line', at(x, 0, 0.35), at(x, 0, 0.55), 0.108);
    }
    let i = 0;
    for (let x = body[0] + 18; x < body[1] - 18; x += 34, i++) {
      const z = (i % 2 ? -1 : 1) * (w - 0.4),
        y = 6.34;
      rod(o, 'steel', 'lamp', at(x, z, 0.19), at(x, z, y), 0.112);
      rod(o, 'steel', 'lamp', at(x, z, y), at(x, z * 0.79, y + 0.38), 0.096);
      rod(o, 'steel', 'yellow', at(x, z * 0.79, y + 0.38), at(x, z * 0.73, y + 0.38), 0.152, 0.11);
    }
  }
}
export function buildSarafiyaLevel(o, level) {
  const tier = ['skyline', 'district', 'street', 'closeup', 'master'].indexOf(level);
  if (tier < 0) throw Error('Unknown Al-Sarafiya level ' + level);
  pavement(o, tier);
  supports(o, tier);
  for (const span of spans) truss(o, span, tier);
  details(o, tier);
}
export const buildSarafiyaSkyline = (o) => buildSarafiyaLevel(o, 'skyline');
export const buildSarafiyaDistrict = (o) => buildSarafiyaLevel(o, 'district');
export const buildSarafiyaStreet = (o) => buildSarafiyaLevel(o, 'street');
export const buildSarafiyaCloseup = (o) => buildSarafiyaLevel(o, 'closeup');
