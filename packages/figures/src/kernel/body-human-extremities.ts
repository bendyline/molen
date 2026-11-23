/** Shaped palms, fingers and footwear on the existing hand/foot joints. */
import { dmath, type Quat, quatRotateVec3, type Vec3 } from '@bendyline/molen-kernel/determinism';
import { tint } from './body-human-head';
import type { RGB } from './color';
import {
  blend,
  type FigureRegion,
  type FigureTier,
  type RingRef,
  type Skin,
  type SkinnedMeshBuilder,
} from './skinned-mesh-builder';
import type { FigureFootwearStyle } from './types';

export function buildHumanHand(
  b: SkinnedMeshBuilder,
  wrist: Vec3,
  direction: Vec3,
  length: number,
  s: Skin,
  color: RGB,
  tier: FigureTier,
  fingers: boolean,
  roll?: Quat,
): void {
  const rotate = (v: Vec3): Vec3 => (roll ? quatRotateVec3(roll, v) : v);
  const point = (along: number, across: number, thick = 0): Vec3 => {
    const p = rotate([
      direction[0] * along * length - direction[1] * thick * length,
      direction[1] * along * length + direction[0] * thick * length,
      across * length,
    ]);
    return [wrist[0] + p[0], wrist[1] + p[1], wrist[2] + p[2]];
  };
  const sides = tier === 0 ? 10 : 6;
  // Stable palm frame: +thick is the back of the hand; fingers flex toward -thick.
  const ringAt = (
    along: number,
    across: number,
    thick: number,
    width: number,
    depth: number,
    bend = 0,
    count = sides,
  ): RingRef => {
    const start = b.mark();
    for (let i = 0; i < count; i++) {
      const angle = (dmath.TAU * i) / count;
      const offset = depth * dmath.cos(angle);
      b.vertex(
        point(
          along + dmath.sin(bend) * offset,
          across + width * dmath.sin(angle),
          thick + dmath.cos(bend) * offset,
        ),
        color,
        s,
      );
    }
    return { start, sides: count, center: point(along, across, thick) };
  };
  let last: RingRef | undefined;
  const palm: readonly [number, number, number][] = [
    [0, 0.18, 0.105],
    [0.22, 0.245, 0.12],
    [0.48, 0.245, 0.1],
    [0.59, 0.21, 0.075],
  ];
  for (const [t, width, depth] of palm) {
    const ring = ringAt(t, 0, 0, width, depth);
    if (last) b.loft('skin', last, ring);
    last = ring;
  }
  if (last) b.cap('skin', last, s, color);
  if (fingers && tier === 0) {
    const digits: readonly [number, number, number][] = [
      [-0.18, 0.87, 60],
      [-0.06, 1.0, 55],
      [0.06, 1.03, 48],
      [0.18, 0.93, 40],
    ];
    for (const [z, end, curl] of digits) {
      const a0 = (6 * dmath.PI) / 180;
      const arc = ((curl - 6) * dmath.PI) / 180;
      const scale = (end - 0.49) / arc;
      let digit: RingRef | undefined;
      for (const [u, radius] of [
        [0, 1],
        [0.2, 1],
        [0.48, 0.95],
        [0.72, 0.87],
        [0.9, 0.68],
        [1, 0.3],
      ] as const) {
        const a = a0 + arc * u;
        const ring = ringAt(
          0.49 + scale * (dmath.sin(a) - dmath.sin(a0)),
          z,
          -0.018 - scale * (dmath.cos(a0) - dmath.cos(a)),
          0.05 * radius,
          0.052 * radius,
          a,
          8,
        );
        if (digit) b.loft('skin', digit, ring);
        digit = ring;
      }
      if (digit) b.cap('skin', digit, s, color);
    }
  } else {
    // The merged silhouette keeps the same cupped fingers at the cheaper tiers.
    let digit: RingRef | undefined;
    for (const [t, thick, width, depth, bend] of [
      [0.52, -0.015, 0.205, 0.07, 8],
      [0.7, -0.045, 0.2, 0.065, 22],
      [0.86, -0.12, 0.175, 0.055, 40],
      [0.94, -0.2, 0.12, 0.025, 55],
    ] as const) {
      const ring = ringAt(t, 0, thick, width, depth, (bend * dmath.PI) / 180);
      if (digit) b.loft('skin', digit, ring);
      digit = ring;
    }
    if (digit) b.cap('skin', digit, s, color);
  }
  const thumbAxis = rotate([
    direction[0] * 0.88 + direction[1] * 0.22,
    direction[1] * 0.88 - direction[0] * 0.22,
    0.42,
  ]);
  b.ellipsoid(
    'skin',
    point(0.36, 0.24, -0.055),
    thumbAxis,
    [0.07 * length, 0.075 * length, 0.21 * length],
    sides,
    tier === 0 ? 6 : 4,
    s,
    color,
  );
}

/** A footwear variant over the reference shoe (see buildHumanShoe). */
export interface HumanShoeStyle {
  style: FigureFootwearStyle;
  /** Skin weights of the shin, which a boot's shaft top follows. */
  shaft: Skin;
  /** The leg's radius at a boot's shaft top (the shaft clears it). */
  legRadius: number;
  /** Skin color (a sandal's bare foot). */
  skin: RGB;
  /**
   * Trousers fall over a boot's shaft (wide trousers): the boot stops at the ankle, inside them,
   * so their hem crosses it on one clean line.
   */
  covered?: boolean;
}

/** One lofted footwear section: height, half-width and half-length (of the foot length), z offset. */
type FootSection = readonly [y: number, w: number, depth: number, z: number];

/**
 * A shoe on the foot joint. Without a style (or `shoe`) it is the reference shoe, unchanged;
 * `sneaker`, `boot` and `sandal` are other section stacks over the same foot.
 */
export function buildHumanShoe(
  b: SkinnedMeshBuilder,
  ankle: Vec3,
  length: number,
  height: number,
  s: Skin,
  color: RGB,
  tier: FigureTier,
  style?: HumanShoeStyle,
): void {
  if (style !== undefined && style.style !== 'shoe') {
    buildFootwear(b, ankle, length, height, s, color, tier, style);
    return;
  }
  const sides = tier === 0 ? 16 : 8;
  const sole = tint(color, 0.52);
  const sections: readonly [number, number, number, number][] = [
    [0, 0.225, 0.55, 0.2],
    [0.012 * height, 0.235, 0.55, 0.2],
    [0.022 * height, 0.225, 0.53, 0.2],
    [0.035 * height, 0.205, 0.43, 0.14],
    [ankle[1] + 0.025 * height, 0.17, 0.25, 0.035],
  ];
  let last: RingRef | undefined;
  for (let i = 0; i < sections.length; i++) {
    const [y, w, depth, z] = sections[i] as readonly [number, number, number, number];
    const colorAt = i < 2 ? sole : color;
    const ring = b.ring(
      'shoes',
      [ankle[0], y, ankle[2] + z * length],
      [0, 1, 0],
      w * length,
      depth * length,
      sides,
      s,
      colorAt,
    );
    if (last) b.loft('shoes', last, ring);
    else b.cap('shoes', ring, s, sole, undefined, false);
    last = ring;
  }
  if (last) b.cap('shoes', last, s, color);
  if (tier === 0) {
    for (let i = 0; i < 3; i++) {
      const z = ankle[2] + (0.16 + 0.07 * i) * length;
      const y = ankle[1] + (0.018 - 0.0045 * i) * height;
      b.box(
        'shoes',
        [ankle[0] - 0.12 * length, y, z],
        [ankle[0] + 0.12 * length, y + 0.0015 * height, z + 0.012 * length],
        s,
        tint(color, 1.5),
      );
    }
  }
}

/** A footwear ring: its section, color and region (and skin, when not the foot's). */
interface FootRing {
  at: FootSection;
  color: RGB;
  region: FigureRegion;
  s?: Skin;
}

const PALE: RGB = [0.93, 0.92, 0.89];
const mixRgb = (a: RGB, b: RGB, t: number): RGB => [
  dmath.lerp(a[0], b[0], t),
  dmath.lerp(a[1], b[1], t),
  dmath.lerp(a[2], b[2], t),
];

/**
 * Sneakers, boots and sandals: section stacks lofted like the reference shoe, no more rings than
 * it below near detail. Near, sole edges are doubled rings, so a sole color ends on a line
 * instead of fading up the upper. A boot's shaft top follows the shin; a sandal is a sole under
 * the bare foot with arched straps over it (near) or a band of its color (further away).
 */
function buildFootwear(
  b: SkinnedMeshBuilder,
  ankle: Vec3,
  length: number,
  H: number,
  s: Skin,
  color: RGB,
  tier: FigureTier,
  style: HumanShoeStyle,
): void {
  const sides = tier === 0 ? 16 : 8;
  const near = tier === 0;
  /** A ring; `nearOnly` rings (crisp edges, toe shaping) are left out below near detail. */
  const ring = (
    at: FootSection,
    c: RGB,
    options: { region?: FigureRegion; s?: Skin; nearOnly?: boolean } = {},
  ): FootRing | undefined =>
    options.nearOnly && !near
      ? undefined
      : { at, color: c, region: options.region ?? 'shoes', ...(options.s ? { s: options.s } : {}) };
  let all: (FootRing | undefined)[];
  let opening = color;
  if (style.style === 'sneaker') {
    // A thick pale sole with a crisp edge (near) under a slightly fuller upper.
    const sole = mixRgb(color, PALE, 0.85);
    all = [
      ring([0, 0.235, 0.575, 0.2], sole),
      ring([0.021 * H, 0.245, 0.58, 0.2], sole),
      ring([0.0215 * H, 0.232, 0.555, 0.2], color, { nearOnly: true }),
      ring([0.033 * H, 0.226, 0.535, 0.2], color),
      ring([0.046 * H, 0.206, 0.445, 0.14], color),
      ring([ankle[1] + 0.03 * H, 0.178, 0.27, 0.035], color),
    ];
  } else if (style.style === 'boot') {
    // A heel-and-sole block and a shaft up the shin, wide enough to clear the leg.
    const sole = tint(color, 0.45);
    const shaftW = dmath.max(0.19, (style.legRadius * 1.14) / length);
    const shaftD = dmath.max(0.25, (style.legRadius * 1.2) / length);
    all = [
      ring([0, 0.23, 0.56, 0.2], sole),
      ring([0.016 * H, 0.242, 0.57, 0.2], sole),
      ring([0.0165 * H, 0.232, 0.55, 0.2], color),
      ring([0.028 * H, 0.228, 0.53, 0.2], color, { nearOnly: true }),
      ring([0.042 * H, 0.212, 0.45, 0.13], color),
      style.covered
        ? ring([ankle[1] + 0.03 * H, 0.16, 0.24, 0.03], color)
        : ring([ankle[1] + 0.03 * H, 0.19, 0.29, 0.03], color, {
            s: blend(s[0], 0.6, style.shaft[0], 0.4),
            nearOnly: true,
          }),
      style.covered
        ? undefined
        : ring([ankle[1] + 0.09 * H, shaftW, shaftD, 0.01], color, { s: style.shaft }),
    ];
    opening = tint(color, 0.5);
  } else {
    // A sandal: a sole slab under the bare foot. Below near detail the straps are a band of
    // the sandal's color over the instep.
    const sole = tint(color, 0.72);
    const skinRing = { region: 'skin' as const };
    all = [
      ring([0, 0.225, 0.555, 0.2], sole),
      ring([0.011 * H, 0.238, 0.565, 0.2], sole),
      ring([0.0115 * H, 0.222, 0.54, 0.2], style.skin, skinRing),
      ring([0.021 * H, 0.212, 0.51, 0.2], style.skin, { ...skinRing, nearOnly: true }),
      ring([0.033 * H, 0.188, 0.41, 0.14], near ? style.skin : color, skinRing),
      ring([ankle[1] + 0.025 * H, 0.16, 0.245, 0.035], style.skin, skinRing),
    ];
    opening = style.skin;
  }
  const rings = all.filter((r): r is FootRing => r !== undefined);
  let last: RingRef | undefined;
  let lastRegion: FigureRegion = 'shoes';
  for (const r of rings) {
    const [y, w, depth, z] = r.at;
    const next = b.ring(
      r.region,
      [ankle[0], y, ankle[2] + z * length],
      [0, 1, 0],
      w * length,
      depth * length,
      sides,
      r.s ?? s,
      r.color,
    );
    if (last) b.loft(r.region, last, next);
    else b.cap(r.region, next, s, r.color, undefined, false);
    last = next;
    lastRegion = r.region;
  }
  const top = rings[rings.length - 1] as FootRing;
  if (last) b.cap(lastRegion, last, top.s ?? s, opening);
  if (style.style === 'sneaker' && tier === 0) {
    const laces = mixRgb(color, PALE, 0.7);
    for (let i = 0; i < 3; i++) {
      const z = ankle[2] + (0.17 + 0.07 * i) * length;
      const y = ankle[1] + (0.023 - 0.0045 * i) * H;
      b.box(
        'shoes',
        [ankle[0] - 0.12 * length, y, z],
        [ankle[0] + 0.12 * length, y + 0.0015 * H, z + 0.012 * length],
        s,
        laces,
      );
    }
  }
  if (style.style === 'sandal' && near) {
    // Straps are thin domes standing on the sole, arched over the foot where they cross it.
    const foot = rings.filter((r) => r.region === 'skin').map((r) => r.at);
    const soleTop = 0.011 * H;
    /** The foot's top at a forward offset (in foot lengths): along the lofted front profile. */
    const topAt = (z: number): number => {
      for (let i = foot.length - 1; i > 0; i--) {
        const [y1, , d1, z1] = foot[i] as FootSection;
        const [y0, , d0, z0] = foot[i - 1] as FootSection;
        const f1 = z1 + d1,
          f0 = z0 + d0;
        if (z <= f1) return y1;
        if (z <= f0) return dmath.lerp(y1, y0, (z - f1) / (f0 - f1));
      }
      return soleTop;
    };
    const halfAt = (z: number): number => {
      let half = 0;
      for (const [, w, d, zc] of foot) {
        const k = (z - zc) / d;
        if (k * k < 1) half = dmath.max(half, w * dmath.sqrt(1 - k * k));
      }
      return half * length;
    };
    // A dome narrows toward its top while the foot stays broad, so it stands well clear.
    for (const z of [0.1, 0.4]) {
      const rise = (topAt(z) - soleTop) * 1.3 + 0.004 * H;
      b.ellipsoid(
        'shoes',
        [ankle[0], soleTop - 0.002 * H, ankle[2] + z * length],
        [0, 1, 0],
        [halfAt(z) * 1.22 + 0.003 * H, 0.07 * length, rise],
        8,
        2,
        s,
        color,
        0,
        1,
      );
    }
  }
}
