/** Anatomical head surfaces, with features following the same surface at every detail tier. */
import { dmath, type Vec3 } from '@bendyline/molen-kernel/determinism';
import { hatBand } from './body-human-accessories';
import { parseColor, type RGB } from './color';
import type { FigureMetrics } from './proportions';
import {
  blend,
  type FigureRegion,
  type FigureTier,
  type RingRef,
  type Skin,
  type SkinnedMeshBuilder,
} from './skinned-mesh-builder';
import type {
  FigureForm,
  FigureHairStyle,
  FigureHairTexture,
  FigureHeadShape,
  ResolvedFigureDescriptor,
} from './types';

export function tint(color: RGB, factor: number): RGB {
  return [color[0] * factor, color[1] * factor, color[2] * factor];
}

const mixColor = (a: RGB, b: RGB, t: number): RGB => [
  dmath.lerp(a[0], b[0], t),
  dmath.lerp(a[1], b[1], t),
  dmath.lerp(a[2], b[2], t),
];

const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const unit = (a: Vec3): Vec3 => {
  const l = dmath.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

/**
 * Profile coordinates below the cranium: height above the chin, half width, front depth, back
 * depth (fractions of the head width unit, measured from the axis the neck carries the head on).
 * Adult means: the brow stands about 0.6 of a head width in front of the ear and the back of the
 * skull as far behind it; the jaw is 0.7 of the cheekbones across; the chin stands some 3 cm in
 * front of the throat, which is what gives a head a jawline.
 */
const PROFILE: readonly (readonly [number, number, number, number])[] = [
  [0, 0.11, 0.44, 0.1],
  [0.05, 0.2, 0.52, 0.2],
  [0.12, 0.31, 0.525, 0.3],
  [0.2, 0.385, 0.54, 0.4],
  [0.3, 0.43, 0.55, 0.48],
  [0.42, 0.475, 0.55, 0.55],
  [0.5, 0.475, 0.548, 0.58],
  [0.6, 0.468, 0.555, 0.6],
  [0.72, 0.4626, 0.5447, 0.6012],
];

/** Where the table hands over to the cranium's arcs. */
const CRANIUM = 0.72;

/** Half width, front and back depth of the reference skull at height t. */
function profile(t: number): [number, number, number] {
  if (t >= CRANIUM) {
    // The cranium is three arcs of one ellipse: the forehead slopes back sooner than the sides.
    const k = dmath.clamp((t - 0.66) / 0.34, 0, 1);
    const e = dmath.sqrt(dmath.max(0, 1 - k * k));
    return [
      dmath.max(0.015, 0.47 * e),
      dmath.max(0.015, 0.555 * dmath.pow(e, 1.15)),
      dmath.max(0.015, 0.61 * dmath.pow(e, 0.9)),
    ];
  }
  for (let i = 1; i < PROFILE.length; i++) {
    const a = PROFILE[i - 1] as readonly [number, number, number, number];
    const c = PROFILE[i] as readonly [number, number, number, number];
    if (t <= c[0]) {
      const f = dmath.clamp((t - a[0]) / (c[0] - a[0]), 0, 1);
      return [dmath.lerp(a[1], c[1], f), dmath.lerp(a[2], c[2], f), dmath.lerp(a[3], c[3], f)];
    }
  }
  return [0.4626, 0.5447, 0.6012];
}

function bump(x: number, y: number): number {
  return dmath.exp(-x * x - y * y);
}

/** The reference head: every shape parameter 0 (the generator's own face). */
const REFERENCE_HEAD: FigureHeadShape = {
  faceWidth: 0,
  jaw: 0,
  chin: 0,
  cheeks: 0,
  cheekbones: 0,
  brow: 0,
  noseBridge: 0,
  noseWidth: 0,
  noseTip: 0,
  eyeSpacing: 0,
  eyeSize: 0,
  eyeTilt: 0,
  lips: 0,
  crown: 0,
  faceLength: 0,
  noseLength: 0,
  mouthWidth: 0,
  browArch: 0,
  eyeLid: 0,
};

/**
 * The face of a figure without a head shape follows its body form: a squarer jaw and a stronger
 * brow, or a narrower jaw, fuller lips and arched brows. A head shape replaces all of it.
 */
const FORM_HEADS: Readonly<Record<FigureForm, Partial<FigureHeadShape>>> = {
  neutral: {},
  masculine: { jaw: 0.3, chin: 0.25, brow: 0.35, lips: -0.25, noseWidth: 0.1, browArch: -0.3 },
  feminine: {
    jaw: -0.3,
    chin: -0.2,
    brow: -0.4,
    lips: 0.45,
    eyeSize: 0.15,
    browArch: 0.4,
    noseTip: -0.15,
  },
};

const clamp1 = (v: number): number => dmath.clamp(v, -1, 1);

/**
 * The shape the head is built from: the authored shape or the body form's, then what age does to
 * any face. A child's features are small and soft on full cheeks; an elder's cheeks and lips thin
 * and the nose lengthens.
 */
function effectiveHead(d: ResolvedFigureDescriptor): FigureHeadShape {
  const k: FigureHeadShape = {
    ...REFERENCE_HEAD,
    ...(d.head ?? (d.age === 'child' ? {} : FORM_HEADS[d.features.form])),
  };
  if (d.age === 'child') {
    k.jaw = clamp1(0.5 * k.jaw - 0.2);
    k.chin = clamp1(0.5 * k.chin - 0.3);
    k.cheeks = clamp1(0.6 * k.cheeks + 0.4);
    k.brow = clamp1(0.6 * k.brow - 0.4);
    k.noseBridge = clamp1(0.6 * k.noseBridge - 0.45);
    k.noseTip = clamp1(0.7 * k.noseTip - 0.25);
    k.noseLength = clamp1(0.6 * k.noseLength - 0.4);
    k.eyeSize = clamp1(0.7 * k.eyeSize + 0.3);
  } else if (d.age === 'elder') {
    k.cheeks = clamp1(k.cheeks - 0.25);
    k.lips = clamp1(k.lips - 0.3);
    k.noseTip = clamp1(k.noseTip + 0.15);
    k.noseLength = clamp1(k.noseLength + 0.2);
    k.eyeLid = clamp1(k.eyeLid - 0.2);
    k.brow = clamp1(k.brow + 0.1);
  }
  return k;
}

/**
 * The head's frame: width unit, chin-to-crown height and chin height, from the metrics. A head
 * shape's `faceWidth` widens or narrows the width unit (the face, skull and hair follow it) and
 * its `faceLength` moves the chin, the crown staying at the figure's height.
 */
export function humanHeadFrame(
  m: FigureMetrics,
  head: Vec3,
  shape?: FigureHeadShape,
): { W: number; L: number; baseY: number } {
  const L = m.headLen * 0.9 * (shape ? 1 + 0.055 * (shape.faceLength ?? 0) : 1);
  const W = m.headWidth * 0.86;
  return { W: shape ? W * (1 + 0.1 * shape.faceWidth) : W, L, baseY: head[1] + m.headLen - L };
}

/** Styles whose shell hangs below the skull (they get a rolled lower edge). */
const HANGING: ReadonlySet<FigureHairStyle> = new Set(['bob', 'long', 'shoulder', 'locs']);

/** Styles with loose hair: a texture adds volume and ripple to them (pulled-back hair keeps its shape). */
const LOOSE: ReadonlySet<FigureHairStyle> = new Set([
  'cap',
  'crop',
  'bob',
  'long',
  'afro',
  'shoulder',
  'fade',
  'mohawk',
]);

/**
 * What a texture does to loose hair (head width units): `add` lifts the whole shell off the
 * scalp, `flare` pushes hanging lengths further out toward their ends, `ripple` roughs the
 * silhouette (a fraction of the radius, near detail only) at the given angular and vertical
 * frequencies.
 */
const TEXTURES: Readonly<
  Record<FigureHairTexture, { add: number; flare: number; ripple: number; freq: [number, number] }>
> = {
  straight: { add: 0, flare: 0, ripple: 0, freq: [0, 0] },
  wavy: { add: 0.018, flare: 0.035, ripple: 0.03, freq: [5, 9] },
  curly: { add: 0.045, flare: 0.08, ripple: 0.045, freq: [9, 17] },
  coily: { add: 0.075, flare: 0.13, ripple: 0.06, freq: [13, 25] },
};

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
    case 'shoulder':
      // Below the jaw at the sides and back, a fringe-free front.
      return dmath.lerp(line(0.735, 0.24), -0.08, toward(0.3, 0.3));
    case 'locs':
      // The shell is the mass under the locks: it ends at the jaw, and the locks hang past it.
      return dmath.lerp(line(0.735, 0.24), 0.08, toward(0.3, 0.3));
    case 'fade':
      return line(0.72, 0.24);
    case 'mohawk':
    case 'rows':
      return line(0.74, 0.22);
    case 'topknot':
    case 'puffs':
    case 'braids':
      return line(0.745, 0.22);
    default:
      return line(0.73, 0.24);
  }
}

/** How far toward the middle a point of the head is, for a mohawk ridge (1 on the centre line). */
function mohawkRidge(c: number): number {
  const side = dmath.sqrt(dmath.max(0, 1 - c * c));
  return dmath.smoothstep(dmath.clamp(1 - side / 0.42, 0, 1));
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
      // Cut close at the sides, standing up on top and most at the front.
      return 0.022 + (0.055 + 0.045 * dmath.max(0, c)) * top;
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
    case 'shoulder':
      return 0.03 + 0.06 * dmath.smoothstep(dmath.clamp((0.5 - t) / 0.6, 0, 1));
    case 'locs':
      return 0.045 + 0.05 * dmath.smoothstep(dmath.clamp((0.5 - t) / 0.6, 0, 1));
    case 'fade':
      // Close at the sides and nape, fuller on top.
      return 0.016 + 0.085 * top;
    case 'mohawk':
      // Close-cropped sides rising into a rounded ridge along the middle, front to nape.
      return 0.02 + 0.1 * mohawkRidge(c) * (0.55 + 0.45 * top);
    case 'rows':
      return 0.018;
    case 'topknot':
    case 'puffs':
    case 'braids':
      return 0.016;
    default:
      // The short cut: lying close at the sides, a little body on top.
      return 0.026 + (0.03 + 0.015 * dmath.max(0, c)) * top;
  }
}

/**
 * The head as built, for what is worn on it (hats, glasses, headphones): the frame, the mapping
 * the hair shell uses from (angle, height, offset) to a point, how far the hair stands off the
 * skull, and where the face, eyes and ears are.
 */
export interface HumanHeadSurface {
  /** Width unit, chin-to-crown height and chin height (see humanHeadFrame). */
  W: number;
  L: number;
  baseY: number;
  /**
   * A point over the skull at height `t` (0 chin, 1 crown) and angle `a` (0 front, π back) on
   * the `sign` side (1 = +x), `offset` head widths off it; toward the crown part of the offset
   * lifts the point instead, as the hair shell does.
   */
  shell(a: number, sign: number, t: number, offset: number): Vec3;
  /**
   * How far the hair stands off the skull (head widths) at `c` (cosine of the angle: 1 front,
   * −1 back) and `t`, with room for its ripples; 0 without hair.
   */
  hair(c: number, t: number): number;
  /** The face's depth (absolute z) at x (head widths) and t: its drawn triangles and the nose. */
  faceZ(x: number, t: number): number;
  /** Half-width of the skull (head widths) at t. */
  halfWidth(t: number): number;
  /** The left eye: x (head widths), t and size factor. */
  eye: { x: number; t: number; scale: number };
  /** The left ear's center and half its length. */
  ear: Vec3;
  earLen: number;
}

/** Hanging hair (braids) steps out over a backpack whose top is at `y`, `depth` deep. */
export interface HumanHeadPack {
  y: number;
  depth: number;
}

/** How far behind the figure's axis the body's back is at (x, y), for hair that lies on it. */
export type HumanBackSurface = (x: number, y: number) => number;

export function buildHumanHead(
  d: ResolvedFigureDescriptor,
  m: FigureMetrics,
  head: Vec3,
  tier: FigureTier,
  b: SkinnedMeshBuilder,
  s: Skin,
  /** The chest joint: hair that falls past the neck (a ponytail) blends toward it. */
  chestJoint: number = s[0],
  pack?: HumanHeadPack,
  /** The back of the neck and torso, so braids and locks lie on them instead of floating. */
  back?: HumanBackSurface,
): HumanHeadSurface {
  const near = tier === 0;
  const mid = tier === 1;
  const far = tier === 2;
  const sides = near ? 40 : mid ? 20 : 8;
  const rows = near ? 30 : mid ? 16 : 8;
  const k = effectiveHead(d);
  const { W, L, baseY } = humanHeadFrame(m, head, d.head);
  const adult = d.age !== 'child';
  const style = d.features.hair;
  const texture = d.features.hairTexture;
  // A hat: the hair shell stops just inside its band, and what is gathered on the crown hides.
  const hat = d.features.headwear;
  const skinColor = parseColor(d.palette.skin);
  const hairColor = parseColor(d.palette.hair);
  const eyeColor = parseColor(d.palette.eyes);
  const facial = adult ? d.features.facialHair : 'none';

  // ---- The skull ------------------------------------------------------------------------------
  // Jaw and chin widths, cheekbones, cheek fullness and the crown reshape the reference profile.
  const jawK = (adult ? 0.22 : 0.12) * k.jaw;
  const prof = (t: number): [number, number, number] => {
    const p = profile(t);
    const kj = (t - 0.17) / 0.12;
    const kc = (t - 0.03) / 0.07;
    const g = (t - 0.44) / 0.1;
    const ck = (t - 0.29) / 0.09;
    const width =
      (1 + jawK * dmath.exp(-kj * kj)) *
      (1 + 0.18 * k.chin * dmath.exp(-kc * kc)) *
      (1 + 0.085 * k.cheekbones * dmath.exp(-g * g)) *
      (1 + 0.05 * k.cheeks * dmath.exp(-ck * ck));
    const crown = 1 + 0.1 * k.crown * dmath.smoothstep(dmath.clamp((t - 0.7) / 0.3, 0, 1));
    return [p[0] * width * crown, p[1] * crown, p[2] * crown];
  };

  // Feature placement: eye spacing moves the eyes, sockets and brows; size and tilt shape them.
  const eyeX = 0.205 * (1 + 0.13 * k.eyeSpacing);
  const eyeT = 0.497;
  const eyeScale = 1 + 0.2 * k.eyeSize;
  const eyeTilt = 0.024 * k.eyeTilt;
  const eyeHalf = 0.098 * eyeScale;
  const browStrength = (adult ? 1 : 0.8) * (1 + 0.6 * k.brow);
  // Mouth and nose landmarks (t above the chin, x in head widths).
  const mouthT = 0.205;
  const mouthHalf = 0.165 * (1 + 0.2 * k.mouthWidth);
  const lipFull = 1 + 0.45 * k.lips;
  const lipUp = 0.027 * lipFull;
  const lipLow = 0.038 * lipFull;
  const noseBase = 0.318 - 0.02 * k.noseLength;
  const noseTipT = noseBase + 0.042;
  const noseRoot = 0.53;
  const noseWide = 1 + 0.28 * k.noseWidth;
  const alar = 0.112 * (1 + 0.3 * k.noseWidth);

  // The facial relief is actual geometry: brow ridge, eye sockets, cheekbones, the mound the
  // teeth make around the mouth, and the chin under a shallow groove. The nose and lips stand on
  // it as their own planes.
  const browAmp = 0.046 * browStrength;
  const socketAmp = 0.05 * (1 + 0.35 * k.eyeLid);
  const cheekboneAmp = 0.03 * (1 + 1.2 * k.cheekbones);
  const cheekAmp = 0.03 * (0.4 + 1.3 * k.cheeks);
  const chinAmp = 0.05 * (1 + 0.95 * k.chin);
  const nasionDip = 0.012 - 0.008 * k.noseBridge;
  const relief = (x: number, t: number): number => {
    const ax = dmath.abs(x);
    return (
      browAmp * bump((ax - 0.17) / 0.16, (t - 0.588) / 0.04) +
      0.012 * browStrength * bump(x / 0.09, (t - 0.585) / 0.04) -
      nasionDip * bump(x / 0.075, (t - 0.527) / 0.035) -
      socketAmp * bump((ax - eyeX) / 0.105, (t - eyeT) / 0.048) +
      cheekboneAmp * bump((ax - 0.34) / 0.1, (t - 0.42) / 0.06) +
      cheekAmp * bump((ax - 0.26) / 0.15, (t - 0.3) / 0.1) +
      0.028 * bump(x / 0.21, (t - 0.25) / 0.085) +
      0.02 * bump(x / 0.07, (t - 0.42) / 0.08) +
      chinAmp * bump(x / 0.15, (t - 0.07) / 0.055) -
      0.014 * bump(x / 0.13, (t - 0.148) / 0.028) -
      0.012 * bump((ax - 0.44) / 0.07, (t - 0.63) / 0.07)
    );
  };
  // Seen from above the face is a blunt wedge: it has fallen back a third of its depth by the
  // outer corners of the eyes.
  const frontZ = (x: number, t: number): number => {
    const [rx, front] = prof(t);
    const f = dmath.sqrt(dmath.max(0, 1 - (x / rx) * (x / rx)));
    return W * (front * dmath.pow(f, 0.68) + relief(x, t) * f);
  };

  // Hair covers the scalp: the skull under a full shell is not drawn (the shell's lip meets what
  // is left of it along the hairline).
  const covered = style !== 'none' && style !== 'balding';
  // A coarser shell spans more of the skull's curve per row: it stands a little further off.
  const tierLift = near ? 0 : mid ? 0.008 : 0.016;
  const hairline: number[] = [];
  for (let i = 0; i < sides; i++) {
    const a = (dmath.TAU * (i <= sides / 2 ? i : sides - i)) / sides;
    const edge = hairStart(style, dmath.cos(a), dmath.abs(dmath.sin(a)));
    // A hanging shell falls straight from the widest of the skull: the skull below it stays.
    hairline.push(covered ? (HANGING.has(style) ? dmath.max(0.38, edge) : edge) : 2);
  }
  // Beard shadow: the jaw, chin and upper lip under a line that runs level from the corners of
  // the mouth and climbs to the sideburns in front of the ears.
  const cheekLine = (ax: number): number =>
    0.275 +
    0.03 * dmath.smoothstep(dmath.clamp((ax - 0.2) / 0.2, 0, 1)) +
    0.13 * dmath.smoothstep(dmath.clamp((ax - 0.3) / 0.14, 0, 1));
  const beardArea = (x: number, t: number): number => {
    const ax = dmath.abs(x);
    const lips = ax < mouthHalf && t > mouthT - lipLow && t < mouthT + lipUp ? 1 : 0;
    return dmath.clamp((cheekLine(ax) - t) / 0.035, 0, 1) * (1 - lips);
  };
  const shadow =
    facial === 'none' ? 0 : facial === 'stubble' ? 0.34 : far && facial === 'beard' ? 0.75 : 0.22;

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
  let previous: RingRef | undefined;
  for (let r = 0; r <= rows; r++) {
    const t = r / rows;
    const [rx, , backDepth] = prof(t);
    const start = b.mark();
    const points: Vec3[] = [];
    for (let i = 0; i < sides; i++) {
      // Fold around the centerline so mirrored coordinates quantize identically.
      const a = (dmath.TAU * (i <= sides / 2 ? i : sides - i)) / sides;
      const x = dmath.sin(a) * rx * (i <= sides / 2 ? 1 : -1);
      const c = dmath.cos(a);
      const z = c >= 0 ? frontZ(x, t) : c * backDepth * W;
      const ax = dmath.abs(x);
      // Subtle anatomical pigmentation, independent of lighting or viewing direction.
      const flush =
        dmath.max(0, c) *
        (0.02 * bump((ax - 0.29) / 0.14, (t - 0.36) / 0.1) +
          0.02 * bump(x / 0.09, (t - 0.37) / 0.06));
      // Where little sky reaches: the sockets, under the nose and lower lip, under the jaw.
      const shade =
        1 -
        dmath.max(0, c) *
          (0.1 * bump((ax - eyeX) / 0.12, (t - eyeT) / 0.045) +
            0.1 * bump(x / 0.11, (t - noseBase + 0.012) / 0.02) +
            0.07 * bump(x / 0.13, (t - 0.15) / 0.02)) -
        0.12 * dmath.clamp((0.05 - t) / 0.05, 0, 1);
      let color: RGB = [
        skinColor[0] * (1 + flush * 0.35) * shade,
        skinColor[1] * (1 - flush) * shade,
        skinColor[2] * (1 - flush * 0.6) * shade,
      ];
      if (shadow > 0 && c > -0.25)
        color = mixColor(color, hairColor, shadow * beardArea(x, t) * dmath.clamp(c + 0.25, 0, 1));
      b.vertex([x * W, baseY + t * L, z], color, s);
      points.push([x, t, z / W]);
    }
    surface.push(points);
    const ring = { start, sides, center: [0, baseY + t * L, 0] as Vec3 };
    if (previous) {
      const below = (r - 1) / rows;
      // Mirrored diagonals preserve the same piecewise-planar face on both sides.
      for (let i = 0; i < sides; i++) {
        const j = (i + 1) % sides;
        if (below >= dmath.max(hairline[i] as number, hairline[j] as number)) continue;
        if (i < sides / 2)
          b.quad('skin', previous.start + i, previous.start + j, ring.start + j, ring.start + i);
        else b.quad('skin', previous.start + j, ring.start + j, ring.start + i, previous.start + i);
      }
    } else b.cap('skin', ring, s, tint(skinColor, 0.88), undefined, false);
    previous = ring;
    if (r === rows && !covered) b.cap('skin', ring, s, skinColor);
  }

  // ---- Features -------------------------------------------------------------------------------
  /** The face's depth on its drawn triangles, head widths. */
  const F = (x: number, t: number): number => sampledFrontZ(x, t) / W;
  /** A point at an absolute depth (head widths). */
  const at = (x: number, t: number, z: number): Vec3 => [x * W, baseY + t * L, z * W];
  /** A point `depth` head widths proud of the face. */
  const on = (x: number, t: number, depth: number): Vec3 => at(x, t, F(x, t) + depth);
  /**
   * A patch with its own vertices: rows top to bottom, columns by increasing x. It shades
   * smoothly inside and meets its neighbours on a crease, which is what makes a plane of it.
   */
  const patch = (
    region: FigureRegion,
    pts: readonly (readonly Vec3[])[],
    color: (row: number, col: number) => RGB,
  ): void => {
    const ids = pts.map((row, r) => row.map((p, c) => b.vertex(p, color(r, c), s)));
    for (let r = 0; r + 1 < ids.length; r++) {
      const hi = ids[r] as number[];
      const lo = ids[r + 1] as number[];
      for (let c = 0; c + 1 < hi.length; c++)
        b.quad(region, hi[c] as number, lo[c] as number, lo[c + 1] as number, hi[c + 1] as number);
    }
  };

  // The nose: a ridge from the root between the eyes to the tip, side walls down to the cheeks,
  // wings round the nostrils and an underside. Rows: root, upper and lower bridge, tip, under the
  // tip, base.
  const noseRows = [
    noseRoot,
    dmath.lerp(noseRoot, noseTipT, 0.4),
    dmath.lerp(noseRoot, noseTipT, 0.78),
    noseTipT,
    noseTipT - 0.02,
    noseBase,
  ];
  const faceMid = (t: number): number => frontZ(0, t) / W;
  const tipOut = dmath.clamp(0.106 * (1 + 0.32 * k.noseTip + 0.22 * k.noseBridge), 0.065, 0.16);
  const tipZ = faceMid(noseBase) + tipOut;
  const rootZ = faceMid(noseRoot) + 0.006 + 0.012 * dmath.max(0, k.noseBridge);
  const baseZ = faceMid(noseBase) + 0.012;
  // A high bridge is straight or arched; a low one dips between root and tip.
  const hump = 0.004 + 0.016 * k.noseBridge;
  const ridge = (u: number): number =>
    dmath.lerp(rootZ, tipZ - 0.004, u) + hump * dmath.sin(dmath.PI * dmath.pow(u, 0.8));
  const tipHalf = 0.05 * (1 + 0.25 * k.noseWidth + 0.2 * k.noseTip);
  const ridgeHalf = (u: number): number => dmath.lerp(0.024, 0.04, u) * (1 + 0.2 * k.noseWidth);
  // The side walls stay clear of the inner corners of the eyes.
  const innerEye = eyeX - eyeHalf - 0.014;
  const wallHalf = (u: number): number =>
    dmath.min(dmath.lerp(0.055, 0.102, u) * noseWide, u < 0.5 ? innerEye : 1);
  const alaOut = 1 + 0.2 * k.noseTip;
  const noseCenter = [ridge(0), ridge(0.4), ridge(0.78), tipZ, tipZ - 0.03, baseZ];
  const noseEdgeX = [ridgeHalf(0), ridgeHalf(0.4), ridgeHalf(0.78), tipHalf, tipHalf * 0.85, 0.024];
  /** One side of the nose: [edge of the ridge, middle of the wall or wing, foot on the face]. */
  const noseSide = (row: number): [Vec3, Vec3, Vec3] => {
    const t = noseRows[row] as number;
    const xe = noseEdgeX[row] as number;
    const zc = noseCenter[row] as number;
    if (row <= 2) {
      const u = [0, 0.4, 0.78][row] as number;
      const xb = wallHalf(u);
      const ze = zc - ([0.004, 0.007, 0.012][row] as number);
      const zb = F(xb, t) + 0.004;
      const f = row === 2 ? 0.6 : 0.5;
      return [
        at(xe, t, ze),
        at(dmath.lerp(xe, xb, f), t, dmath.lerp(ze, zb, f + 0.05)),
        at(xb, t, zb),
      ];
    }
    if (row === 3) {
      const xm = alar * 0.8;
      return [
        at(xe, t, zc - 0.024),
        at(xm, t, F(xm, t) + 0.05 * alaOut),
        at(alar, t, F(alar, t) + 0.014),
      ];
    }
    if (row === 4) {
      const xm = alar * 0.76;
      return [
        at(xe, t, zc - 0.022),
        at(xm, t, F(xm, t) + 0.04 * alaOut),
        at(alar * 0.98, t, F(alar * 0.98, t) + 0.008),
      ];
    }
    const xm = alar * 0.55;
    return [
      at(xe, t, F(xe, t) + 0.012),
      at(xm, t, F(xm, t) + 0.008),
      at(alar * 0.82, t, F(alar * 0.82, t) + 0.004),
    ];
  };
  /** The nose's depth over the face at (x, t), head widths (far below it where there is none). */
  const noseZ = (x: number, t: number): number => {
    if (t > noseRoot || t < noseBase) return -1e9;
    const ax = dmath.abs(x);
    if (t >= noseTipT) {
      const u = (noseRoot - t) / (noseRoot - noseTipT);
      const xe = ridgeHalf(u);
      const xb = dmath.lerp(
        wallHalf(u),
        alar,
        dmath.smoothstep(dmath.clamp((u - 0.78) / 0.22, 0, 1)),
      );
      if (ax >= xb) return -1e9;
      const zc = ridge(u);
      return ax <= xe ? zc : dmath.lerp(zc, frontZ(xb, t) / W, (ax - xe) / (xb - xe));
    }
    if (ax >= alar) return -1e9;
    const v = (noseTipT - t) / (noseTipT - noseBase);
    return dmath.lerp(dmath.lerp(tipZ, baseZ, v), frontZ(alar, t) / W, ax / alar);
  };
  const noseSkin = (row: number, col: number): RGB =>
    // The wings and the underside sit in the nose's own shade.
    tint(skinColor, row >= 4 ? 0.93 : col === 2 ? 0.95 : 1);
  const noseRowIds = near ? [0, 1, 2, 3, 4] : [0, 2, 3, 4];

  // The eye: an almond between the lid margins, the upper lid a fold standing over it with a dark
  // lash line, the iris cut off by the lids as an eye's is. Whites are subdued at gameplay scale.
  const eyeSegs = near ? 8 : mid ? 4 : 2;
  const eyeU = Array.from({ length: eyeSegs + 1 }, (_, i) => (2 * i) / eyeSegs - 1);
  const openUp = 0.028 * eyeScale;
  const openLow = 0.019 * eyeScale;
  /** Lid margins at u (−1 the inner corner, 1 the outer): the upper peaks toward the nose. */
  const upperLid = (u: number): number =>
    eyeT + eyeTilt * u + openUp * dmath.pow(dmath.max(0, 1 - u * u), 0.6) * (1 - 0.15 * u);
  const lowerLid = (u: number): number =>
    eyeT + eyeTilt * u - openLow * dmath.pow(dmath.max(0, 1 - u * u), 0.8) * (1 + 0.2 * u);
  const eyePoint = (u: number, t: number, depth: number): Vec3 => on(eyeX + u * eyeHalf, t, depth);
  /**
   * A point on the eye itself: the surface stretched between the lid margins (the socket under
   * it is hollow, so the face's own depth there would sink the iris behind the white).
   */
  const onEye = (x: number, t: number, depth: number): Vec3 => {
    const u = dmath.clamp((x - eyeX) / eyeHalf, -1, 1);
    const hi = upperLid(u);
    const lo = lowerLid(u);
    const v = hi - lo < 1e-6 ? 0 : dmath.clamp((t - lo) / (hi - lo), 0, 1);
    return at(x, t, dmath.lerp(F(x, lo), F(x, hi), v) + depth);
  };
  const sclera = parseColor('#bdb7aa');
  const lash = mixColor(tint(hairColor, 0.3), [0.02, 0.017, 0.015], 0.55);
  const browColor = mixColor(hairColor, [0.07, 0.055, 0.045], 0.35);

  const mark = b.mark();
  patch(
    'eyes',
    [
      eyeU.map((u) => eyePoint(u, upperLid(u), 0.012)),
      eyeU.map((u) => eyePoint(u, lowerLid(u), 0.012)),
    ],
    (row, col) => {
      const u = eyeU[col] as number;
      // Darker under the upper lid and into the corners.
      return tint(sclera, (row === 0 ? 0.66 : 0.9) * (0.8 + 0.2 * (1 - u * u)));
    },
  );
  /** A disc on the eye, cut off by the lids. */
  const eyeDisc = (radius: number, depth: number, count: number, rim: RGB, center: RGB): void => {
    const within = (x: number, t: number): number => {
      const u = dmath.clamp((x - eyeX) / eyeHalf, -1, 1);
      return dmath.clamp(t, lowerLid(u), upperLid(u));
    };
    const ct = eyeT + 0.004 * eyeScale;
    const hub = b.vertex(onEye(eyeX, within(eyeX, ct), depth), center, s);
    const ids: number[] = [];
    for (let i = 0; i < count; i++) {
      const a = (dmath.TAU * i) / count;
      const x = eyeX + radius * dmath.cos(a);
      ids.push(
        b.vertex(onEye(x, within(x, ct + ((radius * W) / L) * dmath.sin(a)), depth), rim, s),
      );
    }
    for (let i = 0; i < count; i++)
      b.triangle('eyes', hub, ids[i] as number, ids[(i + 1) % count] as number);
  };
  const irisRadius = 0.036 * dmath.sqrt(eyeScale);
  // Further off the pupil is the iris's dark middle.
  eyeDisc(
    irisRadius,
    0.016,
    near ? 10 : mid ? 8 : 6,
    tint(eyeColor, 0.72),
    near ? tint(eyeColor, 1.15) : tint(eyeColor, 0.4),
  );
  if (near) eyeDisc(irisRadius * 0.44, 0.019, 8, [0.03, 0.03, 0.035], [0.03, 0.03, 0.035]);
  if (!far) {
    // The upper lid from its fold down to its margin, which stands proud of the eye. A smooth lid
    // has almost no fold; a deep-set eye a high one.
    const fold = 0.015 * eyeScale * (1 + 0.7 * k.eyeLid);
    patch(
      'skin',
      [
        eyeU.map((u) =>
          eyePoint(u, upperLid(u) + fold * dmath.sqrt(dmath.max(0, 1 - u * u)) + 0.002, 0.011),
        ),
        eyeU.map((u) => eyePoint(u, upperLid(u), 0.024)),
      ],
      (row) => tint(skinColor, row === 0 ? 0.78 : 0.95),
    );
    // Lashes: a dark line along the margin, thicker toward the outer corner, none at the inner.
    const lashWidth = (u: number): number =>
      (0.0035 + 0.0015 * (u + 1)) * eyeScale * dmath.smoothstep(dmath.clamp((u + 1) / 0.35, 0, 1));
    patch(
      'brow',
      [
        eyeU.map((u) => eyePoint(u, upperLid(u) + 0.0012, 0.026)),
        eyeU.map((u) => eyePoint(u, upperLid(u) - lashWidth(u), 0.026)),
      ],
      () => lash,
    );
  }
  if (near)
    // The lower lid's rim.
    patch(
      'skin',
      [
        eyeU.map((u) => eyePoint(u, lowerLid(u), 0.017)),
        eyeU.map((u) =>
          eyePoint(u, lowerLid(u) - 0.007 * dmath.sqrt(dmath.max(0, 1 - u * u)), 0.011),
        ),
      ],
      (row) => tint(skinColor, row === 0 ? 0.8 : 0.98),
    );

  // Brows ride on the brow ridge: thick toward the nose, thinning to a tail; spacing moves them
  // out, a strong brow thickens and lowers them, the arch lifts their outer third.
  {
    const count = near ? 5 : mid ? 3 : 2;
    const spread = eyeX / 0.205;
    const thick = (adult ? 1 : 0.8) * (1 + 0.35 * k.brow);
    const line = eyeT + 0.093 - 0.008 * k.brow;
    const rise = 0.012 + 0.011 * k.browArch;
    const top: Vec3[] = [];
    const bottom: Vec3[] = [];
    for (let i = 0; i <= count; i++) {
      const u = i / count;
      const x = dmath.lerp(0.082, 0.345, u) * spread;
      const t =
        u <= 0.62
          ? dmath.lerp(line - 0.002, line + rise, dmath.smoothstep(u / 0.62))
          : dmath.lerp(
              line + rise,
              line + rise - 0.02 - 0.006 * k.browArch,
              dmath.pow((u - 0.62) / 0.38, 1.5),
            );
      const half = thick * dmath.lerp(0.015, 0.0045, dmath.pow(u, 1.3));
      top.push(on(x, t + half, 0.013));
      bottom.push(on(x, t - half, 0.013));
    }
    patch('brow', [top, bottom], () => browColor);
  }

  // The nose's underside (this side; the ridge and walls follow unmirrored).
  if (!far) {
    const upper = noseSide(4);
    const lower = noseSide(5);
    const underTop: Vec3[] = [at(0, noseRows[4] as number, tipZ - 0.03), ...upper];
    const underBottom: Vec3[] = [at(0, noseBase, baseZ), ...lower];
    // Septum, nostril, wing: each its own facet, the nostril dark.
    const under: RGB[] = [tint(skinColor, 1.06), tint(skinColor, 0.62), tint(skinColor, 1.06)];
    for (let i = 0; i < 3; i++)
      patch(
        'skin',
        [
          [underTop[i] as Vec3, underTop[i + 1] as Vec3],
          [underBottom[i] as Vec3, underBottom[i + 1] as Vec3],
        ],
        () => under[i] as RGB,
      );
  }

  // The ear: a shallow shell standing off the head at its rear edge, about as long as from the
  // brow to the base of the nose, with a darker bowl.
  const earHalf = m.earLen * 1.03;
  const earT = 0.455;
  // Close-cut hair passes behind the ear, so the ear stands off the skull by its thickness;
  // hair that hangs past the ears, or stands as far off the head as they do, covers them.
  const hairAtEar =
    style === 'none'
      ? 0
      : hairOffset(style, -0.1, earT) +
        (texture !== undefined && LOOSE.has(style) ? TEXTURES[texture].add : 0);
  const earHidden = HANGING.has(style) || hairAtEar > 0.045;
  const earLift = earHidden ? 0 : hairAtEar;
  const earRoot: Vec3 = [(prof(earT)[0] * 0.985 + earLift) * W, baseY + earT * L, -0.03 * W];
  const earUp: Vec3 = [0, dmath.cos(0.17), -dmath.sin(0.17)];
  const earBack = ((): Vec3 => {
    const raw: Vec3 = [dmath.sin(0.38), 0, -dmath.cos(0.38)];
    const along = raw[0] * earUp[0] + raw[1] * earUp[1] + raw[2] * earUp[2];
    return unit([raw[0] - along * earUp[0], raw[1] - along * earUp[1], raw[2] - along * earUp[2]]);
  })();
  const earOut = cross(earBack, earUp);
  const earWide = 0.56 * earHalf;
  const earAt = (p: number, q: number, out: number): Vec3 => [
    earRoot[0] + earBack[0] * p + earUp[0] * q + earOut[0] * out,
    earRoot[1] + earBack[1] * p + earUp[1] * q + earOut[1] * out,
    earRoot[2] + earBack[2] * p + earUp[2] * q + earOut[2] * out,
  ];
  const earCenter = earAt(earWide, 0, 0);
  if (d.features.ears !== 'none' && !far && !earHidden) {
    const count = near ? 8 : 6;
    const rim: number[] = [];
    const rear: number[] = [];
    const bowl: number[] = [];
    for (let i = 0; i < count; i++) {
      const a = (dmath.TAU * i) / count;
      // Wider above than at the lobe.
      const ca = dmath.sign(dmath.cos(a)) * dmath.pow(dmath.abs(dmath.cos(a)), 0.7);
      const sa = dmath.sign(dmath.sin(a)) * dmath.pow(dmath.abs(dmath.sin(a)), 0.7);
      const p = earWide * (1 + ca * (0.92 + 0.12 * sa));
      const q = earHalf * sa;
      rim.push(b.vertex(earAt(p, q, 0.06 * earHalf), skinColor, s));
      rear.push(b.vertex(earAt(p, q, -0.12 * earHalf), tint(skinColor, 0.85), s));
      if (near)
        bowl.push(
          b.vertex(
            earAt(earWide + (p - earWide) * 0.55, q * 0.62, 0.01 * earHalf),
            tint(skinColor, 0.74),
            s,
          ),
        );
    }
    const hub = b.vertex(earAt(earWide * 0.9, 0, -0.03 * earHalf), tint(skinColor, 0.5), s);
    const behind = b.vertex(earAt(earWide * 0.7, 0, -0.34 * earHalf), tint(skinColor, 0.8), s);
    for (let i = 0; i < count; i++) {
      const j = (i + 1) % count;
      if (near) {
        b.quad('skin', bowl[i] as number, rim[i] as number, rim[j] as number, bowl[j] as number);
        b.triangle('skin', hub, bowl[i] as number, bowl[j] as number);
      } else b.triangle('skin', hub, rim[i] as number, rim[j] as number);
      b.quad('skin', rim[i] as number, rear[i] as number, rear[j] as number, rim[j] as number);
      b.triangle('skin', behind, rear[j] as number, rear[i] as number);
    }
  }
  b.mirrorX(mark, (joint) => joint);

  // The ridge, walls and wings of the nose, across the middle in one piece.
  if (!far) {
    const flip = (p: Vec3): Vec3 => [-p[0], p[1], p[2]];
    patch(
      'skin',
      noseRowIds.map((row) => {
        const [edge, wall, foot] = noseSide(row);
        return [
          flip(foot),
          flip(wall),
          flip(edge),
          at(0, noseRows[row] as number, noseCenter[row] as number),
          edge,
          wall,
          foot,
        ];
      }),
      (row, col) => noseSkin(noseRowIds[row] as number, dmath.abs(col - 3) - 1),
    );
  } else {
    // Far off the nose is a wedge: root, tip, wings, base.
    const root = at(0, noseRoot, rootZ);
    const tip = at(0, noseTipT, tipZ);
    const base = at(0, noseBase, baseZ);
    const wing = (sign: number): Vec3 =>
      at(sign * alar, noseTipT - 0.01, F(alar, noseTipT - 0.01) + 0.01);
    const facet = (p: Vec3, q: Vec3, r: Vec3, shadeBy: number): void => {
      const color = tint(skinColor, shadeBy);
      b.triangle('skin', b.vertex(p, color, s), b.vertex(q, color, s), b.vertex(r, color, s));
    };
    facet(root, tip, wing(1), 1);
    facet(root, wing(-1), tip, 1);
    facet(tip, base, wing(1), 0.8);
    facet(tip, wing(-1), base, 0.8);
  }

  // The mouth: an upper lip with its bow and a fuller lower lip, parted by a dark line, standing
  // on the mound around the mouth and tapering into its corners.
  if (!far) {
    const lipColor: RGB = mixColor(
      skinColor,
      [skinColor[0] * 0.86, skinColor[1] * 0.58, skinColor[2] * 0.6],
      0.7 + 0.3 * dmath.clamp(k.lips, 0, 1),
    );
    const cols = near ? [-1, -0.72, -0.44, -0.2, 0, 0.2, 0.44, 0.72, 1] : [-1, -0.5, 0, 0.5, 1];
    const partT = (u: number): number =>
      mouthT - 0.003 * dmath.exp(-(u / 0.25) * (u / 0.25)) + 0.002 * u * u;
    const upperT = (u: number): number => {
      const a = dmath.abs(u);
      const k1 = (a - 0.22) / 0.12;
      const k0 = a / 0.1;
      return (
        partT(u) +
        lipUp *
          (1 - dmath.pow(a, 2.2)) *
          (1 + 0.18 * dmath.exp(-k1 * k1) - 0.1 * dmath.exp(-k0 * k0))
      );
    };
    const lowerT = (u: number): number =>
      partT(u) - lipLow * dmath.pow(dmath.max(0, 1 - dmath.pow(dmath.abs(u), 2.5)), 0.9);
    const swell = (u: number): number => dmath.max(0, 1 - u * u);
    const lipRows: [(u: number) => number, (u: number) => number, RGB][] = near
      ? [
          [upperT, (u) => 0.012 + 0.004 * swell(u), mixColor(lipColor, skinColor, 0.4)],
          [
            (u) => dmath.lerp(partT(u), upperT(u), 0.5),
            (u) => 0.012 + 0.022 * lipFull * swell(u),
            tint(lipColor, 0.88),
          ],
          [partT, (u) => 0.012 + 0.012 * swell(u), tint(lipColor, 0.42)],
          [
            (u) => dmath.lerp(partT(u), lowerT(u), 0.55),
            (u) => 0.012 + 0.026 * lipFull * swell(u),
            tint(lipColor, 1.04),
          ],
          [lowerT, (u) => 0.012 + 0.003 * swell(u), mixColor(lipColor, skinColor, 0.4)],
        ]
      : [
          [upperT, (u) => 0.012 + 0.008 * swell(u), tint(lipColor, 0.92)],
          [partT, (u) => 0.012 + 0.014 * swell(u), tint(lipColor, 0.5)],
          [lowerT, (u) => 0.012 + 0.008 * swell(u), tint(lipColor, 1.02)],
        ];
    patch(
      'skin',
      lipRows.map(([t, depth]) => cols.map((u) => on(u * mouthHalf, t(u), depth(u)))),
      (row) => (lipRows[row] as [unknown, unknown, RGB])[2],
    );
  }

  // ---- Facial hair ----------------------------------------------------------------------------
  const whisker = (col: number, row: number): RGB =>
    tint(hairColor, 0.8 + 0.07 * dmath.sin(col * 1.7 + row * 1.3));
  if ((facial === 'mustache' || facial === 'beard') && !far) {
    // A mustache from under the nose over the upper lip, its ends past the corners of the mouth.
    const half = mouthHalf + 0.04;
    const cols = near ? [-1, -0.8, -0.55, -0.28, 0, 0.28, 0.55, 0.8, 1] : [-1, -0.5, 0, 0.5, 1];
    const lipTop = (x: number): number => {
      const a = dmath.min(1, dmath.abs(x) / mouthHalf);
      return mouthT + lipUp * (1 - dmath.pow(a, 2.2));
    };
    const top = (u: number): number =>
      dmath.lerp(noseBase - 0.008, mouthT + 0.022, dmath.pow(dmath.abs(u), 1.4));
    const bottom = (u: number): number =>
      dmath.max(lipTop(u * half) - 0.004, mouthT + 0.004) -
      0.03 * dmath.smoothstep(dmath.clamp((dmath.abs(u) - 0.7) / 0.3, 0, 1));
    const middle = (u: number): number => dmath.lerp(bottom(u), top(u), 0.45);
    const taper = (u: number): number => 1 - 0.7 * dmath.pow(dmath.abs(u), 3);
    patch(
      'hair',
      [
        cols.map((u) => on(u * half, top(u), 0.014)),
        cols.map((u) => on(u * half, middle(u), 0.014 + 0.026 * taper(u))),
        cols.map((u) => on(u * half, bottom(u), 0.02 + 0.006 * taper(u))),
      ],
      (row, col) => whisker(col, row),
    );
  }
  if (facial === 'beard' && !far) {
    // A full beard wraps the jaw: thin where it starts on the cheek and in front of the ear,
    // fullest round the chin, tucked under the jaw so it is closed from below. Its upper edge
    // stops at the sideburns; its lower edge follows the jaw round to under the ears.
    const cols = near ? 16 : 8;
    const rowsB = near ? 5 : 4;
    const grid: number[][] = [];
    for (let row = 0; row <= rowsB + 1; row++) {
      const v = dmath.min(1, row / rowsB);
      const tuck = row > rowsB;
      const ids: number[] = [];
      for (let col = 0; col <= cols; col++) {
        const u = (2 * col) / cols - 1;
        const side = dmath.abs(u);
        const phi = u * dmath.lerp(1.45, 1.66, v);
        const sn = dmath.sin(phi);
        const cs = dmath.cos(phi);
        const axMouth = dmath.abs(dmath.sin(u * 1.45)) * prof(0.25)[0];
        // Under the lower lip in the middle, round the corners of the mouth, up the cheek line.
        const top = dmath.lerp(
          mouthT - lipLow - 0.012,
          cheekLine(axMouth),
          dmath.smoothstep(dmath.clamp((axMouth - mouthHalf + 0.02) / 0.06, 0, 1)),
        );
        // Below the chin in front, along the jaw's edge toward the ear.
        const low = dmath.lerp(-0.03, 0.17, dmath.smoothstep(side));
        const t = dmath.lerp(top, low, v);
        // Below the jaw it hangs from the jaw's outline rather than closing in under the chin.
        const tt = dmath.max(t, 0.085);
        const rx = prof(tt)[0];
        const x = sn * rx;
        // It thins out to nothing at the sideburns and the ends of the jaw.
        const thin = 1 - dmath.smoothstep(dmath.clamp((side - 0.72) / 0.28, 0, 1));
        const full = (0.03 + 0.03 * (1 - side) * v) * (0.15 + 0.85 * thin);
        const off = tuck
          ? 0
          : (near ? 0.005 : 0.014) + full * dmath.smoothstep(dmath.clamp(v / 0.3, 0, 1));
        const lock = near && !tuck ? 1 + 0.16 * dmath.sin(col * 2.1 + row * 1.3) * v : 1;
        const z = cs >= 0 ? frontZ(x, tt) : cs * prof(tt)[2] * W;
        let p: Vec3 = [(x + sn * off * lock) * W, baseY + t * L, z + cs * off * lock * W];
        if (tuck) p = [dmath.lerp(p[0], 0, 0.4), p[1] + 0.025 * L, dmath.lerp(p[2], 0.1 * W, 0.4)];
        const edge = row === 0 || side > 0.93;
        ids.push(
          b.vertex(
            p,
            edge
              ? mixColor(skinColor, hairColor, 0.62)
              : tuck
                ? tint(hairColor, 0.55)
                : whisker(col, row),
            s,
          ),
        );
      }
      grid.push(ids);
    }
    for (let row = 0; row <= rowsB; row++) {
      const hi = grid[row] as number[];
      const lo = grid[row + 1] as number[];
      for (let col = 0; col < cols; col++)
        b.quad(
          'hair',
          hi[col] as number,
          lo[col] as number,
          lo[col + 1] as number,
          hi[col + 1] as number,
        );
    }
  }

  const looseTex = texture !== undefined && LOOSE.has(style) ? TEXTURES[texture] : undefined;
  const looseLift = looseTex ? (style === 'afro' ? 0.5 : 1) * looseTex.add : 0;
  const surfaceApi: HumanHeadSurface = {
    W,
    L,
    baseY,
    shell(a, sign, t, offset) {
      const c = dmath.cos(a);
      const tt = dmath.max(0.12, t);
      const [rx, , back] = prof(tt);
      const lift = dmath.pow(dmath.clamp((tt - 0.62) / 0.38, 0, 1), 1.5);
      const across = dmath.sqrt(1 - lift * lift);
      const x = dmath.sin(a) * (rx + offset * across) * sign;
      const z =
        c >= 0
          ? frontZ(dmath.sin(a) * rx * sign, tt) + c * offset * across * W
          : c * (back + offset * across) * W;
      return [x * W, baseY + t * L + 0.009 * L + offset * lift * W, z];
    },
    hair(c, t) {
      if (style === 'none') return 0;
      let offset = hairOffset(style, c, t) + tierLift;
      if (looseTex)
        offset +=
          looseLift + looseTex.flare * dmath.smoothstep(dmath.clamp((0.55 - t) / 0.65, 0, 1));
      // Curls, ripples and lock ridges stand a few percent proud of the shell.
      return offset * 1.08 + 0.012;
    },
    faceZ: (x, t) => dmath.max(sampledFrontZ(x, t), W * noseZ(x, t)),
    halfWidth: (t) => prof(t)[0],
    eye: { x: eyeX, t: eyeT, scale: eyeScale },
    ear: earCenter,
    earLen: earHalf,
  };
  if (style === 'none') return surfaceApi;
  // Gathered hair (a bun, topknot or puffs) swells with its texture, a little.
  const gathered = texture ? 1 + 2 * TEXTURES[texture].add : 1;
  buildHairShell(style);
  if (style === 'ponytail') buildPonytail();
  if (style === 'bun') {
    // Under a hat the bun sits low at the nape, below the band.
    const bun: Vec3 = hat
      ? [0, baseY + (hatBand(hat, -1) - 0.12) * L, -(prof(hatBand(hat, -1) - 0.12)[2] + 0.14) * W]
      : [0, baseY + 0.8 * L, -0.66 * W];
    b.ellipsoid(
      'hair',
      bun,
      [0, 0.45, -1],
      [0.24 * W * gathered, 0.22 * W * gathered, 0.2 * W * gathered],
      near ? 14 : tier === 1 ? 8 : 6,
      near ? 8 : tier === 1 ? 4 : 3,
      s,
      tint(hairColor, 0.95),
    );
  }
  if (style === 'topknot' && !hat)
    b.ellipsoid(
      'hair',
      [0, baseY + 1.03 * L, -0.1 * W],
      [0, 1, -0.25],
      [0.2 * W * gathered, 0.19 * W * gathered, 0.2 * W * gathered],
      near ? 14 : tier === 1 ? 8 : 6,
      near ? 8 : tier === 1 ? 4 : 3,
      s,
      tint(hairColor, 0.95),
    );
  if (style === 'puffs' && !hat)
    for (const sideSign of [1, -1])
      b.ellipsoid(
        'hair',
        [sideSign * 0.44 * W, baseY + 0.97 * L, -0.06 * W],
        [sideSign * 0.8, 1, -0.1],
        [0.26 * W * gathered, 0.25 * W * gathered, 0.26 * W * gathered],
        near ? 12 : tier === 1 ? 7 : 5,
        near ? 7 : tier === 1 ? 4 : 2,
        s,
        tint(hairColor, 0.97),
      );
  // Braids and locks are strands: drawn near (braids at medium detail too), merged into the
  // shell's silhouette far off.
  if (style === 'braids' && tier < 2) {
    buildBraid(1);
    buildBraid(-1);
  }
  if (style === 'locs' && tier < 2) buildLocks();
  return surfaceApi;

  /** The scalp-following shell; a rolled edge where it hangs free of the skull. */
  function buildHairShell(style: FigureHairStyle): void {
    const long =
      style === 'long' ||
      style === 'bob' ||
      style === 'afro' ||
      style === 'shoulder' ||
      style === 'locs';
    // Under a hat the shell spans only its hairline to the band: half the rows do.
    const hairRows = hat
      ? near
        ? long
          ? 6
          : 4
        : tier === 1
          ? 3
          : 1
      : near
        ? long
          ? 12
          : 9
        : tier === 1
          ? long
            ? 6
            : 5
          : 3;
    const SKULL = 0.38;
    const banded = style === 'balding';
    // A texture changes loose hair only: its volume pushes the shell out, its ripple roughs the
    // silhouette (near only). An afro is already full, so it takes less of the volume.
    const tex = texture !== undefined && LOOSE.has(style) ? TEXTURES[texture] : undefined;
    // An afro is already full: it takes half of a texture's lift.
    const texLift = tex ? (style === 'afro' ? 0.5 : 1) * tex.add : 0;
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
        const top = banded
          ? dmath.lerp(
              dmath.lerp(0.6, 0.72, dmath.clamp(-c, 0, 1)),
              t0 + 0.01,
              dmath.smoothstep(dmath.clamp(c / 0.32, 0, 1)),
            )
          : 0.997;
        // Under a hat the shell ends just inside the band (all of it, where the hairline is higher).
        const t1 = hat ? dmath.max(t0, dmath.min(top, hatBand(hat, c) + 0.04)) : top;
        const hangs = t0 < SKULL && HANGING.has(style);
        const t = r < 0 ? t0 + (hangs ? 0.035 : 0) : dmath.lerp(t0, t1, 1 - (1 - f) * (1 - f));
        let offset = r < 0 ? (hangs ? -0.12 : -0.006) : hairOffset(style, c, t) + tierLift;
        if (style === 'afro' && r >= 0)
          offset = dmath.lerp(0.02, offset, dmath.smoothstep(dmath.clamp(f / 0.35, 0, 1)));
        if (tex !== undefined && r >= 0)
          offset += texLift + tex.flare * dmath.smoothstep(dmath.clamp((0.55 - t) / 0.65, 0, 1));
        // Close braided rows: a ridge, then a groove, around the head.
        if (style === 'rows' && near && r >= 0) offset += 0.012 * (0.5 + 0.5 * dmath.cos(a * 20));
        // Hanging styles fall straight below the skull; short ones follow the nape inward.
        const tt = HANGING.has(style) ? dmath.max(SKULL, t) : dmath.max(0.12, t);
        const [rx, , back] = prof(tt);
        // Toward the crown the scalp faces up, so part of the offset lifts the hair instead.
        const lift = dmath.pow(dmath.clamp((tt - 0.62) / 0.38, 0, 1), 1.5);
        const across = dmath.sqrt(1 - lift * lift);
        // Locks are small silhouette changes, not painted lighting.
        const afroCurl =
          style === 'afro' && near
            ? 1 + 0.035 * dmath.sin(a * 9 + t * 21) * dmath.sin(a * 5 - t * 13)
            : 1;
        const ripple =
          tex !== undefined && near && r >= 0 && tex.ripple > 0
            ? 1 +
              tex.ripple *
                dmath.sin(a * tex.freq[0] + t * tex.freq[1]) *
                dmath.sin(a * (tex.freq[0] - 2) - t * (tex.freq[1] - 6))
            : 1;
        const curl = afroCurl * ripple;
        // Locks: deep rope-like ridges; other styles a faint parting texture.
        const lock =
          near && r >= 0
            ? style === 'locs'
              ? 1 + 0.035 * dmath.cos(a * 16) * (1 - 0.5 * f)
              : 1 + 0.012 * dmath.cos(a * 12) * (1 - f)
            : 1;
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
            : style === 'mohawk'
              ? // Buzzed sides (as the buzz cut) under the full-colour ridge.
                mixColor(tint(hairColor, strand), skinColor, 0.3 * (1 - mohawkRidge(c)))
              : style === 'fade'
                ? // Skin shows through low on the sides, fading into the full top.
                  mixColor(
                    tint(hairColor, strand),
                    skinColor,
                    0.45 * (1 - dmath.smoothstep(dmath.clamp((t - 0.48) / 0.26, 0, 1))),
                  )
                : style === 'rows'
                  ? mixColor(
                      tint(hairColor, strand),
                      skinColor,
                      0.3 * (0.5 - 0.5 * dmath.cos(a * 20)),
                    )
                  : style === 'locs'
                    ? // The mass under the locks sits in their shade.
                      tint(hairColor, strand * 0.74)
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
        b.cap(
          'hair',
          ring,
          s,
          hairColor,
          hat ? [0, baseY + 0.97 * L, 0] : [0, baseY + 1.006 * L + hairOffset(style, 1, 1) * W, 0],
        );
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
          [0.2, 0.16],
          [0.35, 0.19],
          [0.55, 0.18],
          [0.75, 0.15],
          [0.9, 0.1],
          [1, 0.045],
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
      // Out from the back of the crown, over in a quarter turn, then down against the nape and
      // the back instead of standing clear of them.
      const t = dmath.lerp(0.7, -0.5, u);
      const y = baseY + t * L;
      const out =
        0.17 *
          dmath.sin(dmath.min(1, u * 2.4) * dmath.PI * 0.5) *
          (1 - 0.55 * dmath.smoothstep(dmath.clamp((u - 0.35) / 0.5, 0, 1))) +
        0.02 * u;
      const rest = t < 0.1 ? behind(0, y) + 0.12 * W : 0;
      return [0, y, -dmath.max((0.6 + out) * W, rest)];
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
      const wChest = 0.8 * dmath.smoothstep(dmath.clamp((u - 0.3) / 0.7, 0, 1));
      const weights = blend(s[0], 1 - wChest, chestJoint, wChest);
      const tie = near && (k === 1 || k === 2);
      const start = b.mark();
      for (let i = 0; i < ringSides; i++) {
        const angle = (dmath.TAU * i) / ringSides;
        // A tail lies flat: broader across the back than it is thick.
        const cx = dmath.cos(angle) * radius * 1.15,
          cy = dmath.sin(angle) * radius * 0.8;
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

  /**
   * How far behind the figure's axis the neck and back are at (x, y): the body's own surface when
   * the caller passes it, else an estimate from the metrics (neck under the skull, widening to
   * the shoulder blades).
   */
  function behind(x: number, y: number): number {
    if (back) return back(x, y);
    const down = dmath.smoothstep(dmath.clamp((baseY - y) / (0.8 * L), 0, 1));
    return dmath.lerp(0.46 * W, m.torsoRadius * 0.98, down);
  }

  /**
   * A hanging strand along `path` (figure space, u from 0 at the head to 1 at the tip): rings
   * framed by parallel transport so it never twists, blending from the head joint toward the
   * chest by up to `chestMax`, so it stays on the back when the head turns. `turn` rotates each
   * ring about the strand (a rope's or a plait's twist).
   */
  function strand(
    path: (u: number) => Vec3,
    stations: readonly number[],
    radiusAt: (u: number) => number,
    ringSides: number,
    colorAt: (u: number, angle: number) => RGB,
    chestMax: number,
    turn: (u: number) => number = () => 0,
  ): void {
    let tangent: Vec3 | undefined;
    let prev: RingRef | undefined;
    for (let k = 0; k < stations.length; k++) {
      const u = stations[k] as number;
      const p = path(u);
      const q = path(dmath.min(1, u + 0.02));
      const o = path(dmath.max(0, u - 0.02));
      const dl = dmath.hypot(q[0] - o[0], q[1] - o[1], q[2] - o[2]) || 1;
      const dir: Vec3 = [(q[0] - o[0]) / dl, (q[1] - o[1]) / dl, (q[2] - o[2]) / dl];
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
      const radius = radiusAt(u);
      const w = chestMax * dmath.smoothstep(dmath.clamp((u - 0.15) / 0.6, 0, 1));
      const weights = blend(s[0], 1 - w, chestJoint, w);
      const phase = turn(u);
      const start = b.mark();
      for (let i = 0; i < ringSides; i++) {
        const angle = (dmath.TAU * i) / ringSides + phase;
        const cx = dmath.cos(angle) * radius,
          cy = dmath.sin(angle) * radius;
        b.vertex(
          [
            p[0] + tangent[0] * cx + up[0] * cy,
            p[1] + tangent[1] * cx + up[1] * cy,
            p[2] + tangent[2] * cx + up[2] * cy,
          ],
          colorAt(u, angle),
          weights,
        );
      }
      const ring = { start, sides: ringSides, center: p };
      if (prev) b.loft('hair', prev, ring);
      else b.cap('hair', ring, weights, colorAt(u, 0), undefined, false);
      if (k === stations.length - 1)
        b.cap('hair', ring, weights, colorAt(u, 0), [p[0], p[1] - radius, p[2]]);
      prev = ring;
    }
  }

  /**
   * A braid: it leaves the hair low behind the ear, where it starts inside the shell, drops past
   * the nape, lies on the shoulder and the back, and ends in a tie and a short tuft.
   */
  function buildBraid(sideSign: number): void {
    const count = near ? 15 : 6;
    const stations = Array.from({ length: count + 1 }, (_, i) => i / count);
    const thick = 0.084 * W;
    const root = surfaceApi.shell(2.2, sideSign, 0.36, -0.02);
    const points: Vec3[] = [
      root,
      [sideSign * 0.34 * W, baseY + 0.16 * L, -0.5 * W],
      [sideSign * 0.37 * W, baseY - 0.2 * L, 0],
      [sideSign * 0.37 * W, baseY - 0.75 * L, 0],
      [sideSign * 0.35 * W, baseY - 1.25 * L, 0],
    ];
    // Below the collar it rests on the body: its own half-thickness off the back, and out over a
    // backpack from just above its top.
    for (let k = 2; k < points.length; k++) {
      const p = points[k] as Vec3;
      const over = pack
        ? pack.depth * dmath.smoothstep(dmath.clamp((pack.y + 0.15 * L - p[1]) / (0.3 * L), 0, 1))
        : 0;
      p[2] = -(behind(p[0], p[1]) + thick * 0.9 + over);
    }
    /** A Catmull-Rom curve through the points. */
    const path = (u: number): Vec3 => {
      const f = dmath.clamp(u, 0, 1) * (points.length - 1);
      const k = dmath.min(points.length - 2, dmath.floor(f));
      const v = f - k;
      const p0 = points[dmath.max(0, k - 1)] as Vec3;
      const p1 = points[k] as Vec3;
      const p2 = points[k + 1] as Vec3;
      const p3 = points[dmath.min(points.length - 1, k + 2)] as Vec3;
      const out: Vec3 = [0, 0, 0];
      for (let c = 0; c < 3; c++) {
        const a = p0[c] as number,
          bb = p1[c] as number,
          cc = p2[c] as number,
          dd = p3[c] as number;
        out[c] =
          0.5 *
          (2 * bb +
            (cc - a) * v +
            (2 * a - 5 * bb + 4 * cc - dd) * v * v +
            (3 * bb - a - 3 * cc + dd) * v * v * v);
      }
      return out;
    };
    const accent = tint(parseColor(d.palette.accent), 0.8);
    const tie = (u: number): boolean => u > 0.84 && u < 0.92;
    strand(
      path,
      stations,
      // Plaited: it swells and pinches along its length, pinched hard under the tie.
      (u) =>
        thick *
        dmath.lerp(1, 0.7, u) *
        (tie(u) ? 0.62 : u > 0.92 ? 0.85 : near ? 1 + 0.2 * dmath.cos(u * count * dmath.PI) : 1),
      near ? 6 : 5,
      (u, angle) => (tie(u) ? accent : tint(hairColor, 0.92 + 0.1 * dmath.sin(angle * 2 + u * 40))),
      0.9,
      // Each ring turned against the last, so the facets cross like plaited strands.
      near ? (u) => (dmath.round(u * count) % 2) * (dmath.PI / 6) : undefined,
    );
  }

  /**
   * Rope-like locks: each starts on the shell high on the head, runs down it as a ridge, and
   * hangs free below the skull to the shoulders, clear of the back.
   */
  function buildLocks(): void {
    const count = near ? 14 : 8;
    const radius = (near ? 0.052 : 0.06) * W;
    const stations = near ? [0, 0.2, 0.42, 0.62, 0.82, 1] : [0, 0.45, 0.75, 1];
    for (let n = 0; n < count; n++) {
      // From in front of one ear round the back to the other, symmetric about the middle.
      const a = dmath.lerp(0.36 * dmath.PI, 1.64 * dmath.PI, (n + 0.5) / count);
      const sign = a <= dmath.PI ? 1 : -1;
      const fold = a <= dmath.PI ? a : dmath.TAU - a;
      const mirror = dmath.min(n, count - 1 - n);
      const end = -0.24 - 0.07 * (mirror % 3);
      const path = (u: number): Vec3 => {
        const t = dmath.lerp(0.88, end, u);
        const p = surfaceApi.shell(fold, sign, t, hairOffset(style, dmath.cos(fold), t) - 0.014);
        // Hanging free it clears the neck and the back.
        if (t < 0.38) {
          const clear = behind(p[0], p[1]) + radius * 1.2;
          if (p[2] > -clear && dmath.cos(fold) < 0) {
            const k = dmath.smoothstep(dmath.clamp(-dmath.cos(fold) / 0.5, 0, 1));
            p[2] = dmath.lerp(p[2], dmath.min(p[2], -clear), k);
          }
        }
        return p;
      };
      strand(
        path,
        stations,
        // Each rises out of the shell from nothing, so no cut end shows on the crown.
        (u) => radius * dmath.lerp(0.2, 1, dmath.min(1, u / 0.2)) * dmath.lerp(1, 0.74, u),
        near ? 5 : 4,
        (u, angle) => tint(hairColor, (0.9 + 0.1 * dmath.sin(angle * 3 + n)) * (1 - 0.1 * u)),
        0.6,
      );
    }
  }
}
