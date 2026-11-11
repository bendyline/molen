/** Twin needle pylons and a single central plane of stays over the Élorn. */
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
  concrete: { slot: 'foundation', graph: 'concrete_boardformed', roughness: 0.9 },
  pavement: { slot: 'wall', graph: 'gravel', roughness: 0.94 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.72, metallic: 0.27 },
  stays: { slot: 'trim', graph: 'metal_stainless', roughness: 0.58, metallic: 0.54 },
};
const colors = {
  pier: '9a9b91',
  plinth: '767f7c',
  tower: 'a0a59c',
  fascia: 'c4c7bd',
  box: '788283',
  road: '545a59',
  edge: '747a76',
  rail: '87908a',
  paint: 'e1dfce',
  cable: '555e60',
  anchor: '9ba6a2',
  seam: '50585b',
};
const palette = Object.fromEntries(
  Object.entries(colors).map(([k, hex]) => [
    k,
    hex.match(/../g).map((b) => {
      const s = Number.parseInt(b, 16) / 255;
      return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    }),
  ]),
);
const tiers = { skyline: 0, district: 1, street: 2, closeup: 3, master: 4 },
  ref = 'palette:#ffffff',
  up = [0, 1, 0],
  down = [0, -1, 0];
const mix = (a, b, t) => a + (b - a) * t;
const value = (rows, x, axis = 1) => {
  const i = rows.findIndex((r) => x <= r[0]);
  if (i <= 0) return rows.at(i)[axis];
  const a = rows[i - 1],
    b = rows[i];
  return mix(a[axis], b[axis], (x - a[0]) / (b[0] - a[0]));
};
export const deckY = (x) => value(layout.deck, x);
export const centerZ = (x) => value(layout.guide, x);
const half = (x) => value(layout.guide, x, 2);
function at(x, z, y = 0) {
  const endBlend = Math.max(0, 1 - (layout.ends[1] - x) / 18);
  return [
    x + endBlend * (layout.eastLandingSkew[0] + z * layout.eastLandingSkew[1]),
    deckY(x) + y,
    centerZ(x) + z,
  ];
}
function face(out, slot, tone, a, b, c, d, normal) {
  for (let t of [
    [a, b, c],
    [a, c, d],
  ]) {
    let n = normalFor(...t);
    if (n.reduce((s, v, i) => s + v * normal[i], 0) < 0) {
      t = t.toReversed();
      n = normalFor(...t);
    }
    out.addTriangle(slot, ref, t, n, undefined, palette[tone]);
  }
}
function strip(out, slot, tone, a, b, left, right, y = 0, normal = up) {
  face(
    out,
    slot,
    tone,
    at(a, left(a), y),
    at(b, left(b), y),
    at(b, right(b), y),
    at(a, right(a), y),
    normal,
  );
}
function rod(out, slot, tone, a, b, w, d = w) {
  beam(out, slot, a, b, w, d, palette[tone]);
}
function box(out, slot, tone, x, rows, chamfer) {
  const z = centerZ(x);
  loft(
    out,
    slot,
    rows.map(([y, w, d]) =>
      chamfer
        ? chamferedRectangle(x, y, z, w, d, chamfer)
        : [
            [x - w / 2, y, z - d / 2],
            [x - w / 2, y, z + d / 2],
            [x + w / 2, y, z + d / 2],
            [x + w / 2, y, z - d / 2],
          ],
    ),
    palette[tone],
  );
}
const stations = [
  ...new Set([...layout.deck.map((p) => p[0]), ...layout.guide.map((p) => p[0])]),
].sort((a, b) => a - b);
function deck(out, tier) {
  for (let i = 1; i < stations.length; i++) {
    const a = stations[i - 1],
      b = stations[i],
      center = () => 4.82;
    strip(out, 'pavement', 'road', a, b, (x) => -half(x), half);
    strip(out, 'concrete', 'box', a, b, (x) => -center(x), center, -3.22, down);
    for (const side of [-1, 1]) {
      const n = [0, 0, side],
        w = (x) => half(x) * side,
        bottom = center() * side;
      face(
        out,
        'concrete',
        'fascia',
        at(a, w(a)),
        at(b, w(b)),
        at(b, w(b), -0.52),
        at(a, w(a), -0.52),
        n,
      );
      face(
        out,
        'concrete',
        'box',
        at(a, w(a), -0.52),
        at(b, w(b), -0.52),
        at(b, bottom, -3.22),
        at(a, bottom, -3.22),
        down,
      );
      if (tier === 0) continue;
      strip(
        out,
        'concrete',
        'edge',
        a,
        b,
        (x) => side * (half(x) - 0.75),
        (x) => side * half(x),
        0.09,
      );
      face(
        out,
        'concrete',
        'edge',
        at(a, side * (half(a) - 0.75)),
        at(b, side * (half(b) - 0.75)),
        at(b, side * (half(b) - 0.75), 0.09),
        at(a, side * (half(a) - 0.75), 0.09),
        [0, 0, -side],
      );
      const bar = (x) => side * (half(x) - 0.25),
        stripe = side * 9.32;
      rod(out, 'metal', 'rail', at(a, bar(a), 1.09), at(b, bar(b), 1.09), 0.14, 0.15);
      if (tier >= 2)
        rod(out, 'metal', 'rail', at(a, bar(a), 0.61), at(b, bar(b), 0.61), 0.105, 0.095);
      strip(
        out,
        'metal',
        'paint',
        a,
        b,
        () => stripe - 0.063,
        () => stripe + 0.063,
        0.016,
      );
    }
    if (tier > 0) {
      rod(out, 'concrete', 'edge', at(a, 0, 0.32), at(b, 0, 0.32), 0.67, 0.63);
      for (const s of [-1, 1])
        strip(
          out,
          'metal',
          'paint',
          a,
          b,
          () => s * 1.69 - 0.059,
          () => s * 1.69 + 0.059,
          0.017,
        );
    }
  }
  for (const [i, x] of layout.ends.entries()) {
    const w = half(x),
      d = 4.82,
      sign = i === 0 ? -1 : 1;
    face(out, 'concrete', 'fascia', at(x, -w), at(x, w), at(x, w, -0.52), at(x, -w, -0.52), [
      sign,
      0,
      0,
    ]);
    face(
      out,
      'concrete',
      'box',
      at(x, -w, -0.52),
      at(x, w, -0.52),
      at(x, d, -3.22),
      at(x, -d, -3.22),
      [sign, 0, 0],
    );
    if (tier >= 2)
      strip(
        out,
        'metal',
        'seam',
        i === 0 ? x : x - 0.29,
        i === 0 ? x + 0.29 : x,
        () => -w,
        () => w,
        0.019,
      );
  }
  if (tier < 2) return;
  const [start, end] = layout.ends,
    spacing = tier === 2 ? 11 : tier === 3 ? 5.6 : 3.6;
  for (let x = start + spacing * 0.65; x < end; x += spacing)
    for (const side of [-1, 1]) {
      const z = side * (half(x) - 0.25);
      rod(out, 'metal', 'rail', at(x, z, 0.08), at(x, z, 1.09), 0.095, 0.105);
      if (tier >= 3) rod(out, 'metal', 'anchor', at(x, z, 0.11), at(x, z, 0.18), 0.245, 0.34);
    }
  for (let x = start + 5; x < end - 5; x += 13.5)
    for (const s of [-1, 1]) {
      const z = s * 5.54;
      strip(
        out,
        'metal',
        'paint',
        x,
        x + 4.4,
        () => z - 0.073,
        () => z + 0.073,
        0.019,
      );
    }
}
function supports(out, tier) {
  const chamfer = tier === 0 ? 0 : 0.35;
  for (const { x, ground } of layout.piers) {
    const cap = deckY(x) - 3.22,
      base = Math.min(ground - 0.9, cap - 2.75);
    box(
      out,
      'concrete',
      'pier',
      x,
      [
        [base, 6.25, 5.95],
        [cap - 1.42, 5.86, 5.45],
        [cap, 7.35, 9.6],
      ],
      chamfer,
    );
    if (tier >= 2)
      box(
        out,
        'concrete',
        'plinth',
        x,
        [
          [base - 0.08, 7.7, 7.8],
          [base + 0.61, 7.7, 7.8],
        ],
        chamfer,
      );
  }
  for (const x of layout.towers) {
    const deck = deckY(x),
      top = layout.towerTop,
      z = centerZ(x);
    box(
      out,
      'concrete',
      'plinth',
      x,
      [
        [-5.2, 9.5, 9.5],
        [-2.3, 9.5, 9.5],
        [-1.6, 7.12, 6.7],
      ],
      chamfer,
    );
    box(
      out,
      'concrete',
      'pier',
      x,
      [
        [-1.62, 7.12, 6.7],
        [deck - 3.28, 5.62, 5.8],
        [deck, 5.72, 2.42],
      ],
      chamfer,
    );
    box(
      out,
      'concrete',
      'tower',
      x,
      [
        [deck - 0.04, 5.27, 2.42],
        [deck + 14, 4.97, 2.33],
        [top - 2.4, 3.72, 2.06],
        [top, 3.6, 2.01],
      ],
      chamfer,
    );
    if (tier >= 3) {
      for (const side of [-1, 1])
        for (const rib of [-1, 1])
          rod(
            out,
            'concrete',
            'fascia',
            [x + rib * 1.77, deck + 0.24, z + 1.201 * side],
            [x + rib * 1.54, top - 3, z + 1.033 * side],
            0.095,
            0.078,
          );
      tubePath(
        out,
        'metal',
        [
          [x + 0.64, top - 0.05, z],
          [x + 0.64, top + 1.02, z],
        ],
        0.05,
        palette.rail,
        5,
      );
    }
  }
  if (tier > 0)
    for (const [i, x] of layout.ends.entries()) {
      const pos = x + (i === 0 ? 2.1 : -2.1),
        y = deckY(pos);
      box(
        out,
        'concrete',
        'pier',
        pos,
        [
          [y - 6.2, 4.2, 2 * half(x)],
          [y - 0.52, 4.2, 2 * half(x)],
        ],
        0,
      );
    }
}
function cables(out, tier) {
  const count = layout.cablesPerSide;
  const selected =
    tier === 0
      ? [0, 3, 7, 11, 15, 19, 24]
      : tier === 1
        ? [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24]
        : Array.from({ length: count }, (_, i) => i);
  for (const [i, x] of layout.towers.entries())
    for (const side of [-1, 1]) {
      const inner = (i === 0 ? 1 : -1) === side,
        maxRun = inner ? 195 : i === 0 ? 174 : 176;
      for (const k of selected) {
        const t = k / (count - 1),
          landing = x + side * mix(22.9, maxRun, t);
        const start = [
            x + side * mix(2.44, 1.73, t),
            mix(deckY(x) + 37.2, layout.towerTop - 3.1, t),
            centerZ(x),
          ],
          end = at(landing, 0, 0.63);
        const radius =
          tier === 0 ? 0.2 : tier === 1 ? 0.143 : tier === 2 ? 0.096 : 0.081 + 0.025 * t;
        tubePath(out, 'stays', [start, end], radius, palette.cable, tier >= 3 ? 6 : 3);
        if (tier >= 3) {
          const collar = end.map((v, j) => mix(v, start[j], 0.009));
          tubePath(out, 'metal', [end, collar], 0.21, palette.anchor, 5);
          rod(out, 'concrete', 'edge', at(landing, 0, 0.24), at(landing, 0, 0.64), 0.62, 0.67);
        }
      }
    }
}
export function buildBridgeLevel(out, level) {
  const tier = tiers[level];
  if (tier === undefined) throw Error(`Unknown Iroise Bridge level ${level}`);
  deck(out, tier);
  supports(out, tier);
  cables(out, tier);
}
export const buildBridgeSkyline = (out) => buildBridgeLevel(out, 'skyline');
export const buildBridgeDistrict = (out) => buildBridgeLevel(out, 'district');
export const buildBridgeStreet = (out) => buildBridgeLevel(out, 'street');
export const buildBridgeCloseup = (out) => buildBridgeLevel(out, 'closeup');
