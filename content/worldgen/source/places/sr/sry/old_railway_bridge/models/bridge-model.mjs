/** Belgrade's four-span riveted railway lattice as documented before conversion. */
import { readFileSync } from 'node:fs';
import {
  beam,
  chamferedRectangle,
  loft,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { tubePath } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

export const layout = JSON.parse(readFileSync(new URL('../layout.json', import.meta.url)));
export const bridgeSurfaces = {
  iron: { slot: 'trim', graph: 'metal_painted', roughness: 0.86, metallic: 0.28 },
  stone: { slot: 'foundation', graph: 'stone_ashlar', roughness: 0.94 },
  wood: { slot: 'foundation', graph: 'wood_plain', roughness: 0.96 },
};
const tint = {
  chord: '656056',
  web: '706659',
  plate: '806e58',
  rust: '8f775e',
  rivet: '625a4e',
  track: '7a7c73',
  deck: '645d50',
  under: '514f46',
  pier: 'a29a86',
  belt: '81796b',
  cutwater: '918b79',
  tile: '9e9682',
};
const color = Object.fromEntries(
  Object.entries(tint).map(([k, hex]) => [
    k,
    hex.match(/../g).map((b) => {
      const v = parseInt(b, 16) / 255;
      return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    }),
  ]),
);
const tiers = { skyline: 0, district: 1, street: 2, closeup: 3, master: 4 },
  up = [0, 1, 0],
  down = [0, -1, 0],
  ref = 'palette:#ffffff';
const mix = (a, b, t) => a + (b - a) * t;
export function deckY(x) {
  const i = layout.deck.findIndex((p) => x <= p[0]);
  if (i <= 0) return layout.deck.at(i)[1];
  const [[a, y], [b, Y]] = layout.deck.slice(i - 1, i + 1);
  return mix(y, Y, (x - a) / (b - a));
}
const at = (x, z, y = 0) => [x, deckY(x) + y, z];
const rod = (out, mat, tone, a, b, w, d = w) => beam(out, mat, a, b, w, d, color[tone]);
function panel(out, mat, tone, a, b, c, d, normal) {
  for (let t of [
    [a, b, c],
    [a, c, d],
  ]) {
    let n = normalFor(...t);
    if (n.reduce((s, v, i) => s + v * normal[i], 0) < 0) {
      t = t.toReversed();
      n = normalFor(...t);
    }
    if (Math.hypot(...n) > 0.5) out.addTriangle(mat, ref, t, n, undefined, color[tone]);
  }
}
function silhouetteMember(out, tone, a, b, width) {
  const dx = b[0] - a[0],
    dy = b[1] - a[1],
    r = (width * 0.5) / Math.hypot(dx, dy),
    u = -dy * r,
    v = dx * r;
  for (const sign of [-1, 1]) {
    const z = a[2] + sign * 0.075;
    panel(
      out,
      'iron',
      tone,
      [a[0] + u, a[1] + v, z],
      [b[0] + u, b[1] + v, z],
      [b[0] - u, b[1] - v, z],
      [a[0] - u, a[1] - v, z],
      [0, 0, sign],
    );
  }
}
function deck(out, tier) {
  const [first, last] = layout.ends,
    W = layout.halfWidth;
  for (let i = 1; i < layout.deck.length; i++) {
    const a = layout.deck[i - 1][0],
      b = layout.deck[i][0];
    panel(out, 'wood', 'deck', at(a, -W), at(b, -W), at(b, W), at(a, W), up);
    panel(
      out,
      'iron',
      'under',
      at(a, -W, -0.29),
      at(b, -W, -0.29),
      at(b, W, -0.29),
      at(a, W, -0.29),
      down,
    );
    for (const side of [-1, 1]) {
      const z = side * W;
      panel(out, 'iron', 'chord', at(a, z), at(b, z), at(b, z, -0.6), at(a, z, -0.6), [0, 0, side]);
      if (tier > 0)
        rod(
          out,
          'iron',
          'track',
          at(a, side * 0.7175, 0.17),
          at(b, side * 0.7175, 0.17),
          0.082,
          0.126,
        );
      if (tier > 2)
        rod(
          out,
          'iron',
          'track',
          at(a, side * 0.7175, 0.25),
          at(b, side * 0.7175, 0.25),
          0.086,
          0.036,
        );
    }
  }
  if (tier >= 2) {
    const pitch = tier === 2 ? 2.5 : tier === 3 ? 0.83 : 0.59;
    for (let x = first + 0.5; x < last - 0.4; x += pitch) {
      rod(out, 'wood', 'deck', at(x, -1.33, 0.045), at(x, 1.33, 0.045), 0.22, 0.14);
      if (tier >= 3 && Math.round(x / pitch) % 7 === 0)
        for (const s of [-1, 1])
          rod(out, 'iron', 'plate', at(x, s * 0.7175, 0.07), at(x, s * 0.7175, 0.115), 0.28, 0.22);
    }
  }
}
function lattice(out, tier) {
  const W = layout.halfWidth,
    H = layout.trussHeight;
  const n = [5, 8, 14, 17, 19][tier];
  for (let span = 1; span < layout.spanEnds.length; span++) {
    const a = layout.spanEnds[span - 1],
      b = layout.spanEnds[span],
      A = a + 0.17,
      B = b - 0.17,
      x = (i) => mix(A, B, i / n);
    const low = (i, z) => at(x(i), z, 0.29),
      high = (i, z) => at(x(i), z, H);
    for (const s of [-1, 1]) {
      const z = s * W;
      if (tier === 0) {
        silhouetteMember(out, 'chord', low(0, z), low(n, z), 0.57);
        silhouetteMember(out, 'chord', high(0, z), high(n, z), 0.55);
        for (const i of [0, n]) silhouetteMember(out, 'chord', low(i, z), high(i, z), 0.49);
      } else {
        rod(out, 'iron', 'chord', low(0, z), low(n, z), 0.56, 0.57);
        rod(out, 'iron', 'chord', high(0, z), high(n, z), 0.55, 0.57);
        for (const i of [0, n]) rod(out, 'iron', 'chord', low(i, z), high(i, z), 0.45, 0.59);
      }
      for (let i = 0; i < n; i++) {
        const tone = tier >= 2 && i % 4 === 2 ? 'rust' : 'web';
        if (tier === 0) {
          silhouetteMember(out, tone, low(i, z - 0.06 * s), high(i + 1, z - 0.06 * s), 0.44);
          silhouetteMember(out, tone, high(i, z + 0.06 * s), low(i + 1, z + 0.06 * s), 0.44);
        } else {
          rod(out, 'iron', tone, low(i, z - 0.055 * s), high(i + 1, z - 0.055 * s), 0.28, 0.37);
          rod(out, 'iron', tone, high(i, z + 0.055 * s), low(i + 1, z + 0.055 * s), 0.28, 0.37);
          if (i > 0 && (tier > 1 || i % 2 === 0))
            rod(out, 'iron', 'chord', low(i, z), high(i, z), 0.29, 0.34);
        }
        if (tier < 2) continue;
        for (const y of [0.42, H - 0.14]) {
          const p = x(i),
            faceZ = z + s * 0.249;
          panel(
            out,
            'iron',
            'plate',
            at(p - 0.53, faceZ, y - 0.34),
            at(p + 0.52, faceZ, y - 0.34),
            at(p + 0.34, faceZ, y + 0.32),
            at(p - 0.37, faceZ, y + 0.32),
            [0, 0, s],
          );
          if (tier >= 3 && (tier === 4 || i % 2 === 0))
            for (const dx of [-0.28, 0, 0.28])
              for (const dy of [-0.19, 0.16]) {
                tubePath(
                  out,
                  'iron',
                  [at(p + dx, faceZ, y + dy), at(p + dx, faceZ + s * 0.044, y + dy)],
                  0.059,
                  color.rivet,
                  5,
                );
              }
        }
      }
    }
    for (const i of tier === 0 ? [0, n] : Array.from({ length: n + 1 }, (_, k) => k)) {
      rod(out, 'iron', 'chord', high(i, -W), high(i, W), 0.31, 0.31);
      if (tier > 0) rod(out, 'iron', 'chord', at(x(i), -W, -0.55), at(x(i), W, -0.55), 0.37, 0.37);
      if (i === n || tier < 2) continue;
      for (const s of [-1, 1]) {
        rod(out, 'iron', 'web', high(i, s * W), high(i + 1, -s * W), 0.139, 0.18);
        if (tier >= 3)
          rod(out, 'iron', 'web', at(x(i), s * W, -0.48), at(x(i + 1), -s * W, -0.48), 0.12, 0.16);
      }
    }
  }
}
function supports(out, tier) {
  for (const [x, grade] of [...layout.piers, ...layout.abutments]) {
    const abut = Math.abs(x) > 190,
      y = deckY(x),
      base = Math.min(-0.67, grade - 1.6);
    const rows = abut
      ? [
          [grade - 2.0, 8.8, 9.8],
          [y - 1.0, 7.2, 8.4],
          [y - 0.38, 8.0, 9.0],
        ]
      : [
          [base, 6.6, 10.7],
          [Math.max(1.15, grade - 0.38), 6.5, 10.7],
          [Math.max(1.8, grade + 0.25), 5.8, 9.3],
          [y - 1.06, 5.5, 8.8],
          [y - 0.52, 6.4, 9.7],
        ];
    const cut = abut ? 0.6 : tier === 0 ? 1.16 : 1.65;
    const rings = tier === 0 ? [rows[0], rows.at(-1)] : rows;
    loft(
      out,
      'stone',
      rings.map(([h, w, d]) => chamferedRectangle(x, h, 0, w, d, cut)),
      color.pier,
    );
    if (tier >= 2)
      loft(
        out,
        'stone',
        [
          [y - 1.19, 6.01, 9.29],
          [y - 1.02, 6.5, 9.78],
        ].map(([h, w, d]) => chamferedRectangle(x, h, 0, w, d, cut)),
        color.belt,
      );
    if (tier > 0 && !abut)
      for (const s of [-1, 1])
        rod(out, 'iron', 'under', at(x, s * 2.62, -0.59), at(x, s * 2.62, -0.31), 0.69, 1.9);
  }
}
export function buildBridgeLevel(out, level) {
  const tier = tiers[level];
  if (tier === undefined) throw Error(`Unknown Belgrade railway bridge level ${level}`);
  deck(out, tier);
  lattice(out, tier);
  supports(out, tier);
}
export const buildBridgeSkyline = (out) => buildBridgeLevel(out, 'skyline');
export const buildBridgeDistrict = (out) => buildBridgeLevel(out, 'district');
export const buildBridgeStreet = (out) => buildBridgeLevel(out, 'street');
export const buildBridgeCloseup = (out) => buildBridgeLevel(out, 'closeup');
