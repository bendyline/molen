/** Anatomical head surfaces, with features following the same surface at every detail tier. */
import { dmath, type Vec3 } from '@bendyline/molen-kernel/determinism';
import { parseColor, type RGB } from './color';
import type { FigureMetrics } from './proportions';
import type { FigureTier, RingRef, Skin, SkinnedMeshBuilder } from './skinned-mesh-builder';
import type { ResolvedFigureDescriptor } from './types';

const UP: Vec3 = [0, 1, 0];

export function tint(color: RGB, factor: number): RGB {
  return [color[0] * factor, color[1] * factor, color[2] * factor];
}

/** Profile coordinates: height above the chin, half width, front depth, back depth. */
const PROFILE: readonly (readonly [number, number, number, number])[] = [
  [0, 0.16, 0.24, 0.18],
  [0.06, 0.28, 0.39, 0.26],
  [0.14, 0.39, 0.4, 0.34],
  [0.24, 0.44, 0.41, 0.42],
  [0.36, 0.49, 0.43, 0.49],
  [0.48, 0.5, 0.39, 0.53],
  [0.58, 0.48, 0.42, 0.55],
  [0.7, 0.47, 0.43, 0.55],
  [0.82, 0.42, 0.39, 0.49],
  [0.92, 0.31, 0.28, 0.35],
  [0.98, 0.15, 0.13, 0.16],
  [1, 0.015, 0.015, 0.015],
];

function profile(t: number): [number, number, number] {
  for (let i = 1; i < PROFILE.length; i++) {
    const a = PROFILE[i - 1] as readonly [number, number, number, number];
    const c = PROFILE[i] as readonly [number, number, number, number];
    if (t <= c[0]) {
      const k = dmath.clamp((t - a[0]) / (c[0] - a[0]), 0, 1);
      return [dmath.lerp(a[1], c[1], k), dmath.lerp(a[2], c[2], k), dmath.lerp(a[3], c[3], k)];
    }
  }
  return [0.015, 0.015, 0.015];
}

function bump(x: number, y: number): number {
  return dmath.exp(-x * x - y * y);
}

export function buildHumanHead(
  d: ResolvedFigureDescriptor,
  m: FigureMetrics,
  head: Vec3,
  tier: FigureTier,
  b: SkinnedMeshBuilder,
  s: Skin,
): void {
  const near = tier === 0;
  const sides = near ? 40 : tier === 1 ? 20 : 8;
  const rows = near ? 30 : tier === 1 ? 16 : 8;
  const W = m.headWidth * 0.86;
  const L = m.headLen * 0.9;
  const baseY = head[1] + m.headLen - L;
  const skinColor = parseColor(d.palette.skin);
  const hairColor = parseColor(d.palette.hair);
  const lipColor: RGB = [skinColor[0] * 0.89, skinColor[1] * 0.64, skinColor[2] * 0.67];
  const eyeColor = parseColor(d.palette.eyes);
  // The facial relief is actual geometry. Nose, brow ridge, cheeks and chin catch scene light.
  const relief = (x: number, t: number): number =>
    0.105 * bump(x / 0.085, (t - 0.49) / 0.18) +
    0.135 * bump(x / 0.075, (t - 0.365) / 0.055) +
    0.045 * bump((dmath.abs(x) - 0.24) / 0.14, (t - 0.35) / 0.09) +
    0.045 * bump((dmath.abs(x) - 0.19) / 0.13, (t - 0.57) / 0.045) -
    0.045 * bump((dmath.abs(x) - 0.2) / 0.1, (t - 0.49) / 0.055) +
    0.035 * bump(x / 0.19, (t - 0.21) / 0.06);
  const frontZ = (x: number, t: number): number => {
    const [rx, front] = profile(t);
    const f = dmath.sqrt(dmath.max(0, 1 - (x / rx) * (x / rx)));
    return W * (front * dmath.pow(f, 0.55) + relief(x, t) * f);
  };
  const surface: Vec3[][] = [];
  // Features sit on the actual triangulated face, including coarse LODs. Sampling the
  // analytic surface alone lets a coarse nose triangle cover the eyes and mouth.
  const sampledFrontZ = (x: number, t: number): number => {
    x = dmath.abs(x);
    const row = dmath.clamp(dmath.floor(t * rows), 0, rows - 1);
    const low = surface[row] as Vec3[];
    const high = surface[row + 1] as Vec3[];
    for (let i = 0; i < sides; i++) {
      if (i >= sides / 4 && i < (3 * sides) / 4) continue;
      const j = (i + 1) % sides;
      for (const [a, c, e] of [
        [low[i], low[j], high[j]],
        [low[i], high[j], high[i]],
      ] as [Vec3, Vec3, Vec3][]) {
        const det = (c[1] - e[1]) * (a[0] - e[0]) + (e[0] - c[0]) * (a[1] - e[1]);
        if (dmath.abs(det) < 1e-12) continue;
        const u = ((c[1] - e[1]) * (x - e[0]) + (e[0] - c[0]) * (t - e[1])) / det;
        const v = ((e[1] - a[1]) * (x - e[0]) + (a[0] - e[0]) * (t - e[1])) / det;
        if (u >= -1e-6 && v >= -1e-6 && u + v <= 1 + 1e-6)
          return W * (u * a[2] + v * c[2] + (1 - u - v) * e[2]);
      }
    }
    return frontZ(x, t);
  };
  const point = (x: number, t: number, depth = 0): Vec3 => [
    x * W,
    baseY + t * L,
    sampledFrontZ(x, t) + depth * W,
  ];
  let previous: RingRef | undefined;
  for (let r = 0; r <= rows; r++) {
    const t = r / rows;
    const [rx, , back] = profile(t);
    const start = b.mark();
    const points: Vec3[] = [];
    for (let i = 0; i < sides; i++) {
      // Fold around the centerline so mirrored coordinates quantize identically.
      const a = (dmath.TAU * (i <= sides / 2 ? i : sides - i)) / sides;
      const x = dmath.sin(a) * rx * (i <= sides / 2 ? 1 : -1);
      const c = dmath.cos(a);
      const z = c >= 0 ? frontZ(x, t) : c * back * W;
      // Subtle anatomical pigmentation, independent of lighting or viewing direction.
      const flush =
        dmath.max(0, c) *
        (0.07 * bump((dmath.abs(x) - 0.29) / 0.14, (t - 0.36) / 0.1) +
          0.05 * bump(x / 0.09, (t - 0.37) / 0.06));
      const color: RGB = [
        skinColor[0] * (1 + flush * 0.35),
        skinColor[1] * (1 - flush),
        skinColor[2] * (1 - flush * 0.6),
      ];
      b.vertex([x * W, baseY + t * L, z], color, s);
      points.push([x, t, z / W]);
    }
    surface.push(points);
    const ring = { start, sides, center: [0, baseY + t * L, 0] as Vec3 };
    if (previous) {
      // Mirrored diagonals preserve the same piecewise-planar face on both sides.
      for (let i = 0; i < sides; i++) {
        const j = (i + 1) % sides;
        if (i < sides / 2)
          b.quad('skin', previous.start + i, previous.start + j, ring.start + j, ring.start + i);
        else b.quad('skin', previous.start + j, ring.start + j, ring.start + i, previous.start + i);
      }
    } else b.cap('skin', ring, s, skinColor, undefined, false);
    previous = ring;
    if (r === rows) b.cap('skin', ring, s, skinColor);
  }

  // Surface-following ribbons avoid floating brows and mouth decals at oblique angles.
  const ribbon = (
    region: 'skin' | 'brow',
    pts: readonly [number, number][],
    width: number,
    color: RGB,
  ): void => {
    let prev = -1;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i] as [number, number];
      const next = pts[i + 1] as [number, number];
      const steps = near ? 4 : 2;
      for (let j = i === 0 ? 0 : 1; j <= steps; j++) {
        const x = dmath.lerp(a[0], next[0], j / steps);
        const t = dmath.lerp(a[1], next[1], j / steps);
        const lo = b.vertex(point(x, t - width, 0.009), color, s);
        const hi = b.vertex(point(x, t + width, 0.009), color, s);
        if (prev >= 0) b.quad(region, prev, lo, hi, prev + 1);
        prev = lo;
      }
    }
  };
  if (tier < 2) {
    ribbon(
      'skin',
      [
        [-0.16, 0.205],
        [-0.08, 0.215],
        [0, 0.209],
        [0.08, 0.215],
        [0.16, 0.205],
      ],
      0.011,
      lipColor,
    );
    ribbon(
      'skin',
      [
        [-0.15, 0.201],
        [0, 0.195],
        [0.15, 0.201],
      ],
      0.004,
      tint(lipColor, 0.64),
    );
  }

  const mark = b.mark();
  // Almond eyes, with a raised skin rim. Whites are deliberately subdued at gameplay scale.
  const eyeX = 0.205;
  const eyeT = 0.495;
  const eyeSides = near ? 16 : 8;
  const eyeCenter = b.vertex(point(eyeX, eyeT, 0.017), parseColor('#b8b2a5'), s);
  const inner: number[] = [];
  const outer: number[] = [];
  for (let i = 0; i < eyeSides; i++) {
    const a = (i * dmath.TAU) / eyeSides;
    const x = dmath.cos(a);
    const y = dmath.sin(a) * (dmath.sin(a) > 0 ? 1 : 0.7);
    inner.push(b.vertex(point(eyeX + x * 0.098, eyeT + y * 0.02, 0.013), parseColor('#b8b2a5'), s));
    outer.push(
      b.vertex(
        point(eyeX + x * 0.118, eyeT + y * 0.031, 0.016),
        tint(skinColor, y > 0 ? 0.76 : 0.96),
        s,
      ),
    );
  }
  for (let i = 0; i < eyeSides; i++) {
    const j = (i + 1) % eyeSides;
    b.triangle('eyes', eyeCenter, inner[i] as number, inner[j] as number);
    b.quad('skin', inner[i] as number, outer[i] as number, outer[j] as number, inner[j] as number);
  }
  const iris = (radius: number, depth: number, color: RGB): void => {
    const center = b.vertex(point(eyeX, eyeT, depth), color, s);
    const count = near ? 12 : 8;
    const rim: number[] = [];
    for (let i = 0; i < count; i++) {
      const a = (dmath.TAU * i) / count;
      rim.push(
        b.vertex(
          point(eyeX + radius * dmath.cos(a), eyeT + ((radius * W) / L) * dmath.sin(a), depth),
          color,
          s,
        ),
      );
    }
    for (let i = 0; i < count; i++)
      b.triangle('eyes', center, rim[i] as number, rim[(i + 1) % count] as number);
  };
  iris(0.037, 0.025, eyeColor);
  if (near) iris(0.016, 0.027, parseColor('#111214'));
  ribbon(
    'brow',
    [
      [0.095, 0.565],
      [0.18, 0.581],
      [0.26, 0.579],
      [0.32, 0.557],
    ],
    0.01,
    hairColor,
  );
  if (near) {
    b.ellipsoid(
      'skin',
      point(0.057, 0.341, 0.002),
      UP,
      [W * 0.032, W * 0.012, L * 0.009],
      8,
      4,
      s,
      tint(skinColor, 0.45),
    );
  }
  if (d.features.ears !== 'none' && tier < 2) {
    const ear = m.earLen * 0.95;
    const center: Vec3 = [W * 0.493, baseY + L * 0.43, -W * 0.01];
    b.ellipsoid(
      'skin',
      center,
      UP,
      [ear * 0.48, ear * 0.32, ear],
      near ? 12 : 6,
      near ? 8 : 4,
      s,
      skinColor,
    );
    if (near)
      b.ellipsoid(
        'skin',
        [center[0] + ear * 0.12, center[1], center[2] + ear * 0.27],
        UP,
        [ear * 0.23, ear * 0.09, ear * 0.62],
        8,
        6,
        s,
        tint(skinColor, 0.65),
      );
  }
  b.mirrorX(mark, (joint) => joint);

  if (d.features.hair === 'none') return;
  const hairRows = near ? 9 : tier === 1 ? 5 : 3;
  let last: RingRef | undefined;
  for (let r = 0; r <= hairRows; r++) {
    const start = b.mark();
    for (let i = 0; i < sides; i++) {
      const a = (dmath.TAU * (i <= sides / 2 ? i : sides - i)) / sides;
      const c = dmath.cos(a);
      const side = dmath.abs(dmath.sin(a));
      // Receding temples and a nape, instead of a horizontal helmet edge across the face.
      const hairline = c > 0 ? 0.73 - 0.35 * dmath.pow(side, 8) : 0.35;
      const long = d.features.hair !== 'cap' && c < 0.15;
      const t0 = long ? (d.features.hair === 'long' ? -0.48 : 0.08) : hairline;
      const t = dmath.lerp(t0, 0.997, 1 - (1 - r / hairRows) * (1 - r / hairRows));
      const [rx, , back] = profile(dmath.max(0.38, t));
      const x = dmath.sin(a) * (rx + 0.025) * (i <= sides / 2 ? 1 : -1);
      const z =
        c >= 0
          ? frontZ(dmath.sin(a) * rx, dmath.max(0.38, t)) + c * 0.035 * W
          : c * (back + 0.035) * W;
      // Locks are small silhouette changes, not painted lighting.
      const lock = near ? 1 + 0.012 * dmath.cos(a * 12) * (1 - r / hairRows) : 1;
      const strand = 1 + 0.12 * dmath.sin(a * 17 + t * 4) * dmath.sin(a * 7 - t * 3);
      b.vertex([x * W * lock, baseY + t * L + 0.009 * L, z * lock], tint(hairColor, strand), s);
    }
    const ring = { start, sides, center: [0, baseY + L, 0] as Vec3 };
    if (last) b.loft('hair', last, ring);
    last = ring;
    if (r === hairRows) b.cap('hair', ring, s, hairColor, [0, head[1] + m.headLen + 0.015 * L, 0]);
  }
  // Long hair remains on the head joint; it must not drag or stretch when the head turns.
}
