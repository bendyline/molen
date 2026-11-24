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

/** A leg section's radii in limb radii: outward, inward, in front of and behind its centre. */
export type LegRadii = readonly [out: number, inner: number, front: number, back: number];

interface LegwearCut {
  /** Fullness over the leg (1 = skin tight). */
  ease: number;
  /**
   * The least radius of the leg tube by station (`t`: 0 hip, 1 knee, 2 ankle), in limb radii and
   * linear between entries: where cloth hangs clear of the leg instead of following it.
   */
  drape: readonly (readonly [t: number, r: number])[];
  /** The hem's station: the leg is bare below it (9: the hem is at the shoe). */
  hem: number;
}

/**
 * Trouser cuts. Cloth hangs from the seat and thigh, so a regular leg is a near-straight tube
 * about 0.08 of stature across at the knee and 0.07 at the hem: drawn skin tight, trousers read
 * as leggings and the legs as long and thin.
 */
const LEGWEAR: Readonly<Record<FigureLegwearStyle, LegwearCut>> = {
  long: {
    ease: 1.06,
    drape: [
      [0.5, 1.2],
      [1, 1.16],
      [1.4, 1.1],
      [2, 1.02],
    ],
    hem: 9,
  },
  slim: {
    ease: 1.05,
    drape: [
      [1, 0.98],
      [1.5, 0.9],
      [2, 0.74],
    ],
    hem: 9,
  },
  wide: {
    ease: 1.08,
    drape: [
      [0.4, 1.4],
      [1, 1.38],
      [1.5, 1.56],
      [2, 1.72],
    ],
    hem: 9,
  },
  cropped: {
    ease: 1.06,
    drape: [
      [0.5, 1.2],
      [1, 1.16],
      [1.55, 1.1],
    ],
    hem: 1.55,
  },
  shorts: {
    ease: 1.1,
    drape: [
      [0.27, 1.5],
      [0.68, 1.42],
    ],
    hem: 0.68,
  },
  skirt: { ease: 1, drape: [], hem: -1 },
};

/**
 * A trouser leg's section at a station (`t`: 0 hip, 1 knee, 2 ankle) over the leg's own: the leg
 * with the cut's ease, or the cut's drape where that is fuller.
 */
export function legwearSection(legs: FigureLegwearStyle, t: number, body: LegRadii): LegRadii {
  const cut = LEGWEAR[legs];
  let drape = 0;
  const table = cut.drape;
  for (let i = 0; i < table.length; i++) {
    const [t1, r1] = table[i] as readonly [number, number];
    if (i === 0 && t < t1) break;
    const next = table[i + 1];
    if (next === undefined || t <= next[0]) {
      drape = next === undefined ? r1 : dmath.lerp(r1, next[1], (t - t1) / (next[0] - t1));
      break;
    }
  }
  return [
    dmath.max(body[0] * cut.ease, drape),
    dmath.max(body[1] * cut.ease, drape),
    dmath.max(body[2] * cut.ease, drape),
    dmath.max(body[3] * cut.ease, drape),
  ];
}

/** Where the leg is bare from (a station `t`, see legwearSection), else beyond the ankle. */
export function legwearBareFrom(legs: FigureLegwearStyle, skirtLike: boolean): number {
  return skirtLike ? -1 : LEGWEAR[legs].hem;
}

/** Whether a trouser leg reaches the shoe and falls over a boot's shaft (slim legs tuck in). */
export function legwearOverBoot(legs: FigureLegwearStyle): boolean {
  return legs === 'long' || legs === 'wide';
}
