/** Human geometry on the canonical skeleton, with continuous skinned shoulder and hip surfaces. */
import { dmath, quatRotateVec3, type Vec3 } from '@bendyline/molen-kernel/determinism';
import { jointIndex, jointPosition } from './body';
import {
  backpackShape,
  buildBodyAccessories,
  buildHeadAccessories,
} from './body-human-accessories';
import {
  BOOT_SHAFT,
  buildHumanHand,
  buildHumanShoe,
  type HumanShoeStyle,
} from './body-human-extremities';
import {
  type LegRadii,
  legwearBareFrom,
  legwearOverBoot,
  legwearSection,
  topSpec,
} from './body-human-garments';
import { buildHumanHead, humanHeadFrame, tint } from './body-human-head';
import { parseColor, type RGB } from './color';
import { forearmRoll, REST_FOREARM_ROLL } from './hand-rest';
import { FIGURE_FORMS } from './proportions';
import { type FigureRig, mirrorName, rigBindModel } from './rig';
import {
  blend,
  type FigureRegion,
  type FigureTier,
  type RingRef,
  type Skin,
  type SkinnedMeshBuilder,
  skin,
} from './skinned-mesh-builder';
import type { ResolvedFigureDescriptor } from './types';

const UP: Vec3 = [0, 1, 0];
const mix = (a: Vec3, b: Vec3, t: number): Vec3 => [
  dmath.lerp(a[0], b[0], t),
  dmath.lerp(a[1], b[1], t),
  dmath.lerp(a[2], b[2], t),
];
const direction = (a: Vec3, b: Vec3): Vec3 => {
  const l = dmath.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  return [(b[0] - a[0]) / l, (b[1] - a[1]) / l, (b[2] - a[2]) / l];
};

/**
 * One horizontal section of the trunk. The outline is a superellipse (`n` 2 is an ellipse, more
 * is squarer: a ribcage is a rounded box, not a tube) `rx` to each side of the axis, `zf` in
 * front of its centre and `zb` behind it, so the chest can stand forward of a hollow back and
 * the seat behind the hips.
 */
interface Section {
  y: number;
  rx: number;
  zf: number;
  zb: number;
  s: Skin;
  /** Bust or pectoral swell of the row, of stature (lower tiers may skip that row). */
  swell: number;
  /** The centre's offset in z. */
  zc: number;
  n: number;
  /** How much of the neck line's rise toward the nape (and its lean) the row takes, 0 to 1. */
  rise: number;
}

/** Squareness of the trunk's sections. */
const TRUNK_N = 2.3;

/** A unit-circle coordinate on a superellipse of exponent `n`. */
const squared = (u: number, n: number): number =>
  n === 2 ? u : dmath.sign(u) * dmath.pow(dmath.abs(u), 2 / n);

/** A superellipse's depth (of its half-depth) at `across` (of its half-width). */
const depthAt = (across: number, n: number): number =>
  dmath.pow(dmath.max(0, 1 - dmath.pow(across, n)), 1 / n);

/**
 * The leg by station (`t`: 0 hip joint, 1 knee, 2 ankle): radii to the outside, the inside, the
 * front and the back in limb radii, and how far forward of the joint line its centre lies. Fitted
 * to adult girths (thigh 0.31, knee 0.22, calf 0.21, ankle 0.13 of stature around): the thigh is
 * fullest in front, the knee carries the kneecap, the calf lies behind a straight shin. The first
 * row's outside and inside come from the hips (see `thighTop`).
 */
const LEG: readonly (readonly [number, number, number, number, number, number])[] = [
  [0.27, 1.22, 1.5, 1.5, 1.62, 0],
  [0.48, 1.22, 1.3, 1.45, 1.34, 0.04],
  [0.78, 1.0, 1.03, 1.14, 1.03, 0.03],
  [1, 0.93, 0.94, 1.04, 0.9, 0],
  [1.1, 0.9, 0.92, 0.92, 0.96, -0.02],
  [1.32, 0.98, 1, 0.8, 1.26, -0.03],
  [1.6, 0.82, 0.82, 0.72, 0.98, -0.03],
  [1.86, 0.62, 0.62, 0.64, 0.74, -0.01],
  [2.06, 0.58, 0.58, 0.68, 0.7, 0],
];

export function buildBipedBody(
  d: ResolvedFigureDescriptor,
  rig: FigureRig,
  tier: FigureTier,
  b: SkinnedMeshBuilder,
): void {
  const m = rig.metrics;
  const H = d.height;
  const near = tier === 0;
  const sides = near ? 20 : tier === 1 ? 12 : 8;
  const limbSides = near ? 12 : 8;
  const bind = rigBindModel(rig);
  const J = (name: string): number => jointIndex(rig, name);
  const P = (name: string): Vec3 => jointPosition(bind, J(name));
  const c = {
    skin: parseColor(d.palette.skin),
    top: parseColor(d.palette.top),
    bottom: parseColor(d.palette.bottom),
    shoes: parseColor(d.palette.shoes),
    accent: parseColor(d.palette.accent),
  };
  // The top (absent: the button shirt, drawn exactly as before). An outer layer (a jacket or
  // coat) colors the torso and sleeves with `palette.outer`; the shirt shows down its open front.
  const top = topSpec(d.features.top);
  const garment = top.outer ? parseColor(d.palette.outer ?? d.palette.top) : c.top;
  const dress = top.hem === 'skirt';
  const hips = P('hips'),
    spine = P('spine'),
    chest = P('chest'),
    neck = P('neck'),
    head = P('head');
  const form = FIGURE_FORMS[d.features.form] ?? FIGURE_FORMS.neutral;
  // The hip measure the waist rows are fitted to: about 0.1 of stature to each side.
  const pelvis = m.hipHalf / 0.9 + m.limbRadius * 1.1;
  // About 0.072 of stature across (a 39 cm collar on a 1.75 m adult); a thinner neck read as
  // a stalk under the head.
  const neckR = 0.036 * H * form.neck * (1 + 0.15 * d.build);
  // Upper arms are slimmer than thighs: about 0.3 m around a 1.75 m adult's sleeve.
  const armR = m.limbRadius * 0.84 * form.arm;
  const waistSkin = blend(J('hips'), 0.55, J('spine'), 0.45);
  const chestSkin = skin(J('chest'));
  // Body-shape proportions (each exactly neutral when absent): a narrower or wider waist, a
  // fuller belly, and fuller hips, seat and thighs.
  const waistK = d.proportions.waist ?? 1;
  const belly = d.proportions.belly ?? 0;
  const seatK = d.proportions.seat ?? 1;
  // Half the chest's depth; the belly stands out in front of the waist, not behind it.
  const depth = m.torsoRadius;
  const waistRx = pelvis * 0.92 * dmath.lerp(1, form.waist, 0.4) * waistK;
  const waistZf = depth * 0.85 * (1 + 0.3 * belly);
  const waistZb = depth * 0.69 * (1 + 0.05 * belly);
  // The waistband's top edge, where a tucked top ends: 0.578 of stature, on the hips. At 0.6
  // (the navel) trousers read as worn high and the legs as starting there.
  const waistTop = hips[1] + m.hipsLen * 0.83;
  const shoulderY = neck[1] - H * 0.014;
  // The neck leaves the torso on a slanted line: the sternal notch in front, the trapezius at
  // the sides and the seventh vertebra behind, about level with the chin (0.83, 0.85 and 0.865
  // of stature). A level neck base left a 9 cm column under the skull from behind.
  const neckBaseY = neck[1] + H * 0.005;
  const neckRise = H * 0.036;
  // The neck sits toward the back of the shoulders and leans forward up to the skull.
  const neckSet = -H * 0.011;
  /** Height of the neck line above its front at a normalized depth (1 front, -1 back). */
  const neckLift = (zn: number): number =>
    neckRise * dmath.pow(dmath.clamp((1 - zn) / 2, 0, 1), 0.8);
  // The neck tapers a little and leans forward from its set-back base to under the skull,
  // ending inside the head above the jaw angle.
  const neckTopY = head[1] + m.headLen * 0.28;
  const neckCenterZ = (y: number): number =>
    neckSet * dmath.clamp((neckTopY - y) / (neckTopY - neckBaseY), 0, 1);
  /**
   * How far forward the neck line lies where it has risen by `lift`: it leans with the neck, so
   * a collar hugs the nape instead of standing off it.
   */
  const neckLean = (lift: number): number => neckCenterZ(neckBaseY + lift) - neckSet;
  /** Ring column → [x, z] on the unit circle, in the builder's ring order (folded for symmetry). */
  const fold = (col: number, count: number): [number, number] => {
    let k = col;
    const zSign = k <= count / 2 ? 1 : -1;
    if (k > count / 2) k = count - k;
    const xSign = k <= count / 4 ? -1 : 1;
    if (k > count / 4) k = count / 2 - k;
    const angle = (dmath.TAU * k) / count;
    return [xSign * dmath.cos(angle), zSign * dmath.sin(angle)];
  };
  /** A ring around the neck that follows the slanted neck line. */
  const neckLine = (y: number, rx: number, rz: number, s: Skin, color: RGB): RingRef => {
    const start = b.mark();
    for (let i = 0; i < sides; i++) {
      const [x, z] = fold(i, sides);
      const lift = neckLift(z);
      b.vertex([x * rx, y + lift, z * rz + neckSet + neckLean(lift)], color, s);
    }
    return { start, sides, center: [0, y, neckSet] };
  };
  const section = (
    y: number,
    rx: number,
    zf: number,
    zb: number,
    s: Skin,
    swell = 0,
    zc = 0,
    n = TRUNK_N,
    rise = 0,
  ): Section => ({ y, rx, zf, zb, s, swell, zc, n, rise });
  /** A trunk ring on a section scaled by `k`, in the torso's column order. */
  const trunkRing = (
    sec: Section,
    color: RGB,
    k = 1,
    skinAt?: (x: number, ux: number) => Skin,
  ): RingRef => {
    const start = b.mark();
    for (let i = 0; i < sides; i++) {
      const [ux, uz] = fold(i, sides);
      const x = squared(ux, sec.n) * sec.rx * k;
      const z = sec.zc + squared(uz, sec.n) * (uz >= 0 ? sec.zf : sec.zb) * k;
      b.vertex([x, sec.y, z], color, skinAt ? skinAt(x, ux) : sec.s);
    }
    return { start, sides, center: [0, sec.y, sec.zc] };
  };
  // A hem over the waist hides the belt; a dress's belt is a seam in its own color.
  const covered = top.hem === 'band' || top.hem === 'hip' || top.hem === 'thigh';
  const beltColor = dress ? tint(c.top, 0.8) : tint(c.shoes, 0.7);

  // Waistband, waist, chest, pectoral line, armpit, shoulder line, trapezius and neck base.
  // Widths follow adult means: chest about 0.19 of stature across and 0.135 deep, waist 0.18
  // across and 0.11 deep, the arms outside them. From the side the chest stands forward of the
  // belly, the shoulder blades behind a hollow lower back: a standing spine, not a board. The
  // ribcage narrows under the arms, so a hanging arm lies beside it instead of inside it.
  const rowsAll: readonly (readonly [string, Section])[] = [
    ['waist', section(waistTop, waistRx, waistZf, waistZb, waistSkin)],
    [
      'belly',
      section(
        spine[1] + m.spineLen * 0.4,
        pelvis * 0.89 * form.waist * waistK,
        depth * 0.86 * (1 + 0.42 * belly),
        depth * 0.66 * (1 + 0.08 * belly),
        blend(J('spine'), 0.8, J('chest'), 0.2),
      ),
    ],
    [
      'chest',
      section(
        chest[1],
        m.shoulderHalf * 0.94,
        depth * 0.97 * (1 + 0.14 * belly),
        depth * 0.82,
        blend(J('spine'), 0.35, J('chest'), 0.65),
        0.012,
      ),
    ],
    [
      'pectoral',
      section(
        chest[1] + m.chestLen * 0.35,
        m.shoulderHalf * 0.96,
        depth * 1.03,
        depth * 0.94,
        blend(J('spine'), 0.1, J('chest'), 0.9),
        0.026,
      ),
    ],
    [
      'armpit',
      section(
        chest[1] + m.chestLen * 0.65,
        m.shoulderHalf * 0.91,
        depth * 0.95,
        depth * 0.97,
        chestSkin,
        0.009,
      ),
    ],
    // The shoulder line: its ends are the points of the shoulders, over the joints.
    ['shoulder', section(shoulderY, m.shoulderHalf * 1.1, depth * 0.68, depth * 0.8, chestSkin)],
    // The trapezius falls steeply off the neck, then flattens toward the shoulder.
    [
      'trapezius',
      section(
        dmath.lerp(shoulderY, neckBaseY, 0.55),
        dmath.lerp(m.shoulderHalf * 1.1, neckR * 1.2, 0.65),
        dmath.lerp(depth * 0.68, neckR * 1.1, 0.6),
        dmath.lerp(depth * 0.8, neckR * 1.1, 0.45),
        chestSkin,
        0,
        neckSet * 0.7,
        (TRUNK_N + 2) / 2,
        0.7,
      ),
    ],
    [
      'neck',
      section(neckBaseY, neckR * 1.2, neckR * 1.1, neckR * 1.1, chestSkin, 0, neckSet, 2, 1),
    ],
  ];
  // A bust (feminine adults) or a slight pectoral swell, peaking at 0.45 of the half-width. The
  // `bust` proportion sets it apart from the body form.
  const bust =
    d.age === 'child' ? 0 : (d.proportions.bust ?? (d.features.form === 'feminine' ? 1 : 0.25));
  // The pectoral row carries the swell (medium detail keeps it only for a bust); the trapezius
  // row is near detail.
  const tierRows = rowsAll.filter(
    ([name]) =>
      (name !== 'pectoral' || tier === 0 || (tier === 1 && bust >= 1)) &&
      (name !== 'trapezius' || near),
  );
  // A looser top stands off the body: its full ease below the shoulders, half at the shoulder
  // line, less up the trapezius and none at the neck (exactly the body when fitted).
  const torso: readonly Section[] = tierRows.map(([name, sec]): Section => {
    if (top.ease === 1) return sec;
    const k =
      name === 'neck'
        ? 1
        : name === 'trapezius'
          ? (3 + top.ease) / 4
          : name === 'shoulder'
            ? (1 + top.ease) / 2
            : top.ease;
    return { ...sec, rx: sec.rx * k, zf: sec.zf * k, zb: sec.zb * k };
  });
  const ARMPIT = tierRows.findIndex(([name]) => name === 'armpit');
  const SHOULDER = ARMPIT + 1;
  const NECK_ROW = torso.length - 1;
  const row = (index: number): Section => torso[index] as Section;
  const bulge = (index: number, across: number): number => {
    const k = (across - 0.45) / 0.27;
    return bust * (torso[index]?.swell ?? 0) * H * dmath.exp(-k * k);
  };
  /** A row's rise above its own height and its lean forward, where the unit-circle z is `uz`. */
  const rowLift = (sec: Section, uz: number): [number, number] => {
    if (sec.rise === 0) return [0, 0];
    const lift = neckLift(uz);
    return [sec.rise * lift, sec.rise * neckLean(lift)];
  };
  let last: RingRef | undefined;
  const torsoRings: RingRef[] = [];
  const shoulderWidth = near ? 2 : 1;
  const torsoPoint = (index: number, col: number): Vec3 => {
    const sec = row(index);
    const [ux, uz] = fold(col, sides);
    const c0 = dmath.abs(ux);
    // The armpit sits a little below its row; the points of the shoulders a little above theirs.
    const side =
      index === ARMPIT
        ? -H * 0.01 * dmath.pow(c0, 8)
        : index === SHOULDER
          ? H * 0.003 * dmath.pow(c0, 4)
          : 0;
    const [lift, lean] = rowLift(sec, uz);
    const X = squared(ux, sec.n);
    const Z = squared(uz, sec.n);
    const z = sec.zc + (uz >= 0 ? sec.zf * Z + bulge(index, dmath.abs(X)) : sec.zb * Z);
    return [X * sec.rx, sec.y + side + lift, z + lean];
  };
  // The torso as drawn, column by column from the middle out to the side, in front and behind:
  // what lies on it (collars, plackets, pockets, an open jacket's shirt, straps, hair) follows
  // these facets. The smooth outline the columns sample stands inside the facets wherever it is
  // hollow (beside a bust, toward the neck), and anything laid on it there sank into them.
  const quarter = sides / 4;
  const frontCols: Vec3[][] = torso.map((_, index) =>
    Array.from({ length: quarter + 1 }, (__, k) => torsoPoint(index, quarter + k)),
  );
  const backCols: Vec3[][] = torso.map((_, index) =>
    Array.from({ length: quarter + 1 }, (__, k) => torsoPoint(index, 3 * quarter - k)),
  );
  /** A point of a row's drawn outline at |x|: [height, depth], between its two nearest columns. */
  const onRow = (cols: readonly Vec3[], ax: number): [number, number] => {
    for (let k = 1; k < cols.length; k++) {
      const a = cols[k - 1] as Vec3;
      const e = cols[k] as Vec3;
      if (ax > e[0] && k < cols.length - 1) continue;
      const f = e[0] > a[0] ? dmath.clamp((ax - a[0]) / (e[0] - a[0]), 0, 1) : 0;
      return [dmath.lerp(a[1], e[1], f), dmath.lerp(a[2], e[2], f)];
    }
    return [0, 0];
  };
  /**
   * The drawn surface at (|x|, y), in front or behind: the depth z. Between two rows the loft
   * joins points of equal column, so the point lies a fraction `t` up one strip of quads; solving
   * for `t` keeps a point wider than the narrower row (near the neck) on the slope between them.
   */
  const onTorso = (cols: readonly Vec3[][], ax: number, y: number): number => {
    for (let i = 1; i < cols.length; i++) {
      const low = cols[i - 1] as Vec3[];
      const high = cols[i] as Vec3[];
      const at = (t: number): [number, number] => {
        for (let k = 1; k < low.length; k++) {
          const a = dmath.lerp((low[k - 1] as Vec3)[0], (high[k - 1] as Vec3)[0], t);
          const e = dmath.lerp((low[k] as Vec3)[0], (high[k] as Vec3)[0], t);
          if (ax > e && k < low.length - 1) continue;
          const f = e > a ? dmath.clamp((ax - a) / (e - a), 0, 1) : 0;
          const mixed = (axis: number): number =>
            dmath.lerp(
              dmath.lerp((low[k - 1] as Vec3)[axis] as number, (low[k] as Vec3)[axis] as number, f),
              dmath.lerp(
                (high[k - 1] as Vec3)[axis] as number,
                (high[k] as Vec3)[axis] as number,
                f,
              ),
              t,
            );
          return [mixed(1), mixed(2)];
        }
        return [0, 0];
      };
      if (y > at(1)[0] && i < cols.length - 1) continue;
      let t0 = 0,
        t1 = 1;
      for (let step = 0; step < 24; step++) {
        const mid = (t0 + t1) / 2;
        if (at(mid)[0] < y) t0 = mid;
        else t1 = mid;
      }
      return at((t0 + t1) / 2)[1];
    }
    return 0;
  };
  /** Front surface depth of a torso row at x (shirt details sit on it). */
  const rowFront = (index: number, x: number): number =>
    onRow(frontCols[index] as Vec3[], dmath.abs(x))[1];
  for (const [index, sec] of torso.entries()) {
    const start = b.mark();
    for (let i = 0; i < sides; i++) b.vertex(torsoPoint(index, i), garment, sec.s);
    const ring = { start, sides, center: [0, sec.y, 0] as Vec3 };
    if (last) {
      for (let i = 0; i < sides; i++) {
        const armhole =
          index === SHOULDER &&
          (i < shoulderWidth ||
            i >= sides - shoulderWidth ||
            (i >= sides / 2 - shoulderWidth && i < sides / 2 + shoulderWidth));
        if (armhole) continue;
        const next = (i + 1) % sides;
        b.quad('top', last.start + i, last.start + next, ring.start + next, ring.start + i);
      }
    }
    torsoRings.push(ring);
    last = ring;
  }
  // The armholes are actual boundaries in the torso's sides, between the armpit and the shoulder
  // line: set-in sleeves share these vertices and their normals, so no overlapping cap can form
  // a shoulder-pad seam, and the yoke from shoulder to neck stays whole. The loop runs as an arm
  // ring does: the point of the shoulder, forward along the shoulder line, down and back under
  // the arm, and up behind.
  const boundary: [number, number][] = [];
  const middle = sides / 2;
  for (let i = middle; i >= middle - shoulderWidth; i--) boundary.push([SHOULDER, i]);
  for (let i = middle - shoulderWidth; i <= middle + shoulderWidth; i++) boundary.push([ARMPIT, i]);
  for (let i = middle + shoulderWidth; i > middle; i--) boundary.push([SHOULDER, i]);
  const armSides = boundary.length;
  const shoulderLeft = boundary.map(([r, col]) => (torsoRings[r] as RingRef).start + col);
  const shoulderRight = boundary.map(
    ([r, col]) => (torsoRings[r] as RingRef).start + ((sides / 2 - col + sides) % sides),
  );
  const shoulderPoints: Vec3[] = boundary.map(([r, col]) => torsoPoint(r, col));
  const collarSkin = blend(J('chest'), 0.8, J('neck'), 0.2);
  if (top.collar === 'hood') {
    // A hood lies folded around the neck: in front it is no more than the collar band; toward
    // the back it swells into a thick roll that rises with the neck line, then closes onto the
    // neck.
    const hood = tint(garment, 0.9);
    /** A ring between front radii and back radii (times neckR), lifted toward the back. */
    const hoodLine = (
      y: number,
      front: readonly [number, number],
      back: readonly [number, number],
      rise: number,
      s: Skin,
      color: RGB,
    ): RingRef => {
      const start = b.mark();
      for (let i = 0; i < sides; i++) {
        const [x, z] = fold(i, sides);
        const f = dmath.smoothstep(dmath.clamp(((1 - z) / 2) * 1.4, 0, 1));
        const rx = neckR * dmath.lerp(front[0], back[0], f);
        const rz = neckR * dmath.lerp(front[1], back[1], f);
        b.vertex(
          [x * rx, y + neckLift(z) + rise * f, z * rz + neckSet + neckLean(neckLift(z))],
          color,
          s,
        );
      }
      return { start, sides, center: [0, y, neckSet] };
    };
    const h0 = hoodLine(neckBaseY - H * 0.004, [1.24, 1.14], [1.55, 1.22], 0, chestSkin, hood);
    const h1 = hoodLine(
      neckBaseY + H * 0.001,
      [1.2, 1.1],
      [1.78, 1.62],
      H * 0.01,
      collarSkin,
      tint(garment, 0.97),
    );
    const h2 = hoodLine(
      neckBaseY + H * 0.005,
      [1.12, 1.03],
      [1.42, 1.38],
      H * 0.02,
      collarSkin,
      hood,
    );
    const h3 = neckLine(
      neckBaseY + H * 0.006,
      neckR * 1.08,
      neckR * 1.0,
      collarSkin,
      tint(garment, 0.6),
    );
    b.loft('top', h0, h1);
    b.loft('top', h1, h2);
    b.loft('top', h2, h3);
  } else {
    const collar0 = neckLine(
      neckBaseY - H * 0.003,
      neckR * 1.23,
      neckR * 1.13,
      chestSkin,
      tint(garment, 0.72),
    );
    const collar1 = neckLine(
      neckBaseY + H * 0.005,
      neckR * 1.12,
      neckR * 1.03,
      collarSkin,
      tint(garment, 0.72),
    );
    b.loft('top', collar0, collar1);
  }
  /** The shirt's front surface at (x, y), between torso rows. */
  const shirtFront = (x: number, y: number): number => {
    for (let i = 1; i < torso.length; i++) {
      const low = row(i - 1);
      const high = row(i);
      if (y > high.y && i < torso.length - 1) continue;
      const t = dmath.clamp((y - low.y) / (high.y - low.y), 0, 1);
      return dmath.lerp(rowFront(i - 1, x), rowFront(i, x), t) + H * 0.004;
    }
    return neckR;
  };
  if (tier < 2 && top.collar === 'shirt') {
    // Subdivide the collar over the curved shoulders so its center cannot clip through.
    for (const side of [-1, 1]) {
      const grid: number[][] = [];
      for (let r = 0; r <= 4; r++) {
        const v = r / 4;
        const ids: number[] = [];
        for (let col = 0; col <= 4; col++) {
          const u = col / 4;
          const x =
            side *
            dmath.lerp(
              dmath.lerp(H * 0.004, neckR * 0.85, u),
              dmath.lerp(m.shoulderHalf * 0.22, m.shoulderHalf * 0.4, u),
              v,
            );
          // The top edge follows the slanted collar line.
          const across = dmath.clamp(dmath.abs(x) / (neckR * 1.2), 0, 1);
          const y =
            neckBaseY +
            H * dmath.lerp(0.001, dmath.lerp(-0.039, -0.024, u), v) +
            (1 - v) * neckLift(dmath.sqrt(1 - across * across));
          ids.push(b.vertex([x, y, shirtFront(x, y)], tint(c.top, 1.08), chestSkin));
        }
        grid.push(ids);
      }
      for (let r = 0; r < 4; r++) {
        const high = grid[r] as number[];
        const low = grid[r + 1] as number[];
        for (let col = 0; col < 4; col++) {
          const a = high[col] as number,
            c0 = high[col + 1] as number;
          const e = low[col + 1] as number,
            f = low[col] as number;
          if (side > 0) b.quad('top', f, e, c0, a);
          else b.quad('top', a, c0, e, f);
        }
      }
    }
  }
  /** The torso's front at (x, y), on the drawn surface itself (see onTorso). */
  const frontAt = (x: number, y: number): number => onTorso(frontCols, dmath.abs(x), y);
  /** Skin of the chest front at a height (as the pockets': more spine lower down). */
  const frontSkin = (y: number): Skin => {
    const t = dmath.clamp((y - chest[1]) / (m.chestLen * 0.65), 0, 1);
    const weight = 0.35 * (1 - t);
    return blend(J('spine'), weight, J('chest'), 1 - weight);
  };
  /**
   * A patch over the torso front: rows top to bottom, columns left to right (increasing x),
   * each point given by `at` and colored by `color`; faces outward.
   */
  const sheet = (
    rows: number,
    cols: number,
    at: (r: number, col: number) => Vec3,
    color: (r: number, col: number) => RGB,
  ): void => {
    let high: number[] | undefined;
    for (let r = 0; r <= rows; r++) {
      const ids: number[] = [];
      for (let k = 0; k <= cols; k++) {
        const p = at(r, k);
        ids.push(b.vertex(p, color(r, k), frontSkin(p[1])));
      }
      if (high)
        for (let k = 0; k < cols; k++)
          b.quad(
            'top',
            ids[k] as number,
            ids[k + 1] as number,
            high[k + 1] as number,
            high[k] as number,
          );
      high = ids;
    }
  };
  /**
   * Row heights (top down) for a patch between two heights: the torso's own rows inside the
   * span (a straight span across a row's kink would sink under it) plus `steps` even rows.
   */
  const patchRows = (topY: number, bottomY: number, steps: number): number[] => {
    const heights = [topY, bottomY];
    for (const sec of torso) if (sec.y > bottomY && sec.y < topY) heights.push(sec.y);
    for (let r = 1; r < steps; r++) heights.push(dmath.lerp(topY, bottomY, r / steps));
    heights.sort((a, b2) => b2 - a);
    return heights.filter((y, i) => i === 0 || (heights[i - 1] as number) - y > H * 0.004);
  };
  if (top.collar === 'lapel') {
    // An open front: the shirt shows in a V from the collar to the top button, framed by
    // lapels in the outer color.
    const vY = spine[1] + m.spineLen * 0.5;
    const topY = neckBaseY - H * 0.004;
    const ys = patchRows(topY, vY, near ? 6 : 1);
    const rows = ys.length - 1;
    const yAt = (r: number): number => ys[r] as number;
    const openAt = (y: number): number =>
      neckR * 1.2 * dmath.pow(dmath.clamp((y - vY) / (topY - vY), 0, 1), 0.7);
    const cols = near ? 4 : 2;
    // Over a bust the torso's quads twist, and their two triangles stand up to this far off the
    // surface between their corners.
    const twist = H * 0.0024 * dmath.min(bust, 1.5);
    sheet(
      rows,
      cols,
      (r, k) => {
        const y = yAt(r);
        const x = dmath.lerp(-openAt(y), openAt(y), k / cols);
        return [x, y, frontAt(x, y) + H * 0.0015 + twist];
      },
      () => c.top,
    );
    if (near) {
      // Lapels roll off the front: their fold edge stands out and catches the light, their
      // outer edge lies flat in shadow. Further away the open front alone carries the shape.
      const lapel = tint(garment, 1.14);
      const widthAt = (v: number): number =>
        neckR * (0.6 + 0.9 * dmath.min(1, v / 0.3)) * dmath.pow(1 - v, 0.6);
      for (const side of [-1, 1]) {
        sheet(
          rows,
          2,
          (r, k) => {
            const y = yAt(r);
            const inner = openAt(y);
            const u = side > 0 ? k / 2 : 1 - k / 2;
            const x = side * (inner + widthAt((topY - y) / (topY - vY)) * u);
            return [x, y, frontAt(x, y) + H * (0.002 + 0.005 * (1 - u)) + twist];
          },
          (_, k) => {
            const u = side > 0 ? k / 2 : 1 - k / 2;
            return u === 1 ? tint(garment, 0.72) : lapel;
          },
        );
      }
      const y = vY - H * 0.012;
      b.disc(
        'accent',
        [0, y, frontAt(0, y) + H * 0.002],
        [0, 0, 1],
        H * 0.0035,
        8,
        frontSkin(y),
        tint(garment, 0.55),
      );
    }
  }
  if (top.collar === 'hood' && near) {
    // The hood's fabric piled on the upper back below the roll, and its drawstrings.
    const hood = tint(garment, 0.86);
    b.ellipsoid(
      'top',
      [0, shoulderY + H * 0.006, -depth * 0.78 * top.ease],
      UP,
      [neckR * 1.7, H * 0.026, H * 0.032],
      10,
      4,
      chestSkin,
      hood,
    );
    for (const side of [-1, 1]) {
      // Drawstrings lie on the chest from the hood's edge.
      const x = side * neckR * 0.45;
      const ys = patchRows(neckBaseY - H * 0.004, neckBaseY - H * 0.06, 2);
      sheet(
        ys.length - 1,
        1,
        (r, k) => {
          const px = x + (k - 0.5) * H * 0.0026;
          const y = ys[r] as number;
          return [px, y, frontAt(px, y) + H * 0.0025];
        },
        () => tint(garment, 1.35),
      );
    }
  }
  const neck0 = b.ring(
    'skin',
    [0, neck[1], neckCenterZ(neck[1])],
    UP,
    neckR,
    neckR * 0.94,
    sides,
    blend(J('chest'), 0.4, J('neck'), 0.6),
    c.skin,
  );
  const neck1 = b.ring(
    'skin',
    [0, neckTopY, 0],
    UP,
    neckR * 0.88,
    neckR * 0.88,
    sides,
    blend(J('neck'), 0.2, J('head'), 0.8),
    c.skin,
  );
  b.loft('skin', neck0, neck1);
  /** How far behind the axis the back is at (x, y): the torso, then the neck above it. */
  const backAt = (x: number, y: number): number => {
    const ax = dmath.abs(x);
    if (y >= onRow(backCols[NECK_ROW] as Vec3[], ax)[0]) {
      // The actual neck: tapering from its base to under the skull, set back at its base.
      const u = dmath.clamp((y - neck[1]) / (neckTopY - neck[1]), 0, 1);
      const rx = neckR * dmath.lerp(1, 0.88, u);
      const k = dmath.clamp(ax / (rx * 1.1), 0, 1);
      return neckR * dmath.lerp(0.94, 0.88, u) * 1.04 * dmath.sqrt(1 - k * k) - neckCenterZ(y);
    }
    return -onTorso(backCols, ax, y);
  };
  /**
   * The surface behind the body: the back, and under a hoodie the hood's roll at the nape and
   * its folds on the upper back, which stand well off it.
   */
  const behindAt =
    top.collar !== 'hood'
      ? backAt
      : (x: number, y: number): number => {
          const lean = neckLean(neckRise);
          // The roll's rings behind the neck: [height, half-width, how far behind the axis].
          const roll: readonly (readonly [number, number, number])[] = [
            [neckBaseY + neckRise - H * 0.024, 1.55, 0],
            [neckBaseY + neckRise - H * 0.004, 1.55, 1.22],
            [neckBaseY + neckRise + H * 0.011, 1.78, 1.62],
            [neckBaseY + neckRise + H * 0.025, 1.42, 1.38],
            [neckBaseY + neckRise + H * 0.034, 1.42, 1.3],
            [neckBaseY + neckRise + H * 0.05, 1.2, 0],
          ];
          let rest = backAt(x, y);
          for (let i = 1; i < roll.length; i++) {
            const low = roll[i - 1] as (typeof roll)[number];
            const high = roll[i] as (typeof roll)[number];
            if (y < low[0] || y > high[0]) continue;
            const t = (y - low[0]) / (high[0] - low[0]);
            const k = dmath.clamp(dmath.abs(x) / (neckR * dmath.lerp(low[1], high[1], t)), 0, 1);
            const behind = neckR * dmath.lerp(low[2], high[2], t);
            if (behind > 0) rest = dmath.max(rest, behind * dmath.sqrt(1 - k * k) - neckSet - lean);
          }
          if (near) {
            // The pile of fabric below the roll (see the hood's ellipsoid).
            const kx = x / (neckR * 1.8);
            const ky = (y - (shoulderY + H * 0.006)) / (H * 0.03);
            const inside = 1 - kx * kx - ky * ky;
            if (inside > 0)
              rest = dmath.max(rest, depth * 0.78 * top.ease + H * 0.032 * dmath.sqrt(inside));
          }
          return rest;
        };
  /**
   * What hanging hair rests on behind the body. Hair hangs plumb: below the shoulder blades it
   * stays as far back as they stand, clear of the hollow of the lower back.
   */
  const hairRest = (x: number, y: number): number => {
    let rest = behindAt(x, y);
    if (y < shoulderY)
      for (let j = 1; j <= 8; j++)
        rest = dmath.max(rest, behindAt(x, dmath.lerp(y, shoulderY, j / 8)));
    return rest;
  };
  // A backpack: hanging hair (braids, a long sheet) steps out over it.
  const pack =
    d.features.backwear === 'backpack' ? backpackShape(H, shoulderY, spine[1]) : undefined;
  const headSurface = buildHumanHead(
    d,
    m,
    head,
    tier,
    b,
    skin(J('head')),
    J('chest'),
    pack ? { y: pack.top, depth: pack.gap + pack.depth } : undefined,
    hairRest,
  );
  buildHeadAccessories(d, headSurface, tier, b, skin(J('head')));
  if (d.features.hair === 'long') {
    // Long hair continues down the back as its own sheet: it starts inside the head's hair
    // shell, follows the neck, shoulders and back 1.2 cm off the surface, and ends below the
    // shoulder blades. Its top rides the head and its tip the chest.
    const { W, L, baseY } = humanHeadFrame(m, head, d.head);
    const hairColor = parseColor(d.palette.hair);
    // Over a backpack the sheet lies on the pack below its top.
    const hairBack = pack
      ? (x: number, y: number): number =>
          hairRest(x, y) +
          (pack.gap + pack.depth) *
            dmath.smoothstep(dmath.clamp((pack.top + 0.012 * H - y) / (0.03 * H), 0, 1))
      : hairRest;
    // The sheet starts inside the head's hair shell above the nape, so it can reach out over
    // the collar behind the neck without a ledge at the shell's edge.
    const yTop = baseY + 0.24 * L;
    const yBottom = chest[1] + m.chestLen * 0.42;
    const count = near ? 10 : tier === 1 ? 5 : 2;
    const ringSides = near ? 12 : tier === 1 ? 8 : 6;
    // It lies thin and close over the collar, under the head's hanging shell, and fills out
    // below it.
    const fill = (v: number): number => dmath.smoothstep(dmath.clamp((v - 0.18) / 0.32, 0, 1));
    const gapAt = (v: number): number => H * dmath.lerp(0.002, 0.007, fill(v));
    // Hair falls outward from the skull at a limited slope: each ring clears the body below it
    // within a cone, so a deep collar spreads the sheet gradually instead of in one step.
    const clearAt = (y: number): number => {
      let clear = 0.47 * W;
      for (let j = 0; j <= 24; j++) {
        const below = dmath.lerp(y, yBottom, j / 24);
        const v = (yTop - below) / (yTop - yBottom);
        clear = dmath.max(clear, hairBack(0, below) + gapAt(v) - 0.75 * (y - below));
      }
      return clear;
    };
    let prev: RingRef | undefined;
    for (let k = 0; k <= count; k++) {
      const v = k / count;
      const y = dmath.lerp(yTop, yBottom, v);
      const end = k === count;
      const hw =
        W * dmath.lerp(0.42, 0.66, dmath.smoothstep(dmath.min(1, v * 1.4))) * (end ? 0.92 : 1);
      const gap = gapAt(v);
      const reach = clearAt(y);
      const thick = end ? H * 0.002 : H * dmath.lerp(0.004, 0.006 + 0.004 * (1 - v), fill(v));
      const wChest = dmath.smoothstep(dmath.clamp((v - 0.08) / 0.6, 0, 1));
      const weights = blend(J('head'), 1 - wChest, J('chest'), wChest);
      const start = b.mark();
      for (let i = 0; i < ringSides; i++) {
        const angle = (dmath.TAU * i) / ringSides;
        const x = hw * dmath.cos(angle);
        const k2 = x / (1.3 * hw);
        const inner = dmath.max(reach * dmath.sqrt(1 - k2 * k2), hairBack(x, y) + gap);
        const z = -(inner + thick * (1 + dmath.sin(angle)) * 0.5);
        const strand = 1 + 0.1 * dmath.sin(x * 140 + v * 3);
        b.vertex([x, y, z], tint(hairColor, strand * (1 - 0.08 * v)), weights);
      }
      const ring = { start, sides: ringSides, center: [0, y, -reach] as Vec3 };
      if (prev) b.loft('hair', prev, ring);
      else b.cap('hair', ring, weights, hairColor, undefined, false);
      if (end) b.cap('hair', ring, weights, hairColor, [0, y - H * 0.004, -reach - thick]);
      prev = ring;
    }
  }

  // A button placket follows the torso surface and shares its skin weights.
  if (tier < 2 && top.placket !== 'none') {
    let strip: [number, number] | undefined;
    for (const [index, sec] of torso.entries()) {
      // A polo's placket runs from the collar to mid-chest.
      if (top.placket === 'short' && sec.y < chest[1] + m.chestLen * 0.6) continue;
      if (sec.rise > 0 && index !== NECK_ROW) continue;
      const x = H * 0.007;
      const z = rowFront(index, x) + H * 0.001;
      const a = b.vertex([-x, sec.y, z], tint(c.top, 0.82), sec.s);
      const c0 = b.vertex([x, sec.y, z], tint(c.top, 0.82), sec.s);
      if (strip) b.quad('top', strip[0], strip[1], c0, a);
      strip = [a, c0];
      if (near)
        b.disc(
          'accent',
          [0, sec.y + H * 0.002, z + H * 0.001],
          [0, 0, 1],
          H * 0.0018,
          8,
          sec.s,
          tint(c.accent, 0.7),
        );
    }
  }
  if (top.pouch && tier < 2) {
    // A hoodie's pouch pocket across the belly, wider at the bottom, its top edge darker.
    const y0 = waistTop + H * 0.022,
      y1 = spine[1] + m.spineLen * 0.62;
    const ys = patchRows(y1, y0, near ? 3 : 1);
    const cols = near ? 6 : 2;
    const pouch = tint(garment, 0.95);
    sheet(
      ys.length - 1,
      cols,
      (r, k) => {
        const y = ys[r] as number;
        const half = waistRx * top.ease * dmath.lerp(0.4, 0.56, (y1 - y) / (y1 - y0));
        const x = dmath.lerp(-half, half, k / cols);
        return [x, y, frontAt(x, y) + H * 0.002];
      },
      (r) => (r === 0 ? tint(garment, 0.74) : pouch),
    );
  }

  // ---- Hips ------------------------------------------------------------------------------------
  // One block from the waistband to the crotch, widest at the hip joints with the seat behind
  // them, which splits into the two legs below. Trousers get a rise, and the legs start where
  // legs start: a leg that grew out of half the waistband read as 0.6 of the figure's height.
  const hipJoint = P('upperLeg.l'),
    K = P('lowerLeg.l'),
    ankle = P('foot.l');
  // Under a skirt the legs are bare (a striding thigh shows skin) and need no color seam.
  const skirt = d.features.legs === 'skirt' || dress;
  const bare = legwearBareFrom(d.features.legs, skirt);
  const lower: FigureRegion = skirt ? 'skin' : 'bottom';
  const lowerColor = skirt ? c.skin : c.bottom;
  const R = m.limbRadius;
  // Heights below the hip joints are fractions of the thigh, so short or long legs keep the
  // crotch between the hips and the first ring of the legs (0.03 and 0.045 of an adult's stature).
  const thigh = m.upperLegLen;
  const seatTop = 1 + (seatK - 1) * 0.8;
  // Hips about 0.2 of stature across at the joints (0.195 masculine, 0.21 feminine) and 0.135
  // deep, the seat making most of it.
  const hipRx = m.hipOutline;
  const depth0 = m.torsoRadius / form.chest;
  const seatZb =
    depth0 * (d.age === 'child' ? 0.98 : 1.08) * seatTop * dmath.lerp(1, form.hip, 0.5);
  const hipZf = depth0 * 0.8 * (1 + 0.25 * belly);
  const hipSkin = skin(J('hips'));
  const legL = J('upperLeg.l'),
    legR = J('upperLeg.r'),
    hipsJ = J('hips'),
    spineJ = J('spine');
  const hipRowsAll: readonly Section[] = [
    section(waistTop, waistRx * 0.985, waistZf * 0.98, waistZb * 0.98, waistSkin),
    section(
      hips[1] + m.hipsLen * 0.5,
      dmath.lerp(waistRx, hipRx, 0.62),
      dmath.lerp(waistZf, hipZf, 0.6),
      dmath.lerp(waistZb, seatZb, 0.7),
      blend(hipsJ, 0.85, spineJ, 0.15),
    ),
    section(hips[1] + H * 0.004, hipRx, hipZf, seatZb, hipSkin),
    section(hips[1] - thigh * 0.122, hipRx * 0.985, hipZf * 0.94, seatZb * 0.95, hipSkin),
  ];
  // Near, and only where they show: under a skirt or at a distance the high-hip row goes.
  const hipRows = near && !skirt ? hipRowsAll : hipRowsAll.filter((_, i) => i !== 1);
  /** The hips' outline at a height above the split: [half-width, front, back]. */
  const hipAt = (y: number): [number, number, number] => {
    for (let i = 1; i < hipRowsAll.length; i++) {
      const high = hipRowsAll[i - 1] as Section;
      const low = hipRowsAll[i] as Section;
      if (y < low.y && i < hipRowsAll.length - 1) continue;
      const t = dmath.clamp((high.y - y) / (high.y - low.y), 0, 1);
      return [
        dmath.lerp(high.rx, low.rx, t),
        dmath.lerp(high.zf, low.zf, t),
        dmath.lerp(high.zb, low.zb, t),
      ];
    }
    return [hipRx, hipZf, seatZb];
  };
  const splitRow = hipRows[hipRows.length - 1] as Section;
  let split: RingRef | undefined;
  for (const [index, sec] of hipRows.entries()) {
    // The lowest row begins to follow the thighs, except between them.
    const ring =
      index === hipRows.length - 1
        ? trunkRing(sec, lowerColor, 1, (x, ux) =>
            blend(
              hipsJ,
              1 - 0.25 * dmath.smoothstep(dmath.abs(ux) / 0.5),
              x >= 0 ? legL : legR,
              0.25 * dmath.smoothstep(dmath.abs(ux) / 0.5),
            ),
          )
        : trunkRing(sec, lowerColor);
    if (split) b.loft(lower, ring, split);
    split = ring;
  }
  const splitRing = split as RingRef;
  // The seam under the body, from behind to the front: the extra vertices that close each leg's
  // opening into a loop of `limbSides`.
  const crotchY = hips[1] - thigh * 0.184;
  const crotch: number[] = [];
  const crotchCount = limbSides - (sides / 2 + 1);
  for (let k = 0; k < crotchCount; k++) {
    const u = crotchCount === 1 ? 0 : (2 * k) / (crotchCount - 1) - 1;
    const z = u >= 0 ? u * 0.55 * splitRow.zf : u * 0.55 * splitRow.zb;
    const y = crotchY + dmath.abs(u) * 0.6 * (splitRow.y - crotchY);
    crotch.push(b.vertex([0, y, z - H * 0.004], tint(lowerColor, 0.8), hipSkin));
  }
  /** A leg's opening in the hips: half the split ring from front to back, then the seam. */
  const legLoop = (side: number): number[] => {
    const loop: number[] = [];
    for (let col = sides / 4; col <= (3 * sides) / 4; col++)
      loop.push(splitRing.start + (side > 0 ? col : (sides / 2 - col + sides) % sides));
    return [...loop, ...crotch];
  };
  if (!covered) {
    // The belt lies on the hips just under the waistband's top edge.
    const beltRing = (y: number): RingRef => {
      const [rx, zf, zb] = hipAt(y);
      return trunkRing(section(y, rx, zf, zb, waistSkin), beltColor, 1.02);
    };
    const belt0 = beltRing(waistTop - H * 0.013);
    const belt1 = beltRing(waistTop);
    b.loft('accent', belt0, belt1);
    if (tier < 2 && !dress) {
      const z = hipAt(waistTop - H * 0.008)[1] * 1.02;
      b.box(
        'accent',
        [-H * 0.013, waistTop - H * 0.012, z - H * 0.001],
        [H * 0.013, waistTop - H * 0.001, z + H * 0.003],
        waistSkin,
        c.accent,
      );
    }
  }

  const mark = b.mark();
  if (near && bust < 1 && top.pockets) {
    // Patch pockets lie on the chest's own surface, with a darker flap along the top.
    const x0 = m.shoulderHalf * 0.2,
      x1 = m.shoulderHalf * 0.58;
    const y0 = chest[1] + m.chestLen * 0.22,
      y1 = y0 + H * 0.036;
    const ys = patchRows(y1, y0, 2);
    const at =
      (heights: readonly number[], lift: number) =>
      (r: number, k: number): Vec3 => {
        const y = heights[r] as number;
        const x = dmath.lerp(x0, x1, k / 3);
        return [x, y, frontAt(x, y) + H * lift];
      };
    sheet(ys.length - 1, 3, at(ys, 0.003), () => tint(c.top, 0.94));
    sheet(1, 3, at([y1, y1 - H * 0.005], 0.0038), () => tint(c.top, 0.72));
  }
  if (near && !skirt && top.hem !== 'hip' && top.hem !== 'thigh') {
    // A patch pocket on the seat of the trousers: what a camera following the figure sees.
    const high = hipRowsAll[1] as Section;
    const widest = hipRowsAll[2] as Section;
    const ys = [high.y - H * 0.006, widest.y, widest.y - H * 0.016];
    const x0 = hipRx * 0.2,
      x1 = hipRx * 0.64;
    const pocket = tint(c.bottom, 0.84);
    let above: number[] | undefined;
    for (const [r, y] of ys.entries()) {
      const [rx, , zb] = hipAt(y);
      const ids: number[] = [];
      for (let k = 0; k <= 2; k++) {
        // The bottom edge comes to a shallow point, as a jeans pocket's does.
        const x = dmath.lerp(x1, x0, k / 2);
        const dip = r === ys.length - 1 && k !== 1 ? H * 0.006 : 0;
        const across = dmath.clamp(x / rx, 0, 1);
        const w =
          y >= widest.y
            ? 0
            : (0.25 *
                dmath.smoothstep(dmath.pow(across, TRUNK_N / 2) / 0.5) *
                (widest.y - (y + dip))) /
              (widest.y - splitRow.y);
        ids.push(
          b.vertex(
            [x, y + dip, -(zb * depthAt(across, TRUNK_N) + H * 0.0025)],
            r === 0 ? tint(pocket, 0.8) : pocket,
            y >= widest.y ? blend(hipsJ, 1, spineJ, 0) : blend(hipsJ, 1 - w, legL, w),
          ),
        );
      }
      if (above)
        for (let k = 0; k < 2; k++)
          b.quad(
            'bottom',
            ids[k] as number,
            ids[k + 1] as number,
            above[k + 1] as number,
            above[k] as number,
          );
      above = ids;
    }
  }
  const A = P('upperArm.l'),
    E = P('foreArm.l'),
    W = P('hand.l');
  const armDir = direction(A, E);
  const lowerDir = direction(E, W);
  // Keep volume through the elbow and taper gradually into the forearm. A narrow
  // elbow followed by a wider forearm exaggerates an hourglass shape under skinning.
  // [station, radius, depth over width]: the deltoid and biceps are deeper front to back than
  // they are wide, which also brings the front of the shoulder up level with the chest beside
  // it instead of leaving a groove there.
  const armSections: readonly [number, number, number][] = near
    ? [
        [0.22, 1, 1.2],
        [0.4, 0.98, 1.14],
        [0.5, 0.94, 1.1],
        [0.8, 0.89, 1],
        [0.94, 0.87, 0.96],
        [1, 0.86, 0.94],
        [1.07, 0.85, 0.94],
        [1.25, 0.8, 0.94],
        [1.5, 0.74, 0.94],
        [1.8, 0.62, 0.94],
        [2, 0.56, 0.94],
      ]
    : [
        [0.22, 1, 1.2],
        [0.5, 0.94, 1.1],
        [1, 0.86, 0.94],
        [1.35, 0.78, 0.94],
        [2, 0.56, 0.94],
      ];
  // A consistent frame keeps the outer deltoid and the forearm on the same meridian: vertex 0
  // is the outside of the arm, a quarter of the way round its front.
  const armRing = (
    center: Vec3,
    axis: Vec3,
    rx: number,
    rz: number,
    s: Skin,
    color: RGB,
    roll = 0,
  ): RingRef => {
    const start = b.mark();
    const rotation = roll === 0 ? undefined : forearmRoll(axis, roll);
    for (let i = 0; i < armSides; i++) {
      const angle = (dmath.TAU * i) / armSides;
      const across = rx * dmath.cos(angle);
      const offset: Vec3 = [-axis[1] * across, axis[0] * across, rz * dmath.sin(angle)];
      const p = rotation ? quatRotateVec3(rotation, offset) : offset;
      b.vertex([center[0] + p[0], center[1] + p[1], center[2] + p[2]], color, s);
    }
    return { start, sides: armSides, center };
  };
  last = undefined;
  let previousRegion: FigureRegion | undefined;
  let sleeveBridge: RingRef | undefined;
  let hemmed: { r: number; deep: number; axis: Vec3; s: Skin } | undefined;
  for (const [t, r, deep] of armSections.filter(
    ([t]) => tier < 2 || t === 0.22 || t === 0.5 || t === 1 || t === 2,
  )) {
    const center = t <= 1 ? mix(A, E, t) : mix(E, W, t - 1);
    // The upper arm hangs clear of the ribs and a little forward of the joint line.
    center[0] += H * 0.008 * dmath.clamp((1 - t) / 0.78, 0, 1);
    center[2] += H * 0.003 * dmath.clamp((1 - t) / 0.78, 0, 1);
    const axis = t <= 1 ? armDir : lowerDir;
    const region =
      d.features.sleeves === 'none' || (d.features.sleeves === 'short' && t > 0.5)
        ? 'skin'
        : 'sleeves';
    const color = region === 'skin' ? c.skin : garment;
    const s =
      t < 0.32
        ? blend(J('chest'), 0.6 * (1 - t / 0.32), J('upperArm.l'), 0.4 + (0.6 * t) / 0.32)
        : t < 0.8
          ? skin(J('upperArm.l'))
          : t < 1.2
            ? blend(J('upperArm.l'), (1.2 - t) / 0.4, J('foreArm.l'), (t - 0.8) / 0.4)
            : t < 1.8
              ? skin(J('foreArm.l'))
              : blend(J('foreArm.l'), 0.8, J('hand.l'), 0.2);
    if (last && previousRegion !== region && hemmed) {
      // A sleeve's hem: its shadowed underside turns in to the arm, which goes on as skin.
      const inner = armR * hemmed.r * 0.91;
      const under = armRing(
        last.center,
        hemmed.axis,
        inner,
        inner * hemmed.deep,
        hemmed.s,
        tint(garment, 0.55),
      );
      b.loft(previousRegion as FigureRegion, last, under);
      last = armRing(last.center, hemmed.axis, inner, inner * hemmed.deep, hemmed.s, color);
    }
    hemmed = { r, deep, axis, s };
    const radius = armR * r * (region === 'skin' ? 0.91 : 1.03 * top.ease);
    const wristBlend = dmath.clamp((t - 1.8) / 0.2, 0, 1);
    const rx = dmath.lerp(radius, m.handLen * 0.105, wristBlend);
    const rz = dmath.lerp(radius * deep, m.handLen * 0.18, wristBlend);
    if (!last) {
      const seam =
        region === 'skin'
          ? shoulderPoints.map((point) => b.vertex(point, color, chestSkin))
          : shoulderLeft;
      const steps = near ? 4 : tier === 1 ? 3 : 2;
      for (let step = 1; step < steps; step++) {
        const u = step / steps;
        const start = b.mark();
        for (let i = 0; i < armSides; i++) {
          const angle = (dmath.TAU * i) / armSides;
          const across = rx * dmath.cos(angle);
          const target: Vec3 = [
            center[0] - axis[1] * across,
            center[1] + axis[0] * across,
            center[2] + rz * dmath.sin(angle),
          ];
          // The deltoid: off the shoulder line the cap carries on down the shoulder's slope,
          // swells a little past the arm and comes down plumb onto it, a rounded corner over
          // the joint. Under the arm it runs straight from the armpit.
          const from = shoulderPoints[i] as Vec3;
          const upper = (boundary[i] as [number, number])[0] === SHOULDER ? 1 : 0;
          const drop = from[1] - target[1];
          const out1 = dmath.lerp(1 / 3, 0.72, upper);
          const out2 = dmath.lerp(2 / 3, 1.05, upper);
          const c1: Vec3 = [
            dmath.lerp(from[0], target[0], out1),
            from[1] - drop * dmath.lerp(1 / 3, 0.2, upper),
            dmath.lerp(from[2], target[2], out1),
          ];
          const c2: Vec3 = [
            dmath.lerp(from[0], target[0], out2),
            target[1] + drop * dmath.lerp(1 / 3, 0.6, upper),
            dmath.lerp(from[2], target[2], out2),
          ];
          const v = 1 - u;
          const point: Vec3 = [0, 0, 0];
          for (let k = 0; k < 3; k++)
            point[k] =
              v * v * v * (from[k] as number) +
              3 * u * v * v * (c1[k] as number) +
              3 * u * u * v * (c2[k] as number) +
              u * u * u * (target[k] as number);
          b.vertex(point, color, blend(J('chest'), 1 - 0.9 * u, J('upperArm.l'), 0.9 * u));
        }
        const bridge = { start, sides: armSides, center };
        if (last) b.loft(region, last, bridge);
        else {
          sleeveBridge = bridge;
          for (let i = 0; i < armSides; i++) {
            const next = (i + 1) % armSides;
            b.quad(region, seam[i] as number, seam[next] as number, start + next, start + i);
          }
        }
        last = bridge;
      }
    }
    const ring = armRing(
      center,
      axis,
      rx,
      rz,
      s,
      color,
      tier === 2 ? REST_FOREARM_ROLL * dmath.clamp(t - 1, 0, 1) : 0,
    );
    if (last) b.loft(region, last, ring);
    last = ring;
    previousRegion = region;
  }
  if (last)
    b.cap(
      previousRegion as FigureRegion,
      last,
      skin(J('hand.l')),
      previousRegion === 'skin' ? c.skin : garment,
    );
  buildHumanHand(
    b,
    W,
    lowerDir,
    m.handLen,
    skin(J('hand.l')),
    c.skin,
    tier,
    d.features.hands === 'fingers',
    tier === 2 ? forearmRoll(lowerDir) : undefined,
  );

  // ---- Legs ------------------------------------------------------------------------------------
  const legGap = H * 0.002;
  // The top of the thigh continues the hips' outline and meets the other thigh at the middle.
  const thighTop: readonly [number, number] = [
    (hipRx * 0.965 - hipJoint[0]) / R,
    dmath.min((hipJoint[0] - legGap) / R, 1.5 * seatK),
  ];
  /** The leg itself at a station: radii in limb radii, and its centre's offset forward. */
  const legAt = (t: number): { radii: LegRadii; dz: number } => {
    const first = LEG[0] as (typeof LEG)[number];
    let a = first;
    let e = first;
    for (let i = 1; i < LEG.length; i++) {
      a = LEG[i - 1] as (typeof LEG)[number];
      e = LEG[i] as (typeof LEG)[number];
      if (t <= e[0]) break;
    }
    const f = dmath.clamp((t - a[0]) / (e[0] - a[0]), 0, 1);
    const at = (k: number): number => {
      const va = a === first && k <= 2 ? (thighTop[k - 1] as number) : (a[k] as number);
      const ve = e === first && k <= 2 ? (thighTop[k - 1] as number) : (e[k] as number);
      return dmath.lerp(va, ve, f);
    };
    // Seat fullness tapers out down the thigh (exactly 1 when the proportion is absent); the
    // thigh's outside already follows the hips.
    const seat = 1 + (seatK - 1) * dmath.max(0, 1 - t / 0.6);
    return { radii: [at(1), at(2) * seat, at(3) * seat, at(4) * seat], dz: at(5) };
  };
  /** The leg as drawn at a station: trousers where they cover it. */
  const legDrawn = (t: number): LegRadii =>
    t <= bare ? legwearSection(d.features.legs, t, legAt(t).radii) : legAt(t).radii;
  const legCentre = (t: number): Vec3 => {
    const p: Vec3 =
      t <= 1
        ? mix(hipJoint, K, t)
        : t <= 2
          ? mix(K, ankle, t - 1)
          : [ankle[0], ankle[1] - (t - 2) * m.lowerLegLen, ankle[2]];
    return [p[0], p[1], p[2] + legAt(t).dz * R];
  };
  const legSkin = (t: number): Skin =>
    t < 0.34
      ? blend(hipsJ, 0.3, legL, 0.7)
      : t < 0.8
        ? skin(legL)
        : t < 1.2
          ? blend(legL, (1.2 - t) / 0.4, J('lowerLeg.l'), (t - 0.8) / 0.4)
          : t <= 2
            ? skin(J('lowerLeg.l'))
            : blend(J('lowerLeg.l'), 0.4, J('foot.l'), 0.6);
  // Leg rings run in the hips' column order (front, outside, back, inside), so the first one
  // lofts straight onto the leg's opening.
  const outerIndex = sides / 4;
  const legRing = (t: number, radii: LegRadii, color: RGB): RingRef => {
    const center = legCentre(t);
    const s = legSkin(t);
    const start = b.mark();
    // Under the hips the thigh's inside is flat against the other thigh, a D in section, and
    // rounds out down to mid-thigh.
    const flat = dmath.lerp(0.5, 1, dmath.clamp((t - 0.27) / 0.3, 0, 1));
    for (let i = 0; i < limbSides; i++) {
      const angle = (dmath.TAU * (outerIndex - i)) / limbSides;
      let cs = dmath.cos(angle),
        sn = dmath.sin(angle);
      if (cs < -1e-9 && flat < 1) {
        cs = -dmath.pow(-cs, flat);
        sn = dmath.sign(sn) * dmath.pow(dmath.abs(sn), flat);
      }
      b.vertex(
        [
          // The thighs meet at the middle; neither crosses it.
          dmath.max(legGap, center[0] + cs * (cs >= 0 ? radii[0] : radii[1]) * R),
          center[1],
          center[2] + sn * (sn >= 0 ? radii[2] : radii[3]) * R,
        ],
        color,
        s,
      );
    }
    return { start, sides: limbSides, center };
  };
  const baseStations = near
    ? [0.27, 0.48, 0.78, 1, 1.1, 1.32, 1.6, 1.86]
    : tier === 1
      ? [0.27, 0.5, 1, 1.32]
      : [0.27, 1];
  // Trousers that reach the shoe end on a hem just above it; shorter ones on a hem with the
  // bare leg going on below; a bare leg ends inside the shoe.
  const toShoe = bare >= 2;
  const clothed = baseStations.filter((t) => t < (toShoe ? 1.7 : bare - 0.06));
  if (toShoe) clothed.push(1.95);
  else if (bare > 0) clothed.push(bare);
  const unclothed = toShoe ? [] : [...baseStations.filter((t) => t > bare + 0.1), 2.06];
  const leg: { first?: RingRef; last?: RingRef; region: FigureRegion } = { region: lower };
  const addLeg = (ring: RingRef, region: FigureRegion): void => {
    if (leg.last) b.loft(region, ring, leg.last);
    else {
      // The leg's first ring joins its opening in the hips, vertex for vertex.
      leg.first = ring;
      const loop = legLoop(1);
      for (let i = 0; i < limbSides; i++) {
        const next = (i + 1) % limbSides;
        b.quad(region, ring.start + i, ring.start + next, loop[next] as number, loop[i] as number);
      }
    }
    leg.last = ring;
    leg.region = region;
  };
  for (const t of clothed) addLeg(legRing(t, legDrawn(t), c.bottom), 'bottom');
  if (!toShoe && leg.last) {
    // A hem: its shadowed underside turns in to the leg, which goes on as skin.
    const under = legRing(bare, legAt(bare).radii, tint(c.bottom, 0.5));
    b.loft('bottom', under, leg.last);
    leg.last = legRing(bare, legAt(bare).radii, c.skin);
  }
  for (const t of unclothed) addLeg(legRing(t, legAt(t).radii, c.skin), 'skin');
  if (leg.last)
    b.cap(
      leg.region,
      leg.last,
      toShoe ? skin(J('lowerLeg.l')) : legSkin(2.06),
      toShoe ? tint(c.bottom, 0.45) : c.skin,
      undefined,
      false,
    );
  let footwear: HumanShoeStyle | undefined;
  if (d.features.footwear !== undefined) {
    // A boot's shaft clears the leg where it ends; regular and wide trousers fall over it.
    const shaftY = ankle[1] + H * BOOT_SHAFT;
    const t = 1 + dmath.clamp((K[1] - shaftY) / (K[1] - ankle[1]), 0, 1);
    const radii = legDrawn(t);
    footwear = {
      style: d.features.footwear,
      shaft: skin(J('lowerLeg.l')),
      legRadius: dmath.max(dmath.max(radii[0], radii[1]), dmath.max(radii[2], radii[3])) * R,
      skin: c.skin,
      ...(legwearOverBoot(d.features.legs) && t <= bare ? { covered: true } : {}),
    };
  }
  buildHumanShoe(b, ankle, m.footLen, H, skin(J('foot.l')), c.shoes, tier, footwear);
  const mirrorOffset = b.mark() - mark;
  b.mirrorX(mark, (joint) => jointIndex(rig, mirrorName(rig.joints[joint]?.name ?? 'root')));
  // mirrorX copies the limbs but deliberately skips faces sharing pre-mark trunk vertices.
  if (sleeveBridge && d.features.sleeves !== 'none') {
    const start = sleeveBridge.start + mirrorOffset;
    for (let i = 0; i < armSides; i++) {
      const next = (i + 1) % armSides;
      // The mirror image of the left seam's quad, split along the same diagonal.
      b.quad(
        'sleeves',
        shoulderRight[i] as number,
        start + i,
        start + next,
        shoulderRight[next] as number,
      );
    }
  }
  if (leg.first) {
    const start = leg.first.start + mirrorOffset;
    const loop = legLoop(-1);
    const region: FigureRegion = clothed.length > 0 ? 'bottom' : 'skin';
    for (let i = 0; i < limbSides; i++) {
      const next = (i + 1) % limbSides;
      b.quad(region, start + i, loop[i] as number, loop[next] as number, start + next);
    }
  }

  // ---- Skirts and hems ---------------------------------------------------------------------------
  const knee = K;
  /** The thighs' outline at a height below the split, as drawn: [half-width, front, back]. */
  const thighsAt = (y: number): [number, number, number] => {
    const t = dmath.clamp((hipJoint[1] - y) / m.upperLegLen, 0.27, 1);
    const radii = legDrawn(t);
    const dz = legAt(t).dz * R;
    return [hipJoint[0] + radii[0] * R, radii[2] * R + dz, radii[3] * R - dz];
  };
  const drapeTop = (hipRows[hipRows.length - 2] as Section).y;
  const skirtHem = knee[1] + thigh * 0.143;
  /**
   * What hangs from the hips (a skirt, a jacket's or coat's hem) at a height: the hips' outline
   * with clearance down to the hip joints, then an A-line that clears the thighs, [half-width,
   * front, back].
   */
  const drape = (y: number): [number, number, number] => {
    const clear = H * 0.006;
    if (y >= drapeTop) {
      const [rx, zf, zb] = hipAt(y);
      // No clearance at the waistband, all of it by the high hip.
      const k = dmath.clamp((waistTop - y) / (waistTop - (hips[1] + m.hipsLen * 0.5)), 0, 1);
      return [rx + clear * k, zf + clear * k, zb + clear * k];
    }
    const v = dmath.clamp((drapeTop - y) / (drapeTop - skirtHem), 0, 1);
    const [tx, tf, tb] = thighsAt(y);
    return [
      dmath.max((hipRx + clear) * (1 + 0.1 * v), tx + clear),
      dmath.max((hipZf + clear) * (1 + 0.08 * v), tf + 2 * clear),
      dmath.max((seatZb + clear) * (1 + 0.03 * v), tb + clear),
    ];
  };
  /** Skin of a hanging garment: the hips, then each side's thigh, most strongly over it. */
  const drapeSkin = (x: number, y: number, uz: number): Skin => {
    if (y > hips[1]) {
      // Up to the torso's bottom ring, whose weights it meets.
      const a = dmath.clamp((y - hips[1]) / (waistTop - hips[1]), 0, 1);
      return blend(hipsJ, 1 - 0.45 * a, spineJ, 0.45 * a);
    }
    // A third of the way down it goes with the thigh, so a striding thigh pushes the cloth ahead
    // of it instead of through it; between the thighs a little less, so it neither tears at the
    // middle when they part nor hangs through the lap when both rise to sit.
    const v = dmath.clamp((hips[1] - y) / (hips[1] - skirtHem), 0, 1);
    const between = dmath.clamp(1 - dmath.abs(x) / hipJoint[0], 0, 1);
    // Behind, it hangs from the seat and goes only half way: a thigh raised to sit would
    // otherwise pull the back of the cloth forward off the seat.
    const behind = dmath.lerp(0.55, 1, dmath.smoothstep(dmath.clamp(0.5 + uz, 0, 1)));
    const w = dmath.smoothstep(dmath.min(1, 3 * v)) * (0.95 - 0.25 * between) * behind;
    return blend(hipsJ, 1 - w, x >= 0 ? legL : legR, w);
  };
  /** A ring of a hanging garment at a height, `k` times its drape; `pleat` ripples its hem. */
  const drapeRing = (y: number, k: number, color: RGB, pleat = 0): RingRef => {
    const [rx, zf, zb] = drape(y);
    const start = b.mark();
    for (let i = 0; i < sides; i++) {
      const [ux, uz] = fold(i, sides);
      const fullness = 1 + pleat * dmath.cos(8 * dmath.acos(dmath.clamp(ux, -1, 1)));
      const x = squared(ux, TRUNK_N) * rx * k * fullness;
      const z = squared(uz, TRUNK_N) * (uz >= 0 ? zf : zb) * k * fullness;
      b.vertex([x, y, z], color, drapeSkin(x, y, uz));
    }
    return { start, sides, center: [0, y, 0] };
  };
  if (covered) {
    // A hem below the waist: a sweater's ribbed band over the belt, a jacket to the hip, a
    // coat to mid-thigh. It continues the torso's bottom ring (shared vertices, so no seam)
    // down over the trousers on the skirt's profile, follows the thighs below the hips as the
    // skirt does, and rolls inward at its edge so it is never open from below.
    const upperHip = hips[1] + m.hipsLen * 0.5;
    // [height, scale over the drape, color]; the last station is the rolled inner hem.
    const stations: [number, number, RGB][] = [];
    if (top.hem === 'band') {
      const rib = tint(garment, 0.86);
      const bottom = upperHip - H * 0.012;
      const bandTop = bottom + H * 0.022;
      // Near, the band starts on a crisp line; further away its color blends in.
      if (tier < 2) stations.push([bandTop, 1, garment]);
      if (near) stations.push([bandTop - H * 0.001, 1.012, rib]);
      stations.push([bottom, 1.012, rib]);
    } else {
      const hemY = top.hem === 'hip' ? hips[1] - thigh * 0.143 : dmath.lerp(hips[1], knee[1], 0.55);
      if (near) stations.push([upperHip, 1, garment]);
      // The seat is fullest at the hip joints: a station there keeps the hem outside it.
      stations.push([drapeTop, 1, garment]);
      if (top.hem === 'thigh' && tier < 2)
        stations.push([dmath.lerp(drapeTop, hemY, 0.5), 1, garment]);
      stations.push([hemY, 1, garment]);
    }
    let prev = torsoRings[0] as RingRef;
    for (const [y, k, color] of stations) {
      const ring = drapeRing(y, k * top.ease, color);
      b.loft('top', ring, prev);
      prev = ring;
    }
    if (tier < 2) {
      const [y, k, color] = stations[stations.length - 1] as [number, number, RGB];
      const inner = drapeRing(y + H * 0.004, k * top.ease * 0.96, tint(color, 0.7));
      b.loft('top', prev, inner);
    }
  }
  if (skirt) {
    // A dress continues the top's color down its skirt.
    const fabric = dress ? garment : c.bottom;
    // A knee-length A-line skirt: one ring loft from the waistband over the hips to a hem
    // just above the knee, with a rolled inner hem so it is never open from below. Each
    // vertex follows the thigh on its side, most strongly over the thigh line, so the skirt
    // sways with the stride and stays over the thighs when seated.
    const allStations: readonly number[] = [
      waistTop - H * 0.006,
      hips[1] + m.hipsLen * 0.5,
      drapeTop,
      dmath.lerp(hips[1], skirtHem, 0.35),
      skirtHem,
      skirtHem + H * 0.004,
    ];
    // Medium detail drops the high-hip station (as the hips under it do); distant detail, which
    // does not move, keeps waist, hip and hem.
    const stations = near
      ? allStations
      : allStations.filter((_, i) => (tier === 1 ? i !== 1 : i === 0 || i === 2 || i === 4));
    let prev: RingRef | undefined;
    for (const [k, y] of stations.entries()) {
      const v = dmath.clamp((hips[1] - y) / (hips[1] - skirtHem), 0, 1);
      const inner = tier < 2 && k === stations.length - 1;
      const ring = drapeRing(
        y,
        k === 0 ? 1.004 : inner ? 0.955 : 1,
        tint(fabric, inner ? 0.7 : 1 - 0.08 * v),
        near && !inner ? 0.025 * v * v : 0,
      );
      if (prev) {
        // The rolled hem turns inward: loft in the opposite order to face down and in.
        if (inner) b.loft('bottom', prev, ring);
        else b.loft('bottom', ring, prev);
      }
      prev = ring;
    }
  }

  const f = d.features;
  if (f.neckwear || f.backwear || f.bag || f.wristwear) {
    // Body accessories sit on the torso as built here, garment included.
    const insideTorso = (p: Vec3): boolean => {
      const [x, y, z] = p;
      if (y < row(0).y || y > row(NECK_ROW).y + neckRise) return false;
      for (let i = 1; i < torso.length; i++) {
        const low = row(i - 1);
        const high = row(i);
        if (y > high.y && i < torso.length - 1) continue;
        const t = dmath.clamp((y - low.y) / (high.y - low.y), 0, 1);
        const rx = dmath.lerp(low.rx, high.rx, t);
        if (dmath.abs(x) >= rx) return false;
        const k = dmath.abs(x) / rx;
        const zr = z - dmath.lerp(low.zc, high.zc, t);
        const reach =
          (zr >= 0 ? dmath.lerp(low.zf, high.zf, t) : dmath.lerp(low.zb, high.zb, t)) *
          depthAt(k, dmath.lerp(low.n, high.n, t));
        const swell = zr >= 0 ? dmath.lerp(bulge(i - 1, k), bulge(i, k), t) : 0;
        return dmath.abs(zr) <= reach + swell;
      }
      return false;
    };
    const skinAt = (y: number): Skin => {
      if (y >= chest[1]) return frontSkin(y);
      const w = dmath.lerp(0.35, 1, dmath.clamp((chest[1] - y) / (chest[1] - spine[1]), 0, 1));
      return blend(J('spine'), w, J('chest'), 1 - w);
    };
    // The left wrist, where a watch sits (on the sleeve or the skin).
    const wristT = 0.86;
    const sleeved = d.features.sleeves === 'long';
    const wristR = armR * 0.6 * (sleeved ? 1.03 * top.ease : 0.91);
    const wristBlend = dmath.clamp((1 + wristT - 1.8) / 0.2, 0, 1);
    const garmentEase = covered ? top.ease : 1;
    const hipsDrape = drape(hips[1]);
    buildBodyAccessories(d, {
      b,
      tier,
      H,
      joint: J,
      at: P,
      front: frontAt,
      back: backAt,
      inside: insideTorso,
      skinAt,
      neckRing: neckLine,
      neckR,
      neckBaseY,
      shoulderY,
      shoulderHalf: m.shoulderHalf,
      sides,
      hood: top.collar === 'hood',
      wrist: {
        center: mix(E, W, wristT),
        axis: lowerDir,
        radius: dmath.max(
          dmath.lerp(wristR, m.handLen * 0.105, wristBlend),
          dmath.lerp(wristR * 0.94, m.handLen * 0.18, wristBlend),
        ),
        skin: blend(J('foreArm.l'), 0.8, J('hand.l'), 0.2),
      },
      waistY: spine[1],
      waistRx: waistRx * garmentEase,
      waistRz: dmath.max(waistZf, waistZb) * garmentEase,
      hipsY: hips[1],
      hipRx: hipsDrape[0] * garmentEase,
      hipRz: dmath.max(hipsDrape[1], hipsDrape[2]) * garmentEase,
    });
  }
}
