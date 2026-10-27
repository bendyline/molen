/** Original two-tier Ferreres arcade. All 36 openings remain real voids at every LOD. */
import { readFileSync } from 'node:fs';
import {
  loft,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';

export const ferreresControls = JSON.parse(
  readFileSync(new URL('./ferreres-controls.json', import.meta.url)),
);
const C = ferreresControls;
export const ferreresSurfaces = {
  far: { slot: 'foundation', localRef: 'palette:#ffffff', roughness: 1, metallic: 0 },
  stone: { slot: 'wall', graph: 'stone_sandstone_raw', roughness: 1, metallic: 0 },
  arch: { slot: 'wall', graph: 'stone_sandstone', roughness: 1, metallic: 0 },
  channel: { slot: 'foundation', graph: 'stone_limestone_raw', roughness: 1, metallic: 0 },
};
const linear = (hex) =>
  hex.match(/../g).map((h) => {
    const v = Number.parseInt(h, 16) / 255;
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
const stone = linear('b7a184'),
  archColor = linear('c1a989'),
  capColor = linear('c5b599'),
  floorColor = linear('b5ab98');
const configs = {
  skyline: { segments: 2, ring: 0, course: 0, caps: false },
  district: { segments: 6, ring: 0, course: 0, caps: true },
  street: { segments: 12, ring: 12, course: 0, caps: true },
  closeup: { segments: 24, ring: 24, course: 0.85, caps: true },
  master: { segments: 40, ring: 32, course: 0.62, caps: true },
};
function interpolate(points, x) {
  for (let i = 1; i < points.length; i++) {
    const [a, y] = points[i - 1],
      [b, z] = points[i];
    if (x <= b) return y + (z - y) * Math.max(0, (x - a) / (b - a));
  }
  return points.at(-1)[1];
}
export const ferreresCenterZ = (x) => interpolate(C.spine, x);
export const ferreresChannelY = () => C.channelFloor;
function point(x, y, z) {
  return [x, y, z + ferreresCenterZ(x)];
}
function face(o, slot, pts, color, normal) {
  const p =
    normal && normalFor(...pts).reduce((s, v, i) => s + v * normal[i], 0) < 0
      ? [...pts].reverse()
      : pts;
  o.addConvexPolygon(
    slot,
    'palette:#ffffff',
    p,
    normal ?? normalFor(...p),
    (p) => [p[0], p[1]],
    color,
  );
}
function prism(o, slot, lo, hi, color, { bottom = true, top = true } = {}) {
  const knots = C.spine.map((p) => p[0]).filter((x) => x > lo[0] + 1e-6 && x < hi[0] - 1e-6);
  if (knots.length) {
    const xs = [lo[0], ...knots, hi[0]];
    for (let i = 1; i < xs.length; i++)
      prism(o, slot, [xs[i - 1], lo[1], lo[2]], [xs[i], hi[1], hi[2]], color, { bottom, top });
    return;
  }
  const [a, b, c] = lo,
    [d, e, f] = hi,
    p = [
      [a, b, c],
      [a, b, f],
      [d, b, f],
      [d, b, c],
      [a, e, c],
      [a, e, f],
      [d, e, f],
      [d, e, c],
    ].map((p) => point(...p));
  for (const [ids, n] of [
    [
      [0, 4, 7, 3],
      [0, 0, -1],
    ],
    [
      [1, 2, 6, 5],
      [0, 0, 1],
    ],
    [
      [0, 1, 5, 4],
      [-1, 0, 0],
    ],
    [
      [3, 7, 6, 2],
      [1, 0, 0],
    ],
    ...(bottom
      ? [
          [
            [0, 3, 2, 1],
            [0, -1, 0],
          ],
        ]
      : []),
    ...(top
      ? [
          [
            [4, 5, 6, 7],
            [0, 1, 0],
          ],
        ]
      : []),
  ])
    face(
      o,
      slot,
      ids.map((i) => p[i]),
      color,
      n,
    );
}
function ring(x, y, w, d) {
  return [
    [x - w / 2, y, -d / 2],
    [x - w / 2, y, d / 2],
    [x + w / 2, y, d / 2],
    [x + w / 2, y, -d / 2],
  ].map((p) => point(...p));
}
function pier(o, slot, x, base, spring, width, depth, cfg, lower, topY) {
  const taper = lower ? 0.28 : 0.2;
  if (cfg === configs.skyline)
    prism(o, slot, [x - width / 2, base, -depth / 2], [x + width / 2, topY, depth / 2], stone, {
      top: false,
      bottom: false,
    });
  else
    loft(
      o,
      slot,
      [ring(x, base, width + taper, depth + taper), ring(x, spring, width, depth)],
      stone,
    );
  if (cfg.caps) {
    prism(
      o,
      slot,
      [x - width / 2 - 0.18, spring - 0.22, -depth / 2 - 0.18],
      [x + width / 2 + 0.18, spring + 0.16, depth / 2 + 0.18],
      capColor,
    );
    prism(
      o,
      slot,
      [x - width / 2 - 0.22, base, -depth / 2 - 0.22],
      [x + width / 2 + 0.22, base + 0.35, depth / 2 + 0.22],
      stone,
    );
  }
  if (cfg.course) {
    const rows = Math.max(1, Math.floor((spring - base - 0.5) / cfg.course)),
      height = (spring - base - 0.5) / rows;
    for (let j = 0; j < rows; j++)
      for (const side of [-1, 1])
        for (let k = 0; k < 2; k++) {
          const y = base + 0.38 + j * height,
            t = (y - base) / (spring - base),
            w = width + taper * (1 - t),
            d = depth + taper * (1 - t),
            a = x - w / 2 + (k * w) / 2 + 0.025,
            b = x - w / 2 + ((k + 1) * w) / 2 - 0.025;
          const v = (((j * 7 + k * 11 + Math.round(x * 10)) % 9) + 9) % 9,
            shade = stone.map((c) => c * (0.89 + 0.022 * v));
          prism(
            o,
            slot,
            [a, y, side > 0 ? d / 2 : d / -2 - 0.028],
            [b, y + height - 0.045, side > 0 ? d / 2 + 0.028 : d / -2],
            shade,
            { bottom: false, top: false },
          );
        }
  }
}
function arcade(o, slot, tier, cfg) {
  const count = tier.count,
    pitch = C.pitch,
    r = C.opening / 2,
    width = tier.depth;
  for (let i = 0; i <= count; i++) {
    const x = (i - count / 2) * pitch,
      base = tier.lower
        ? interpolate(C.lowerGround, x)
        : Math.abs(x) <= (C.lowerCount * C.pitch) / 2 + 0.01
          ? C.lowerTop
          : interpolate(C.hillGround, x);
    pier(
      o,
      slot,
      x,
      Math.min(tier.spring - 0.5, base),
      tier.spring,
      pitch - C.opening,
      width,
      cfg,
      tier.lower,
      tier.top,
    );
    if (cfg !== configs.skyline)
      prism(
        o,
        slot,
        [x - (pitch - C.opening) / 2, tier.spring, -width / 2],
        [x + (pitch - C.opening) / 2, tier.top, width / 2],
        stone,
      );
  }
  for (let i = 0; i < count; i++) {
    const cx = (i - (count - 1) / 2) * pitch;
    for (let j = 0; j < cfg.segments; j++) {
      const t0 = Math.PI - (j * Math.PI) / cfg.segments,
        t1 = Math.PI - ((j + 1) * Math.PI) / cfg.segments,
        a = [cx + r * Math.cos(t0), tier.spring + r * Math.sin(t0)],
        b = [cx + r * Math.cos(t1), tier.spring + r * Math.sin(t1)];
      for (const side of [-1, 1])
        face(
          o,
          slot,
          [
            point(a[0], a[1], (side * width) / 2),
            point(b[0], b[1], (side * width) / 2),
            point(b[0], tier.top, (side * width) / 2),
            point(a[0], tier.top, (side * width) / 2),
          ],
          stone,
          [0, 0, side],
        );
      const pts = [
        point(a[0], a[1], -width / 2),
        point(b[0], b[1], -width / 2),
        point(b[0], b[1], width / 2),
        point(a[0], a[1], width / 2),
      ];
      face(o, slot, pts, archColor, [-Math.cos((t0 + t1) / 2), -Math.sin((t0 + t1) / 2), 0]);
    }
    if (cfg.ring)
      for (const side of [-1, 1])
        for (let j = 0; j < cfg.ring; j++) {
          const gap = 0.012,
            t0 = Math.PI - (j * Math.PI) / cfg.ring - gap,
            t1 = Math.PI - ((j + 1) * Math.PI) / cfg.ring + gap,
            R = r + 0.65,
            z = side * (width / 2 + 0.014);
          const shade = archColor.map((c) => c * (0.92 + 0.035 * ((i + j * 3) % 5))),
            pts = [
              [r, t0],
              [r, t1],
              [R, t1],
              [R, t0],
            ].map(([r, t]) => point(cx + r * Math.cos(t), tier.spring + r * Math.sin(t), z));
          face(o, 'arch', pts, shade, [0, 0, side]);
        }
  }
  const end = (count * pitch) / 2;
  if (cfg === configs.skyline) {
    const xs = [-end, ...C.spine.map((p) => p[0]).filter((x) => x > -end && x < end), end];
    for (let i = 1; i < xs.length; i++)
      face(
        o,
        slot,
        [
          point(xs[i - 1], tier.top, -width / 2),
          point(xs[i - 1], tier.top, width / 2),
          point(xs[i], tier.top, width / 2),
          point(xs[i], tier.top, -width / 2),
        ],
        capColor,
        [0, 1, 0],
      );
  } else prism(o, slot, [-end, tier.top - 0.16, -width / 2], [end, tier.top, width / 2], capColor);
  if (cfg.caps)
    for (const side of [-1, 1])
      prism(
        o,
        slot,
        [-end - 0.12, tier.top - 0.35, side < 0 ? -width / 2 - 0.16 : width / 2],
        [end + 0.12, tier.top - 0.1, side < 0 ? -width / 2 : width / 2 + 0.16],
        capColor,
      );
}
export function buildFerreresLevel(o, level = 'master') {
  const cfg = configs[level];
  if (!cfg) throw new Error(`Unknown Ferreres level ${level}`);
  const slot = level === 'skyline' ? 'far' : 'stone';
  arcade(
    o,
    slot,
    { count: C.lowerCount, lower: true, depth: 3.35, spring: C.lowerSpring, top: C.lowerTop },
    cfg,
  );
  arcade(
    o,
    slot,
    {
      count: C.upperCount,
      lower: false,
      depth: 2.45,
      spring: C.upperSpring,
      top: C.channelFloor - 0.24,
    },
    cfg,
  );
  const start = (-C.upperCount * C.pitch) / 2,
    end = -start;
  for (const sign of [-1, 1]) {
    const a = sign < 0 ? C.ends[0][0] : end,
      b = sign < 0 ? start : C.ends[1][0],
      mid = (a + b) / 2;
    const base = interpolate(C.hillGround, mid);
    prism(o, slot, [a, base, -1.225], [b, C.channelFloor - 0.24, 1.225], stone);
  }
  const floorSlot = level === 'skyline' ? 'far' : 'channel';
  // The shared channel is continuous through every mapped bend, with a true open trough.
  const knots = [C.ends[0][0], ...C.spine.slice(1, -1).map((p) => p[0]), C.ends[1][0]].sort(
    (a, b) => a - b,
  );
  for (let i = 1; i < knots.length; i++) {
    const a = knots[i - 1],
      b = knots[i];
    prism(o, floorSlot, [a, C.channelFloor - 0.24, -1.225], [b, C.channelFloor, 1.225], floorColor);
    for (const side of [-1, 1]) {
      const z0 = side < 0 ? -1.225 : 0.5,
        z1 = side < 0 ? -0.5 : 1.225;
      prism(o, slot, [a, C.channelFloor, z0], [b, C.height, z1], stone);
      if (cfg.caps)
        prism(o, slot, [a, C.height - 0.13, z0 - 0.035], [b, C.height, z1 + 0.035], capColor);
    }
  }
}
export const buildFerreresSkyline = (o) => buildFerreresLevel(o, 'skyline');
export const buildFerreresDistrict = (o) => buildFerreresLevel(o, 'district');
export const buildFerreresStreet = (o) => buildFerreresLevel(o, 'street');
export const buildFerreresCloseup = (o) => buildFerreresLevel(o, 'closeup');
