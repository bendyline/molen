/**
 * Human garments as parameters of the one lofted body: a top is a record of what the torso
 * builder draws (collar, placket, pockets, how loose it hangs, what hem it has, whether it is an
 * open outer layer), not a second mesh. Legwear and footwear variants are radius and section
 * changes in the leg and shoe builders. Absent features are the reference garments (a button
 * shirt, trousers, shoes), drawn exactly as before.
 */

import { dmath } from '@bendyline/molen-kernel/determinism';
import type { FigureLegwearStyle, FigureTopStyle } from './types';

export interface TopSpec {
  /**
   * `shirt`: a collar band and collar points; `crew`: the band alone; `lapel`: wide lapels over
   * an open front; `hood`: the band and a hood lying behind the neck.
   */
  collar: 'shirt' | 'crew' | 'lapel' | 'hood';
  /** Button strip: down the whole front, the top few rows (a polo), or none. */
  placket: 'full' | 'short' | 'none';
  /** Breast pockets (near detail, without a bust). */
  pockets: boolean;
  /** A pouch pocket across the belly (a hoodie's). */
  pouch: boolean;
  /** Torso and sleeve fullness over the body (1 = fitted). */
  ease: number;
  /**
   * Below the waist: `none` (tucked in, the belt shows), `band` (a ribbed hem over the belt),
   * `hip` (to the hip), `thigh` (to mid-thigh, swinging with the legs), `skirt` (a dress: the
   * knee-length skirt in the top color over bare legs).
   */
  hem: 'none' | 'band' | 'hip' | 'thigh' | 'skirt';
  /** An open outer layer in `palette.outer`, the shirt under it showing down the front. */
  outer: boolean;
}

export const TOP_SPECS: Readonly<Record<FigureTopStyle, TopSpec>> = {
  shirt: {
    collar: 'shirt',
    placket: 'full',
    pockets: true,
    pouch: false,
    ease: 1,
    hem: 'none',
    outer: false,
  },
  tee: {
    collar: 'crew',
    placket: 'none',
    pockets: false,
    pouch: false,
    ease: 1,
    hem: 'none',
    outer: false,
  },
  tank: {
    collar: 'crew',
    placket: 'none',
    pockets: false,
    pouch: false,
    ease: 1,
    hem: 'none',
    outer: false,
  },
  polo: {
    collar: 'shirt',
    placket: 'short',
    pockets: false,
    pouch: false,
    ease: 1,
    hem: 'none',
    outer: false,
  },
  sweater: {
    collar: 'crew',
    placket: 'none',
    pockets: false,
    pouch: false,
    ease: 1.04,
    hem: 'band',
    outer: false,
  },
  hoodie: {
    collar: 'hood',
    placket: 'none',
    pockets: false,
    pouch: true,
    ease: 1.05,
    hem: 'band',
    outer: false,
  },
  jacket: {
    collar: 'lapel',
    placket: 'none',
    pockets: false,
    pouch: false,
    ease: 1.06,
    hem: 'hip',
    outer: true,
  },
  coat: {
    collar: 'lapel',
    placket: 'none',
    pockets: false,
    pouch: false,
    ease: 1.08,
    hem: 'thigh',
    outer: true,
  },
  dress: {
    collar: 'crew',
    placket: 'none',
    pockets: false,
    pouch: false,
    ease: 1,
    hem: 'skirt',
    outer: false,
  },
};

/** The spec of a top (absent = the shirt). */
export function topSpec(top: FigureTopStyle | undefined): TopSpec {
  return TOP_SPECS[top ?? 'shirt'];
}

/**
 * The leg radius factor of a trouser cut at a station (`t`: 0 hip, 1 knee, 2 ankle): slim cuts
 * taper below the knee, wide ones flare. Exactly 1 for every other legwear.
 */
export function legwearRadius(legs: FigureLegwearStyle, t: number): number {
  if (legs === 'slim')
    return t > 0.9 ? 1 - 0.16 * dmath.smoothstep(dmath.clamp((t - 0.9) / 1.04, 0, 1)) : 1;
  if (legs === 'wide')
    return t > 0.7 ? 1 + 0.42 * dmath.smoothstep(dmath.clamp((t - 0.7) / 1.24, 0, 1)) : 1;
  return 1;
}

/** Where the leg is bare from (a station `t`, see legwearRadius), else beyond the ankle. */
export function legwearBareFrom(legs: FigureLegwearStyle, skirtLike: boolean): number {
  if (skirtLike) return -1;
  if (legs === 'shorts') return 0.5;
  if (legs === 'cropped') return 1.55;
  return 9;
}
