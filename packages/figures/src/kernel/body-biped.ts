/** Human geometry on the canonical skeleton, with continuous skinned shoulder surfaces. */
import { dmath, quatRotateVec3, type Vec3 } from '@bendyline/molen-kernel/determinism';
import { jointIndex, jointPosition } from './body';
import { circle } from './body-animal-shape';
import {
  backpackShape,
  buildBodyAccessories,
  buildHeadAccessories,
} from './body-human-accessories';
import { buildHumanHand, buildHumanShoe, type HumanShoeStyle } from './body-human-extremities';
import { legwearBareFrom, legwearRadius, topSpec } from './body-human-garments';
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
const DOWN: Vec3 = [0, -1, 0];
const mix = (a: Vec3, b: Vec3, t: number): Vec3 => [
  dmath.lerp(a[0], b[0], t),
  dmath.lerp(a[1], b[1], t),
  dmath.lerp(a[2], b[2], t),
];
const direction = (a: Vec3, b: Vec3): Vec3 => {
  const l = dmath.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  return [(b[0] - a[0]) / l, (b[1] - a[1]) / l, (b[2] - a[2]) / l];
};

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
  const pelvis = m.hipHalf + m.limbRadius * 1.1;
  // About 0.072 of stature across (a 39 cm collar on a 1.75 m adult); a thinner neck read as
  // a stalk under the head.
  const neckR = 0.036 * H * form.neck * (1 + 0.15 * d.build);
  // Upper arms are slimmer than thighs: about 0.3 m around a 1.75 m adult's sleeve.
  const armR = m.limbRadius * 0.84 * form.arm;
  const waistSkin = blend(J('hips'), 0.4, J('spine'), 0.6);
  const chestSkin = skin(J('chest'));
  // Body-shape proportions (each exactly neutral when absent, so older bodies are unchanged):
  // a narrower or wider waist, a fuller belly, and fuller hips, seat and thighs.
  const waistK = d.proportions.waist ?? 1;
  const belly = d.proportions.belly ?? 0;
  const seatK = d.proportions.seat ?? 1;
  const bellyWaist = 1 + 0.16 * belly;
  const waistRx = pelvis * 0.92 * dmath.lerp(1, form.waist, 0.4) * waistK;
  const waistRz = m.torsoRadius * 0.84 * bellyWaist;
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
      b.vertex([x * rx, y + neckLift(z), z * rz + neckSet], color, s);
    }
    return { start, sides, center: [0, y, neckSet] };
  };
  const torsoRing = (
    region: FigureRegion,
    y: number,
    rx: number,
    rz: number,
    s: Skin,
    color: RGB,
  ): RingRef => b.ring(region, [0, y, 0], UP, rx, rz, sides, s, color);
  // A hem over the waist hides the belt; a dress's belt is a seam in its own color.
  const covered = top.hem === 'band' || top.hem === 'hip' || top.hem === 'thigh';
  const beltColor = dress ? tint(c.top, 0.8) : tint(c.shoes, 0.7);
  if (!covered) {
    const belt = torsoRing(
      'accent',
      spine[1] + H * 0.008,
      waistRx * 0.995,
      waistRz * 0.97,
      waistSkin,
      beltColor,
    );
    const beltTop = torsoRing(
      'accent',
      spine[1] + H * 0.019,
      waistRx * 0.995,
      waistRz * 0.97,
      waistSkin,
      beltColor,
    );
    b.loft('accent', belt, beltTop);
    if (tier < 2 && !dress)
      b.box(
        'accent',
        [-H * 0.013, spine[1] + H * 0.009, waistRz * 0.965],
        [H * 0.013, spine[1] + H * 0.018, waistRz * 0.965 + H * 0.003],
        waistSkin,
        c.accent,
      );
  }

  // Waist, chest, armpit, shoulder line and neck base. Widths follow adult means: chest about
  // 0.19 of stature across and 0.135 deep, waist 0.17 across, the arms outside them.
  // The fifth value is the bust or pectoral swell of the row (lower tiers may skip that row).
  const torsoRows: readonly [number, number, number, Skin, number][] = [
    [spine[1] + H * 0.017, waistRx, waistRz, waistSkin, 0],
    [
      spine[1] + m.spineLen * 0.4,
      pelvis * 0.89 * form.waist * waistK,
      m.torsoRadius * 0.86 * (1 + 0.3 * belly),
      blend(J('spine'), 0.8, J('chest'), 0.2),
      0,
    ],
    [
      chest[1],
      m.shoulderHalf * 0.94,
      m.torsoRadius * 0.94 * (1 + 0.08 * belly),
      blend(J('spine'), 0.35, J('chest'), 0.65),
      0.012,
    ],
    [
      chest[1] + m.chestLen * 0.35,
      m.shoulderHalf * 0.97,
      m.torsoRadius * 0.96,
      blend(J('spine'), 0.1, J('chest'), 0.9),
      0.026,
    ],
    [chest[1] + m.chestLen * 0.65, m.shoulderHalf * 0.99, m.torsoRadius * 0.9, chestSkin, 0.009],
    [shoulderY, m.shoulderHalf * 1.1, m.torsoRadius * 0.7, chestSkin, 0],
    [neckBaseY, neckR * 1.2, neckR * 1.1, chestSkin, 0],
  ];
  // A bust (feminine adults) or a slight pectoral swell, peaking at 0.45 of the half-width. The
  // `bust` proportion sets it apart from the body form.
  const bust =
    d.age === 'child' ? 0 : (d.proportions.bust ?? (d.features.form === 'feminine' ? 1 : 0.25));
  // The chest row carries the swell; medium detail keeps it only for a bust.
  const tierRows =
    tier === 2 || (tier === 1 && bust < 1) ? torsoRows.filter((_, i) => i !== 3) : torsoRows;
  // A looser top stands off the body: its full ease below the shoulders, half at the shoulder
  // line, none at the neck (exactly the body when fitted).
  const torso =
    top.ease === 1
      ? tierRows
      : tierRows.map((row, i): (typeof torsoRows)[number] => {
          const k =
            i === tierRows.length - 1
              ? 1
              : i === tierRows.length - 2
                ? (1 + top.ease) / 2
                : top.ease;
          return [row[0], row[1] * k, row[2] * k, row[3], row[4]];
        });
  const ARMPIT = torso.length - 3;
  const NECK_ROW = torso.length - 1;
  const bulge = (row: number, across: number): number => {
    const k = (across - 0.45) / 0.27;
    return bust * (torso[row]?.[4] ?? 0) * H * dmath.exp(-k * k);
  };
  /** Front surface depth of a torso row at x (shirt details sit on it). */
  const rowFront = (row: number, x: number): number => {
    const [, rx, rz] = torso[row] as (typeof torso)[number];
    const across = dmath.clamp(dmath.abs(x) / rx, 0, 1);
    const set = row === NECK_ROW ? neckSet : 0;
    return rz * dmath.sqrt(1 - across * across) + bulge(row, across) + set;
  };
  let last: RingRef | undefined;
  const torsoRings: RingRef[] = [];
  const shoulderWidth = near ? 2 : 1;
  const torsoPoint = (row: number, col: number): Vec3 => {
    const [y, rx, rz] = torso[row] as (typeof torso)[number];
    const [ux, uz] = fold(col, sides);
    const c0 = dmath.abs(ux);
    // Lower the axilla while leaving the front of the chest and its pockets level.
    const underarm = row === ARMPIT ? H * 0.035 * dmath.pow(c0, 8) : 0;
    const neckRow = row === NECK_ROW;
    const lift = neckRow ? neckLift(uz) : 0;
    const z = rz * uz + (uz >= 0 ? bulge(row, c0) : 0) + (neckRow ? neckSet : 0);
    return [ux * rx, y - underarm + lift, z];
  };
  for (const [row, [y, , , s]] of torso.entries()) {
    const start = b.mark();
    for (let i = 0; i < sides; i++) b.vertex(torsoPoint(row, i), garment, s);
    const ring = { start, sides, center: [0, y, 0] as Vec3 };
    if (last) {
      for (let i = 0; i < sides; i++) {
        const armhole =
          row > ARMPIT &&
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
  // The armholes are actual boundaries in the torso. Sleeves share these vertices
  // and their normals, so no overlapping cap can form a shoulder-pad seam.
  const boundary: [number, number][] = [];
  const middle = sides / 2;
  for (let i = middle; i >= middle - shoulderWidth; i--) boundary.push([NECK_ROW, i]);
  for (let row = NECK_ROW - 1; row >= ARMPIT; row--) boundary.push([row, middle - shoulderWidth]);
  for (let i = middle - shoulderWidth + 1; i <= middle + shoulderWidth; i++)
    boundary.push([ARMPIT, i]);
  for (let row = ARMPIT + 1; row <= NECK_ROW; row++) boundary.push([row, middle + shoulderWidth]);
  for (let i = middle + shoulderWidth - 1; i > middle; i--) boundary.push([NECK_ROW, i]);
  const shoulderLeft = boundary.map(([row, col]) => (torsoRings[row] as RingRef).start + col);
  const shoulderRight = boundary.map(
    ([row, col]) => (torsoRings[row] as RingRef).start + ((sides / 2 - col + sides) % sides),
  );
  const shoulderPoints: Vec3[] = boundary.map(([row, col]) => torsoPoint(row, col));
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
        b.vertex([x * rx, y + neckLift(z) + rise * f, z * rz + neckSet], color, s);
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
      const low = torso[i - 1] as (typeof torso)[number];
      const high = torso[i] as (typeof torso)[number];
      if (y > high[0] && i < torso.length - 1) continue;
      const t = dmath.clamp((y - low[0]) / (high[0] - low[0]), 0, 1);
      return dmath.lerp(rowFront(i - 1, x), rowFront(i, x), t) + H * 0.004;
    }
    return neckR;
  };
  if (tier < 2 && top.collar === 'shirt') {
    // Subdivide the collar over the curved shoulders so its center cannot clip through.
    for (const side of [-1, 1]) {
      const grid: number[][] = [];
      for (let row = 0; row <= 4; row++) {
        const v = row / 4;
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
      for (let row = 0; row < 4; row++) {
        const high = grid[row] as number[];
        const low = grid[row + 1] as number[];
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
  /**
   * The torso's front at (x, y) on the lofted surface itself. Between two rows the loft joins
   * points of equal angle, so a surface point is one angle and one fraction `t` up the span:
   * its x scales with the interpolated half-width and its height includes the neck line's
   * rise. Solving for `t` keeps a point wider than the narrower row (near the neck) on the
   * slope between them. shirtFront blends depths at a fixed x, which is right only near the
   * middle.
   */
  const frontAt = (x: number, y: number): number => {
    const ax = dmath.abs(x);
    for (let i = 1; i < torso.length; i++) {
      const low = torso[i - 1] as (typeof torso)[number];
      const high = torso[i] as (typeof torso)[number];
      const across = (t: number): number => dmath.clamp(ax / dmath.lerp(low[1], high[1], t), 0, 1);
      const heightAt = (t: number): number => {
        const k = across(t);
        const lift = i === NECK_ROW ? neckLift(dmath.sqrt(1 - k * k)) : 0;
        return dmath.lerp(low[0], high[0] + lift, t);
      };
      if (y > heightAt(1) && i < torso.length - 1) continue;
      let t0 = 0,
        t1 = 1;
      for (let step = 0; step < 24; step++) {
        const mid = (t0 + t1) / 2;
        if (heightAt(mid) < y) t0 = mid;
        else t1 = mid;
      }
      const t = (t0 + t1) / 2;
      const k = across(t);
      const uz = dmath.sqrt(1 - k * k);
      const zLow = low[2] * uz + bulge(i - 1, k);
      const zHigh = high[2] * uz + bulge(i, k) + (i === NECK_ROW ? neckSet : 0);
      return dmath.lerp(zLow, zHigh, t);
    }
    return neckR;
  };
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
    at: (row: number, col: number) => Vec3,
    color: (row: number, col: number) => RGB,
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
    for (const [y] of torso) if (y > bottomY && y < topY) heights.push(y);
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
    sheet(
      rows,
      cols,
      (r, k) => {
        const y = yAt(r);
        const x = dmath.lerp(-openAt(y), openAt(y), k / cols);
        return [x, y, frontAt(x, y) + H * 0.0015];
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
            return [x, y, frontAt(x, y) + H * (0.002 + 0.005 * (1 - u))];
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
      [0, shoulderY + H * 0.006, -m.torsoRadius * 0.66 * top.ease],
      UP,
      [neckR * 1.7, H * 0.026, H * 0.045],
      10,
      4,
      chestSkin,
      hood,
    );
    for (const side of [-1, 1]) {
      const x = side * neckR * 0.45;
      const y0 = neckBaseY - H * 0.06,
        y1 = neckBaseY - H * 0.004;
      const z = dmath.max(frontAt(x, y0), frontAt(x, y1)) + H * 0.002;
      b.box(
        'top',
        [x - H * 0.0012, y0, z],
        [x + H * 0.0012, y1, z + H * 0.0015],
        chestSkin,
        tint(garment, 1.35),
      );
    }
  }
  // The neck tapers a little and leans forward from its set-back base to under the skull,
  // ending inside the head above the jaw angle.
  const neckTopY = head[1] + m.headLen * 0.28;
  const neckCenterZ = (y: number): number =>
    neckSet * dmath.clamp((neckTopY - y) / (neckTopY - neckBaseY), 0, 1);
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
  /** Height of a torso row at the back (the neck line rises behind). */
  const backY = (row: number, x: number): number => {
    const [y, rx] = torso[row] as (typeof torso)[number];
    if (row !== NECK_ROW) return y;
    const k = dmath.clamp(dmath.abs(x) / rx, 0, 1);
    return y + neckLift(-dmath.sqrt(1 - k * k));
  };
  /** How far behind the axis the back is at (x, y): the torso, then the neck above it. */
  const backAt = (x: number, y: number): number => {
    if (y >= backY(NECK_ROW, x)) {
      // The actual neck: tapering from its base to under the skull, set back at its base.
      const u = dmath.clamp((y - neck[1]) / (neckTopY - neck[1]), 0, 1);
      const rx = neckR * dmath.lerp(1, 0.88, u);
      const k = dmath.clamp(dmath.abs(x) / (rx * 1.1), 0, 1);
      return neckR * dmath.lerp(0.94, 0.88, u) * 1.04 * dmath.sqrt(1 - k * k) - neckCenterZ(y);
    }
    for (let i = 1; i < torso.length; i++) {
      const low = torso[i - 1] as (typeof torso)[number];
      const high = torso[i] as (typeof torso)[number];
      const lowY = backY(i - 1, x);
      const highY = backY(i, x);
      if (y > highY && i < torso.length - 1) continue;
      const t = dmath.clamp((y - lowY) / (highY - lowY), 0, 1);
      const rx = dmath.lerp(low[1], high[1], t);
      const k = dmath.clamp(dmath.abs(x) / rx, 0, 1);
      const set = i === NECK_ROW ? -neckSet * t : 0;
      return dmath.lerp(low[2], high[2], t) * dmath.sqrt(1 - k * k) + set;
    }
    return 0;
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
          backAt(x, y) +
          (pack.gap + pack.depth) *
            dmath.smoothstep(dmath.clamp((pack.top + 0.012 * H - y) / (0.03 * H), 0, 1))
      : backAt;
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
      const depth = clearAt(y);
      const thick = end ? H * 0.002 : H * dmath.lerp(0.004, 0.006 + 0.004 * (1 - v), fill(v));
      const wChest = dmath.smoothstep(dmath.clamp((v - 0.08) / 0.6, 0, 1));
      const weights = blend(J('head'), 1 - wChest, J('chest'), wChest);
      const start = b.mark();
      for (let i = 0; i < ringSides; i++) {
        const angle = (dmath.TAU * i) / ringSides;
        const x = hw * dmath.cos(angle);
        const k2 = x / (1.3 * hw);
        const inner = dmath.max(depth * dmath.sqrt(1 - k2 * k2), hairBack(x, y) + gap);
        const z = -(inner + thick * (1 + dmath.sin(angle)) * 0.5);
        const strand = 1 + 0.1 * dmath.sin(x * 140 + v * 3);
        b.vertex([x, y, z], tint(hairColor, strand * (1 - 0.08 * v)), weights);
      }
      const ring = { start, sides: ringSides, center: [0, y, -depth] as Vec3 };
      if (prev) b.loft('hair', prev, ring);
      else b.cap('hair', ring, weights, hairColor, undefined, false);
      if (end) b.cap('hair', ring, weights, hairColor, [0, y - H * 0.004, -depth - thick]);
      prev = ring;
    }
  }

  // A button placket follows the torso surface and shares its skin weights.
  if (tier < 2 && top.placket !== 'none') {
    let strip: [number, number] | undefined;
    for (const [row, [y, , , s]] of torso.entries()) {
      // A polo's placket runs from the collar to mid-chest.
      if (top.placket === 'short' && y < chest[1] + m.chestLen * 0.6) continue;
      const x = H * 0.007;
      const z = rowFront(row, x) + H * 0.001;
      const a = b.vertex([-x, y, z], tint(c.top, 0.82), s);
      const c0 = b.vertex([x, y, z], tint(c.top, 0.82), s);
      if (strip) b.quad('top', strip[0], strip[1], c0, a);
      strip = [a, c0];
      if (near)
        b.disc(
          'accent',
          [0, y + H * 0.002, z + H * 0.001],
          [0, 0, 1],
          H * 0.0018,
          8,
          s,
          tint(c.accent, 0.7),
        );
    }
  }
  if (top.pouch && tier < 2) {
    // A hoodie's pouch pocket across the belly, wider at the bottom, its top edge darker.
    const y0 = spine[1] + H * 0.024,
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
  const mark = b.mark();
  if (near && bust < 1 && top.pockets) {
    // Patch pockets conform to the chest instead of floating rectangular blocks.
    const x0 = m.shoulderHalf * 0.2,
      x1 = m.shoulderHalf * 0.58;
    const y0 = chest[1] + m.chestLen * 0.22,
      y1 = y0 + H * 0.036;
    const patch = (x: number, y: number, color: RGB): number => {
      const t = dmath.clamp((y - chest[1]) / (m.chestLen * 0.65), 0, 1);
      const weight = 0.35 * (1 - t);
      return b.vertex(
        [x, y, shirtFront(x, y)],
        color,
        blend(J('spine'), weight, J('chest'), 1 - weight),
      );
    };
    for (let row = 0; row < 3; row++) {
      const low = dmath.lerp(y0, y1, row / 3);
      const high = dmath.lerp(y0, y1, (row + 1) / 3);
      for (let col = 0; col < 6; col++) {
        const left = dmath.lerp(x0, x1, col / 6),
          right = dmath.lerp(x0, x1, (col + 1) / 6);
        b.quad(
          'top',
          patch(left, low, tint(c.top, 0.94)),
          patch(right, low, tint(c.top, 0.94)),
          patch(right, high, tint(c.top, 0.94)),
          patch(left, high, tint(c.top, 0.94)),
        );
        if (row === 2)
          b.quad(
            'top',
            patch(left, y1 - H * 0.002, tint(c.top, 0.72)),
            patch(right, y1 - H * 0.002, tint(c.top, 0.72)),
            patch(right, y1, tint(c.top, 0.72)),
            patch(left, y1, tint(c.top, 0.72)),
          );
      }
    }
  }
  const A = P('upperArm.l'),
    E = P('foreArm.l'),
    W = P('hand.l');
  const armDir = direction(A, E);
  const lowerDir = direction(E, W);
  // Keep volume through the elbow and taper gradually into the forearm. A narrow
  // elbow followed by a wider forearm exaggerates an hourglass shape under skinning.
  const armSections: readonly [number, number][] = near
    ? [
        [0.22, 1.02],
        [0.4, 0.99],
        [0.5, 0.94],
        [0.8, 0.89],
        [0.94, 0.87],
        [1, 0.86],
        [1.07, 0.85],
        [1.25, 0.8],
        [1.5, 0.74],
        [1.8, 0.62],
        [2, 0.56],
      ]
    : [
        [0.22, 1.02],
        [0.5, 0.94],
        [1, 0.86],
        [1.35, 0.78],
        [2, 0.56],
      ];
  // A consistent frame keeps the outer deltoid and the forearm on the same meridian.
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
    for (let i = 0; i < limbSides; i++) {
      const angle = (dmath.TAU * i) / limbSides;
      const across = rx * dmath.cos(angle);
      const offset: Vec3 = [-axis[1] * across, axis[0] * across, rz * dmath.sin(angle)];
      const p = rotation ? quatRotateVec3(rotation, offset) : offset;
      b.vertex([center[0] + p[0], center[1] + p[1], center[2] + p[2]], color, s);
    }
    return { start, sides: limbSides, center };
  };
  last = undefined;
  let previousRegion: FigureRegion | undefined;
  let sleeveBridge: RingRef | undefined;
  for (const [t, r] of armSections.filter(
    ([t]) => tier < 2 || t === 0.22 || t === 0.5 || t === 1 || t === 2,
  )) {
    const center = t <= 1 ? mix(A, E, t) : mix(E, W, t - 1);
    center[0] += H * 0.004 * dmath.clamp((1 - t) / 0.78, 0, 1);
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
    if (last && previousRegion !== region) {
      const edge = armRing(last.center, axis, armR * r, armR * r, s, color);
      b.loft(previousRegion as FigureRegion, last, edge);
      last = edge;
    }
    const radius = armR * r * (region === 'skin' ? 0.91 : 1.03 * top.ease);
    const wristBlend = dmath.clamp((t - 1.8) / 0.2, 0, 1);
    const rx = dmath.lerp(radius, m.handLen * 0.105, wristBlend);
    const rz = dmath.lerp(radius * 0.94, m.handLen * 0.18, wristBlend);
    if (!last) {
      const seam =
        region === 'skin'
          ? shoulderPoints.map((point) => b.vertex(point, color, chestSkin))
          : shoulderLeft;
      const steps = near ? 5 : tier === 1 ? 3 : 2;
      for (let step = 1; step < steps; step++) {
        const u = step / steps;
        const start = b.mark();
        for (let i = 0; i < limbSides; i++) {
          const angle = (dmath.TAU * i) / limbSides;
          const across = rx * dmath.cos(angle);
          const target: Vec3 = [
            center[0] - axis[1] * across,
            center[1] + axis[0] * across,
            rz * dmath.sin(angle),
          ];
          // The top of the sleeve slopes gently off the neck (trapezius), crests at the
          // acromion and rounds the deltoid down into the arm: a cubic through that corner,
          // straight under the arm. A bulge on a straight neck-to-arm line read as a pad.
          const from = shoulderPoints[i] as Vec3;
          const outer = dmath.max(0, dmath.cos(angle)) ** 2;
          const corner: Vec3 = [
            target[0] + H * 0.002,
            shoulderY + H * 0.009,
            (from[2] + target[2]) / 2,
          ];
          // The trapezius is concave: it falls steeply off the neck, then flattens outward.
          const slope: Vec3 = [
            dmath.lerp(from[0], corner[0], 0.3),
            dmath.lerp(from[1], corner[1], 0.75),
            dmath.lerp(from[2], corner[2], 0.4),
          ];
          const c1 = mix(mix(from, target, 1 / 3), slope, outer);
          const c2 = mix(mix(from, target, 2 / 3), corner, outer);
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
        const bridge = { start, sides: limbSides, center };
        if (last) b.loft(region, last, bridge);
        else {
          sleeveBridge = bridge;
          for (let i = 0; i < limbSides; i++) {
            const next = (i + 1) % limbSides;
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

  const hipJoint = P('upperLeg.l'),
    K = P('lowerLeg.l'),
    ankle = P('foot.l');
  const legSections: readonly [number, number][] = near
    ? [
        [0.12, 1.42],
        [0.15, 1.48],
        [0.4, 1.32],
        [0.5, 1.21],
        [0.78, 0.99],
        [0.94, 0.91],
        [1, 0.94],
        [1.08, 0.94],
        [1.3, 1.07],
        [1.55, 0.91],
        [1.8, 0.69],
        [1.94, 0.64],
      ]
    : [
        [0.12, 1.42],
        [0.25, 1.42],
        [0.5, 1.21],
        [1, 0.94],
        [1.35, 1.04],
        [1.94, 0.64],
      ];
  // Each pant leg grows out of half of the waistband. The inner halves meet along
  // the crotch seam, avoiding overlapping pelvis/thigh shells and the old diaper silhouette.
  // Under a skirt the legs are bare (a striding thigh shows skin) and need no color seam.
  const skirt = d.features.legs === 'skirt' || dress;
  const bare = legwearBareFrom(d.features.legs, skirt);
  const yokeStart = b.mark();
  const waistY = spine[1] + H * 0.014;
  const crotchY = hips[1] - H * 0.045;
  // The yoke's top stays inside the waist, so a wide seat or narrow waist cannot push it
  // through a skirt, a dress or a hem. Bodies without shape proportions or a chosen top are
  // drawn as they always were.
  const fitted =
    d.features.top !== undefined ||
    d.proportions.waist !== undefined ||
    d.proportions.seat !== undefined ||
    d.proportions.belly !== undefined;
  const yokeX = fitted ? dmath.min(pelvis * 0.9 * seatK, waistRx * 0.96) : pelvis * 0.9 * seatK;
  const yokeZ = fitted
    ? dmath.min(m.torsoRadius * 0.8 * bellyWaist * seatK, waistRz * 0.94)
    : m.torsoRadius * 0.8 * bellyWaist * seatK;
  for (let i = 0; i < limbSides; i++) {
    const angle = (dmath.TAU * i) / limbSides;
    const x = dmath.cos(angle);
    const z = dmath.sin(angle);
    const y = x >= 0 ? waistY : dmath.lerp(waistY, crotchY, -x);
    b.vertex(
      [dmath.max(0, x) * yokeX, y, z * yokeZ],
      skirt ? c.skin : c.bottom,
      x >= 0 ? waistSkin : skin(J('hips')),
    );
  }
  last = { start: yokeStart, sides: limbSides, center: [hipJoint[0], waistY, 0] };
  previousRegion = skirt ? 'skin' : 'bottom';
  const legStations = legSections.filter(
    ([t]) => tier < 2 || t === 0.12 || t === 0.5 || t === 1 || t === 1.94,
  );
  for (const [t, r] of legStations) {
    const center = t <= 1 ? mix(hipJoint, K, t) : mix(K, ankle, t - 1);
    const region = t > bare ? 'skin' : 'bottom';
    const color = region === 'skin' ? c.skin : c.bottom;
    const s =
      t < 0.15
        ? blend(J('hips'), 0.25, J('upperLeg.l'), 0.75)
        : t < 0.8
          ? skin(J('upperLeg.l'))
          : t < 1.2
            ? blend(J('upperLeg.l'), (1.2 - t) / 0.4, J('lowerLeg.l'), (t - 0.8) / 0.4)
            : skin(J('lowerLeg.l'));
    // Seat fullness tapers out down the thigh (exactly 1 when the proportion is absent).
    const seatLeg = 1 + (seatK - 1) * dmath.max(0, 1 - t / 0.6);
    const radius =
      m.limbRadius * r * (region === 'skin' ? 0.88 : legwearRadius(d.features.legs, t)) * seatLeg;
    if (last && previousRegion !== region) {
      const edge = b.ring(region, last.center, DOWN, radius, radius * 1.06, limbSides, s, color);
      b.loft(previousRegion as FigureRegion, last, edge);
      last = edge;
    }
    const ring = b.ring(region, center, DOWN, radius, radius * 1.06, limbSides, s, color);
    if (last) b.loft(region, last, ring);
    else b.cap(region, ring, s, color, undefined, false);
    last = ring;
    previousRegion = region;
  }
  if (last)
    b.cap(
      previousRegion as FigureRegion,
      last,
      skin(J('lowerLeg.l')),
      previousRegion === 'skin' ? c.skin : c.bottom,
    );
  let footwear: HumanShoeStyle | undefined;
  if (d.features.footwear !== undefined) {
    // A boot's shaft clears the leg where it ends (the plain leg: wide trousers fall over it).
    const shaftY = ankle[1] + H * 0.09;
    const t = 1 + dmath.clamp((K[1] - shaftY) / (K[1] - ankle[1]), 0, 1);
    let r = (legStations[legStations.length - 1] as [number, number])[1];
    for (let i = 1; i < legStations.length; i++) {
      const [t0, r0] = legStations[i - 1] as [number, number];
      const [t1, r1] = legStations[i] as [number, number];
      if (t <= t1) {
        r = dmath.lerp(r0, r1, dmath.clamp((t - t0) / (t1 - t0), 0, 1));
        break;
      }
    }
    footwear = {
      style: d.features.footwear,
      shaft: skin(J('lowerLeg.l')),
      legRadius: m.limbRadius * r * (t > bare ? 0.88 : 1),
      skin: c.skin,
      ...(d.features.legs === 'wide' && t <= bare ? { covered: true } : {}),
    };
  }
  buildHumanShoe(b, ankle, m.footLen, H, skin(J('foot.l')), c.shoes, tier, footwear);
  const mirrorOffset = b.mark() - mark;
  b.mirrorX(mark, (joint) => jointIndex(rig, mirrorName(rig.joints[joint]?.name ?? 'root')));
  // mirrorX copies the arm but deliberately skips faces sharing pre-mark torso vertices.
  if (sleeveBridge && d.features.sleeves !== 'none') {
    const start = sleeveBridge.start + mirrorOffset;
    for (let i = 0; i < limbSides; i++) {
      const next = (i + 1) % limbSides;
      b.quad(
        'sleeves',
        shoulderRight[next] as number,
        shoulderRight[i] as number,
        start + i,
        start + next,
      );
    }
  }
  if (covered) {
    // A hem below the waist: a sweater's ribbed band over the belt, a jacket to the hip, a
    // coat to mid-thigh. It continues the torso's bottom ring (shared vertices, so no seam)
    // down over the trousers on the skirt's profile, follows the thighs below the hips as the
    // skirt does, and rolls inward at its edge so it is never open from below.
    const hip = P('upperLeg.l'),
      knee = P('lowerLeg.l');
    const skirtHem = knee[1] + H * 0.035;
    const seatTop = 1 + (seatK - 1) * 0.8;
    const hipR = dmath.max(pelvis * seatK, m.hipHalf + m.limbRadius * 1.48 * seatTop) + H * 0.006;
    const seat = m.torsoRadius * 0.98 * seatK + H * 0.006;
    const waistTop = (torso[0] as (typeof torso)[number])[0];
    const upperHip = hips[1] + m.hipsLen * 0.35;
    const hipLine = hips[1] - H * 0.02;
    const lerp2 = (a: [number, number], b2: [number, number], t: number): [number, number] => [
      dmath.lerp(a[0], b2[0], t),
      dmath.lerp(a[1], b2[1], t),
    ];
    const atWaist: [number, number] = [waistRx, waistRz];
    const atUpperHip: [number, number] = [dmath.lerp(waistRx, hipR, 0.75), seat * 0.95];
    /** Half-width and half-depth of the hem's profile at a height (before ease). */
    const profile = (y: number): [number, number] => {
      if (y >= upperHip)
        return lerp2(
          atWaist,
          atUpperHip,
          dmath.clamp((waistTop - y) / (waistTop - upperHip), 0, 1),
        );
      if (y >= hipLine)
        return lerp2(atUpperHip, [hipR, seat], (upperHip - y) / (upperHip - hipLine));
      const v = dmath.clamp((hipLine - y) / (hipLine - skirtHem), 0, 1);
      return [hipR * (1 + 0.1 * v), seat * (1 + 0.08 * v)];
    };
    const legL = J('upperLeg.l'),
      legR = J('upperLeg.r'),
      hipsJ = J('hips'),
      spineJ = J('spine');
    const hemSkin = (x: number, y: number, rx: number): Skin => {
      if (y > hips[1]) {
        // Up to the torso's bottom ring, whose weights it meets.
        const a = dmath.clamp((y - hips[1]) / (waistTop - hips[1]), 0, 1);
        return blend(hipsJ, 1 - 0.6 * a, spineJ, 0.6 * a);
      }
      const v = dmath.clamp((hips[1] - y) / (hips[1] - skirtHem), 0, 1);
      const thigh = dmath.clamp(dmath.abs(dmath.abs(x) - hip[0]) / (0.6 * rx), 0, 1);
      const w = dmath.smoothstep(v) * (0.85 - 0.5 * thigh);
      return blend(hipsJ, 1 - w, x >= 0 ? legL : legR, w);
    };
    const hemRing = (y: number, k: number, color: RGB): RingRef => {
      const [px, pz] = profile(y);
      const rx = px * top.ease * k,
        rz = pz * top.ease * k;
      const start = b.mark();
      for (let i = 0; i < sides; i++) {
        const [ux, uz] = fold(i, sides);
        b.vertex([ux * rx, y, uz * rz], color, hemSkin(ux * rx, y, rx));
      }
      return { start, sides, center: [0, y, 0] };
    };
    // [height, scale over the profile, color]; the last station is the rolled inner hem.
    const stations: [number, number, RGB][] = [];
    if (top.hem === 'band') {
      const rib = tint(garment, 0.86);
      const bottom = upperHip;
      const bandTop = dmath.min(bottom + H * 0.022, dmath.lerp(bottom, waistTop, 0.6));
      // Near, the band starts on a crisp line; further away its color blends in.
      if (tier < 2) stations.push([bandTop, 1, garment]);
      if (near) stations.push([bandTop - H * 0.001, 1.012, rib]);
      stations.push([bottom, 1.012, rib]);
    } else {
      const hemY = top.hem === 'hip' ? hips[1] - H * 0.035 : dmath.lerp(hips[1], knee[1], 0.55);
      // The skirt keeps its upper-hip station at medium detail; a hem over it must too, or its
      // straight span from the waist would pass inside the skirt's curve.
      if (near || (tier === 1 && skirt)) stations.push([upperHip, 1, garment]);
      stations.push([hipLine, 1, garment]);
      if (top.hem === 'thigh' && tier < 2)
        stations.push([dmath.lerp(hipLine, hemY, 0.5), 1, garment]);
      stations.push([hemY, 1, garment]);
    }
    let prev = torsoRings[0] as RingRef;
    for (const [y, k, color] of stations) {
      const ring = hemRing(y, k, color);
      b.loft('top', ring, prev);
      prev = ring;
    }
    if (tier < 2) {
      const [y, k, color] = stations[stations.length - 1] as [number, number, RGB];
      const inner = hemRing(y + H * 0.004, k * 0.96, tint(color, 0.7));
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
    const hip = P('upperLeg.l'),
      knee = P('lowerLeg.l');
    const hemY = knee[1] + H * 0.035;
    // Clear the tops of the thighs (1.48 limb radii), which stand wider than the pelvis.
    const seatTop = 1 + (seatK - 1) * 0.8;
    const hipR = dmath.max(pelvis * seatK, m.hipHalf + m.limbRadius * 1.48 * seatTop) + H * 0.006;
    const seat = m.torsoRadius * 0.98 * seatK + H * 0.006;
    const allStations: readonly [number, number, number][] = [
      // [y, half-width, half-depth]
      [spine[1] + H * 0.012, waistRx * 0.99, waistRz * 0.96],
      [hips[1] + m.hipsLen * 0.35, dmath.lerp(waistRx, hipR, 0.75), seat * 0.95],
      [hips[1] - H * 0.02, hipR, seat],
      [dmath.lerp(hips[1], hemY, 0.55), hipR * 1.04, seat * 1.03],
      [hemY, hipR * 1.1, seat * 1.08],
      [hemY + H * 0.004, hipR * 1.05, seat * 1.02],
    ];
    // Medium detail drops the mid-thigh station; distant detail keeps waist, hip and hem.
    const stations = near
      ? allStations
      : allStations.filter((_, i) => (tier === 1 ? i !== 3 : i === 0 || i === 2 || i === 4));
    const legL = J('upperLeg.l'),
      legR = J('upperLeg.r'),
      hipsJ = J('hips');
    let prev: RingRef | undefined;
    for (const [k, [y, rx, rz]] of stations.entries()) {
      const v = dmath.clamp((hips[1] - y) / (hips[1] - hemY), 0, 1);
      const inner = tier < 2 && k === stations.length - 1;
      const start = b.mark();
      for (let i = 0; i < sides; i++) {
        const [cx, sz] = circle(sides, i);
        const pleat = near && !inner ? 1 + 0.025 * v * v * dmath.cos(8 * dmath.acos(cx)) : 1;
        const x = cx * rx * pleat;
        const thigh = dmath.clamp(dmath.abs(dmath.abs(x) - hip[0]) / (0.6 * rx), 0, 1);
        const w = dmath.smoothstep(v) * (0.85 - 0.5 * thigh);
        b.vertex(
          [x, y, sz * rz * pleat],
          tint(fabric, inner ? 0.7 : 1 - 0.08 * v),
          blend(hipsJ, 1 - w, x >= 0 ? legL : legR, w),
        );
      }
      const ring = { start, sides, center: [0, y, 0] as Vec3 };
      if (prev) {
        if (inner) {
          // The rolled hem turns inward: loft in the opposite order to face down and in.
          b.loft('bottom', ring, prev);
        } else b.loft('bottom', prev, ring);
      }
      prev = ring;
    }
  }

  const f = d.features;
  if (f.neckwear || f.backwear || f.bag || f.wristwear) {
    // Body accessories sit on the torso as built here, garment included.
    const insideTorso = (p: Vec3): boolean => {
      const [x, y, z] = p;
      const first = torso[0] as (typeof torso)[number];
      if (y < first[0] || y > (torso[NECK_ROW] as (typeof torso)[number])[0] + neckRise)
        return false;
      for (let i = 1; i < torso.length; i++) {
        const low = torso[i - 1] as (typeof torso)[number];
        const high = torso[i] as (typeof torso)[number];
        if (y > high[0] && i < torso.length - 1) continue;
        const t = dmath.clamp((y - low[0]) / (high[0] - low[0]), 0, 1);
        const rx = dmath.lerp(low[1], high[1], t);
        if (dmath.abs(x) >= rx) return false;
        const k = dmath.abs(x) / rx;
        const zf = z - (i === NECK_ROW ? neckSet * t : 0);
        const depth = dmath.lerp(low[2], high[2], t) * dmath.sqrt(1 - k * k);
        const swell = zf >= 0 ? dmath.lerp(bulge(i - 1, k), bulge(i, k), t) : 0;
        return dmath.abs(zf) <= depth + swell;
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
    const seatTop = 1 + (seatK - 1) * 0.8;
    const hipR = dmath.max(pelvis * seatK, m.hipHalf + m.limbRadius * 1.48 * seatTop) + H * 0.006;
    const garmentEase = covered ? top.ease : 1;
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
      waistRz: waistRz * garmentEase,
      hipsY: hips[1],
      hipRx: hipR * garmentEase,
      hipRz: (m.torsoRadius * 0.98 * seatK + H * 0.006) * garmentEase,
    });
  }
}
