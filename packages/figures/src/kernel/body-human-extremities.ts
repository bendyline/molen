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
   * Trousers fall over a boot's shaft (regular and wide trousers): the boot stops at the ankle,
   * inside them, so their hem crosses it on one clean line.
   */
  covered?: boolean;
}

/** One lofted footwear section: height, half-width and half-length (of the foot length), z offset. */
type FootSection = readonly [y: number, w: number, depth: number, z: number];

/** A footwear ring: its section, color and region (and skin, when not the foot's). */
interface FootRing {
  at: FootSection;
  color: RGB;
  region: FigureRegion;
  s?: Skin;
}

/** How far a boot's shaft rises above the ankle joint, of stature. */
export const BOOT_SHAFT: number = 0.065;

const PALE: RGB = [0.93, 0.92, 0.89];
const mixRgb = (a: RGB, b: RGB, t: number): RGB => [
  dmath.lerp(a[0], b[0], t),
  dmath.lerp(a[1], b[1], t),
  dmath.lerp(a[2], b[2], t),
];

/**
 * Footwear on the foot joint: section stacks lofted from the ground up, the same count for every
 * style below near detail. A shoe is 1.1 foot lengths long with the ankle 0.27 of the way from
 * the heel, and each section is narrower at the heel than across the ball of the foot. Near, sole
 * edges are doubled rings, so a sole color ends on a line instead of fading up the upper. A
 * boot's shaft top follows the shin; a sandal is a sole under the bare foot with arched straps
 * over it (near) or a band of its color (further away). Without a style it is the reference
 * shoe, a low leather shoe.
 */
export function buildHumanShoe(
  b: SkinnedMeshBuilder,
  ankle: Vec3,
  length: number,
  H: number,
  s: Skin,
  color: RGB,
  tier: FigureTier,
  style?: HumanShoeStyle,
): void {
  const sides = tier === 0 ? 16 : 8;
  const near = tier === 0;
  const kind = style?.style ?? 'shoe';
  const a = ankle[1];
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
  let opening = tint(color, 0.5);
  if (kind === 'sneaker') {
    // A thick pale sole with a crisp edge (near) under a slightly fuller upper.
    const sole = mixRgb(color, PALE, 0.85);
    all = [
      ring([0, 0.228, 0.565, 0.25], sole),
      ring([0.019 * H, 0.24, 0.572, 0.25], sole),
      ring([0.0195 * H, 0.228, 0.55, 0.25], color, { nearOnly: true }),
      ring([0.03 * H, 0.224, 0.535, 0.245], color),
      ring([0.041 * H, 0.196, 0.42, 0.16], color),
      ring([a + 0.008 * H, 0.165, 0.25, 0.025], color),
    ];
  } else if (kind === 'boot') {
    // A heel-and-sole block and a shaft up the shin, wide enough to clear the leg.
    const sole = tint(color, 0.45);
    const leg = style?.legRadius ?? 0;
    const shaftW = dmath.max(0.175, (leg * 1.14) / length);
    const shaftD = dmath.max(0.24, (leg * 1.2) / length);
    const covered = style?.covered === true;
    const shin = style?.shaft ?? s;
    all = [
      ring([0, 0.225, 0.555, 0.25], sole),
      ring([0.015 * H, 0.238, 0.565, 0.25], sole),
      ring([0.0155 * H, 0.228, 0.545, 0.25], color),
      ring([0.027 * H, 0.224, 0.53, 0.245], color, { nearOnly: true }),
      ring([0.04 * H, 0.2, 0.43, 0.15], color),
      covered
        ? ring([a + 0.012 * H, 0.15, 0.225, 0.02], color)
        : ring([a + 0.012 * H, 0.18, 0.27, 0.025], color, {
            s: blend(s[0], 0.6, shin[0], 0.4),
            nearOnly: true,
          }),
      covered ? undefined : ring([a + BOOT_SHAFT * H, shaftW, shaftD, 0.01], color, { s: shin }),
    ];
  } else if (kind === 'sandal') {
    // A sandal: a sole slab under the bare foot. Below near detail the straps are a band of
    // the sandal's color over the instep.
    const sole = tint(color, 0.72);
    const bare = style?.skin ?? color;
    const skinRing = { region: 'skin' as const };
    all = [
      ring([0, 0.22, 0.55, 0.25], sole),
      ring([0.01 * H, 0.232, 0.558, 0.25], sole),
      ring([0.0105 * H, 0.215, 0.535, 0.25], bare, skinRing),
      ring([0.019 * H, 0.208, 0.51, 0.25], bare, { ...skinRing, nearOnly: true }),
      ring([0.031 * H, 0.176, 0.395, 0.16], near ? bare : color, skinRing),
      ring([a + 0.002 * H, 0.14, 0.215, 0.02], bare, skinRing),
    ];
    opening = bare;
  } else {
    // The reference shoe: a low leather shoe with a dark sole and a sloped toe.
    const sole = tint(color, 0.52);
    all = [
      ring([0, 0.218, 0.55, 0.25], sole),
      ring([0.01 * H, 0.23, 0.556, 0.25], sole),
      ring([0.0105 * H, 0.218, 0.536, 0.25], color, { nearOnly: true }),
      ring([0.021 * H, 0.214, 0.522, 0.245], color),
      ring([0.034 * H, 0.184, 0.4, 0.15], color),
      ring([a + 0.004 * H, 0.15, 0.232, 0.02], color),
    ];
  }
  const rings = all.filter((r): r is FootRing => r !== undefined);
  let last: RingRef | undefined;
  let lastRegion: FigureRegion = 'shoes';
  for (const r of rings) {
    const [y, w, depth, z] = r.at;
    const start = b.mark();
    for (let i = 0; i < sides; i++) {
      // Folded about the foot's centre line, so both edges of a shoe match exactly.
      const angle = (dmath.TAU * (i <= sides / 2 ? i : sides - i)) / sides;
      const along = -dmath.cos(angle);
      const across = dmath.sin(angle) * (i <= sides / 2 ? -1 : 1);
      // Broader across the ball of the foot than at the heel.
      b.vertex(
        [
          ankle[0] + across * w * length * (1 + 0.14 * along),
          y,
          ankle[2] + (z + along * depth) * length,
        ],
        r.color,
        r.s ?? s,
      );
    }
    const next: RingRef = { start, sides, center: [ankle[0], y, ankle[2] + z * length] };
    if (last) b.loft(r.region, last, next);
    else b.cap(r.region, next, s, r.color, undefined, false);
    last = next;
    lastRegion = r.region;
  }
  const top = rings[rings.length - 1] as FootRing;
  if (last) b.cap(lastRegion, last, top.s ?? s, opening);
  if ((kind === 'shoe' || kind === 'sneaker') && near) {
    const laces = kind === 'sneaker' ? mixRgb(color, PALE, 0.7) : tint(color, 1.5);
    const lift = kind === 'sneaker' ? 0.007 : 0;
    for (let i = 0; i < 3; i++) {
      const z = ankle[2] + (0.3 + 0.075 * i) * length;
      const y = a + (lift - 0.0005 - 0.0033 * i) * H;
      b.box(
        'shoes',
        [ankle[0] - 0.11 * length, y, z],
        [ankle[0] + 0.11 * length, y + 0.0015 * H, z + 0.012 * length],
        s,
        laces,
      );
    }
  }
  if (kind === 'sandal' && near) {
    // Straps are thin domes standing on the sole, arched over the foot where they cross it.
    const foot = rings.filter((r) => r.region === 'skin').map((r) => r.at);
    const soleTop = 0.01 * H;
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
        if (k * k < 1) half = dmath.max(half, w * (1 + 0.14 * k) * dmath.sqrt(1 - k * k));
      }
      return half * length;
    };
    // A dome narrows toward its top while the foot stays broad, so it stands well clear.
    for (const z of [0.16, 0.5]) {
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
