/**
 * Human accessories on the one skinned body mesh: hats, glasses, headphones, a scarf, a
 * backpack, a crossbody bag and a watch. Each is optional (`features.headwear`, `eyewear`, …,
 * absent = not worn), takes its color from the palette key of its name (a default when absent),
 * and is drawn in the `gear` region, skinned to the joint it rides on.
 *
 * Head pieces sit on the head as built (`HumanHeadSurface` from body-human-head.ts): a hat's
 * band clears the hair just under it and the hair shell stops inside that band (`hatBand`, read
 * by the hair builder), so any of the 18 styles fits under any hat; headphones clear the hair
 * and the hat. Body pieces sit on the torso through `HumanTorsoContext` (body-biped.ts), whose
 * surface queries include the garment worn, so a scarf rides a hood and straps lie on a coat.
 *
 * Gotchas: shapes are oriented by an explicit outward direction per face (`quadFacing`), since
 * several are open sheets (brims, straps, rims) that must face out at every tier. Everything
 * here runs only when its feature is present, so bodies without accessories are unchanged.
 */

import { dmath, type Vec3 } from '@bendyline/molen-kernel/determinism';
import type { HumanHeadSurface } from './body-human-head';
import { parseColor, type RGB } from './color';
import {
  blend,
  type FigureRegion,
  type FigureTier,
  type RingRef,
  type Skin,
  type SkinnedMeshBuilder,
} from './skinned-mesh-builder';
import type { FigureHeadwearStyle, ResolvedFigureDescriptor } from './types';

/** The palette keys accessories take their colors from. */
export type FigureAccessoryKey =
  | 'headwear'
  | 'eyewear'
  | 'neckwear'
  | 'backwear'
  | 'earwear'
  | 'wristwear'
  | 'bag';

/** Colors of accessories without a palette entry. */
export const FIGURE_ACCESSORY_DEFAULT_COLORS: Readonly<Record<FigureAccessoryKey, string>> = {
  headwear: '#2f3b52',
  eyewear: '#1f1d1b',
  neckwear: '#8a3b2e',
  backwear: '#3e4c3a',
  earwear: '#1d1d1f',
  wristwear: '#2b2522',
  bag: '#6b4a2f',
};

const REGION: FigureRegion = 'gear';

export function accessoryColor(d: ResolvedFigureDescriptor, key: FigureAccessoryKey): RGB {
  return parseColor(d.palette[key] ?? FIGURE_ACCESSORY_DEFAULT_COLORS[key]);
}

/**
 * Where a hat's lower edge meets the head, as t above the chin (0 chin, 1 crown), at `c` (the
 * cosine of the angle round the head: 1 front, 0 sides, −1 back). A cap and a sun hat sit above
 * the brows and the ears; a beanie comes lower behind.
 */
export function hatBand(style: FigureHeadwearStyle, c: number): number {
  const [back, side, front] =
    style === 'beanie'
      ? [0.5, 0.585, 0.62]
      : style === 'cap'
        ? [0.6, 0.63, 0.665]
        : [0.6, 0.625, 0.66];
  return c >= 0 ? dmath.lerp(side, front, c) : dmath.lerp(side, back, -c);
}

// --- small vector and face helpers -------------------------------------------------------

const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const scale = (a: Vec3, k: number): Vec3 => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const normalize = (a: Vec3): Vec3 => {
  const l = dmath.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
const shade = (c: RGB, k: number): RGB => [c[0] * k, c[1] * k, c[2] * k];
const mixRgb = (a: RGB, b: RGB, t: number): RGB => [
  dmath.lerp(a[0], b[0], t),
  dmath.lerp(a[1], b[1], t),
  dmath.lerp(a[2], b[2], t),
];

/** A vertex and where it is (the builder does not hand positions back). */
interface V {
  id: number;
  p: Vec3;
}

function vtx(b: SkinnedMeshBuilder, p: Vec3, color: RGB, s: Skin): V {
  return { id: b.vertex(p, color, s), p };
}

/** A quad a→c→e→f whose front faces `want` (its winding is flipped when it would not). */
function quadFacing(b: SkinnedMeshBuilder, a: V, c: V, e: V, f: V, want: Vec3): void {
  const n = add(cross(sub(c.p, a.p), sub(e.p, a.p)), cross(sub(e.p, a.p), sub(f.p, a.p)));
  if (dot(n, want) >= 0) b.quad(REGION, a.id, c.id, e.id, f.id);
  else b.quad(REGION, a.id, f.id, e.id, c.id);
}

function triFacing(b: SkinnedMeshBuilder, a: V, c: V, e: V, want: Vec3): void {
  const n = cross(sub(c.p, a.p), sub(e.p, a.p));
  if (dot(n, want) >= 0) b.triangle(REGION, a.id, c.id, e.id);
  else b.triangle(REGION, a.id, e.id, c.id);
}

/** Quads between two rows of vertices, each facing `want(row, col)`. */
function bridge(
  b: SkinnedMeshBuilder,
  lower: readonly V[],
  upper: readonly V[],
  want: (k: number) => Vec3,
  closed = false,
): void {
  const n = closed ? lower.length : lower.length - 1;
  for (let k = 0; k < n; k++) {
    const j = (k + 1) % lower.length;
    quadFacing(b, lower[k] as V, lower[j] as V, upper[j] as V, upper[k] as V, want(k));
  }
}

/**
 * A rectangular bar along `path`: at each station a cross-section `halfW` across (on the
 * `side` axis) and `halfH` deep (on the `up` axis, perpendicular to the path), capped at both
 * ends. Used for frames and the headphone band. `flat` draws only the outer face (`halfH` out
 * along `up`): a strap lying on the body, whose other faces never show.
 */
function sweep(
  b: SkinnedMeshBuilder,
  path: readonly Vec3[],
  up: (k: number) => Vec3,
  halfW: number,
  halfH: number,
  color: RGB,
  skinAt: (k: number) => Skin,
  flat = false,
): void {
  const rings: V[][] = [];
  const frames: { u: Vec3; w: Vec3; t: Vec3 }[] = [];
  for (let k = 0; k < path.length; k++) {
    const p = path[k] as Vec3;
    const t = normalize(
      sub(path[dmath.min(path.length - 1, k + 1)] as Vec3, path[dmath.max(0, k - 1)] as Vec3),
    );
    const hint = up(k);
    const u = normalize(sub(hint, scale(t, dot(hint, t))));
    const w = cross(t, u);
    frames.push({ u, w, t });
    const s = skinAt(k);
    if (flat) {
      rings.push([
        vtx(b, add(p, add(scale(u, halfH), scale(w, halfW))), color, s),
        vtx(b, add(p, add(scale(u, halfH), scale(w, -halfW))), color, s),
      ]);
      continue;
    }
    rings.push([
      vtx(b, add(p, add(scale(u, halfH), scale(w, halfW))), color, s),
      vtx(b, add(p, add(scale(u, halfH), scale(w, -halfW))), color, s),
      vtx(b, add(p, add(scale(u, -halfH), scale(w, -halfW))), shade(color, 0.8), s),
      vtx(b, add(p, add(scale(u, -halfH), scale(w, halfW))), shade(color, 0.8), s),
    ]);
  }
  if (flat) {
    for (let k = 0; k + 1 < rings.length; k++) {
      const [a, c] = rings[k] as [V, V];
      const [e, g] = rings[k + 1] as [V, V];
      quadFacing(b, a, c, g, e, (frames[k] as { u: Vec3 }).u);
    }
    return;
  }
  for (let k = 0; k + 1 < rings.length; k++) {
    const f = frames[k] as { u: Vec3; w: Vec3 };
    const outward = [f.u, scale(f.w, -1), scale(f.u, -1), f.w];
    bridge(b, rings[k] as V[], rings[k + 1] as V[], (side) => outward[side] as Vec3, true);
  }
  const first = rings[0] as V[];
  const last = rings[rings.length - 1] as V[];
  quadFacing(
    b,
    first[0] as V,
    first[1] as V,
    first[2] as V,
    first[3] as V,
    scale((frames[0] as { t: Vec3 }).t, -1),
  );
  quadFacing(
    b,
    last[0] as V,
    last[1] as V,
    last[2] as V,
    last[3] as V,
    (frames[frames.length - 1] as { t: Vec3 }).t,
  );
}

// --- head ------------------------------------------------------------------------------------

/** How far a hat stands off the skull (head widths) at (c, t); 0 below its band or without one. */
export type HatOffset = (c: number, t: number) => number;

/**
 * Hats, glasses and headphones, on the head joint (`s`). Call after the head and hair are
 * built (buildHumanHead returns the surface).
 */
export function buildHeadAccessories(
  d: ResolvedFigureDescriptor,
  head: HumanHeadSurface,
  tier: FigureTier,
  b: SkinnedMeshBuilder,
  s: Skin,
): void {
  const hat = d.features.headwear;
  const hatOffset = hat
    ? buildHat(hat, head, tier, b, s, accessoryColor(d, 'headwear'))
    : undefined;
  if (d.features.eyewear !== undefined)
    buildEyewear(
      d.features.eyewear === 'sunglasses',
      head,
      tier,
      b,
      s,
      accessoryColor(d, 'eyewear'),
    );
  if (d.features.earwear === 'headphones')
    buildHeadphones(head, tier, b, s, accessoryColor(d, 'earwear'), hatOffset, hat === 'sunhat');
}

function buildHat(
  style: FigureHeadwearStyle,
  head: HumanHeadSurface,
  tier: FigureTier,
  b: SkinnedMeshBuilder,
  s: Skin,
  color: RGB,
): HatOffset {
  const near = tier === 0;
  const { W, L, baseY } = head;
  const sides = near ? 20 : tier === 1 ? 12 : 8;
  // Two rows at least: one straight span from the band would cut inside a bare crown.
  const rows = near ? 5 : 2;
  /** Ring column → angle round the head and side, folded as the hair shell is. */
  const fold = (i: number): [number, number] => [
    (dmath.TAU * (i <= sides / 2 ? i : sides - i)) / sides,
    i <= sides / 2 ? 1 : -1,
  ];
  // The band clears the hair at and just under it, plus the fabric; above, the hair is pressed
  // flat, so the crown comes down close to the skull.
  let hairUnder = 0;
  for (let k = 0; k <= 12; k++) {
    const c = dmath.cos((dmath.PI * k) / 12);
    const tb = hatBand(style, c);
    for (const dt of [-0.03, 0, 0.02, 0.045])
      hairUnder = dmath.max(hairUnder, head.hair(c, tb + dt));
  }
  const knit = style === 'beanie';
  const bandOff = hairUnder + (knit ? 0.03 : 0.022);
  const crownOff = dmath.max(0.035, dmath.min(bandOff, 0.07)) + (knit ? 0.06 : 0);
  /** A beanie slouches: extra fullness toward the back of the crown. */
  const slouch = (a: number, f: number): number =>
    knit ? 0.07 * dmath.smoothstep(f) * dmath.max(0, -dmath.cos(a)) : 0;
  // Rows climb from the band toward the crown, closing with a fan at the top.
  const tAt = (c: number, f: number): number => dmath.lerp(hatBand(style, c), 1, f);
  const offAt = (f: number): number => dmath.lerp(bandOff, crownOff, dmath.smoothstep(f));
  const reach = 0.93;
  const center: Vec3 = [0, baseY + 0.55 * L, -0.08 * W];
  const out = (p: Vec3): Vec3 => normalize(sub(p, center));
  const rib = (a: number): number => (knit && near ? 1 + 0.06 * dmath.cos(a * 18) : 1);
  const panel = (a: number): number =>
    style === 'cap' && near ? 1 - 0.05 * dmath.pow(dmath.cos(a * 3), 8) : 1;
  const ring = (f: number, extra = 0, tint = 1): V[] => {
    const vs: V[] = [];
    for (let i = 0; i < sides; i++) {
      const [a, sign] = fold(i);
      const p = head.shell(a, sign, tAt(dmath.cos(a), f), offAt(f) + extra + slouch(a, f));
      vs.push(vtx(b, p, shade(color, tint * rib(a) * panel(a)), s));
    }
    return vs;
  };
  const dome: V[][] = [];
  for (let r = 0; r <= rows; r++) dome.push(ring((r / rows) * reach));
  for (let r = 0; r < rows; r++)
    bridge(b, dome[r] as V[], dome[r + 1] as V[], (k) => out((dome[r] as V[])[k]?.p as Vec3), true);
  const apex = vtx(
    b,
    [0, baseY + 1.009 * L + crownOff * W, (knit ? -0.09 : -0.02) * W],
    shade(color, 1.04),
    s,
  );
  const top = dome[rows] as V[];
  for (let i = 0; i < sides; i++)
    triFacing(b, apex, top[i] as V, top[(i + 1) % sides] as V, [0, 1, 0]);
  // The band's edge rolls under, so the hat is never open from below.
  if (near) {
    const lip = ring(0, -0.025, 0.6);
    bridge(b, dome[0] as V[], lip, () => [0, -1, 0], true);
  }

  // A beanie's folded cuff over the band (left out far off, where the band reads alone).
  if (knit && tier < 2) {
    const cuffLow = ring(0, 0.045, 0.78);
    const cuffHigh: V[] = [];
    for (let i = 0; i < sides; i++) {
      const [a, sign] = fold(i);
      const p = head.shell(a, sign, hatBand(style, dmath.cos(a)) + 0.1, bandOff + 0.04);
      cuffHigh.push(vtx(b, p, shade(color, 0.78 * rib(a)), s));
    }
    bridge(b, cuffLow, cuffHigh, (k) => out((cuffLow[k] as V).p), true);
    if (near) {
      const under = ring(0, -0.004, 0.6);
      bridge(b, under, cuffLow, () => [0, -1, 0], true);
    }
  } else if (!knit) {
    // A cap's visor in front, or a sun hat's brim all round: a top and an underside.
    const brimDown = 0.012 * W;
    const pointsAt = (a: number, sign: number): [Vec3, Vec3] => {
      const inner = head.shell(a, sign, hatBand(style, dmath.cos(a)), bandOff);
      const flat = normalize([inner[0], 0, inner[2] - center[2]]);
      if (style === 'cap') {
        const dir = normalize([flat[0] * 0.65, 0, flat[2] * 0.65 + 0.35]);
        const len = 0.52 * W * (0.3 + 0.7 * dmath.cos(a));
        return [inner, add(inner, add(scale(dir, len), [0, -0.12 * len, 0]))];
      }
      const len = 0.42 * W * (1 + 0.12 * dmath.max(0, dmath.cos(a)));
      return [inner, add(inner, add(scale(flat, len), [0, -0.13 * len, 0]))];
    };
    const count = style === 'cap' ? (near ? 11 : tier === 1 ? 7 : 5) : sides;
    const topIn: V[] = [];
    const topOut: V[] = [];
    const lowIn: V[] = [];
    const lowOut: V[] = [];
    for (let k = 0; k < count; k++) {
      let a: number;
      let sign: number;
      if (style === 'cap') {
        const u = (k / (count - 1)) * 2 - 1;
        a = dmath.abs(u) * 1.3;
        sign = u >= 0 ? 1 : -1;
      } else [a, sign] = fold(k);
      const [inner, outer] = pointsAt(a, sign);
      topIn.push(vtx(b, inner, color, s));
      topOut.push(vtx(b, outer, shade(color, 1.05), s));
      lowIn.push(vtx(b, add(inner, [0, -brimDown, 0]), shade(color, 0.62), s));
      lowOut.push(vtx(b, add(outer, [0, -brimDown, 0]), shade(color, 0.7), s));
    }
    const closed = style !== 'cap';
    bridge(b, topIn, topOut, () => [0, 1, 0], closed);
    // Far off the underside is left out: figures are seen from about their own height.
    if (tier < 2) bridge(b, lowIn, lowOut, () => [0, -1, 0], closed);
    if (near)
      bridge(
        b,
        lowOut,
        topOut,
        (k) => normalize([(topOut[k] as V).p[0], 0, (topOut[k] as V).p[2] - center[2]]),
        closed,
      );
  }
  return (c, t) => {
    const tb = hatBand(style, c);
    if (t < tb) return 0;
    const f = dmath.clamp((t - tb) / (1 - tb) / reach, 0, 1);
    return offAt(f) + (knit && t < tb + 0.1 ? 0.045 : 0);
  };
}

function buildEyewear(
  sun: boolean,
  head: HumanHeadSurface,
  tier: FigureTier,
  b: SkinnedMeshBuilder,
  s: Skin,
  color: RGB,
): void {
  const near = tier === 0;
  // Far off only sunglasses read: two dark lenses.
  if (tier === 2 && !sun) return;
  const { W, L, baseY } = head;
  const { x: ex, t: et, scale: size } = head.eye;
  const k = dmath.sqrt(size);
  const rl = (sun ? 0.158 : 0.148) * k * W;
  const rv = (sun ? 0.112 : 0.104) * k * W;
  const rim = (sun ? 0.026 : 0.02) * W;
  const cy = baseY + (et + 0.006) * L;
  // The lens plane clears the face inside each lens, the brow above it and the cheek below.
  let zl = -1e9;
  for (const u of [-1, -0.5, 0, 0.5, 1])
    for (const v of [-1, -0.5, 0, 0.5, 1]) {
      if (u * u + v * v > 1.3) continue;
      const x = ex + (u * (rl + rim)) / W;
      const t = et + 0.006 + (v * (rv + rim)) / L;
      zl = dmath.max(zl, head.faceZ(x, t));
    }
  zl += 0.022 * W;
  const lens: RGB = mixRgb([0.05, 0.06, 0.07], color, 0.15);
  const n = near ? 12 : tier === 1 ? 8 : 4;
  for (const sign of [1, -1]) {
    const cx = sign * ex * W;
    const inner: V[] = [];
    const outer: V[] = [];
    const behind: V[] = [];
    for (let i = 0; i < n; i++) {
      const a = (dmath.TAU * i) / n;
      const ca = dmath.cos(a),
        sa = dmath.sin(a);
      inner.push(vtx(b, [cx + rl * ca, cy + rv * sa, zl], color, s));
      outer.push(vtx(b, [cx + (rl + rim) * ca, cy + (rv + rim) * sa, zl], color, s));
      if (near)
        behind.push(
          vtx(
            b,
            [cx + (rl + rim) * ca, cy + (rv + rim) * sa, zl - 0.016 * W],
            shade(color, 0.7),
            s,
          ),
        );
    }
    if (tier < 2) bridge(b, inner, outer, () => [0, 0, 1], true);
    if (near)
      bridge(
        b,
        behind,
        outer,
        (i) => [dmath.cos((dmath.TAU * i) / n), dmath.sin((dmath.TAU * i) / n), 0],
        true,
      );
    if (sun) {
      const mid = vtx(b, [cx, cy, zl - 0.002 * W], shade(lens, 1.2), s);
      const ring = inner.map((v) => vtx(b, [v.p[0], v.p[1], zl - 0.002 * W], lens, s));
      for (let i = 0; i < n; i++)
        triFacing(b, mid, ring[i] as V, ring[(i + 1) % n] as V, [0, 0, 1]);
    }
  }
  if (tier === 2) return;
  const bar = 0.011 * W;
  // The bridge arcs over the nose.
  const zb = dmath.max(zl, head.faceZ(0, et + 0.04) + 0.016 * W);
  const xi = ex * W - rl - rim * 0.4;
  sweep(
    b,
    [
      [-xi, cy + rv * 0.4, zl],
      [0, cy + rv * 0.55, zb],
      [xi, cy + rv * 0.4, zl],
    ],
    () => [0, 1, 0],
    bar,
    bar,
    color,
    () => s,
  );
  // Hinges stand off the temples; the arms run back above the ears.
  const hw = head.halfWidth(et) * W;
  const zh = dmath.min(zl, head.faceZ(head.halfWidth(et) * 0.8, et) + 0.03 * W);
  for (const sign of [1, -1]) {
    const corner: Vec3 = [sign * (ex * W + rl + rim * 0.6), cy + rv * 0.45, zl];
    const hinge: Vec3 = [sign * (hw + 0.03 * W), cy + rv * 0.45, zh];
    const end: Vec3 = [
      sign * dmath.max(hw + 0.03 * W, head.ear[0] + 0.03 * W),
      cy + rv * 0.1,
      head.ear[2] - 0.1 * W,
    ];
    sweep(
      b,
      near ? [corner, hinge, end] : [corner, end],
      () => [0, 1, 0],
      bar * 0.8,
      bar,
      color,
      () => s,
    );
  }
}

function buildHeadphones(
  head: HumanHeadSurface,
  tier: FigureTier,
  b: SkinnedMeshBuilder,
  s: Skin,
  color: RGB,
  hat: HatOffset | undefined,
  brimmed: boolean,
): void {
  const near = tier === 0;
  const { W, L, baseY } = head;
  const ear = head.ear;
  const earT = (ear[1] - baseY) / L;
  const sideHair = dmath.max(
    head.hair(0, earT),
    dmath.max(head.hair(-0.4, earT), head.hair(0.3, earT)),
  );
  const inner = (head.halfWidth(earT) + 0.012 + dmath.max(0.02, sideHair)) * W;
  const cupR = 0.17 * W;
  const cupX = inner + 0.07 * W;
  const segs = near ? 10 : tier === 1 ? 6 : 5;
  const cupRings = near ? 4 : tier === 1 ? 3 : 2;
  for (const sign of [1, -1]) {
    b.ellipsoid(
      REGION,
      [sign * cupX, ear[1], ear[2]],
      [1, 0, 0],
      [cupR * 0.9, cupR, 0.075 * W],
      segs,
      cupRings,
      s,
      color,
    );
  }
  // The band follows the head over the crown, clear of the hair and any hat. Under a sun hat's
  // brim it would cut through: there the cups are worn alone.
  if (brimmed || tier === 2) return;
  const a = dmath.PI / 2 + 0.12;
  const c = dmath.cos(a);
  const clear = (t: number): number => dmath.max(head.hair(c, t), hat ? hat(c, t) : 0) + 0.03;
  const steps = near ? 5 : 2;
  const startT = earT + (cupR * 0.9) / L;
  const side = (sign: number): Vec3[] => {
    const pts: Vec3[] = [[sign * cupX, ear[1] + cupR * 0.85, ear[2]]];
    for (let k = 1; k <= steps; k++) {
      const t = dmath.lerp(startT, 0.995, k / steps);
      pts.push(head.shell(a, sign, t, clear(t)));
    }
    return pts;
  };
  const left = side(1);
  const path = [...left, ...side(-1).reverse().slice(1)];
  const center: Vec3 = [0, baseY + 0.45 * L, ear[2]];
  sweep(
    b,
    path,
    (k) => sub(path[k] as Vec3, center),
    0.05 * W,
    0.018 * W,
    color,
    () => s,
  );
}

// --- body ------------------------------------------------------------------------------------

/** What the body accessories need of the torso as built (body-biped.ts). */
export interface HumanTorsoContext {
  b: SkinnedMeshBuilder;
  tier: FigureTier;
  /** Stature. */
  H: number;
  joint(name: string): number;
  /** A joint's bind position. */
  at(name: string): Vec3;
  /** The front of the torso (z), garment included, at (x, y). */
  front(x: number, y: number): number;
  /** How far behind the axis the back of the torso is (positive) at (x, y). */
  back(x: number, y: number): number;
  /** Whether a point is inside the torso, garment included (bind pose). */
  inside(p: Vec3): boolean;
  /** The torso's skin weights at a height. */
  skinAt(y: number): Skin;
  /** A ring around the neck on the slanted neck line (see body-biped's neckLine). */
  neckRing(y: number, rx: number, rz: number, s: Skin, color: RGB): RingRef;
  neckR: number;
  neckBaseY: number;
  shoulderY: number;
  shoulderHalf: number;
  /** Ring sides of the torso. */
  sides: number;
  /** A hood lies round the neck (a scarf rides over it). */
  hood: boolean;
  /** The left wrist: center, axis (elbow → hand), the sleeve or skin radius there, skin. */
  wrist: { center: Vec3; axis: Vec3; radius: number; skin: Skin };
  /** The waist line and half-widths, and the hip joint height. */
  waistY: number;
  waistRx: number;
  waistRz: number;
  hipsY: number;
  /** Half-width and half-depth over the hips, a hem or skirt included. */
  hipRx: number;
  hipRz: number;
}

/** A backpack's extent: its top, bottom, half-width and depth (absolute). */
export interface BackpackShape {
  top: number;
  bottom: number;
  halfWidth: number;
  depth: number;
  /** Gap between the pack and the back. */
  gap: number;
}

/** Where a backpack sits, from the shoulders and the waist. */
export function backpackShape(H: number, shoulderY: number, waistY: number): BackpackShape {
  return {
    top: shoulderY - 0.045 * H,
    bottom: waistY + 0.01 * H,
    halfWidth: 0.082 * H,
    depth: 0.075 * H,
    gap: 0.004 * H,
  };
}

/** A scarf, a backpack, a crossbody bag and a watch, as `d.features` asks. */
export function buildBodyAccessories(d: ResolvedFigureDescriptor, t: HumanTorsoContext): void {
  if (d.features.neckwear === 'scarf') buildScarf(t, accessoryColor(d, 'neckwear'));
  if (d.features.backwear === 'backpack') buildBackpack(t, accessoryColor(d, 'backwear'));
  if (d.features.bag === 'crossbody') buildBag(t, accessoryColor(d, 'bag'));
  if (d.features.wristwear === 'watch' && t.tier < 2) buildWatch(t, accessoryColor(d, 'wristwear'));
}

function buildScarf(t: HumanTorsoContext, color: RGB): void {
  const { b, H, neckR, neckBaseY } = t;
  const near = t.tier === 0;
  const k = t.hood ? 1.2 : 1;
  const sNeck = blend(t.joint('chest'), 0.7, t.joint('neck'), 0.3);
  const sChest = t.skinAt(neckBaseY - 0.02 * H);
  // A soft roll round the neck: on the collar, a little proud of it, closing onto the neck.
  const r0 = t.neckRing(
    neckBaseY - 0.018 * H,
    neckR * 1.42 * k,
    neckR * 1.33 * k,
    sChest,
    shade(color, 0.85),
  );
  const r1 = t.neckRing(neckBaseY - 0.002 * H, neckR * 1.46 * k, neckR * 1.37 * k, sNeck, color);
  const r2 = t.neckRing(
    neckBaseY + 0.015 * H,
    neckR * 1.18 * k,
    neckR * 1.1 * k,
    sNeck,
    shade(color, 0.95),
  );
  const r3 = t.neckRing(neckBaseY + 0.02 * H, neckR * 1.03, neckR * 0.97, sNeck, shade(color, 0.6));
  if (t.tier === 2) b.loft(REGION, r0, r2);
  else {
    b.loft(REGION, r0, r1);
    b.loft(REGION, r1, r2);
  }
  if (near) b.loft(REGION, r2, r3);
  // One end hangs down the front, a little to the left.
  const rows = near ? 6 : t.tier === 1 ? 3 : 1;
  const x0 = neckR * 0.55;
  const half = 0.02 * H;
  const y0 = neckBaseY - 0.012 * H;
  const y1 = neckBaseY - 0.16 * H;
  let prev: V[] | undefined;
  for (let r = 0; r <= rows; r++) {
    const y = dmath.lerp(y0, y1, r / rows);
    const x = x0 + 0.01 * H * (r / rows);
    const row: V[] = [];
    for (const dx of [-half, half]) {
      const px = x + dx;
      const z = t.front(px, y) + 0.014 * H;
      const end = r === rows;
      row.push(vtx(b, [px, y, z], end ? shade(color, 0.75) : color, t.skinAt(y)));
    }
    if (prev) bridge(b, row, prev, () => [0, 0, 1]);
    prev = row;
  }
}

/** Surface points round the shoulder in the plane x, from the back (`from`) to the front (`to`), angles from the vertical. */
function overShoulder(
  t: HumanTorsoContext,
  x: number,
  from: number,
  to: number,
  steps: number,
  lift: number,
): Vec3[] {
  const c: Vec3 = [x, t.shoulderY - 0.06 * t.H, -0.005 * t.H];
  const pts: Vec3[] = [];
  for (let k = 0; k <= steps; k++) {
    const a = dmath.lerp(from, to, k / steps);
    const dir: Vec3 = [0, dmath.cos(a), dmath.sin(a)];
    let r = 0;
    while (r < 0.3 * t.H && t.inside(add(c, scale(dir, r)))) r += 0.002 * t.H;
    pts.push(add(c, scale(dir, r + lift)));
  }
  return pts;
}

function buildBackpack(t: HumanTorsoContext, color: RGB): void {
  const { b, H } = t;
  const near = t.tier === 0;
  const pack = backpackShape(H, t.shoulderY, t.waistY);
  const sides = near ? 16 : t.tier === 1 ? 10 : 6;
  // Rows top to bottom: [height, size], rounded at both ends.
  const levels: readonly [number, number][] = near
    ? [
        [pack.top, 0.8],
        [pack.top - 0.012 * H, 0.97],
        [pack.top - 0.04 * H, 1],
        [dmath.lerp(pack.top, pack.bottom, 0.6), 1],
        [pack.bottom + 0.012 * H, 0.98],
        [pack.bottom, 0.82],
      ]
    : t.tier === 1
      ? [
          [pack.top, 0.85],
          [dmath.lerp(pack.top, pack.bottom, 0.4), 1],
          [pack.bottom, 0.9],
        ]
      : [
          [pack.top, 0.9],
          [pack.bottom, 0.9],
        ];
  const rings: V[][] = [];
  for (const [y, k] of levels) {
    const ring: V[] = [];
    for (let i = 0; i < sides; i++) {
      const a = (dmath.TAU * i) / sides;
      // A rounded rectangle: x across, q from the back (0) to the pack's outside (1).
      const ca = dmath.cos(a),
        sa = dmath.sin(a);
      const x = pack.halfWidth * k * dmath.sign(ca) * dmath.pow(dmath.abs(ca), 0.5);
      const q = 0.5 - 0.5 * dmath.sign(sa) * dmath.pow(dmath.abs(sa), 0.5);
      const qk = 0.5 + (q - 0.5) * k;
      const z = -(t.back(x, y) + pack.gap + qk * pack.depth);
      const outside = q > 0.9;
      ring.push(vtx(b, [x, y, z], shade(color, outside ? 1 : 0.9), t.skinAt(y)));
    }
    rings.push(ring);
  }
  const mid = (ring: V[]): Vec3 => {
    let x = 0,
      y = 0,
      z = 0;
    for (const v of ring) {
      x += v.p[0];
      y += v.p[1];
      z += v.p[2];
    }
    return [x / ring.length, y / ring.length, z / ring.length];
  };
  for (let r = 0; r + 1 < rings.length; r++) {
    const c = mid(rings[r] as V[]);
    bridge(
      b,
      rings[r + 1] as V[],
      rings[r] as V[],
      (k) => normalize(sub(((rings[r] as V[])[k] as V).p, c)),
      true,
    );
  }
  for (const [ring, up] of [
    [rings[0] as V[], 1],
    [rings[rings.length - 1] as V[], -1],
  ] as const) {
    const c = mid(ring);
    const apex = vtx(b, add(c, [0, up * 0.006 * H, 0]), shade(color, 0.95), t.skinAt(c[1]));
    for (let i = 0; i < sides; i++)
      triFacing(b, apex, ring[i] as V, ring[(i + 1) % sides] as V, [0, up, 0]);
  }
  if (near) {
    // A front pocket on the outside.
    const py = dmath.lerp(pack.top, pack.bottom, 0.62);
    b.box(
      REGION,
      [-pack.halfWidth * 0.6, py - 0.06 * H, -(t.back(0, py) + pack.gap + pack.depth + 0.018 * H)],
      [pack.halfWidth * 0.6, py, -(t.back(0, py) + pack.gap + pack.depth - 0.004 * H)],
      t.skinAt(py),
      shade(color, 0.85),
    );
  }
  if (t.tier === 2) return;
  // Straps from the pack's top over the shoulders and down the front to below the armpits.
  const strapColor = shade(color, 0.7);
  for (const sign of [1, -1]) {
    const x = sign * t.shoulderHalf * 0.5;
    const round = overShoulder(t, x, -1.2, 1.15, near ? 8 : 4, 0.007 * H);
    const lowY = t.shoulderY - 0.13 * H;
    const down: Vec3[] = [];
    const last = round[round.length - 1] as Vec3;
    const steps = near ? 4 : 2;
    for (let k = 1; k <= steps; k++) {
      const y = dmath.lerp(last[1], lowY, k / steps);
      const xx = dmath.lerp(x, sign * t.shoulderHalf * 0.62, k / steps);
      down.push([xx, y, t.front(xx, y) + 0.007 * H]);
    }
    const start: Vec3 = [
      x * 0.8,
      pack.top - 0.01 * H,
      -(t.back(x * 0.8, pack.top) + pack.gap + 0.3 * pack.depth),
    ];
    const path = [start, ...round, ...down];
    const center: Vec3 = [x, t.shoulderY - 0.06 * H, 0];
    sweep(
      b,
      path,
      (k) => sub(path[k] as Vec3, center),
      0.016 * H,
      0.004 * H,
      strapColor,
      (k) => t.skinAt((path[k] as Vec3)[1]),
      true,
    );
  }
}

function buildBag(t: HumanTorsoContext, color: RGB): void {
  const { b, H } = t;
  const near = t.tier === 0;
  const hips = t.joint('hips');
  // The bag sits at the right hip, a little forward, facing out.
  const yTop = t.waistY - 0.02 * H;
  const height = 0.1 * H;
  const halfW = 0.065 * H;
  const halfD = 0.02 * H;
  const outAngle = -0.95;
  const n: Vec3 = [dmath.sin(outAngle), 0, dmath.cos(outAngle)];
  const along: Vec3 = [n[2], 0, -n[0]];
  const reachX = dmath.max(t.waistRx * 1.08, t.hipRx) + halfD;
  const reachZ = dmath.max(t.waistRz * 1.12, t.hipRz) + halfD;
  const c: Vec3 = [n[0] * reachX, yTop - height / 2, n[2] * reachZ];
  const sides = near ? 12 : t.tier === 1 ? 8 : 4;
  const levels: readonly [number, number][] = near
    ? [
        [yTop, 0.9],
        [yTop - 0.008 * H, 1],
        [yTop - height + 0.01 * H, 1],
        [yTop - height, 0.88],
      ]
    : [
        [yTop, 0.95],
        [yTop - height, 0.95],
      ];
  const rings: V[][] = [];
  for (const [y, k] of levels) {
    const ring: V[] = [];
    for (let i = 0; i < sides; i++) {
      const a = (dmath.TAU * i) / sides + (sides === 4 ? dmath.PI / 4 : 0);
      const ca = dmath.cos(a),
        sa = dmath.sin(a);
      const u = halfW * k * dmath.sign(ca) * dmath.pow(dmath.abs(ca), 0.4);
      const v = halfD * k * dmath.sign(sa) * dmath.pow(dmath.abs(sa), 0.4);
      ring.push(
        vtx(
          b,
          [c[0] + along[0] * u + n[0] * v, y, c[2] + along[2] * u + n[2] * v],
          sa > 0.5 ? shade(color, 1.05) : color,
          [hips, 1, hips, 0],
        ),
      );
    }
    rings.push(ring);
  }
  for (let r = 0; r + 1 < rings.length; r++)
    bridge(
      b,
      rings[r + 1] as V[],
      rings[r] as V[],
      (k) =>
        normalize(
          sub(((rings[r] as V[])[k] as V).p, [c[0], ((rings[r] as V[])[k] as V).p[1], c[2]]),
        ),
      true,
    );
  for (const [ring, up] of [
    [rings[0] as V[], 1],
    [rings[rings.length - 1] as V[], -1],
  ] as const) {
    const apex = vtx(b, [c[0], (ring[0] as V).p[1], c[2]], color, [hips, 1, hips, 0]);
    for (let i = 0; i < sides; i++)
      triFacing(b, apex, ring[i] as V, ring[(i + 1) % sides] as V, [0, up, 0]);
  }
  if (near)
    // The flap over the front.
    b.box(
      REGION,
      [c[0] + n[0] * halfD - 0.03 * H, yTop - 0.045 * H, c[2] + n[2] * halfD - 0.002 * H],
      [c[0] + n[0] * halfD + 0.03 * H, yTop - 0.04 * H, c[2] + n[2] * halfD + 0.002 * H],
      [hips, 1, hips, 0],
      shade(color, 0.6),
    );
  if (t.tier === 2) return;
  // The strap: up the front from the bag across the chest, over the left shoulder, and down the
  // back to the right side.
  const strap = shade(color, 0.85);
  const x = t.shoulderHalf * 0.42;
  const round = overShoulder(t, x, -0.9, 1.0, near ? 7 : 3, 0.011 * H);
  const steps = near ? 7 : 3;
  const front: Vec3[] = [];
  const from: Vec3 = [c[0] - along[0] * halfW * 0.4, yTop, c[2] - along[2] * halfW * 0.4];
  const top = round[round.length - 1] as Vec3;
  for (let k = 1; k < steps; k++) {
    const f = k / steps;
    const xx = dmath.lerp(from[0], top[0], f);
    const y = dmath.lerp(from[1], top[1], f);
    front.push([xx, y, dmath.max(t.front(xx, y), dmath.lerp(from[2], top[2], f)) + 0.011 * H]);
  }
  const back: Vec3[] = [];
  const first = round[0] as Vec3;
  const to: Vec3 = [-t.waistRx * 1.02, t.waistY + 0.01 * H, -0.01 * H];
  for (let k = steps - 1; k >= 1; k--) {
    const f = k / steps;
    const xx = dmath.lerp(to[0], first[0], f);
    const y = dmath.lerp(to[1], first[1], f);
    back.push([xx, y, -(t.back(xx, y) + 0.011 * H)]);
  }
  const path = [from, ...front, ...[...round].reverse(), ...back, to];
  sweep(
    b,
    path,
    (k) => {
      const p = path[k] as Vec3;
      return [p[0] * 0.3, p[1] - (t.shoulderY - 0.1 * H), p[2]];
    },
    0.011 * H,
    0.003 * H,
    strap,
    (k) => t.skinAt((path[k] as Vec3)[1]),
    true,
  );
}

function buildWatch(t: HumanTorsoContext, color: RGB): void {
  const { b, H } = t;
  const { center, axis, radius, skin: s } = t.wrist;
  const near = t.tier === 0;
  const sides = near ? 10 : 6;
  const strap = (offset: number): RingRef =>
    b.ring(
      REGION,
      add(center, scale(axis, offset)),
      axis,
      radius + 0.003 * H,
      radius + 0.003 * H,
      sides,
      s,
      color,
    );
  const a = strap(-0.008 * H);
  const c = strap(0.008 * H);
  b.loft(REGION, c, a);
  // The face on the outside of the wrist.
  const out = normalize(cross([0, 0, 1], axis));
  const faceAt = add(center, scale(out, radius + 0.006 * H));
  b.disc(
    REGION,
    faceAt,
    out,
    0.0085 * H,
    near ? 10 : 6,
    s,
    mixRgb([0.78, 0.78, 0.76], color, 0.15),
  );
  if (near)
    b.ring(
      REGION,
      add(faceAt, scale(out, -0.002 * H)),
      out,
      0.0095 * H,
      0.0095 * H,
      10,
      s,
      [0.55, 0.56, 0.58],
    );
}
