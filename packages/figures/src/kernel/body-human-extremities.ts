/** Shaped palms, fingers and footwear on the existing hand/foot joints. */
import { dmath, type Quat, quatRotateVec3, type Vec3 } from '@bendyline/molen-kernel/determinism';
import { tint } from './body-human-head';
import type { RGB } from './color';
import type { FigureTier, RingRef, Skin, SkinnedMeshBuilder } from './skinned-mesh-builder';

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

export function buildHumanShoe(
  b: SkinnedMeshBuilder,
  ankle: Vec3,
  length: number,
  height: number,
  s: Skin,
  color: RGB,
  tier: FigureTier,
): void {
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
