/** Anatomical head surfaces, with features following the same surface at every detail tier. */
import { dmath, type Vec3 } from '@bendyline/molen-kernel/determinism';
import { parseColor, type RGB } from './color';
import type { FigureMetrics } from './proportions';
import {
  blend,
  type FigureTier,
  type RingRef,
  type Skin,
  type SkinnedMeshBuilder,
} from './skinned-mesh-builder';
import type { FigureHairStyle, ResolvedFigureDescriptor } from './types';

const UP: Vec3 = [0, 1, 0];

export function tint(color: RGB, factor: number): RGB {
  return [color[0] * factor, color[1] * factor, color[2] * factor];
}

const mixColor = (a: RGB, b: RGB, t: number): RGB => [
  dmath.lerp(a[0], b[0], t),
  dmath.lerp(a[1], b[1], t),
  dmath.lerp(a[2], b[2], t),
];

/**
 * Profile coordinates: height above the chin, half width, front depth, back depth (fractions
 * of the head width unit). The jaw is about 0.83 of the cheekbones across, as on adults; a
 * jaw as wide as the cheeks read as a box.
 */
const PROFILE: readonly (readonly [number, number, number, number])[] = [
  [0, 0.13, 0.24, 0.18],
  [0.06, 0.25, 0.39, 0.26],
  [0.14, 0.34, 0.4, 0.34],
  [0.24, 0.395, 0.41, 0.42],
  [0.36, 0.455, 0.43, 0.5],
  [0.48, 0.475, 0.39, 0.56],
  [0.58, 0.475, 0.42, 0.6],
  [0.7, 0.47, 0.43, 0.6],
  [0.82, 0.425, 0.39, 0.53],
  [0.92, 0.31, 0.28, 0.37],
  [0.98, 0.15, 0.13, 0.17],
  [1, 0.015, 0.015, 0.015],
];

/** Half width, front and back depth at height t; `jaw` widens (+) or narrows (−) the jaw. */
function profile(t: number, jaw = 0): [number, number, number] {
  const k = (t - 0.18) / 0.13;
  const jawScale = 1 + jaw * dmath.exp(-k * k);
  for (let i = 1; i < PROFILE.length; i++) {
    const a = PROFILE[i - 1] as readonly [number, number, number, number];
    const c = PROFILE[i] as readonly [number, number, number, number];
    if (t <= c[0]) {
      const f = dmath.clamp((t - a[0]) / (c[0] - a[0]), 0, 1);
      return [
        dmath.lerp(a[1], c[1], f) * jawScale,
        dmath.lerp(a[2], c[2], f),
        dmath.lerp(a[3], c[3], f),
      ];
    }
  }
  return [0.015, 0.015, 0.015];
}

function bump(x: number, y: number): number {
  return dmath.exp(-x * x - y * y);
}

/** The head's frame: width unit, chin-to-crown height and chin height, from the metrics. */
export function humanHeadFrame(
  m: FigureMetrics,
  head: Vec3,
): { W: number; L: number; baseY: number } {
  const L = m.headLen * 0.9;
  return { W: m.headWidth * 0.86, L, baseY: head[1] + m.headLen - L };
}

/** Styles whose shell hangs below the skull (they get a rolled lower edge). */
const HANGING: ReadonlySet<FigureHairStyle> = new Set(['bob', 'long']);

/** Lower edge of a hair shell (t above the chin) at an angle: front hairline, sides, nape. */
function hairStart(style: FigureHairStyle, c: number, side: number): number {
  // Forehead and temples in front; behind the ears the line falls to the nape, which sits
  // about level with the mouth.
  const line = (top: number, nape: number): number =>
    c > 0
      ? dmath.max(0.38, top - 0.35 * dmath.pow(side, 8))
      : dmath.lerp(0.38, nape, dmath.smoothstep(dmath.clamp(-c / 0.6, 0, 1)));
  const toward = (edge: number, width: number): number =>
    dmath.smoothstep(dmath.clamp((edge - c) / width, 0, 1));
  switch (style) {
    case 'buzz':
      return line(0.74, 0.24);
    case 'balding':
      // A horseshoe above and behind the ears, low at the nape.
      return dmath.lerp(0.47, 0.22, dmath.smoothstep(dmath.clamp(-c / 0.7, 0, 1)));
    case 'crop':
      return line(0.71, 0.23);
    case 'bob':
      // A fringe over the upper forehead, curving down past the temples to the jaw.
      return dmath.lerp(0.64 - 0.28 * dmath.pow(side, 6), 0.1, toward(0.25, 0.3));
    case 'long':
      return dmath.lerp(line(0.735, 0.24), -0.12, toward(0.32, 0.3));
    case 'ponytail':
    case 'bun':
      return line(0.745, 0.22);
    case 'afro':
      return line(0.72, 0.18);
    default:
      return line(0.73, 0.24);
  }
}

/** Distance of the hair surface above the scalp (head width units). */
function hairOffset(style: FigureHairStyle, c: number, t: number): number {
  const top = dmath.smoothstep(dmath.clamp((t - 0.7) / 0.25, 0, 1));
  switch (style) {
    // Close crops still clear the skull between the shell's coarser rows (about 2 mm).
    case 'buzz':
      return 0.02;
    case 'balding':
      return 0.022;
    case 'crop':
      return 0.022 + (0.045 + 0.03 * dmath.max(0, c)) * top;
    case 'bob':
      return 0.035 + 0.05 * dmath.clamp((0.55 - t) / 0.45, 0, 1);
    case 'long':
      // Falls a little outward below the skull, over the collar behind the neck.
      return 0.03 + 0.08 * dmath.smoothstep(dmath.clamp((0.5 - t) / 0.6, 0, 1));
    case 'ponytail':
    case 'bun':
      return 0.016;
    case 'afro':
      return 0.17 + 0.12 * dmath.smoothstep(dmath.clamp((t - 0.45) / 0.45, 0, 1));
    default:
      return 0.025;
  }
}

export function buildHumanHead(
  d: ResolvedFigureDescriptor,
  m: FigureMetrics,
  head: Vec3,
  tier: FigureTier,
  b: SkinnedMeshBuilder,
  s: Skin,
  /** The chest joint: hair that falls past the neck (a ponytail) blends toward it. */
  chestJoint: number = s[0],
): void {
  const near = tier === 0;
  const sides = near ? 40 : tier === 1 ? 20 : 8;
  const rows = near ? 30 : tier === 1 ? 16 : 8;
  const { W, L, baseY } = humanHeadFrame(m, head);
  const form = d.features.form;
  const adult = d.age !== 'child';
  // Jaw and brow follow the body form: a squarer jaw, or a narrower one and fuller lips.
  const jaw = !adult ? -0.03 : form === 'masculine' ? 0.05 : form === 'feminine' ? -0.05 : 0;
  const brow = !adult ? 0.8 : form === 'masculine' ? 1.25 : form === 'feminine' ? 0.75 : 1;
  const prof = (t: number): [number, number, number] => profile(t, jaw);
  const skinColor = parseColor(d.palette.skin);
  const hairColor = parseColor(d.palette.hair);
  const lipColor: RGB = [skinColor[0] * 0.89, skinColor[1] * 0.64, skinColor[2] * 0.67];
  const eyeColor = parseColor(d.palette.eyes);
  const facial = adult ? d.features.facialHair : 'none';
  // The facial relief is actual geometry. Nose, brow ridge, cheeks and chin catch scene light.
  const relief = (x: number, t: number): number =>
    0.105 * bump(x / 0.085, (t - 0.49) / 0.18) +
    0.135 * bump(x / 0.075, (t - 0.365) / 0.055) +
    0.045 * bump((dmath.abs(x) - 0.24) / 0.14, (t - 0.35) / 0.09) +
    0.045 * brow * bump((dmath.abs(x) - 0.19) / 0.13, (t - 0.57) / 0.045) -
    0.045 * bump((dmath.abs(x) - 0.2) / 0.1, (t - 0.49) / 0.055) +
    0.035 * bump(x / 0.19, (t - 0.21) / 0.06);
  const frontZ = (x: number, t: number): number => {
    const [rx, front] = prof(t);
    const f = dmath.sqrt(dmath.max(0, 1 - (x / rx) * (x / rx)));
    return W * (front * dmath.pow(f, 0.55) + relief(x, t) * f);
  };
  // Beard shadow: jaw, chin and upper lip, rising to the sideburns; lips stay clear.
  const beardArea = (x: number, t: number): number => {
    const ax = dmath.abs(x);
    const top = 0.3 + 0.16 * dmath.smoothstep(dmath.clamp((ax - 0.22) / 0.2, 0, 1));
    const lips = ax < 0.17 && t > 0.18 && t < 0.232 ? 1 : 0;
    const nose = ax < 0.11 && t > 0.27 ? 1 : 0;
    return dmath.clamp((top - t) / 0.04, 0, 1) * (1 - lips) * (1 - nose);
  };
  const shadow =
    facial === 'none'
      ? 0
      : facial === 'stubble'
        ? 0.32
        : tier === 2 && facial === 'beard'
          ? 0.75
          : 0.22;
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
    const [rx, , back] = prof(t);
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
      let color: RGB = [
        skinColor[0] * (1 + flush * 0.35),
        skinColor[1] * (1 - flush),
        skinColor[2] * (1 - flush * 0.6),
      ];
      if (shadow > 0 && c > -0.25)
        color = mixColor(color, hairColor, shadow * beardArea(x, t) * dmath.clamp(c + 0.25, 0, 1));
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
    region: 'skin' | 'brow' | 'hair',
    pts: readonly [number, number][],
    width: number,
    color: RGB,
    depth = 0.009,
  ): void => {
    let prev = -1;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i] as [number, number];
      const next = pts[i + 1] as [number, number];
      const steps = near ? 4 : 2;
      for (let j = i === 0 ? 0 : 1; j <= steps; j++) {
        const x = dmath.lerp(a[0], next[0], j / steps);
        const t = dmath.lerp(a[1], next[1], j / steps);
        const lo = b.vertex(point(x, t - width, depth), color, s);
        const hi = b.vertex(point(x, t + width, depth), color, s);
        if (prev >= 0) b.quad(region, prev, lo, hi, prev + 1);
        prev = lo;
      }
    }
  };
  if (tier < 2) {
    const fuller = adult && form === 'feminine' ? 1.25 : 1;
    ribbon(
      'skin',
      [
        [-0.16, 0.205],
        [-0.08, 0.215],
        [0, 0.209],
        [0.08, 0.215],
        [0.16, 0.205],
      ],
      0.011 * fuller,
      fuller > 1 ? [lipColor[0] * 0.98, lipColor[1] * 0.9, lipColor[2] * 0.92] : lipColor,
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
  if ((facial === 'mustache' || facial === 'beard') && tier < 2)
    ribbon(
      'hair',
      [
        [-0.2, 0.2],
        [-0.15, 0.236],
        [-0.06, 0.252],
        [0, 0.25],
        [0.06, 0.252],
        [0.15, 0.236],
        [0.2, 0.2],
      ],
      0.022,
      tint(hairColor, 0.92),
      0.022,
    );
  if (facial === 'beard' && tier < 2) {
    // A shell over jaw and chin, pushed out along the face normal, with the mouth left open.
    const cols = near ? 14 : 8;
    const rowsB = near ? 7 : 4;
    // Rows below the lower lip span the whole jaw; above it only the cheeks continue up to
    // the mustache corners and sideburns, so the mouth has a clean edge.
    const lowerRows = near ? 4 : 2;
    const LIP = 0.165;
    const heightAt = (row: number, across: number): number =>
      row <= lowerRows
        ? dmath.lerp(-0.07, LIP, row / lowerRows)
        : dmath.lerp(
            LIP,
            0.3 + 0.17 * dmath.smoothstep(dmath.abs(across)),
            (row - lowerRows) / (rowsB - lowerRows),
          );
    const grid: number[][] = [];
    for (let row = 0; row <= rowsB; row++) {
      const ids: number[] = [];
      for (let col = 0; col <= cols; col++) {
        const across = (2 * col) / cols - 1;
        const t = heightAt(row, across);
        const [rx] = prof(dmath.max(0, t));
        const x = across * rx * 0.97;
        const below = row <= lowerRows ? 1 - row / lowerRows : 0;
        const depth = 0.026 + 0.022 * below * (1 - dmath.abs(across));
        const p = point(x, t, 0);
        const nx = x / rx;
        const nz = dmath.sqrt(dmath.max(0, 1 - nx * nx));
        const lock = near ? 1 + 0.18 * dmath.sin(col * 2.1 + row * 1.3) : 1;
        ids.push(
          b.vertex(
            [p[0] + nx * depth * W * lock, p[1] - below * 0.025 * L, p[2] + nz * depth * W * lock],
            tint(hairColor, 0.9 + 0.1 * dmath.sin(col * 1.7 + row)),
            s,
          ),
        );
      }
      grid.push(ids);
    }
    for (let row = 0; row < rowsB; row++)
      for (let col = 0; col < cols; col++) {
        const across = (2 * (col + 0.5)) / cols - 1;
        if (row >= lowerRows && dmath.abs(across) < 0.45) continue;
        const lo = grid[row] as number[];
        const hi = grid[row + 1] as number[];
        b.quad(
          'hair',
          lo[col] as number,
          lo[col + 1] as number,
          hi[col + 1] as number,
          hi[col] as number,
        );
      }
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
    // The raised lid rim is sub-pixel on the distant tier.
    if (tier < 2)
      b.quad(
        'skin',
        inner[i] as number,
        outer[i] as number,
        outer[j] as number,
        inner[j] as number,
      );
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
    0.01 * (adult && form === 'feminine' ? 0.8 : 1),
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
    const center: Vec3 = [W * (prof(0.43)[0] + 0.012), baseY + L * 0.43, -W * 0.01];
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

  const style = d.features.hair;
  if (style === 'none') return;
  buildHairShell(style);
  if (style === 'ponytail') buildPonytail();
  if (style === 'bun') {
    const bun: Vec3 = [0, baseY + 0.8 * L, -0.66 * W];
    b.ellipsoid(
      'hair',
      bun,
      [0, 0.45, -1],
      [0.24 * W, 0.22 * W, 0.2 * W],
      near ? 14 : tier === 1 ? 8 : 6,
      near ? 8 : tier === 1 ? 4 : 3,
      s,
      tint(hairColor, 0.95),
    );
  }

  /** The scalp-following shell; a rolled edge where it hangs free of the skull. */
  function buildHairShell(style: FigureHairStyle): void {
    const long = style === 'long' || style === 'bob' || style === 'afro';
    const hairRows = near ? (long ? 12 : 9) : tier === 1 ? (long ? 6 : 5) : 3;
    const SKULL = 0.38;
    const banded = style === 'balding';
    const included = (c: number): boolean => !banded || c < 0.32;
    let last: RingRef | undefined;
    // Ring -1 is the rolled lip: under the scalp at a hairline, toward the neck where the
    // hair hangs free (so a hanging edge has an underside instead of an open shell).
    // The distant tier, seen from far off, skips the lip.
    for (let r = tier === 2 ? 0 : -1; r <= hairRows; r++) {
      const f = dmath.max(0, r) / hairRows;
      const start = b.mark();
      for (let i = 0; i < sides; i++) {
        const a = (dmath.TAU * (i <= sides / 2 ? i : sides - i)) / sides;
        const c = dmath.cos(a);
        const sign = i <= sides / 2 ? 1 : -1;
        const side = dmath.abs(dmath.sin(a));
        const t0 = hairStart(style, c, side);
        const t1 = banded ? dmath.lerp(0.6, 0.72, dmath.clamp(-c, 0, 1)) : 0.997;
        const hangs = t0 < SKULL && HANGING.has(style);
        const t = r < 0 ? t0 + (hangs ? 0.035 : 0) : dmath.lerp(t0, t1, 1 - (1 - f) * (1 - f));
        let offset = r < 0 ? (hangs ? -0.12 : -0.006) : hairOffset(style, c, t);
        if (style === 'afro' && r >= 0)
          offset = dmath.lerp(0.02, offset, dmath.smoothstep(dmath.clamp(f / 0.35, 0, 1)));
        // Hanging styles fall straight below the skull; short ones follow the nape inward.
        const tt = HANGING.has(style) ? dmath.max(SKULL, t) : dmath.max(0.12, t);
        const [rx, , back] = prof(tt);
        // Toward the crown the scalp faces up, so part of the offset lifts the hair instead.
        const lift = dmath.pow(dmath.clamp((tt - 0.62) / 0.38, 0, 1), 1.5);
        const across = dmath.sqrt(1 - lift * lift);
        // Locks are small silhouette changes, not painted lighting.
        const curl =
          style === 'afro' && near
            ? 1 + 0.035 * dmath.sin(a * 9 + t * 21) * dmath.sin(a * 5 - t * 13)
            : 1;
        const lock = near && r >= 0 ? 1 + 0.012 * dmath.cos(a * 12) * (1 - f) : 1;
        const x = dmath.sin(a) * (rx + offset * across) * sign * curl * lock;
        const z =
          (c >= 0
            ? frontZ(dmath.sin(a) * rx * sign, tt) + c * offset * across * W
            : c * (back + offset * across) * W) *
          curl *
          lock;
        const strand = 1 + 0.12 * dmath.sin(a * 17 + t * 4) * dmath.sin(a * 7 - t * 3);
        b.vertex(
          [x * W, baseY + t * L + 0.009 * L + offset * lift * W * curl, z],
          style === 'buzz'
            ? mixColor(tint(hairColor, strand), skinColor, 0.3)
            : tint(hairColor, strand),
          s,
        );
      }
      const ring = { start, sides, center: [0, baseY + L, 0] as Vec3 };
      if (last) {
        for (let i = 0; i < sides; i++) {
          const j = (i + 1) % sides;
          const ci = dmath.cos((dmath.TAU * (i <= sides / 2 ? i : sides - i)) / sides);
          const cj = dmath.cos((dmath.TAU * (j <= sides / 2 ? j : sides - j)) / sides);
          if (!included(ci) || !included(cj)) continue;
          b.quad('hair', last.start + i, last.start + j, ring.start + j, ring.start + i);
        }
      }
      last = ring;
      if (r === hairRows && !banded)
        b.cap('hair', ring, s, hairColor, [0, baseY + 1.006 * L + hairOffset(style, 1, 1) * W, 0]);
    }
  }

  /** Gathered high on the back of the head, then hanging behind the neck toward the chest. */
  function buildPonytail(): void {
    const ringSides = near ? 10 : 6;
    // Stations along the tail: [u, radius in W]; the two narrow ones are the tie.
    const stations: readonly (readonly [number, number])[] = near
      ? [
          [0, 0.07],
          [0.05, 0.085],
          [0.075, 0.085],
          [0.1, 0.1],
          [0.2, 0.17],
          [0.35, 0.2],
          [0.55, 0.18],
          [0.75, 0.13],
          [0.9, 0.08],
          [1, 0.03],
        ]
      : tier === 1
        ? [
            [0, 0.07],
            [0.1, 0.1],
            [0.3, 0.19],
            [0.6, 0.17],
            [1, 0.04],
          ]
        : [
            [0, 0.08],
            [0.3, 0.19],
            [1, 0.05],
          ];
    const path = (u: number): Vec3 => {
      // Out from the occiput, then down: a quarter turn, then a gentle fall.
      const t = dmath.lerp(0.68, -0.45, u);
      const out = 0.2 * dmath.sin(dmath.min(1, u * 2.2) * dmath.PI * 0.5) + 0.06 * u;
      return [0, baseY + t * L, -(0.6 + out) * W];
    };
    const accent = tint(parseColor(d.palette.accent), 0.8);
    let tangent: Vec3 | undefined;
    let prev: RingRef | undefined;
    for (let k = 0; k < stations.length; k++) {
      const [u, radiusW] = stations[k] as readonly [number, number];
      const p = path(u);
      const q = path(dmath.min(1, u + 0.02));
      const o = path(dmath.max(0, u - 0.02));
      const dl = dmath.hypot(q[0] - o[0], q[1] - o[1], q[2] - o[2]) || 1;
      const dir: Vec3 = [(q[0] - o[0]) / dl, (q[1] - o[1]) / dl, (q[2] - o[2]) / dl];
      // Transport the frame along the curve so the hanging tail never twists inside out.
      const ref: Vec3 = tangent ?? [1, 0, 0];
      const dot = ref[0] * dir[0] + ref[1] * dir[1] + ref[2] * dir[2];
      const tx = ref[0] - dir[0] * dot,
        ty = ref[1] - dir[1] * dot,
        tz = ref[2] - dir[2] * dot;
      const tl = dmath.hypot(tx, ty, tz) || 1;
      tangent = [tx / tl, ty / tl, tz / tl];
      const up: Vec3 = [
        dir[1] * tangent[2] - dir[2] * tangent[1],
        dir[2] * tangent[0] - dir[0] * tangent[2],
        dir[0] * tangent[1] - dir[1] * tangent[0],
      ];
      const radius = radiusW * W;
      const wChest = 0.5 * dmath.smoothstep(dmath.clamp((u - 0.3) / 0.7, 0, 1));
      const weights = blend(s[0], 1 - wChest, chestJoint, wChest);
      const tie = near && (k === 1 || k === 2);
      const start = b.mark();
      for (let i = 0; i < ringSides; i++) {
        const angle = (dmath.TAU * i) / ringSides;
        const cx = dmath.cos(angle) * radius * 0.9,
          cy = dmath.sin(angle) * radius;
        b.vertex(
          [
            p[0] + tangent[0] * cx + up[0] * cy,
            p[1] + tangent[1] * cx + up[1] * cy,
            p[2] + tangent[2] * cx + up[2] * cy,
          ],
          tie ? accent : tint(hairColor, 1 + 0.1 * dmath.sin(angle * 3 + u * 5)),
          weights,
        );
      }
      const ring = { start, sides: ringSides, center: p };
      if (prev) b.loft(tie && k === 2 ? 'accent' : 'hair', prev, ring);
      else b.cap('hair', ring, weights, hairColor, undefined, false);
      if (k === stations.length - 1)
        b.cap('hair', ring, weights, hairColor, [p[0], p[1] - 0.02 * L, p[2]]);
      prev = ring;
    }
  }
}
